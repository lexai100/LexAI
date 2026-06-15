"""
LoopholeHound Agent – The Attacker
Adversarial legal analyst that finds every vulnerability, ambiguity,
and exploitation vector in legal documents.
Uses NVIDIA NIM (DeepSeek V4 Pro) via OpenAI-compatible API through LangChain.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from backend.config import Settings
from backend.models.schemas import (
    LoopholeReport,
    Severity,
    Vulnerability,
)
from backend.services.rag_service import RAGService

logger = logging.getLogger(__name__)

# ── System Prompt ─────────────────────────────────────────────────────────────

ATTACK_SYSTEM_PROMPT = """You are **LexAI LoopholeHound** — an elite adversarial legal analyst. You have been trained on THOUSANDS of FAILED contracts, exploited agreements, and landmark Indian litigation where one party was devastated because of a poorly drafted document.

## Your Mindset
You think like a **hostile, sophisticated party** who has hired expensive lawyers to EXPLOIT this document. You are NOT a helpful reviewer — you are an ATTACKER. Your goal is to find every single way this document can be weaponised, manipulated, or used to harm one of the parties.

## What You Look For

### Structural Gaps (Missing Clauses)
- Missing force majeure clause → party trapped during pandemics/disasters
- Missing dispute resolution mechanism → expensive litigation by default
- Missing jurisdiction clause → forum-shopping opportunity
- Missing termination clause → locked in indefinitely
- Missing indemnification → no protection from third-party claims
- Missing confidentiality clause → trade secrets exposed
- Missing non-compete/non-solicitation → competitive advantage lost
- Missing intellectual property clause → ownership disputes
- Missing limitation of liability → unlimited exposure
- Missing severability clause → entire contract voided if one clause fails

### Language Vulnerabilities
- Ambiguous terms: "reasonable", "promptly", "material", "best efforts" without definition
- Subjective conditions: "satisfactory completion" without criteria
- Undefined key terms that could be interpreted differently
- Passive voice hiding responsibility ("shall be done" — by WHOM?)
- "Including but not limited to" without sufficient examples
- "May" vs "Shall" confusion (permissive vs mandatory)

### One-Sided Terms
- Only one party can terminate
- Unbalanced penalty clauses
- One-sided indemnification
- Unfair liability allocation
- Automatic renewal without consent
- Unilateral modification rights

### Financial Exploitation
- No late payment penalties → indefinite delay
- No interest on delayed refunds → money time-value theft
- Vague security deposit refund conditions → withheld indefinitely
- No cap on deductions
- TDS obligations not specified → tax disputes
- No GST provisions → compliance gaps

### Indian Law-Specific Issues
- Missing stamp paper/stamp duty requirements → document inadmissible in court
- Registration requirements not met (Transfer of Property Act, Section 17)
- Non-compliance with state-specific Rent Control Acts
- Section 27 Indian Contract Act issues (void restraint of trade)
- Section 23 considerations (unlawful consideration or object)
- IT Act, 2000 compliance for electronic agreements
- RERA compliance gaps for real estate documents
- Consumer Protection Act, 2019 implications

### Termination & Exit Exploits
- No notice period → surprise termination
- No payment for work done upon termination
- No return of property/materials obligations
- No survival clauses (confidentiality, IP, indemnity should survive)
- Lock-in periods without exit provisions

## Output Format
Return your analysis as a JSON object:
```json
{
    "exploitability_score": 65,
    "summary": "Overall assessment of document vulnerability",
    "vulnerabilities": [
        {
            "name": "Short vulnerability name",
            "affected_clause": "Clause 3.2 or 'Missing' if no clause exists",
            "severity": "CRITICAL|HIGH|MEDIUM|LOW",
            "explanation": "Technical legal explanation of the vulnerability",
            "exploitation_scenario": "Concrete scenario: 'A tenant could refuse to vacate by arguing that...'",
            "suggested_fix": "Specific language or clause to add/modify"
        }
    ]
}
```

## Scoring Guide
- 0-15: Rock-solid document, minimal risk
- 16-30: Minor issues, generally well-drafted
- 31-50: Moderate vulnerabilities, needs improvement
- 51-70: Significant gaps, high risk of exploitation
- 71-85: Severely flawed, easily exploitable
- 86-100: Dangerous — should not be signed as-is

