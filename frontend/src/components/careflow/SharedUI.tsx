import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Inbox,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Timer,
} from 'lucide-react';
import { AICandidate, MedicalStaff, UnassignedRequest } from '../../types/healthcare';

export type CareFlowRoute =
  | '/overview'
  | '/recommendations'
  | '/dispatch'
  | '/routes'
  | '/requests'
  | '/team'
  | '/reports';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 mb-6 border-b border-[#E1E9E6]">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] leading-[32px] font-semibold text-[#253438] tracking-tight m-0">
          {title}
        </h1>
        {badge}
      </div>
      {subtitle && (
        <p className="text-[14px] text-[#687A78] mt-1 mb-0">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
  </div>
);

export interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'default' | 'teal' | 'warning' | 'danger' | 'success';
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sublabel,
  tone = 'default',
  icon,
  onClick,
}) => {
  const toneStyles: Record<string, { border: string; valueColor: string; iconBg: string }> = {
    default: {
      border: 'border-[#E1E9E6]',
      valueColor: 'text-[#253438]',
      iconBg: 'bg-[#F7FAF9] text-[#687A78]',
    },
    teal: {
      border: 'border-[#C6DFD7]',
      valueColor: 'text-[#2F6F64]',
      iconBg: 'bg-[#E5F1EC] text-[#2F6F64]',
    },
    warning: {
      border: 'border-[#F3D9B1]',
      valueColor: 'text-[#B87514]',
      iconBg: 'bg-[#FDF6EC] text-[#E6A64B]',
    },
    danger: {
      border: 'border-[#F2C6CB]',
      valueColor: 'text-[#C03A47]',
      iconBg: 'bg-[#FDF2F3] text-[#D85D68]',
    },
    success: {
      border: 'border-[#C5E2D7]',
      valueColor: 'text-[#2E755D]',
      iconBg: 'bg-[#EBF6F1] text-[#4D947B]',
    },
  };

  const st = toneStyles[tone] || toneStyles.default;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[10px] border ${st.border} p-4 transition-colors ${
        onClick ? 'cursor-pointer hover:border-[#2F6F64]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium text-[#687A78] uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${st.iconBg}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`text-[28px] leading-[34px] font-semibold mt-2 tabular-nums ${st.valueColor}`}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[12px] text-[#687A78] mt-1.5 flex items-center gap-1.5">
          {sublabel}
        </div>
      )}
    </div>
  );
};

export const formatPriorityLabel = (priority: string): {
  label: string;
  tone: 'urgent' | 'high' | 'standard';
} => {
  if (priority === 'Khẩn cấp' || priority.toLowerCase() === 'urgent') {
    return { label: 'KHẨN CẤP', tone: 'urgent' };
  }
  if (priority === 'Cao' || priority.toLowerCase() === 'high') {
    return { label: 'Ưu tiên cao', tone: 'high' };
  }
  return { label: 'Tiêu chuẩn', tone: 'standard' };
};

