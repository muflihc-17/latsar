import httpx
import json
import asyncio
import logging
from sqlalchemy.orm import Session
from app.models import News, NewsAnalysis
from app.config import get_settings
from app.services.scraper_service import scrape_article
import uuid

logger = logging.getLogger(__name__)
settings = get_settings()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Set untuk track berita yang sedang dianalisis (hindari double)
_analyzing_ids: set = set()

CATEGORIES = [
    "Keamanan & Kamtibmas",
    "Bencana Alam & Lingkungan",
    "Konflik Sosial",
    "Politik & Pemerintahan",
    "Ekonomi & Infrastruktur",
    "Kesehatan & Kemanusiaan",
    "Lainnya",
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
    "Lainnya",
]


async def call_groq(prompt: str, max_tokens: int = 1500, retries: int = 5) -> str:
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
                    # Delay rate limit: 30s, 60s, 120s
                    delays = [30, 60, 120]
                    wait = delays[attempt] if attempt < len(delays) else 120
                    logger.warning(f"Rate limit 429, tunggu {wait} detik... (attempt {attempt+1}/{retries})")
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


def _build_prompt_negatif(title: str, region: str, content: str) -> str:
    """Prompt profiling intelijen mendalam untuk berita NEGATIF (Butuh Full Content)."""
    return f"""Kamu adalah analis Intelijen Siber Kodam V/Brawijaya. Tugasmu melakukan profiling intelijen terhadap berita yang berpotensi mengancam keamanan dan ketertiban di wilayah Jawa Timur.

Baca artikel berikut secara menyeluruh:

JUDUL: {title}
WILAYAH: {region}
ISI ARTIKEL:
{content}

Lakukan profiling intelijen dan berikan respons HANYA dalam format JSON berikut (tanpa teks lain):
{{
  "sentiment": "negatif",
  "sentiment_score": angka 0.0 sampai 1.0 (0.0 = sangat positif, 1.0 = sangat negatif),
  "category": salah satu dari {CATEGORIES},
  "facts": [
    "Tulis fakta secara detail dan komprehensif, ambil langsung dari teks artikel, kalimat panjang dan tidak boleh singkat.",
    "Tulis penjabaran rinci terkait kronologi/kejadian penting yang ada di artikel.",
    "Gali informasi mendalam dari isi berita secara utuh dan jelas.",
    "(jika ada): Ekstraksi data angka/waktu/kutipan penting dengan format panjang."
  ],
  "threat_type": salah satu dari {THREAT_TYPES},
  "escalation_potential": "Analisis potensi eskalasi situasi dengan detail berdasarkan pov intelijen Kodam V/Brawijaya namun JANGAN menyebutkan subjek 'Kodam V/Brawijaya', max 5 kalimat",
  "recommended_action": "Tindakan mitigasi atau strategis konkret secara proaktif. Langsung sebutkan tindakannya (contoh: 'Tingkatkan patroli siber di wilayah X...'). JANGAN menyebutkan subjek 'Kodam V/Brawijaya harus', langsung tulis kata kerja dengan detail penjelasannya.",
  "entities": {{
    "locations": ["daftar lokasi spesifik yang disebut"],
    "persons": ["daftar nama tokoh/pejabat yang disebut"],
    "organizations": ["daftar instansi/organisasi yang disebut"]
  }},
  "keywords": ["kata", "kunci", "dominan", "maksimal 6"]
}}"""


