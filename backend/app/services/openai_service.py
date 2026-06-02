import httpx
import json
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import News, NewsAnalysis
from app.config import get_settings
import uuid

logger = logging.getLogger(__name__)
settings = get_settings()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Set untuk track berita yang sedang dianalisis (hindari double)
_analyzing_ids: set = set()
_deep_profiling_ids: set = set()

CATEGORIES = [
    "MBG",
    "KDMP",
    "Jembatan Garuda",
    "TNI",
    "Politik & Korupsi",
    "Demo & Konsolidasi",
    "Bencana Alam",
    "Narkoba",
]

THREAT_TYPES = [
    "Bencana Alam",
    "Kriminalitas",
    "Konflik Sosial",
    "Separatisme",
    "Terorisme",
    "Instabilitas Politik",
    "Keresahan Ekonomi",
    "Gangguan Kamtibmas",
    "Penyimpangan Oknum TNI/Polri",
    "Isu Viral & Citra Institusi TNI",
    "Keracunan & Kesehatan Publik",
    "Lainnya",
]


async def call_groq(prompt: str, max_tokens: int = 1000, retries: int = 5) -> str:
    """Panggil Groq API dengan retry otomatis jika 429."""
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }

    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(GROQ_URL, headers=headers, json=payload)

                if response.status_code == 429:
                    delays = [30, 60, 120, 180]
                    wait = delays[attempt] if attempt < len(delays) else 180
                    logger.warning(f"Rate limit 429, tunggu {wait}s... (attempt {attempt+1}/{retries})")
                    await asyncio.sleep(wait)
                    continue

                response.raise_for_status()
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    return ""
                content = choices[0].get("message", {}).get("content", "")
                return content.strip() if content else ""

        except httpx.HTTPStatusError:
            if attempt == retries - 1:
                raise
            await asyncio.sleep(5)

    raise Exception("Gagal setelah semua retry")


def _parse_json_response(text: str) -> dict:
    """Parse JSON dari response AI, toleran terhadap teks tambahan."""
    clean = text.replace("```json", "").replace("```", "").strip()
    start = clean.find("{")
    end = clean.rfind("}") + 1
    if start >= 0 and end > start:
        clean = clean[start:end]
    return json.loads(clean)


# ─── PROMPT 1: Fast Classify (hemat token, hanya sentiment + category) ───

def _build_fast_classify_prompt(title: str, region: str, description: str) -> str:
    return f"""Kamu adalah analis intelijen. Klasifikasikan berita ancaman dari wilayah Jawa Timur berikut.

JUDUL: {title}
WILAYAH: {region}
DESKRIPSI: {description or '-'}

PANDUAN SENTIMEN:
- "negatif": Berita mengandung ancaman, kerugian, kegagalan, skandal, kriminal, bencana, konflik, demo, korupsi, kecelakaan, program bermasalah, isu viral negatif TNI, dll.
- "netral": Informasi umum tanpa dampak jelas, statistik rutin, pengumuman jadwal.
- "positif": Prestasi, keberhasilan, penghargaan, dampak baik.
CATATAN: Jika ragu antara netral dan negatif, PILIH negatif. Prioritaskan deteksi ancaman.

PANDUAN KATEGORI:
- WAJIB pilih "MBG" jika berita membahas program Makan Bergizi Gratis atau SPPG.
- WAJIB pilih "KDMP" jika berita membahas Koperasi Desa Merah Putih atau Kopdes.
- WAJIB pilih "Jembatan Garuda" jika membahas proyek jembatan tersebut.
Untuk isu lainnya, sesuaikan dengan kategori yang ada.

Respons HANYA JSON (tanpa teks lain):
{{
  "sentiment": "negatif" atau "netral" atau "positif",
  "sentiment_score": angka 0.0-1.0 (0.0=sangat positif, 1.0=sangat negatif),
  "category": salah satu dari {CATEGORIES}
}}"""


