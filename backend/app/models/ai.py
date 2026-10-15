from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import BigInteger, String, Text, DateTime, Numeric, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class AIModelVersion(Base):
    __tablename__ = "ai_model_versions"

    model_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task: Mapped[str] = mapped_column(String(100), nullable=False)  # vd: duration_prediction, demand_forecasting
    algorithm: Mapped[str] = mapped_column(String(100), nullable=False)  # vd: Ridge, RandomForest, HistGradientBoosting
    version: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)  # vd: v1.0.0
    feature_schema_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)  # Danh sách features và types
    metrics_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)  # MAE, RMSE, R2
    artifact_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Đường dẫn tới file model .joblib
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # True = model đang phục vụ production/inference

    # Relationships
    predictions: Mapped[List["AIPrediction"]] = relationship("AIPrediction", back_populates="model")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    prediction_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("service_requests.request_id"), nullable=False, index=True)
    model_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("ai_model_versions.model_id"), nullable=False, index=True)
    predicted_duration: Mapped[int] = mapped_column(Integer, nullable=False)  # Số phút dự đoán
    prediction_meta_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)  # input snapshot, feature importance
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="ai_predictions")
    model: Mapped["AIModelVersion"] = relationship("AIModelVersion", back_populates="predictions")
    assignments: Mapped[List["Assignment"]] = relationship("Assignment", back_populates="prediction")


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"

    recommendation_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("service_requests.request_id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.employee_id"), nullable=False, index=True)
    schedule_version_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("schedule_versions.schedule_version_id"), nullable=True, index=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)  # Top 1, Top 2, Top 3
    score: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)  # Điểm tổng hợp [0 - 1]
    score_breakdown_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)  # SkillFit, TimeFit, Distance, Workload, Continuity
    rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Lý do nếu ứng viên bị loại ở Hard Constraints
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="recommendation_logs")
    employee: Mapped["Employee"] = relationship("Employee", back_populates="recommendation_logs")
    schedule_version: Mapped[Optional["ScheduleVersion"]] = relationship("ScheduleVersion", back_populates="recommendation_logs")
    selected_in_assignment: Mapped[List["Assignment"]] = relationship("Assignment", back_populates="recommendation", foreign_keys="Assignment.selected_recommendation_id")
