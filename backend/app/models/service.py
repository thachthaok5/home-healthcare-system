from datetime import date
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import BigInteger, String, Text, Date, Numeric, Integer, SmallInteger, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Skill(Base):
    __tablename__ = "skills"

    skill_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    skill_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    # Relationships
    employee_skills: Mapped[List["EmployeeSkill"]] = relationship("EmployeeSkill", back_populates="skill", cascade="all, delete-orphan")
    service_required_skills: Mapped[List["ServiceRequiredSkill"]] = relationship("ServiceRequiredSkill", back_populates="skill", cascade="all, delete-orphan")


class EmployeeSkill(Base):
    __tablename__ = "employee_skills"

    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.employee_id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("skills.skill_id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)  # Cấp độ kỹ năng (1-5)
    valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="employee_skills")
    skill: Mapped["Skill"] = relationship("Skill", back_populates="employee_skills")


class Service(Base):
    __tablename__ = "services"

    service_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    service_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=60)  # Phút mặc định (fallback khi AI không khả dụng)
    base_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    service_requests: Mapped[List["ServiceRequest"]] = relationship("ServiceRequest", back_populates="service")
    required_skills: Mapped[List["ServiceRequiredSkill"]] = relationship("ServiceRequiredSkill", back_populates="service", cascade="all, delete-orphan")


class ServiceRequiredSkill(Base):
    __tablename__ = "service_required_skills"

    service_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("services.service_id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("skills.skill_id", ondelete="CASCADE"), primary_key=True)
    min_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)  # True = bắt buộc (hard constraint)

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="required_skills")
    skill: Mapped["Skill"] = relationship("Skill", back_populates="service_required_skills")