# ─── PROMPT 2: Deep Profile (lengkap, on-demand) ───

def _build_deep_profile_prompt(title: str, region: str, content: str) -> str:
    return f"""Kamu adalah analis Intelijen Siber Kodam V/Brawijaya. Lakukan profiling intelijen mendalam terhadap berita ancaman berikut.

JUDUL: {title}
WILAYAH: {region}
ISI ARTIKEL:
{content}

Respons HANYA JSON (tanpa teks lain):
{{
  "facts": [
    "Fakta detail 1 dari artikel (kalimat panjang, komprehensif)",
    "Fakta detail 2 - kronologi/kejadian penting",
    "Fakta detail 3 - data angka/waktu/kutipan penting jika ada"
  ],
  "keywords": ["kata", "kunci", "dominan", "maksimal 8"],
  "entities": {{
    "locations": ["daftar lokasi spesifik"],
    "persons": ["daftar nama tokoh/pejabat"],
    "organizations": ["daftar instansi/organisasi"]
  }},
  "threat_level": angka 1-5 (1=Rendah, 2=Sedang-Rendah, 3=Sedang, 4=Tinggi, 5=Kritis),
  "threat_type": salah satu dari {THREAT_TYPES},
  "escalation_potential": "Analisis berita ini secara objektif: latar belakang, dampak, dan implikasinya. Max 4 kalimat. JANGAN sebut subjek 'Kodam V/Brawijaya'.",
  "recommended_action": "Tindakan mitigasi konkret yang direkomendasikan dalam pov intelejen siber tni ad tanpa menyebutkan subjek tersebut dalam kalimat. Mulai langsung dengan kata kerja (contoh: 'Tingkatkan patroli...'). Max 3 kalimat."
}}"""


# ─────────────────────────────────────────────────────────────────────────────
# FASE 1: Fast Classify — dipanggil oleh scheduler/crawler
# Hanya simpan berita NEGATIF ke DB dengan status "pending"
# ─────────────────────────────────────────────────────────────────────────────

async def fast_classify(db: Session, news: News) -> bool:
    """
    Klasifikasi cepat sentimen + kategori.
    Hanya simpan ke DB jika negatif.
    Return True jika berhasil diproses (meski netral/positif).
    """
    if news.id in _analyzing_ids:
        logger.info(f"⏭ Skip (sedang dianalisis): {news.title[:50]}")
        return False

    existing = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news.id).first()
    if existing:
        return True  # sudah pernah dianalisis

    _analyzing_ids.add(news.id)
    try:
        logger.info(f"🤖 Fast classify: '{news.title[:60]}'...")
        prompt = _build_fast_classify_prompt(news.title, news.region or "", news.description or "")
        result_text = await call_groq(prompt, max_tokens=200)

        if not result_text:
            logger.warning(f"Response kosong untuk: {news.title[:50]}")
            return False

        result = _parse_json_response(result_text)
        sentiment = result.get("sentiment", "netral")
        category = result.get("category", "Lainnya")

        # ── STRICT OVERRIDE KATEGORI KHUSUS ──
        # Memaksa kategori jika terdeteksi kata kunci spesifik di judul/deskripsi
        # karena AI kadang salah klasifikasi (misal: korupsi dana desa MBG masuk ke 'Politik & Korupsi')
        text_to_check = f"{news.title} {news.description or ''}".lower()
        
        # 1. MBG (Makan Bergizi Gratis / Badan Gizi Nasional / SPPG)
        mbg_keywords = ["mbg", "makan bergizi gratis", "sppg", "bgn", "badan gizi nasional"]
        if any(kw in text_to_check for kw in mbg_keywords):
            category = "MBG"
        
        # 2. KDMP (Koperasi Desa Merah Putih)
        elif "kdmp" in text_to_check or "koperasi desa merah putih" in text_to_check or "kopdes" in text_to_check:
            category = "KDMP"
            
        # 3. Jembatan Garuda
        elif "jembatan garuda" in text_to_check:
            category = "Jembatan Garuda"

        # HANYA simpan jika negatif
        if sentiment != "negatif":
            logger.info(f"  ↪ Sentimen '{sentiment}' — tidak disimpan")
            return True  # bukan error, hanya tidak relevan

        analysis = NewsAnalysis(
            id=str(uuid.uuid4()),
            news_id=news.id,
            sentiment="negatif",
            sentiment_score=float(result.get("sentiment_score", 0.7)),
            category=category,
            profiling_status="pending",
            # Deep profiling fields = NULL (diisi on-demand)
            facts=None,
            keywords=None,
            entities=None,
            threat_level=None,
            threat_type=None,
            escalation_potential=None,
            recommended_action=None,
        )
        db.add(analysis)
        db.commit()
        logger.info(f"  ✅ Tersimpan NEGATIF [{analysis.category}]: {news.title[:50]}")
        return True

    except json.JSONDecodeError as e:
        logger.warning(f"Gagal parse JSON: {e}")
        return False
    except Exception as e:
        logger.error(f"Error fast classify {news.id}: {e}")
        db.rollback()
        return False
    finally:
        _analyzing_ids.discard(news.id)


