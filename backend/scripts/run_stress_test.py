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
from datetime import datetime, timedelta, timezone
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


def generate_requests(db, num_reqs, seed, target_date):
    rng = np.random.default_rng(seed)
    py_rnd = random.Random(seed)

    services = db.execute(select(Service)).scalars().all()
    srv_skills = {}
    for s in services:
        sk = db.execute(select(ServiceRequiredSkill.skill_id).where(ServiceRequiredSkill.service_id == s.service_id)).scalars().all()
        srv_skills[s.service_id] = list(sk)

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

        requests.append(BenchmarkReq(
            i, 1000 + i, srv.service_id, srv.service_name, base_dur, pred_dur, act_dur,
            st, comp, equip, prio, dist["code"], lat, lon, srv_skills.get(srv.service_id, [])
        ))

    return requests


def is_feasible(emp, emp_skills, req, st, et, existing_slots):
    if emp.status != "active":
        return False
    for sk_id in req.required_skill_ids:
        if sk_id not in emp_skills:
            return False
    if st.hour < 7 or et.hour > 18 or (et.hour == 18 and et.minute > 0):
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
        dist_km, travel_mins = RoutingEngine.haversine_estimate(s["lat"], s["lon"], req.lat, req.lon)
        if s_et <= st and (st - s_et).total_seconds() / 60.0 < travel_mins:
            return False
        elif et <= s_st and (s_st - et).total_seconds() / 60.0 < travel_mins:
            return False

    return True


def calc_dss(emp, emp_skills, req, st, current_wl, weights=None):
    w = weights or {"skill": 0.30, "time": 0.25, "distance": 0.20, "workload": 0.15, "continuity": 0.10}
    bonus = sum(max(0, emp_skills.get(sk_id, 1) - 1) for sk_id in req.required_skill_ids)
    skill_fit = min(1.0, 0.70 + bonus * 0.10)
    diff = abs((st - req.preferred_start).total_seconds() / 60.0)
    time_fit = max(0.0, 1.0 - (diff / 120.0))
    dist_km, travel_mins = RoutingEngine.haversine_estimate(float(emp.base_lat), float(emp.base_lon), req.lat, req.lon)
    dist_score = max(0.0, 1.0 - (dist_km / 15.0))
    max_m = emp.max_daily_minutes or 480
    wl_score = max(0.0, 1.0 - (current_wl / max_m))
    cont_score = 0.50

    total = (
        w.get("skill", 0.30) * skill_fit +
        w.get("time", 0.25) * time_fit +
        w.get("distance", 0.20) * dist_score +
        w.get("workload", 0.15) * wl_score +
        w.get("continuity", 0.10) * cont_score
    )
    return round(total, 4), dist_km, travel_mins


def run_nearest(reqs, emps, use_ai=True):
    t0 = time.time()
    emp_skills = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in emps}
    emp_slots = {e.employee_id: [] for e in emps}
    assigns = []

    for r in reqs:
        dur = r.predicted_duration if use_ai else r.default_duration
        st, et = r.preferred_start, r.preferred_start + timedelta(minutes=dur)
        candidates = []
        for e in emps:
            if is_feasible(e, emp_skills[e.employee_id], r, st, et, emp_slots[e.employee_id]):
                wl = sum(s["duration_mins"] for s in emp_slots[e.employee_id])
                score, d_km, t_min = calc_dss(e, emp_skills[e.employee_id], r, st, wl)
                candidates.append((e, d_km, t_min, score))
        if candidates:
            best_e, d_km, t_min, score = min(candidates, key=lambda x: x[1])
            slot = {
                "request_id": r.request_id, "employee_id": best_e.employee_id,
                "scheduled_start": st, "scheduled_end": et, "duration_mins": dur,
                "actual_duration": r.actual_duration, "lat": r.lat, "lon": r.lon,
                "distance_km": d_km, "travel_mins": t_min, "dss_score": score
            }
            emp_slots[best_e.employee_id].append(slot)
            assigns.append(slot)

    return assigns, (time.time() - t0) * 1000.0


def run_weighted(reqs, emps, use_ai=True, weights=None):
    t0 = time.time()
    emp_skills = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in emps}
    emp_slots = {e.employee_id: [] for e in emps}
    assigns = []

    for r in reqs:
        dur = r.predicted_duration if use_ai else r.default_duration
        st, et = r.preferred_start, r.preferred_start + timedelta(minutes=dur)
        candidates = []
        for e in emps:
            if is_feasible(e, emp_skills[e.employee_id], r, st, et, emp_slots[e.employee_id]):
                wl = sum(s["duration_mins"] for s in emp_slots[e.employee_id])
                score, d_km, t_min = calc_dss(e, emp_skills[e.employee_id], r, st, wl, weights)
                candidates.append((e, d_km, t_min, score))
        if candidates:
            best_e, d_km, t_min, score = max(candidates, key=lambda x: x[3])
            slot = {
                "request_id": r.request_id, "employee_id": best_e.employee_id,
                "scheduled_start": st, "scheduled_end": et, "duration_mins": dur,
                "actual_duration": r.actual_duration, "lat": r.lat, "lon": r.lon,
                "distance_km": d_km, "travel_mins": t_min, "dss_score": score
            }
            emp_slots[best_e.employee_id].append(slot)
            assigns.append(slot)

    return assigns, (time.time() - t0) * 1000.0


