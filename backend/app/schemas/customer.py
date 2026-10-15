from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CustomerBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    lat: Optional[Decimal] = None
    lon: Optional[Decimal] = None
    emergency_contact: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[Decimal] = None
    lon: Optional[Decimal] = None
    emergency_contact: Optional[str] = None


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    status: str
    created_at: datetime
