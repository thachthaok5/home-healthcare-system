"""
Script: train_duration_models.py
Mục đích:
- Huấn luyện và đánh giá so sánh 4 mô hình Machine Learning dự đoán thời lượng dịch vụ:
  1. Baseline 1: Quy chuẩn cố định (default_duration)
  2. Baseline 2: Giá trị trung bình theo dịch vụ (Service-specific Mean)
  3. Linear Model: Ridge Regression
  4. Ensemble Tree: Random Forest Regressor
  5. Gradient Boosting: HistGradientBoostingRegressor
- Đánh giá trên tập kiểm thử độc lập (Test Set) bằng 3 chỉ số bắt buộc trong đồ án MIS:
  - MAE (Mean Absolute Error)
  - RMSE (Root Mean Squared Error)
  - R^2 Score (Hệ số xác định)
- Lưu trữ mô hình tối ưu nhất dưới dạng file joblib vào artifacts/models/duration_model_v1.joblib.
- Đăng ký metadata của mô hình vào bảng `ai_model_versions` trong PostgreSQL 18.
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import joblib

# Thiết lập đường dẫn import backend
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from sqlalchemy import select, update
from app.db.session import SessionLocal
from app.models import AIModelVersion


def train_and_evaluate_models():
    # 1. Đọc dữ liệu đã sinh
    csv_path = BASE_DIR / "artifacts" / "data" / "duration_dataset.csv"
    if not csv_path.exists():
        print(f"Error: Khong tim thay tap du lieu tai {csv_path}. Vui long chay build_duration_dataset.py truoc.")
        return

    df = pd.read_csv(csv_path)
    print(f"-> Da load {len(df)} mau tu {csv_path}")

    # 2. Phân chia Features (X) và Target (y)
    # KHÔNG RÒ RỈ DỮ LIỆU: chỉ dùng các đặc trưng đã biết trước khi thực hiện ca
    num_features = [
        "default_duration",
        "base_price",
        "complexity_level",
        "has_special_equip",
        "priority",
        "preferred_start_hour",
        "day_of_week"
    ]
    cat_features = ["district_code"]

    X = df[num_features + cat_features]
    y = df["actual_duration"]

    # Phân chia Train (70%), Validation (15%), Test (15%) với random_state cố định
    X_temp, X_test, y_temp, y_test = train_test_split(X, y, test_size=0.15, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=0.1765, random_state=42)  # 0.85 * 0.1765 ≈ 0.15

    print(f"-> Tap huan luyen (Train): {len(X_train)} mau")
    print(f"-> Tap tham dinh (Val):    {len(X_val)} mau")
    print(f"-> Tap kiem thu (Test):    {len(X_test)} mau")

    # 3. Xây dựng Preprocessor (chuẩn hóa dữ liệu)
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_features),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features)
        ]
    )

    # 4. Định nghĩa các mô hình thử nghiệm
    models = {
        "Baseline_DefaultDuration": None,  # Quy chuẩn cố định của hệ thống
        "Baseline_ServiceMean": None,       # Trung bình theo nhóm dịch vụ
        "Ridge_Regression": Pipeline([
            ("preprocessor", preprocessor),
            ("regressor", Ridge(alpha=1.0, random_state=42))
        ]),
        "Random_Forest": Pipeline([
            ("preprocessor", preprocessor),
            ("regressor", RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42))
        ]),
        "Hist_Gradient_Boosting": Pipeline([
            ("preprocessor", preprocessor),
            ("regressor", HistGradientBoostingRegressor(max_iter=100, max_depth=6, random_state=42))
        ])
    }

    # Bảng lưu kết quả so sánh
    results = []

    # Dữ liệu phụ trợ cho Baseline Service Mean
    service_means = y_train.groupby(X_train["default_duration"]).mean().to_dict()

    for name, model in models.items():
        if name == "Baseline_DefaultDuration":
            y_pred_test = X_test["default_duration"].values
        elif name == "Baseline_ServiceMean":
            # Gán giá trị trung bình theo default_duration tương ứng
            overall_mean = y_train.mean()
            y_pred_test = X_test["default_duration"].map(service_means).fillna(overall_mean).values
        else:
            # Huấn luyện mô hình ML
            model.fit(X_train, y_train)
            y_pred_test = model.predict(X_test)

        mae = mean_absolute_error(y_test, y_pred_test)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
        r2 = r2_score(y_test, y_pred_test)

        results.append({
            "model_name": name,
            "mae": round(float(mae), 3),
            "rmse": round(float(rmse), 3),
            "r2": round(float(r2), 4),
            "model_obj": model
        })

    # 5. In bảng so sánh kết quả
    print("\n" + "="*70)
    print(f"{'MÔ HÌNH':<26} | {'MAE (phút)':<12} | {'RMSE (phút)':<12} | {'R^2 Score':<10}")
    print("="*70)
    for r in results:
        print(f"{r['model_name']:<26} | {r['mae']:<12} | {r['rmse']:<12} | {r['r2']:<10}")
    print("="*70)

    # 6. Chọn mô hình tốt nhất (dựa trên MAE thấp nhất và R^2 cao nhất)
    ml_candidates = [r for r in results if r["model_obj"] is not None]
    best_result = min(ml_candidates, key=lambda x: x["mae"])
    print(f"\n-> Mo hinh vuot troi nhat: {best_result['model_name']} (MAE: {best_result['mae']} phut, R2: {best_result['r2']})")

    # 7. Đóng gói Artifact Joblib
    model_dir = BASE_DIR / "artifacts" / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "duration_model_v1.joblib"
    joblib.dump(best_result["model_obj"], model_path)
    print(f"-> Da xuat file model artifact: {model_path}")

    # 8. Đăng ký thông tin vào PostgreSQL (ai_model_versions)
    db = SessionLocal()
    try:
        # Hủy kích hoạt các phiên bản cũ của task duration_prediction
        db.execute(
            update(AIModelVersion)
            .where(AIModelVersion.task == "duration_prediction")
            .values(active=False)
        )
        
        # Thêm phiên bản mới v1.1.0
        new_version = AIModelVersion(
            task="duration_prediction",
            algorithm=best_result["model_name"],
            version="v1.1.0",
            feature_schema_json={
                "num_features": num_features,
                "cat_features": cat_features,
                "target": "actual_duration",
                "target_definition": "actual_end - actual_start (phút)",
                "hyperparameters": {
                    "random_state": 42,
                    "train_samples": len(X_train),
                    "val_samples": len(X_val),
                    "test_samples": len(X_test)
                }
            },
            metrics_json={
                "mae": best_result["mae"],
                "rmse": best_result["rmse"],
                "r2": best_result["r2"],
                "all_models_comparison": [
                    {"name": r["model_name"], "mae": r["mae"], "rmse": r["rmse"], "r2": r["r2"]}
                    for r in results
                ]
            },
            artifact_path=str(model_path.relative_to(BASE_DIR)).replace("\\", "/"),
            trained_at=datetime.now(timezone.utc),
            active=True
        )
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
        print(f"-> Da dang ky thanh cong AI Model Version ID: {new_version.model_id} (Version: {new_version.version}) trong CSDL PostgreSQL.")

    finally:
        db.close()


if __name__ == "__main__":
    train_and_evaluate_models()
