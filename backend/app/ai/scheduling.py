"""
Module: scheduling.py
Mục đích:
- Hệ thống điều phối và tối ưu hóa phân công nhân sự y tế (Scheduling Engine & DSS).
- Kiểm tra 6 Ràng Buộc Cứng (Hard Constraints) theo đúng yêu cầu đề tài:
  1. H1 - Skill Matching: Nhân viên có đủ các kỹ năng bắt buộc và đạt min_level.
  2. H2 - Active Status: Nhân viên ở trạng thái đang hoạt động (active).
  3. H3 - Availability: Nằm trong ca làm việc đăng ký, không trùng lịch nghỉ phép.
  4. H4 - No Schedule Overlap: Không bị trùng lặp thời gian với các ca khác của cùng nhân viên.
  5. H5 - Travel Feasibility: Đủ thời gian di chuyển giữa 2 điểm liên tiếp.
  6. H6 - Daily Workload Limit: Không vượt quá thời lượng tối đa mỗi ngày (max_daily_minutes).
- Chấm điểm đa tiêu chí mềm DSS (Multi-Criteria Scoring):
  Score = 0.30*SkillFit + 0.25*TimeFit + 0.20*Distance + 0.15*Workload + 0.10*Continuity.
- Tối ưu hóa phân công toàn cục (Global Assignment) bằng Google OR-Tools CP-SAT.
- Quản lý phiên bản lịch (ScheduleVersion) và Nhật ký đề xuất (RecommendationLog).
"""

import math
import logging
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.models import (
    Employee, Customer, Service, ServiceRequest, EmployeeAvailability,
    LeaveRequest, Assignment, TravelMatrix, ScheduleVersion, RecommendationLog,
    EmployeeSkill, ServiceRequiredSkill, AIPrediction, ServiceResult
)

logger = logging.getLogger(__name__)