def _build_fast_prompt(title: str, region: str, description: str) -> str:
    """Prompt profiling cepat menggunakan deskripsi RSS untuk semua berita."""
    return f"""Kamu adalah analis Intelijen Siber Kodam V/Brawijaya. Lakukan klasifikasi dan ekstraksi informasi pada berita di wilayah Jawa Timur berikut:

JUDUL: {title}
WILAYAH: {region}
DESKRIPSI: {description or '-'}

PANDUAN SENTIMEN (WAJIB DIPATUHI):
- "negatif": Berita yang mengandung unsur ancaman, kerugian, kegagalan, atau dampak buruk. TERMASUK:
  * Kegagalan/pengembalian produk/layanan pemerintah (misalnya: MBG, bansos, dll.)
  * Kualitas buruk: makanan basi/berbau, produk rusak, layanan mengecewakan
  * Keluhan/penolakan/pengembalian oleh masyarakat atau institusi
  * Skandal publik, korupsi, pungutan liar, kecurangan
  * Kriminalitas, kecelakaan, bencana, konflik sosial
  * Program pemerintah yang bermasalah, gagal, atau dikritik
  * Unjuk rasa, protes, penolakan kebijakan
  * Korban, kerugian, kerusakan, ketidakadilan
- "positif": Berita tentang prestasi, keberhasilan, penghargaan, pembangunan positif, kegiatan sosial yang berdampak baik.
- "netral": HANYA untuk berita yang benar-benar tidak memiliki dampak positif maupun negatif yang jelas, misalnya pengumuman jadwal, informasi umum tanpa dampak, atau laporan statistik rutin tanpa masalah.

CATATAN: Jika ragu antara "netral" dan "negatif", PILIH "negatif". Prioritaskan keamanan intelijen.

Berikan respons HANYA dalam format JSON berikut (tanpa teks lain):
{{
  "sentiment": "positif" atau "netral" atau "negatif",
  "sentiment_score": angka 0.0 sampai 1.0 (0.0=sangat positif, 1.0=sangat negatif),
  "category": salah satu dari {CATEGORIES},
  "facts": [
    "Tulis secara detail, tidak terlalu singkat, dan ambil informasi spesifik dari deskripsi",
    "Tulis poin-poin utama secara rinci yang terkandung pada deskripsi",
    "(jika ada): Tambahan informasi detail dari deskripsi"
  ],
  "threat_level": "(opsional, HANYA isi jika negatif) Angka 1-5 (1=Rendah, 5=Kritis)",
  "threat_type": "(opsional, HANYA isi jika negatif) salah satu dari {THREAT_TYPES}",
  "escalation_potential": "(opsional, HANYA isi jika negatif) Analisis potensi eskalasi, 1-2 kalimat",
  "recommended_action": "(opsional, HANYA isi jika negatif) Tindakan mitigasi konkret, 1-2 kalimat",
  "entities": {{
    "locations": ["lokasi"],
    "persons": ["tokoh"],
    "organizations": ["organisasi"]
  }},
  "keywords": ["kata", "kunci", "dominan", "maksimal 6"]
}}"""


async def analyze_single_news(db: Session, news: News) -> bool:
    """Analisis + profiling satu berita. Return True jika berhasil."""
    if news.id in _analyzing_ids:
        logger.info(f"⏭ Skip (sedang dianalisis): {news.title[:50]}")
        return False

    existing = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news.id).first()
    if existing:
        return True

    _analyzing_ids.add(news.id)
    try:
        # 1. Fast Pass API Call (Hanya dari deskripsi, sangat hemat token)
        logger.info(f"🤖 Menganalisis Awal: '{news.title[:50]}'...")
        fast_prompt = _build_fast_prompt(news.title, news.region, news.description or "")
        fast_result_text = await call_groq(fast_prompt, max_tokens=800)

        if not fast_result_text:
            logger.warning(f"Response awal kosong untuk: {news.title[:50]}")
            return False

        # Parse JSON Awal
        try:
            clean = fast_result_text.replace("```json", "").replace("```", "").strip()
            start = clean.find("{")
            end = clean.rfind("}") + 1
            if start >= 0 and end > start:
                clean = clean[start:end]
            result = json.loads(clean)
        except json.JSONDecodeError:
            logger.warning(f"Gagal parse JSON awal: {fast_result_text[:200]}")
            return False

        sentiment = result.get("sentiment", "netral")
        full_content = ""

        # 2. Jika Negatif, tidak perlu Full Profiling lagi (Scraping dinonaktifkan untuk menghemat limit)
        if sentiment == "negatif":
            logger.info(f"  ⚠️ Sentimen NEGATIF. Menggunakan deskripsi untuk ancaman...")

        # 3. Simpan ke DB
        analysis = NewsAnalysis(
            id=str(uuid.uuid4()),
            news_id=news.id,
            sentiment=sentiment,
            sentiment_score=float(result.get("sentiment_score", 0.5)),
            category=result.get("category", "Lainnya"),
            summary="",  # tidak dipakai lagi, ganti dengan facts
            full_content=full_content[:2000] if full_content else "",  # simpan sebagian
            facts=result.get("facts", []),
            keywords=result.get("keywords", []),
            entities=result.get("entities", {}),
            # Kolom khusus negatif
            threat_level=int(result.get("threat_level", 0)) if sentiment == "negatif" else None,
            threat_type=result.get("threat_type") if sentiment == "negatif" else None,
            escalation_potential=result.get("escalation_potential") if sentiment == "negatif" else None,
            recommended_action=result.get("recommended_action") if sentiment == "negatif" else None,
            profiling_complete=True,
        )
        db.add(analysis)
        db.commit()
        logger.info(f"✅ Profiling selesai: {news.title[:50]}... → {sentiment} (threat: {analysis.threat_level})")
        return True

    except Exception as e:
        logger.error(f"Error analisis {news.id}: {e}")
        db.rollback()
        return False
    finally:
        _analyzing_ids.discard(news.id)