export const UrgentCountdownBadge: React.FC<{
  seedId?: string;
  initialSeconds?: number;
  labelPrefix?: string;
}> = ({ seedId = 'default', initialSeconds, labelPrefix = 'SLA' }) => {
  const computeInitialSeconds = () => {
    if (typeof initialSeconds === 'number') return initialSeconds;
    let hash = 0;
    for (let i = 0; i < seedId.length; i++) {
      hash = (hash * 31 + seedId.charCodeAt(i)) % 600;
    }
    // Between 6 minutes (360s) and 15 minutes (900s)
    return 420 + (hash % 480);
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(computeInitialSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#C03A47] text-white border border-[#A32935] tabular-nums shadow-xs"
      title="Thời gian đếm ngược SLA cần xử lý phân công khẩn cấp"
    >
      <Timer className="w-3 h-3 animate-pulse shrink-0" />
      <span>
        {labelPrefix}: {formatted}
      </span>
    </span>
  );
};

export const PriorityBadge: React.FC<{
  priority: string;
  showCountdown?: boolean;
  seedId?: string;
}> = ({ priority, showCountdown = false, seedId }) => {
  const { label, tone } = formatPriorityLabel(priority);
  if (tone === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-[#FDF2F3] text-[#C03A47] border border-[#D85D68]">
          <span className="w-2 h-2 rounded-full bg-[#D85D68] animate-ping" />
          <Flame className="w-3 h-3 text-[#C03A47] shrink-0" />
          {label}
        </span>
        {showCountdown && <UrgentCountdownBadge seedId={seedId || priority} />}
      </span>
    );
  }
  if (tone === 'high') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FDF6EC] text-[#C27D1A] border border-[#F3D9B1]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E6A64B]" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7FAF9] text-[#687A78] border border-[#E1E9E6]">
      {label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = status.toLowerCase();
  if (normalized === 'confirmed' || normalized === 'completed' || normalized === 'đã xác nhận' || normalized === 'hoàn thành') {
    const label =
      normalized === 'completed' || normalized === 'hoàn thành'
        ? 'Hoàn thành'
        : 'Đã xác nhận';
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EBF6F1] text-[#2E755D] border border-[#C5E2D7]">
        <CheckCircle2 className="w-3 h-3" />
        {label}
      </span>
    );
  }
  if (normalized === 'in-progress' || normalized === 'đang thực hiện') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#E5F1EC] text-[#2F6F64] border border-[#B8D9CE]">
        <Clock className="w-3 h-3" />
        Đang thực hiện
      </span>
    );
  }
  if (normalized === 'proposed' || normalized === 'pending review' || normalized === 'chờ duyệt') {
    const label =
      normalized === 'proposed'
        ? 'Chờ xác nhận'
        : normalized === 'pending review'
        ? 'Cần theo dõi tải'
        : status;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FDF6EC] text-[#B87514] border border-[#F3D9B1]">
        {label}
      </span>
    );
  }
  if (
    normalized === 'conflict' ||
    normalized === 'rejected' ||
    normalized === 'manual review' ||
    normalized === 'xung đột' ||
    normalized === 'từ chối'
  ) {
    const label =
      normalized === 'conflict'
        ? 'Xung đột lịch'
        : normalized === 'rejected'
        ? 'Đã từ chối / Nghỉ'
        : normalized === 'manual review'
        ? 'Cần xử lý thủ công'
        : status;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FDF2F3] text-[#C03A47] border border-[#F2C6CB]">
        <AlertTriangle className="w-3 h-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7FAF9] text-[#687A78] border border-[#E1E9E6]">
      {status === 'Unassigned' || status === 'Pending Assignment'
        ? 'Chờ phân công'
        : status}
    </span>
  );
};

export const SuitabilityScoreBadge: React.FC<{
  score: number;
  size?: 'sm' | 'md' | 'lg';
}> = ({ score, size = 'md' }) => {
  const normalized = (score / 100).toFixed(2);
  const isHigh = score >= 80;
  const isMid = score >= 65 && score < 80;

  const colorClasses = isHigh
    ? 'bg-[#E5F1EC] text-[#2F6F64] border-[#B8D9CE]'
    : isMid
    ? 'bg-[#FDF6EC] text-[#B87514] border-[#F3D9B1]'
    : 'bg-[#FDF2F3] text-[#C03A47] border-[#F2C6CB]';

  if (size === 'lg') {
    return (
      <div className={`inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border ${colorClasses}`}>
        <span className="text-[20px] font-semibold tabular-nums leading-none">{score}%</span>
        <span className="text-[11px] opacity-80 font-mono-num">({normalized})</span>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border tabular-nums ${colorClasses}`}>
        {score}%
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold border tabular-nums ${colorClasses}`}>
      <span>{score}%</span>
      <span className="text-[11px] opacity-75 font-mono-num">({normalized})</span>
    </span>
  );
};

