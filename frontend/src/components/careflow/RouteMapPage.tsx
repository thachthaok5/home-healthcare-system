import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Maximize2,
  Layers,
  Info,
  RefreshCw,
  Route as RouteIcon,
  Eye,
  EyeOff,
  ArrowUpRight,
} from 'lucide-react';
import {
  DispatchAssignment,
  MedicalStaff,
  UnassignedRequest,
} from '../../types/healthcare';
import {
  PageHeader,
  StatusBadge,
  PriorityBadge,
  CareFlowRoute,
} from './SharedUI';

export interface RouteMapPageProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  staffList: MedicalStaff[];
  assignments: DispatchAssignment[];
  unassignedRequests: UnassignedRequest[];
  onNavigate: (route: CareFlowRoute, requestId?: string) => void;
}

export interface RouteStopItem {
  assignmentId: string;
  stopNumber: number;
  staffId: string;
  staffName: string;
  routeColor: string;
  patientName: string;
  serviceName: string;
  serviceCategory: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  status: DispatchAssignment['status'];
  isConflict?: boolean;
  conflictOverlapMin?: number;
  address: string;
  district: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  travelMinutes: number | null;
}

export interface StaffRouteViewModel {
  staff: MedicalStaff;
  routeColor: string;
  hubCoords: { lat: number; lng: number };
  stops: RouteStopItem[];
  visitCount: number;
  routeStatus: 'Nominal' | 'Conflict' | 'High Load' | 'On Leave' | 'Idle';
  routeStatusLabel: string;
  totalDistanceKm: number | null;
  totalTravelMinutes: number | null;
  hasTravelMetrics: boolean;
}

// Distinct, accessible route colors for different staff members
const STAFF_ROUTE_COLORS: string[] = [
  '#1A73A0', // Deep Healthcare Teal
  '#1A73A0', // Royal Blue
  '#5B4BC4', // Amethyst Violet
  '#F27A1A', // Warm Amber
  '#4FB3D9', // Ocean Cyan
  '#C2187A', // Berry Magenta
  '#5B4BC4', // Indigo
  '#0F7A4A', // Emerald Green
];

// Fictional demonstration coordinates anchored on real wards in Nha Trang (land-only)
const NHA_TRANG_WARD_ANCHORS: Record<string, { lat: number; lng: number }> = {
  'Phường Lộc Thọ': { lat: 12.2388, lng: 109.1942 },
  'Phường Tân Lập': { lat: 12.2345, lng: 109.1905 },
  'Phường Phước Tiến': { lat: 12.2418, lng: 109.1882 },
  'Phường Phước Hòa': { lat: 12.2362, lng: 109.1835 },
  'Phường Phước Hải': { lat: 12.2395, lng: 109.1778 },
  'Phường Vạn Thạnh': { lat: 12.2535, lng: 109.1908 },
  'Phường Phương Sài': { lat: 12.2512, lng: 109.1836 },
  'Phường Vĩnh Hải': { lat: 12.2735, lng: 109.1938 },
  'Phường Vĩnh Phước': { lat: 12.2652, lng: 109.1965 },
  'Phường Vĩnh Nguyên': { lat: 12.2125, lng: 109.2015 },
  'Phường Vĩnh Trường': { lat: 12.2045, lng: 109.1968 },
  'Xã Vĩnh Ngọc': { lat: 12.2665, lng: 109.1695 },
};

const DEFAULT_CENTER: [number, number] = [12.2435, 109.1905];

const parseTimeMinutes = (timeStr: string): number => {
  const [hh, mm] = (timeStr || '08:00').split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
};

/**
 * Generates deterministic fictional demonstration coordinates within Nha Trang land bounds
 * so that visits never overlap at the exact same pixel and never drift into the sea.
 */
function resolveDemonstrationCoords(
  rawLocation: { lat: number; lng: number } | undefined,
  district: string,
  seedKey: string,
  indexOffset: number
): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) % 10000;
  }

  const wardAnchor = NHA_TRANG_WARD_ANCHORS[district];
  const hasValidRaw =
    rawLocation &&
    typeof rawLocation.lat === 'number' &&
    typeof rawLocation.lng === 'number' &&
    rawLocation.lat >= 12.18 &&
    rawLocation.lat <= 12.31 &&
    rawLocation.lng >= 109.15 &&
    rawLocation.lng <= 109.21;

  // Deterministic micro-offset so markers in the same ward don't stack on top of each other
  const latJitter = (((hash % 17) - 8) * 0.00055) + (indexOffset % 5) * 0.00035;
  const lngJitter = ((((hash >> 3) % 17) - 8) * 0.00055) - (indexOffset % 4) * 0.00035;

  const baseLat = hasValidRaw
    ? rawLocation!.lat
    : wardAnchor
    ? wardAnchor.lat
    : DEFAULT_CENTER[0];
  const baseLng = hasValidRaw
    ? rawLocation!.lng
    : wardAnchor
    ? wardAnchor.lng
    : DEFAULT_CENTER[1];

  // Clamp longitude west of 109.1985 for central wards so pins stay strictly on land
  const clampedLng = Math.min(109.1985, Math.max(109.165, baseLng + lngJitter));
  const clampedLat = Math.min(12.288, Math.max(12.198, baseLat + latJitter));

  return {
    lat: Number(clampedLat.toFixed(5)),
    lng: Number(clampedLng.toFixed(5)),
  };
}