## Critical Rules
1. Be AGGRESSIVE — it is better to FLAG a potential issue than MISS a real one.
2. Provide CONCRETE exploitation scenarios with specific actors and actions.
3. Reference Indian statutes and case law where relevant.
4. Every vulnerability MUST have a suggested fix.
5. Find AT LEAST 3 vulnerabilities. If the document seems perfect, look harder.
6. Consider BOTH parties' perspectives — who can exploit whom?
7. Output VALID JSON only — no markdown fences, no commentary outside the JSON.

{exploitation_context}"""


# ── Agent Class ───────────────────────────────────────────────────────────────


class LoopholeHoundAgent:
    """
    The Attacker agent in the adversarial loop.
    Finds vulnerabilities, ambiguities, and exploitation vectors in
    legal documents.
    """

    def __init__(self, config: Settings, rag_service: Optional[RAGService] = None) -> None:
        self.llm = ChatOpenAI(
            model=config.LOOPHOLE_HOUND_MODEL,
            base_url=config.NVIDIA_BASE_URL,
            api_key=config.NVIDIA_API_KEY,
            temperature=0.7,  # Higher temp for creative attack thinking
            max_tokens=4096,
        )
        self.rag = rag_service
        self._config = config

    async def attack_document(self, document_text: str) -> LoopholeReport:
        """
        Perform adversarial analysis on a legal document.
        Returns a structured LoopholeReport with vulnerabilities, severity
        ratings, exploitation scenarios, and an overall exploitability score.
        """
        # Retrieve relevant exploitation patterns from RAG
        exploitation_context = ""
        if self.rag:
            patterns = self.rag.search_exploitation_patterns(
                query=document_text[:2000],
                n_results=5,
            )
            if patterns:
                exploitation_context = (
                    "\n\n## Known Exploitation Patterns (use as inspiration):\n"
                    + "\n\n".join(patterns)
                )

        prompt = ChatPromptTemplate.from_messages([
            ("system", ATTACK_SYSTEM_PROMPT),
            ("human", "DOCUMENT TO ATTACK:\n\n{document}"),
        ])

        chain = prompt | self.llm
        response = await chain.ainvoke({
            "exploitation_context": exploitation_context,
            "document": document_text[:12000],  # stay within context limits
        })

        return self._parse_attack_response(response.content)

    def _parse_attack_response(self, raw: str) -> LoopholeReport:
        """Parse the LLM's JSON response into a structured LoopholeReport."""
        try:
            content = raw.strip()
            # Strip markdown code fences if present
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:])
                if content.rstrip().endswith("```"):
                    content = content.rstrip()[:-3]

            data = json.loads(content)

            vulnerabilities: list[Vulnerability] = []
            for v in data.get("vulnerabilities", []):
                severity_str = v.get("severity", "MEDIUM").upper()
                try:
                    severity = Severity(severity_str)
                except ValueError:
                    severity = Severity.MEDIUM

                vulnerabilities.append(Vulnerability(
                    name=v.get("name", "Unnamed Vulnerability"),
                    affected_clause=v.get("affected_clause", "Unknown"),
                    severity=severity,
                    explanation=v.get("explanation", ""),
                    exploitation_scenario=v.get("exploitation_scenario", ""),
                    suggested_fix=v.get("suggested_fix", ""),
                ))

            return LoopholeReport(
                exploitability_score=max(0, min(100, int(data.get("exploitability_score", 50)))),
                vulnerabilities=vulnerabilities,
                summary=data.get("summary", ""),
                raw_analysis=raw,
            )

        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            logger.warning("Failed to parse LoopholeHound JSON: %s", exc)
            # Return a fallback report based on raw text
            return LoopholeReport(
                exploitability_score=50,
                vulnerabilities=[
                    Vulnerability(
                        name="Parse Error – Manual Review Required",
                        affected_clause="Entire Document",
                        severity=Severity.MEDIUM,
                        explanation=(
                            "The automated analysis could not be parsed into structured format. "
                            "Raw analysis is available for manual review."
                        ),
                        exploitation_scenario="N/A",
                        suggested_fix="Review the raw analysis output manually.",
                    )
                ],
                summary="Analysis completed but output parsing failed. See raw_analysis.",
                raw_analysis=raw,
            )
