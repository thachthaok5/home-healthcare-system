from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, model_validator


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
    model_config = ConfigDict(populate_by_name=True)

    skill_id: int
    skill_name: Optional[str] = None
    min_level: int = 1
    is_mandatory: bool = True
    mandatory: bool = True

    @model_validator(mode="after")
    def sync_mandatory(self):
        if not self.is_mandatory:
            self.mandatory = False
        elif not self.mandatory:
            self.is_mandatory = False
        return self


class ServiceBase(BaseModel):
    service_name: str
    description: Optional[str] = None
    default_duration: int = 60
    base_price: Optional[Decimal] = None


class ServiceCreate(ServiceBase):
    required_skills: List[RequiredSkillInfo] = []


class ServiceOut(ServiceBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    service_id: int
    is_active: bool = True
    active: bool = True
    required_skills: List[RequiredSkillInfo] = []

    @model_validator(mode="after")
    def sync_active(self):
        if not self.is_active:
            self.active = False
        elif not self.active:
            self.is_active = False
        return self
