# 🚀 Kodam Brawijaya — Backend Setup

## Persyaratan
- Python 3.11+
- PostgreSQL 16
- pip

---

## 1. Masuk ke folder backend
```bash
cd backend
```

## 2. Buat virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```

## 3. Install dependencies
```bash
pip install -r requirements.txt
```

## 4. Buat file .env
```bash
cp .env.example .env
```
Lalu edit file `.env` dan isi:
```
DATABASE_URL=postgresql://muflihulchoir@localhost:5432/sansidam_db
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx   ← isi API key OpenRouter kamu
OPENROUTER_MODEL=openai/gpt-4o-mini
```

> Catatan: sesuaikan `DATABASE_URL` dengan user & nama database Postgres di mesin kamu.

## 5. Jalankan backend
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 6. Cek API berjalan
Buka browser: **http://localhost:8000**
Swagger docs: **http://localhost:8000/docs**

---

## Endpoints Utama

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/news/` | Daftar berita |
| GET | `/api/news/stats` | Statistik hari ini |
| GET | `/api/news/by-region` | Data per wilayah |
| GET | `/api/news/trend` | Tren per jam |
| POST | `/api/agent/chat` | Chat AI Agent |
| GET | `/api/report/latest` | Laporan terbaru |
| POST | `/api/crawl/manual` | Trigger crawl manual |
| POST | `/api/analyze/manual` | Trigger analisis manual |
| GET | `/api/crawl/logs` | Log riwayat crawling |

---

## Catatan
- Crawling berjalan **otomatis tiap 10 menit** setelah backend dijalankan
- Tabel database dibuat **otomatis** saat pertama kali backend dijalankan
- Log crawling tersimpan di tabel `crawl_logs`
