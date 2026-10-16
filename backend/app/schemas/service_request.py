from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator


class ServiceRequestBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_id: int
    service_id: int
    preferred_start: datetime
    preferred_end: datetime
    address: str
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    lat: Optional[Decimal] = None
    lon: Optional[Decimal] = None
    district_code: Optional[str] = None
    complexity_level: int = 1
    has_special_equip: bool = False
    priority: int = 2

    @model_validator(mode="after")
    def sync_coords(self):
        if self.latitude is None and self.lat is not None:
            self.latitude = self.lat
        elif self.lat is None and self.latitude is not None:
            self.lat = self.latitude
        if self.longitude is None and self.lon is not None:
            self.longitude = self.lon
        elif self.lon is None and self.longitude is not None:
            self.lon = self.longitude
        return self


class ServiceRequestCreate(ServiceRequestBase):
    pass


class ServiceRequestOut(ServiceRequestBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    request_id: int
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    status: str
    created_at: datetime
    predicted_duration: Optional[int] = None  # Lấy từ quan hệ ai_predictions, không lặp cột CSDL
