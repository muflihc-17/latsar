from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import cast, Date, desc
from app.database import get_db
from app.models import Watchlist, News, NewsAnalysis
from datetime import date, timedelta, datetime, timezone
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/watchlist", tags=["Watchlist"])


class WatchlistCreate(BaseModel):
    term: str
    term_type: Optional[str] = "keyword"  # "person" | "organization" | "keyword" | "location"


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/watchlist/  — Daftar semua term watchlist
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
def get_watchlist(db: Session = Depends(get_db)):
    items = db.query(Watchlist).order_by(desc(Watchlist.hit_count)).all()
    return [
        {
            "id": w.id,
            "term": w.term,
            "term_type": w.term_type,
            "hit_count": w.hit_count,
            "last_hit_at": w.last_hit_at,
            "created_at": w.created_at,
        }
        for w in items
    ]


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/watchlist/  — Tambah term baru
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/")
def add_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db)):
    term = payload.term.strip()
    if not term:
        raise HTTPException(status_code=400, detail="Term tidak boleh kosong")

    existing = db.query(Watchlist).filter(
        Watchlist.term.ilike(term)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Term '{term}' sudah ada di watchlist")

    import uuid
    item = Watchlist(
        id=str(uuid.uuid4()),
        term=term,
        term_type=payload.term_type or "keyword",
        hit_count=0,
    )
    db.add(item)
    db.commit()

    return {"success": True, "id": item.id, "term": item.term}


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /api/watchlist/{watchlist_id}  — Hapus term
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{watchlist_id}")
def delete_watchlist(watchlist_id: str, db: Session = Depends(get_db)):
    item = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Term tidak ditemukan")

    db.delete(item)
    db.commit()
    return {"success": True, "deleted": item.term}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/watchlist/hits  — Cek kemunculan semua term di berita negatif
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hits")
def get_watchlist_hits(db: Session = Depends(get_db), period: str = "day"):
    """
    Cek setiap term watchlist di berita negatif (title + description).
    Update hit_count dan last_hit_at di DB.
    Return: setiap term + berita yang match.
    """
    watchlist = db.query(Watchlist).all()
    if not watchlist:
        return []

    today = date.today()
    if period == "week":
        start = today - timedelta(days=7)
    elif period == "month":
        start = today - timedelta(days=30)
    else:
        start = today

    # Ambil semua berita negatif dalam periode
    news_query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(
        NewsAnalysis.sentiment == "negatif",
        cast(News.crawled_at, Date) >= start,
    ).all()

    results = []
    for w in watchlist:
        term_lower = w.term.lower()
        matches = []

        for n, a in news_query:
            text = f"{n.title} {n.description or ''}".lower()
            # Juga cari di entities jika sudah di-profile
            entity_text = ""
            if a.entities:
                entity_text = " ".join([
                    " ".join(a.entities.get("persons", [])),
                    " ".join(a.entities.get("organizations", [])),
                    " ".join(a.entities.get("locations", [])),
                ]).lower()

            if term_lower in text or term_lower in entity_text:
                matches.append({
                    "news_id": n.id,
                    "title": n.title,
                    "region": n.region,
                    "category": a.category,
                    "crawled_at": n.crawled_at,
                })

        # Update hit count di DB
        if matches:
            w.hit_count = len(matches)
            w.last_hit_at = datetime.now(timezone.utc)
            db.commit()

        results.append({
            "id": w.id,
            "term": w.term,
            "term_type": w.term_type,
            "hit_count": len(matches),
            "last_hit_at": w.last_hit_at,
            "recent_hits": matches[:5],  # max 5 berita terbaru
            "has_new": len(matches) > 0,
        })

    return sorted(results, key=lambda x: x["hit_count"], reverse=True)
