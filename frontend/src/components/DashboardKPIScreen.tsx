import React, { useState, useEffect } from 'react';
import { App as AntdApp, Button, Progress, Tooltip } from 'antd';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Navigation,
  Sparkles,
  Activity,
  Users,
  Timer,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { DashboardKPIData } from '../types/healthcare';

interface DashboardKPIScreenProps {
  refreshTrigger: number;
  onNavigateToAI: () => void;
  onNavigateToGantt: () => void;
  onNavigateToORTools: () => void;
}

export const DashboardKPIScreen: React.FC<DashboardKPIScreenProps> = ({
  refreshTrigger,
  onNavigateToGantt,
  onNavigateToORTools,
}) => {
  const { message } = AntdApp.useApp();
  const [kpiData, setKpiData] = useState<DashboardKPIData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kpis');
      if (res.ok) {
        const data: DashboardKPIData = await res.json();
        setKpiData(data);
      }
    } catch (err) {
      message.error('Không thể tải dữ liệu Dashboard KPI từ Backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, [refreshTrigger]);

  if (loading || !kpiData) {
    return (
      <div className="bg-white border border-[#E2DED5] rounded-xl p-8 text-center text-xs text-[#687873]">
        Đang tổng hợp chỉ số KPI thời gian thực từ Backend API...
      </div>
    );
  }

  const { summary, hourlyDensity, serviceBreakdown, staffUtilization, overrideLogs } =
    kpiData;

  const maxHourlyTotal = Math.max(
    4,
    ...hourlyDensity.map(
      (h) => h.completed + h.inProgress + h.confirmed + h.proposed
    )
  );

  // Reference palette colors for service breakdown bars
  const SERVICE_COLORS = ['#879A8F', '#96ADB7', '#D4B995', '#C68F7B'];

  return (
    <div className="space-y-5">
      {/* 1. HEADER BAR */}
      <div className="bg-white border border-[#E2DED5] rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5A6E63] uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Tổng Quan Vận Hành & Chỉ Số Hiệu Suất Điều Phối (Operations Dashboard)</span>
          </div>
          <h1 className="text-xl font-bold text-[#30433F] mt-1">
            Bảng Chỉ Số Vận Hành Chăm Sóc Tại Nhà & Đánh Giá DSS
          </h1>
          <p className="text-xs text-[#687873] mt-0.5">
            Tổng hợp trực tiếp từ trạng thái phân công ca, dự báo thời lượng chăm sóc và nhật ký điều phối viên Override.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="small"
            onClick={fetchKPIs}
            className="text-xs flex items-center gap-1 text-[#30433F] border-[#E2DED5] h-8 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#5A6E63]" />
            <span>Làm mới số liệu</span>
          </Button>
          <Button
            size="small"
            onClick={onNavigateToORTools}
            className="text-xs font-medium text-[#30433F] border-[#879A8F] bg-[#FAF8F5] h-8 px-3"
          >
            Mở Tối Ưu Lịch
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={onNavigateToGantt}
            className="bg-[#5A6E63] hover:!bg-[#4B5D53] border-none text-xs font-semibold h-8 px-3.5"
          >
            Xem Lịch Gantt
          </Button>
        </div>
      </div>

      {/* 2. TOP 6 KPI PANELS (MATCHING REFERENCE CARD STYLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Visits */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Tổng Ca Hôm Nay</span>
            <span className="w-7 h-7 rounded-lg bg-[#E6ECE8] flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[#5A6E63]" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#30433F] mt-2">
            {summary.totalVisitsToday}{' '}
            <span className="text-xs font-normal text-[#687873]">ca</span>
          </div>
          <div className="text-[11px] text-[#5A6E63] font-medium mt-1.5">
            {summary.completedVisits} hoàn thành · {summary.inProgressVisits} đang làm · {summary.unassignedCount} chờ
          </div>
        </div>

        {/* Card 2: SLA On-Time Rate */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Tỷ Lệ Đúng Giờ SLA</span>
            <span className="w-7 h-7 rounded-lg bg-[#E6ECE8] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#5A6E63]" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#5A6E63] mt-2">
            {summary.slaOnTimePct}%
          </div>
          <div className="text-[11px] mt-1.5">
            {summary.conflictCount > 0 ? (
              <span className="text-[#7D4532] font-semibold">
                Còn {summary.conflictCount} ca trùng giờ cần xử lý
              </span>
            ) : (
              <span className="text-[#5A6E63] font-semibold">
                0 xung đột · Đạt chuẩn SLA
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Duration Prediction Accuracy */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Độ Chính Xác Dự Báo</span>
            <span className="w-7 h-7 rounded-lg bg-[#E9F0F2] flex items-center justify-center">
              <Timer className="w-4 h-4 text-[#3A525D]" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#3A525D] mt-2">
            {summary.durationPredictionAccuracyPct}%
          </div>
          <div className="text-[10px] text-[#687873] font-mono-num mt-1.5 truncate">
            {summary.durationModelVersion}
          </div>
        </div>

        {/* Card 4: AI Top-1 Acceptance vs Override */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Tỷ Lệ Chốt AI Top-1</span>
            <span className="w-7 h-7 rounded-lg bg-[#F5EFE6] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6B5335]" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#30433F] mt-2">
            {summary.aiTop1AcceptancePct}%
          </div>
          <div className="text-[11px] text-[#6B5335] font-medium mt-1.5">
            {summary.overrideCount} ca điều phối viên Override
          </div>
        </div>

        {/* Card 5: Total Travel Distance & Time */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Quãng Đường Di Chuyển</span>
            <span className="w-7 h-7 rounded-lg bg-[#E9F0F2] flex items-center justify-center">
              <Navigation className="w-4 h-4 text-[#3A525D]" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#30433F] mt-2">
            {summary.totalTravelKm}{' '}
            <span className="text-xs font-normal text-[#687873]">km</span>
          </div>
          <div className="text-[11px] text-[#687873] font-mono-num mt-1.5">
            Tổng thời gian: {summary.totalTravelMinutes} phút
          </div>
        </div>

        {/* Card 6: Average Staff Workload */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#687873]">
            <span className="font-semibold">Tải Nhân Sự Trung Bình</span>
            <span className="w-7 h-7 rounded-lg bg-[#F6EBE7] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#7D4532]" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-num text-[#30433F] mt-2">
            {summary.avgWorkloadPct}%
          </div>
          <div className="text-[11px] text-[#5A6E63] font-medium mt-1.5">
            6/6 nhân sự trong ngưỡng an toàn
          </div>
        </div>
      </div>

      {/* 3. CHARTS ROW: HOURLY CARE DENSITY + SERVICE DURATION BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 cols): Hourly Care Density Bar Chart in Sage / Dusty Blue / Warm Beige */}
        <div className="lg:col-span-7 bg-white border border-[#E2DED5] rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE9E2] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#30433F]">
                Phân Bổ Mật Độ Ca Chăm Sóc Theo Khung Giờ (07:00 – 17:00)
              </h2>
              <p className="text-[11px] text-[#687873]">
                Tổng hợp từ lịch phân công thực tế trên Timeline Gantt
              </p>
            </div>

            <div className="flex items-center gap-3.5 text-[11px] text-[#30433F]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#879A8F] inline-block" />
                <span>Hoàn thành</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#96ADB7] inline-block" />
                <span>Đang làm / Đã chốt</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#D4B995] inline-block" />
                <span>AI Đề xuất</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-11 gap-2.5 items-end h-52 pt-4 px-2">
            {hourlyDensity.map((item) => {
              const total =
                item.completed + item.inProgress + item.confirmed + item.proposed;
              const heightPct = Math.round((total / maxHourlyTotal) * 100);

              return (
                <Tooltip
                  key={item.hourLabel}
                  title={`${item.hourLabel}: Tổng ${total} ca (Hoàn thành: ${item.completed}, Đang làm/Đã chốt: ${item.inProgress + item.confirmed}, AI đề xuất: ${item.proposed})`}
                >
                  <div className="flex flex-col items-center h-full justify-end group cursor-pointer">
                    <div className="text-[10px] font-mono-num font-bold text-[#30433F] mb-1">
                      {total > 0 ? `${total}` : ''}
                    </div>
                    <div className="w-full max-w-[34px] bg-[#FAF8F5] rounded-t-lg overflow-hidden flex flex-col-reverse h-36 border border-[#E2DED5]">
                      {total > 0 && (
                        <div
                          style={{ height: `${Math.max(16, heightPct)}%` }}
                          className="w-full flex flex-col-reverse transition-all"
                        >
                          {item.completed > 0 && (
                            <div
                              style={{ flex: item.completed }}
                              className="bg-[#879A8F] w-full"
                            />
                          )}
                          {item.inProgress + item.confirmed > 0 && (
                            <div
                              style={{ flex: item.inProgress + item.confirmed }}
                              className="bg-[#96ADB7] w-full"
                            />
                          )}
                          {item.proposed > 0 && (
                            <div
                              style={{ flex: item.proposed }}
                              className="bg-[#D4B995] w-full"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-mono-num text-[#687873] mt-1.5 font-medium">
                      {item.hourLabel}
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Right (5 cols): Service Breakdown & Standard vs Predicted Duration */}
        <div className="lg:col-span-5 bg-white border border-[#E2DED5] rounded-xl p-5 shadow-2xs space-y-3.5">
          <div className="border-b border-[#ECE9E2] pb-3">
            <h2 className="text-sm font-bold text-[#30433F]">
              Cơ Cấu Dịch Vụ & So Sánh Thời Lượng (Chuẩn vs Dự Báo)
            </h2>
            <p className="text-[11px] text-[#687873]">
              Định mức chuẩn so với thời lượng dự báo trung bình của mô hình AI
            </p>
          </div>

          <div className="space-y-3">
            {serviceBreakdown.map((item, idx) => {
              const barColor = SERVICE_COLORS[idx % SERVICE_COLORS.length];
              return (
                <div
                  key={item.category}
                  className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E2DED5] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#30433F]">{item.category}</span>
                    <span className="font-mono-num font-semibold text-[#5A6E63]">
                      {item.visitCount} ca ({item.percentage}%)
                    </span>
                  </div>
                  <Progress
                    percent={item.percentage}
                    showInfo={false}
                    strokeColor={barColor}
                    railColor="#E2DED5"
                    size="small"
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono-num text-[#687873]">
                    <span>Chuẩn: {item.avgStandardMin}p</span>
                    <span className="text-[#30433F] font-semibold">
                      Dự báo TB: {item.avgPredictedMin}p (+{item.avgPredictedMin - item.avgStandardMin}p)
                    </span>
                    <span>Di chuyển TB: {item.avgTravelMin}p</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. STAFF WORKLOAD SUMMARY TABLE & OVERRIDE AUDIT LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 cols): Staff Utilization */}
        <div className="lg:col-span-7 bg-white border border-[#E2DED5] rounded-xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 bg-[#FAF8F5] border-b border-[#E2DED5] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#30433F] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5A6E63]" />
              <span>Tổng Hợp Tải Công Việc Nhân Sự Y Tế Trong Ngày</span>
            </h2>
            <span className="text-xs text-[#687873] font-mono-num">
              {staffUtilization.length} nhân sự trực
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E2DED5] text-[#687873] font-semibold text-[11px]">
                  <th className="py-3 px-4">Nhân sự Y tế</th>
                  <th className="py-3 px-4">Khu vực phụ trách</th>
                  <th className="py-3 px-3 text-center">Số ca</th>
                  <th className="py-3 px-3 text-center">Giờ chăm sóc</th>
                  <th className="py-3 px-3 text-center">Di chuyển</th>
                  <th className="py-3 px-4">Tải công việc (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE9E2]">
                {staffUtilization.map((st) => (
                  <tr key={st.staffId} className="hover:bg-[#FAF8F5]">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: st.avatarColor }}
                        />
                        <div>
                          <div className="font-bold text-[#30433F]">{st.staffName}</div>
                          <div className="text-[11px] text-[#687873]">{st.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#687873]">{st.zone}</td>
                    <td className="py-3 px-3 text-center font-mono-num font-bold text-[#30433F]">
                      {st.assignedCount}
                    </td>
                    <td className="py-3 px-3 text-center font-mono-num text-[#5A6E63] font-semibold">
                      {st.careMinutes}p
                    </td>
                    <td className="py-3 px-3 text-center font-mono-num text-[#687873]">
                      {st.travelMinutes}p
                    </td>
                    <td className="py-3 px-4 w-44">
                      <div className="flex items-center gap-2 font-mono-num">
                        <Progress
                          percent={st.workloadPct}
                          showInfo={false}
                          strokeColor={st.workloadPct > 80 ? '#C68F7B' : '#879A8F'}
                          railColor="#E2DED5"
                          size="small"
                        />
                        <span className="font-bold text-[#30433F] text-[11px]">
                          {st.workloadPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (5 cols): Override Audit Logs */}
        <div className="lg:col-span-5 bg-white border border-[#E2DED5] rounded-xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#ECE9E2] pb-3">
            <h2 className="text-sm font-bold text-[#30433F] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#5A6E63]" />
              <span>Nhật Ký Điều Phối Viên Override Gần Đây</span>
            </h2>
            <span className="font-mono-num text-xs px-2 py-0.5 rounded bg-[#F5EFE6] text-[#6B5335] font-semibold">
              {overrideLogs.length} lượt
            </span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {overrideLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E2DED5] text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#30433F]">{log.patientName}</span>
                  <span className="font-mono-num text-[10px] text-[#687873]">
                    {log.timestamp}
                  </span>
                </div>
                <div className="text-[11px] text-[#687873]">
                  AI #1: <strong>{log.aiTopStaff}</strong> → Chọn:{' '}
                  <strong className="text-[#5A6E63]">{log.chosenStaff}</strong>
                </div>
                <div className="text-[11px] text-[#30433F] bg-white p-2.5 rounded-lg border border-[#E2DED5] mt-1">
                  <span className="font-semibold text-[#7D4532]">{log.overrideCategory}:</span>{' '}
                  {log.overrideReason}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
