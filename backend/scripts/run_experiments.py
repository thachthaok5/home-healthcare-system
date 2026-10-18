"""
Script: run_experiments.py
Mục đích:
- Thực hiện đầy đủ 3 khối thực nghiệm mở rộng theo Kế hoạch Hoàn thiện Đồ án Đợt 2:
  1. Giai đoạn 3: Mở rộng Benchmark & Stress Test (4 mức tải: 10, 25, 50, 100 requests/ngày x 5 random seeds)
     - So sánh 3 giải thuật: Nearest Feasible, Weighted DSS, Google OR-Tools CP-SAT.
     - Báo cáo 8 chỉ số quản trị dạng mean ± std.
  2. Giai đoạn 4: Đánh giá kiểm chứng bằng Actual Duration
     - Đối sánh Kịch bản A (Default Duration) vs Kịch bản B (AI Predicted Duration).
     - Đo lường ca overlap thực tế, ca trễ giờ, tổng số phút trễ, trễ tối đa, và tỷ lệ khả thi thực tế.
  3. Giai đoạn 5: Phân tích độ nhạy trọng số DSS (Sensitivity Analysis)
     - 6 kịch bản trọng số (Cơ sở, Ưu tiên kỹ năng, Ưu tiên thời gian, Ưu tiên khoảng cách, Ưu tiên cân bằng tải, Ưu tiên liên tục).
- Xuất toàn bộ file CSV kết quả gốc phục vụ Luận văn tốt nghiệp và Dashboard.
"""

import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime, timedelta, timezone
import pandas as pd
import numpy as np

# Thiết lập đường dẫn import backend
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import Employee
from app.ai.evaluation import SchedulingExperimentRunner


