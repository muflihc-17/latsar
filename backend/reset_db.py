from app.database import engine, Base
from app.models import News, NewsAnalysis, Watchlist, DailyReport, CrawlLog

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Creating all tables...")
Base.metadata.create_all(bind=engine)
print("Database reset complete. All tables recreated.")
