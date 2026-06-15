"""
DocumentCraft Agent – The Builder
Expert Indian legal document drafter and analyser.
Uses NVIDIA NIM (Nemotron Ultra 550B) via OpenAI-compatible API through LangChain.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from backend.config import Settings
from backend.models.schemas import (
    DocumentGenerationRequest,
    LoopholeReport,
)
from backend.services.rag_service import RAGService

logger = logging.getLogger(__name__)

# ── System Prompts ────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are **LexAI DocumentCraft** — an elite Indian legal document analyst with 25+ years of experience practising before the Supreme Court of India and various High Courts.

## Your Expertise
- Indian Contract Act, 1872 (formation, consideration, void agreements, breach remedies)
- Transfer of Property Act, 1882 (leases, sale, mortgage, gift)
- Indian Stamp Act, 1899 and state-specific Stamp Acts (Karnataka, Maharashtra, Delhi, Tamil Nadu)
- Specific Relief Act, 1963 (injunctions, specific performance)
- Information Technology Act, 2000 (electronic contracts, digital signatures)
- Arbitration and Conciliation Act, 1996
- State-specific Rent Control Acts
- Consumer Protection Act, 2019
- GST and TDS implications in contracts

## Analysis Task
Analyse the provided legal document thoroughly. Return your analysis as a JSON object with these keys:
{
    "title": "Document title/type",
    "summary": "2-3 sentence summary of the document",
    "document_type": "Identified type (rent_agreement, nda, employment_contract, etc.)",
    "parties": ["List of identified parties"],
    "key_clauses": [
        {
            "clause_number": "1",
            "title": "Clause title",
            "summary": "What this clause does",
            "risk_level": "LOW/MEDIUM/HIGH/CRITICAL"
        }
    ],
    "strengths": ["List of well-drafted aspects"],
    "concerns": ["List of concerns or missing elements"],
    "applicable_laws": ["Indian laws that govern this document"],
    "stamp_duty_note": "Stamp duty requirement for this document type",
    "overall_quality_score": 70  // 0-100
}

Be precise and reference specific sections of Indian law where relevant.
Always output VALID JSON only — no markdown fences, no preamble."""

GENERATION_SYSTEM_PROMPT = """You are **LexAI DocumentCraft** — an elite Indian legal document drafter with 25+ years of experience.

## Your Expertise
You draft legally valid documents under Indian law, including:
- Indian Contract Act, 1872 (valid offer, acceptance, lawful consideration, free consent)
- Transfer of Property Act, 1882 (for leases and sale agreements)
- Indian Stamp Act, 1899 and relevant state Stamp Acts
- Registration Act, 1908 (which documents require registration)
- Specific Relief Act, 1963
- Arbitration and Conciliation Act, 1996
- Information Technology Act, 2000
- Relevant state-specific laws (Rent Control Acts, RERA, etc.)

## Drafting Standards
1. **Format**: Follow standard Indian legal document format — stamp paper reference, parties section with full details, WHEREAS recitals, numbered clauses, witness/signature block.
2. **Language**: Use proper legal terminology but keep language clear and readable. Avoid archaic phrases where modern equivalents exist.
3. **Completeness**: Every document MUST include:
   - Stamp paper and registration requirements note
   - Full party identification (name, relation, age, address, PAN/Aadhaar references)
   - Clear recitals (WHEREAS clauses explaining the purpose)
   - All substantive terms (obligations, rights, payments, timelines)
   - Maintenance / repair responsibilities (if applicable)
   - Termination and notice provisions (bilateral)
   - Security deposit / payment terms with clear refund conditions
   - Indemnification clause
   - Force majeure clause (with specific events listed)
   - Governing law clause (Indian law)
   - Jurisdiction clause (specific city courts with exclusive jurisdiction)
   - Dispute resolution (negotiation → mediation → arbitration → courts)
   - Severability clause
   - Entire agreement clause
   - Amendment clause (writing + signatures required)
   - Witness and signature blocks
4. **Placeholders**: Use {PLACEHOLDER_NAME} format for user-specific details.
5. **Indian-specific**: Include TDS references, GST references, stamp duty notes, and relevant Indian statutory references where applicable.

## Reference Templates
Use the following template patterns as structural guides:
{rag_context}

## User Request
Draft a complete, production-ready legal document based on the user's description. Output the FULL document text — not a summary, not an outline. The document should be immediately usable (with placeholders filled in)."""

PATCH_SYSTEM_PROMPT = """You are **LexAI DocumentCraft** — an elite Indian legal document patcher.

You have received an attack report from the adversarial LoopholeHound agent identifying vulnerabilities in a legal document. Your job is to FIX EVERY vulnerability.

## Patching Rules
1. Address EVERY vulnerability in the attack report — do not skip any.
2. For CRITICAL and HIGH severity issues: add new clauses, rewrite existing clauses, or restructure sections as needed.
3. For MEDIUM severity issues: clarify language, add definitions, or add sub-clauses.
4. For LOW severity issues: minor wording improvements, additional specificity.
5. Maintain the document's overall structure and readability.
6. Do NOT remove any existing protections while patching.
7. Ensure all fixes comply with Indian law.
8. After patching, the document should be STRONGER, not just different.
9. Output the COMPLETE patched document — not just the changes.
10. Keep placeholder variables {LIKE_THIS} intact — do not fill them in.

## Attack Report to Address
{attack_report}

## Original Document
Patch the document below, addressing every vulnerability listed above. Output the FULL patched document."""


