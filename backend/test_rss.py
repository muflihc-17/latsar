import feedparser
import urllib.parse
query = urllib.parse.quote("surabaya")
url = f"https://news.google.com/rss/search?q={query}&hl=id&gl=ID&ceid=ID:id"
feed = feedparser.parse(url)
print(f"Found {len(feed.entries)} news")
if feed.entries:
    print(feed.entries[0].title)
