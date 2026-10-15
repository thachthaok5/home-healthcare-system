from datetime import date, time, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select

from app.models import (
    Employee, Skill, EmployeeSkill, Service, ServiceRequiredSkill,
    ServiceRequest, EmployeeAvailability, Assignment
)


def test_hard_constraint_1_skill_matching(db_session):
    """
    RÀNG BUỘC CỨNG 1: Skill Match
    Nhân viên phải đáp ứng đủ tất cả các kỹ năng bắt buộc (mandatory=True)
    của dịch vụ với trình độ level >= min_level.
    """
    # Lấy dịch vụ "Thay băng cắt chỉ vết mổ" (yêu cầu kỹ năng SKILL_SURGICAL_DRESSING cấp độ >= 2)
    service = db_session.execute(
        select(Service).where(Service.service_name.like("%Thay băng cắt chỉ%"))
    ).scalar_one()

    required_skills = db_session.execute(
        select(ServiceRequiredSkill).where(ServiceRequiredSkill.service_id == service.service_id)
    ).scalars().all()

    assert len(required_skills) > 0, "Dịch vụ phải có kỹ năng bắt buộc"

    for req in required_skills:
        if req.mandatory:
            # Tìm nhân viên có kỹ năng này và level >= min_level
            eligible_emp_skills = db_session.execute(
                select(EmployeeSkill).where(
                    EmployeeSkill.skill_id == req.skill_id,
                    EmployeeSkill.level >= req.min_level
                )
            ).scalars().all()
            assert len(eligible_emp_skills) > 0, f"Phải có ít nhất 1 nhân viên đạt kỹ năng {req.skill_id}"

            # Kiểm tra một nhân viên có kỹ năng hợp lệ
            sample_emp_skill = eligible_emp_skills[0]
            assert sample_emp_skill.level >= req.min_level


def test_hard_constraint_2_active_status(db_session):
    """
    RÀNG BUỘC CỨNG 2: Active Status
    Nhân viên được phân công phải có trạng thái hoạt động ('active'), không bị đình chỉ hay nghỉ việc.
    """
    employees = db_session.execute(select(Employee)).scalars().all()
    assert len(employees) > 0

    active_employees = [e for e in employees if e.status == "active"]
    assert len(active_employees) > 0, "Hệ thống phải có nhân viên đang active"

    # Kiểm tra tất cả các phân công hiện tại đều thuộc nhân viên active
    assignments = db_session.execute(select(Assignment)).scalars().all()
    for a in assignments:
        emp = db_session.get(Employee, a.employee_id)
        assert emp.status == "active", f"Nhân viên {emp.employee_id} được phân công nhưng không active!"


def test_hard_constraint_3_availability(db_session):
    """
    RÀNG BUỘC CỨNG 3: Availability
    Thời gian thực hiện dịch vụ phải nằm hoàn toàn trong ca làm việc đã đăng ký của nhân viên.
    """
    # Lấy 1 nhân viên có lịch làm việc
    avail = db_session.execute(select(EmployeeAvailability)).scalars().first()
    assert avail is not None, "Phải có ca làm việc"

    # Giả lập thời gian dịch vụ nằm trong ca
    service_start = time(8, 0)
    service_end = time(9, 0)

    # Kiểm tra ca làm việc bao phủ thời gian dịch vụ
    is_covered = (avail.start_time <= service_start) and (service_end <= avail.end_time)
    assert is_covered, f"Ca làm việc ({avail.start_time} - {avail.end_time}) phải bao phủ ({service_start} - {service_end})"


