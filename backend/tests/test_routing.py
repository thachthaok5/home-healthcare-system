"""
Test Suite: test_routing.py
Mục đích:
- Kiểm thử công cụ định tuyến OSRM / OpenStreetMap và cơ chế Safe Fallback Haversine.
- Kiểm thử tính đúng đắn của cự ly và thời gian di chuyển với tọa độ Nha Trang.
- Kiểm thử cơ chế bộ nhớ đệm (Cache).
- Kiểm thử xử lý ngoại lệ: tọa độ bất hợp lệ, tọa độ ngoài biên, điểm trùng nhau.
"""

import pytest
from app.ai.routing import RoutingEngine


def test_routing_nha_trang_real_locations():
    """Kiểm thử tính khoảng cách giữa 2 phường tại Nha Trang (Lộc Thọ -> Vĩnh Hải)"""
    # Lộc Thọ: 12.2388, 109.1967 | Vĩnh Hải: 12.2789, 109.1983
    dist_km, travel_mins, source = RoutingEngine.get_distance_and_travel_time(
        from_lat=12.2388, from_lon=109.1967,
        to_lat=12.2789, to_lon=109.1983,
        allow_network=True
    )
    assert dist_km > 3.0, f"Khoảng cách Lộc Thọ - Vĩnh Hải phải > 3km, thực tế: {dist_km}"
    assert travel_mins >= 5, f"Thời gian di chuyển phải >= 5 phút, thực tế: {travel_mins}"
    assert source in ["osrm_network", "osrm_cache", "haversine_fallback"]


def test_routing_cache_mechanism():
    """Kiểm thử tính năng lưu và lấy kết quả từ Cache"""
    lat1, lon1 = 12.2450, 109.1900
    lat2, lon2 = 12.2500, 109.2000

    # Lần 1: Gọi tính toán
    dist1, time1, _ = RoutingEngine.get_distance_and_travel_time(lat1, lon1, lat2, lon2, allow_network=False)
    
    # Lần 2: Phải lấy từ Cache
    dist2, time2, src2 = RoutingEngine.get_distance_and_travel_time(lat1, lon1, lat2, lon2, allow_network=False)
    
    assert dist1 == dist2
    assert time1 == time2
    assert src2 == "osrm_cache"


def test_routing_same_location():
    """Kiểm thử trường hợp điểm xuất phát và đích trùng nhau"""
    dist, travel_time, src = RoutingEngine.get_distance_and_travel_time(
        12.2400, 109.1900, 12.2400, 109.1900
    )
    assert dist == 0.0
    assert travel_time <= 3
    assert src == "same_location"


def test_routing_invalid_and_out_of_bounds_coordinates():
    """Kiểm thử cơ chế an toàn khi tọa độ bất hợp lệ hoặc ngoài phạm vi Trái Đất"""
    # Tọa độ None
    d1, t1, s1 = RoutingEngine.get_distance_and_travel_time(None, None, 12.0, 109.0)
    assert s1 == "default_fallback"
    assert d1 == 3.0 and t1 == 10

    # Tọa độ ngoài biên
    d2, t2, s2 = RoutingEngine.get_distance_and_travel_time(999.0, 109.0, 12.0, 109.0)
    assert s2 == "out_of_bounds_fallback"


def test_routing_fallback_haversine_accuracy():
    """Kiểm thử độ chính xác của hàm ước lượng hình học Haversine Nha Trang"""
    # Cự ly ~ 4.5 km đường chim bay giữa Lộc Thọ và Phước Hải
    dist, travel_time = RoutingEngine.haversine_estimate(12.2388, 109.1967, 12.2200, 109.1800)
    assert 2.0 <= dist <= 6.0
    assert 5 <= travel_time <= 25
