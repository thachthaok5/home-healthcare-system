"""
Script: run_stress_test.py
Mục đích:
- Thực thi toàn bộ thí nghiệm Stress Test (10, 25, 50, 100, 150 requests x 5 random seeds)
- Đánh giá kiểm chứng lịch trình bằng Actual Duration (Default vs AI Duration)
- Phân tích độ nhạy 6 kịch bản trọng số DSS
- Xuất đầy đủ các file CSV kết quả mean ± std phục vụ Báo cáo Luận văn tốt nghiệp MIS.
"""

import sys
import os
import json
import time
import math
import random
from pathlib import Path
from datetime import datetime, timedelta, timezone, time as dt_time
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
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
from ortools.sat.python import cp_model

from app.db.session import SessionLocal
from app.models import Employee, Service, ServiceRequiredSkill
from app.ai.routing import RoutingEngine
from app.ai.duration_prediction import DurationPredictor

vn_tz = timezone(timedelta(hours=7))

# 10 phường tại Nha Trang
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


class BenchmarkEmployeeSkill:
    def __init__(self, skill_id, level):
        self.skill_id = skill_id
        self.level = level


class BenchmarkEmployee:
    def __init__(self, employee_id, full_name, employee_type, base_lat, base_lon, skills, max_mins=480, status="active"):
        self.employee_id = employee_id
        self.full_name = full_name
        self.employee_type = employee_type
        self.base_lat = base_lat
        self.base_lon = base_lon
        self.max_daily_minutes = max_mins
        self.status = status
        self.employee_skills = [BenchmarkEmployeeSkill(s_id, lvl) for s_id, lvl in skills]


class BenchmarkService:
    def __init__(self, service_id, service_name, default_duration, required_skill_ids):
        self.service_id = service_id
        self.service_name = service_name
        self.default_duration = default_duration
        self.required_skill_ids = required_skill_ids


def get_standard_fixtures():
    """
    Tạo fixture chuẩn hóa 10 nhân viên và 5 dịch vụ y tế tại Nha Trang,
    đồng bộ 100% với dữ liệu sinh bởi seed_database.py.
    Bảo đảm script có thể chạy độc lập trong môi trường Sandbox cô lập mạng.
    """
    nha_trang_coords = [
        (12.245800, 109.194200),  # Lộc Thọ
        (12.253600, 109.191200),  # Phước Tiến
        (12.261200, 109.189500),  # Vạn Thạnh
        (12.271500, 109.196300),  # Vĩnh Phước
        (12.238900, 109.185600),  # Phước Hải
        (12.229400, 109.192300),  # Tân Lập
        (12.249100, 109.181200),  # Phương Sài
        (12.280200, 109.198900),  # Vĩnh Hòa
        (12.220500, 109.180400),  # Vĩnh Trường
        (12.258000, 109.175000),  # Ngọc Hiệp
    ]
    # Skill mapping:
    # 1: WOUND_CARE, 2: SURGICAL_DRESSING, 3: IV_INJECTION, 4: PHYSIOTHERAPY,
    # 5: VENTILATOR_CARE, 6: ELDERLY_VITALS, 7: DIABETES_CARE, 8: NEONATAL_CARE,
    # 9: ACUPUNCTURE, 10: NUTRITION_FEEDING
    employee_specs = [
        (1, "Nguyễn Văn Hùng", "nurse", [(1, 4), (2, 3), (3, 4)]),
        (2, "Trần Thị Mai", "nurse", [(1, 5), (2, 4), (6, 4)]),
        (3, "Lê Hoàng Nam", "physiotherapist", [(4, 5), (9, 4)]),
        (4, "Phạm Minh Tuấn", "physiotherapist", [(4, 4), (9, 3)]),
        (5, "Đỗ Thị Lan", "nurse", [(3, 5), (5, 3), (6, 4)]),
        (6, "Vũ Thanh Tùng", "caregiver", [(6, 4), (7, 3), (10, 4)]),
        (7, "Hoàng Thị Cúc", "nurse", [(8, 5), (1, 3), (3, 3)]),
        (8, "Bùi Đức Thắng", "nurse", [(2, 5), (5, 4), (3, 4)]),
        (9, "Ngô Thị Bích", "caregiver", [(6, 3), (7, 4), (1, 2)]),
        (10, "Dương Quang Huy", "physiotherapist", [(4, 4), (1, 3)]),
    ]
    emps = []
    for i, (eid, name, etype, sk_list) in enumerate(employee_specs):
        lat, lon = nha_trang_coords[i % len(nha_trang_coords)]
        emps.append(BenchmarkEmployee(eid, name, etype, lat, lon, sk_list))

    services = [
        BenchmarkService(1, "Chăm sóc vết thương và thay băng tại nhà", 45, [1]),
        BenchmarkService(2, "Thay băng cắt chỉ vết mổ sau phẫu thuật", 50, [2]),
        BenchmarkService(3, "Vật lý trị liệu phục hồi chức năng sau tai biến", 60, [4]),
        BenchmarkService(4, "Tiêm truyền và lấy mẫu xét nghiệm tận nơi", 40, [3]),
        BenchmarkService(5, "Chăm sóc toàn diện người cao tuổi / nằm liệt giường", 90, [6]),
    ]
    srv_skills = {s.service_id: s.required_skill_ids for s in services}
    return emps, services, srv_skills


