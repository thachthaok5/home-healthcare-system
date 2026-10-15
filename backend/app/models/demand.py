from datetime import date, time, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import BigInteger, String, Text, Date, Time, DateTime, Numeric, SmallInteger, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    request_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("customers.customer_id"), nullable=False, index=True)
    service_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("services.service_id"), nullable=False, index=True)
    preferred_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    preferred_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    lon: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    district_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    complexity_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)  # Mức độ phức tạp (1-3)
    has_special_equip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=2)  # 1: Khẩn, 2: Bình thường, 3: Thấp
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="service_requests")
    service: Mapped["Service"] = relationship("Service", back_populates="service_requests")
    assignments: Mapped[List["Assignment"]] = relationship("Assignment", back_populates="request")
    ai_predictions: Mapped[List["AIPrediction"]] = relationship("AIPrediction", back_populates="request")
    recommendation_logs: Mapped[List["RecommendationLog"]] = relationship("RecommendationLog", back_populates="request")


class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"

    availability_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.employee_id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    availability_type: Mapped[str] = mapped_column(String(30), nullable=False, default="working")  # working, available, on_call

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="availabilities")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    leave_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.employee_id"), nullable=False, index=True)
    from_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    to_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")  # pending, approved, rejected
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="leave_requests")
