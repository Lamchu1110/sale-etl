#!/bin/zsh
# ============================================================
#   SALES ETL - SETUP MOI TRUONG TU DONG (macOS)
#   Chu Quang Lam - 23070406 - VNU-IS Group 3
# ============================================================

echo ""
echo "============================================================"
echo "  SALES ETL - SETUP MOI TRUONG (macOS)"
echo "============================================================"
echo ""

# ── Kiểm tra Homebrew ────────────────────────────────────────
echo "[0/4] Kiem tra Homebrew..."
if ! command -v brew &>/dev/null; then
  echo "   Chua co Homebrew. Dang cai..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "   OK: Homebrew da co san"
fi

# ── Kiểm tra Python ──────────────────────────────────────────
echo ""
echo "[1/4] Kiem tra Python..."
if ! command -v python3 &>/dev/null; then
  echo "   Chua co Python. Dang cai Python 3.11..."
  brew install python@3.11
else
  python3 --version
  echo "   OK: Python da san sang"
fi

# ── Kiểm tra Node.js ─────────────────────────────────────────
echo ""
echo "[2/4] Kiem tra Node.js..."
if ! command -v node &>/dev/null; then
  echo "   Chua co Node.js. Dang cai..."
  brew install node@20
else
  node --version
  echo "   OK: Node.js da san sang"
fi

# ── Backend setup ────────────────────────────────────────────
echo ""
echo "[3/4] Cai dat Backend (Python + FastAPI + SQLite)..."
cd backend

if [ ! -d "venv" ]; then
  echo "   Tao virtual environment..."
  python3 -m venv venv
  echo "   OK: Virtual environment da tao"
else
  echo "   OK: Virtual environment da co san"
fi

echo "   Cai thu vien Python..."
source venv/bin/activate
pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
  echo "   ERROR: Cai thu vien that bai"
  exit 1
fi
echo "   OK: Thu vien Python da cai xong"

mkdir -p uploads
echo "   OK: Thu muc uploads da san sang"

# Seed demo data
echo "   Seed demo users..."
python scripts/seed_demo.py
echo "   OK: Demo users da tao (admin/admin123, user/user123)"

deactivate
cd ..

# ── Frontend setup ───────────────────────────────────────────
echo ""
echo "[4/4] Cai dat Frontend (React + npm)..."
cd frontend
npm install --silent
if [ $? -ne 0 ]; then
  echo "   ERROR: npm install that bai"
  exit 1
fi
echo "   OK: Node modules da cai xong"
cd ..

# ── Kết quả ──────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  SETUP HOAN TAT!"
echo ""
echo "  Backend su dung SQLite (khong can PostgreSQL)"
echo ""
echo "  Chay ung dung:"
echo "  Terminal 1: cd backend && source venv/bin/activate && python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8001"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "  Truy cap: http://localhost:5173"
echo "  API Docs: http://localhost:8001/docs"
echo "============================================================"
echo ""
