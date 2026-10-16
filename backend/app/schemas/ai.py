from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, model_validator


class DurationPredictionRequest(BaseModel):
    service_id: int
    complexity_level: int = 1
    has_special_equip: bool = False
    priority: int = 2
    district_code: Optional[str] = "LOC_THO"
    preferred_start: Optional[datetime] = None


class DurationPredictionResponse(BaseModel):
    service_id: int
    default_duration: int
    predicted_duration: int
    difference_minutes: int
    model_version: Optional[str] = None
    algorithm: Optional[str] = None
    confidence_score: float
    source: str
    meta: Optional[Dict[str, Any]] = None


class AIModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    model_id: int
    task: str
    algorithm: str
    version: str
    metrics_json: Optional[Dict[str, Any]] = None
    artifact_path: Optional[str] = None
    trained_at: datetime
    is_active: bool = False
    active: bool = False

    @model_validator(mode="after")
    def sync_active(self):
        if self.is_active:
            self.active = True
        elif self.active:
            self.is_active = True
        return self
