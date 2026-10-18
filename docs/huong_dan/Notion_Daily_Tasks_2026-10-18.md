# 📅 NOTION DAILY TASK LOG – NGÀY 18/10/2026
## CHỦ ĐỀ: HIỆU CHỈNH TOÀN DIỆN VÀ MỞ RỘNG THỰC NGHIỆM THEO FEEDBACK ĐỢT 2 (LẦN 3)

- **Dự án:** Hệ thống Quản lý và Điều phối Dịch vụ Chăm sóc Y tế tại Nhà (Home Healthcare MIS)
- **Sinh viên thực hiện:** Nguyễn Thạch Thảo (Lớp 65.TTQL_1)
- **Giảng viên hướng dẫn:** TS. Trịnh Thị Ngọc Thúy
- **Ngày thực hiện:** 18/10/2026
- **Tài liệu căn cứ:** `docs/huong_dan/feedback_dot2_lan3.docx` (và `feedback_dot2_lan3.md`)
- **Mục tiêu trong ngày:** Đồng bộ 100% số liệu giữa báo cáo, mã nguồn và model registry; tích hợp OSRM routing; mở rộng Stress Test & kiểm chứng lịch trình bằng Actual Duration; hoàn thiện cơ chế Human-in-the-loop.

---

## 📌 BẢNG QUẢN LÝ TASK CHI TIẾT TRÊN NOTION (DATABASE VIEW)

| Mã Task | Tên công việc (Task Name) | Phân loại (Category) | Mức độ ưu tiên | Trạng thái (Status) | Người thực hiện | Căn cứ Feedback GVHD |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| **TASK-01** | Rà soát và thống nhất số liệu mô hình AI (Random Forest v1.1.0) | AI / Data Science | P1 - Urgent | 🟢 Done | Mục 1: Thống nhất mô hình AI |
| **TASK-02** | Đồng bộ số lượng test case tự động (29/29 tests passed) | Quality Assurance | P1 - Urgent | 🟢 Done | Mục 2: Chuẩn hóa số lượng test case |
| **TASK-03** | Đính chính thuật ngữ nguồn gốc dữ liệu 800 mẫu (Synthetic Dataset) | Documentation | P1 - Urgent | 🟢 Done | Mục 5: Nguồn gốc tập dữ liệu |
| **TASK-04** | Tiết chế kết luận học thuật trong Ablation Study | Academic Writing | P1 - Urgent | 🟢 Done | Mục 3: Tiết chế kết luận |
| **TASK-05** | Tích hợp công cụ định tuyến OSRM / OpenStreetMap | Scheduling Engine | P2 - High | 🟢 Done | Mục 4 & Mục 8: Bước 4 OSRM |
| **TASK-06** | Mở rộng Benchmark & Stress Test (10, 25, 50, 100, 150 req x 5 seeds) | Experiments | P1 - Urgent | 🟢 Done | Mục 4: Stress test nhiều mức tải |
| **TASK-07** | Đánh giá kiểm chứng lịch trình bằng Actual Duration | Experiments | P1 - Urgent | 🟢 Done | Mục 4: Đo ca trễ và overlap thực tế |
| **TASK-08** | Phân tích độ nhạy trọng số DSS (Sensitivity Analysis) | Decision Support | P2 - High | 🟢 Done | Mục 8: Thí nghiệm độ nhạy DSS |
| **TASK-09** | Thiết kế API & Schema cho Human-in-the-loop (Override Dropdown) | Backend / API | P2 - High | 🟢 Done | Mục 6: Chuẩn hóa cơ chế Override |
| **TASK-10** | Cập nhật file Word Báo cáo tiến độ hoàn chỉnh (`generate_word_report.py`) | Deliverables | P1 - Urgent | 🟢 Done | Mục 8: Báo cáo Word hoàn chỉnh |

---

## 📝 MÔ TẢ CHI TIẾT TỪNG TASK (NOTION CARD DETAILS)

