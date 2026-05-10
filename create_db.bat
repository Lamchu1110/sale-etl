@echo off
echo ============================================================
echo   TAO DATABASE POSTGRESQL
echo ============================================================
echo.
echo Ban can nhap mat khau PostgreSQL (mat khau user postgres)
echo.
psql -U postgres -c "CREATE DATABASE sales_etl;" 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo.
    echo   OK: Database "sales_etl" da duoc tao thanh cong!
) ELSE (
    echo.
    echo   WARN: Database co the da ton tai hoac co loi.
    echo   Thu chay: psql -U postgres -c "SELECT datname FROM pg_database;"
    echo   de kiem tra database da ton tai chua.
)
echo.
pause
