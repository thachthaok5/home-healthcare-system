from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import (
    Assignment, ServiceRequest, Employee, ServiceResult,
    ServiceRequiredSkill, EmployeeSkill, AIPrediction, Rating
)
from app.schemas.assignment import (
    ManualAssignmentCreate, AssignmentConfirmRequest, AssignmentOverrideRequest,
    ServiceResultRecordRequest, AssignmentOut, ServiceResultOut, RatingCreate,
    OVERRIDE_REASON_METADATA, OverrideReasonCode
)

router = APIRouter(prefix="/assignments", tags=["Assignments & Execution"])


@router.get("/override-reasons", summary="Danh mục lý do can thiệp điều phối thủ công (Human-in-the-loop)")
def get_override_reasons():
    """
    Trả về danh mục chuẩn hóa các lý do điều phối viên có thể can thiệp
    thay đổi đề xuất của AI / Solver phục vụ giao diện Dropdown.
    """
    return {
        "success": True,
        "total": len(OVERRIDE_REASON_METADATA),
        "data": OVERRIDE_REASON_METADATA
    }


@router.get("", response_model=List[AssignmentOut], summary="Danh sách phân công nhân sự")
def list_assignments(
    status_filter: Optional[str] = None,
    employee_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = select(Assignment)
    if status_filter:
        query = query.where(Assignment.assignment_status == status_filter)
    if employee_id:
        query = query.where(Assignment.employee_id == employee_id)
    query = query.order_by(Assignment.scheduled_start.desc()).offset(skip).limit(limit)

    assignments = db.execute(query).scalars().all()
    results = []
    for a in assignments:
        results.append(AssignmentOut(
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
        ))
    return results


@router.post("/manual", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED, summary="Tạo phân công thủ công (Điều phối viên chỉ định)")
def create_manual_assignment(
    assign_in: ManualAssignmentCreate,
    db: Session = Depends(get_db)
):
    # 1. Kiểm tra request và employee
    sr = db.get(ServiceRequest, assign_in.request_id)
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy yêu cầu dịch vụ")
    
    emp = db.get(Employee, assign_in.employee_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân viên")
    
    # Ràng buộc cứng: Nhân viên phải active
    if emp.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhân viên hiện không ở trạng thái hoạt động")

    # Ràng buộc cứng: Kiểm tra kỹ năng bắt buộc
    req_skills = db.execute(
        select(ServiceRequiredSkill).where(
            ServiceRequiredSkill.service_id == sr.service_id,
            ServiceRequiredSkill.is_mandatory == True
        )
    ).scalars().all()

    emp_skill_map = {es.skill_id: es.level for es in emp.employee_skills}
    for rs in req_skills:
        if rs.skill_id not in emp_skill_map or emp_skill_map[rs.skill_id] < rs.min_level:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nhân viên thiếu kỹ năng bắt buộc ID {rs.skill_id} hoặc cấp độ < {rs.min_level}"
            )

    # Ràng buộc cứng: Kiểm tra trùng lịch (No Schedule Overlap)
    overlap_assign = db.execute(
        select(Assignment).where(
            Assignment.employee_id == emp.employee_id,
            Assignment.assignment_status.in_(["proposed", "confirmed"]),
            Assignment.scheduled_start < assign_in.scheduled_end,
            assign_in.scheduled_start < Assignment.scheduled_end
        )
    ).scalars().first()
    if overlap_assign:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nhân viên {emp.full_name} đã có ca phân công trùng giờ (Assignment ID {overlap_assign.assignment_id})"
        )

    # 2. Tìm prediction_id liên kết nếu có
    pred = db.execute(
        select(AIPrediction).where(AIPrediction.request_id == sr.request_id)
    ).scalars().first()

    assign = Assignment(
        request_id=sr.request_id,
        employee_id=emp.employee_id,
        prediction_id=pred.prediction_id if pred else None,
        scheduled_start=assign_in.scheduled_start,
        scheduled_end=assign_in.scheduled_end,
        assignment_status="proposed",
        recommendation_score=Decimal("1.0000"),
        explanation=assign_in.explanation
    )
    db.add(assign)
    sr.status = "scheduled"
    db.commit()
    db.refresh(assign)

    return AssignmentOut(
        assignment_id=assign.assignment_id,
        request_id=assign.request_id,
        employee_id=assign.employee_id,
        employee_name=emp.full_name,
        customer_name=sr.customer.full_name if sr.customer else None,
        service_name=sr.service.service_name if sr.service else None,
        scheduled_start=assign.scheduled_start,
        scheduled_end=assign.scheduled_end,
        assignment_status=assign.assignment_status,
        recommendation_score=assign.recommendation_score,
        explanation=assign.explanation,
        confirmed_by=assign.confirmed_by,
        confirmed_at=assign.confirmed_at,
        override_reason=assign.override_reason,
        created_at=assign.created_at
    )


