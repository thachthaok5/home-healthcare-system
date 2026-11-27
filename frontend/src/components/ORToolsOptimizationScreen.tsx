import React, { useState } from 'react';
import { App as AntdApp, Button, Slider } from 'antd';
import {
  Cpu,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Activity,
  HeartHandshake,
  Play,
  Check,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  OptimizationResult,
  OptimizationWeights,
} from '../types/healthcare';

interface ORToolsOptimizationScreenProps {
  onApplySuccess: () => Promise<void>;
  onNavigateToGantt: () => void;
}

export const ORToolsOptimizationScreen: React.FC<ORToolsOptimizationScreenProps> = ({
  onApplySuccess,
  onNavigateToGantt,
}) => {
  const { message } = AntdApp.useApp();
  const [optData, setOptData] = useState<OptimizationResult | null>(null);
  const [loading] = useState<boolean>(false);
  const [solving, setSolving] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [weights, setWeights] = useState<OptimizationWeights>({
    travelWeight: 40,
    workloadBalanceWeight: 30,
    continuityWeight: 20,
    slaPenaltyWeight: 10,
  });

  const handleRunSolver = async () => {
    setSolving(true);
    try {
      const res = await fetch('/api/v1/coordinator/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_time_window: true, weights }),
      });
      if (res.ok) {
        const data: OptimizationResult = await res.json();
        setOptData(data);
        message.success(
          `Bộ giải OR-Tools kết thúc (${data.solverStatus}) trong ${data.solveTimeMs}ms · Điểm mục tiêu: ${data.objectiveValue}`
        );
      }
    } catch (err) {
      message.error('Lỗi khi chạy bộ giải tối ưu hóa trên Server.');
    } finally {
      setSolving(false);
    }
  };

  const handleApplySchedule = async () => {
    setApplying(true);
    try {
      const versionId = (optData as (OptimizationResult & { scheduleVersionId?: number }) | null)?.scheduleVersionId;
      if (!versionId) {
        message.warning('Chưa có phiên bản lịch OR-Tools để áp dụng.');
        return;
      }
      const res = await fetch('/api/v1/coordinator/optimize/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_version_id: versionId }),
      });
      if (res.ok) {
        setOptData((prev) => (prev ? { ...prev, isApplied: true } : prev));
        await onApplySuccess();
        message.success(
          'Đã áp dụng Lịch tối ưu vào Timeline/Gantt! Toàn bộ ca chờ hợp lệ đã được xếp lịch và loại bỏ xung đột giờ.'
        );
      }
    } catch (err) {
      message.error('Lỗi khi áp dụng lịch tối ưu vào hệ thống.');
    } finally {
      setApplying(false);
    }
  };

  if (loading || !optData) {
    return (
      <div className="bg-white border border-line-strong rounded-xl p-8 text-center text-xs text-muted space-y-3">
        <div>Chưa có kết quả tối ưu hóa cho ngày đang chọn. Bấm nút dưới để chạy OR-Tools CP-SAT trên dữ liệu PostgreSQL qua FastAPI.</div>
        <button
          type="button"
          onClick={handleRunSolver}
          disabled={solving}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60"
        >
          {solving ? 'Đang chạy bộ giải...' : 'Chạy bộ giải OR-Tools'}
        </button>
      </div>
    );
  }

  const { baselineMetrics, optimizedMetrics } = optData;
  const travelSavedMin = Math.max(
    0,
    baselineMetrics.totalTravelMinutes - optimizedMetrics.totalTravelMinutes
  );
  const travelSavedPct = Math.round(
    (travelSavedMin / Math.max(1, baselineMetrics.totalTravelMinutes)) * 100
  );

  return (
    <div className="space-y-5">
      {/* 1. COMPACT OPTIMIZATION SETUP & CONSTRAINT SUMMARY */}
      <div className="bg-white border border-line-strong rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <Cpu className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider">Tối Ưu Lịch Toàn Ngày (OR-Tools VRPTW + CP-SAT)</span>
              <span>·</span>
              <span className="px-2 py-0.5 rounded bg-line text-ink-soft font-mono-num">
                Trạng thái: {optData.solverStatus} ({optData.solveTimeMs}ms)
              </span>
              <span className="px-2 py-0.5 rounded bg-sun-50 text-sun-700 border border-sun-300/60 font-normal">
                Kết quả mô phỏng Prototype học thuật (Simulated Optimization)
              </span>
            </div>
            <h1 className="text-xl font-bold text-ink-soft mt-1">
              Tối Ưu Hóa Lịch Điều Phối Hàng Ngày & Đối Chiếu Trước / Sau
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Cân bằng đồng thời quãng đường di chuyển, độ lệch tải nhân sự, tính liên tục chăm sóc và khung giờ cam kết (SLA).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={handleRunSolver}
              loading={solving}
              className="border-subtle text-ink-soft hover:!bg-line/50 text-xs font-semibold flex items-center gap-1.5 h-9 px-3.5"
            >
              <Play className="w-3.5 h-3.5 text-muted" />
              <span>Chạy lại mô hình tối ưu</span>
            </Button>

            <Button
              type="primary"
              loading={applying}
              disabled={optData.isApplied}
              onClick={handleApplySchedule}
              className="bg-muted hover:!bg-ink-soft border-none text-xs font-semibold flex items-center gap-1.5 h-9 px-4"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {optData.isApplied
                  ? 'Đã áp dụng vào Lịch Gantt'
                  : 'Áp dụng Lịch Tối Ưu vào Gantt'}
              </span>
            </Button>
          </div>
        </div>

        {/* Compact Constraint Summary Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line text-xs">
          <span className="font-semibold text-ink-soft mr-1">Ràng buộc cứng (Hard Constraints):</span>
          <span className="px-2.5 py-1 rounded-md bg-canvas border border-line-strong text-ink-soft">
            1. Khớp kỹ năng & chứng chỉ y khoa
          </span>
          <span className="px-2.5 py-1 rounded-md bg-canvas border border-line-strong text-ink-soft">
            2. Tôn trọng khung giờ hẹn bệnh nhân
          </span>
          <span className="px-2.5 py-1 rounded-md bg-canvas border border-line-strong text-ink-soft">
            3. Giới hạn ca trực nhân viên
          </span>
          <span className="px-2.5 py-1 rounded-md bg-canvas border border-line-strong text-ink-soft">
            4. Không trùng lắp ca (Zero Overlap)
          </span>
          <span className="px-2.5 py-1 rounded-md bg-canvas border border-line-strong text-ink-soft">
            5. Đệm thời gian di chuyển thực tế
          </span>
        </div>

        {/* Multi-Objective Function Formula & Sliders */}
        <div className="p-4 rounded-xl bg-canvas border border-line-strong space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-ink-soft flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-muted" />
              <span>Trọng số hàm mục tiêu:</span>
              <code className="font-mono-num text-[11px] bg-white px-2.5 py-0.5 rounded border border-line-strong text-muted">
                Min Z = w1·TravelTime + w2·WorkloadStdDev - w3·Continuity + w4·SLAPenalty
              </code>
            </div>
            <div className="font-mono-num text-xs">
              Điểm hội tụ mô phỏng:{' '}
              <strong className="text-sm text-ink-soft bg-line border border-subtle/50 px-2.5 py-0.5 rounded">
                {optData.objectiveValue} / 100
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 text-xs">
            <div>
              <div className="flex justify-between font-medium text-ink-soft">
                <span>w1: Tối thiểu di chuyển</span>
                <span className="font-mono-num font-bold text-muted">{weights.travelWeight}%</span>
              </div>
              <Slider
                min={10}
                max={70}
                value={weights.travelWeight}
                onChange={(v) => setWeights({ ...weights, travelWeight: v })}
              />
            </div>
            <div>
              <div className="flex justify-between font-medium text-ink-soft">
                <span>w2: Cân bằng tải nhân sự</span>
                <span className="font-mono-num font-bold text-ink-soft">{weights.workloadBalanceWeight}%</span>
              </div>
              <Slider
                min={10}
                max={60}
                value={weights.workloadBalanceWeight}
                onChange={(v) => setWeights({ ...weights, workloadBalanceWeight: v })}
              />
            </div>
            <div>
              <div className="flex justify-between font-medium text-ink-soft">
                <span>w3: Ưu tiên Continuity</span>
                <span className="font-mono-num font-bold text-sun-700">{weights.continuityWeight}%</span>
              </div>
              <Slider
                min={5}
                max={50}
                value={weights.continuityWeight}
                onChange={(v) => setWeights({ ...weights, continuityWeight: v })}
              />
            </div>
            <div>
              <div className="flex justify-between font-medium text-ink-soft">
                <span>w4: Phạt trễ khung giờ SLA</span>
                <span className="font-mono-num font-bold text-high-ink">{weights.slaPenaltyWeight}%</span>
              </div>
              <Slider
                min={5}
                max={40}
                value={weights.slaPenaltyWeight}
                onChange={(v) => setWeights({ ...weights, slaPenaltyWeight: v })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. STRUCTURED RESULT PANELS: BASELINE VS OPTIMIZED */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Panel 1: Total Assigned Visits */}
        <div className="bg-white border border-line-strong rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold">Tổng Ca Đã Xếp Lịch</span>
            <span className="w-7 h-7 rounded-lg bg-line flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-muted" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-muted">
                Trước tối ưu: {baselineMetrics.totalAssigned} ca
              </div>
              <div className="text-lg font-bold text-ink-soft">
                Sau tối ưu: {optimizedMetrics.totalAssigned} ca
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-line text-ink-soft text-xs font-bold">
              SLA {optimizedMetrics.slaCompliancePct}%
            </span>
          </div>
        </div>

        {/* Panel 2: Unassigned Visits */}
        <div className="bg-white border border-line-strong rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold">Ca Chưa Phân Công</span>
            <span className="w-7 h-7 rounded-lg bg-sun-50 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-sun-700" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-muted">
                Trước tối ưu: {baselineMetrics.unassignedCount} ca chờ
              </div>
              <div className="text-lg font-bold text-sun-700">
                Sau tối ưu: {optimizedMetrics.unassignedCount} ngoại lệ
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-sun-50 text-sun-700 text-xs font-semibold">
              Cần duyệt tay
            </span>
          </div>
        </div>

        {/* Panel 3: Travel Improvement Summary */}
        <div className="bg-white border border-line-strong rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold">Thời Gian Di Chuyển</span>
            <span className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-ink-soft" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-muted line-through">
                Baseline: {baselineMetrics.totalTravelMinutes}p ({baselineMetrics.totalDistanceKm}km)
              </div>
              <div className="text-lg font-bold text-ink-soft">
                Tối ưu: {optimizedMetrics.totalTravelMinutes}p ({optimizedMetrics.totalDistanceKm}km)
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-line text-ink-soft text-xs font-bold">
              -{travelSavedPct}%
            </span>
          </div>
        </div>

        {/* Panel 4: Workload Improvement Summary */}
        <div className="bg-white border border-line-strong rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold">Độ Lệch Tải & Xung Đột</span>
            <span className="w-7 h-7 rounded-lg bg-high-tint flex items-center justify-center">
              <Activity className="w-4 h-4 text-high-ink" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-high-ink">
                Baseline: ±{baselineMetrics.workloadStdDevPct}% ({baselineMetrics.conflictCount} trùng)
              </div>
              <div className="text-lg font-bold text-muted">
                Tối ưu: ±{optimizedMetrics.workloadStdDevPct}% (0 trùng)
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-line text-ink-soft text-xs font-bold">
              Cân bằng
            </span>
          </div>
        </div>

        {/* Panel 5: Continuity Rate */}
        <div className="bg-white border border-line-strong rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold">Tỷ Lệ Liên Tục (Continuity)</span>
            <span className="w-7 h-7 rounded-lg bg-line flex items-center justify-center">
              <HeartHandshake className="w-4 h-4 text-muted" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-muted">
                Baseline: {baselineMetrics.continuityMatchRatePct}%
              </div>
              <div className="text-lg font-bold text-muted">
                Tối ưu: {optimizedMetrics.continuityMatchRatePct}%
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-line text-ink-soft text-xs font-bold">
              +{(optimizedMetrics.continuityMatchRatePct - baselineMetrics.continuityMatchRatePct).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. UNSCHEDULABLE / INFEASIBLE REQUESTS */}
      <div className="bg-white border border-high/60 rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-high" />
            <h2 className="text-sm font-bold text-high-ink">
              Ca Ngoại Lệ Chưa Thể Tự Động Xếp Lịch ({optData.unschedulableRequests.length} ca vi phạm ràng buộc cứng)
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-high-tint text-high-ink">
            Cần điều phối viên can thiệp thủ công
          </span>
        </div>

        <div className="space-y-2.5">
          {optData.unschedulableRequests.map((item) => (
            <div
              key={item.requestId}
              className="p-3.5 rounded-lg bg-canvas border border-line-strong text-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm text-ink-soft">
                  <span className="font-mono-num text-high-ink mr-2">{item.requestId}</span>
                  {item.patientName} — {item.serviceName}
                </div>
                <span className="font-mono-num font-semibold text-high-ink bg-high-tint px-2.5 py-0.5 rounded border border-high/40">
                  Khung giờ yêu cầu: {item.requestedWindow}
                </span>
              </div>
              <div className="text-high-ink">
                <strong>Nguyên nhân từ chối xếp tự động:</strong> {item.infeasibleReason}
              </div>
              <div className="text-sun-700 bg-sun-50 px-3 py-1.5 rounded border border-sun-300/50">
                <strong>Khuyến nghị điều phối:</strong> {item.suggestedResolution}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. DETAILED SCHEDULE DIFF TABLE: BASELINE VS OR-TOOLS */}
      <div className="bg-white border border-line-strong rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-canvas border-b border-line-strong flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink-soft flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-muted" />
              <span>Bảng Đối Chiếu Chi Tiết Từng Ca: Lịch Baseline vs Lịch Tối Ưu</span>
            </h2>
            <p className="text-[11px] text-muted">
              Hiển thị các ca được dịch chuyển giờ chống Overlap, tối ưu lộ trình và ghép mới từ hàng đợi chờ
            </p>
          </div>
          <Button
            size="small"
            onClick={onNavigateToGantt}
            className="text-xs font-medium text-muted border-subtle"
          >
            Mở Timeline Gantt →
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line-strong text-muted font-semibold text-[11px]">
                <th className="py-3 px-4">Mã ca / Bệnh nhân</th>
                <th className="py-3 px-4">Dịch vụ & Khu vực</th>
                <th className="py-3 px-4">Lịch Baseline (Trước tối ưu)</th>
                <th className="py-3 px-4">Lịch Đề Xuất (Sau tối ưu)</th>
                <th className="py-3 px-4 text-center">Di chuyển</th>
                <th className="py-3 px-4">Giải thích cải thiện lịch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {optData.scheduleComparison.map((row) => (
                <tr
                  key={row.assignmentId}
                  className={
                    row.baselineHasConflict
                      ? 'bg-high-tint/40 hover:bg-high-tint/60'
                      : row.isNewlyAssignedFromQueue
                      ? 'bg-line/40 hover:bg-line/60'
                      : 'hover:bg-canvas'
                  }
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-num font-bold text-muted">
                        {row.assignmentId}
                      </span>
                      {row.isNewlyAssignedFromQueue && (
                        <span className="px-1.5 py-0.2 rounded bg-muted text-white text-[10px] font-semibold">
                          Mới xếp
                        </span>
                      )}
                      {row.baselineHasConflict && (
                        <span className="px-1.5 py-0.2 rounded bg-high text-white text-[10px] font-semibold">
                          Xử lý trùng giờ
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-ink-soft mt-0.5">{row.patientName}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink-soft line-clamp-1">{row.serviceName}</div>
                    <div className="text-[11px] text-muted">{row.district}</div>
                  </td>

                  <td className="py-3 px-4 font-mono-num">
                    <div className="text-muted font-sans">{row.baselineStaffName}</div>
                    <div className={row.baselineHasConflict ? 'text-high-ink font-bold' : 'text-ink-soft'}>
                      {row.baselineTime}
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono-num">
                    <div className="font-bold text-ink-soft font-sans">{row.optimizedStaffName}</div>
                    <div className="font-bold text-muted">
                      {row.optimizedStartTime} – {row.optimizedEndTime}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center font-mono-num">
                    <span className="text-subtle line-through mr-1">{row.baselineTravelMin}p</span>
                    <span className="font-bold text-muted">{row.optimizedTravelMin}p</span>
                    <div className="text-[10px] text-muted">{row.optimizedDistanceKm} km</div>
                  </td>

                  <td className="py-3 px-4 text-[11px] text-ink-soft">
                    {row.improvementNote}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
