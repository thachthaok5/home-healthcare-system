import React, { useState, useEffect, useRef } from 'react';
import { App as AntdApp, Button, Select, Switch } from 'antd';
import L from 'leaflet';
import {
  Compass,
  Sparkles,
} from 'lucide-react';
import {
  StaffRouteItinerary,
  RouteStop,
  GeoCoord,
} from '../types/healthcare';

interface UnassignedMapPoint {
  id: string;
  patientName: string;
  serviceName: string;
  district: string;
  address: string;
  location: GeoCoord;
  priority: string;
  requestedWindow: string;
}

interface LeafletRouteMapScreenProps {
  onNavigateToAI: () => void;
  onNavigateToGantt: () => void;
}

export const LeafletRouteMapScreen: React.FC<LeafletRouteMapScreenProps> = ({
  onNavigateToAI,
}) => {
  const { message } = AntdApp.useApp();
  const [itineraries, setItineraries] = useState<StaffRouteItinerary[]>([]);
  const [unassignedPoints, setUnassignedPoints] = useState<UnassignedMapPoint[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [showUnassignedPins, setShowUnassignedPins] = useState<boolean>(true);
  const [activeStop, setActiveStop] = useState<RouteStop | null>(null);
  const [, setLoading] = useState<boolean>(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/routes');
      if (res.ok) {
        const data = await res.json();
        setItineraries(data.itineraries || []);
        setUnassignedPoints(data.unassignedPoints || []);
      }
    } catch (err) {
      message.error('Không thể tải dữ liệu lộ trình từ Backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.7769, 106.6951], // Central Ho Chi Minh City
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Render Routes, Base Hubs, Stop Markers & Unassigned Pins on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const visibleItineraries =
      selectedStaffId === 'ALL'
        ? itineraries
        : itineraries.filter((it) => it.staffId === selectedStaffId);

    const allCoords: L.LatLngExpression[] = [];

    visibleItineraries.forEach((itin) => {
      const routeCoords: L.LatLngExpression[] = [
        [itin.baseLocation.lat, itin.baseLocation.lng],
      ];
      allCoords.push([itin.baseLocation.lat, itin.baseLocation.lng]);

      // 1. Base Station Marker (Hub)
      const hubIcon = L.divIcon({
        className: 'custom-leaflet-hub',
        html: `<div style="background:${itin.avatarColor};color:#fff;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #FAF8F5;box-shadow:0 2px 6px rgba(48,67,63,0.22);">H</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([itin.baseLocation.lat, itin.baseLocation.lng], { icon: hubIcon })
        .bindPopup(
          `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;line-height:1.45;min-width:200px;color:#30433F;">
            <div style="font-weight:700;color:#5A6E63;">Trạm Xuất Phát (Base Hub)</div>
            <div style="font-weight:600;color:#30433F;margin-top:2px;">${itin.staffName}</div>
            <div style="color:#687873;font-size:11px;">${itin.baseAddress}</div>
            <div style="color:#5A6E63;font-size:11px;margin-top:4px;font-weight:600;">Ca trực: ${itin.shiftStart} – ${itin.shiftEnd}</div>
          </div>`
        )
        .addTo(layerGroup);

      // 2. Patient Stop Markers
      itin.stops.forEach((stop) => {
        routeCoords.push([stop.location.lat, stop.location.lng]);
        allCoords.push([stop.location.lat, stop.location.lng]);

        const bg = stop.isConflict ? '#C68F7B' : itin.avatarColor;
        const stopIcon = L.divIcon({
          className: 'custom-leaflet-stop',
          html: `<div style="background:${bg};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #FAF8F5;box-shadow:0 2px 6px rgba(48,67,63,0.25);">${stop.stopOrder}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([stop.location.lat, stop.location.lng], {
          icon: stopIcon,
        })
          .bindPopup(
            `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;line-height:1.45;min-width:220px;color:#30433F;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:700;color:#5A6E63;">Điểm dừng #${stop.stopOrder} · ${stop.startTime}–${stop.endTime}</span>
                <span style="background:#E6ECE8;color:#30433F;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;">${stop.status}</span>
              </div>
              <div style="font-weight:700;color:#30433F;margin-top:4px;">BN: ${stop.patientName} (${stop.patientAge}t)</div>
              <div style="color:#5A6E63;font-weight:600;font-size:11px;">${stop.serviceName}</div>
              <div style="color:#687873;font-size:11px;margin-top:2px;">${stop.address}</div>
              <div style="margin-top:6px;padding-top:4px;border-top:1px solid #E2DED5;font-size:11px;color:#30433F;">
                <strong>Nhân sự:</strong> ${itin.staffName}<br/>
                <strong>Chặng ước tính:</strong> ${stop.legDistanceKm} km (~${stop.legTravelMinutes} phút)<br/>
                <strong>Thời lượng dự báo:</strong> ${stop.predictedDurationMin} phút
              </div>
            </div>`
          )
          .on('click', () => {
            setActiveStop(stop);
          });

        marker.addTo(layerGroup);
      });

      // 3. Route Polyline connecting Base -> Stop 1 -> Stop 2...
      if (routeCoords.length > 1) {
        L.polyline(routeCoords, {
          color: itin.avatarColor,
          weight: selectedStaffId === 'ALL' ? 3.5 : 4.5,
          opacity: 0.85,
        }).addTo(layerGroup);
      }
    });

    // 4. Unassigned Request Pins (Rosewood #C68F7B)
    if (showUnassignedPins) {
      unassignedPoints.forEach((pt) => {
        allCoords.push([pt.location.lat, pt.location.lng]);
        const uIcon = L.divIcon({
          className: 'custom-leaflet-unassigned',
          html: `<div style="background:#C68F7B;color:#fff;padding:2px 7px;border-radius:12px;font-weight:700;font-size:10px;border:2px solid #FAF8F5;box-shadow:0 2px 6px rgba(198,143,123,0.4);white-space:nowrap;">Chờ xếp</div>`,
          iconSize: [56, 22],
          iconAnchor: [28, 11],
        });

        L.marker([pt.location.lat, pt.location.lng], { icon: uIcon })
          .bindPopup(
            `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;line-height:1.45;min-width:210px;color:#30433F;">
              <div style="font-weight:700;color:#7D4532;background:#F6EBE7;padding:2px 6px;border-radius:4px;display:inline-block;font-size:10px;">Yêu cầu Chưa Phân Công (${pt.priority})</div>
              <div style="font-weight:700;color:#30433F;margin-top:4px;">${pt.patientName}</div>
              <div style="color:#5A6E63;font-weight:600;font-size:11px;">${pt.serviceName}</div>
              <div style="color:#687873;font-size:11px;margin-top:2px;">${pt.address} (${pt.district})</div>
              <div style="color:#30433F;font-size:11px;margin-top:4px;"><strong>Khung giờ yêu cầu:</strong> ${pt.requestedWindow}</div>
            </div>`
          )
          .addTo(layerGroup);
      });
    }

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
  }, [itineraries, unassignedPoints, selectedStaffId, showUnassignedPins]);

  const handleFocusStop = (coord: GeoCoord, stop?: RouteStop) => {
    if (stop) setActiveStop(stop);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([coord.lat, coord.lng], 15, {
        duration: 0.6,
      });
    }
  };

  const displayedItineraries =
    selectedStaffId === 'ALL'
      ? itineraries
      : itineraries.filter((i) => i.staffId === selectedStaffId);

  const totalKmAll = itineraries
    .reduce((s, i) => s + i.totalDistanceKm, 0)
    .toFixed(1);
  const totalTravelMinAll = itineraries.reduce(
    (s, i) => s + i.totalTravelMinutes,
    0
  );

  return (
    <div className="space-y-5">
      {/* 1. HEADER & MAP FILTER BAR */}
      <div className="bg-white border border-[#E2DED5] rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#5A6E63] uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              <span>Bản Đồ Lộ Trình Nhân Sự & Điểm Chăm Sóc Tại Nhà (Leaflet GIS)</span>
            </div>
            <h1 className="text-xl font-bold text-[#30433F] mt-1">
              Lộ Trình Di Chuyển Nhân Sự Y Tế & Thứ Tự Điểm Dừng
            </h1>
            <p className="text-xs text-[#687873] mt-0.5">
              Hiển thị chuỗi điểm dừng theo nhân sự: Trạm xuất phát (H) → Điểm dừng ca chăm sóc (1 → 2 → 3) cùng khoảng cách và thời gian di chuyển ước tính (Estimated Haversine Travel).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Select
              value={selectedStaffId}
              onChange={setSelectedStaffId}
              className="w-56 text-xs"
              options={[
                { value: 'ALL', label: `Tất cả tuyến nhân sự (${itineraries.length})` },
                ...itineraries.map((i) => ({
                  value: i.staffId,
                  label: `${i.staffName} (${i.totalStops} điểm)`,
                })),
              ]}
            />

            <div className="flex items-center gap-1.5 text-xs bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#E2DED5]">
              <Switch
                size="small"
                checked={showUnassignedPins}
                onChange={setShowUnassignedPins}
              />
              <span className="text-[#30433F] font-medium">
                Hiện ca chờ xếp ({unassignedPoints.length})
              </span>
            </div>

            <Button
              type="primary"
              onClick={onNavigateToAI}
              className="bg-[#5A6E63] hover:!bg-[#4B5D53] border-none text-xs font-semibold flex items-center gap-1.5 h-9 px-3.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F5EFE6]" />
              <span>Phân công ca chờ</span>
            </Button>
          </div>
        </div>

        {/* Summary GIS Strip */}
        <div className="pt-3 border-t border-[#ECE9E2] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-[#30433F]">
              <span className="w-5 h-5 rounded bg-[#5A6E63] text-white font-bold flex items-center justify-center text-[10px]">
                H
              </span>
              <span>Trạm Xuất Phát (Base Hub)</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[#30433F]">
              <span className="w-5 h-5 rounded-full bg-[#879A8F] text-white font-bold flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Thứ tự điểm chăm sóc tại nhà</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[#7D4532]">
              <span className="px-2 py-0.5 rounded-full bg-[#C68F7B] text-white font-bold text-[10px]">
                Chờ xếp
              </span>
              <span>Yêu cầu chưa phân công</span>
            </span>
          </div>

          <div className="font-mono-num text-xs text-[#687873]">
            Tổng quãng đường ước tính: <strong className="text-[#30433F]">{totalKmAll} km</strong> · Tổng thời gian di chuyển ước tính: <strong className="text-[#5A6E63]">{totalTravelMinAll} phút</strong>
          </div>
        </div>
      </div>

      {/* 2. LEAFLET MAP + COMPACT SIDE ITINERARY PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT (8 cols): INTERACTIVE LEAFLET MAP */}
        <div className="lg:col-span-8 bg-white border border-[#E2DED5] rounded-xl overflow-hidden shadow-2xs">
          <div
            ref={mapContainerRef}
            className="w-full h-[560px] z-0"
          />
        </div>

        {/* RIGHT (4 cols): COMPACT SEQUENTIAL ROUTE ITINERARY PANEL */}
        <div className="lg:col-span-4 bg-white border border-[#E2DED5] rounded-xl p-4 shadow-2xs space-y-3.5 max-h-[560px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#ECE9E2] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#30433F]">
                Thứ Tự Điểm Dừng & Di Chuyển Ước Tính
              </h2>
              <p className="text-[11px] text-[#687873]">
                Nhấn vào từng điểm dừng để định vị trên bản đồ
              </p>
            </div>
            <span className="font-mono-num text-xs font-semibold px-2 py-0.5 rounded bg-[#E6ECE8] text-[#30433F]">
              {displayedItineraries.length} tuyến
            </span>
          </div>

          <div className="space-y-4">
            {displayedItineraries.map((itin) => (
              <div
                key={itin.staffId}
                className="border border-[#E2DED5] rounded-xl p-3.5 bg-[#FAF8F5] space-y-2.5"
              >
                {/* Staff Route Header */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E2DED5]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: itin.avatarColor }}
                    />
                    <div>
                      <div className="font-bold text-xs text-[#30433F]">
                        {itin.staffName}
                      </div>
                      <div className="text-[11px] text-[#687873]">
                        {itin.staffRole} · {itin.zone}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono-num text-[11px]">
                    <div className="font-bold text-[#5A6E63]">
                      ~{itin.totalDistanceKm} km · {itin.totalTravelMinutes}p
                    </div>
                    <div className="text-[#687873]">Tải {itin.workloadPct}%</div>
                  </div>
                </div>

                {/* Base Station Departure */}
                <button
                  type="button"
                  onClick={() => handleFocusStop(itin.baseLocation)}
                  className="w-full text-left p-2 rounded-lg bg-white border border-[#E2DED5] hover:border-[#879A8F] text-[11px] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span
                    className="w-5 h-5 rounded text-white font-bold flex items-center justify-center text-[10px] shrink-0"
                    style={{ backgroundColor: itin.avatarColor }}
                  >
                    H
                  </span>
                  <div className="truncate">
                    <div className="font-semibold text-[#30433F] truncate">
                      Xuất phát ({itin.shiftStart}): {itin.baseAddress}
                    </div>
                  </div>
                </button>

                {/* Sequential Stops */}
                <div className="space-y-2 pl-2.5 border-l-2 border-dashed border-[#D8D3C8] ml-2">
                  {itin.stops.map((stop) => {
                    const isFocused = activeStop?.assignmentId === stop.assignmentId;
                    return (
                      <button
                        key={stop.assignmentId}
                        type="button"
                        onClick={() => handleFocusStop(stop.location, stop)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer space-y-1 text-xs ${
                          isFocused
                            ? 'bg-[#E6ECE8]/70 border-[#5A6E63] ring-1 ring-[#879A8F]/40'
                            : stop.isConflict
                            ? 'bg-[#F6EBE7]/70 border-[#C68F7B]'
                            : 'bg-white border-[#E2DED5] hover:border-[#879A8F]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-5 h-5 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: stop.isConflict
                                  ? '#C68F7B'
                                  : itin.avatarColor,
                              }}
                            >
                              {stop.stopOrder}
                            </span>
                            <span className="font-mono-num font-bold text-[#30433F]">
                              {stop.startTime} – {stop.endTime}
                            </span>
                          </div>
                          <span className="font-mono-num text-[10px] text-[#687873] bg-[#FAF8F5] px-1.5 py-0.5 rounded border border-[#E2DED5]">
                            +{stop.legDistanceKm}km (~{stop.legTravelMinutes}p)
                          </span>
                        </div>

                        <div className="font-bold text-[#30433F] line-clamp-1">
                          BN: {stop.patientName} ({stop.patientAge}t)
                        </div>
                        <div className="text-[11px] text-[#5A6E63] font-medium line-clamp-1">
                          {stop.serviceName}
                        </div>
                        <div className="text-[11px] text-[#687873] truncate">
                          {stop.address}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
