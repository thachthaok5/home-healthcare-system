import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  AlertTriangle,
  X,
  Stethoscope,
  Clock,
  MapPin,
  RotateCcw,
  Users,
  CheckCircle2,
  Edit3,
  CalendarClock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  DispatchAssignment,
  MedicalStaff,
} from '../../types/healthcare';
import {
  PageHeader,
  StatusBadge,
  EmptyStateCard,
  KpiCard,
  CareFlowRoute,
} from './SharedUI';

export interface CareTeamPageProps {
  staffList: MedicalStaff[];
  assignments: DispatchAssignment[];
  onAddStaff?: (newStaff: MedicalStaff) => void;
  onUpdateStaff?: (updatedStaff: MedicalStaff) => void;
  onNavigate?: (route: CareFlowRoute, requestId?: string) => void;
}

export type StaffAvailabilityState =
  | 'Available'
  | 'Partially Busy'
  | 'Fully Booked'
  | 'Unavailable';

const computeAvailabilityState = (staff: MedicalStaff): StaffAvailabilityState => {
  if (staff.isOnApprovedLeave) return 'Unavailable';
  const assignedMin =
    staff.assignedMinutes ?? Math.round(((staff.workloadPct || 0) / 100) * staff.maxDailyMinutes);
  const pct = staff.maxDailyMinutes > 0 ? (assignedMin / staff.maxDailyMinutes) * 100 : 0;
  if (pct >= 92 || assignedMin >= staff.maxDailyMinutes - 30) return 'Fully Booked';
  if (pct >= 35 || (staff.assignedCount || 0) >= 2) return 'Partially Busy';
  return 'Available';
};

const renderAvailabilityBadge = (avail: StaffAvailabilityState) => {
  switch (avail) {
    case 'Available':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EBF6F1] text-[#2E755D] border border-[#C5E2D7]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4D947B]" />
          Sẵn sàng (Available)
        </span>
      );
    case 'Partially Busy':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#E5F1EC] text-[#2F6F64] border border-[#B8D9CE]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2F6F64]" />
          Bận một phần (Partially Busy)
        </span>
      );
    case 'Fully Booked':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FDF6EC] text-[#B87514] border border-[#F3D9B1]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E6A64B]" />
          Kín lịch (Fully Booked)
        </span>
      );
    case 'Unavailable':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FDF2F3] text-[#C03A47] border border-[#F2C6CB]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D85D68]" />
          Không khả dụng (Unavailable)
        </span>
      );
  }
};

const renderActiveStatusBadge = (isActive: boolean) => {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EBF6F1] text-[#2E755D] border border-[#C5E2D7]">
        <CheckCircle2 className="w-3 h-3" />
        Đang hoạt động
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7FAF9] text-[#687A78] border border-[#CBD8D3]">
      Tạm ngưng (Inactive)
    </span>
  );
};

