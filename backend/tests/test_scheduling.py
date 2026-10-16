"""
Test Suite: test_scheduling.py
Mục đích:
- Kiểm thử hệ thống điều phối thông minh (Phase E).
- Kiểm thử bộ lọc ứng viên và chấm điểm đa mục tiêu DSS (Multi-Criteria Scoring).
- Kiểm thử thuật toán tối ưu hóa toàn cục Google OR-Tools CP-SAT.
- Kiểm thử quy trình phê duyệt của Điều phối viên (Human-in-the-Loop Bulk Confirmation).
"""

from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models import ServiceRequest, Employee, ScheduleVersion, Assignment, User
from app.ai.scheduling import SchedulingEngine

client = TestClient(app)


def test_dss_scoring_computation(db_session):
    """Kiểm tra tính đúng đắn của công thức chấm điểm đa tiêu chí DSS"""
    emp = db_session.get(Employee, 1)
    # Lấy request đầu tiên
    req = db_session.execute(select(ServiceRequest)).scalars().first()
    assert emp is not None and req is not None

    st = req.preferred_start
    et = st + timedelta(minutes=60)

    score, breakdown, explanation = SchedulingEngine.calculate_dss_score(
        db=db_session,
        employee=emp,
        request=req,
        start_time=st,
        end_time=et
    )

    assert 0.0 <= score <= 1.0, f"Điểm DSS phải nằm trong khoảng [0, 1], thực tế: {score}"
    assert "skill_fit" in breakdown
    assert "time_fit" in breakdown
    assert "distance_score" in breakdown
    assert "workload_score" in breakdown
    assert "continuity_score" in breakdown
    assert len(explanation) > 10
    assert "điểm DSS" in explanation


def test_recommend_candidates_api():
    """Kiểm thử API gợi ý Top ứng viên kèm giải trình: GET /api/v1/schedule/recommend-candidates/{request_id}"""
    # Lấy ID của một yêu cầu chưa được xử lý
    res = client.get("/api/v1/service-requests?status_filter=pending")
    assert res.status_code == 200
    pending_list = res.json()
    assert len(pending_list) > 0, "Cần có ít nhất 1 request pending để kiểm thử"

    req_id = pending_list[0]["request_id"]
    rec_res = client.get(f"/api/v1/schedule/recommend-candidates/{req_id}?top_k=3")
    assert rec_res.status_code == 200, rec_res.text
    candidates = rec_res.json()
    assert len(candidates) <= 3

    if len(candidates) > 0:
        top_1 = candidates[0]
        assert "employee_id" in top_1
        assert "score" in top_1
        assert "explanation" in top_1
        assert top_1["is_feasible"] is True


def test_realtime_feasibility_check_api():
    """Kiểm thử API thẩm định 6 ràng buộc cứng: POST /api/v1/schedule/check-feasibility"""
    # 1. Trường hợp khả thi
    now = datetime.now(timezone.utc)
    feasible_payload = {
        "employee_id": 1,
        "request_id": 1,
        # Giờ hành chính sáng hợp lệ
        "scheduled_start": datetime(now.year, now.month, now.day, 8, 30, tzinfo=timezone.utc).isoformat(),
        "scheduled_end": datetime(now.year, now.month, now.day, 9, 30, tzinfo=timezone.utc).isoformat()
    }
    # 2. Trường hợp vi phạm (khung giờ ngoài ca làm việc: 2h sáng)
    infeasible_payload = {
        "employee_id": 1,
        "request_id": 1,
        "scheduled_start": datetime(now.year, now.month, now.day, 2, 0, tzinfo=timezone.utc).isoformat(),
        "scheduled_end": datetime(now.year, now.month, now.day, 3, 0, tzinfo=timezone.utc).isoformat()
    }

    res_infeasible = client.post("/api/v1/schedule/check-feasibility", json=infeasible_payload)
    assert res_infeasible.status_code == 200
    inf_data = res_infeasible.json()
    assert inf_data["is_feasible"] is False
    assert "H3" in inf_data["rejection_reason"]


