import logging
from transformers import pipeline
logging.basicConfig(level=logging.INFO)
print("Downloading model...")
pipeline("sentiment-analysis", model="w11wo/indonesian-roberta-base-sentiment-classifier")
print("Download complete!")
