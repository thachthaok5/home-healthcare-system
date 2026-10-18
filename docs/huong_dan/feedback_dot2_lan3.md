# TỔNG HỢP VÀ PHÂN TÍCH FEEDBACK BÁO CÁO TIẾN ĐỘ ĐỢT 2 (LẦN 3)

- **Người hướng dẫn:** TS. Trịnh Thị Ngọc Thúy
- **Sinh viên thực hiện:** Nguyễn Thạch Thảo
- **Đề tài:** Hệ thống thông tin quản lý và hỗ trợ điều phối dịch vụ y tế tại nhà (Home Healthcare MIS)
- **Thời gian nhận phản hồi:** 17/10/2026 (21:00)
- **Tài liệu gốc:** `docs/huong_dan/feedback_dot2_lan3.docx`

---

## 📌 TỔNG QUAN ĐÁNH GIÁ TỪ GIẢNG VIÊN HƯỚNG DẪN

> *"Nhìn chung, kết quả thực hiện đợt này tốt và tiến độ khá nhanh... cô đánh giá phần lõi kỹ thuật của đề tài hiện đã đạt mức tốt và có thể chuyển sang giai đoạn hoàn thiện/thực nghiệm mở rộng. Việc quan trọng nhất lúc này không phải thêm nhiều thuật toán mới, mà là làm cho thực nghiệm đủ lớn, số liệu nhất quán và chứng minh rõ đóng góp của AI đối với bài toán lập lịch."*

---

## 🌟 PHẦN 1: NHỮNG GÌ SINH VIÊN ĐÃ LÀM ĐÚNG VÀ ĐƯỢC GHI NHẬN TÍCH CỰC

1. **Tiến độ triển khai nhanh và chất lượng lõi kỹ thuật tốt:**
   - Hoàn thành trọn vẹn chuỗi khép kín end-to-end (Database PostgreSQL -> Business Backend API -> Machine Learning Pipeline -> Decision Support System / Scheduling Engine -> Benchmark & Ablation Study).
   - Bộ mã nguồn backend, migration và cấu trúc quan hệ CSDL hoạt động chuẩn mực.

2. **Hiệu quả thực tế của mô hình dự báo thời lượng AI:**
   - Kết quả thực nghiệm chứng minh mô hình AI giúp giảm sai số dự báo thời lượng phục vụ đáng kể: từ **12.33 phút** (định mức cố định) xuống **4.71 phút** (Random Forest), tương đương giảm **61.8% sai số**.
   - Cô đánh giá đây là kết quả rất tốt và có giá trị thực tiễn cao cho đề tài.

3. **Chất lượng kiểm thử tự động (Unit Test / Integration Test):**
   - Đạt độ bao phủ kiểm thử tốt với **25/25 test cases passed** (kiểm thử hồi quy tự động các ràng buộc nghiệp vụ: phân bổ kỹ năng, khung giờ làm việc, trùng lịch, chuyển trạng thái vòng đời request...).

4. **Định hướng học thuật đúng đắn khi chủ động đề xuất Stress Test / Sensitivity Analysis:**
   - Cô Thúy hoàn toàn đồng ý và đánh giá cao đề xuất mở rộng thử nghiệm tải cao của sinh viên để làm rõ hơn ưu thế của thuật toán tối ưu toàn cục (OR-Tools CP-SAT) so với các heuristics cục bộ.

---

## ⚠️ PHẦN 2: NHỮNG ĐIỂM CẦN CHỈNH SỬA VÀ BỔ SUNG THEO FEEDBACK

Dưới đây là 8 nhóm vấn đề cần chỉnh sửa và hoàn thiện theo đúng tài liệu góp ý:

### 1. Thống nhất mô hình AI được chọn và toàn bộ số liệu liên quan
- **Vấn đề tồn tại:** 
  - Phần đầu báo cáo (Summary / Tóm tắt) ghi: `HistGradientBoosting đạt MAE 4.43 phút, R² = 0.920, giảm 67.1% sai số`.
  - Nhưng bảng chi tiết và phần sau báo cáo lại ghi: `Random Forest đạt MAE = 4.710, R² = 0.9337`, còn `HistGradientBoosting có MAE = 4.750, R² = 0.9344` và đánh dấu `Random Forest` là mô hình được chọn.
- **Yêu cầu chỉnh sửa:**
  - Kiểm tra lại file kết quả gốc (`backend/scripts/train_duration_models.py`, `duration_model_v1.joblib`, model registry trong DB).
  - Chọn **một bộ số liệu duy nhất** (`Random Forest: MAE = 4.710 phút, RMSE = 6.105 phút, R² = 0.9337, giảm 61.8% sai số`) để sử dụng xuyên suốt toàn bộ báo cáo, mã nguồn, registry và các bảng ablation.

### 2. Chuẩn hóa số lượng test case
- **Vấn đề tồn tại:** 
  - Một số đoạn đầu báo cáo ghi `24 tests`, trong khi phần kiểm thử chi tiết và log pytest ghi `25/25 tests passed`.
- **Yêu cầu chỉnh sửa:** 
  - Rà soát và đồng bộ toàn bộ báo cáo thành con số thực tế: **25 tests passed**.

### 3. Điều chỉnh văn phong & kết luận từ Ablation Study (Tránh khẳng định quá mức)
- **Vấn đề tồn tại:**
  - Báo cáo kết luận quá mạnh rằng AI *"triệt tiêu nguy cơ trễ hẹn dây chuyền"* hoặc *"chắc chắn làm lịch tốt hơn"*.
  - Tuy nhiên số liệu thực tế hiện tại cho thấy: Tỷ lệ khả thi vẫn giữ nguyên 80%, tổng quãng đường (3.64 km) và travel time (4.75 phút) không đổi, thậm chí độ lệch tải còn tăng từ 31.97 lên 34.05.
- **Yêu cầu chỉnh sửa:**
  - Viết trung thực, chuẩn mực khoa học: AI chỉ mới chứng minh được việc giảm mạnh sai số ước tính thời lượng (từ 12.33p xuống 4.71p), các chỉ số điều phối chưa có khác biệt rõ rệt ở bộ dữ liệu nhỏ hiện tại. Tuyệt đối không kết luận quá đà.

### 4. Bổ sung Stress Test / Sensitivity Analysis & Kiểm tra lịch bằng Actual Duration
- **Vấn đề tồn tại:**
  - Benchmark lập lịch hiện tại có quy mô quá nhỏ (5 request / 3 nhân viên), khiến Nearest Feasible, Weighted DSS và OR-Tools cho kết quả gần như giống hệt nhau (chỉ khác thời gian chạy ms), chưa thể hiện được sức mạnh tối ưu toàn cục.
- **Yêu cầu bổ sung (Ưu tiên số 1):**
  - **Quy mô thử nghiệm:** Tạo tối thiểu các mức tải **10, 25, 50, 100 request/ngày** (mở rộng lên 150–200 request nếu máy xử lý được).
  - **Phương pháp thực nghiệm:** Chạy trên **nhiều random seeds (ví dụ 5 seeds)**, báo cáo kết quả dưới dạng `mean ± std` cho các chỉ số:
    1. Feasible assignment rate (Tỷ lệ phân công thành công).
    2. Số lượng request không xếp được lịch (Unassigned count).
    3. Total / Mean travel time & distance.
    4. Overtime (Số phút làm thêm giờ ngoài ca).
    5. Workload imbalance (Độ lệch chuẩn khối lượng công việc giữa nhân viên).
    6. Điểm đánh giá DSS score.
    7. Thời gian giải thuật toán (Solver runtime).
  - **Đánh giá kiểm chứng bằng Actual Duration (Cực kỳ quan trọng):**
    - Lập 2 phương án lịch: (1) Lịch lập bằng `Default Duration` và (2) Lịch lập bằng `AI Predicted Duration`.
    - Sau đó đưa `Actual Duration` (thời lượng thực tế) vào cả 2 lịch trên để đo lường:
      - Số ca thực tế bị overlap / đè giờ.
      - Số ca bị bắt đầu trễ giờ hẹn.
      - Tổng số phút trễ hẹn phát sinh.
      - Tỷ lệ lịch trình vẫn còn khả thi sau khi thế thời lượng thực tế vào.
    - *Đây chính là bằng chứng định lượng thuyết phục nhất chứng minh giá trị của AI đối với bài toán điều phối.*

