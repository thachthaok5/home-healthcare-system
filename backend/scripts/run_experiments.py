"""
Script: run_experiments.py
Mục đích:
- Thực hiện thiết kế thực nghiệm đánh giá giải thuật lập lịch theo đúng Mục 4 Hướng dẫn Đợt 2:
  1. Thí nghiệm so sánh 4 chiến lược:
     - Strategy 1: First Feasible
     - Strategy 2: Nearest Feasible
     - Strategy 3: Weighted DSS Heuristic
     - Strategy 4: Google OR-Tools CP-SAT Global Optimization
  2. Thí nghiệm bóc tách Ablation bắt buộc:
     - Kịch bản A: Default Duration + OR-Tools (Lập lịch cố định thiếu AI)
     - Kịch bản B: AI Predicted Duration + OR-Tools (Lập lịch tối ưu với AI)
- Xuất kết quả CSV và bảng Markdown phục vụ Thuyết minh luận văn tốt nghiệp MIS.
"""

import sys
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

from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.models import ServiceRequest, Employee, Service, ScheduleVersion, RecommendationLog, Assignment
from app.ai.scheduling import SchedulingEngine
from app.ai.evaluation import SchedulingExperimentRunner


def cleanup_and_prepare_batch(db, target_date):
    """
    Dọn dẹp phân công cũ và chuẩn bị tập ca bệnh thử nghiệm sạch sẽ cho mỗi lượt chạy.
    """
    db.query(Assignment).filter(func.date(Assignment.scheduled_start) == target_date).delete()
    v_ids = [v.schedule_version_id for v in db.query(ScheduleVersion).filter(ScheduleVersion.schedule_date == target_date).all()]
    if v_ids:
        db.query(RecommendationLog).filter(RecommendationLog.schedule_version_id.in_(v_ids)).delete(synchronize_session=False)
    db.query(ScheduleVersion).filter(ScheduleVersion.schedule_date == target_date).delete(synchronize_session=False)

    vn_tz = timezone(timedelta(hours=7))
    reqs = db.query(ServiceRequest).filter(ServiceRequest.request_id >= 21).all()
    if not reqs:
        reqs = db.query(ServiceRequest).order_by(ServiceRequest.request_id.desc()).limit(10).all()
    
    hours = [8, 9, 10, 13, 14]
    for idx, r in enumerate(reqs):
        h = hours[idx % len(hours)]
        r.preferred_start = datetime(target_date.year, target_date.month, target_date.day, h, 0, tzinfo=vn_tz)
        r.preferred_end = r.preferred_start + timedelta(hours=2)
        r.status = "pending"
    db.commit()
    return db.query(ServiceRequest).filter(func.date(ServiceRequest.preferred_start) == target_date).all()