def load_fixtures():
    import socket
    can_connect = False
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        s.connect(("localhost", 5432))
        s.close()
        can_connect = True
    except Exception:
        pass

    if can_connect:
        try:
            db = SessionLocal()
            emps = db.execute(select(Employee).where(Employee.status == "active")).scalars().all()
            if emps and len(emps) >= 10:
                services = db.execute(select(Service)).scalars().all()
                srv_skills = {}
                for s in services:
                    sk = db.execute(select(ServiceRequiredSkill.skill_id).where(ServiceRequiredSkill.service_id == s.service_id)).scalars().all()
                    srv_skills[s.service_id] = list(sk)
                return emps, services, srv_skills, db
        except Exception:
            pass

    emps, services, srv_skills = get_standard_fixtures()
    return emps, services, srv_skills, None


class BenchmarkReq:
    def __init__(self, req_id, cust_id, srv_id, srv_name, def_dur, pred_dur, act_dur, pref_st, comp, equip, prio, dist_code, lat, lon, skill_ids):
        self.request_id = req_id
        self.customer_id = cust_id
        self.service_id = srv_id
        self.service_name = srv_name
        self.default_duration = def_dur
        self.predicted_duration = pred_dur
        self.actual_duration = act_dur
        self.preferred_start = pref_st
        self.complexity_level = comp
        self.has_special_equip = equip
        self.priority = prio
        self.district_code = dist_code
        self.lat = lat
        self.lon = lon
        self.required_skill_ids = skill_ids


def generate_requests(num_reqs, seed, target_date, emps=None, services=None, srv_skills=None, db=None):
    rng = np.random.default_rng(seed)
    py_rnd = random.Random(seed)

    if services is None or srv_skills is None:
        if db is not None:
            services = db.execute(select(Service)).scalars().all()
            srv_skills = {}
            for s in services:
                sk = db.execute(select(ServiceRequiredSkill.skill_id).where(ServiceRequiredSkill.service_id == s.service_id)).scalars().all()
                srv_skills[s.service_id] = list(sk)
        else:
            _, services, srv_skills = get_standard_fixtures()

    emp_ids = [e.employee_id for e in emps] if emps else list(range(1, 11))

    # Sinh dữ liệu lịch sử Customer - Employee tương tác trước đây (Continuity of Care)
    pool_size = max(10, min(50, int(num_reqs * 0.6)))
    customer_emp_history = {}
    for c_id in range(1, pool_size + 1):
        # 60% khách hàng là bệnh nhân quen, có nhân viên từng chăm sóc 1-3 lần trước đây
        if py_rnd.random() < 0.60:
            fav_emp_id = py_rnd.choice(emp_ids)
            past_visits = py_rnd.choice([1, 2, 3])
            customer_emp_history[(c_id, fav_emp_id)] = past_visits

    vn_tz = timezone(timedelta(hours=7))
    requests = []

    hours = [8, 9, 10, 11, 13, 14, 15, 16]
    prob = [0.18, 0.22, 0.15, 0.05, 0.10, 0.15, 0.10, 0.05]

    for i in range(1, num_reqs + 1):
        srv = py_rnd.choice(services)
        dist = py_rnd.choice(NHA_TRANG_DISTRICTS)

        lat = dist["lat"] + float(rng.uniform(-0.005, 0.005))
        lon = dist["lon"] + float(rng.uniform(-0.005, 0.005))
        comp = int(rng.choice([1, 2, 3, 4, 5], p=[0.45, 0.30, 0.15, 0.07, 0.03]))
        equip = bool(rng.random() < 0.25)
        prio = int(rng.choice([1, 2, 3], p=[0.60, 0.30, 0.10]))
        h = int(rng.choice(hours, p=prob))
        m = int(rng.choice([0, 15, 30, 45]))
        st = datetime(target_date.year, target_date.month, target_date.day, h, m, tzinfo=vn_tz)

        base_dur = srv.default_duration

        # Ground truth actual duration
        exp = base_dur + base_dur * (comp - 1) * 0.12
        if equip:
            exp += 12.0
        if prio == 3:
            exp += 5.0
        elif prio == 2:
            exp += 2.0
        if h in [8, 9, 14, 15]:
            exp += 3.0
        noise = float(rng.normal(0, 4.5))
        act_dur = max(15, min(240, int(round(exp + noise))))

        # AI Prediction
        try:
            pred_dur, _, _ = DurationPredictor.predict(
                db=db, service=srv, complexity_level=comp, has_special_equip=equip,
                priority=prio, district_code=dist["code"], preferred_start=st
            )
        except Exception:
            pred_dur = int(round(exp))

        cust_id = (i % pool_size) + 1
        requests.append(BenchmarkReq(
            i, cust_id, srv.service_id, srv.service_name, base_dur, pred_dur, act_dur,
            st, comp, equip, prio, dist["code"], lat, lon, srv_skills.get(srv.service_id, [])
        ))

    return requests, customer_emp_history


