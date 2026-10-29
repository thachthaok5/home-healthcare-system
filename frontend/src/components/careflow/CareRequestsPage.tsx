import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowUpDown,
  X,
  Clock,
  MapPin,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  RotateCcw,
  Edit3,
  ExternalLink,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  DispatchAssignment,
  UnassignedRequest,
} from '../../types/healthcare';
import {
  PageHeader,
  PriorityBadge,
  StatusBadge,
  CareFlowRoute,
  EmptyStateCard,
  KpiCard,
} from './SharedUI';
import { NewRequestDrawer } from './NewRequestDrawer';

export interface CareRequestsPageProps {
  selectedDate: string;
  onDateChange: (d: string) => void;
  unassignedRequests: UnassignedRequest[];
  assignments: DispatchAssignment[];
  onOpenNewRequest: () => void;
  onUpdateRequest?: (updated: Partial<UnassignedRequest>, sendToAI?: boolean) => void;
  onNavigate: (route: CareFlowRoute, requestId?: string) => void;
}

export type CareRequestOperationalStatus =
  | 'Ready for AI'
  | 'Needs Review'
  | 'New'
  | 'Assigned'
  | 'Completed'
  | 'Cancelled';

interface ReadinessCheckItem {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface UnifiedRequestItem {
  id: string;
  createdAtText: string;
  patientName: string;
  patientAge: number;
  patientPhone?: string;
  serviceName: string;
  serviceCategory: string;
  requestedDate: string;
  requestedTime: string;
  windowStart: string;
  windowEnd: string;
  district: string;
  address: string;
  priority: 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn';
  operationalStatus: CareRequestOperationalStatus;
  rawStatus: string;
  requiredSkills: string[];
  standardDurationMin: number;
  predictedDurationMin: number;
  clinicalNotes: string;
  assignedStaffName?: string;
  isUnassigned: boolean;
  eligibleStaffCount: number;
  readinessChecks: ReadinessCheckItem[];
  isReadyForAI: boolean;
}

const SUPPORTED_ZONES = [
  'Phường Lộc Thọ',
  'Phường Tân Lập',
  'Phường Phước Tiến',
  'Phường Vĩnh Nguyên',
  'Phường Vĩnh Hải',
  'Phường Phước Hải',
  'Phường Vạn Thạnh',
  'Phường Phương Sài',
];

const renderCareRequestStatusBadge = (status: CareRequestOperationalStatus) => {
  switch (status) {
    case 'Ready for AI':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E5F1EC] text-[#2F6F64] border border-[#B8D9CE]">
          <Sparkles className="w-3 h-3" />
          Sẵn sàng AI
        </span>
      );
    case 'Needs Review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FDF6EC] text-[#B87514] border border-[#F3D9B1]">
          <AlertTriangle className="w-3 h-3" />
          Cần rà soát
        </span>
      );
    case 'New':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7FAF9] text-[#253438] border border-[#CBD8D3]">
          Mới tiếp nhận
        </span>
      );
    case 'Assigned':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EBF6F1] text-[#2E755D] border border-[#C5E2D7]">
          <CheckCircle2 className="w-3 h-3" />
          Đã phân công
        </span>
      );
    case 'Completed':
      return <StatusBadge status="Completed" />;
    case 'Cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FDF2F3] text-[#C03A47] border border-[#F2C6CB]">
          Đã hủy
        </span>
      );
  }
};

