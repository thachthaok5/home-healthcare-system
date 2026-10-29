import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Sliders,
  UserCheck,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import {
  AICandidate,
  DSSWeights,
  MedicalStaff,
  OverrideReasonCode,
  UnassignedRequest,
} from '../../types/healthcare';
import {
  PageHeader,
  PriorityBadge,
  StatusBadge,
  SuitabilityScoreBadge,
  ConstraintCheckList,
  evaluateSixHardConstraints,
  EmptyStateCard,
} from './SharedUI';

export interface RecommendationsPageProps {
  selectedDate: string;
  onDateChange: (d: string) => void;
  unassignedRequests: UnassignedRequest[];
  reviewedRecords: {
    requestId: string;
    patientName: string;
    serviceName: string;
    district: string;
    requestedWindow: string;
    priority: string;
    assignedStaffName: string;
    suitabilityScore: number;
    status: 'Confirmed' | 'Rejected';
    reviewedAt: string;
  }[];
  staffList: MedicalStaff[];
  selectedRequestId: string;
  onSelectRequest: (id: string) => void;
  dssWeights: DSSWeights;
  onUpdateWeights: (w: DSSWeights) => void;
  onConfirmAssignment: (
    requestId: string,
    candidate: AICandidate,
    isOverride: boolean,
    overrideCategory?: string,
    overrideReason?: string,
    overrideReasonCode?: OverrideReasonCode
  ) => Promise<void>;
  onRejectSuggestion: (requestId: string, reason: string) => void;
}

