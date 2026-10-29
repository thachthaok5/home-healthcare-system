import React, { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState<boolean>(true);
  const [solving, setSolving] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [weights, setWeights] = useState<OptimizationWeights>({
    travelWeight: 40,
    workloadBalanceWeight: 30,
    continuityWeight: 20,
    slaPenaltyWeight: 10,
  });

  const fetchLatestOptimization = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/optimization/latest');
      if (res.ok) {
        const data: OptimizationResult = await res.json();
        setOptData(data);
        setWeights(data.weightsUsed);
      }
    } catch (err) {
      message.error('Không thể tải dữ liệu tối ưu hóa từ Backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestOptimization();
  }, []);

  const handleRunSolver = async () => {
    setSolving(true);
    try {
      const res = await fetch('/api/optimization/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
      if (res.ok) {
        const data: OptimizationResult = await res.json();
        setOptData(data);
        message.success(
          `Mô phỏng bộ giải OR-Tools đã hội tụ (${data.solverStatus}) trong ${data.solveTimeMs}ms · Điểm mục tiêu: ${data.objectiveValue}`
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
      const res = await fetch('/api/optimization/apply', {
        method: 'POST',
      });
      if (res.ok) {
        const result = await res.json();
        setOptData(result.optimization);
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
      <div className="bg-white border border-[#E2DED5] rounded-xl p-8 text-center text-xs text-[#687873]">
        Đang tải kết quả mô hình tối ưu hóa toàn ngày từ Backend API...
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
      <div className="bg-white border border-[#E2DED5] rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5A6E63]">
              <Cpu className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider">Tối Ưu Lịch Toàn Ngày (OR-Tools VRPTW + CP-SAT)</span>
              <span>·</span>
              <span className="px-2 py-0.5 rounded bg-[#E6ECE8] text-[#30433F] font-mono-num">
                Trạng thái: {optData.solverStatus} ({optData.solveTimeMs}ms)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F5EFE6] text-[#6B5335] border border-[#D4B995]/60 font-normal">
                Kết quả mô phỏng Prototype học thuật (Simulated Optimization)
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#30433F] mt-1">
              Tối Ưu Hóa Lịch Điều Phối Hàng Ngày & Đối Chiếu Trước / Sau
            </h1>
            <p className="text-xs text-[#687873] mt-0.5">
              Cân bằng đồng thời quãng đường di chuyển, độ lệch tải nhân sự, tính liên tục chăm sóc và khung giờ cam kết (SLA).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={handleRunSolver}
              loading={solving}
              className="border-[#879A8F] text-[#30433F] hover:!bg-[#E6ECE8]/50 text-xs font-semibold flex items-center gap-1.5 h-9 px-3.5"
            >
              <Play className="w-3.5 h-3.5 text-[#5A6E63]" />
              <span>Chạy lại mô hình tối ưu</span>
            </Button>

            <Button
              type="primary"
              loading={applying}
              disabled={optData.isApplied}
              onClick={handleApplySchedule}
              className="bg-[#5A6E63] hover:!bg-[#4B5D53] border-none text-xs font-semibold flex items-center gap-1.5 h-9 px-4"
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
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#ECE9E2] text-xs">
          <span className="font-semibold text-[#30433F] mr-1">Ràng buộc cứng (Hard Constraints):</span>
          <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E2DED5] text-[#30433F]">
            1. Khớp kỹ năng & chứng chỉ y khoa
          </span>
          <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E2DED5] text-[#30433F]">
            2. Tôn trọng khung giờ hẹn bệnh nhân
          </span>
          <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E2DED5] text-[#30433F]">
            3. Giới hạn ca trực nhân viên
          </span>
          <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E2DED5] text-[#30433F]">
            4. Không trùng lắp ca (Zero Overlap)
          </span>
          <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E2DED5] text-[#30433F]">
            5. Đệm thời gian di chuyển thực tế
          </span>
        </div>

        {/* Multi-Objective Function Formula & Sliders */}
        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2DED5] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-[#30433F] flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#5A6E63]" />
              <span>Trọng số hàm mục tiêu:</span>
              <code className="font-mono-num text-[11px] bg-white px-2.5 py-0.5 rounded border border-[#E2DED5] text-[#5A6E63]">
                Min Z = w1·TravelTime + w2·WorkloadStdDev - w3·Continuity + w4·SLAPenalty
              </code>
            </div>
            <div className="font-mono-num text-xs">
              Điểm hội tụ mô phỏng:{' '}
              <strong className="text-sm text-[#30433F] bg-[#E6ECE8] border border-[#879A8F]/50 px-2.5 py-0.5 rounded">
                {optData.objectiveValue} / 100
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 text-xs">
            <div>
              <div className="flex justify-between font-medium text-[#30433F]">
                <span>w1: Tối thiểu di chuyển</span>
                <span className="font-mono-num font-bold text-[#5A6E63]">{weights.travelWeight}%</span>
              </div>
              <Slider
                min={10}
                max={70}
                value={weights.travelWeight}
                onChange={(v) => setWeights({ ...weights, travelWeight: v })}
              />
            </div>
            <div>
              <div className="flex justify-between font-medium text-[#30433F]">
                <span>w2: Cân bằng tải nhân sự</span>
                <span className="font-mono-num font-bold text-[#3A525D]">{weights.workloadBalanceWeight}%</span>
              </div>
              <Slider
                min={10}
                max={60}
                value={weights.workloadBalanceWeight}
                onChange={(v) => setWeights({ ...weights, workloadBalanceWeight: v })}
              />
            </div>
            <div>
              <div className="flex justify-between font-medium text-[#30433F]">
                <span>w3: Ưu tiên Continuity</span>
                <span className="font-mono-num font-bold text-[#6B5335]">{weights.continuityWeight}%</span>
              </div>
              <Slider
                min={5}
                max={50}
                value={weights.continuityWeight}
                onChange={(v) => setWeights({ ...weights, continuityWeight: v })}
              />
            </div>
            <div>
              <div className="flex justify-between font-medium text-[#30433F]">
                <span>w4: Phạt trễ khung giờ SLA</span>
                <span className="font-mono-num font-bold text-[#7D4532]">{weights.slaPenaltyWeight}%</span>
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
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Tổng Ca Đã Xếp Lịch</span>
            <span className="w-7 h-7 rounded-lg bg-[#E6ECE8] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#5A6E63]" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-[#687873]">
                Trước tối ưu: {baselineMetrics.totalAssigned} ca
              </div>
              <div className="text-lg font-bold text-[#30433F]">
                Sau tối ưu: {optimizedMetrics.totalAssigned} ca
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#E6ECE8] text-[#30433F] text-xs font-bold">
              SLA {optimizedMetrics.slaCompliancePct}%
            </span>
          </div>
        </div>

        {/* Panel 2: Unassigned Visits */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Ca Chưa Phân Công</span>
            <span className="w-7 h-7 rounded-lg bg-[#F5EFE6] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#6B5335]" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-[#687873]">
                Trước tối ưu: {baselineMetrics.unassignedCount} ca chờ
              </div>
              <div className="text-lg font-bold text-[#6B5335]">
                Sau tối ưu: {optimizedMetrics.unassignedCount} ngoại lệ
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#F5EFE6] text-[#6B5335] text-xs font-semibold">
              Cần duyệt tay
            </span>
          </div>
        </div>

        {/* Panel 3: Travel Improvement Summary */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Thời Gian Di Chuyển</span>
            <span className="w-7 h-7 rounded-lg bg-[#E9F0F2] flex items-center justify-center">
              <Navigation className="w-4 h-4 text-[#3A525D]" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-[#687873] line-through">
                Baseline: {baselineMetrics.totalTravelMinutes}p ({baselineMetrics.totalDistanceKm}km)
              </div>
              <div className="text-lg font-bold text-[#3A525D]">
                Tối ưu: {optimizedMetrics.totalTravelMinutes}p ({optimizedMetrics.totalDistanceKm}km)
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#E6ECE8] text-[#30433F] text-xs font-bold">
              -{travelSavedPct}%
            </span>
          </div>
        </div>

        {/* Panel 4: Workload Improvement Summary */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Độ Lệch Tải & Xung Đột</span>
            <span className="w-7 h-7 rounded-lg bg-[#F6EBE7] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#7D4532]" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-[#7D4532]">
                Baseline: ±{baselineMetrics.workloadStdDevPct}% ({baselineMetrics.conflictCount} trùng)
              </div>
              <div className="text-lg font-bold text-[#5A6E63]">
                Tối ưu: ±{optimizedMetrics.workloadStdDevPct}% (0 trùng)
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#E6ECE8] text-[#30433F] text-xs font-bold">
              Cân bằng
            </span>
          </div>
        </div>

        {/* Panel 5: Continuity Rate */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Tỷ Lệ Liên Tục (Continuity)</span>
            <span className="w-7 h-7 rounded-lg bg-[#E6ECE8] flex items-center justify-center">
              <HeartHandshake className="w-4 h-4 text-[#5A6E63]" />
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono-num">
            <div>
              <div className="text-[11px] text-[#687873]">
                Baseline: {baselineMetrics.continuityMatchRatePct}%
              </div>
              <div className="text-lg font-bold text-[#5A6E63]">
                Tối ưu: {optimizedMetrics.continuityMatchRatePct}%
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#E6ECE8] text-[#30433F] text-xs font-bold">
              +{(optimizedMetrics.continuityMatchRatePct - baselineMetrics.continuityMatchRatePct).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. UNSCHEDULABLE / INFEASIBLE REQUESTS */}
      <div className="bg-white border border-[#C68F7B]/60 rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#ECE9E2] pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C68F7B]" />
            <h2 className="text-sm font-bold text-[#7D4532]">
              Ca Ngoại Lệ Chưa Thể Tự Động Xếp Lịch ({optData.unschedulableRequests.length} ca vi phạm ràng buộc cứng)
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#F6EBE7] text-[#7D4532]">
            Cần điều phối viên can thiệp thủ công
          </span>
        </div>

        <div className="space-y-2.5">
          {optData.unschedulableRequests.map((item) => (
            <div
              key={item.requestId}
              className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2DED5] text-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm text-[#30433F]">
                  <span className="font-mono-num text-[#7D4532] mr-2">{item.requestId}</span>
                  {item.patientName} — {item.serviceName}
                </div>
                <span className="font-mono-num font-semibold text-[#7D4532] bg-[#F6EBE7] px-2.5 py-0.5 rounded border border-[#C68F7B]/40">
                  Khung giờ yêu cầu: {item.requestedWindow}
                </span>
              </div>
              <div className="text-[#7D4532]">
                <strong>Nguyên nhân từ chối xếp tự động:</strong> {item.infeasibleReason}
              </div>
              <div className="text-[#6B5335] bg-[#F5EFE6] px-3 py-1.5 rounded border border-[#D4B995]/50">
                <strong>Khuyến nghị điều phối:</strong> {item.suggestedResolution}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. DETAILED SCHEDULE DIFF TABLE: BASELINE VS OR-TOOLS */}
      <div className="bg-white border border-[#E2DED5] rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-[#E2DED5] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#30433F] flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#5A6E63]" />
              <span>Bảng Đối Chiếu Chi Tiết Từng Ca: Lịch Baseline vs Lịch Tối Ưu</span>
            </h2>
            <p className="text-[11px] text-[#687873]">
              Hiển thị các ca được dịch chuyển giờ chống Overlap, tối ưu lộ trình và ghép mới từ hàng đợi chờ
            </p>
          </div>
          <Button
            size="small"
            onClick={onNavigateToGantt}
            className="text-xs font-medium text-[#5A6E63] border-[#879A8F]"
          >
            Mở Timeline Gantt →
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E2DED5] text-[#687873] font-semibold text-[11px]">
                <th className="py-3 px-4">Mã ca / Bệnh nhân</th>
                <th className="py-3 px-4">Dịch vụ & Khu vực</th>
                <th className="py-3 px-4">Lịch Baseline (Trước tối ưu)</th>
                <th className="py-3 px-4">Lịch Đề Xuất (Sau tối ưu)</th>
                <th className="py-3 px-4 text-center">Di chuyển</th>
                <th className="py-3 px-4">Giải thích cải thiện lịch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE9E2]">
              {optData.scheduleComparison.map((row) => (
                <tr
                  key={row.assignmentId}
                  className={
                    row.baselineHasConflict
                      ? 'bg-[#F6EBE7]/40 hover:bg-[#F6EBE7]/60'
                      : row.isNewlyAssignedFromQueue
                      ? 'bg-[#E6ECE8]/40 hover:bg-[#E6ECE8]/60'
                      : 'hover:bg-[#FAF8F5]'
                  }
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-num font-bold text-[#5A6E63]">
                        {row.assignmentId}
                      </span>
                      {row.isNewlyAssignedFromQueue && (
                        <span className="px-1.5 py-0.2 rounded bg-[#5A6E63] text-white text-[10px] font-semibold">
                          Mới xếp
                        </span>
                      )}
                      {row.baselineHasConflict && (
                        <span className="px-1.5 py-0.2 rounded bg-[#C68F7B] text-white text-[10px] font-semibold">
                          Xử lý trùng giờ
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-[#30433F] mt-0.5">{row.patientName}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#30433F] line-clamp-1">{row.serviceName}</div>
                    <div className="text-[11px] text-[#687873]">{row.district}</div>
                  </td>

                  <td className="py-3 px-4 font-mono-num">
                    <div className="text-[#687873] font-sans">{row.baselineStaffName}</div>
                    <div className={row.baselineHasConflict ? 'text-[#7D4532] font-bold' : 'text-[#30433F]'}>
                      {row.baselineTime}
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono-num">
                    <div className="font-bold text-[#30433F] font-sans">{row.optimizedStaffName}</div>
                    <div className="font-bold text-[#5A6E63]">
                      {row.optimizedStartTime} – {row.optimizedEndTime}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center font-mono-num">
                    <span className="text-[#8E9B96] line-through mr-1">{row.baselineTravelMin}p</span>
                    <span className="font-bold text-[#5A6E63]">{row.optimizedTravelMin}p</span>
                    <div className="text-[10px] text-[#687873]">{row.optimizedDistanceKm} km</div>
                  </td>

                  <td className="py-3 px-4 text-[11px] text-[#30433F]">
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
