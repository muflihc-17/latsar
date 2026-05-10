from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.services.openai_service import chat_with_agent, generate_daily_report, analyze_news
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
def get_latest_report(db: Session = Depends(get_db)):
    report = db.query(DailyReport).order_by(desc(DailyReport.created_at)).first()
    if not report:
        return {"message": "Belum ada laporan"}
    return {
        "report_date": report.report_date,
        "summary": report.summary,
        "top_issues": report.top_issues,
        "alert_level": report.alert_level,
        "created_at": report.created_at,
    }

@router.post("/crawl/manual")
async def manual_crawl(background_tasks: BackgroundTasks):
    """Trigger crawling + analisis paralel secara manual."""
    from app.services.scheduler import job_crawl_and_analyze
    background_tasks.add_task(job_crawl_and_analyze)
    return {"message": "Crawling & analisis paralel dimulai di background"}

@router.post("/analyze/manual")
async def manual_analyze(db: Session = Depends(get_db)):
    result = await analyze_news(db)
    return result

@router.post("/analyze/all")
async def analyze_all(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    analyzed_ids = {row[0] for row in db.query(NewsAnalysis.news_id).all()}
    total_pending = db.query(News).filter(~News.id.in_(analyzed_ids)).count()
    if total_pending == 0:
        return {"message": "Semua berita sudah dianalisis", "pending": 0}
    background_tasks.add_task(run_analyze_all)
    return {"message": f"Proses analisis {total_pending} berita dimulai", "pending": total_pending}

async def run_analyze_all():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        total = 0
        while True:
            result = await analyze_news(db)
            analyzed = result.get("analyzed", 0)
            total += analyzed
            if analyzed == 0:
                break
        logger.info(f"✅ Analyze all selesai: {total} berita")
    except Exception as e:
        logger.error(f"Error analyze all: {e}")
    finally:
        db.close()

@router.get("/analyze/status")
def analyze_status(db: Session = Depends(get_db)):
    total_news     = db.query(News).count()
    total_analyzed = db.query(NewsAnalysis).count()
    pending        = total_news - total_analyzed
    return {
        "total_news": total_news,
        "total_analyzed": total_analyzed,
        "pending": pending,
        "percent": round((total_analyzed / total_news * 100) if total_news > 0 else 0, 1),
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
            "status": l.status,
            "error_msg": l.error_msg,
        }
        for l in logs
    ]
