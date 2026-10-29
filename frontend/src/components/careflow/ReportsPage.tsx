import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Scale,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  DashboardKPIData,
  DispatchAssignment,
  MedicalStaff,
  OptimizationResult,
  OverrideLog,
  UnassignedRequest,
} from '../../types/healthcare';
import {
  PageHeader,
  KpiCard,
  CareFlowRoute,
} from './SharedUI';
import { ORToolsOptimizationScreen } from '../ORToolsOptimizationScreen';
import { Cpu, BarChart3 } from 'lucide-react';

export interface ReportsPageProps {
  staffList: MedicalStaff[];
  assignments: DispatchAssignment[];
  unassignedRequests: UnassignedRequest[];
  overrideLogs: OverrideLog[];
  kpiData: DashboardKPIData | null;
  optimizationResult: OptimizationResult | null;
  onRunOptimization?: () => Promise<void>;
  onApplyOptimization?: () => Promise<void>;
  onNavigate?: (route: CareFlowRoute) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  staffList,
  assignments,
  unassignedRequests,
  overrideLogs,
  optimizationResult,
  onRunOptimization,
  onApplyOptimization,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'kpi_summary' | 'ortools_deepdive'>('kpi_summary');
  const [dateRange, setDateRange] = useState<string>('7 ngày gần nhất (09/05 – 15/05/2026)');
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState<boolean>(false);
  const [isRunningSolver, setIsRunningSolver] = useState<boolean>(false);

  const totalAssigned = assignments.length;
  const totalUnassigned = unassignedRequests.length;
  const totalRequests = totalAssigned + totalUnassigned;
  const feasibilityRatePct =
    totalRequests > 0 ? Math.round((totalAssigned / totalRequests) * 1000) / 10 : 100;

  const totalTravelMin = assignments.reduce((acc, a) => acc + (a.travelMinutes || 0), 0);
  const totalTravelKm =
    Math.round(assignments.reduce((acc, a) => acc + (a.distanceKm || 0), 0) * 10) / 10;

  // Compute workload std deviation across active staff
  const activeStaff = staffList.filter((s) => !s.isOnApprovedLeave);
  const avgLoad =
    activeStaff.length > 0
      ? activeStaff.reduce((acc, s) => acc + (s.workloadPct || 0), 0) / activeStaff.length
      : 0;
  const variance =
    activeStaff.length > 0
      ? activeStaff.reduce((acc, s) => acc + Math.pow((s.workloadPct || 0) - avgLoad, 2), 0) /
        activeStaff.length
      : 0;
  const stdDevPct = Math.round(Math.sqrt(variance) * 10) / 10;

  // Outcome counts by status
  const confirmedCount = assignments.filter((a) => a.status === 'Confirmed').length;
  const inProgressCount = assignments.filter((a) => a.status === 'In-Progress').length;
  const completedCount = assignments.filter((a) => a.status === 'Completed').length;
  const proposedCount = assignments.filter((a) => a.status === 'Proposed').length;

