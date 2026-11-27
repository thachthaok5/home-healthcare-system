import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  CalendarClock,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  Calendar,
  HeartPulse,
  RefreshCw,
  CheckCircle2,
  X,
  MapPin,
  Siren,
  ArrowRight,
  Flame,
} from 'lucide-react';
import {
  AICandidate,
  DashboardKPIData,
  DispatchAssignment,
  DSSWeights,
  MedicalStaff,
  OptimizationResult,
  OverrideLog,
  OverrideReasonCode,
  UnassignedRequest,
} from './types/healthcare';
import { CareFlowRoute } from './components/careflow/SharedUI';
import { OverviewPage } from './components/careflow/OverviewPage';
import { RecommendationsPage } from './components/careflow/RecommendationsPage';
import { DispatchBoardPage } from './components/careflow/DispatchBoardPage';
import { RouteMapPage } from './components/careflow/RouteMapPage';
import { CareRequestsPage } from './components/careflow/CareRequestsPage';
import { CareTeamPage } from './components/careflow/CareTeamPage';
import { ReportsPage } from './components/careflow/ReportsPage';
import { NewRequestDrawer } from './components/careflow/NewRequestDrawer';

interface NavItem {
  route: CareFlowRoute;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  urgentCount?: number;
}

const resolveInitialRoute = (): CareFlowRoute => {
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/recommendations')) return '/recommendations';
  if (path.startsWith('/dispatch')) return '/dispatch';
  if (path.startsWith('/routes') || path.startsWith('/map')) return '/routes';
  if (path.startsWith('/requests')) return '/requests';
  if (path.startsWith('/team')) return '/team';
  if (path.startsWith('/reports')) return '/reports';
  return '/overview';
};

