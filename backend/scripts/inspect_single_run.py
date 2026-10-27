"""
Script: inspect_single_run.py
Mục đích:
- Cho phép người dùng soi chi tiết lịch trình của từng nhân viên y tế trong 1 lượt chạy cụ thể (ví dụ: Load 25, seed 42).
- Trực quan hóa giờ hẹn, thời gian di chuyển, thời lượng dự đoán vs thực tế và số phút trễ.
- Giúp người dùng kiểm chứng bằng mắt thường tính logic và tính khả thi của thuật toán.
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from sqlalchemy import select

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.db.session import SessionLocal
from app.models import Employee
from app.ai.routing import RoutingEngine
from scripts.run_stress_test import generate_requests, run_ortools_opt

def inspect_run(load=25, seed=42):
    print("=" * 90)
    print(f" SOI CHI TIẾT LỊCH TRÌNH VẬN HÀNH (MỨC TẢI {load} REQUESTS/NGÀY - RANDOM SEED {seed})")
    print("=" * 90)

    db = SessionLocal()
    try:
        emps = db.execute(select(Employee).where(Employee.status == "active")).scalars().all()
        target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
        reqs = generate_requests(db, load, seed, target_date)

        print(f"-> Tổng số ca yêu cầu phát sinh: {len(reqs)}")
        print(f"-> Đội ngũ nhân viên tiếp nhận: {len(emps)} điều dưỡng")

        # Chạy xếp lịch với AI Duration bằng OR-Tools
        assigns, runtime = run_ortools_opt(reqs, emps, use_ai=True, time_limit=5.0)
        print(f"-> Số ca xếp thành công: {len(assigns)}/{len(reqs)} ({len(assigns)/len(reqs)*100:.1f}%) | Solver runtime: {runtime:.2f} ms\n")

        # Gom nhóm ca theo từng nhân viên
        emp_map = {e.employee_id: [] for e in emps}
        for a in assigns:
            emp_map[a["employee_id"]].append(a)

        for e in emps:
            my_assigns = emp_map[e.employee_id]
            if not my_assigns:
                print(f"🔹 Nhân viên: {e.full_name} (ID: {e.employee_id}) - Không có ca nào được phân bổ.")
                continue

            my_assigns.sort(key=lambda x: x["scheduled_start"])
            tot_dur = sum(x["duration_mins"] for x in my_assigns)
            print(f"👨‍⚕️ Điều dưỡng: {e.full_name} (ID: {e.employee_id}) | Tổng tải: {tot_dur} phút / 480 phút | Số ca: {len(my_assigns)}")
            print("-" * 90)
            print(f"{'Ca':<4} | {'Bắt đầu':<8} | {'Kết thúc':<8} | {'Dự đoán':<9} | {'Thực tế':<9} | {'Cự ly':<8} | {'Di chuyển':<10} | {'Độ trễ':<8}")
            print("-" * 90)

            curr_time = None
            prev_loc = (float(e.base_lat), float(e.base_lon))
            for idx, a in enumerate(my_assigns, 1):
                st = a["scheduled_start"].strftime("%H:%M")
                et = a["scheduled_end"].strftime("%H:%M")
                dur_pred = f"{a['duration_mins']}p"
                dur_act = f"{a['actual_duration']}p"
                
                # Tính cự ly từ vị trí trước
                loc = (a["lat"], a["lon"])
                dist_km, t_min, _ = RoutingEngine.get_distance_and_travel_time(prev_loc[0], prev_loc[1], loc[0], loc[1])
                
                # Mô phỏng giờ đến thực tế
                if curr_time is None:
                    act_st = a["scheduled_start"]
                    delay = 0
                else:
                    earliest = curr_time + timedelta(minutes=t_min)
                    if earliest > a["scheduled_start"]:
                        delay = int((earliest - a["scheduled_start"]).total_seconds() / 60.0)
                        act_st = earliest
                    else:
                        delay = 0
                        act_st = a["scheduled_start"]

                curr_time = act_st + timedelta(minutes=a["actual_duration"])
                prev_loc = loc

                delay_str = f"Trễ {delay}p" if delay > 0 else "Đúng giờ"
                print(f"#{idx:<3} | {st:<8} | {et:<8} | {dur_pred:<9} | {dur_act:<9} | {dist_km:>5.1f} km | {t_min:>5} phút  | {delay_str:<8}")

            print("=" * 90)

    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--load", type=int, default=25, help="Số lượng request (10, 25, 50, 100)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (42, 101, 202...)")
    args = parser.parse_args()
    inspect_run(args.load, args.seed)
