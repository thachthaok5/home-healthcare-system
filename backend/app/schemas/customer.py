from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator


class CustomerBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    lat: Optional[Decimal] = None
    lon: Optional[Decimal] = None
    emergency_contact: Optional[str] = None

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


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    lat: Optional[Decimal] = None
    lon: Optional[Decimal] = None
    emergency_contact: Optional[str] = None

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


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    customer_id: int
    status: str
    created_at: datetime