@router.post("/{assignment_id}/confirm", response_model=AssignmentOut, summary="Điều phối viên phê duyệt phân công")
def confirm_assignment(
    assignment_id: int,
    confirm_in: AssignmentConfirmRequest,
    db: Session = Depends(get_db)
):
    assign = db.get(Assignment, assignment_id)
    if not assign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phân công")
    
    assign.assignment_status = "confirmed"
    assign.confirmed_by = confirm_in.confirmed_by
    assign.confirmed_at = datetime.now(timezone.utc)
    if confirm_in.reason_code:
        label = next((item["label"] for item in OVERRIDE_REASON_METADATA if item["code"] == confirm_in.reason_code.value), confirm_in.reason_code.value)
        formatted = f"[{confirm_in.reason_code.value.upper()}] {label}"
        if confirm_in.override_notes:
            formatted += f" - {confirm_in.override_notes}"
        assign.override_reason = formatted
    elif confirm_in.override_reason:
        assign.override_reason = confirm_in.override_reason

    db.commit()
    db.refresh(assign)

    return AssignmentOut(
        assignment_id=assign.assignment_id,
        request_id=assign.request_id,
        employee_id=assign.employee_id,
        employee_name=assign.employee.full_name if assign.employee else None,
        customer_name=assign.request.customer.full_name if assign.request and assign.request.customer else None,
        service_name=assign.request.service.service_name if assign.request and assign.request.service else None,
        scheduled_start=assign.scheduled_start,
        scheduled_end=assign.scheduled_end,
        assignment_status=assign.assignment_status,
        recommendation_score=assign.recommendation_score,
        explanation=assign.explanation,
        confirmed_by=assign.confirmed_by,
        confirmed_at=assign.confirmed_at,
        override_reason=assign.override_reason,
        created_at=assign.created_at
    )


@router.post("/{assignment_id}/override", response_model=AssignmentOut, summary="Điều phối viên can thiệp thay đổi phân công (Human-in-the-loop Override)")
def override_assignment(
    assignment_id: int,
    override_in: AssignmentOverrideRequest,
    db: Session = Depends(get_db)
):
    """
    Cho phép điều phối viên ghi đè (override) quyết định gợi ý của AI/Solver:
    - Thay đổi nhân sự được phân công (kiểm tra trạng thái active, kỹ năng bắt buộc, trùng lịch).
    - Cập nhật thời gian bắt đầu/kết thúc nếu cần.
    - Bắt buộc ghi nhận lý do chuẩn hóa (reason_code) và ghi chú nghiệp vụ (override_notes).
    - Tự động chuyển trạng thái thành confirmed kèm thông tin người phê duyệt.
    """
    assign = db.get(Assignment, assignment_id)
    if not assign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phân công")

    sr = assign.request
    target_emp_id = override_in.new_employee_id or assign.employee_id
    new_start = override_in.scheduled_start or assign.scheduled_start
    new_end = override_in.scheduled_end or assign.scheduled_end

    if new_end <= new_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thời gian kết thúc phải sau thời gian bắt đầu")

    # Kiểm tra nhân viên mục tiêu
    emp = db.get(Employee, target_emp_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân viên được chỉ định")

    if emp.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Nhân viên {emp.full_name} hiện không ở trạng thái hoạt động")

    # Kiểm tra kỹ năng bắt buộc của nhân viên mới
    if sr:
        req_skills = db.execute(
            select(ServiceRequiredSkill).where(
                ServiceRequiredSkill.service_id == sr.service_id,
                ServiceRequiredSkill.is_mandatory == True
            )
        ).scalars().all()
        emp_skill_map = {es.skill_id: es.level for es in emp.employee_skills}
        for rs in req_skills:
            if rs.skill_id not in emp_skill_map or emp_skill_map[rs.skill_id] < rs.min_level:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nhân viên {emp.full_name} thiếu kỹ năng bắt buộc ID {rs.skill_id} hoặc cấp độ < {rs.min_level}"
                )

    # Kiểm tra trùng lịch với các ca khác của nhân viên mới (loại trừ chính assignment này)
    overlap = db.execute(
        select(Assignment).where(
            Assignment.employee_id == emp.employee_id,
            Assignment.assignment_id != assign.assignment_id,
            Assignment.assignment_status.in_(["proposed", "confirmed"]),
            Assignment.scheduled_start < new_end,
            new_start < Assignment.scheduled_end
        )
    ).scalars().first()
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nhân viên {emp.full_name} đã có ca phân công trùng giờ (Assignment ID {overlap.assignment_id})"
        )

    # Cập nhật thông tin phân công
    assign.employee_id = emp.employee_id
    assign.scheduled_start = new_start
    assign.scheduled_end = new_end
    assign.assignment_status = "confirmed"
    assign.confirmed_by = override_in.confirmed_by
    assign.confirmed_at = datetime.now(timezone.utc)

    # Định dạng lý do chuẩn hóa
    label = next((item["label"] for item in OVERRIDE_REASON_METADATA if item["code"] == override_in.reason_code.value), override_in.reason_code.value)
    formatted_reason = f"[{override_in.reason_code.value.upper()}] {label}"
    if override_in.override_notes:
        formatted_reason += f" - Ghi chú: {override_in.override_notes}"
    assign.override_reason = formatted_reason
    assign.explanation = f"Điều phối viên can thiệp thủ công: {formatted_reason}"

    db.commit()
    db.refresh(assign)

    return AssignmentOut(
        assignment_id=assign.assignment_id,
        request_id=assign.request_id,
        employee_id=assign.employee_id,
        employee_name=emp.full_name,
        customer_name=assign.request.customer.full_name if assign.request and assign.request.customer else None,
        service_name=assign.request.service.service_name if assign.request and assign.request.service else None,
        scheduled_start=assign.scheduled_start,
        scheduled_end=assign.scheduled_end,
        assignment_status=assign.assignment_status,
        recommendation_score=assign.recommendation_score,
        explanation=assign.explanation,
        confirmed_by=assign.confirmed_by,
        confirmed_at=assign.confirmed_at,
        override_reason=assign.override_reason,
        created_at=assign.created_at
    )


