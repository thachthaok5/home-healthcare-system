"""
Module: routing.py
Mục đích:
- Tính toán khoảng cách (km) và thời gian di chuyển (phút) theo mạng lưới đường sá thực tế OSRM (Open Source Routing Machine / OpenStreetMap).
- Tích hợp bộ nhớ đệm đa tầng (In-memory & JSON disk cache) để giảm thiểu độ trễ, tối ưu hiệu năng và đảm bảo khả năng tái lập thực nghiệm.
- Cơ chế dự phòng (Safe Fallback) về giải thuật Haversine (tốc độ xe máy nội thành Nha Trang 25 km/h + 3 phút dự phòng đỗ xe) khi không có mạng hoặc OSRM timeout.
- Xử lý các trường hợp biên: tọa độ bất hợp lệ, vị trí trùng nhau, lỗi dịch vụ định tuyến.
"""

import json
import logging
import math
from pathlib import Path
from decimal import Decimal
from typing import Optional, Tuple, Dict
import httpx

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).resolve().parent.parent.parent / "artifacts" / "data" / "routing_cache.json"


class RoutingEngine:
    """
    Công cụ tính toán cự ly và thời gian di chuyển tích hợp OSRM và Fallback Haversine.
    """
    _memory_cache: Dict[str, Tuple[float, int, str]] = {}
    _cache_loaded: bool = False

    @classmethod
    def _init_cache(cls):
        if cls._cache_loaded:
            return
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    cls._memory_cache = {k: (v[0], v[1], v[2]) for k, v in data.items()}
            except Exception as e:
                logger.warning(f"Không thể đọc routing cache từ file: {e}")
        cls._cache_loaded = True

    @classmethod
    def _save_cache(cls):
        try:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cls._memory_cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Không thể lưu routing cache: {e}")

    @staticmethod
    def haversine_estimate(
        from_lat: float,
        from_lon: float,
        to_lat: float,
        to_lon: float,
        speed_kmh: float = 25.0,
        parking_buffer_mins: int = 3
    ) -> Tuple[float, int]:
        """
        Tính toán cự ly hình học Haversine đường chim bay và ước tính thời gian di chuyển.
        """
        lat1, lon1 = math.radians(from_lat), math.radians(from_lon)
        lat2, lon2 = math.radians(to_lat), math.radians(to_lon)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
        c = 2.0 * math.asin(math.sqrt(max(0.0, min(1.0, a))))
        dist_km = 6371.0 * c
        # Hệ số uốn lượn đường đô thị (circuity factor) ~ 1.3 đối với đô thị ven biển Nha Trang
        actual_est_km = dist_km * 1.3
        travel_mins = int((actual_est_km / speed_kmh) * 60) + parking_buffer_mins
        return round(actual_est_km, 2), max(3, travel_mins)

    @classmethod
    def get_distance_and_travel_time(
        cls,
        from_lat: Optional[float | Decimal],
        from_lon: Optional[float | Decimal],
        to_lat: Optional[float | Decimal],
        to_lon: Optional[float | Decimal],
        timeout_seconds: float = 2.0,
        allow_network: bool = True
    ) -> Tuple[float, int, str]:
        """
        Tính cự ly (km) và thời gian di chuyển (phút).
        Trả về: (distance_km, travel_minutes, source)
        source: 'osrm_network', 'osrm_cache', hoặc 'haversine_fallback'
        """
        cls._init_cache()

        # Kiểm tra tính hợp lệ của tọa độ
        if from_lat is None or from_lon is None or to_lat is None or to_lon is None:
            return 3.0, 10, "default_fallback"

        try:
            f_lat = float(from_lat)
            f_lon = float(from_lon)
            t_lat = float(to_lat)
            t_lon = float(to_lon)
        except (ValueError, TypeError):
            return 3.0, 10, "invalid_coords_fallback"

        # Kiểm tra biên vĩ độ, kinh độ
        if not (-90.0 <= f_lat <= 90.0 and -180.0 <= f_lon <= 180.0 and
                -90.0 <= t_lat <= 90.0 and -180.0 <= t_lon <= 180.0):
            return 3.0, 10, "out_of_bounds_fallback"

        # Điểm trùng nhau hoặc cực gần (< 30m)
        if abs(f_lat - t_lat) < 0.0003 and abs(f_lon - t_lon) < 0.0003:
            return 0.0, 2, "same_location"

        cache_key = f"{f_lat:.5f},{f_lon:.5f}->{t_lat:.5f},{t_lon:.5f}"
        if cache_key in cls._memory_cache:
            dist_km, dur_mins, _ = cls._memory_cache[cache_key]
            return dist_km, dur_mins, "osrm_cache"

        # Nếu cho phép gọi mạng, truy vấn OSRM public server
        if allow_network:
            url = f"http://router.project-osrm.org/route/v1/driving/{f_lon:.6f},{f_lat:.6f};{t_lon:.6f},{t_lat:.6f}?overview=false"
            try:
                with httpx.Client(timeout=timeout_seconds) as client:
                    resp = client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                            route = data["routes"][0]
                            dist_km = round(route["distance"] / 1000.0, 2)
                            # Bổ sung 3 phút dự phòng tìm nhà/đỗ xe trong hẻm Nha Trang
                            dur_mins = max(3, int(math.ceil(route["duration"] / 60.0)) + 3)
                            
                            cls._memory_cache[cache_key] = (dist_km, dur_mins, "osrm_network")
                            cls._save_cache()
                            return dist_km, dur_mins, "osrm_network"
            except Exception as e:
                logger.debug(f"OSRM query fallback do ngoại lệ: {e}")

        # Dự phòng Fallback Haversine
        h_dist, h_time = cls.haversine_estimate(f_lat, f_lon, t_lat, t_lon)
        cls._memory_cache[cache_key] = (h_dist, h_time, "haversine_fallback")
        return h_dist, h_time, "haversine_fallback"

    @classmethod
    def clear_cache(cls):
        """Xóa bộ nhớ đệm (dùng cho test)"""
        cls._memory_cache.clear()
        cls._cache_loaded = False
        if CACHE_FILE.exists():
            try:
                CACHE_FILE.unlink()
            except Exception:
                pass