def generate_seed_workforce_availability(employees, seed, target_date):
    """
    Sinh cấu hình ca làm việc (Shifts) và Đơn nghỉ phép (Leave Requests) ngẫu nhiên có kiểm soát theo từng seed.
    Mô phỏng đầy đủ Hard Constraint H3:
    - Ca 1 (Sáng): 07:00 - 15:30
    - Ca 2 (Hành chính): 08:00 - 17:00
    - Ca 3 (Chiều): 09:30 - 18:00
    - Ca 4 (Linh hoạt): 07:00 - 18:00
    - ~10% nhân viên có đơn nghỉ phép đã duyệt trong ngày (Leave Request).
    """
    py_rnd = random.Random(seed)
    vn_tz = timezone(timedelta(hours=7))

    shifts_pool = [
        {"start_time": dt_time(7, 0), "end_time": dt_time(15, 30), "name": "Morning Shift (07:00 - 15:30)"},
        {"start_time": dt_time(8, 0), "end_time": dt_time(17, 0), "name": "Day Shift (08:00 - 17:00)"},
        {"start_time": dt_time(9, 30), "end_time": dt_time(18, 0), "name": "Late Shift (09:30 - 18:00)"},
        {"start_time": dt_time(7, 0), "end_time": dt_time(18, 0), "name": "Full Shift (07:00 - 18:00)"},
    ]
    shift_weights = [0.25, 0.35, 0.20, 0.20]

    emp_shifts = {}
    emp_leaves = {}

    for e in employees:
        chosen_shift = py_rnd.choices(shifts_pool, weights=shift_weights, k=1)[0]
        emp_shifts[e.employee_id] = chosen_shift
        emp_leaves[e.employee_id] = []

    # Chọn ngẫu nhiên 1 nhân viên (10% đội ngũ) có đơn nghỉ phép được duyệt
    leave_emp_id = py_rnd.choice([e.employee_id for e in employees])
    leave_options = [
        (datetime(target_date.year, target_date.month, target_date.day, 7, 0, tzinfo=vn_tz),
         datetime(target_date.year, target_date.month, target_date.day, 11, 30, tzinfo=vn_tz),
         "Nghỉ phép cá nhân buổi sáng"),
        (datetime(target_date.year, target_date.month, target_date.day, 13, 30, tzinfo=vn_tz),
         datetime(target_date.year, target_date.month, target_date.day, 17, 30, tzinfo=vn_tz),
         "Khám sức khỏe định kỳ"),
    ]
    lv_st, lv_et, lv_reason = py_rnd.choice(leave_options)
    emp_leaves[leave_emp_id].append({
        "from_time": lv_st,
        "to_time": lv_et,
        "reason": lv_reason
    })

    return emp_shifts, emp_leaves


def is_feasible(emp, emp_skills, req, st, et, existing_slots, emp_shifts=None, emp_leaves=None):
    if emp.status != "active":
        return False
    for sk_id in req.required_skill_ids:
        if sk_id not in emp_skills:
            return False

    # H3: Khung ca làm việc (Shift Availability)
    if emp_shifts and emp.employee_id in emp_shifts:
        sh = emp_shifts[emp.employee_id]
        if st.time() < sh["start_time"] or et.time() > sh["end_time"]:
            return False
    else:
        if st.hour < 7 or et.hour > 18 or (et.hour == 18 and et.minute > 0):
            return False

    # H3: Đơn nghỉ phép đã duyệt (Leave Request)
    if emp_leaves and emp.employee_id in emp_leaves:
        for lv in emp_leaves[emp.employee_id]:
            if lv["from_time"] < et and st < lv["to_time"]:
                return False

    new_dur = int((et - st).total_seconds() / 60.0)
    current_wl = sum(s["duration_mins"] for s in existing_slots)
    max_mins = emp.max_daily_minutes or 480
    if current_wl + new_dur > max_mins:
        return False

    for s in existing_slots:
        s_st, s_et = s["scheduled_start"], s["scheduled_end"]
        if (st < s_et) and (s_st < et):
            return False
        if abs((st - s_st).total_seconds()) > 2700:
            continue
        dist_km, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(s["lat"], s["lon"], req.lat, req.lon)
        if s_et <= st and (st - s_et).total_seconds() / 60.0 < travel_mins:
            return False
        elif et <= s_st and (s_st - et).total_seconds() / 60.0 < travel_mins:
            return False

    return True


def calc_dss(emp, emp_skills, req, st, current_wl, weights=None, customer_history=None):
    w = weights or {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10}
    bonus = sum(max(0, emp_skills.get(sk_id, 1) - 1) for sk_id in req.required_skill_ids)
    skill_fit = min(1.0, 0.70 + bonus * 0.10)
    diff = abs((st - req.preferred_start).total_seconds() / 60.0)
    time_fit = max(0.0, 1.0 - (diff / 120.0))
    dist_km, travel_mins, _ = RoutingEngine.get_distance_and_travel_time(float(emp.base_lat), float(emp.base_lon), req.lat, req.lon)
    dist_score = max(0.0, 1.0 - (dist_km / 15.0))
    max_m = emp.max_daily_minutes or 480
    wl_score = max(0.0, 1.0 - (current_wl / max_m))
    
    # Continuity động từ lịch sử chăm sóc thực tế Customer - Employee
    past_visits = 0
    if customer_history:
        past_visits = customer_history.get((req.customer_id, emp.employee_id), 0)
    cont_score = min(1.0, past_visits / 2.0) if past_visits > 0 else 0.0

    total = (
        w.get("skill", 0.30) * skill_fit +
        w.get("time", 0.25) * time_fit +
        w.get("distance", 0.20) * dist_score +
        w.get("workload", 0.15) * wl_score +
        w.get("continuity", 0.10) * cont_score
    )
    breakdown = {
        "skill_fit": round(skill_fit, 3),
        "time_fit": round(time_fit, 3),
        "dist_score": round(dist_score, 3),
        "wl_score": round(wl_score, 3),
        "cont_score": round(cont_score, 3),
        "past_visits": past_visits
    }
    return round(total, 4), dist_km, travel_mins, breakdown


