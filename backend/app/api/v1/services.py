from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Service, Skill, ServiceRequiredSkill
from app.schemas.service import ServiceCreate, ServiceOut, SkillCreate, SkillOut, RequiredSkillInfo

router = APIRouter(tags=["Services & Skills"])


@router.get("/services", response_model=List[ServiceOut], summary="Danh sách loại dịch vụ")
def list_services(db: Session = Depends(get_db)):
    services = db.execute(select(Service)).scalars().all()
    results = []
    for srv in services:
        req_skills = [
            RequiredSkillInfo(
                skill_id=rs.skill_id,
                skill_name=rs.skill.skill_name,
                min_level=rs.min_level,
                is_mandatory=rs.is_mandatory,
                mandatory=rs.is_mandatory
            )
            for rs in srv.required_skills
        ]
        results.append(ServiceOut(
            service_id=srv.service_id,
            service_name=srv.service_name,
            description=srv.description,
            default_duration=srv.default_duration,
            base_price=srv.base_price,
            is_active=srv.is_active,
            active=srv.is_active,
            required_skills=req_skills
        ))
    return results


@router.get("/skills", response_model=List[SkillOut], summary="Danh mục kỹ năng y tế")
def list_skills(db: Session = Depends(get_db)):
    return db.execute(select(Skill)).scalars().all()
