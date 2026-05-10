"""
Script: fix_urls.py
Jalankan: venv/bin/python3 fix_urls.py
Tujuan: Resolve semua Google News redirect URL di database → URL artikel asli
"""
import sys, os, time, random
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import News
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url)
Session = sessionmaker(bind=engine)
db = Session()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

def resolve_url(url: str, retries: int = 3) -> str:
    """Follow Google redirect dengan retry dan jeda random."""
    if not url or "news.google" not in url:
        return url

    for attempt in range(retries):
        try:
            # Jeda random untuk menghindari rate limit
            wait = random.uniform(2, 5) * (attempt + 1)
            if attempt > 0:
                print(f"    Retry {attempt+1}/{retries}, tunggu {wait:.1f}s...")
                time.sleep(wait)

            with httpx.Client(
                follow_redirects=True,
                timeout=15,
                headers=HEADERS,
            ) as client:
                resp = client.get(url)
                final = str(resp.url)
                if final and "news.google" not in final and final.startswith("http"):
                    return final

        except httpx.TooManyRedirects:
            break
        except Exception as e:
            print(f"    Error: {e}")

    # Fallback: googlenewsdecoder dengan jeda
    try:
        time.sleep(random.uniform(3, 7))
        from googlenewsdecoder import new_decoderv1
        res = new_decoderv1(url)
        if res and res.get("status") and res.get("decoded_url"):
            d = res["decoded_url"]
            if "news.google" not in d:
                return d
    except Exception:
        pass

    return url


google_news = db.query(News).filter(News.url.like("%news.google%")).all()
total = len(google_news)
print(f"🔍 Ditemukan {total} berita dengan Google News URL")
print("⚠️  Proses ini memerlukan jeda antara request untuk menghindari rate limit Google.")
print()

fixed = 0
failed = 0
for i, news in enumerate(google_news, 1):
    print(f"[{i}/{total}] {news.title[:55]}...")
    real_url = resolve_url(news.url)
    if real_url != news.url and "news.google" not in real_url:
        news.url = real_url
        db.commit()
        print(f"  ✅ → {real_url[:70]}")
        fixed += 1
    else:
        print(f"  ✗ Gagal (URL tetap Google News)")
        failed += 1

    # Jeda 3-6 detik antar request agar tidak diblokir
    delay = random.uniform(3, 6)
    time.sleep(delay)

print(f"\n🎉 Selesai: {fixed} berhasil, {failed} gagal dari {total} total")
db.close()