def run_nearest(reqs, emps, use_ai=True, emp_shifts=None, emp_leaves=None, customer_history=None):
    t0 = time.time()
    emp_skills = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in emps}
    emp_slots = {e.employee_id: [] for e in emps}
    assigns = []

    for r in reqs:
        dur = r.predicted_duration if use_ai else r.default_duration
        st, et = r.preferred_start, r.preferred_start + timedelta(minutes=dur)
        candidates = []
        for e in emps:
            if is_feasible(e, emp_skills[e.employee_id], r, st, et, emp_slots[e.employee_id], emp_shifts=emp_shifts, emp_leaves=emp_leaves):
                wl = sum(s["duration_mins"] for s in emp_slots[e.employee_id])
                score, d_km, t_min, bd = calc_dss(e, emp_skills[e.employee_id], r, st, wl, customer_history=customer_history)
                candidates.append((e, d_km, t_min, score, bd))
        if candidates:
            best_e, d_km, t_min, score, bd = min(candidates, key=lambda x: x[1])
            slot = {
                "request_id": r.request_id, "customer_id": r.customer_id, "employee_id": best_e.employee_id,
                "scheduled_start": st, "scheduled_end": et, "duration_mins": dur,
                "actual_duration": r.actual_duration, "lat": r.lat, "lon": r.lon,
                "distance_km": d_km, "travel_mins": t_min, "dss_score": score, "breakdown": bd
            }
            emp_slots[best_e.employee_id].append(slot)
            assigns.append(slot)

    return assigns, (time.time() - t0) * 1000.0


def run_weighted(reqs, emps, use_ai=True, weights=None, emp_shifts=None, emp_leaves=None, customer_history=None):
    t0 = time.time()
    emp_skills = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in emps}
    emp_slots = {e.employee_id: [] for e in emps}
    assigns = []

    for r in reqs:
        dur = r.predicted_duration if use_ai else r.default_duration
        st, et = r.preferred_start, r.preferred_start + timedelta(minutes=dur)
        candidates = []
        for e in emps:
            if is_feasible(e, emp_skills[e.employee_id], r, st, et, emp_slots[e.employee_id], emp_shifts=emp_shifts, emp_leaves=emp_leaves):
                wl = sum(s["duration_mins"] for s in emp_slots[e.employee_id])
                score, d_km, t_min, bd = calc_dss(e, emp_skills[e.employee_id], r, st, wl, weights, customer_history=customer_history)
                candidates.append((e, d_km, t_min, score, bd))
        if candidates:
            best_e, d_km, t_min, score, bd = max(candidates, key=lambda x: x[3])
            slot = {
                "request_id": r.request_id, "customer_id": r.customer_id, "employee_id": best_e.employee_id,
                "scheduled_start": st, "scheduled_end": et, "duration_mins": dur,
                "actual_duration": r.actual_duration, "lat": r.lat, "lon": r.lon,
                "distance_km": d_km, "travel_mins": t_min, "dss_score": score, "breakdown": bd
            }
            emp_slots[best_e.employee_id].append(slot)
            assigns.append(slot)

    return assigns, (time.time() - t0) * 1000.0


