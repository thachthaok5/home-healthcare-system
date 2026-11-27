import React from 'react';
import {
  Calendar,
  Plus,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Clock,
  CheckCircle2,
  ClipboardList,
  MapPin,
} from 'lucide-react';
import {
  DispatchAssignment,
  UnassignedRequest,
} from '../../types/healthcare';
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  PriorityBadge,
  UrgentCountdownBadge,
  SuitabilityScoreBadge,
  CareFlowRoute,
} from './SharedUI';

export interface OverviewPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  assignments: DispatchAssignment[];
  unassignedRequests: UnassignedRequest[];
  onNavigate: (route: CareFlowRoute, requestId?: string) => void;
  onOpenNewRequest: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  selectedDate,
  onDateChange,
  assignments,
  unassignedRequests,
  onNavigate,
  onOpenNewRequest,
}) => {
  const visitsTodayCount = assignments.length;
  const pendingAssignmentsCount = unassignedRequests.length;
  const awaitingConfirmationCount = assignments.filter(
    (a) => a.status === 'Proposed'
  ).length;
  const conflictAssignments = assignments.filter((a) => a.isConflict);
  const urgentRequests = unassignedRequests.filter(
    (r) => r.priority === 'Khẩn cấp' || r.priority === 'Cao'
  );
  const schedulingAlertsCount =
    conflictAssignments.length +
    unassignedRequests.filter((r) => r.priority === 'Khẩn cấp').length;

  const previewAssignments = [...assignments]
    .sort((a, b) => {
      const aUrgent = a.priority === 'Khẩn cấp' || a.isConflict ? 0 : 1;
      const bUrgent = b.priority === 'Khẩn cấp' || b.isConflict ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 6);

  const attentionItems: {
    id: string;
    type: 'conflict' | 'urgent_request' | 'confirmation';
    title: string;
    subtitle: string;
    severity: 'danger' | 'warning';
    targetRoute: CareFlowRoute;
    targetRequestId?: string;
    deadline?: string;
  }[] = [];

  conflictAssignments.forEach((ca) => {
    attentionItems.push({
      id: `conf-${ca.id}`,
      type: 'conflict',
      title: `Xung đột lịch trình: ${ca.staffName}`,
      subtitle: `${ca.id} (${ca.startTime}–${ca.endTime}) bị trùng ${
        ca.conflictDetail?.overlapMinutes || 15
      } phút tại ${ca.district}`,
      severity: 'danger',
      targetRoute: '/dispatch',
    });
  });

  urgentRequests.slice(0, 3).forEach((req) => {
    attentionItems.push({
      id: `urg-${req.id}`,
      type: 'urgent_request',
      title: `${req.priority === 'Khẩn cấp' ? 'Khẩn cấp' : 'Ưu tiên cao'} chưa phân công: ${req.id}`,
      subtitle: `${req.serviceName} · Khung giờ ${req.requestedWindow} (${req.district})`,
      severity: req.priority === 'Khẩn cấp' ? 'danger' : 'warning',
      targetRoute: '/recommendations',
      targetRequestId: req.id,
      deadline: req.requestedWindow,
    });
  });

  assignments
    .filter((a) => a.status === 'Proposed')
    .slice(0, 2)
    .forEach((prop) => {
      attentionItems.push({
        id: `prop-${prop.id}`,
        type: 'confirmation',
        title: `Chờ xác nhận lịch: ${prop.id}`,
        subtitle: `Dự kiến giao ${prop.staffName} lúc ${prop.startTime} (${prop.serviceName})`,
        severity: 'warning',
        targetRoute: '/dispatch',
      });
    });

  // Sort urgent (danger) items to the top
  attentionItems.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'danger' ? -1 : 1;
  });

  const priorityOrder: Record<string, number> = {
    'Khẩn cấp': 0,
    Cao: 1,
    'Tiêu chuẩn': 2,
  };

  const topRecommendations = [...unassignedRequests]
    .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* 5.1 Page Heading */}
      <PageHeader
        title="Tổng quan Vận hành"
        subtitle="Tình hình điều phối chăm sóc y tế tại nhà trong ngày"
        actions={
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-white text-[13px] text-ink">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span className="text-muted text-[12px]">Ngày trực:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="text-[13px] font-medium text-ink bg-transparent border-none outline-none tabular-nums cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-[13px] font-medium hover:bg-brand-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo Yêu cầu Chăm sóc
            </button>
          </>
        }
      />

      {/* 5.2 Top KPI Row: bento, ô cảnh báo rộng gấp đôi và đặt đầu tiên */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="sm:col-span-2">
          <KpiCard
            label="Cảnh báo Lịch trình"
            value={schedulingAlertsCount}
            sublabel={`${conflictAssignments.length} ca trùng lịch · ${
              unassignedRequests.filter((r) => r.priority === 'Khẩn cấp').length
            } ca khẩn cấp`}
            tone={schedulingAlertsCount > 0 ? 'danger' : 'success'}
            icon={<AlertTriangle className="w-4 h-4" />}
            onClick={() => onNavigate('/dispatch')}
          />
        </div>
        <KpiCard
          label="Ca khám Hôm nay"
          value={visitsTodayCount}
          sublabel="Đã xếp lịch cho đội ngũ y tế"
          tone="teal"
          icon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => onNavigate('/dispatch')}
        />
        <KpiCard
          label="Chờ Phân công"
          value={pendingAssignmentsCount}
          sublabel="Yêu cầu mới đang chờ điều phối"
          tone={pendingAssignmentsCount > 0 ? 'sun' : 'default'}
          icon={<ClipboardList className="w-4 h-4" />}
          onClick={() => onNavigate('/recommendations')}
        />
        <KpiCard
          label="Chờ Xác nhận"
          value={awaitingConfirmationCount}
          sublabel="Ca đề xuất cần điều phối viên duyệt"
          tone="ai"
          icon={<Clock className="w-4 h-4" />}
          onClick={() => onNavigate('/dispatch')}
        />
      </div>

      {/* 5.3 Top Priority Area (2-Column Layout: Left = Cần Xử lý Ngay, Right = Đề xuất AI) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Cần Xử lý Ngay */}
        <div className="lg:col-span-5 bg-white rounded-[10px] border border-line overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-ink m-0">
                Cần Xử lý Ngay
              </h2>
              <p className="text-[12px] text-muted m-0 mt-0.5">
                Cảnh báo trùng lịch và ca ưu tiên chưa phân công
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-urgent-tint text-urgent border border-urgent-line tabular-nums">
              {attentionItems.length}
            </span>
          </div>

          <div className="p-3 space-y-2.5 flex-1">
            {attentionItems.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted">
                Hiện không có cảnh báo xung đột lịch trình nào.
              </div>
            ) : (
              attentionItems.slice(0, 5).map((item) => {
                const isUrgent = item.severity === 'danger';
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg flex items-start justify-between gap-3 transition-colors ${
                      isUrgent
                        ? 'border-2 border-urgent bg-urgent-tint/55 hover:bg-urgent-tint'
                        : 'border border-line bg-white hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          isUrgent ? 'bg-urgent animate-pulse' : 'bg-high'
                        }`}
                      />
                      <div className="min-w-0 space-y-1">
                        {isUrgent && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PriorityBadge priority="Khẩn cấp" />
                            <UrgentCountdownBadge deadline={item.deadline} />
                          </div>
                        )}
                        <div
                          className={`text-[13px] font-semibold leading-snug ${
                            isUrgent ? 'text-urgent-ink' : 'text-ink'
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-[12px] text-muted leading-snug">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.targetRoute, item.targetRequestId)}
                      className={`px-2.5 py-1.5 rounded-md text-[12px] font-semibold shrink-0 cursor-pointer transition-colors ${
                        isUrgent
                          ? 'bg-urgent text-white border border-urgent-ink hover:bg-urgent-ink'
                          : 'border border-line bg-white text-brand-600 hover:bg-brand-100 hover:border-brand-600'
                      }`}
                    >
                      Xem xét
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Đề xuất AI Chờ Điều phối viên Xét duyệt */}
        <div className="lg:col-span-7 bg-white rounded-[10px] border border-line overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-lav-100 text-lav-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-ink m-0">
                  Đề xuất AI Chờ Điều phối viên Xét duyệt
                </h2>
                <p className="text-[12px] text-muted m-0 mt-0.5">
                  Ứng viên Top 1 phù hợp nhất đang chờ phê duyệt (Human-in-the-loop)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/recommendations')}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 shrink-0 cursor-pointer"
            >
              Xem tất cả ({unassignedRequests.length})
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {topRecommendations.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-muted flex-1 flex items-center justify-center">
              Tất cả yêu cầu chăm sóc đã được xét duyệt và phân công.
            </div>
          ) : (
            <div className="p-3 space-y-2.5 flex-1">
              {topRecommendations.map((req) => {
                const isUrgent = req.priority === 'Khẩn cấp';
                const top1 = req.aiCandidates.find((c) => c.isEligible) || req.aiCandidates[0];
                const conciseReason = top1
                  ? `Khớp kỹ năng (${top1.criteria.matchedSkills[0] || 'Đạt chuẩn'}) + trống lịch (${top1.criteria.distanceKm} km)`
                  : 'Cần can thiệp thủ công — kiểm tra ràng buộc';

                return (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isUrgent
                        ? 'border-2 border-urgent bg-urgent-tint/50 hover:bg-urgent-tint'
                        : 'border border-line bg-white hover:bg-canvas/70'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-mono-num text-[12px] font-semibold px-2 py-0.5 rounded ${
                            isUrgent
                              ? 'bg-urgent text-white'
                              : 'text-brand-600 bg-brand-100'
                          }`}
                        >
                          {req.id}
                        </span>
                        <PriorityBadge
                          priority={req.priority}
                          showCountdown={isUrgent}
                          deadline={req.requestedWindow}
                        />
                        <span className="text-[12px] text-muted tabular-nums">
                          · Khung giờ: {req.requestedWindow}
                        </span>
                      </div>

                      <div>
                        <div
                          className={`text-[14px] font-semibold truncate ${
                            isUrgent ? 'text-urgent-ink' : 'text-ink'
                          }`}
                        >
                          {req.serviceName}
                        </div>
                        <div className="text-[12px] text-muted flex items-center gap-2 mt-0.5">
                          <span className="font-medium text-ink">{req.patientName}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {req.district}
                          </span>
                        </div>
                      </div>
                    </div>

                    {top1 && (
                      <div
                        className={`sm:w-[260px] shrink-0 p-2.5 rounded-lg space-y-1 border ${
                          isUrgent
                            ? 'bg-white border-urgent-line'
                            : 'bg-canvas border-line'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wider text-muted">
                              Nhân sự Đề xuất
                            </div>
                            <div className="text-[13px] font-semibold text-ink truncate">
                              {top1.staffName}
                            </div>
                          </div>
                          <SuitabilityScoreBadge score={top1.totalScore} size="sm" />
                        </div>
                        <div className="text-[11px] text-muted leading-snug truncate">
                          {conciseReason}
                        </div>
                      </div>
                    )}

                    <div className="shrink-0 flex sm:flex-col items-end justify-end">
                      <button
                        type="button"
                        onClick={() => onNavigate('/recommendations', req.id)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-colors ${
                          isUrgent
                            ? 'bg-urgent text-white border border-urgent-ink hover:bg-urgent-ink'
                            : 'border border-line bg-white text-brand-600 hover:bg-brand-100 hover:border-brand-600'
                        }`}
                      >
                        Đánh giá
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5.4 Bottom Section — Lịch trình Hôm nay */}
      <div className="bg-white rounded-[10px] border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-ink m-0">
              Lịch trình Hôm nay
            </h2>
            <p className="text-[12px] text-muted m-0 mt-0.5">
              Danh sách tóm tắt các ca chăm sóc đang và sắp diễn ra
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/dispatch')}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
          >
            Mở Bảng Điều phối
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          {previewAssignments.map((visit) => {
            const isUrgentVisit = visit.priority === 'Khẩn cấp' || visit.isConflict;
            return (
              <div
                key={visit.id}
                onClick={() => onNavigate('/dispatch')}
                className={`px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isUrgentVisit
                    ? 'border-2 border-urgent bg-urgent-tint/50 hover:bg-urgent-tint'
                    : 'border border-line bg-white hover:bg-canvas'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`px-2.5 py-1 rounded text-[12px] font-semibold tabular-nums shrink-0 ${
                      isUrgentVisit
                        ? 'bg-urgent text-white'
                        : 'bg-brand-100 text-brand-600'
                    }`}
                  >
                    {visit.startTime} – {visit.endTime}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[13px] font-semibold ${
                          isUrgentVisit ? 'text-urgent-ink' : 'text-ink'
                        }`}
                      >
                        {visit.staffName}
                      </span>
                      <span className="text-[12px] text-muted font-mono-num">
                        ({visit.id})
                      </span>
                      {isUrgentVisit && (
                        <>
                          <PriorityBadge priority="Khẩn cấp" />
                          <UrgentCountdownBadge deadline={visit.startTime} />
                        </>
                      )}
                    </div>
                    <div className="text-[13px] text-muted truncate mt-0.5">
                      {visit.serviceName} ·{' '}
                      <span className="text-ink font-medium">{visit.patientName}</span> (
                      {visit.district})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {visit.isConflict ? (
                    <StatusBadge status="Conflict" />
                  ) : (
                    <StatusBadge status={visit.status} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
