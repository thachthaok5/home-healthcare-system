from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class SkillInfo(BaseModel):
    skill_id: int
    skill_name: str
    level: int


class EmployeeBase(BaseModel):
    full_name: str
    employee_type: Optional[str] = "nurse"
    phone: Optional[str] = None
    base_lat: Optional[Decimal] = None
    base_lon: Optional[Decimal] = None
    max_daily_minutes: int = 480


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeSkillAssign(BaseModel):
    skill_id: int
    level: int = 1


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    status: str
    created_at: datetime
    skills: List[SkillInfo] = []