export const CareTeamPage: React.FC<CareTeamPageProps> = ({
  staffList,
  assignments,
  onAddStaff,
  onUpdateStaff,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');
  const [skillFilter, setSkillFilter] = useState<string>('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>(
    'ALL'
  );

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'Overview' | 'Availability' | 'Assignments'>(
    'Overview'
  );

  // Edit mode inside Staff Detail Drawer
  const [isEditingStaff, setIsEditingStaff] = useState<boolean>(false);
  const [editZone, setEditZone] = useState<string>('');
  const [editSkillsText, setEditSkillsText] = useState<string>('');
  const [editMaxMinutes, setEditMaxMinutes] = useState<number>(480);
  const [editShiftStart, setEditShiftStart] = useState<string>('07:30');
  const [editShiftEnd, setEditShiftEnd] = useState<string>('17:30');
  const [editIsInactive, setEditIsInactive] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add staff modal states
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('ĐD. Lê Thị Thanh Hương');
  const [newRole, setNewRole] = useState<MedicalStaff['role']>('Điều dưỡng Chuyên khoa');
  const [newZone, setNewZone] = useState<string>('Phường Lộc Thọ');
  const [newSkillsText, setNewSkillsText] = useState<string>(
    'Chăm sóc vết thương, Tiêm truyền tĩnh mạch'
  );

  // All distinct skills for filter dropdown
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => s.skills.forEach((sk) => set.add(sk)));
    return Array.from(set);
  }, [staffList]);

  // 3.2 Summary metrics (3 KPI cards)
  const activeStaffCount = staffList.filter((s) => !s.isOnApprovedLeave).length;
  const availableStaffCount = staffList.filter((s) => {
    const st = computeAvailabilityState(s);
    return st === 'Available' || st === 'Partially Busy';
  }).length;
  const highWorkloadCount = staffList.filter((s) => {
    const assignedMin =
      s.assignedMinutes ?? Math.round(((s.workloadPct || 0) / 100) * s.maxDailyMinutes);
    return assignedMin / (s.maxDailyMinutes || 480) >= 0.78 || (s.workloadPct || 0) >= 78;
  }).length;

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter((s) => {
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.id.toLowerCase().includes(q) &&
        !s.role.toLowerCase().includes(q) &&
        !s.zone.toLowerCase().includes(q)
      ) {
        return false;
      }
      const avail = computeAvailabilityState(s);
      if (availabilityFilter !== 'ALL' && avail !== availabilityFilter) return false;
      if (skillFilter !== 'ALL' && !s.skills.includes(skillFilter)) return false;
      if (activeStatusFilter !== 'ALL') {
        const isActive = !s.isOnApprovedLeave;
        if (activeStatusFilter === 'Active' && !isActive) return false;
        if (activeStatusFilter === 'Inactive' && isActive) return false;
      }
      return true;
    });
  }, [staffList, searchQuery, availabilityFilter, skillFilter, activeStatusFilter]);

  const selectedStaff = useMemo(
    () => staffList.find((s) => s.id === selectedStaffId) || null,
    [staffList, selectedStaffId]
  );

  const selectedStaffVisits = useMemo(
    () =>
      selectedStaff
        ? assignments
            .filter((a) => a.staffId === selectedStaff.id)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
        : [],
    [assignments, selectedStaff]
  );

  // Calculate available time windows for selected staff (Tab 2)
  const calculatedAvailableWindows = useMemo(() => {
    if (!selectedStaff) return [];
    if (selectedStaff.isOnApprovedLeave) return [];

    const toMins = (t: string) => {
      const [h, m] = (t || '07:30').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const toTimeStr = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const shiftS = toMins(selectedStaff.shiftStart || '07:30');
    const shiftE = toMins(selectedStaff.shiftEnd || '17:30');
    let cursor = shiftS;
    const windows: { start: string; end: string; durationMin: number }[] = [];

    selectedStaffVisits.forEach((v) => {
      const vStart = toMins(v.startTime);
      const vEnd = toMins(v.endTime);
      if (vStart > cursor + 15) {
        windows.push({
          start: toTimeStr(cursor),
          end: toTimeStr(vStart),
          durationMin: vStart - cursor,
        });
      }
      if (vEnd > cursor) {
        cursor = vEnd;
      }
    });

    if (shiftE > cursor + 15) {
      windows.push({
        start: toTimeStr(cursor),
        end: toTimeStr(shiftE),
        durationMin: shiftE - cursor,
      });
    }

    return windows;
  }, [selectedStaff, selectedStaffVisits]);

  const handleOpenStaffDetail = (staff: MedicalStaff) => {
    setSelectedStaffId(staff.id);
    setDrawerTab('Overview');
    setIsEditingStaff(false);
    setEditError(null);
  };

  const handleStartEditStaff = (staff: MedicalStaff) => {
    setEditZone(staff.zone);
    setEditSkillsText(staff.skills.join(', '));
    setEditMaxMinutes(staff.maxDailyMinutes || 480);
    setEditShiftStart(staff.shiftStart || '07:30');
    setEditShiftEnd(staff.shiftEnd || '17:30');
    setEditIsInactive(Boolean(staff.isOnApprovedLeave));
    setEditError(null);
    setIsEditingStaff(true);
  };

  const handleSaveStaffEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const currentAssignedMin =
      selectedStaff.assignedMinutes ??
      Math.round(((selectedStaff.workloadPct || 0) / 100) * selectedStaff.maxDailyMinutes);

    // Hard Constraint Validation (Section 4.3)
    if (editMaxMinutes < currentAssignedMin) {
      setEditError(
        `Không thể đặt trần thời lượng ngày (${editMaxMinutes} phút) thấp hơn số phút đã phân công (${currentAssignedMin} phút).`
      );
      return;
    }

    const skillsArr = editSkillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (skillsArr.length === 0) {
      setEditError('Nhân sự phải có ít nhất 1 kỹ năng chuyên môn.');
      return;
    }

    const newWorkloadPct = Math.round((currentAssignedMin / editMaxMinutes) * 100);
    const updated: MedicalStaff = {
      ...selectedStaff,
      zone: editZone.trim() || selectedStaff.zone,
      skills: skillsArr,
      specialty: skillsArr[0],
      maxDailyMinutes: editMaxMinutes,
      workloadPct: newWorkloadPct,
      shiftStart: editShiftStart,
      shiftEnd: editShiftEnd,
      isOnApprovedLeave: editIsInactive,
      leaveWindowText: editIsInactive ? 'Tạm ngưng nhận ca / Nghỉ phép' : undefined,
    };

    if (onUpdateStaff) {
      onUpdateStaff(updated);
    }
    setIsEditingStaff(false);
    setEditError(null);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setAvailabilityFilter('ALL');
    setSkillFilter('ALL');
    setActiveStatusFilter('ALL');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    availabilityFilter !== 'ALL' ||
    skillFilter !== 'ALL' ||
    activeStatusFilter !== 'ALL';

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddStaff) {
      setAddModalOpen(false);
      return;
    }
    const nextIdx = staffList.length + 1;
    const skillsArr = newSkillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onAddStaff({
      id: `EMP-${String(nextIdx).padStart(2, '0')}`,
      name: newName.trim() || `Nhân viên #${nextIdx}`,
      role: newRole,
      specialty: skillsArr[0] || 'Chăm sóc tổng quát',
      skills: skillsArr.length > 0 ? skillsArr : ['Chăm sóc vết thương'],
      avatarColor: '#2F6F64',
      zone: newZone,
      baseLocation: { lat: 12.2388, lng: 109.1967 },
      baseAddress: `Trạm Y tế ${newZone}, Nha Trang`,
      shiftStart: '07:30',
      shiftEnd: '17:30',
      maxDailyMinutes: 480,
      assignedMinutes: 0,
      workloadPct: 0,
      assignedCount: 0,
    });
    setAddModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* 3.1 Page Header */}
      <PageHeader
        title="Đội ngũ Nhân sự (Care Team)"
        subtitle="Theo dõi lịch trực khả dụng, chứng chỉ kỹ năng chuyên môn và tải công việc hàng ngày"
        actions={
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[#253438] text-[13px] font-medium hover:border-[#2F6F64] hover:text-[#2F6F64] transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            + Thêm Nhân sự
          </button>
        }
      />

      {/* 3.2 Summary Metrics (3 Compact KPI Cards in One Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Nhân sự Đang hoạt động (Active Staff)"
          value={activeStaffCount}
          sublabel={`Trên tổng số ${staffList.length} nhân sự trong danh sách`}
          tone="default"
          icon={<Users className="w-4 h-4" />}
          onClick={() => setActiveStatusFilter('Active')}
        />
        <KpiCard
          label="Sẵn sàng Nhận ca (Available Staff)"
          value={availableStaffCount}
          sublabel="Còn trống khung giờ và dung lượng thời gian"
          tone="teal"
          icon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => setAvailabilityFilter('Available')}
        />
        <KpiCard
          label="Tải công việc Cao (High Workload)"
          value={highWorkloadCount}
          sublabel="Đã gán >= 78% trần thời lượng 480 phút/ngày"
          tone={highWorkloadCount > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="w-4 h-4" />}
          onClick={() => setAvailabilityFilter('Fully Booked')}
        />
      </div>

      {/* 3.3 Search and Filters Toolbar */}
      <div className="bg-white rounded-[10px] border border-[#E1E9E6] p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[230px] max-w-sm">
          <Search className="w-4 h-4 text-[#687A78] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên nhân sự, mã EMP, chức danh hoặc khu vực..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] text-[13px] text-[#253438] focus:bg-white focus:border-[#2F6F64] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Availability filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Mức khả dụng</option>
            <option value="Available">Sẵn sàng (Available)</option>
            <option value="Partially Busy">Bận một phần (Partially Busy)</option>
            <option value="Fully Booked">Kín lịch (Fully Booked)</option>
            <option value="Unavailable">Không khả dụng (Unavailable)</option>
          </select>

          {/* Skill filter */}
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Kỹ năng chuyên môn</option>
            {allSkills.map((sk) => (
              <option key={sk} value={sk}>
                {sk}
              </option>
            ))}
          </select>

          {/* Active status filter */}
          <select
            value={activeStatusFilter}
            onChange={(e) =>
              setActiveStatusFilter(e.target.value as 'ALL' | 'Active' | 'Inactive')
            }
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="Active">Đang hoạt động (Active)</option>
            <option value="Inactive">Tạm ngưng (Inactive)</option>
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] text-[12px] font-medium text-[#687A78] hover:text-[#253438] hover:border-[#2F6F64] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* 3.4 Clean 6-Column Staff Table */}
      {filteredStaff.length === 0 ? (
        <EmptyStateCard
          title="Không tìm thấy nhân sự phù hợp với bộ lọc"
          description="Hãy xóa bộ lọc tìm kiếm hoặc thêm nhân sự mới vào đội ngũ chăm sóc."
          actionLabel="Xóa Bộ lọc"
          onAction={handleClearFilters}
        />
      ) : (
        <div className="bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E1E9E6] bg-[#F7FAF9] text-[12px] font-semibold text-[#687A78]">
                  <th className="py-3 px-4">Nhân sự Y tế (Staff Member)</th>
                  <th className="py-3 px-4">Kỹ năng (Skills)</th>
                  <th className="py-3 px-4">Mức Khả dụng (Availability)</th>
                  <th className="py-3 px-4">Tải Công việc Ngày (Daily Workload)</th>
                  <th className="py-3 px-4">Trạng thái (Status)</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E9E6] text-[13px]">
                {filteredStaff.map((staff) => {
                  const assignedMin =
                    staff.assignedMinutes ??
                    Math.round(((staff.workloadPct || 0) / 100) * staff.maxDailyMinutes);
                  const remainingMin = Math.max(0, staff.maxDailyMinutes - assignedMin);
                  const visibleSkills = staff.skills.slice(0, 2);
                  const extraSkillsCount = Math.max(0, staff.skills.length - 2);
                  const availabilityState = computeAvailabilityState(staff);
                  const isActive = !staff.isOnApprovedLeave;
                  const isHighWorkload = staff.workloadPct >= 80;

                  return (
                    <tr
                      key={staff.id}
                      onClick={() => handleOpenStaffDetail(staff)}
                      className={`transition-colors cursor-pointer ${
                        selectedStaffId === staff.id
                          ? 'bg-[#E5F1EC]/60'
                          : 'hover:bg-[#F7FAF9]'
                      }`}
                    >
                      {/* 1. Staff Member */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
                            style={{ backgroundColor: staff.avatarColor || '#2F6F64' }}
                          >
                            {staff.name.slice(-2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[#253438]">{staff.name}</div>
                            <div className="text-[11px] text-[#687A78]">
                              <span className="font-mono-num font-medium text-[#2F6F64]">
                                {staff.id}
                              </span>{' '}
                              · {staff.role} · {staff.zone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Skills (max 2 chips + +N) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {visibleSkills.map((sk) => (
                            <span
                              key={sk}
                              className="px-2 py-0.5 rounded bg-[#F7FAF9] border border-[#E1E9E6] text-[11px] text-[#253438]"
                            >
                              {sk}
                            </span>
                          ))}
                          {extraSkillsCount > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-[#E5F1EC] text-[#2F6F64] text-[11px] font-semibold"
                              title={staff.skills.slice(2).join(', ')}
                            >
                              +{extraSkillsCount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Availability (distinct from Active Status) */}
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="space-y-1">
                          <div>{renderAvailabilityBadge(availabilityState)}</div>
                          <div className="text-[11px] text-[#687A78] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#2F6F64]" />
                            {staff.isOnApprovedLeave ? (
                              <span>{staff.leaveWindowText || 'Nghỉ ca hôm nay'}</span>
                            ) : (
                              <span>
                                Ca trực: {staff.shiftStart} – {staff.shiftEnd}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Daily Workload */}
                      <td className="py-3.5 px-4 w-[240px]">
                        <div className="flex items-center justify-between text-[11px] tabular-nums mb-1">
                          <span className="font-semibold text-[#253438]">
                            {assignedMin} / {staff.maxDailyMinutes} phút ({staff.workloadPct}%)
                          </span>
                          {isHighWorkload ? (
                            <span className="text-[#C03A47] font-semibold inline-flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Tải cao
                            </span>
                          ) : (
                            <span className="text-[#687A78]">Trống {remainingMin}p</span>
                          )}
                        </div>
                        <div className="w-full h-2 bg-[#E1E9E6] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              staff.workloadPct >= 85
                                ? 'bg-[#D85D68]'
                                : staff.workloadPct >= 75
                                ? 'bg-[#E6A64B]'
                                : 'bg-[#2F6F64]'
                            }`}
                            style={{ width: `${Math.min(100, staff.workloadPct)}%` }}
                          />
                        </div>
                      </td>

                      {/* 5. Status (Active / Inactive) */}
                      <td className="py-3.5 px-4">{renderActiveStatusBadge(isActive)}</td>

                      {/* 6. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenStaffDetail(staff);
                          }}
                          className="px-2.5 py-1 rounded border border-[#E1E9E6] bg-white text-[12px] font-medium text-[#2F6F64] hover:border-[#2F6F64] cursor-pointer"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3.5 Staff Detail Drawer (Right-Side, 420px–480px) with 3 Tabs */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#253438]/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[470px] bg-white h-full shadow-xl border-l border-[#E1E9E6] flex flex-col">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-[#E1E9E6] bg-[#F7FAF9] shrink-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[14px] shrink-0"
                    style={{ backgroundColor: selectedStaff.avatarColor || '#2F6F64' }}
                  >
                    {selectedStaff.name.slice(-2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#253438] m-0">
                      {selectedStaff.name}
                    </h3>
                    <p className="text-[12px] text-[#687A78] m-0">
                      <span className="font-mono-num font-semibold text-[#2F6F64]">
                        {selectedStaff.id}
                      </span>{' '}
                      · {selectedStaff.role}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStaffId(null)}
                  className="p-1.5 rounded-lg text-[#687A78] hover:text-[#253438] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {renderActiveStatusBadge(!selectedStaff.isOnApprovedLeave)}
                  {renderAvailabilityBadge(computeAvailabilityState(selectedStaff))}
                </div>
                <button
                  type="button"
                  onClick={() => handleStartEditStaff(selectedStaff)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E1E9E6] bg-white text-[12px] font-medium text-[#2F6F64] hover:border-[#2F6F64] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Chỉnh sửa
                </button>
              </div>

              {/* 3 Tabs inside Drawer */}
              <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-[#E1E9E6]">
                {(
                  [
                    { key: 'Overview', label: 'Tổng quan (Overview)' },
                    { key: 'Availability', label: 'Lịch trực (Availability)' },
                    {
                      key: 'Assignments',
                      label: `Ca khám (${selectedStaffVisits.length})`,
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setDrawerTab(t.key);
                      setIsEditingStaff(false);
                    }}
                    className={`py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                      drawerTab === t.key
                        ? 'bg-[#2F6F64] text-white font-semibold'
                        : 'text-[#687A78] hover:text-[#253438]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isEditingStaff ? (
                /* Inline Edit Staff / Edit Availability Form */
                <form onSubmit={handleSaveStaffEdit} className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E1E9E6]">
                    <span className="text-[13px] font-semibold text-[#253438]">
                      Cập nhật Thông tin & Lịch khả dụng ({selectedStaff.id})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingStaff(false)}
                      className="text-[12px] text-[#687A78] cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>

                  {editError && (
                    <div className="p-3 rounded-lg bg-[#FDF2F3] border border-[#F2C6CB] text-[12px] text-[#C03A47] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{editError}</span>
                    </div>
                  )}

                  {editIsInactive && selectedStaffVisits.length > 0 && (
                    <div className="p-3 rounded-lg bg-[#FDF6EC] border border-[#F3D9B1] text-[12px] text-[#B87514] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Cảnh báo Ràng buộc: Nhân sự này đang có{' '}
                        <strong>{selectedStaffVisits.length} ca phân công</strong> trong ngày. Chuyển
                        sang Tạm ngưng (Inactive) sẽ chặn phân công mới và đánh dấu cần điều phối lại.
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-medium text-[#253438] mb-1">
                      Khu vực phụ trách chính (Primary Zone)
                    </label>
                    <input
                      type="text"
                      value={editZone}
                      onChange={(e) => setEditZone(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#253438] mb-1">
                      Kỹ năng chuyên môn (phân cách bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={editSkillsText}
                      onChange={(e) => setEditSkillsText(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#253438] mb-1">
                        Giờ bắt đầu ca
                      </label>
                      <input
                        type="time"
                        value={editShiftStart}
                        onChange={(e) => setEditShiftStart(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#253438] mb-1">
                        Giờ kết thúc ca
                      </label>
                      <input
                        type="time"
                        value={editShiftEnd}
                        onChange={(e) => setEditShiftEnd(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px] tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#253438] mb-1">
                      Trần thời lượng tối đa/ngày (phút) — Đã gán:{' '}
                      {selectedStaff.assignedMinutes ?? 0}p
                    </label>
                    <input
                      type="number"
                      min={60}
                      max={600}
                      value={editMaxMinutes}
                      onChange={(e) => setEditMaxMinutes(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px] tabular-nums"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-[#253438]">
                        Trạng thái Hoạt động (Active Status)
                      </div>
                      <div className="text-[11px] text-[#687A78]">
                        Nhân sự Inactive sẽ không được AI gợi ý phân công
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditIsInactive((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer ${
                        !editIsInactive
                          ? 'bg-[#EBF6F1] text-[#2E755D] border-[#C5E2D7]'
                          : 'bg-[#FDF2F3] text-[#C03A47] border-[#F2C6CB]'
                      }`}
                    >
                      {!editIsInactive ? 'Đang hoạt động (Active)' : 'Tạm ngưng (Inactive)'}
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingStaff(false)}
                      className="px-3.5 py-2 rounded-lg border border-[#E1E9E6] text-[13px] cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold cursor-pointer"
                    >
                      Lưu Cập nhật
                    </button>
                  </div>
                </form>
              ) : drawerTab === 'Overview' ? (
                /* TAB 1: Overview */
                <>
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Chức danh & Khu vực Phụ trách
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Chức danh chuyên môn:</span>
                        <span className="font-semibold text-[#253438]">{selectedStaff.role}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Khu vực chính (Primary Zone):</span>
                        <span className="font-medium text-[#253438] inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#2F6F64]" />
                          {selectedStaff.zone}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#687A78]">Trạm xuất phát:</span>
                        <span className="text-[#253438] text-right">
                          {selectedStaff.baseAddress}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Kỹ năng & Chứng chỉ Đủ Điều kiện (Qualified Skills)
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] flex flex-wrap gap-1.5">
                      {selectedStaff.skills.map((sk) => (
                        <span
                          key={sk}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#E1E9E6] text-[12px] font-medium text-[#253438]"
                        >
                          <Stethoscope className="w-3.5 h-3.5 text-[#2F6F64]" />
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Workload & Remaining Capacity */}
                  {(() => {
                    const assignedMin =
                      selectedStaff.assignedMinutes ??
                      Math.round(
                        ((selectedStaff.workloadPct || 0) / 100) * selectedStaff.maxDailyMinutes
                      );
                    const remainingMin = Math.max(0, selectedStaff.maxDailyMinutes - assignedMin);
                    return (
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                          Tải Công việc & Dung lượng Còn lại (Daily Capacity)
                        </div>
                        <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2.5">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded bg-white border border-[#E1E9E6]">
                              <span className="block text-[11px] text-[#687A78]">Trần tối đa</span>
                              <strong className="text-[14px] text-[#253438] tabular-nums">
                                {selectedStaff.maxDailyMinutes}p
                              </strong>
                            </div>
                            <div className="p-2 rounded bg-white border border-[#E1E9E6]">
                              <span className="block text-[11px] text-[#687A78]">Đã phân công</span>
                              <strong className="text-[14px] text-[#2F6F64] tabular-nums">
                                {assignedMin}p
                              </strong>
                            </div>
                            <div className="p-2 rounded bg-white border border-[#E1E9E6]">
                              <span className="block text-[11px] text-[#687A78]">Còn trống</span>
                              <strong className="text-[14px] text-[#253438] tabular-nums">
                                {remainingMin}p
                              </strong>
                            </div>
                          </div>

                          <div className="w-full h-2.5 bg-[#E1E9E6] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                selectedStaff.workloadPct >= 85
                                  ? 'bg-[#D85D68]'
                                  : selectedStaff.workloadPct >= 75
                                  ? 'bg-[#E6A64B]'
                                  : 'bg-[#2F6F64]'
                              }`}
                              style={{ width: `${Math.min(100, selectedStaff.workloadPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Operational Notes */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Ghi chú Vận hành (Operational Notes)
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] text-[12px] text-[#253438] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[#2E755D] font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Tuân thủ quy tắc 6 ràng buộc cứng khi điều phối tự động</span>
                      </div>
                      <p className="text-[#687A78] m-0">
                        {selectedStaff.isOnApprovedLeave
                          ? `Nhân sự đang tạm ngưng nhận ca (${selectedStaff.leaveWindowText}).`
                          : `Phụ trách chính tại ${selectedStaff.zone}, ưu tiên các ca ${selectedStaff.specialty}.`}
                      </p>
                    </div>
                  </div>
                </>
              ) : drawerTab === 'Availability' ? (
                /* TAB 2: Availability */
                <>
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Khung Giờ Làm việc Hôm nay (Working Hours)
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] flex items-center justify-between text-[13px]">
                      <span className="text-[#687A78] inline-flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#2F6F64]" />
                        Ca trực tiêu chuẩn:
                      </span>
                      <span className="font-semibold text-[#253438] tabular-nums">
                        {selectedStaff.shiftStart} – {selectedStaff.shiftEnd}
                      </span>
                    </div>
                  </div>

                  {/* Available Time Windows */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#2F6F64]">
                      Khung giờ Trống Khả dụng (Available Time Windows)
                    </div>
                    {calculatedAvailableWindows.length === 0 ? (
                      <div className="p-3.5 rounded-lg bg-[#FDF2F3] border border-[#F2C6CB] text-[12px] text-[#C03A47]">
                        Không còn khoảng trống khả dụng trong ca trực hôm nay.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {calculatedAvailableWindows.map((win, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-[#EBF6F1] border border-[#C5E2D7] flex items-center justify-between text-[12px]"
                          >
                            <span className="font-mono-num font-semibold text-[#2E755D]">
                              {win.start} – {win.end}
                            </span>
                            <span className="text-[#2E755D] tabular-nums">
                              Trống {win.durationMin} phút
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Busy / Unavailable Slots */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Khung giờ Đã Kín lịch / Không Khả dụng (Busy & Blocked Slots)
                    </div>
                    {selectedStaff.isOnApprovedLeave ? (
                      <div className="p-3 rounded-lg bg-[#FDF2F3] border border-[#F2C6CB] text-[12px] text-[#C03A47]">
                        {selectedStaff.leaveWindowText || 'Nghỉ phép cả ngày đã duyệt'}
                      </div>
                    ) : selectedStaffVisits.length === 0 ? (
                      <div className="p-3 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] text-[12px] text-[#687A78]">
                        Chưa có khung giờ nào bị khóa trong ngày.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedStaffVisits.map((v) => (
                          <div
                            key={v.id}
                            className="p-2.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] flex items-center justify-between text-[12px]"
                          >
                            <span className="font-mono-num font-semibold text-[#253438]">
                              {v.startTime} – {v.endTime}
                            </span>
                            <span className="text-[#687A78] truncate max-w-[220px]">
                              Bận ca {v.id} ({v.patientName})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* TAB 3: Assignments */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                      Danh sách Ca Đã phân công Hôm nay ({selectedStaffVisits.length})
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffId(null);
                          onNavigate('/dispatch');
                        }}
                        className="text-[12px] font-medium text-[#2F6F64] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        Mở Bảng Điều phối
                      </button>
                    )}
                  </div>

                  {selectedStaffVisits.length === 0 ? (
                    <div className="p-5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] text-[12px] text-[#687A78] text-center">
                      Chưa có ca chăm sóc nào được phân công cho nhân sự này hôm nay.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedStaffVisits.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => {
                            if (onNavigate) {
                              setSelectedStaffId(null);
                              onNavigate('/dispatch');
                            }
                          }}
                          className={`p-3.5 rounded-lg border transition-colors cursor-pointer ${
                            v.isConflict
                              ? 'bg-[#FDF2F3] border-[#F2C6CB] hover:border-[#D85D68]'
                              : 'bg-[#F7FAF9] border-[#E1E9E6] hover:border-[#2F6F64]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-num text-[12px] font-semibold text-[#2F6F64]">
                                {v.id}
                              </span>
                              <span className="font-mono-num text-[12px] font-semibold text-[#253438] bg-white px-2 py-0.5 rounded border border-[#E1E9E6]">
                                {v.startTime} – {v.endTime}
                              </span>
                            </div>
                            <StatusBadge status={v.isConflict ? 'Conflict' : v.status} />
                          </div>

                          <div className="text-[13px] font-semibold text-[#253438] mt-1.5">
                            {v.serviceName}
                          </div>

                          <div className="flex items-center justify-between text-[12px] text-[#687A78] mt-1">
                            <span>
                              {v.patientName} · {v.district}
                            </span>
                            <span className="tabular-nums font-medium text-[#2F6F64] inline-flex items-center gap-1">
                              {v.predictedDurationMin} phút
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleStartEditStaff(selectedStaff)}
                className="px-3.5 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] font-medium text-[#253438] hover:border-[#2F6F64] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Cập nhật Hồ sơ / Lịch trực
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffId(null);
                    onNavigate('/dispatch');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold hover:bg-[#255A51] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CalendarClock className="w-4 h-4" />
                  Xem Lịch Điều phối
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#253438]/30 p-4">
          <form
            onSubmit={handleCreateStaff}
            className="bg-white rounded-[12px] border border-[#E1E9E6] max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-[16px] font-semibold text-[#253438] m-0">
              Thêm Nhân sự Y tế Mới
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Họ tên & Học vị *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Chức danh Chuyên môn
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as MedicalStaff['role'])}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px]"
                >
                  <option value="Điều dưỡng Chuyên khoa">Điều dưỡng Chuyên khoa</option>
                  <option value="Bác sĩ Gia đình">Bác sĩ Gia đình</option>
                  <option value="Chuyên viên Vật lý trị liệu">Chuyên viên Vật lý trị liệu</option>
                  <option value="Điều dưỡng Chăm sóc">Điều dưỡng Chăm sóc</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Khu vực Phụ trách Chính (Phường)
                </label>
                <input
                  type="text"
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Chứng chỉ Kỹ năng (phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={newSkillsText}
                  onChange={(e) => setNewSkillsText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold cursor-pointer"
              >
                Lưu Nhân sự
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