def run_ortools_opt(reqs, emps, use_ai=True, weights=None, time_limit=6.0, emp_shifts=None, emp_leaves=None, customer_history=None):
    t0 = time.time()
    emp_skills = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in emps}

    model = cp_model.CpModel()
    x = {}
    pair_map = {}

    for r in reqs:
        dur = r.predicted_duration if use_ai else r.default_duration
        st, et = r.preferred_start, r.preferred_start + timedelta(minutes=dur)
        for e in emps:
            if is_feasible(e, emp_skills[e.employee_id], r, st, et, [], emp_shifts=emp_shifts, emp_leaves=emp_leaves):
                score, d_km, t_min, bd = calc_dss(e, emp_skills[e.employee_id], r, st, 0, weights, customer_history=customer_history)
                var = model.new_bool_var(f"x_{r.request_id}_{e.employee_id}")
                x[(r.request_id, e.employee_id)] = var
                pair_map[(r.request_id, e.employee_id)] = {
                    "request": r, "employee": e, "st": st, "et": et,
                    "dur": dur, "act_dur": r.actual_duration, "d_km": d_km,
                    "t_min": t_min, "score": score, "breakdown": bd
                }

    for r in reqs:
        vars_r = [x[(r.request_id, e.employee_id)] for e in emps if (r.request_id, e.employee_id) in x]
        if vars_r:
            model.add(sum(vars_r) <= 1)

    for e in emps:
        p_list = [pair_map[k] for k in pair_map if k[1] == e.employee_id]
        n_p = len(p_list)
        for i in range(n_p):
            for j in range(i + 1, n_p):
                p1, p2 = p_list[i], p_list[j]
                st1, et1 = p1["st"], p1["et"]
                st2, et2 = p2["st"], p2["et"]

                # Neu khoang cach thoi gian vuot qua 45 phut, trong noi thanh Nha Trang (ban kinh < 10km) chac chan khong conflict
                if abs((st1 - st2).total_seconds()) > 2700:
                    continue

                conflict = False
                if (st1 < et2) and (st2 < et1):
                    conflict = True
                else:
                    _, t_mins, _ = RoutingEngine.get_distance_and_travel_time(p1["request"].lat, p1["request"].lon, p2["request"].lat, p2["request"].lon)
                    if et1 <= st2 and (st2 - et1).total_seconds() / 60.0 < t_mins:
                        conflict = True
                    elif et2 <= st1 and (st1 - et2).total_seconds() / 60.0 < t_mins:
                        conflict = True

                if conflict:
                    model.add(x[(p1["request"].request_id, e.employee_id)] + x[(p2["request"].request_id, e.employee_id)] <= 1)

        max_mins = e.max_daily_minutes or 480
        w_terms = [x[(p["request"].request_id, e.employee_id)] * p["dur"] for p in p_list]
        if w_terms:
            model.add(sum(w_terms) <= max_mins)

    obj_terms = [x[k] * int(pair_map[k]["score"] * 1000) for k in x]
    model.maximize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    status = solver.solve(model)

    assigns = []
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for k, var in x.items():
            if solver.boolean_value(var):
                p = pair_map[k]
                assigns.append({
                    "request_id": p["request"].request_id, "customer_id": p["request"].customer_id,
                    "employee_id": p["employee"].employee_id,
                    "scheduled_start": p["st"], "scheduled_end": p["et"], "duration_mins": p["dur"],
                    "actual_duration": p["act_dur"], "lat": p["request"].lat, "lon": p["request"].lon,
                    "distance_km": p["d_km"], "travel_mins": p["t_min"], "dss_score": p["score"],
                    "breakdown": p["breakdown"]
                })

    return assigns, (time.time() - t0) * 1000.0


def calc_metrics(assigns, total_reqs, emps):
    n = len(assigns)
    feas_rate = (n / total_reqs * 100.0) if total_reqs > 0 else 0.0
    if not assigns:
        return {
            "feasible_rate": 0.0, "assigned_count": 0, "unassigned_count": total_reqs,
            "total_travel_distance_km": 0.0, "mean_travel_time_min": 0.0, "overtime_minutes": 0,
            "workload_std_dev": 0.0, "avg_dss_score": 0.0, "continuity_match_rate": 0.0,
            "avg_skill_fit": 0.0, "avg_time_fit": 0.0, "avg_dist_score": 0.0,
            "avg_wl_score": 0.0, "avg_cont_score": 0.0
        }

    # Gom nhóm theo nhân viên và tính chuỗi hành trình thực tế: Base -> Ca 1 -> Ca 2 -> ... -> Base
    emp_slots = {e.employee_id: [] for e in emps}
    for a in assigns:
        emp_slots[a["employee_id"]].append(a)

    total_tour_dist = 0.0
    total_tour_time = 0
    total_legs = 0

    for e in emps:
        slots = emp_slots[e.employee_id]
        if slots:
            d_km, t_min, legs = RoutingEngine.calculate_daily_tour_metrics(
                base_lat=float(e.base_lat),
                base_lon=float(e.base_lon),
                assigned_slots=slots,
                include_return=True
            )
            total_tour_dist += d_km
            total_tour_time += t_min
            total_legs += legs

    mean_time = (total_tour_time / total_legs) if total_legs > 0 else 0.0

    emp_wl = {e.employee_id: sum(s["duration_mins"] for s in emp_slots[e.employee_id]) for e in emps}
    wl_std = float(np.std(list(emp_wl.values())))
    overtime = sum(max(0, emp_wl[e.employee_id] - (e.max_daily_minutes or 480)) for e in emps)
    avg_dss = float(np.mean([a["dss_score"] for a in assigns]))

    # Tính toán External Metrics và Sub-scores
    cont_matches = sum(1 for a in assigns if a.get("breakdown", {}).get("past_visits", 0) > 0)
    cont_match_rate = round((cont_matches / n * 100.0), 2) if n > 0 else 0.0

    avg_skill = round(float(np.mean([a.get("breakdown", {}).get("skill_fit", 0.7) for a in assigns])), 3) if n > 0 else 0.0
    avg_time = round(float(np.mean([a.get("breakdown", {}).get("time_fit", 1.0) for a in assigns])), 3) if n > 0 else 0.0
    avg_dist = round(float(np.mean([a.get("breakdown", {}).get("dist_score", 0.5) for a in assigns])), 3) if n > 0 else 0.0
    avg_wl = round(float(np.mean([a.get("breakdown", {}).get("wl_score", 0.5) for a in assigns])), 3) if n > 0 else 0.0
    avg_cont = round(float(np.mean([a.get("breakdown", {}).get("cont_score", 0.0) for a in assigns])), 3) if n > 0 else 0.0

    return {
        "feasible_rate": round(feas_rate, 2),
        "assigned_count": n,
        "unassigned_count": total_reqs - n,
        "total_travel_distance_km": round(total_tour_dist, 2),
        "mean_travel_time_min": round(mean_time, 2),
        "overtime_minutes": overtime,
        "workload_std_dev": round(wl_std, 2),
        "avg_dss_score": round(avg_dss, 4),
        "continuity_match_rate": cont_match_rate,
        "avg_skill_fit": avg_skill,
        "avg_time_fit": avg_time,
        "avg_dist_score": avg_dist,
        "avg_wl_score": avg_wl,
        "avg_cont_score": avg_cont
    }