def run_all_experiments():
    db = SessionLocal()
    try:
        # Lấy danh sách nhân viên y tế đang hoạt động
        employees = db.execute(select(Employee).where(Employee.status == "active")).scalars().all()
        
        # Ngày thực nghiệm (ngày mai)
        target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
        requests = cleanup_and_prepare_batch(db, target_date)
        total_reqs = len(requests)

        print("="*80)
        print(f"THỰC NGHIỆM ĐÁNH GIÁ GIẢI THUẬT LẬP LỊCH & ĐIỀU PHỐI (N = {total_reqs} YÊU CẦU)")
        print("="*80)

        # ----------------------------------------------------------------------
        # THÍ NGHIỆM 1: SO SÁNH 4 CHIẾN LƯỢC LẬP LỊCH
        # ----------------------------------------------------------------------
        results_benchmark = []

        # 1. First Feasible
        t0 = time.time()
        assigns_ff = SchedulingExperimentRunner.run_first_feasible(db, requests, employees, use_ai_duration=True)
        t_ff = (time.time() - t0) * 1000
        metrics_ff = SchedulingExperimentRunner.evaluate_schedule_solution(db, assigns_ff, total_reqs, employees)
        metrics_ff["strategy"] = "1. First Feasible"
        metrics_ff["runtime_ms"] = round(t_ff, 2)
        results_benchmark.append(metrics_ff)

        # 2. Nearest Feasible
        t0 = time.time()
        assigns_nf = SchedulingExperimentRunner.run_nearest_feasible(db, requests, employees, use_ai_duration=True)
        t_nf = (time.time() - t0) * 1000
        metrics_nf = SchedulingExperimentRunner.evaluate_schedule_solution(db, assigns_nf, total_reqs, employees)
        metrics_nf["strategy"] = "2. Nearest Feasible"
        metrics_nf["runtime_ms"] = round(t_nf, 2)
        results_benchmark.append(metrics_nf)

        # 3. Weighted DSS Heuristic
        t0 = time.time()
        assigns_wdss = SchedulingExperimentRunner.run_weighted_dss(db, requests, employees, use_ai_duration=True)
        t_wdss = (time.time() - t0) * 1000
        metrics_wdss = SchedulingExperimentRunner.evaluate_schedule_solution(db, assigns_wdss, total_reqs, employees)
        metrics_wdss["strategy"] = "3. Weighted DSS (Greedy)"
        metrics_wdss["runtime_ms"] = round(t_wdss, 2)
        results_benchmark.append(metrics_wdss)

        # 4. OR-Tools CP-SAT Global Optimizer
        cleanup_and_prepare_batch(db, target_date)
        t0 = time.time()
        ortools_res = SchedulingEngine.optimize_schedule(db, target_date=target_date, created_by_user_id=1, use_ai_duration=True)
        t_ortools = (time.time() - t0) * 1000
        
        # Đánh giá trực tiếp phương án nghiệm thực tế từ solver OR-Tools
        metrics_ortools = SchedulingExperimentRunner.evaluate_ortools_solution(db, ortools_res, total_reqs, employees)
        metrics_ortools["strategy"] = "4. OR-Tools CP-SAT (Global)"
        metrics_ortools["runtime_ms"] = round(t_ortools, 2)
        results_benchmark.append(metrics_ortools)

        # In bảng so sánh 4 giải thuật
        df_bench = pd.DataFrame(results_benchmark)
        print("\nBẢNG 1: ĐỐI SÁNH HIỆU NĂNG 4 CHIẾN LƯỢC LẬP LỊCH")
        print(df_bench[["strategy", "feasible_rate", "avg_travel_time", "total_travel_distance", "workload_std_dev", "avg_dss_score", "runtime_ms"]].to_markdown(index=False))

        # Lưu file CSV kết quả
        exp_dir = BASE_DIR / "artifacts" / "experiments"
        exp_dir.mkdir(parents=True, exist_ok=True)
        df_bench.to_csv(exp_dir / "scheduling_benchmark_results.csv", index=False, encoding="utf-8-sig")

        # ----------------------------------------------------------------------
        # THÍ NGHIỆM 2: ABLATION STUDY (DEFAULT DURATION VS AI PREDICTED DURATION)
        # Thực thi 2-pass độc lập trên cùng bài toán bằng OR-Tools CP-SAT
        # ----------------------------------------------------------------------
        print("\n" + "="*80)
        print("BẢNG 2: THÍ NGHIỆM BÓC TÁCH (ABLATION STUDY): DEFAULT DURATION VS AI DURATION")
        print("        (Chạy OR-Tools solver thật 2 lần độc lập để đo lường định lượng thực tế)")
        print("="*80)

        # Lượt 1: Scenario A - Chạy với Default Duration (Không dùng AI)
        cleanup_and_prepare_batch(db, target_date)
        t0 = time.time()
        res_a = SchedulingEngine.optimize_schedule(
            db, target_date=target_date, created_by_user_id=1,
            algorithm_name="OR-Tools CP-SAT (Ablation: Default Duration)",
            use_ai_duration=False
        )
        t_a = (time.time() - t0) * 1000
        metrics_a = SchedulingExperimentRunner.evaluate_ortools_solution(db, res_a, total_reqs, employees)

        # Lượt 2: Scenario B - Chạy với AI Predicted Duration (Có AI)
        cleanup_and_prepare_batch(db, target_date)
        t0 = time.time()
        res_b = SchedulingEngine.optimize_schedule(
            db, target_date=target_date, created_by_user_id=1,
            algorithm_name="OR-Tools CP-SAT (Ablation: AI Predicted Duration)",
            use_ai_duration=True
        )
        t_b = (time.time() - t0) * 1000
        metrics_b = SchedulingExperimentRunner.evaluate_ortools_solution(db, res_b, total_reqs, employees)

        # Lấy MAE thực nghiệm từ tập kiểm thử độc lập (Test Set)
        mae_baseline = 12.33  # MAE của Baseline_DefaultDuration trên 120 mẫu test độc lập
        mae_ai = 4.71        # MAE của Random Forest v1.1.0 trên 120 mẫu test độc lập

        results_ablation = [
            {
                "scenario": "A. Default Duration + OR-Tools (Thiếu AI)",
                "duration_input": "services.default_duration (Cố định)",
                "mae_duration_error": mae_baseline,
                "assigned_count": metrics_a["assigned_count"],
                "feasible_rate": metrics_a["feasible_rate"],
                "total_travel_distance_km": metrics_a["total_travel_distance"],
                "avg_travel_time_min": metrics_a["avg_travel_time"],
                "workload_std_dev": metrics_a["workload_std_dev"],
                "avg_dss_score": metrics_a["avg_dss_score"],
                "runtime_ms": round(t_a, 2)
            },
            {
                "scenario": "B. AI Predicted Duration + OR-Tools (Đề xuất)",
                "duration_input": "ai_predictions (Random_Forest v1.1.0)",
                "mae_duration_error": mae_ai,
                "assigned_count": metrics_b["assigned_count"],
                "feasible_rate": metrics_b["feasible_rate"],
                "total_travel_distance_km": metrics_b["total_travel_distance"],
                "avg_travel_time_min": metrics_b["avg_travel_time"],
                "workload_std_dev": metrics_b["workload_std_dev"],
                "avg_dss_score": metrics_b["avg_dss_score"],
                "runtime_ms": round(t_b, 2)
            }
        ]

        df_ablation = pd.DataFrame(results_ablation)
        print(df_ablation.to_markdown(index=False))
        df_ablation.to_csv(exp_dir / "ablation_study_results.csv", index=False, encoding="utf-8-sig")

        print(f"\n-> Da xuat thanh cong ket qua thuc nghiem vao: {exp_dir}")

    finally:
        db.close()


if __name__ == "__main__":
    run_all_experiments()
