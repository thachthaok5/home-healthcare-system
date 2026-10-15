from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Employee, EmployeeSkill, Skill
from app.schemas.employee import EmployeeCreate, EmployeeOut, SkillInfo, EmployeeSkillAssign

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=List[EmployeeOut], summary="Danh sách nhân viên y tế")
def list_employees(
    status_filter: Optional[str] = "active",
    employee_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = select(Employee)
    if status_filter:
        query = query.where(Employee.status == status_filter)
    if employee_type:
        query = query.where(Employee.employee_type == employee_type)
    
    employees = db.execute(query).scalars().all()
    results = []
    for emp in employees:
        skills_info = [
            SkillInfo(skill_id=es.skill_id, skill_name=es.skill.skill_name, level=es.level)
            for es in emp.employee_skills
        ]
        results.append(EmployeeOut(
            employee_id=emp.employee_id,
            full_name=emp.full_name,
            employee_type=emp.employee_type,
            phone=emp.phone,
            base_lat=emp.base_lat,
            base_lon=emp.base_lon,
            max_daily_minutes=emp.max_daily_minutes,
            status=emp.status,
            created_at=emp.created_at,
            skills=skills_info
        ))
    return results


@router.get("/{employee_id}", response_model=EmployeeOut, summary="Xem chi tiết nhân viên")
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân viên")
    
    skills_info = [
        SkillInfo(skill_id=es.skill_id, skill_name=es.skill.skill_name, level=es.level)
        for es in emp.employee_skills
    ]
    return EmployeeOut(
        employee_id=emp.employee_id,
        full_name=emp.full_name,
        employee_type=emp.employee_type,
        phone=emp.phone,
        base_lat=emp.base_lat,
        base_lon=emp.base_lon,
        max_daily_minutes=emp.max_daily_minutes,
        status=emp.status,
        created_at=emp.created_at,
        skills=skills_info
    )


@router.post("/{employee_id}/skills", status_code=status.HTTP_201_CREATED, summary="Gán kỹ năng cho nhân viên")
def assign_skill(employee_id: int, skill_in: EmployeeSkillAssign, db: Session = Depends(get_db)):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân viên")
    skill = db.get(Skill, skill_in.skill_id)
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy kỹ năng")

    emp_skill = db.execute(
        select(EmployeeSkill).where(
            EmployeeSkill.employee_id == employee_id,
            EmployeeSkill.skill_id == skill_in.skill_id
        )
    ).scalar_one_or_none()

    if emp_skill:
        emp_skill.level = skill_in.level
    else:
        emp_skill = EmployeeSkill(employee_id=employee_id, skill_id=skill_in.skill_id, level=skill_in.level)
        db.add(emp_skill)
    
    db.commit()
    return {"message": "Gán kỹ năng thành công", "employee_id": employee_id, "skill_id": skill_in.skill_id, "level": skill_in.level}
