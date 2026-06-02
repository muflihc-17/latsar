from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.database import SessionLocal
from app.services.gnews_service import crawl_and_enqueue
from app.services.openai_service import fast_classify
from app.models import News
from app.config import get_settings
import logging
import asyncio

logger = logging.getLogger(__name__)
settings = get_settings()
scheduler = AsyncIOScheduler()

_crawl_running = False     # True hanya saat crawl sedang berjalan
_classify_running = False  # True hanya saat classifier sedang berjalan


async def classifier_worker(queue: asyncio.Queue):
    """
    Worker yang membaca dari queue dan menjalankan fast_classify.
    Hanya menyimpan berita NEGATIF ke DB.
    Berhenti saat menerima sinyal None dari crawler.
    """
    global _classify_running
    _classify_running = True
    db = SessionLocal()
    try:
        total_classified = 0
        total_saved = 0

        while True:
            news_id = await queue.get()

            if news_id is None:
                logger.info(f"✅ Classifier selesai: {total_classified} diklasifikasi, {total_saved} disimpan (negatif)")
                break

            news = db.query(News).filter(News.id == news_id).first()
            if not news:
                continue

            success = await fast_classify(db, news)
            if success:
                total_classified += 1
                # Cek apakah berita tersimpan sebagai negatif
                from app.models import NewsAnalysis
                if db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first():
                    total_saved += 1

            # Pastikan transaksi ditutup sebelum tidur panjang agar tidak mengunci database (pool exhaustion/deadlock)
            db.commit()

            # Jeda agar tidak terkena rate limit Groq (1 menit per berita)
            await asyncio.sleep(60)
    except Exception as e:
        logger.error(f"Error di classifier_worker: {e}")
    finally:
        db.close()
        _classify_running = False


async def job_crawl_and_classify():
    """
    Pipeline: Crawling → Fast Classify → Simpan hanya negatif.
    Deep profiling hanya dilakukan on-demand oleh operator.
    """
    global _crawl_running
    if _crawl_running:
        logger.info("⏭ Job crawl sebelumnya masih berjalan, skip.")
        return

    _crawl_running = True
    db = SessionLocal()

    try:
        queue = asyncio.Queue()
        logger.info("🚀 Memulai crawling + fast classify...")

        # Jalankan classifier sebagai background task (tidak ditunggu)
        # _classify_running akan dikelola oleh classifier_worker sendiri
        asyncio.create_task(classifier_worker(queue))

        # Tunggu hanya proses crawling
        await crawl_and_enqueue(db, queue)

    except Exception as e:
        logger.error(f"❌ Error pipeline: {e}")
    finally:
        db.close()
        _crawl_running = False


async def run_crawl_only():
    """
    Crawl manual: hanya jalankan crawling, classifier jalan terpisah.
    Tidak diblokir meski classifier dari sesi sebelumnya masih berjalan.
    """
    global _crawl_running
    if _crawl_running:
        logger.info("⏭ Crawl sedang berjalan, skip crawl manual.")
        return

    _crawl_running = True
    db = SessionLocal()

    try:
        queue = asyncio.Queue()
        logger.info("🔄 Crawl manual dimulai...")
        # Sama seperti jadwal otomatis, classifier dilepas ke background
        asyncio.create_task(classifier_worker(queue))
        await crawl_and_enqueue(db, queue)
    except Exception as e:
        logger.error(f"❌ Error crawl manual: {e}")
    finally:
        db.close()
        _crawl_running = False


def is_crawl_running() -> bool:
    return _crawl_running


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
        job_crawl_and_classify,
        trigger=IntervalTrigger(minutes=settings.crawl_interval_minutes),
        id="crawl_classify",
        name="Crawl & Fast Classify",
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
