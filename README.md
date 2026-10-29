# HỆ THỐNG THÔNG TIN QUẢN LÝ DỊCH VỤ CHĂM SÓC SỨC KHỎE TẠI NHÀ TÍCH HỢP AI & OR-TOOLS (CAREFLOW / HOME HEALTHCARE DISPATCH SYSTEM)

**Đồ án tốt nghiệp Đại học ngành Hệ thống Thông tin Quản lý (MIS)**  
* **Sinh viên thực hiện:** Nguyễn Thạch Thảo – Lớp 65.TTQL_1
* **Giảng viên hướng dẫn:** TS. Trần Thị Thúy
* **Địa bàn nghiên cứu & ứng dụng:** Thành phố Nha Trang, Tỉnh Khánh Hòa
* **Phiên bản mã nguồn:** v2.1 (Đợt 2 - Lần 4)

---

## 📌 GIỚI THIỆU TỔNG QUAN

Dự án phát triển Hệ thống Thông tin Quản lý và Điều phối Y tế tại nhà (*Home Healthcare Dispatch & AI Scheduling System*), giải quyết bài toán cốt lõi:
1. **Dự báo thời lượng ca khám thực tế (AI Actual Duration Prediction):** Sử dụng mô hình học máy **Random Forest Regressor** (MAE ~4.39 phút, $R^2 = 0.943$) để thay thế định mức cố định, hạn chế tình trạng trễ dây chuyền (*cascading delay*).
2. **Hệ thống hỗ trợ ra quyết định phân công nhân sự (Explainable DSS):** Lọc ứng viên qua **6 Ràng buộc Cứng (H1 – H6)** và xếp hạng đa mục tiêu 5 thành phần (Kỹ năng, Khung giờ hẹn, Khoảng cách di chuyển OSRM, Cân bằng tải làm việc, Tính liên tục phục vụ bệnh nhân quen).
3. **Tối ưu hóa lập lịch toàn ngày (OR-Tools CP-SAT VRPTW):** Bộ giải tối ưu hóa toàn cục giảm thiểu tổng thời gian di chuyển theo chuỗi hành trình Tour (Base $\rightarrow$ Ca 1 $\rightarrow$ ... $\rightarrow$ Base) và cân bằng tải làm việc giữa các điều dưỡng.
4. **Cơ chế can thiệp của con người (Human-in-the-Loop Override):** Chuẩn hóa 6 danh mục lý do điều phối viên có thể can thiệp thay đổi đề xuất của AI phục vụ kiểm toán lâm sàng.

---

## 🏗️ CÔNG NGHỆ CHÍNH

* **Backend:** Python 3.13 + FastAPI (Asynchronous RESTful API).
* **Database & ORM:** PostgreSQL 16/18 + SQLAlchemy 2.0 + Psycopg 3 (`psycopg[binary]`).
* **Machine Learning:** Scikit-learn (`RandomForestRegressor`, `HistGradientBoostingRegressor`) + Joblib.
* **Tối ưu hóa toán học:** Google OR-Tools (CP-SAT Solver).
* **Routing & Bản đồ:** OSRM Routing Engine (Nha Trang Land-bounds) + Leaflet interactive maps.
* **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + Ant Design.
* **CI/CD:** GitHub Actions (Automated Regression Testing với PostgreSQL Container).

---

## 📁 CẤU TRÚC THƯ MỤC CHUẨN HÓA

```text
DOAN/
├── .github/workflows/ci.yml           # Pipeline CI/CD tự động kiểm thử trên GitHub Actions
├── backend/                           # Mã nguồn Backend (FastAPI + AI + OR-Tools)
│   ├── app/
│   │   ├── ai/                        # routing.py (OSRM Tour), scheduling.py (OR-Tools CP-SAT)
│   │   ├── api/v1/                    # REST API endpoints (dss, assignments, schedule, kpis...)
│   │   ├── core/                      # config.py, security.py
│   │   ├── db/                        # session.py, base.py
│   │   ├── models/                    # 23 bảng SQLAlchemy (ORM Data Model chuẩn hóa)
│   │   └── schemas/                   # Pydantic Schemas (Request/Response models)
│   ├── artifacts/
│   │   ├── models/                    # File mô hình duration_model_v1.joblib
│   │   └── experiments/               # File CSV kết quả 155 lần chạy thực nghiệm khoa học
│   ├── scripts/                       # Các script độc lập: seed_database.py, verify_experiments.py...
│   ├── tests/                         # 33 unit & regression test cases (100% Passed)
│   └── requirements.txt               # Thư viện phụ thuộc Python
├── frontend/                          # Giao diện người dùng Web (React 19 + Vite + Tailwind)
│   ├── src/
│   │   ├── components/careflow/       # 5 Màn hình cốt lõi: Recommendations, Dispatch, Routes, Reports, Overview
│   │   ├── types/healthcare.ts        # TypeScript Type Definitions chuẩn y tế
│   │   └── App.tsx                    # Luồng điều hướng và State Management
│   ├── package.json                   # Thư viện phụ thuộc Node.js
│   ├── vite.config.ts                 # Cấu hình Vite Proxy sang cổng 8000
│   └── server.ts                      # Full-stack Development Server với Mock Data chuẩn Seed 42
├── docs/                              # Báo cáo Word tự động đồng bộ & Tài liệu thiết kế
│   ├── generate_word_report.py        # Script trích xuất CSV và tự động sinh Báo cáo Word
│   └── Bao_cao_Tien_do_Dot_2_Nguyen_Thach_Thao.docx
└── README.md                          # Hướng dẫn cài đặt và vận hành toàn bộ hệ thống
```

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY HỆ THỐNG

### 1. Yêu cầu Tiên quyết
* **Hệ điều hành:** Windows 10/11, macOS, hoặc Linux.
* **Python:** Phiên bản `3.13.x` (khuyến nghị 3.13.3).
* **Node.js:** Phiên bản `20.x` hoặc `22.x` (kèm npm 10+).
* **PostgreSQL:** Phiên bản 14 trở lên (khuyến nghị PostgreSQL 16/18).

---

### 2. Thiết lập Cơ sở dữ liệu PostgreSQL

1. Khởi động dịch vụ PostgreSQL trên máy tính của bạn (Cổng mặc định: `5432`).
2. Mở công cụ quản trị (pgAdmin hoặc `psql`) và tạo database mới:
   ```sql
   CREATE DATABASE home_healthcare_db;
   ```
3. Tạo file cấu hình môi trường `backend/.env` (hoặc sao chép từ `backend/.env.example`):
   ```env
   PROJECT_NAME="Home Healthcare Management System"
   API_V1_STR="/api/v1"
   POSTGRES_SERVER=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=password
   POSTGRES_DB=home_healthcare_db
   SECRET_KEY=supersecretjwtkey_homehealthcare_2026
   ```

---

### 3. Cài đặt & Khởi động Backend (FastAPI)

1. Mở cửa sổ dòng lệnh tại thư mục `backend`:
   ```powershell
   cd "d:\New folder\DOAN\backend"
   ```

2. Tạo và kích hoạt môi trường ảo Python (`venv`):
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. Cài đặt các thư viện cần thiết:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Khởi tạo dữ liệu hạt giống (Seed Database):**
   ```powershell
   python scripts/seed_database.py
   ```
   *(Script sẽ tự động tạo bảng, nạp 10 điều dưỡng Nha Trang, 20 khách hàng, 25 yêu cầu dịch vụ mẫu, đăng ký model AI v1.1.0 và ca trực)*

5. **Khởi chạy máy chủ Backend API:**
   ```powershell
   .\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
   ```
   * **API Base URL:** `http://localhost:8000`
   * **Swagger Interactive Docs:** `http://localhost:8000/docs`
   * **ReDoc:** `http://localhost:8000/redoc`

---

### 4. Cài đặt & Khởi động Frontend (React 19 + Vite)

