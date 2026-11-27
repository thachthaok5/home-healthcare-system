"""
Script: precompute_routing_matrix.py
Mục đích:
- Sinh trước ma trận khoảng cách/thời gian đường bộ OSRM cho ĐÚNG các điểm được dùng trong benchmark
  (tọa độ yêu cầu của từng cặp (mức tải, seed) + trạm xuất phát của nhân viên), rồi ghi vào
  backend/artifacts/data/routing_matrix_benchmark.json.gz (nén gzip).
- Khi chạy run_stress_test.py (mạng bị tắt), các truy vấn sẽ lấy từ cache OSRM thay vì rơi về Haversine.
- Dùng OSRM Table API (profile driving) trên máy chủ công khai router.project-osrm.org, chia khối
  50 x 50 điểm để không vượt giới hạn 100 tọa độ/truy vấn.

Cách chạy (cần Internet, chạy một lần trước khi chạy pipeline thực nghiệm):
    python backend/scripts/precompute_routing_matrix.py
"""
import sys
import math
import time
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import httpx

from app.ai.routing import RoutingEngine, PRECOMPUTED_MATRIX_FILE
import run_stress_test as rst

OSRM_TABLE_URL = "https://router.project-osrm.org/table/v1/driving/"
BLOCK = 50          # 50 nguồn + 50 đích = 100 tọa độ / truy vấn
SLEEP_SECONDS = 1.0  # tôn trọng giới hạn tần suất của máy chủ OSRM công khai


def cache_key(f_lat, f_lon, t_lat, t_lon):
    return f"{f_lat:.5f},{f_lon:.5f}->{t_lat:.5f},{t_lon:.5f}"


def is_same_location(a, b):
    return abs(a[0] - b[0]) < 0.0003 and abs(a[1] - b[1]) < 0.0003


def collect_point_sets():
    """Trả về danh sách tập điểm, mỗi tập ứng với một lần chạy (load, seed) trong pipeline."""
    emps, services, srv_skills, db = rst.load_fixtures()
    try:
        bases = [(float(e.base_lat), float(e.base_lon)) for e in emps]
        target_date = rst.get_benchmark_target_date()
        point_sets = []
        for load in rst.LOADS:
            for seed in rst.SEEDS:
                reqs, _ = rst.generate_requests(load, seed, target_date, emps=emps, services=services, srv_skills=srv_skills, db=db)
                pts = bases + [(float(r.lat), float(r.lon)) for r in reqs]
                # Bỏ trùng, giữ thứ tự
                seen, uniq = set(), []
                for p in pts:
                    k = (round(p[0], 5), round(p[1], 5))
                    if k not in seen:
                        seen.add(k)
                        uniq.append(p)
                point_sets.append(((load, seed), uniq))
        return point_sets
    finally:
        if db:
            db.close()


def fetch_block(client, src, dst):
    coords = src + dst
    coord_str = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in coords)
    sources = ";".join(str(i) for i in range(len(src)))
    destinations = ";".join(str(len(src) + j) for j in range(len(dst)))
    url = f"{OSRM_TABLE_URL}{coord_str}?sources={sources}&destinations={destinations}&annotations=distance,duration"
    for attempt in range(5):
        try:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok":
                    return data["distances"], data["durations"]
            time.sleep(2 ** attempt)
        except Exception:
            time.sleep(2 ** attempt)
    raise RuntimeError("OSRM Table API không phản hồi sau 5 lần thử")


def main():
    RoutingEngine._init_cache()
    cache = RoutingEngine._memory_cache
    point_sets = collect_point_sets()
    added = 0
    with httpx.Client(timeout=30.0) as client:
        for (load, seed), pts in point_sets:
            # Kiểm tra cặp nào còn thiếu trong cache
            missing = any(
                cache_key(a[0], a[1], b[0], b[1]) not in cache or cache[cache_key(a[0], a[1], b[0], b[1])][2] == "haversine_fallback"
                for a in pts for b in pts if not is_same_location(a, b)
            )
            if not missing:
                print(f"-> load={load} seed={seed}: đã đủ trong cache ({len(pts)} điểm)")
                continue
            blocks = [pts[i:i + BLOCK] for i in range(0, len(pts), BLOCK)]
            for src in blocks:
                for dst in blocks:
                    dists, durs = fetch_block(client, src, dst)
                    for i, a in enumerate(src):
                        for j, b in enumerate(dst):
                            if is_same_location(a, b):
                                continue
                            d, t = dists[i][j], durs[i][j]
                            if d is None or t is None:
                                continue
                            dist_km = round(d / 1000.0, 2)
                            # Cùng quy ước với RoutingEngine: +3 phút tìm nhà/đỗ xe
                            dur_mins = max(3, int(math.ceil(t / 60.0)) + 3)
                            k = cache_key(a[0], a[1], b[0], b[1])
                            if k not in cache or cache[k][2] == "haversine_fallback":
                                added += 1
                            cache[k] = (dist_km, dur_mins, "osrm_network")
                    time.sleep(SLEEP_SECONDS)
            print(f"-> load={load} seed={seed}: {len(pts)} điểm, tổng cặp mới đến nay {added}")

    # Chỉ lưu các cặp lấy từ OSRM (không lưu Haversine vào cache)
    import gzip
    osrm_only = {k: [v[0], v[1], "osrm_cache"] for k, v in sorted(cache.items()) if v[2] in ("osrm_network", "osrm_cache")}
    PRECOMPUTED_MATRIX_FILE.parent.mkdir(parents=True, exist_ok=True)
    # mtime=0 để file nén tất định (cùng nội dung → cùng byte)
    with open(PRECOMPUTED_MATRIX_FILE, "wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
            gz.write(json.dumps(osrm_only, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    print(f"\nĐã ghi {len(osrm_only):,} cặp OSRM vào {PRECOMPUTED_MATRIX_FILE} (thêm mới {added:,}).")


if __name__ == "__main__":
    main()
