from app.db.base import Base

# Authentication & RBAC (4 tables)
from app.models.auth import Role, Permission, RolePermission, User

# Profile (2 tables)
from app.models.profile import Customer, Employee

# Service & Skill (4 tables)
from app.models.service import Skill, EmployeeSkill, Service, ServiceRequiredSkill

# Demand & Availability (3 tables)
from app.models.demand import ServiceRequest, EmployeeAvailability, LeaveRequest

# Scheduling & Assignments (5 tables)
from app.models.scheduling import ScheduleVersion, Assignment, TravelMatrix, ServiceResult, Rating

# AI Models & Predictions (3 tables)
from app.models.ai import AIModelVersion, AIPrediction, RecommendationLog

# System Management (2 tables)
from app.models.system import Notification, AuditLog

__all__ = [
    "Base",
    # Auth & RBAC
    "Role",
    "Permission",
    "RolePermission",
    "User",
    # Profiles
    "Customer",
    "Employee",
    # Service & Skills
    "Skill",
    "EmployeeSkill",
    "Service",
    "ServiceRequiredSkill",
    # Demands & Availability
    "ServiceRequest",
    "EmployeeAvailability",
    "LeaveRequest",
    # Scheduling & Execution
    "ScheduleVersion",
    "Assignment",
    "TravelMatrix",
    "ServiceResult",
    "Rating",
    # AI & Recommendations
    "AIModelVersion",
    "AIPrediction",
    "RecommendationLog",
    # System
    "Notification",
    "AuditLog",
]
