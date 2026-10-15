"""
Test Suite: test_ai.py
Mục đích:
- Kiểm thử tập dữ liệu Machine Learning (Phase C).
- Kiểm thử mô hình dự đoán thời lượng AI (Phase D).
- Kiểm thử cơ chế suy luận và an toàn dự phòng (Safe Fallback).
- Kiểm thử các API AI endpoints (/api/v1/ai/*).
"""

from pathlib import Path
import pytest
import pandas as pd
import joblib
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models import AIModelVersion, Service
from app.ai.duration_prediction import DurationPredictor

client = TestClient(app)
BASE_DIR = Path(__file__).resolve().parent.parent


def test_ai_dataset_integrity():
    """Kiểm tra tính toàn vẹn của tập dữ liệu ML (Phase C)"""
    csv_path = BASE_DIR / "artifacts" / "data" / "duration_dataset.csv"
    assert csv_path.exists(), f"Không tìm thấy file dataset tại {csv_path}"

    df = pd.read_csv(csv_path)
    assert len(df) >= 800, f"Tập dữ liệu phải có ít nhất 800 mẫu, thực tế: {len(df)}"

    required_cols = [
        "service_id", "default_duration", "base_price", "complexity_level",
        "has_special_equip", "priority", "district_code", "preferred_start_hour",
        "day_of_week", "actual_duration"
    ]
    for col in required_cols:
        assert col in df.columns, f"Thiếu cột {col} trong dataset"

    # Kiểm tra target actual_duration nằm trong cận an toàn thực tế
    assert (df["actual_duration"] >= 15).all()
    assert (df["actual_duration"] <= 240).all()


def test_ai_model_artifact_load_and_inference():
    """Kiểm tra nạp file model artifact và dự đoán thử nghiệm (Phase D)"""
    model_path = BASE_DIR / "artifacts" / "models" / "duration_model_v1.joblib"
    assert model_path.exists(), f"Không tìm thấy file model artifact tại {model_path}"

    model = joblib.load(model_path)
    assert model is not None

    # Thử suy luận với 1 bản ghi mẫu
    sample_df = pd.DataFrame([{
        "default_duration": 45,
        "base_price": 150000.0,
        "complexity_level": 2,
        "has_special_equip": 0,
        "priority": 2,
        "preferred_start_hour": 9,
        "day_of_week": 2,
        "district_code": "LOC_THO"
    }])
    pred = model.predict(sample_df)
    assert len(pred) == 1
    assert 30 <= pred[0] <= 90


def test_ai_model_version_registry_in_db(db_session):
    """Kiểm tra thông tin mô hình được đăng ký đầy đủ trong PostgreSQL (ai_model_versions)"""
    model_v = db_session.execute(
        select(AIModelVersion)
        .where(AIModelVersion.task == "duration_prediction")
        .where(AIModelVersion.active == True)
    ).scalars().first()

    assert model_v is not None, "Phải có ít nhất 1 mô hình active cho duration_prediction"
    assert model_v.version == "v1.1.0"
    assert model_v.metrics_json is not None
    assert "mae" in model_v.metrics_json
    assert "rmse" in model_v.metrics_json
    assert "r2" in model_v.metrics_json
    assert model_v.metrics_json["r2"] > 0.85, f"R^2 phải đạt trên 0.85, thực tế: {model_v.metrics_json['r2']}"
    assert model_v.metrics_json["mae"] < 6.0, f"MAE phải dưới 6 phút, thực tế: {model_v.metrics_json['mae']}"


def test_api_predict_duration_endpoint():
    """Kiểm thử API POST /api/v1/ai/predict-duration"""
    payload = {
        "service_id": 1,  # Chăm sóc vết thương (default_duration = 45 phút)
        "complexity_level": 1,
        "has_special_equip": False,
        "priority": 2,
        "district_code": "LOC_THO"
    }
    res = client.post("/api/v1/ai/predict-duration", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["service_id"] == 1
    assert data["default_duration"] == 45
    assert 35 <= data["predicted_duration"] <= 60
    assert data["confidence_score"] >= 0.85
    assert data["model_version"] == "v1.1.0"

    # Trường hợp ca khó (độ phức tạp 4 + thiết bị chuyên dụng): thời lượng phải tăng tương ứng
    payload_hard = {
        "service_id": 1,
        "complexity_level": 4,
        "has_special_equip": True,
        "priority": 3,
        "district_code": "VINH_HAI"
    }
    res_hard = client.post("/api/v1/ai/predict-duration", json=payload_hard)
    assert res_hard.status_code == 200
    data_hard = res_hard.json()
    assert data_hard["predicted_duration"] > data["predicted_duration"] + 10


def test_api_ai_models_comparison_endpoint():
    """Kiểm thử API GET /api/v1/ai/models/comparison phục vụ báo cáo đồ án"""
    res = client.get("/api/v1/ai/models/comparison")
    assert res.status_code == 200
    data = res.json()
    assert data["task"] == "duration_prediction"
    assert "metrics" in data
    assert len(data["metrics"]) >= 4  # Ít nhất 4 mô hình so sánh


def test_safe_fallback_mechanism(db_session):
    """Kiểm tra cơ chế an toàn Fallback khi nạp dịch vụ không có mô hình"""
    srv = db_session.get(Service, 1)
    # Thử nghiệm với đối số hợp lệ
    dur, meta, m_id = DurationPredictor.predict(
        db=db_session,
        service=srv,
        complexity_level=1,
        has_special_equip=False,
        priority=2,
        district_code="LOC_THO"
    )
    assert dur > 0
    assert "confidence_score" in meta
