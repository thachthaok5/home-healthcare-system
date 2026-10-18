from datetime import datetime
from enum import Enum
from decimal import Decimal
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict


class OverrideReasonCode(str, Enum):
    DISTANCE = "distance"
    SKILL = "skill"
    CUSTOMER_REQUEST = "customer_request"
    TIME_CONSTRAINT = "time_constraint"
    WORKLOAD_BALANCE = "workload_balance"
    OTHER = "other"


OVERRIDE_REASON_METADATA = [
    {"code": "distance", "label": "Vị trí di chuyển thuận tiện hơn", "description": "Nhân viên ở gần điểm hẹn hơn hoặc cùng lộ trình di chuyển."},
    {"code": "skill", "label": "Trình độ chuyên môn phù hợp hơn", "description": "Nhân viên có chứng chỉ/kỹ năng chuyên sâu phù hợp với ca bệnh đặc thù."},
    {"code": "customer_request", "label": "Khách hàng quen chỉ định đích danh", "description": "Bệnh nhân/người nhà yêu cầu nhân viên chăm sóc quen thuộc."},
    {"code": "time_constraint", "label": "Ràng buộc thời gian đột xuất", "description": "Nhân viên được AI gợi ý gặp sự cố cá nhân hoặc đổi ca đột xuất."},
    {"code": "workload_balance", "label": "Cân bằng khối lượng công việc nội bộ", "description": "Điều phối viên chủ động chia tải để tránh điều dưỡng bị kiệt sức."},
    {"code": "other", "label": "Yêu cầu đặc biệt khác", "description": "Các trường hợp nghiệp vụ đặc thù được ghi chú chi tiết."},
]


class ManualAssignmentCreate(BaseModel):
    request_id: int
    employee_id: int
    scheduled_start: datetime
    scheduled_end: datetime
    explanation: Optional[str] = "Phân công thủ công bởi Điều phối viên"


class AssignmentConfirmRequest(BaseModel):
    confirmed_by: int
    override_reason: Optional[str] = None
    reason_code: Optional[OverrideReasonCode] = None
    override_notes: Optional[str] = None


class AssignmentOverrideRequest(BaseModel):
    confirmed_by: int
    new_employee_id: Optional[int] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    reason_code: OverrideReasonCode
    override_notes: Optional[str] = None


class ServiceResultRecordRequest(BaseModel):
    actual_start: datetime
    actual_end: datetime
    status_outcome: str = "successful"
    travel_minutes: Optional[int] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None


class RatingCreate(BaseModel):
    score: int
    comment: Optional[str] = None


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assignment_id: int
    request_id: int
    employee_id: int
    employee_name: Optional[str] = None
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    assignment_status: str
    recommendation_score: Optional[Decimal] = None
    explanation: Optional[str] = None
    confirmed_by: Optional[int] = None
    confirmed_at: Optional[datetime] = None
    override_reason: Optional[str] = None
    created_at: datetime


class ServiceResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    service_result_id: int
    assignment_id: int
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    actual_duration: Optional[int] = None
    status_outcome: str
    outcome: Optional[str] = None
    notes: Optional[str] = None
