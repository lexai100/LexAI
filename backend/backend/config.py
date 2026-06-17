"""
LexAI Configuration
Loads environment variables and exposes all constants used across the platform.
"""

from __future__ import annotations

import os
import secrets

from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── API Keys ──────────────────────────────────────────────────────────
    NVIDIA_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    INDIAN_KANOON_TOKEN: str = ""

    # ── Encryption ────────────────────────────────────────────────────────
    ENCRYPTION_KEY: str = ""

    # ── Storage ───────────────────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # ── Server ────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Model constants (not loaded from env) ─────────────────────────────

    # DocumentCraft – expert legal drafter (DeepSeek V4 Pro)
    DOCUMENT_CRAFT_MODEL: str = "deepseek-ai/deepseek-v4-pro"
    # LoopholeHound – adversarial analyst (DeepSeek Flash for speed + less rate limiting)
    LOOPHOLE_HOUND_MODEL: str = "deepseek-ai/deepseek-v4-flash"
    # Fast utility model (DeepSeek V4 Flash)
    FAST_MODEL: str = "deepseek-ai/deepseek-v4-flash"

    # ── Endpoint base URLs ────────────────────────────────────────────────
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # ── Adversarial loop defaults ─────────────────────────────────────────
    MAX_ADVERSARIAL_ROUNDS: int = 3
    EXPLOITABILITY_THRESHOLD: int = 15  # score < this → document is "safe"

    # ── Derived helpers ───────────────────────────────────────────────────

    def get_fernet(self) -> Fernet:
        """Return a Fernet instance, auto-generating a key on first run."""
        key = self.ENCRYPTION_KEY
        if not key:
            key = Fernet.generate_key().decode()
            # Persist so subsequent runs reuse the same key
            self._persist_encryption_key(key)
            self.ENCRYPTION_KEY = key
        return Fernet(key.encode() if isinstance(key, str) else key)

    @staticmethod
    def _persist_encryption_key(key: str) -> None:
        """Append the generated key to .env so it survives restarts."""
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        try:
            with open(env_path, "a", encoding="utf-8") as fp:
                fp.write(f"\nENCRYPTION_KEY={key}\n")
        except OSError:
            pass  # Non-critical – key is held in memory for this process


# Singleton used throughout the app
settings = Settings()