### 🔹 TASK-01: Rà soát và thống nhất mô hình AI được chọn
* **Mục tiêu:** Xử lý triệt để sự mâu thuẫn giữa số liệu tóm tắt và bảng chi tiết mà cô Thúy đã chỉ ra trong tài liệu góp ý.
* **Chi tiết công việc:**
  1. Kiểm tra bảng `ai_model_versions` trong CSDL PostgreSQL 18 và file artifact `artifacts/models/duration_model_v1.joblib`: Xác nhận mô hình active là **Random Forest (Version v1.1.0)**.
  2. Chốt bảng kết quả AI chuẩn duy nhất:
     * Baseline 1 (Default Duration): MAE = **12.33 phút**, RMSE = **15.97 phút**, R² = **0.5468**.
     * Baseline 2 (Service Mean): MAE = **8.11 phút**, RMSE = **10.16 phút**, R² = **0.8164**.
     * Ridge Regression: MAE = **5.03 phút**, RMSE = **6.25 phút**, R² = **0.9306**.
     * **Random Forest (Chọn):** MAE = **4.71 phút**, RMSE = **6.11 phút**, R² = **0.9337**.
     * HistGradientBoosting: MAE = **4.75 phút**, RMSE = **6.07 phút**, R² = **0.9344**.
  3. Mức giảm sai số chuẩn xác: `(12.33 - 4.71) / 12.33 = 61.8%`.
  4. Loại bỏ hoàn toàn số cũ: MAE = 4.43p và mức giảm 67.1%.
* **Sản phẩm đầu ra:** Bảng số liệu AI đồng nhất trên toàn bộ codebase và báo cáo.

---

### 🔹 TASK-02: Chuẩn hóa số lượng test case tự động
* **Mục tiêu:** Chấm dứt sự không khớp giữa các đoạn ghi 24 tests và 25 tests trong báo cáo tiến độ.
* **Chi tiết công việc:**
  1. Chạy hồi quy toàn bộ test suite trên pytest trong môi trường ảo backend.
  2. Bộ test gốc gồm 24 test functions (`test_ai`, `test_api`, `test_constraints`, `test_end_to_end_flow`, `test_scheduling`).
  3. Bổ sung thêm 5 bài kiểm thử cho module OSRM trong `tests/test_routing.py`.
  4. Ghi nhận tổng kết quả thực tế mới nhất: **29/29 tests passed (100%)**.
* **Sản phẩm đầu ra:** Cập nhật số liệu 29 tests passed vào báo cáo Word và log kiểm thử.

---

### 🔹 TASK-03: Đính chính thuật ngữ nguồn gốc tập dữ liệu 800 mẫu
* **Mục tiêu:** Đảm bảo tính minh bạch học thuật theo đúng yêu cầu của GVHD.
* **Chi tiết công việc:**
  1. Rà soát file sinh dữ liệu `backend/scripts/build_duration_dataset.py`.
  2. Thay thế toàn bộ cụm từ *"dữ liệu thực tế"* bằng cụm từ chuẩn:
     > *"Bộ dữ liệu tổng hợp (synthetic dataset) gồm 800 mẫu được sinh theo kịch bản mô phỏng bám sát phân phối dịch vụ, độ phức tạp bệnh nhân và địa bàn 10 phường tại TP. Nha Trang (random seed = 42, công thức thời lượng ground-truth có nhiễu Gaussian)."*
* **Sản phẩm đầu ra:** Khái niệm chuẩn mực, không gây hiểu lầm với hội đồng bảo vệ.

---

### 🔹 TASK-04: Điều chỉnh văn phong & Tiết chế kết luận Ablation Study
* **Mục tiêu:** Tránh các khẳng định phóng đại không được dữ liệu hỗ trợ.
* **Chi tiết công việc:**
  1. Rà soát lại các kết luận về AI và giải thuật lập lịch.
  2. Bỏ các khẳng định *"AI triệt tiêu nguy cơ trễ hẹn dây chuyền"* hoặc *"chắc chắn tạo lịch tốt hơn ở mọi khía cạnh"*.
  3. Viết lại đúng mức độ khoa học: AI giảm 61.8% sai số ước tính thời lượng; ở quy mô tải nhỏ các thuật toán có kết quả phân công tương tự nhau do ràng buộc chưa bão hòa; hiệu quả thực tế cần kiểm chứng qua Stress Test và Actual Duration.
