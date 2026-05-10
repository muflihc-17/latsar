from gnews import GNews
gn = GNews(language="id", country="ID", max_results=5, period="1d")
query = "bencana Malang"
print(f"Testing query: {query}")
try:
    results = gn.get_news(query)
    print(f"Found {len(results) if results else 0} results")
    if results:
        print(results[0])
except Exception as e:
    print(f"Error: {e}")
