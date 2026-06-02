from gnews import GNews
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import News, CrawlLog
import uuid
import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=2)

TOPIC_KEYWORDS = [
    # MBG
    "MBG", "makan bergizi gratis", "keracunan mbg", "sppg",
    # KDMP (Koperasi Desa Merah Putih)
    "KDMP", "koperasi desa merah putih", "kopdes",
    # Jembatan Garuda
    "jembatan garuda", "garuda bridge", "proyek jembatan garuda", "pembangunan jembatan garuda",
    # TNI
    "TNI", "oknum TNI", "prajurit tni", "tentara", "batalyon", "militer", "komandan", "TNI viral", "keluarga TNI", "persit", "kodam v/brawijaya", "kodam brawijaya",
    # Politik & Korupsi
    "korupsi", "pilkada", "politik", "suap",
    # Demo & Konsolidasi
    "demo", "unjuk rasa", "aksi damai", "konsolidasi", "protes",
    # Bencana Alam
    "bencana", "banjir", "longsor", "gempa", "kebakaran", "puting beliung",
    # Narkoba
    "narkoba", "sabu", "narkotika", "pengedar",
]

REGIONS = [
    "Surabaya", "Malang", "Jember", "Sidoarjo", "Gresik",
    "Kediri", "Mojokerto", "Pasuruan", "Banyuwangi", "Lumajang",
    "Probolinggo", "Madiun", "Blitar", "Sampang", "Pamekasan",
    "Sumenep", "Bangkalan", "Bojonegoro", "Tuban", "Lamongan",
    "Jombang", "Nganjuk", "Trenggalek", "Tulungagung", "Ponorogo",
    "Magetan", "Ngawi", "Pacitan", "Situbondo", "Bondowoso",
]


def detect_region(text: str) -> str:
    for region in REGIONS:
        if region.lower() in text.lower():
            return region
    return "Jawa Timur"


def _fetch_news_sync(query: str) -> list:
    """Fetch berita hari ini menggunakan gnews."""
    gn = GNews(
        language="id",
        country="ID",
        max_results=5,
        period="1d",
    )
    try:
        return gn.get_news(query) or []
    except Exception as e:
        logger.warning(f"Error fetch '{query}': {e}")
        return []


def _decode_google_url(google_url: str) -> str:
    """
    Decode Google News redirect URL ke URL artikel asli.
    Menggunakan googlenewsdecoder dengan jeda agar tidak kena rate limit 429.
    """
    if not google_url or "news.google" not in google_url:
        return google_url

    max_retries = 3
    for attempt in range(max_retries):
        try:
            from googlenewsdecoder import new_decoderv1
            # Jeda progresif: 3s, 6s, 9s
            wait = 3 * (attempt + 1)
            if attempt > 0:
                logger.info(f"      Retry decode {attempt+1}/{max_retries}, tunggu {wait}s...")
                time.sleep(wait)

            result = new_decoderv1(google_url)

            if result and result.get("status") and result.get("decoded_url"):
                decoded = result["decoded_url"]
                if decoded.startswith("http") and "news.google" not in decoded:
                    logger.info(f"      ✓ URL decoded: {decoded[:65]}")
                    return decoded
            elif result and not result.get("status"):
                msg = result.get("message", "")
                if "429" in str(msg):
                    # Rate limit — tunggu lebih lama
                    logger.warning(f"      Rate limit 429, tunggu {wait * 2}s...")
                    time.sleep(wait * 2)
                    continue

        except Exception as e:
            logger.warning(f"      Decode error: {e}")
            time.sleep(3)

    logger.warning(f"      ✗ Gagal decode URL setelah {max_retries} percobaan")
    return google_url  # kembalikan URL asli jika gagal


def _is_today(pub_date_str: str) -> bool:
    """Cek apakah tanggal publikasi adalah hari ini."""
    if not pub_date_str:
        return True
    try:
        pub_date = datetime.strptime(pub_date_str, "%a, %d %b %Y %H:%M:%S %Z")
        return pub_date.date() == datetime.now().date()
    except Exception:
        return True


