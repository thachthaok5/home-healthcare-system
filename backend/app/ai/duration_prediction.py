"""
Module: duration_prediction.py
Mục đích:
- Cung cấp dịch vụ AI dự đoán thời lượng dịch vụ chăm sóc sức khỏe tại nhà.
- Sử dụng mô hình Machine Learning tốt nhất (HistGradientBoosting / RandomForest) đã huấn luyện.
- Hỗ trợ cơ chế Fallback an toàn (Safe Fallback) về `services.default_duration` khi có ngoại lệ.
- Ghi nhận đầy đủ metadata dự đoán (model version, feature inputs, confidence score) phục vụ giải trình DSS.
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from datetime import datetime
import joblib
import pandas as pd

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Service, ServiceRequest, AIModelVersion

logger = logging.getLogger(__name__)

# Thư mục gốc chứa model artifacts
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class DurationPredictor:
    """
    Bộ dự đoán thời lượng AI tích hợp cache mô hình và fallback an toàn.
    """
    _cached_model = None
    _cached_model_id = None
    _cached_version = None
    _cached_algorithm = None

    @classmethod
    def load_active_model(cls, db: Session):
        """
        Nạp mô hình đang active từ CSDL và file artifact joblib.
        """
        active_model = db.execute(
            select(AIModelVersion)
            .where(AIModelVersion.task == "duration_prediction")
            .where(AIModelVersion.active == True)
        ).scalars().first()

        if not active_model:
            logger.warning("Không tìm thấy mô hình active nào trong ai_model_versions.")
            return None, None, None, None

        if cls._cached_model_id == active_model.model_id and cls._cached_model is not None:
            return cls._cached_model, active_model.model_id, active_model.version, active_model.algorithm

        # Nạp từ file artifact
        model_path = BASE_DIR / (active_model.artifact_path or "artifacts/models/duration_model_v1.joblib")
        if not model_path.exists():
            logger.warning(f"File mô hình không tồn tại tại {model_path}. Kích hoạt chế độ fallback.")
            return None, active_model.model_id, active_model.version, active_model.algorithm

        try:
            loaded_obj = joblib.load(model_path)
            cls._cached_model = loaded_obj
            cls._cached_model_id = active_model.model_id
            cls._cached_version = active_model.version
            cls._cached_algorithm = active_model.algorithm
            logger.info(f"Đã nạp thành công mô hình AI {active_model.algorithm} (Version {active_model.version})")
            return cls._cached_model, active_model.model_id, active_model.version, active_model.algorithm
        except Exception as e:
            logger.error(f"Lỗi nạp file mô hình: {e}. Kích hoạt chế độ fallback.")
            return None, active_model.model_id, active_model.version, active_model.algorithm

    @classmethod
    def predict(
        cls,
        db: Session,
        service: Service,
        complexity_level: int = 1,
        has_special_equip: bool = False,
        priority: int = 2,
        district_code: Optional[str] = None,
        preferred_start: Optional[datetime] = None
    ) -> Tuple[int, Dict[str, Any], Optional[int]]:
        """
        Dự đoán số phút thực hiện dịch vụ.
        Trả về:
            - predicted_minutes (int)
            - metadata (dict)
            - model_id (int hoặc None)
        """
        model, model_id, version, algorithm = cls.load_active_model(db)

        # Fallback cơ sở mặc định nếu không có mô hình hoặc mô hình bị lỗi
        default_dur = service.default_duration if service else 60
        base_prc = float(service.base_price) if service and service.base_price else 200000.0

        if model is None:
            # Fallback theo quy tắc nghiệp vụ điều dưỡng kết hợp độ phức tạp
            fallback_duration = int(default_dur * (1 + (complexity_level - 1) * 0.12))
            if has_special_equip:
                fallback_duration += 12
            meta = {
                "source": "business_rule_fallback",
                "reason": "Model artifact not available or inactive",
                "default_duration": default_dur,
                "confidence_score": 0.70
            }
            return fallback_duration, meta, model_id

        # Chuẩn bị dữ liệu đầu vào chuẩn xác theo schema huấn luyện
        pref_hour = preferred_start.hour if preferred_start else 9
        day_of_week = preferred_start.weekday() if preferred_start else 2
        dist_code = district_code or "LOC_THO"

        input_data = pd.DataFrame([{
            "default_duration": default_dur,
            "base_price": base_prc,
            "complexity_level": complexity_level,
            "has_special_equip": 1 if has_special_equip else 0,
            "priority": priority,
            "preferred_start_hour": pref_hour,
            "day_of_week": day_of_week,
            "district_code": dist_code
        }])

        try:
            raw_pred = model.predict(input_data)[0]
            predicted_minutes = int(round(raw_pred))

            # Giới hạn an toàn (tối thiểu 15 phút, tối đa 240 phút)
            predicted_minutes = max(15, min(240, predicted_minutes))

            meta = {
                "source": "ml_model_inference",
                "model_version": version,
                "algorithm": algorithm,
                "input_snapshot": {
                    "service_id": service.service_id if service else None,
                    "default_duration": default_dur,
                    "complexity_level": complexity_level,
                    "has_special_equip": has_special_equip,
                    "priority": priority,
                    "district_code": dist_code,
                    "hour": pref_hour
                },
                "confidence_score": 0.92,
                "diff_from_default": predicted_minutes - default_dur
            }
            return predicted_minutes, meta, model_id

        except Exception as e:
            logger.error(f"Lỗi khi thực hiện suy luận ML: {e}. Fallback về mặc định.")
            fallback_duration = default_dur
            meta = {
                "source": "exception_fallback",
                "error": str(e),
                "default_duration": default_dur,
                "confidence_score": 0.50
            }
            return fallback_duration, meta, model_id
