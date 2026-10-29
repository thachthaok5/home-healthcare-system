import React, { useState, useEffect } from 'react';
import {
  App as AntdApp,
  Drawer,
  Button,
  Radio,
  Input,
} from 'antd';
import {
  Sparkles,
  UserCheck,
  Clock,
  Navigation,
  Activity,
  HeartHandshake,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';
import {
  UnassignedRequest,
  AICandidate,
} from '../types/healthcare';

interface AIRecommendationDrawerProps {
  open: boolean;
  request: UnassignedRequest | null;
  onClose: () => void;
  onConfirmAssignment: (
    req: UnassignedRequest,
    chosenCandidate: AICandidate,
    isOverride: boolean,
    overrideCategory?: string,
    overrideReason?: string
  ) => void;
}

const OVERRIDE_REASONS = [
  'Bệnh nhân/Người nhà yêu cầu nhân sự quen thuộc (Patient Preference)',
  'Tình hình thời tiết / tuyến đường ùn tắc thực tế (Traffic Condition)',
  'Cân đối sức khỏe / thể trạng nhân viên trong ca (Staff Fatigue Management)',
  'Kết hợp lấy thêm vật tư y tế tại trạm y tế phụ (Logistics Convenience)',
];

export const AIRecommendationDrawer: React.FC<AIRecommendationDrawerProps> = ({
  open,
  request,
  onClose,
  onConfirmAssignment,
}) => {
  const { message } = AntdApp.useApp();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<string>(OVERRIDE_REASONS[0]);
  const [overrideReason, setOverrideReason] = useState<string>('');

  useEffect(() => {
    if (request && request.aiCandidates.length > 0) {
      setSelectedStaffId(request.aiCandidates[0].staffId);
      setOverrideReason('');
    }
  }, [request]);

  if (!request) return null;

  const activeStaffId = selectedStaffId || request.aiCandidates[0]?.staffId;
  const currentCandidate =
    request.aiCandidates.find((c) => c.staffId === activeStaffId) ||
    request.aiCandidates[0];

  const top1Candidate = request.aiCandidates[0];
  const isOverriding =
    Boolean(currentCandidate && top1Candidate && currentCandidate.staffId !== top1Candidate.staffId);

  const handleConfirm = () => {
    if (!currentCandidate) return;
    if (isOverriding && !overrideReason.trim()) {
      message.error('Vui lòng nhập lý do giải trình cụ thể khi thực hiện Override.');
      return;
    }

    onConfirmAssignment(
      request,
      currentCandidate,
      isOverriding,
      isOverriding ? overrideCategory : undefined,
      isOverriding ? overrideReason : undefined
    );
    onClose();
  };

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between pr-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#E6ECE8] text-[#30433F]">
              <Sparkles className="w-4 h-4 text-[#5A6E63]" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#687873] uppercase tracking-wider">
                Hệ Hỗ Trợ Quyết Định Điều Phối (Explainable DSS)
              </div>
              <h2 className="text-base font-bold text-[#30433F] leading-tight mt-0.5">
                Đề xuất Ứng viên · Mã ca {request.id}
              </h2>
            </div>
          </div>
          <span className="font-mono-num font-semibold text-xs px-2.5 py-1 rounded-md bg-[#E6ECE8] text-[#30433F] border border-[#879A8F]/30">
            Độ tin cậy dự báo: {request.predictionConfidencePct}%
          </span>
        </div>
      }
      open={open}
      onClose={onClose}
      size={820}
      styles={{
        body: { padding: '22px 24px', backgroundColor: '#F7F5F0' },
        footer: { borderTop: '1px solid #E2DED5', padding: '14px 24px', backgroundColor: '#FFFFFF' },
      }}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#687873]">
            <span className="font-semibold text-[#30433F]">Nguyên tắc:</span> Điểm số tính từ dữ liệu mô phỏng (Prototype), điều phối viên duyệt quyết định cuối.
          </div>
          <div className="flex items-center gap-2.5">
            <Button onClick={onClose} className="text-xs">
              Đóng
            </Button>
            {currentCandidate && currentCandidate.isEligible && (
              <Button
                type="primary"
                onClick={handleConfirm}
                className="bg-[#5A6E63] hover:!bg-[#4B5D53] text-xs font-medium"
              >
                {isOverriding
                  ? `Xác nhận Override & Gán cho ${currentCandidate.staffName}`
                  : `Xác nhận phân công ${currentCandidate.staffName} (#1)`}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 1. Tóm tắt yêu cầu & Thời lượng dự báo */}
        <div className="bg-white border border-[#E2DED5] rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#687873]">
                <span className="font-bold text-[#30433F] text-sm">{request.patientName}</span>
                <span>·</span>
                <span>{request.patientAge} tuổi</span>
                <span>·</span>
                <span className="font-mono-num">{request.patientPhone}</span>
                <span className="px-2 py-0.5 rounded bg-[#F6EBE7] text-[#7D4532] font-semibold text-[11px]">
                  {request.priority}
                </span>
              </div>
              <div className="text-sm font-bold text-[#30433F] mt-1">
                {request.serviceName}
              </div>
              <div className="text-xs text-[#687873] mt-0.5">
                {request.address} ({request.district})
              </div>
            </div>

            <div className="text-right font-mono-num shrink-0 bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#E2DED5]">
              <div className="text-[11px] text-[#687873]">Khung giờ yêu cầu</div>
              <div className="text-sm font-bold text-[#30433F]">{request.requestedWindow}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#ECE9E2] text-xs">
            <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E2DED5]">
              <div className="text-[#687873]">Thời lượng chuẩn</div>
              <div className="text-base font-bold text-[#30433F] font-mono-num mt-0.5">
                {request.standardDurationMin} phút
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#E6ECE8]/60 border border-[#879A8F]/40">
              <div className="text-[#30433F] font-semibold flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-[#5A6E63]" />
                <span>Predicted Duration</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-bold text-[#30433F] font-mono-num">
                  {request.predictedDurationMin} phút
                </span>
                <span className="text-[11px] text-[#6B5335] font-mono-num bg-[#F5EFE6] px-1.5 py-0.2 rounded">
                  +{request.predictedDurationMin - request.standardDurationMin}p
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E2DED5]">
              <div className="text-[#687873]">Yêu cầu kỹ năng</div>
              <div className="font-semibold text-[#30433F] mt-0.5 line-clamp-1">
                {request.requiredSkills.join(' · ')}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Bảng xếp hạng ứng viên */}
        <div className="bg-white border border-[#E2DED5] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#E2DED5] flex items-center justify-between text-xs">
            <span className="font-bold text-[#30433F]">
              Danh sách Ứng viên Đánh giá ({request.aiCandidates.length} nhân sự)
            </span>
            <span className="text-[#687873]">Chọn nhân sự để kiểm tra tiêu chí & chốt lịch</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E2DED5] text-[#687873] text-[11px]">
                  <th className="py-2 px-3">Trạng thái</th>
                  <th className="py-2 px-3">Nhân sự</th>
                  <th className="py-2 px-2 text-center">SkillFit</th>
                  <th className="py-2 px-2 text-center">TimeFit</th>
                  <th className="py-2 px-2 text-center">Distance</th>
                  <th className="py-2 px-2 text-center">Workload</th>
                  <th className="py-2 px-2 text-center">Continuity</th>
                  <th className="py-2 px-2 text-center">Pred. Dur</th>
                  <th className="py-2 px-3 text-right">Điểm DSS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE9E2]">
                {request.aiCandidates.map((cand) => {
                  const isSelected = cand.staffId === activeStaffId;
                  return (
                    <tr
                      key={cand.staffId}
                      onClick={() => setSelectedStaffId(cand.staffId)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#E6ECE8]/70 font-medium'
                          : cand.isEligible
                          ? 'hover:bg-[#FAF8F5]'
                          : 'bg-[#F6EBE7]/35 hover:bg-[#F6EBE7]/60'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            cand.rank === 1 && cand.isEligible
                              ? 'bg-[#E6ECE8] text-[#30433F] border border-[#879A8F]/40'
                              : cand.isEligible
                              ? 'bg-[#E9F0F2] text-[#3A525D]'
                              : 'bg-[#F6EBE7] text-[#7D4532]'
                          }`}
                        >
                          {cand.statusBadge}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#30433F]">{cand.staffName}</div>
                        <div className="text-[11px] text-[#687873]">{cand.staffRole}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-num">{cand.criteria.skillFitScore}</td>
                      <td className="py-2.5 px-2 text-center font-mono-num">{cand.criteria.timeFitScore}</td>
                      <td className="py-2.5 px-2 text-center font-mono-num">
                        {cand.criteria.distanceKm}km ({cand.criteria.travelMinutes}p)
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-num">
                        {cand.criteria.workloadPct}% → {cand.criteria.projectedWorkloadPct}%
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono-num">{cand.criteria.continuityScore}</td>
                      <td className="py-2.5 px-2 text-center font-mono-num">{cand.criteria.predictedDurationMin}p</td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-bold text-[#30433F]">
                        {cand.totalScore.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Lý do đủ điều kiện / Lý do loại trừ & Khung Override */}
        {currentCandidate && (
          <div className="bg-white border border-[#E2DED5] rounded-xl p-4 space-y-3">
            {currentCandidate.isEligible ? (
              <div className="p-3 rounded-lg bg-[#E6ECE8]/60 border border-[#879A8F]/40 text-xs text-[#30433F]">
                <strong className="font-semibold">Lý do đủ điều kiện ({currentCandidate.staffName}): </strong>
                {currentCandidate.qualificationReason}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#F6EBE7] border border-[#C68F7B] text-xs text-[#7D4532] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#C68F7B]" />
                  <span>Lý do ứng viên bị loại ({currentCandidate.staffName}):</span>
                </div>
                <ul className="list-disc list-inside pl-1 space-y-0.5">
                  {currentCandidate.constraintViolations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {isOverriding && currentCandidate.isEligible && (
              <div className="p-3.5 rounded-lg bg-[#F5EFE6] border border-[#D4B995] space-y-2.5 text-xs">
                <div className="font-bold text-[#6B5335] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Ghi nhận lý do Override (Chọn {currentCandidate.staffName} thay vì {top1Candidate.staffName})</span>
                </div>
                <Radio.Group
                  value={overrideCategory}
                  onChange={(e) => setOverrideCategory(e.target.value)}
                  className="flex flex-col gap-1"
                >
                  {OVERRIDE_REASONS.map((r) => (
                    <Radio key={r} value={r} className="text-xs text-[#30433F]">
                      {r}
                    </Radio>
                  ))}
                </Radio.Group>
                <Input.TextArea
                  rows={2}
                  placeholder="Nhập lý do giải trình cụ thể trước khi xác nhận..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="text-xs bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
};