async def crawl_and_enqueue(db: Session, queue: asyncio.Queue) -> dict:
    total_found = 0
    total_new = 0
    status = "success"
    error_msg = None
    loop = asyncio.get_event_loop()
    today = datetime.now().date()

    try:
        TOPIC_GROUPS = [
            # MBG
            '("MBG" OR "makan bergizi gratis" OR "keracunan mbg" OR "SPPG")',
            # KDMP (Koperasi Desa Merah Putih)
            '("KDMP" OR "koperasi desa merah putih" OR "kopdes")',
            # Jembatan Garuda
            '("jembatan garuda" OR garuda bridge OR proyek jembatan garuda OR pembangunan jembatan garuda)',
            # TNI
            '(TNI OR tentara OR prajurit OR batalyon OR militer OR komandan OR oknum TNI OR TNI viral OR keluarga TNI OR persit OR kodam v/brawijaya)',
            # Politik & Korupsi
            '(korupsi OR pilkada OR politik OR suap)',
            # Demo & Konsolidasi
            '(demo OR unjuk rasa OR aksi damai OR konsolidasi OR protes)',
            # Bencana Alam
            '(bencana OR banjir OR longsor OR gempa OR kebakaran OR puting beliung)',
            # Narkoba
            '(narkoba OR sabu OR narkotika OR pengedar)',
        ]

        for region_name in REGIONS:
                
            for topic_group in TOPIC_GROUPS:
                query = f"{topic_group} {region_name}"
                logger.info(f"📍 Crawling: '{query}'")
                articles = await loop.run_in_executor(_executor, _fetch_news_sync, query)

                # Jeda antar topik — cukup 3 detik untuk hindari rate limit
                await asyncio.sleep(3)

                if not articles:
                    continue

                for article in articles:
                    total_found += 1

                    google_url = article.get("url", "")
                    if not google_url:
                        continue

                    # Filter hari ini
                    pub_date_str = article.get("published date", "")
                    if not _is_today(pub_date_str):
                        logger.info(f"  ⏭ Skip (bukan hari ini): {article.get('title','')[:50]}")
                        continue

                    title = article.get("title", "")
                    description = article.get("description", "")
                    combined_text = f"{title} {description}".lower()

                    # Filter relevansi wilayah Jatim (karena kita sudah menargetkan kota/kab, 
                    # kita bisa lebih toleran, tapi tetap pastikan relevan dengan Jatim)
                    is_relevant = (
                        any(r.lower() in combined_text for r in REGIONS) or
                        "jawa timur" in combined_text or
                        "jatim" in combined_text
                    )
                    if not is_relevant:
                        continue

                    detected_region = detect_region(combined_text)

                    published_at = None
                    if pub_date_str:
                        try:
                            published_at = datetime.strptime(pub_date_str, "%a, %d %b %Y %H:%M:%S %Z")
                        except Exception:
                            published_at = datetime.now()

                    # Cek apakah URL ini sudah pernah dicrawl hari ini agar tidak dobel decode yang mahal
                    existing_news = db.query(News).filter(News.title == title).first()
                    if existing_news:
                        logger.info(f"  ⏭ Skip (sudah ada di DB): {title[:50]}")
                        continue

                    # ─── Decode URL Google → URL artikel asli ───
                    # Jeda 3 detik sebelum setiap decode untuk menghindari rate limit
                    logger.info(f"  🔗 Resolving URL: {title[:50]}")
                    await asyncio.sleep(3)
                    real_url = await loop.run_in_executor(
                        _executor, _decode_google_url, google_url
                    )

                    news = News(
                        id=str(uuid.uuid4()),
                        title=title,
                        description=description,
                        url=real_url,  # URL artikel asli (atau Google URL jika decode gagal)
                        source=article.get("publisher", {}).get("title", ""),
                        region=detected_region,
                        published_at=published_at,
                        keyword="Per Kota/Kab",
                    )
                    db.add(news)
                    db.commit()
                    total_new += 1

                    await queue.put(news.id)
                    logger.info(f"  📥 Queue({queue.qsize()}): '{title[:50]}'")

        logger.info(f"🎉 Crawl selesai: {total_new} berita baru ({today})")

    except Exception as e:
        status = "error"
        error_msg = str(e)
        db.rollback()
        logger.error(f"❌ Crawl error: {e}")

    await queue.put(None)

    # Hitung total berita negatif yang tersimpan dari sesi ini
    from app.models import NewsAnalysis
    total_neg = db.query(NewsAnalysis).filter(NewsAnalysis.sentiment == "negatif").count()

    log = CrawlLog(
        total_found=total_found,
        total_new=total_new,
        total_neg=total_neg,
        status=status,
        error_msg=error_msg,
    )
    db.add(log)
    db.commit()

    return {"total_found": total_found, "total_new": total_new, "status": status}