import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Clock,
  MapPin,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
} from 'lucide-react';
import { UnassignedRequest } from '../../types/healthcare';

export interface NewRequestDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmitRequest: (newReq: Partial<UnassignedRequest>, sendToAI?: boolean) => void;
  initialRequest?: Partial<UnassignedRequest> | null;
}

export const SERVICE_OPTIONS = [
  {
    name: 'Thay băng & Cắt chỉ vết mổ phức tạp',
    category: 'Chăm sóc vết thương',
    skills: ['Chăm sóc vết thương', 'Tiêm truyền tĩnh mạch'],
    standardMin: 45,
    predictedMin: 55,
  },
  {
    name: 'Phục hồi chức năng vận động sau tai biến',
    category: 'Vật lý trị liệu',
    skills: ['Vật lý trị liệu', 'Phục hồi chức năng'],
    standardMin: 60,
    predictedMin: 68,
  },
  {
    name: 'Truyền dịch & Theo dõi sinh hiệu tại nhà',
    category: 'Điều dưỡng chuyên khoa',
    skills: ['Tiêm truyền tĩnh mạch', 'Cấp cứu cơ bản'],
    standardMin: 50,
    predictedMin: 58,
  },
  {
    name: 'Khám định kỳ & Điều chỉnh phác đồ tim mạch',
    category: 'Bác sĩ Gia đình',
    skills: ['Khám nội tổng quát', 'Siêu âm cầm tay'],
    standardMin: 40,
    predictedMin: 45,
  },
];

export const DISTRICT_OPTIONS = [
  'Phường Lộc Thọ',
  'Phường Tân Lập',
  'Phường Phước Tiến',
  'Phường Vĩnh Nguyên',
  'Phường Vĩnh Hải',
  'Phường Phước Hải',
  'Phường Vạn Thạnh',
  'Phường Phương Sài',
];

export const SKILL_OPTIONS = [
  'Chăm sóc vết thương',
  'Tiêm truyền tĩnh mạch',
  'Vật lý trị liệu',
  'Phục hồi chức năng',
  'Cấp cứu cơ bản',
  'Khám nội tổng quát',
  'Siêu âm cầm tay',
  'Chăm sóc giảm nhẹ',
];

