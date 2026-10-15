"""
Module: evaluation.py
Mục đích:
- Thực hiện các thí nghiệm so sánh giải thuật lập lịch và nghiên cứu bóc tách (Ablation Study)
  theo đúng Mục 4 trong Hướng dẫn Đợt 2 của Thầy:
  1. So sánh 4 chiến lược lập lịch:
     - Strategy 1: First Feasible (Tham lam gán ứng viên khả thi đầu tiên)
     - Strategy 2: Nearest Feasible (Ưu tiên cự ly địa lý ngắn nhất)
     - Strategy 3: Weighted DSS (Sắp xếp theo hàm mục tiêu DSS đơn lẻ)
     - Strategy 4: OR-Tools CP-SAT (Tối ưu hóa toàn cục đa mục tiêu)
  2. Ablation Study bắt buộc:
     - Kịch bản A: Default Duration + OR-Tools (Lập lịch với thời lượng cố định thiếu AI)
     - Kịch bản B: AI Predicted Duration + OR-Tools (Lập lịch với thời lượng dự đoán chính xác của AI)
- Đo lường các chỉ số quản trị MIS:
  - Feasible Assignment Rate (%)
  - Average Travel Time (phút)
  - Total Travel Distance (km)
  - Workload Standard Deviation (Cân bằng tải giữa các điều dưỡng)
  - Average DSS Quality Score
  - Runtime (ms)
"""

import time
import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models import Employee, ServiceRequest, Service, TravelMatrix, Assignment, AIPrediction
from app.ai.scheduling import SchedulingEngine


