from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import BigInteger, String, Text, Date, DateTime, Numeric, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.user_id"), unique=True, nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    lon: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="customer")
    service_requests: Mapped[List["ServiceRequest"]] = relationship("ServiceRequest", back_populates="customer")


class Employee(Base):
    __tablename__ = "employees"

    employee_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    employee_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # vd: nurse, caregiver, physiotherapist
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    base_lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    base_lon: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    max_daily_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=480)  # 8 hours = 480 mins
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="employee")
    employee_skills: Mapped[List["EmployeeSkill"]] = relationship("EmployeeSkill", back_populates="employee", cascade="all, delete-orphan")
    availabilities: Mapped[List["EmployeeAvailability"]] = relationship("EmployeeAvailability", back_populates="employee", cascade="all, delete-orphan")
    leave_requests: Mapped[List["LeaveRequest"]] = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    assignments: Mapped[List["Assignment"]] = relationship("Assignment", back_populates="employee")
    recommendation_logs: Mapped[List["RecommendationLog"]] = relationship("RecommendationLog", back_populates="employee")
