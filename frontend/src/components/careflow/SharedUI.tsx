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

export const SUPPORTED_ZONES = [
  'Phường Lộc Thọ',
  'Phường Tân Lập',
  'Phường Phước Tiến',
  'Phường Vĩnh Nguyên',
  'Phường Vĩnh Hải',
  'Phường Phước Hải',
  'Phường Vạn Thạnh',
  'Phường Phương Sài',
];

const EXTRA_NHA_TRANG_WARDS: Record<string, string> = {
  'vinh phuoc': 'Phường Vĩnh Phước',
  'vinh truong': 'Phường Vĩnh Trường',
  'vinh ngoc': 'Xã Vĩnh Ngọc',
  'phuoc hoa': 'Phường Phước Hòa',
  'xuong huan': 'Phường Xương Huân',
  'phuoc tan': 'Phường Phước Tân',
  'phuoc long': 'Phường Phước Long',
  'ngoc hiep': 'Phường Ngọc Hiệp',
  'vinh thai': 'Xã Vĩnh Thái',
  'vinh hiep': 'Xã Vĩnh Hiệp',
};

export const normalizeVi = (s: string): string => {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/^(phường|phuong|xã|xa)\s+/i, '')
    .trim();
};

export const displayWard = (district: string): string => {
  if (!district) return '';
  const norm = normalizeVi(district);
  const matchedZone = SUPPORTED_ZONES.find((z) => normalizeVi(z) === norm);
  if (matchedZone) return matchedZone;
  if (EXTRA_NHA_TRANG_WARDS[norm]) return EXTRA_NHA_TRANG_WARDS[norm];
  return district;
};

const SKILL_NAME_BY_ID: Record<number, string> = {
  1: 'Chăm sóc và rửa vết thương cơ bản',
  2: 'Thay băng cắt chỉ & rửa vết mổ phẫu thuật',
  3: 'Tiêm truyền tĩnh mạch & lấy mẫu máu xét nghiệm',
  4: 'Vật lý trị liệu & phục hồi chức năng vận động',
  5: 'Chăm sóc bệnh nhân thở máy & mở khí quản',
  6: 'Theo dõi sinh hiệu, huyết áp & đường huyết người cao tuổi',
  7: 'Chăm sóc loét tỳ đè & biến chứng đái tháo đường',
  8: 'Tắm bé sơ sinh & chăm sóc rốn trẻ em',
  9: 'Xoa bóp bấm huyệt & trị liệu đông y phục hồi',
  10: 'Đặt ống sonde dạ dày & hỗ trợ dinh dưỡng qua ống',
};

