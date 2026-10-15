from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Assignment, ServiceResult, ServiceRequest, AIPrediction

client = TestClient(app)


def test_health_check():
    """Kiểm tra endpoint /health"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "home_healthcare_db" in data["database"]


def test_auth_login_success():
    """Kiểm tra đăng nhập thành công với tài khoản điều phối viên"""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "coordinator1", "password": "123456"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_auth_login_invalid_password():
    """Kiểm tra đăng nhập thất bại khi sai mật khẩu"""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "coordinator1", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_get_customers_and_employees():
    """Kiểm tra danh sách khách hàng và nhân viên y tế"""
    res_cust = client.get("/api/v1/customers")
    assert res_cust.status_code == 200
    assert len(res_cust.json()) > 0

    res_emp = client.get("/api/v1/employees")
    assert res_emp.status_code == 200
    assert len(res_emp.json()) > 0


def test_get_services_and_skills():
    """Kiểm tra danh mục dịch vụ và kỹ năng"""
    res_srv = client.get("/api/v1/services")
    assert res_srv.status_code == 200
    assert len(res_srv.json()) >= 5

    res_skills = client.get("/api/v1/skills")
    assert res_skills.status_code == 200
    assert len(res_skills.json()) >= 10


def test_end_to_end_request_assignment_result_flow(db_session):
    """
    KIỂM THỬ LUỒNG NGHIỆP VỤ ĐẦY ĐỦ (END-TO-END WORKFLOW):
    1. Đăng nhập điều phối viên lấy Token
    2. Tạo Service Request mới
    3. Tạo phân công thủ công (Manual Assignment)
    4. Điều phối viên phê duyệt phân công (Confirm)
    5. Nhân viên hoàn tất ca chăm sóc và cập nhật actual_duration
    6. Kiểm tra Dashboard KPI được cập nhật
    7. Tự động dọn dẹp (cleanup) dữ liệu test để bảo đảm tính cô lập.
    """
    request_id = None
    assignment_id = None

    try:
        # 1. Đăng nhập
        login_res = client.post(
            "/api/v1/auth/login",
            json={"username": "coordinator1", "password": "123456"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Tạo Service Request vào thời gian xa (30 ngày sau) để tránh xung đột
        now = datetime.now(timezone.utc) + timedelta(days=30)
        req_payload = {
            "customer_id": 1,
            "service_id": 1,  # Chăm sóc vết thương
            "preferred_start": now.isoformat(),
            "preferred_end": (now + timedelta(hours=2)).isoformat(),
            "address": "12 Lê Thánh Tôn, Lộc Thọ, Nha Trang",
            "district_code": "LOC_THO",
            "complexity_level": 2,
            "has_special_equip": False,
            "priority": 2
        }
        req_res = client.post("/api/v1/service-requests", json=req_payload)
        assert req_res.status_code == 201, req_res.text
        req_data = req_res.json()
        request_id = req_data["request_id"]
        assert req_data["status"] == "pending"
        assert req_data["predicted_duration"] is not None  # AI duration đã được dự đoán

        # 3. Tạo phân công thủ công cho nhân viên ID 1 (có đủ kỹ năng)
        assign_payload = {
            "request_id": request_id,
            "employee_id": 1,
            "scheduled_start": req_payload["preferred_start"],
            "scheduled_end": (now + timedelta(minutes=req_data["predicted_duration"])).isoformat(),
            "explanation": "Điều phối viên chỉ định nhân viên có kỹ năng phù hợp nhất"
        }
        assign_res = client.post("/api/v1/assignments/manual", json=assign_payload)
        assert assign_res.status_code == 201, assign_res.text
        assign_data = assign_res.json()
        assignment_id = assign_data["assignment_id"]
        assert assign_data["assignment_status"] == "proposed"

        # 4. Điều phối viên phê duyệt (Confirm)
        confirm_payload = {
            "confirmed_by": 2,  # coordinator1 user_id
            "override_reason": "Chấp thuận phân công"
        }
        confirm_res = client.post(f"/api/v1/assignments/{assignment_id}/confirm", json=confirm_payload)
        assert confirm_res.status_code == 200
        assert confirm_res.json()["assignment_status"] == "confirmed"

        # 5. Ghi nhận kết quả thực tế
        act_start = now + timedelta(minutes=5)
        act_end = act_start + timedelta(minutes=48)  # actual_duration = 48 phút
        result_payload = {
            "actual_start": act_start.isoformat(),
            "actual_end": act_end.isoformat(),
            "status_outcome": "successful",
            "travel_minutes": 10,
            "outcome": "Vết thương sạch, không sưng viêm, hồi phục tốt.",
            "notes": "Bệnh nhân tuân thủ dặn dò y tế."
        }
        result_res = client.post(f"/api/v1/assignments/{assignment_id}/result", json=result_payload)
        assert result_res.status_code == 200, result_res.text
        res_data = result_res.json()
        assert res_data["actual_duration"] == 48  # Đã tính đúng 48 phút!
        assert res_data["status_outcome"] == "successful"

        # 6. Kiểm tra Dashboard KPI
        kpi_res = client.get("/api/v1/dashboard/kpis")
        assert kpi_res.status_code == 200
        kpi_data = kpi_res.json()
        assert kpi_data["total_requests"] >= 26
        assert kpi_data["completed_requests"] >= 21

    finally:
        # Dọn dẹp dữ liệu test để không ảnh hưởng các test constraints khác
        if assignment_id:
            db_session.query(ServiceResult).filter(ServiceResult.assignment_id == assignment_id).delete()
            db_session.query(Assignment).filter(Assignment.assignment_id == assignment_id).delete()
        if request_id:
            db_session.query(AIPrediction).filter(AIPrediction.request_id == request_id).delete()
            db_session.query(ServiceRequest).filter(ServiceRequest.request_id == request_id).delete()
        db_session.commit()

