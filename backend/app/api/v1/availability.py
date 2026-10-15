from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import EmployeeAvailability, Employee
from app.schemas.availability import AvailabilityCreate, AvailabilityOut

router = APIRouter(prefix="/availability", tags=["Availability"])


@router.get("", response_model=List[AvailabilityOut], summary="Tra cứu lịch khả dụng của nhân viên")
def get_availabilities(
    employee_id: Optional[int] = None,
    filter_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = select(EmployeeAvailability)
    if employee_id:
        query = query.where(EmployeeAvailability.employee_id == employee_id)
    if filter_date:
        query = query.where(EmployeeAvailability.date == filter_date)
    return db.execute(query).scalars().all()


@router.post("", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED, summary="Đăng ký ca làm việc")
def create_availability(avail_in: AvailabilityCreate, db: Session = Depends(get_db)):
    emp = db.get(Employee, avail_in.employee_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân viên")
    
    avail = EmployeeAvailability(**avail_in.model_dump())
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail
