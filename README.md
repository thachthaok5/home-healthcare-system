# HOME HEALTHCARE MANAGEMENT SYSTEM (HỆ THỐNG THÔNG TIN QUẢN LÝ DỊCH VỤ CHĂM SÓC SỨC KHỎE TẠI NHÀ)

**Đồ án tốt nghiệp Đại học ngành Hệ thống thông tin quản lý (MIS)**  
**Sinh viên thực hiện:** Nguyễn Thạch Thảo – Lớp 65.TTQL_1  
**Đề tài:** Nghiên cứu và thiết kế hệ thống thông tin quản lý dịch vụ chăm sóc sức khỏe tại nhà tích hợp AI hỗ trợ lập lịch và điều phối nhân sự y tế.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN ĐÃ ĐƯỢC CHUẨN HÓA

```text
DOAN/
├── docs/                               # Toàn bộ tài liệu văn bản, đặc tả và bản vẽ thiết kế
│   ├── huong_dan/                      # Hướng dẫn chi tiết từ Giảng viên hướng dẫn
│   │   ├── Huong_dan_Do_an_Nguyen_Thach_Thao.docx  # Hướng dẫn khung 19 mục toàn diện
│   │   └── Thao_HuongDan_TienDo_Dot2.docx          # Nhận xét & checklist chuẩn hóa đợt 2
│   ├── proposals/                      # Đề cương, Data Plan, Data Dictionary, State Transitions
│   │   ├── proposal.docx / proposal.pdf
│   │   ├── data_dictionary_erd_v2.docx
│   │   ├── data_plan_v2_standard.docx
│   │   ├── state_transition_table_v2.docx
│   │   └── Thesis_V2_1_Synchronized_Data_Plan_Dictionary_State_Transitions.xlsx
│   └── diagrams/                       # Các sơ đồ thiết kế kiến trúc hệ thống
│       ├── drawio/                     # Bản vẽ Draw.io gốc (mở trên app.diagrams.net)
│       │   ├── Activity_Diagram_Home_Healthcare_MIS.drawio    (Activity Diagram v3)
│       │   ├── ERD_Home_Healthcare_MIS_v2.drawio              (ERD v2 - 23 bảng PlantUML)
│       │   ├── Activity_Diagram_Home_Healthcare_MIS_v1.drawio (Activity Diagram v1)
│       │   └── ERD_Initial_8_Tables.drawio                    (ERD v1 - 8 bảng ban đầu)
│       └── images/                     # Ảnh sơ đồ xuất ra & Bản trình bày giao diện
│           ├── Activity_Diagram_Home_Healthcare_MIS.drawio.png
│           ├── ERD_Home_Healthcare_MIS_v2.drawio.png
│           ├── Ban_trinh_bay_Giao_dien.pdf
│           ├── ERD.png
│           ├── MAU.png
│           └── b4b93807-b974-4369-b7a0-b03e54d24e77.png
├── backend/                            # Mã nguồn ứng dụng Backend (FastAPI + SQLAlchemy + AI)
│   ├── app/                            # Ứng dụng chính (core, db, models, api, services, ai)
│   ├── alembic/                        # Database migration scripts
│   ├── scripts/                        # seed_database.py, build_duration_dataset.py
│   ├── tests/                          # Unit tests & constraint verification
│   ├── venv/                           # Môi trường ảo Python
│   ├── .env                            # Cấu hình môi trường kết nối CSDL cục bộ
│   ├── .env.example                    # File mẫu cấu hình
│   ├── requirements.txt                # Thư viện phụ thuộc
│   └── alembic.ini                     # Cấu hình Alembic
└── installers/                         # Các phần mềm phụ trợ cài đặt
    ├── postgresql_14.exe
    └── Antigravity-x64.exe
```

---

## 🛠️ CÔNG NGHỆ CHÍNH ĐANG SỬ DỤNG

- **Hệ quản trị CSDL:** PostgreSQL 18 (Cổng 5432, Database: `home_healthcare_db`).
- **Backend:** Python 3.13 + FastAPI.
- **ORM & Driver:** SQLAlchemy 2.x + Psycopg 3 (`psycopg[binary]`).
- **Database Migrations:** Alembic.
- **AI Regression:** scikit-learn (Ridge, Random Forest, HistGradientBoosting) + joblib.
- **Tối ưu hóa Lập lịch & Điều phối:** Google OR-Tools CP-SAT Solver.
