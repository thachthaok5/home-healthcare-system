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
  User,
  ChevronDown,
  ChevronUp,
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

const formatDateVi = (isoDate: string): string => {
  if (!isoDate) return '';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return isoDate;
};

const renderCareRequestStatusBadge = (status: CareRequestOperationalStatus) => {
  switch (status) {
    case 'Ready for AI':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-100 text-brand-600 border border-brand-200 whitespace-nowrap shrink-0">
          <Sparkles className="w-3 h-3" />
          Sẵn sàng AI
        </span>
      );
    case 'Needs Review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-high-tint text-high-ink border border-high-line whitespace-nowrap shrink-0">
          <AlertTriangle className="w-3 h-3" />
          Cần rà soát
        </span>
      );
    case 'New':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-canvas text-ink border border-line-strong whitespace-nowrap shrink-0">
          Mới tiếp nhận
        </span>
      );
    case 'Assigned':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-ok-tint text-ok border border-brand-200 whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3" />
          Đã phân công
        </span>
      );
    case 'Completed':
      return <StatusBadge status="Completed" />;
    case 'Cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-urgent-tint text-urgent border border-urgent-line whitespace-nowrap shrink-0">
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
  const [sortField, setSortField] = useState<'id' | 'requestedTime' | 'priority'>('priority');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<Partial<UnassignedRequest> | null>(null);
  const [showReadinessDetails, setShowReadinessDetails] = useState<boolean>(false);

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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-[13px] font-medium hover:bg-brand-700 transition-colors cursor-pointer"
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
          tone="sun"
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
          tone="ai"
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
      <div className="bg-white rounded-[10px] border border-line p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[230px] max-w-sm">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Mã REQ, dịch vụ, bệnh nhân hoặc phường..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-line bg-canvas text-[13px] text-ink focus:bg-white focus:border-brand-600 outline-none"
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
            className="px-2.5 py-1.5 rounded-lg border border-line bg-white text-[12px] text-ink"
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
            className="px-2.5 py-1.5 rounded-lg border border-line bg-white text-[12px] text-ink"
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
            className="px-2.5 py-1.5 rounded-lg border border-line bg-white text-[12px] text-ink"
          >
            <option value="ALL">Tất cả Loại dịch vụ</option>
            {serviceCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Requested date filter */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-white text-[12px] text-ink">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-[12px] font-medium text-muted hover:text-ink hover:border-brand-600 cursor-pointer"
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
        <div className="bg-white rounded-[10px] border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas text-[12px] font-semibold text-muted">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('id')}
                      className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"
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
                      className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"
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
                      className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"
                    >
                      Mức Ưu tiên
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[13px]">
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
                            ? 'bg-urgent-tint outline outline-2 -outline-offset-2 outline-urgent'
                            : 'bg-urgent-tint/55 outline outline-2 -outline-offset-2 outline-urgent hover:bg-urgent-tint'
                          : isSelected
                          ? 'bg-brand-100/60'
                          : 'hover:bg-canvas'
                      }`}
                    >
                      {/* 1. Request ID */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono-num font-semibold ${
                            isUrgent
                              ? 'px-2 py-0.5 rounded bg-urgent text-white'
                              : 'text-brand-600'
                          }`}
                        >
                          {row.id}
                        </span>
                        <div className="text-[11px] text-muted mt-0.5 tabular-nums">
                          {row.createdAtText}
                        </div>
                      </td>

                      {/* 2. Service Type */}
                      <td className="py-3.5 px-4 max-w-[270px]">
                        <div
                          className={`font-semibold truncate ${
                            isUrgent ? 'text-urgent-ink' : 'text-ink'
                          }`}
                        >
                          {row.serviceName}
                        </div>
                        <div className="text-[12px] text-muted truncate">
                          {row.patientName} ({row.patientAge}t) · {row.serviceCategory}
                        </div>
                      </td>

                      {/* 3. Requested Time */}
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="font-medium text-ink">{row.requestedTime}</div>
                        <div className="text-[11px] text-muted">
                          {row.requestedDate} · Dự kiến {row.predictedDurationMin} phút
                        </div>
                      </td>

                      {/* 4. Service Area */}
                      <td className="py-3.5 px-4 max-w-[190px]">
                        <div className="font-medium text-ink">{row.district}</div>
                        <div className="text-[11px] text-muted truncate">{row.address}</div>
                      </td>

                      {/* 5. Priority */}
                      <td className="py-3.5 px-4">
                        <PriorityBadge
                          priority={row.priority}
                          showCountdown={isUrgent}
                          deadline={row.windowStart}
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
                            className="px-2.5 py-1 rounded border border-line bg-white text-[12px] font-medium text-ink hover:border-brand-600 hover:text-brand-600 cursor-pointer"
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
                                  ? 'bg-brand-100 text-brand-600 hover:bg-brand-600 hover:text-white cursor-pointer'
                                  : 'bg-canvas text-muted border border-line opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              Đề xuất AI
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onNavigate('/dispatch')}
                              className="px-2.5 py-1 rounded border border-line bg-canvas text-[12px] font-medium text-brand-600 hover:border-brand-600 cursor-pointer"
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

          <div className="px-4 py-3 border-t border-line bg-canvas flex items-center justify-between text-[12px] text-muted">
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
                className="px-2.5 py-1 rounded border border-line bg-white text-ink disabled:opacity-40 cursor-pointer"
              >
                Trước
              </button>
              <span className="px-2 font-medium text-ink tabular-nums">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-line bg-white text-ink disabled:opacity-40 cursor-pointer"
              >
                Tiếp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Request Detail Drawer */}
      {selectedDetail && (() => {
        const failedChecks = selectedDetail.readinessChecks.filter((c) => !c.passed);
        const passedCount = selectedDetail.readinessChecks.length - failedChecks.length;
        const totalChecks = selectedDetail.readinessChecks.length;
        const sortedChecks = [...selectedDetail.readinessChecks].sort(
          (a, b) => Number(a.passed) - Number(b.passed)
        );
        const isDurationAdjusted =
          selectedDetail.predictedDurationMin !== selectedDetail.standardDurationMin;
        const shortWard = selectedDetail.district
          .replace(/^Phường\s+/i, '')
          .replace(/^Xã\s+/i, '');
        const createdTimeOnly = selectedDetail.createdAtText.includes('·')
          ? selectedDetail.createdAtText.split('·')[1]?.trim()
          : '07:15';

        const summaryStripClass =
          selectedDetail.priority === 'Khẩn cấp'
            ? 'bg-urgent-tint border-urgent-line text-ink'
            : selectedDetail.priority === 'Cao'
            ? 'bg-high-tint border-high-line text-ink'
            : 'bg-brand-50 border-brand-200 text-ink';

        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[1px]">
            <div
              className={`w-full max-w-[560px] bg-white h-full shadow-xl flex flex-col ${
                selectedDetail.priority === 'Khẩn cấp'
                  ? 'border-l-4 border-l-urgent'
                  : 'border-l border-line'
              }`}
            >
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-line bg-white shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-mono-num text-[12px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                          selectedDetail.priority === 'Khẩn cấp'
                            ? 'bg-urgent text-white'
                            : 'text-brand-600 bg-brand-100'
                        }`}
                      >
                        {selectedDetail.id}
                      </span>
                      <PriorityBadge
                        priority={selectedDetail.priority}
                        showCountdown={selectedDetail.priority === 'Khẩn cấp'}
                        deadline={selectedDetail.windowStart}
                      />
                      {renderCareRequestStatusBadge(selectedDetail.operationalStatus)}
                    </div>
                    <h3 className="text-[18px] font-bold text-ink m-0 mt-2 leading-snug">
                      {selectedDetail.serviceName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(null);
                      setShowReadinessDetails(false);
                    }}
                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-canvas cursor-pointer shrink-0"
                    aria-label="Đóng chi tiết yêu cầu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Dải thông tin chính: Ngày giờ, Thời lượng, Phường/xã */}
                <div
                  className={`px-3.5 py-2.5 rounded-lg border flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] ${summaryStripClass}`}
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    {formatDateVi(selectedDetail.requestedDate)} · {selectedDetail.windowStart}–
                    {selectedDetail.windowEnd}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <span
                      className={`font-semibold ${
                        isDurationAdjusted
                          ? 'text-sun-700 bg-sun-100 px-1.5 py-0.5 rounded'
                          : 'text-ink'
                      }`}
                    >
                      {selectedDetail.predictedDurationMin} phút
                    </span>
                    <span className="text-[11px] text-muted">
                      chuẩn {selectedDetail.standardDurationMin}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-ink whitespace-nowrap">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    {shortWard}
                  </span>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Hộp cảnh báo vàng khi chưa sẵn sàng */}
                {!selectedDetail.isReadyForAI && (
                  <div className="p-3.5 rounded-lg bg-sun-50 border border-sun-300 text-sun-700 space-y-1.5">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Còn thiếu {failedChecks.length}/{totalChecks} điều kiện
                      </span>
                    </div>
                    <ul className="m-0 pl-5 space-y-0.5 text-[12px]">
                      {failedChecks.map((fc) => (
                        <li key={fc.key}>{fc.label}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mục 1: Bệnh nhân & dịch vụ */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                    <User className="w-4 h-4 text-brand-600 shrink-0" />
                    <span>Bệnh nhân & dịch vụ</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-canvas border border-line space-y-2 text-[13px]">
                    <div className="font-semibold text-[14px] text-ink">
                      {selectedDetail.patientName} · {selectedDetail.patientAge} tuổi
                      {selectedDetail.patientPhone && (
                        <span className="ml-2 text-[12px] font-normal text-muted font-mono-num">
                          {selectedDetail.patientPhone}
                        </span>
                      )}
                    </div>

                    {selectedDetail.serviceCategory &&
                      selectedDetail.serviceCategory !== selectedDetail.serviceName && (
                        <div className="text-[12.5px] text-ink-soft">
                          <span className="text-muted">Nhóm dịch vụ: </span>
                          <span className="font-medium text-ink">
                            {selectedDetail.serviceCategory}
                          </span>
                        </div>
                      )}

                    {selectedDetail.assignedStaffName && (
                      <div className="text-[12.5px] text-ink-soft pt-1 border-t border-line">
                        <span className="text-muted">Nhân sự phụ trách: </span>
                        <span className="font-semibold text-brand-600">
                          {selectedDetail.assignedStaffName}
                        </span>
                      </div>
                    )}

                    {selectedDetail.clinicalNotes && selectedDetail.clinicalNotes.trim() && (
                      <div className="pt-2 border-t border-line">
                        <span className="text-[11px] font-medium text-muted block mb-0.5">
                          Ghi chú
                        </span>
                        <p className="text-[12.5px] text-ink m-0 leading-relaxed">
                          {selectedDetail.clinicalNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mục 2: Kỹ năng & địa điểm */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                    <Stethoscope className="w-4 h-4 text-brand-600 shrink-0" />
                    <span>Kỹ năng & địa điểm</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-canvas border border-line space-y-3 text-[13px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedDetail.requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2.5 py-0.5 rounded-full bg-white border border-line text-[12px] font-medium text-ink"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>

                    <div className="pt-2.5 border-t border-line flex items-start gap-2 text-[12.5px]">
                      <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                      <span className="text-ink leading-snug line-clamp-2">
                        <strong className="font-semibold">{selectedDetail.district}</strong> ·{' '}
                        {selectedDetail.address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mục 3: Sẵn sàng điều phối */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                      <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                      <span>Sẵn sàng điều phối</span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                        selectedDetail.isReadyForAI
                          ? 'bg-ok-tint text-ok'
                          : 'bg-sun-100 text-sun-700 border border-sun-300'
                      }`}
                    >
                      Đạt {passedCount}/{totalChecks}
                    </span>
                  </div>

                  {selectedDetail.isReadyForAI && !showReadinessDetails ? (
                    <button
                      type="button"
                      onClick={() => setShowReadinessDetails(true)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-ok-tint/60 border border-ok-line flex items-center justify-between text-[12.5px] font-medium text-ok hover:bg-ok-tint cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Đã đủ 5/5 điều kiện
                      </span>
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    </button>
                  ) : (
                    <div className="p-3 rounded-lg bg-canvas border border-line space-y-1.5">
                      {selectedDetail.isReadyForAI && (
                        <button
                          type="button"
                          onClick={() => setShowReadinessDetails(false)}
                          className="w-full flex items-center justify-between text-[12px] font-medium text-ok pb-1.5 mb-1 border-b border-line cursor-pointer"
                        >
                          <span>Thu gọn danh sách điều kiện</span>
                          <ChevronUp className="w-4 h-4 shrink-0" />
                        </button>
                      )}

                      {sortedChecks.map((chk) => (
                        <div
                          key={chk.key}
                          className={`px-2.5 py-2 rounded border flex items-start gap-2 text-[12px] ${
                            chk.passed
                              ? 'bg-white border-line'
                              : 'bg-sun-50 border-sun-300'
                          }`}
                        >
                          {chk.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-high-ink shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-medium ${
                                chk.passed ? 'text-ink' : 'text-sun-700'
                              }`}
                            >
                              {chk.label}
                            </div>
                            {!chk.passed && (
                              <div className="text-[11px] text-sun-700/90 mt-0.5">
                                {chk.detail}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Thời điểm tạo ở cuối drawer */}
                <div className="text-[11px] text-subtle pt-1">
                  Tạo lúc {createdTimeOnly} · {formatDateVi(selectedDetail.requestedDate)}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-line bg-canvas space-y-2 shrink-0">
                {selectedDetail.isUnassigned && !selectedDetail.isReadyForAI && (
                  <div className="text-[11.5px] text-sun-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Chưa đủ điều kiện nên chưa thể xem đề xuất AI. Hãy chỉnh sửa khung giờ hoặc khu vực.
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditSelectedRequest(selectedDetail)}
                    className="px-3.5 py-2.5 rounded-lg border border-line bg-white text-ink text-[13px] font-medium hover:border-brand-600 hover:text-brand-600 inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-4 h-4" />
                    Chỉnh sửa yêu cầu
                  </button>

                  {selectedDetail.isUnassigned ? (
                    <button
                      type="button"
                      disabled={!selectedDetail.isReadyForAI}
                      title={
                        !selectedDetail.isReadyForAI
                          ? `Còn thiếu ${failedChecks.length}/5 điều kiện để chạy đề xuất AI`
                          : undefined
                      }
                      onClick={() => {
                        const id = selectedDetail.id;
                        setSelectedRequestId(null);
                        setShowReadinessDetails(false);
                        onNavigate('/recommendations', id);
                      }}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap ${
                        selectedDetail.isReadyForAI
                          ? 'bg-brand-600 text-white hover:bg-brand-700 cursor-pointer'
                          : 'bg-line text-muted cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      Xem đề xuất AI
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequestId(null);
                        setShowReadinessDetails(false);
                        onNavigate('/dispatch');
                      }}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-700 inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Xem phân công trên lịch
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