# ─────────────────────────────────────────────────────────────────────────────
# FASE 2: Deep Profile — dipanggil on-demand dari endpoint
# Mengisi semua field intel (facts, entities, threat_*, dll.)
# ─────────────────────────────────────────────────────────────────────────────

async def deep_profile(db: Session, news_id: str) -> dict:
    """
    Deep profiling intelijen on-demand untuk berita negatif.
    Scrape artikel, analisis AI lengkap, update DB.
    Return dict hasil atau raise Exception jika gagal.
    """
    if news_id in _deep_profiling_ids:
        raise Exception("Berita sedang dalam proses profiling, harap tunggu.")

    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise Exception("Berita tidak ditemukan")

    analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if not analysis:
        raise Exception("Analisis dasar belum tersedia. Berita belum diproses oleh crawler.")

    _deep_profiling_ids.add(news_id)
    try:
        # 1. Scrape konten artikel
        content = ""
        if news.url and "news.google" not in news.url:
            try:
                from app.services.scraper_service import scrape_article
                content = await scrape_article(news.url) or ""
                logger.info(f"  📄 Konten scraped: {len(content)} chars")
            except Exception as e:
                logger.warning(f"  Scraping gagal: {e}")

        # Fallback ke description jika scraping gagal atau terlalu pendek
        if len(content) < 100:
            content = news.description or news.title
            logger.info(f"  ↪ Fallback ke description ({len(content)} chars)")

        # 2. Deep profiling via Groq
        logger.info(f"  🧠 Deep profiling: '{news.title[:60]}'...")
        prompt = _build_deep_profile_prompt(news.title, news.region or "", content[:3000])
        result_text = await call_groq(prompt, max_tokens=1500)

        if not result_text:
            raise Exception("Respons AI kosong")

        result = _parse_json_response(result_text)

        # 3. Update analysis di DB
        analysis.facts               = result.get("facts", [])
        analysis.keywords            = result.get("keywords", [])
        analysis.entities            = result.get("entities", {"locations": [], "persons": [], "organizations": []})
        analysis.threat_level        = int(result.get("threat_level", 2))
        analysis.threat_type         = result.get("threat_type", "Lainnya")
        analysis.escalation_potential = result.get("escalation_potential", "")
        analysis.recommended_action  = result.get("recommended_action", "")
        analysis.profiling_status    = "complete"
        analysis.profiled_at         = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"  ✅ Deep profiling selesai: level={analysis.threat_level}, type={analysis.threat_type}")

        return {
            "success": True,
            "news_id": news_id,
            "profiling_status": "complete",
            "threat_level": analysis.threat_level,
            "threat_type": analysis.threat_type,
            "facts": analysis.facts,
            "keywords": analysis.keywords,
            "entities": analysis.entities,
            "escalation_potential": analysis.escalation_potential,
            "recommended_action": analysis.recommended_action,
        }

    except json.JSONDecodeError as e:
        analysis.profiling_status = "failed"
        db.commit()
        raise Exception(f"Gagal parse respons AI: {e}")
    except Exception as e:
        db.rollback()
        analysis.profiling_status = "failed"
        try:
            db.commit()
        except Exception:
            pass
        raise
    finally:
        _deep_profiling_ids.discard(news_id)