const OVERRIDE_REASONS: { code: OverrideReasonCode; label: string }[] = [
  { code: 'distance', label: 'distance — Vị trí địa lý thuận tiện hơn thực tế' },
  { code: 'skill', label: 'skill — Tay nghề chuyên sâu phù hợp ca bệnh nặng' },
  { code: 'customer_request', label: 'customer_request — Gia đình bệnh nhân yêu cầu đích danh' },
  { code: 'time_constraint', label: 'time_constraint — Ràng buộc thời gian đột xuất' },
  { code: 'workload_balance', label: 'workload_balance — Điều tiết tải nội bộ trạm y tế' },
  { code: 'other', label: 'other — Yêu cầu vận hành / lâm sàng đặc biệt khác' },
];

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
  selectedDate,
  onDateChange,
  unassignedRequests,
  reviewedRecords,
  staffList,
  selectedRequestId,
  onSelectRequest,
  dssWeights,
  onUpdateWeights,
  onConfirmAssignment,
  onRejectSuggestion,
}) => {
  // Top bar filters
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'Pending Review' | 'Reviewed'>('Pending Review');

  // Right panel interactive states
  const [showDssCriteria, setShowDssCriteria] = useState<boolean>(false);
  const [showWeightsTuner, setShowWeightsTuner] = useState<boolean>(false);
  const [previewCandidateId, setPreviewCandidateId] = useState<string | null>(null);
  const [showConstraintDetails, setShowConstraintDetails] = useState<boolean>(false);

  // Modals / Drawers for Human-in-the-loop actions
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [changeModalOpen, setChangeModalOpen] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [compareDrawerOpen, setCompareDrawerOpen] = useState<boolean>(false);

  // Change / Override modal state
  const [overrideStaffId, setOverrideStaffId] = useState<string>('');
  const [overrideReasonCode, setOverrideReasonCode] = useState<OverrideReasonCode>('skill');
  const [overrideNotes, setOverrideNotes] = useState<string>('');
  const [rejectNotes, setRejectNotes] = useState<string>(
    'Chuyển sang ca chiều theo nguyện vọng gia đình bệnh nhân.'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Unique service categories for filter
  const serviceTypes = useMemo(() => {
    const set = new Set<string>();
    unassignedRequests.forEach((r) => set.add(r.serviceCategory));
    return Array.from(set);
  }, [unassignedRequests]);

  // Filtered queue
  const filteredPending = useMemo(() => {
    return unassignedRequests.filter((req) => {
      if (serviceFilter !== 'ALL' && req.serviceCategory !== serviceFilter) return false;
      if (priorityFilter !== 'ALL') {
        if (priorityFilter === 'Urgent' && req.priority !== 'Khẩn cấp') return false;
        if (priorityFilter === 'High' && req.priority !== 'Cao') return false;
        if (priorityFilter === 'Standard' && req.priority !== 'Tiêu chuẩn') return false;
      }
      return true;
    });
  }, [unassignedRequests, serviceFilter, priorityFilter]);

  // Summary counts (Section 6.2 — Maximum 3 compact counts)
  const awaitingReviewCount = unassignedRequests.length;
  const readyForReviewCount = unassignedRequests.filter((r) =>
    r.aiCandidates.some((c) => c.isEligible)
  ).length;
  const manualInterventionCount = unassignedRequests.filter(
    (r) =>
      !r.aiCandidates.some((c) => c.isEligible) ||
      r.priority === 'Khẩn cấp'
  ).length;

  // Currently selected request
  const activeRequest = useMemo(() => {
    const found = filteredPending.find((r) => r.id === selectedRequestId);
    return found || filteredPending[0] || unassignedRequests[0];
  }, [filteredPending, selectedRequestId, unassignedRequests]);

  const eligibleCandidates = useMemo(
    () => (activeRequest ? activeRequest.aiCandidates.filter((c) => c.isEligible) : []),
    [activeRequest]
  );

  const disqualifiedCandidates = useMemo(
    () => (activeRequest ? activeRequest.aiCandidates.filter((c) => !c.isEligible) : []),
    [activeRequest]
  );

  const top1Candidate = eligibleCandidates[0] || activeRequest?.aiCandidates[0];

  // Candidate currently displayed in Section 2 of the right panel
  const activeCandidate = useMemo(() => {
    if (!activeRequest) return undefined;
    if (previewCandidateId) {
      const match = activeRequest.aiCandidates.find((c) => c.staffId === previewCandidateId);
      if (match) return match;
    }
    return top1Candidate;
  }, [activeRequest, previewCandidateId, top1Candidate]);

  const activeStaffRecord = useMemo(
    () => staffList.find((s) => s.id === activeCandidate?.staffId),
    [staffList, activeCandidate]
  );

  const hardConstraintChecks = useMemo(
    () => evaluateSixHardConstraints(activeCandidate, activeRequest, activeStaffRecord),
    [activeCandidate, activeRequest, activeStaffRecord]
  );

  const allHardConstraintsPass =
    hardConstraintChecks.length > 0 && hardConstraintChecks.every((c) => c.passed);

  const alternativeCandidates = useMemo(() => {
    if (!activeRequest || !activeCandidate) return [];
    return eligibleCandidates
      .filter((c) => c.staffId !== activeCandidate.staffId)
      .slice(0, 2);
  }, [activeRequest, activeCandidate, eligibleCandidates]);

  // Handlers
  const handleSelectRequestRow = (reqId: string) => {
    setPreviewCandidateId(null);
    onSelectRequest(reqId);
  };

  const handleOpenChangeModal = (preselectStaffId?: string) => {
    const fallbackAlt =
      preselectStaffId ||
      alternativeCandidates[0]?.staffId ||
      eligibleCandidates[0]?.staffId ||
      '';
    setOverrideStaffId(fallbackAlt);
    setOverrideReasonCode('skill');
    setOverrideNotes('');
    setChangeModalOpen(true);
  };

  const handleAcceptConfirmed = async () => {
    if (!activeRequest || !activeCandidate || !allHardConstraintsPass) return;
    setIsSubmitting(true);
    try {
      const isOverride = activeCandidate.staffId !== top1Candidate?.staffId;
      await onConfirmAssignment(
        activeRequest.id,
        activeCandidate,
        isOverride,
        isOverride ? 'Điều phối viên chọn ứng viên thay thế' : undefined,
        isOverride ? 'Đã chọn ứng viên khả thi khác trong quá trình xét duyệt' : undefined,
        isOverride ? 'skill' : undefined
      );
      setConfirmModalOpen(false);
      setPreviewCandidateId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverrideConfirmed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !overrideStaffId || !overrideNotes.trim()) return;
    const chosenCand = activeRequest.aiCandidates.find((c) => c.staffId === overrideStaffId);
    if (!chosenCand) return;

    const chosenStaffObj = staffList.find((s) => s.id === chosenCand.staffId);
    const checks = evaluateSixHardConstraints(chosenCand, activeRequest, chosenStaffObj);
    if (!checks.every((c) => c.passed)) return;

    const reasonLabel =
      OVERRIDE_REASONS.find((r) => r.code === overrideReasonCode)?.label || overrideReasonCode;

    setIsSubmitting(true);
    try {
      await onConfirmAssignment(
        activeRequest.id,
        chosenCand,
        chosenCand.staffId !== top1Candidate?.staffId,
        reasonLabel,
        overrideNotes.trim(),
        overrideReasonCode
      );
      setChangeModalOpen(false);
      setPreviewCandidateId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirmed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;
    onRejectSuggestion(activeRequest.id, rejectNotes.trim() || 'Tạm hoãn để xếp lịch thủ công');
    setRejectModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* 6.1 Page Heading and Filters */}
      <PageHeader
        title="Đề xuất AI & Giải trình DSS"
        subtitle="Đánh giá gợi ý ứng viên của AI, kiểm tra ràng buộc và xác nhận phân công"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E5F1EC] text-[#2F6F64] border border-[#C6DFD7]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4D947B]" />
            Đã đồng bộ
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Filter */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438] tabular-nums"
            />
            {/* Service Type Filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
            >
              <option value="ALL">Tất cả Loại dịch vụ</option>
              {serviceTypes.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[12px] text-[#253438]"
            >
              <option value="ALL">Tất cả Mức ưu tiên</option>
              <option value="Urgent">Khẩn cấp</option>
              <option value="High">Ưu tiên cao</option>
              <option value="Standard">Tiêu chuẩn</option>
            </select>
            {/* Status Filter (Pending Review / Reviewed) */}
            <div className="inline-flex rounded-lg border border-[#E1E9E6] bg-white p-0.5">
              {(
                [
                  { key: 'Pending Review', label: 'Chờ xét duyệt' },
                  { key: 'Reviewed', label: 'Đã xử lý' },
                ] as const
              ).map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-[#2F6F64] text-white'
                      : 'text-[#687A78] hover:text-[#253438]'
                  }`}
                >
                  {st.label}
                  {st.key === 'Pending Review'
                    ? ` (${unassignedRequests.length})`
                    : ` (${reviewedRecords.length})`}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* 6.2 Compact Summary Row (Maximum 3 Compact Counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-[10px] border border-[#E1E9E6] px-4 py-3 flex items-center justify-between">
          <span className="text-[13px] text-[#687A78] font-medium">
            Yêu cầu đang chờ xét duyệt
          </span>
          <span className="text-[20px] font-semibold text-[#253438] tabular-nums">
            {awaitingReviewCount}
          </span>
        </div>
        <div className="bg-white rounded-[10px] border border-[#C6DFD7] px-4 py-3 flex items-center justify-between">
          <span className="text-[13px] text-[#2F6F64] font-medium">
            Đề xuất AI sẵn sàng phê duyệt
          </span>
          <span className="text-[20px] font-semibold text-[#2F6F64] tabular-nums">
            {readyForReviewCount}
          </span>
        </div>
        <div className="bg-white rounded-[10px] border border-[#F3D9B1] px-4 py-3 flex items-center justify-between">
          <span className="text-[13px] text-[#B87514] font-medium">
            Ca cần điều phối viên can thiệp
          </span>
          <span className="text-[20px] font-semibold text-[#B87514] tabular-nums">
            {manualInterventionCount}
          </span>
        </div>
      </div>

      {/* Reviewed History View if Status Filter = Reviewed */}
      {statusFilter === 'Reviewed' ? (
        reviewedRecords.length === 0 ? (
          <EmptyStateCard
            title="Chưa có đề xuất nào được xử lý trong phiên này"
            description="Chuyển về tab Chờ xét duyệt để đánh giá các yêu cầu chăm sóc mới và xác nhận hoặc điều chỉnh nhân sự."
            actionLabel="Xem Hàng đợi Chờ duyệt"
            onAction={() => setStatusFilter('Pending Review')}
          />
        ) : (
          <div className="bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E1E9E6] flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#253438] m-0">
                Đề xuất Đã Xử lý ({reviewedRecords.length})
              </h2>
            </div>
            <div className="divide-y divide-[#E1E9E6]">
              {reviewedRecords.map((rec) => (
                <div
                  key={`${rec.requestId}-${rec.reviewedAt}`}
                  className="px-5 py-3.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-[12px] font-semibold text-[#2F6F64]">
                        {rec.requestId}
                      </span>
                      <span className="text-[14px] font-semibold text-[#253438]">
                        {rec.serviceName}
                      </span>
                      <PriorityBadge priority={rec.priority} />
                    </div>
                    <div className="text-[12px] text-[#687A78] mt-0.5">
                      Bệnh nhân: {rec.patientName} · {rec.district} · Khung giờ {rec.requestedWindow}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-[#253438]">
                        {rec.assignedStaffName}
                      </div>
                      <div className="text-[11px] text-[#687A78] tabular-nums">
                        Xử lý lúc {rec.reviewedAt}
                      </div>
                    </div>
                    <StatusBadge status={rec.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : filteredPending.length === 0 ? (
        <EmptyStateCard
          title="Không có yêu cầu nào khớp bộ lọc hiện tại"
          description="Tất cả các yêu cầu thuộc bộ lọc này đã được xử lý."
          actionLabel="Đặt lại Bộ lọc"
          onAction={() => {
            setServiceFilter('ALL');
            setPriorityFilter('ALL');
          }}
        />
      ) : (
        /* 6.3 Main Two-Column Layout (Left 60–65% Request Queue, Right 35–40% Selected Recommendation)
           Independent split-pane scrolling: scrolling left queue keeps right panel stationary and vice versa */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:h-[calc(100vh-250px)] lg:min-h-[560px]">
          {/* LEFT COLUMN (7 cols ~ 58-60%) — Request Queue (Independent Scroll Container) */}
          <div className="lg:col-span-7 bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden flex flex-col lg:h-full">
            <div className="px-5 py-3.5 border-b border-[#E1E9E6] flex items-center justify-between bg-[#F7FAF9] shrink-0">
              <div>
                <h2 className="text-[15px] font-semibold text-[#253438] m-0">
                  Hàng đợi Yêu cầu Chăm sóc
                </h2>
                <p className="text-[12px] text-[#687A78] m-0">
                  Chọn một yêu cầu để xem giải trình DSS và kiểm tra 6 ràng buộc cứng
                </p>
              </div>
              <span className="text-[12px] font-medium text-[#687A78] tabular-nums">
                {filteredPending.length} yêu cầu
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto overscroll-contain">
              {filteredPending.map((req) => {
                const isSelected = activeRequest?.id === req.id;
                const isUrgent = req.priority === 'Khẩn cấp';
                const topCand = req.aiCandidates.find((c) => c.isEligible) || req.aiCandidates[0];
                const hasEligible = req.aiCandidates.some((c) => c.isEligible);

                return (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRequestRow(req.id)}
                    className={`p-4 rounded-lg transition-colors cursor-pointer ${
                      isUrgent
                        ? isSelected
                          ? 'border-2 border-[#C03A47] bg-[#FDF2F3] ring-2 ring-[#D85D68]/25'
                          : 'border-2 border-[#D85D68] bg-[#FDF2F3]/50 hover:bg-[#FDF2F3]'
                        : isSelected
                        ? 'border-2 border-[#2F6F64] bg-[#E5F1EC]/55'
                        : 'border border-[#E1E9E6] bg-white hover:bg-[#F7FAF9]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-mono-num text-[12px] font-semibold px-2 py-0.5 rounded ${
                            isUrgent
                              ? 'bg-[#C03A47] text-white'
                              : 'text-[#2F6F64] bg-[#E5F1EC]'
                          }`}
                        >
                          {req.id}
                        </span>
                        <span
                          className={`text-[14px] font-semibold ${
                            isUrgent ? 'text-[#A32935]' : 'text-[#253438]'
                          }`}
                        >
                          {req.serviceName}
                        </span>
                        <PriorityBadge
                          priority={req.priority}
                          showCountdown={isUrgent}
                          seedId={req.id}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasEligible && topCand ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E5F1EC] text-[#2F6F64] border border-[#C6DFD7] tabular-nums">
                            Top 1: {topCand.staffName} ({topCand.totalScore}%)
                          </span>
                        ) : (
                          <StatusBadge status="Manual Review" />
                        )}
                      </div>
                    </div>

                    {/* Concise Grid Row for Glanceability */}
                    <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] text-[#687A78]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 text-[#2F6F64] shrink-0" />
                        <span className="tabular-nums text-[#253438] font-medium">
                          {req.requestedWindow}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#687A78] shrink-0" />
                        <span className="truncate">{req.district}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Stethoscope className="w-3.5 h-3.5 text-[#687A78] shrink-0" />
                        <span className="truncate">
                          {req.requiredSkills[0] || req.serviceCategory}
                        </span>
                      </div>
                      <div className="flex items-center justify-end sm:justify-start gap-1 tabular-nums">
                        <span>AI dự báo:</span>
                        <strong className="text-[#253438]">{req.predictedDurationMin}p</strong>
                        <span className="text-[11px] opacity-75">
                          (Chuẩn {req.standardDurationMin}p)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols ~ 40-42%) — Selected Recommendation Detail Panel (Independent Scroll Container) */}
          {activeRequest && (
            <div
              className={`lg:col-span-5 bg-white rounded-[10px] overflow-hidden flex flex-col lg:h-full ${
                activeRequest.priority === 'Khẩn cấp'
                  ? 'border-2 border-[#D85D68]'
                  : 'border border-[#E1E9E6]'
              }`}
            >
              <div
                className={`px-5 py-3.5 border-b flex items-center justify-between gap-2 flex-wrap shrink-0 ${
                  activeRequest.priority === 'Khẩn cấp'
                    ? 'bg-[#FDF2F3] border-[#F2C6CB]'
                    : 'bg-[#F7FAF9] border-[#E1E9E6]'
                }`}
              >
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      activeRequest.priority === 'Khẩn cấp' ? 'text-[#C03A47]' : 'text-[#2F6F64]'
                    }`}
                  >
                    Chi tiết Đề xuất Đang chọn
                  </div>
                  <h2 className="text-[16px] font-semibold text-[#253438] m-0">
                    {activeRequest.id} · {activeRequest.patientName} ({activeRequest.patientAge} tuổi)
                  </h2>
                </div>
                <PriorityBadge
                  priority={activeRequest.priority}
                  showCountdown={activeRequest.priority === 'Khẩn cấp'}
                  seedId={activeRequest.id}
                />
              </div>

              <div className="p-5 space-y-5 flex-1 overflow-y-auto overscroll-contain">
                {/* SECTION 1: Request Summary */}
                <div className="space-y-2 pb-4 border-b border-[#E1E9E6]">
                  <div className="text-[12px] font-semibold text-[#687A78] uppercase tracking-wider">
                    1. Tóm tắt Yêu cầu Chăm sóc
                  </div>
                  <div className="text-[14px] font-semibold text-[#253438]">
                    {activeRequest.serviceName}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="bg-[#F7FAF9] p-2 rounded border border-[#E1E9E6]">
                      <span className="text-[#687A78] block text-[11px]">Khung giờ yêu cầu</span>
                      <span className="font-semibold text-[#253438] tabular-nums">
                        {activeRequest.requestedWindow} (Ưu tiên: {activeRequest.preferredStart})
                      </span>
                    </div>
                    <div className="bg-[#F7FAF9] p-2 rounded border border-[#E1E9E6]">
                      <span className="text-[#687A78] block text-[11px]">
                        Thời lượng (Định mức vs AI)
                      </span>
                      <span className="font-semibold text-[#2F6F64] tabular-nums">
                        {activeRequest.predictedDurationMin} phút{' '}
                        <span className="text-[#687A78] font-normal">
                          (Chuẩn {activeRequest.standardDurationMin}p)
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-[#687A78] pt-1 flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#2F6F64]" />
                      {activeRequest.address}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {activeRequest.requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-0.5 rounded bg-[#E5F1EC] text-[#2F6F64] text-[11px] font-medium"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Recommended Staff Member */}
                {activeCandidate ? (
                  <div className="space-y-3 pb-4 border-b border-[#E1E9E6]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#687A78] uppercase tracking-wider">
                        2. Nhân sự Y tế Đề xuất
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#E5F1EC] text-[#2F6F64]">
                        {activeCandidate.rankLabel}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-lg border border-[#C6DFD7] bg-[#E5F1EC]/35 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-[13px] shrink-0"
                            style={{ backgroundColor: activeCandidate.avatarColor || '#2F6F64' }}
                          >
                            {activeCandidate.staffName.slice(-2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[15px] font-semibold text-[#253438]">
                              {activeCandidate.staffName}
                            </div>
                            <div className="text-[12px] text-[#687A78]">
                              {activeCandidate.staffRole} · {activeCandidate.zone}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-[#687A78] mb-0.5">
                            Điểm Phù hợp (DSS)
                          </div>
                          <SuitabilityScoreBadge score={activeCandidate.totalScore} size="md" />
                        </div>
                      </div>

                      {/* Availability + Stacked Workload Progress Bar (Current + Projected out of 480m) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-[#687A78] inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#2F6F64]" />
                            Lịch trống: <strong className="text-[#253438] tabular-nums">{activeCandidate.criteria.availableGapText}</strong>
                          </span>
                          <span className="text-[11px] text-[#687A78] tabular-nums">
                            Tải công việc:{' '}
                            <strong className="text-[#253438]">
                              {activeCandidate.criteria.assignedMinutes}p
                            </strong>{' '}
                            +{' '}
                            <strong className="text-[#2F6F64]">
                              {activeCandidate.criteria.projectedAssignedMinutes -
                                activeCandidate.criteria.assignedMinutes}
                              p
                            </strong>{' '}
                            / {activeCandidate.criteria.maxDailyMinutes}p
                          </span>
                        </div>
                        {/* 2-Color Stacked Bar */}
                        <div className="w-full h-2.5 bg-[#E1E9E6] rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-[#2F6F64]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (activeCandidate.criteria.assignedMinutes /
                                    activeCandidate.criteria.maxDailyMinutes) *
                                    100
                                )
                              )}%`,
                            }}
                            title={`Đã gán trong ngày: ${activeCandidate.criteria.assignedMinutes} phút`}
                          />
                          <div
                            className="h-full bg-[#7BB6A6]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  ((activeCandidate.criteria.projectedAssignedMinutes -
                                    activeCandidate.criteria.assignedMinutes) /
                                    activeCandidate.criteria.maxDailyMinutes) *
                                    100
                                )
                              )}%`,
                            }}
                            title={`Tăng thêm nếu nhận ca này: +${
                              activeCandidate.criteria.projectedAssignedMinutes -
                              activeCandidate.criteria.assignedMinutes
                            } phút`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* SECTION 3: Why this candidate? (3 concise items + collapsible View DSS Criteria) */}
                {activeCandidate && (
                  <div className="space-y-2.5 pb-4 border-b border-[#E1E9E6]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#687A78] uppercase tracking-wider">
                        3. Giải trình Lý do Đề xuất
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDssCriteria((prev) => !prev)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2F6F64] hover:text-[#255A51] cursor-pointer"
                      >
                        {showDssCriteria ? 'Thu gọn 5 tiêu chí DSS' : 'Xem 5 tiêu chí DSS'}
                        {showDssCriteria ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* 3 Concise Explanation Items */}
                    <div className="grid grid-cols-1 gap-1.5 text-[12px]">
                      <div className="flex items-center justify-between px-3 py-2 rounded bg-[#F7FAF9] border border-[#E1E9E6]">
                        <span className="text-[#687A78]">Độ khớp kỹ năng</span>
                        <span className="font-medium text-[#253438]">
                          {activeCandidate.criteria.matchedSkills.join(', ') || 'Đủ chứng chỉ'} (
                          {activeCandidate.criteria.skillFitScore}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 rounded bg-[#F7FAF9] border border-[#E1E9E6]">
                        <span className="text-[#687A78]">Độ khít khung giờ</span>
                        <span className="font-medium text-[#253438] tabular-nums">
                          {activeCandidate.criteria.availableGapText} (
                          {activeCandidate.criteria.timeFitScore}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 rounded bg-[#F7FAF9] border border-[#E1E9E6]">
                        <span className="text-[#687A78]">Khoảng cách & Cân bằng tải</span>
                        <span className="font-medium text-[#253438] tabular-nums">
                          {activeCandidate.criteria.distanceKm} km (~
                          {activeCandidate.criteria.travelMinutes}p) ·{' '}
                          {activeCandidate.criteria.projectedWorkloadPct}% trần
                        </span>
                      </div>
                    </div>

                    {/* Collapsible 5-Component Weighted DSS Breakdown */}
                    {showDssCriteria && (
                      <div className="mt-2 p-3 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#253438]">
                            Giải trình 5 Thành phần Trọng số DSS
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowWeightsTuner((v) => !v)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#2F6F64] font-medium cursor-pointer"
                          >
                            <Sliders className="w-3 h-3" />
                            {showWeightsTuner ? 'Ẩn trọng số' : 'Điều chỉnh trọng số'}
                          </button>
                        </div>

                        {[
                          {
                            label: 'SkillFit (Độ khớp kỹ năng)',
                            weightPct: Math.round(dssWeights.skillFit * 100),
                            score: activeCandidate.criteria.skillFitScore,
                            detail: activeCandidate.criteria.skillFitNote,
                          },
                          {
                            label: 'TimeFit (Độ khít thời gian)',
                            weightPct: Math.round(dssWeights.timeFit * 100),
                            score: activeCandidate.criteria.timeFitScore,
                            detail: activeCandidate.criteria.timeFitNote,
                          },
                          {
                            label: 'Distance (Khoảng cách di chuyển)',
                            weightPct: Math.round(dssWeights.distance * 100),
                            score: activeCandidate.criteria.distanceScore,
                            detail: `${activeCandidate.criteria.distanceKm} km (~${activeCandidate.criteria.travelMinutes} phút)`,
                          },
                          {
                            label: 'Workload (Cân bằng tải công việc)',
                            weightPct: Math.round(dssWeights.workload * 100),
                            score: activeCandidate.criteria.workloadScore,
                            detail: `${activeCandidate.criteria.projectedAssignedMinutes}/480 phút`,
                          },
                          {
                            label: 'Continuity (Tính liên tục chăm sóc)',
                            weightPct: Math.round(dssWeights.continuity * 100),
                            score: activeCandidate.criteria.continuityScore,
                            detail: `${activeCandidate.criteria.previousVisitsCount} lần khám trước`,
                          },
                        ].map((factor) => (
                          <div key={factor.label} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-[#253438]">
                                {factor.label}{' '}
                                <span className="text-[#687A78]">({factor.weightPct}%)</span>
                              </span>
                              <span className="font-mono-num font-semibold text-[#2F6F64]">
                                {factor.score}/100
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#E1E9E6] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#2F6F64] rounded-full"
                                style={{ width: `${factor.score}%` }}
                              />
                            </div>
                          </div>
                        ))}

                        {showWeightsTuner && (
                          <div className="pt-2 border-t border-[#E1E9E6] space-y-2">
                            <div className="text-[11px] text-[#687A78]">
                              Chọn cấu hình trọng số DSS (tự động chuẩn hóa tổng = 100%):
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateWeights({
                                    skillFit: 0.3,
                                    timeFit: 0.25,
                                    distance: 0.2,
                                    workload: 0.15,
                                    continuity: 0.1,
                                  })
                                }
                                className="px-2 py-1 rounded bg-white border border-[#E1E9E6] text-[11px] text-[#253438] hover:border-[#2F6F64] cursor-pointer"
                              >
                                Mặc định (30/25/20/15/10)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateWeights({
                                    skillFit: 0.25,
                                    timeFit: 0.2,
                                    distance: 0.35,
                                    workload: 0.1,
                                    continuity: 0.1,
                                  })
                                }
                                className="px-2 py-1 rounded bg-white border border-[#E1E9E6] text-[11px] text-[#253438] hover:border-[#2F6F64] cursor-pointer"
                              >
                                Ưu tiên Khoảng cách (35%)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 4: Alternative Candidates (up to 2 compact rows + Compare/Disqualified drawer trigger) */}
                <div className="space-y-2 pb-4 border-b border-[#E1E9E6]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#687A78] uppercase tracking-wider">
                      4. Ứng viên Thay thế Khả thi
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompareDrawerOpen(true)}
                      className="text-[12px] font-medium text-[#2F6F64] hover:text-[#255A51] cursor-pointer"
                    >
                      Tất cả & Nhân sự bị loại ({activeRequest.aiCandidates.length})
                    </button>
                  </div>

                  {alternativeCandidates.length === 0 ? (
                    <div className="text-[12px] text-[#687A78] bg-[#F7FAF9] p-2.5 rounded border border-[#E1E9E6]">
                      Không còn ứng viên nào khác vượt qua cả 6 ràng buộc cứng. Nhấn "Tất cả & Nhân sự bị loại" để xem chi tiết.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {alternativeCandidates.map((alt) => (
                        <div
                          key={alt.staffId}
                          className="px-3 py-2 rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white border border-[#E1E9E6] text-[#687A78]">
                                {alt.rankLabel}
                              </span>
                              <span className="text-[13px] font-semibold text-[#253438] truncate">
                                {alt.staffName}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#687A78] mt-0.5 tabular-nums">
                              {alt.criteria.distanceKm} km · Tải dự kiến {alt.criteria.projectedWorkloadPct}%
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <SuitabilityScoreBadge score={alt.totalScore} size="sm" />
                            <button
                              type="button"
                              onClick={() => setPreviewCandidateId(alt.staffId)}
                              className="px-2 py-1 rounded border border-[#E1E9E6] bg-white text-[11px] font-medium text-[#2F6F64] hover:border-[#2F6F64] cursor-pointer"
                            >
                              Xem thử
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION 5: Constraint Validation (Collapsible Summary Badge) */}
                <div className="space-y-2 pb-3 border-b border-[#E1E9E6]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#687A78] uppercase tracking-wider">
                      Ràng buộc Vận hành & Lâm sàng (Hard Constraints)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowConstraintDetails((prev) => !prev)}
                      className="text-[12px] font-semibold text-[#2F6F64] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showConstraintDetails ? 'Thu gọn' : 'Xem chi tiết 6 điều kiện'}</span>
                      {showConstraintDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {allHardConstraintsPass ? (
                    <div className="p-3 rounded-xl bg-[#E5F1EC]/80 border border-[#A8D3C6] flex items-center justify-between transition-all">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#2F6F64] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                          ✓
                        </span>
                        <div>
                          <div className="text-[13px] font-bold text-[#253438]">
                            Thỏa mãn 6/6 Ràng buộc Cứng (H1 – H6)
                          </div>
                          <div className="text-[11px] text-[#557670]">
                            Khớp kỹ năng, khung giờ hẹn, ca trực, không trùng lịch, đệm OSRM & trần 480p
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#2F6F64] text-white shrink-0">
                        100% Hợp lệ
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-[#FDF2F3] border border-[#F2C6CB] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-[#C03A47] shrink-0" />
                        <div>
                          <div className="text-[13px] font-bold text-[#C03A47]">
                            Vi phạm Ràng buộc ({hardConstraintChecks.filter((c) => !c.passed).length} điều kiện không đạt)
                          </div>
                          <div className="text-[11px] text-[#A32935]">
                            Ứng viên hiện tại chưa đủ điều kiện xếp lịch trực tiếp
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConstraintDetails(true)}
                        className="text-[11px] font-bold text-[#C03A47] underline cursor-pointer"
                      >
                        Xem lỗi
                      </button>
                    </div>
                  )}

                  {showConstraintDetails && (
                    <div className="mt-2 pt-2 border-t border-[#E1E9E6]">
                      <ConstraintCheckList checks={hardConstraintChecks} compact />
                    </div>
                  )}
                </div>

                {/* SECTION 6: Primary Actions (Accept Recommendation, Change Assignment, Reject Suggestion) */}
                <div className="space-y-2.5">
                  <div className="text-[12px] font-semibold text-[#687A78] uppercase tracking-wider">
                    6. Quyết định của Điều phối viên
                  </div>

                  {!allHardConstraintsPass && (
                    <div className="p-2.5 rounded-lg bg-[#FDF2F3] border border-[#F2C6CB] text-[12px] text-[#C03A47] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Chặn xác nhận: Ứng viên đang chọn vi phạm ràng buộc cứng. Vui lòng chọn ứng viên hợp lệ.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      disabled={!allHardConstraintsPass || !activeCandidate}
                      onClick={() => setConfirmModalOpen(true)}
                      className={`h-12 inline-flex items-center justify-center gap-2 px-5 rounded-xl text-[14px] font-bold shadow-xs transition-all ${
                        allHardConstraintsPass && activeCandidate
                          ? 'bg-[#2F6F64] text-white hover:bg-[#255A51] hover:shadow-md cursor-pointer'
                          : 'bg-[#E1E9E6] text-[#687A78] cursor-not-allowed'
                      }`}
                    >
                      <UserCheck className="w-5 h-5" />
                      <span>Chấp thuận Đề xuất này</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenChangeModal()}
                      className="h-12 inline-flex items-center justify-center gap-2 px-4 rounded-xl border-2 border-[#D97706]/40 bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7] hover:border-[#D97706] text-[13px] font-bold transition-all cursor-pointer"
                    >
                      <span>Can thiệp / Đổi ứng viên (Override)</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {previewCandidateId && previewCandidateId !== top1Candidate?.staffId ? (
                      <button
                        type="button"
                        onClick={() => setPreviewCandidateId(null)}
                        className="text-[12px] text-[#2F6F64] hover:underline cursor-pointer"
                      >
                        Quay về Top 1 ({top1Candidate?.staffName})
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#687A78]">
                        Bắt buộc xác nhận bởi Điều phối viên (Human-in-the-loop)
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setRejectModalOpen(true)}
                      className="text-[12px] font-medium text-[#D85D68] hover:underline cursor-pointer"
                    >
                      Từ chối / Tạm hoãn
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ACCEPT RECOMMENDATION CONFIRMATION DIALOG
          ===================================================================== */}
      {confirmModalOpen && activeRequest && activeCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#253438]/30 p-4">
          <div className="bg-white rounded-[12px] border border-[#E1E9E6] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#E5F1EC] text-[#2F6F64] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#253438] m-0">
                  Xác nhận Phân công Nhân sự
                </h3>
                <p className="text-[12px] text-[#687A78] m-0">
                  Ứng viên đã vượt qua đầy đủ 6 ràng buộc cứng vận hành
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F7FAF9] border border-[#E1E9E6] space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#687A78]">Mã yêu cầu:</span>
                <span className="font-semibold text-[#253438]">
                  {activeRequest.id} ({activeRequest.patientName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#687A78]">Dịch vụ:</span>
                <span className="font-medium text-[#253438]">{activeRequest.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#687A78]">Nhân sự phân công:</span>
                <span className="font-semibold text-[#2F6F64]">{activeCandidate.staffName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#687A78]">Điểm DSS tổng hợp:</span>
                <span className="font-mono-num font-semibold text-[#253438]">
                  {activeCandidate.totalScore}% ({activeCandidate.dssScoreNormalized})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#687A78]">Khung giờ dự kiến:</span>
                <span className="tabular-nums font-medium text-[#253438]">
                  {activeRequest.suggestedStartTime} ({activeRequest.predictedDurationMin} phút)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] font-medium text-[#253438] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAcceptConfirmed}
                className="px-4 py-2 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold hover:bg-[#255A51] cursor-pointer"
              >
                {isSubmitting ? 'Đang lưu...' : 'Xác nhận Phân công'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CHANGE ASSIGNMENT (HUMAN-IN-THE-LOOP OVERRIDE)
          ===================================================================== */}
      {changeModalOpen && activeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#253438]/30 p-4">
          <form
            onSubmit={handleOverrideConfirmed}
            className="bg-white rounded-[12px] border border-[#E1E9E6] max-w-lg w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E1E9E6] pb-3">
              <div>
                <h3 className="text-[16px] font-semibold text-[#253438] m-0">
                  Can thiệp Phân công (Human-in-the-loop Override)
                </h3>
                <p className="text-[12px] text-[#687A78] m-0">
                  Chọn nhân viên đủ điều kiện và ghi nhận lý do can thiệp vào nhật ký kiểm toán
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangeModalOpen(false)}
                className="text-[12px] text-[#687A78] hover:text-[#253438] cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Chọn Nhân sự Thay thế (Đạt 6 Ràng buộc cứng) *
                </label>
                <select
                  value={overrideStaffId}
                  onChange={(e) => setOverrideStaffId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                >
                  {eligibleCandidates.map((cand) => (
                    <option key={cand.staffId} value={cand.staffId}>
                      {cand.rankLabel}: {cand.staffName} — Điểm DSS {cand.totalScore}% (
                      {cand.criteria.distanceKm} km, tải {cand.criteria.projectedWorkloadPct}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Lý do Can thiệp Chuẩn hóa *
                </label>
                <select
                  value={overrideReasonCode}
                  onChange={(e) => setOverrideReasonCode(e.target.value as OverrideReasonCode)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                >
                  {OVERRIDE_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Ghi chú Giải trình Bắt buộc (override_notes) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Nhập giải trình chi tiết lý do chọn nhân sự này..."
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E1E9E6]">
              <button
                type="button"
                onClick={() => setChangeModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[13px] font-medium text-[#253438] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !overrideStaffId || !overrideNotes.trim()}
                className="px-4 py-2 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold hover:bg-[#255A51] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Đang lưu...' : 'Xác nhận Can thiệp Phân công'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: REJECT SUGGESTION / DEFER REQUEST
          ===================================================================== */}
      {rejectModalOpen && activeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#253438]/30 p-4">
          <form
            onSubmit={handleRejectConfirmed}
            className="bg-white rounded-[12px] border border-[#E1E9E6] max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-[16px] font-semibold text-[#253438] m-0">
              Từ chối / Tạm hoãn Đề xuất AI ({activeRequest.id})
            </h3>
            <p className="text-[12px] text-[#687A78] m-0">
              Ghi nhận lý do từ chối gợi ý hiện tại hoặc chuyển sang điều phối thủ công.
            </p>
            <textarea
              rows={3}
              required
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E1E9E6] text-[13px] text-[#253438]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#E1E9E6] text-[13px] text-[#253438] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#D85D68] text-white text-[13px] font-semibold cursor-pointer"
              >
                Xác nhận Từ chối
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          DRAWER 4: COMPARE ALL & DISQUALIFIED CANDIDATES (HARD CONSTRAINTS)
          ===================================================================== */}
      {compareDrawerOpen && activeRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#253438]/30">
          <div className="w-full max-w-[620px] bg-white h-full shadow-xl border-l border-[#E1E9E6] flex flex-col">
            <div className="px-6 py-4 border-b border-[#E1E9E6] bg-[#F7FAF9] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#253438] m-0">
                  So sánh Ứng viên & Danh sách Không khả thi ({activeRequest.id})
                </h3>
                <p className="text-[12px] text-[#687A78] m-0">
                  {eligibleCandidates.length} ứng viên khả thi · {disqualifiedCandidates.length} nhân sự bị loại do vi phạm ràng buộc cứng
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompareDrawerOpen(false)}
                className="px-3 py-1 rounded border border-[#E1E9E6] bg-white text-[12px] text-[#253438] cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Eligible Section */}
              <div className="space-y-3">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[#2F6F64]">
                  Ứng viên Khả thi ({eligibleCandidates.length})
                </div>
                {eligibleCandidates.map((cand) => (
                  <div
                    key={cand.staffId}
                    className="p-3.5 rounded-lg border border-[#C6DFD7] bg-[#F7FAF9] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#E5F1EC] text-[#2F6F64]">
                          {cand.rankLabel}
                        </span>
                        <span className="text-[14px] font-semibold text-[#253438]">
                          {cand.staffName}
                        </span>
                        <span className="text-[12px] text-[#687A78]">({cand.staffRole})</span>
                      </div>
                      <div className="text-[12px] text-[#687A78] mt-1 tabular-nums">
                        Kỹ năng: {cand.criteria.skillFitScore}% · Thời gian: {cand.criteria.timeFitScore}% · Khoảng cách: {cand.criteria.distanceKm} km · Tải: {cand.criteria.projectedAssignedMinutes}/480p
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SuitabilityScoreBadge score={cand.totalScore} size="sm" />
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewCandidateId(cand.staffId);
                          setCompareDrawerOpen(false);
                        }}
                        className="px-2.5 py-1 rounded bg-[#2F6F64] text-white text-[12px] font-medium cursor-pointer"
                      >
                        Chọn xem
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Disqualified Section (6 Hard Constraints Violations) */}
              <div className="space-y-3">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[#C03A47]">
                  Ứng viên Không khả thi — Vi phạm Ràng buộc cứng ({disqualifiedCandidates.length})
                </div>
                {disqualifiedCandidates.map((cand) => (
                  <div
                    key={cand.staffId}
                    className="p-3.5 rounded-lg border border-[#F2C6CB] bg-[#FDF2F3]/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[14px] font-semibold text-[#253438]">
                          {cand.staffName}
                        </span>
                        <span className="text-[12px] text-[#687A78] ml-2">
                          ({cand.staffRole} · {cand.zone})
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FDF2F3] text-[#C03A47] border border-[#F2C6CB]">
                        Không hợp lệ (Vi phạm ràng buộc cứng)
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(cand.hardConstraintDetails && cand.hardConstraintDetails.length > 0
                        ? cand.hardConstraintDetails.map((v) => `${v.labelVi}: ${v.detail}`)
                        : cand.constraintViolations
                      ).map((reason, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[12px] text-[#C03A47]"
                        >
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