def simulate_actual(assigns, emps, emp_shifts=None):
    """
    Mô phỏng diễn tiến thực tế (Ground-Truth Execution Simulation) của lịch trình:
    1. direct_overlap_count: Số ca bị chồng lấn thực tế trực tiếp (Physical Overlap),
       xảy ra khi ca trước chưa kết thúc mà ca sau đã đến giờ hẹn bắt đầu (current_time > sched_st).
    2. cascading_delay_count: Số ca bị bắt đầu trễ do hiệu ứng dây chuyền (earliest_arrival > sched_st).
    3. mild_delay_count: Số ca trễ nhẹ trong ngưỡng dung sai lâm sàng (0 < delay <= 15 phút - Grace Period).
    4. severe_delay_count: Số ca trễ nghiêm trọng (> 15 phút, vi phạm SLA).
    5. actual_feasible_rate: Tỷ lệ ca khả thi thực tế (không bị trễ > 15 phút).
    6. overtime_minutes: Tổng số phút làm thêm ngoài giờ làm việc chuẩn (Shift End) của nhân viên.
    """
    if not assigns:
        return {
            "direct_overlap_count": 0, "cascading_delay_count": 0, "late_start_count": 0,
            "mild_delay_count": 0, "severe_delay_count": 0,
            "total_delay_minutes": 0, "max_delay_minutes": 0, "overtime_minutes": 0,
            "actual_feasible_rate": 0.0
        }

    emp_a = {e.employee_id: [] for e in emps}
    for a in assigns:
        emp_a[a["employee_id"]].append(a)

    direct_overlaps = 0
    cascading_delays = 0
    mild_delays = 0
    severe_delays = 0
    tot_delay = 0
    max_delay = 0
    total_overtime = 0

    for e in emps:
        eid = e.employee_id
        a_list = emp_a.get(eid, [])
        if not a_list:
            continue

        a_list.sort(key=lambda x: x["scheduled_start"])
        curr_time = None
        prev_loc = None

        # Xác định mốc kết thúc ca làm việc chuẩn của nhân viên
        target_d = a_list[0]["scheduled_start"].date()
        if emp_shifts and eid in emp_shifts:
            sh_end_t = emp_shifts[eid]["end_time"]
        else:
            sh_end_t = dt_time(18, 0)
        shift_end_dt = datetime.combine(target_d, sh_end_t, tzinfo=vn_tz)

        for i, ca in enumerate(a_list):
            st, et = ca["scheduled_start"], ca["scheduled_end"]
            act_dur = ca["actual_duration"]
            loc = (ca["lat"], ca["lon"])

            if i == 0:
                act_st = st
                delay = 0
            else:
                _, t_mins, _ = RoutingEngine.get_distance_and_travel_time(prev_loc[0], prev_loc[1], loc[0], loc[1])
                earliest_arrival = curr_time + timedelta(minutes=t_mins)

                # Kiểm tra trực tiếp chồng lấn thực tế (Direct Physical Overlap)
                # Ca trước chưa xong mà giờ hẹn ca sau đã điểm
                if curr_time > st:
                    direct_overlaps += 1
                elif earliest_arrival > et:
                    direct_overlaps += 1

                if earliest_arrival > st:
                    delay = int((earliest_arrival - st).total_seconds() / 60.0)
                    act_st = earliest_arrival
                    cascading_delays += 1
                    tot_delay += delay
                    max_delay = max(max_delay, delay)

                    if delay <= 15:
                        mild_delays += 1
                    else:
                        severe_delays += 1
                else:
                    act_st = st
                    delay = 0

            curr_time = act_st + timedelta(minutes=act_dur)
            prev_loc = loc

        # Di chuyển từ ca cuối cùng về trạm y tế (base)
        _, return_mins, _ = RoutingEngine.get_distance_and_travel_time(prev_loc[0], prev_loc[1], float(e.base_lat), float(e.base_lon))
        day_finish_dt = curr_time + timedelta(minutes=return_mins)
        if day_finish_dt > shift_end_dt:
            emp_overtime = int((day_finish_dt - shift_end_dt).total_seconds() / 60.0)
            total_overtime += emp_overtime

    tot_ca = len(assigns)
    feas = round(((tot_ca - severe_delays) / tot_ca * 100.0), 2) if tot_ca > 0 else 0.0
    return {
        "direct_overlap_count": direct_overlaps,
        "cascading_delay_count": cascading_delays,
        "late_start_count": cascading_delays,
        "mild_delay_count": mild_delays,
        "severe_delay_count": severe_delays,
        "total_delay_minutes": tot_delay,
        "max_delay_minutes": max_delay,
        "overtime_minutes": total_overtime,
        "actual_feasible_rate": feas
    }