export function App() {
  const [currentRoute, setCurrentRoute] = useState<CareFlowRoute>(resolveInitialRoute);
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-15');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [newRequestDrawerOpen, setNewRequestDrawerOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState<string | null>(null);

  // Operational State from Backend API
  const [staffList, setStaffList] = useState<MedicalStaff[]>([]);
  const [assignments, setAssignments] = useState<DispatchAssignment[]>([]);
  const [unassignedRequests, setUnassignedRequests] = useState<UnassignedRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('REQ-201');
  const [dssWeights, setDssWeights] = useState<DSSWeights>({
    skillFit: 0.3,
    timeFit: 0.25,
    distance: 0.2,
    workload: 0.15,
    continuity: 0.1,
  });
  const [overrideLogs, setOverrideLogs] = useState<OverrideLog[]>([]);
  const [kpiData, setKpiData] = useState<DashboardKPIData | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reviewed recommendations log for current coordinator session
  const [reviewedRecords, setReviewedRecords] = useState<
    {
      requestId: string;
      patientName: string;
      serviceName: string;
      district: string;
      requestedWindow: string;
      priority: string;
      assignedStaffName: string;
      suitabilityScore: number;
      status: 'Confirmed' | 'Rejected';
      reviewedAt: string;
    }[]
  >([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Navigate between the 6 distinct pages and sync browser URL path
  const handleNavigate = useCallback((route: CareFlowRoute, requestId?: string) => {
    setCurrentRoute(route);
    if (requestId) {
      setSelectedRequestId(requestId);
    }
    try {
      window.history.pushState({}, '', route);
    } catch {
      // Ignore pushState restrictions in sandboxed environments
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(resolveInitialRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Fetch initial state & KPIs from Express backend
  const fetchSystemState = useCallback(async () => {
    try {
      setIsLoading(true);
      const dateQs = selectedDate ? `?target_date=${selectedDate}` : '';
      const [stateRes, kpiRes] = await Promise.all([
        fetch(`/api/v1/coordinator/dispatch-state${dateQs}`),
        fetch(`/api/v1/coordinator/kpis${dateQs}`),
      ]);

      const isJsonResponse = (res: Response) =>
        res.ok && (res.headers.get('content-type') || '').includes('application/json');

      if (isJsonResponse(stateRes)) {
        const data = await stateRes.json();
        setStaffList(data.staffList || []);
        setAssignments(data.assignments || []);
        setUnassignedRequests(data.unassignedRequests || []);
        setDssWeights(
          data.dssWeights || {
            skillFit: 0.3,
            timeFit: 0.25,
            distance: 0.2,
            workload: 0.15,
            continuity: 0.1,
          }
        );
        setOverrideLogs(data.overrideLogs || []);

        if (data.targetDate && data.targetDate !== selectedDate) {

          setSelectedDate(data.targetDate);

        }
        if (data.unassignedRequests?.length > 0) {
          setSelectedRequestId((prev) =>
            data.unassignedRequests.some((r: UnassignedRequest) => r.id === prev)
              ? prev
              : data.unassignedRequests[0].id
          );
        }
      }

      if (isJsonResponse(kpiRes)) {
        const kData = await kpiRes.json();
        setKpiData(kData);
      }


    } catch (err) {
      console.error('Error fetching CareFlow state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemState();
  }, [fetchSystemState]);

  // Update DSS weights via backend
  const handleUpdateWeights = async (newWeights: DSSWeights) => {
    try {
      const dateQs = selectedDate ? `?target_date=${selectedDate}` : '';
      let res = await fetch(`/api/v1/coordinator/evaluate-dss${dateQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights: {
            skill: newWeights.skillFit,
            time: newWeights.timeFit,
            distance: newWeights.distance,
            workload: newWeights.workload,
            continuity: newWeights.continuity,
          },
        }),
      });
      if (!res.ok) {
        res = await fetch('/api/dss/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weights: newWeights }),
        });
      }
      if (res.ok) {
        const data = await res.json();
        setDssWeights(data.dssWeights || newWeights);
        setUnassignedRequests(data.unassignedRequests || []);
        showToast('Đã cập nhật trọng số DSS và tính toán lại điểm phù hợp của ứng viên.');
      }
    } catch (err) {
      console.error('Error updating DSS weights:', err);
    }
  };

  // Confirm assignment (Accept Top 1 or Coordinator Override)
  const handleConfirmAssignment = async (
    requestId: string,
    candidate: AICandidate,
    isOverride: boolean,
    overrideCategory?: string,
    overrideReason?: string,
    overrideReasonCode?: OverrideReasonCode
  ) => {
    const targetReq = unassignedRequests.find((r) => r.id === requestId);
    const nowTime = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      let res = await fetch('/api/v1/coordinator/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          employee_id: candidate.staffId,
          is_override: isOverride,
          reason_code: overrideReasonCode || 'skill',
          override_notes: overrideReason || 'Xác nhận từ màn hình Đề xuất AI',
        }),
      });
      if (!res.ok) {
        res = await fetch('/api/v1/assignments/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            staffId: candidate.staffId,
            isOverride,
            overrideReasonCode: overrideReasonCode || 'skill',
            overrideCategory: overrideCategory || 'Điều phối viên Xác nhận',
            overrideNotes: overrideReason || 'Xác nhận từ màn hình Đề xuất AI',
            dispatcherName: 'Điều phối viên Trần Thu Hà',
          }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staffList);
        setAssignments(data.assignments);
        setUnassignedRequests(data.unassignedRequests);
        setOverrideLogs(data.overrideLogs || overrideLogs);

        if (targetReq) {
          setReviewedRecords((prev) => [
            {
              requestId: targetReq.id,
              patientName: targetReq.patientName,
              serviceName: targetReq.serviceName,
              district: targetReq.district,
              requestedWindow: targetReq.requestedWindow,
              priority: targetReq.priority,
              assignedStaffName: candidate.staffName,
              suitabilityScore: candidate.totalScore,
              status: 'Confirmed',
              reviewedAt: nowTime,
            },
            ...prev,
          ]);
        }

        if (data.unassignedRequests?.length > 0) {
          setSelectedRequestId(data.unassignedRequests[0].id);
        }

        // Identify the newly created/updated assignment on the timeline
        const matchedAsg = (data.assignments || []).find(
          (a: DispatchAssignment) =>
            (targetReq && a.patientName === targetReq.patientName) ||
            (targetReq && a.patientId === targetReq.patientId) ||
            a.notes?.includes(requestId) ||
            (a.staffId === candidate.staffId && targetReq && a.patientName === targetReq.patientName)
        ) || (data.assignments && data.assignments[data.assignments.length - 1]);

        if (matchedAsg) {
          setHighlightedAssignmentId(matchedAsg.id);
        }

        showToast(
          `Đã xác nhận phân công: ${requestId} giao cho ${candidate.staffName}! Đang hiển thị vị trí trên Timeline.`
        );

        // Seamlessly navigate to Dispatch Board to show where it was scheduled
        handleNavigate('/dispatch');
      }
    } catch (err) {
      console.error('Error confirming assignment:', err);
    }
  };

  // Reject / Defer AI suggestion
  const handleRejectSuggestion = (requestId: string, reason: string) => {
    const targetReq = unassignedRequests.find((r) => r.id === requestId);
    if (!targetReq) return;
    const nowTime = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const topCand = targetReq.aiCandidates[0];

    setReviewedRecords((prev) => [
      {
        requestId: targetReq.id,
        patientName: targetReq.patientName,
        serviceName: targetReq.serviceName,
        district: targetReq.district,
        requestedWindow: targetReq.requestedWindow,
        priority: targetReq.priority,
        assignedStaffName: topCand ? `${topCand.staffName} (Từ chối)` : 'Chưa gán',
        suitabilityScore: topCand?.totalScore || 0,
        status: 'Rejected',
        reviewedAt: nowTime,
      },
      ...prev,
    ]);

    showToast(`Đã tạm hoãn yêu cầu ${requestId} để xử lý thủ công: "${reason}"`);
  };

  // Resolve schedule conflict on Dispatch Board
  const handleResolveConflict = async (
    assignmentId: string,
    newStartTime: string,
    newEndTime: string,
    newStaffId?: string
  ) => {
    try {
      let res = await fetch('/api/v1/coordinator/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          new_start_time: newStartTime,
          new_end_time: newEndTime,
          new_staff_id: newStaffId,
        }),
      });
      if (!res.ok) {
        res = await fetch('/api/dispatch/resolve-conflict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId,
            newStartTime,
            newEndTime,
            newStaffId,
          }),
        });
      }
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staffList);
        setAssignments(data.assignments);
        setUnassignedRequests(data.unassignedRequests);
        showToast(`Đã xử lý xung đột lịch trình cho ${assignmentId} (${newStartTime}–${newEndTime}).`);
      }
    } catch (err) {
      console.error('Error resolving conflict:', err);
    }
  };

  // Reassign visit on Dispatch Board
  const handleReassignVisit = (assignmentId: string, newStaffId: string) => {
    const targetStaff = staffList.find((s) => s.id === newStaffId);
    if (!targetStaff) return;
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              staffId: targetStaff.id,
              staffName: targetStaff.name,
              isConflict: false,
            }
          : a
      )
    );
    showToast(`Đã chuyển ca ${assignmentId} sang ${targetStaff.name}.`);
  };

  // Create new Care Request
  const handleCreateNewRequest = (
    partial: Partial<UnassignedRequest>,
    sendToAI?: boolean
  ) => {
    const templateCandidates = unassignedRequests[0]?.aiCandidates || [];
    const newReq: UnassignedRequest = {
      id: partial.id || `REQ-${Math.floor(300 + Math.random() * 600)}`,
      patientId: partial.patientId || 'BN-9012',
      patientName: partial.patientName || 'Nguyễn Văn Minh',
      patientAge: partial.patientAge || 68,
      patientPhone: partial.patientPhone || '0905 412 889',
      district: partial.district || 'Phường Lộc Thọ',
      address: partial.address || '42 Trần Phú, Phường Lộc Thọ',
      location: partial.location || { lat: 12.2388, lng: 109.1967 },
      serviceName: partial.serviceName || 'Thay băng & Cắt chỉ vết mổ phức tạp',
      serviceCategory: partial.serviceCategory || 'Chăm sóc vết thương',
      requestedWindow: partial.requestedWindow || '10:00 - 11:30',
      windowStart: partial.windowStart || '10:00',
      windowEnd: partial.windowEnd || '11:30',
      preferredStart: partial.preferredStart || '10:00',
      suggestedStartTime: partial.suggestedStartTime || '10:00',
      standardDurationMin: partial.standardDurationMin || 45,
      predictedDurationMin: partial.predictedDurationMin || 55,
      predictionConfidencePct: 91,
      predictionFactors: partial.predictionFactors || ['Mức độ bệnh lý nền (+10p)'],
      durationBreakdown: partial.durationBreakdown || [],
      priority: partial.priority || 'Cao',
      clinicalSeverity: partial.clinicalSeverity || 'Cấp độ 2 - Trung bình',
      specializedEquipment: partial.specializedEquipment || ['Bộ chăm sóc vô khuẩn'],
      requiredSkills: partial.requiredSkills || ['Chăm sóc vết thương'],
      clinicalNotes: partial.clinicalNotes || '',
      historicalVisits: {},
      status: 'Unassigned',
      aiCandidates: templateCandidates,
    };

    setUnassignedRequests((prev) => [newReq, ...prev]);
    setSelectedRequestId(newReq.id);
    if (sendToAI) {
      handleNavigate('/recommendations', newReq.id);
      showToast(`Đã tạo yêu cầu ${newReq.id} và chuyển sang màn hình Đề xuất AI.`);
    } else {
      showToast(`Đã tạo yêu cầu chăm sóc ${newReq.id}. Sẵn sàng đánh giá đề xuất AI.`);
    }
  };

  // Update existing Care Request
  const handleUpdateRequest = (
    updated: Partial<UnassignedRequest>,
    sendToAI?: boolean
  ) => {
    if (!updated.id) return;
    setUnassignedRequests((prev) =>
      prev.map((req) => (req.id === updated.id ? { ...req, ...updated } : req))
    );
    setAssignments((prev) =>
      prev.map((asg) =>
        asg.id === updated.id
          ? {
              ...asg,
              patientName: updated.patientName || asg.patientName,
              patientAge: updated.patientAge || asg.patientAge,
              serviceName: updated.serviceName || asg.serviceName,
              serviceCategory: updated.serviceCategory || asg.serviceCategory,
              district: updated.district || asg.district,
              address: updated.address || asg.address,
              priority: (updated.priority as DispatchAssignment['priority']) || asg.priority,
              predictedDurationMin: updated.predictedDurationMin || asg.predictedDurationMin,
            }
          : asg
      )
    );
    if (sendToAI) {
      handleNavigate('/recommendations', updated.id);
      showToast(`Đã cập nhật yêu cầu ${updated.id} và mở Đề xuất AI.`);
    } else {
      showToast(`Đã lưu cập nhật cho yêu cầu chăm sóc ${updated.id}.`);
    }
  };

  // Add new staff member
  const handleAddStaff = (newStaff: MedicalStaff) => {
    setStaffList((prev) => [...prev, newStaff]);
    showToast(`Đã thêm ${newStaff.name} (${newStaff.id}) vào Đội ngũ Y tế.`);
  };

  // Update existing staff member
  const handleUpdateStaff = (updatedStaff: MedicalStaff) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s))
    );
    showToast(`Đã cập nhật hồ sơ & lịch trực của ${updatedStaff.name} (${updatedStaff.id}).`);
  };

  // Run & Apply Optimization in Reports
  const handleRunOptimization = async () => {
    let res = await fetch('/api/v1/coordinator/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_date: selectedDate,
        allow_time_window: true,
        weights: {
          travelWeight: 40,
          workloadBalanceWeight: 30,
          continuityWeight: 20,
          slaPenaltyWeight: 10,
        },
      }),
    });
    if (!res.ok) {
      res = await fetch('/api/optimization/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights: {
            travelWeight: 40,
            workloadBalanceWeight: 30,
            continuityWeight: 20,
            slaPenaltyWeight: 10,
          },
        }),
      });
    }
    if (res.ok) {
      const data = await res.json();
      setOptimizationResult(data);
      if (data.staffList) setStaffList(data.staffList);
      if (data.assignments) setAssignments(data.assignments);
      if (data.unassignedRequests) setUnassignedRequests(data.unassignedRequests);
      showToast('Đã hoàn tất chạy tối ưu hóa lộ trình và cân bằng tải bằng Google OR-Tools CP-SAT.');
    }
  };

  const handleApplyOptimization = async () => {
    const res = await fetch('/api/optimization/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      setStaffList(data.staffList);
      setAssignments(data.assignments);
      setUnassignedRequests(data.unassignedRequests);
      if (optimizationResult) {
        setOptimizationResult({ ...optimizationResult, isApplied: true });
      }
      showToast('Đã áp dụng lịch trình tối ưu cho toàn bộ đội ngũ y tế.');
    }
  };

  // Ca Khẩn cấp chưa phân công: hiển thị thanh cảnh báo đỏ + badge đỏ trên sidebar
  const urgentRequests = unassignedRequests.filter((r) => r.priority === 'Khẩn cấp');

  // Navigation items (Section 4.1 — 6 Distinct Pages)
  const navItems: NavItem[] = [
    {
      route: '/overview',
      label: 'Tổng quan Vận hành',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      route: '/recommendations',
      label: 'Đề xuất AI (DSS)',
      icon: <Sparkles className="w-4 h-4" />,
      badgeCount: unassignedRequests.length,
      urgentCount: urgentRequests.length,
    },
    {
      route: '/dispatch',
      label: 'Bảng Điều phối',
      icon: <CalendarClock className="w-4 h-4" />,
      badgeCount: assignments.filter((a) => a.isConflict).length || undefined,
    },
    {
      route: '/routes',
      label: 'Bản đồ Lộ trình',
      icon: <MapPin className="w-4 h-4" />,
    },
    {
      route: '/requests',
      label: 'Yêu cầu Chăm sóc',
      icon: <ClipboardList className="w-4 h-4" />,
      urgentCount: urgentRequests.length,
    },
    {
      route: '/team',
      label: 'Đội ngũ Y tế',
      icon: <Users className="w-4 h-4" />,
    },
    {
      route: '/reports',
      label: 'Báo cáo & Kiểm toán',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  const currentPageLabel =
    navItems.find((n) => n.route === currentRoute)?.label || 'Tổng quan Vận hành';

  const alertCount =
    assignments.filter((a) => a.isConflict).length +
    unassignedRequests.filter((r) => r.priority === 'Khẩn cấp').length;

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalSearch.trim().toUpperCase();
    if (!q) return;
    const matchUnassigned = unassignedRequests.find(
      (r) =>
        r.id.toUpperCase().includes(q) ||
        r.patientName.toUpperCase().includes(q)
    );
    if (matchUnassigned) {
      handleNavigate('/recommendations', matchUnassigned.id);
      return;
    }
    const matchStaff = staffList.find(
      (s) =>
        s.id.toUpperCase().includes(q) || s.name.toUpperCase().includes(q)
    );
    if (matchStaff) {
      handleNavigate('/team');
      return;
    }
    handleNavigate('/requests');
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* =====================================================================
          4.1 PERSISTENT LEFT SIDEBAR (236px wide)
          ===================================================================== */}
      <aside className="w-[248px] shrink-0 bg-gradient-to-b from-brand-100 via-brand-50 to-white border-r border-line flex flex-col justify-between sticky top-0 h-screen z-30">
        {/* Sidebar Top: Brand Identity */}
        <div>
          <div className="h-16 px-5 border-b border-line flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shrink-0 shadow-float">
              <HeartPulse className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sun-400 border-2 border-white" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[18px] font-semibold text-brand-800 leading-tight tracking-tight">
                CareFlow
              </div>
              <div className="text-[11px] text-muted truncate">
                Điều phối Y tế Tại nhà
              </div>
            </div>
          </div>

          {/* Primary Navigation Items (6 Distinct Pages) */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-700/70">
              Không gian Điều phối
            </div>
            {navItems.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNavigate(item.route)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-float'
                      : 'text-ink-soft hover:bg-white/80 hover:text-brand-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-white' : 'text-brand-600'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    {item.urgentCount !== undefined && item.urgentCount > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-urgent text-white animate-urgent-pulse"
                        title={`${item.urgentCount} ca Khẩn cấp chưa phân công`}
                        aria-label={`${item.urgentCount} ca Khẩn cấp chưa phân công`}
                      >
                        <Flame className="w-3 h-3" />
                        {item.urgentCount}
                      </span>
                    )}
                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                          item.route === '/dispatch'
                            ? 'bg-conflict-tint text-conflict'
                            : isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-lav-100 text-lav-700'
                        }`}
                      >
                        {item.badgeCount}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Settings & Coordinator Profile Summary */}
        <div className="p-3 border-t border-line space-y-2">
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted hover:bg-white hover:text-ink transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Cấu hình Hệ thống</span>
          </button>

          <div className="px-3 py-2.5 rounded-lg bg-white border border-line flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sun-400 text-sun-700 text-[12px] font-bold flex items-center justify-center shrink-0">
              TH
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-ink truncate">
                Trần Thu Hà
              </div>
              <div className="text-[11px] text-muted truncate">
                Điều phối viên Trưởng
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT MAIN AREA: TOP HEADER (64px) + MAIN CONTENT CANVAS
          ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 4.2 Top Header (64px high) */}
        <header className="h-16 bg-white/85 backdrop-blur border-b border-line px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          {/* Left: Current Page Title / Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">CareFlow</span>
            <span className="text-line-strong">/</span>
            <span className="font-semibold text-ink">{currentPageLabel}</span>
            <span className="hidden md:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded text-[11px] bg-canvas text-muted border border-line font-mono-num">
              {currentRoute}
            </span>
          </div>

          {/* Center/Right: Global Search + Shift/Date Context + Notifications + User Avatar */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleGlobalSearchSubmit} className="relative hidden sm:block w-64">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm nhanh REQ-ID, bệnh nhân, nhân sự..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-line bg-canvas text-[12px] text-ink focus:bg-white focus:border-brand-600 outline-none"
              />
            </form>

            {/* Date / Shift Context Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas border border-line text-[12px] text-ink tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              <span>{selectedDate}</span>
              <span className="text-line-strong">|</span>
              <span className="text-brand-600 font-medium">Ca ngày (07:00–19:00)</span>
            </div>

            {/* Notification Icon */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-line bg-white text-muted hover:text-ink hover:border-brand-600 cursor-pointer"
                title="Cảnh báo Vận hành"
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-urgent text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {alertCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-[10px] border border-line shadow-lg p-3 z-50 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="text-[12px] font-semibold text-ink">
                      Cảnh báo Điều phối ({alertCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[11px] text-muted cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                  {assignments
                    .filter((a) => a.isConflict)
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          handleNavigate('/dispatch');
                        }}
                        className="p-2 rounded-lg bg-conflict-tint border-l-4 border-conflict text-[12px] cursor-pointer"
                      >
                        <div className="font-bold text-conflict">
                          Trùng lịch: {c.staffName} ({c.id})
                        </div>
                        <div className="text-[11px] text-muted">
                          Trùng {c.conflictDetail?.overlapMinutes} phút lúc {c.startTime}
                        </div>
                      </div>
                    ))}
                  {unassignedRequests
                    .filter((r) => r.priority === 'Khẩn cấp')
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          handleNavigate('/recommendations', u.id);
                        }}
                        className="p-2 rounded-lg bg-urgent-tint border-l-4 border-urgent text-[12px] cursor-pointer"
                      >
                        <div className="font-bold text-urgent-ink">
                          Yêu cầu Khẩn cấp: {u.id} ({u.patientName})
                        </div>
                        <div className="text-[11px] text-muted">
                          {u.serviceName} · Khung giờ {u.requestedWindow}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Refresh State Button */}
            <button
              type="button"
              onClick={fetchSystemState}
              className="p-2 rounded-lg border border-line bg-white text-muted hover:text-brand-600 cursor-pointer"
              title="Làm mới dữ liệu điều phối"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-brand-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* Toast Feedback Banner */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-lg border border-brand-600 flex items-center gap-2.5 text-[13px]">
            <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-line-strong hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Thanh cảnh báo Khẩn cấp: chỉ hiện khi còn ca Khẩn cấp chưa phân công */}
        {urgentRequests.length > 0 && (
          <div
            role="alert"
            className="sticky top-16 z-10 bg-urgent text-white px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 shadow-urgent"
          >
            <span className="relative flex w-8 h-8 items-center justify-center rounded-full bg-white/20 shrink-0">
              <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
              <Siren className="w-4 h-4 relative" />
            </span>
            <div className="flex-1 min-w-[220px]">
              <div className="font-display text-[15px] font-semibold leading-tight">
                {urgentRequests.length} ca Khẩn cấp đang chờ phân công
              </div>
              <div className="text-[12px] text-white/85 truncate">
                {urgentRequests
                  .slice(0, 3)
                  .map((r) => `${r.id} · ${r.patientName} · ${r.requestedWindow}`)
                  .join('   |   ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleNavigate('/recommendations', urgentRequests[0].id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-urgent-ink text-[13px] font-bold hover:bg-urgent-tint cursor-pointer focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              Phân công ngay
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Canvas (Padding 24px–32px) */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {currentRoute === '/overview' && (
            <OverviewPage
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              assignments={assignments}
              unassignedRequests={unassignedRequests}
              onNavigate={handleNavigate}
              onOpenNewRequest={() => setNewRequestDrawerOpen(true)}
            />
          )}

          {currentRoute === '/recommendations' && (
            <RecommendationsPage
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              unassignedRequests={unassignedRequests}
              reviewedRecords={reviewedRecords}
              staffList={staffList}
              selectedRequestId={selectedRequestId}
              onSelectRequest={setSelectedRequestId}
              dssWeights={dssWeights}
              onUpdateWeights={handleUpdateWeights}
              onConfirmAssignment={handleConfirmAssignment}
              onRejectSuggestion={handleRejectSuggestion}
            />
          )}

          {currentRoute === '/dispatch' && (
            <DispatchBoardPage
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              staffList={staffList}
              assignments={assignments}
              unassignedRequests={unassignedRequests}
              onNavigate={handleNavigate}
              onResolveConflict={handleResolveConflict}
              onReassignVisit={handleReassignVisit}
              highlightedAssignmentId={highlightedAssignmentId}
              onClearHighlight={() => setHighlightedAssignmentId(null)}
            />
          )}

          {currentRoute === '/routes' && (
            <RouteMapPage
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              staffList={staffList}
              assignments={assignments}
              unassignedRequests={unassignedRequests}
              onNavigate={handleNavigate}
            />
          )}

          {currentRoute === '/requests' && (
            <CareRequestsPage
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              unassignedRequests={unassignedRequests}
              assignments={assignments}
              onOpenNewRequest={() => setNewRequestDrawerOpen(true)}
              onUpdateRequest={handleUpdateRequest}
              onNavigate={handleNavigate}
            />
          )}

          {currentRoute === '/team' && (
            <CareTeamPage
              staffList={staffList}
              assignments={assignments}
              onAddStaff={handleAddStaff}
              onUpdateStaff={handleUpdateStaff}
              onNavigate={handleNavigate}
            />
          )}

          {currentRoute === '/reports' && (
            <ReportsPage
              staffList={staffList}
              assignments={assignments}
              unassignedRequests={unassignedRequests}
              overrideLogs={overrideLogs}
              kpiData={kpiData}
              optimizationResult={optimizationResult}
              onRunOptimization={handleRunOptimization}
              onApplyOptimization={handleApplyOptimization}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

      {/* Multi-Section New Care Request Drawer */}
      <NewRequestDrawer
        open={newRequestDrawerOpen}
        onClose={() => setNewRequestDrawerOpen(false)}
        onSubmitRequest={handleCreateNewRequest}
      />

      {/* Settings Modal (DSS Weights & Constraint Configuration) */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <div className="bg-white rounded-[12px] border border-line max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-[16px] font-semibold text-ink m-0">
                  Cấu hình Hệ thống Điều phối CareFlow
                </h3>
                <p className="text-[12px] text-muted m-0">
                  Thông số ca trực vận hành và bộ trọng số đánh giá DSS
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="text-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-[13px]">
              <div className="p-3 rounded-lg bg-canvas border border-line space-y-1.5">
                <div className="font-semibold text-ink">
                  Trần Ràng buộc Cứng (Hard Constraints)
                </div>
                <div className="text-[12px] text-muted">
                  Thời lượng làm việc tối đa: <strong>480 phút (8.0 giờ)</strong> / ca trực
                </div>
                <div className="text-[12px] text-muted">
                  Kiểm duyệt con người (Human-in-the-loop): <strong>Bắt buộc cho mọi phân công</strong>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-canvas border border-line space-y-1.5">
                <div className="font-semibold text-ink">
                  Trọng số Chấm điểm Mềm DSS Hiện tại
                </div>
                <div className="grid grid-cols-2 gap-1 text-[12px] text-muted tabular-nums">
                  <span>Độ khớp kỹ năng: {Math.round(dssWeights.skillFit * 100)}%</span>
                  <span>Độ khít thời gian: {Math.round(dssWeights.timeFit * 100)}%</span>
                  <span>Khoảng cách: {Math.round(dssWeights.distance * 100)}%</span>
                  <span>Cân bằng tải: {Math.round(dssWeights.workload * 100)}%</span>
                  <span>Tính liên tục: {Math.round(dssWeights.continuity * 100)}%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-[13px] font-semibold cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
