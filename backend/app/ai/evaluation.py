"""
Module: evaluation.py
Mục đích:
- Thực hiện thiết kế thực nghiệm đánh giá giải thuật lập lịch và đo lường đóng góp định lượng của AI
  theo đúng hướng dẫn của GVHD TS. Trịnh Thị Ngọc Thúy:
  1. Mở rộng Benchmark & Stress Test:
     - 4 mức tải: Nhỏ (10), Trung bình (25), Lớn (50), Rất lớn (100) yêu cầu/ngày.
     - Đánh giá trên ít nhất 5 random seeds (báo cáo mean ± std).
     - Đối sánh 3 chiến lược: Nearest Feasible, Weighted DSS, và Google OR-Tools CP-SAT.
  2. Đánh giá kiểm chứng bằng Actual Duration (Ground-truth verification):
     - Lập lịch với Default Duration (Phương án A) vs AI Predicted Duration (Phương án B).
     - Mô phỏng thực thi với actual_duration: đo ca overlap thực tế, ca bắt đầu trễ, tổng số phút trễ, trễ tối đa, và tỷ lệ lịch trình còn khả thi.
  3. Phân tích độ nhạy trọng số DSS (Sensitivity Analysis):
     - Thử nghiệm 6 kịch bản trọng số khác nhau để kiểm tra tính vững (robustness).
  4. Thu thập toàn diện 8 chỉ số quản trị MIS.
"""

import time
import math
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.models import (
    Employee, ServiceRequest, Service, TravelMatrix, Assignment, AIPrediction,
    Customer, ServiceRequiredSkill, LeaveRequest, EmployeeAvailability
)
from app.ai.scheduling import SchedulingEngine
from app.ai.routing import RoutingEngine
from app.ai.duration_prediction import DurationPredictor


class BenchmarkRequest:
    """Đối tượng yêu cầu phục vụ dùng cho môi trường benchmark độc lập"""
    def __init__(
        self,
        request_id: int,
        customer_id: int,
        service_id: int,
        service_name: str,
        default_duration: int,
        predicted_duration: int,
        actual_duration: int,
        preferred_start: datetime,
        complexity_level: int,
        has_special_equip: bool,
        priority: int,
        district_code: str,
        lat: float,
        lon: float,
        required_skill_ids: List[int]
    ):
        self.request_id = request_id
        self.customer_id = customer_id
        self.service_id = service_id
        self.service_name = service_name
        self.default_duration = default_duration
        self.predicted_duration = predicted_duration
        self.actual_duration = actual_duration
        self.preferred_start = preferred_start
        self.complexity_level = complexity_level
        self.has_special_equip = has_special_equip
        self.priority = priority
        self.district_code = district_code
        self.lat = lat
        self.lon = lon
        self.required_skill_ids = required_skill_ids


