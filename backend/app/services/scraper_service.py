import logging
import trafilatura
from concurrent.futures import ThreadPoolExecutor
from googlenewsdecoder import new_decoderv1

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=3)

MAX_CONTENT_CHARS = 4000  # Batasi isi artikel agar tidak terlalu banyak token


def _fetch_and_extract(url: str) -> str:
    """Fetch dan extract teks artikel dari URL (blocking, jalankan di executor)."""
    try:
        # Resolve Google News redirect URL → URL asli
        if "news.google" in url:
            resolved = None
            # Coba httpx follow redirect
            try:
                import httpx as _httpx
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                }
                with _httpx.Client(follow_redirects=True, timeout=10, headers=headers) as c:
                    resp = c.get(url)
                    final = str(resp.url)
                    if final and "news.google" not in final and final.startswith("http"):
                        resolved = final
                        logger.info(f"    ↳ URL resolved via redirect: {final[:60]}...")
            except Exception as e:
                logger.warning(f"httpx redirect gagal (scraper): {e}")

            # Fallback googlenewsdecoder
            if not resolved:
                try:
                    res = new_decoderv1(url)
                    if res and res.get("decoded_url"):
                        d = res["decoded_url"]
                        if "news.google" not in d:
                            resolved = d
                            logger.info(f"    ↳ URL decoded: {d[:60]}...")
                except Exception as e:
                    logger.warning(f"Gagal decode URL: {e}")

            if resolved:
                url = resolved

        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""

        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
            favor_precision=True,
        )
        return text or ""
    except Exception as e:
        logger.warning(f"Scrape gagal untuk {url}: {e}")
        return ""


async def scrape_article(url: str) -> str:
    """
    Scrape full content artikel dari URL secara async.
    Fallback return string kosong jika gagal.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        text = await loop.run_in_executor(_executor, _fetch_and_extract, url)
        # Batasi panjang agar hemat token Groq
        return text[:MAX_CONTENT_CHARS] if text else ""
    except Exception as e:
        logger.warning(f"scrape_article error: {e}")
        return ""
