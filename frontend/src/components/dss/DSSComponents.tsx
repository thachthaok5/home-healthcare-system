import React from 'react';

/* ==========================================================================
   1. DSS BUTTON COMPONENT (B2B Healthcare DSS Color System)
   ========================================================================== */
export type DSSButtonVariant = 'solid' | 'outline' | 'ghost' | 'danger';
export type DSSButtonSize = 'xs' | 'sm' | 'md';
export type DSSVisualState = 'default' | 'hover' | 'active' | 'disabled';

interface DSSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DSSButtonVariant;
  size?: DSSButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  forceState?: DSSVisualState;
}

export const DSSButton: React.FC<DSSButtonProps> = ({
  variant = 'solid',
  size = 'sm',
  icon,
  iconRight,
  forceState,
  disabled,
  className = '',
  children,
  ...rest
}) => {
  const isDisabled = disabled || forceState === 'disabled';

  const sizeClasses: Record<DSSButtonSize, string> = {
    xs: 'h-7 px-2.5 py-1 text-[11px] leading-[14px] gap-1 rounded-[8px]',
    sm: 'h-8 px-3 py-1.5 text-[12px] leading-[16px] gap-1.5 rounded-[8px]',
    md: 'h-9 px-4 py-2 text-[13px] leading-[18px] gap-2 rounded-[8px]',
  };

  const getVariantClasses = (): string => {
    if (isDisabled) {
      if (variant === 'solid' || variant === 'danger') {
        return 'bg-[#DDE1DA] text-[#8E9892] border border-[#DDE1DA] cursor-not-allowed';
      }
      if (variant === 'outline') {
        return 'bg-[#F9FAF8] text-[#8E9892] border border-[#DDE1DA] cursor-not-allowed';
      }
      return 'bg-transparent text-[#8E9892] border border-transparent cursor-not-allowed';
    }

    if (variant === 'danger') {
      return 'bg-[#D93843] text-white border border-[#D93843] hover:bg-[#B82832] hover:border-[#B82832] active:bg-[#991B1B] cursor-pointer';
    }

    if (variant === 'solid') {
      if (forceState === 'hover') {
        return 'bg-[#3D4841] text-white border border-[#3D4841]';
      }
      if (forceState === 'active') {
        return 'bg-[#2F3833] text-white border border-[#2F3833]';
      }
      return 'bg-[#4B5850] text-white border border-[#4B5850] hover:bg-[#3D4841] hover:border-[#3D4841] active:bg-[#2F3833] active:border-[#2F3833] cursor-pointer';
    }

    if (variant === 'outline') {
      if (forceState === 'hover') {
        return 'bg-[#EEF1EE] text-[#1E2421] border-[#4B5850]';
      }
      if (forceState === 'active') {
        return 'bg-[#E2E6E2] text-[#1E2421] border-[#2F3833]';
      }
      return 'bg-white text-[#1E2421] border border-[#DDE1DA] hover:bg-[#F9FAF8] hover:border-[#4B5850] active:bg-[#EEF1EE] cursor-pointer';
    }

    // ghost
    if (forceState === 'hover') {
      return 'bg-[#EEF1EE] text-[#1E2421] border border-transparent';
    }
    if (forceState === 'active') {
      return 'bg-[#DDE1DA] text-[#1E2421] border border-transparent';
    }
    return 'bg-transparent text-[#4A5550] border border-transparent hover:bg-[#EEF1EE] hover:text-[#1E2421] active:bg-[#DDE1DA] cursor-pointer';
  };

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4B5850] ${sizeClasses[size]} ${getVariantClasses()} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
      {iconRight && <span className="shrink-0 flex items-center">{iconRight}</span>}
    </button>
  );
};

/* ==========================================================================
   2. DSS BADGE / PRIORITY SIGNAGE COMPONENT
   ========================================================================== */
export type DSSBadgeTone =
  | 'optimal'
  | 'eligible'
  | 'warning'
  | 'urgent'
  | 'neutral';

