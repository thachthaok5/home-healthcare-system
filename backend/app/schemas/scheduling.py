from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class OptimizeScheduleRequest(BaseModel):
    target_date: date
    created_by_user_id: int = 1


class CandidateBreakdown(BaseModel):
    skill_fit: float
    time_fit: float
    distance_score: float
    workload_score: float
    continuity_score: float
    distance_km: float
    current_workload_mins: int


class CandidateRecommendationOut(BaseModel):
    employee_id: int
    employee_name: str
    phone: Optional[str] = None
    is_feasible: bool
    score: float
    breakdown: Optional[CandidateBreakdown] = None
    explanation: Optional[str] = None
    rejection_reason: Optional[str] = None


class ScheduleVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schedule_version_id: int
    schedule_date: date
    created_by: int
    algorithm: str
    parameters_json: Optional[Dict[str, Any]] = None
    created_at: datetime


class FeasibilityCheckRequest(BaseModel):
    employee_id: int
    request_id: int
    scheduled_start: datetime
    scheduled_end: datetime


class FeasibilityCheckResponse(BaseModel):
    is_feasible: bool
    rejection_reason: Optional[str] = None
    dss_score: Optional[float] = None
    explanation: Optional[str] = None
