from app.schemas.auth import LoginRequest, Token, UserOut
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut
from app.schemas.employee import EmployeeCreate, EmployeeOut, SkillInfo, EmployeeSkillAssign
from app.schemas.service import ServiceCreate, ServiceOut, SkillCreate, SkillOut, RequiredSkillInfo
from app.schemas.availability import AvailabilityCreate, AvailabilityOut
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestOut
from app.schemas.assignment import (
    ManualAssignmentCreate, AssignmentConfirmRequest,
    ServiceResultRecordRequest, RatingCreate, AssignmentOut, ServiceResultOut
)

__all__ = [
    "LoginRequest", "Token", "UserOut",
    "CustomerCreate", "CustomerUpdate", "CustomerOut",
    "EmployeeCreate", "EmployeeOut", "SkillInfo", "EmployeeSkillAssign",
    "ServiceCreate", "ServiceOut", "SkillCreate", "SkillOut", "RequiredSkillInfo",
    "AvailabilityCreate", "AvailabilityOut",
    "ServiceRequestCreate", "ServiceRequestOut",
    "ManualAssignmentCreate", "AssignmentConfirmRequest",
    "ServiceResultRecordRequest", "RatingCreate", "AssignmentOut", "ServiceResultOut"
]