### 5. Chuẩn hóa thuật ngữ về nguồn gốc tập dữ liệu 800 mẫu
- **Vấn đề tồn tại:** Báo cáo dùng từ *"dữ liệu thực tế"* trong khi dữ liệu được sinh từ script mô phỏng.
- **Yêu cầu chỉnh sửa:**
  - Phải ghi chính xác là: **Synthetic dataset mô phỏng theo bối cảnh đô thị Nha Trang**.
  - Chỉ được dùng cụm từ "dữ liệu thực tế" nếu là số liệu thu thập trực tiếp từ phòng khám/cơ sở y tế có quy trình ẩn danh và cấp phép.

### 6. Chuẩn hóa giao diện & cơ chế Human-in-the-loop (Điều phối viên Override)
- **Yêu cầu thiết kế:**
  - Khi Coordinator can thiệp thay đổi đề xuất Top-1 của AI, hệ thống áp dụng cơ chế kết hợp: **Dropdown lý do chuẩn + Ô ghi chú tự do**.
  - Dropdown bao gồm các lý do chuẩn hóa:
    1. Khoảng cách địa lý / Vị trí di chuyển thuận tiện hơn.
    2. Kỹ năng / Trình độ chuyên môn phù hợp hơn với ca bệnh khó.
    3. Yêu cầu chỉ định đích danh từ khách hàng quen.
    4. Ràng buộc thời gian đột xuất của nhân viên.
    5. Cân bằng khối lượng công việc nội bộ.
    6. Yêu cầu đặc biệt khác (chọn mục "Khác" và nhập text vào ô ghi chú tự do).
  - Mục đích: Vừa tiện dụng cho thao tác, vừa lưu vết structured log để tính toán tỷ lệ override và thống kê nguyên nhân trong luận văn tốt nghiệp.

### 7. Thiết kế màn hình Dispatch Board (Bảng điều phối trung tâm)
- **Yêu cầu thiết kế:**
  - **Ưu tiên màn hình Timeline / Gantt Chart theo trục thời gian làm màn hình làm việc chính** của Coordinator:
    - Trục tung (hàng ngang): Danh sách nhân viên y tế trong ca.
    - Trục hoành: Dòng thời gian trong ngày (từ 07:00 đến 18:00).
    - Các ca phân công (assignments) hiển thị thành các khối màu (block) trực quan: Dễ dàng nhận biết khoảng trống ca (idle time), nguy cơ đè lịch (overlap) và trình tự di chuyển.
  - Có thể tích hợp thêm một thanh Kanban phụ bên góc để lọc nhanh các request theo trạng thái: `Unassigned` / `Proposed` / `Confirmed` / `Completed`, nhưng **không dùng Kanban thuần túy thay cho màn hình lịch chính**.