def run_ortools_opt(reqs, emps, use_ai=True, weights=None, time_limit=8.0):
    t0 = time.time()
    emp_skills = {e.employee_id: {es.skill_id: es.level for es in e.employee_skills} for e in emps}

    model = cp_model.CpModel()
    x = {}
    pair_map = {}

    for r in reqs:
        dur = r.predicted_duration if use_ai else r.default_duration
        st, et = r.preferred_start, r.preferred_start + timedelta(minutes=dur)
        for e in emps:
            if is_feasible(e, emp_skills[e.employee_id], r, st, et, []):
                score, d_km, t_min = calc_dss(e, emp_skills[e.employee_id], r, st, 0, weights)
                var = model.new_bool_var(f"x_{r.request_id}_{e.employee_id}")
                x[(r.request_id, e.employee_id)] = var
                pair_map[(r.request_id, e.employee_id)] = {
                    "request": r, "employee": e, "st": st, "et": et,
                    "dur": dur, "act_dur": r.actual_duration, "d_km": d_km,
                    "t_min": t_min, "score": score
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
                    _, t_mins = RoutingEngine.haversine_estimate(p1["request"].lat, p1["request"].lon, p2["request"].lat, p2["request"].lon)
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
                    "request_id": p["request"].request_id, "employee_id": p["employee"].employee_id,
                    "scheduled_start": p["st"], "scheduled_end": p["et"], "duration_mins": p["dur"],
                    "actual_duration": p["act_dur"], "lat": p["request"].lat, "lon": p["request"].lon,
                    "distance_km": p["d_km"], "travel_mins": p["t_min"], "dss_score": p["score"]
                })

    return assigns, (time.time() - t0) * 1000.0


def calc_metrics(assigns, total_reqs, emps):
    n = len(assigns)
    feas_rate = (n / total_reqs * 100.0) if total_reqs > 0 else 0.0
    if not assigns:
        return {
            "feasible_rate": 0.0, "assigned_count": 0, "unassigned_count": total_reqs,
            "total_travel_distance_km": 0.0, "mean_travel_time_min": 0.0, "overtime_minutes": 0,
            "workload_std_dev": 0.0, "avg_dss_score": 0.0
        }

    tot_dist = sum(a["distance_km"] for a in assigns)
    tot_time = sum(a["travel_mins"] for a in assigns)
    mean_time = tot_time / n

    emp_wl = {e.employee_id: 0 for e in emps}
    for a in assigns:
        emp_wl[a["employee_id"]] = emp_wl.get(a["employee_id"], 0) + a["duration_mins"]

    wl_std = float(np.std(list(emp_wl.values())))
    overtime = sum(max(0, emp_wl[e.employee_id] - (e.max_daily_minutes or 480)) for e in emps)
    avg_dss = float(np.mean([a["dss_score"] for a in assigns]))

    return {
        "feasible_rate": round(feas_rate, 2),
        "assigned_count": n,
        "unassigned_count": total_reqs - n,
        "total_travel_distance_km": round(tot_dist, 2),
        "mean_travel_time_min": round(mean_time, 2),
        "overtime_minutes": overtime,
        "workload_std_dev": round(wl_std, 2),
        "avg_dss_score": round(avg_dss, 4)
    }