@router.post("/{assignment_id}/result", response_model=ServiceResultOut, summary="Ghi nhận kết quả thực hiện và tính actual_duration")
def record_service_result(
    assignment_id: int,
    res_in: ServiceResultRecordRequest,
    db: Session = Depends(get_db)
):
    assign = db.get(Assignment, assignment_id)
    if not assign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phân công")
    
    # Tính actual_duration = actual_end - actual_start (phút)
    duration_delta = res_in.actual_end - res_in.actual_start
    actual_mins = int(duration_delta.total_seconds() / 60)
    if actual_mins <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thời gian kết thúc thực tế phải sau thời gian bắt đầu")

    # Kiểm tra đã có result chưa (vì UNIQUE(assignment_id))
    existing_result = db.execute(
        select(ServiceResult).where(ServiceResult.assignment_id == assignment_id)
    ).scalar_one_or_none()

    if existing_result:
        existing_result.actual_start = res_in.actual_start
        existing_result.actual_end = res_in.actual_end
        existing_result.actual_duration = actual_mins
        existing_result.status_outcome = res_in.status_outcome
        existing_result.travel_minutes = res_in.travel_minutes
        existing_result.outcome = res_in.outcome
        existing_result.notes = res_in.notes
        sr_res = existing_result
    else:
        sr_res = ServiceResult(
            assignment_id=assignment_id,
            actual_start=res_in.actual_start,
            actual_end=res_in.actual_end,
            actual_duration=actual_mins,  # TARGET CHO ML HUẤN LUYỆN
            status_outcome=res_in.status_outcome,
            travel_minutes=res_in.travel_minutes,
            outcome=res_in.outcome,
            notes=res_in.notes
        )
        db.add(sr_res)
    
    assign.assignment_status = "completed"
    if assign.request:
        assign.request.status = "completed"

    db.commit()
    db.refresh(sr_res)
    return sr_res


@router.post("/{assignment_id}/rate", status_code=status.HTTP_201_CREATED, summary="Đánh giá chất lượng dịch vụ (Rating)")
def rate_assignment(
    assignment_id: int,
    rate_in: RatingCreate,
    db: Session = Depends(get_db)
):
    assign = db.get(Assignment, assignment_id)
    if not assign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phân công")
    
    # Kiểm tra đã đánh giá chưa (UNIQUE(assignment_id))
    existing_rating = db.execute(
        select(Rating).where(Rating.assignment_id == assignment_id)
    ).scalar_one_or_none()

    if existing_rating:
        existing_rating.score = rate_in.score
        existing_rating.comment = rate_in.comment
        r_obj = existing_rating
    else:
        r_obj = Rating(
            assignment_id=assignment_id,
            score=rate_in.score,
            comment=rate_in.comment
        )
        db.add(r_obj)
    
    db.commit()
    db.refresh(r_obj)
    return {
        "rating_id": r_obj.rating_id,
        "assignment_id": r_obj.assignment_id,
        "score": r_obj.score,
        "comment": r_obj.comment
    }

