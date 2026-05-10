import logging
from huggingface_hub import snapshot_download
logging.basicConfig(level=logging.INFO)
print("Optimized downloading starting...")
snapshot_download(
    repo_id="w11wo/indonesian-roberta-base-sentiment-classifier",
    allow_patterns=["*.json", "*.txt", "*.safetensors", "*.model"]
)
print("Optimized download complete!")
