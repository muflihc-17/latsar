from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://muflihulchoir@localhost:5432/sansidam_db"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "meta-llama/llama-prompt-guard-2-22m"

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    crawl_interval_minutes: int = 10
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
