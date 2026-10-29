import React, { useState, useEffect, useMemo } from 'react';
import {
  App as AntdApp,
  Drawer,
  Input,
  Modal,
  Select,
  Slider,
  Tooltip,
} from 'antd';
import {
  SlidersHorizontal,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  ArrowLeft,
  Flame,
  Stethoscope,
  Clock,
  MapPin,
  CheckCircle2,
  UserCheck,
  Zap,
  PackageCheck,
  Rows3,
  LayoutList,
  GitBranch,
  Activity,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  UserX,
  Wrench,
  FileWarning,
  ArrowRightLeft,
} from 'lucide-react';
import {
  UnassignedRequest,
  AICandidate,
  DSSWeights,
  OverrideLog,
  OverrideReasonItem,
  OverrideReasonCode,
  HardConstraintViolation,
} from '../types/healthcare';

interface AIRecommendationScreenProps {
  unassignedRequests: UnassignedRequest[];
  dssWeights: DSSWeights;
  overrideLogs: OverrideLog[];
  onAssignRequest: (
    req: UnassignedRequest,
    chosenCandidate: AICandidate,
    isOverride: boolean,
    overrideCategory?: string,
    overrideReason?: string,
    overrideReasonCode?: string
  ) => Promise<void>;
  onUpdateWeights: (newWeights: DSSWeights) => Promise<void>;
  onNavigateToGantt: () => void;
}

type KPIBucketKey = 'queue' | 'urgent' | 'active' | 'completed';
type TableDensity = 'comfortable' | 'compact';

interface ProtocolStep {
  id: string;
  stepNumber: number;
  shortTitle: string;
  subTag: string;
}

interface ScalableQueueRecord {
  id: string;
  patientName: string;
  patientAge: number;
  serviceName: string;
  symptomKeyword: string;
  district: string;
  addressShort: string;
  caregiverPhone: string;
  requestedWindow: string;
  preferredStart: string;
  standardDurationMin: number;
  predictedDurationMin: number;
  clinicalSeverity: string;
  specializedEquipment: string[];
  slaMinutes: number;
  priority: 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn';
  bucket: KPIBucketKey;
  vitals: {
    bp: string;
    spo2: string;
    heartRate: string;
    riskShort: string;
  };
  requiredSkills: string[];
  emergencyKit: string[];
  protocolSteps: ProtocolStep[];
  linkedRequest?: UnassignedRequest;
}

const DEFAULT_OVERRIDE_REASONS: OverrideReasonItem[] = [
  {
    code: 'distance',
    label: 'Vị trí địa lý thuận tiện hơn thực tế.',
    description: 'Nhân viên đang ở gần nhà bệnh nhân hơn hoặc thuận tuyến đường thực tế tại Nha Trang.',
  },
  {
    code: 'skill',
    label: 'Tay nghề chuyên sâu phù hợp ca bệnh nặng.',
    description: 'Ca bệnh diễn biến phức tạp cần nhân sự có kinh nghiệm lâm sàng chuyên sâu hơn.',
  },
  {
    code: 'customer_request',
    label: 'Gia đình bệnh nhân yêu cầu đích danh.',
    description: 'Bệnh nhân hoặc người nhà mong muốn nhân viên y tế quen thuộc tiếp tục chăm sóc.',
  },
  {
    code: 'time_constraint',
    label: 'Ràng buộc thời gian đột xuất.',
    description: 'Thay đổi khung giờ tiếp nhận đột xuất hoặc nhân viên Top 1 phát sinh việc khẩn.',
  },
  {
    code: 'workload_balance',
    label: 'Điều tiết tải nội bộ trạm y tế.',
    description: 'Chủ động san sẻ khối lượng công việc trong ca giữa các điều dưỡng/bác sĩ.',
  },
  {
    code: 'other',
    label: 'Yêu cầu đặc biệt khác.',
    description: 'Các tình huống vận hành đặc thù khác của Điều phối viên.',
  },
];

const NHA_TRANG_WARDS = [
  'Phường Lộc Thọ',
  'Phường Tân Lập',
  'Phường Phước Hải',
  'Phường Vĩnh Hải',
  'Phường Vĩnh Nguyên',
  'Phường Vạn Thạnh',
  'Phường Phương Sài',
];

function shortenServiceTitle(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('loét') || lower.includes('vac')) return 'Thay băng VAC';
  if (lower.includes('khí quản') || lower.includes('tắc đờm')) return 'Hút đờm khí quản';
  if (lower.includes('chảy máu') || lower.includes('hậu phẫu')) return 'Cầm máu hậu phẫu';
  if (lower.includes('kháng sinh') || lower.includes('truyền')) return 'Truyền kháng sinh';
  if (lower.includes('huyết áp') || lower.includes('tai biến')) return 'Hạ áp cấp cứu';
  if (lower.includes('đường huyết') || lower.includes('tiểu đường')) return 'Cấp cứu hạ đường';
  if (lower.includes('vật lý') || lower.includes('phục hồi')) return 'Tập phục hồi cơ';
  if (lower.includes('lão khoa')) return 'Khám Nội Lão khoa';
  if (raw.length > 26) return raw.slice(0, 24).trim() + '…';
  return raw;
}

function formatNormalizedScore(cand: AICandidate): string {
  const norm =
    typeof cand.dssScoreNormalized === 'number'
      ? cand.dssScoreNormalized
      : cand.totalScore / 100;
  return norm.toFixed(2);
}

function getBarColorClass(score: number): string {
  if (score >= 80) return 'bg-[#2D7D46]';
  if (score >= 60) return 'bg-[#D97706]';
  return 'bg-[#D93843]';
}

function getStrokeColorHex(score: number): string {
  if (score >= 80) return '#2D7D46';
  if (score >= 60) return '#D97706';
  return '#D93843';
}

