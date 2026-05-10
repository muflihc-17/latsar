from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, cast, Date, func
from app.database import get_db
from app.models import News, NewsAnalysis
from datetime import date, timedelta
from typing import Optional

router = APIRouter(prefix="/api/news", tags=["News"])


def period_filter(query, period: str = "day", model=News):
    """Filter berita berdasarkan periode."""
    today = date.today()
    if period == "week":
        start = today - timedelta(days=7)
        return query.filter(cast(model.crawled_at, Date) >= start)
    elif period == "month":
        start = today - timedelta(days=30)
        return query.filter(cast(model.crawled_at, Date) >= start)
    else:  # default: hari ini
        return query.filter(cast(model.crawled_at, Date) == today)


@router.get("/")
def get_news(
    db: Session = Depends(get_db),
    region: Optional[str] = None,
    sentiment: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=20, le=200),
    skip: int = 0,
    period: str = "day",
):
    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    )
    query = period_filter(query, period)

    if region:
        query = query.filter(News.region.ilike(f"%{region}%"))
    if sentiment:
        query = query.filter(NewsAnalysis.sentiment == sentiment)
    if category:
        query = query.filter(NewsAnalysis.category == category)

    results = query.order_by(desc(News.crawled_at)).offset(skip).limit(limit).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "description": n.description,
            "url": n.url,
            "source": n.source,
            "region": n.region,
            "keyword": n.keyword,
            "published_at": n.published_at,
            "crawled_at": n.crawled_at,
            "sentiment": a.sentiment,
            "sentiment_score": a.sentiment_score,
            "category": a.category,
            "profiling_complete": a.profiling_complete,
        }
        for n, a in results
    ]


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), period: str = "day"):
    results = db.query(NewsAnalysis.sentiment).join(
        News, News.id == NewsAnalysis.news_id
    )
    results = period_filter(results, period, model=News).all()

    pos   = sum(1 for (s,) in results if s == "positif")
    neu   = sum(1 for (s,) in results if s == "netral")
    neg   = sum(1 for (s,) in results if s == "negatif")
    total = pos + neu + neg

    today = date.today()
    total_crawled = db.query(News).filter(cast(News.crawled_at, Date) == today).count()

    return {
        "total": total,
        "total_crawled": total_crawled,
        "positive": pos,
        "neutral": neu,
        "negative": neg,
        "date": today.isoformat(),
        "pending_analysis": max(0, total_crawled - total),
    }


@router.get("/by-region")
def get_by_region(db: Session = Depends(get_db), period: str = "day"):
    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    )
    query = period_filter(query, period)
    results = query.all()

    region_data: dict = {}
    for n, a in results:
        r = n.region or "Lainnya"
        if r not in region_data:
            region_data[r] = {"region": r, "total": 0, "positif": 0, "netral": 0, "negatif": 0}
        region_data[r]["total"] += 1
        region_data[r][a.sentiment] = region_data[r].get(a.sentiment, 0) + 1

    for r in region_data.values():
        neg = r["negatif"]
        r["level"] = "kritis" if neg >= 10 else "waspada" if neg >= 5 else "aman"

    return list(region_data.values())


@router.get("/trend")
def get_trend(db: Session = Depends(get_db), period: str = "day"):
    today = date.today()

    results = db.query(
        func.date_part("hour", News.crawled_at).label("hour"),
        NewsAnalysis.sentiment,
        func.count().label("count"),
    ).join(NewsAnalysis, News.id == NewsAnalysis.news_id).filter(
        cast(News.crawled_at, Date) == today
    ).group_by("hour", NewsAnalysis.sentiment).all()

    trend: dict = {}
    for hour, sentiment, count in results:
        h = int(hour)
        if h not in trend:
            trend[h] = {"hour": f"{h:02d}:00", "positif": 0, "netral": 0, "negatif": 0}
        trend[h][sentiment] = count

    return sorted(trend.values(), key=lambda x: x["hour"])