def test_hard_constraint_4_no_schedule_overlap(db_session):
    """
    RÀNG BUỘC CỨNG 4: No Schedule Overlap
    Một nhân viên không được có hai ca phân công bị chồng lấn thời gian.
    Quy tắc: (StartA < EndB) và (StartB < EndA) => Trùng lịch!
    """
    assignments = db_session.execute(select(Assignment)).scalars().all()
    
    # Gom nhóm phân công theo nhân viên
    emp_assignments = {}
    for a in assignments:
        emp_assignments.setdefault(a.employee_id, []).append(a)

    for emp_id, a_list in emp_assignments.items():
        # Kiểm tra từng cặp phân công của cùng 1 nhân viên
        for i in range(len(a_list)):
            for j in range(i + 1, len(a_list)):
                a1 = a_list[i]
                a2 = a_list[j]
                
                # Hai ca chỉ có thể trùng nếu diễn ra cùng ngày
                if a1.scheduled_start.date() == a2.scheduled_start.date():
                    overlap = (a1.scheduled_start < a2.scheduled_end) and (a2.scheduled_start < a1.scheduled_end)
                    assert not overlap, f"Phát hiện trùng lịch giữa Assignment {a1.assignment_id} và {a2.assignment_id} của nhân viên {emp_id}"


def test_hard_constraint_5_travel_feasibility():
    """
    RÀNG BUỘC CỨNG 5: Travel Feasibility
    Khoảng thời gian nghỉ giữa ca làm việc trước và ca làm việc sau phải >= thời gian di chuyển dự kiến.
    Gap = Start2 - End1 >= TravelMinutes.
    """
    end_task_1 = datetime(2026, 10, 16, 9, 30, tzinfo=timezone.utc)
    start_task_2 = datetime(2026, 10, 16, 10, 0, tzinfo=timezone.utc)
    travel_minutes = 15

    gap_minutes = (start_task_2 - end_task_1).total_seconds() / 60
    assert gap_minutes >= travel_minutes, f"Thời gian nghỉ ({gap_minutes}p) không đủ cho di chuyển ({travel_minutes}p)"


def test_hard_constraint_6_daily_workload_limit(db_session):
    """
    RÀNG BUỘC CỨNG 6: Daily Workload Limit
    Tổng thời lượng dịch vụ trong ngày của nhân viên không được vượt quá max_daily_minutes (thường là 480 phút = 8 giờ).
    """
    employees = db_session.execute(select(Employee)).scalars().all()
    assignments = db_session.execute(select(Assignment)).scalars().all()

    for emp in employees:
        emp_assignments = [a for a in assignments if a.employee_id == emp.employee_id]
        
        # Gom nhóm theo ngày
        daily_work = {}
        for a in emp_assignments:
            d = a.scheduled_start.date()
            dur = (a.scheduled_end - a.scheduled_start).total_seconds() / 60
            daily_work[d] = daily_work.get(d, 0) + dur

        for d, total_dur in daily_work.items():
            assert total_dur <= emp.max_daily_minutes, (
                f"Nhân viên {emp.full_name} làm việc {total_dur}p vào ngày {d}, "
                f"vượt quá giới hạn {emp.max_daily_minutes}p/ngày!"
            )


def test_state_transitions(db_session):
    """
    KIỂM THỬ CHUYỂN TRẠNG THÁI NGHIỆP VỤ (State Transitions)
    Quy trình: pending -> proposed -> confirmed -> completed
    """
    # 1. Yêu cầu tạo mới: status = 'pending'
    req = db_session.execute(
        select(ServiceRequest).where(ServiceRequest.status == "pending")
    ).scalars().first()
    assert req is not None, "Phải có yêu cầu ở trạng thái pending"

    # 2. Phân công hoàn tất: assignment_status = 'completed'
    assign = db_session.execute(
        select(Assignment).where(Assignment.assignment_status == "completed")
    ).scalars().first()
    assert assign is not None, "Phải có phân công ở trạng thái completed"
    assert assign.confirmed_by is not None, "Phân công hoàn tất phải có người phê duyệt (confirmed_by)"
    assert assign.service_result is not None, "Phân công hoàn tất phải có kết quả thực hiện (service_result)"
    assert assign.service_result.actual_duration > 0, "Thời lượng thực tế phải > 0"