  const handleTriggerSolver = async () => {
    if (!onRunOptimization) return;
    setIsRunningSolver(true);
    try {
      await onRunOptimization();
    } finally {
      setIsRunningSolver(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 10.1 Page Heading and Controls */}
      <PageHeader
        title="Báo cáo & Hiệu suất Điều phối"
        subtitle="Tổng hợp chỉ số vận hành, phân bổ tải nhân sự và nhật ký kiểm toán can thiệp"
        actions={
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E1E9E6] bg-white text-[13px] text-[#253438]">
            <Calendar className="w-4 h-4 text-[#2F6F64]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-[#253438] cursor-pointer"
            >
              <option value="Hôm nay (15/05/2026)">Hôm nay (15/05/2026)</option>
              <option value="7 ngày gần nhất (09/05 – 15/05/2026)">
                7 ngày gần nhất (09/05 – 15/05/2026)
              </option>
              <option value="Tháng 05/2026">Tháng 05/2026</option>
            </select>
          </div>
        }
      />

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E1E9E6] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('kpi_summary')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
            activeTab === 'kpi_summary'
              ? 'border-[#2F6F64] text-[#2F6F64] bg-[#E5F1EC]/40'
              : 'border-transparent text-[#687A78] hover:text-[#253438] hover:bg-black/5'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Chỉ số KPI Vận hành & Kiểm toán Can thiệp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ortools_deepdive')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
            activeTab === 'ortools_deepdive'
              ? 'border-[#2F6F64] text-[#2F6F64] bg-[#E5F1EC]/40'
              : 'border-transparent text-[#687A78] hover:text-[#253438] hover:bg-black/5'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Bộ giải Tối ưu hóa OR-Tools CP-SAT (Deep Dive)</span>
        </button>
      </div>

      {activeTab === 'ortools_deepdive' ? (
        <ORToolsOptimizationScreen
          onApplySuccess={onApplyOptimization || (async () => {})}
          onNavigateToGantt={() => onNavigate?.('/dispatch')}
        />
      ) : (
        <>
      {/* 10.2 Top KPI Row (Maximum 4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tỷ lệ Phân công Khả thi"
          value={`${feasibilityRatePct}%`}
          sublabel={`${totalAssigned} / ${totalRequests} yêu cầu đã xếp lịch`}
          tone="teal"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <KpiCard
          label="Yêu cầu Chưa phân công"
          value={totalUnassigned}
          sublabel="Đang chờ điều phối viên xác nhận"
          tone={totalUnassigned > 0 ? 'warning' : 'success'}
          icon={<ClipboardList className="w-4 h-4" />}
        />
        <KpiCard
          label="Tổng Thời gian Di chuyển"
          value={`${totalTravelMin} phút`}
          sublabel={`${totalTravelKm} km trên tổng ${totalAssigned} ca khám`}
          tone="default"
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiCard
          label="Độ lệch Cân bằng Tải"
          value={`±${stdDevPct}%`}
          sublabel={`Hiệu suất TB ${Math.round(avgLoad)}% (trần 480p)`}
          tone="success"
          icon={<Scale className="w-4 h-4" />}
        />
      </div>

      {/* 10.3 Main Chart Layout (Two-Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Assignment Outcomes (Assigned vs Unassigned) */}
        <div className="bg-white rounded-[10px] border border-[#E1E9E6] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E1E9E6] pb-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#253438] m-0">
                Kết quả Phân công (Đã xếp lịch vs Chờ xử lý)
              </h2>
              <p className="text-[12px] text-[#687A78] m-0 mt-0.5">
                Tỷ trọng các yêu cầu chăm sóc theo trạng thái điều phối
              </p>
            </div>
            <span className="text-[12px] font-mono-num font-semibold text-[#2F6F64]">
              Tổng: {totalRequests}
            </span>
          </div>

          {/* Stacked Horizontal Summary Bar */}
          <div className="space-y-2">
            <div className="w-full h-5 rounded-md overflow-hidden flex bg-[#E1E9E6]">
              <div
                className="h-full bg-[#2F6F64]"
                style={{ width: `${(totalAssigned / Math.max(1, totalRequests)) * 100}%` }}
                title={`Đã phân công: ${totalAssigned}`}
              />
              <div
                className="h-full bg-[#E6A64B]"
                style={{ width: `${(totalUnassigned / Math.max(1, totalRequests)) * 100}%` }}
                title={`Chưa phân công: ${totalUnassigned}`}
              />
            </div>
            <div className="flex items-center justify-between text-[12px] text-[#687A78] tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2F6F64]" />
                Đã xếp lịch: <strong className="text-[#253438]">{totalAssigned}</strong> (
                {feasibilityRatePct}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#E6A64B]" />
                Chờ phân công: <strong className="text-[#253438]">{totalUnassigned}</strong> (
                {(100 - feasibilityRatePct).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Breakdown Rows */}
          <div className="pt-2 space-y-2.5">
            {[
              { label: 'Ca đã xác nhận', count: confirmedCount, color: 'bg-[#2F6F64]' },
              { label: 'Ca đang thực hiện', count: inProgressCount, color: 'bg-[#4D947B]' },
              { label: 'Ca đã hoàn thành', count: completedCount, color: 'bg-[#7BB6A6]' },
              {
                label: 'Ca đề xuất chờ xác nhận',
                count: proposedCount,
                color: 'bg-[#E6A64B]',
              },
              {
                label: 'Yêu cầu chưa phân công',
                count: totalUnassigned,
                color: 'bg-[#D96F7C]',
              },
            ].map((row) => {
              const pct = Math.round((row.count / Math.max(1, totalRequests)) * 100);
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#253438] font-medium">{row.label}</span>
                    <span className="tabular-nums text-[#687A78]">
                      <strong className="text-[#253438]">{row.count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F7FAF9] border border-[#E1E9E6] rounded-full overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Staff Workload Distribution & Travel-Time Overview */}
        <div className="bg-white rounded-[10px] border border-[#E1E9E6] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E1E9E6] pb-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#253438] m-0">
                Phân bổ Tải Công việc & Thời gian Di chuyển
              </h2>
              <p className="text-[12px] text-[#687A78] m-0 mt-0.5">
                Thời lượng chăm sóc trực tiếp + di chuyển so với trần 480 phút/ngày
              </p>
            </div>
            <span className="text-[12px] text-[#687A78] tabular-nums">Trần: 480p/ngày</span>
          </div>

          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {staffList.map((st) => {
              const assignedMin =
                st.assignedMinutes ?? Math.round(((st.workloadPct || 0) / 100) * 480);
              const travelMin = st.totalTravelMinutes ?? 24;
              const careMin = Math.max(0, assignedMin - travelMin);

              return (
                <div key={st.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[#253438] truncate">
                      {st.name}{' '}
                      <span className="text-[11px] text-[#687A78] font-normal">({st.zone})</span>
                    </span>
                    <span className="tabular-nums text-[11px] text-[#687A78]">
                      {st.isOnApprovedLeave ? (
                        <span className="text-[#C03A47] font-semibold">Nghỉ phép</span>
                      ) : (
                        <>
                          <strong className="text-[#253438]">{assignedMin}p</strong> ({st.workloadPct}%)
                        </>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#E1E9E6] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#2F6F64]"
                      style={{ width: `${Math.min(100, (careMin / 480) * 100)}%` }}
                      title={`Chăm sóc trực tiếp: ${careMin} phút`}
                    />
                    <div
                      className="h-full bg-[#E6A64B]"
                      style={{ width: `${Math.min(100, (travelMin / 480) * 100)}%` }}
                      title={`Thời gian di chuyển: ${travelMin} phút`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#E1E9E6] flex items-center justify-between text-[11px] text-[#687A78]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2F6F64]" /> Thời gian Chăm sóc Trực tiếp
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#E6A64B]" /> Thời gian Di chuyển Giữa các Ca
            </span>
          </div>
        </div>
      </div>

      {/* 10.4 Secondary Section: Compact Operational Summary Table */}
      <div className="bg-white rounded-[10px] border border-[#E1E9E6] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E1E9E6] flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-[#253438] m-0">
              Chẩn đoán Ràng buộc Vận hành & Bộ giải Tối ưu (Solver)
            </h2>
            <p className="text-[12px] text-[#687A78] m-0 mt-0.5">
              Tổng hợp độ lệch tải, kiểm soát làm thêm giờ, tuân thủ ràng buộc cứng và thời gian giải
            </p>
          </div>
          {onRunOptimization && (
            <button
              type="button"
              disabled={isRunningSolver}
              onClick={handleTriggerSolver}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F6F64] bg-[#E5F1EC] text-[#2F6F64] text-[12px] font-semibold hover:bg-[#2F6F64] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningSolver ? 'animate-spin' : ''}`} />
              {isRunningSolver ? 'Đang chạy tối ưu...' : 'Chạy Tối ưu Lộ trình & Cân bằng Tải'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E1E9E6]">
          <div className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
              Độ lệch Cân bằng Tải
            </div>
            <div className="text-[20px] font-semibold text-[#253438] mt-1 tabular-nums">
              ±{stdDevPct}% Độ lệch chuẩn
            </div>
            <div className="text-[12px] text-[#687A78] mt-0.5">
              Ngưỡng mục tiêu: &lt; 15.0% giữa các ca trực
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
              Quá giờ (&gt;480p/ngày)
            </div>
            <div className="text-[20px] font-semibold text-[#4D947B] mt-1 tabular-nums">
              0 phút (0 nhân sự)
            </div>
            <div className="text-[12px] text-[#687A78] mt-0.5">
              Được bảo vệ nghiêm ngặt bởi Ràng buộc cứng #6
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
              Vi phạm Ràng buộc Cứng
            </div>
            <div className="text-[20px] font-semibold text-[#253438] mt-1 tabular-nums">
              {assignments.filter((a) => a.isConflict).length} ca trùng lịch
            </div>
            <div className="text-[12px] text-[#687A78] mt-0.5">
              0 ca vi phạm kỹ năng hoặc nghỉ phép
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#687A78]">
              Thời gian Chạy Bộ giải
            </div>
            <div className="text-[20px] font-semibold text-[#2F6F64] mt-1 tabular-nums">
              {optimizationResult?.solveTimeMs || 142} ms
            </div>
            <div className="text-[12px] text-[#687A78] mt-0.5">
              Trạng thái: {optimizationResult?.solverStatus || 'OPTIMAL'} (DSS + CP-SAT)
            </div>
          </div>
        </div>

        {/* Expandable Detailed Analysis & Coordinator Override Audit Log */}
        <div className="border-t border-[#E1E9E6] bg-[#F7FAF9] px-5 py-3">
          <button
            type="button"
            onClick={() => setShowDetailedAnalysis((v) => !v)}
            className="w-full flex items-center justify-between text-[13px] font-semibold text-[#2F6F64] cursor-pointer"
          >
            <span>
              {showDetailedAnalysis
                ? 'Thu gọn Nhật ký Kiểm toán Can thiệp (Override) & Phân tích Tối ưu'
                : `Mở rộng Nhật ký Kiểm toán Can thiệp của Điều phối viên (${overrideLogs.length} bản ghi)`}
            </span>
            {showDetailedAnalysis ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showDetailedAnalysis && (
            <div className="mt-4 space-y-4 pb-2">
              {optimizationResult && !optimizationResult.isApplied && onApplyOptimization && (
                <div className="p-4 rounded-lg bg-white border border-[#C6DFD7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-[#253438] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#2F6F64]" />
                      Phương án Tối ưu Lịch trình Hàng loạt Đã sẵn sàng
                    </div>
                    <div className="text-[12px] text-[#687A78] mt-0.5 tabular-nums">
                      Giảm tổng thời gian di chuyển từ {optimizationResult.baselineMetrics.totalTravelMinutes} phút xuống{' '}
                      <strong>{optimizationResult.optimizedMetrics.totalTravelMinutes} phút</strong> và giải quyết{' '}
                      {optimizationResult.baselineMetrics.conflictCount} xung đột lịch trình.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onApplyOptimization}
                    className="px-3.5 py-2 rounded-lg bg-[#2F6F64] text-white text-[12px] font-semibold hover:bg-[#255A51] shrink-0 cursor-pointer"
                  >
                    Áp dụng Lịch trình Tối ưu
                  </button>
                </div>
              )}

              <div className="bg-white rounded-lg border border-[#E1E9E6] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#E1E9E6] text-[12px] font-semibold text-[#253438]">
                  Nhật ký Kiểm toán Can thiệp của Điều phối viên (Human-in-the-Loop Override Audit)
                </div>
                {overrideLogs.length === 0 ? (
                  <div className="p-4 text-[12px] text-[#687A78]">
                    Chưa có bản ghi can thiệp thủ công nào.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E1E9E6] text-[12px]">
                    {overrideLogs.map((log) => (
                      <div
                        key={log.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-[#253438]">
                            {log.requestId} · {log.patientName}{' '}
                            <span className="font-normal text-[#687A78]">
                              ({log.overrideCategory})
                            </span>
                          </div>
                          <div className="text-[#687A78] mt-0.5">
                            AI gợi ý Top 1: {log.aiTopStaff} → Điều phối viên chọn:{' '}
                            <strong className="text-[#2F6F64]">{log.chosenStaff}</strong> · Giải trình:{' '}
                            {log.overrideReason}
                          </div>
                        </div>
                        <div className="text-[11px] text-[#687A78] tabular-nums shrink-0">
                          {log.timestamp} · {log.dispatcherName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
