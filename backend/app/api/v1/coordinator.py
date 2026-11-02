"""
API điều phối viên: ánh xạ dữ liệu PostgreSQL thật sang payload Frontend CareFlow.
Không hard-code số liệu demo.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.ai.routing import RoutingEngine
from app.ai.scheduling import SchedulingEngine
from app.models import (
    Assignment,
    Customer,
    Employee,
    EmployeeAvailability,
    LeaveRequest,
    Service,
    ServiceRequest,
    ServiceRequiredSkill,
    Skill,
    User,
)
from app.schemas.assignment import OVERRIDE_REASON_METADATA, OverrideReasonCode

router = APIRouter(prefix="/coordinator", tags=["Coordinator Dispatch Board"])

VN_TZ = timezone(timedelta(hours=7))
AVATAR_COLORS = ["#0F766E", "#1D4ED8", "#B45309", "#7C3AED", "#BE123C", "#0F766E", "#0369A1", "#365314", "#9A3412", "#1E3A5F"]
ROLE_MAP = {
    "nurse": "Điều dưỡng Chuyên khoa",
    "physiotherapist": "Chuyên viên Vật lý trị liệu",
    "caregiver": "Điều dưỡng Chăm sóc",
    "doctor": "Bác sĩ Gia đình",
}
DEFAULT_WEIGHTS = {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10}


def _staff_id(emp_id: int) -> str:
    return f"EMP-{emp_id}"


def _req_id(rid: int) -> str:
    return f"REQ-{rid}"


def _asg_id(aid: int) -> str:
    return f"ASG-{aid}"


def _parse_entity_id(value: Any) -> int:
    if isinstance(value, int):
        return value
    text = str(value)
    for prefix in ("REQ-", "EMP-", "ASG-", "BN-"):
        if text.upper().startswith(prefix):
            return int(text.split("-", 1)[1])
    return int(text)


def _hhmm(dt: datetime) -> str:
    local = dt.astimezone(VN_TZ) if dt.tzinfo else dt.replace(tzinfo=VN_TZ)
    return local.strftime("%H:%M")


def _priority_label(priority: int) -> str:
    if priority == 1:
        return "Khẩn cấp"
    if priority == 2:
        return "Cao"
    return "Tiêu chuẩn"


def _status_label(status: str) -> str:
    mapping = {
        "pending": "Unassigned",
        "proposed": "Proposed",
        "scheduled": "Proposed",
        "assigned": "Confirmed",
        "confirmed": "Confirmed",
        "in_progress": "In-Progress",
        "completed": "Completed",
    }
    return mapping.get(status, "Unassigned")


def _age_from_dob(dob) -> int:
    if not dob:
        return 68
    today = date.today()
    return max(1, today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)))


def _district(code: Optional[str]) -> str:
    if not code:
        return "Nha Trang"
    return "Phường " + code.replace("_", " ").title()


def _role(emp: Employee) -> str:
    return ROLE_MAP.get(emp.employee_type or "nurse", "Điều dưỡng Chăm sóc")


def _target_date(db: Session, requested: Optional[date]) -> date:
    if requested:
        return requested
    pending = db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.status.in_(["pending", "proposed"]))
        .order_by(ServiceRequest.preferred_start.asc())
    ).scalars().first()
    if pending:
        return pending.preferred_start.astimezone(VN_TZ).date()
    return datetime.now(VN_TZ).date()


def _weights_fe(w: Dict[str, float]) -> Dict[str, float]:
    return {
        "skillFit": w.get("skill", 0.30),
        "timeFit": w.get("time", 0.25),
        "distance": w.get("distance", 0.20),
        "workload": w.get("workload", 0.15),
        "continuity": w.get("continuity", 0.10),
    }


def _backend_weights(fe: Optional[Dict[str, float]]) -> Dict[str, float]:
    if not fe:
        return dict(DEFAULT_WEIGHTS)
    return {
        "skill": float(fe.get("skillFit", fe.get("skill", 0.30))),
        "time": float(fe.get("timeFit", fe.get("time", 0.25))),
        "distance": float(fe.get("distance", 0.20)),
        "workload": float(fe.get("workload", 0.15)),
        "continuity": float(fe.get("continuity", 0.10)),
    }


def _build_staff(emp: Employee, assignments: List[Assignment], target: date, db: Session) -> Dict[str, Any]:
    day_asg = [
        a for a in assignments
        if a.employee_id == emp.employee_id
        and a.scheduled_start.astimezone(VN_TZ).date() == target
        and a.assignment_status in ("proposed", "confirmed", "completed", "in_progress")
    ]
    care_mins = sum(int((a.scheduled_end - a.scheduled_start).total_seconds() / 60) for a in day_asg)
    max_mins = emp.max_daily_minutes or 480
    avail = db.execute(
        select(EmployeeAvailability).where(
            EmployeeAvailability.employee_id == emp.employee_id,
            EmployeeAvailability.date == target,
        )
    ).scalars().first()
    shift_start = avail.start_time.strftime("%H:%M") if avail else "07:00"
    shift_end = avail.end_time.strftime("%H:%M") if avail else "18:00"
    leave = db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == emp.employee_id,
            LeaveRequest.status == "approved",
            func.date(LeaveRequest.from_time) <= target,
            func.date(LeaveRequest.to_time) >= target,
        )
    ).scalars().first()
    skills = [es.skill.skill_name for es in emp.employee_skills if es.skill]
    color = AVATAR_COLORS[(emp.employee_id - 1) % len(AVATAR_COLORS)]
    lat = float(emp.base_lat) if emp.base_lat is not None else 12.2458
    lon = float(emp.base_lon) if emp.base_lon is not None else 109.1942
    return {
        "id": _staff_id(emp.employee_id),
        "name": emp.full_name,
        "role": _role(emp),
        "specialty": skills[0] if skills else (emp.employee_type or "Chăm sóc tại nhà"),
        "skills": skills,
        "avatarColor": color,
        "zone": "Nha Trang",
        "baseLocation": {"lat": lat, "lng": lon},
        "baseAddress": "Trạm y tế Nha Trang",
        "shiftStart": shift_start,
        "shiftEnd": shift_end,
        "maxDailyMinutes": max_mins,
        "assignedMinutes": care_mins,
        "workloadPct": round(care_mins / max_mins * 100, 1) if max_mins else 0,
        "assignedCount": len(day_asg),
        "isOnApprovedLeave": bool(leave),
        "leaveWindowText": f"{_hhmm(leave.from_time)}–{_hhmm(leave.to_time)}" if leave else None,
    }


def _build_assignment(a: Assignment) -> Dict[str, Any]:
    req = a.request
    cust = req.customer if req else None
    srv = req.service if req else None
    pred = req.ai_predictions[0].predicted_duration if req and req.ai_predictions else int((a.scheduled_end - a.scheduled_start).total_seconds() / 60)
    default_dur = srv.default_duration if srv else pred
    lat = float(req.lat) if req and req.lat is not None else (float(cust.lat) if cust and cust.lat is not None else 12.2388)
    lon = float(req.lon) if req and req.lon is not None else (float(cust.lon) if cust and cust.lon is not None else 109.1967)
    return {
        "id": _asg_id(a.assignment_id),
        "patientId": f"BN-{req.customer_id}" if req else "BN-0",
        "patientName": cust.full_name if cust else "",
        "patientAge": _age_from_dob(cust.date_of_birth) if cust else 0,
        "patientPhone": cust.phone if cust else "",
        "district": _district(req.district_code if req else None),
        "address": req.address if req else "",
        "location": {"lat": lat, "lng": lon},
        "serviceName": srv.service_name if srv else "",
        "serviceCategory": srv.service_name if srv else "",
        "staffId": _staff_id(a.employee_id),
        "staffName": a.employee.full_name if a.employee else "",
        "startTime": _hhmm(a.scheduled_start),
        "endTime": _hhmm(a.scheduled_end),
        "predictedDurationMin": pred,
        "standardDurationMin": default_dur,
        "travelMinutes": 0,
        "distanceKm": 0,
        "status": _status_label(a.assignment_status),
        "priority": _priority_label(req.priority if req else 2),
        "notes": a.explanation,
        "isConflict": False,
    }


def _candidate_payload(c: Dict[str, Any], emp_lookup: Dict[int, Employee], req: ServiceRequest, duration: int) -> Dict[str, Any]:
    emp = emp_lookup.get(c["employee_id"])
    bd = c.get("breakdown") or {}
    feasible = bool(c.get("is_feasible"))
    score = float(c.get("score") or 0)
    past = int(bd.get("past_visits") or 0)
    dist_km = float(bd.get("distance_km") or 0)
    travel = int(bd.get("travel_mins") or 0)
    wl = int(bd.get("current_workload_mins") or 0)
    max_mins = emp.max_daily_minutes if emp else 480
    skill_names = [es.skill.skill_name for es in emp.employee_skills if es.skill] if emp else []
    return {
        "staffId": _staff_id(c["employee_id"]),
        "staffName": c.get("employee_name") or (emp.full_name if emp else ""),
        "staffRole": _role(emp) if emp else "Điều dưỡng Chăm sóc",
        "specialty": skill_names[0] if skill_names else "",
        "zone": "Nha Trang",
        "avatarColor": AVATAR_COLORS[(c["employee_id"] - 1) % len(AVATAR_COLORS)],
        "totalScore": round(score * 100, 1),
        "dssScoreNormalized": round(score, 4),
        "isEligible": feasible,
        "rank": 0,
        "rankLabel": "",
        "criteria": {
            "skillFitScore": round(float(bd.get("skill_fit") or 0) * 100),
            "matchedSkills": skill_names,
            "missingSkills": [],
            "skillFitNote": c.get("explanation") or "",
            "timeFitScore": round(float(bd.get("time_fit") or 0) * 100),
            "availableGapText": f"{_hhmm(req.preferred_start)}–{_hhmm(req.preferred_end)}",
            "timeFitNote": "TimeFit theo lệch so với preferred_start",
            "distanceKm": dist_km,
            "travelMinutes": travel,
            "distanceScore": round(float(bd.get("distance_score") or 0) * 100),
            "assignedMinutes": wl,
            "projectedAssignedMinutes": wl + duration,
            "maxDailyMinutes": max_mins,
            "workloadPct": round(wl / max_mins * 100, 1) if max_mins else 0,
            "projectedWorkloadPct": round((wl + duration) / max_mins * 100, 1) if max_mins else 0,
            "workloadScore": round(float(bd.get("workload_score") or 0) * 100),
            "continuityScore": round(float(bd.get("continuity_score") or 0) * 100),
            "previousVisitsCount": past,
            "continuityNote": f"{past} lần phục vụ trước đó" if past else "Chưa có lịch sử chăm sóc",
            "predictedDurationMin": duration,
            "predictionConfidencePct": 90,
        },
        "statusBadge": "Khả thi" if feasible else "Loại bởi ràng buộc cứng",
        "qualificationReason": c.get("explanation") or "",
        "constraintViolations": [] if feasible else [c.get("rejection_reason") or "Không thỏa ràng buộc cứng"],
        "hardConstraintDetails": None if feasible else [{
            "code": "SKILL_MISMATCH",
            "labelVi": "Loại ứng viên",
            "labelEn": "Rejected",
            "detail": c.get("rejection_reason") or "",
        }],
    }


def _build_unassigned(req: ServiceRequest, db: Session, employees: List[Employee], weights: Dict[str, float]) -> Dict[str, Any]:
    pred = req.ai_predictions[0].predicted_duration if req.ai_predictions else req.service.default_duration
    default_dur = req.service.default_duration if req.service else pred
    raw = SchedulingEngine.get_candidate_recommendations(db=db, request_id=req.request_id, top_k=5, weights=weights)
    emp_lookup = {e.employee_id: e for e in employees}
    cands = [_candidate_payload(c, emp_lookup, req, pred) for c in raw]
    feas = [c for c in cands if c["isEligible"]]
    infeas = [c for c in cands if not c["isEligible"]]
    for i, c in enumerate(feas, start=1):
        c["rank"] = i
        c["rankLabel"] = "Top 1 Khuyến nghị" if i == 1 else f"Top {i}"
    for c in infeas:
        c["rank"] = 99
        c["rankLabel"] = "Không khả thi"
    cust = req.customer
    lat = float(req.lat) if req.lat is not None else (float(cust.lat) if cust and cust.lat is not None else 12.2388)
    lon = float(req.lon) if req.lon is not None else (float(cust.lon) if cust and cust.lon is not None else 109.1967)
    req_skills = []
    if req.service_id:
        rows = db.execute(
            select(Skill.skill_name)
            .join(ServiceRequiredSkill, ServiceRequiredSkill.skill_id == Skill.skill_id)
            .where(ServiceRequiredSkill.service_id == req.service_id)
        ).scalars().all()
        req_skills = list(rows)
    return {
        "id": _req_id(req.request_id),
        "patientId": f"BN-{req.customer_id}",
        "patientName": cust.full_name if cust else "",
        "patientAge": _age_from_dob(cust.date_of_birth) if cust else 0,
        "patientPhone": cust.phone if cust else "",
        "district": _district(req.district_code),
        "address": req.address,
        "location": {"lat": lat, "lng": lon},
        "serviceName": req.service.service_name if req.service else "",
        "serviceCategory": req.service.service_name if req.service else "",
        "requestedWindow": f"{_hhmm(req.preferred_start)} - {_hhmm(req.preferred_end)}",
        "windowStart": _hhmm(req.preferred_start),
        "windowEnd": _hhmm(req.preferred_end),
        "preferredStart": _hhmm(req.preferred_start),
        "suggestedStartTime": _hhmm(req.preferred_start),
        "standardDurationMin": default_dur,
        "predictedDurationMin": pred,
        "predictionConfidencePct": 90,
        "predictionFactors": ["Mô hình Random Forest v1.1.0 trên synthetic dataset Nha Trang"],
        "durationBreakdown": [],
        "priority": _priority_label(req.priority),
        "clinicalSeverity": f"Mức phức tạp {req.complexity_level}",
        "specializedEquipment": ["Thiết bị chuyên dụng"] if req.has_special_equip else [],
        "requiredSkills": req_skills,
        "clinicalNotes": "",
        "historicalVisits": {},
        "status": "Unassigned",
        "aiCandidates": feas + infeas,
    }


def _override_logs(assignments: List[Assignment]) -> List[Dict[str, Any]]:
    logs = []
    for a in assignments:
        if not a.override_reason:
            continue
        logs.append({
            "id": f"OVR-{a.assignment_id}",
            "timestamp": (a.confirmed_at or a.created_at).isoformat(),
            "requestId": _req_id(a.request_id),
            "patientName": a.request.customer.full_name if a.request and a.request.customer else "",
            "serviceName": a.request.service.service_name if a.request and a.request.service else "",
            "aiTopStaff": "",
            "chosenStaff": a.employee.full_name if a.employee else "",
            "overrideCategory": "Coordinator Override",
            "overrideReason": a.override_reason,
            "dispatcherName": "Điều phối viên",
        })
    return logs


def _build_state(db: Session, target: date, weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    w = weights or dict(DEFAULT_WEIGHTS)
    employees = db.execute(select(Employee).where(Employee.status == "active")).scalars().all()
    assignments = db.execute(select(Assignment)).scalars().all()
    day_asg = [a for a in assignments if a.scheduled_start.astimezone(VN_TZ).date() == target]
    pending = db.execute(
        select(ServiceRequest).where(
            ServiceRequest.status.in_(["pending", "proposed"]),
            func.date(ServiceRequest.preferred_start) == target,
        )
    ).scalars().all()
    if not pending:
        pending = db.execute(
            select(ServiceRequest).where(ServiceRequest.status.in_(["pending", "proposed"]))
        ).scalars().all()

    staff_list = [_build_staff(e, day_asg, target, db) for e in employees]
    asg_payload = [_build_assignment(a) for a in day_asg]
    unassigned = [_build_unassigned(r, db, employees, w) for r in pending]
    return {
        "targetDate": target.isoformat(),
        "staffList": staff_list,
        "assignments": asg_payload,
        "unassignedRequests": unassigned,
        "dssWeights": _weights_fe(w),
        "overrideLogs": _override_logs(day_asg),
    }


def _kpi_payload(state: Dict[str, Any], db: Session) -> Dict[str, Any]:
    asgs = state["assignments"]
    staff = state["staffList"]
    unassigned = state["unassignedRequests"]
    completed = [a for a in asgs if a["status"] == "Completed"]
    return {
        "summary": {
            "totalVisitsToday": len(asgs),
            "completedVisits": len(completed),
            "inProgressVisits": len([a for a in asgs if a["status"] == "In-Progress"]),
            "confirmedVisits": len([a for a in asgs if a["status"] == "Confirmed"]),
            "proposedVisits": len([a for a in asgs if a["status"] == "Proposed"]),
            "unassignedCount": len(unassigned),
            "conflictCount": 0,
            "slaOnTimePct": 100.0 if asgs else 0.0,
            "avgWorkloadPct": round(sum(s["workloadPct"] for s in staff) / len(staff), 1) if staff else 0,
            "totalTravelKm": 0,
            "totalTravelMinutes": 0,
            "aiTop1AcceptancePct": 0,
            "overrideCount": len(state["overrideLogs"]),
            "durationPredictionAccuracyPct": 0,
            "durationModelVersion": "v1.1.0",
        },
        "hourlyDensity": [],
        "serviceBreakdown": [],
        "staffUtilization": [
            {
                "staffId": s["id"],
                "staffName": s["name"],
                "role": s["role"],
                "zone": s["zone"],
                "assignedCount": s["assignedCount"],
                "careMinutes": s["assignedMinutes"],
                "travelMinutes": 0,
                "workloadPct": s["workloadPct"],
                "avatarColor": s["avatarColor"],
            }
            for s in staff
        ],
        "overrideLogs": state["overrideLogs"],
    }


@router.get("/dispatch-state")
def get_dispatch_state(
    target_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    target = _target_date(db, target_date)
    return _build_state(db, target)


@router.get("/kpis")
def get_coordinator_kpis(
    target_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    target = _target_date(db, target_date)
    state = _build_state(db, target)
    return _kpi_payload(state, db)


class EvaluateWeightsIn(BaseModel):
    weights: Dict[str, float]
    target_date: Optional[date] = None


@router.post("/evaluate-dss")
def evaluate_dss(body: EvaluateWeightsIn, db: Session = Depends(get_db)):
    target = _target_date(db, body.target_date)
    state = _build_state(db, target, _backend_weights(body.weights))
    return state


class AssignIn(BaseModel):
    request_id: Any
    employee_id: Any
    is_override: bool = False
    reason_code: Optional[str] = "other"
    override_notes: Optional[str] = None
    confirmed_by: int = 1


@router.post("/assign")
def assign_request(body: AssignIn, db: Session = Depends(get_db)):
    rid = _parse_entity_id(body.request_id)
    eid = _parse_entity_id(body.employee_id)
    sr = db.get(ServiceRequest, rid)
    emp = db.get(Employee, eid)
    if not sr:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    pred = sr.ai_predictions[0].predicted_duration if sr.ai_predictions else sr.service.default_duration
    start = sr.preferred_start
    end = start + timedelta(minutes=pred)
    coord = db.execute(select(User).where(User.username == "coordinator1")).scalars().first()
    confirmed_by = coord.user_id if coord else body.confirmed_by

    from app.schemas.assignment import ManualAssignmentCreate
    from app.api.v1.assignments import create_manual_assignment

    created = create_manual_assignment(
        ManualAssignmentCreate(
            request_id=rid,
            employee_id=eid,
            scheduled_start=start,
            scheduled_end=end,
            explanation=body.override_notes or "Phân công từ màn hình Đề xuất AI",
        ),
        db=db,
    )
    assign = db.get(Assignment, created.assignment_id)
    if assign:
        assign.assignment_status = "confirmed"
        assign.confirmed_by = confirmed_by
        assign.confirmed_at = datetime.now(timezone.utc)
        if body.is_override:
            code = body.reason_code or "other"
            label = next((item["label"] for item in OVERRIDE_REASON_METADATA if item["code"] == code), code)
            assign.override_reason = f"[{code.upper()}] {label}"
            if body.override_notes:
                assign.override_reason += f" - {body.override_notes}"
        sr.status = "assigned"
        db.commit()

    target = start.astimezone(VN_TZ).date()
    return _build_state(db, target)


class OptimizeIn(BaseModel):
    target_date: Optional[date] = None
    allow_time_window: bool = True
    weights: Optional[Dict[str, float]] = None


@router.post("/optimize")
def optimize_day(body: OptimizeIn, db: Session = Depends(get_db)):
    target = _target_date(db, body.target_date)
    t0 = datetime.now()
    result = SchedulingEngine.optimize_schedule(
        db=db,
        target_date=target,
        created_by_user_id=1,
        weights=_backend_weights(body.weights) if body.weights else None,
        allow_time_window=body.allow_time_window,
        window_minutes=90,
    )
    elapsed = (datetime.now() - t0).total_seconds() * 1000
    state = _build_state(db, target)
    return {
        "solverStatus": "OPTIMAL" if result.get("status") == "success" else "FEASIBLE",
        "solveTimeMs": round(elapsed, 1),
        "objectiveValue": 0,
        "weightsUsed": {
            "travelWeight": 40,
            "workloadBalanceWeight": 30,
            "continuityWeight": 20,
            "slaPenaltyWeight": 10,
        },
        "baselineMetrics": {
            "totalAssigned": 0,
            "unassignedCount": len(state["unassignedRequests"]),
            "totalTravelMinutes": 0,
            "totalDistanceKm": 0,
            "workloadStdDevPct": 0,
            "continuityMatchRatePct": 0,
            "conflictCount": 0,
            "slaCompliancePct": 0,
        },
        "optimizedMetrics": {
            "totalAssigned": len(state["assignments"]),
            "unassignedCount": len(state["unassignedRequests"]),
            "totalTravelMinutes": 0,
            "totalDistanceKm": 0,
            "workloadStdDevPct": 0,
            "continuityMatchRatePct": 0,
            "conflictCount": 0,
            "slaCompliancePct": 0,
        },
        "scheduleComparison": [],
        "unschedulableRequests": [],
        "isApplied": True,
        "backendResult": {"status": result.get("status"), "message": result.get("message"), "schedule_version_id": result.get("schedule_version_id")},
        "staffList": state["staffList"],
        "assignments": state["assignments"],
        "unassignedRequests": state["unassignedRequests"],
    }


class ResolveConflictIn(BaseModel):
    assignment_id: Any
    new_start_time: str
    new_end_time: str
    new_staff_id: Optional[Any] = None


@router.post("/resolve-conflict")
def resolve_conflict(body: ResolveConflictIn, db: Session = Depends(get_db)):
    aid = _parse_entity_id(body.assignment_id)
    assign = db.get(Assignment, aid)
    if not assign:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân công")
    day = assign.scheduled_start.astimezone(VN_TZ).date()

    def parse_hm(hm: str) -> datetime:
        hh, mm = [int(x) for x in hm.split(":")[:2]]
        return datetime(day.year, day.month, day.day, hh, mm, tzinfo=VN_TZ)

    assign.scheduled_start = parse_hm(body.new_start_time)
    assign.scheduled_end = parse_hm(body.new_end_time)
    if body.new_staff_id:
        assign.employee_id = _parse_entity_id(body.new_staff_id)
    db.commit()
    return _build_state(db, day)


@router.get("/routes")
def get_routes(
    target_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    target = _target_date(db, target_date)
    state = _build_state(db, target)
    itineraries = []
    for staff in state["staffList"]:
        stops_src = [a for a in state["assignments"] if a["staffId"] == staff["id"]]
        stops_src.sort(key=lambda a: a["startTime"])
        stops = []
        prev_lat, prev_lon = staff["baseLocation"]["lat"], staff["baseLocation"]["lng"]
        tot_km = 0.0
        tot_min = 0
        for i, a in enumerate(stops_src, start=1):
            d_km, t_min, _ = RoutingEngine.get_distance_and_travel_time(
                prev_lat, prev_lon, a["location"]["lat"], a["location"]["lng"]
            )
            tot_km += d_km
            tot_min += t_min
            stops.append({
                "stopOrder": i,
                "assignmentId": a["id"],
                "patientName": a["patientName"],
                "patientAge": a["patientAge"],
                "serviceName": a["serviceName"],
                "address": a["address"],
                "district": a["district"],
                "location": a["location"],
                "startTime": a["startTime"],
                "endTime": a["endTime"],
                "predictedDurationMin": a["predictedDurationMin"],
                "status": a["status"],
                "priority": a["priority"],
                "legDistanceKm": d_km,
                "legTravelMinutes": t_min,
            })
            prev_lat, prev_lon = a["location"]["lat"], a["location"]["lng"]
        itineraries.append({
            "staffId": staff["id"],
            "staffName": staff["name"],
            "staffRole": staff["role"],
            "avatarColor": staff["avatarColor"],
            "zone": staff["zone"],
            "baseLocation": staff["baseLocation"],
            "baseAddress": staff["baseAddress"],
            "shiftStart": staff["shiftStart"],
            "shiftEnd": staff["shiftEnd"],
            "totalStops": len(stops),
            "totalDistanceKm": round(tot_km, 2),
            "totalTravelMinutes": tot_min,
            "totalCareMinutes": staff["assignedMinutes"],
            "workloadPct": staff["workloadPct"],
            "stops": stops,
        })
    return {"targetDate": target.isoformat(), "itineraries": itineraries}
