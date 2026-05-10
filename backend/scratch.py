import asyncio
from app.database import SessionLocal
from app.models import News
from app.services.openai_service import analyze_single_news
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    db = SessionLocal()
    news = db.query(News).first()
    if news:
        print(f"Analyzing {news.id} - {news.title}")
        try:
            success = await analyze_single_news(db, news)
            print(f"Success: {success}")
        except Exception as e:
            print(f"Exception: {e}")
    else:
        print("No news found")

if __name__ == "__main__":
    asyncio.run(main())
