from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.database import SessionLocal
from app.services.gnews_service import crawl_and_enqueue
from app.services.openai_service import analyze_single_news
from app.models import News
from app.config import get_settings
import logging
import asyncio

logger = logging.getLogger(__name__)
settings = get_settings()
scheduler = AsyncIOScheduler()

_job_running = False

async def analyzer_worker(queue: asyncio.Queue, db):
    """
    Worker yang terus membaca dari queue dan menganalisis berita satu per satu.
    Berhenti ketika menerima sinyal None dari crawler.
    """
    total_analyzed = 0
    while True:
        news_id = await queue.get()

        # Sinyal selesai dari crawler
        if news_id is None:
            logger.info(f"✅ Analyzer selesai: {total_analyzed} berita dianalisis")
            break

        # Ambil berita dari DB
        news = db.query(News).filter(News.id == news_id).first()
        if not news:
            continue

        logger.info(f"🤖 Menganalisis: '{news.title[:60]}'...")
        success = await analyze_single_news(db, news)

        if success:
            total_analyzed += 1
            logger.info(f"✅ [{total_analyzed}] Selesai → tampil di dashboard")

        # Jeda ringan antar analisis agar tidak spam API berlebihan (30 detik untuk Groq free tier)
        await asyncio.sleep(30)

async def job_crawl_and_analyze():
    """
    Jalankan crawler dan analyzer secara PARALEL menggunakan asyncio Queue.
    Crawler kirim berita → Queue → Analyzer langsung proses.
    """
    global _job_running
    if _job_running:
        logger.info("⏭ Job sebelumnya masih berjalan, skip.")
        return

    _job_running = True
    db = SessionLocal()

    try:
        queue = asyncio.Queue()
        logger.info("🚀 Memulai crawling + analisis paralel...")

        # Jalankan crawler dan analyzer secara bersamaan
        await asyncio.gather(
            crawl_and_enqueue(db, queue),  # Crawler: crawl & isi queue
            analyzer_worker(queue, db),    # Analyzer: langsung proses dari queue
        )

    except Exception as e:
        logger.error(f"❌ Error: {e}")
    finally:
        db.close()
        _job_running = False

async def job_daily_report():
    logger.info("📋 Membuat laporan harian...")
    db = SessionLocal()
    try:
        from app.services.openai_service import generate_daily_report
        await generate_daily_report(db)
        logger.info("✅ Laporan harian selesai")
    except Exception as e:
        logger.error(f"❌ Error laporan harian: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(
        job_crawl_and_analyze,
        trigger=IntervalTrigger(minutes=settings.crawl_interval_minutes),
        id="crawl_analyze",
        name="Crawl & Analyze Parallel",
        replace_existing=True,
    )
    scheduler.add_job(
        job_daily_report,
        trigger="cron",
        hour=6, minute=0,
        id="daily_report",
        name="Daily Report",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"🚀 Scheduler aktif — crawling tiap {settings.crawl_interval_minutes} menit")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
