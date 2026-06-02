from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.services.openai_service import chat_with_agent, generate_daily_report, classify_pending_news
from app.models import DailyReport, CrawlLog, News, NewsAnalysis
from sqlalchemy import desc
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Agent & Reports"])

class ChatRequest(BaseModel):
    message: str

@router.post("/agent/chat")
async def agent_chat(req: ChatRequest, db: Session = Depends(get_db)):
    reply = await chat_with_agent(req.message, db)
    return {"reply": reply}

@router.get("/report/latest")
def get_latest_report(db: Session = Depends(get_db), period: str = "day"):
    from app.routers.news import period_filter
    from datetime import date

    report = db.query(DailyReport).order_by(desc(DailyReport.created_at)).first()

    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    query = period_filter(query, period)
    news_items = query.all()

    neg_news = [{"title": n.title, "region": n.region} for n, a in news_items]
    dynamic_alert_level = "kritis" if len(neg_news) >= 10 else "waspada" if len(neg_news) >= 5 else "aman"

    if not report:
        return {
            "summary": "Belum ada ringkasan AI tersedia.",
            "top_issues": neg_news[:5],
            "alert_level": dynamic_alert_level,
            "period": period,
        }

    return {
        "report_date": report.report_date,
        "summary": report.summary,
        "top_issues": neg_news[:5] if period != "day" else report.top_issues,
        "alert_level": dynamic_alert_level,
        "created_at": report.created_at,
        "period": period,
    }

@router.post("/crawl/manual")
async def manual_crawl(background_tasks: BackgroundTasks):
    """Trigger crawling + fast classify secara manual."""
    from app.services.scheduler import run_crawl_only, is_crawl_running
    if is_crawl_running():
        return {"message": "⏭ Crawl sedang berjalan, harap tunggu selesai.", "status": "busy"}
    background_tasks.add_task(run_crawl_only)
    return {"message": "✅ Crawling dimulai di background", "status": "started"}

@router.post("/analyze/all")
async def analyze_all(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Klasifikasi batch berita yang belum dianalisis (fast classify)."""
    analyzed_ids = {row[0] for row in db.query(NewsAnalysis.news_id).all()}
    total_pending = db.query(News).filter(~News.id.in_(analyzed_ids)).count()
    if total_pending == 0:
        return {"message": "Semua berita sudah dianalisis", "pending": 0}
    background_tasks.add_task(_run_classify_all)
    return {"message": f"Fast classify {total_pending} berita dimulai", "pending": total_pending}

async def _run_classify_all():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        result = await classify_pending_news(db)
        logger.info(f"✅ Classify all selesai: {result}")
    except Exception as e:
        logger.error(f"Error classify all: {e}")
    finally:
        db.close()

@router.get("/analyze/status")
def analyze_status(db: Session = Depends(get_db)):
    total_news     = db.query(News).count()
    total_analyzed = db.query(NewsAnalysis).count()
    pending_profiling = db.query(NewsAnalysis).filter(NewsAnalysis.profiling_status == "pending").count()
    complete_profiling = db.query(NewsAnalysis).filter(NewsAnalysis.profiling_status == "complete").count()
    return {
        "total_news_crawled": total_news,
        "total_negative_saved": total_analyzed,
        "pending_deep_profile": pending_profiling,
        "complete_deep_profile": complete_profiling,
    }

@router.post("/report/generate")
async def manual_report(db: Session = Depends(get_db)):
    summary = await generate_daily_report(db)
    return {"summary": summary}

@router.get("/crawl/logs")
def get_crawl_logs(db: Session = Depends(get_db), limit: int = 20):
    logs = db.query(CrawlLog).order_by(desc(CrawlLog.crawled_at)).limit(limit).all()
    return [
        {
            "crawled_at": l.crawled_at,
            "total_found": l.total_found,
            "total_new": l.total_new,
            "total_neg": l.total_neg,
            "status": l.status,
            "error_msg": l.error_msg,
        }
        for l in logs
    ]
