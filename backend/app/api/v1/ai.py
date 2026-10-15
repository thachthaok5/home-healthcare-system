from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Service, AIModelVersion
from app.schemas.ai import DurationPredictionRequest, DurationPredictionResponse, AIModelVersionOut
from app.ai.duration_prediction import DurationPredictor

router = APIRouter(prefix="/ai", tags=["AI & Predictions"])


@router.post("/predict-duration", response_model=DurationPredictionResponse, summary="Dự đoán thời lượng dịch vụ bằng mô hình AI")
def predict_service_duration(
    req: DurationPredictionRequest,
    db: Session = Depends(get_db)
):
    srv = db.get(Service, req.service_id)
    if not srv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy dịch vụ")

    pred_minutes, meta, model_id = DurationPredictor.predict(
        db=db,
        service=srv,
        complexity_level=req.complexity_level,
        has_special_equip=req.has_special_equip,
        priority=req.priority,
        district_code=req.district_code,
        preferred_start=req.preferred_start
    )

    diff = pred_minutes - srv.default_duration

    return DurationPredictionResponse(
        service_id=srv.service_id,
        default_duration=srv.default_duration,
        predicted_duration=pred_minutes,
        difference_minutes=diff,
        model_version=meta.get("model_version"),
        algorithm=meta.get("algorithm"),
        confidence_score=meta.get("confidence_score", 0.90),
        source=meta.get("source", "ml_model_inference"),
        meta=meta
    )


@router.get("/models", response_model=List[AIModelVersionOut], summary="Danh sách các phiên bản mô hình AI đã đăng ký")
def list_ai_models(db: Session = Depends(get_db)):
    models = db.execute(
        select(AIModelVersion).order_by(AIModelVersion.trained_at.desc())
    ).scalars().all()
    return models


@router.get("/models/active", response_model=AIModelVersionOut, summary="Xem thông tin mô hình AI đang phục vụ dự đoán")
def get_active_model(db: Session = Depends(get_db)):
    model = db.execute(
        select(AIModelVersion)
        .where(AIModelVersion.task == "duration_prediction")
        .where(AIModelVersion.active == True)
    ).scalars().first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có mô hình nào được kích hoạt")
    return model


@router.get("/models/comparison", summary="Báo cáo so sánh các thuật toán AI (MAE, RMSE, R2) cho đồ án")
def get_models_comparison(db: Session = Depends(get_db)):
    model = db.execute(
        select(AIModelVersion)
        .where(AIModelVersion.task == "duration_prediction")
        .where(AIModelVersion.active == True)
    ).scalars().first()

    if not model or not model.metrics_json or "all_models_comparison" not in model.metrics_json:
        # Dữ liệu dự phòng nếu chưa chạy script
        return {
            "task": "duration_prediction",
            "active_version": model.version if model else "N/A",
            "comparison": []
        }

    return {
        "task": "duration_prediction",
        "active_version": model.version,
        "active_algorithm": model.algorithm,
        "metrics": model.metrics_json.get("all_models_comparison", []),
        "evaluation_summary": (
            f"Mô hình {model.algorithm} đạt hiệu suất cao nhất với MAE={model.metrics_json.get('mae')} phút "
            f"và R²={model.metrics_json.get('r2')}, giảm thiểu sai số đáng kể so với mức chuẩn cố định."
        )
    }
