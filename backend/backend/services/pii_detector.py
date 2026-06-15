"""
PII Detector Service
Custom Microsoft Presidio recognizers for Indian PII patterns (Aadhaar, PAN,
Indian phone numbers, IFSC codes, UPI IDs) plus tokenization/detokenization
using Fernet symmetric encryption.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from cryptography.fernet import Fernet
from presidio_analyzer import (
    AnalyzerEngine,
    Pattern,
    PatternRecognizer,
    RecognizerResult,
)
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

logger = logging.getLogger(__name__)


# ── Custom Indian PII Recognizers ─────────────────────────────────────────────


class AadhaarRecognizer(PatternRecognizer):
    """Recognises 12-digit Aadhaar numbers (XXXX XXXX XXXX or XXXX-XXXX-XXXX)."""

    PATTERNS = [
        Pattern(
            "AADHAAR_SPACED",
            r"\b[2-9]\d{3}\s\d{4}\s\d{4}\b",
            0.85,
        ),
        Pattern(
            "AADHAAR_DASHED",
            r"\b[2-9]\d{3}-\d{4}-\d{4}\b",
            0.85,
        ),
        Pattern(
            "AADHAAR_PLAIN",
            r"\b[2-9]\d{11}\b",
            0.6,
        ),
    ]

    CONTEXT_WORDS = [
        "aadhaar", "aadhar", "uidai", "uid", "unique identification",
        "aadhaar number", "aadhaar no", "aadhar no",
    ]

    def __init__(self) -> None:
        super().__init__(
            supported_entity="IN_AADHAAR",
            patterns=self.PATTERNS,
            context=self.CONTEXT_WORDS,
            supported_language="en",
        )


class PANRecognizer(PatternRecognizer):
    """Recognises Indian PAN (Permanent Account Number): ABCDE1234F."""

    PATTERNS = [
        Pattern(
            "PAN",
            r"\b[A-Z]{3}[ABCFGHLJPTK][A-Z]\d{4}[A-Z]\b",
            0.85,
        ),
    ]

    CONTEXT_WORDS = [
        "pan", "permanent account", "income tax", "pan number",
        "pan no", "pan card",
    ]

    def __init__(self) -> None:
        super().__init__(
            supported_entity="IN_PAN",
            patterns=self.PATTERNS,
            context=self.CONTEXT_WORDS,
            supported_language="en",
        )


class IndianPhoneRecognizer(PatternRecognizer):
    """Recognises Indian mobile numbers: +91, 0, or bare 10-digit starting with 6-9."""

    PATTERNS = [
        Pattern(
            "INDIAN_PHONE_INTL",
            r"\b(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b",
            0.5,
        ),
        Pattern(
            "INDIAN_PHONE_DOMESTIC",
            r"\b0?[6-9]\d{9}\b",
            0.4,
        ),
    ]

    CONTEXT_WORDS = [
        "phone", "mobile", "contact", "cell", "telephone", "mob",
        "whatsapp", "call",
    ]

    def __init__(self) -> None:
        super().__init__(
            supported_entity="IN_PHONE",
            patterns=self.PATTERNS,
            context=self.CONTEXT_WORDS,
            supported_language="en",
        )


class IFSCRecognizer(PatternRecognizer):
    """Recognises Indian bank IFSC codes: 4 letters + 0 + 6 alphanumeric."""

    PATTERNS = [
        Pattern(
            "IFSC",
            r"\b[A-Z]{4}0[A-Z0-9]{6}\b",
            0.7,
        ),
    ]

    CONTEXT_WORDS = [
        "ifsc", "bank", "branch", "neft", "rtgs", "imps",
    ]

    def __init__(self) -> None:
        super().__init__(
            supported_entity="IN_IFSC",
            patterns=self.PATTERNS,
            context=self.CONTEXT_WORDS,
            supported_language="en",
        )


class UPIRecognizer(PatternRecognizer):
    """Recognises UPI IDs: user@provider (e.g. name@upi, name@oksbi)."""

    PATTERNS = [
        Pattern(
            "UPI_ID",
            r"\b[a-zA-Z0-9._-]+@[a-zA-Z]{2,}[a-zA-Z0-9]*\b",
            0.4,
        ),
    ]

    CONTEXT_WORDS = [
        "upi", "vpa", "upi id", "gpay", "phonepe", "paytm", "bhim",
    ]

    def __init__(self) -> None:
        super().__init__(
            supported_entity="IN_UPI",
            patterns=self.PATTERNS,
            context=self.CONTEXT_WORDS,
            supported_language="en",
        )


# ── PII Detection Service ────────────────────────────────────────────────────


class PIIDetectorService:
    """Detect, anonymize, and de-anonymize PII in legal documents."""

    # Entities we care about (built-in + Indian custom)
    ENTITIES = [
        # Built-in Presidio
        "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION",
        "DATE_TIME", "CREDIT_CARD", "IBAN_CODE",
        # Indian custom
        "IN_AADHAAR", "IN_PAN", "IN_PHONE", "IN_IFSC", "IN_UPI",
    ]

    def __init__(self, fernet: Optional[Fernet] = None) -> None:
        self._fernet = fernet

        # Build NLP engine with spaCy – use small model for speed
        nlp_config = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
        try:
            nlp_provider = NlpEngineProvider(nlp_configuration=nlp_config)
            nlp_engine = nlp_provider.create_engine()
        except Exception:
            logger.warning(
                "spaCy model 'en_core_web_sm' not found. "
                "Run: python -m spacy download en_core_web_sm"
            )
            nlp_engine = None

        self._analyzer = AnalyzerEngine(nlp_engine=nlp_engine) if nlp_engine else AnalyzerEngine()
        self._anonymizer = AnonymizerEngine()

        # Register custom Indian recognizers
        for recognizer_cls in (
            AadhaarRecognizer,
            PANRecognizer,
            IndianPhoneRecognizer,
            IFSCRecognizer,
            UPIRecognizer,
        ):
            self._analyzer.registry.add_recognizer(recognizer_cls())

        # Token map for de-anonymization
        self._token_map: dict[str, str] = {}

    # ── Public API ────────────────────────────────────────────────────────

    def detect(self, text: str, language: str = "en") -> list[RecognizerResult]:
        """Detect PII entities in text."""
        return self._analyzer.analyze(
            text=text,
            entities=self.ENTITIES,
            language=language,
        )

    def anonymize(self, text: str, language: str = "en") -> tuple[str, int]:
        """Replace PII with tokens. Returns (anonymized_text, entity_count)."""
        results = self.detect(text, language)
        if not results:
            return text, 0

        # Build operator config – encrypt if Fernet available, else mask
        if self._fernet:
            operators = {
                "DEFAULT": OperatorConfig(
                    "replace",
                    {"new_value": "<PII_REDACTED>"},
                )
            }
        else:
            operators = {
                "DEFAULT": OperatorConfig(
                    "replace",
                    {"new_value": "<PII_REDACTED>"},
                )
            }

        anonymized = self._anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators=operators,
        )

        return anonymized.text, len(results)

    def tokenize(self, text: str, language: str = "en") -> tuple[str, dict[str, str]]:
        """
        Replace each PII entity with an encrypted token and return a
        mapping so the original values can be restored.
        """
        results = self.detect(text, language)
        if not results:
            return text, {}

        # Sort by start position descending so replacements don't shift indices
        results_sorted = sorted(results, key=lambda r: r.start, reverse=True)
        token_map: dict[str, str] = {}
        tokenized = text

        for i, result in enumerate(results_sorted):
            original = text[result.start: result.end]
            token_key = f"<<{result.entity_type}_{i}>>"

            if self._fernet:
                encrypted = self._fernet.encrypt(original.encode()).decode()
                token_map[token_key] = encrypted
            else:
                token_map[token_key] = original

            tokenized = tokenized[:result.start] + token_key + tokenized[result.end:]

        self._token_map.update(token_map)
        return tokenized, token_map

    def detokenize(self, text: str, token_map: Optional[dict[str, str]] = None) -> str:
        """Restore original PII values from tokens."""
        mapping = token_map or self._token_map
        result = text
        for token_key, encrypted_or_original in mapping.items():
            if self._fernet and not encrypted_or_original.startswith("<<"):
                try:
                    original = self._fernet.decrypt(encrypted_or_original.encode()).decode()
                except Exception:
                    original = encrypted_or_original
            else:
                original = encrypted_or_original
            result = result.replace(token_key, original)
        return result

    def get_entity_count(self, text: str, language: str = "en") -> int:
        """Count PII entities found in text."""
        return len(self.detect(text, language))
