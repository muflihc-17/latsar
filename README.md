# Kodam (Monorepo)

Struktur:

- `backend/`: FastAPI + PostgreSQL
- `frontend/`: Next.js dashboard

## Jalankan backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Jalankan frontend

```bash
cd frontend
npm install
npm run dev
```
