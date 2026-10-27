"""
Script: run_ai_robustness_test.py
Mục đích:
- Thực hiện bài kiểm tra độ bền vững (Robustness Test) cho mô hình dự đoán thời lượng AI
  theo đúng góp ý của GVHD TS. Trịnh Thị Ngọc Thúy (Feedback 7).
- Đánh giá khả năng thích ứng của mô hình Random Forest đã huấn luyện (duration_model_v1.joblib)
  trên các phân phối dữ liệu bị biến dạng (Distribution Shifts & Perturbations):
  1. R0: Phân phối gốc (Baseline: sigma=4.5p)
  2. R1: Nhiễu ngẫu nhiên cao (High Noise: sigma=9.0p)
  3. R2: Biến chứng đột xuất (Heavy-tail Medical Complications: 12% ca kéo dài thêm 20-45p)
  4. R3: Thay đổi cấu trúc lâm sàng (Structural Shift: hệ số độ phức tạp 18%, thiết bị +18p)
  5. R4: Thử thách kết hợp (Combined Stress: High Noise + Biến chứng)
- Xuất file kết quả: backend/artifacts/experiments/ai_robustness_test_results.csv
"""

import sys
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def run_robustness_evaluation():
    model_path = BASE_DIR / "artifacts" / "models" / "duration_model_v1.joblib"
    data_path = BASE_DIR / "artifacts" / "data" / "duration_dataset.csv"
    out_dir = BASE_DIR / "artifacts" / "experiments"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not model_path.exists() or not data_path.exists():
        print("❌ LỖI: Không tìm thấy file model artifact hoặc file dataset!")
        return False

    model = joblib.load(model_path)
    df = pd.read_csv(data_path)
    print(f"-> Đã nạp Model Pipeline và {len(df)} mẫu dữ liệu gốc.")

    # Lấy tập kiểm thử 15% theo trục thời gian (Test set chuẩn của quy trình huấn luyện)
    if "scheduled_date" in df.columns:
        df["scheduled_date"] = pd.to_datetime(df["scheduled_date"])
        df = df.sort_values(by="scheduled_date").reset_index(drop=True)
    
    n_test = int(len(df) * 0.15)
    test_df = df.iloc[-n_test:].copy().reset_index(drop=True)
    print(f"-> Tập Test Set độc lập: {len(test_df)} mẫu.")

    # Định nghĩa 5 kịch bản phân phối kiểm thử
    scenarios = [
        {
            "id": "R0",
            "name": "R0. Baseline Distribution",
            "description": "Phân phối gốc ban đầu (noise sigma = 4.5p, hệ số chuẩn)",
            "noise_sigma": 4.5,
            "comp_factor": 0.12,
            "equip_bonus": 12.0,
            "complication_prob": 0.0,
            "complication_range": (0, 0)
        },
        {
            "id": "R1",
            "name": "R1. High Noise Perturbation",
            "description": "Nhiễu ngẫu nhiên gấp đôi (sigma = 9.0p: kẹt xe, chậm thủ tục)",
            "noise_sigma": 9.0,
            "comp_factor": 0.12,
            "equip_bonus": 12.0,
            "complication_prob": 0.0,
            "complication_range": (0, 0)
        },
        {
            "id": "R2",
            "name": "R2. Heavy-tail Complications",
            "description": "Biến chứng đột xuất (12% ca kéo dài thêm 20-45 phút bất ngờ)",
            "noise_sigma": 4.5,
            "comp_factor": 0.12,
            "equip_bonus": 12.0,
            "complication_prob": 0.12,
            "complication_range": (20, 45)
        },
        {
            "id": "R3",
            "name": "R3. Structural Shift (Older Cohort)",
            "description": "Bệnh nền nặng hơn (độ phức tạp 18%, thiết bị đặc biệt +18p)",
            "noise_sigma": 4.5,
            "comp_factor": 0.18,
            "equip_bonus": 18.0,
            "complication_prob": 0.0,
            "complication_range": (0, 0)
        },
        {
            "id": "R4",
            "name": "R4. Combined Extreme Stress",
            "description": "Thử thách kết hợp (sigma = 8.0p + 10% ca biến chứng đột xuất)",
            "noise_sigma": 8.0,
            "comp_factor": 0.15,
            "equip_bonus": 15.0,
            "complication_prob": 0.10,
            "complication_range": (15, 40)
        }
    ]

    results = []
    seeds = [42, 101, 202, 303, 404]

    for sc in scenarios:
        mae_def_list = []
        rmse_def_list = []
        mae_ai_list = []
        rmse_ai_list = []
        r2_ai_list = []
        impr_list = []

        for seed in seeds:
            rng = np.random.default_rng(seed)
            perturbed_df = test_df.copy()

            # Sinh lại actual_duration theo kịch bản phân phối mới
            new_actual = []
            for _, row in perturbed_df.iterrows():
                base_d = row["default_duration"]
                comp = row["complexity_level"]
                has_eq = row["has_special_equip"]
                prio = row["priority"]
                h = row["preferred_start_hour"]

                exp = base_d + base_d * (comp - 1) * sc["comp_factor"]
                if has_eq:
                    exp += sc["equip_bonus"]
                if prio == 3:
                    exp += 5.0
                elif prio == 2:
                    exp += 2.0
                if h in [8, 9, 14, 15]:
                    exp += 3.0

                # Thêm biến chứng đột xuất nếu có
                comp_extra = 0.0
                if sc["complication_prob"] > 0 and rng.random() < sc["complication_prob"]:
                    comp_extra = float(rng.uniform(sc["complication_range"][0], sc["complication_range"][1]))

                noise = float(rng.normal(0, sc["noise_sigma"]))
                act = max(15, min(240, int(round(exp + comp_extra + noise))))
                new_actual.append(act)

            perturbed_df["actual_duration"] = new_actual
            perturbed_df["service_code"] = "SRV_" + perturbed_df["service_id"].astype(str)

            # Features và Targets
            feature_cols = [
                "default_duration", "base_price", "complexity_level",
                "has_special_equip", "priority", "preferred_start_hour",
                "day_of_week", "district_code", "service_code"
            ]
            X_eval = perturbed_df[feature_cols]
            y_eval = perturbed_df["actual_duration"].values
            y_default = perturbed_df["default_duration"].values

            # Dự đoán bằng AI Model đã huấn luyện
            y_pred_ai = model.predict(X_eval)

            # Đánh giá Default Duration
            mae_def = mean_absolute_error(y_eval, y_default)
            rmse_def = np.sqrt(mean_squared_error(y_eval, y_default))

            # Đánh giá AI Model
            mae_ai = mean_absolute_error(y_eval, y_pred_ai)
            rmse_ai = np.sqrt(mean_squared_error(y_eval, y_pred_ai))
            r2_ai = r2_score(y_eval, y_pred_ai)

            impr_pct = ((mae_def - mae_ai) / mae_def) * 100.0 if mae_def > 0 else 0.0

            mae_def_list.append(mae_def)
            rmse_def_list.append(rmse_def)
            mae_ai_list.append(mae_ai)
            rmse_ai_list.append(rmse_ai)
            r2_ai_list.append(r2_ai)
            impr_list.append(impr_pct)

        results.append({
            "scenario_id": sc["id"],
            "scenario_name": sc["name"],
            "description": sc["description"],
            "mae_default": f"{np.mean(mae_def_list):.2f} ± {np.std(mae_def_list):.2f}",
            "rmse_default": f"{np.mean(rmse_def_list):.2f} ± {np.std(rmse_def_list):.2f}",
            "mae_ai": f"{np.mean(mae_ai_list):.2f} ± {np.std(mae_ai_list):.2f}",
            "rmse_ai": f"{np.mean(rmse_ai_list):.2f} ± {np.std(rmse_ai_list):.2f}",
            "r2_ai": f"{np.mean(r2_ai_list):.3f} ± {np.std(r2_ai_list):.3f}",
            "mae_reduction_pct": f"{np.mean(impr_list):.1f}% ± {np.std(impr_list):.1f}%"
        })

    res_df = pd.DataFrame(results)
    out_csv = out_dir / "ai_robustness_test_results.csv"
    try:
        res_df.to_csv(out_csv, index=False, encoding="utf-8-sig")
        print(f"\n✅ Đã lưu kết quả bài kiểm tra độ bền vững vào: {out_csv}")
    except PermissionError:
        pass

    print("\n" + "="*85)
    print(" BẢNG KẾT QUẢ KIỂM TRA ĐỘ BỀN VỮNG MÔ HÌNH AI (ROBUSTNESS TEST ACROSS 5 PERTURBATIONS) ")
    print("="*85)
    print(res_df[["scenario_name", "mae_default", "mae_ai", "r2_ai", "mae_reduction_pct"]].to_markdown(index=False))
    print("\n--- CSV OUTPUT BEGIN ---")
    print(res_df.to_csv(index=False))
    print("--- CSV OUTPUT END ---")
    return True


if __name__ == "__main__":
    run_robustness_evaluation()
