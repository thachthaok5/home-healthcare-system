from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class SkillBase(BaseModel):
    skill_name: str
    description: Optional[str] = None


class SkillCreate(SkillBase):
    pass


class SkillOut(SkillBase):
    model_config = ConfigDict(from_attributes=True)

    skill_id: int
    status: str


class RequiredSkillInfo(BaseModel):
    skill_id: int
    skill_name: Optional[str] = None
    min_level: int = 1
    mandatory: bool = True


class ServiceBase(BaseModel):
    service_name: str
    description: Optional[str] = None
    default_duration: int = 60
    base_price: Optional[Decimal] = None


class ServiceCreate(ServiceBase):
    required_skills: List[RequiredSkillInfo] = []


class ServiceOut(ServiceBase):
    model_config = ConfigDict(from_attributes=True)

    service_id: int
    active: bool
    required_skills: List[RequiredSkillInfo] = []