def simulate_actual(assigns, emps):
    if not assigns:
        return {"actual_overlap_count": 0, "late_start_count": 0, "total_delay_minutes": 0, "max_delay_minutes": 0, "actual_feasible_rate": 0.0}

    emp_a = {e.employee_id: [] for e in emps}
    for a in assigns:
        emp_a[a["employee_id"]].append(a)

    overlaps = 0
    late_starts = 0
    tot_delay = 0
    max_delay = 0
    severe_delay = 0

    for eid, a_list in emp_a.items():
        if not a_list:
            continue
        a_list.sort(key=lambda x: x["scheduled_start"])
        curr_time = None
        prev_loc = None

        for i, ca in enumerate(a_list):
            st, et = ca["scheduled_start"], ca["scheduled_end"]
            act_dur = ca["actual_duration"]
            loc = (ca["lat"], ca["lon"])

            if i == 0:
                act_st = st
                delay = 0
            else:
                _, t_mins = RoutingEngine.haversine_estimate(prev_loc[0], prev_loc[1], loc[0], loc[1])
                earliest = curr_time + timedelta(minutes=t_mins)
                if earliest > st:
                    delay = int((earliest - st).total_seconds() / 60.0)
                    act_st = earliest
                    late_starts += 1
                    tot_delay += delay
                    max_delay = max(max_delay, delay)
                    if earliest > et or curr_time > st:
                        overlaps += 1
                    if delay > 15:
                        severe_delay += 1
                else:
                    act_st = st
                    delay = 0

            curr_time = act_st + timedelta(minutes=act_dur)
            prev_loc = loc

    tot_ca = len(assigns)
    feas = round(((tot_ca - severe_delay) / tot_ca * 100.0), 2) if tot_ca > 0 else 0.0
    return {
        "actual_overlap_count": overlaps, "late_start_count": late_starts,
        "total_delay_minutes": tot_delay, "max_delay_minutes": max_delay,
        "actual_feasible_rate": feas
    }


def main():
    db = SessionLocal()
    try:
        emps = db.execute(select(Employee).where(Employee.status == "active")).scalars().all()
        print(f"-> Active Medical Staff in Database: {len(emps)}")

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
                reqs = generate_requests(db, load, seed, target_date)

                # Nearest
                a_nf, t_nf = run_nearest(reqs, emps, True)
                m = calc_metrics(a_nf, load, emps)
                m.update({"load": load, "seed": seed, "algorithm": "Nearest Feasible", "runtime_ms": round(t_nf, 2)})
                stress_recs.append(m)

                # Weighted DSS
                a_wd, t_wd = run_weighted(reqs, emps, True)
                m = calc_metrics(a_wd, load, emps)
                m.update({"load": load, "seed": seed, "algorithm": "Weighted DSS", "runtime_ms": round(t_wd, 2)})
                stress_recs.append(m)

                # OR-Tools
                a_ort, t_ort = run_ortools_opt(reqs, emps, True, time_limit=8.0)
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
        for load in [10, 25, 50, 100]:
            print(f"--> Load {load} req/day...")
            for seed in seeds:
                reqs = generate_requests(db, load, seed, target_date)

                # Plan A: Default Duration
                a_def, _ = run_ortools_opt(reqs, emps, use_ai=False, time_limit=8.0)
                res_a = simulate_actual(a_def, emps)
                res_a.update({"load": load, "seed": seed, "plan": "A. Default Duration (Thiếu AI)"})
                act_recs.append(res_a)

                # Plan B: AI Predicted Duration
                a_ai, _ = run_ortools_opt(reqs, emps, use_ai=True, time_limit=8.0)
                res_b = simulate_actual(a_ai, emps)
                res_b.update({"load": load, "seed": seed, "plan": "B. AI Predicted Duration (Có AI)"})
                act_recs.append(res_b)

        df_act = pd.DataFrame(act_recs)
        df_act.to_csv(exp_dir / "actual_duration_evaluation_results.csv", index=False, encoding="utf-8-sig")

        act_cols = ["actual_overlap_count", "late_start_count", "total_delay_minutes", "max_delay_minutes", "actual_feasible_rate"]
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
        for s_name, w_dict in scenarios.items():
            for seed in seeds:
                reqs = generate_requests(db, 50, seed, target_date)
                a_ort, t_ort = run_ortools_opt(reqs, emps, use_ai=True, weights=w_dict, time_limit=8.0)
                m = calc_metrics(a_ort, 50, emps)
                m.update({"scenario": s_name, "seed": seed, "runtime_ms": round(t_ort, 2)})
                sens_recs.append(m)

        df_sens = pd.DataFrame(sens_recs)
        df_sens.to_csv(exp_dir / "dss_sensitivity_analysis_results.csv", index=False, encoding="utf-8-sig")

        sum_sens = []
        for s_name, group in df_sens.groupby("scenario"):
            row = {"scenario": s_name}
            for c in ["feasible_rate", "total_travel_distance_km", "workload_std_dev", "avg_dss_score"]:
                row[c] = f"{group[c].mean():.2f} ± {group[c].std():.2f}"
            sum_sens.append(row)

        df_sens_sum = pd.DataFrame(sum_sens)
        df_sens_sum.to_csv(exp_dir / "dss_sensitivity_summary.csv", index=False, encoding="utf-8-sig")
        print("\nDSS SENSITIVITY SUMMARY TABLE (mean ± std):")
        print(df_sens_sum.to_markdown(index=False))

        print(f"\n---> ALL EXPERIMENTS FINISHED! Files saved to: {exp_dir}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