Mở một cửa sổ dòng lệnh **mới** (Terminal 2) tại thư mục `frontend`:

```powershell
cd "d:\New folder\DOAN\frontend"
```

1. Cài đặt thư viện dependencies:
   ```powershell
   npm install --legacy-peer-deps
   ```

2. Khởi chạy máy chủ giao diện:
   ```powershell
   npm run dev
   ```
   *(Hoặc trên Windows PowerShell: `cmd /c npm run dev`)*

3. Mở trình duyệt web truy cập:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🖥️ TRẢI NGHIỆM 5 MÀN HÌNH CHÍNH THEO ĐẶC TẢ ĐỒ ÁN

### 1. Màn hình 1: Đề xuất AI & Giải trình DSS (`/recommendations`)
* **Khảo sát yêu cầu:** Chọn yêu cầu khám từ hàng đợi chờ duyệt (ví dụ: `REQ-201`, `REQ-202`...).
* **Kiểm định 6 Ràng buộc Cứng:** Xem banner kiểm chuẩn `✓ Thỏa mãn 6/6 Ràng buộc Cứng` (Kỹ năng, Khung giờ, Ca trực, Không trùng lịch, Đệm di chuyển OSRM, Trần tải 480 phút) hoặc bấm *"Xem chi tiết 6 điều kiện"*.
* **Phân rã điểm DSS:** Xem chi tiết 5 thành phần (SkillFit, TimeFit, Distance, Workload, Continuity) và thời lượng dự báo bởi AI (`predictedDurationMin`) so sánh với chuẩn.
* **Hành động Điều phối:**
  * Bấm **`✓ Chấp thuận Đề xuất này`**: Hệ thống chốt lịch và tự động chuyển sang Bảng Điều phối Gantt.
  * Bấm **`✎ Can thiệp / Đổi ứng viên (Override)`**: Mở modal chọn lý do can thiệp chuẩn hóa (Khoảng cách, Kỹ năng lâm sàng, Yêu cầu bệnh nhân, Cân bằng tải...).

### 2. Màn hình 2: Bảng Điều phối Dòng thời gian (`/dispatch`)
* **Trực quan hóa Dòng thời gian:** Dải giờ 07:00 – 19:00 theo từng nhân sự y tế.
* **Nhận diện Ca vừa phân công:** Ca khám vừa được xác nhận từ Màn hình 1 sẽ xuất hiện trên dòng thời gian với **viền xanh ngọc nhấp nháy (`ring-4 animate-pulse`)** kèm huy hiệu **`✨ Vừa xếp lịch`** và tự động mở bảng thông tin chi tiết bên phải.
* **Màu sắc Pastel y tế:** Phân biệt rõ ràng giữa ca Đã xác nhận (Xanh ngọc), ca Chờ duyệt (Kem hổ phách) và ca Trùng lịch (Hồng phấn cảnh báo).

### 3. Màn hình 3: Tối ưu hóa Lập lịch Hàng ngày OR-Tools (`/reports` $\rightarrow$ Tab Deep Dive)
* **Giải thuật CP-SAT:** Chạy bài toán *Global Staff-Assignment Optimization under Requested Service Times* với tùy chọn `allow_time_window=True`.
* **Thanh trượt Trọng số:** Tùy biến trọng số Đa mục tiêu (Quãng đường, Cân bằng tải, Bệnh nhân quen, Phạt SLA).
* **So sánh Trước / Sau:** Đối chiếu trực quan chỉ số giảm thời gian di chuyển, giải tỏa xung đột lịch và nút *Áp dụng Lịch tối ưu vào Gantt*.

### 4. Màn hình 4: Bản đồ Lộ trình Tour Nha Trang (`/routes`)
* **Bản đồ tương tác Leaflet:** Cố định tọa độ trên đất liền thuộc các phường trung tâm Nha Trang (Lộc Thọ, Tân Lập, Phước Hòa, Vĩnh Hải...).
* **Hành trình Tour:** Hiển thị chuỗi di chuyển khép kín của từng nhân viên: $\text{Trạm xuất phát (Base)} \rightarrow \text{Điểm dừng 1} \rightarrow \text{Điểm dừng 2} \rightarrow \dots \rightarrow \text{Base}$.