class SchedulingExperimentRunner:
    """
    Bộ chạy thực nghiệm và đo lường định lượng các giải thuật lập lịch cho đồ án MIS.
    """

    @classmethod
    def evaluate_schedule_solution(
        cls,
        db: Session,
        assignments: List[Dict[str, Any]],
        total_requests: int,
        employees: List[Employee]
    ) -> Dict[str, Any]:
        """
        Đo lường các chỉ số hiệu năng của một phương án phân công.
        """
        assigned_count = len(assignments)
        feasible_rate = (assigned_count / total_requests * 100.0) if total_requests > 0 else 0.0

        if not assignments:
            return {
                "feasible_rate": 0.0,
                "assigned_count": 0,
                "unassigned_count": total_requests,
                "avg_travel_time": 0.0,
                "total_travel_distance": 0.0,
                "workload_std_dev": 0.0,
                "avg_dss_score": 0.0
            }

        # 1. Tính quãng đường và thời gian di chuyển
        total_travel_mins = sum(a.get("travel_mins", 10) for a in assignments)
        total_travel_km = sum(a.get("distance_km", 3.0) for a in assignments)
        avg_travel_mins = total_travel_mins / assigned_count

        # 2. Tính độ cân bằng tải giữa các nhân viên (Workload Standard Deviation)
        emp_workloads = {e.employee_id: 0 for e in employees}
        for a in assignments:
            emp_id = a["employee_id"]
            dur = a["duration_mins"]
            emp_workloads[emp_id] = emp_workloads.get(emp_id, 0) + dur

        workload_values = list(emp_workloads.values())
        workload_std = float(np.std(workload_values))

        # 3. Điểm DSS trung bình
        avg_dss = float(np.mean([a.get("dss_score", 0.70) for a in assignments]))

        return {
            "feasible_rate": round(feasible_rate, 2),
            "assigned_count": assigned_count,
            "unassigned_count": total_requests - assigned_count,
            "avg_travel_time": round(avg_travel_mins, 2),
            "total_travel_distance": round(total_travel_km, 2),
            "workload_std_dev": round(workload_std, 2),
            "avg_dss_score": round(avg_dss, 4)
        }

    @classmethod
    def run_first_feasible(
        cls,
        db: Session,
        requests: List[ServiceRequest],
        employees: List[Employee],
        use_ai_duration: bool = True
    ) -> List[Dict[str, Any]]:
        """Chiến lược 1: First Feasible (Tham lam gán nhân viên khả thi đầu tiên)"""
        assignments = []
        assigned_emp_times = {e.employee_id: [] for e in employees}

        for req in requests:
            dur = req.service.default_duration
            if use_ai_duration and req.ai_predictions:
                dur = req.ai_predictions[0].predicted_duration

            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            for emp in employees:
                # Kiểm tra ràng buộc cơ bản
                is_feasible, _ = SchedulingEngine.check_hard_constraints(
                    db=db, employee=emp, request=req, start_time=st, end_time=et
                )
                if is_feasible:
                    score, breakdown, _ = SchedulingEngine.calculate_dss_score(
                        db=db, employee=emp, request=req, start_time=st, end_time=et
                    )
                    assignments.append({
                        "request_id": req.request_id,
                        "employee_id": emp.employee_id,
                        "duration_mins": dur,
                        "distance_km": breakdown["distance_km"],
                        "travel_mins": int(breakdown["distance_km"] * 2.5) + 3,
                        "dss_score": score
                    })
                    break  # Gán xong chuyển ngay sang request tiếp theo

        return assignments

    @classmethod
    def run_nearest_feasible(
        cls,
        db: Session,
        requests: List[ServiceRequest],
        employees: List[Employee],
        use_ai_duration: bool = True
    ) -> List[Dict[str, Any]]:
        """Chiến lược 2: Nearest Feasible (Ưu tiên nhân viên gần vị trí bệnh nhân nhất)"""
        assignments = []

        for req in requests:
            dur = req.service.default_duration
            if use_ai_duration and req.ai_predictions:
                dur = req.ai_predictions[0].predicted_duration

            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            feasible_candidates = []
            for emp in employees:
                is_feasible, _ = SchedulingEngine.check_hard_constraints(
                    db=db, employee=emp, request=req, start_time=st, end_time=et
                )
                if is_feasible:
                    score, breakdown, _ = SchedulingEngine.calculate_dss_score(
                        db=db, employee=emp, request=req, start_time=st, end_time=et
                    )
                    feasible_candidates.append({
                        "employee_id": emp.employee_id,
                        "distance_km": breakdown["distance_km"],
                        "travel_mins": int(breakdown["distance_km"] * 2.5) + 3,
                        "dss_score": score
                    })

            if feasible_candidates:
                # Chọn ứng viên có khoảng cách nhỏ nhất
                nearest = min(feasible_candidates, key=lambda x: x["distance_km"])
                assignments.append({
                    "request_id": req.request_id,
                    "employee_id": nearest["employee_id"],
                    "duration_mins": dur,
                    "distance_km": nearest["distance_km"],
                    "travel_mins": nearest["travel_mins"],
                    "dss_score": nearest["dss_score"]
                })

        return assignments

    @classmethod
    def run_weighted_dss(
        cls,
        db: Session,
        requests: List[ServiceRequest],
        employees: List[Employee],
        use_ai_duration: bool = True
    ) -> List[Dict[str, Any]]:
        """Chiến lược 3: Weighted DSS (Ưu tiên ứng viên có điểm tổng hợp DSS cao nhất cho từng ca)"""
        assignments = []

        for req in requests:
            dur = req.service.default_duration
            if use_ai_duration and req.ai_predictions:
                dur = req.ai_predictions[0].predicted_duration

            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            feasible_candidates = []
            for emp in employees:
                is_feasible, _ = SchedulingEngine.check_hard_constraints(
                    db=db, employee=emp, request=req, start_time=st, end_time=et
                )
                if is_feasible:
                    score, breakdown, _ = SchedulingEngine.calculate_dss_score(
                        db=db, employee=emp, request=req, start_time=st, end_time=et
                    )
                    feasible_candidates.append({
                        "employee_id": emp.employee_id,
                        "distance_km": breakdown["distance_km"],
                        "travel_mins": int(breakdown["distance_km"] * 2.5) + 3,
                        "dss_score": score
                    })

            if feasible_candidates:
                # Chọn ứng viên có điểm DSS cao nhất
                best = max(feasible_candidates, key=lambda x: x["dss_score"])
                assignments.append({
                    "request_id": req.request_id,
                    "employee_id": best["employee_id"],
                    "duration_mins": dur,
                    "distance_km": best["distance_km"],
                    "travel_mins": best["travel_mins"],
                    "dss_score": best["dss_score"]
                })

        return assignments