export interface HardConstraintCheckItem {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export const evaluateSixHardConstraints = (
  candidate: AICandidate | undefined,
  request: UnassignedRequest | undefined,
  staffMember?: MedicalStaff
): HardConstraintCheckItem[] => {
  if (!candidate || !request) {
    return [];
  }

  const violations = candidate.hardConstraintDetails || [];
  const hasCode = (code: string) => violations.some((v) => v.code === code);
  const hasText = (kw: string) =>
    candidate.constraintViolations.some((v) => v.toLowerCase().includes(kw));

  const skillPassed =
    !hasCode('SKILL_MISMATCH') &&
    candidate.criteria.missingSkills.length === 0 &&
    !hasText('kỹ năng');

  const activePassed =
    !hasCode('LEAVE_CONFLICT') &&
    !staffMember?.isOnApprovedLeave &&
    !hasText('nghỉ phép');

  const availabilityPassed =
    !hasCode('OUTSIDE_SHIFT_HOURS') && !hasText('ca trực');

  const noOverlapPassed =
    !hasCode('DIRECT_OVERLAP') && !hasText('trùng');

  const travelPassed =
    !hasCode('TRAVEL_INFEASIBLE') && !hasText('di chuyển');

  const maxDurationPassed =
    !hasCode('EXCEEDS_DAILY_WORKLOAD') &&
    candidate.criteria.projectedAssignedMinutes <= candidate.criteria.maxDailyMinutes &&
    !hasText('vượt trần');

  return [
    {
      key: 'skill_match',
      label: 'Đáp ứng kỹ năng bắt buộc',
      passed: skillPassed,
      detail: skillPassed
        ? `Đạt (${candidate.criteria.matchedSkills.join(', ') || 'Đủ chứng chỉ'})`
        : `Thiếu: ${candidate.criteria.missingSkills.join(', ') || 'Chứng chỉ chuyên môn'}`,
    },
    {
      key: 'active_status',
      label: 'Trạng thái nhân sự đang trực',
      passed: activePassed,
      detail: activePassed
        ? 'Đang trong danh sách trực'
        : staffMember?.leaveWindowText || 'Đang nghỉ phép đã duyệt',
    },
    {
      key: 'shift_availability',
      label: 'Nằm trong khung giờ ca trực',
      passed: availabilityPassed,
      detail: availabilityPassed
        ? `Ca trực (${staffMember?.shiftStart || '07:30'}–${staffMember?.shiftEnd || '17:30'})`
        : 'Ngoài khung giờ ca trực',
    },
    {
      key: 'no_overlap',
      label: 'Không trùng lịch ca khám khác',
      passed: noOverlapPassed,
      detail: noOverlapPassed
        ? `Khung giờ trống (${candidate.criteria.availableGapText})`
        : 'Trùng trực tiếp với ca khám khác',
    },
    {
      key: 'travel_feasibility',
      label: 'Đảm bảo thời gian di chuyển',
      passed: travelPassed,
      detail: travelPassed
        ? `${candidate.criteria.distanceKm} km (~${candidate.criteria.travelMinutes} phút di chuyển)`
        : `Không đủ thời gian di chuyển (cần ${candidate.criteria.travelMinutes} phút)`,
    },
    {
      key: 'max_daily_duration',
      label: 'Không vượt trần 480 phút/ngày',
      passed: maxDurationPassed,
      detail: `${candidate.criteria.projectedAssignedMinutes}/${candidate.criteria.maxDailyMinutes} phút (${candidate.criteria.projectedWorkloadPct}%)`,
    },
  ];
};

export const ConstraintCheckList: React.FC<{
  checks: HardConstraintCheckItem[];
  compact?: boolean;
}> = ({ checks, compact = false }) => {
  const allPassed = checks.length > 0 && checks.every((c) => c.passed);

  return (
    <div className="rounded-lg border border-[#E1E9E6] bg-[#F7FAF9] p-3">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#E1E9E6]">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#253438]">
          {allPassed ? (
            <ShieldCheck className="w-4 h-4 text-[#4D947B]" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-[#D85D68]" />
          )}
          <span>Kiểm tra Ràng buộc cứng (6/6 Quy tắc)</span>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            allPassed
              ? 'bg-[#EBF6F1] text-[#2E755D]'
              : 'bg-[#FDF2F3] text-[#C03A47]'
          }`}
        >
          {allPassed
            ? 'Đạt cả 6 điều kiện'
            : `Vi phạm ${checks.filter((c) => !c.passed).length} điều kiện`}
        </span>
      </div>

      <div className={compact ? 'grid grid-cols-1 gap-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
        {checks.map((item) => (
          <div
            key={item.key}
            className={`flex items-start gap-2 p-2 rounded border text-[12px] ${
              item.passed
                ? 'bg-white border-[#E1E9E6]'
                : 'bg-[#FDF2F3] border-[#F2C6CB]'
            }`}
          >
            {item.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4D947B] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-[#D85D68] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`font-medium leading-tight ${
                  item.passed ? 'text-[#253438]' : 'text-[#C03A47]'
                }`}
              >
                {item.label}
              </div>
              <div className="text-[11px] text-[#687A78] truncate mt-0.5 tabular-nums">
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const EmptyStateCard: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="bg-white rounded-[10px] border border-[#E1E9E6] p-8 text-center flex flex-col items-center justify-center">
    <div className="w-10 h-10 rounded-full bg-[#E5F1EC] text-[#2F6F64] flex items-center justify-center mb-3">
      <Inbox className="w-5 h-5" />
    </div>
    <h3 className="text-[15px] font-semibold text-[#253438] m-0">{title}</h3>
    <p className="text-[13px] text-[#687A78] max-w-md mt-1 mb-0">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-3.5 py-1.5 rounded-lg bg-[#2F6F64] text-white text-[13px] font-medium hover:bg-[#255A51] transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