### 5. Màn hình 5: Tổng quan Vận hành & Báo cáo KPI (`/overview` & `/reports`)
* Tổng hợp 4 chỉ số KPI cốt lõi: Tỷ lệ khả thi (Feasibility Rate), Số ca chờ, Tổng thời gian di chuyển, Độ lệch chuẩn phân bổ tải ($\pm \sigma\%$).
* Nhật ký kiểm toán can thiệp của Điều phối viên (*Override Audit Trail*).

---

## 🧪 QUY TRÌNH CHẠY KIỂM THỬ & TÁI LẬP THỰC NGHIỆM

Hệ thống tuân thủ quy trình khoa học nghiêm ngặt: **Freeze Source $\rightarrow$ Seed Data $\rightarrow$ Chạy Thực nghiệm $\rightarrow$ Verify Assertions $\rightarrow$ Tự động sinh Báo cáo Word**.

### 1. Chạy Bộ Kiểm thử Hồi quy Toàn diện (Pytest)
```powershell
cd "d:\New folder\DOAN\backend"
.\venv\Scripts\python -m pytest tests/ -v
```
*Kết quả:* **33/33 tests passed 100%** (Gồm `test_ai.py`, `test_api.py`, `test_constraints.py`, `test_routing.py`, `test_scheduling.py`, `test_end_to_end_flow.py`).

### 2. Chạy Lại Toàn bộ Thực nghiệm Khoa học (155 Optimization Runs)
```powershell
cd "d:\New folder\DOAN\backend"

# 1. Stress Test 5 mức tải (10, 25, 50, 100, 150) qua 5 hạt giống ngẫu nhiên (75 runs)
.\venv\Scripts\python scripts/run_stress_test.py

# 2. Mô phỏng Thời lượng Thực tế Actual Duration (50 runs)
.\venv\Scripts\python scripts/run_actual_duration_simulation.py

# 3. Phân tích Độ nhạy DSS Sensitivity Analysis trên 6 kịch bản trọng số (30 runs)
.\venv\Scripts\python scripts/run_sensitivity_analysis.py

# 4. Thử nghiệm Độ bền vững AI Robustness Test trên 5 phân phối nhiễu
.\venv\Scripts\python scripts/run_ai_robustness_test.py
```

### 3. Xác thực Tính Nhất quán Dữ liệu (Strict Assertions)
```powershell
.\venv\Scripts\python scripts/verify_experiments.py
```
*(Script kiểm tra tính toàn vẹn, xác thực runtime $\le 8000$ms, overtime $= 0$, và đối chiếu tỷ lệ khả thi bằng các lệnh assert nghiêm ngặt)*.

### 4. Tự động Cập nhật Báo cáo Word Tiến độ Đợt 2
```powershell
cd "d:\New folder\DOAN\docs"
..\backend\venv\Scripts\python generate_word_report.py
```
*File xuất ra:* `docs/Bao_cao_Tien_do_Dot_2_Nguyen_Thach_Thao.docx` (Tự động điền 100% số liệu từ CSV, nhúng Git Commit SHA, danh sách seeds `[42, 101, 2024, 7777, 9999]`, Python 3.13.3, Model version v1.1.0 mà không chỉnh sửa thủ công).

---

## 👥 THÔNG TIN LIÊN HỆ & BẢN QUYỀN

* **Sinh viên:** Nguyễn Thạch Thảo (Email: `thachthao.k65@gmail.com` | GitHub: `thachthaok5`)
* **Đơn vị đào tạo:** Khoa Hệ thống Thông tin Kinh tế & Thương mại Điện tử – Trường Đại học Thương Mại (TMU)
* **Kho lưu trữ GitHub:** [home-healthcare-system](https://github.com/thachthaok5/home-healthcare-system.git)
