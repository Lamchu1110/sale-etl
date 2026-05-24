@echo off
echo ============================================================
echo   SALES ETL - SETUP MOI TRUONG TU DONG
echo   Chu Quang Lam - 23070406 - VNU-IS Group 3
echo ============================================================
echo.

REM ── Kiểm tra Python ─────────────────────────────────────────
echo [1/4] Kiem tra Python...
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo    ERROR: Python chua duoc cai. Vui long cai Python 3.11+
    echo    Link: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo    OK: Python da san sang

REM ── Kiểm tra Node.js ────────────────────────────────────────
echo.
echo [2/4] Kiem tra Node.js...
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo    ERROR: Node.js chua duoc cai. Vui long cai Node.js 20 LTS
    echo    Link: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo    OK: Node.js da san sang

REM ── Backend setup ───────────────────────────────────────────
echo.
echo [3/4] Cai dat Backend (Python + FastAPI + SQLite)...
cd backend

IF NOT EXIST "venv" (
    echo    Tao virtual environment...
    python -m venv venv
    echo    OK: Virtual environment da tao
) ELSE (
    echo    OK: Virtual environment da co san
)

echo    Cai thu vien Python...
call venv\Scripts\activate
pip install -r requirements.txt --quiet
IF %ERRORLEVEL% NEQ 0 (
    echo    ERROR: Cai thu vien that bai
    pause
    exit /b 1
)
echo    OK: Thu vien Python da cai xong

IF NOT EXIST "uploads" mkdir uploads
echo    OK: Thu muc uploads da san sang

REM ── Seed demo data ──────────────────────────────────────────
echo    Seed demo users...
python scripts/seed_demo.py
echo    OK: Demo users da tao (admin/admin123, user/user123)

cd ..

REM ── Frontend setup ──────────────────────────────────────────
echo.
echo [4/4] Cai dat Frontend (React + npm)...
cd frontend
npm install --silent
IF %ERRORLEVEL% NEQ 0 (
    echo    ERROR: npm install that bai
    pause
    exit /b 1
)
echo    OK: Node modules da cai xong
cd ..

REM ── Kết quả ─────────────────────────────────────────────────
echo.
echo ============================================================
echo   SETUP HOAN TAT!
echo.
echo   Backend su dung SQLite (khong can PostgreSQL)
echo.
echo   Chay ung dung:
echo   Terminal 1: cd backend ^&^& venv\Scripts\activate ^&^& python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8001
echo   Terminal 2: cd frontend ^&^& npm run dev
echo.
echo   Truy cap: http://localhost:5173
echo   API Docs: http://localhost:8001/docs
echo ============================================================
echo.
pause
