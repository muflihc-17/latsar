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
    keyword      = Column(String(100))
    published_at = Column(DateTime)
    crawled_at   = Column(DateTime, server_default=func.now())

class NewsAnalysis(Base):
    __tablename__ = "news_analysis"

    id                   = Column(String, primary_key=True, default=gen_uuid)
    news_id              = Column(String, nullable=False)
    # Sentimen dasar
    sentiment            = Column(String(20))
    sentiment_score      = Column(Float)
    category             = Column(String(100))
    summary              = Column(Text)
    # Profiling intelijen
    full_content         = Column(Text)           # hasil scrape artikel
    facts                = Column(JSON)           # list fakta-fakta kunci
    keywords             = Column(JSON)           # kata kunci dominan
    entities             = Column(JSON)           # lokasi, tokoh, organisasi
    # Analisis ancaman (hanya untuk berita negatif)
    threat_level         = Column(Integer)        # 1–10
    threat_type          = Column(String(100))    # jenis ancaman
    escalation_potential = Column(Text)           # potensi eskalasi
    recommended_action   = Column(Text)           # rekomendasi tindakan
    # Meta
    profiling_complete   = Column(Boolean, default=False)
    analyzed_at          = Column(DateTime, server_default=func.now())

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
    status       = Column(String(20))
    error_msg    = Column(Text)