async def analyze_news(db: Session) -> dict:
    """Analisis batch berita yang belum dianalisis (untuk manual trigger)."""
    analyzed_ids = {row[0] for row in db.query(NewsAnalysis.news_id).all()}
    unanalyzed = db.query(News).filter(~News.id.in_(analyzed_ids)).limit(20).all()

    if not unanalyzed:
        return {"analyzed": 0, "message": "Semua berita sudah dianalisis"}

    total = 0
    for news in unanalyzed:
        success = await analyze_single_news(db, news)
        if success:
            total += 1
        await asyncio.sleep(15)

    return {"analyzed": total, "total_pending": len(unanalyzed)}


async def generate_daily_report(db: Session) -> str:
    """Generate ringkasan eksekutif harian."""
    from datetime import date
    from app.models import DailyReport
    from sqlalchemy import cast, Date

    today = date.today().isoformat()

    news_today = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(cast(News.crawled_at, Date) == today).all()

    if not news_today:
        return "Tidak ada data berita hari ini."

    neg_news = [(n.title, n.region) for n, a in news_today if a.sentiment == "negatif"][:10]
    pos_news = [(n.title, n.region) for n, a in news_today if a.sentiment == "positif"][:5]

    prompt = f"""Kamu adalah analis intelijen Kodam V/Brawijaya.
Buat ringkasan eksekutif singkat (3-4 kalimat) dalam bahasa Indonesia yang profesional dari sudut pandang intelijen siber TNI.

BERITA NEGATIF: {chr(10).join([f'- [{r}] {t}' for t, r in neg_news]) or 'Tidak ada'}
BERITA POSITIF: {chr(10).join([f'- [{r}] {t}' for t, r in pos_news]) or 'Tidak ada'}
Total berita hari ini: {len(news_today)}

Ringkasan eksekutif intelijen:"""

    summary = await call_groq(prompt, max_tokens=600)

    alert_level = "kritis" if len(neg_news) >= 10 else "waspada" if len(neg_news) >= 5 else "aman"

    report = DailyReport(
        id=str(uuid.uuid4()),
        report_date=today,
        region="ALL",
        summary=summary,
        top_issues=[{"title": t, "region": r} for t, r in neg_news[:5]],
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
    ).filter(cast(News.crawled_at, Date) == today).order_by(News.crawled_at.desc()).limit(30).all()

    context = "\n".join([
        f"[{a.sentiment.upper()}][{n.region}][{a.category}] {n.title}"
        for n, a in recent
    ])

    prompt = f"""Kamu adalah AI Agent analisis situasi intelijen Kodam V/Brawijaya.
Jawab pertanyaan operator berdasarkan data berita intelijen terkini dalam bahasa Indonesia yang profesional dan lugas.

DATA INTEL ({today}):
{context or 'Belum ada data.'}

PERTANYAAN OPERATOR: {message}
JAWABAN INTEL:"""

    return await call_groq(prompt, max_tokens=800)