class SchedulingExperimentRunner:
    """
    Bộ máy thực nghiệm khoa học, stress test và đánh giá định lượng cho bài toán điều phối y tế tại nhà.
    """

    # 10 tọa độ thực tế đại diện cho các phường tại thành phố Nha Trang
    NHA_TRANG_DISTRICTS = [
        {"code": "LOC_THO", "lat": 12.2388, "lon": 109.1967},
        {"code": "PHUOC_TIEN", "lat": 12.2450, "lon": 109.1890},
        {"code": "VAN_THANH", "lat": 12.2530, "lon": 109.1930},
        {"code": "VINH_PHUOC", "lat": 12.2680, "lon": 109.2010},
        {"code": "TAN_LAP", "lat": 12.2350, "lon": 109.1910},
        {"code": "PHUOC_HAI", "lat": 12.2280, "lon": 109.1780},
        {"code": "VINH_HAI", "lat": 12.2789, "lon": 109.1983},
        {"code": "XUONG_HUAN", "lat": 12.2560, "lon": 109.1970},
        {"code": "PHUONG_SAI", "lat": 12.2490, "lon": 109.1820},
        {"code": "VINH_NGUYEN", "lat": 12.2150, "lon": 109.2050},
    ]

    @classmethod
    def generate_benchmark_requests(
        cls,
        db: Session,
        num_requests: int,
        seed: int,
        target_date: date
    ) -> List[BenchmarkRequest]:
        """
        Sinh tập dữ liệu yêu cầu thực nghiệm chuẩn hóa mô phỏng đặc thù Nha Trang theo seed cố định.
        """
        rng = np.random.default_rng(seed)
        py_random = random.Random(seed)

        services = db.execute(select(Service)).scalars().all()
        if not services:
            raise ValueError("Không tìm thấy danh mục dịch vụ trong CSDL.")

        service_skills_map = {}
        for s in services:
            req_skills = db.execute(
                select(ServiceRequiredSkill.skill_id)
                .where(ServiceRequiredSkill.service_id == s.service_id)
            ).scalars().all()
            service_skills_map[s.service_id] = list(req_skills)

        vn_tz = timezone(timedelta(hours=7))
        requests = []

        hours_choices = [8, 9, 10, 11, 13, 14, 15, 16]
        hour_prob = [0.18, 0.22, 0.15, 0.05, 0.10, 0.15, 0.10, 0.05]

        for i in range(1, num_requests + 1):
            srv = py_random.choice(services)
            dist_info = py_random.choice(cls.NHA_TRANG_DISTRICTS)
            
            # Tọa độ với biến thiên nhỏ ±500m trong bán kính phường
            lat = dist_info["lat"] + float(rng.uniform(-0.005, 0.005))
            lon = dist_info["lon"] + float(rng.uniform(-0.005, 0.005))

            complexity = int(rng.choice([1, 2, 3, 4, 5], p=[0.45, 0.30, 0.15, 0.07, 0.03]))
            has_equip = bool(rng.random() < 0.25)
            priority = int(rng.choice([1, 2, 3], p=[0.60, 0.30, 0.10]))
            pref_hour = int(rng.choice(hours_choices, p=hour_prob))
            pref_minute = int(rng.choice([0, 15, 30, 45]))

            pref_start = datetime(
                target_date.year, target_date.month, target_date.day,
                pref_hour, pref_minute, tzinfo=vn_tz
            )

            # 1. Thời lượng mặc định định mức
            base_dur = srv.default_duration

            # 2. Thời lượng thực tế (Ground-truth formula có nhiễu Gaussian)
            expected = base_dur + base_dur * (complexity - 1) * 0.12
            if has_equip:
                expected += 12.0
            if priority == 3:
                expected += 5.0
            elif priority == 2:
                expected += 2.0
            if pref_hour in [8, 9, 14, 15]:
                expected += 3.0
            noise = float(rng.normal(0, 4.5))
            actual_dur = int(round(expected + noise))
            actual_dur = max(15, min(240, actual_dur))

            # 3. Thời lượng do AI Random Forest dự đoán
            pred_dur, _, _ = DurationPredictor.predict(
                db=db,
                service=srv,
                complexity_level=complexity,
                has_special_equip=has_equip,
                priority=priority,
                district_code=dist_info["code"],
                preferred_start_hour=pref_hour,
                day_of_week=pref_start.weekday()
            )

            requests.append(
                BenchmarkRequest(
                    request_id=i,
                    customer_id=1000 + i,
                    service_id=srv.service_id,
                    service_name=srv.service_name,
                    default_duration=base_dur,
                    predicted_duration=pred_dur,
                    actual_duration=actual_dur,
                    preferred_start=pref_start,
                    complexity_level=complexity,
                    has_special_equip=has_equip,
                    priority=priority,
                    district_code=dist_info["code"],
                    lat=lat,
                    lon=lon,
                    required_skill_ids=service_skills_map.get(srv.service_id, [])
                )
            )

        return requests

    @classmethod
    def check_request_employee_feasibility(
        cls,
        employee: Employee,
        emp_skills: Dict[int, int],
        req: BenchmarkRequest,
        st: datetime,
        et: datetime,
        emp_existing_slots: List[Dict[str, Any]]
    ) -> Tuple[bool, Optional[str]]:
        """
        Kiểm tra 6 ràng buộc cứng giữa yêu cầu và nhân viên bao gồm cả các ca đã xếp trong đợt chạy.
        """
        # H2: Trạng thái active
        if employee.status != "active":
            return False, "H2: Inactive"

        # H1: Kỹ năng bắt buộc
        for sk_id in req.required_skill_ids:
            if sk_id not in emp_skills:
                return False, f"H1: Missing skill {sk_id}"

        # H3: Khung giờ làm việc (07:00 - 18:00)
        if st.hour < 7 or et.hour > 18 or (et.hour == 18 and et.minute > 0):
            return False, "H3: Outside shift"

        # H4: Không trùng lặp lịch & H5: Tính khả thi di chuyển với các ca trong cùng ngày
        new_dur = int((et - st).total_seconds() / 60.0)
        current_workload = sum(s["duration_mins"] for s in emp_existing_slots)
        max_mins = employee.max_daily_minutes or 480

        # H6: Giới hạn tải làm việc trong ngày
        if current_workload + new_dur > max_mins:
            return False, "H6: Exceed daily workload"

        for s in emp_existing_slots:
            s_st = s["scheduled_start"]
            s_et = s["scheduled_end"]
            
            # H4: Trùng lịch
            if (st < s_et) and (s_st < et):
                return False, "H4: Overlap"

            # H5: Thời gian di chuyển
            dist_km, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(
                from_lat=s["lat"], from_lon=s["lon"],
                to_lat=req.lat, to_lon=req.lon
            )

            if s_et <= st:
                gap = (st - s_et).total_seconds() / 60.0
                if gap < travel_mins:
                    return False, f"H5: Travel buffer deficient ({gap:.0f}p < {travel_mins}p)"
            elif et <= s_st:
                gap = (s_st - et).total_seconds() / 60.0
                if gap < travel_mins:
                    return False, f"H5: Travel buffer deficient ({gap:.0f}p < {travel_mins}p)"

        return True, None

    @classmethod
    def calculate_dss_score_fast(
        cls,
        employee: Employee,
        emp_skills: Dict[int, int],
        req: BenchmarkRequest,
        st: datetime,
        current_workload_mins: int,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[float, float, int]:
        """
        Tính điểm DSS đa mục tiêu (Skill, Time, Distance, Workload, Continuity).
        """
        w = weights or {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10}

        # 1. SkillFit
        bonus = sum(max(0, emp_skills.get(sk_id, 1) - 1) for sk_id in req.required_skill_ids)
        skill_fit = min(1.0, 0.70 + bonus * 0.10)

        # 2. TimeFit
        diff_mins = abs((st - req.preferred_start).total_seconds() / 60.0)
        time_fit = max(0.0, 1.0 - (diff_mins / 120.0))

        # 3. Distance & Travel Time
        dist_km, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(
            from_lat=employee.base_lat,
            from_lon=employee.base_lon,
            to_lat=req.lat,
            to_lon=req.lon
        )
        distance_score = max(0.0, 1.0 - (dist_km / 15.0))

        # 4. Workload
        max_mins = employee.max_daily_minutes or 480
        workload_score = max(0.0, 1.0 - (current_workload_mins / max_mins))

        # 5. Continuity
        continuity_score = 0.50

        total_score = (
            w.get("skill", 0.30) * skill_fit +
            w.get("time", 0.25) * time_fit +
            w.get("distance", 0.20) * distance_score +
            w.get("workload", 0.15) * workload_score +
            w.get("continuity", 0.10) * continuity_score
        )

        return round(total_score, 4), dist_km, travel_mins

    @classmethod
    def run_nearest_feasible_benchmark(
        cls,
        requests: List[BenchmarkRequest],
        employees: List[Employee],
        use_ai_duration: bool = True
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Chiến lược 1: Nearest Feasible (Ưu tiên khoảng cách di chuyển ngắn nhất).
        """
        t0 = time.time()
        emp_skills_cache = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in employees}
        emp_assignments = {e.employee_id: [] for e in employees}
        assignments = []

        for req in requests:
            dur = req.predicted_duration if use_ai_duration else req.default_duration
            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            feasible_candidates = []
            for emp in employees:
                is_feasi, _ = cls.check_request_employee_feasibility(
                    emp, emp_skills_cache[emp.employee_id], req, st, et, emp_assignments[emp.employee_id]
                )
                if is_feasi:
                    current_wl = sum(s["duration_mins"] for s in emp_assignments[emp.employee_id])
                    score, dist_km, travel_mins = cls.calculate_dss_score_fast(
                        emp, emp_skills_cache[emp.employee_id], req, st, current_wl
                    )
                    feasible_candidates.append({
                        "employee": emp,
                        "distance_km": dist_km,
                        "travel_mins": travel_mins,
                        "dss_score": score
                    })

            if feasible_candidates:
                # Chọn ứng viên gần nhất
                best = min(feasible_candidates, key=lambda x: x["distance_km"])
                emp = best["employee"]
                slot = {
                    "request_id": req.request_id,
                    "employee_id": emp.employee_id,
                    "scheduled_start": st,
                    "scheduled_end": et,
                    "duration_mins": dur,
                    "actual_duration": req.actual_duration,
                    "lat": req.lat,
                    "lon": req.lon,
                    "distance_km": best["distance_km"],
                    "travel_mins": best["travel_mins"],
                    "dss_score": best["dss_score"]
                }
                emp_assignments[emp.employee_id].append(slot)
                assignments.append(slot)

        runtime_ms = (time.time() - t0) * 1000.0
        return assignments, runtime_ms

    @classmethod
    def run_weighted_dss_benchmark(
        cls,
        requests: List[BenchmarkRequest],
        employees: List[Employee],
        use_ai_duration: bool = True,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Chiến lược 2: Weighted DSS (Ưu tiên điểm số DSS đa tiêu chí cao nhất).
        """
        t0 = time.time()
        emp_skills_cache = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in employees}
        emp_assignments = {e.employee_id: [] for e in employees}
        assignments = []

        for req in requests:
            dur = req.predicted_duration if use_ai_duration else req.default_duration
            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            feasible_candidates = []
            for emp in employees:
                is_feasi, _ = cls.check_request_employee_feasibility(
                    emp, emp_skills_cache[emp.employee_id], req, st, et, emp_assignments[emp.employee_id]
                )
                if is_feasi:
                    current_wl = sum(s["duration_mins"] for s in emp_assignments[emp.employee_id])
                    score, dist_km, travel_mins = cls.calculate_dss_score_fast(
                        emp, emp_skills_cache[emp.employee_id], req, st, current_wl, weights=weights
                    )
                    feasible_candidates.append({
                        "employee": emp,
                        "distance_km": dist_km,
                        "travel_mins": travel_mins,
                        "dss_score": score
                    })

            if feasible_candidates:
                # Chọn ứng viên có điểm DSS cao nhất
                best = max(feasible_candidates, key=lambda x: x["dss_score"])
                emp = best["employee"]
                slot = {
                    "request_id": req.request_id,
                    "employee_id": emp.employee_id,
                    "scheduled_start": st,
                    "scheduled_end": et,
                    "duration_mins": dur,
                    "actual_duration": req.actual_duration,
                    "lat": req.lat,
                    "lon": req.lon,
                    "distance_km": best["distance_km"],
                    "travel_mins": best["travel_mins"],
                    "dss_score": best["dss_score"]
                }
                emp_assignments[emp.employee_id].append(slot)
                assignments.append(slot)

        runtime_ms = (time.time() - t0) * 1000.0
        return assignments, runtime_ms

    @classmethod
    def run_ortools_benchmark(
        cls,
        requests: List[BenchmarkRequest],
        employees: List[Employee],
        use_ai_duration: bool = True,
        weights: Optional[Dict[str, float]] = None,
        time_limit_seconds: float = 10.0
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Chiến lược 3: Google OR-Tools CP-SAT (Tối ưu hóa toàn cục Global Optimization).
        """
        t0 = time.time()
        emp_skills_cache = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in employees}

        model = cp_model.CpModel()
        x = {}
        pair_details = {}
        durations = {}

        # 1. Tìm các cặp khả thi ban đầu
        for req in requests:
            dur = req.predicted_duration if use_ai_duration else req.default_duration
            durations[req.request_id] = dur
            st = req.preferred_start
            et = st + timedelta(minutes=dur)

            for emp in employees:
                is_feasi, _ = cls.check_request_employee_feasibility(
                    emp, emp_skills_cache[emp.employee_id], req, st, et, []
                )
                if is_feasi:
                    score, dist_km, travel_mins = cls.calculate_dss_score_fast(
                        emp, emp_skills_cache[emp.employee_id], req, st, 0, weights=weights
                    )
                    var = model.new_bool_var(f"x_{req.request_id}_{emp.employee_id}")
                    x[(req.request_id, emp.employee_id)] = var
                    pair_details[(req.request_id, emp.employee_id)] = {
                        "request": req,
                        "employee": emp,
                        "scheduled_start": st,
                        "scheduled_end": et,
                        "duration_mins": dur,
                        "actual_duration": req.actual_duration,
                        "distance_km": dist_km,
                        "travel_mins": travel_mins,
                        "dss_score": score
                    }

        # 2. Ràng buộc: Mỗi yêu cầu chỉ được gán tối đa cho 1 nhân viên
        for req in requests:
            vars_for_req = [x[(req.request_id, emp.employee_id)] for emp in employees if (req.request_id, emp.employee_id) in x]
            if vars_for_req:
                model.add(sum(vars_for_req) <= 1)

        # 3. Ràng buộc: Trùng lặp & Không đủ thời gian di chuyển giữa các ca của cùng 1 nhân viên
        for emp in employees:
            pairs_for_emp = [pair_details[k] for k in pair_details if k[1] == emp.employee_id]
            n_p = len(pairs_for_emp)
            for i in range(n_p):
                for j in range(i + 1, n_p):
                    p1 = pairs_for_emp[i]
                    p2 = pairs_for_emp[j]
                    st1, et1 = p1["scheduled_start"], p1["scheduled_end"]
                    st2, et2 = p2["scheduled_start"], p2["scheduled_end"]

                    dist_km, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(
                        from_lat=p1["request"].lat, from_lon=p1["request"].lon,
                        to_lat=p2["request"].lat, to_lon=p2["request"].lon
                    )

                    conflict = False
                    if (st1 < et2) and (st2 < et1):
                        conflict = True
                    elif et1 <= st2 and (st2 - et1).total_seconds() / 60.0 < travel_mins:
                        conflict = True
                    elif et2 <= st1 and (st1 - et2).total_seconds() / 60.0 < travel_mins:
                        conflict = True

                    if conflict:
                        v1 = x[(p1["request"].request_id, emp.employee_id)]
                        v2 = x[(p2["request"].request_id, emp.employee_id)]
                        model.add(v1 + v2 <= 1)

            # Ràng buộc tải làm việc tối đa trong ngày
            max_mins = emp.max_daily_minutes or 480
            workload_terms = [
                x[(p["request"].request_id, emp.employee_id)] * p["duration_mins"]
                for p in pairs_for_emp
            ]
            if workload_terms:
                model.add(sum(workload_terms) <= max_mins)

        # 4. Hàm mục tiêu: Tối đa hóa tổng điểm DSS
        obj_terms = []
        for (r_id, e_id), var in x.items():
            int_score = int(pair_details[(r_id, e_id)]["dss_score"] * 1000)
            obj_terms.append(var * int_score)

        model.maximize(sum(obj_terms))

        # 5. Giải bài toán
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        status = solver.solve(model)

        assignments = []
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for (r_id, e_id), var in x.items():
                if solver.boolean_value(var):
                    p = pair_details[(r_id, e_id)]
                    assignments.append({
                        "request_id": r_id,
                        "employee_id": e_id,
                        "scheduled_start": p["scheduled_start"],
                        "scheduled_end": p["scheduled_end"],
                        "duration_mins": p["duration_mins"],
                        "actual_duration": p["actual_duration"],
                        "lat": p["request"].lat,
                        "lon": p["request"].lon,
                        "distance_km": p["distance_km"],
                        "travel_mins": p["travel_mins"],
                        "dss_score": p["dss_score"]
                    })

        runtime_ms = (time.time() - t0) * 1000.0
        return assignments, runtime_ms

    @classmethod
    def evaluate_solution_metrics(
        cls,
        assignments: List[Dict[str, Any]],
        total_requests: int,
        employees: List[Employee]
    ) -> Dict[str, Any]:
        """
        Tính toán 8 chỉ số quản trị MIS chuẩn hóa.
        """
        assigned_count = len(assignments)
        unassigned_count = total_requests - assigned_count
        feasible_rate = (assigned_count / total_requests * 100.0) if total_requests > 0 else 0.0

        if not assignments:
            return {
                "feasible_rate": 0.0,
                "assigned_count": 0,
                "unassigned_count": total_requests,
                "total_travel_distance_km": 0.0,
                "total_travel_time_min": 0.0,
                "mean_travel_time_min": 0.0,
                "overtime_minutes": 0,
                "workload_std_dev": 0.0,
                "avg_dss_score": 0.0
            }

        total_dist = sum(a["distance_km"] for a in assignments)
        total_travel_time = sum(a["travel_mins"] for a in assignments)
        mean_travel_time = total_travel_time / assigned_count

        # Workload per employee & Overtime
        emp_workloads = {e.employee_id: 0 for e in employees}
        for a in assignments:
            emp_workloads[a["employee_id"]] = emp_workloads.get(a["employee_id"], 0) + a["duration_mins"]

        workload_values = list(emp_workloads.values())
        workload_std = float(np.std(workload_values))

        overtime = 0
        for e in employees:
            max_mins = e.max_daily_minutes or 480
            wl = emp_workloads.get(e.employee_id, 0)
            if wl > max_mins:
                overtime += (wl - max_mins)

        avg_dss = float(np.mean([a["dss_score"] for a in assignments]))

        return {
            "feasible_rate": round(feasible_rate, 2),
            "assigned_count": assigned_count,
            "unassigned_count": unassigned_count,
            "total_travel_distance_km": round(total_dist, 2),
            "total_travel_time_min": round(total_travel_time, 2),
            "mean_travel_time_min": round(mean_travel_time, 2),
            "overtime_minutes": overtime,
            "workload_std_dev": round(workload_std, 2),
            "avg_dss_score": round(avg_dss, 4)
        }

    @classmethod
    def simulate_actual_duration_execution(
        cls,
        assignments: List[Dict[str, Any]],
        employees: List[Employee]
    ) -> Dict[str, Any]:
        """
        Mô phỏng thực thi lịch trình với thời lượng thực tế (Ground-truth Actual Duration).
        Đo lường:
        - actual_overlap_count: Số ca bị chồng lấn thực tế.
        - late_start_count: Số ca bắt đầu muộn hơn giờ hẹn.
        - total_delay_minutes: Tổng số phút bắt đầu trễ của các ca.
        - max_delay_minutes: Số phút trễ lớn nhất.
        - actual_feasible_rate: Tỷ lệ ca không bị trễ nghiêm trọng (trễ <= 15 phút).
        """
        if not assignments:
            return {
                "total_assigned": 0,
                "actual_overlap_count": 0,
                "late_start_count": 0,
                "total_delay_minutes": 0,
                "max_delay_minutes": 0,
                "actual_feasible_rate": 0.0
            }

        # Gom nhóm theo từng nhân viên và sắp xếp theo scheduled_start
        emp_assignments = {e.employee_id: [] for e in employees}
        for a in assignments:
            emp_assignments[a["employee_id"]].append(a)

        actual_overlaps = 0
        late_starts = 0
        total_delay = 0
        max_delay = 0
        severely_delayed_count = 0

        for emp_id, a_list in emp_assignments.items():
            if not a_list:
                continue

            a_list.sort(key=lambda x: x["scheduled_start"])

            current_time = None
            prev_loc = None

            for i, ca in enumerate(a_list):
                sched_st = ca["scheduled_start"]
                sched_et = ca["scheduled_end"]
                act_dur = ca["actual_duration"]
                curr_loc = (ca["lat"], ca["lon"])

                if i == 0:
                    # Ca đầu tiên: nhân viên bắt đầu đúng giờ hẹn
                    actual_st = sched_st
                    delay_mins = 0
                else:
                    # Tính thời gian di chuyển từ ca trước đến ca hiện tại
                    _, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(
                        from_lat=prev_loc[0], from_lon=prev_loc[1],
                        to_lat=curr_loc[0], to_lon=curr_loc[1]
                    )

                    earliest_arrival = current_time + timedelta(minutes=travel_mins)
                    if earliest_arrival > sched_st:
                        # Bắt đầu trễ
                        delay_mins = int((earliest_arrival - sched_st).total_seconds() / 60.0)
                        actual_st = earliest_arrival
                        late_starts += 1
                        total_delay += delay_mins
                        max_delay = max(max_delay, delay_mins)

                        # Kiểm tra chồng lấn: ca trước + di chuyển vượt quá giờ kết thúc dự kiến hoặc đè lên ca
                        if earliest_arrival > sched_et:
                            actual_overlaps += 1
                        elif current_time > sched_st:
                            actual_overlaps += 1

                        if delay_mins > 15:
                            severely_delayed_count += 1
                    else:
                        actual_st = sched_st
                        delay_mins = 0

                actual_et = actual_st + timedelta(minutes=act_dur)
                current_time = actual_et
                prev_loc = curr_loc

        total_ca = len(assignments)
        actual_feasible_rate = round(((total_ca - severely_delayed_count) / total_ca * 100.0), 2) if total_ca > 0 else 0.0

        return {
            "total_assigned": total_ca,
            "actual_overlap_count": actual_overlaps,
            "late_start_count": late_starts,
            "total_delay_minutes": total_delay,
            "max_delay_minutes": max_delay,
            "actual_feasible_rate": actual_feasible_rate
        }
