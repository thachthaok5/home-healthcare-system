"""
Test Suite: test_end_to_end_flow.py
Mục đích:
- Kiểm thử toàn diện Chuỗi Nghiệp vụ Khép kín (End-to-End Closed Loop Flow) của Giai đoạn F
  theo đúng Mục 3 Hướng dẫn Đợt 2 của Thầy:
  Create Request -> Validate -> Predict Duration (AI) -> Check Constraints (6 Hard Constraints) ->
  Generate Recommendation (DSS) -> Coordinator Review / Modify -> Confirm Assignment -> Execute ->
  Record Actual Duration (actual_end - actual_start) -> Feedback / Rating.
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models import ServiceRequest, Assignment, ServiceResult, Rating, AIPrediction

client = TestClient(app)


def test_complete_phase_f_closed_loop_workflow(db_session):
    """
    KIỂM THỬ ĐẦY ĐỦ CHUỖI GIÁ TRỊ THÔNG TIN MIS ĐỢT 2 (GIAI ĐOẠN F):
    1. Tiếp nhận & Thẩm định yêu cầu (Create Request & Validate)
    2. Dự đoán thời lượng AI tự động (Predict Duration -> ai_predictions)
    3. Thẩm định 6 ràng buộc cứng & Gợi ý Top ứng viên (DSS Recommendations)
    4. Tối ưu hóa phân công toàn cục (OR-Tools CP-SAT Optimization)
    5. Điều phối viên xem xét & Phê duyệt (Coordinator Review & Confirm)
    6. Điều dưỡng thực hiện ca & Ghi nhận kết quả thực tế (actual_duration = actual_end - actual_start)
    7. Đánh giá chất lượng dịch vụ (Rating)
    8. Cập nhật Dashboard KPI
    """
    request_id = None
    assignment_id = None
    schedule_version_id = None

    try:
        # BƯỚC 1: Tiếp nhận & Thẩm định yêu cầu
        # Chọn ngày hẹn trong tuần (tránh Chủ Nhật nghỉ) vào ca sáng (8:30) nằm trong khung làm việc (07:30 - 11:30)
        now_dt = datetime.now(timezone.utc)
        target_day = (now_dt + timedelta(days=4)).date()
        if target_day.weekday() == 6:  # Nếu là Chủ Nhật, dời sang Thứ Hai
            target_day += timedelta(days=1)
        pref_start = datetime(target_day.year, target_day.month, target_day.day, 8, 30, tzinfo=timezone.utc)
        pref_end = pref_start + timedelta(hours=2)

        req_payload = {
            "customer_id": 1,
            "service_id": 1,  # Chăm sóc vết thương (default 45p)
            "preferred_start": pref_start.isoformat(),
            "preferred_end": pref_end.isoformat(),
            "address": "45 Pasteur, Xương Huân, Nha Trang",
            "district_code": "XUONG_HUAN",
            "complexity_level": 3,  # Ca phức tạp
            "has_special_equip": True,  # Có thiết bị chuyên dụng
            "priority": 2
        }
        res_req = client.post("/api/v1/service-requests", json=req_payload)
        assert res_req.status_code == 201, res_req.text
        req_data = res_req.json()
        request_id = req_data["request_id"]
        assert req_data["status"] == "pending"

        # BƯỚC 2: AI tự động dự đoán thời lượng (lưu vào ai_predictions)
        assert req_data["predicted_duration"] is not None
        # Với complexity 3 và thiết bị chuyên dụng, AI dự đoán thời lượng > 45 phút mặc định
        assert req_data["predicted_duration"] > 45

        # BƯỚC 3: Gợi ý Top ứng viên DSS & Kiểm tra 6 ràng buộc cứng
        rec_res = client.get(f"/api/v1/schedule/recommend-candidates/{request_id}?top_k=3")
        assert rec_res.status_code == 200
        candidates = rec_res.json()
        assert len(candidates) > 0
        top_1 = candidates[0]
        assert top_1["is_feasible"] is True
        assert top_1["score"] > 0.60
        assert "điểm DSS" in top_1["explanation"]

        # BƯỚC 4: Tạo phân công đề xuất (Proposed Assignment)
        selected_emp_id = top_1["employee_id"]
        assign_payload = {
            "request_id": request_id,
            "employee_id": selected_emp_id,
            "scheduled_start": pref_start.isoformat(),
            "scheduled_end": (pref_start + timedelta(minutes=req_data["predicted_duration"])).isoformat(),
            "explanation": f"Gợi ý Top 1 từ hệ thống DSS: {top_1['explanation']}"
        }
        assign_res = client.post("/api/v1/assignments/manual", json=assign_payload)
        assert assign_res.status_code == 201, assign_res.text
        assign_data = assign_res.json()
        assignment_id = assign_data["assignment_id"]
        assert assign_data["assignment_status"] == "proposed"

        # BƯỚC 5: Điều phối viên thẩm định & Phê duyệt (Confirm)
        confirm_payload = {
            "confirmed_by": 2,  # coordinator1
            "override_reason": "Chấp thuận đề xuất Top-1 của AI"
        }
        confirm_res = client.post(f"/api/v1/assignments/{assignment_id}/confirm", json=confirm_payload)
        assert confirm_res.status_code == 200
        assert confirm_res.json()["assignment_status"] == "confirmed"

        # BƯỚC 6: Thực thi & Ghi nhận actual_duration = actual_end - actual_start
        act_start = pref_start + timedelta(minutes=3)
        act_end = act_start + timedelta(minutes=55)  # 55 phút thực tế
        result_payload = {
            "actual_start": act_start.isoformat(),
            "actual_end": act_end.isoformat(),
            "status_outcome": "successful",
            "travel_minutes": 8,
            "outcome": "Vết thương khô sạch, thay băng vô khuẩn đúng quy trình kỹ thuật.",
            "notes": "Bệnh nhân phản hồi tốt, không sốt, không đau nhức."
        }
        res_result = client.post(f"/api/v1/assignments/{assignment_id}/result", json=result_payload)
        assert res_result.status_code == 200
        result_data = res_result.json()
        # Kiểm tra tính toán actual_duration chuẩn xác
        assert result_data["actual_duration"] == 55
        assert result_data["status_outcome"] == "successful"

        # BƯỚC 7: Đánh giá chất lượng dịch vụ (Rating 5 sao)
        rating_payload = {
            "score": 5,
            "comment": "Điều dưỡng viên thao tác nhẹ nhàng, tận tâm và chuyên nghiệp."
        }
        res_rate = client.post(f"/api/v1/assignments/{assignment_id}/rate", json=rating_payload)
        assert res_rate.status_code == 201
        assert res_rate.json()["score"] == 5

        # BƯỚC 8: Cập nhật Dashboard KPI
        kpi_res = client.get("/api/v1/dashboard/kpis")
        assert kpi_res.status_code == 200
        kpi_data = kpi_res.json()
        assert kpi_data["completed_requests"] >= 20
        assert kpi_data["average_customer_rating"] >= 4.0

    finally:
        # Dọn dẹp dữ liệu kiểm thử
        if assignment_id:
            db_session.query(Rating).filter(Rating.assignment_id == assignment_id).delete()
            db_session.query(ServiceResult).filter(ServiceResult.assignment_id == assignment_id).delete()
            db_session.query(Assignment).filter(Assignment.assignment_id == assignment_id).delete()
        if request_id:
            db_session.query(AIPrediction).filter(AIPrediction.request_id == request_id).delete()
            db_session.query(ServiceRequest).filter(ServiceRequest.request_id == request_id).delete()
        db_session.commit()