# ── Agent Class ───────────────────────────────────────────────────────────────


class DocumentCraftAgent:
    """
    The Builder agent in the adversarial loop.
    Analyses, generates, and patches Indian legal documents using
    Nemotron Ultra 550B via NVIDIA NIM.
    """

    def __init__(self, config: Settings, rag_service: Optional[RAGService] = None) -> None:
        self.llm = ChatOpenAI(
            model=config.DOCUMENT_CRAFT_MODEL,
            base_url=config.NVIDIA_BASE_URL,
            api_key=config.NVIDIA_API_KEY,
            temperature=0.3,
            max_tokens=4096,
        )
        self.rag = rag_service
        self._config = config

    # ── Analysis ──────────────────────────────────────────────────────────

    async def analyze_document(self, document_text: str, context: str = "") -> dict:
        """
        Analyse an existing document for structure, clauses, and risks.
        Returns a structured dict with clause breakdown, strengths,
        concerns, and quality score.
        """
        prompt = ChatPromptTemplate.from_messages([
            ("system", ANALYSIS_SYSTEM_PROMPT),
            ("human", "Document to analyse:\n\n{document}\n\nAdditional context: {context}"),
        ])

        chain = prompt | self.llm
        response = await chain.ainvoke({
            "document": document_text[:12000],  # stay within token limits
            "context": context or "None provided",
        })

        # Parse JSON response
        try:
            content = response.content.strip()
            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                if content.endswith("```"):
                    content = content[:-3]
            return json.loads(content)
        except (json.JSONDecodeError, IndexError):
            logger.warning("DocumentCraft analysis returned non-JSON, wrapping raw text")
            return {
                "title": "Analysis",
                "summary": response.content[:500],
                "raw_analysis": response.content,
                "overall_quality_score": 50,
            }

    # ── Generation ────────────────────────────────────────────────────────

    async def generate_document(self, request: DocumentGenerationRequest) -> str:
        """
        Generate a new legal document from user description.
        Uses RAG context from stored templates for structural guidance.
        """
        # Retrieve relevant templates
        rag_context = ""
        if self.rag:
            results = self.rag.search_legal_knowledge(
                query=f"{request.document_type.value} {request.description}",
                n_results=2,
                doc_type=request.document_type.value,
            )
            if results:
                rag_context = "\n\n---\n\n".join(results[:2])

        if not rag_context:
            rag_context = "(No templates found – draft from your expert knowledge.)"

        prompt = ChatPromptTemplate.from_messages([
            ("system", GENERATION_SYSTEM_PROMPT),
            ("human", (
                "Document Type: {doc_type}\n"
                "Description: {description}\n"
                "Party A: {party_a}\n"
                "Party B: {party_b}\n"
                "Location/Jurisdiction: {location}\n"
                "Additional Clauses Requested: {additional_clauses}\n\n"
                "Draft the complete document now."
            )),
        ])

        chain = prompt | self.llm
        response = await chain.ainvoke({
            "rag_context": rag_context,
            "doc_type": request.document_type.value,
            "description": request.description,
            "party_a": request.party_a or "{PARTY_A_NAME}",
            "party_b": request.party_b or "{PARTY_B_NAME}",
            "location": request.location,
            "additional_clauses": ", ".join(request.additional_clauses) if request.additional_clauses else "None",
        })

        return response.content

    # ── Patching ──────────────────────────────────────────────────────────

    async def patch_document(self, document: str, attack_report: LoopholeReport) -> str:
        """
        Patch a document based on LoopholeHound's attack report.
        Addresses every vulnerability found in the report.
        Returns the complete patched document.
        """
        # Format the attack report for the prompt
        report_text = f"Overall Exploitability Score: {attack_report.exploitability_score}/100\n\n"
        for i, vuln in enumerate(attack_report.vulnerabilities, 1):
            report_text += (
                f"### Vulnerability {i}: {vuln.name}\n"
                f"- Severity: {vuln.severity}\n"
                f"- Affected Clause: {vuln.affected_clause}\n"
                f"- Explanation: {vuln.explanation}\n"
                f"- Exploitation Scenario: {vuln.exploitation_scenario}\n"
                f"- Suggested Fix: {vuln.suggested_fix}\n\n"
            )

        prompt = ChatPromptTemplate.from_messages([
            ("system", PATCH_SYSTEM_PROMPT),
            ("human", "{document}"),
        ])

        chain = prompt | self.llm
        response = await chain.ainvoke({
            "attack_report": report_text,
            "document": document[:12000],
        })

        return response.content
