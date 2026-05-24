# Sales ETL and Analytics Dashboard System

He thong web ho tro upload file CSV ban hang, xu ly ETL, lam sach du lieu, tinh toan chi so kinh doanh, hien thi dashboard phan tich doanh thu, du bao xu huong va quan tri batch/log ETL.

Du an gom 2 phan chinh:

- `backend`: FastAPI, SQLAlchemy, SQLite, pandas, numpy.
- `frontend`: React, Vite, Recharts, Axios.

## Yeu Cau Moi Truong

- Python 3.11 tro len.
- Node.js 20 LTS tro len.
- npm.

MacOS co the can Homebrew neu chay script `setup.sh`.

## Setup Tu Dong

### Windows

Chay tai thu muc goc du an:

```bat
setup.bat
```

### macOS/Linux

Chay tai thu muc goc du an:

```sh
chmod +x setup.sh
./setup.sh
```

Script setup se:

- Tao virtual environment cho backend trong `backend/venv`.
- Cai cac package Python tu `backend/requirements.txt`.
- Cai dependencies frontend bang `npm install`.
- Tao thu muc `backend/uploads`.
- Tao database SQLite va seed tai khoan demo.

## Setup Thu Cong

### Backend

```sh
cd backend
python -m venv venv
```

Windows:

```bat
venv\Scripts\activate
pip install -r requirements.txt
python scripts/seed_demo.py
```

macOS/Linux:

```sh
source venv/bin/activate
pip install -r requirements.txt
python scripts/seed_demo.py
```

### Frontend

```sh
cd frontend
npm install
```

## Khoi Dong Du An

Can mo 2 terminal rieng.

### Terminal 1: Backend

```sh
cd backend
```

Windows:

```bat
venv\Scripts\activate
python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8001
```

macOS/Linux:

```sh
source venv/bin/activate
python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8001
```

Backend mac dinh chay tai:

- API: `http://localhost:8001`
- Swagger Docs: `http://localhost:8001/docs`

### Terminal 2: Frontend

```sh
cd frontend
npm run dev
```

Frontend mac dinh chay tai:

- App: `http://localhost:5173`

## Tai Khoan Demo

Sau khi chay `setup.bat`, `setup.sh` hoac `python scripts/seed_demo.py`, co the dang nhap bang:

- Admin: `admin` / `admin123`
- User: `user` / `user123`

## Cau Hinh

Backend doc cau hinh tu file `.env` trong thu muc `backend` neu co. Neu khong co `.env`, he thong dung cau hinh mac dinh:

- `DATABASE_URL=sqlite:///./web_sales_etl.db`
- `API_PREFIX=/api`
- `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

Frontend co the cau hinh API URL bang bien moi truong:

```env
VITE_API_URL=http://localhost:8001/api
```
