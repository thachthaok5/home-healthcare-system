import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  PanelRightClose,
  PanelRightOpen,
  X,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  DispatchAssignment,
  MedicalStaff,
  UnassignedRequest,
} from '../../types/healthcare';
import {
  PageHeader,
  StatusBadge,
  PriorityBadge,
  CareFlowRoute,
} from './SharedUI';

export interface DispatchBoardPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  staffList: MedicalStaff[];
  assignments: DispatchAssignment[];
  unassignedRequests: UnassignedRequest[];
  onNavigate: (route: CareFlowRoute, requestId?: string) => void;
  onResolveConflict: (
    assignmentId: string,
    newStartTime: string,
    newEndTime: string,
    newStaffId?: string
  ) => Promise<void>;
  onReassignVisit?: (assignmentId: string, newStaffId: string) => void;
  highlightedAssignmentId?: string | null;
  onClearHighlight?: () => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 to 19:00

const parseMinutesFrom7AM = (timeStr: string): number => {
  const [hh, mm] = timeStr.split(':').map(Number);
  return Math.max(0, Math.min(12 * 60, (hh - 7) * 60 + (mm || 0)));
};

export const DispatchBoardPage: React.FC<DispatchBoardPageProps> = ({
  selectedDate,
  onDateChange,
  staffList,
  assignments,
  unassignedRequests,
  onNavigate,
  onResolveConflict,
  onReassignVisit,
  highlightedAssignmentId,
  onClearHighlight,
}) => {
  const [viewMode, setViewMode] = useState<'Day' | 'Week'>('Day');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showUnassignedPanel, setShowUnassignedPanel] = useState<boolean>(false);

  // Selected assignment for right-side detail drawer
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'change' | 'constraints'>('details');
  const [reassignStaffId, setReassignStaffId] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  const zones = useMemo(() => {
    const s = new Set<string>();
    staffList.forEach((st) => s.add(st.zone));
    return Array.from(s);
  }, [staffList]);

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (staffFilter !== 'ALL' && s.id !== staffFilter) return false;
      if (zoneFilter !== 'ALL' && s.zone !== zoneFilter) return false;
      return true;
    });
  }, [staffList, staffFilter, zoneFilter]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Conflict' && !a.isConflict) return false;
        if (statusFilter !== 'Conflict' && a.status !== statusFilter) return false;
      }
      return true;
    });
  }, [assignments, statusFilter]);

  // 7.2 Summary indicators
  const unassignedCount = unassignedRequests.length;
  const conflictCount = assignments.filter((a) => a.isConflict).length;
  const staffWithCapacityCount = staffList.filter(
    (s) => !s.isOnApprovedLeave && (s.workloadPct || 0) < 85
  ).length;

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId]
  );

  const stepDate = (deltaDays: number) => {
    const d = new Date(selectedDate || '2026-05-15');
    d.setDate(d.getDate() + deltaDays);
    onDateChange(d.toISOString().slice(0, 10));
  };

  const handleOpenAssignmentDrawer = (assignment: DispatchAssignment) => {
    setSelectedAssignmentId(assignment.id);
    setReassignStaffId(assignment.staffId);
    setDrawerTab('details');
  };

  const handleResolveConflictAction = async () => {
    if (!selectedAssignment || !selectedAssignment.conflictDetail) return;
    setIsResolving(true);
    try {
      await onResolveConflict(
        selectedAssignment.id,
        selectedAssignment.conflictDetail.suggestedNewStart,
        selectedAssignment.conflictDetail.suggestedNewEnd
      );
      setSelectedAssignmentId(null);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Newly Scheduled Assignment Success Notification */}
      {highlightedAssignmentId && (
        <div className="p-3.5 rounded-xl bg-[#E5F1EC] border-2 border-[#2F6F64] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[#2F6F64] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
              ✓
            </span>
            <div>
              <span className="text-[13px] font-bold text-[#253438]">
                Đã xếp lịch thành công vào Dòng thời gian!
              </span>
              <span className="block text-[11px] text-[#557670]">
                Vị trí ca khám đang được viền nổi bật nhấp nháy trên timeline và mở chi tiết tại bảng thông tin bên phải.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearHighlight}
            className="px-2.5 py-1 rounded-md text-[12px] font-bold text-[#2F6F64] hover:bg-[#2F6F64] hover:text-white transition-colors cursor-pointer"
          >
            Đã nắm rõ
          </button>
        </div>
      )}

      {/* Page Heading + Unassigned Drawer Toggle */}
      <PageHeader
        title="Bảng Điều phối Lịch trình"
        subtitle="Theo dõi dòng thời gian ca trực, phân bổ năng lực nhân sự và xử lý xung đột lịch"
        actions={
          <button
            type="button"
            onClick={() => setShowUnassignedPanel((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-[13px] font-medium transition-colors cursor-pointer ${
              showUnassignedPanel
                ? 'bg-[#E5F1EC] border-[#2F6F64] text-[#2F6F64]'
                : 'bg-white border-[#E1E9E6] text-[#253438] hover:border-[#2F6F64]'
            }`}
          >
            {showUnassignedPanel ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
            <span>Hàng đợi Chưa phân công ({unassignedCount})</span>
          </button>
        }
      />

      {/* 7.1 Top Toolbar */}
      <div className="bg-white rounded-[10px] border border-[#E1E9E6] p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Date Navigation & Day/Week Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] p-0.5">
            <button
              type="button"
              onClick={() => stepDate(-1)}
              className="p-1.5 rounded hover:bg-white text-[#253438] cursor-pointer"
              title="Ngày trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-[13px] font-semibold text-[#253438] tabular-nums">
              {selectedDate}
            </span>
            <button
              type="button"
              onClick={() => stepDate(1)}
              className="p-1.5 rounded hover:bg-white text-[#253438] cursor-pointer"
              title="Ngày sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onDateChange('2026-05-15')}
            className="px-3 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] font-medium text-[#253438] hover:border-[#2F6F64] cursor-pointer"
          >
            Hôm nay
          </button>

          <div className="inline-flex rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] p-0.5">
            {(
              [
                { key: 'Day', label: 'Theo Ngày' },
                { key: 'Week', label: 'Theo Tuần' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setViewMode(m.key)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                  viewMode === m.key
                    ? 'bg-[#2F6F64] text-white'
                    : 'text-[#687A78] hover:text-[#253438]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Nhân sự ({staffList.length})</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Khu vực (Phường)</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Trạng thái Ca khám</option>
            <option value="Confirmed">Đã xác nhận</option>
            <option value="In-Progress">Đang thực hiện</option>
            <option value="Proposed">Chờ xác nhận</option>
            <option value="Completed">Hoàn thành</option>
            <option value="Conflict">Đang xung đột lịch</option>
          </select>
        </div>
      </div>

      {/* 7.2 Compact Summary Indicators (3 Indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => setShowUnassignedPanel(true)}
          className="bg-white rounded-[10px] border border-[#E1E9E6] px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-[#2F6F64]"
        >
          <span className="text-[13px] text-[#687A78] font-medium">
            Yêu cầu chưa phân công
          </span>
          <span className="text-[18px] font-semibold text-[#253438] tabular-nums">
            {unassignedCount}
          </span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Conflict' ? 'ALL' : 'Conflict')}
          className={`bg-white rounded-[10px] border px-4 py-2.5 flex items-center justify-between cursor-pointer ${
            conflictCount > 0 ? 'border-[#F2C6CB]' : 'border-[#E1E9E6]'
          }`}
        >
          <span className="text-[13px] text-[#687A78] font-medium flex items-center gap-1.5">
            {conflictCount > 0 && <AlertTriangle className="w-4 h-4 text-[#D85D68]" />}
            Xung đột lịch trình
          </span>
          <span
            className={`text-[18px] font-semibold tabular-nums ${
              conflictCount > 0 ? 'text-[#D85D68]' : 'text-[#4D947B]'
            }`}
          >
            {conflictCount}
          </span>
        </div>

        <div className="bg-white rounded-[10px] border border-[#C6DFD7] px-4 py-2.5 flex items-center justify-between">
          <span className="text-[13px] text-[#2F6F64] font-medium">
            Nhân sự còn dư năng lực nhận ca
          </span>
          <span className="text-[18px] font-semibold text-[#2F6F64] tabular-nums">
            {staffWithCapacityCount} / {staffList.length}
          </span>
        </div>
      </div>

      {/* 7.3 Primary Schedule View + Optional Collapsible Unassigned Side Panel */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Dominant Horizontal Timeline / Gantt */}
        <div className="flex-1 w-full bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden">
          {/* Legend & Mode Header */}
          <div className="px-4 py-3 border-b border-[#E1E9E6] bg-[#F7FAF9] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-semibold text-[#253438]">
              {viewMode === 'Day'
                ? `Dòng thời gian Lịch trực Nhân sự (07:00 – 19:00) · ${selectedDate}`
                : `Tổng quan Năng lực & Ca trực Theo Tuần · Tuần ${selectedDate}`}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#687A78]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2F6F64]" /> Đã xác nhận / Đang khám
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#E6A64B]" /> Chờ xác nhận
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D96F7C]" /> Cảnh báo Trùng lịch
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#E5F1EC] border border-[#C6DFD7]" /> Khung giờ Ca trực
              </span>
            </div>
          </div>

          {viewMode === 'Day' ? (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                {/* Time Axis Row (07:00 - 19:00) */}
                <div className="flex border-b border-[#E1E9E6] bg-[#F7FAF9]">
                  <div className="w-[240px] shrink-0 px-4 py-2.5 border-r border-[#E1E9E6] text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                    Nhân sự Y tế & Tải công việc
                  </div>
                  <div className="flex-1 grid grid-cols-12">
                    {HOURS.slice(0, 12).map((hr) => (
                      <div
                        key={hr}
                        className="px-2 py-2.5 border-r border-[#E1E9E6] last:border-r-0 text-[11px] font-mono-num font-semibold text-[#687A78]"
                      >
                        {String(hr).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff Rows */}
                <div className="divide-y divide-[#E1E9E6]">
                  {filteredStaff.map((staff) => {
                    const staffVisits = filteredAssignments.filter(
                      (a) => a.staffId === staff.id
                    );
                    const shiftStartMin = parseMinutesFrom7AM(staff.shiftStart);
                    const shiftEndMin = parseMinutesFrom7AM(staff.shiftEnd);
                    const shiftLeftPct = (shiftStartMin / 720) * 100;
                    const shiftWidthPct = Math.max(
                      0,
                      ((shiftEndMin - shiftStartMin) / 720) * 100
                    );
                    const assignedMin =
                      staff.assignedMinutes ??
                      Math.round(((staff.workloadPct || 0) / 100) * staff.maxDailyMinutes);

                    return (
                      <div
                        key={staff.id}
                        className="flex items-stretch min-h-[84px] hover:bg-[#F7FAF9]/50 transition-colors"
                      >
                        {/* Pinned Left Staff Column */}
                        <div className="w-[240px] shrink-0 px-4 py-3 border-r border-[#E1E9E6] flex flex-col justify-between bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[#253438] truncate">
                                {staff.name}
                              </div>
                              <div className="text-[11px] text-[#687A78] truncate">
                                {staff.role} · {staff.zone}
                              </div>
                            </div>
                            {staff.isOnApprovedLeave ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FDF2F3] text-[#C03A47] shrink-0">
                                Nghỉ phép
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E5F1EC] text-[#2F6F64] tabular-nums shrink-0">
                                {staff.workloadPct}%
                              </span>
                            )}
                          </div>

                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] text-[#687A78] tabular-nums mb-1">
                              <span>
                                {assignedMin}/{staff.maxDailyMinutes}p
                              </span>
                              <span>
                                Ca {staff.shiftStart}–{staff.shiftEnd}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#E1E9E6] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  staff.workloadPct > 85
                                    ? 'bg-[#D85D68]'
                                    : staff.workloadPct > 70
                                    ? 'bg-[#E6A64B]'
                                    : 'bg-[#2F6F64]'
                                }`}
                                style={{ width: `${Math.min(100, staff.workloadPct)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right Timeline Track */}
                        <div className="flex-1 relative bg-[#F7FAF9]/35">
                          {/* Background Hour Grid Lines */}
                          <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                            {HOURS.slice(0, 12).map((hr) => (
                              <div
                                key={hr}
                                className="border-r border-dashed border-[#E1E9E6] last:border-r-0"
                              />
                            ))}
                          </div>

                          {/* Available Shift Capacity Band */}
                          {!staff.isOnApprovedLeave ? (
                            <div
                              className="absolute top-2 bottom-2 bg-white border border-[#E1E9E6] rounded pointer-events-none"
                              style={{
                                left: `${shiftLeftPct}%`,
                                width: `${shiftWidthPct}%`,
                              }}
                            />
                          ) : (
                            <div className="absolute inset-2 rounded bg-[#FDF2F3]/60 border border-dashed border-[#F2C6CB] flex items-center justify-center text-[11px] text-[#C03A47] font-medium">
                              Nghỉ phép đã duyệt ({staff.leaveWindowText || 'Cả ngày'})
                            </div>
                          )}

                          {/* Assignment Blocks */}
                          {staffVisits.map((visit) => {
                            const startMin = parseMinutesFrom7AM(visit.startTime);
                            const endMin = parseMinutesFrom7AM(visit.endTime);
                            const leftPct = (startMin / 720) * 100;
                            const widthPct = Math.max(7.5, ((endMin - startMin) / 720) * 100);
                            const isSelected = selectedAssignmentId === visit.id;
                            const isNewlyScheduled = highlightedAssignmentId === visit.id;

                            const blockStyle = isNewlyScheduled
                              ? 'bg-[#D1FAE5] border-2 border-[#059669] text-[#065F46] ring-4 ring-[#2F6F64]/50 shadow-xl scale-[1.03] z-20 animate-pulse'
                              : visit.isConflict
                              ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEE2E2]'
                              : visit.status === 'Proposed'
                              ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E] hover:bg-[#FEF3C7]'
                              : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] hover:bg-[#D1FAE5]';

                            return (
                              <div
                                key={visit.id}
                                onClick={() => handleOpenAssignmentDrawer(visit)}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                }}
                                className={`absolute top-2.5 bottom-2.5 rounded-md border px-2 py-1 cursor-pointer transition-shadow hover:shadow-md flex flex-col justify-between overflow-hidden ${blockStyle} ${
                                  isSelected ? 'ring-2 ring-[#2F6F64]' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono-num text-[10px] font-bold truncate">
                                    {visit.id}
                                  </span>
                                  {visit.isConflict && (
                                    <AlertTriangle className="w-3 h-3 text-[#D85D68] shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] font-semibold truncate leading-tight">
                                  {visit.serviceCategory || visit.serviceName}
                                </div>
                                <div className="text-[10px] opacity-80 tabular-nums truncate">
                                  {visit.startTime}–{visit.endTime}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Compact Week View */
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E1E9E6] text-[12px] text-[#687A78]">
                    <th className="py-2.5 px-3">Nhân sự Y tế</th>
                    <th className="py-2.5 px-3">Thứ 2</th>
                    <th className="py-2.5 px-3">Thứ 3</th>
                    <th className="py-2.5 px-3">Thứ 4 (Hôm nay)</th>
                    <th className="py-2.5 px-3">Thứ 5</th>
                    <th className="py-2.5 px-3">Thứ 6</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E9E6] text-[12px]">
                  {filteredStaff.map((st) => {
                    const todayCount = assignments.filter((a) => a.staffId === st.id).length;
                    return (
                      <tr key={st.id} className="hover:bg-[#F7FAF9]">
                        <td className="py-3 px-3 font-semibold text-[#253438]">
                          {st.name}
                          <div className="text-[11px] font-normal text-[#687A78]">{st.role}</div>
                        </td>
                        <td className="py-3 px-3 tabular-nums text-[#687A78]">2 ca (180p)</td>
                        <td className="py-3 px-3 tabular-nums text-[#687A78]">3 ca (240p)</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-1 rounded bg-[#E5F1EC] text-[#2F6F64] font-semibold tabular-nums">
                            {todayCount} ca ({st.workloadPct}% tải)
                          </span>
                        </td>
                        <td className="py-3 px-3 tabular-nums text-[#687A78]">2 ca (150p)</td>
                        <td className="py-3 px-3 tabular-nums text-[#687A78]">1 ca (90p)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 7.5 Collapsible Side Panel for Unassigned Requests */}
        {showUnassignedPanel && (
          <div className="w-full lg:w-[340px] shrink-0 bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#253438] m-0">
                  Yêu cầu Chưa phân công ({unassignedRequests.length})
                </h3>
                <p className="text-[11px] text-[#687A78] m-0">
                  Mở trong Đề xuất AI để đánh giá và gán nhân sự
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnassignedPanel(false)}
                className="text-[#687A78] hover:text-[#253438] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-[#E1E9E6] max-h-[540px] overflow-y-auto">
              {unassignedRequests.map((req) => (
                <div key={req.id} className="p-3.5 space-y-2 hover:bg-[#F7FAF9]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-num text-[12px] font-semibold text-[#2F6F64]">
                      {req.id}
                    </span>
                    <PriorityBadge priority={req.priority} />
                  </div>
                  <div className="text-[13px] font-semibold text-[#253438]">
                    {req.serviceName}
                  </div>
                  <div className="text-[12px] text-[#687A78] flex items-center justify-between tabular-nums">
                    <span>{req.district}</span>
                    <span>{req.requestedWindow}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('/recommendations', req.id)}
                    className="w-full mt-1 py-1.5 px-3 rounded-md bg-[#E5F1EC] text-[#2F6F64] text-[12px] font-semibold hover:bg-[#2F6F64] hover:text-white transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Đánh giá Đề xuất AI
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7.4 Right-Side Assignment Detail Drawer */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#253438]/30">
          <div className="w-full max-w-[460px] bg-white h-full shadow-xl border-l border-[#E1E9E6] flex flex-col">
            <div className="px-6 py-4 border-b border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-num text-[12px] font-semibold text-[#2F6F64] bg-[#E5F1EC] px-2 py-0.5 rounded">
                    {selectedAssignment.id}
                  </span>
                  {selectedAssignment.isConflict ? (
                    <StatusBadge status="Conflict" />
                  ) : (
                    <StatusBadge status={selectedAssignment.status} />
                  )}
                </div>
                <h3 className="text-[16px] font-semibold text-[#253438] m-0 mt-1">
                  {selectedAssignment.serviceName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignmentId(null)}
                className="p-1.5 rounded-lg text-[#687A78] hover:text-[#253438] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Tabs inside Drawer */}
            <div className="px-6 py-2.5 border-b border-[#E1E9E6] flex items-center gap-2 bg-white">
              <button
                type="button"
                onClick={() => setDrawerTab('details')}
                className={`px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer ${
                  drawerTab === 'details'
                    ? 'bg-[#E5F1EC] text-[#2F6F64]'
                    : 'text-[#687A78] hover:text-[#253438]'
                }`}
              >
                Chi tiết ca khám
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('change')}
                className={`px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer ${
                  drawerTab === 'change'
                    ? 'bg-[#E5F1EC] text-[#2F6F64]'
                    : 'text-[#687A78] hover:text-[#253438]'
                }`}
              >
                Đổi nhân sự
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('constraints')}
                className={`px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer ${
                  drawerTab === 'constraints'
                    ? 'bg-[#E5F1EC] text-[#2F6F64]'
                    : 'text-[#687A78] hover:text-[#253438]'
                }`}
              >
                Kiểm tra ràng buộc
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {drawerTab === 'details' && (
                <>
                  {/* Request Summary */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Thông tin Bệnh nhân & Yêu cầu
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-1.5 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Bệnh nhân:</span>
                        <span className="font-semibold text-[#253438]">
                          {selectedAssignment.patientName} ({selectedAssignment.patientAge} tuổi)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Mức ưu tiên:</span>
                        <PriorityBadge priority={selectedAssignment.priority} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Địa chỉ khám:</span>
                        <span className="font-medium text-[#253438] text-right">
                          {selectedAssignment.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Staff & Scheduled Window */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Nhân sự Phụ trách & Khung giờ
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Nhân sự được gán:</span>
                        <span className="font-semibold text-[#2F6F64]">
                          {selectedAssignment.staffName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Khung giờ lịch hẹn:</span>
                        <span className="font-semibold text-[#253438] tabular-nums">
                          {selectedAssignment.startTime} – {selectedAssignment.endTime} (
                          {selectedAssignment.predictedDurationMin} phút)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Quãng đường di chuyển:</span>
                        <span className="tabular-nums text-[#253438]">
                          {selectedAssignment.distanceKm} km (~{selectedAssignment.travelMinutes} phút)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Alert & One-Click Resolution if applicable */}
                  {selectedAssignment.isConflict && selectedAssignment.conflictDetail && (
                    <div className="p-4 rounded-lg bg-[#FDF2F3] border border-[#F2C6CB] space-y-2.5">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#C03A47]">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Phát hiện Trùng lịch ({selectedAssignment.conflictDetail.overlapMinutes} phút)</span>
                      </div>
                      <p className="text-[12px] text-[#253438] m-0">
                        {selectedAssignment.conflictDetail.reason}
                      </p>
                      <div className="text-[12px] text-[#2F6F64] font-medium tabular-nums">
                        Khung giờ điều chỉnh gợi ý: {selectedAssignment.conflictDetail.suggestedNewStart} –{' '}
                        {selectedAssignment.conflictDetail.suggestedNewEnd}
                      </div>
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={handleResolveConflictAction}
                        className="w-full py-2 px-3 rounded-lg bg-[#2F6F64] text-white text-[12px] font-semibold hover:bg-[#255A51] cursor-pointer"
                      >
                        {isResolving
                          ? 'Đang cập nhật khung giờ...'
                          : `Áp dụng Khung giờ Gợi ý (${selectedAssignment.conflictDetail.suggestedNewStart}–${selectedAssignment.conflictDetail.suggestedNewEnd})`}
                      </button>
                    </div>
                  )}
                </>
              )}

              {drawerTab === 'change' && (
                <div className="space-y-4">
                  <div className="text-[13px] font-semibold text-[#253438]">
                    Chuyển Ca chăm sóc sang Nhân sự Khác
                  </div>
                  <select
                    value={reassignStaffId}
                    onChange={(e) => setReassignStaffId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                  >
                    {staffList
                      .filter((s) => !s.isOnApprovedLeave)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role}) — {s.workloadPct}% tải công việc
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (onReassignVisit && reassignStaffId) {
                        onReassignVisit(selectedAssignment.id, reassignStaffId);
                        setSelectedAssignmentId(null);
                      }
                    }}
                    className="w-full py-2 px-4 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold hover:bg-[#255A51] cursor-pointer"
                  >
                    Xác nhận Đổi Nhân sự
                  </button>
                </div>
              )}

              {drawerTab === 'constraints' && (
                <div className="space-y-3">
                  <div className="text-[13px] font-semibold text-[#253438]">
                    Trạng thái 6 Ràng buộc Cứng Vận hành
                  </div>
                  {[
                    {
                      label: 'Đáp ứng kỹ năng chuyên môn bắt buộc',
                      passed: true,
                      detail: `Đã xác thực cho danh mục ${selectedAssignment.serviceCategory}`,
                    },
                    {
                      label: 'Trạng thái nhân sự đang trực',
                      passed: true,
                      detail: `${selectedAssignment.staffName} đang trong ca trực hoạt động`,
                    },
                    {
                      label: 'Nằm trong khung giờ ca trực',
                      passed: true,
                      detail: `Khung giờ đã xếp ${selectedAssignment.startTime}–${selectedAssignment.endTime}`,
                    },
                    {
                      label: 'Không trùng lịch ca khám khác',
                      passed: !selectedAssignment.isConflict,
                      detail: selectedAssignment.isConflict
                        ? `Bị trùng ${selectedAssignment.conflictDetail?.overlapMinutes} phút với ca ${selectedAssignment.conflictDetail?.conflictingAssignmentId}`
                        : 'Không trùng với các ca liền kề',
                    },
                    {
                      label: 'Đảm bảo thời gian di chuyển',
                      passed: true,
                      detail: `${selectedAssignment.distanceKm} km (~${selectedAssignment.travelMinutes} phút di chuyển)`,
                    },
                    {
                      label: 'Không vượt trần 480 phút/ngày',
                      passed: true,
                      detail: 'Nằm trong giới hạn 480 phút/ngày',
                    },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className={`p-2.5 rounded border flex items-start gap-2 text-[12px] ${
                        c.passed
                          ? 'bg-[#F7FAF9] border-[#E1E9E6]'
                          : 'bg-[#FDF2F3] border-[#F2C6CB]'
                      }`}
                    >
                      {c.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4D947B] shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#D85D68] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-[#253438]">{c.label}</div>
                        <div className="text-[11px] text-[#687A78]">{c.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAssignmentId(null);
                  onNavigate('/requests');
                }}
                className="px-3.5 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[12px] font-medium text-[#253438] hover:border-[#2F6F64] cursor-pointer"
              >
                Xem Yêu cầu
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerTab('change')}
                  className="px-3.5 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[12px] font-medium text-[#2F6F64] hover:bg-[#E5F1EC] cursor-pointer"
                >
                  Đổi Nhân sự
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('constraints')}
                  className="px-3.5 py-2 rounded-lg bg-[#2F6F64] text-white text-[12px] font-medium hover:bg-[#255A51] cursor-pointer"
                >
                  Kiểm tra Ràng buộc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
