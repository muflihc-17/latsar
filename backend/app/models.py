from sqlalchemy import Column, String, Float, Text, DateTime, Integer, JSON, Boolean
from sqlalchemy.sql import func
from app.database import Base
import uuid

def gen_uuid():
    return str(uuid.uuid4())

class News(Base):
    __tablename__ = "news"

    id           = Column(String, primary_key=True, default=gen_uuid)
    title        = Column(Text, nullable=False)
    description  = Column(Text)
    url          = Column(Text)
    source       = Column(String(255))
    region       = Column(String(100))
    keyword      = Column(String(100))   # query keyword saat crawling
    published_at = Column(DateTime)
    crawled_at   = Column(DateTime, server_default=func.now())


class NewsAnalysis(Base):
    __tablename__ = "news_analysis"

    id               = Column(String, primary_key=True, default=gen_uuid)
    news_id          = Column(String, nullable=False)

    # Klasifikasi awal (dari fast_classify — selalu tersedia)
    sentiment        = Column(String(20))          # selalu "negatif"
    sentiment_score  = Column(Float)
    category         = Column(String(100))

    # Status profiling
    # "pending"  = hanya fast classify, belum deep profile
    # "complete" = sudah deep profile (on-demand)
    # "failed"   = deep profile gagal
    profiling_status = Column(String(20), default="pending")

    # Deep profiling fields (diisi saat on-demand, awalnya NULL)
    facts                = Column(JSON)            # list fakta kunci dari artikel
    keywords             = Column(JSON)            # kata kunci dominan dari AI
    entities             = Column(JSON)            # {locations, persons, organizations}
    threat_level         = Column(Integer)         # 1-5 (Rendah - Kritis)
    threat_type          = Column(String(100))     # jenis ancaman
    escalation_potential = Column(Text)            # analisis potensi eskalasi
    recommended_action   = Column(Text)            # rekomendasi tindakan

    # Meta
    analyzed_at          = Column(DateTime, server_default=func.now())
    profiled_at          = Column(DateTime)        # waktu deep profile selesai


class Watchlist(Base):
    __tablename__ = "watchlist"

    id          = Column(String, primary_key=True, default=gen_uuid)
    term        = Column(String(200), nullable=False, unique=True)  # kata/nama yang dipantau
    term_type   = Column(String(50))    # "person" | "organization" | "keyword" | "location"
    hit_count   = Column(Integer, default=0)
    last_hit_at = Column(DateTime)
    created_at  = Column(DateTime, server_default=func.now())


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id          = Column(String, primary_key=True, default=gen_uuid)
    report_date = Column(String(20))
    region      = Column(String(100), default="ALL")
    summary     = Column(Text)
    top_issues  = Column(JSON)
    alert_level = Column(String(20))
    created_at  = Column(DateTime, server_default=func.now())


class CrawlLog(Base):
    __tablename__ = "crawl_logs"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    crawled_at   = Column(DateTime, server_default=func.now())
    total_found  = Column(Integer, default=0)
    total_new    = Column(Integer, default=0)
    total_neg    = Column(Integer, default=0)    # berapa yang negatif & disimpan
    status       = Column(String(20))
    error_msg    = Column(Text)

class ExecutiveReport(Base):
    __tablename__ = "executive_reports"

    id          = Column(String, primary_key=True, default=gen_uuid)
    title       = Column(String(255))
    content     = Column(Text)
    news_ids    = Column(JSON)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())
