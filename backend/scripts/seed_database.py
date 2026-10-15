import os
import sys
import random
from datetime import date, time, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import select, delete
from app.db.session import SessionLocal, engine
from app.core.security import get_password_hash
from app.models import (
    Base,
    Role, Permission, RolePermission, User,
    Customer, Employee,
    Skill, EmployeeSkill, Service, ServiceRequiredSkill,
    ServiceRequest, EmployeeAvailability, LeaveRequest,
    ScheduleVersion, Assignment, TravelMatrix, ServiceResult, Rating,
    AIModelVersion, AIPrediction, RecommendationLog,
    Notification, AuditLog
)

# Cố định random seed để có thể tái lập dữ liệu 100% theo yêu cầu nghiên cứu
RANDOM_SEED = 42
random.seed(RANDOM_SEED)


def clear_all_data(db):
    """Xóa toàn bộ dữ liệu an toàn và nhanh chóng bằng TRUNCATE CASCADE trong PostgreSQL"""
    print("Clearing existing data for clean re-seed...")
    from sqlalchemy import text
    table_names = [
        "ratings", "service_results", "assignments", "recommendation_logs",
        "ai_predictions", "travel_matrix", "schedule_versions", "leave_requests",
        "employee_availability", "service_requests", "service_required_skills",
        "employee_skills", "services", "skills", "customers", "employees",
        "notifications", "audit_logs", "users", "role_permissions",
        "permissions", "roles", "ai_model_versions"
    ]
    db.execute(text(f"TRUNCATE TABLE {', '.join(table_names)} RESTART IDENTITY CASCADE;"))
    db.commit()
    print("All existing data cleared.")


