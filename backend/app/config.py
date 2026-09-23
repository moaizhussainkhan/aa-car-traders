"""
Centralized application settings, loaded from environment variables / .env.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ folder — every path below is anchored here so the app works no matter
# which directory uvicorn is started from (and inside Docker).
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    APP_NAME: str = "AA Car Traders API"
    ENVIRONMENT: str = "development"  # development | production
    SITE_URL: str = "http://localhost:8000"  # production: https://aacartraders.com

    SECRET_KEY: str = "insecure-dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = "sqlite:///./aa_car_traders.db"

    # Where uploaded product photos/videos are stored. Leave empty for backend/media
    # (in Docker, mount a volume here so uploads survive redeploys).
    MEDIA_DIR: str = ""
    MAX_IMAGE_MB: int = 12
    MAX_VIDEO_MB: int = 120

    # Tailwind is pre-compiled to static/css/tailwind.css. Set true only if you edit
    # templates/JS and add new utility classes without rebuilding the CSS.
    USE_TAILWIND_CDN: bool = False

    # Single-admin bootstrap credentials (used only to seed the one admin row)
    ADMIN_EMAIL: str = "aacartrad3rs@gmail.com"
    ADMIN_PASSWORD: str = "change-this-strong-password"
    ADMIN_NAME: str = "AA Car Traders Admin"

    WHATSAPP_NUMBER: str = "923154448835"
    WHATSAPP_DEFAULT_MESSAGE: str = "Hi AA Car Traders, I'm interested in this product:"

    CONTACT_PHONE: str = "03154448835"
    CONTACT_EMAIL: str = "aacartrad3rs@gmail.com"

    AI_PROVIDER: str = "groq"  # groq | openai | gemini
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # ---- Leopards Courier (merchant API) — booking + tracking for orders ----
    # Get these from your Leopards Courier merchant account (https://ep.leopardscourier.com).
    # Left blank, booking runs in MOCK MODE: it generates a fake tracking number
    # locally so you can demo/test the flow end-to-end before real credentials arrive.
    LEOPARDS_API_KEY: str = ""
    LEOPARDS_API_PASSWORD: str = ""
    LEOPARDS_BOOKING_URL: str = "https://merchantapi.leopardscourier.com/api/bookPacket/format/json/"
    LEOPARDS_TRACKING_URL: str = "https://merchantapi.leopardscourier.com/api/trackBookedPacket/format/json/"
    LEOPARDS_ORIGIN_CITY: str = "Lahore"
    LEOPARDS_SHIPPING_MODE: str = "Overland"  # Overland | Air

    @property
    def leopards_configured(self) -> bool:
        return bool(self.LEOPARDS_API_KEY and self.LEOPARDS_API_PASSWORD)

    @property
    def media_path(self) -> Path:
        return Path(self.MEDIA_DIR) if self.MEDIA_DIR else BASE_DIR / "media"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
