"""
Script: build_duration_dataset.py
Mục đích:
- Xây dựng tập dữ liệu huấn luyện ML dự đoán thời lượng dịch vụ y tế tại nhà.
- Đọc dữ liệu thực tế từ cơ sở dữ liệu (các ca hoàn tất thành công: status_outcome == 'successful').
- Bổ sung các mẫu lịch sử mô phỏng thực tế bám sát phân phối dịch vụ tại Nha Trang (800 mẫu).
- Đảm bảo KHÔNG BỊ RÒ RỈ DỮ LIỆU (No Data Leakage): chỉ sử dụng các đặc trưng đã biết trước khi điều phối ca.
- Lưu tập dữ liệu vào artifacts/data/duration_dataset.csv và chia train/val/test.
"""

import os
import sys
import math
import random
from pathlib import Path
from datetime import datetime, timedelta, timezone
import pandas as pd
import numpy as np

# Thiết lập đường dẫn import backend
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import Service, ServiceRequest, Assignment, ServiceResult, Customer


def generate_duration_dataset(total_records: int = 800, random_seed: int = 42):
    """
    Tạo tập dữ liệu ML dự đoán thời lượng dịch vụ dựa trên dữ liệu thật trong CSDL
    và các quy luật thực tế của ngành điều dưỡng tại nhà.
    """
    np.random.seed(random_seed)
    random.seed(random_seed)

    db = SessionLocal()
    try:
        # 1. Đọc danh mục dịch vụ từ CSDL
        services = db.execute(select(Service)).scalars().all()
        service_lookup = {
            s.service_id: {
                "name": s.service_name,
                "default_duration": s.default_duration,
                "base_price": float(s.base_price) if s.base_price else 200000.0
            }
            for s in services
        }
        
        # 2. Đọc các bản ghi thực tế đã hoàn thành trong CSDL (nếu có)
        query = (
            select(
                ServiceResult.actual_duration,
                ServiceResult.actual_start,
                ServiceResult.actual_end,
                ServiceResult.status_outcome,
                Assignment.scheduled_start,
                ServiceRequest.service_id,
                ServiceRequest.complexity_level,
                ServiceRequest.has_special_equip,
                ServiceRequest.priority,
                ServiceRequest.district_code,
                ServiceRequest.preferred_start
            )
            .join(Assignment, ServiceResult.assignment_id == Assignment.assignment_id)
            .join(ServiceRequest, Assignment.request_id == ServiceRequest.request_id)
            .filter(ServiceResult.status_outcome == "successful")
            .filter(ServiceResult.actual_duration.isnot(None))
            .filter(ServiceResult.actual_duration > 0)
        )
        real_records = db.execute(query).all()
        print(f"-> Tim thay {len(real_records)} ban ghi thuc te hoan tat tu database.")

        dataset_rows = []

        # Chuyển đổi dữ liệu thực tế
        for row in real_records:
            s_info = service_lookup.get(row.service_id, {"default_duration": 60, "base_price": 200000.0})
            pref_start = row.preferred_start or row.scheduled_start
            
            dataset_rows.append({
                "service_id": row.service_id,
                "default_duration": s_info["default_duration"],
                "base_price": s_info["base_price"],
                "complexity_level": row.complexity_level or 1,
                "has_special_equip": 1 if row.has_special_equip else 0,
                "priority": row.priority or 2,
                "district_code": row.district_code or "LOC_THO",
                "preferred_start_hour": pref_start.hour if pref_start else 9,
                "day_of_week": pref_start.weekday() if pref_start else 2,
                "actual_duration": int(row.actual_duration),
                "is_synthetic": 0
            })

        # 3. Tạo bổ sung các ca lịch sử mô phỏng theo phân phối nghiệp vụ y tế Nha Trang
        districts = [
            "LOC_THO", "PHUOC_TIEN", "VAN_THANH", "VINH_PHUOC", "TAN_LAP",
            "PHUOC_HAI", "VINH_HAI", "XUONG_HUAN", "PHUONG_SAI", "VINH_NGUYEN"
        ]
        needed_synthetic = max(0, total_records - len(dataset_rows))
        print(f"-> Mo phong bo sung {needed_synthetic} ban ghi hop le theo quy luat y te Nha Trang...")

        service_ids = list(service_lookup.keys())

        for i in range(needed_synthetic):
            s_id = random.choice(service_ids)
            s_info = service_lookup[s_id]
            base_dur = s_info["default_duration"]
            base_prc = s_info["base_price"]

            # Phân phối mức độ phức tạp (1: 45%, 2: 30%, 3: 15%, 4: 7%, 5: 3%)
            complexity = np.random.choice([1, 2, 3, 4, 5], p=[0.45, 0.30, 0.15, 0.07, 0.03])
            
            # Thiết bị chuyên dụng (25% có thiết bị)
            has_equip = 1 if np.random.rand() < 0.25 else 0

            # Mức độ ưu tiên (1: bình thường 60%, 2: nhanh 30%, 3: khẩn cấp 10%)
            priority = np.random.choice([1, 2, 3], p=[0.60, 0.30, 0.10])

            # Quận/huyện tại Nha Trang
            dist_code = random.choice(districts)

            # Khung giờ hẹn (7h sáng đến 18h tối)
            # Giờ cao điểm khám sáng: 8-10h, chiều: 14-16h
            hour_choices = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17]
            hour_prob = [0.05, 0.18, 0.20, 0.12, 0.05, 0.05, 0.15, 0.12, 0.05, 0.03]
            pref_hour = int(np.random.choice(hour_choices, p=hour_prob))

            # Ngày trong tuần (0: Thứ Hai -> 6: Chủ Nhật)
            day_of_week = random.randint(0, 6)

            # --- MÔ HÌNH HÓA THỜI LƯỢNG THỰC TẾ (GROUND TRUTH FORMULA) ---
            # 1. Thời lượng cơ sở theo gói dịch vụ
            expected_duration = base_dur

            # 2. Ảnh hưởng của độ phức tạp bệnh án (+12% mỗi bậc trên mức 1)
            expected_duration += base_dur * (complexity - 1) * 0.12

            # 3. Ảnh hưởng của thao tác lắp đặt & khử trùng thiết bị chuyên dụng (+10 đến +15 phút)
            if has_equip:
                expected_duration += 12.0

            # 4. Ca khẩn cấp/ưu tiên cao: chăm sóc tỉ mỉ hoặc xử lý phát sinh (+3 đến +7 phút)
            if priority == 3:
                expected_duration += 5.0
            elif priority == 2:
                expected_duration += 2.0

            # 5. Khung giờ cao điểm: chuẩn bị vật tư, trao đổi gia đình kỹ hơn (+2 đến +4 phút)
            if pref_hour in [8, 9, 14, 15]:
                expected_duration += 3.0

            # 6. Nhiễu ngẫu nhiên thực tế (phản ánh đặc thù bệnh nhân, huyết áp, tâm lý): Gaussian(mu=0, sigma=4.5)
            noise = np.random.normal(0, 4.5)
            actual_dur = int(round(expected_duration + noise))

            # Giới hạn cận an toàn thực tế (tối thiểu 15 phút, tối đa 240 phút)
            actual_dur = max(15, min(240, actual_dur))

            dataset_rows.append({
                "service_id": s_id,
                "default_duration": base_dur,
                "base_price": base_prc,
                "complexity_level": complexity,
                "has_special_equip": has_equip,
                "priority": priority,
                "district_code": dist_code,
                "preferred_start_hour": pref_hour,
                "day_of_week": day_of_week,
                "actual_duration": actual_dur,
                "is_synthetic": 1
            })

        df = pd.DataFrame(dataset_rows)

        # 4. Lưu file dataset CSV
        data_dir = BASE_DIR / "artifacts" / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        csv_path = data_dir / "duration_dataset.csv"
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")

        print(f"-> Da tao thanh cong tap du lieu: {csv_path}")
        print(f"-> Tong so mau: {len(df)}")
        print(f"-> Phan phoi theo Service ID:\n{df['service_id'].value_counts().sort_index()}")
        print(f"-> Thoi luong thuc te (actual_duration) trung binh: {df['actual_duration'].mean():.2f} phut (Min: {df['actual_duration'].min()}, Max: {df['actual_duration'].max()})")

        return df

    finally:
        db.close()


if __name__ == "__main__":
    generate_duration_dataset()
