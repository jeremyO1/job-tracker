import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _list(name: str, default: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    supabase_url: str = os.environ["SUPABASE_URL"]
    # Service-role key: the backend bypasses RLS, so every query must filter by user_id.
    supabase_service_key: str = os.environ["SUPABASE_SERVICE_KEY"]

    openai_api_key: str = os.environ["OPENAI_API_KEY"]
    # Cheap model that decides which emails are job-related from sender/subject/snippet.
    triage_model: str = os.getenv("TRIAGE_MODEL", "gpt-5-nano")
    # Model that reads the full email of relevant messages and extracts the details.
    extract_model: str = os.getenv("EXTRACT_MODEL", "gpt-5-mini")
    llm_concurrency: int = int(os.getenv("LLM_CONCURRENCY", "8"))

    google_client_id: str = os.environ["GOOGLE_CLIENT_ID"]
    google_client_secret: str = os.environ["GOOGLE_CLIENT_SECRET"]

    # Public URLs, used for the OAuth redirect and CORS.
    backend_url: str = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS", "http://localhost:5173"))

    # Signs the OAuth "state" parameter so a callback can't be forged for another user.
    state_secret: str = os.environ["STATE_SECRET"]

    # On the very first sync of an account, only look this far back.
    initial_sync_days: int = int(os.getenv("INITIAL_SYNC_DAYS", "60"))
    max_emails_per_sync: int = int(os.getenv("MAX_EMAILS_PER_SYNC", "500"))
    gmail_concurrency: int = int(os.getenv("GMAIL_CONCURRENCY", "10"))


settings = Settings()
