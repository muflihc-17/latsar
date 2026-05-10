import logging
logging.basicConfig(level=logging.INFO)
from app.services.sentiment_service import analyze_sentiment_local

print(analyze_sentiment_local("Pemerintah berencana meningkatkan subsidi pupuk untuk petani tahun depan."))
print(analyze_sentiment_local("Kecelakaan beruntun terjadi di jalan tol hari ini, 3 orang tewas."))