* **Sản phẩm đầu ra:** Bản luận giải học thuật khách quan, thuyết phục.

---

### 🔹 TASK-05: Tích hợp OSRM / OpenStreetMap Routing Engine
* **Mục tiêu:** Thay thế công thức Haversine đường chim bay với vận tốc xe máy cố định 25 km/h bằng khoảng cách và thời gian di chuyển theo tuyến đường thực tế.
* **Chi tiết công việc:**
  1. Xây dựng module `backend/app/ai/routing.py` tích hợp OSRM API thực tế.
  2. Cài đặt hệ thống bộ nhớ đệm (Cache) trên RAM và JSON file `artifacts/data/routing_cache.json`.
  3. Xây dựng cơ chế Safe Fallback về công thức Haversine đô thị Nha Trang khi mất mạng hoặc timeout (2s).
  4. Tích hợp trực tiếp vào `SchedulingEngine.calculate_distance_and_travel`.
  5. Viết 5 unit tests trong `tests/test_routing.py` (kiểm tra tọa độ Nha Trang, cache, điểm trùng, lỗi tọa độ, fallback).
* **Sản phẩm đầu ra:** `app/ai/routing.py` và `tests/test_routing.py` hoạt động hoàn hảo.

---

### 🔹 TASK-06: Mở rộng Benchmark & Stress Test (Nhiều mức tải x Nhiều seed)
* **Mục tiêu:** Đánh giá khả năng đáp ứng và bộc lộ sự khác biệt giữa các giải thuật lập lịch khi tải tăng cao.
* **Chi tiết công việc:**
  1. Thiết lập 4 mức tải:
     * Nhỏ: **10 requests/ngày**
     * Trung bình: **25 requests/ngày**
     * Lớn: **50 requests/ngày**
     * Rất lớn: **100 requests/ngày**
  2. Chạy trên **5 random seeds** (42, 101, 202, 303, 404) -> 20 tập dữ liệu thực nghiệm chuẩn.
  3. Đánh giá đối sánh 3 giải thuật:
     * **Nearest Feasible:** Heuristic cục bộ ưu tiên khoảng cách.
     * **Weighted DSS:** Heuristic tham lam theo điểm đa tiêu chí DSS.
     * **Google OR-Tools CP-SAT:** Tối ưu hóa toàn cục với ràng buộc di chuyển.
  4. Thu thập 8 chỉ số quản trị: Feasible rate, Unassigned count, Total travel distance, Mean travel time, Overtime, Workload imbalance (std dev), DSS score, Solver runtime.
  5. Báo cáo kết quả theo định dạng `mean ± std`.
* **Sản phẩm đầu ra:** `stress_test_benchmark_results.csv` và `stress_test_summary_mean_std.csv`.

---

### 🔹 TASK-07: Đánh giá lịch trình bằng Actual Duration (Ground-truth Verification)
* **Mục tiêu:** Cung cấp bằng chứng định lượng quan trọng nhất chứng minh giá trị thực sự của AI đối với bài toán lập lịch.
* **Chi tiết công việc:**
  1. Lập 2 phương án lịch trên cùng một bài toán:
     * **Phương án A (Default Duration):** Sử dụng thời lượng định mức của dịch vụ.
     * **Phương án B (AI Predicted Duration):** Sử dụng thời lượng do Random Forest dự đoán.
  2. Đưa cùng giá trị `actual_duration` (thời lượng thực tế) vào mô phỏng thực thi tuần tự cho từng nhân viên.
  3. Đo lường và so sánh 5 chỉ số then chốt:
     * **Actual overlap count:** Số ca bị chồng lấn thời gian thực tế.
     * **Late-start count:** Số ca bắt đầu trễ so với giờ hẹn.
     * **Total delay minutes:** Tổng số phút trễ phát sinh.
     * **Maximum delay:** Độ trễ lớn nhất của một ca bệnh.
     * **Actual feasible rate:** Tỷ lệ ca bệnh hoàn thành mà không bị trễ nghiêm trọng (trễ $\le$ 15 phút).
