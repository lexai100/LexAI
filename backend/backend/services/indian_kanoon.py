"""
Indian Kanoon API Client
Searches and fetches Indian court judgments via the Indian Kanoon API.
Supports Delhi High Court, Karnataka High Court, Supreme Court + district courts.

Pricing reminder (pre-paid INR):
  Search: ₹0.50 | Document: ₹0.20 | DocFragment: ₹0.05 | Metainfo: ₹0.02
  ₹500 free credits on signup → ~1000 searches for the hackathon.
"""

from __future__ import annotations

import logging
from typing import Literal, Optional

import httpx

logger = logging.getLogger(__name__)

# Available court identifiers (add more as needed)
CourtCode = Literal[
    "supremecourt",
    "delhi",
    "delhidc",          # Delhi District Courts
    "karnataka",
    "allahabad",
    "bombay",
    "madras",
    "calcutta",
    "kerala",
    "",                 # empty = all courts
]


class IndianKanoonClient:
    """
    Async client for the Indian Kanoon REST API.

    Usage::
        client = IndianKanoonClient(api_token="f32034...")
        results = await client.search("rent agreement dispute", court="delhi")
        doc = await client.get_document(results[0]["tid"])
    """

    BASE_URL = "https://api.indiankanoon.org"

    def __init__(self, api_token: str) -> None:
        if not api_token:
            raise ValueError("INDIAN_KANOON_TOKEN is required")
        self._token = api_token
        self._headers = {"Authorization": f"Token {self._token}"}

    # ── Search ────────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        court: CourtCode = "",
        page: int = 0,
        max_results: int = 5,
    ) -> list[dict]:
        """
        Full-text search across Indian court judgments and statutes.

        Returns a list of result dicts::
            [
                {
                    "tid": int,
                    "title": str,
                    "headline": str,       # snippet with keywords
                    "doc_type": str,       # "judgment", "act", etc.
                    "court": str,
                    "date": str,
                    "url": str,            # Indian Kanoon public URL
                }
            ]
        """
        # Build query string — append court filter using doctypes: operator
        full_query = query.strip()
        if court:
            full_query += f" doctypes:{court}"

        logger.info("IndianKanoon search: query=%r page=%d", full_query, page)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.BASE_URL}/search/",
                    headers=self._headers,
                    data={"formInput": full_query, "pagenum": page},
                )
                resp.raise_for_status()
                data = resp.json()

        except httpx.HTTPStatusError as exc:
            logger.error(
                "IndianKanoon search HTTP %d: %s",
                exc.response.status_code,
                exc.response.text[:300],
            )
            raise RuntimeError(
                f"Indian Kanoon search failed (HTTP {exc.response.status_code})"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Network error calling Indian Kanoon: {exc}") from exc

        docs = data.get("docs", [])
        results = []
        for doc in docs[:max_results]:
            tid = doc.get("tid", 0)
            results.append({
                "tid": tid,
                "title": doc.get("title", "Untitled"),
                "headline": _strip_html(doc.get("headline", "")),
                "doc_type": doc.get("doctype", "judgment"),
                "court": doc.get("docsource", ""),
                "date": doc.get("publishdate", ""),
                "url": f"https://indiankanoon.org/doc/{tid}/",
            })

        logger.info("IndianKanoon: %d results for %r", len(results), query)
        return results

    # ── Document fetch ────────────────────────────────────────────────────

    async def get_document(self, doc_id: int) -> dict:
        """
        Fetch the full text and metadata of a single judgment/act.

        Returns::
            {
                "tid": int,
                "title": str,
                "doc": str,        # full text (may be long)
                "court": str,
                "date": str,
                "url": str,
            }
        """
        logger.info("IndianKanoon: fetching doc %d", doc_id)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/doc/{doc_id}/",
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Indian Kanoon doc fetch failed (HTTP {exc.response.status_code})"
            ) from exc

        return {
            "tid": doc_id,
            "title": data.get("title", ""),
            "doc": _strip_html(data.get("doc", "")),
            "court": data.get("docsource", ""),
            "date": data.get("publishdate", ""),
            "url": f"https://indiankanoon.org/doc/{doc_id}/",
        }

    # ── Document metadata ─────────────────────────────────────────────────

    async def get_metainfo(self, doc_id: int) -> dict:
        """Cheap (₹0.02) metadata-only fetch — title, court, date, citations."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/docmeta/{doc_id}/",
                    headers=self._headers,
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.warning("IndianKanoon metainfo failed for %d: %s", doc_id, exc)
            return {}

    # ── Smart legal search ────────────────────────────────────────────────

    async def search_for_document_type(
        self,
        document_type: str,
        context: Optional[str] = None,
        court: CourtCode = "",
    ) -> list[dict]:
        """
        Higher-level search: given a document type (e.g. 'rent_agreement'),
        build a relevant legal query and return top cases.
        """
        query_map = {
            "rent_agreement": "rental agreement dispute landlord tenant",
            "nda": "non-disclosure agreement breach confidentiality",
            "employment": "employment contract termination wrongful dismissal",
            "freelance": "independent contractor payment dispute services",
            "partnership": "partnership deed dissolution dispute",
            "sale": "sale agreement property dispute specific performance",
            "mou": "memorandum of understanding breach enforcement",
        }
        base_query = query_map.get(
            document_type.lower(),
            f"{document_type.replace('_', ' ')} contract dispute",
        )
        if context:
            base_query += f" {context}"

        return await self.search(base_query, court=court, max_results=5)


# ── Utilities ─────────────────────────────────────────────────────────────────

import re as _re

_HTML_TAG = _re.compile(r"<[^>]+>")
_WHITESPACE = _re.compile(r"\s+")


def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = _HTML_TAG.sub(" ", text)
    text = _WHITESPACE.sub(" ", text)
    return text.strip()
