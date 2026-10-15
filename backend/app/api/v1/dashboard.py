from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import (
    Customer, Employee, ServiceRequest, Assignment,
    ServiceResult, Rating
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard & KPIs"])


@router.get("/kpis", response_model=Dict[str, Any], summary="Các chỉ số quản trị cốt lõi (KPIs)")
def get_kpis(db: Session = Depends(get_db)):
    total_customers = db.execute(select(func.count(Customer.customer_id))).scalar() or 0
    total_employees = db.execute(select(func.count(Employee.employee_id)).where(Employee.status == "active")).scalar() or 0
    total_requests = db.execute(select(func.count(ServiceRequest.request_id))).scalar() or 0
    completed_requests = db.execute(select(func.count(ServiceRequest.request_id)).where(ServiceRequest.status == "completed")).scalar() or 0
    pending_requests = db.execute(select(func.count(ServiceRequest.request_id)).where(ServiceRequest.status == "pending")).scalar() or 0
    
    avg_duration = db.execute(
        select(func.avg(ServiceResult.actual_duration)).where(ServiceResult.status_outcome == "successful")
    ).scalar() or 0.0

    avg_rating = db.execute(select(func.avg(Rating.score))).scalar() or 0.0

    return {
        "total_customers": total_customers,
        "active_employees": total_employees,
        "total_requests": total_requests,
        "completed_requests": completed_requests,
        "pending_requests": pending_requests,
        "fulfillment_rate": round((completed_requests / total_requests * 100), 1) if total_requests > 0 else 0.0,
        "average_actual_duration_minutes": round(float(avg_duration), 1),
        "average_customer_rating": round(float(avg_rating), 2)
    }
