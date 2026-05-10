from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import engine
from app.models import Base
from app.routers import news, agent
from app.services.scheduler import start_scheduler, stop_scheduler
from app.config import get_settings
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Kodam Brawijaya Backend...")
    Base.metadata.create_all(bind=engine)  # Buat tabel otomatis
    logger.info("✅ Database tables ready")
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    logger.info("👋 Backend stopped")

app = FastAPI(
    title="Kodam V/Brawijaya — Sistem Analisis Situasi",
    description="API Backend untuk Dashboard Analisis Situasi Jawa Timur",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS untuk Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(news.router)
app.include_router(agent.router)

@app.get("/")
def root():
    return {
        "service": "Kodam V/Brawijaya API",
        "status": "online",
        "docs": "/docs",
    }

@app.get("/health")
def health():
    return {"status": "ok"}