@router.post("/fix-urls")
async def fix_google_urls(db: Session = Depends(get_db)):
    """Batch decode semua Google News redirect URL ke URL artikel asli di database."""
    from app.services.gnews_service import _resolve_google_url
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    executor = ThreadPoolExecutor(max_workers=3)
    loop = asyncio.get_event_loop()

    # Ambil semua berita dengan URL Google
    google_news = db.query(News).filter(News.url.like("%news.google%")).all()
    if not google_news:
        return {"fixed": 0, "message": "Tidak ada URL Google News di database"}

    fixed = 0
    failed = 0
    for news in google_news:
        try:
            real_url = await loop.run_in_executor(executor, _resolve_google_url, news.url)
            if real_url != news.url and "news.google" not in real_url:
                news.url = real_url
                db.commit()
                fixed += 1
            await asyncio.sleep(0.5)  # throttle agar tidak diblok
        except Exception:
            failed += 1

    return {"fixed": fixed, "failed": failed, "total_processed": len(google_news)}


# ⚠️ Route dengan path parameter HARUS diletakkan PALING BAWAH
# agar tidak "menangkap" route statis seperti /stats, /by-region, /trend

@router.patch("/{news_id}/sentiment")
def override_sentiment(news_id: str, payload: dict, db: Session = Depends(get_db)):
    """Override manual sentimen berita (tanpa re-analisis AI)."""
    new_sentiment = payload.get("sentiment")
    if new_sentiment not in ("positif", "netral", "negatif"):
        raise HTTPException(status_code=400, detail="Sentimen tidak valid. Gunakan: positif, netral, atau negatif")

    analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analisis belum tersedia")

    analysis.sentiment = new_sentiment
    # Update score sesuai sentimen override
    if new_sentiment == "negatif":
        analysis.sentiment_score = max(analysis.sentiment_score or 0.5, 0.7)
    elif new_sentiment == "positif":
        analysis.sentiment_score = min(analysis.sentiment_score or 0.5, 0.3)
    else:
        analysis.sentiment_score = 0.5

    db.commit()
    return {"success": True, "news_id": news_id, "sentiment": new_sentiment}


@router.post("/{news_id}/reanalyze")
async def reanalyze_news(news_id: str, db: Session = Depends(get_db)):
    """Hapus analisis lama dan jalankan ulang analisis AI untuk berita ini."""
    from app.services.openai_service import analyze_single_news

    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")

    # Hapus analisis lama agar bisa diproses ulang
    old_analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if old_analysis:
        db.delete(old_analysis)
        db.commit()

    success = await analyze_single_news(db, news)
    if not success:
        raise HTTPException(status_code=500, detail="Re-analisis gagal. Coba lagi nanti.")

    new_analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    return {
        "success": True,
        "news_id": news_id,
        "sentiment": new_analysis.sentiment if new_analysis else None,
        "sentiment_score": new_analysis.sentiment_score if new_analysis else None,
    }


@router.get("/{news_id}/profiling")
def get_profiling(news_id: str, db: Session = Depends(get_db)):
    """Endpoint profiling intelijen detail per berita."""
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")

    analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analisis belum tersedia")

    return {
        # Info berita
        "id": news.id,
        "title": news.title,
        "url": news.url,
        "source": news.source,
        "region": news.region,
        "published_at": news.published_at,
        "crawled_at": news.crawled_at,
        # Analisis dasar
        "sentiment": analysis.sentiment,
        "sentiment_score": analysis.sentiment_score,
        "category": analysis.category,
        # Profiling
        "facts": analysis.facts or [],
        "keywords": analysis.keywords or [],
        "entities": analysis.entities or {"locations": [], "persons": [], "organizations": []},
        # Ancaman (hanya negatif)
        "threat_level": analysis.threat_level,
        "threat_type": analysis.threat_type,
        "escalation_potential": analysis.escalation_potential,
        "recommended_action": analysis.recommended_action,
        # Meta
        "profiling_complete": analysis.profiling_complete,
        "analyzed_at": analysis.analyzed_at,
    }