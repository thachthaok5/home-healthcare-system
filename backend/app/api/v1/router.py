from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.customers import router as customers_router
from app.api.v1.employees import router as employees_router
from app.api.v1.services import router as services_router
from app.api.v1.availability import router as availability_router
from app.api.v1.service_requests import router as service_requests_router
from app.api.v1.assignments import router as assignments_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.ai import router as ai_router
from app.api.v1.scheduling import router as scheduling_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(customers_router)
api_router.include_router(employees_router)
api_router.include_router(services_router)
api_router.include_router(availability_router)
api_router.include_router(service_requests_router)
api_router.include_router(assignments_router)
api_router.include_router(dashboard_router)
api_router.include_router(ai_router)
api_router.include_router(scheduling_router)
