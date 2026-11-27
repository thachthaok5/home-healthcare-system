#!/usr/bin/env bash
# Chạy lại TOÀN BỘ pipeline thực nghiệm tại commit hiện tại (cần cây mã nguồn sạch, đã commit).
# Yêu cầu: PostgreSQL đang chạy, biến DATABASE_URL (hoặc DB_*) trỏ tới CSDL home_healthcare_db,
#          đã cài backend/requirements.txt. Không cần Internet (ma trận OSRM đã tính trước).
# Cách chạy (từ thư mục gốc repo):  bash backend/scripts/run_full_pipeline.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONPATH="$PWD/backend"

if [ -n "$(git status --porcelain -- backend/app backend/scripts backend/requirements.txt backend/artifacts/models backend/artifacts/data)" ]; then
  echo "LỖI: còn thay đổi chưa commit trong mã nguồn backend. Hãy commit trước khi chạy pipeline." >&2
  exit 1
fi

echo "[1/5] Khởi tạo lại schema và seed CSDL sạch"
python - <<'PY'
from app.db.session import engine
from app.models import Base
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("Schema created")
PY
python backend/scripts/seed_database.py

echo "[2/5] Robustness Test mô hình AI (R0–R4 x 5 seeds)"
python backend/scripts/run_ai_robustness_test.py

echo "[3/5] Stress Test + Actual Duration + DSS Sensitivity + độ nhạy ngưỡng trễ + manifest"
python backend/scripts/run_stress_test.py

echo "[4/5] Kiểm định độc lập"
python backend/scripts/verify_experiments.py

echo "[5/5] Sinh báo cáo Word từ CSV + manifest"
python docs/generate_word_report.py
echo "HOÀN TẤT. Commit backend/artifacts/experiments/ và file .docx trong docs/."
