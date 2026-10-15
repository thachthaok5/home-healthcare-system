from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ManualAssignmentCreate(BaseModel):
    request_id: int
    employee_id: int
    scheduled_start: datetime
    scheduled_end: datetime
    explanation: Optional[str] = "Phân công thủ công bởi Điều phối viên"


class AssignmentConfirmRequest(BaseModel):
    confirmed_by: int
    override_reason: Optional[str] = None


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
