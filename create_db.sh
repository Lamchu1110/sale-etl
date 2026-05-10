#!/bin/zsh
# ============================================================
#   TAO DATABASE POSTGRESQL (macOS)
# ============================================================

echo ""
echo "============================================================"
echo "  TAO DATABASE POSTGRESQL"
echo "============================================================"
echo ""

# Đảm bảo PostgreSQL đang chạy
echo "Kiem tra PostgreSQL dang chay..."
brew services start postgresql@16 2>/dev/null || true

# Thử tạo database
psql -U postgres -c "CREATE DATABASE sales_etl;" 2>/dev/null

if [ $? -eq 0 ]; then
  echo ""
  echo "  OK: Database 'sales_etl' da duoc tao thanh cong!"
else
  echo ""
  echo "  WARN: Database co the da ton tai."
  echo "  Kiem tra: psql -U postgres -c '\l'"
fi

echo ""
echo "  Sau do hay chinh sua backend/.env:"
echo "  DATABASE_URL=postgresql://postgres:MAT_KHAU@localhost:5432/sales_etl"
echo ""
