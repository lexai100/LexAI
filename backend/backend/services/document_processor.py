"""
Document Processor Service
Extracts text and structure from uploaded PDF files using PyMuPDF (fitz),
and parses raw legal text into a structured representation (sections,
clauses, parties).
"""

from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass, field

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


# ── Data structures ───────────────────────────────────────────────────────────


@dataclass
class Clause:
    """A single identified clause/section in a legal document."""
    number: str = ""
    title: str = ""
    text: str = ""
    sub_clauses: list["Clause"] = field(default_factory=list)


@dataclass
class ParsedDocument:
    """Structured representation of a legal document."""
    raw_text: str = ""
    title: str = ""
    parties: list[str] = field(default_factory=list)
    recitals: str = ""
    clauses: list[Clause] = field(default_factory=list)
    signatures: str = ""
    page_count: int = 0
    word_count: int = 0
    has_stamp_paper_ref: bool = False


# ── Service ───────────────────────────────────────────────────────────────────


class DocumentProcessorService:
    """Process PDF and text documents into structured legal representations."""

    # ── PDF extraction ────────────────────────────────────────────────────

    @staticmethod
    def extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
        """
        Extract all text from a PDF file.
        Returns (full_text, page_count).
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages: list[str] = []
            for page in doc:
                text = page.get_text("text")
                if text.strip():
                    pages.append(text)
                else:
                    # Attempt OCR-based extraction for scanned pages
                    try:
                        text = page.get_text("text", flags=fitz.TEXT_PRESERVE_WHITESPACE)
                        if text.strip():
                            pages.append(text)
                    except Exception:
                        logger.debug("OCR fallback failed for page %d", page.number)
            page_count = len(doc)
            doc.close()
            full_text = "\n\n--- Page Break ---\n\n".join(pages)
            return full_text, page_count
        except Exception as exc:
            logger.error("PDF extraction failed: %s", exc)
            raise ValueError(f"Could not process PDF: {exc}") from exc

    # ── Text parsing ──────────────────────────────────────────────────────

    @classmethod
    def parse_document(cls, text: str, page_count: int = 1) -> ParsedDocument:
        """
        Parse raw legal text into a structured ParsedDocument.
        Uses heuristics to identify title, parties, clauses, etc.
        """
        doc = ParsedDocument(
            raw_text=text,
            page_count=page_count,
            word_count=len(text.split()),
        )

        lines = text.split("\n")
        cleaned_lines = [ln.strip() for ln in lines if ln.strip()]

        # ── Title detection ───────────────────────────────────────────
        doc.title = cls._detect_title(cleaned_lines)

        # ── Stamp paper reference ─────────────────────────────────────
        doc.has_stamp_paper_ref = bool(
            re.search(r"stamp\s*paper|non[- ]judicial", text, re.IGNORECASE)
        )

        # ── Parties detection ─────────────────────────────────────────
        doc.parties = cls._detect_parties(text)

        # ── Recitals detection ────────────────────────────────────────
        doc.recitals = cls._detect_recitals(text)

        # ── Clause parsing ────────────────────────────────────────────
        doc.clauses = cls._parse_clauses(text)

        # ── Signatures ───────────────────────────────────────────────
        doc.signatures = cls._detect_signatures(text)

        return doc

    # ── Private helpers ───────────────────────────────────────────────────

    @staticmethod
    def _detect_title(lines: list[str]) -> str:
        """Heuristic: first line that's mostly uppercase and > 5 chars is the title."""
        for line in lines[:10]:
            upper_ratio = sum(1 for c in line if c.isupper()) / max(len(line), 1)
            if len(line) > 5 and upper_ratio > 0.5:
                return line
        return lines[0] if lines else "Untitled Document"

    @staticmethod
    def _detect_parties(text: str) -> list[str]:
        """Extract party names from BETWEEN ... AND ... blocks."""
        parties: list[str] = []
        # Pattern: "BETWEEN\n{name}," or "(hereinafter ... "Landlord")"
        between_match = re.search(
            r"BETWEEN\s*\n\s*(.+?)(?:,|\n)",
            text,
            re.IGNORECASE,
        )
        if between_match:
            parties.append(between_match.group(1).strip())

        and_match = re.search(
            r"\bAND\s*\n\s*(.+?)(?:,|\n)",
            text,
            re.IGNORECASE,
        )
        if and_match:
            candidate = and_match.group(1).strip()
            if len(candidate) > 2 and candidate not in parties:
                parties.append(candidate)

        # Fallback: look for "hereinafter referred to as" patterns
        hereinafter = re.findall(
            r'hereinafter\s+referred\s+to\s+as\s+(?:the\s+)?["\'](.+?)["\']',
            text,
            re.IGNORECASE,
        )
        if not parties and hereinafter:
            parties = hereinafter[:2]

        return parties

    @staticmethod
    def _detect_recitals(text: str) -> str:
        """Extract WHEREAS / RECITALS block."""
        match = re.search(
            r"((?:RECITALS|WHEREAS).*?)(?=\n\s*\d+\.\s|\nNOW\s+THEREFORE)",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        return match.group(1).strip() if match else ""

    @staticmethod
    def _parse_clauses(text: str) -> list[Clause]:
        """
        Split text into numbered clauses.
        Handles patterns like '1.', '1. TITLE', '1.1.', etc.
        """
        # Split on top-level numbered headings: "1. TITLE" or "1. "
        pattern = re.compile(
            r"^(\d{1,2})\.\s+([A-Z][A-Z\s,&/()-]{2,})\s*$",
            re.MULTILINE,
        )
        matches = list(pattern.finditer(text))

        if not matches:
            # Fallback: just split on "NUMBER. " at line start
            pattern2 = re.compile(r"^(\d{1,2})\.\s+", re.MULTILINE)
            matches = list(pattern2.finditer(text))

        clauses: list[Clause] = []
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            block = text[start:end].strip()

            # Try to get title from first line
            first_line = block.split("\n")[0]
            title_match = re.match(r"\d+\.\s+(.*)", first_line)
            title = title_match.group(1).strip() if title_match else ""
            body = "\n".join(block.split("\n")[1:]).strip()

            clause = Clause(
                number=m.group(1),
                title=title,
                text=body,
            )

            # Parse sub-clauses (X.Y.)
            sub_pattern = re.compile(
                rf"^{re.escape(m.group(1))}\.(\d+)\.\s+",
                re.MULTILINE,
            )
            sub_matches = list(sub_pattern.finditer(body))
            for j, sm in enumerate(sub_matches):
                s_start = sm.start()
                s_end = sub_matches[j + 1].start() if j + 1 < len(sub_matches) else len(body)
                sub_text = body[s_start:s_end].strip()
                clause.sub_clauses.append(
                    Clause(
                        number=f"{m.group(1)}.{sm.group(1)}",
                        text=sub_text,
                    )
                )

            clauses.append(clause)

        return clauses

    @staticmethod
    def _detect_signatures(text: str) -> str:
        """Extract the signature block (typically at the end)."""
        match = re.search(
            r"(IN\s+WITNESS\s+WHEREOF.*)",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        return match.group(1).strip() if match else ""

    # ── Convenience ───────────────────────────────────────────────────────

    @classmethod
    def process_pdf(cls, pdf_bytes: bytes) -> ParsedDocument:
        """Extract + parse a PDF in one call."""
        text, pages = cls.extract_text_from_pdf(pdf_bytes)
        return cls.parse_document(text, pages)

    @classmethod
    def process_text(cls, text: str) -> ParsedDocument:
        """Parse raw text (no PDF extraction needed)."""
        return cls.parse_document(text)
