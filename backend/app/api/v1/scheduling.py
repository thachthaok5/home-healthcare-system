from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models import ScheduleVersion, Assignment, Employee, ServiceRequest, User
from app.schemas.scheduling import (
    OptimizeScheduleRequest, CandidateRecommendationOut, ScheduleVersionOut,
    FeasibilityCheckRequest, FeasibilityCheckResponse
)
from app.schemas.assignment import AssignmentOut
from app.ai.scheduling import SchedulingEngine

router = APIRouter(prefix="/schedule", tags=["Intelligent Scheduling & DSS"])


@router.post("/optimize", summary="Tối ưu hóa lập lịch phân công toàn cục (OR-Tools CP-SAT)")
def optimize_schedule(
    req: OptimizeScheduleRequest,
    db: Session = Depends(get_db)
):
    """
    Kích hoạt thuật toán OR-Tools CP-SAT để tự động giải bài toán phân công
    tối ưu cho toàn bộ yêu cầu chờ xếp lịch trong ngày, bảo đảm 6 ràng buộc cứng
    và tối đa hóa hàm mục tiêu DSS.
    """
    result = SchedulingEngine.optimize_schedule(
        db=db,
        target_date=req.target_date,
        created_by_user_id=req.created_by_user_id
    )
    if result["status"] == "infeasible":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=result["message"])
    return result


@router.get("/recommend-candidates/{request_id}", response_model=List[CandidateRecommendationOut], summary="Gợi ý Top ứng viên kèm điểm giải trình DSS")
def recommend_candidates(
    request_id: int,
    top_k: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """
    Hệ thống hỗ trợ ra quyết định (DSS): Lọc ứng viên thỏa mãn 6 ràng buộc cứng
    và xếp hạng theo trọng số đa mục tiêu để Điều phối viên lựa chọn.
    """
    req = db.get(ServiceRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy yêu cầu chăm sóc")

    candidates = SchedulingEngine.get_candidate_recommendations(db=db, request_id=request_id, top_k=top_k)
    return candidates


@router.post("/check-feasibility", response_model=FeasibilityCheckResponse, summary="Thẩm định 6 ràng buộc cứng theo thời gian thực khi Điều phối viên sửa lịch")
def check_feasibility(
    req_body: FeasibilityCheckRequest,
    db: Session = Depends(get_db)
):
    """
    Khi Điều phối viên kéo thả hoặc đổi nhân viên/khung giờ trên giao diện,
    API lập tức kiểm tra 6 ràng buộc cứng (Skill, Active, Availability, Overlap, Travel, MaxWorkload).
    """
    emp = db.get(Employee, req_body.employee_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân viên")
    s_req = db.get(ServiceRequest, req_body.request_id)
    if not s_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy yêu cầu")

    is_feasible, rejection = SchedulingEngine.check_hard_constraints(
        db=db,
        employee=emp,
        request=s_req,
        start_time=req_body.scheduled_start,
        end_time=req_body.scheduled_end
    )

    if is_feasible:
        score, breakdown, explanation = SchedulingEngine.calculate_dss_score(
            db=db,
            employee=emp,
            request=s_req,
            start_time=req_body.scheduled_start,
            end_time=req_body.scheduled_end
        )
        return FeasibilityCheckResponse(
            is_feasible=True,
            dss_score=score,
            explanation=explanation
        )
    else:
        return FeasibilityCheckResponse(
            is_feasible=False,
            rejection_reason=rejection
        )


@router.get("/versions", response_model=List[ScheduleVersionOut], summary="Danh sách các phiên bản lịch đã tạo")
def list_schedule_versions(
    schedule_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    query = select(ScheduleVersion)
    if schedule_date:
        query = query.where(ScheduleVersion.schedule_date == schedule_date)
    query = query.order_by(ScheduleVersion.created_at.desc()).offset(skip).limit(limit)
    return db.execute(query).scalars().all()


@router.get("/versions/{version_id}/assignments", response_model=List[AssignmentOut], summary="Danh sách phân công thuộc một phiên bản lịch")
def get_version_assignments(version_id: int, db: Session = Depends(get_db)):
    version = db.get(ScheduleVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phiên bản lịch")

    assigns = db.execute(
        select(Assignment).where(Assignment.schedule_version_id == version_id)
    ).scalars().all()

    return [
        AssignmentOut(
            assignment_id=a.assignment_id,
            request_id=a.request_id,
            employee_id=a.employee_id,
            employee_name=a.employee.full_name if a.employee else None,
            customer_name=a.request.customer.full_name if a.request and a.request.customer else None,
            service_name=a.request.service.service_name if a.request and a.request.service else None,
            scheduled_start=a.scheduled_start,
            scheduled_end=a.scheduled_end,
            assignment_status=a.assignment_status,
            recommendation_score=a.recommendation_score,
            explanation=a.explanation,
            confirmed_by=a.confirmed_by,
            confirmed_at=a.confirmed_at,
            override_reason=a.override_reason,
            created_at=a.created_at
        )
        for a in assigns
    ]


@router.post("/versions/{version_id}/confirm", summary="Phê duyệt hàng loạt toàn bộ phân công trong phiên bản lịch")
def bulk_confirm_schedule_version(
    version_id: int,
    confirmed_by: int = Query(..., description="ID Điều phối viên phê duyệt"),
    db: Session = Depends(get_db)
):
    """
    Quy trình Human-in-the-Loop: Điều phối viên kiểm tra các đề xuất AI
    và bấm nút xác nhận để chính thức chốt lịch cho nhân viên.
    """
    version = db.get(ScheduleVersion, version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phiên bản lịch")

    now_utc = datetime.now(timezone.utc)
    updated = db.execute(
        update(Assignment)
        .where(
            Assignment.schedule_version_id == version_id,
            Assignment.assignment_status == "proposed"
        )
        .values(
            assignment_status="confirmed",
            confirmed_by=confirmed_by,
            confirmed_at=now_utc
        )
    )

    # Đồng thời cập nhật trạng thái các Service Request sang 'assigned'
    assigns = db.execute(
        select(Assignment).where(Assignment.schedule_version_id == version_id)
    ).scalars().all()
    req_ids = [a.request_id for a in assigns]
    if req_ids:
        db.execute(
            update(ServiceRequest)
            .where(ServiceRequest.request_id.in_(req_ids))
            .values(status="assigned")
        )

    db.commit()

    return {
        "status": "success",
        "message": f"Đã phê duyệt thành công toàn bộ phân công của phiên bản lịch #{version_id}.",
        "confirmed_count": updated.rowcount,
        "confirmed_at": now_utc
    }
