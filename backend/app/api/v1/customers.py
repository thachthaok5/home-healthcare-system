from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=List[CustomerOut], summary="Danh sách khách hàng")
def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = select(Customer)
    if search:
        query = query.where(Customer.full_name.ilike(f"%{search}%"))
    query = query.offset(skip).limit(limit)
    return db.execute(query).scalars().all()


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED, summary="Tạo mới hồ sơ khách hàng")
def create_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db)
):
    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut, summary="Xem chi tiết khách hàng")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng")
    return customer