from sqlalchemy import func
from app.models import RecommendationLog


def test_ortools_global_schedule_optimization(db_session):
    """Kiểm thử giải bài toán tối ưu hóa phân công toàn cục bằng OR-Tools CP-SAT"""
    # Ngày mai (đã seed 5 request pending)
    target_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()

    # Dọn dẹp phân công cũ trên target_date để đảm bảo tính cô lập (tuân thủ thứ tự FK)
    db_session.query(Assignment).filter(func.date(Assignment.scheduled_start) == target_date).delete()
    v_ids = [v.schedule_version_id for v in db_session.query(ScheduleVersion).filter(ScheduleVersion.schedule_date == target_date).all()]
    if v_ids:
        db_session.query(RecommendationLog).filter(RecommendationLog.schedule_version_id.in_(v_ids)).delete(synchronize_session=False)
    db_session.query(ScheduleVersion).filter(ScheduleVersion.schedule_date == target_date).delete(synchronize_session=False)
    
    # Đảm bảo các request pending 21..25 đặt đúng target_date trong giờ hành chính (8h, 9h, 10h, 13h, 14h)
    vn_tz = timezone(timedelta(hours=7))
    pending_reqs = db_session.query(ServiceRequest).filter(ServiceRequest.request_id >= 21).all()
    hours = [8, 9, 10, 13, 14]
    if pending_reqs:
        for idx, r in enumerate(pending_reqs):
            h = hours[idx % len(hours)]
            r.preferred_start = datetime(target_date.year, target_date.month, target_date.day, h, 0, tzinfo=vn_tz)
            r.preferred_end = r.preferred_start + timedelta(hours=2)
            r.status = "pending"
    else:
        sample_reqs = db_session.query(ServiceRequest).order_by(ServiceRequest.request_id.desc()).limit(5).all()
        for idx, r in enumerate(sample_reqs):
            h = hours[idx % len(hours)]
            r.preferred_start = datetime(target_date.year, target_date.month, target_date.day, h, 0, tzinfo=vn_tz)
            r.preferred_end = r.preferred_start + timedelta(hours=2)
            r.status = "pending"
    db_session.commit()

    version_id = None
    try:
        payload = {
            "target_date": target_date.isoformat(),
            "created_by_user_id": 1
        }
        res = client.post("/api/v1/schedule/optimize", json=payload)
        assert res.status_code == 200, res.text
        opt_data = res.json()

        assert opt_data["status"] == "success"
        assert opt_data["schedule_version_id"] is not None
        assert opt_data["assigned_count"] > 0
        version_id = opt_data["schedule_version_id"]

        # Kiểm tra các phân công được tạo trong phiên bản lịch
        ver_assigns = client.get(f"/api/v1/schedule/versions/{version_id}/assignments")
        assert ver_assigns.status_code == 200
        assign_list = ver_assigns.json()
        assert len(assign_list) == opt_data["assigned_count"]

        for a in assign_list:
            assert a["assignment_status"] == "proposed"
            assert a["recommendation_score"] is not None
            assert a["explanation"] is not None

        # Kiểm tra Điều phối viên phê duyệt toàn bộ phiên bản lịch (Human-in-the-Loop)
        confirm_res = client.post(f"/api/v1/schedule/versions/{version_id}/confirm?confirmed_by=1")
        assert confirm_res.status_code == 200
        c_data = confirm_res.json()
        assert c_data["status"] == "success"
        assert c_data["confirmed_count"] == opt_data["assigned_count"]

    finally:
        # Dọn dẹp sau khi kiểm thử để không làm ô nhiễm CSDL
        db_session.query(Assignment).filter(func.date(Assignment.scheduled_start) == target_date).delete()
        if version_id:
            db_session.query(RecommendationLog).filter(RecommendationLog.schedule_version_id == version_id).delete()
            db_session.query(ScheduleVersion).filter(ScheduleVersion.schedule_version_id == version_id).delete()
        db_session.query(ServiceRequest).filter(func.date(ServiceRequest.preferred_start) == target_date).update({"status": "pending"})
        db_session.commit()