export const NewRequestDrawer: React.FC<NewRequestDrawerProps> = ({
  open,
  onClose,
  onSubmitRequest,
  initialRequest,
}) => {
  const isEditing = Boolean(initialRequest?.id);

  const [patientName, setPatientName] = useState('Nguyễn Văn Minh');
  const [patientAge, setPatientAge] = useState(68);
  const [patientPhone, setPatientPhone] = useState('0905 412 889');
  const [priority, setPriority] = useState<'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn'>('Cao');
  const [serviceName, setServiceName] = useState(SERVICE_OPTIONS[0].name);
  const [serviceCategory, setServiceCategory] = useState(SERVICE_OPTIONS[0].category);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(SERVICE_OPTIONS[0].skills);
  const [district, setDistrict] = useState(DISTRICT_OPTIONS[0]);
  const [address, setAddress] = useState('42 Trần Phú, Nha Trang');
  const [requestedDate, setRequestedDate] = useState('2026-05-15');
  const [windowStart, setWindowStart] = useState('10:00');
  const [windowEnd, setWindowEnd] = useState('11:30');
  const [estimatedDurationMin, setEstimatedDurationMin] = useState<number>(55);
  const [clinicalNotes, setClinicalNotes] = useState(
    'Bệnh nhân sau phẫu thuật ngày thứ 5, cần kiểm tra dịch thấm và thay băng vô khuẩn.'
  );

  useEffect(() => {
    if (!open) return;
    if (initialRequest) {
      setPatientName(initialRequest.patientName || 'Nguyễn Văn Minh');
      setPatientAge(initialRequest.patientAge || 68);
      setPatientPhone(initialRequest.patientPhone || '0905 412 889');
      setPriority((initialRequest.priority as 'Khẩn cấp' | 'Cao' | 'Tiêu chuẩn') || 'Cao');
      setServiceName(initialRequest.serviceName || SERVICE_OPTIONS[0].name);
      setServiceCategory(initialRequest.serviceCategory || SERVICE_OPTIONS[0].category);
      setSelectedSkills(
        initialRequest.requiredSkills && initialRequest.requiredSkills.length > 0
          ? initialRequest.requiredSkills
          : SERVICE_OPTIONS[0].skills
      );
      setDistrict(initialRequest.district || DISTRICT_OPTIONS[0]);
      setAddress(
        initialRequest.address
          ? initialRequest.address.replace(`, ${initialRequest.district || ''}`, '')
          : '42 Trần Phú, Nha Trang'
      );
      const parts = (initialRequest.requestedWindow || '10:00 - 11:30').split('-').map((s) => s.trim());
      setWindowStart(initialRequest.windowStart || parts[0] || '10:00');
      setWindowEnd(initialRequest.windowEnd || parts[1] || '11:30');
      setEstimatedDurationMin(
        initialRequest.predictedDurationMin || initialRequest.standardDurationMin || 55
      );
      setClinicalNotes(
        initialRequest.clinicalNotes ||
          'Cần điều phối nhân sự đúng chuyên môn trong khung giờ yêu cầu.'
      );
    } else {
      setPatientName('Nguyễn Văn Minh');
      setPatientAge(68);
      setPatientPhone('0905 412 889');
      setPriority('Cao');
      setServiceName(SERVICE_OPTIONS[0].name);
      setServiceCategory(SERVICE_OPTIONS[0].category);
      setSelectedSkills(SERVICE_OPTIONS[0].skills);
      setDistrict(DISTRICT_OPTIONS[0]);
      setAddress('42 Trần Phú, Nha Trang');
      setRequestedDate('2026-05-15');
      setWindowStart('10:00');
      setWindowEnd('11:30');
      setEstimatedDurationMin(SERVICE_OPTIONS[0].predictedMin);
      setClinicalNotes(
        'Bệnh nhân sau phẫu thuật ngày thứ 5, cần kiểm tra dịch thấm và thay băng vô khuẩn.'
      );
    }
  }, [open, initialRequest]);

  // Validation checks (Section 2.6)
  const validationState = useMemo(() => {
    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const startM = toMins(windowStart);
    const endM = toMins(windowEnd);
    const windowSpan = endM - startM;

    const isTimeValid = startM < endM && windowSpan >= 20;
    const isDurationPositive = estimatedDurationMin > 0;
    const isDurationWithinLimit = estimatedDurationMin <= 480;
    const isDurationFitsWindow = isTimeValid ? estimatedDurationMin <= windowSpan + 15 : false;
    const hasSkill = selectedSkills.length > 0;
    const hasArea = Boolean(district.trim());
    const hasPatient = Boolean(patientName.trim());

    const errors: string[] = [];
    if (!hasPatient) errors.push('Vui lòng nhập họ tên bệnh nhân / người nhận chăm sóc.');
    if (!isTimeValid) errors.push('Giờ bắt đầu phải trước giờ kết thúc ít nhất 20 phút.');
    if (!isDurationPositive) errors.push('Thời lượng dự kiến phải lớn hơn 0 phút.');
    if (!isDurationWithinLimit)
      errors.push('Thời lượng vượt quá giới hạn tối đa trong ngày (480 phút).');
    if (isTimeValid && !isDurationFitsWindow)
      errors.push(
        `Thời lượng dự kiến (${estimatedDurationMin}p) dài hơn đáng kể so với khung giờ hẹn (${windowSpan}p).`
      );
    if (!hasSkill) errors.push('Phải chọn ít nhất 1 kỹ năng chuyên môn bắt buộc.');
    if (!hasArea) errors.push('Phải chọn khu vực phục vụ (Phường).');

    return {
      isTimeValid,
      isDurationPositive,
      isDurationWithinLimit,
      hasSkill,
      hasArea,
      isValid:
        hasPatient &&
        isTimeValid &&
        isDurationPositive &&
        isDurationWithinLimit &&
        hasSkill &&
        hasArea,
      errors,
    };
  }, [windowStart, windowEnd, estimatedDurationMin, selectedSkills, district, patientName]);

  if (!open) return null;

  const handleServicePresetChange = (presetName: string) => {
    const found = SERVICE_OPTIONS.find((s) => s.name === presetName);
    if (found) {
      setServiceName(found.name);
      setServiceCategory(found.category);
      setSelectedSkills(found.skills);
      setEstimatedDurationMin(found.predictedMin);
    } else {
      setServiceName(presetName);
    }
  };

  const toggleSkill = (sk: string) => {
    setSelectedSkills((prev) =>
      prev.includes(sk) ? prev.filter((item) => item !== sk) : [...prev, sk]
    );
  };

  const buildPayload = (): Partial<UnassignedRequest> => {
    const reqId = initialRequest?.id || `REQ-${Math.floor(210 + Math.random() * 680)}`;
    const stdMin = Math.max(20, Math.round(estimatedDurationMin * 0.85));
    return {
      id: reqId,
      patientId: initialRequest?.patientId || `BN-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName: patientName.trim() || 'Bệnh nhân mới',
      patientAge: Number(patientAge) || 65,
      patientPhone: patientPhone.trim() || '0905 000 111',
      district,
      address: address.includes(district) ? address : `${address}, ${district}`,
      location: initialRequest?.location || { lat: 12.2388, lng: 109.1967 },
      serviceName,
      serviceCategory,
      requestedWindow: `${windowStart} - ${windowEnd}`,
      windowStart,
      windowEnd,
      preferredStart: windowStart,
      suggestedStartTime: windowStart,
      standardDurationMin: stdMin,
      predictedDurationMin: Number(estimatedDurationMin) || 45,
      predictionConfidencePct: 92,
      predictionFactors: ['Định mức chuyên môn', 'Cấu hình vận hành tại khu vực'],
      durationBreakdown: [
        {
          factorName: 'Thời lượng chuẩn danh mục',
          impactMinutes: stdMin,
          description: 'Định mức cơ sở',
        },
        {
          factorName: 'Dự báo điều chỉnh vận hành',
          impactMinutes: Math.max(0, Number(estimatedDurationMin) - stdMin),
          description: 'Ước lượng thời gian thực hiện thực tế',
        },
      ],
      priority,
      clinicalSeverity:
        priority === 'Khẩn cấp' ? 'Cấp độ 3 - Xử lý khẩn' : 'Cấp độ 2 - Tiêu chuẩn',
      specializedEquipment: ['Bộ dụng cụ tiêu chuẩn'],
      requiredSkills: selectedSkills,
      clinicalNotes: clinicalNotes.trim(),
      historicalVisits: initialRequest?.historicalVisits || {},
      status: 'Unassigned',
    };
  };

  const handleSaveOnly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationState.isValid) return;
    onSubmitRequest(buildPayload(), false);
    onClose();
  };

  const handleSaveAndSendToAI = () => {
    if (!validationState.isValid) return;
    onSubmitRequest(buildPayload(), true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#253438]/30 backdrop-blur-[1px]">
      <div className="w-full max-w-[540px] bg-white h-full shadow-xl border-l border-[#E1E9E6] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E1E9E6] flex items-center justify-between bg-[#F7FAF9] shrink-0">
          <div>
            <h2 className="text-[18px] font-semibold text-[#253438] m-0">
              {isEditing ? `Chỉnh sửa Yêu cầu ${initialRequest?.id}` : 'Tạo Yêu cầu Chăm sóc Mới'}
            </h2>
            <p className="text-[12px] text-[#687A78] m-0 mt-0.5">
              {isEditing
                ? 'Cập nhật thông tin dịch vụ, khung giờ và điều kiện sẵn sàng trước khi gửi AI'
                : 'Tiếp nhận yêu cầu chăm sóc tại nhà và kiểm tra điều kiện sẵn sàng điều phối'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#687A78] hover:text-[#253438] hover:bg-[#E1E9E6]/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveOnly} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION A: Basic Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#2F6F64] uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#E5F1EC] text-[#2F6F64] inline-flex items-center justify-center text-[11px]">
                A
              </span>
              Thông tin Cơ bản (Basic Information)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F7FAF9] p-4 rounded-lg border border-[#E1E9E6]">
              <div className="sm:col-span-3">
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Loại dịch vụ chăm sóc (Service Type) *
                </label>
                <select
                  value={serviceName}
                  onChange={(e) => handleServicePresetChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                >
                  {SERVICE_OPTIONS.map((srv) => (
                    <option key={srv.name} value={srv.name}>
                      {srv.name} ({srv.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Người nhận chăm sóc / Bệnh nhân *
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Tuổi
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={patientAge}
                  onChange={(e) => setPatientAge(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438] tabular-nums"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Mức độ ưu tiên (Priority) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'Tiêu chuẩn', label: 'Tiêu chuẩn (Normal)' },
                      { value: 'Cao', label: 'Ưu tiên cao (High)' },
                      { value: 'Khẩn cấp', label: 'Khẩn cấp (Urgent)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`py-1.5 px-2.5 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
                        priority === opt.value
                          ? opt.value === 'Khẩn cấp'
                            ? 'bg-[#FDF2F3] border-[#D85D68] text-[#C03A47] font-semibold'
                            : 'bg-[#E5F1EC] border-[#2F6F64] text-[#2F6F64] font-semibold'
                          : 'bg-white border-[#E1E9E6] text-[#687A78]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Khu vực / Phường (Service Area) *
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                >
                  {DISTRICT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Địa chỉ ngắn gọn & SĐT liên hệ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số nhà, tên đường"
                    className="col-span-2 px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                  />
                  <input
                    type="text"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="SĐT"
                    className="px-2.5 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[12px] text-[#253438] tabular-nums"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[12px] font-medium text-[#253438] mb-1">
                  Ghi chú vận hành ngắn gọn (Operational Note)
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Ghi chú hướng dẫn tiếp cận địa điểm hoặc dụng cụ cần mang theo..."
                  className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438]"
                />
              </div>
            </div>
          </div>

          {/* SECTION B: Scheduling Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#2F6F64] uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#E5F1EC] text-[#2F6F64] inline-flex items-center justify-center text-[11px]">
                B
              </span>
              Thông tin Lịch hẹn & Kỹ năng (Scheduling Information)
            </div>
            <div className="bg-[#F7FAF9] p-4 rounded-lg border border-[#E1E9E6] space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#253438] mb-1">
                    Ngày yêu cầu (Requested Date) *
                  </label>
                  <input
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#253438] mb-1">
                    Thời lượng dự kiến (phút, tối đa 480p) *
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={480}
                    value={estimatedDurationMin}
                    onChange={(e) => setEstimatedDurationMin(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#253438] mb-1">
                    Giờ bắt đầu mong muốn (Start Time) *
                  </label>
                  <input
                    type="time"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#253438] mb-1">
                    Giờ kết thúc khung hẹn (End Time) *
                  </label>
                  <input
                    type="time"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-[#E1E9E6] bg-white text-[13px] text-[#253438] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-medium text-[#253438] flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-[#2F6F64]" />
                    Kỹ năng chuyên môn bắt buộc (Required Skills) *
                  </label>
                  <span className="text-[11px] text-[#687A78]">
                    Đã chọn: {selectedSkills.length} kỹ năng
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SKILL_OPTIONS.map((sk) => {
                    const active = selectedSkills.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => toggleSkill(sk)}
                        className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#2F6F64] text-white border-[#2F6F64]'
                            : 'bg-white text-[#687A78] border-[#E1E9E6] hover:border-[#2F6F64]'
                        }`}
                      >
                        {sk}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION C: Review & Validation */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#2F6F64] uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-[#E5F1EC] text-[#2F6F64] inline-flex items-center justify-center text-[11px]">
                C
              </span>
              Kiểm tra Điều kiện Sẵn sàng (Readiness Validation)
            </div>

            {validationState.errors.length > 0 ? (
              <div className="p-3.5 rounded-lg bg-[#FDF2F3] border border-[#F2C6CB] text-[12px] text-[#C03A47] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Vui lòng hoàn thiện các điều kiện bắt buộc:
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {validationState.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-[#E5F1EC]/50 border border-[#C6DFD7] text-[12px] text-[#253438] space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    {serviceName} · {patientName}
                  </span>
                  <span className="text-[#2F6F64] tabular-nums">
                    {requestedDate} ({windowStart} – {windowEnd})
                  </span>
                </div>
                <div className="text-[#687A78] flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#2F6F64]" /> {district}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-[#2F6F64]" /> Thời lượng: {estimatedDurationMin} phút
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#2E755D] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đạt chuẩn gửi sang Đề xuất AI
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E1E9E6] flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-[#E1E9E6] bg-white text-[#253438] text-[13px] font-medium hover:bg-[#F7FAF9] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!validationState.isValid}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2F6F64] bg-white text-[#2F6F64] text-[13px] font-semibold hover:bg-[#E5F1EC] disabled:opacity-40 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isEditing ? 'Lưu Thay đổi' : 'Lưu Yêu cầu'}
            </button>
            <button
              type="button"
              disabled={!validationState.isValid}
              onClick={handleSaveAndSendToAI}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2F6F64] text-white text-[13px] font-semibold hover:bg-[#255A51] disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Lưu & Gửi sang Đề xuất AI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