def run_full_experimental_suite():
    db = SessionLocal()
    try:
        employees = db.execute(select(Employee).where(Employee.status == "active")).scalars().all()
        print(f"-> So luong nhan vien y te active trong CSDL: {len(employees)}")

        exp_dir = BASE_DIR / "artifacts" / "experiments"
        exp_dir.mkdir(parents=True, exist_ok=True)

        target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
        seeds = [42, 101, 202, 303, 404]
        load_levels = [10, 25, 50, 100]

        # ======================================================================
        # GIAI ĐOẠN 3: MỞ RỘNG BENCHMARK VÀ STRESS TEST
        # ======================================================================
        print("\n" + "="*80)
        print("GIAI ĐOẠN 3: MỞ RỘNG BENCHMARK & STRESS TEST (4 MỨC TẢI X 5 SEEDS = 20 TẬP THỰC NGHIỆM)")
        print("             So sánh 3 giải thuật: Nearest Feasible, Weighted DSS, Google OR-Tools CP-SAT")
        print("="*80)

        stress_records = []

        for load in load_levels:
            print(f"\n---> Chay muc tai: {load} requests/ngay:")
            for seed in seeds:
                reqs = SchedulingExperimentRunner.generate_benchmark_requests(
                    db=db, num_requests=load, seed=seed, target_date=target_date
                )

                # 1. Nearest Feasible
                assigns_nf, t_nf = SchedulingExperimentRunner.run_nearest_feasible_benchmark(
                    requests=reqs, employees=employees, use_ai_duration=True
                )
                m_nf = SchedulingExperimentRunner.evaluate_solution_metrics(assigns_nf, load, employees)
                m_nf["load"] = load
                m_nf["seed"] = seed
                m_nf["algorithm"] = "Nearest Feasible"
                m_nf["runtime_ms"] = round(t_nf, 2)
                stress_records.append(m_nf)

                # 2. Weighted DSS
                assigns_wdss, t_wdss = SchedulingExperimentRunner.run_weighted_dss_benchmark(
                    requests=reqs, employees=employees, use_ai_duration=True
                )
                m_wdss = SchedulingExperimentRunner.evaluate_solution_metrics(assigns_wdss, load, employees)
                m_wdss["load"] = load
                m_wdss["seed"] = seed
                m_wdss["algorithm"] = "Weighted DSS"
                m_wdss["runtime_ms"] = round(t_wdss, 2)
                stress_records.append(m_wdss)

                # 3. OR-Tools CP-SAT
                assigns_ort, t_ort = SchedulingExperimentRunner.run_ortools_benchmark(
                    requests=reqs, employees=employees, use_ai_duration=True, time_limit_seconds=10.0
                )
                m_ort = SchedulingExperimentRunner.evaluate_solution_metrics(assigns_ort, load, employees)
                m_ort["load"] = load
                m_ort["seed"] = seed
                m_ort["algorithm"] = "OR-Tools CP-SAT"
                m_ort["runtime_ms"] = round(t_ort, 2)
                stress_records.append(m_ort)

        df_stress = pd.DataFrame(stress_records)
        df_stress.to_csv(exp_dir / "stress_test_benchmark_results.csv", index=False, encoding="utf-8-sig")

        # Tổng hợp mean ± std theo mức tải và giải thuật
        summary_rows = []
        metrics_cols = [
            "feasible_rate", "unassigned_count", "total_travel_distance_km",
            "mean_travel_time_min", "workload_std_dev", "avg_dss_score", "runtime_ms"
        ]

        for (load, algo), group in df_stress.groupby(["load", "algorithm"]):
            row = {"load": load, "algorithm": algo}
            for col in metrics_cols:
                m = group[col].mean()
                s = group[col].std()
                row[f"{col}_mean"] = round(m, 2)
                row[f"{col}_std"] = round(s, 2)
                row[col] = f"{m:.2f} ± {s:.2f}"
            summary_rows.append(row)

        df_stress_summary = pd.DataFrame(summary_rows)
        df_stress_summary.to_csv(exp_dir / "stress_test_summary_mean_std.csv", index=False, encoding="utf-8-sig")
        
        print("\nBẢNG TỔNG HỢP STRESS TEST (MEAN ± STD QUA 5 RANDOM SEEDS):")
        cols_display = ["load", "algorithm", "feasible_rate", "unassigned_count", "total_travel_distance_km", "workload_std_dev", "runtime_ms"]
        print(df_stress_summary[cols_display].to_markdown(index=False))

        # ======================================================================
        # GIAI ĐOẠN 4: ĐÁNH GIÁ LỊCH BẰNG ACTUAL DURATION
        # ======================================================================
        print("\n" + "="*80)
        print("GIAI ĐOẠN 4: ĐÁNH GIÁ LỊCH TRÌNH BẰNG THỜI LƯỢNG THỰC TẾ (ACTUAL DURATION EVALUATION)")
        print("             So sánh Phương án A (Default Duration) vs Phương án B (AI Predicted Duration)")
        print("="*80)

        actual_eval_records = []

        for load in load_levels:
            for seed in seeds:
                reqs = SchedulingExperimentRunner.generate_benchmark_requests(
                    db=db, num_requests=load, seed=seed, target_date=target_date
                )

                # Phương án A: Lập lịch bằng Default Duration (Không có AI)
                assigns_default, _ = SchedulingExperimentRunner.run_ortools_benchmark(
                    requests=reqs, employees=employees, use_ai_duration=False, time_limit_seconds=8.0
                )
                res_a = SchedulingExperimentRunner.simulate_actual_duration_execution(assigns_default, employees)
                res_a["load"] = load
                res_a["seed"] = seed
                res_a["plan"] = "A. Default Duration (Thiếu AI)"
                actual_eval_records.append(res_a)

                # Phương án B: Lập lịch bằng AI Predicted Duration (Có AI)
                assigns_ai, _ = SchedulingExperimentRunner.run_ortools_benchmark(
                    requests=reqs, employees=employees, use_ai_duration=True, time_limit_seconds=8.0
                )
                res_b = SchedulingExperimentRunner.simulate_actual_duration_execution(assigns_ai, employees)
                res_b["load"] = load
                res_b["seed"] = seed
                res_b["plan"] = "B. AI Predicted Duration (Có AI)"
                actual_eval_records.append(res_b)

        df_actual = pd.DataFrame(actual_eval_records)
        df_actual.to_csv(exp_dir / "actual_duration_evaluation_results.csv", index=False, encoding="utf-8-sig")

        # Tổng hợp mean ± std
        actual_summary = []
        act_cols = ["actual_overlap_count", "late_start_count", "total_delay_minutes", "max_delay_minutes", "actual_feasible_rate"]

        for (load, plan), group in df_actual.groupby(["load", "plan"]):
            row = {"load": load, "plan": plan}
            for col in act_cols:
                m = group[col].mean()
                s = group[col].std()
                row[f"{col}_mean"] = round(m, 2)
                row[f"{col}_std"] = round(s, 2)
                row[col] = f"{m:.1f} ± {s:.1f}"
            actual_summary.append(row)

        df_actual_summary = pd.DataFrame(actual_summary)
        df_actual_summary.to_csv(exp_dir / "actual_duration_summary_mean_std.csv", index=False, encoding="utf-8-sig")

        print("\nBẢNG ĐÁNH GIÁ LỊCH BẰNG ACTUAL DURATION (MEAN ± STD QUA 5 RANDOM SEEDS):")
        print(df_actual_summary[["load", "plan", "actual_overlap_count", "late_start_count", "total_delay_minutes", "max_delay_minutes", "actual_feasible_rate"]].to_markdown(index=False))

        # ======================================================================
        # GIAI ĐOẠN 5: PHÂN TÍCH ĐỘ NHẠY TRỌNG SỐ DSS (SENSITIVITY ANALYSIS)
        # ======================================================================
        print("\n" + "="*80)
        print("GIAI ĐOẠN 5: PHÂN TÍCH ĐỘ NHẠY CỦA TRỌNG SỐ DSS (SENSITIVITY ANALYSIS - 6 KỊCH BẢN)")
        print("="*80)

        scenarios = {
            "1. Co so (Baseline)": {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10},
            "2. Uu tien ky nang": {"skill": 0.35, "time": 0.20, "distance": 0.20, "workload": 0.15, "continuity": 0.10},
            "3. Uu tien thoi gian": {"skill": 0.25, "time": 0.30, "distance": 0.20, "workload": 0.15, "continuity": 0.10},
            "4. Uu tien khoang cach": {"skill": 0.25, "time": 0.20, "distance": 0.30, "workload": 0.15, "continuity": 0.10},
            "5. Uu tien can bang tai": {"skill": 0.25, "time": 0.20, "distance": 0.15, "workload": 0.30, "continuity": 0.10},
            "6. Uu tien lien tuc": {"skill": 0.25, "time": 0.20, "distance": 0.15, "workload": 0.10, "continuity": 0.30},
        }

        sensitivity_records = []
        test_load = 50  # Mức tải đại diện 50 requests/ngày

        for sc_name, w_dict in scenarios.items():
            for seed in seeds:
                reqs = SchedulingExperimentRunner.generate_benchmark_requests(
                    db=db, num_requests=test_load, seed=seed, target_date=target_date
                )
                assigns_ort, t_ort = SchedulingExperimentRunner.run_ortools_benchmark(
                    requests=reqs, employees=employees, use_ai_duration=True, weights=w_dict, time_limit_seconds=8.0
                )
                m = SchedulingExperimentRunner.evaluate_solution_metrics(assigns_ort, test_load, employees)
                m["scenario"] = sc_name
                m["seed"] = seed
                m["runtime_ms"] = round(t_ort, 2)
                sensitivity_records.append(m)

        df_sens = pd.DataFrame(sensitivity_records)
        df_sens.to_csv(exp_dir / "dss_sensitivity_analysis_results.csv", index=False, encoding="utf-8-sig")

        sens_summary = []
        for sc_name, group in df_sens.groupby("scenario"):
            row = {"scenario": sc_name}
            for col in metrics_cols:
                m = group[col].mean()
                s = group[col].std()
                row[f"{col}_mean"] = round(m, 2)
                row[f"{col}_std"] = round(s, 2)
                row[col] = f"{m:.2f} ± {s:.2f}"
            sens_summary.append(row)

        df_sens_summary = pd.DataFrame(sens_summary)
        df_sens_summary.to_csv(exp_dir / "dss_sensitivity_summary.csv", index=False, encoding="utf-8-sig")

        print("\nBẢNG PHÂN TÍCH ĐỘ NHẠY TRỌNG SỐ DSS (N = 50 REQUESTS, 5 RANDOM SEEDS):")
        print(df_sens_summary[["scenario", "feasible_rate", "total_travel_distance_km", "workload_std_dev", "avg_dss_score"]].to_markdown(index=False))

        # Cập nhật các bảng benchmark cũ (đồng bộ tương thích ngược)
        # Bảng so sánh 3 thuật toán ở mức 25 req (mức vận hành tiêu chuẩn)
        df_bench_25 = df_stress_summary[df_stress_summary["load"] == 25][["algorithm", "feasible_rate", "total_travel_distance_km", "workload_std_dev", "avg_dss_score", "runtime_ms"]]
        df_bench_25.to_csv(exp_dir / "scheduling_benchmark_results.csv", index=False, encoding="utf-8-sig")

        print(f"\n-> HOÀN TẤT TOÀN BỘ THỰC NGHIỆM! Đã xuất các file kết quả vào: {exp_dir}")

    finally:
        db.close()


if __name__ == "__main__":
    run_full_experimental_suite()