* **Sản phẩm đầu ra:** `actual_duration_evaluation_results.csv` và `actual_duration_summary_mean_std.csv`.

---

### 🔹 TASK-08: Phân tích độ nhạy của trọng số DSS (Sensitivity Analysis)
* **Mục tiêu:** Chứng minh tính vững (robustness) và giải thích tính hợp lý của bộ trọng số DSS cơ sở.
* **Chi tiết công việc:**
  1. Nâng cấp `SchedulingEngine` hỗ trợ nhận tham số trọng số động.
  2. Thực nghiệm trên 6 kịch bản trọng số:
     * Kịch bản 1 (Cơ sở): 0.30 Skill / 0.25 Time / 0.20 Dist / 0.15 Workload / 0.10 Continuity.
     * Kịch bản 2 (Ưu tiên Kỹ năng): 0.35 / 0.20 / 0.20 / 0.15 / 0.10.
     * Kịch bản 3 (Ưu tiên Thời gian): 0.25 / 0.30 / 0.20 / 0.15 / 0.10.
     * Kịch bản 4 (Ưu tiên Khoảng cách): 0.25 / 0.20 / 0.30 / 0.15 / 0.10.
     * Kịch bản 5 (Ưu tiên Cân bằng tải): 0.25 / 0.20 / 0.15 / 0.30 / 0.10.
     * Kịch bản 6 (Ưu tiên Tính liên tục): 0.25 / 0.20 / 0.15 / 0.10 / 0.30.
  3. Theo dõi sự biến thiên của DSS score, quãng đường di chuyển và độ lệch tải giữa các kịch bản.
* **Sản phẩm đầu ra:** `dss_sensitivity_analysis_results.csv` và `dss_sensitivity_summary.csv`.

---

### 🔹 TASK-09: Chuẩn hóa API & Schema cho Human-in-the-loop (Điều phối viên Override)
* **Mục tiêu:** Xây dựng cơ chế can thiệp của con người kết hợp danh mục chuẩn hóa và ghi chú tự do.
* **Chi tiết công việc:**
  1. Bổ sung Schema Pydantic cho dữ liệu Override:
     * Dropdown Enum mã lý do chuẩn:
       - `distance`: Vị trí di chuyển thuận tiện hơn
       - `skill`: Trình độ chuyên môn phù hợp hơn
       - `customer_request`: Khách hàng quen chỉ định đích danh
       - `time_constraint`: Ràng buộc thời gian đột xuất của nhân viên
       - `workload_balance`: Cân bằng khối lượng công việc nội bộ
       - `other`: Yêu cầu đặc biệt khác
     * Ô nhập ghi chú tự do: `override_notes` (Text).
  2. Lưu vết thông tin vào `Assignment.override_reason` và bảng `RecommendationLog` phục vụ thống kê tỷ lệ can thiệp của con người trong luận văn.
* **Sản phẩm đầu ra:** Endpoint `/api/v1/assignments/{id}/override` chuẩn RESTful.

---

### 🔹 TASK-10: Cập nhật file Word Báo cáo tiến độ chính thức
* **Mục tiêu:** Xuất bản tài liệu Word báo cáo đồ án Đợt 2 phiên bản hoàn thiện nhất nộp GVHD.
* **Chi tiết công việc:**
  1. Cập nhật script `docs/generate_word_report.py`:
     * Đưa bảng kết quả AI chuẩn (Random Forest 4.71p, giảm 61.8%).
     * Đưa bảng Stress Test tổng hợp `mean ± std`.
     * Đưa bảng đánh giá kiểm chứng lịch bằng Actual Duration.
     * Đưa bảng phân tích độ nhạy trọng số DSS.
     * Đính chính số lượng test: 29/29 tests passed.
     * Đính chính thuật ngữ *Synthetic Dataset*.
  2. Sinh file Word `docs/Bao_cao_Tien_do_Dot_2_Nguyen_Thach_Thao.docx` hoàn chỉnh.
* **Sản phẩm đầu ra:** File báo cáo Word hoàn thiện, số liệu khớp 100% với mã nguồn và CSDL.
