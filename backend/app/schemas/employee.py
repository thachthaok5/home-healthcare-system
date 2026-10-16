from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, model_validator


class SkillInfo(BaseModel):
    skill_id: int
    skill_name: str
    level: int


class EmployeeBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str
    employee_type: Optional[str] = "nurse"
    phone: Optional[str] = None
    base_latitude: Optional[Decimal] = None
    base_longitude: Optional[Decimal] = None
    base_lat: Optional[Decimal] = None
    base_lon: Optional[Decimal] = None
    max_daily_minutes: int = 480

    @model_validator(mode="after")
    def sync_coords(self):
        if self.base_latitude is None and self.base_lat is not None:
            self.base_latitude = self.base_lat
        elif self.base_lat is None and self.base_latitude is not None:
            self.base_lat = self.base_latitude
        if self.base_longitude is None and self.base_lon is not None:
            self.base_longitude = self.base_lon
        elif self.base_lon is None and self.base_longitude is not None:
            self.base_lon = self.base_longitude
        return self


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeSkillAssign(BaseModel):
    skill_id: int
    level: int = 1


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    employee_id: int
    status: str
    created_at: datetime
    skills: List[SkillInfo] = []