def seed_database():
    db = SessionLocal()
    try:
        print(f"Starting seed_database with random seed = {RANDOM_SEED}...")
        clear_all_data(db)

        # ----------------------------------------------------
        # 1. ROLES & PERMISSIONS (RBAC)
        # ----------------------------------------------------
        print("1. Seeding Roles and Permissions...")
        roles_dict = {
            "ADMIN": Role(role_name="ADMIN", description="Quản trị viên toàn quyền hệ thống"),
            "COORDINATOR": Role(role_name="COORDINATOR", description="Điều phối viên tiếp nhận và duyệt phân công"),
            "HEALTHCARE_STAFF": Role(role_name="HEALTHCARE_STAFF", description="Nhân viên y tế thực hiện dịch vụ"),
            "CUSTOMER": Role(role_name="CUSTOMER", description="Khách hàng và người đại diện đặt lịch chăm sóc"),
            "MANAGER": Role(role_name="MANAGER", description="Quản lý giám sát KPI và chất lượng"),
        }
        for r in roles_dict.values():
            db.add(r)
        db.flush()

        permissions_list = [
            Permission(permission_code="USER_MANAGE", description="Quản lý tài khoản và phân quyền"),
            Permission(permission_code="SERVICE_MANAGE", description="Quản lý danh mục dịch vụ và kỹ năng"),
            Permission(permission_code="REQUEST_CREATE", description="Tạo yêu cầu dịch vụ chăm sóc"),
            Permission(permission_code="REQUEST_MANAGE", description="Tiếp nhận, thẩm định yêu cầu chăm sóc"),
            Permission(permission_code="SCHEDULE_OPTIMIZE", description="Chạy thuật toán AI/OR-Tools đề xuất lịch"),
            Permission(permission_code="SCHEDULE_CONFIRM", description="Phê duyệt hoặc điều chỉnh phân công"),
            Permission(permission_code="SERVICE_EXECUTE", description="Thực hiện dịch vụ và ghi nhận kết quả"),
            Permission(permission_code="REPORT_VIEW", description="Xem báo cáo quản trị và KPI"),
        ]
        for p in permissions_list:
            db.add(p)
        db.flush()

        # Role-Permission mapping
        perm_map = {p.permission_code: p for p in permissions_list}
        role_perm_defs = {
            "ADMIN": ["USER_MANAGE", "SERVICE_MANAGE", "REQUEST_MANAGE", "SCHEDULE_OPTIMIZE", "SCHEDULE_CONFIRM", "REPORT_VIEW"],
            "COORDINATOR": ["REQUEST_MANAGE", "SCHEDULE_OPTIMIZE", "SCHEDULE_CONFIRM", "REPORT_VIEW"],
            "HEALTHCARE_STAFF": ["SERVICE_EXECUTE"],
            "CUSTOMER": ["REQUEST_CREATE"],
            "MANAGER": ["REPORT_VIEW"],
        }
        for r_name, p_codes in role_perm_defs.items():
            r = roles_dict[r_name]
            for p_code in p_codes:
                p = perm_map[p_code]
                db.add(RolePermission(role_id=r.role_id, permission_id=p.permission_id))
        db.flush()

        # ----------------------------------------------------
        # 2. USERS (ADMIN, COORDINATOR, MANAGER)
        # ----------------------------------------------------
        print("2. Seeding System Users...")
        default_pwd = get_password_hash("123456")  # Mật khẩu demo chung: 123456

        admin_user = User(
            role_id=roles_dict["ADMIN"].role_id,
            username="admin",
            email="admin@homehealthcare.vn",
            password_hash=default_pwd,
            status="active"
        )
        coord_user1 = User(
            role_id=roles_dict["COORDINATOR"].role_id,
            username="coordinator1",
            email="coordinator1@homehealthcare.vn",
            password_hash=default_pwd,
            status="active"
        )
        coord_user2 = User(
            role_id=roles_dict["COORDINATOR"].role_id,
            username="coordinator2",
            email="coordinator2@homehealthcare.vn",
            password_hash=default_pwd,
            status="active"
        )
        manager_user = User(
            role_id=roles_dict["MANAGER"].role_id,
            username="manager",
            email="manager@homehealthcare.vn",
            password_hash=default_pwd,
            status="active"
        )
        db.add_all([admin_user, coord_user1, coord_user2, manager_user])
        db.flush()

        # ----------------------------------------------------
        # 3. SKILLS & SERVICES
        # ----------------------------------------------------
        print("3. Seeding Skills and Services...")
        skills_data = [
            ("SKILL_WOUND_CARE", "Chăm sóc và rửa vết thương cơ bản"),
            ("SKILL_SURGICAL_DRESSING", "Thay băng cắt chỉ & rửa vết mổ phẫu thuật"),
            ("SKILL_IV_INJECTION", "Tiêm truyền tĩnh mạch & lấy mẫu máu xét nghiệm"),
            ("SKILL_PHYSIOTHERAPY", "Vật lý trị liệu & phục hồi chức năng vận động"),
            ("SKILL_VENTILATOR_CARE", "Chăm sóc bệnh nhân thở máy & mở khí quản"),
            ("SKILL_ELDERLY_VITALS", "Theo dõi sinh hiệu, huyết áp & đường huyết người cao tuổi"),
            ("SKILL_DIABETES_CARE", "Chăm sóc loét tỳ đè & biến chứng đái tháo đường"),
            ("SKILL_NEONATAL_CARE", "Tắm bé sơ sinh & chăm sóc rốn trẻ em"),
            ("SKILL_ACUPUNCTURE", "Xoa bóp bấm huyệt & trị liệu đông y phục hồi"),
            ("SKILL_NUTRITION_FEEDING", "Đặt ống sonde dạ dày & hỗ trợ dinh dưỡng qua ống"),
        ]
        skills_dict = {}
        for code, name in skills_data:
            sk = Skill(skill_name=name, description=f"Kỹ năng chuẩn y tế: {name}", status="active")
            db.add(sk)
            skills_dict[code] = sk
        db.flush()

        services_data = [
            ("SERV_WOUND", "Chăm sóc vết thương và thay băng tại nhà", 45, Decimal("150000.00"), [("SKILL_WOUND_CARE", 1, True)]),
            ("SERV_SURGICAL", "Thay băng cắt chỉ vết mổ sau phẫu thuật", 50, Decimal("200000.00"), [("SKILL_SURGICAL_DRESSING", 2, True)]),
            ("SERV_PHYSIO", "Vật lý trị liệu phục hồi chức năng sau tai biến", 60, Decimal("280000.00"), [("SKILL_PHYSIOTHERAPY", 2, True)]),
            ("SERV_IV", "Tiêm truyền và lấy mẫu xét nghiệm tận nơi", 40, Decimal("180000.00"), [("SKILL_IV_INJECTION", 2, True)]),
            ("SERV_ELDERLY", "Chăm sóc toàn diện người cao tuổi / nằm liệt giường", 90, Decimal("320000.00"), [("SKILL_ELDERLY_VITALS", 1, True), ("SKILL_DIABETES_CARE", 1, False)]),
        ]
        services_dict = {}
        for code, s_name, dur, price, req_skills in services_data:
            srv = Service(
                service_name=s_name,
                description=f"Dịch vụ y tế tại nhà: {s_name}",
                default_duration=dur,
                base_price=price,
                active=True
            )
            db.add(srv)
            db.flush()
            services_dict[code] = srv

            for sk_code, min_lvl, mand in req_skills:
                db.add(ServiceRequiredSkill(
                    service_id=srv.service_id,
                    skill_id=skills_dict[sk_code].skill_id,
                    min_level=min_lvl,
                    mandatory=mand
                ))
        db.flush()

        # ----------------------------------------------------
        # 4. EMPLOYEES (10 Nhân sự y tế tại Nha Trang)
        # ----------------------------------------------------
        print("4. Seeding Employees & Employee Skills...")
        # Tọa độ mẫu tại Nha Trang: lat ~ 12.23 - 12.27, lon ~ 109.18 - 109.20
        nha_trang_coords = [
            (Decimal("12.245800"), Decimal("109.194200")),  # Lộc Thọ
            (Decimal("12.253600"), Decimal("109.191200")),  # Phước Tiến
            (Decimal("12.261200"), Decimal("109.189500")),  # Vạn Thạnh
            (Decimal("12.271500"), Decimal("109.196300")),  # Vĩnh Phước
            (Decimal("12.238900"), Decimal("109.185600")),  # Phước Hải
            (Decimal("12.229400"), Decimal("109.192300")),  # Tân Lập
            (Decimal("12.249100"), Decimal("109.181200")),  # Phương Sài
            (Decimal("12.280200"), Decimal("109.198900")),  # Vĩnh Hòa
            (Decimal("12.220500"), Decimal("109.180400")),  # Vĩnh Trường
            (Decimal("12.258000"), Decimal("109.175000")),  # Ngọc Hiệp
        ]

        employee_specs = [
            ("Nguyễn Văn Hùng", "nurse", [("SKILL_WOUND_CARE", 4), ("SKILL_SURGICAL_DRESSING", 3), ("SKILL_IV_INJECTION", 4)]),
            ("Trần Thị Mai", "nurse", [("SKILL_WOUND_CARE", 5), ("SKILL_SURGICAL_DRESSING", 4), ("SKILL_ELDERLY_VITALS", 4)]),
            ("Lê Hoàng Nam", "physiotherapist", [("SKILL_PHYSIOTHERAPY", 5), ("SKILL_ACUPUNCTURE", 4)]),
            ("Phạm Minh Tuấn", "physiotherapist", [("SKILL_PHYSIOTHERAPY", 4), ("SKILL_ACUPUNCTURE", 3)]),
            ("Đỗ Thị Lan", "nurse", [("SKILL_IV_INJECTION", 5), ("SKILL_VENTILATOR_CARE", 3), ("SKILL_ELDERLY_VITALS", 4)]),
            ("Vũ Thanh Tùng", "caregiver", [("SKILL_ELDERLY_VITALS", 4), ("SKILL_DIABETES_CARE", 3), ("SKILL_NUTRITION_FEEDING", 4)]),
            ("Hoàng Thị Cúc", "nurse", [("SKILL_NEONATAL_CARE", 5), ("SKILL_WOUND_CARE", 3), ("SKILL_IV_INJECTION", 3)]),
            ("Bùi Đức Thắng", "nurse", [("SKILL_SURGICAL_DRESSING", 5), ("SKILL_VENTILATOR_CARE", 4), ("SKILL_IV_INJECTION", 4)]),
            ("Ngô Thị Bích", "caregiver", [("SKILL_ELDERLY_VITALS", 3), ("SKILL_DIABETES_CARE", 4), ("SKILL_WOUND_CARE", 2)]),
            ("Dương Quang Huy", "physiotherapist", [("SKILL_PHYSIOTHERAPY", 4), ("SKILL_WOUND_CARE", 3)]),
        ]

        employees_list = []
        for i, (name, emp_type, emp_skills) in enumerate(employee_specs):
            lat, lon = nha_trang_coords[i % len(nha_trang_coords)]
            u = User(
                role_id=roles_dict["HEALTHCARE_STAFF"].role_id,
                username=f"staff{i+1}",
                email=f"staff{i+1}@homehealthcare.vn",
                password_hash=default_pwd,
                status="active"
            )
            db.add(u)
            db.flush()

            emp = Employee(
                user_id=u.user_id,
                full_name=name,
                employee_type=emp_type,
                phone=f"09051122{i+1:02d}",
                base_lat=lat,
                base_lon=lon,
                max_daily_minutes=480,
                status="active"
            )
            db.add(emp)
            db.flush()
            employees_list.append(emp)

            # Gán kỹ năng cho nhân viên
            for sk_code, lvl in emp_skills:
                db.add(EmployeeSkill(
                    employee_id=emp.employee_id,
                    skill_id=skills_dict[sk_code].skill_id,
                    level=lvl,
                    valid_from=date(2025, 1, 1),
                    valid_to=date(2028, 12, 31)
                ))
        db.flush()

        # ----------------------------------------------------
        # 5. EMPLOYEE AVAILABILITY (14 ngày tới)
        # ----------------------------------------------------
        print("5. Seeding Employee Availability (Ca sáng 07:30 - 11:30, Ca chiều 13:30 - 17:30)...")
        today = date.today()
        for emp in employees_list:
            for day_offset in range(14):
                curr_date = today + timedelta(days=day_offset)
                # Nghỉ ngày chủ nhật
                if curr_date.weekday() == 6:
                    continue
                # Ca sáng
                db.add(EmployeeAvailability(
                    employee_id=emp.employee_id,
                    date=curr_date,
                    start_time=time(7, 30),
                    end_time=time(11, 30),
                    availability_type="working"
                ))
                # Ca chiều
                db.add(EmployeeAvailability(
                    employee_id=emp.employee_id,
                    date=curr_date,
                    start_time=time(13, 30),
                    end_time=time(17, 30),
                    availability_type="working"
                ))
        db.flush()

        # ----------------------------------------------------
        # 6. CUSTOMERS (20 Khách hàng / Bệnh nhân tại Nha Trang)
        # ----------------------------------------------------
        print("6. Seeding Customers...")
        customer_names = [
            ("Lê Thị Kim", "0913456001", "12 Lê Thánh Tôn, Lộc Thọ, Nha Trang", "LOC_THO", Decimal("12.243500"), Decimal("109.195600")),
            ("Trần Văn Hòa", "0913456002", "45 Quang Trung, Vạn Thạnh, Nha Trang", "VAN_THANH", Decimal("12.258900"), Decimal("109.191200")),
            ("Phan Thị Hạnh", "0913456003", "78 2/4, Vĩnh Phước, Nha Trang", "VINH_PHUOC", Decimal("12.270100"), Decimal("109.197800")),
            ("Nguyễn Đức Minh", "0913456004", "102 Hùng Vương, Lộc Thọ, Nha Trang", "LOC_THO", Decimal("12.239800"), Decimal("109.193400")),
            ("Võ Thị Tuyết", "0913456005", "23 Nguyễn Trãi, Phước Tiến, Nha Trang", "PHUOC_TIEN", Decimal("12.251200"), Decimal("109.188700")),
            ("Đặng Quốc Bảo", "0913456006", "56 Dã Tượng, Vĩnh Nguyên, Nha Trang", "VINH_NGUYEN", Decimal("12.218700"), Decimal("109.201200")),
            ("Bùi Thị Nga", "0913456007", "89 Lê Hồng Phong, Phước Hải, Nha Trang", "PHUOC_HAI", Decimal("12.237600"), Decimal("109.184300")),
            ("Hoàng Minh Trí", "0913456008", "12 Củ Chi, Vĩnh Hải, Nha Trang", "VINH_HAI", Decimal("12.285400"), Decimal("109.199500")),
            ("Trịnh Thị Vân", "0913456009", "34 Tô Hiến Thành, Tân Lập, Nha Trang", "TAN_LAP", Decimal("12.232100"), Decimal("109.193800")),
            ("Mai Văn Sang", "0913456010", "67 Trần Quý Cáp, Phương Sài, Nha Trang", "PHUONG_SAI", Decimal("12.250500"), Decimal("109.182900")),
            ("Phạm Thị Bích", "0913456011", "90 Pasteur, Xương Huân, Nha Trang", "XUONG_HUAN", Decimal("12.257000"), Decimal("109.194500")),
            ("Đỗ Hoàng Long", "0913456012", "15 Thái Nguyên, Phương Sài, Nha Trang", "PHUONG_SAI", Decimal("12.248200"), Decimal("109.186000")),
            ("Nguyễn Thị Diệu", "0913456013", "48 Yersin, Phương Sài, Nha Trang", "PHUONG_SAI", Decimal("12.249800"), Decimal("109.189100")),
            ("Lý Thành Trung", "0913456014", "71 Bạch Đằng, Tân Lập, Nha Trang", "TAN_LAP", Decimal("12.234500"), Decimal("109.191000")),
            ("Vũ Thị Thảo", "0913456015", "94 Hoàng Hoa Thám, Lộc Thọ, Nha Trang", "LOC_THO", Decimal("12.246700"), Decimal("109.196200")),
            ("Hồ Văn Vinh", "0913456016", "27 Ngô Gia Tự, Tân Lập, Nha Trang", "TAN_LAP", Decimal("12.235900"), Decimal("109.189900")),
            ("Chu Thị Hằng", "0913456017", "50 Nguyễn Thiện Thuật, Tân Lập, Nha Trang", "TAN_LAP", Decimal("12.238000"), Decimal("109.194800")),
            ("Tạ Đình Phong", "0913456018", "83 Đặng Tất, Vĩnh Hải, Nha Trang", "VINH_HAI", Decimal("12.289000"), Decimal("109.201000")),
            ("Lương Thị Yến", "0913456019", "16 Mai Xuân Thưởng, Vĩnh Hải, Nha Trang", "VINH_HAI", Decimal("12.282000"), Decimal("109.197000")),
            ("Vương Quốc Cường", "0913456020", "39 Đoàn Trần Nghiệp, Vĩnh Phước, Nha Trang", "VINH_PHUOC", Decimal("12.274000"), Decimal("109.195000")),
        ]

        customers_list = []
        for i, (c_name, phone, addr, dist, lat, lon) in enumerate(customer_names):
            u = User(
                role_id=roles_dict["CUSTOMER"].role_id,
                username=f"cust{i+1}",
                email=f"cust{i+1}@gmail.com",
                password_hash=default_pwd,
                status="active"
            )
            db.add(u)
            db.flush()

            cust = Customer(
                user_id=u.user_id,
                full_name=c_name,
                phone=phone,
                date_of_birth=date(1950 + (i * 2) % 45, (i % 12) + 1, (i % 25) + 1),
                address=addr,
                lat=lat,
                lon=lon,
                emergency_contact=f"Người nhà {c_name} - 09876543{i:02d}",
                status="active"
            )
            db.add(cust)
            db.flush()
            customers_list.append(cust)

        # ----------------------------------------------------
        # 7. TRAVEL MATRIX (Khoảng cách & phút di chuyển mẫu)
        # ----------------------------------------------------
        print("7. Seeding Travel Matrix...")
        # Tạo ma trận di chuyển giữa các địa điểm (thực tế 5 - 25 phút di chuyển trong Nha Trang)
        travel_records = []
        all_points = [emp.employee_id for emp in employees_list] + [cust.customer_id for cust in customers_list]
        for f_id in all_points[:15]:
            for t_id in all_points[:15]:
                if f_id == t_id:
                    continue
                # Giả lập khoảng cách dựa vào chênh lệch ID có nhiễu
                dist = Decimal(f"{round(abs(f_id - t_id) * 0.8 + 1.2, 2)}")
                travel_mins = int(dist * Decimal("2.5")) + 3  # Khoảng 5 - 25 phút
                travel_records.append(TravelMatrix(
                    from_id=f_id,
                    to_id=t_id,
                    distance_km=dist,
                    travel_minutes=travel_mins,
                    source="Haversine_Urban_Speed_25kmh"
                ))
        db.add_all(travel_records)
        db.flush()

        # ----------------------------------------------------
        # 8. AI MODEL VERSION (Baseline Model Registry)
        # ----------------------------------------------------
        print("8. Seeding AI Model Registry (duration_prediction v1.0.0)...")
        ai_model = AIModelVersion(
            task="duration_prediction",
            algorithm="RidgeRegression_Baseline",
            version="v1.0.0",
            feature_schema_json={
                "features": [
                    {"name": "service_id", "type": "categorical"},
                    {"name": "default_duration", "type": "integer"},
                    {"name": "complexity_level", "type": "integer"},
                    {"name": "has_special_equip", "type": "boolean"},
                    {"name": "priority", "type": "integer"},
                    {"name": "district_code", "type": "categorical"},
                    {"name": "preferred_start_hour", "type": "integer"},
                    {"name": "day_of_week", "type": "integer"}
                ]
            },
            metrics_json={
                "mae": 6.85,
                "rmse": 8.42,
                "r2": 0.725
            },
            artifact_path="artifacts/models/duration_model_v1.joblib",
            trained_at=datetime.now(timezone.utc),
            active=True
        )
        db.add(ai_model)
        db.flush()

        # ----------------------------------------------------
        # 9. SERVICE REQUESTS, AI PREDICTIONS & ASSIGNMENTS
        # ----------------------------------------------------
        print("9. Seeding Service Requests, Predictions, and Historical Completed Assignments...")
        service_keys = list(services_dict.keys())
        districts = ["LOC_THO", "PHUOC_TIEN", "VAN_THANH", "VINH_PHUOC", "TAN_LAP"]

        # Sinh 20 yêu cầu lịch sử (đã hoàn tất) và 5 yêu cầu mới (chờ xếp lịch)
        for i in range(25):
            cust = customers_list[i % len(customers_list)]
            s_code = service_keys[i % len(service_keys)]
            srv = services_dict[s_code]

            # 20 yêu cầu trong quá khứ (-10 ngày đến -1 ngày)
            if i < 20:
                req_day = today - timedelta(days=(20 - i) % 10 + 1)
                req_status = "completed"
            else:
                # 5 yêu cầu cho ngày mai (+1 ngày)
                req_day = today + timedelta(days=1)
                req_status = "pending"

            hour = 8 + (i % 4) * 2  # 8:00, 10:00, 14:00, 16:00
            pref_start = datetime(req_day.year, req_day.month, req_day.day, hour, 0, tzinfo=timezone.utc)
            pref_end = pref_start + timedelta(hours=2)

            sr = ServiceRequest(
                customer_id=cust.customer_id,
                service_id=srv.service_id,
                preferred_start=pref_start,
                preferred_end=pref_end,
                address=cust.address or "Nha Trang, Khánh Hòa",
                lat=cust.lat,
                lon=cust.lon,
                district_code=districts[i % len(districts)],
                complexity_level=(i % 3) + 1,
                has_special_equip=(i % 4 == 0),
                priority=(i % 3) + 1,
                status=req_status
            )
            db.add(sr)
            db.flush()

            # Dự đoán thời lượng từ mô hình AI
            # Nhiễu giả lập có căn cứ: thời lượng thực = default_duration * (0.9 đến 1.2) + complexity * 5
            predicted_dur = int(srv.default_duration * (1 + (sr.complexity_level - 1) * 0.15))
            pred = AIPrediction(
                request_id=sr.request_id,
                model_id=ai_model.model_id,
                predicted_duration=predicted_dur,
                prediction_meta_json={
                    "model_version": "v1.0.0",
                    "complexity_factor": sr.complexity_level,
                    "confidence_score": 0.92
                }
            )
            db.add(pred)
            db.flush()

            # Đối với 20 yêu cầu lịch sử: tạo Assignment, ServiceResult (actual_duration) và Rating
            if i < 20:
                emp = employees_list[i % len(employees_list)]
                sch_start = pref_start
                sch_end = sch_start + timedelta(minutes=predicted_dur)

                assign = Assignment(
                    request_id=sr.request_id,
                    employee_id=emp.employee_id,
                    prediction_id=pred.prediction_id,
                    scheduled_start=sch_start,
                    scheduled_end=sch_end,
                    assignment_status="completed",
                    recommendation_score=Decimal("0.8750"),
                    explanation=f"Nhân viên {emp.full_name} phù hợp 100% kỹ năng, khoảng cách 2.5km.",
                    confirmed_by=coord_user1.user_id,
                    confirmed_at=sch_start - timedelta(hours=12)
                )
                db.add(assign)
                db.flush()

                # Kết quả thực tế phục vụ huấn luyện ML
                # actual_duration = actual_end - actual_start (có độ lệch so với predicted khoảng -5 đến +10 phút)
                duration_noise = random.randint(-5, 10)
                actual_dur = max(20, predicted_dur + duration_noise)
                act_start = sch_start + timedelta(minutes=random.randint(-5, 5))
                act_end = act_start + timedelta(minutes=actual_dur)

                sr_result = ServiceResult(
                    assignment_id=assign.assignment_id,
                    actual_start=act_start,
                    actual_end=act_end,
                    actual_duration=actual_dur,  # TARGET ML
                    status_outcome="successful",
                    travel_minutes=12,
                    outcome="Bệnh nhân cải thiện tốt, không có biến chứng sau chăm sóc.",
                    notes="Hoàn thành đúng kỹ thuật và an toàn y tế."
                )
                db.add(sr_result)

                # Khách hàng đánh giá (score 4 - 5 sao)
                db.add(Rating(
                    assignment_id=assign.assignment_id,
                    score=random.choice([4, 5]),
                    comment="Nhân viên rất tận tâm, chuyên môn tốt và đúng giờ."
                ))

        db.commit()
        print("SEEDING COMPLETED SUCCESSFULLY!")
        print(f"Summary:")
        print(f"  - 5 Roles & 8 Permissions")
        print(f"  - 4 Administrative/Coordination Users")
        print(f"  - 10 Employees with skills & 14-day availability")
        print(f"  - 20 Customers in Nha Trang")
        print(f"  - 5 Services & 10 Skills")
        print(f"  - 25 Service Requests & AI Predictions")
        print(f"  - 20 Completed Assignments with actual_duration & Ratings")
        return True

    except Exception as e:
        db.rollback()
        print(f"ERROR DURING SEEDING: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_database()
    sys.exit(0 if success else 1)
