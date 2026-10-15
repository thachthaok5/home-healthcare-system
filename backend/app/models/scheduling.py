from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import BigInteger, String, Text, Date, DateTime, Numeric, Integer, SmallInteger, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"

    schedule_version_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(100), nullable=False)  # vd: OR-Tools CP-SAT, Weighted DSS, First Feasible
    parameters_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="created_schedules")
    assignments: Mapped[List["Assignment"]] = relationship("Assignment", back_populates="schedule_version")
    recommendation_logs: Mapped[List["RecommendationLog"]] = relationship("RecommendationLog", back_populates="schedule_version")


class Assignment(Base):
    __tablename__ = "assignments"

    assignment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("service_requests.request_id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.employee_id"), nullable=False, index=True)
    schedule_version_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("schedule_versions.schedule_version_id"), nullable=True, index=True)
    prediction_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("ai_predictions.prediction_id"), nullable=True, index=True)
    selected_recommendation_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("recommendation_logs.recommendation_id"), nullable=True, index=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assignment_status: Mapped[str] = mapped_column(String(40), nullable=False, default="proposed", index=True)  # proposed, confirmed, completed, cancelled
    recommendation_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confirmed_by: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Lý do Coordinator chọn khác đề xuất AI
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="assignments")
    employee: Mapped["Employee"] = relationship("Employee", back_populates="assignments")
    schedule_version: Mapped[Optional["ScheduleVersion"]] = relationship("ScheduleVersion", back_populates="assignments")
    prediction: Mapped[Optional["AIPrediction"]] = relationship("AIPrediction", back_populates="assignments")
    recommendation: Mapped[Optional["RecommendationLog"]] = relationship("RecommendationLog", back_populates="selected_in_assignment", foreign_keys=[selected_recommendation_id])
    confirmer: Mapped[Optional["User"]] = relationship("User", back_populates="confirmed_assignments")
    service_result: Mapped[Optional["ServiceResult"]] = relationship("ServiceResult", back_populates="assignment", uselist=False)
    rating: Mapped[Optional["Rating"]] = relationship("Rating", back_populates="assignment", uselist=False)


class TravelMatrix(Base):
    __tablename__ = "travel_matrix"

    travel_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    from_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    to_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    distance_km: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    travel_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # vd: OSRM, Haversine, Google Maps
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ServiceResult(Base):
    __tablename__ = "service_results"

    service_result_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("assignments.assignment_id"), unique=True, nullable=False, index=True)
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Target của mô hình AI: actual_end - actual_start (phút)
    status_outcome: Mapped[str] = mapped_column(String(30), nullable=False, default="successful")  # successful, patient_absent, aborted, partially_completed
    travel_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="service_result")


class Rating(Base):
    __tablename__ = "ratings"

    rating_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("assignments.assignment_id"), unique=True, nullable=False, index=True)
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # Thang điểm 1-5
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="rating")