# ─────────────────────────────────────────────────────────────────────────────
# Batch analyze (untuk trigger manual — analisis semua pending)
# ─────────────────────────────────────────────────────────────────────────────

async def classify_pending_news(db: Session) -> dict:
    """Klasifikasi batch berita yang belum dianalisis (trigger manual)."""
    analyzed_ids = {row[0] for row in db.query(NewsAnalysis.news_id).all()}
    unanalyzed = db.query(News).filter(~News.id.in_(analyzed_ids)).limit(30).all()

    if not unanalyzed:
        return {"classified": 0, "saved_negative": 0, "message": "Semua berita sudah dianalisis"}

    classified = 0
    saved = 0
    for news in unanalyzed:
        success = await fast_classify(db, news)
        if success:
            classified += 1
            # Cek apakah tersimpan sebagai negatif
            if db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news.id).first():
                saved += 1
        await asyncio.sleep(8)  # lebih cepat karena prompt lebih kecil

    return {
        "classified": classified,
        "saved_negative": saved,
        "skipped_non_negative": classified - saved,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Daily Report (tetap dipertahankan)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_daily_report(db: Session) -> str:
    """Generate ringkasan eksekutif harian berbasis berita negatif."""
    from datetime import date
    from app.models import DailyReport
    from sqlalchemy import cast, Date

    today = date.today().isoformat()

    neg_news = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(cast(News.crawled_at, Date) == today).limit(15).all()

    if not neg_news:
        return "Tidak ada data berita negatif hari ini."

    news_list = "\n".join([
        f"- [{n.region}][{a.category}] {n.title}"
        for n, a in neg_news
    ])

    prompt = f"""Kamu adalah analis intelijen. Buat ringkasan eksekutif situasi keamanan (3-4 kalimat, bahasa Indonesia profesional).

DATA INSIDEN HARI INI ({today}):
{news_list}
Total: {len(neg_news)} insiden negatif

Ringkasan eksekutif:"""

    summary = await call_groq(prompt, max_tokens=400)

    neg_count = len(neg_news)
    alert_level = "kritis" if neg_count >= 10 else "waspada" if neg_count >= 5 else "aman"

    report = DailyReport(
        id=str(uuid.uuid4()),
        report_date=today,
        region="ALL",
        summary=summary,
        top_issues=[{"title": n.title, "region": n.region, "category": a.category}
                    for n, a in neg_news[:5]],
        alert_level=alert_level,
    )
    db.add(report)
    db.commit()
    return summary


async def chat_with_agent(message: str, db: Session) -> str:
    """AI Agent untuk menjawab pertanyaan situasi Jawa Timur."""
    from datetime import date
    from sqlalchemy import cast, Date

    today = date.today().isoformat()
    recent = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(cast(News.crawled_at, Date) == today).order_by(
        News.crawled_at.desc()
    ).limit(30).all()

    context = "\n".join([
        f"[{n.region}][{a.category}] {n.title}"
        for n, a in recent
    ])

    prompt = f"""Kamu adalah AI Agent analisis situasi intelijen wilayah Jawa Timur.
Jawab pertanyaan operator berdasarkan data intel terkini. Bahasa Indonesia, profesional dan lugas.

DATA INTEL ({today}):
{context or 'Belum ada data hari ini.'}

PERTANYAAN: {message}
JAWABAN:"""

    return await call_groq(prompt, max_tokens=600)
