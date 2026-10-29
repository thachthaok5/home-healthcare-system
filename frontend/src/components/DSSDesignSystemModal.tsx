import React, { useState } from 'react';
import { Modal } from 'antd';
import {
  Calendar,
  Map,
  Route,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Clock,
  Users,
  ShieldAlert,
  Info,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  DSSButton,
  DSSBadge,
  DSSMicroProgressBar,
  DSSStaffCell,
  DSSSidebarItem,
} from './dss/DSSComponents';

interface DSSDesignSystemModalProps {
  open: boolean;
  onClose: () => void;
}

export const DSSDesignSystemModal: React.FC<DSSDesignSystemModalProps> = ({
  open,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'tokens' | 'components' | 'table-viz'
  >('tokens');
  const [sampleExplainOpen, setSampleExplainOpen] = useState<boolean>(false);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1080}
      title={
        <div className="flex flex-wrap items-center justify-between gap-4 pr-6 pb-2 border-b border-[#DCE0DC]">
          <div>
            <div className="dss-caption text-[#5A6E63] uppercase">
              B2B Healthcare Decision Support System · UI/UX Specification
            </div>
            <div className="dss-h1 mt-0.5">
              Hệ Quy Chuẩn Design Tokens, UI Components & Multi-Criteria Data Viz
            </div>
          </div>

          {/* Segmented Spec Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F5F4F0] border border-[#DCE0DC]">
            <button
              type="button"
              onClick={() => setActiveTab('tokens')}
              className={`px-3 py-1.5 rounded-md dss-caption transition-colors cursor-pointer ${
                activeTab === 'tokens'
                  ? 'bg-[#2C3E38] text-white'
                  : 'text-[#41524D] hover:text-[#1F2D29]'
              }`}
            >
              1. Design Tokens & Typography
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('components')}
              className={`px-3 py-1.5 rounded-md dss-caption transition-colors cursor-pointer ${
                activeTab === 'components'
                  ? 'bg-[#2C3E38] text-white'
                  : 'text-[#41524D] hover:text-[#1F2D29]'
              }`}
            >
              2. Core UI Components
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table-viz')}
              className={`px-3 py-1.5 rounded-md dss-caption transition-colors cursor-pointer ${
                activeTab === 'table-viz'
                  ? 'bg-[#2C3E38] text-white'
                  : 'text-[#41524D] hover:text-[#1F2D29]'
              }`}
            >
              3. DSS Table, Data Viz & Icons (1.5px)
            </button>
          </div>
        </div>
      }
    >
      <div className="pt-3 space-y-6 max-h-[76vh] overflow-y-auto pr-1 text-[#1F2D29]">
        {/* ====================================================================
            TAB 1: DESIGN TOKENS (COLOR PALETTE & TYPOGRAPHY SCALE)
            ==================================================================== */}
        {activeTab === 'tokens' && (
          <div className="space-y-6">
            {/* Color Palette Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="dss-h2">
                  1.1. Bảng Màu Hệ Thống (Color Palette Tokens — Chuẩn tương phản WCAG AA/AAA)
                </h3>
                <span className="dss-body2">
                  Phân bổ 60% Surface · 30% Neutral/Primary Structure · 10% Semantic Status
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Group 1: Primary (Dark Moss / Slate Sage) */}
                <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-[#DCE0DC] space-y-2.5">
                  <div className="dss-caption text-[#2C3E38] uppercase">
                    Primary · Xám Rêu Tối Chủ Đạo
                  </div>
                  <div className="space-y-1.5 font-mono-num text-[11px]">
                    <div className="flex items-center justify-between p-2 rounded bg-[#2C3E38] text-white">
                      <span>--dss-primary-900</span>
                      <span>#2C3E38 (11.4:1)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#3D524A] text-white">
                      <span>--dss-primary-700</span>
                      <span>#3D524A (8.3:1)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#5A6E63] text-white">
                      <span>--dss-primary-500</span>
                      <span>#5A6E63 (5.4:1)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#E6ECE8] text-[#1F2D29] border border-[#879A8F]/40">
                      <span>--dss-primary-100</span>
                      <span>#E6ECE8 (Tint)</span>
                    </div>
                  </div>
                </div>

                {/* Group 2: Semantic (Success, Warning, Danger) */}
                <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-[#DCE0DC] space-y-2.5">
                  <div className="dss-caption text-[#23533A] uppercase">
                    Semantic · Tối Ưu & Cảnh Báo Lịch
                  </div>
                  <div className="space-y-1.5 font-mono-num text-[11px]">
                    <div className="p-2 rounded bg-[#E4F0E9] text-[#23533A] border border-[#B5D3C2]">
                      <div className="flex justify-between font-semibold">
                        <span>Success (Tối ưu ≥80%)</span>
                        <span>8.2:1 AAA</span>
                      </div>
                      <div className="text-[10px] opacity-85">
                        Text #23533A · Bar #3B7A57 · Bg #E4F0E9
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#F7EFE2] text-[#6E4B1F] border border-[#E3CCA8]">
                      <div className="flex justify-between font-semibold">
                        <span>Warning (Tải 60–79%)</span>
                        <span>7.1:1 AAA</span>
                      </div>
                      <div className="text-[10px] opacity-85">
                        Text #6E4B1F · Bar #C48F3F · Bg #F7EFE2
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#F8EAE7] text-[#7A2E22] border border-[#E4BEB6]">
                      <div className="flex justify-between font-semibold">
                        <span>Danger (Xung đột &lt;60%)</span>
                        <span>7.6:1 AAA</span>
                      </div>
                      <div className="text-[10px] opacity-85">
                        Text #7A2E22 · Bar #B85442 · Bg #F8EAE7
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 3: Neutral (Text & Hairline Borders) */}
                <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-[#DCE0DC] space-y-2.5">
                  <div className="dss-caption text-[#41524D] uppercase">
                    Neutral · Phân Cấp Chữ & Đường Viền
                  </div>
                  <div className="space-y-1.5 font-mono-num text-[11px]">
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-[#DCE0DC] text-[#1F2D29]">
                      <span className="font-bold">Neutral 900 (Chính)</span>
                      <span>#1F2D29 (13.8:1)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-[#DCE0DC] text-[#41524D]">
                      <span className="font-medium">Neutral 700 (Phụ)</span>
                      <span>#41524D (7.9:1)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-[#DCE0DC] text-[#5D6E68]">
                      <span>Neutral 500 (Muted)</span>
                      <span>#5D6E68 (5.1:1)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#FAF9F6] border border-[#DCE0DC] text-[#8A9994]">
                      <span>Neutral 200 (Border)</span>
                      <span>#DCE0DC (1px)</span>
                    </div>
                  </div>
                </div>

                {/* Group 4: Surface Hierarchy */}
                <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-[#DCE0DC] space-y-2.5">
                  <div className="dss-caption text-[#41524D] uppercase">
                    Surface · Phân Lớp Nền Giao Diện
                  </div>
                  <div className="space-y-1.5 font-mono-num text-[11px]">
                    <div className="flex items-center justify-between p-2 rounded bg-[#F5F4F0] border border-[#DCE0DC] text-[#1F2D29]">
                      <span>L0 · Canvas Nền</span>
                      <span>#F5F4F0</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#EAEFE9] border border-[#D8E0D9] text-[#1F2D29]">
                      <span>L1 · Sidebar Rêu Nhạt</span>
                      <span>#EAEFE9</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#FAF9F6] border border-[#DCE0DC] text-[#1F2D29]">
                      <span>L2 · Table Header</span>
                      <span>#FAF9F6</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-white border border-[#DCE0DC] text-[#1F2D29] shadow-[0_8px_20px_-4px_rgba(31,45,41,0.12)]">
                      <span>L3/L4 · Card & Elevated</span>
                      <span>#FFFFFF</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Typography Scale Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="dss-h2">
                  1.2. Thang Đo Typography Mật Độ Dữ Liệu Cao (High-Density B2B DSS Type Scale)
                </h3>
                <span className="dss-body2">
                  Primary Sans: Plus Jakarta Sans · Numeric Telemetry: JetBrains Mono (tabular-nums)
                </span>
              </div>

              <div className="border border-[#DCE0DC] rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#DCE0DC] dss-caption text-[#5D6E68]">
                      <th className="py-2.5 px-4">Cấp độ (Token)</th>
                      <th className="py-2.5 px-4">Size / Weight / Line-Height</th>
                      <th className="py-2.5 px-4">Độ tương phản WCAG</th>
                      <th className="py-2.5 px-4">Minh họa hiển thị thực tế trong hệ thống DSS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBECE8]">
                    <tr>
                      <td className="py-3 px-4 font-mono-num dss-caption text-[#2C3E38]">
                        H1 · Page Header
                      </td>
                      <td className="py-3 px-4 font-mono-num dss-body2">
                        20px · Bold (700) · LH 28px (-0.015em)
                      </td>
                      <td className="py-3 px-4">
                        <DSSBadge tone="optimal">13.8:1 (AAA)</DSSBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="dss-h1">
                          Đề Xuất Nhân Sự & Xếp Hạng Đa Tiêu Chí
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4 font-mono-num dss-caption text-[#2C3E38]">
                        H2 · Section Title
                      </td>
                      <td className="py-3 px-4 font-mono-num dss-body2">
                        15px · SemiBold (600) · LH 22px (-0.01em)
                      </td>
                      <td className="py-3 px-4">
                        <DSSBadge tone="optimal">13.8:1 (AAA)</DSSBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="dss-h2">
                          Bảng Xếp Hạng Ứng Viên Nhân Sự Y Tế (6 ứng viên)
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4 font-mono-num dss-caption text-[#2C3E38]">
                        Body 1 · Primary Data
                      </td>
                      <td className="py-3 px-4 font-mono-num dss-body2">
                        13px · Medium/Semi (500) · LH 18px
                      </td>
                      <td className="py-3 px-4">
                        <DSSBadge tone="optimal">13.8:1 (AAA)</DSSBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="dss-body1 font-semibold">
                          ĐD. Nguyễn Thị Minh Tâm — Thay băng vết thương phức tạp & Hút dịch
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4 font-mono-num dss-caption text-[#2C3E38]">
                        Body 2 · Secondary Param
                      </td>
                      <td className="py-3 px-4 font-mono-num dss-body2">
                        12px · Regular (400) · LH 16px
                      </td>
                      <td className="py-3 px-4">
                        <DSSBadge tone="eligible">5.1:1 (AA)</DSSBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="dss-body2">
                          Điều dưỡng Trưởng · Quận 3 · Khoảng cách 1.8 km (~7 phút di chuyển)
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4 font-mono-num dss-caption text-[#2C3E38]">
                        Caption · Badge & Header
                      </td>
                      <td className="py-3 px-4 font-mono-num dss-body2">
                        11px · SemiBold (600) · LH 14px (+0.02em)
                      </td>
                      <td className="py-3 px-4">
                        <DSSBadge tone="optimal">7.6:1+ (AAA)</DSSBadge>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <DSSBadge tone="optimal">Đủ điều kiện</DSSBadge>
                        <DSSBadge tone="urgent">Khẩn cấp</DSSBadge>
                        <DSSBadge tone="warning">Cảnh báo tải</DSSBadge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: CORE UI COMPONENTS (BUTTONS, BADGES, SIDEBAR NAVIGATION)
            ==================================================================== */}
        {activeTab === 'components' && (
          <div className="space-y-6">
            {/* 2.1 Buttons Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="dss-h2">
                  2.1. Hệ Thống Buttons (3 Biến Thể Solid, Outline, Ghost × 4 Trạng Thái)
                </h3>
                <span className="dss-body2">
                  Auto Layout (`inline-flex items-center gap-1.5`), không dùng drop-shadow
                </span>
              </div>

              <div className="border border-[#DCE0DC] rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#DCE0DC] dss-caption text-[#5D6E68]">
                      <th className="py-2.5 px-4">Biến thể (Variant)</th>
                      <th className="py-2.5 px-4">Default</th>
                      <th className="py-2.5 px-4">Hover</th>
                      <th className="py-2.5 px-4">Active / Pressed</th>
                      <th className="py-2.5 px-4">Disabled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBECE8]">
                    <tr>
                      <td className="py-3.5 px-4">
                        <div className="dss-body1 font-semibold">Solid (Primary CTA)</div>
                        <div className="dss-body2">Xác nhận điều phối / Chốt lịch</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="solid"
                          forceState="default"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Chốt phân công
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="solid"
                          forceState="hover"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Chốt phân công
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="solid"
                          forceState="active"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Chốt phân công
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="solid"
                          forceState="disabled"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Chốt phân công
                        </DSSButton>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3.5 px-4">
                        <div className="dss-body1 font-semibold">Outline (Secondary Action)</div>
                        <div className="dss-body2">Giải thích thuật toán / Bộ lọc</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="outline"
                          forceState="default"
                          icon={<Info className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Giải thích
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="outline"
                          forceState="hover"
                          icon={<Info className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Giải thích
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="outline"
                          forceState="active"
                          icon={<Info className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Giải thích
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="outline"
                          forceState="disabled"
                          icon={<Info className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Giải thích
                        </DSSButton>
                      </td>
                    </tr>

                    <tr>
                      <td className="py-3.5 px-4">
                        <div className="dss-body1 font-semibold">Ghost (Tertiary / Utility)</div>
                        <div className="dss-body2">Thao tác phụ trong bảng / Khôi phục</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="ghost"
                          forceState="default"
                          icon={<SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Cấu hình DSS
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="ghost"
                          forceState="hover"
                          icon={<SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Cấu hình DSS
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="ghost"
                          forceState="active"
                          icon={<SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Cấu hình DSS
                        </DSSButton>
                      </td>
                      <td className="py-3.5 px-4">
                        <DSSButton
                          variant="ghost"
                          forceState="disabled"
                          icon={<SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                          Cấu hình DSS
                        </DSSButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2.2 Badges / Tags & 2.3 Navigation Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Badges / Tags */}
              <div className="p-4 rounded-lg bg-white border border-[#DCE0DC] space-y-3">
                <h3 className="dss-h2">
                  2.2. Nhãn Trạng Thái (Semantic Badges / Tags)
                </h3>
                <p className="dss-body2">
                  Padding nhỏ gọn (<code>px-2 py-0.5</code>), kết hợp nền nhạt và chữ đậm đạt chuẩn tương phản WCAG AAA.
                </p>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <DSSBadge
                    tone="urgent"
                    icon={<AlertTriangle className="w-3 h-3" strokeWidth={1.5} />}
                  >
                    Khẩn cấp
                  </DSSBadge>
                  <DSSBadge
                    tone="optimal"
                    icon={<CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />}
                  >
                    Đủ điều kiện
                  </DSSBadge>
                  <DSSBadge
                    tone="optimal"
                    icon={<Sparkles className="w-3 h-3" strokeWidth={1.5} />}
                  >
                    Đề xuất #1 (Tối ưu)
                  </DSSBadge>
                  <DSSBadge tone="eligible">Hạng #2 · Khả thi</DSSBadge>
                  <DSSBadge tone="warning">Cảnh báo tải (78%)</DSSBadge>
                  <DSSBadge tone="urgent">Xung đột lịch 15p</DSSBadge>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="p-4 rounded-lg bg-[#EAEFE9] border border-[#D8E0D9] space-y-3">
                <h3 className="dss-h2">
                  2.3. Sidebar Navigation Items & Notification Counter
                </h3>
                <p className="dss-body2">
                  Phân cấp rõ trạng thái <strong>Active</strong> (nền rêu đậm + viền mảnh) và <strong>Default</strong>, tích hợp bộ đếm thông báo, không dùng drop-shadow.
                </p>
                <div className="space-y-1.5 max-w-xs">
                  <DSSSidebarItem
                    active={true}
                    icon={<Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    label="AI Recommendation & DSS"
                    subLabel="Trạng thái Active đang chọn"
                    counter={4}
                    counterTone="urgent"
                  />
                  <DSSSidebarItem
                    active={false}
                    icon={<Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    label="Dispatch Board (Gantt)"
                    subLabel="Trạng thái Default mặc định"
                    counter={1}
                    counterTone="default"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: MULTI-CRITERIA DATA TABLE, MICRO PROGRESS BAR & 1.5PX ICONS
            ==================================================================== */}
        {activeTab === 'table-viz' && (
          <div className="space-y-6">
            {/* 3.1 Micro In-Cell Progress Bar Rules & 1.5px Line Iconography */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white border border-[#DCE0DC] space-y-3">
                <h3 className="dss-h2">
                  3.1. In-Cell Micro Progress Bar (3 Ngưỡng Màu Ngữ Nghĩa)
                </h3>
                <p className="dss-body2">
                  Đặt trực tiếp trong ô bảng dữ liệu (chiều cao 6px, rộng 84px) kèm số liệu <code>tabular-nums</code>:
                </p>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 rounded bg-[#FAF9F6] border border-[#DCE0DC]">
                    <div className="dss-caption text-[#23533A] mb-1.5">
                      1. Tốt (80% – 100%)
                    </div>
                    <DSSMicroProgressBar
                      score={96}
                      primaryLabel="96/100"
                      showLevelTag={true}
                    />
                  </div>
                  <div className="p-2.5 rounded bg-[#FAF9F6] border border-[#DCE0DC]">
                    <div className="dss-caption text-[#6E4B1F] mb-1.5">
                      2. Cảnh báo (60% – 79%)
                    </div>
                    <DSSMicroProgressBar
                      score={68}
                      primaryLabel="68/100"
                      showLevelTag={true}
                    />
                  </div>
                  <div className="p-2.5 rounded bg-[#FAF9F6] border border-[#DCE0DC]">
                    <div className="dss-caption text-[#7A2E22] mb-1.5">
                      3. Kém (&lt; 60%)
                    </div>
                    <DSSMicroProgressBar
                      score={35}
                      primaryLabel="35/100"
                      showLevelTag={true}
                    />
                  </div>
                </div>
              </div>

              {/* 3.2 Line Iconography 1.5px */}
              <div className="p-4 rounded-lg bg-white border border-[#DCE0DC] space-y-3">
                <h3 className="dss-h2">
                  3.2. Hệ Thống Iconography Line (Stroke 1.5px Đồng Nhất)
                </h3>
                <p className="dss-body2">
                  Đường nét mảnh <code>strokeWidth={1.5}</code>, bo góc mềm mại (<code>round</code>) cho giao diện y tế chuyên nghiệp:
                </p>
                <div className="grid grid-cols-4 gap-2.5 pt-1">
                  {[
                    { icon: <Calendar className="w-4 h-4" strokeWidth={1.5} />, name: 'Lịch biểu' },
                    { icon: <Map className="w-4 h-4" strokeWidth={1.5} />, name: 'Bản đồ GIS' },
                    { icon: <Route className="w-4 h-4" strokeWidth={1.5} />, name: 'Tuyến đường' },
                    { icon: <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />, name: 'Cảnh báo' },
                    { icon: <Users className="w-4 h-4" strokeWidth={1.5} />, name: 'Nhân sự Y tế' },
                    { icon: <Clock className="w-4 h-4" strokeWidth={1.5} />, name: 'Thời lượng' },
                    { icon: <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />, name: 'Trọng số DSS' },
                    { icon: <Layers className="w-4 h-4" strokeWidth={1.5} />, name: 'Phân lớp ca' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[#FAF9F6] border border-[#DCE0DC] flex items-center gap-2 text-[#1F2D29]"
                    >
                      <span className="text-[#2C3E38] shrink-0">{item.icon}</span>
                      <span className="text-[11px] font-medium truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3.3 Multi-Criteria Ranking Data Table Specimen with Progressive Disclosure */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="dss-h2">
                  3.3. Cấu Trúc Multi-Criteria DSS Data Table & Progressive Disclosure (&ldquo;Giải thích&rdquo;)
                </h3>
                <span className="dss-body2">
                  Nhấn nút &ldquo;Giải thích&rdquo; ở cột cuối để kiểm tra cơ chế ẩn/hiện thông tin lũy tiến
                </span>
              </div>

              <div className="border border-[#DCE0DC] rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#DCE0DC] dss-caption text-[#5D6E68]">
                      <th className="py-2.5 px-3.5">Trạng thái</th>
                      <th className="py-2.5 px-3.5">Nhân sự Y tế</th>
                      <th className="py-2.5 px-3">SkillFit</th>
                      <th className="py-2.5 px-3">TimeFit</th>
                      <th className="py-2.5 px-3">Distance</th>
                      <th className="py-2.5 px-3">Workload</th>
                      <th className="py-2.5 px-3">Continuity</th>
                      <th className="py-2.5 px-3.5 text-right">Tổng điểm DSS</th>
                      <th className="py-2.5 px-3.5 text-right">Giải thích</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EBECE8]">
                    <tr className="hover:bg-[#FAF9F6]">
                      <td className="py-3 px-3.5">
                        <DSSBadge
                          tone="optimal"
                          icon={<CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />}
                        >
                          Đủ điều kiện · #1
                        </DSSBadge>
                      </td>
                      <td className="py-3 px-3.5">
                        <DSSStaffCell
                          name="ĐD. Nguyễn Thị Minh Tâm"
                          role="Điều dưỡng Trưởng"
                          zone="Quận 3"
                          avatarColor="#5A6E63"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <DSSMicroProgressBar score={98} primaryLabel="98%" subLabel="3/3 kỹ năng" />
                      </td>
                      <td className="py-3 px-3">
                        <DSSMicroProgressBar score={95} primaryLabel="95%" subLabel="Trống 110p" />
                      </td>
                      <td className="py-3 px-3">
                        <DSSMicroProgressBar score={90} primaryLabel="1.8 km" subLabel="~7 phút" />
                      </td>
                      <td className="py-3 px-3">
                        <DSSMicroProgressBar score={74} primaryLabel="74 điểm" subLabel="Tải 62%→74%" />
                      </td>
                      <td className="py-3 px-3">
                        <DSSMicroProgressBar score={92} primaryLabel="92%" subLabel="4 lần khám" />
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono-num">
                        <span className="text-[14px] font-bold text-[#23533A]">92.4</span>
                        <span className="dss-body2 block">Dự báo 52p</span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <DSSButton
                          variant="outline"
                          size="xs"
                          icon={<Info className="w-3.5 h-3.5" strokeWidth={1.5} />}
                          onClick={() => setSampleExplainOpen(!sampleExplainOpen)}
                        >
                          Giải thích
                        </DSSButton>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {sampleExplainOpen && (
                  <div className="p-4 bg-[#FAF9F6] border-t border-[#DCE0DC] flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="dss-body1 font-semibold text-[#23533A]">
                        Giải thích thuật toán đa tiêu chí (Progressive Disclosure Layer):
                      </div>
                      <div className="dss-body2 text-[#41524D]">
                        Điểm tổng hợp = <code>0.30×98 (SkillFit) + 0.25×95 (TimeFit) + 0.20×90 (Distance) + 0.15×74 (Workload) + 0.10×92 (Continuity) = 92.4 điểm</code>. Nhân sự có chứng chỉ chăm sóc vết thương phức tạp, cách nhà bệnh nhân 1.8km và đã trực tiếp chăm sóc bệnh nhân 4 lần trước đó.
                      </div>
                    </div>
                    <DSSButton
                      variant="ghost"
                      size="xs"
                      onClick={() => setSampleExplainOpen(false)}
                    >
                      Đóng
                    </DSSButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
