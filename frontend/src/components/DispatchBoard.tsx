import React, { useState, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventContentArg, EventClickArg } from '@fullcalendar/core';
import {
  App as AntdApp,
  Select,
  DatePicker,
  Modal,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import {
  AlertTriangle,
  Sparkles,
  Layers,
  Code2,
  Calendar,
} from 'lucide-react';
import {
  MedicalStaff,
  DispatchAssignment,
  UnassignedRequest,
  AssignmentStatus,
  AICandidate,
} from '../types/healthcare';
import { AIRecommendationDrawer } from './AIRecommendationDrawer';
import { DSSButton, DSSBadge, getStaffInitials } from './dss/DSSComponents';

interface DispatchBoardProps {
  staffList: MedicalStaff[];
  assignments: DispatchAssignment[];
  unassignedRequests: UnassignedRequest[];
  onAssignRequest: (
    req: UnassignedRequest,
    chosenCandidate?: AICandidate,
    isOverride?: boolean,
    overrideCategory?: string,
    overrideReason?: string
  ) => void;
  onUpdateAssignmentStatus: (assignmentId: string, newStatus: AssignmentStatus) => void;
  onResolveConflict: (assignmentId: string) => void;
  onOpenAISuggest: (req?: UnassignedRequest) => void;
}

/**
 * Semantic Color Mapping for Schedule Events:
 * - Ca bị trùng lịch / vi phạm time window (Danger): #D93843
 * - Ca đang chờ / Proposed (Warning): #D9822B
 * - Ca đã chốt / Confirmed & In-Progress (Primary): #4B5850
 * - Ca hoàn thành / Completed (Success): #2D7D46
 */
function getSemanticEventStyle(asg: DispatchAssignment) {
  if (asg.isConflict) {
    return {
      backgroundColor: '#FCE8E9',
      borderColor: '#D93843',
      textColor: '#9E1F28',
      badgeText: 'Trùng lịch (Danger)',
      badgeBg: '#D93843',
    };
  }
  if (asg.status === 'Proposed') {
    return {
      backgroundColor: '#FEF3E6',
      borderColor: '#D9822B',
      textColor: '#8A4D0F',
      badgeText: 'Đang chờ (Warning)',
      badgeBg: '#D9822B',
    };
  }
  if (asg.status === 'Completed') {
    return {
      backgroundColor: '#E6F4EA',
      borderColor: '#2D7D46',
      textColor: '#1E5A31',
      badgeText: 'Hoàn thành (Success)',
      badgeBg: '#2D7D46',
    };
  }
  // Confirmed or In-Progress -> Primary (#4B5850)
  return {
    backgroundColor: '#4B5850',
    borderColor: '#3C4740',
    textColor: '#FFFFFF',
    badgeText: asg.status === 'In-Progress' ? 'Đang khám (Primary)' : 'Đã chốt (Primary)',
    badgeBg: '#2E3732',
  };
}

export const DispatchBoard: React.FC<DispatchBoardProps> = ({
  staffList,
  assignments,
  unassignedRequests,
  onAssignRequest,
  onUpdateAssignmentStatus,
  onResolveConflict,
}) => {
  const { message } = AntdApp.useApp();
  const calendarRef = useRef<FullCalendar | null>(null);

  // Filters & View Mode
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs('2026-10-17'));
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [calendarView, setCalendarView] = useState<'resourceTimelineDay' | 'timeGridDay'>(
    'resourceTimelineDay'
  );
  const [showJsonPreview, setShowJsonPreview] = useState<boolean>(false);
  const [showKanbanDrawer, setShowKanbanDrawer] = useState<boolean>(false);

  // Selected Assignment for Detail Modal
  const [detailAssignment, setDetailAssignment] = useState<DispatchAssignment | null>(null);

  // Selected Unassigned Request for AI Inspection Drawer
  const [aiInspectRequest, setAiInspectRequest] = useState<UnassignedRequest | null>(null);

  // Conflict Explanation Modal
  const [activeConflictAssignment, setActiveConflictAssignment] = useState<DispatchAssignment | null>(null);

  const handleViewChange = (newView: 'resourceTimelineDay' | 'timeGridDay') => {
    setCalendarView(newView);
    const api = calendarRef.current?.getApi();
    if (api) {
      api.changeView(newView);
    }
  };

  // 1. Transform MedicalStaff[] JSON into FullCalendar Resources (Vertical Axis)
  const calendarResources = useMemo(() => {
    return staffList
      .filter((s) => selectedStaffFilter === 'ALL' || s.id === selectedStaffFilter)
      .map((s) => ({
        id: s.id,
        title: s.name,
        extendedProps: {
          role: s.role,
          zone: s.zone,
          workloadPct: s.workloadPct,
          shiftStart: s.shiftStart,
          shiftEnd: s.shiftEnd,
          avatarColor: s.avatarColor,
        },
      }));
  }, [staffList, selectedStaffFilter]);

  // 2. Transform DispatchAssignment[] JSON into FullCalendar Events (07:00 - 19:00)
  const calendarEvents = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');

    return assignments
      .filter((asg) => {
        if (selectedStaffFilter !== 'ALL' && asg.staffId !== selectedStaffFilter) {
          return false;
        }
        if (selectedStatusFilter !== 'ALL' && asg.status !== selectedStatusFilter) {
          return false;
        }
        return true;
      })
      .map((asg) => {
        const semantic = getSemanticEventStyle(asg);
        return {
          id: asg.id,
          resourceId: asg.staffId,
          title: asg.serviceName,
          start: `${dateStr}T${asg.startTime}:00`,
          end: `${dateStr}T${asg.endTime}:00`,
          backgroundColor: semantic.backgroundColor,
          borderColor: semantic.borderColor,
          textColor: semantic.textColor,
          extendedProps: {
            assignment: asg,
            semantic,
          },
        };
      });
  }, [assignments, selectedDate, selectedStaffFilter, selectedStatusFilter]);

  // Count conflict assignments
  const conflictCount = useMemo(() => {
    return assignments.filter((a) => a.isConflict).length;
  }, [assignments]);

  // Event Click Handler on FullCalendar
  const handleEventClick = (clickInfo: EventClickArg) => {
    const asg = clickInfo.event.extendedProps.assignment as DispatchAssignment;
    if (!asg) return;
    if (asg.isConflict) {
      setActiveConflictAssignment(asg);
    } else {
      setDetailAssignment(asg);
    }
  };

  // Custom Event Renderer inside FullCalendar blocks
  const renderEventContent = (eventInfo: EventContentArg) => {
    const asg = eventInfo.event.extendedProps.assignment as DispatchAssignment | undefined;
    if (!asg) return <span>{eventInfo.event.title}</span>;

    return (
      <div className="flex flex-col justify-between w-full overflow-hidden leading-tight py-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-[11px] truncate">
            {asg.serviceName}
          </span>
          {asg.isConflict && (
            <AlertTriangle className="w-3.5 h-3.5 text-[#D93843] shrink-0" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono-num opacity-90 mt-0.5">
          <span>
            {asg.startTime}–{asg.endTime}
          </span>
          <span className="font-sans truncate">{asg.patientName}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* 1. TOP CONTROL BAR & SEMANTIC LEGEND */}
      <div className="bg-white border border-[#DCE0DA] rounded-[8px] p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="dss-caption text-[#4B5850] uppercase flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>FullCalendar Resource Timeline & TimeGrid · Khung giờ 07:00 – 19:00</span>
            </div>
            <h1 className="dss-h1 mt-0.5 flex flex-wrap items-center gap-3">
              <span>Dispatch Board (Lịch Vận Hành Nhân Sự Y Tế)</span>
              {conflictCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstConflict = assignments.find((a) => a.isConflict);
                    if (firstConflict) setActiveConflictAssignment(firstConflict);
                  }}
                  className="dss-caption px-2.5 py-1 rounded-[6px] bg-[#FCE8E9] text-[#9E1F28] border border-[#D93843] hover:bg-[#F8D4D6] flex items-center gap-1.5 font-mono-num cursor-pointer transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#D93843]" strokeWidth={1.5} />
                  <span>{conflictCount} ca trùng lịch / vi phạm Time Window (Nhấn xử lý)</span>
                </button>
              )}
            </h1>
          </div>

          {/* View Switcher & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-[#F5F6F3] rounded-[8px] border border-[#DCE0DA]">
              <button
                type="button"
                onClick={() => handleViewChange('resourceTimelineDay')}
                className={`px-3 py-1 rounded-[6px] dss-caption transition-colors cursor-pointer ${
                  calendarView === 'resourceTimelineDay'
                    ? 'bg-[#4B5850] text-white'
                    : 'text-[#4A5750] hover:text-[#1F2924]'
                }`}
              >
                Resource Timeline (Gantt)
              </button>
              <button
                type="button"
                onClick={() => handleViewChange('timeGridDay')}
                className={`px-3 py-1 rounded-[6px] dss-caption transition-colors cursor-pointer ${
                  calendarView === 'timeGridDay'
                    ? 'bg-[#4B5850] text-white'
                    : 'text-[#4A5750] hover:text-[#1F2924]'
                }`}
              >
                TimeGrid (07:00–19:00)
              </button>
            </div>

            <DSSButton
              variant="outline"
              size="sm"
              icon={<Code2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
              onClick={() => setShowJsonPreview(!showJsonPreview)}
            >
              {showJsonPreview ? 'Ẩn JSON Events' : 'Xem JSON Events'}
            </DSSButton>

            <DSSButton
              variant="solid"
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />}
              onClick={() => {
                if (unassignedRequests.length > 0) {
                  setAiInspectRequest(unassignedRequests[0]);
                } else {
                  message.info('Tất cả yêu cầu hiện tại đã được phân công trên lịch.');
                }
              }}
            >
              AI Đề xuất ({unassignedRequests.length} ca chờ)
            </DSSButton>
          </div>
        </div>

        {/* Filters & Semantic Color Legend */}
        <div className="pt-3 border-t border-[#EAECE8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 dss-body2">
            <span className="font-semibold text-[#1F2924]">Bộ lọc:</span>
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              format="DD/MM/YYYY"
              allowClear={false}
              size="small"
              className="w-32"
            />
            <Select
              size="small"
              value={selectedStaffFilter}
              onChange={setSelectedStaffFilter}
              className="w-48"
              options={[
                { value: 'ALL', label: `Tất cả điều dưỡng/bác sĩ (${staffList.length})` },
                ...staffList.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              size="small"
              value={selectedStatusFilter}
              onChange={setSelectedStatusFilter}
              className="w-40"
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'Confirmed', label: 'Ca đã chốt (Primary)' },
                { value: 'Proposed', label: 'Ca đang chờ (Warning)' },
                { value: 'Completed', label: 'Hoàn thành (Success)' },
              ]}
            />
          </div>

          {/* Semantic Legend */}
          <div className="flex flex-wrap items-center gap-4 dss-body2">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-[#4B5850] inline-block" />
              <strong className="text-[#1F2924]">Ca đã chốt (Primary #4B5850)</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-[#FEF3E6] border border-[#D9822B] inline-block" />
              <strong className="text-[#8A4D0F]">Ca đang chờ (Warning #D9822B)</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-[#FCE8E9] border border-[#D93843] inline-block" />
              <strong className="text-[#9E1F28]">Trùng lịch / Vi phạm (Danger #D93843)</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[4px] bg-[#E6F4EA] border border-[#2D7D46] inline-block" />
              <strong className="text-[#1E5A31]">Hoàn thành (Success #2D7D46)</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible JSON Data Source Inspector */}
      {showJsonPreview && (
        <div className="bg-white border border-[#DCE0DA] rounded-[8px] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="dss-h2">
              Cấu trúc dữ liệu JSON Resources & Events truyền vào FullCalendar
            </span>
            <span className="dss-body2 font-mono-num">
              {calendarResources.length} resources · {calendarEvents.length} events
            </span>
          </div>
          <pre className="p-3 rounded-[8px] bg-[#F5F6F3] border border-[#DCE0DA] text-[11px] font-mono-num overflow-x-auto max-h-56 text-[#1F2924]">
            {JSON.stringify(
              {
                slotMinTime: '07:00:00',
                slotMaxTime: '19:00:00',
                resources: calendarResources.slice(0, 2),
                events: calendarEvents.slice(0, 3).map((e) => ({
                  id: e.id,
                  resourceId: e.resourceId,
                  title: e.title,
                  start: e.start,
                  end: e.end,
                  backgroundColor: e.backgroundColor,
                  borderColor: e.borderColor,
                })),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* 2. FULLCALENDAR RESOURCE TIMELINE / TIMEGRID WORKSPACE (07:00 - 19:00) */}
      <div className="bg-white border border-[#DCE0DA] rounded-[8px] p-4 overflow-x-auto">
        <FullCalendar
          ref={calendarRef}
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
          plugins={[resourceTimelinePlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarView}
          initialDate={selectedDate.format('YYYY-MM-DD')}
          headerToolbar={false}
          slotMinTime="07:00:00"
          slotMaxTime="19:00:00"
          slotDuration="01:00:00"
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          resourceAreaHeaderContent="Điều dưỡng / Bác sĩ"
          resourceAreaWidth="240px"
          resources={calendarResources}
          events={calendarEvents}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          height="auto"
          resourceLabelContent={(arg) => {
            const props = arg.resource.extendedProps as {
              role: string;
              zone: string;
              workloadPct: number;
              shiftStart: string;
              shiftEnd: string;
              avatarColor: string;
            };
            const initials = getStaffInitials(arg.resource.title);
            return (
              <div className="flex items-center justify-between gap-2 w-full py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: props.avatarColor || '#4B5850' }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="dss-body1 font-semibold truncate">
                      {arg.resource.title}
                    </div>
                    <div className="dss-body2 truncate">
                      {props.role} · {props.zone}
                    </div>
                  </div>
                </div>
                <span className="font-mono-num dss-caption px-1.5 py-0.5 rounded bg-[#F5F6F3] border border-[#DCE0DA] text-[#1F2924] shrink-0">
                  {props.workloadPct}%
                </span>
              </div>
            );
          }}
        />
      </div>

      {/* 3. OPTIONAL KANBAN STATUS DRAWER TOGGLE */}
      <div className="flex justify-end">
        <DSSButton
          variant="outline"
          size="xs"
          icon={<Layers className="w-3.5 h-3.5" strokeWidth={1.5} />}
          onClick={() => setShowKanbanDrawer(!showKanbanDrawer)}
        >
          {showKanbanDrawer ? 'Ẩn bảng trạng thái phụ trợ' : 'Hiện bảng trạng thái ca (Kanban)'}
        </DSSButton>
      </div>

      {showKanbanDrawer && (
        <div className="bg-white border border-[#DCE0DA] rounded-[8px] p-4 space-y-3">
          <div className="dss-h2">
            Tổng hợp nhanh theo trạng thái (Unassigned · Proposed · Confirmed · Completed)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              {
                title: `Chờ phân công (${unassignedRequests.length})`,
                items: unassignedRequests.map((u) => ({
                  id: u.id,
                  name: u.serviceName,
                  sub: `${u.patientName} · ${u.requestedWindow}`,
                })),
              },
              {
                title: `Ca đang chờ / AI Đề xuất (${assignments.filter((a) => a.status === 'Proposed').length})`,
                items: assignments
                  .filter((a) => a.status === 'Proposed')
                  .map((a) => ({
                    id: a.id,
                    name: a.serviceName,
                    sub: `${a.staffName} · ${a.startTime}-${a.endTime}`,
                  })),
              },
              {
                title: `Ca đã chốt (${assignments.filter((a) => a.status === 'Confirmed' || a.status === 'In-Progress').length})`,
                items: assignments
                  .filter((a) => a.status === 'Confirmed' || a.status === 'In-Progress')
                  .map((a) => ({
                    id: a.id,
                    name: a.serviceName,
                    sub: `${a.staffName} · ${a.startTime}-${a.endTime}`,
                  })),
              },
              {
                title: `Hoàn thành (${assignments.filter((a) => a.status === 'Completed').length})`,
                items: assignments
                  .filter((a) => a.status === 'Completed')
                  .map((a) => ({
                    id: a.id,
                    name: a.serviceName,
                    sub: `${a.staffName} · ${a.startTime}-${a.endTime}`,
                  })),
              },
            ].map((col, idx) => (
              <div
                key={idx}
                className="p-3 rounded-[8px] bg-[#F9FAF8] border border-[#DCE0DA] space-y-2"
              >
                <div className="dss-caption text-[#1F2924]">{col.title}</div>
                <div className="space-y-1.5">
                  {col.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-2 rounded-[6px] bg-white border border-[#DCE0DA] dss-body2"
                    >
                      <div className="font-semibold text-[#1F2924] truncate">{it.name}</div>
                      <div className="text-[11px] text-[#68756E] truncate">{it.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MODAL CHI TIẾT CA KHÁM */}
      <Modal
        title={
          detailAssignment ? (
            <div className="flex items-center gap-2">
              <span className="dss-h2">Chi Tiết Ca Khám Tại Nhà</span>
              <span className="font-mono-num dss-body2">Mã {detailAssignment.id}</span>
            </div>
          ) : (
            'Chi Tiết Ca'
          )
        }
        open={Boolean(detailAssignment)}
        onCancel={() => setDetailAssignment(null)}
        footer={
          detailAssignment ? (
            <div className="flex justify-end gap-2">
              <DSSButton variant="outline" size="sm" onClick={() => setDetailAssignment(null)}>
                Đóng
              </DSSButton>
              {detailAssignment.status === 'Proposed' && (
                <DSSButton
                  variant="solid"
                  size="sm"
                  onClick={() => {
                    onUpdateAssignmentStatus(detailAssignment.id, 'Confirmed');
                    setDetailAssignment(null);
                    message.success('Đã xác nhận chốt ca khám.');
                  }}
                >
                  Chốt ca khám (Confirmed)
                </DSSButton>
              )}
              {(detailAssignment.status === 'Confirmed' ||
                detailAssignment.status === 'In-Progress') && (
                <DSSButton
                  variant="solid"
                  size="sm"
                  onClick={() => {
                    onUpdateAssignmentStatus(detailAssignment.id, 'Completed');
                    setDetailAssignment(null);
                    message.success('Đã đánh dấu hoàn thành ca khám.');
                  }}
                >
                  Đánh dấu Hoàn thành
                </DSSButton>
              )}
            </div>
          ) : null
        }
      >
        {detailAssignment && (
          <div className="space-y-3 pt-2 dss-body2 text-[#1F2924]">
            <div className="p-3 rounded-[8px] bg-[#F9FAF8] border border-[#DCE0DA] space-y-1">
              <div className="dss-h2">{detailAssignment.serviceName}</div>
              <div>
                Bệnh nhân: <strong>{detailAssignment.patientName}</strong> ({detailAssignment.patientAge} tuổi) · SĐT: {detailAssignment.patientPhone}
              </div>
              <div>
                Địa chỉ: {detailAssignment.address} ({detailAssignment.district})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono-num">
              <div className="p-3 rounded-[8px] border border-[#DCE0DA]">
                <div className="text-[#68756E]">Khung giờ thực hiện</div>
                <div className="text-base font-bold text-[#4B5850] mt-0.5">
                  {detailAssignment.startTime} – {detailAssignment.endTime}
                </div>
                <div className="text-[11px] text-[#68756E] mt-0.5">
                  Dự báo: {detailAssignment.predictedDurationMin}p (Chuẩn {detailAssignment.standardDurationMin}p)
                </div>
              </div>
              <div className="p-3 rounded-[8px] border border-[#DCE0DA]">
                <div className="text-[#68756E]">Nhân sự phụ trách</div>
                <div className="text-base font-bold text-[#1F2924] mt-0.5">
                  {detailAssignment.staffName}
                </div>
                <div className="mt-1">
                  <DSSBadge
                    tone={
                      detailAssignment.status === 'Completed'
                        ? 'optimal'
                        : detailAssignment.status === 'Proposed'
                        ? 'warning'
                        : 'eligible'
                    }
                  >
                    {detailAssignment.status}
                  </DSSBadge>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 5. MODAL XỬ LÝ XUNG ĐỘT LỊCH TRÌNH (DANGER #D93843) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-[#9E1F28] font-bold">
            <AlertTriangle className="w-5 h-5 text-[#D93843]" strokeWidth={1.5} />
            <span>Cảnh Báo Trùng Lịch / Vi Phạm Time Window (Danger)</span>
          </div>
        }
        open={Boolean(activeConflictAssignment)}
        onCancel={() => setActiveConflictAssignment(null)}
        footer={
          activeConflictAssignment ? (
            <div className="flex justify-end gap-2">
              <DSSButton
                variant="outline"
                size="sm"
                onClick={() => setActiveConflictAssignment(null)}
              >
                Đóng
              </DSSButton>
              <DSSButton
                variant="solid"
                size="sm"
                onClick={() => {
                  onResolveConflict(activeConflictAssignment.id);
                  setActiveConflictAssignment(null);
                }}
              >
                Tự động dời ca sang{' '}
                {activeConflictAssignment.conflictDetail?.suggestedNewStart || '10:15'} –{' '}
                {activeConflictAssignment.conflictDetail?.suggestedNewEnd || '11:05'}
              </DSSButton>
            </div>
          ) : null
        }
      >
        {activeConflictAssignment && activeConflictAssignment.conflictDetail && (
          <div className="space-y-3 pt-2 dss-body2">
            <div className="p-3.5 rounded-[8px] bg-[#FCE8E9] border border-[#D93843] text-[#9E1F28] space-y-1">
              <div className="dss-body1 font-bold text-[#9E1F28]">
                Phát hiện trùng {activeConflictAssignment.conflictDetail.overlapMinutes} phút trong lịch của {activeConflictAssignment.staffName}
              </div>
              <div>{activeConflictAssignment.conflictDetail.reason}</div>
            </div>

            <div className="p-3 rounded-[8px] bg-[#FEF3E6] border border-[#D9822B] text-[#8A4D0F]">
              <strong>Giải pháp đề xuất:</strong> Dời giờ bắt đầu sang{' '}
              <strong>{activeConflictAssignment.conflictDetail.suggestedNewStart}</strong> –{' '}
              <strong>{activeConflictAssignment.conflictDetail.suggestedNewEnd}</strong> để đảm bảo đủ thời gian di chuyển.
            </div>
          </div>
        )}
      </Modal>

      {/* 6. DRAWER ĐỀ XUẤT AI */}
      <AIRecommendationDrawer
        open={Boolean(aiInspectRequest)}
        request={aiInspectRequest}
        onClose={() => setAiInspectRequest(null)}
        onConfirmAssignment={(req, chosenCandidate, isOverride, overrideCategory, overrideReason) => {
          onAssignRequest(req, chosenCandidate, isOverride, overrideCategory, overrideReason);
          setAiInspectRequest(null);
        }}
      />
    </div>
  );
};
