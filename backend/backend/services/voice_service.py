"""
Voice Service
Handles Speech-to-Text via Groq Whisper (multilingual — supports Hindi, Kannada,
English, Tamil, Telugu, Marathi) and returns structured text for TTS.

Pipeline:
  Audio bytes → Groq Whisper → raw transcript
             → PII scan (remove Aadhaar/PAN from voice) → clean text
"""

from __future__ import annotations

import logging
import re
from typing import Literal

import httpx

logger = logging.getLogger(__name__)

# Supported language codes (ISO 639-1) that Whisper handles well
SupportedLanguage = Literal["en", "hi", "kn", "ta", "te", "mr", "gu", "bn", "auto"]

# Quick regex-based PII strip for voice transcripts (pre-LLM safety net)
_PII_PATTERNS = [
    (re.compile(r"\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b"), "[AADHAAR]"),
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"), "[PAN]"),
    (re.compile(r"\b(?:\+91[\s\-]?)?[6-9]\d{9}\b"), "[PHONE]"),
    (re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"), "[IFSC]"),
    (re.compile(r"\b\w+@(?:upi|oksbi|okaxis|okhdfcbank|ybl|ibl|axl|paytm)\b", re.I), "[UPI]"),
]


def _sanitize_transcript(text: str) -> str:
    """Strip obvious Indian PII from a voice transcript."""
    for pattern, replacement in _PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text.strip()


class VoiceService:
    """
    Wraps Groq Whisper for fast multilingual STT optimised for Indian accents.

    Usage::
        svc = VoiceService(groq_api_key="gsk_...")
        result = await svc.transcribe(audio_bytes, filename="audio.webm", language="hi")
    """

    GROQ_BASE_URL = "https://api.groq.com/openai/v1"
    # Groq's fastest multilingual model — great for Indian accents
    WHISPER_MODEL = "whisper-large-v3-turbo"

    def __init__(self, groq_api_key: str) -> None:
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY is required for the Voice Service")
        self._api_key = groq_api_key

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        language: SupportedLanguage = "auto",
        sanitize_pii: bool = True,
    ) -> dict:
        """
        Transcribe audio bytes → text.

        Returns a dict::
            {
                "text": str,               # clean transcript
                "raw_text": str,           # before PII strip
                "language": str,           # detected language code
                "duration_seconds": float,
                "pii_redacted": bool,
            }

        Raises ``RuntimeError`` on API failure.
        """
        if not audio_bytes:
            raise ValueError("audio_bytes is empty")

        # Build multipart form
        form_data: dict = {
            "model": self.WHISPER_MODEL,
            "response_format": "verbose_json",
        }
        if language != "auto":
            form_data["language"] = language

        logger.info(
            "VoiceService: transcribing %d bytes (lang=%s, model=%s)",
            len(audio_bytes),
            language,
            self.WHISPER_MODEL,
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.GROQ_BASE_URL}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    files={"file": (filename, audio_bytes, _guess_mime(filename))},
                    data=form_data,
                )
                response.raise_for_status()
                data = response.json()

        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500]
            logger.error("Groq Whisper HTTP error %d: %s", exc.response.status_code, body)
            raise RuntimeError(
                f"Groq STT failed (HTTP {exc.response.status_code}): {body}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Groq Whisper network error: %s", exc)
            raise RuntimeError(f"Network error calling Groq: {exc}") from exc

        raw_text: str = data.get("text", "").strip()
        detected_lang: str = data.get("language", language if language != "auto" else "en")
        duration: float = float(data.get("duration", 0.0))

        # PII sanitization
        pii_redacted = False
        clean_text = raw_text
        if sanitize_pii:
            clean_text = _sanitize_transcript(raw_text)
            pii_redacted = clean_text != raw_text

        if pii_redacted:
            logger.info("VoiceService: PII detected and redacted from transcript")

        logger.info(
            "VoiceService: transcribed %.1fs audio → %d chars (lang=%s)",
            duration,
            len(clean_text),
            detected_lang,
        )

        return {
            "text": clean_text,
            "raw_text": raw_text,
            "language": detected_lang,
            "duration_seconds": duration,
            "pii_redacted": pii_redacted,
        }

    async def health_check(self) -> bool:
        """Ping Groq to verify the API key is valid."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.GROQ_BASE_URL}/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                return resp.status_code == 200
        except Exception:
            return False


def _guess_mime(filename: str) -> str:
    """Return a MIME type for common audio file extensions."""
    ext = filename.rsplit(".", 1)[-1].lower()
    mime_map = {
        "webm": "audio/webm",
        "wav": "audio/wav",
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "ogg": "audio/ogg",
        "flac": "audio/flac",
        "mp4": "audio/mp4",
    }
    return mime_map.get(ext, "audio/webm")
