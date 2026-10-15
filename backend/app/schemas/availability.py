from datetime import date, time
from pydantic import BaseModel, ConfigDict


class AvailabilityCreate(BaseModel):
    employee_id: int
    date: date
    start_time: time
    end_time: time
    availability_type: str = "working"


class AvailabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    availability_id: int
    employee_id: int
    date: date
    start_time: time
    end_time: time
    availability_type: str