class SchedulingEngine:
    """
    Bộ máy lập lịch và điều phối thông minh kết hợp OR-Tools CP-SAT và DSS.
    """

    @staticmethod
    def calculate_distance_and_travel(
        db: Session,
        from_id: int,
        to_id: int,
        from_lat: Optional[Decimal] = None,
        from_lon: Optional[Decimal] = None,
        to_lat: Optional[Decimal] = None,
        to_lon: Optional[Decimal] = None
    ) -> Tuple[float, int]:
        """
        Tra cứu hoặc tính toán cự ly (km) và số phút di chuyển thực tế tại Nha Trang
        thông qua OSRM / OpenStreetMap kèm bộ nhớ đệm và cơ chế Safe Fallback Haversine.
        """
        # 1. Tra cứu ma trận di chuyển nếu đã có sẵn trong CSDL
        tm = db.execute(
            select(TravelMatrix).where(
                TravelMatrix.from_id == from_id,
                TravelMatrix.to_id == to_id
            )
        ).scalars().first()

        if tm:
            return float(tm.distance_km), int(tm.travel_minutes)

        # 2. Sử dụng RoutingEngine (OSRM kèm Cache & Fallback) nếu có tọa độ GPS
        if from_lat is not None and from_lon is not None and to_lat is not None and to_lon is not None:
            from app.ai.routing import RoutingEngine
            dist_km, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(
                from_lat=from_lat,
                from_lon=from_lon,
                to_lat=to_lat,
                to_lon=to_lon
            )
            return dist_km, travel_mins

        # 3. Giá trị mặc định nội thành Nha Trang
        return 3.0, 10

    @classmethod
    def check_hard_constraints(
        cls,
        db: Session,
        employee: Employee,
        request: ServiceRequest,
        start_time: datetime,
        end_time: datetime
    ) -> Tuple[bool, Optional[str]]:
        """
        Kiểm tra 6 ràng buộc cứng bắt buộc đối với một ca phân công dự kiến.
        Trả về: (is_feasible, rejection_reason)
        """
        # H2: Trạng thái nhân viên phải là active
        if employee.status != "active":
            return False, f"H2: Nhân viên {employee.full_name} không ở trạng thái active"

        # H1: Kỹ năng bắt buộc (Skill Matching)
        req_skills = db.execute(
            select(ServiceRequiredSkill).where(
                ServiceRequiredSkill.service_id == request.service_id,
                ServiceRequiredSkill.is_mandatory == True
            )
        ).scalars().all()

        emp_skills = {es.skill_id: es.level for es in employee.employee_skills}
        for rs in req_skills:
            if rs.skill_id not in emp_skills:
                return False, f"H1: Thiếu kỹ năng bắt buộc ID {rs.skill_id}"
            if emp_skills[rs.skill_id] < rs.min_level:
                return False, f"H1: Kỹ năng ID {rs.skill_id} chưa đạt cấp độ tối thiểu {rs.min_level}"

        # H3: Khả năng phục vụ & Lịch nghỉ phép (Availability & Leave)
        target_date = start_time.date()
        # Kiểm tra nghỉ phép (trùng thời gian ca)
        leave = db.execute(
            select(LeaveRequest).where(
                LeaveRequest.employee_id == employee.employee_id,
                LeaveRequest.status == "approved",
                LeaveRequest.from_time < end_time,
                start_time < LeaveRequest.to_time
            )
        ).scalars().first()
        if leave:
            return False, f"H3: Nhân viên có lịch nghỉ phép đã duyệt trong khung giờ này"

        # Kiểm tra ca làm việc
        st_time = start_time.time()
        et_time = end_time.time()
        avail = db.execute(
            select(EmployeeAvailability).where(
                EmployeeAvailability.employee_id == employee.employee_id,
                EmployeeAvailability.date == target_date,
                EmployeeAvailability.availability_type == "working",
                EmployeeAvailability.start_time <= st_time,
                EmployeeAvailability.end_time >= et_time
            )
        ).scalars().first()
        if not avail:
            return False, f"H3: Thời gian ca ({st_time} - {et_time}) nằm ngoài ca làm việc đăng ký"

        # Lấy danh sách các ca đã gán trong ngày của nhân viên (không tính ca bị hủy)
        existing_assigns = db.execute(
            select(Assignment).where(
                Assignment.employee_id == employee.employee_id,
                func.date(Assignment.scheduled_start) == target_date,
                Assignment.assignment_status.in_(["proposed", "confirmed", "completed"])
            ).order_by(Assignment.scheduled_start.asc())
        ).scalars().all()

        # H4: Không trùng lặp lịch (No Schedule Overlap)
        for a in existing_assigns:
            if (a.scheduled_start < end_time) and (start_time < a.scheduled_end):
                return False, f"H4: Trùng lịch với ca phân công {a.assignment_id} ({a.scheduled_start} - {a.scheduled_end})"

        # H5: Tính khả thi về di chuyển (Travel Feasibility)
        cust = request.customer
        for a in existing_assigns:
            # Nếu ca này diễn ra trước ca mới
            if a.scheduled_end <= start_time:
                dist_km, travel_mins = cls.calculate_distance_and_travel(
                    db=db,
                    from_id=a.request.customer_id if a.request else 0,
                    to_id=cust.customer_id if cust else 0,
                    from_lat=a.request.customer.lat if a.request and a.request.customer else None,
                    from_lon=a.request.customer.lon if a.request and a.request.customer else None,
                    to_lat=cust.lat if cust else None,
                    to_lon=cust.lon if cust else None
                )
                gap_mins = (start_time - a.scheduled_end).total_seconds() / 60.0
                if gap_mins < travel_mins:
                    return False, f"H5: Không đủ thời gian di chuyển từ ca trước ({gap_mins:.0f}p < {travel_mins}p cần thiết)"

            # Nếu ca này diễn ra sau ca mới
            elif end_time <= a.scheduled_start:
                dist_km, travel_mins = cls.calculate_distance_and_travel(
                    db=db,
                    from_id=cust.customer_id if cust else 0,
                    to_id=a.request.customer_id if a.request else 0,
                    from_lat=cust.lat if cust else None,
                    from_lon=cust.lon if cust else None,
                    to_lat=a.request.customer.lat if a.request and a.request.customer else None,
                    to_lon=a.request.customer.lon if a.request and a.request.customer else None
                )
                gap_mins = (a.scheduled_start - end_time).total_seconds() / 60.0
                if gap_mins < travel_mins:
                    return False, f"H5: Không đủ thời gian di chuyển tới ca tiếp theo ({gap_mins:.0f}p < {travel_mins}p cần thiết)"

        # H6: Giới hạn tải làm việc trong ngày (Daily Workload Limit)
        current_workload_mins = sum(
            int((a.scheduled_end - a.scheduled_start).total_seconds() / 60.0)
            for a in existing_assigns
        )
        new_duration_mins = int((end_time - start_time).total_seconds() / 60.0)
        max_mins = employee.max_daily_minutes or 480
        if current_workload_mins + new_duration_mins > max_mins:
            return False, f"H6: Tổng thời lượng làm việc trong ngày ({current_workload_mins + new_duration_mins}p) vượt mức tối đa {max_mins}p"

        return True, None

    @classmethod
    def calculate_dss_score(
        cls,
        db: Session,
        employee: Employee,
        request: ServiceRequest,
        start_time: datetime,
        end_time: datetime,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, Dict[str, float], str]:
        """
        Tính điểm tiêu chí mềm DSS:
        Score = w_skill*SkillFit + w_time*TimeFit + w_dist*Distance + w_workload*Workload + w_continuity*Continuity
        """
        # 1. SkillFit (0.0 -> 1.0)
        req_skills = db.execute(
            select(ServiceRequiredSkill).where(ServiceRequiredSkill.service_id == request.service_id)
        ).scalars().all()
        emp_skills = {es.skill_id: es.level for es in employee.employee_skills}
        
        bonus_levels = 0
        for rs in req_skills:
            if rs.skill_id in emp_skills:
                bonus_levels += max(0, emp_skills[rs.skill_id] - rs.min_level)
        skill_fit = min(1.0, 0.70 + bonus_levels * 0.10)

        # 2. TimeFit (0.0 -> 1.0)
        diff_mins = abs((start_time - request.preferred_start).total_seconds() / 60.0)
        time_fit = max(0.0, 1.0 - (diff_mins / 120.0))

        # 3. DistanceScore (0.0 -> 1.0)
        cust = request.customer
        dist_km, travel_mins = cls.calculate_distance_and_travel(
            db=db,
            from_id=employee.employee_id,
            to_id=cust.customer_id if cust else 0,
            from_lat=employee.base_lat,
            from_lon=employee.base_lon,
            to_lat=cust.lat if cust else None,
            to_lon=cust.lon if cust else None
        )
        distance_score = max(0.0, 1.0 - (dist_km / 15.0))

        # 4. WorkloadBalance (0.0 -> 1.0)
        target_date = start_time.date()
        daily_assigns = db.execute(
            select(Assignment).where(
                Assignment.employee_id == employee.employee_id,
                func.date(Assignment.scheduled_start) == target_date,
                Assignment.assignment_status.in_(["proposed", "confirmed", "completed"])
            )
        ).scalars().all()
        current_workload = sum(
            int((a.scheduled_end - a.scheduled_start).total_seconds() / 60.0)
            for a in daily_assigns
        )
        max_mins = employee.max_daily_minutes or 480
        workload_score = max(0.0, 1.0 - (current_workload / max_mins))

        # 5. Continuity (0.0 hoặc 1.0)
        past_successful = db.execute(
            select(func.count(Assignment.assignment_id))
            .join(ServiceRequest, Assignment.request_id == ServiceRequest.request_id)
            .join(ServiceResult, Assignment.assignment_id == ServiceResult.assignment_id)
            .where(
                Assignment.employee_id == employee.employee_id,
                ServiceRequest.customer_id == request.customer_id,
                ServiceResult.status_outcome == "successful"
            )
        ).scalar() or 0
        continuity_score = 1.0 if past_successful > 0 else 0.0

        # Tổng hợp điểm theo trọng số (mặc định hoặc cấu hình phân tích độ nhạy)
        if weights is None:
            w_skill, w_time, w_dist, w_workload, w_continuity = 0.30, 0.25, 0.20, 0.15, 0.10
        else:
            w_skill = float(weights.get("skill", 0.30))
            w_time = float(weights.get("time", 0.25))
            w_dist = float(weights.get("distance", 0.20))
            w_workload = float(weights.get("workload", 0.15))
            w_continuity = float(weights.get("continuity", 0.10))

        total_score = (
            w_skill * skill_fit +
            w_time * time_fit +
            w_dist * distance_score +
            w_workload * workload_score +
            w_continuity * continuity_score
        )

        breakdown = {
            "skill_fit": round(skill_fit, 3),
            "time_fit": round(time_fit, 3),
            "distance_score": round(distance_score, 3),
            "workload_score": round(workload_score, 3),
            "continuity_score": round(continuity_score, 3),
            "distance_km": dist_km,
            "current_workload_mins": current_workload
        }

        continuity_str = "từng phục vụ tốt bệnh nhân này" if past_successful > 0 else "ứng viên mới"
        explanation = (
            f"Nhân viên {employee.full_name} đạt {total_score*100:.1f}/100 điểm DSS. "
            f"Kỹ năng: {skill_fit*100:.0f}%, Khoảng cách: {dist_km}km ({travel_mins}p di chuyển), "
            f"Tải công việc hôm nay: {current_workload}/{max_mins}p, {continuity_str}."
        )

        return round(total_score, 4), breakdown, explanation

    @classmethod
    def get_candidate_recommendations(
        cls,
        db: Session,
        request_id: int,
        top_k: int = 3,
        weights: Optional[Dict[str, float]] = None
    ) -> List[Dict[str, Any]]:
        """
        Lấy danh sách Top K nhân viên phù hợp nhất cho 1 yêu cầu cụ thể,
        kèm điểm chi tiết và lý do loại trừ (nếu có).
        """
        req = db.get(ServiceRequest, request_id)
        if not req:
            return []

        # Lấy thời lượng dự đoán
        pred = db.execute(
            select(AIPrediction).where(AIPrediction.request_id == req.request_id).order_by(AIPrediction.created_at.desc())
        ).scalars().first()
        duration_mins = pred.predicted_duration if pred else req.service.default_duration

        start_time = req.preferred_start
        end_time = start_time + timedelta(minutes=duration_mins)

        employees = db.execute(select(Employee)).scalars().all()
        candidates = []

        for emp in employees:
            is_feasible, reject_reason = cls.check_hard_constraints(
                db=db,
                employee=emp,
                request=req,
                start_time=start_time,
                end_time=end_time
            )

            if is_feasible:
                score, breakdown, explanation = cls.calculate_dss_score(
                    db=db,
                    employee=emp,
                    request=req,
                    start_time=start_time,
                    end_time=end_time,
                    weights=weights
                )
                candidates.append({
                    "employee_id": emp.employee_id,
                    "employee_name": emp.full_name,
                    "phone": emp.phone,
                    "is_feasible": True,
                    "score": score,
                    "breakdown": breakdown,
                    "explanation": explanation
                })
            else:
                candidates.append({
                    "employee_id": emp.employee_id,
                    "employee_name": emp.full_name,
                    "phone": emp.phone,
                    "is_feasible": False,
                    "score": 0.0,
                    "rejection_reason": reject_reason
                })

        # Sắp xếp ứng viên khả thi theo điểm số giảm dần
        feasible_candidates = [c for c in candidates if c["is_feasible"]]
        feasible_candidates.sort(key=lambda x: x["score"], reverse=True)

        return feasible_candidates[:top_k]

    @classmethod
    def optimize_schedule(
        cls,
        db: Session,
        target_date: date,
        created_by_user_id: int = 1,
        algorithm_name: Optional[str] = None,
        use_ai_duration: bool = True,
        weights: Optional[Dict[str, float]] = None,
        allow_time_window: bool = False,
        window_minutes: int = 60
    ) -> Dict[str, Any]:
        """
        Giải bài toán phân công nhân sự tối ưu toàn cục theo thời điểm phục vụ yêu cầu
        (Global Staff-Assignment Optimization under Fixed/Requested Service Times),
        hoặc nâng cấp tối ưu hóa đồng thời biến thời gian bắt đầu trong cửa sổ thời gian linh hoạt
        (Flexible Time Window Optimization [preferred_start, preferred_end]) bằng Google OR-Tools CP-SAT.
        """
        if algorithm_name is None:
            if allow_time_window:
                algorithm_name = "OR-Tools CP-SAT (Staff-Assignment with Flexible Time Windows)"
            else:
                algorithm_name = "OR-Tools CP-SAT (Global Staff-Assignment under Fixed Service Times)"

        # 1. Lấy danh sách các yêu cầu đang chờ xếp lịch trong ngày
        requests = db.execute(
            select(ServiceRequest).where(
                func.date(ServiceRequest.preferred_start) == target_date,
                ServiceRequest.status.in_(["pending", "proposed"])
            )
        ).scalars().all()

        if not requests:
            return {
                "status": "no_requests",
                "message": f"Không có yêu cầu chăm sóc nào chờ xếp lịch trong ngày {target_date}",
                "schedule_version_id": None,
                "assignments": []
            }

        # 2. Lấy danh sách nhân viên y tế đang hoạt động
        employees = db.execute(
            select(Employee).where(Employee.status == "active")
        ).scalars().all()

        # 3. Tạo mô hình tối ưu OR-Tools CP-SAT
        model = cp_model.CpModel()
        x = {}  # Biến nhị phân x[r_id, e_id]
        scores = {}
        durations = {}
        breakdowns = {}
        explanations = {}
        start_vars = {}

        # 4. Lọc các cặp (Request, Employee) khả thi thỏa mãn 6 ràng buộc cứng
        feasible_pairs = []
        for req in requests:
            if use_ai_duration:
                pred = db.execute(
                    select(AIPrediction).where(AIPrediction.request_id == req.request_id).order_by(AIPrediction.created_at.desc())
                ).scalars().first()
                dur = pred.predicted_duration if pred else req.service.default_duration
            else:
                dur = req.service.default_duration
            durations[req.request_id] = dur

            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            # Khởi tạo biến quyết định thời điểm bắt đầu nếu bật cửa sổ thời gian linh hoạt
            if allow_time_window:
                pref_st_mins = req.preferred_start.hour * 60 + req.preferred_start.minute
                if req.preferred_end:
                    pref_et_mins = req.preferred_end.hour * 60 + req.preferred_end.minute
                else:
                    pref_et_mins = pref_st_mins + window_minutes
                latest_st_mins = max(pref_st_mins, pref_et_mins - dur)
                start_vars[req.request_id] = model.new_int_var(pref_st_mins, latest_st_mins, f"st_{req.request_id}")

            for emp in employees:
                is_feasible, _ = cls.check_hard_constraints(
                    db=db,
                    employee=emp,
                    request=req,
                    start_time=st,
                    end_time=et
                )
                if is_feasible:
                    score, breakdown, explanation = cls.calculate_dss_score(
                        db=db,
                        employee=emp,
                        request=req,
                        start_time=st,
                        end_time=et,
                        weights=weights
                    )
                    var = model.new_bool_var(f"x_{req.request_id}_{emp.employee_id}")
                    x[(req.request_id, emp.employee_id)] = var
                    scores[(req.request_id, emp.employee_id)] = score
                    breakdowns[(req.request_id, emp.employee_id)] = breakdown
                    explanations[(req.request_id, emp.employee_id)] = explanation
                    feasible_pairs.append((req, emp))

        if not feasible_pairs:
            return {
                "status": "infeasible",
                "message": f"Không tìm thấy phương án phân công khả thi thỏa mãn 6 ràng buộc cứng cho ngày {target_date}.",
                "schedule_version_id": None,
                "assignments": []
            }

        # 5. Thiết lập Ràng buộc Tối ưu:
        # Constraint 1: Mỗi yêu cầu chỉ được gán tối đa cho 1 nhân viên
        for req in requests:
            emp_vars = [x[(req.request_id, emp.employee_id)] for (r, emp) in feasible_pairs if r.request_id == req.request_id]
            if emp_vars:
                model.add(sum(emp_vars) <= 1)

        # Constraint 2: Ràng buộc không trùng lịch và bảo đảm thời gian di chuyển
        for emp in employees:
            assigned_reqs = [r for (r, e) in feasible_pairs if e.employee_id == emp.employee_id]
            n_ar = len(assigned_reqs)
            for i in range(n_ar):
                for j in range(i + 1, n_ar):
                    r1 = assigned_reqs[i]
                    r2 = assigned_reqs[j]
                    dur1 = durations[r1.request_id]
                    dur2 = durations[r2.request_id]

                    c1 = r1.customer
                    c2 = r2.customer
                    _, travel_mins = cls.calculate_distance_and_travel(
                        db=db,
                        from_id=c1.customer_id if c1 else 0,
                        to_id=c2.customer_id if c2 else 0,
                        from_lat=c1.lat if c1 else None,
                        from_lon=c1.lon if c1 else None,
                        to_lat=c2.lat if c2 else None,
                        to_lon=c2.lon if c2 else None
                    )

                    var1 = x[(r1.request_id, emp.employee_id)]
                    var2 = x[(r2.request_id, emp.employee_id)]

                    if allow_time_window:
                        # Tối ưu hóa thời gian bắt đầu trong Time Window:
                        # Sử dụng biến thứ tự Boolean (Precedence)
                        prec = model.new_bool_var(f"prec_{r1.request_id}_{r2.request_id}_{emp.employee_id}")
                        st_v1 = start_vars[r1.request_id]
                        st_v2 = start_vars[r2.request_id]
                        # r1 trước r2: st_v2 >= st_v1 + dur1 + travel_mins
                        model.add(st_v2 >= st_v1 + dur1 + travel_mins).only_enforce_if([var1, var2, prec])
                        # r2 trước r1: st_v1 >= st_v2 + dur2 + travel_mins
                        model.add(st_v1 >= st_v2 + dur2 + travel_mins).only_enforce_if([var1, var2, prec.Not()])
                    else:
                        # Thời điểm cố định theo yêu cầu khách hàng (Fixed requested start time)
                        st1, et1 = r1.preferred_start, r1.preferred_start + timedelta(minutes=dur1)
                        st2, et2 = r2.preferred_start, r2.preferred_start + timedelta(minutes=dur2)

                        conflict = False
                        if (st1 < et2) and (st2 < et1):
                            conflict = True
                        elif et1 <= st2 and (st2 - et1).total_seconds() / 60.0 < travel_mins:
                            conflict = True
                        elif et2 <= st1 and (st1 - et2).total_seconds() / 60.0 < travel_mins:
                            conflict = True

                        if conflict:
                            model.add(var1 + var2 <= 1)

            # Ràng buộc tải làm việc tối đa trong ngày của nhân viên
            max_mins = emp.max_daily_minutes or 480
            w_terms = [x[(r.request_id, emp.employee_id)] * durations[r.request_id] for r in assigned_reqs]
            if w_terms:
                model.add(sum(w_terms) <= max_mins)

        # 6. Hàm mục tiêu: Tối đa hóa tổng điểm DSS (chuyển sang số nguyên scaled x 1000)
        objective_terms = []
        for (r_id, e_id), var in x.items():
            int_weight = int(scores[(r_id, e_id)] * 1000)
            objective_terms.append(var * int_weight)

        if allow_time_window:
            # Phạt nhẹ nếu dời giờ xa khỏi preferred_start để giữ sự hài lòng cho bệnh nhân
            for r in requests:
                if r.request_id in start_vars:
                    pref_mins = r.preferred_start.hour * 60 + r.preferred_start.minute
                    diff = model.new_int_var(0, 1440, f"diff_{r.request_id}")
                    model.add_abs_equality(diff, start_vars[r.request_id] - pref_mins)
                    objective_terms.append(-diff * 2)

        model.maximize(sum(objective_terms))

        # 7. Giải bằng Solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 8.0
        status = solver.solve(model)

        if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return {
                "status": "solver_failed",
                "message": "Bộ giải CP-SAT không tìm thấy nghiệm khả thi.",
                "schedule_version_id": None,
                "assignments": []
            }

        # 8. Lưu kết quả thành Phiên bản lịch mới (ScheduleVersion)
        ver_count = db.execute(
            select(func.count(ScheduleVersion.schedule_version_id)).where(ScheduleVersion.schedule_date == target_date)
        ).scalar() or 0
        version_code = f"V{target_date.strftime('%Y%m%d')}-{ver_count + 1}"

        applied_weights = weights or {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10}
        new_version = ScheduleVersion(
            schedule_date=target_date,
            created_by=created_by_user_id,
            algorithm=algorithm_name,
            parameters_json={
                "solver_status": solver.status_name(status),
                "objective_value": solver.objective_value,
                "weights": applied_weights,
                "allow_time_window": allow_time_window
            }
        )
        db.add(new_version)
        db.flush()

        created_assignments = []
        assigned_requests_count = 0

        for (req, emp) in feasible_pairs:
            pair_key = (req.request_id, emp.employee_id)
            if pair_key in x and solver.boolean_value(x[pair_key]):
                rec_log = RecommendationLog(
                    request_id=req.request_id,
                    employee_id=emp.employee_id,
                    schedule_version_id=new_version.schedule_version_id,
                    rank=1,
                    score=Decimal(f"{scores[(req.request_id, emp.employee_id)]:.4f}"),
                    score_breakdown_json=breakdowns[(req.request_id, emp.employee_id)]
                )
                db.add(rec_log)
                db.flush()

                dur = durations[req.request_id]
                if allow_time_window and req.request_id in start_vars:
                    opt_mins = solver.value(start_vars[req.request_id])
                    opt_h, opt_m = divmod(opt_mins, 60)
                    st = datetime(target_date.year, target_date.month, target_date.day, opt_h, opt_m, tzinfo=req.preferred_start.tzinfo)
                    et = st + timedelta(minutes=dur)
                else:
                    st = req.preferred_start
                    et = st + timedelta(minutes=dur)

                pred = db.execute(
                    select(AIPrediction).where(AIPrediction.request_id == req.request_id).order_by(AIPrediction.created_at.desc())
                ).scalars().first()

                assignment = Assignment(
                    request_id=req.request_id,
                    employee_id=emp.employee_id,
                    schedule_version_id=new_version.schedule_version_id,
                    prediction_id=pred.prediction_id if pred else None,
                    selected_recommendation_id=rec_log.recommendation_id,
                    scheduled_start=st,
                    scheduled_end=et,
                    assignment_status="proposed",
                    recommendation_score=rec_log.score,
                    explanation=explanations[(req.request_id, emp.employee_id)]
                )
                db.add(assignment)
                created_assignments.append(assignment)
                assigned_requests_count += 1

        db.commit()

        return {
            "status": "success",
            "schedule_version_id": new_version.schedule_version_id,
            "version_code": version_code,
            "total_requests": len(requests),
            "assigned_count": assigned_requests_count,
            "unassigned_count": len(requests) - assigned_requests_count,
            "assignments_count": len(created_assignments),
            "assignments": created_assignments,
            "message": f"Đã tối ưu thành công {assigned_requests_count}/{len(requests)} yêu cầu chăm sóc cho ngày {target_date} ({algorithm_name})."
        }
