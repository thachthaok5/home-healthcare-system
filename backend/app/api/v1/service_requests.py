from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import ServiceRequest, Customer, Service, AIPrediction, AIModelVersion
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestOut

router = APIRouter(prefix="/service-requests", tags=["Service Requests"])


@router.get("", response_model=List[ServiceRequestOut], summary="Danh sách yêu cầu dịch vụ chăm sóc")
def list_service_requests(
    status_filter: Optional[str] = None,
    customer_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = select(ServiceRequest)
    if status_filter:
        query = query.where(ServiceRequest.status == status_filter)
    if customer_id:
        query = query.where(ServiceRequest.customer_id == customer_id)
    query = query.order_by(ServiceRequest.created_at.desc()).offset(skip).limit(limit)
    
    requests = db.execute(query).scalars().all()
    results = []
    for r in requests:
        pred_val = None
        if r.ai_predictions:
            pred_val = r.ai_predictions[0].predicted_duration

        results.append(ServiceRequestOut(
            request_id=r.request_id,
            customer_id=r.customer_id,
            service_id=r.service_id,
            customer_name=r.customer.full_name if r.customer else None,
            service_name=r.service.service_name if r.service else None,
            preferred_start=r.preferred_start,
            preferred_end=r.preferred_end,
            address=r.address,
            lat=r.lat,
            lon=r.lon,
            district_code=r.district_code,
            complexity_level=r.complexity_level,
            has_special_equip=r.has_special_equip,
            priority=r.priority,
            status=r.status,
            created_at=r.created_at,
            predicted_duration=pred_val
        ))
    return results


@router.post("", response_model=ServiceRequestOut, status_code=status.HTTP_201_CREATED, summary="Tiếp nhận yêu cầu chăm sóc mới")
def create_service_request(req_in: ServiceRequestCreate, db: Session = Depends(get_db)):
    # 1. Thẩm định tính hợp lệ thời gian
    if req_in.preferred_start >= req_in.preferred_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian bắt đầu mong muốn phải trước thời gian kết thúc"
        )
    
    # 2. Kiểm tra tồn tại Khách hàng và Dịch vụ
    cust = db.get(Customer, req_in.customer_id)
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng")
    srv = db.get(Service, req_in.service_id)
    if not srv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy dịch vụ")

    # 3. Tạo Service Request
    sr = ServiceRequest(**req_in.model_dump())
    db.add(sr)
    db.flush()

    # 4. Tự động dự đoán thời lượng bằng mô hình AI (với cơ chế an toàn Fallback)
    from app.ai.duration_prediction import DurationPredictor
    predicted_dur, pred_meta, model_id = DurationPredictor.predict(
        db=db,
        service=srv,
        complexity_level=sr.complexity_level,
        has_special_equip=sr.has_special_equip,
        priority=sr.priority,
        district_code=sr.district_code,
        preferred_start=sr.preferred_start
    )

    if model_id:
        pred = AIPrediction(
            request_id=sr.request_id,
            model_id=model_id,
            predicted_duration=predicted_dur,
            prediction_meta_json=pred_meta
        )
        db.add(pred)

    db.commit()
    db.refresh(sr)

    return ServiceRequestOut(
        request_id=sr.request_id,
        customer_id=sr.customer_id,
        service_id=sr.service_id,
        customer_name=cust.full_name,
        service_name=srv.service_name,
        preferred_start=sr.preferred_start,
        preferred_end=sr.preferred_end,
        address=sr.address,
        lat=sr.lat,
        lon=sr.lon,
        district_code=sr.district_code,
        complexity_level=sr.complexity_level,
        has_special_equip=sr.has_special_equip,
        priority=sr.priority,
        status=sr.status,
        created_at=sr.created_at,
        predicted_duration=predicted_dur
    )


@router.get("/{request_id}", response_model=ServiceRequestOut, summary="Xem chi tiết yêu cầu chăm sóc")
def get_service_request(request_id: int, db: Session = Depends(get_db)):
    r = db.get(ServiceRequest, request_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy yêu cầu")
    
    pred_val = r.ai_predictions[0].predicted_duration if r.ai_predictions else None
    return ServiceRequestOut(
        request_id=r.request_id,
        customer_id=r.customer_id,
        service_id=r.service_id,
        customer_name=r.customer.full_name if r.customer else None,
        service_name=r.service.service_name if r.service else None,
        preferred_start=r.preferred_start,
        preferred_end=r.preferred_end,
        address=r.address,
        lat=r.lat,
        lon=r.lon,
        district_code=r.district_code,
        complexity_level=r.complexity_level,
        has_special_equip=r.has_special_equip,
        priority=r.priority,
        status=r.status,
        created_at=r.created_at,
        predicted_duration=pred_val
    )
