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

    # 2. Tiền xử lý Outliers theo IQR trên từng nhóm service_id (theo chuẩn Data Plan v2)
    initial_count = len(df)
    clean_dfs = []
    for s_id, group in df.groupby("service_id"):
        q25 = group["actual_duration"].quantile(0.25)
        q75 = group["actual_duration"].quantile(0.75)
        iqr = q75 - q25
        lower_bound = max(15.0, q25 - 1.5 * iqr)
        upper_bound = min(240.0, q75 + 1.5 * iqr)
        filtered = group[(group["actual_duration"] >= lower_bound) & (group["actual_duration"] <= upper_bound)]
        clean_dfs.append(filtered)
    df = pd.concat(clean_dfs, ignore_index=True)
    outliers_removed = initial_count - len(df)
    print(f"-> Loc Outlier theo IQR cho tung service_id: Da loai bo {outliers_removed} mau ngoai lai. Con lai {len(df)} mau.")

    # 3. Phân chia theo trục thời gian (CHRONOLOGICAL SPLIT 70% / 15% / 15%)
    if "scheduled_date" in df.columns:
        df["scheduled_date"] = pd.to_datetime(df["scheduled_date"])
        df = df.sort_values(by="scheduled_date").reset_index(drop=True)
    
    n_total = len(df)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)
    
    train_df = df.iloc[:n_train].copy()
    val_df = df.iloc[n_train:n_train + n_val].copy()
    test_df = df.iloc[n_train + n_val:].copy()
    
    print(f"-> CHRONOLOGICAL SPLIT (70% Train - 15% Val - 15% Test):")
    if "scheduled_date" in df.columns:
        print(f"   Train: {len(train_df)} mau ({train_df['scheduled_date'].min().strftime('%Y-%m-%d')} den {train_df['scheduled_date'].max().strftime('%Y-%m-%d')})")
        print(f"   Val:   {len(val_df)} mau ({val_df['scheduled_date'].min().strftime('%Y-%m-%d')} den {val_df['scheduled_date'].max().strftime('%Y-%m-%d')})")
        print(f"   Test:  {len(test_df)} mau ({test_df['scheduled_date'].min().strftime('%Y-%m-%d')} den {test_df['scheduled_date'].max().strftime('%Y-%m-%d')})")
    else:
        print(f"   Train: {len(train_df)} mau | Val: {len(val_df)} mau | Test: {len(test_df)} mau")

    # 4. Phân chia Features (X) và Target (y)
    num_features = [
        "default_duration",
        "base_price",
        "complexity_level",
        "has_special_equip",
        "priority",
        "preferred_start_hour",
        "day_of_week"
    ]
    cat_features = ["district_code", "service_code"]

    for d in [train_df, val_df, test_df]:
        d["service_code"] = "SRV_" + d["service_id"].astype(str)

    X_train = train_df[num_features + cat_features]
    y_train = train_df["actual_duration"]
    X_val = val_df[num_features + cat_features]
    y_val = val_df["actual_duration"]
    X_test = test_df[num_features + cat_features]
    y_test = test_df["actual_duration"]

    # 5. Xây dựng Preprocessor (chuẩn hóa dữ liệu)
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_features),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features)
        ]
    )

    # 6. Định nghĩa các mô hình thử nghiệm
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
            .values(is_active=False)
        )
        
        # Kiểm tra nếu phiên bản v1.1.0 đã tồn tại thì cập nhật (Upsert)
        existing_version = db.execute(
            select(AIModelVersion).where(AIModelVersion.version == "v1.1.0")
        ).scalars().first()

        feature_schema = {
            "num_features": num_features,
            "cat_features": cat_features,
            "target": "actual_duration",
            "target_definition": "actual_end - actual_start (phút)",
            "hyperparameters": {
                "random_state": 42,
                "train_samples": len(X_train),
                "val_samples": len(X_val),
                "test_samples": len(X_test),
                "split_strategy": "chronological_70_15_15"
            }
        }
        metrics = {
            "mae": best_result["mae"],
            "rmse": best_result["rmse"],
            "r2": best_result["r2"],
            "all_models_comparison": [
                {"name": r["model_name"], "mae": r["mae"], "rmse": r["rmse"], "r2": r["r2"]}
                for r in results
            ]
        }
        artifact_rel_path = str(model_path.relative_to(BASE_DIR)).replace("\\", "/")

        if existing_version:
            existing_version.algorithm = best_result["model_name"]
            existing_version.feature_schema_json = feature_schema
            existing_version.metrics_json = metrics
            existing_version.artifact_path = artifact_rel_path
            existing_version.trained_at = datetime.now(timezone.utc)
            existing_version.is_active = True
            new_version = existing_version
        else:
            new_version = AIModelVersion(
                task="duration_prediction",
                algorithm=best_result["model_name"],
                version="v1.1.0",
                feature_schema_json=feature_schema,
                metrics_json=metrics,
                artifact_path=artifact_rel_path,
                trained_at=datetime.now(timezone.utc),
                is_active=True
            )
            db.add(new_version)
        db.commit()
        db.refresh(new_version)
        print(f"-> Da dang ky thanh cong AI Model Version ID: {new_version.model_id} (Version: {new_version.version}) trong CSDL PostgreSQL.")

    finally:
        db.close()


if __name__ == "__main__":
    train_and_evaluate_models()
