from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ServiceRequestBase(BaseModel):
    customer_id: int
    service_id: int
    preferred_start: datetime
    preferred_end: datetime
    address: str
    lat: Optional[Decimal] = None
    lon: Optional[Decimal] = None
    district_code: Optional[str] = None
    complexity_level: int = 1
    has_special_equip: bool = False
    priority: int = 2


class ServiceRequestCreate(ServiceRequestBase):
    pass


class ServiceRequestOut(ServiceRequestBase):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    status: str
    created_at: datetime
    predicted_duration: Optional[int] = None  # Lấy từ quan hệ ai_predictions, không lặp cột CSDL