function formatAssignmentStatusVi(status: string, isConflict?: boolean): string {
  if (isConflict || status === 'Conflict') return 'Xung đột lịch';
  if (status === 'Completed') return 'Hoàn thành';
  if (status === 'In-Progress') return 'Đang thực hiện';
  if (status === 'Proposed') return 'Chờ xác nhận';
  return 'Đã xác nhận';
}

export const RouteMapPage: React.FC<RouteMapPageProps> = ({
  selectedDate,
  onDateChange,
  staffList,
  assignments,
  unassignedRequests,
  onNavigate,
}) => {
  // Filter & Selection State
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [routeStatusFilter, setRouteStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CONFLICT'>('ALL');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [showIllustrativeLines, setShowIllustrativeLines] = useState<boolean>(true);
  const [showUnassignedPins, setShowUnassignedPins] = useState<boolean>(true);
  const [showHubMarkers, setShowHubMarkers] = useState<boolean>(true);

  // Tile loading & error resilience state
  const [tileProvider, setTileProvider] = useState<'osm' | 'carto'>('osm');
  const [tileErrorMessage, setTileErrorMessage] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // Refs for Leaflet map, layer group, marker dictionary, and right-panel stop rows
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Record<string, L.Marker>>({});
  const stopRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Build Staff Route View Models from live operational state
  const staffRoutes: StaffRouteViewModel[] = useMemo(() => {
    return staffList.map((staff, idx) => {
      const routeColor =
        STAFF_ROUTE_COLORS[idx % STAFF_ROUTE_COLORS.length] || staff.avatarColor || '#1A73A0';

      const hubCoords = resolveDemonstrationCoords(
        staff.baseLocation,
        staff.zone,
        `HUB-${staff.id}`,
        idx
      );

      const staffAssignments = assignments
        .filter((a) => a.staffId === staff.id)
        .sort((a, b) => parseTimeMinutes(a.startTime) - parseTimeMinutes(b.startTime));

      const stops: RouteStopItem[] = staffAssignments.map((asg, stopIdx) => {
        const coords = resolveDemonstrationCoords(
          asg.location,
          asg.district,
          asg.id,
          stopIdx + 1
        );

        const hasDistance =
          typeof asg.distanceKm === 'number' && !Number.isNaN(asg.distanceKm) && asg.distanceKm > 0;
        const hasTravelMin =
          typeof asg.travelMinutes === 'number' &&
          !Number.isNaN(asg.travelMinutes) &&
          asg.travelMinutes > 0;

        return {
          assignmentId: asg.id,
          stopNumber: stopIdx + 1,
          staffId: staff.id,
          staffName: staff.name,
          routeColor,
          patientName: asg.patientName,
          serviceName: asg.serviceName,
          serviceCategory: asg.serviceCategory,
          startTime: asg.startTime,
          endTime: asg.endTime,
          durationMin: asg.predictedDurationMin,
          status: asg.status,
          isConflict: asg.isConflict,
          conflictOverlapMin: asg.conflictDetail?.overlapMinutes,
          address: asg.address,
          district: asg.district,
          lat: coords.lat,
          lng: coords.lng,
          distanceKm: hasDistance ? Number(asg.distanceKm.toFixed(1)) : null,
          travelMinutes: hasTravelMin ? Math.round(asg.travelMinutes) : null,
        };
      });

      const hasConflict = stops.some((s) => s.isConflict || s.status === 'Conflict');
      const stopsWithMetrics = stops.filter(
        (s) => s.distanceKm !== null || s.travelMinutes !== null
      );
      const hasTravelMetrics = stopsWithMetrics.length > 0;

      const totalDistanceKm = hasTravelMetrics
        ? Number(
            stops
              .reduce((acc, s) => acc + (s.distanceKm || 0), 0)
              .toFixed(1)
          )
        : null;

      const totalTravelMinutes = hasTravelMetrics
        ? stops.reduce((acc, s) => acc + (s.travelMinutes || 0), 0)
        : null;

      let routeStatus: StaffRouteViewModel['routeStatus'] = 'Nominal';
      let routeStatusLabel = 'Lộ trình ổn định';

      if (staff.isOnApprovedLeave) {
        routeStatus = 'On Leave';
        routeStatusLabel = 'Đang nghỉ phép';
      } else if (hasConflict) {
        routeStatus = 'Conflict';
        routeStatusLabel = 'Có xung đột lịch';
      } else if (stops.length === 0) {
        routeStatus = 'Idle';
        routeStatusLabel = 'Chưa có ca giao';
      } else if ((staff.workloadPct || 0) >= 85 || stops.length >= 4) {
        routeStatus = 'High Load';
        routeStatusLabel = 'Tải cao';
      }

      return {
        staff,
        routeColor,
        hubCoords,
        stops,
        visitCount: stops.length,
        routeStatus,
        routeStatusLabel,
        totalDistanceKm,
        totalTravelMinutes,
        hasTravelMetrics,
      };
    });
  }, [staffList, assignments]);

  // Filtered staff routes for display
  const filteredRoutes = useMemo(() => {
    return staffRoutes.filter((route) => {
      if (selectedStaffId !== 'ALL' && route.staff.id !== selectedStaffId) {
        return false;
      }
      if (routeStatusFilter === 'ACTIVE' && route.visitCount === 0) {
        return false;
      }
      if (routeStatusFilter === 'CONFLICT' && route.routeStatus !== 'Conflict') {
        return false;
      }
      return true;
    });
  }, [staffRoutes, selectedStaffId, routeStatusFilter]);

  // All stops flat list for quick lookup
  const allStopsFlat = useMemo(() => {
    return staffRoutes.flatMap((r) => r.stops);
  }, [staffRoutes]);

  const activeStop = useMemo(() => {
    if (!selectedStopId) return null;
    return allStopsFlat.find((s) => s.assignmentId === selectedStopId) || null;
  }, [allStopsFlat, selectedStopId]);

  // Summary metrics
  const totalScheduledStops = allStopsFlat.length;
  const activeRouteCount = staffRoutes.filter((r) => r.visitCount > 0).length;
  const conflictStopCount = allStopsFlat.filter((s) => s.isConflict || s.status === 'Conflict').length;

  const stepDate = (deltaDays: number) => {
    const d = new Date(selectedDate || '2026-05-15');
    d.setDate(d.getDate() + deltaDays);
    onDateChange(d.toISOString().slice(0, 10));
  };

  // Fit bounds helper
  const fitMapToCurrentSelection = useCallback(
    (targetStaffId?: string) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const staffScope = targetStaffId ?? selectedStaffId;
      const routesToFit =
        staffScope === 'ALL'
          ? filteredRoutes.filter((r) => r.visitCount > 0 || !r.staff.isOnApprovedLeave)
          : staffRoutes.filter((r) => r.staff.id === staffScope);

      const points: [number, number][] = [];
      routesToFit.forEach((r) => {
        if (showHubMarkers) {
          points.push([r.hubCoords.lat, r.hubCoords.lng]);
        }
        r.stops.forEach((s) => {
          points.push([s.lat, s.lng]);
        });
      });

      if (staffScope === 'ALL' && showUnassignedPins) {
        unassignedRequests.forEach((req, idx) => {
          const c = resolveDemonstrationCoords(req.location, req.district, req.id, idx + 20);
          points.push([c.lat, c.lng]);
        });
      }

      if (points.length === 0) {
        map.setView(DEFAULT_CENTER, 13, { animate: true });
        return;
      }

      if (points.length === 1) {
        map.setView(points[0], 15, { animate: true });
        return;
      }

      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
      }
    },
    [filteredRoutes, selectedStaffId, showHubMarkers, showUnassignedPins, staffRoutes, unassignedRequests]
  );

  // Initialize Leaflet Map with OpenStreetMap tile layer & ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true,
    });

    const overlayGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    overlayLayerGroupRef.current = overlayGroup;
    setIsMapReady(true);

    // Responsive container observer so tiles never leave gray gaps
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      overlayLayerGroupRef.current = null;
    };
  }, []);

  // Manage OpenStreetMap Tile Layer & graceful error fallback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tileUrl =
      tileProvider === 'osm'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const tileAttribution =
      tileProvider === 'osm'
        ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        : '&copy; OpenStreetMap contributors &copy; CARTO';

    let errorCount = 0;
    const layer = L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19,
    });

    layer.on('tileerror', () => {
      errorCount += 1;
      if (errorCount >= 4 && tileProvider === 'osm') {
        setTileErrorMessage(
          'Máy chủ bản đồ OpenStreetMap chính phản hồi chậm. Đã tự động chuyển sang máy chủ dự phòng OpenStreetMap.'
        );
        setTileProvider('carto');
      } else if (errorCount >= 6) {
        setTileErrorMessage(
          'Không thể tải đầy đủ một số ô bản đồ nền do kết nối mạng. Các điểm dừng và lộ trình vẫn hoạt động bình thường.'
        );
      }
    });

    layer.on('load', () => {
      if (errorCount === 0) {
        setTileErrorMessage(null);
      }
    });

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tileProvider, isMapReady]);

  // Synchronized handler when selecting a staff route
  const handleSelectStaffRoute = (staffId: string) => {
    const nextStaffId = selectedStaffId === staffId ? 'ALL' : staffId;
    setSelectedStaffId(nextStaffId);
    setSelectedStopId(null);
    setTimeout(() => {
      fitMapToCurrentSelection(nextStaffId);
    }, 50);
  };

  // Synchronized handler when clicking a visit in the right-side list or on the map
  const handleSelectStop = useCallback(
    (stop: RouteStopItem, source: 'list' | 'map') => {
      setSelectedStopId(stop.assignmentId);

      const map = mapInstanceRef.current;
      const marker = markerMapRef.current[stop.assignmentId];

      if (source === 'list' && map) {
        map.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 15), {
          duration: 0.45,
        });
        if (marker) {
          marker.openPopup();
        }
      }

      if (source === 'map') {
        const rowEl = stopRowRefs.current[stop.assignmentId];
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    },
    []
  );

  // Render markers, numbered visit badges, and illustrative route lines onto Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = overlayLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markerMapRef.current = {};

    // 1. Render Staff Routes (Polylines, Hub Markers, Numbered Visit Markers)
    filteredRoutes.forEach((route) => {
      const isRouteHighlighted =
        selectedStaffId === 'ALL' || selectedStaffId === route.staff.id;
      const routeOpacity = isRouteHighlighted ? 0.85 : 0.25;

      // 1a. Illustrative sequence polyline connecting Base Hub -> Stop 1 -> Stop 2 ...
      if (showIllustrativeLines && route.stops.length > 0) {
        const latLngSequence: [number, number][] = [];
        if (showHubMarkers) {
          latLngSequence.push([route.hubCoords.lat, route.hubCoords.lng]);
        }
        route.stops.forEach((st) => {
          latLngSequence.push([st.lat, st.lng]);
        });

        if (latLngSequence.length >= 2) {
          // Subtle white halo under the dashed line for contrast on OSM roads
          L.polyline(latLngSequence, {
            color: '#FFFFFF',
            weight: isRouteHighlighted ? 6 : 4,
            opacity: isRouteHighlighted ? 0.7 : 0.2,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(layerGroup);

          const polyline = L.polyline(latLngSequence, {
            color: route.routeColor,
            weight: isRouteHighlighted ? 3.5 : 2,
            opacity: routeOpacity,
            dashArray: '8, 7',
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(layerGroup);

          polyline.bindTooltip(
            `<div style="font-size:11px;font-weight:600;color:#15334A;">
              Lộ trình minh họa: ${route.staff.name} (${route.visitCount} điểm dừng)
            </div>`,
            { sticky: true }
          );

          polyline.on('click', () => {
            setSelectedStaffId(route.staff.id);
          });
        }
      }

      // 1b. Base Hub Marker ("H")
      if (showHubMarkers && (!route.staff.isOnApprovedLeave || route.stops.length > 0)) {
        const hubIcon = L.divIcon({
          className: 'careflow-hub-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 6px;
              background: #FFFFFF;
              border: 2px solid ${route.routeColor};
              color: ${route.routeColor};
              font-weight: 700;
              font-size: 11px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(37,52,56,0.18);
              opacity: ${isRouteHighlighted ? 1 : 0.45};
            " title="Trạm xuất phát: ${route.staff.name}">
              H
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12],
        });

        const hubMarker = L.marker([route.hubCoords.lat, route.hubCoords.lng], {
          icon: hubIcon,
        }).addTo(layerGroup);

        hubMarker.bindPopup(`
          <div style="min-width: 210px; font-family: Nunito, 'Be Vietnam Pro', sans-serif;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${route.routeColor};"></span>
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5A7184;letter-spacing:0.04em;">
                Điểm xuất phát (Base Hub)
              </span>
            </div>
            <div style="font-size:13px;font-weight:600;color:#15334A;">${route.staff.name}</div>
            <div style="font-size:11px;color:#5A7184;margin-top:2px;">
              ${route.staff.role} · ${route.staff.zone}
            </div>
            <div style="font-size:11px;color:#15334A;margin-top:6px;padding-top:6px;border-top:1px solid #DDEBF2;">
              Ca trực: <strong>${route.staff.shiftStart} – ${route.staff.shiftEnd}</strong> · Số ca: <strong>${route.visitCount}</strong>
            </div>
          </div>
        `);
      }

      // 1c. Numbered Visit Markers (1, 2, 3...)
      route.stops.forEach((stop) => {
        const isSelectedStop = selectedStopId === stop.assignmentId;
        const isConflict = Boolean(stop.isConflict || stop.status === 'Conflict');
        const badgeBg = isConflict ? '#D3132E' : route.routeColor;
        const size = isSelectedStop ? 34 : 28;
        const ringShadow = isSelectedStop
          ? `0 0 0 4px rgba(47, 111, 100, 0.28), 0 4px 12px rgba(37, 52, 56, 0.3)`
          : isConflict
          ? `0 0 0 3px rgba(216, 93, 104, 0.28), 0 2px 6px rgba(37, 52, 56, 0.22)`
          : `0 2px 6px rgba(37, 52, 56, 0.22)`;

        const visitIcon = L.divIcon({
          className: 'careflow-visit-marker',
          html: `
            <div style="
              width: ${size}px;
              height: ${size}px;
              border-radius: 9999px;
              background: ${badgeBg};
              border: 2.5px solid #FFFFFF;
              color: #FFFFFF;
              font-weight: 700;
              font-size: ${isSelectedStop ? '13px' : '12px'};
              font-variant-numeric: tabular-nums;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: ${ringShadow};
              opacity: ${isRouteHighlighted ? 1 : 0.45};
              transition: transform 0.15s ease;
              position: relative;
            ">
              ${stop.stopNumber}
              ${
                isConflict
                  ? `<span style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:999px;background:#FFF;color:#D3132E;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1px solid #D3132E;">!</span>`
                  : ''
              }
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -(size / 2)],
        });

        const marker = L.marker([stop.lat, stop.lng], {
          icon: visitIcon,
          zIndexOffset: isSelectedStop ? 1000 : isConflict ? 500 : 100,
        }).addTo(layerGroup);

        const statusLabel = formatAssignmentStatusVi(stop.status, stop.isConflict);
        const statusBg = isConflict
          ? '#FFE8EB'
          : stop.status === 'Completed'
          ? '#E6F7EE'
          : stop.status === 'Proposed'
          ? '#FFF3DF'
          : '#D6EFF8';
        const statusColor = isConflict
          ? '#D3132E'
          : stop.status === 'Completed'
          ? '#0F7A4A'
          : stop.status === 'Proposed'
          ? '#B45309'
          : '#1A73A0';

        const travelHtml =
          stop.distanceKm !== null || stop.travelMinutes !== null
            ? `<div style="font-size:11px;color:#5A7184;margin-top:4px;">
                Quãng đường ước tính: <strong>${
                  stop.distanceKm !== null ? `${stop.distanceKm} km` : '—'
                }</strong> ${
                stop.travelMinutes !== null ? `(~${stop.travelMinutes} phút)` : ''
              }
              </div>`
            : '';

        const popupHtml = `
          <div style="min-width: 245px; max-width: 280px; font-family: Nunito, 'Be Vietnam Pro', sans-serif; color: #15334A;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
              <span style="font-family:monospace;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:#F4FAFD;border:1px solid #DDEBF2;color:#15334A;">
                ${stop.assignmentId} · Điểm dừng #${stop.stopNumber}
              </span>
              <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:${statusBg};color:${statusColor};">
                ${statusLabel}
              </span>
            </div>

            <div style="font-size:13px;font-weight:600;color:#15334A;margin-bottom:2px;">
              ${stop.serviceName}
            </div>
            <div style="font-size:12px;color:#5A7184;margin-bottom:6px;">
              Bệnh nhân: <strong style="color:#15334A;">${stop.patientName}</strong>
            </div>

            <div style="padding:6px 8px;border-radius:6px;background:#F4FAFD;border:1px solid #DDEBF2;font-size:11px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="color:#5A7184;">Khung giờ lịch:</span>
                <strong style="color:#15334A;font-variant-numeric:tabular-nums;">${stop.startTime} – ${stop.endTime} (${stop.durationMin}p)</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="color:#5A7184;">Nhân sự phụ trách:</span>
                <strong style="color:${route.routeColor};">${stop.staffName}</strong>
              </div>
              <div style="color:#5A7184;margin-top:3px;">
                Địa chỉ: ${stop.address} (${stop.district})
              </div>
              ${travelHtml}
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          handleSelectStop(stop, 'map');
        });

        markerMapRef.current[stop.assignmentId] = marker;
      });
    });

    // 2. Render Unassigned Request Markers when enabled
    if (showUnassignedPins && selectedStaffId === 'ALL') {
      unassignedRequests.forEach((req, idx) => {
        const coords = resolveDemonstrationCoords(
          req.location,
          req.district,
          req.id,
          idx + 30
        );
        const isUrgent =
          req.priority === 'Khẩn cấp' || req.priority.toLowerCase() === 'urgent';
        const pinColor = isUrgent ? '#D3132E' : '#F27A1A';

        // Ca Khẩn cấp: ghim đỏ đặc, to hơn 1,5 lần, có vòng sáng nhấp nháy.
        const pinSize = isUrgent ? 38 : 26;
        const unassignedIcon = L.divIcon({
          className: 'careflow-unassigned-marker',
          html: isUrgent
            ? `
            <div class="cf-urgent-pin" style="
              width: ${pinSize}px;
              height: ${pinSize}px;
              background: ${pinColor};
              border: 3px solid #FFFFFF;
              color: #FFFFFF;
              font-weight: 800;
              font-size: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
            " title="KHẨN CẤP · chờ phân công: ${req.id}">
              !
            </div>
          `
            : `
            <div style="
              width: ${pinSize}px;
              height: ${pinSize}px;
              border-radius: 9999px;
              background: #FFFFFF;
              border: 2.5px dashed ${pinColor};
              color: ${pinColor};
              font-weight: 800;
              font-size: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(21, 51, 74, 0.2);
            " title="Chờ phân công: ${req.id}">
              ?
            </div>
          `,
          iconSize: [pinSize, pinSize],
          iconAnchor: [pinSize / 2, pinSize / 2],
          popupAnchor: [0, -pinSize / 2],
        });

        const reqMarker = L.marker([coords.lat, coords.lng], {
          icon: unassignedIcon,
          zIndexOffset: isUrgent ? 1000 : 0,
        }).addTo(layerGroup);

        reqMarker.bindPopup(`
          <div style="min-width: 230px; font-family: Nunito, 'Be Vietnam Pro', sans-serif; color: #15334A;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
              <span style="font-family:monospace;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:#FFF3DF;border:1px solid #FBD3A6;color:#B45309;">
                ${req.id} · Chờ phân công
              </span>
              <span style="font-size:10px;font-weight:700;color:${pinColor};">
                ${req.priority}
              </span>
            </div>
            <div style="font-size:13px;font-weight:600;color:#15334A;margin-bottom:2px;">
              ${req.serviceName}
            </div>
            <div style="font-size:12px;color:#5A7184;margin-bottom:6px;">
              Bệnh nhân: <strong style="color:#15334A;">${req.patientName}</strong>
            </div>
            <div style="font-size:11px;color:#5A7184;padding:6px 8px;border-radius:6px;background:#F4FAFD;border:1px solid #DDEBF2;">
              <div>Khung giờ yêu cầu: <strong style="color:#15334A;">${req.requestedWindow}</strong> (${req.estimatedDurationMin}p)</div>
              <div style="margin-top:2px;">Khu vực: ${req.address} (${req.district})</div>
            </div>
          </div>
        `);
      });
    }
  }, [
    filteredRoutes,
    selectedStaffId,
    selectedStopId,
    showIllustrativeLines,
    showHubMarkers,
    showUnassignedPins,
    unassignedRequests,
    handleSelectStop,
    isMapReady,
  ]);

  return (
    <div className="space-y-5">
      {/* Page Header with Direct Navigation to Dispatch Board & AI Recommendations */}
      <PageHeader
        title="Bản đồ Lộ trình Điều phối"
        subtitle="Trực quan hóa điểm dừng chăm sóc tại nhà theo thứ tự ca trực trên nền OpenStreetMap"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-100 text-brand-600 border border-brand-200">
            <RouteIcon className="w-3.5 h-3.5" />
            <span>OpenStreetMap · {totalScheduledStops} điểm dừng</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigate('/dispatch')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-white hover:border-brand-600 text-ink text-[13px] font-medium transition-colors cursor-pointer"
            >
              <CalendarClock className="w-4 h-4 text-brand-600" />
              <span>Mở Bảng Điều phối</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/recommendations')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Đề xuất AI ({unassignedRequests.length})</span>
            </button>
          </div>
        }
      />

      {/* Compact Control & Filter Bar */}
      <div className="bg-white rounded-[10px] border border-line p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Compact Date Selector & Staff Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="inline-flex items-center rounded-lg border border-line bg-canvas p-0.5">
            <button
              type="button"
              onClick={() => stepDate(-1)}
              className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-white transition-colors cursor-pointer"
              title="Ngày trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 text-[12px] font-medium text-ink">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent border-none outline-none font-mono-num text-[12px] text-ink cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => stepDate(1)}
              className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-white transition-colors cursor-pointer"
              title="Ngày tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Staff Member Filter */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted" />
            <select
              value={selectedStaffId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStaffId(val);
                setSelectedStopId(null);
                setTimeout(() => fitMapToCurrentSelection(val), 50);
              }}
              className="px-3 py-1.5 rounded-lg border border-line bg-canvas text-[12px] font-medium text-ink focus:bg-white focus:border-brand-600 outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả nhân sự ({staffList.length})</option>
              {staffRoutes.map((r) => (
                <option key={r.staff.id} value={r.staff.id}>
                  {r.staff.name} · {r.visitCount} điểm dừng ({r.staff.zone})
                </option>
              ))}
            </select>
          </div>

          {/* Route Status Filter */}
          <select
            value={routeStatusFilter}
            onChange={(e) =>
              setRouteStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'CONFLICT')
            }
            className="px-3 py-1.5 rounded-lg border border-line bg-canvas text-[12px] text-ink focus:bg-white focus:border-brand-600 outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái lộ trình</option>
            <option value="ACTIVE">Có lịch đi khám ({activeRouteCount})</option>
            <option value="CONFLICT">Có xung đột lịch ({conflictStopCount})</option>
          </select>
        </div>

        {/* Right: Layer Toggles & Fit Map Action */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIllustrativeLines((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer ${
              showIllustrativeLines
                ? 'bg-brand-100 border-brand-200 text-brand-600'
                : 'bg-white border-line text-muted'
            }`}
            title="Bật/tắt đường nối thứ tự điểm dừng minh họa"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Đường nối minh họa</span>
          </button>

          <button
            type="button"
            onClick={() => setShowUnassignedPins((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer ${
              showUnassignedPins
                ? 'bg-high-tint border-high-line text-high-ink'
                : 'bg-white border-line text-muted'
            }`}
            title="Hiển thị các yêu cầu chưa phân công trên bản đồ"
          >
            {showUnassignedPins ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span>Ca chờ phân công ({unassignedRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => fitMapToCurrentSelection()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-white hover:border-brand-600 text-[12px] font-medium text-ink transition-colors cursor-pointer"
            title="Căn chỉnh khung nhìn vừa toàn bộ các điểm dừng"
          >
            <Maximize2 className="w-3.5 h-3.5 text-brand-600" />
            <span>Toàn cảnh lộ trình</span>
          </button>
        </div>
      </div>

      {/* Quick Staff Color Legend Bar */}
      <div className="bg-white rounded-[10px] border border-line px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
            Màu lộ trình nhân sự:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedStaffId('ALL');
              setSelectedStopId(null);
              setTimeout(() => fitMapToCurrentSelection('ALL'), 50);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
              selectedStaffId === 'ALL'
                ? 'bg-ink text-white border-ink'
                : 'bg-canvas text-muted border-line hover:text-ink'
            }`}
          >
            <span>Tất cả ({activeRouteCount} lộ trình)</span>
          </button>
          {staffRoutes.map((route) => {
            const isSelected = selectedStaffId === route.staff.id;
            return (
              <button
                key={route.staff.id}
                type="button"
                onClick={() => handleSelectStaffRoute(route.staff.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-brand-100 text-ink border-brand-600 font-semibold shadow-2xs'
                    : 'bg-white text-ink border-line hover:border-brand-600'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: route.routeColor }}
                />
                <span className="truncate max-w-[140px]">{route.staff.name}</span>
                <span className="text-[11px] text-muted font-mono-num">
                  ({route.visitCount})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Info className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span>
            Đường nét đứt thể hiện <strong>thứ tự điểm dừng minh họa</strong> (không phải dẫn đường giao thông thực tế)
          </span>
        </div>
      </div>

      {/* Main Split Workspace: Interactive OpenStreetMap (Left 7 cols) + Synchronized Route List Panel (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT 7 COLUMNS: Interactive Leaflet Map + Active Stop Bar */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          <div className="bg-white rounded-[10px] border border-line overflow-hidden relative">
            {/* Graceful Map Tile Error / Fallback Notice */}
            {tileErrorMessage && (
              <div className="bg-high-tint border-b border-high-line px-3.5 py-2 flex items-center justify-between gap-2 text-[12px] text-high-ink">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{tileErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTileErrorMessage(null);
                    setTileProvider((prev) => (prev === 'osm' ? 'carto' : 'osm'));
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-high-line text-[11px] font-semibold text-ink hover:border-brand-600 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Tải lại bản đồ</span>
                </button>
              </div>
            )}

            {/* Map Canvas Container */}
            <div
              ref={mapContainerRef}
              className="w-full h-[540px] lg:h-[620px] z-0"
              aria-label="Bản đồ lộ trình điều phối nhân sự y tế tại nhà"
            />

            {/* Floating Map Legend & Illustrative Route Disclaimer Overlay */}
            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs rounded-lg border border-line p-2.5 shadow-sm max-w-xs pointer-events-auto">
              <div className="text-[11px] font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <span>Chú giải Ký hiệu Bản đồ</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
                    1
                  </span>
                  <span>Thứ tự ca khám</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-white border-2 border-brand-600 text-brand-600 text-[10px] font-bold inline-flex items-center justify-center">
                    H
                  </span>
                  <span>Trạm xuất phát</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-urgent text-white text-[10px] font-bold inline-flex items-center justify-center">
                    !
                  </span>
                  <span>Ca xung đột lịch</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-white border border-dashed border-high text-high text-[10px] font-bold inline-flex items-center justify-center">
                    ?
                  </span>
                  <span>Chờ phân công</span>
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-line text-[10px] text-muted leading-snug">
                Tọa độ mô phỏng tại Nha Trang. Đường nối nét đứt minh họa thứ tự điểm dừng.
              </div>
            </div>
          </div>

          {/* Synchronized Selected Visit Detail Bar below Map */}
          {activeStop ? (
            <div className="bg-white rounded-[10px] border border-brand-600 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="w-6 h-6 rounded-full text-white text-[12px] font-bold inline-flex items-center justify-center tabular-nums"
                    style={{
                      backgroundColor: activeStop.isConflict
                        ? '#D3132E'
                        : activeStop.routeColor,
                    }}
                  >
                    {activeStop.stopNumber}
                  </span>
                  <span className="font-mono-num text-[12px] font-semibold px-2 py-0.5 rounded bg-canvas border border-line text-ink">
                    {activeStop.assignmentId}
                  </span>
                  <span className="text-[14px] font-semibold text-ink">
                    {activeStop.serviceName}
                  </span>
                  <StatusBadge
                    status={activeStop.isConflict ? 'Conflict' : activeStop.status}
                  />
                </div>
                <div className="text-[12px] text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Bệnh nhân: <strong className="text-ink">{activeStop.patientName}</strong>
                  </span>
                  <span className="tabular-nums">
                    Khung giờ: <strong className="text-ink">{activeStop.startTime} – {activeStop.endTime}</strong> ({activeStop.durationMin} phút)
                  </span>
                  <span>
                    Nhân sự: <strong className="text-brand-600">{activeStop.staffName}</strong>
                  </span>
                  <span>
                    Địa chỉ: {activeStop.address} ({activeStop.district})
                  </span>
                  {(activeStop.distanceKm !== null || activeStop.travelMinutes !== null) && (
                    <span className="tabular-nums">
                      Ước tính di chuyển:{' '}
                      <strong className="text-ink">
                        {activeStop.distanceKm !== null ? `${activeStop.distanceKm} km` : ''}
                        {activeStop.travelMinutes !== null
                          ? ` (~${activeStop.travelMinutes} phút)`
                          : ''}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('/dispatch')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-semibold transition-colors cursor-pointer"
                >
                  <span>Điều chỉnh trên Bảng Điều phối</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[10px] border border-line px-4 py-3 flex items-center justify-between gap-3 text-[12px] text-muted">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  Nhấp vào bất kỳ <strong>điểm dừng đánh số</strong> trên bản đồ hoặc chọn một ca khám ở danh sách bên phải để xem chi tiết lộ trình đồng bộ.
                </span>
              </div>
              {unassignedRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('/recommendations')}
                  className="text-brand-600 font-semibold hover:underline shrink-0 cursor-pointer"
                >
                  Xem {unassignedRequests.length} ca chờ AI đề xuất →
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT 5 COLUMNS: Synchronized Staff Route & Visit List Panel */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-[10px] border border-line flex flex-col lg:h-[680px] overflow-hidden">
          {/* Panel Header */}
          <div className="p-4 border-b border-line flex items-center justify-between gap-2 bg-canvas/60">
            <div>
              <h2 className="text-[15px] font-semibold text-ink m-0">
                Danh sách Lộ trình Nhân sự ({filteredRoutes.length})
              </h2>
              <p className="text-[12px] text-muted m-0 mt-0.5">
                Chọn lộ trình hoặc điểm dừng để đồng bộ vị trí trên bản đồ
              </p>
            </div>
            {selectedStaffId !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStaffId('ALL');
                  setSelectedStopId(null);
                  setTimeout(() => fitMapToCurrentSelection('ALL'), 50);
                }}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-line text-brand-600 hover:border-brand-600 cursor-pointer shrink-0"
              >
                Hiện tất cả
              </button>
            )}
          </div>

          {/* Scrollable Route Cards & Visit Lists */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-3">
            {filteredRoutes.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted">
                Không có lộ trình nhân sự nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredRoutes.map((route) => {
                const isRouteSelected = selectedStaffId === route.staff.id;
                const statusBadgeTone =
                  route.routeStatus === 'Conflict'
                    ? 'bg-urgent-tint text-urgent border-urgent-line'
                    : route.routeStatus === 'On Leave'
                    ? 'bg-canvas text-muted border-line'
                    : route.routeStatus === 'High Load'
                    ? 'bg-high-tint text-high-ink border-high-line'
                    : route.routeStatus === 'Idle'
                    ? 'bg-canvas text-muted border-line'
                    : 'bg-ok-tint text-ok border-brand-200';

                return (
                  <div
                    key={route.staff.id}
                    className={`rounded-[10px] border transition-colors overflow-hidden ${
                      isRouteSelected
                        ? 'border-brand-600 bg-canvas/50'
                        : 'border-line bg-white hover:border-line-strong'
                    }`}
                  >
                    {/* Route Summary Header (Click to select/focus staff route) */}
                    <div
                      onClick={() => handleSelectStaffRoute(route.staff.id)}
                      className="p-3.5 cursor-pointer select-none border-b border-line/80 bg-white hover:bg-canvas/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow-2xs"
                            style={{ backgroundColor: route.routeColor }}
                          />
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-ink truncate">
                              {route.staff.name}
                            </div>
                            <div className="text-[11px] text-muted truncate">
                              {route.staff.role} · {route.staff.zone} · Ca {route.staff.shiftStart}–{route.staff.shiftEnd}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${statusBadgeTone}`}
                        >
                          {route.routeStatusLabel}
                        </span>
                      </div>

                      {/* Route Metrics Row: Visit count & Travel metrics when available */}
                      <div className="mt-2.5 pt-2 border-t border-line/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted tabular-nums">
                        <span className="font-medium text-ink">
                          Số điểm dừng: <strong>{route.visitCount} ca</strong>
                        </span>

                        {route.hasTravelMetrics ? (
                          <span>
                            Di chuyển ước tính:{' '}
                            <strong className="text-ink">
                              {route.totalDistanceKm !== null
                                ? `${route.totalDistanceKm} km`
                                : '—'}
                            </strong>
                            {route.totalTravelMinutes !== null
                              ? ` · ~${route.totalTravelMinutes} phút`
                              : ''}
                          </span>
                        ) : (
                          <span className="italic text-muted">
                            {route.visitCount > 0
                              ? 'Chưa có số liệu quãng đường'
                              : 'Không có lịch di chuyển'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Numbered Visit Sequence List */}
                    {route.stops.length > 0 ? (
                      <div className="divide-y divide-line/70 bg-canvas/30">
                        {route.stops.map((stop) => {
                          const isStopActive = selectedStopId === stop.assignmentId;
                          const isConflict = Boolean(
                            stop.isConflict || stop.status === 'Conflict'
                          );

                          return (
                            <div
                              key={stop.assignmentId}
                              ref={(el) => {
                                stopRowRefs.current[stop.assignmentId] = el;
                              }}
                              onClick={() => handleSelectStop(stop, 'list')}
                              className={`p-3 flex items-start gap-2.5 cursor-pointer transition-colors ${
                                isStopActive
                                  ? 'bg-brand-100/80 border-l-4 border-l-brand-600'
                                  : isConflict
                                  ? 'bg-urgent-tint/60 hover:bg-urgent-tint'
                                  : 'hover:bg-canvas'
                              }`}
                            >
                              {/* Numbered Stop Pin */}
                              <div
                                className="w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums shadow-2xs"
                                style={{
                                  backgroundColor: isConflict
                                    ? '#D3132E'
                                    : route.routeColor,
                                }}
                              >
                                {stop.stopNumber}
                              </div>

                              {/* Stop Content */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono-num text-[11px] font-semibold text-brand-600 bg-white px-1.5 py-0.5 rounded border border-line">
                                      {stop.startTime}–{stop.endTime}
                                    </span>
                                    <span className="font-mono-num text-[11px] text-muted">
                                      {stop.assignmentId}
                                    </span>
                                  </div>
                                  <StatusBadge
                                    status={isConflict ? 'Conflict' : stop.status}
                                  />
                                </div>

                                <div className="text-[12px] font-semibold text-ink truncate">
                                  {stop.serviceName}
                                </div>

                                <div className="text-[11px] text-muted flex flex-wrap items-center justify-between gap-1">
                                  <span className="truncate">
                                    BN: <strong className="text-ink">{stop.patientName}</strong> · {stop.district}
                                  </span>
                                  {(stop.distanceKm !== null ||
                                    stop.travelMinutes !== null) && (
                                    <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-white border border-line text-muted">
                                      {stop.distanceKm !== null
                                        ? `${stop.distanceKm} km`
                                        : ''}
                                      {stop.travelMinutes !== null
                                        ? ` · ${stop.travelMinutes}p`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3.5 py-2.5 text-[11px] text-muted bg-canvas/50">
                        {route.staff.isOnApprovedLeave
                          ? `Nhân sự đang nghỉ phép (${route.staff.leaveWindowText || 'Cả ngày'}).`
                          : 'Chưa có điểm dừng nào được phân công trong ca này.'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Panel Footer: Quick Links to Dispatch Board & AI Recommendations */}
          <div className="p-3 border-t border-line bg-canvas flex items-center justify-between gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => onNavigate('/dispatch')}
              className="flex-1 py-2 px-3 rounded-lg bg-white border border-line hover:border-brand-600 text-ink font-medium text-center transition-colors cursor-pointer"
            >
              Bảng Điều phối Lịch
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/recommendations')}
              className="flex-1 py-2 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-center transition-colors cursor-pointer"
            >
              Đề xuất AI ({unassignedRequests.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
