"""Settings read from environment variables (prefixed ``LIBRARY_``)."""

import secrets
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/src/library_system/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LIBRARY_")

    # LIBRARY_DATABASE_FILE: the SQLite database, created on first run.
    # The web API and the command-line program share it.
    database_file: Path = BACKEND_DIR / "library.db"

    # LIBRARY_SECRET_KEY signs sign-in tokens. Generate one with
    # `openssl rand -hex 32`. Without it a random key is used, so
    # everyone is signed out whenever the server restarts.
    secret_key: str = Field(
        default_factory=lambda: secrets.token_hex(32), min_length=32
    )

    access_token_expire_minutes: int = 30

    # LIBRARY_FRONTEND_DIR: the web pages the API serves at "/".
    frontend_dir: Path = BACKEND_DIR.parent / "frontend"