export const formatConstraintReason = (raw: string): string => {
  if (!raw) return '';
  let text = raw.trim();
  text = text.replace(/^(H[1-6]|Loại ứng viên)\s*:\s*/i, '');
  text = text.replace(/Thiếu kỹ năng bắt buộc ID\s*(\d+)/gi, (_, idStr) => {
    const name = SKILL_NAME_BY_ID[Number(idStr)];
    return name ? `Thiếu kỹ năng: ${name}` : `Thiếu kỹ năng chuyên môn`;
  });
  text = text.replace(/Kỹ năng ID\s*(\d+)\s*chưa đạt cấp độ tối thiểu\s*(\d+)/gi, (_, idStr, lvl) => {
    const name = SKILL_NAME_BY_ID[Number(idStr)];
    return name
      ? `Kỹ năng "${name}" chưa đạt cấp độ tối thiểu ${lvl}`
      : `Kỹ năng chưa đạt cấp độ tối thiểu ${lvl}`;
  });
  return text;
};

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
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 mb-6 border-b border-line">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[28px] leading-[36px] font-semibold text-brand-800 tracking-tight m-0">
          {title}
        </h1>
        {badge}
      </div>
      {subtitle && (
        <p className="text-[14px] text-muted mt-1 mb-0">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
  </div>
);

export interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'default' | 'teal' | 'ai' | 'sun' | 'warning' | 'danger' | 'success';
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
  // Mỗi tone là một ô màu riêng để hàng KPI không đơn điệu
  const toneStyles: Record<string, { card: string; valueColor: string; iconBg: string; label: string }> = {
    default: {
      card: 'bg-white border-line',
      valueColor: 'text-ink',
      iconBg: 'bg-brand-50 text-brand-600',
      label: 'text-muted',
    },
    teal: {
      card: 'bg-gradient-to-br from-brand-100 to-brand-50 border-brand-200',
      valueColor: 'text-brand-700',
      iconBg: 'bg-white text-brand-600',
      label: 'text-brand-700',
    },
    ai: {
      card: 'bg-gradient-to-br from-lav-100 to-lav-50 border-lav-200',
      valueColor: 'text-lav-700',
      iconBg: 'bg-white text-lav-700',
      label: 'text-lav-700',
    },
    sun: {
      card: 'bg-gradient-to-br from-sun-100 to-sun-50 border-sun-300',
      valueColor: 'text-sun-700',
      iconBg: 'bg-white text-sun-700',
      label: 'text-sun-700',
    },
    warning: {
      card: 'bg-high-tint border-high-line',
      valueColor: 'text-high-ink',
      iconBg: 'bg-white text-high',
      label: 'text-high-ink',
    },
    danger: {
      card: 'bg-white border-2 border-urgent',
      valueColor: 'text-urgent',
      iconBg: 'bg-urgent-tint text-urgent',
      label: 'text-urgent-ink',
    },
    success: {
      card: 'bg-ok-tint border-ok-line',
      valueColor: 'text-ok',
      iconBg: 'bg-white text-ok',
      label: 'text-ok',
    },
  };

  const st = toneStyles[tone] || toneStyles.default;

  return (
    <div
      onClick={onClick}
      className={`h-full rounded-2xl border ${st.card} p-4 transition-transform ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[12px] font-bold uppercase tracking-wider ${st.label}`}>
          {label}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${st.iconBg}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`font-display text-[30px] leading-[36px] font-semibold mt-2 tabular-nums ${st.valueColor}`}>
        {value}
      </div>
      {sublabel && (
        <div className={`text-[12px] mt-1.5 flex items-center gap-1.5 ${st.label}`}>
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

/**
 * Lấy giờ hẹn (HH:MM đầu tiên) từ chuỗi như '17:00 - 19:00' hoặc '09:15'.
 */
const parseDeadlineSeconds = (deadline?: string): number | null => {
  if (!deadline) return null;
  const m = deadline.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60;
};

const formatDuration = (totalSeconds: number): string => {
  const t = Math.abs(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
};

/**
 * Đồng hồ SLA thật: đếm thời gian còn lại tới giờ bắt đầu khung hẹn của ca
 * (so với giờ hiện tại trong ngày). Đổi màu theo mức độ:
 *  > 30 phút: xanh · 10–30 phút: vàng nắng · < 10 phút: đỏ · quá giờ: đỏ đậm nhấp nháy.
 */
export const UrgentCountdownBadge: React.FC<{
  deadline?: string;
  labelPrefix?: string;
}> = ({ deadline, labelPrefix = 'Còn' }) => {
  const deadlineSec = parseDeadlineSeconds(deadline);
  const nowSeconds = () => {
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };
  const [now, setNow] = useState<number>(nowSeconds);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowSeconds()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (deadlineSec === null) return null;
  const left = deadlineSec - now;

  let cls = 'bg-ok-tint text-ok border-ok-line';
  let text = `${labelPrefix} ${formatDuration(left)}`;
  if (left <= 0) {
    cls = 'bg-urgent-deep text-white border-urgent-deep animate-pulse';
    text = `Quá giờ hẹn +${formatDuration(left)}`;
  } else if (left < 10 * 60) {
    cls = 'bg-urgent text-white border-urgent';
  } else if (left < 30 * 60) {
    cls = 'bg-sun-100 text-sun-700 border-sun-400';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border tabular-nums font-mono-num ${cls}`}
      title={`Thời gian còn lại tới giờ hẹn ${deadline}`}
    >
      <Timer className="w-3 h-3 shrink-0" />
      <span>{text}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{
  priority: string;
  showCountdown?: boolean;
  deadline?: string;
}> = ({ priority, showCountdown = false, deadline }) => {
  const { label, tone } = formatPriorityLabel(priority);
  if (tone === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-urgent text-white shadow-urgent">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-white animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-white" />
          </span>
          <Flame className="w-3 h-3 shrink-0" />
          {label}
        </span>
        {showCountdown && <UrgentCountdownBadge deadline={deadline} />}
      </span>
    );
  }
  if (tone === 'high') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-high-tint text-high-ink border border-high">
        <span className="w-1.5 h-1.5 rounded-full bg-high" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-muted border border-line">
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-ok-tint text-ok border border-brand-200">
        <CheckCircle2 className="w-3 h-3" />
        {label}
      </span>
    );
  }
  if (normalized === 'in-progress' || normalized === 'đang thực hiện') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-brand-100 text-brand-600 border border-brand-200">
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-high-tint text-high-ink border border-high-line">
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
    // Xung đột: hồng đậm; thủ công/từ chối: cam. Đỏ chỉ dành cho ca Khẩn cấp.
    const cls =
      normalized === 'conflict' || normalized === 'xung đột'
        ? 'bg-conflict-tint text-conflict border-conflict/40'
        : 'bg-high-tint text-high-ink border-high-line';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
        <AlertTriangle className="w-3 h-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-canvas text-muted border border-line">
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
  const rounded = Math.round(score);
  const isHigh = rounded >= 80;
  const isMid = rounded >= 65 && rounded < 80;

  const colorClasses = isHigh
    ? 'bg-lav-100 text-lav-700 border-lav-200'
    : isMid
    ? 'bg-sun-100 text-sun-700 border-sun-300'
    : 'bg-canvas text-muted border-line-strong';

  if (size === 'lg') {
    return (
      <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border ${colorClasses}`}>
        <span className="text-[20px] font-semibold tabular-nums leading-none">{rounded}%</span>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border tabular-nums ${colorClasses}`}>
        {rounded}%
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[14px] font-bold border tabular-nums ${colorClasses}`}>
      {rounded}%
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

  const rawSkillViolation =
    candidate.constraintViolations.find((v) => /H1:|kỹ năng/i.test(v)) ||
    violations.find((v) => v.code === 'SKILL_MISMATCH')?.detail ||
    '';

  return [
    {
      key: 'skill_match',
      label: 'Đáp ứng kỹ năng bắt buộc',
      passed: skillPassed,
      detail: skillPassed
        ? `Đạt (${candidate.criteria.matchedSkills.join(', ') || 'Đủ chứng chỉ'})`
        : candidate.criteria.missingSkills.length > 0
        ? `Thiếu: ${candidate.criteria.missingSkills.join(', ')}`
        : rawSkillViolation
        ? formatConstraintReason(rawSkillViolation)
        : 'Thiếu chứng chỉ chuyên môn',
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
    <div className="rounded-lg border border-line bg-canvas p-3">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-line">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          {allPassed ? (
            <ShieldCheck className="w-4 h-4 text-ok" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-urgent" />
          )}
          <span>Kiểm tra Ràng buộc cứng (6/6 Quy tắc)</span>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            allPassed
              ? 'bg-ok-tint text-ok'
              : 'bg-urgent-tint text-urgent'
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
                ? 'bg-white border-line'
                : 'bg-urgent-tint border-urgent-line'
            }`}
          >
            {item.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-urgent shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`font-medium leading-tight ${
                  item.passed ? 'text-ink' : 'text-urgent'
                }`}
              >
                {item.label}
              </div>
              <div className="text-[11px] text-muted truncate mt-0.5 tabular-nums">
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
  <div className="bg-white rounded-[10px] border border-line p-8 text-center flex flex-col items-center justify-center">
    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-3">
      <Inbox className="w-5 h-5" />
    </div>
    <h3 className="text-[15px] font-semibold text-ink m-0">{title}</h3>
    <p className="text-[13px] text-muted max-w-md mt-1 mb-0">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-[13px] font-medium hover:bg-brand-700 transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
