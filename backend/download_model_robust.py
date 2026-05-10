import time
import logging
from huggingface_hub import snapshot_download
logging.basicConfig(level=logging.INFO)

print("Starting robust download...")
while True:
    try:
        snapshot_download(
            repo_id="w11wo/indonesian-roberta-base-sentiment-classifier",
            allow_patterns=["*.json", "*.txt", "*.safetensors", "*.model"],
            resume_download=True
        )
        print("Download complete!")
        break
    except Exception as e:
        print(f"Error: {e}. Retrying in 5 seconds...")
        time.sleep(5)