function getInitials(name: string): string {
  const parts = name
    .replace(/^(ĐD\.|BS\.|CN\.|ThS\.|CKI\.|KTV\.)\s*/gi, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * COMPACT BADGE COMPONENT (Thẻ badge nhỏ gọn)
 */
const CompactBadge: React.FC<{
  tone?: 'urgent' | 'optimal' | 'primary' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon, children }) => {
  const styles = {
    urgent: 'bg-[#FEF2F2] text-[#D93843] border-[#FECACA]',
    optimal: 'bg-[#EAF5EE] text-[#2D7D46] border-[#B7DFC5]',
    primary: 'bg-[#EEF1EE] text-[#4B5850] border-[#CBD2CD]',
    warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
    neutral: 'bg-white text-[#4A5550] border-[#DDE1DA]',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] border text-[11px] font-semibold leading-4 whitespace-nowrap shrink-0 ${styles}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};

/**
 * MINI SVG RADIAL RING GAUGE
 */
const MiniRadialGauge: React.FC<{
  value: number;
  label: string;
  subValue?: string;
  size?: number;
}> = ({ value, label, subValue, size = 38 }) => {
  const clamped = Math.max(0, Math.min(100, value));
  const strokeWidth = 3.5;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = getStrokeColorHex(clamped);

  return (
    <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-[6px] border border-[#ECEFE9]">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#ECEFE9"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[10px] font-semibold font-mono-num text-[#1E2421]">
          {(clamped / 100).toFixed(2)}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[#1E2421] leading-tight truncate">
          {label}
        </div>
        {subValue && (
          <div className="text-[10px] text-[#68746E] font-mono-num leading-tight mt-0.5">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 2-COLOR STACKED PROGRESS BAR (THANH TIẾN TRÌNH GỘP KHỐI LƯỢNG CÔNG VIỆC)
 * - Màu 1 (Sage Green #4E6E5D): Số giờ/phút đã kín lịch (Assigned Workload)
 * - Màu 2 (Warm Amber Beige #D49B4B): Số giờ/phút tăng thêm nếu nhận ca này (+Delta)
 * - Nền Track (Warm Beige #E6E0D4): Trần 480 phút (8h/ngày)
 * - Progressive Disclosure: Chi tiết số phút hiện trong Ant Design Tooltip khi hover
 */
const WorkloadStackedBar: React.FC<{
  assignedMin: number;
  deltaMin: number;
  maxMin?: number;
}> = ({ assignedMin, deltaMin, maxMin = 480 }) => {
  const bookedPct = Math.min(100, Math.round((assignedMin / maxMin) * 100));
  const rawDeltaPct = Math.round((deltaMin / maxMin) * 100);
  const deltaPct = Math.min(100 - bookedPct, Math.max(3, rawDeltaPct));
  const projectedMin = assignedMin + deltaMin;
  const totalPct = Math.round((projectedMin / maxMin) * 100);
  const isOverload = projectedMin > maxMin;

  const bookedHours = (assignedMin / 60).toFixed(1);
  const deltaHours = (deltaMin / 60).toFixed(1);

  return (
    <Tooltip
      placement="top"
      color="#1F2924"
      title={
        <div className="p-1 space-y-1.5 text-[11px] font-mono-num">
          <div className="font-sans font-semibold text-[#F2ECE1] border-b border-white/15 pb-1">
            Tải công việc trong ngày (Trần {maxMin}p / 8.0h)
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[#D8E6DF]">
              <span className="w-2 h-2 rounded-xs bg-[#4E6E5D] inline-block" />
              Đã kín lịch:
            </span>
            <span className="font-semibold text-white">
              {assignedMin}p ({bookedHours}h · {bookedPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[#F5DEB3]">
              <span className="w-2 h-2 rounded-xs bg-[#D49B4B] inline-block" />
              Tăng thêm (Ca + Di chuyển):
            </span>
            <span className="font-semibold text-[#F5DEB3]">
              +{deltaMin}p (+{deltaHours}h · +{rawDeltaPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/15">
            <span className="text-white/80">Tổng tải sau nhận ca:</span>
            <span className={`font-semibold ${isOverload ? 'text-[#FCA5A5]' : 'text-[#A7F3D0]'}`}>
              {projectedMin}/{maxMin}p ({totalPct}%)
            </span>
          </div>
        </div>
      }
    >
      <div className="w-full max-w-[155px] cursor-help space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono-num tabular-nums leading-none">
          <span className="font-semibold text-[#2C3832]">{bookedHours}h</span>
          <span className="text-[#9E6B25] font-semibold">+{deltaHours}h</span>
          <span className="text-[#7A756C]">{totalPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#E6E0D4] overflow-hidden flex p-[1px] gap-[1px]">
          <div
            className="h-full bg-[#4E6E5D] rounded-l-full transition-all duration-150"
            style={{ width: `${bookedPct}%` }}
          />
          <div
            className={`h-full rounded-r-full transition-all duration-150 ${
              isOverload ? 'bg-[#C94A4A]' : 'bg-[#D49B4B]'
            }`}
            style={{ width: `${deltaPct}%` }}
          />
        </div>
      </div>
    </Tooltip>
  );
};

/**
 * MINI 5-AXIS RADAR GLYPH + PROGRESSIVE DISCLOSURE TOOLTIP
 * Chỉ hiển thị hình ngũ giác tương thích + Điểm số DSS tổng (0.00 - 1.00) trên mặt phẳng dòng.
 * Rà chuột (Hover) để mở Tooltip 5 điểm thành phần (SkillFit, TimeFit, Distance, Workload, Continuity).
 */
const MiniRadarWithTooltip: React.FC<{
  candidate: AICandidate;
  weights: DSSWeights;
  isTop1?: boolean;
}> = ({ candidate, weights, isTop1 }) => {
  const axes = [
    candidate.criteria.skillFitScore,
    candidate.criteria.timeFitScore,
    candidate.criteria.distanceScore,
    candidate.criteria.workloadScore,
    candidate.criteria.continuityScore,
  ];
  const size = 34;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 13;

  const getPt = (idx: number, val: number) => {
    const angle = (Math.PI * 2 * idx) / 5 - Math.PI / 2;
    const r = (Math.max(15, Math.min(100, val)) / 100) * maxR;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  };

  const outerPolygon = [0, 1, 2, 3, 4].map((i) => getPt(i, 100)).join(' ');
  const valuePolygon = axes.map((v, i) => getPt(i, v)).join(' ');

  const breakdownRows = [
    {
      label: 'SkillFit (Kỹ năng)',
      weight: `${Math.round(weights.skillFit * 100)}%`,
      score: (candidate.criteria.skillFitScore / 100).toFixed(2),
      pct: candidate.criteria.skillFitScore,
      meta:
        candidate.criteria.missingSkills.length === 0
          ? `Đạt ${candidate.criteria.matchedSkills.length} chứng chỉ`
          : `Thiếu ${candidate.criteria.missingSkills.length} KN`,
    },
    {
      label: 'TimeFit (Khung giờ)',
      weight: `${Math.round(weights.timeFit * 100)}%`,
      score: (candidate.criteria.timeFitScore / 100).toFixed(2),
      pct: candidate.criteria.timeFitScore,
      meta: candidate.criteria.availableGapText,
    },
    {
      label: 'Distance (Khoảng cách)',
      weight: `${Math.round(weights.distance * 100)}%`,
      score: (candidate.criteria.distanceScore / 100).toFixed(2),
      pct: candidate.criteria.distanceScore,
      meta: `${candidate.criteria.distanceKm.toFixed(1)}km · ${candidate.criteria.travelMinutes}p`,
    },
    {
      label: 'Workload (Tải ngày)',
      weight: `${Math.round(weights.workload * 100)}%`,
      score: (candidate.criteria.workloadScore / 100).toFixed(2),
      pct: candidate.criteria.workloadScore,
      meta: `${candidate.criteria.workloadPct}% đã gán`,
    },
    {
      label: 'Continuity (Quen ca)',
      weight: `${Math.round(weights.continuity * 100)}%`,
      score: (candidate.criteria.continuityScore / 100).toFixed(2),
      pct: candidate.criteria.continuityScore,
      meta: `${candidate.criteria.previousVisitsCount} lần khám`,
    },
  ];

  return (
    <Tooltip
      placement="left"
      color="#1F2924"
      title={
        <div className="p-1.5 w-[250px] space-y-2">
          <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
            <span className="text-[11px] font-semibold text-[#F2ECE1]">
              Giải trình 5 thành phần DSS
            </span>
            <span className="text-[12px] font-mono-num font-semibold text-[#A7F3D0]">
              Tổng: {formatNormalizedScore(candidate)}
            </span>
          </div>
          <div className="space-y-1.5">
            {breakdownRows.map((item) => (
              <div key={item.label} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/90">
                    {item.label} <span className="text-white/50">({item.weight})</span>
                  </span>
                  <span className="font-mono-num font-semibold text-[#A7F3D0]">
                    {item.score} <span className="text-white/60 font-normal">· {item.meta}</span>
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#689F80] rounded-full"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="inline-flex items-center gap-2.5 cursor-help px-2 py-1 rounded-[6px] hover:bg-[#EBF2EE]/70 transition-colors">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <polygon
            points={outerPolygon}
            fill="#F2ECE1"
            stroke="#D6CFC2"
            strokeWidth="1"
          />
          <polygon
            points={valuePolygon}
            fill="rgba(78, 110, 93, 0.28)"
            stroke="#4E6E5D"
            strokeWidth="1.6"
          />
        </svg>
        <div className="text-right font-mono-num tabular-nums leading-tight">
          <div
            className={`text-[16px] font-semibold ${
              isTop1 ? 'text-[#3A5A49]' : 'text-[#2C3832]'
            }`}
          >
            {formatNormalizedScore(candidate)}
          </div>
          <div className="text-[10px] text-[#7A756C]">Rà xem 5 chỉ số</div>
        </div>
      </div>
    </Tooltip>
  );
};

/**
 * 1. KHUNG TIẾP NHẬN YÊU CẦU PHẲNG (FLAT REQUEST HEADER STRIP - CALM CREAM & WARM BEIGE)
 * Loại bỏ các thẻ lồng nhau (nested cards), hiển thị dạng dải lưới phẳng (flat grid) với hệ thống Icon quét nhanh.
 */
const RequestHeaderPanel: React.FC<{
  request: UnassignedRequest;
  topCandidate: AICandidate | null;
  slaCountdown: string;
  submitting: boolean;
  onFastAssign: () => void;
  onOpenMindMapPage: () => void;
}> = ({
  request,
  topCandidate,
  slaCountdown,
  submitting,
  onFastAssign,
  onOpenMindMapPage,
}) => {
  const isUrgent = request.priority === 'Khẩn cấp';
  const eligibleCount = request.aiCandidates.filter((c) => c.isEligible).length;
  const disqualifiedCount = request.aiCandidates.length - eligibleCount;
  const diffMin = request.predictedDurationMin - request.standardDurationMin;
  const preferredStart = request.preferredStart || request.suggestedStartTime || request.windowStart;
  const equipmentList =
    request.specializedEquipment && request.specializedEquipment.length > 0
      ? request.specializedEquipment
      : ['Máy hút áp lực âm (VAC)', 'Bộ tiểu phẫu vô khuẩn'];
  const severityText =
    request.clinicalSeverity ||
    (isUrgent ? 'Độ III · Loét phức tạp' : 'Độ II · Theo dõi chuyên khoa');

  const stdPct = Math.min(
    100,
    Math.round((request.standardDurationMin / Math.max(1, request.predictedDurationMin)) * 100)
  );

  return (
    <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-[#E6E0D4] space-y-3">
      {/* Dòng 1: Định danh ca bệnh + Tóm tắt trạng thái + Thao tác chính */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#5C5852]">
          <span className="font-mono-num font-semibold text-[#2C3832] text-[13px]">
            {request.id}
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={`font-semibold ${
              isUrgent ? 'text-[#B93829]' : 'text-[#4E6E5D]'
            }`}
          >
            {isUrgent ? `Khẩn cấp (SLA ${slaCountdown})` : request.priority}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-[#2C3832]">
            {request.patientName} ({request.patientAge}t)
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-[#5C5852]">
            <MapPin className="w-3.5 h-3.5 text-[#4E6E5D]" strokeWidth={1.8} />
            <span>{request.address} ({request.district})</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num text-[#4E6E5D] font-semibold">
            {eligibleCount} khả thi / {disqualifiedCount} bị loại
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenMindMapPage}
            className="px-3 py-1.5 rounded-[6px] border border-[#D8C7AE] bg-[#F2ECE1] hover:bg-[#E8DEC8] text-[#4A443B] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#4E6E5D]" strokeWidth={1.8} />
            <span>Sơ đồ tư duy ca</span>
          </button>

          {topCandidate && topCandidate.isEligible && (
            <button
              type="button"
              disabled={submitting}
              onClick={onFastAssign}
              className="px-3.5 py-1.5 rounded-[6px] bg-[#4E6E5D] hover:bg-[#3E594B] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" strokeWidth={2} />
              <span>
                Phân công Top 1 ({topCandidate.staffName} · {formatNormalizedScore(topCandidate)})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Dòng 2: Lưới phẳng 4 cột không viền hộp lồng nhau (Flat Glanceable Strip) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2.5 border-t border-[#EAE4D8] text-[12px]">
        {/* Cột 1: Dịch vụ & Bệnh lý */}
        <div className="flex items-start gap-2.5 min-w-0">
          <Stethoscope className="w-4 h-4 text-[#4E6E5D] shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="min-w-0">
            <div className="font-semibold text-[#2C3832] truncate" title={request.serviceName}>
              {request.serviceName}
            </div>
            <div className="text-[11px] text-[#7A756C] truncate mt-0.5" title={severityText}>
              {severityText}
            </div>
          </div>
        </div>

        {/* Cột 2: Khung giờ yêu cầu (preferred_start) */}
        <div className="flex items-start gap-2.5 min-w-0">
          <Clock className="w-4 h-4 text-[#4E6E5D] shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="min-w-0 font-mono-num">
            <div className="font-semibold text-[#2C3832]">
              Khung {request.requestedWindow} · Bắt đầu {preferredStart}
            </div>
            <div className="text-[11px] text-[#7A756C] font-sans mt-0.5">
              Độ tin cậy AI: <span className="font-mono-num font-semibold text-[#4E6E5D]">{request.predictionConfidencePct}%</span> (RandomForest v1.1)
            </div>
          </div>
        </div>

        {/* Cột 3: Thanh tiến trình gộp Thời lượng Định mức vs AI Dự báo */}
        <Tooltip
          placement="top"
          color="#1F2924"
          title={`Định mức chuẩn: ${request.standardDurationMin}p | AI dự báo: ${request.predictedDurationMin}p (${diffMin >= 0 ? `+${diffMin}p` : `${diffMin}p`} do mức độ bệnh lý & thiết bị)`}
        >
          <div className="flex items-start gap-2.5 min-w-0 cursor-help">
            <Activity className="w-4 h-4 text-[#9E6B25] shrink-0 mt-0.5" strokeWidth={1.8} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono-num">
                <span className="text-[#5C5852]">
                  Chuẩn <strong className="text-[#2C3832]">{request.standardDurationMin}p</strong>
                </span>
                <span className="font-semibold text-[#9E6B25]">
                  AI {request.predictedDurationMin}p ({diffMin >= 0 ? `+${diffMin}p` : `${diffMin}p`})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E6E0D4] overflow-hidden flex p-[1px] gap-[1px]">
                <div
                  className="h-full bg-[#4E6E5D] rounded-l-full"
                  style={{ width: `${stdPct}%` }}
                />
                <div
                  className="h-full bg-[#D49B4B] rounded-r-full"
                  style={{ width: `${Math.max(0, 100 - stdPct)}%` }}
                />
              </div>
            </div>
          </div>
        </Tooltip>

        {/* Cột 4: Thiết bị & Chứng chỉ yêu cầu */}
        <Tooltip
          placement="top"
          color="#1F2924"
          title={
            <div className="p-1 space-y-1 text-[11px]">
              <div className="font-semibold text-[#F2ECE1]">Thiết bị & Kỹ năng bắt buộc:</div>
              <div>• Thiết bị: {equipmentList.join(', ')}</div>
              <div>• Kỹ năng: {request.requiredSkills.join(', ')}</div>
            </div>
          }
        >
          <div className="flex items-start gap-2.5 min-w-0 cursor-help">
            <PackageCheck className="w-4 h-4 text-[#4E6E5D] shrink-0 mt-0.5" strokeWidth={1.8} />
            <div className="min-w-0">
              <div className="font-semibold text-[#2C3832] truncate">
                {request.requiredSkills[0] || 'Chăm sóc chuyên khoa'}
              </div>
              <div className="text-[11px] text-[#7A756C] truncate mt-0.5">
                {equipmentList[0]} {equipmentList.length > 1 ? `+${equipmentList.length - 1} thiết bị` : ''}
              </div>
            </div>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

/**
 * SMART SUMMARY 1: ĐẦU DANH SÁCH CA BỆNH (QUEUE LIST SMART SUMMARY)
 */
const QueueSmartSummary: React.FC<{
  cases: ScalableQueueRecord[];
  dispatchedMap: Record<string, string>;
}> = ({ cases, dispatchedMap }) => {
  const total = Math.max(1, cases.length);
  const urgentCount = cases.filter((c) => c.priority === 'Khẩn cấp').length;
  const criticalSlaCount = cases.filter((c) => c.slaMinutes <= 12).length;
  const doneCount = cases.filter((c) => Boolean(dispatchedMap[c.id])).length;
  const pendingCount = cases.length - doneCount;

  const districtCounts: Record<string, number> = {};
  cases.forEach((c) => {
    districtCounts[c.district] = (districtCounts[c.district] || 0) + 1;
  });
  const topDistrict =
    Object.entries(districtCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Phường Lộc Thọ';

  const urgentPct = Math.round((urgentCount / total) * 100);
  const donePct = Math.round((doneCount / total) * 100);
  const normalPct = Math.max(0, 100 - urgentPct - donePct);

  return (
    <div className="p-2.5 rounded-[8px] bg-white border border-[#DDE1DA] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4B5850] inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#2D7D46]" strokeWidth={2} />
          <span>SmartSummary · Hàng chờ Nha Trang</span>
        </span>
        <span className="text-[10px] font-mono-num text-[#68746E]">
          Đông nhất: <strong className="text-[#1E2421]">{topDistrict}</strong>
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[#ECEFE9] overflow-hidden flex">
        {urgentPct > 0 && (
          <div
            className="h-full bg-[#D93843]"
            style={{ width: `${urgentPct}%` }}
            title={`Khẩn cấp: ${urgentCount}`}
          />
        )}
        {normalPct > 0 && (
          <div
            className="h-full bg-[#D97706]"
            style={{ width: `${normalPct}%` }}
            title={`Chờ xử lý: ${pendingCount}`}
          />
        )}
        {donePct > 0 && (
          <div
            className="h-full bg-[#2D7D46]"
            style={{ width: `${donePct}%` }}
            title={`Đã chốt: ${doneCount}`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <CompactBadge tone="urgent" icon={<Flame className="w-2.5 h-2.5" strokeWidth={2} />}>
          {urgentCount} Khẩn cấp
        </CompactBadge>
        <CompactBadge tone="warning" icon={<Clock className="w-2.5 h-2.5" strokeWidth={2} />}>
          {criticalSlaCount} ca &le; 12p
        </CompactBadge>
        <CompactBadge tone="optimal" icon={<Check className="w-2.5 h-2.5" strokeWidth={2.2} />}>
          {doneCount} Đã chốt
        </CompactBadge>
      </div>
    </div>
  );
};

/**
 * SMART SUMMARY 2: ĐẦU DANH SÁCH ỨNG VIÊN KHẢ THI (TOP-K CANDIDATE SMART SUMMARY)
 */
const CandidateListSmartSummary: React.FC<{
  candidates: AICandidate[];
  selectedCandidate: AICandidate | null;
}> = ({ candidates, selectedCandidate }) => {
  const eligibleCount = candidates.filter((c) => c.isEligible).length;
  const blockedCount = candidates.length - eligibleCount;
  const best = selectedCandidate || candidates.find((c) => c.isEligible) || candidates[0];

  if (!best) return null;

  return (
    <div className="px-4 py-3 bg-[#F9FAF8] border-b border-[#DDE1DA] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2D7D46] inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            <span>SmartSummary · Top-K Khả thi</span>
          </span>
          <CompactBadge tone="optimal">
            Khả thi: {eligibleCount} nhân sự
          </CompactBadge>
          {blockedCount > 0 && (
            <CompactBadge tone="urgent">
              Không khả thi: {blockedCount} (Vi phạm ràng buộc cứng)
            </CompactBadge>
          )}
          <CompactBadge tone="primary">
            Top 1: {best.staffName} (DSS {formatNormalizedScore(best)})
          </CompactBadge>
        </div>

        <div className="flex items-center gap-2">
          <MiniRadialGauge
            value={best.criteria.skillFitScore}
            label="SkillFit"
            subValue="Đủ chứng chỉ"
            size={34}
          />
          <MiniRadialGauge
            value={best.criteria.timeFitScore}
            label="TimeFit"
            subValue={`${best.criteria.travelMinutes}p di chuyển`}
            size={34}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Color-coded B2B Healthcare DSS SVG Radar Chart
 */
const DSSColoredRadarChart: React.FC<{
  candidate: AICandidate;
  benchmark?: AICandidate | null;
}> = ({ candidate, benchmark }) => {
  const axes = [
    { label: 'SkillFit', val: candidate.criteria.skillFitScore, bench: benchmark?.criteria.skillFitScore ?? 95 },
    { label: 'TimeFit', val: candidate.criteria.timeFitScore, bench: benchmark?.criteria.timeFitScore ?? 90 },
    { label: 'Distance', val: candidate.criteria.distanceScore, bench: benchmark?.criteria.distanceScore ?? 85 },
    { label: 'Workload', val: candidate.criteria.workloadScore, bench: benchmark?.criteria.workloadScore ?? 80 },
    { label: 'Continuity', val: candidate.criteria.continuityScore, bench: benchmark?.criteria.continuityScore ?? 85 },
  ];

  const cx = 115;
  const cy = 110;
  const maxR = 72;

  const getPoint = (index: number, scorePct: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, scorePct)) / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const candPoints = axes
    .map((a, i) => {
      const p = getPoint(i, a.val);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const benchPoints = axes
    .map((a, i) => {
      const p = getPoint(i, a.bench);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg width="230" height="215" viewBox="0 0 230 215" className="overflow-visible">
        {[25, 50, 75, 100].map((level) => {
          const pts = axes
            .map((_, i) => {
              const p = getPoint(i, level);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="#DDE1DA"
              strokeWidth="1"
            />
          );
        })}

        {axes.map((a, i) => {
          const outer = getPoint(i, 100);
          const labelPos = getPoint(i, 125);
          return (
            <g key={a.label}>
              <line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="#DDE1DA"
                strokeWidth="1"
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[11px] fill-[#4A5550] font-medium"
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {benchmark && benchmark.staffId !== candidate.staffId && (
          <polygon
            points={benchPoints}
            fill="rgba(75, 88, 80, 0.10)"
            stroke="#68746E"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />
        )}

        <polygon
          points={candPoints}
          fill="rgba(45, 125, 70, 0.16)"
          stroke="#2D7D46"
          strokeWidth="2"
        />

        {axes.map((a, i) => {
          const p = getPoint(i, a.val);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3.2"
              fill="#2D7D46"
            />
          );
        })}
      </svg>

      <div className="flex items-center gap-4 text-[11px] text-[#68746E] mt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#2D7D46] inline-block" />
          <span className="text-[#1E2421] font-semibold">
            {candidate.staffName} ({formatNormalizedScore(candidate)})
          </span>
        </span>
        {benchmark && benchmark.staffId !== candidate.staffId && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-[#68746E] inline-block" />
            <span>
              Top 1 ({benchmark.staffName} · {formatNormalizedScore(benchmark)})
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * SƠ ĐỒ TƯ DUY THUẬT TOÁN 5 THÀNH PHẦN (EXPLAINABLE DSS 5-COMPONENT MIND MAP)
 */
const CandidateMindMap: React.FC<{
  candidate: AICandidate;
  weights: DSSWeights;
}> = ({ candidate, weights }) => {
  const assignedMin =
    candidate.criteria.assignedMinutes ??
    Math.round((candidate.criteria.workloadPct / 100) * 480);
  const projectedMin =
    candidate.criteria.projectedAssignedMinutes ??
    assignedMin + candidate.criteria.predictedDurationMin + candidate.criteria.travelMinutes;

  const nodes = [
    {
      title: 'SkillFit',
      pct: candidate.criteria.skillFitScore,
      display: (candidate.criteria.skillFitScore / 100).toFixed(2),
      weight: `${Math.round(weights.skillFit * 100)}%`,
      badge:
        candidate.criteria.missingSkills.length === 0
          ? `Đạt ${candidate.criteria.matchedSkills.length}/${candidate.criteria.matchedSkills.length} KN`
          : `Thiếu ${candidate.criteria.missingSkills.length} KN`,
      tone: (candidate.criteria.skillFitScore >= 80 ? 'optimal' : 'urgent') as 'optimal' | 'urgent',
    },
    {
      title: 'TimeFit',
      pct: candidate.criteria.timeFitScore,
      display: (candidate.criteria.timeFitScore / 100).toFixed(2),
      weight: `${Math.round(weights.timeFit * 100)}%`,
      badge: candidate.criteria.availableGapText,
      tone: (candidate.criteria.timeFitScore >= 80 ? 'optimal' : 'warning') as 'optimal' | 'warning',
    },
    {
      title: 'Distance',
      pct: candidate.criteria.distanceScore,
      display: `${candidate.criteria.distanceKm.toFixed(1)}km`,
      weight: `${Math.round(weights.distance * 100)}%`,
      badge: `${candidate.criteria.travelMinutes} phút di chuyển`,
      tone: (candidate.criteria.distanceKm <= 3.5 ? 'optimal' : 'warning') as 'optimal' | 'warning',
    },
    {
      title: 'Workload',
      pct: candidate.criteria.workloadScore,
      display: `${assignedMin}/480p`,
      weight: `${Math.round(weights.workload * 100)}%`,
      badge: `Sau gán: ${projectedMin}/480p`,
      tone: (projectedMin <= 480 ? 'optimal' : 'urgent') as 'optimal' | 'urgent',
    },
    {
      title: 'Continuity',
      pct: candidate.criteria.continuityScore,
      display: `${candidate.criteria.previousVisitsCount} lần`,
      weight: `${Math.round(weights.continuity * 100)}%`,
      badge:
        candidate.criteria.previousVisitsCount > 0
          ? `Đã khám ${candidate.criteria.previousVisitsCount} lần`
          : '0 lần (Mới)',
      tone: (candidate.criteria.previousVisitsCount > 0 ? 'optimal' : 'primary') as 'optimal' | 'primary',
    },
  ];

  return (
    <div className="p-3.5 rounded-[8px] bg-white border border-[#DDE1DA] space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-[#2D7D46]" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4B5850]">
            Explainable DSS Breakdown (5 Thành phần)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <CompactBadge tone={candidate.isEligible ? 'optimal' : 'urgent'}>
            {candidate.rankLabel || (candidate.isEligible ? `Top ${candidate.rank}` : 'Không khả thi')}
          </CompactBadge>
          <CompactBadge tone="primary">
            Dự báo: {candidate.criteria.predictedDurationMin} phút
          </CompactBadge>
          <CompactBadge tone="optimal">
            Điểm DSS: {formatNormalizedScore(candidate)} / 1.00
          </CompactBadge>
        </div>
      </div>

      {/* Visual SVG Tree Connector */}
      <div className="flex flex-col items-center">
        <div className="px-4 py-1.5 rounded-[8px] bg-[#1E2421] text-white text-center shadow-2xs flex items-center gap-2">
          <span className="text-[12px] font-semibold">{candidate.staffName}</span>
          <span className="px-1.5 py-0.5 rounded-[4px] bg-[#2D7D46] text-white text-[11px] font-mono-num font-semibold">
            DSS {formatNormalizedScore(candidate)}
          </span>
        </div>

        <svg width="100%" height="22" viewBox="0 0 500 22" preserveAspectRatio="none" className="w-full max-w-[460px]">
          <line x1="250" y1="0" x2="250" y2="11" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="50" y1="11" x2="450" y2="11" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="50" y1="11" x2="50" y2="22" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="150" y1="11" x2="150" y2="22" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="250" y1="11" x2="250" y2="22" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="350" y1="11" x2="350" y2="22" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="450" y1="11" x2="450" y2="22" stroke="#CBD2CD" strokeWidth="2" />
        </svg>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full">
          {nodes.map((n, i) => {
            const r = 14;
            const c = 2 * Math.PI * r;
            const offset = c - (Math.max(0, Math.min(100, n.pct)) / 100) * c;
            const strokeColor = getStrokeColorHex(n.pct);

            return (
              <div
                key={i}
                className="p-2 rounded-[8px] bg-[#F9FAF8] border border-[#DDE1DA] flex flex-col items-center text-center gap-1"
              >
                <span className="text-[10px] text-[#68746E] font-semibold">
                  {n.title} ({n.weight})
                </span>

                <div className="relative w-9 h-9 flex items-center justify-center">
                  <svg width="36" height="36" className="-rotate-90">
                    <circle cx="18" cy="18" r={r} fill="none" stroke="#ECEFE9" strokeWidth="3.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r={r}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="3.5"
                      strokeDasharray={c}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[9px] font-semibold font-mono-num text-[#1E2421]">
                    {n.display}
                  </span>
                </div>

                <CompactBadge tone={n.tone}>{n.badge}</CompactBadge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * SƠ ĐỒ HÌNH ẢNH LÂM SÀNG & PHÁC ĐỒ XỬ LÝ (VISUAL SVG CLINICAL & PROTOCOL DIAGRAM)
 */
const UrgentCaseMindMap: React.FC<{
  caseData: ScalableQueueRecord;
  checkedKits: number[];
  completedSteps: string[];
  onToggleKit: (idx: number) => void;
  onToggleStep: (stepId: string) => void;
  onMarkAllSteps: () => void;
}> = ({
  caseData,
  checkedKits,
  completedSteps,
  onToggleKit,
  onToggleStep,
  onMarkAllSteps,
}) => {
  const isUrgent = caseData.priority === 'Khẩn cấp';

  return (
    <div className="bg-white border border-[#DDE1DA] rounded-[8px] p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEFE9] pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-[#D93843]" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold text-[#1E2421] mr-1">
            Sơ đồ tư duy Ca bệnh ({caseData.district}, Nha Trang)
          </span>
          <CompactBadge tone={isUrgent ? 'urgent' : 'primary'}>
            {caseData.vitals.riskShort}
          </CompactBadge>
          <CompactBadge tone="warning">
            Định mức {caseData.standardDurationMin}p → AI {caseData.predictedDurationMin}p
          </CompactBadge>
          <CompactBadge tone="optimal">
            Thiết bị {checkedKits.length}/{caseData.emergencyKit.length}
          </CompactBadge>
        </div>

        <button
          type="button"
          onClick={onMarkAllSteps}
          className="px-2.5 py-1 rounded-[6px] border border-[#B7DFC5] bg-[#EAF5EE] text-[#2D7D46] text-[11px] font-semibold cursor-pointer"
        >
          Duyệt 4/4 bước
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div
          className={`px-4 py-2.5 rounded-[8px] border-2 text-center max-w-md w-full shadow-2xs ${
            isUrgent
              ? 'bg-[#FEF2F2] border-[#D93843]'
              : 'bg-[#F9FAF8] border-[#4B5850]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <CompactBadge tone={isUrgent ? 'urgent' : 'primary'}>
              {caseData.id}
            </CompactBadge>
            <span className="text-[14px] font-semibold text-[#1E2421]">
              {caseData.patientName} ({caseData.patientAge}t)
            </span>
            <CompactBadge tone="urgent">{caseData.serviceName}</CompactBadge>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
            <CompactBadge tone="warning">{caseData.clinicalSeverity}</CompactBadge>
            <CompactBadge tone="neutral">{caseData.addressShort}</CompactBadge>
            <CompactBadge tone="optimal">preferred_start: {caseData.preferredStart}</CompactBadge>
          </div>
        </div>

        <svg width="100%" height="24" viewBox="0 0 600 24" preserveAspectRatio="none" className="w-full max-w-[520px]">
          <line x1="300" y1="0" x2="300" y2="12" stroke="#D93843" strokeWidth="2" />
          <line x1="100" y1="12" x2="500" y2="12" stroke="#CBD2CD" strokeWidth="2" />
          <line x1="100" y1="12" x2="100" y2="24" stroke="#D93843" strokeWidth="2" />
          <line x1="300" y1="12" x2="300" y2="24" stroke="#2D7D46" strokeWidth="2" />
          <line x1="500" y1="12" x2="500" y2="24" stroke="#4B5850" strokeWidth="2" />
        </svg>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
          {/* NHÁNH 1: SINH HIỆU & BỆNH LÝ */}
          <div className="p-3 rounded-[8px] bg-[#FEF2F2]/60 border border-[#FECACA] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#991B1B] inline-flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#D93843]" strokeWidth={1.8} />
                <span>1. Sinh hiệu & Bệnh lý</span>
              </span>
              <CompactBadge tone="urgent">{caseData.vitals.riskShort}</CompactBadge>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center font-mono-num">
              <div className="bg-white p-2 rounded-[6px] border border-[#FECACA]">
                <div className="text-[10px] text-[#68746E]">HA</div>
                <div className="text-[12px] font-semibold text-[#D93843] mt-0.5">
                  {caseData.vitals.bp}
                </div>
              </div>
              <div className="bg-white p-2 rounded-[6px] border border-[#FECACA]">
                <div className="text-[10px] text-[#68746E]">SpO2</div>
                <div className="text-[12px] font-semibold text-[#D93843] mt-0.5">
                  {caseData.vitals.spo2}
                </div>
              </div>
              <div className="bg-white p-2 rounded-[6px] border border-[#FECACA]">
                <div className="text-[10px] text-[#68746E]">Mạch</div>
                <div className="text-[12px] font-semibold text-[#1E2421] mt-0.5">
                  {caseData.vitals.heartRate}
                </div>
              </div>
            </div>
          </div>

          {/* NHÁNH 2: THIẾT BỊ CHUYÊN DỤNG & KỸ NĂNG */}
          <div className="p-3 rounded-[8px] bg-[#F4FAF6] border border-[#B7DFC5] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#1E2421] inline-flex items-center gap-1">
                <PackageCheck className="w-3.5 h-3.5 text-[#2D7D46]" strokeWidth={1.8} />
                <span>2. Thiết bị chuyên dụng</span>
              </span>
              <CompactBadge tone="optimal">
                {checkedKits.length}/{caseData.emergencyKit.length} món
              </CompactBadge>
            </div>

            <div className="flex flex-wrap gap-1">
              {caseData.emergencyKit.map((kit, idx) => {
                const checked = checkedKits.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onToggleKit(idx)}
                    className={`px-2 py-1 rounded-[5px] border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#2D7D46] border-[#2D7D46] text-white'
                        : 'bg-white border-[#DDE1DA] text-[#4A5550]'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                    <span>{kit}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-[#B7DFC5]/60">
              <Stethoscope className="w-3 h-3 text-[#4B5850]" strokeWidth={1.8} />
              {caseData.requiredSkills.map((sk, idx) => (
                <CompactBadge key={idx} tone="neutral">
                  {sk}
                </CompactBadge>
              ))}
            </div>
          </div>

          {/* NHÁNH 3: LUỒNG 4 BƯỚC */}
          <div className="p-3 rounded-[8px] bg-[#F9FAF8] border border-[#DDE1DA] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#1E2421]">
                3. Luồng điều phối 4 bước
              </span>
              <CompactBadge tone="optimal">{completedSteps.length}/4 xong</CompactBadge>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {caseData.protocolSteps.map((step) => {
                const isDone = completedSteps.includes(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onToggleStep(step.id)}
                    className={`p-1.5 rounded-[6px] border text-left transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isDone
                        ? 'bg-[#EAF5EE] border-[#2D7D46] text-[#1E2421]'
                        : 'bg-white border-[#DDE1DA] text-[#4A5550] hover:border-[#4B5850]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                        isDone
                          ? 'bg-[#2D7D46] text-white'
                          : 'bg-[#EEF1EE] text-[#4B5850]'
                      }`}
                    >
                      {isDone ? <Check className="w-2.5 h-2.5" strokeWidth={2.5} /> : step.stepNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#1E2421] truncate leading-tight">
                        {step.shortTitle}
                      </div>
                      <div className="text-[9px] text-[#68746E] truncate leading-tight">
                        {step.subTag}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AIRecommendationScreen: React.FC<AIRecommendationScreenProps> = ({
  unassignedRequests,
  dssWeights,
  onAssignRequest,
  onUpdateWeights,
  onNavigateToGantt,
}) => {
  const { message } = AntdApp.useApp();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Page Navigation State
  const [activeKpiPage, setActiveKpiPage] = useState<KPIBucketKey | null>(null);
  const [queueSearchQuery, setQueueSearchQuery] = useState<string>('');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [selectedPageCaseId, setSelectedPageCaseId] = useState<string | null>(null);
  const [selectedPageStaffId, setSelectedPageStaffId] = useState<string | null>(null);

  // Main Overview Controls
  const [tableDensity, setTableDensity] = useState<TableDensity>('comfortable');
  const [expandedRowStaffId, setExpandedRowStaffId] = useState<string | null>(null);
  const [overviewPriorityFilter, setOverviewPriorityFilter] = useState<string>('ALL');

  // Live API Data from GET /api/v1/schedule/recommend-candidates/:request_id & GET /api/v1/assignments/override-reasons
  const [overrideReasonsList, setOverrideReasonsList] = useState<OverrideReasonItem[]>(
    DEFAULT_OVERRIDE_REASONS
  );
  const [apiRecommendedCandidates, setApiRecommendedCandidates] = useState<AICandidate[] | null>(
    null
  );

  // Human-in-the-loop Override Modal State
  const [overrideModalCandidate, setOverrideModalCandidate] = useState<AICandidate | null>(null);
  const [overrideModalRequest, setOverrideModalRequest] = useState<UnassignedRequest | null>(null);
  const [selectedOverrideCode, setSelectedOverrideCode] = useState<OverrideReasonCode>('distance');
  const [overrideNotes, setOverrideNotes] = useState<string>('');

  // Slide-out Drawer for Deep Radar Inspection
  const [drawerCandidate, setDrawerCandidate] = useState<AICandidate | null>(null);

  // Optional Weight Tuner
  const [showWeightTuner, setShowWeightTuner] = useState<boolean>(false);
  const [localWeights, setLocalWeights] = useState<DSSWeights>(dssWeights);

  // Live Golden Hour Countdown timer
  const [countdownTick, setCountdownTick] = useState<number>(0);

  // Interactive states
  const [completedStepsByCase, setCompletedStepsByCase] = useState<Record<string, string[]>>({});
  const [checkedKitsByCase, setCheckedKitsByCase] = useState<Record<string, number[]>>({});
  const [dispatchedSyntheticCaseIds, setDispatchedSyntheticCaseIds] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLocalWeights(dssWeights);
  }, [dssWeights]);

  // Fetch standardized override reasons from GET /api/v1/assignments/override-reasons
  useEffect(() => {
    fetch('/api/v1/assignments/override-reasons')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.reasons) && data.reasons.length > 0) {
          setOverrideReasonsList(data.reasons);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_OVERRIDE_REASONS
      });
  }, []);

  const filteredOverviewRequests = useMemo(() => {
    if (overviewPriorityFilter === 'ALL') return unassignedRequests;
    return unassignedRequests.filter((r) => r.priority === overviewPriorityFilter);
  }, [unassignedRequests, overviewPriorityFilter]);

  useEffect(() => {
    if (filteredOverviewRequests.length > 0) {
      const stillExists = filteredOverviewRequests.find((r) => r.id === selectedRequestId);
      const targetReq = stillExists || filteredOverviewRequests[0];
      setSelectedRequestId(targetReq.id);
    } else if (unassignedRequests.length > 0) {
      setSelectedRequestId(unassignedRequests[0].id);
    } else {
      setSelectedRequestId(null);
    }
  }, [filteredOverviewRequests, unassignedRequests, selectedRequestId]);

  const activeRequest =
    unassignedRequests.find((r) => r.id === selectedRequestId) ||
    unassignedRequests[0] ||
    null;

  // Fetch candidates from GET /api/v1/schedule/recommend-candidates/{request_id} when activeRequest changes
  useEffect(() => {
    if (!activeRequest?.id) {
      setApiRecommendedCandidates(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/schedule/recommend-candidates/${encodeURIComponent(activeRequest.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.all_candidates)) {
          setApiRecommendedCandidates(data.all_candidates);
        }
      })
      .catch(() => {
        if (!cancelled) setApiRecommendedCandidates(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRequest?.id, dssWeights]);

  const allEvaluatedCandidates = useMemo<AICandidate[]>(() => {
    if (!activeRequest) return [];
    return apiRecommendedCandidates || activeRequest.aiCandidates || [];
  }, [activeRequest, apiRecommendedCandidates]);

  // Separate Top-K Eligible Candidates vs Disqualified Candidates (Hard Constraints)
  const topKCandidates = useMemo<AICandidate[]>(
    () => allEvaluatedCandidates.filter((c) => c.isEligible),
    [allEvaluatedCandidates]
  );

  const disqualifiedCandidates = useMemo<AICandidate[]>(
    () => allEvaluatedCandidates.filter((c) => !c.isEligible),
    [allEvaluatedCandidates]
  );

  const top1Candidate = topKCandidates[0] || allEvaluatedCandidates[0] || null;

  // Build Nha Trang patient cases for Dedicated Split View
  const enterpriseQueueRecords = useMemo<ScalableQueueRecord[]>(() => {
    const defaultSteps: ProtocolStep[] = [
      { id: 'step-1', stepNumber: 1, shortTitle: 'Gọi Tele-Triage', subTag: 'Kê đầu 30°' },
      { id: 'step-2', stepNumber: 2, shortTitle: 'Chuẩn bị Thiết bị', subTag: 'Đủ vật tư' },
      { id: 'step-3', stepNumber: 3, shortTitle: 'Chốt điều dưỡng', subTag: 'Đến < 15p' },
      { id: 'step-4', stepNumber: 4, shortTitle: 'Báo sinh hiệu', subTag: 'Đo SpO2/HA' },
    ];

    const liveRecords: ScalableQueueRecord[] = unassignedRequests.map((r, idx) => {
      const isUrgent = r.priority === 'Khẩn cấp';
      return {
        id: r.id,
        patientName: r.patientName,
        patientAge: r.patientAge,
        serviceName: shortenServiceTitle(r.serviceName),
        symptomKeyword: isUrgent ? 'Loét độ III · ĐTĐ' : 'Khám chuyên khoa',
        district: r.district,
        addressShort: r.address || `${18 + idx * 14} Trần Phú, ${r.district}, Nha Trang`,
        caregiverPhone: r.patientPhone || `090${3 + idx} 824 ${110 + idx * 17}`,
        requestedWindow: r.requestedWindow,
        preferredStart: r.preferredStart || r.suggestedStartTime || r.windowStart,
        standardDurationMin: r.standardDurationMin,
        predictedDurationMin: r.predictedDurationMin,
        clinicalSeverity:
          r.clinicalSeverity ||
          (isUrgent ? 'Nặng (Độ III - Nhiễm khuẩn)' : 'Trung bình - Nặng'),
        specializedEquipment:
          r.specializedEquipment && r.specializedEquipment.length > 0
            ? r.specializedEquipment
            : ['Máy hút VAC', 'Bộ cắt lọc vô khuẩn', 'Máy đo SpO2'],
        slaMinutes: isUrgent ? 12 : 30,
        priority: r.priority,
        bucket: isUrgent ? 'urgent' : 'queue',
        vitals: isUrgent
          ? {
              bp: '155/95',
              spo2: '93%',
              heartRate: '108 l/p',
              riskShort: 'Cấp độ Đỏ',
            }
          : {
              bp: '125/80',
              spo2: '98%',
              heartRate: '78 l/p',
              riskShort: 'Ổn định',
            },
        requiredSkills: r.requiredSkills,
        emergencyKit:
          r.specializedEquipment && r.specializedEquipment.length > 0
            ? r.specializedEquipment
            : ['Máy hút VAC', 'Máy đo SpO2', 'Túi phản vệ'],
        protocolSteps: defaultSteps,
        linkedRequest: r,
      };
    });

    const sampleNames = [
      'Nguyễn Văn Hòa',
      'Trần Thị Bích Ngọc',
      'Lê Hoàng Nam',
      'Phạm Minh Tuấn',
      'Võ Thị Thu Thảo',
      'Đặng Quốc Khánh',
      'Bùi Thanh Hà',
      'Đỗ Ngọc Ánh',
      'Hồ Văn Sơn',
      'Ngô Thị Kim Liên',
    ];
    const shortServices = [
      'Hút đờm khí quản',
      'Cầm máu hậu phẫu',
      'Truyền kháng sinh',
      'Hạ áp cấp cứu',
      'Cấp cứu hạ đường',
    ];
    const shortSeverities = [
      'Nặng (Tắc đờm · SpO2 92%)',
      'Nặng (Chảy máu vết mổ)',
      'Trung bình - Nặng (Sốt 39.2°C)',
      'Nặng (Cơn tăng HA 165/100)',
      'Cấp cứu (Hạ đường huyết 3.2)',
    ];
    const sampleStreets = [
      'Trần Phú',
      'Nguyễn Thị Minh Khai',
      'Lê Hồng Phong',
      'Đường 2/4',
      'Hoàng Diệu',
      'Yersin',
      'Thái Nguyên',
    ];

    const syntheticUrgent: ScalableQueueRecord[] = Array.from({ length: 20 }, (_, idx) => {
      const num = 1001 + idx;
      const baseReq = unassignedRequests[idx % Math.max(1, unassignedRequests.length)];
      const district = NHA_TRANG_WARDS[idx % NHA_TRANG_WARDS.length];
      const bucket: KPIBucketKey =
        idx < 12 ? 'urgent' : idx < 15 ? 'active' : idx < 18 ? 'completed' : 'queue';
      const isUrgent = bucket === 'urgent' || idx % 3 === 0;
      const startHour = (7 + (idx % 9)).toString().padStart(2, '0');
      const endHour = (8 + (idx % 9)).toString().padStart(2, '0');

      return {
        id: `REQ-${num}`,
        patientName: sampleNames[idx % sampleNames.length],
        patientAge: 64 + (idx % 25),
        serviceName: shortServices[idx % shortServices.length],
        symptomKeyword: shortSeverities[idx % shortSeverities.length],
        district,
        addressShort: `${42 + idx * 9} ${sampleStreets[idx % sampleStreets.length]}, ${district}, Nha Trang`,
        caregiverPhone: `091${idx % 9} 456 ${(200 + idx * 13) % 900 + 100}`,
        requestedWindow: `${startHour}:30 - ${endHour}:30`,
        preferredStart: `${startHour}:30`,
        standardDurationMin: 45,
        predictedDurationMin: 60 + (idx % 3) * 5,
        clinicalSeverity: shortSeverities[idx % shortSeverities.length],
        specializedEquipment: ['Máy hút đờm mini', 'Bình Oxy di động', 'Túi cấp cứu'],
        slaMinutes: 8 + (idx % 10),
        priority: isUrgent ? 'Khẩn cấp' : 'Cao',
        bucket,
        vitals: {
          bp: `${145 + (idx % 25)}/${90 + (idx % 12)}`,
          spo2: `${91 + (idx % 5)}%`,
          heartRate: `${98 + (idx % 22)} l/p`,
          riskShort: isUrgent ? 'Cấp độ Đỏ' : 'Cảnh báo',
        },
        requiredSkills: ['Hồi sức cấp', 'Mở khí quản', 'Tiêm truyền IV'],
        emergencyKit: ['Máy hút đờm', 'Bình Oxy mini', 'Túi thuốc cấp'],
        protocolSteps: defaultSteps,
        linkedRequest: baseReq,
      };
    });

    return [...liveRecords, ...syntheticUrgent];
  }, [unassignedRequests]);

  const urgentLiveAndQueueCount = useMemo(
    () => enterpriseQueueRecords.filter((r) => r.priority === 'Khẩn cấp').length,
    [enterpriseQueueRecords]
  );

  const filteredPageCases = useMemo(() => {
    return enterpriseQueueRecords.filter((item) => {
      if (activeKpiPage === 'urgent' && item.priority !== 'Khẩn cấp') return false;
      if (activeKpiPage === 'active' && item.bucket !== 'active') return false;
      if (activeKpiPage === 'completed' && item.bucket !== 'completed') return false;
      if (selectedDistrictFilter !== 'ALL' && item.district !== selectedDistrictFilter) {
        return false;
      }
      if (selectedPriorityFilter !== 'ALL' && item.priority !== selectedPriorityFilter) {
        return false;
      }
      if (!queueSearchQuery.trim()) return true;
      const q = queueSearchQuery.toLowerCase();
      return (
        item.id.toLowerCase().includes(q) ||
        item.patientName.toLowerCase().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q)
      );
    });
  }, [enterpriseQueueRecords, activeKpiPage, selectedDistrictFilter, selectedPriorityFilter, queueSearchQuery]);

  const activePageCase = useMemo(() => {
    if (filteredPageCases.length === 0) return null;
    return (
      filteredPageCases.find((c) => c.id === selectedPageCaseId) ||
      filteredPageCases[0]
    );
  }, [filteredPageCases, selectedPageCaseId]);

  const activePageCandidates = useMemo<AICandidate[]>(() => {
    if (!activePageCase) return [];
    return (
      activePageCase.linkedRequest?.aiCandidates ||
      unassignedRequests[0]?.aiCandidates ||
      []
    );
  }, [activePageCase, unassignedRequests]);

  const chosenPageCandidate = useMemo<AICandidate | null>(() => {
    if (activePageCandidates.length === 0) return null;
    return (
      activePageCandidates.find((c) => c.staffId === selectedPageStaffId && c.isEligible) ||
      activePageCandidates.find((c) => c.isEligible) ||
      activePageCandidates[0]
    );
  }, [activePageCandidates, selectedPageStaffId]);

  const formatSlaCountdown = (baseMinutes: number) => {
    const totalSeconds = Math.max(60, baseMinutes * 60 - (countdownTick % 180));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleProtocolStep = (caseId: string, stepId: string) => {
    setCompletedStepsByCase((prev) => {
      const current = prev[caseId] || ['step-1'];
      const exists = current.includes(stepId);
      const next = exists ? current.filter((id) => id !== stepId) : [...current, stepId];
      return { ...prev, [caseId]: next };
    });
  };

  const toggleEmergencyKitItem = (caseId: string, itemIdx: number) => {
    setCheckedKitsByCase((prev) => {
      const current = prev[caseId] || [0, 1];
      const exists = current.includes(itemIdx);
      const next = exists ? current.filter((i) => i !== itemIdx) : [...current, itemIdx];
      return { ...prev, [caseId]: next };
    });
  };

  const markAllProtocolStepsDone = (caseId: string, steps: ProtocolStep[]) => {
    setCompletedStepsByCase((prev) => ({
      ...prev,
      [caseId]: steps.map((s) => s.id),
    }));
    message.success(`Đã hoàn tất 4/4 bước ca ${caseId}.`);
  };

  // Trigger assignment or Human-in-the-loop Override Modal
  const handleSelectCandidateForAssignment = async (
    req: UnassignedRequest,
    candidate: AICandidate
  ) => {
    if (!candidate.isEligible) {
      message.error('Ứng viên vi phạm ràng buộc cứng (Hard Constraint), không thể phân công.');
      return;
    }

    const reqTop1 =
      req.aiCandidates.find((c) => c.isEligible) || top1Candidate;

    // If Coordinator selects Top 1 Recommended candidate -> direct 1-click assignment
    if (!reqTop1 || candidate.staffId === reqTop1.staffId) {
      setSubmitting(true);
      try {
        await onAssignRequest(req, candidate, false);
        setDrawerCandidate(null);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Otherwise -> Open Human-in-the-loop Override Modal!
    setOverrideModalRequest(req);
    setOverrideModalCandidate(candidate);
    setSelectedOverrideCode('distance');
    setOverrideNotes('');
  };

  const handleConfirmOverrideModal = async () => {
    if (!overrideModalRequest || !overrideModalCandidate) return;
    if (!overrideNotes.trim()) {
      message.error('Bắt buộc nhập giải trình (override_notes) trước khi xác nhận can thiệp!');
      return;
    }

    const reasonObj =
      overrideReasonsList.find((r) => r.code === selectedOverrideCode) ||
      DEFAULT_OVERRIDE_REASONS[0];

    setSubmitting(true);
    try {
      await onAssignRequest(
        overrideModalRequest,
        overrideModalCandidate,
        true,
        `${reasonObj.code}: ${reasonObj.label}`,
        overrideNotes.trim(),
        reasonObj.code
      );
      setOverrideModalCandidate(null);
      setOverrideModalRequest(null);
      setOverrideNotes('');
      setDrawerCandidate(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatchFromDedicatedPage = async () => {
    if (!activePageCase || !chosenPageCandidate) return;
    if (!chosenPageCandidate.isEligible) {
      message.error('Nhân sự đang vi phạm ràng buộc cứng (Hard Constraint).');
      return;
    }

    const liveMatch =
      unassignedRequests.find((r) => r.id === activePageCase.id) ||
      activePageCase.linkedRequest;
    const pageTop1 = activePageCandidates.find((c) => c.isEligible) || activePageCandidates[0];
    const isOver = Boolean(pageTop1 && pageTop1.staffId !== chosenPageCandidate.staffId);

    if (isOver && liveMatch) {
      setOverrideModalRequest(liveMatch);
      setOverrideModalCandidate(chosenPageCandidate);
      setSelectedOverrideCode('distance');
      setOverrideNotes('');
      return;
    }

    setSubmitting(true);
    try {
      const exactLive = unassignedRequests.find((r) => r.id === activePageCase.id);
      if (exactLive) {
        await onAssignRequest(exactLive, chosenPageCandidate, false);
      } else {
        setDispatchedSyntheticCaseIds((prev) => ({
          ...prev,
          [activePageCase.id]: chosenPageCandidate.staffName,
        }));
        message.success(`Đã phân công ${chosenPageCandidate.staffName} (${activePageCase.id}).`);
      }

      setCompletedStepsByCase((prev) => ({
        ...prev,
        [activePageCase.id]: activePageCase.protocolSteps.map((s) => s.id),
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyWeights = async () => {
    setSubmitting(true);
    try {
      await onUpdateWeights(localWeights);
      message.success('Đã cập nhật trọng số DSS.');
    } finally {
      setSubmitting(false);
    }
  };

  // Shared Modal Component for Human-in-the-loop Override
  const renderOverrideModal = () => {
    const modalTop1 =
      overrideModalRequest?.aiCandidates.find((c) => c.isEligible) || top1Candidate;

    return (
      <Modal
        open={Boolean(overrideModalCandidate && overrideModalRequest)}
        onCancel={() => {
          setOverrideModalCandidate(null);
          setOverrideModalRequest(null);
        }}
        footer={null}
        width={580}
        title={
          <div className="flex items-center gap-2 text-[#1E2421]">
            <ArrowRightLeft className="w-4 h-4 text-[#D97706]" strokeWidth={2} />
            <span className="text-[15px] font-semibold">
              Modal Can thiệp của Điều phối viên (Human-in-the-loop Override)
            </span>
          </div>
        }
      >
        {overrideModalCandidate && overrideModalRequest && (
          <div className="space-y-4 pt-1 text-[#1E2421]">
            <div className="p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] text-[12px] text-[#92400E] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                Bạn đang chọn phân công cho nhân sự khác ngoài <strong>Top 1 Khuyến nghị</strong> của AI. Hệ thống bắt buộc ghi nhận mã lý do chuẩn hóa và giải trình vào CSDL (<code>POST /api/v1/assignments/manual</code>).
              </div>
            </div>

            {/* Comparison Box: Top 1 AI vs Coordinator's Choice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modalTop1 && (
                <div className="p-3 rounded-[8px] bg-[#F9FAF8] border border-[#DDE1DA]">
                  <div className="flex items-center justify-between">
                    <CompactBadge tone="optimal">Top 1 Khuyến nghị (AI)</CompactBadge>
                    <span className="font-mono-num text-[14px] font-semibold text-[#2D7D46]">
                      DSS {formatNormalizedScore(modalTop1)}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#1E2421] mt-1.5">
                    {modalTop1.staffName}
                  </div>
                  <div className="text-[11px] text-[#68746E] font-mono-num mt-0.5">
                    Cách {modalTop1.criteria.distanceKm.toFixed(1)}km ({modalTop1.criteria.travelMinutes}p) · Tải {modalTop1.criteria.assignedMinutes}/480p
                  </div>
                </div>
              )}

              <div className="p-3 rounded-[8px] bg-[#EAF5EE]/60 border-2 border-[#2D7D46]">
                <div className="flex items-center justify-between">
                  <CompactBadge tone="warning">
                    Ứng viên Điều phối chọn ({overrideModalCandidate.rankLabel})
                  </CompactBadge>
                  <span className="font-mono-num text-[14px] font-semibold text-[#1E2421]">
                    DSS {formatNormalizedScore(overrideModalCandidate)}
                  </span>
                </div>
                <div className="text-[13px] font-semibold text-[#1E2421] mt-1.5">
                  {overrideModalCandidate.staffName}
                </div>
                <div className="text-[11px] text-[#68746E] font-mono-num mt-0.5">
                  Cách {overrideModalCandidate.criteria.distanceKm.toFixed(1)}km ({overrideModalCandidate.criteria.travelMinutes}p) · Tải {overrideModalCandidate.criteria.assignedMinutes}/480p
                </div>
              </div>
            </div>

            {/* Standardized Dropdown Reason (GET /api/v1/assignments/override-reasons) */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[#1E2421]">
                1. Lý do can thiệp chuẩn hóa <span className="text-[#D93843]">*</span>
                <span className="ml-1.5 text-[11px] font-normal text-[#68746E]">
                  (GET /api/v1/assignments/override-reasons)
                </span>
              </label>
              <Select
                className="w-full"
                size="middle"
                value={selectedOverrideCode}
                onChange={(val) => setSelectedOverrideCode(val)}
                options={overrideReasonsList.map((item) => ({
                  value: item.code,
                  label: `${item.code} — ${item.label}`,
                }))}
              />
            </div>

            {/* Mandatory Explanation Input (override_notes) */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[#1E2421]">
                2. Nội dung giải trình bắt buộc (<code>override_notes</code>){' '}
                <span className="text-[#D93843]">*</span>
              </label>
              <Input.TextArea
                rows={3}
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                placeholder="Nhập giải trình chi tiết lý do điều phối viên chọn nhân sự này (bắt buộc)..."
                className="text-[12px]"
              />
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ECEFE9]">
              <button
                type="button"
                onClick={() => {
                  setOverrideModalCandidate(null);
                  setOverrideModalRequest(null);
                }}
                className="px-4 py-2 rounded-[8px] border border-[#DDE1DA] bg-white hover:bg-[#F9FAF8] text-[12px] font-medium text-[#1E2421] cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submitting || !overrideNotes.trim()}
                onClick={handleConfirmOverrideModal}
                className={`px-4 py-2 rounded-[8px] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  overrideNotes.trim()
                    ? 'bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                    : 'bg-[#DDE1DA] text-[#68746E] cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" strokeWidth={2} />
                <span>Xác nhận Can thiệp & Lưu CSDL</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    );
  };

  // ============================================================================
  // DEDICATED FULL PAGE VIEW (KHI NHẤN VÀO "CA KHẨN CẤP" HOẶC THẺ KPI)
  // Cuộn độc lập 2 bên + Phường tại Nha Trang + Điểm 0.0-1.0 + Tách khối Bị loại
  // ============================================================================
  if (activeKpiPage !== null) {
    const isUrgentPage = activeKpiPage === 'urgent';
    const currentCompletedSteps = activePageCase
      ? completedStepsByCase[activePageCase.id] || ['step-1']
      : [];
    const currentCheckedKits = activePageCase
      ? checkedKitsByCase[activePageCase.id] || [0, 1]
      : [];
    const pageEligibleCands = activePageCandidates.filter((c) => c.isEligible);
    const pageDisqualifiedCands = activePageCandidates.filter((c) => !c.isEligible);

    return (
      <div className="lg:h-[calc(100vh-48px)] lg:overflow-hidden flex flex-col gap-3.5">
        {renderOverrideModal()}

        {/* Top Minimalist Header */}
        <div
          className={`shrink-0 rounded-[8px] border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 ${
            isUrgentPage
              ? 'bg-[#FEF2F2] border-[#FECACA]'
              : 'bg-white border-[#DDE1DA]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveKpiPage(null)}
              className="px-3 py-1.5 rounded-[8px] bg-white border border-[#DDE1DA] hover:border-[#4B5850] text-[12px] font-semibold text-[#1E2421] inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
              <span>Quay lại Bảng chính</span>
            </button>

            {isUrgentPage && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#D93843] text-white text-[11px] font-semibold uppercase">
                <Flame className="w-3 h-3" strokeWidth={2} />
                <span>ƯU TIÊN SỐ 1 · NHA TRANG</span>
              </span>
            )}

            <h1
              className={`text-[15px] font-semibold ${
                isUrgentPage ? 'text-[#991B1B]' : 'text-[#1E2421]'
              }`}
            >
              {isUrgentPage
                ? 'Điều phối Khẩn cấp (TP. Nha Trang)'
                : activeKpiPage === 'active'
                ? 'Ca Đang xử lý'
                : activeKpiPage === 'completed'
                ? 'Ca Hoàn tất'
                : 'Tổng Hàng chờ Nha Trang'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-[8px] border border-[#DDE1DA]">
            <button
              type="button"
              onClick={() => setActiveKpiPage('urgent')}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                activeKpiPage === 'urgent'
                  ? 'bg-[#D93843] text-white'
                  : 'text-[#D93843] hover:bg-[#FEF2F2]'
              }`}
            >
              <Flame className="w-3 h-3" strokeWidth={1.8} />
              <span>Khẩn cấp ({urgentLiveAndQueueCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveKpiPage('queue')}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                activeKpiPage === 'queue'
                  ? 'bg-[#4B5850] text-white font-semibold'
                  : 'text-[#4A5550] hover:bg-[#EEF1EE]'
              }`}
            >
              Hàng chờ
            </button>
            <button
              type="button"
              onClick={() => setActiveKpiPage('active')}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                activeKpiPage === 'active'
                  ? 'bg-[#2563EB] text-white font-semibold'
                  : 'text-[#4A5550] hover:bg-[#EEF1EE]'
              }`}
            >
              Đang xử lý
            </button>
            <button
              type="button"
              onClick={() => setActiveKpiPage('completed')}
              className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                activeKpiPage === 'completed'
                  ? 'bg-[#2D7D46] text-white font-semibold'
                  : 'text-[#4A5550] hover:bg-[#EEF1EE]'
              }`}
            >
              Hoàn tất
            </button>
          </div>
        </div>

        {/* Full-Page Split Master-Detail Workspace: Independent Left & Right Scroll */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:overflow-hidden">
          {/* LEFT COLUMN (4 cols): Independent Scrollable Case List */}
          <div className="lg:col-span-4 lg:h-full min-h-0 bg-white border border-[#DDE1DA] rounded-[8px] overflow-hidden flex flex-col">
            <div className="shrink-0 p-3 border-b border-[#DDE1DA] bg-[#F9FAF8] space-y-2.5">
              <QueueSmartSummary
                cases={filteredPageCases}
                dispatchedMap={dispatchedSyntheticCaseIds}
              />

              <Input
                size="small"
                prefix={<Search className="w-3.5 h-3.5 text-[#68746E]" strokeWidth={1.6} />}
                placeholder="Tìm mã ca, bệnh nhân, phường tại Nha Trang..."
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                allowClear
              />

              {/* Nha Trang Ward Quick Filter */}
              <div className="flex flex-wrap gap-1">
                {['ALL', ...NHA_TRANG_WARDS.slice(0, 5)].map((ward) => (
                  <button
                    key={ward}
                    type="button"
                    onClick={() => setSelectedDistrictFilter(ward)}
                    className={`px-2 py-0.5 rounded-[5px] text-[11px] font-medium transition-colors cursor-pointer ${
                      selectedDistrictFilter === ward
                        ? isUrgentPage
                          ? 'bg-[#D93843] text-white font-semibold'
                          : 'bg-[#4B5850] text-white font-semibold'
                        : 'bg-white border border-[#DDE1DA] text-[#4A5550] hover:bg-[#EEF1EE]'
                    }`}
                  >
                    {ward === 'ALL' ? 'Tất cả phường' : ward.replace('Phường ', 'P. ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 max-h-[560px] lg:max-h-none overflow-y-auto overscroll-contain divide-y divide-[#ECEFE9]">
              {filteredPageCases.map((item) => {
                const isSelected = activePageCase?.id === item.id;
                const isItemUrgent = item.priority === 'Khẩn cấp';
                const isItemDispatched = Boolean(dispatchedSyntheticCaseIds[item.id]);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedPageCaseId(item.id);
                      setSelectedPageStaffId(null);
                    }}
                    className={`w-full text-left p-3 transition-colors cursor-pointer flex flex-col gap-1.5 border-l-4 ${
                      isSelected
                        ? isItemUrgent
                          ? 'bg-[#FEF2F2] border-l-[#D93843]'
                          : 'bg-[#EEF1EE] border-l-[#4B5850]'
                        : 'border-l-transparent hover:bg-[#F9FAF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono-num text-[12px] font-semibold ${
                            isItemUrgent ? 'text-[#D93843]' : 'text-[#1E2421]'
                          }`}
                        >
                          {item.id}
                        </span>
                        {isItemUrgent ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#D93843] text-white text-[10px] font-semibold uppercase">
                            <Flame className="w-2.5 h-2.5" strokeWidth={2} />
                            <span>KHẨN CẤP</span>
                          </span>
                        ) : (
                          <CompactBadge tone="neutral">{item.priority}</CompactBadge>
                        )}
                      </div>

                      {isItemDispatched ? (
                        <CompactBadge tone="optimal" icon={<CheckCircle2 className="w-2.5 h-2.5" />}>
                          Đã chốt
                        </CompactBadge>
                      ) : (
                        <span
                          className={`font-mono-num text-[11px] font-semibold inline-flex items-center gap-1 ${
                            isItemUrgent ? 'text-[#D93843]' : 'text-[#68746E]'
                          }`}
                        >
                          <Clock className="w-3 h-3" strokeWidth={1.8} />
                          <span>{formatSlaCountdown(item.slaMinutes)}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#1E2421] truncate">
                        {item.patientName} ({item.patientAge}t)
                      </span>
                      <CompactBadge tone={isItemUrgent ? 'urgent' : 'primary'}>
                        {item.serviceName}
                      </CompactBadge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#68746E]">
                      <span className="font-mono-num">
                        {item.district} · {item.requestedWindow}
                      </span>
                      <span className="font-mono-num font-semibold text-[#4B5850]">
                        Định mức {item.standardDurationMin}p / AI {item.predictedDurationMin}p
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN (8 cols): Independent Scrollable Detail Workspace */}
          <div className="lg:col-span-8 lg:h-full min-h-0 lg:overflow-y-auto overscroll-contain lg:pr-1 space-y-4 pb-4">
            {activePageCase ? (
              <>
                {/* CARD 1: TOP-K ỨNG VIÊN KHẢ THI + BỊ LOẠI (FLAT HORIZONTAL GRID - CALM CREAM & SAGE GREEN) */}
                <div className="bg-[#FAF8F5] border border-[#E6E0D4] rounded-[8px] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#E6E0D4] bg-[#F2ECE1] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#4E6E5D]" strokeWidth={1.8} />
                      <span className="text-[13px] font-semibold text-[#2C3832]">
                        Top-K Ứng viên khả thi · {activePageCase.id} ({activePageCase.district})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (activePageCase.linkedRequest) {
                          setSelectedRequestId(activePageCase.linkedRequest.id);
                        }
                        setActiveKpiPage(null);
                      }}
                      className="px-2.5 py-1 rounded-[6px] border border-[#D8C7AE] bg-[#FAF8F5] text-[#4A443B] hover:bg-[#EBF2EE] text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Mở trên Bảng DSS chính
                    </button>
                  </div>

                  {/* Eligible Top-K Flat Rows */}
                  <div className="divide-y divide-[#EAE4D8]">
                    {pageEligibleCands.map((cand, index) => {
                      const isPicked = chosenPageCandidate?.staffId === cand.staffId;
                      const isTop1 = index === 0;
                      const assignedMin =
                        cand.criteria.assignedMinutes ??
                        Math.round((cand.criteria.workloadPct / 100) * 480);
                      const deltaMin =
                        cand.criteria.predictedDurationMin + cand.criteria.travelMinutes;

                      return (
                        <div
                          key={cand.staffId}
                          onClick={() => setSelectedPageStaffId(cand.staffId)}
                          className={`px-4 py-3 grid grid-cols-1 xl:grid-cols-12 items-center gap-3 transition-colors cursor-pointer ${
                            isPicked
                              ? 'bg-[#EBF2EE]'
                              : isTop1
                              ? 'bg-[#FAF8F5] hover:bg-[#F2ECE1]/70'
                              : 'bg-white hover:bg-[#FAF8F5]'
                          }`}
                        >
                          {/* Zone 1 (4 cols): Rank Tag + Nhân sự */}
                          <div className="xl:col-span-4 flex items-center gap-2.5 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-semibold font-mono-num shrink-0 ${
                                isTop1
                                  ? 'bg-[#4E6E5D] text-white'
                                  : 'bg-[#F2ECE1] text-[#4A443B] border border-[#D8C7AE]'
                              }`}
                            >
                              {isTop1 ? 'Top 1' : `Top ${index + 1}`}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[#2C3832] truncate">
                                {cand.staffName}
                              </div>
                              <div className="text-[11px] text-[#7A756C] truncate">
                                {cand.staffRole} · {cand.zone.replace('Phường ', 'P. ')}
                              </div>
                            </div>
                          </div>

                          {/* Zone 2 (4 cols): Icon-Only Glanceable Metrics */}
                          <div className="xl:col-span-4 flex items-center gap-3 text-[12px] font-mono-num text-[#3D4742]">
                            <Tooltip title={`Khung giờ rảnh: ${cand.criteria.availableGapText} (${cand.criteria.timeFitNote})`}>
                              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 text-[#4E6E5D]" strokeWidth={1.8} />
                                <span>{cand.criteria.availableGapText.replace('Rảnh ', '')}</span>
                              </span>
                            </Tooltip>

                            <Tooltip title={`Khoảng cách & Thời gian di chuyển tới nhà bệnh nhân`}>
                              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                <MapPin className="w-3.5 h-3.5 text-[#9E6B25]" strokeWidth={1.8} />
                                <span>{cand.criteria.distanceKm.toFixed(1)}km · {cand.criteria.travelMinutes}p</span>
                              </span>
                            </Tooltip>
                          </div>

                          {/* Zone 3 (2 cols): Stacked Workload Progress Bar */}
                          <div className="xl:col-span-2">
                            <WorkloadStackedBar assignedMin={assignedMin} deltaMin={deltaMin} />
                          </div>

                          {/* Zone 4 (2 cols): Mini Radar + DSS Score Tooltip */}
                          <div className="xl:col-span-2 flex justify-end">
                            <MiniRadarWithTooltip
                              candidate={cand}
                              weights={localWeights}
                              isTop1={isTop1}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Disqualified Candidates Block inside Dedicated Page (Progressive Disclosure via Tooltip) */}
                  {pageDisqualifiedCands.length > 0 && (
                    <div className="border-t border-[#E6E0D4] bg-[#F2ECE1]/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#7A756C] inline-flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5 text-[#B93829]" strokeWidth={1.8} />
                        <span>Không khả thi ({pageDisqualifiedCands.length} nhân sự · Rà chuột xem lý do loại):</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pageDisqualifiedCands.map((cand) => (
                          <Tooltip
                            key={cand.staffId}
                            color="#1F2924"
                            title={
                              <div className="p-1 space-y-1 text-[11px]">
                                <div className="font-semibold text-[#FCA5A5]">
                                  {cand.staffName} ({cand.staffRole})
                                </div>
                                {(cand.hardConstraintDetails || []).map((v, i) => (
                                  <div key={i} className="text-white/90">
                                    • <strong>{v.labelVi}:</strong> {v.detail}
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <span className="px-2 py-0.5 rounded-[4px] bg-white border border-[#E6E0D4] text-[11px] text-[#5C5852] cursor-help inline-flex items-center gap-1">
                              <span>{cand.staffName}</span>
                              <span className="text-[#B93829] font-mono-num">
                                ({cand.hardConstraintDetails?.[0]?.labelEn || 'Hard Constraint'})
                              </span>
                            </span>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="px-4 py-2.5 bg-[#F2ECE1] border-t border-[#E6E0D4] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#5C5852]">
                      Chọn nhân viên ngoài Top 1 sẽ mở <strong>Modal Can thiệp (Override)</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onNavigateToGantt}
                        className="px-3 py-1.5 rounded-[6px] border border-[#D8C7AE] bg-[#FAF8F5] hover:bg-white text-[12px] font-medium text-[#2C3832] cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Lịch Gantt
                      </button>
                      <button
                        type="button"
                        disabled={!chosenPageCandidate || submitting}
                        onClick={handleDispatchFromDedicatedPage}
                        className="px-3.5 py-1.5 rounded-[6px] bg-[#4E6E5D] hover:bg-[#3E594B] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>
                          {chosenPageCandidate &&
                          pageEligibleCands[0] &&
                          chosenPageCandidate.staffId !== pageEligibleCands[0].staffId
                            ? `Can thiệp Override (${chosenPageCandidate.staffName})`
                            : `Chốt điều phối (${chosenPageCandidate?.staffName})`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* CARD 2: SƠ ĐỒ TƯ DUY CA BỆNH */}
                <UrgentCaseMindMap
                  caseData={activePageCase}
                  checkedKits={currentCheckedKits}
                  completedSteps={currentCompletedSteps}
                  onToggleKit={(idx) => toggleEmergencyKitItem(activePageCase.id, idx)}
                  onToggleStep={(stepId) => toggleProtocolStep(activePageCase.id, stepId)}
                  onMarkAllSteps={() =>
                    markAllProtocolStepsDone(activePageCase.id, activePageCase.protocolSteps)
                  }
                />
              </>
            ) : (
              <div className="bg-white border border-[#DDE1DA] rounded-[8px] p-10 text-center text-[13px] text-[#68746E]">
                Không có ca phù hợp.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN AI RECOMMENDATION SCREEN 1 (FULL SPECIFICATION COMPLIANCE)
  // ============================================================================
  return (
    <div className="space-y-5">
      {renderOverrideModal()}

      {/* 1. 4 THẺ KPI (DASHBOARD CARDS) ĐẶT Ở TRÊN CÙNG */}
      <section aria-label="Dashboard KPI Cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setQueueSearchQuery('');
            setSelectedDistrictFilter('ALL');
            setSelectedPriorityFilter('ALL');
            setActiveKpiPage('queue');
          }}
          className="text-left bg-white border border-[#DDE1DA] hover:border-[#4B5850] rounded-[8px] p-4 transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(75,88,80,0.08)] focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#4A5550]">Tổng hàng chờ Nha Trang</span>
            <ChevronRight className="w-4 h-4 text-[#68746E]" strokeWidth={1.8} />
          </div>
          <div className="text-[28px] font-semibold text-[#4B5850] leading-8 mt-1.5 font-mono-num tabular-nums">
            {(1280 + unassignedRequests.length).toLocaleString('en-US')}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueSearchQuery('');
            setSelectedDistrictFilter('ALL');
            setSelectedPriorityFilter('Khẩn cấp');
            setActiveKpiPage('urgent');
          }}
          className="text-left bg-[#FEF2F2] border-2 border-[#D93843] rounded-[8px] p-4 transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(217,56,67,0.18)] focus:outline-none"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#991B1B]">Ca khẩn cấp</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-[#D93843] text-white text-[10px] font-semibold uppercase">
              <Flame className="w-3 h-3" strokeWidth={2} />
              <span>ƯU TIÊN</span>
            </span>
          </div>
          <div className="text-[28px] font-semibold text-[#D93843] leading-8 mt-1.5 font-mono-num tabular-nums">
            {(140 + unassignedRequests.filter((r) => r.priority === 'Khẩn cấp').length).toLocaleString('en-US')}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueSearchQuery('');
            setSelectedDistrictFilter('ALL');
            setSelectedPriorityFilter('ALL');
            setActiveKpiPage('active');
          }}
          className="text-left bg-white border border-[#DDE1DA] hover:border-[#2563EB] rounded-[8px] p-4 transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,99,235,0.08)] focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#4A5550]">Đang xử lý</span>
            <ChevronRight className="w-4 h-4 text-[#2563EB]" strokeWidth={1.8} />
          </div>
          <div className="text-[28px] font-semibold text-[#2563EB] leading-8 mt-1.5 font-mono-num tabular-nums">
            318
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueSearchQuery('');
            setSelectedDistrictFilter('ALL');
            setSelectedPriorityFilter('ALL');
            setActiveKpiPage('completed');
          }}
          className="text-left bg-white border border-[#DDE1DA] hover:border-[#2D7D46] rounded-[8px] p-4 transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(45,125,70,0.08)] focus:outline-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#4A5550]">Hoàn tất</span>
            <ChevronRight className="w-4 h-4 text-[#2D7D46]" strokeWidth={1.8} />
          </div>
          <div className="text-[28px] font-semibold text-[#2D7D46] leading-8 mt-1.5 font-mono-num tabular-nums">
            2,940
          </div>
        </button>
      </section>

      {/* 2. KHUNG TIẾP NHẬN YÊU CẦU + BẢNG XẾP HẠNG TOP-K ỨNG VIÊN KHẢ THI */}
      <section className="bg-white border border-[#DDE1DA] rounded-[8px] overflow-hidden">
        {/* Top Filter & Case Selector Bar */}
        <div className="px-5 py-2.5 border-b border-[#DDE1DA] bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center bg-[#F9FAF8] border border-[#DDE1DA] rounded-[6px] p-0.5">
              {(['ALL', 'Khẩn cấp', 'Cao', 'Tiêu chuẩn'] as const).map((prio) => (
                <button
                  key={prio}
                  type="button"
                  onClick={() => setOverviewPriorityFilter(prio)}
                  className={`px-2.5 py-1 rounded-[5px] text-[11px] font-medium transition-colors cursor-pointer ${
                    overviewPriorityFilter === prio
                      ? prio === 'Khẩn cấp'
                        ? 'bg-[#D93843] text-white font-semibold'
                        : 'bg-[#4B5850] text-white font-semibold'
                      : 'text-[#4A5550] hover:text-[#1E2421]'
                  }`}
                >
                  {prio === 'ALL' ? 'Tất cả' : prio}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {filteredOverviewRequests.map((req) => {
                const isReqActive = activeRequest?.id === req.id;
                const isReqUrgent = req.priority === 'Khẩn cấp';
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(req.id);
                      setExpandedRowStaffId(null);
                    }}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isReqActive
                        ? isReqUrgent
                          ? 'bg-[#D93843] text-white font-semibold'
                          : 'bg-[#4B5850] text-white font-semibold'
                        : isReqUrgent
                        ? 'bg-[#FEF2F2] text-[#D93843] border border-[#FECACA]'
                        : 'bg-white text-[#4A5550] border border-[#DDE1DA]'
                    }`}
                  >
                    {isReqUrgent && <Flame className="w-3 h-3" strokeWidth={2} />}
                    <span className="font-mono-num">{req.id}</span>
                    <span>· {req.patientName} ({req.district.replace('Phường ', 'P. ')})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-[#F9FAF8] border border-[#DDE1DA] rounded-[6px] p-0.5">
              <button
                type="button"
                onClick={() => setTableDensity('comfortable')}
                className={`px-2 py-1 rounded-[4px] text-[11px] inline-flex items-center gap-1 cursor-pointer ${
                  tableDensity === 'comfortable'
                    ? 'bg-white text-[#1E2421] font-semibold shadow-2xs'
                    : 'text-[#68746E]'
                }`}
              >
                <LayoutList className="w-3 h-3" strokeWidth={1.8} />
                <span>Vừa</span>
              </button>
              <button
                type="button"
                onClick={() => setTableDensity('compact')}
                className={`px-2 py-1 rounded-[4px] text-[11px] inline-flex items-center gap-1 cursor-pointer ${
                  tableDensity === 'compact'
                    ? 'bg-white text-[#1E2421] font-semibold shadow-2xs'
                    : 'text-[#68746E]'
                }`}
              >
                <Rows3 className="w-3 h-3" strokeWidth={1.8} />
                <span>Gọn</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowWeightTuner(!showWeightTuner)}
              className="px-2.5 py-1 rounded-[6px] border border-[#DDE1DA] bg-white hover:bg-[#EEF1EE] text-[11px] font-medium text-[#4A5550] inline-flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" strokeWidth={1.5} />
              <span>Trọng số DSS</span>
            </button>
          </div>
        </div>

        {/* KHUNG TIẾP NHẬN YÊU CẦU (REQUEST HEADER) */}
        {activeRequest && (
          <RequestHeaderPanel
            request={activeRequest}
            topCandidate={top1Candidate}
            slaCountdown={formatSlaCountdown(12)}
            submitting={submitting}
            onFastAssign={() => {
              if (activeRequest && top1Candidate) {
                handleSelectCandidateForAssignment(activeRequest, top1Candidate);
              }
            }}
            onOpenMindMapPage={() => {
              setSelectedPageCaseId(activeRequest.id);
              setActiveKpiPage(activeRequest.priority === 'Khẩn cấp' ? 'urgent' : 'queue');
            }}
          />
        )}

        {/* Collapsible Weight Tuner */}
        {showWeightTuner && (
          <div className="px-5 py-3 bg-[#F9FAF8] border-b border-[#DDE1DA] flex flex-wrap items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-5 flex-1 text-[12px]">
              <div>
                <div className="flex justify-between text-[#1E2421] font-medium">
                  <span>SkillFit</span>
                  <span className="font-mono-num text-[#4B5850]">{Math.round(localWeights.skillFit * 100)}%</span>
                </div>
                <Slider
                  min={5}
                  max={60}
                  value={Math.round(localWeights.skillFit * 100)}
                  onChange={(v) => setLocalWeights({ ...localWeights, skillFit: v / 100 })}
                />
              </div>
              <div>
                <div className="flex justify-between text-[#1E2421] font-medium">
                  <span>TimeFit</span>
                  <span className="font-mono-num text-[#4B5850]">{Math.round(localWeights.timeFit * 100)}%</span>
                </div>
                <Slider
                  min={5}
                  max={60}
                  value={Math.round(localWeights.timeFit * 100)}
                  onChange={(v) => setLocalWeights({ ...localWeights, timeFit: v / 100 })}
                />
              </div>
              <div>
                <div className="flex justify-between text-[#1E2421] font-medium">
                  <span>Distance</span>
                  <span className="font-mono-num text-[#4B5850]">{Math.round(localWeights.distance * 100)}%</span>
                </div>
                <Slider
                  min={5}
                  max={60}
                  value={Math.round(localWeights.distance * 100)}
                  onChange={(v) => setLocalWeights({ ...localWeights, distance: v / 100 })}
                />
              </div>
              <div>
                <div className="flex justify-between text-[#1E2421] font-medium">
                  <span>Workload</span>
                  <span className="font-mono-num text-[#4B5850]">{Math.round(localWeights.workload * 100)}%</span>
                </div>
                <Slider
                  min={5}
                  max={60}
                  value={Math.round(localWeights.workload * 100)}
                  onChange={(v) => setLocalWeights({ ...localWeights, workload: v / 100 })}
                />
              </div>
              <div>
                <div className="flex justify-between text-[#1E2421] font-medium">
                  <span>Continuity</span>
                  <span className="font-mono-num text-[#4B5850]">{Math.round(localWeights.continuity * 100)}%</span>
                </div>
                <Slider
                  min={5}
                  max={60}
                  value={Math.round(localWeights.continuity * 100)}
                  onChange={(v) => setLocalWeights({ ...localWeights, continuity: v / 100 })}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleApplyWeights}
              className="px-3.5 py-1.5 rounded-[8px] bg-[#4B5850] hover:bg-[#3D4841] text-white text-[12px] font-medium cursor-pointer shrink-0"
            >
              Lưu trọng số
            </button>
          </div>
        )}

        {/* Section Header: Bảng xếp hạng ứng viên khả thi (Top-K Candidates - Flat Enterprise DSS Grid) */}
        <div className="px-5 py-2.5 bg-[#F2ECE1] border-b border-[#E6E0D4] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4E6E5D]" strokeWidth={2} />
            <span className="text-[13px] font-semibold text-[#2C3832]">
              Ứng viên Khuyến nghị (Top-K Candidates)
            </span>
            <span className="text-[11px] font-mono-num text-[#7A756C] hidden sm:inline">
              · GET /api/v1/schedule/recommend-candidates/{activeRequest?.id}
            </span>
          </div>

          {/* Chú giải trực quan (Legend) cho Thanh tiến trình gộp 2 màu & Icon */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#5C5852]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2 rounded-xs bg-[#4E6E5D] inline-block" />
              <span>Đã kín lịch</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2 rounded-xs bg-[#D49B4B] inline-block" />
              <span>+Tăng thêm nếu nhận ca</span>
            </span>
            <span className="text-[#7A756C] hidden md:inline">
              · Rà chuột vào <strong>Điểm DSS</strong> để xem 5 chỉ số thành phần
            </span>
          </div>
        </div>

        {/* FLAT HORIZONTAL GRID: TOP-K CANDIDATES (GLANCEABLE, NO NESTED CARDS, PROGRESSIVE DISCLOSURE) */}
        {!activeRequest ? (
          <div className="p-10 text-center text-[13px] text-[#7A756C] bg-[#FAF8F5]">
            Đã điều phối hết hàng chờ.
          </div>
        ) : (
          <div className="divide-y divide-[#E6E0D4] bg-[#FAF8F5]">
            {/* Tinh gọn Header cột bằng Icon */}
            <div className="hidden lg:grid lg:grid-cols-12 items-center gap-4 px-5 py-2 bg-[#FAF8F5] text-[11px] font-medium text-[#7A756C]">
              <div className="col-span-4">Ứng viên & Tuyến phụ trách</div>
              <div className="col-span-3 flex items-center gap-5">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#4E6E5D]" /> Khung rảnh
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#9E6B25]" /> Lộ trình
                </span>
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="w-3 h-3 text-[#4E6E5D]" /> Tương thích
                </span>
              </div>
              <div className="col-span-2">Khối lượng công việc (8h)</div>
              <div className="col-span-1 text-right">Điểm DSS</div>
              <div className="col-span-2 text-right">Hành động</div>
            </div>

            {topKCandidates.map((cand, idx) => {
              const isRank1 = idx === 0;
              const isRowExpanded = expandedRowStaffId === cand.staffId;
              const padY = tableDensity === 'compact' ? 'py-2.5' : 'py-3.5';
              const assignedMin =
                cand.criteria.assignedMinutes ??
                Math.round((cand.criteria.workloadPct / 100) * 480);
              const deltaMin =
                cand.criteria.predictedDurationMin + cand.criteria.travelMinutes;

              return (
                <div key={cand.staffId} className="transition-colors">
                  <div
                    onClick={() => setDrawerCandidate(cand)}
                    className={`grid grid-cols-1 lg:grid-cols-12 items-center gap-4 px-5 ${padY} cursor-pointer transition-colors ${
                      isRank1
                        ? 'bg-[#EBF2EE]/65 hover:bg-[#EBF2EE]'
                        : 'bg-[#FAF8F5] hover:bg-[#F2ECE1]/60'
                    }`}
                  >
                    {/* ZONE 1 (Cols 1-4): Rank Tag + Avatar + Tên nhân viên & Tuyến */}
                    <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                          isRank1
                            ? 'bg-[#4E6E5D] text-white'
                            : 'bg-[#F2ECE1] text-[#4A443B] border border-[#D8C7AE]'
                        }`}
                      >
                        {getInitials(cand.staffName)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0 ${
                              isRank1
                                ? 'bg-[#4E6E5D] text-white'
                                : 'bg-[#F2ECE1] text-[#5C5852] border border-[#D8C7AE]'
                            }`}
                          >
                            {isRank1 ? 'Top 1 Khuyến nghị' : `Top ${idx + 1}`}
                          </span>
                          <span className="text-[14px] font-semibold text-[#2C3832] truncate">
                            {cand.staffName}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#7A756C] truncate mt-0.5">
                          {cand.staffRole} · {cand.zone.replace('Phường ', 'P. ')}
                        </div>
                      </div>
                    </div>

                    {/* ZONE 2 (Cols 5-7): Glanceable Icon Grid (Không nhãn chữ rườm rà) */}
                    <div className="lg:col-span-3 flex flex-wrap items-center gap-4 text-[12px] font-mono-num tabular-nums text-[#2C3832]">
                      <Tooltip
                        placement="top"
                        color="#1F2924"
                        title={`Khung giờ trống: ${cand.criteria.availableGapText} · ${cand.criteria.timeFitNote}`}
                      >
                        <span className="inline-flex items-center gap-1.5 cursor-help whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-[#4E6E5D] shrink-0" strokeWidth={1.8} />
                          <span>{cand.criteria.availableGapText.replace('Rảnh ', '')}</span>
                        </span>
                      </Tooltip>

                      <Tooltip
                        placement="top"
                        color="#1F2924"
                        title={`Khoảng cách ${cand.criteria.distanceKm.toFixed(1)} km · Thời gian di chuyển dự kiến ${cand.criteria.travelMinutes} phút`}
                      >
                        <span className="inline-flex items-center gap-1.5 cursor-help whitespace-nowrap">
                          <MapPin className="w-3.5 h-3.5 text-[#9E6B25] shrink-0" strokeWidth={1.8} />
                          <span>
                            {cand.criteria.distanceKm.toFixed(1)}km · {cand.criteria.travelMinutes}p
                          </span>
                        </span>
                      </Tooltip>

                      <Tooltip
                        placement="top"
                        color="#1F2924"
                        title={`Đạt ${cand.criteria.matchedSkills.length}/${activeRequest.requiredSkills.length} chứng chỉ (${cand.criteria.matchedSkills.join(', ')}) · Đã chăm sóc bệnh nhân ${cand.criteria.previousVisitsCount} lần`}
                      >
                        <span className="inline-flex items-center gap-1.5 cursor-help whitespace-nowrap text-[#4E6E5D] font-semibold">
                          <Stethoscope className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                          <span>
                            {cand.criteria.matchedSkills.length}/{activeRequest.requiredSkills.length} KN · {cand.criteria.previousVisitsCount} lần
                          </span>
                        </span>
                      </Tooltip>
                    </div>

                    {/* ZONE 3 (Cols 8-9): 2-Color Stacked Workload Progress Bar */}
                    <div className="lg:col-span-2">
                      <WorkloadStackedBar
                        assignedMin={assignedMin}
                        deltaMin={deltaMin}
                        maxMin={480}
                      />
                    </div>

                    {/* ZONE 4 (Col 10): Progressive Disclosure DSS Score + Mini Radar Tooltip */}
                    <div
                      className="lg:col-span-1 flex lg:justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MiniRadarWithTooltip
                        candidate={cand}
                        weights={localWeights}
                        isTop1={isRank1}
                      />
                    </div>

                    {/* ZONE 5 (Cols 11-12): Nút hành động gọn trên 1 mặt phẳng ngang */}
                    <div
                      className="lg:col-span-2 flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Mở Sơ đồ tư duy 5 thành phần DSS">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRowStaffId(isRowExpanded ? null : cand.staffId)
                          }
                          className="p-1.5 rounded-[6px] border border-[#D8C7AE] bg-[#FAF8F5] text-[#4A443B] hover:bg-[#F2ECE1] inline-flex items-center justify-center cursor-pointer transition-colors"
                          aria-label="Sơ đồ DSS"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-[#4E6E5D]" strokeWidth={1.8} />
                        </button>
                      </Tooltip>

                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          handleSelectCandidateForAssignment(activeRequest, cand)
                        }
                        className={`px-3 py-1.5 rounded-[6px] text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                          isRank1
                            ? 'bg-[#4E6E5D] hover:bg-[#3E594B] text-white'
                            : 'bg-[#F2ECE1] hover:bg-[#E5DBC8] text-[#5C4728] border border-[#D8C7AE]'
                        }`}
                      >
                        {isRank1 ? (
                          <>
                            <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                            <span>Phân công ngay</span>
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={2} />
                            <span>Can thiệp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Hàng mở rộng tùy chọn: SƠ ĐỒ TƯ DUY 5 THÀNH PHẦN EXPLAINABLE DSS */}
                  {isRowExpanded && (
                    <div className="px-5 py-3.5 bg-[#F2ECE1]/45 border-t border-[#E6E0D4]">
                      <CandidateMindMap candidate={cand} weights={localWeights} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. KHỐI DANH SÁCH ỨNG VIÊN KHÔNG KHẢ THI (DISQUALIFIED CANDIDATES - PROGRESSIVE DISCLOSURE VIA TOOLTIP) */}
      {activeRequest && disqualifiedCandidates.length > 0 && (
        <section
          aria-label="Disqualified Candidates"
          className="bg-[#FAF8F5] border border-[#E6E0D4] rounded-[8px] overflow-hidden"
        >
          {/* Flat Header */}
          <div className="px-5 py-2.5 bg-[#F2ECE1] border-b border-[#E6E0D4] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#B93829]" strokeWidth={1.8} />
              <span className="text-[13px] font-semibold text-[#2C3832]">
                Ứng viên không khả thi ({disqualifiedCandidates.length} nhân sự bị loại bởi Ràng buộc cứng)
              </span>
            </div>
            <span className="text-[11px] text-[#7A756C]">
              Rà chuột vào từng nhân sự để xem chi tiết nguyên nhân loại (Progressive Disclosure)
            </span>
          </div>

          {/* Flat Horizontal Rows for Disqualified Candidates */}
          <div className="divide-y divide-[#EAE4D8]">
            {disqualifiedCandidates.map((cand) => {
              const assignedMin =
                cand.criteria.assignedMinutes ??
                Math.round((cand.criteria.workloadPct / 100) * 480);
              const deltaMin =
                cand.criteria.predictedDurationMin + cand.criteria.travelMinutes;
              const violations: HardConstraintViolation[] =
                cand.hardConstraintDetails && cand.hardConstraintDetails.length > 0
                  ? cand.hardConstraintDetails
                  : cand.constraintViolations.map((v) => ({
                      code: 'DIRECT_OVERLAP',
                      labelVi: 'Vi phạm ràng buộc cứng',
                      labelEn: 'Hard constraint',
                      detail: v,
                    }));

              return (
                <Tooltip
                  key={cand.staffId}
                  placement="top"
                  color="#1F2924"
                  title={
                    <div className="p-1.5 space-y-1.5 text-[11px] max-w-[340px]">
                      <div className="font-semibold text-[#FCA5A5] border-b border-white/15 pb-1">
                        Nguyên nhân loại: {cand.staffName} ({cand.staffRole})
                      </div>
                      {violations.map((v, i) => (
                        <div key={i} className="text-white/90 leading-snug">
                          • <strong className="text-[#FDE68A]">{v.labelVi} ({v.labelEn}):</strong>{' '}
                          {v.detail}
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 px-5 py-2.5 bg-[#FAF8F5] hover:bg-[#F2ECE1]/60 transition-colors cursor-help">
                    {/* Cột 1-4: Nhân viên */}
                    <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#F2ECE1] border border-[#D8C7AE] text-[#7A756C] flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {getInitials(cand.staffName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#5C5852] truncate">
                          {cand.staffName}
                        </div>
                        <div className="text-[11px] text-[#7A756C] truncate">
                          {cand.staffRole} · {cand.zone.replace('Phường ', 'P. ')}
                        </div>
                      </div>
                    </div>

                    {/* Cột 5-7: Icon khoảng cách & khung giờ */}
                    <div className="lg:col-span-3 flex items-center gap-4 text-[12px] font-mono-num text-[#7A756C]">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-[#7A756C]" strokeWidth={1.8} />
                        <span>{cand.criteria.availableGapText}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <MapPin className="w-3.5 h-3.5 text-[#7A756C]" strokeWidth={1.8} />
                        <span>{cand.criteria.distanceKm.toFixed(1)}km · {cand.criteria.travelMinutes}p</span>
                      </span>
                    </div>

                    {/* Cột 8-9: Stacked Workload */}
                    <div className="lg:col-span-2 opacity-80">
                      <WorkloadStackedBar assignedMin={assignedMin} deltaMin={deltaMin} />
                    </div>

                    {/* Cột 10-12: Tag tóm tắt ràng buộc vi phạm (Rà chuột xem giải trình chi tiết) */}
                    <div className="lg:col-span-3 flex flex-wrap items-center lg:justify-end gap-1.5">
                      {violations.map((v, vIdx) => (
                        <span
                          key={vIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#FDF2F2] border border-[#F5C2C2] text-[#B93829] text-[11px] font-medium whitespace-nowrap"
                        >
                          <FileWarning className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                          <span>{v.labelVi}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. SLIDE-OUT DRAWER (SƠ ĐỒ 5 THÀNH PHẦN + BIỂU ĐỒ RADAR ĐỐI CHIẾU) */}
      <Drawer
        open={Boolean(drawerCandidate)}
        onClose={() => setDrawerCandidate(null)}
        placement="right"
        size={500}
        styles={{
          mask: { backgroundColor: 'rgba(0, 0, 0, 0.20)' },
        }}
        title={
          drawerCandidate ? (
            <div className="flex items-center justify-between pr-2">
              <div>
                <div className="text-[15px] font-semibold text-[#1E2421] flex items-center gap-2">
                  <span>{drawerCandidate.staffName}</span>
                  <CompactBadge tone={drawerCandidate.isEligible ? 'optimal' : 'urgent'}>
                    {drawerCandidate.rankLabel}
                  </CompactBadge>
                </div>
                <div className="text-[11px] font-normal text-[#68746E]">
                  {drawerCandidate.staffRole} · {drawerCandidate.zone} (TP. Nha Trang)
                </div>
              </div>
              <div className="text-right font-mono-num tabular-nums">
                <div className="text-[18px] font-semibold text-[#2D7D46]">
                  DSS {formatNormalizedScore(drawerCandidate)}
                </div>
              </div>
            </div>
          ) : null
        }
        footer={
          drawerCandidate && activeRequest ? (
            <div className="flex items-center justify-between gap-2.5 py-1">
              <button
                type="button"
                onClick={() => setDrawerCandidate(null)}
                className="px-4 py-2 rounded-[8px] border border-[#DDE1DA] bg-white hover:bg-[#F9FAF8] text-[12px] font-medium text-[#1E2421] cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!drawerCandidate.isEligible || submitting}
                onClick={() =>
                  handleSelectCandidateForAssignment(activeRequest, drawerCandidate)
                }
                className={`flex-1 py-2 px-4 rounded-[8px] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  drawerCandidate.isEligible
                    ? top1Candidate?.staffId === drawerCandidate.staffId
                      ? 'bg-[#2D7D46] hover:bg-[#236337] text-white cursor-pointer'
                      : 'bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer'
                    : 'bg-[#DDE1DA] text-[#68746E] cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" strokeWidth={1.8} />
                <span>
                  {top1Candidate?.staffId === drawerCandidate.staffId
                    ? 'Chốt phân công Top 1 Khuyến nghị'
                    : 'Can thiệp chọn ứng viên này (Mở Modal Override)'}
                </span>
              </button>
            </div>
          ) : null
        }
      >
        {drawerCandidate && (
          <div className="space-y-4 text-[#1E2421]">
            {!drawerCandidate.isEligible && (
              <div className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[#D93843]">
                  <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                  <span>Ứng viên bị loại do vi phạm Ràng buộc cứng (Hard Constraints):</span>
                </div>
                {(drawerCandidate.hardConstraintDetails || []).map((v, i) => (
                  <div key={i} className="text-[11px] text-[#991B1B] pl-6">
                    • <strong>{v.labelVi} ({v.labelEn}):</strong> {v.detail}
                  </div>
                ))}
              </div>
            )}

            {/* Sơ đồ tư duy 5 thành phần điểm số DSS */}
            <CandidateMindMap candidate={drawerCandidate} weights={localWeights} />

            {/* Biểu đồ Radar đối chiếu với Top 1 */}
            <div className="p-3.5 rounded-[8px] bg-[#F9FAF8] border border-[#ECEFE9] flex flex-col items-center">
              <div className="text-[12px] font-semibold text-[#1E2421] self-start mb-1">
                Biểu đồ Radar đối chiếu 5 thành phần DSS
              </div>
              <DSSColoredRadarChart
                candidate={drawerCandidate}
                benchmark={top1Candidate}
              />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
