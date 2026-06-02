from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc, cast, Date, func, Integer as SAInteger
from app.database import get_db
from app.models import News, NewsAnalysis
from datetime import date, timedelta, datetime
from typing import Optional
from collections import Counter

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
    else:
        return query.filter(cast(model.crawled_at, Date) == today)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/  — News feed (hanya negatif)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
def get_news(
    db: Session = Depends(get_db),
    region: Optional[str] = None,
    category: Optional[str] = None,
    profiling_status: Optional[str] = None,
    limit: int = Query(default=20, le=200),
    skip: int = 0,
    period: str = "day",
):
    """Ambil berita negatif. Selalu filter sentiment=negatif."""
    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    query = period_filter(query, period)

    if region:
        query = query.filter(News.region.ilike(f"%{region}%"))
    if category:
        query = query.filter(NewsAnalysis.category == category)
    if profiling_status:
        query = query.filter(NewsAnalysis.profiling_status == profiling_status)

    results = query.order_by(desc(News.crawled_at)).offset(skip).limit(limit).all()

    PRIORITY_CATEGORIES = {"TNI", "Narkoba", "Politik & Korupsi"}

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
            "profiling_status": a.profiling_status,
            "threat_level": a.threat_level,
            "threat_type": a.threat_type,
            "is_priority": (
                (a.category in PRIORITY_CATEGORIES and (a.sentiment_score or 0) >= 0.75)
                or (a.threat_level is not None and a.threat_level >= 4)
            ),
        }
        for n, a in results
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/stats  — KPI Cards
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), period: str = "day"):
    """KPI stats: total insiden, wilayah terparah, kategori dominan, pending profiling."""
    base = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    base = period_filter(base, period)
    results = base.all()

    total = len(results)
    pending = sum(1 for _, a in results if a.profiling_status == "pending")
    complete = sum(1 for _, a in results if a.profiling_status == "complete")

    # Wilayah terparah
    region_counts = Counter(n.region for n, _ in results if n.region)
    top_region = region_counts.most_common(1)[0] if region_counts else ("—", 0)

    # Kategori dominan
    cat_counts = Counter(a.category for _, a in results if a.category)
    top_category = cat_counts.most_common(1)[0] if cat_counts else ("—", 0)

    # Threat level rata-rata (hanya berita yang sudah di-profile)
    levels = [a.threat_level for _, a in results if a.threat_level is not None]
    avg_threat = round(sum(levels) / len(levels), 1) if levels else 0

    # Total crawled (termasuk yang belum dianalisis)
    total_crawled = period_filter(db.query(News), period).count()

    # Eskalasi vs kemarin (hanya berlaku untuk period=day)
    escalation_pct = 0
    escalation_dir = "neutral"
    if period == "day":
        yesterday = date.today() - timedelta(days=1)
        yesterday_count = db.query(News, NewsAnalysis).join(
            NewsAnalysis, News.id == NewsAnalysis.news_id
        ).filter(
            NewsAnalysis.sentiment == "negatif",
            cast(News.crawled_at, Date) == yesterday
        ).count()

        if yesterday_count > 0:
            diff = total - yesterday_count
            escalation_pct = round((diff / yesterday_count) * 100)
            escalation_dir = "up" if diff > 0 else ("down" if diff < 0 else "neutral")
        elif total > 0:
            escalation_pct = 100
            escalation_dir = "up"

    return {
        "total_incidents": total,
        "total_crawled": total_crawled,
        "pending_profiling": pending,
        "complete_profiling": complete,
        "top_region": {"name": top_region[0], "count": top_region[1]},
        "top_category": {"name": top_category[0], "count": top_category[1]},
        "avg_threat_level": avg_threat,
        "escalation_pct": escalation_pct,
        "escalation_dir": escalation_dir,
        "date": date.today().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/by-region  — Sebaran wilayah (hanya negatif)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/by-region")
def get_by_region(db: Session = Depends(get_db), period: str = "day"):
    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    query = period_filter(query, period)
    results = query.all()

    region_data: dict = {}
    for n, a in results:
        r = n.region or "Lainnya"
        if r not in region_data:
            region_data[r] = {"region": r, "total": 0, "categories": {}}
        region_data[r]["total"] += 1
        cat = a.category or "Lainnya"
        region_data[r]["categories"][cat] = region_data[r]["categories"].get(cat, 0) + 1

    for r in region_data.values():
        neg = r["total"]
        r["level"] = "kritis" if neg >= 10 else "waspada" if neg >= 5 else "aman"
        r["top_category"] = max(r["categories"], key=r["categories"].get) if r["categories"] else "—"

    return sorted(region_data.values(), key=lambda x: x["total"], reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/trend  — Tren insiden per jam/hari
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/trend")
def get_trend(db: Session = Depends(get_db), period: str = "day"):
    today = date.today()

    if period == "day":
        # Per jam, hari ini
        results = db.query(
            func.date_part("hour", News.crawled_at).label("hour"),
            func.count().label("count"),
        ).join(NewsAnalysis, News.id == NewsAnalysis.news_id).filter(
            NewsAnalysis.sentiment == "negatif",
            cast(News.crawled_at, Date) == today
        ).group_by("hour").all()

        trend: dict = {}
        for hour, count in results:
            h = int(hour)
            trend[h] = {"label": f"{h:02d}:00", "negatif": count}

        return sorted(trend.values(), key=lambda x: x["label"])

    else:
        # Per hari, untuk week/month
        days = 7 if period == "week" else 30
        start = today - timedelta(days=days)

        results = db.query(
            cast(News.crawled_at, Date).label("day"),
            func.count().label("count"),
        ).join(NewsAnalysis, News.id == NewsAnalysis.news_id).filter(
            NewsAnalysis.sentiment == "negatif",
            cast(News.crawled_at, Date) >= start
        ).group_by("day").all()

        trend_map = {str(row.day): row.count for row in results}
        output = []
        for i in range(days + 1):
            d = start + timedelta(days=i)
            ds = str(d)
            output.append({
                "label": d.strftime("%d/%m"),
                "negatif": trend_map.get(ds, 0),
                "date": ds,
            })
        return output


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/keywords  — Aggregasi keyword untuk Word Cloud
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/keywords")
def get_keywords(db: Session = Depends(get_db), period: str = "day"):
    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    query = period_filter(query, period)
    results = query.all()

    counter: Counter = Counter()

    STOPWORDS = {
        "di", "ke", "dari", "yang", "dan", "atau", "dengan", "untuk", "pada",
        "ini", "itu", "adalah", "dalam", "oleh", "akan", "tidak", "ada",
        "juga", "sudah", "telah", "saat", "atas", "bisa", "karena", "lebih",
        "setelah", "namun", "jika", "hanya", "sebagai", "antara", "hingga",
        "kini", "lagi", "pun", "pula", "agar", "maka", "seperti", "serta",
        "hal", "para", "tapi", "bagi", "belum", "kami", "kita", "mereka",
        "ia", "dia", "kasus", "tahun", "no", "per", "kota", "kab", "kabupaten",
        "jawa", "timur", "jatim", "indonesia", "nasional", "lokal",
        "berita", "news", "co", "id", "com", "www", "http",
        "the", "and", "of", "in", "to", "ungkap", "diduga", "duga",
        # Wilayah Jatim agar tidak muncul di word cloud
        "surabaya", "malang", "jember", "sidoarjo", "gresik", "kediri",
        "mojokerto", "pasuruan", "banyuwangi", "lumajang", "probolinggo",
        "madiun", "blitar", "sampang", "pamekasan", "sumenep", "bangkalan",
        "bojonegoro", "tuban", "lamongan", "jombang", "nganjuk", "trenggalek",
        "tulungagung", "ponorogo", "magetan", "ngawi", "pacitan", "situbondo", "bondowoso"
    }

    for n, a in results:
        # Sumber 1: crawling keyword field (bobot 1)
        if n.keyword:
            kw = n.keyword.strip()
            if kw and kw.lower() not in ("per kota/kab", "jawa timur", "-"):
                counter[kw] += 1

        # Sumber 2: AI keywords dari deep profiling (bobot 3)
        if a.keywords and isinstance(a.keywords, list):
            for kw in a.keywords:
                if kw and isinstance(kw, str) and len(kw) > 2:
                    counter[kw.lower()] += 3

        # Sumber 3: Ekstrak kata & frasa dari judul (bobot 1-2, SELALU tersedia)
        if n.title:
            title_clean = n.title
            if " - " in title_clean:
                title_clean = title_clean.rsplit(" - ", 1)[0]
            if " | " in title_clean:
                title_clean = title_clean.rsplit(" | ", 1)[0]

            # Kumpulkan kata valid
            valid_words = []
            for word in title_clean.lower().split():
                word = word.strip(".,!?():;\"'[]{}/-")
                if len(word) >= 3 and not word.isdigit() and word.isalpha():
                    valid_words.append(word)

            # Tambahkan single word
            for word in valid_words:
                if len(word) >= 4 and word not in STOPWORDS:
                    counter[word] += 1

            # Tambahkan frasa (2 kata berturutan / bigram)
            for i in range(len(valid_words) - 1):
                w1, w2 = valid_words[i], valid_words[i+1]
                if w1 not in STOPWORDS and w2 not in STOPWORDS:
                    counter[f"{w1} {w2}"] += 2

        # Boost kategori (wilayah dihapus dari word cloud)
        if a.category:
            first_word = a.category.split("&")[0].strip().lower()
            if len(first_word) >= 4:
                counter[first_word] += 2

    return [
        {"word": word, "count": count}
        for word, count in counter.most_common(60)
        if count > 0
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/entities  — Top entities dari berita yang sudah di-profile
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/entities")
def get_entities(db: Session = Depends(get_db), period: str = "day"):
    query = db.query(NewsAnalysis).join(
        News, News.id == NewsAnalysis.news_id
    ).filter(
        NewsAnalysis.sentiment == "negatif",
        NewsAnalysis.profiling_status == "complete",
        NewsAnalysis.entities.isnot(None),
    )
    query = period_filter(query, period, model=News)
    results = query.all()

    persons: Counter = Counter()
    orgs: Counter = Counter()
    locations: Counter = Counter()

    for a in results:
        if not a.entities:
            continue
        for p in (a.entities.get("persons") or []):
            if p:
                persons[p] += 1
        for o in (a.entities.get("organizations") or []):
            if o:
                orgs[o] += 1
        for l in (a.entities.get("locations") or []):
            if l:
                locations[l] += 1

    return {
        "persons": [{"name": n, "count": c} for n, c in persons.most_common(10)],
        "organizations": [{"name": n, "count": c} for n, c in orgs.most_common(10)],
        "locations": [{"name": n, "count": c} for n, c in locations.most_common(10)],
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/sources  — Top media sumber berita negatif
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sources")
def get_sources(db: Session = Depends(get_db), period: str = "day"):
    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    query = period_filter(query, period)
    results = query.all()

    source_counter: Counter = Counter()
    for n, _ in results:
        src = (n.source or "").strip()
        if src:
            source_counter[src] += 1

    return [
        {"source": src, "count": count}
        for src, count in source_counter.most_common(15)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/velocity  — Deteksi lonjakan mendadak (spike detection)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/velocity")
def get_velocity(db: Session = Depends(get_db)):
    """
    Bandingkan volume berita negatif 1 jam terakhir vs rata-rata per jam hari ini.
    Jika > 2x rata-rata → is_spike = True.
    """
    from sqlalchemy import text
    now = datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Berita dalam 1 jam terakhir
    recent_count = db.query(func.count()).select_from(News).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(
        NewsAnalysis.sentiment == "negatif",
        News.crawled_at >= one_hour_ago,
    ).scalar() or 0

    # Berita hari ini (untuk hitung rata-rata)
    total_today = db.query(func.count()).select_from(News).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(
        NewsAnalysis.sentiment == "negatif",
        News.crawled_at >= today_start,
    ).scalar() or 0

    # Jam yang sudah berlalu hari ini (minimal 1)
    hours_elapsed = max(1, now.hour)
    avg_per_hour = round(total_today / hours_elapsed, 1)

    # Spike jika 1 jam terakhir > 2x rata-rata dan minimal 3 berita
    is_spike = recent_count >= 3 and recent_count > (avg_per_hour * 2)

    return {
        "is_spike": is_spike,
        "recent_count": recent_count,       # berita 1 jam terakhir
        "avg_per_hour": avg_per_hour,        # rata-rata per jam hari ini
        "total_today": total_today,
        "threshold": round(avg_per_hour * 2, 1),
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/heat-calendar  — Data per hari untuk 30 hari terakhir
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/heat-calendar")
def get_heat_calendar(db: Session = Depends(get_db)):
    """30 hari terakhir: jumlah insiden negatif per hari untuk heat calendar."""
    today = date.today()
    start = today - timedelta(days=29)

    results = db.query(
        cast(News.crawled_at, Date).label("day"),
        func.count().label("count"),
    ).join(NewsAnalysis, News.id == NewsAnalysis.news_id).filter(
        NewsAnalysis.sentiment == "negatif",
        cast(News.crawled_at, Date) >= start,
    ).group_by("day").all()

    count_map = {str(row.day): row.count for row in results}

    calendar = []
    for i in range(30):
        d = start + timedelta(days=i)
        ds = str(d)
        count = count_map.get(ds, 0)
        level = (
            "critical" if count >= 15 else
            "high" if count >= 10 else
            "medium" if count >= 5 else
            "low" if count >= 1 else
            "none"
        )
        calendar.append({
            "date": ds,
            "count": count,
            "level": level,
            "label": d.strftime("%d %b"),
        })

    return calendar


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/compare  — Perbandingan periode ini vs periode lalu
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/compare")
def get_compare(db: Session = Depends(get_db), period: str = "week"):
    """Bandingkan jumlah insiden per kategori: periode ini vs periode lalu."""
    today = date.today()

    if period == "week":
        current_start = today - timedelta(days=7)
        prev_start = today - timedelta(days=14)
        prev_end = today - timedelta(days=7)
    elif period == "month":
        current_start = today - timedelta(days=30)
        prev_start = today - timedelta(days=60)
        prev_end = today - timedelta(days=30)
    else:  # day
        current_start = today
        prev_start = today - timedelta(days=1)
        prev_end = today

    def get_by_category(start_d, end_d=None):
        q = db.query(NewsAnalysis.category, func.count().label("count")).join(
            News, News.id == NewsAnalysis.news_id
        ).filter(
            NewsAnalysis.sentiment == "negatif",
            cast(News.crawled_at, Date) >= start_d,
        )
        if end_d:
            q = q.filter(cast(News.crawled_at, Date) < end_d)
        return {row.category: row.count for row in q.group_by(NewsAnalysis.category).all()}

    current = get_by_category(current_start)
    prev = get_by_category(prev_start, prev_end if period != "day" else None)

    all_cats = sorted(set(list(current.keys()) + list(prev.keys())))
    rows = []
    for cat in all_cats:
        cur = current.get(cat, 0)
        prv = prev.get(cat, 0)
        if cur == 0 and prv == 0:
            continue
        delta = cur - prv
        pct = round((delta / prv * 100), 1) if prv > 0 else (100 if cur > 0 else 0)
        rows.append({
            "category": cat,
            "current": cur,
            "previous": prv,
            "delta": delta,
            "delta_pct": pct,
        })

    return sorted(rows, key=lambda x: abs(x["delta"]), reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/news/{news_id}/analyze  — Deep profiling on-demand
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{news_id}/analyze")
async def analyze_news_deep(
    news_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger deep profiling AI on-demand untuk berita negatif tertentu."""
    from app.services.openai_service import deep_profile

    # Cek berita ada
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")

    analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analisis dasar belum tersedia")

    if analysis.profiling_status == "complete":
        return {"message": "Berita sudah memiliki profiling lengkap", "profiling_status": "complete"}

    try:
        result = await deep_profile(db, news_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/{news_id}/profiling  — Detail profiling
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{news_id}/profiling")
def get_profiling(news_id: str, db: Session = Depends(get_db)):
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")

    analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analisis belum tersedia")

    return {
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
        "profiling_status": analysis.profiling_status,
        # Deep profiling (bisa NULL jika pending)
        "facts": analysis.facts or [],
        "keywords": analysis.keywords or [],
        "entities": analysis.entities or {"locations": [], "persons": [], "organizations": []},
        "threat_level": analysis.threat_level,
        "threat_type": analysis.threat_type,
        "escalation_potential": analysis.escalation_potential,
        "recommended_action": analysis.recommended_action,
        # Meta
        "analyzed_at": analysis.analyzed_at,
        "profiled_at": analysis.profiled_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /api/news/{news_id}/sentiment  — Override manual
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{news_id}/sentiment")
def override_sentiment(news_id: str, payload: dict, db: Session = Depends(get_db)):
    new_sentiment = payload.get("sentiment")
    if new_sentiment not in ("negatif",):
        raise HTTPException(status_code=400, detail="Hanya bisa override ke 'negatif'")

    analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == news_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analisis belum tersedia")

    analysis.sentiment = new_sentiment
    db.commit()
    return {"success": True, "news_id": news_id, "sentiment": new_sentiment}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/news/heatmap  — Matrix Topik × Wilayah
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/heatmap")
def get_heatmap(db: Session = Depends(get_db), period: str = "day"):
    """Mengembalikan matriks: {region: {category: count}} untuk heatmap."""
    from app.services.gnews_service import REGIONS as ALL_REGIONS

    TOPICS = [
        "MBG", "KDMP", "Jembatan Garuda", "TNI",
        "Politik & Korupsi", "Demo & Konsolidasi", "Bencana Alam", "Narkoba",
    ]
    # Gunakan semua wilayah, kecuali "Jawa Timur" (terlalu umum)
    ALL_REGION_LIST = [r for r in ALL_REGIONS if r.lower() != "jawa timur"]

    query = db.query(News, NewsAnalysis).join(
        NewsAnalysis, News.id == NewsAnalysis.news_id
    ).filter(NewsAnalysis.sentiment == "negatif")
    query = period_filter(query, period)
    results = query.all()

    # Hitung jumlah per (region, category)
    matrix: dict = {r: {t: 0 for t in TOPICS} for r in ALL_REGION_LIST}

    for n, a in results:
        region = n.region
        category = a.category
        if region in matrix and category in TOPICS:
            matrix[region][category] += 1

    # Urutkan region berdasarkan total insiden (paling banyak di atas)
    sorted_regions = sorted(
        ALL_REGION_LIST,
        key=lambda r: sum(matrix[r].values()),
        reverse=True
    )

    max_val = max(
        (v for row in matrix.values() for v in row.values()),
        default=1
    )

    return {
        "topics": TOPICS,
        "regions": sorted_regions,
        "matrix": matrix,
        "max": max_val,
    }