export const CareRequestsPage: React.FC<CareRequestsPageProps> = ({
  selectedDate,
  onDateChange,
  unassignedRequests,
  assignments,
  onOpenNewRequest,
  onUpdateRequest,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'id' | 'requestedTime' | 'priority'>('requestedTime');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<Partial<UnassignedRequest> | null>(null);

  const pageSize = 8;

  const unifiedList: UnifiedRequestItem[] = useMemo(() => {
    const computeReadiness = (
      skills: string[],
      winStart: string,
      winEnd: string,
      durationMin: number,
      district: string,
      eligibleCount: number
    ): ReadinessCheckItem[] => {
      const toMins = (t: string) => {
        const [h, m] = (t || '').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const sM = toMins(winStart);
      const eM = toMins(winEnd);
      const hasSkill = skills && skills.length > 0;
      const validWindow = sM < eM && eM - sM >= 20;
      const validDuration = durationMin > 0 && durationMin <= 480;
      const areaSupported = SUPPORTED_ZONES.some((z) =>
        district.toLowerCase().includes(z.toLowerCase().replace('phường ', ''))
      );
      const hasEligibleStaff = eligibleCount > 0;

      return [
        {
          key: 'skill',
          label: 'Đã xác định kỹ năng bắt buộc',
          passed: hasSkill,
          detail: hasSkill ? skills.join(', ') : 'Thiếu thông tin chứng chỉ / kỹ năng',
        },
        {
          key: 'window',
          label: 'Khung giờ hẹn hợp lệ',
          passed: validWindow,
          detail: validWindow ? `${winStart} – ${winEnd}` : 'Khung giờ bắt đầu/kết thúc chưa hợp lệ',
        },
        {
          key: 'duration',
          label: 'Thời lượng trong định mức cho phép',
          passed: validDuration,
          detail: `${durationMin} phút (Giới hạn <= 480 phút)`,
        },
        {
          key: 'area',
          label: 'Khu vực nằm trong phạm vi phục vụ',
          passed: areaSupported,
          detail: areaSupported ? district : `${district} (Ngoài vùng trạm cơ sở)`,
        },
        {
          key: 'eligible_staff',
          label: 'Có nhân sự khả dụng đáp ứng ràng buộc',
          passed: hasEligibleStaff,
          detail: hasEligibleStaff
            ? `${eligibleCount} ứng viên vượt qua 6 ràng buộc cứng`
            : 'Chưa có nhân sự thỏa mãn đồng thời 6 ràng buộc cứng',
        },
      ];
    };

    const fromUnassigned: UnifiedRequestItem[] = unassignedRequests.map((r, idx) => {
      const eligibleCount = r.aiCandidates.filter((c) => c.isEligible).length;
      const parts = (r.requestedWindow || '09:00 - 10:30').split('-').map((s) => s.trim());
      const winStart = r.windowStart || parts[0] || '09:00';
      const winEnd = r.windowEnd || parts[1] || '10:30';
      const checks = computeReadiness(
        r.requiredSkills,
        winStart,
        winEnd,
        r.predictedDurationMin,
        r.district,
        eligibleCount
      );
      const isReady = checks.every((c) => c.passed);

      const opStatus: CareRequestOperationalStatus = !isReady
        ? 'Needs Review'
        : idx === 0 && r.id.startsWith('REQ-3')
        ? 'New'
        : 'Ready for AI';

      return {
        id: r.id,
        createdAtText: `${selectedDate} · 07:${String(15 + (idx * 7) % 40).padStart(2, '0')}`,
        patientName: r.patientName,
        patientAge: r.patientAge,
        patientPhone: r.patientPhone,
        serviceName: r.serviceName,
        serviceCategory: r.serviceCategory,
        requestedDate: selectedDate,
        requestedTime: r.requestedWindow,
        windowStart: winStart,
        windowEnd: winEnd,
        district: r.district,
        address: r.address,
        priority: r.priority,
        operationalStatus: opStatus,
        rawStatus: r.status,
        requiredSkills: r.requiredSkills,
        standardDurationMin: r.standardDurationMin,
        predictedDurationMin: r.predictedDurationMin,
        clinicalNotes:
          r.clinicalNotes ||
          `Chuẩn bị ${r.specializedEquipment?.[0] || 'bộ chăm sóc tiêu chuẩn'} tại nhà bệnh nhân.`,
        isUnassigned: true,
        eligibleStaffCount: eligibleCount,
        readinessChecks: checks,
        isReadyForAI: isReady,
      };
    });

    const fromAssigned: UnifiedRequestItem[] = assignments.map((a, idx) => {
      const checks = computeReadiness(
        [a.serviceCategory],
        a.startTime,
        a.endTime,
        a.predictedDurationMin,
        a.district,
        a.isConflict ? 0 : 1
      );
      const opStatus: CareRequestOperationalStatus = a.isConflict
        ? 'Needs Review'
        : a.status === 'Completed'
        ? 'Completed'
        : 'Assigned';

      return {
        id: a.id,
        createdAtText: `${selectedDate} · 06:${String(30 + (idx * 5) % 28).padStart(2, '0')}`,
        patientName: a.patientName,
        patientAge: a.patientAge,
        serviceName: a.serviceName,
        serviceCategory: a.serviceCategory,
        requestedDate: selectedDate,
        requestedTime: `${a.startTime} - ${a.endTime}`,
        windowStart: a.startTime,
        windowEnd: a.endTime,
        district: a.district,
        address: a.address,
        priority: a.priority,
        operationalStatus: opStatus,
        rawStatus: a.isConflict ? 'Conflict' : a.status,
        requiredSkills: [a.serviceCategory],
        standardDurationMin: a.standardDurationMin,
        predictedDurationMin: a.predictedDurationMin,
        clinicalNotes: a.isConflict
          ? `Cảnh báo trùng lịch ${a.conflictDetail?.overlapMinutes || 15} phút trên lộ trình của ${a.staffName}.`
          : `Đã phân công cho ${a.staffName} (${a.distanceKm} km, ~${a.travelMinutes} phút di chuyển).`,
        assignedStaffName: a.staffName,
        isUnassigned: false,
        eligibleStaffCount: a.isConflict ? 0 : 1,
        readinessChecks: checks,
        isReadyForAI: !a.isConflict,
      };
    });

    return [...fromUnassigned, ...fromAssigned];
  }, [unassignedRequests, assignments, selectedDate]);

  // 2.2 Summary metrics (3 KPI cards)
  const totalRequestsCount = unifiedList.length;
  const unassignedCount = unifiedList.filter((r) => r.isUnassigned).length;
  const needsReviewCount = unifiedList.filter(
    (r) => r.operationalStatus === 'Needs Review'
  ).length;

  const serviceCategories = useMemo(() => {
    const s = new Set<string>();
    unifiedList.forEach((item) => s.add(item.serviceCategory));
    return Array.from(s);
  }, [unifiedList]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = unifiedList.filter((item) => {
      if (
        q &&
        !item.id.toLowerCase().includes(q) &&
        !item.patientName.toLowerCase().includes(q) &&
        !item.serviceName.toLowerCase().includes(q) &&
        !item.district.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && item.operationalStatus !== statusFilter) return false;
      if (priorityFilter !== 'ALL') {
        if (priorityFilter === 'Urgent' && item.priority !== 'Khẩn cấp') return false;
        if (priorityFilter === 'High' && item.priority !== 'Cao') return false;
        if (priorityFilter === 'Normal' && item.priority !== 'Tiêu chuẩn') return false;
      }
      if (serviceFilter !== 'ALL' && item.serviceCategory !== serviceFilter) return false;
      return true;
    });

    const priorityRank: Record<string, number> = {
      'Khẩn cấp': 1,
      Cao: 2,
      'Tiêu chuẩn': 3,
    };

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') {
        cmp = a.id.localeCompare(b.id);
      } else if (sortField === 'requestedTime') {
        cmp = a.requestedTime.localeCompare(b.requestedTime);
      } else {
        cmp = (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [unifiedList, searchQuery, statusFilter, priorityFilter, serviceFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginatedRows = filteredAndSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const selectedDetail = useMemo(
    () => unifiedList.find((r) => r.id === selectedRequestId) || null,
    [unifiedList, selectedRequestId]
  );

  const toggleSort = (field: 'id' | 'requestedTime' | 'priority') => {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setServiceFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    serviceFilter !== 'ALL';

  const handleEditSelectedRequest = (row: UnifiedRequestItem) => {
    const rawUnassigned = unassignedRequests.find((r) => r.id === row.id);
    if (rawUnassigned) {
      setEditingRequest(rawUnassigned);
    } else {
      setEditingRequest({
        id: row.id,
        patientName: row.patientName,
        patientAge: row.patientAge,
        patientPhone: row.patientPhone || '0905 412 889',
        serviceName: row.serviceName,
        serviceCategory: row.serviceCategory,
        district: row.district,
        address: row.address,
        requestedWindow: row.requestedTime,
        windowStart: row.windowStart,
        windowEnd: row.windowEnd,
        standardDurationMin: row.standardDurationMin,
        predictedDurationMin: row.predictedDurationMin,
        priority: row.priority,
        requiredSkills: row.requiredSkills,
        clinicalNotes: row.clinicalNotes,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* 2.1 Page Header */}
      <PageHeader
        title="Yêu cầu Chăm sóc (Care Requests)"
        subtitle="Quản lý yêu cầu chăm sóc y tế tại nhà và kiểm tra mức độ sẵn sàng trước khi điều phối"
        actions={
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2F6F64] text-white text-[13px] font-medium hover:bg-[#255A51] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Tạo Yêu cầu Mới
          </button>
        }
      />

      {/* 2.2 Summary Metrics (3 Compact KPI Cards in One Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Tổng Yêu cầu (Total Requests)"
          value={totalRequestsCount}
          sublabel={`Ngày vận hành ${selectedDate} · Tất cả ca trong ngày`}
          tone="default"
          icon={<ClipboardList className="w-4 h-4" />}
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
        />
        <KpiCard
          label="Chưa Phân công (Unassigned)"
          value={unassignedCount}
          sublabel={`${
            unifiedList.filter((r) => r.operationalStatus === 'Ready for AI').length
          } yêu cầu sẵn sàng gửi sang Đề xuất AI`}
          tone="teal"
          icon={<Sparkles className="w-4 h-4" />}
          onClick={() => {
            setStatusFilter('Ready for AI');
            setCurrentPage(1);
          }}
        />
        <KpiCard
          label="Cần Rà soát (Needs Review)"
          value={needsReviewCount}
          sublabel="Thiếu điều kiện sẵn sàng hoặc cảnh báo trùng lịch"
          tone={needsReviewCount > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="w-4 h-4" />}
          onClick={() => {
            setStatusFilter('Needs Review');
            setCurrentPage(1);
          }}
        />
      </div>

      {/* 2.3 Search and Filters Toolbar */}
      <div className="bg-white rounded-[10px] border border-[#E1E9E6] p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[230px] max-w-sm">
          <Search className="w-4 h-4 text-[#687A78] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Mã REQ, dịch vụ, bệnh nhân hoặc phường..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] text-[13px] text-[#253438] focus:bg-white focus:border-[#2F6F64] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="New">Mới tiếp nhận (New)</option>
            <option value="Ready for AI">Sẵn sàng AI (Ready for AI)</option>
            <option value="Needs Review">Cần rà soát (Needs Review)</option>
            <option value="Assigned">Đã phân công (Assigned)</option>
            <option value="Completed">Hoàn thành (Completed)</option>
            <option value="Cancelled">Đã hủy (Cancelled)</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Mức ưu tiên</option>
            <option value="Urgent">Khẩn cấp (Urgent)</option>
            <option value="High">Ưu tiên cao (High)</option>
            <option value="Normal">Tiêu chuẩn (Normal)</option>
          </select>

          {/* Service type filter */}
          <select
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
          >
            <option value="ALL">Tất cả Loại dịch vụ</option>
            {serviceCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Requested date filter */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]">
            <Calendar className="w-3.5 h-3.5 text-[#2F6F64]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent border-none outline-none tabular-nums text-[12px]"
            />
          </div>

          {/* Reset filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] text-[12px] font-medium text-[#687A78] hover:text-[#253438] hover:border-[#2F6F64] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* 2.4 Clean 7-Column Requests Table */}
      {filteredAndSorted.length === 0 ? (
        <EmptyStateCard
          title="Không có yêu cầu chăm sóc nào khớp bộ lọc hiện tại"
          description="Hãy đặt lại bộ lọc tìm kiếm hoặc tạo yêu cầu chăm sóc mới để bắt đầu điều phối."
          actionLabel="Đặt lại Bộ lọc"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E1E9E6] bg-[#F7FAF9] text-[12px] font-semibold text-[#687A78]">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('id')}
                      className="inline-flex items-center gap-1 hover:text-[#253438] cursor-pointer"
                    >
                      Mã Yêu cầu
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Loại Dịch vụ & Ghi chú</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('requestedTime')}
                      className="inline-flex items-center gap-1 hover:text-[#253438] cursor-pointer"
                    >
                      Khung giờ Yêu cầu
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Khu vực Phục vụ</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('priority')}
                      className="inline-flex items-center gap-1 hover:text-[#253438] cursor-pointer"
                    >
                      Mức Ưu tiên
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E9E6] text-[13px]">
                {paginatedRows.map((row) => {
                  const isSelected = selectedRequestId === row.id;
                  const isUrgent = row.priority === 'Khẩn cấp';
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRequestId(row.id)}
                      className={`transition-colors cursor-pointer ${
                        isUrgent
                          ? isSelected
                            ? 'bg-[#FDF2F3] outline outline-2 -outline-offset-2 outline-[#C03A47]'
                            : 'bg-[#FDF2F3]/55 outline outline-2 -outline-offset-2 outline-[#D85D68] hover:bg-[#FDF2F3]'
                          : isSelected
                          ? 'bg-[#E5F1EC]/60'
                          : 'hover:bg-[#F7FAF9]'
                      }`}
                    >
                      {/* 1. Request ID */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono-num font-semibold ${
                            isUrgent
                              ? 'px-2 py-0.5 rounded bg-[#C03A47] text-white'
                              : 'text-[#2F6F64]'
                          }`}
                        >
                          {row.id}
                        </span>
                        <div className="text-[11px] text-[#687A78] mt-0.5 tabular-nums">
                          {row.createdAtText}
                        </div>
                      </td>

                      {/* 2. Service Type */}
                      <td className="py-3.5 px-4 max-w-[270px]">
                        <div
                          className={`font-semibold truncate ${
                            isUrgent ? 'text-[#A32935]' : 'text-[#253438]'
                          }`}
                        >
                          {row.serviceName}
                        </div>
                        <div className="text-[12px] text-[#687A78] truncate">
                          {row.patientName} ({row.patientAge}t) · {row.serviceCategory}
                        </div>
                      </td>

                      {/* 3. Requested Time */}
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="font-medium text-[#253438]">{row.requestedTime}</div>
                        <div className="text-[11px] text-[#687A78]">
                          {row.requestedDate} · Dự kiến {row.predictedDurationMin} phút
                        </div>
                      </td>

                      {/* 4. Service Area */}
                      <td className="py-3.5 px-4 max-w-[190px]">
                        <div className="font-medium text-[#253438]">{row.district}</div>
                        <div className="text-[11px] text-[#687A78] truncate">{row.address}</div>
                      </td>

                      {/* 5. Priority */}
                      <td className="py-3.5 px-4">
                        <PriorityBadge
                          priority={row.priority}
                          showCountdown={isUrgent}
                          seedId={row.id}
                        />
                      </td>

                      {/* 6. Status */}
                      <td className="py-3.5 px-4">
                        {renderCareRequestStatusBadge(row.operationalStatus)}
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="inline-flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedRequestId(row.id)}
                            className="px-2.5 py-1 rounded border border-[#E1E9E6] bg-white text-[12px] font-medium text-[#253438] hover:border-[#2F6F64] hover:text-[#2F6F64] cursor-pointer"
                          >
                            Chi tiết
                          </button>
                          {row.isUnassigned ? (
                            <button
                              type="button"
                              disabled={!row.isReadyForAI}
                              onClick={() => onNavigate('/recommendations', row.id)}
                              title={
                                row.isReadyForAI
                                  ? 'Chuyển sang màn hình Đề xuất AI'
                                  : 'Cần rà soát điều kiện sẵn sàng trước khi gửi AI'
                              }
                              className={`px-2.5 py-1 rounded text-[12px] font-semibold inline-flex items-center gap-1 ${
                                row.isReadyForAI
                                  ? 'bg-[#E5F1EC] text-[#2F6F64] hover:bg-[#2F6F64] hover:text-white cursor-pointer'
                                  : 'bg-[#F7FAF9] text-[#687A78] border border-[#E1E9E6] opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              Đề xuất AI
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onNavigate('/dispatch')}
                              className="px-2.5 py-1 rounded border border-[#E1E9E6] bg-[#F7FAF9] text-[12px] font-medium text-[#2F6F64] hover:border-[#2F6F64] cursor-pointer"
                            >
                              Xem lịch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between text-[12px] text-[#687A78]">
            <span className="tabular-nums">
              Hiển thị {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredAndSorted.length)} trong tổng số{' '}
              {filteredAndSorted.length} yêu cầu
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-[#E1E9E6] bg-white text-[#253438] disabled:opacity-40 cursor-pointer"
              >
                Trước
              </button>
              <span className="px-2 font-medium text-[#253438] tabular-nums">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-[#E1E9E6] bg-white text-[#253438] disabled:opacity-40 cursor-pointer"
              >
                Tiếp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Request Detail Drawer (Right-Side, 420px–480px) */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#253438]/30 backdrop-blur-[1px]">
          <div
            className={`w-full max-w-[460px] bg-white h-full shadow-xl flex flex-col ${
              selectedDetail.priority === 'Khẩn cấp'
                ? 'border-l-4 border-l-[#D85D68]'
                : 'border-l border-[#E1E9E6]'
            }`}
          >
            {/* Drawer Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
                selectedDetail.priority === 'Khẩn cấp'
                  ? 'bg-[#FDF2F3] border-[#F2C6CB]'
                  : 'bg-[#F7FAF9] border-[#E1E9E6]'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-mono-num text-[12px] font-semibold px-2 py-0.5 rounded ${
                      selectedDetail.priority === 'Khẩn cấp'
                        ? 'bg-[#C03A47] text-white'
                        : 'text-[#2F6F64] bg-[#E5F1EC]'
                    }`}
                  >
                    {selectedDetail.id}
                  </span>
                  <PriorityBadge
                    priority={selectedDetail.priority}
                    showCountdown={selectedDetail.priority === 'Khẩn cấp'}
                    seedId={selectedDetail.id}
                  />
                  {renderCareRequestStatusBadge(selectedDetail.operationalStatus)}
                </div>
                <h3 className="text-[16px] font-semibold text-[#253438] m-0 mt-1.5">
                  {selectedDetail.serviceName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestId(null)}
                className="p-1.5 rounded-lg text-[#687A78] hover:text-[#253438] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content: Sections A, B, C */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* SECTION A — Request Overview */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                  A. Tổng quan Yêu cầu (Request Overview)
                </div>
                <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-[#687A78]">Mã yêu cầu & Thời điểm tạo:</span>
                    <span className="font-mono-num font-semibold text-[#253438]">
                      {selectedDetail.id} ({selectedDetail.createdAtText})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#687A78]">Người nhận chăm sóc:</span>
                    <span className="font-semibold text-[#253438]">
                      {selectedDetail.patientName} ({selectedDetail.patientAge} tuổi)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#687A78]">Nhóm dịch vụ:</span>
                    <span className="font-medium text-[#253438]">
                      {selectedDetail.serviceCategory}
                    </span>
                  </div>
                  {selectedDetail.assignedStaffName && (
                    <div className="flex justify-between pt-1.5 border-t border-[#E1E9E6]">
                      <span className="text-[#687A78]">Nhân sự đã phân công:</span>
                      <span className="font-semibold text-[#2F6F64]">
                        {selectedDetail.assignedStaffName}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#E1E9E6]">
                    <span className="text-[11px] text-[#687A78] block mb-0.5">
                      Ghi chú vận hành (Operational Notes):
                    </span>
                    <p className="text-[12px] text-[#253438] m-0 leading-relaxed">
                      {selectedDetail.clinicalNotes}
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION B — Scheduling Requirements */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                  B. Yêu cầu Lịch trình & Kỹ năng (Scheduling Requirements)
                </div>
                <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2.5 text-[13px]">
                  <div>
                    <span className="text-[11px] text-[#687A78] block mb-1">
                      Kỹ năng / Chứng chỉ bắt buộc:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Stethoscope className="w-4 h-4 text-[#2F6F64]" />
                      {selectedDetail.requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-0.5 rounded bg-white border border-[#E1E9E6] text-[12px] font-medium text-[#253438]"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E1E9E6] text-[12px]">
                    <div>
                      <span className="text-[#687A78] block text-[11px]">Ngày & Khung giờ hẹn</span>
                      <span className="font-semibold text-[#253438] tabular-nums inline-flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#2F6F64]" />
                        {selectedDetail.requestedTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#687A78] block text-[11px]">Thời lượng dự kiến</span>
                      <span className="font-semibold text-[#2F6F64] tabular-nums block mt-0.5">
                        {selectedDetail.predictedDurationMin} phút{' '}
                        <span className="text-[#687A78] font-normal">
                          (Chuẩn {selectedDetail.standardDurationMin}p)
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E1E9E6] flex items-start gap-2 text-[12px]">
                    <MapPin className="w-4 h-4 text-[#2F6F64] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[#253438]">{selectedDetail.district}</div>
                      <div className="text-[#687A78]">{selectedDetail.address}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION C — Readiness and Validation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
                    C. Kiểm tra Sẵn sàng Điều phối (Readiness & Validation)
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      selectedDetail.isReadyForAI
                        ? 'bg-[#EBF6F1] text-[#2E755D]'
                        : 'bg-[#FDF6EC] text-[#B87514]'
                    }`}
                  >
                    {selectedDetail.isReadyForAI ? 'Đạt 5/5 điều kiện' : 'Cần rà soát'}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2">
                  {selectedDetail.readinessChecks.map((chk) => (
                    <div
                      key={chk.key}
                      className={`p-2 rounded border flex items-start justify-between gap-2 text-[12px] ${
                        chk.passed
                          ? 'bg-white border-[#E1E9E6]'
                          : 'bg-[#FDF2F3] border-[#F2C6CB]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {chk.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#4D947B] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-[#D85D68] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div
                            className={`font-medium ${
                              chk.passed ? 'text-[#253438]' : 'text-[#C03A47]'
                            }`}
                          >
                            {chk.label}
                          </div>
                          <div className="text-[11px] text-[#687A78] tabular-nums">
                            {chk.detail}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!selectedDetail.isReadyForAI && (
                    <div className="p-2.5 rounded bg-[#FDF6EC] border border-[#F3D9B1] text-[12px] text-[#B87514] flex items-start gap-2 mt-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Chưa thể gửi sang phân công tự động do còn điều kiện chưa đạt. Vui lòng nhấn{' '}
                        <strong>Chỉnh sửa Yêu cầu</strong> để cập nhật khung giờ hoặc kỹ năng.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION D — Actions */}
            <div className="p-4 border-t border-[#E1E9E6] bg-[#F7FAF9] space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEditSelectedRequest(selectedDetail)}
                  className="px-3.5 py-2.5 rounded-lg border border-[#E1E9E6] bg-white text-[#253438] text-[13px] font-medium hover:border-[#2F6F64] hover:text-[#2F6F64] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  Chỉnh sửa Yêu cầu
                </button>

                {selectedDetail.isUnassigned ? (
                  <button
                    type="button"
                    disabled={!selectedDetail.isReadyForAI}
                    onClick={() => {
                      const id = selectedDetail.id;
                      setSelectedRequestId(null);
                      onNavigate('/recommendations', id);
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-2 ${
                      selectedDetail.isReadyForAI
                        ? 'bg-[#2F6F64] text-white hover:bg-[#255A51] cursor-pointer'
                        : 'bg-[#E1E9E6] text-[#687A78] cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Xem Đề xuất AI
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(null);
                      onNavigate('/dispatch');
                    }}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold hover:bg-[#255A51] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Xem Phân công trên Lịch
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Request Drawer */}
      <NewRequestDrawer
        open={Boolean(editingRequest)}
        onClose={() => setEditingRequest(null)}
        initialRequest={editingRequest}
        onSubmitRequest={(updated, sendToAI) => {
          if (onUpdateRequest) {
            onUpdateRequest(updated, sendToAI);
          }
          setEditingRequest(null);
        }}
      />
    </div>
  );
};