def main():
    RoutingEngine.disable_network()
    print("-> Routing Engine: Deterministic Mode (OSRM Cache + Haversine Fallback, Zero Network Delay)")
    emps, services, srv_skills, db = load_fixtures()
    print(f"-> Active Medical Staff for Benchmark: {len(emps)} (Source: {'PostgreSQL' if db else 'Standard Fixture'})")
    try:
        exp_dir = BASE_DIR / "artifacts" / "experiments"
        exp_dir.mkdir(parents=True, exist_ok=True)

        target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
        seeds = [42, 101, 202, 303, 404]
        loads = [10, 25, 50, 100, 150]

        # -------------------------------------------------------------
        # 1. STRESS TEST BENCHMARK
        # -------------------------------------------------------------
        print("\n" + "="*80)
        print("1. STRESS TEST BENCHMARK (10, 25, 50, 100, 150 requests x 5 seeds = 25 runs)")
        print("   Algorithms: Nearest Feasible, Weighted DSS, Google OR-Tools CP-SAT")
        print("="*80)

        stress_recs = []
        for load in loads:
            print(f"--> Load {load} req/day...")
            for seed in seeds:
                reqs, cust_history = generate_requests(load, seed, target_date, emps=emps, services=services, srv_skills=srv_skills, db=db)
                emp_shifts, emp_leaves = generate_seed_workforce_availability(emps, seed, target_date)

                # Nearest
                a_nf, t_nf = run_nearest(reqs, emps, True, emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history)
                m = calc_metrics(a_nf, load, emps)
                m.update({"load": load, "seed": seed, "algorithm": "Nearest Feasible", "runtime_ms": round(t_nf, 2)})
                stress_recs.append(m)

                # Weighted DSS
                a_wd, t_wd = run_weighted(reqs, emps, True, emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history)
                m = calc_metrics(a_wd, load, emps)
                m.update({"load": load, "seed": seed, "algorithm": "Weighted DSS", "runtime_ms": round(t_wd, 2)})
                stress_recs.append(m)

                # OR-Tools
                a_ort, t_ort = run_ortools_opt(reqs, emps, True, time_limit=6.0, emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history)
                m = calc_metrics(a_ort, load, emps)
                m.update({"load": load, "seed": seed, "algorithm": "OR-Tools CP-SAT", "runtime_ms": round(t_ort, 2)})
                stress_recs.append(m)

        df_stress = pd.DataFrame(stress_recs)
        df_stress.to_csv(exp_dir / "stress_test_benchmark_results.csv", index=False, encoding="utf-8-sig")

        # Summary mean +- std
        cols = ["feasible_rate", "unassigned_count", "total_travel_distance_km", "mean_travel_time_min", "workload_std_dev", "avg_dss_score", "runtime_ms"]
        sum_rows = []
        for (load, algo), group in df_stress.groupby(["load", "algorithm"]):
            row = {"load": load, "algorithm": algo}
            for c in cols:
                row[c] = f"{group[c].mean():.2f} ± {group[c].std():.2f}"
            sum_rows.append(row)

        df_stress_sum = pd.DataFrame(sum_rows)
        df_stress_sum.to_csv(exp_dir / "stress_test_summary_mean_std.csv", index=False, encoding="utf-8-sig")
        print("\nSTRESS TEST SUMMARY TABLE (mean ± std):")
        print(df_stress_sum.to_markdown(index=False))

        # -------------------------------------------------------------
        # 2. ACTUAL DURATION EVALUATION
        # -------------------------------------------------------------
        print("\n" + "="*80)
        print("2. ACTUAL DURATION EVALUATION (Default vs AI Predicted Duration)")
        print("="*80)

        act_recs = []
        for load in [10, 25, 50, 100, 150]:
            print(f"--> Load {load} req/day...")
            for seed in seeds:
                reqs, cust_history = generate_requests(load, seed, target_date, emps=emps, services=services, srv_skills=srv_skills, db=db)
                emp_shifts, emp_leaves = generate_seed_workforce_availability(emps, seed, target_date)

                # Plan A: Default Duration
                a_def, _ = run_ortools_opt(reqs, emps, use_ai=False, time_limit=6.0, emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history)
                res_a = simulate_actual(a_def, emps, emp_shifts=emp_shifts)
                res_a.update({"load": load, "seed": seed, "plan": "A. Default Duration (Thiếu AI)"})
                act_recs.append(res_a)

                # Plan B: AI Predicted Duration
                a_ai, _ = run_ortools_opt(reqs, emps, use_ai=True, time_limit=6.0, emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history)
                res_b = simulate_actual(a_ai, emps, emp_shifts=emp_shifts)
                res_b.update({"load": load, "seed": seed, "plan": "B. AI Predicted Duration (Có AI)"})
                act_recs.append(res_b)

        df_act = pd.DataFrame(act_recs)
        df_act.to_csv(exp_dir / "actual_duration_evaluation_results.csv", index=False, encoding="utf-8-sig")

        act_cols = [
            "direct_overlap_count", "cascading_delay_count", "mild_delay_count", "severe_delay_count",
            "total_delay_minutes", "max_delay_minutes", "overtime_minutes", "actual_feasible_rate"
        ]
        sum_act = []
        for (load, plan), group in df_act.groupby(["load", "plan"]):
            row = {"load": load, "plan": plan}
            for c in act_cols:
                row[c] = f"{group[c].mean():.1f} ± {group[c].std():.1f}"
            sum_act.append(row)

        df_act_sum = pd.DataFrame(sum_act)
        df_act_sum.to_csv(exp_dir / "actual_duration_summary_mean_std.csv", index=False, encoding="utf-8-sig")
        print("\nACTUAL DURATION EVALUATION SUMMARY TABLE (mean ± std):")
        print(df_act_sum.to_markdown(index=False))

        # -------------------------------------------------------------
        # 3. SENSITIVITY ANALYSIS
        # -------------------------------------------------------------
        print("\n" + "="*80)
        print("3. DSS WEIGHT SENSITIVITY ANALYSIS (6 scenarios, N=50, 5 seeds)")
        print("="*80)

        scenarios = {
            "1. Co so (Baseline)": {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10},
            "2. Uu tien ky nang": {"skill": 0.35, "time": 0.20, "distance": 0.20, "workload": 0.15, "continuity": 0.10},
            "3. Uu tien thoi gian": {"skill": 0.25, "time": 0.30, "distance": 0.20, "workload": 0.15, "continuity": 0.10},
            "4. Uu tien khoang cach": {"skill": 0.25, "time": 0.20, "distance": 0.30, "workload": 0.15, "continuity": 0.10},
            "5. Uu tien can bang tai": {"skill": 0.25, "time": 0.20, "distance": 0.15, "workload": 0.30, "continuity": 0.10},
            "6. Uu tien lien tuc": {"skill": 0.25, "time": 0.20, "distance": 0.15, "workload": 0.10, "continuity": 0.30},
        }

        sens_recs = []
        for seed in seeds:
            reqs, cust_history = generate_requests(50, seed, target_date, emps=emps, services=services, srv_skills=srv_skills, db=db)
            emp_shifts, emp_leaves = generate_seed_workforce_availability(emps, seed, target_date)

            # Chạy kịch bản Baseline (Scenario 1) trước làm mốc so sánh
            base_weights = scenarios["1. Co so (Baseline)"]
            a_base, t_base = run_ortools_opt(
                reqs, emps, use_ai=True, weights=base_weights, time_limit=6.0,
                emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history
            )
            base_map = {a["request_id"]: a["employee_id"] for a in a_base}

            for s_name, w_dict in scenarios.items():
                if s_name == "1. Co so (Baseline)":
                    a_curr, t_curr = a_base, t_base
                    diff_count = 0
                else:
                    a_curr, t_curr = run_ortools_opt(
                        reqs, emps, use_ai=True, weights=w_dict, time_limit=6.0,
                        emp_shifts=emp_shifts, emp_leaves=emp_leaves, customer_history=cust_history
                    )
                    curr_map = {a["request_id"]: a["employee_id"] for a in a_curr}
                    diff_count = sum(1 for rid, eid in curr_map.items() if base_map.get(rid) != eid)

                m = calc_metrics(a_curr, 50, emps)
                m.update({
                    "scenario": s_name,
                    "seed": seed,
                    "assignment_change_count": diff_count,
                    "runtime_ms": round(t_curr, 2)
                })
                sens_recs.append(m)

        df_sens = pd.DataFrame(sens_recs)
        df_sens.to_csv(exp_dir / "dss_sensitivity_analysis_results.csv", index=False, encoding="utf-8-sig")

        sum_sens = []
        sens_cols = [
            "feasible_rate", "total_travel_distance_km", "workload_std_dev",
            "continuity_match_rate", "assignment_change_count",
            "avg_skill_fit", "avg_time_fit", "avg_dist_score", "avg_wl_score", "avg_cont_score"
        ]
        for s_name in scenarios.keys():
            group = df_sens[df_sens["scenario"] == s_name]
            row = {"scenario": s_name}
            for c in sens_cols:
                row[c] = f"{group[c].mean():.2f} ± {group[c].std():.2f}"
            sum_sens.append(row)

        df_sens_sum = pd.DataFrame(sum_sens)
        df_sens_sum.to_csv(exp_dir / "dss_sensitivity_summary.csv", index=False, encoding="utf-8-sig")
        print("\nDSS SENSITIVITY SUMMARY TABLE (mean ± std):")
        print(df_sens_sum.to_markdown(index=False))

        # -------------------------------------------------------------
        # 4. ROUTING AUDIT & COVERAGE SUMMARY
        # -------------------------------------------------------------
        routing_stats = RoutingEngine.get_routing_stats()
        print("\n" + "="*80)
        print("4. OSRM ROUTING ENGINE AUDIT REPORT")
        print("="*80)
        print(f"-> Total Distance/Duration Queries : {routing_stats['total_queries']}")
        print(f"-> OSRM Cache Hits                 : {routing_stats['counts']['osrm_cache']} ({routing_stats['ratios_pct']['osrm_cache_pct']}%)")
        print(f"-> OSRM Network Queries            : {routing_stats['counts']['osrm_network']} ({routing_stats['ratios_pct']['osrm_network_pct']}%)")
        print(f"-> Same Location (< 30m)           : {routing_stats['counts']['same_location']} ({routing_stats['ratios_pct']['same_location_pct']}%)")
        print(f"-> Haversine Fallbacks             : {routing_stats['counts']['haversine_fallback']} ({routing_stats['ratios_pct']['haversine_fallback_pct']}%)")
        print(f"-> Overall OSRM Coverage           : {routing_stats['osrm_coverage_pct']}%")

        with open(exp_dir / "routing_audit_summary.json", "w", encoding="utf-8") as f:
            json.dump(routing_stats, f, ensure_ascii=False, indent=2)

        print(f"\n---> ALL EXPERIMENTS FINISHED! Files saved to: {exp_dir}")

    finally:
        if db:
            db.close()


if __name__ == "__main__":
    main()