interface DSSBadgeProps {
  tone?: DSSBadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const DSSBadge: React.FC<DSSBadgeProps> = ({
  tone = 'neutral',
  icon,
  children,
  className = '',
}) => {
  const toneStyles: Record<DSSBadgeTone, string> = {
    optimal: 'bg-[#EAF5EE] text-[#2D7D46] border-[#B7DFC5]',
    eligible: 'bg-[#EEF1EE] text-[#4B5850] border-[#CBD2CD]',
    warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
    urgent: 'bg-[#D93843] text-white border-[#D93843] shadow-xs',
    neutral: 'bg-[#F9FAF8] text-[#68746E] border-[#DDE1DA]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] border dss-caption whitespace-nowrap shrink-0 ${toneStyles[tone]} ${className}`}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

/* ==========================================================================
   3. DSS MICRO IN-CELL PROGRESS BAR (Semantic Color Coded)
   ========================================================================== */
export type DSSMetricLevel = 'good' | 'warning' | 'poor';

export function getDSSMetricLevel(scorePct: number): DSSMetricLevel {
  if (scorePct >= 80) return 'good';
  if (scorePct >= 60) return 'warning';
  return 'poor';
}

interface DSSMicroProgressBarProps {
  score: number;
  primaryLabel?: string;
  subLabel?: string;
  showLevelTag?: boolean;
}

export const DSSMicroProgressBar: React.FC<DSSMicroProgressBarProps> = ({
  score,
  primaryLabel,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const barColor =
    clamped >= 80
      ? 'bg-[#2D7D46]'
      : clamped >= 60
      ? 'bg-[#D97706]'
      : 'bg-[#D93843]';

  return (
    <div className="inline-flex items-center justify-end gap-2.5">
      <div className="w-20 h-1.5 rounded-full bg-[#ECEFE9] overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-200`}
          style={{ width: `${Math.max(4, clamped)}%` }}
        />
      </div>
      <span className="w-9 text-right text-[13px] font-mono-num tabular-nums text-[#1E2421]">
        {primaryLabel ?? `${clamped}%`}
      </span>
    </div>
  );
};

/* ==========================================================================
   4. DSS STAFF CELL
   ========================================================================== */
interface DSSStaffCellProps {
  name: string;
  role: string;
  zone: string;
  avatarColor?: string;
}

export function getStaffInitials(fullName: string): string {
  const cleaned = fullName.replace(/^(ĐD\.|BS\.|KTV\.|CN\.)\s*/i, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const DSSStaffCell: React.FC<DSSStaffCellProps> = ({
  name,
  role,
  zone,
}) => {
  return (
    <div className="min-w-[180px]">
      <div className="text-[13px] font-semibold text-[#1E2421] leading-5 truncate">
        {name}
      </div>
      <div className="text-[12px] font-normal text-[#68746E] leading-4 truncate mt-0.5">
        {role} · {zone}
      </div>
    </div>
  );
};

/* ==========================================================================
   5. DSS SIDEBAR NAVIGATION ITEM
   ========================================================================== */
interface DSSSidebarItemProps {
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  active?: boolean;
  counter?: number;
  counterTone?: 'urgent' | 'default';
  onClick?: () => void;
}

export const DSSSidebarItem: React.FC<DSSSidebarItemProps> = ({
  icon,
  label,
  active = false,
  counter,
  counterTone = 'default',
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[8px] text-left transition-colors duration-150 cursor-pointer ${
        active
          ? 'bg-[#4B5850] text-white font-semibold shadow-xs'
          : 'bg-transparent text-[#4A5550] hover:bg-[#DDE1DA]/60 hover:text-[#1E2421]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0 flex items-center">{icon}</span>
        <span className="text-[13px] leading-[18px] truncate">{label}</span>
      </div>

      {typeof counter === 'number' && counter > 0 && (
        <span
          className={`font-mono-num text-[11px] leading-[14px] px-1.5 py-0.5 rounded-[4px] shrink-0 font-semibold ${
            counterTone === 'urgent'
              ? 'bg-[#D93843] text-white'
              : active
              ? 'bg-white text-[#4B5850]'
              : 'bg-[#DDE1DA] text-[#1E2421]'
          }`}
        >
          {counter}
        </span>
      )}
    </button>
  );
};