### 8. Lộ trình triển khai 6 bước & Phân tích độ nhạy (Sensitivity Analysis)
- **Lộ trình giai đoạn tiếp theo cần tuân thủ đúng thứ tự:**
  1. **Bước 1:** Chỉnh sửa và thống nhất toàn bộ số liệu AI / benchmark hiện tại trong báo cáo và codebase.
  2. **Bước 2:** Mở rộng benchmark + stress test nhiều mức tải (10, 25, 50, 100 req) và nhiều random seed (5 seeds).
  3. **Bước 3:** Bổ sung thực nghiệm đánh giá lịch bằng Actual Duration (đo ca overlap, số phút trễ).
  4. **Bước 4:** Tích hợp OSRM / OpenStreetMap routing API thay thế cho công thức Haversine tốc độ cố định 25 km/h để tính toán thời gian di chuyển sát thực tế.
  5. **Bước 5:** Xây dựng Frontend React, Dispatch Board dạng Timeline/Gantt, màn hình Recommendation/Override có tính giải thích (Explainable DSS: hiển thị SkillFit, TimeFit, Distance, Workload, Continuity, lý do loại trừ ứng viên).
  6. **Bước 6:** Chạy lại toàn bộ bộ thực nghiệm ở phiên bản hệ thống cố định để lấy bảng số liệu chính thức cho khóa luận tốt nghiệp.
- **Thực nghiệm độ nhạy DSS:** Bổ sung một Sensitivity Analysis nhỏ cho bộ trọng số DSS (thay đổi các cấu hình trọng số thay vì chỉ dùng một bộ cố định 0.30/0.25/0.20/0.15/0.10) để chứng minh tính vững (robustness) của thuật toán.

---

## 📋 MA TRẬN KẾ HOẠCH HÀNH ĐỘNG (ACTION PLAN TRACKING)

| STT | Đầu mục công việc | Phạm vi ảnh hưởng | Mức độ ưu tiên | Trạng thái |
|:---:|:---|:---|:---:|:---:|
| **1** | Thống nhất mô hình AI `Random Forest` (MAE=4.71, R²=0.9337, giảm 61.8%) và số lượng test cases (25 tests) | `docs/generate_word_report.py`, `Bao_cao_Tien_do_Dot_2...` | **P1 (Ngay lập tức)** | ⏳ Cần làm |
| **2** | Đính chính thuật ngữ: `Synthetic dataset mô phỏng Nha Trang` và tiết chế kết luận Ablation | Báo cáo tiến độ Word, README, scripts | **P1 (Ngay lập tức)** | ⏳ Cần làm |
| **3** | Xây dựng kịch bản Stress Test / Sensitivity Analysis (10, 25, 50, 100 requests x 5 seeds) | `backend/scripts/run_experiments.py`, `backend/app/ai/` | **P1 (Quan trọng)** | ⏳ Cần làm |
| **4** | Viết hàm đánh giá lịch bằng `Actual Duration` (đo số ca trễ, overlap, số phút vi phạm) | `backend/app/ai/evaluation.py`, `run_experiments.py` | **P1 (Quan trọng)** | ⏳ Cần làm |
| **5** | Bổ sung phân tích độ nhạy (Sensitivity Analysis) cho bộ trọng số DSS | `backend/scripts/run_experiments.py` | **P2 (Trung hạn)** | ⏳ Cần làm |
| **6** | Nghiên cứu tích hợp OSRM / OpenStreetMap cho module ma trận cự ly và thời gian di chuyển | `backend/app/ai/scheduling.py` | **P2 (Trung hạn)** | ⏳ Cần làm |
| **7** | Thiết kế API & Schema cho Human-in-the-loop: Enum lý do chuẩn + override note | `backend/app/schemas/assignment.py`, DB migrations | **P2 (Trung hạn)** | ⏳ Cần làm |
| **8** | Thiết kế Dispatch Board (Timeline/Gantt Chart view) và Explainable Recommendation UI | Frontend React (Giai đoạn tiếp theo) | **P3 (Giao diện)** | ⏳ Kế hoạch sau |

---
*Ghi chú: Tài liệu này được biên soạn và cập nhật tự động từ nội dung góp ý chính thức của GVHD TS. Trịnh Thị Ngọc Thúy vào ngày 17/10/2026.*
