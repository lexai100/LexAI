"""
Adversarial Loop Orchestrator
Coordinates the attack-patch cycle between LoopholeHound (attacker) and
DocumentCraft (builder) until the document reaches an acceptable
exploitability score or the maximum number of rounds is exhausted.
"""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Optional

from backend.agents.document_craft import DocumentCraftAgent
from backend.agents.loophole_hound import LoopholeHoundAgent
from backend.models.schemas import (
    AdversarialRound,
    AnalysisResult,
    DocumentGenerationRequest,
    HeatMapEntry,
    LoopholeReport,
    RadarScores,
    Severity,
    TaskStatus,
)

logger = logging.getLogger(__name__)

# Type alias for progress callback
ProgressCallback = Callable[[AdversarialRound], Awaitable[None]]


class AdversarialLoop:
    """
    Orchestrates the adversarial loop:
      1. LoopholeHound attacks the document
      2. DocumentCraft patches the vulnerabilities
      3. Repeat until score < threshold or max rounds reached
    """

    def __init__(
        self,
        document_craft: DocumentCraftAgent,
        loophole_hound: LoopholeHoundAgent,
        max_rounds: int = 3,
        threshold: int = 15,
    ) -> None:
        self.builder = document_craft
        self.attacker = loophole_hound
        self.max_rounds = max_rounds
        self.threshold = threshold

    # ── Main Entry Points ─────────────────────────────────────────────────

    async def run_on_document(
        self,
        document_text: str,
        callback: Optional[ProgressCallback] = None,
    ) -> AnalysisResult:
        """
        Run the adversarial loop on an existing document.
        """
        return await self._execute_loop(
            initial_document=document_text,
            callback=callback,
        )

    async def run_on_request(
        self,
        request: DocumentGenerationRequest,
        callback: Optional[ProgressCallback] = None,
    ) -> AnalysisResult:
        """
        Generate a document from a request, then run the adversarial loop.
        """
        logger.info("Generating initial document for type=%s", request.document_type)
        initial_doc = await self.builder.generate_document(request)

        if not request.run_adversarial:
            return AnalysisResult(
                status=TaskStatus.COMPLETED,
                summary="Document generated without adversarial analysis.",
                risk_score=0,
                final_document=initial_doc,
                original_document=initial_doc,
            )

        return await self._execute_loop(
            initial_document=initial_doc,
            callback=callback,
        )

    # ── Core Loop ─────────────────────────────────────────────────────────

    async def _execute_loop(
        self,
        initial_document: str,
        callback: Optional[ProgressCallback] = None,
    ) -> AnalysisResult:
        """
        The heart of the adversarial process.
        """
        rounds: list[AdversarialRound] = []
        current_doc = initial_document
        all_vulnerabilities: list[dict[str, Any]] = []
        last_report: Optional[LoopholeReport] = None

        for round_num in range(1, self.max_rounds + 1):
            logger.info("═══ Adversarial Round %d/%d ═══", round_num, self.max_rounds)

            # ── ATTACK PHASE ──────────────────────────────────────────
            logger.info("LoopholeHound attacking document...")
            attack_report = await self.attacker.attack_document(current_doc)
            last_report = attack_report

            logger.info(
                "Attack complete: score=%d, vulnerabilities=%d",
                attack_report.exploitability_score,
                len(attack_report.vulnerabilities),
            )

            # Record round data
            round_data = AdversarialRound(
                round_number=round_num,
                score=attack_report.exploitability_score,
                vulnerabilities_found=len(attack_report.vulnerabilities),
                vulnerabilities=attack_report.vulnerabilities,
                patches_applied=0,
                document_snapshot=current_doc[:500] + "...",  # truncated for storage
            )

            # Track all vulnerabilities across rounds
            for v in attack_report.vulnerabilities:
                all_vulnerabilities.append({
                    "round": round_num,
                    "name": v.name,
                    "severity": v.severity,
                    "clause": v.affected_clause,
                })

            # ── CHECK THRESHOLD ───────────────────────────────────────
            if attack_report.exploitability_score < self.threshold:
                logger.info(
                    "Score %d < threshold %d — document is safe! Stopping.",
                    attack_report.exploitability_score,
                    self.threshold,
                )
                rounds.append(round_data)
                if callback:
                    await callback(round_data)
                break

            # ── PATCH PHASE ───────────────────────────────────────────
            if round_num < self.max_rounds:
                logger.info(
                    "DocumentCraft patching %d vulnerabilities...",
                    len(attack_report.vulnerabilities),
                )
                patched_doc = await self.builder.patch_document(
                    current_doc, attack_report,
                )
                round_data.patches_applied = len(attack_report.vulnerabilities)
                current_doc = patched_doc
                logger.info("Patch complete.")
            else:
                # Final round — still patch, user gets the best possible doc
                logger.info("Final round — applying last patches...")
                patched_doc = await self.builder.patch_document(
                    current_doc, attack_report,
                )
                round_data.patches_applied = len(attack_report.vulnerabilities)
                current_doc = patched_doc

            rounds.append(round_data)
            if callback:
                await callback(round_data)

        # ── Build final result ────────────────────────────────────────────
        final_score = rounds[-1].score if rounds else 50
        heat_map = self._build_heat_map(all_vulnerabilities)
        radar = self._calculate_radar(rounds, final_score)

        summary = self._generate_summary(rounds, final_score)

        return AnalysisResult(
            status=TaskStatus.COMPLETED,
            summary=summary,
            risk_score=final_score,
            rounds=rounds,
            heat_map=heat_map,
            radar=radar,
            final_document=current_doc,
            original_document=initial_document,
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _build_heat_map(all_vulns: list[dict[str, Any]]) -> list[HeatMapEntry]:
        """Build a per-clause heat map from all vulnerabilities found across rounds."""
        clause_map: dict[str, list[str]] = {}
        for v in all_vulns:
            clause = v.get("clause", "General")
            severity = v.get("severity", Severity.LOW)
            if isinstance(severity, Severity):
                severity = severity.value
            clause_map.setdefault(clause, []).append(severity)

        severity_scores = {"CRITICAL": 100, "HIGH": 75, "MEDIUM": 50, "LOW": 25}
        heat_map: list[HeatMapEntry] = []
        for clause, severities in clause_map.items():
            max_sev = max(severities, key=lambda s: severity_scores.get(s, 0))
            score = severity_scores.get(max_sev, 25)
            try:
                risk_level = Severity(max_sev)
            except ValueError:
                risk_level = Severity.LOW
            heat_map.append(HeatMapEntry(
                clause=clause,
                risk_level=risk_level,
                score=score,
            ))

        return sorted(heat_map, key=lambda h: h.score, reverse=True)

    @staticmethod
    def _calculate_radar(rounds: list[AdversarialRound], final_score: int) -> RadarScores:
        """
        Calculate radar-chart scores based on adversarial loop results.
        Higher = better (safer).
        """
        safety = max(0, 100 - final_score)

        if not rounds:
            return RadarScores()

        # Improvement ratio across rounds
        first_score = rounds[0].score
        improvement = max(0, first_score - final_score)

        # Count vulnerability categories
        all_vulns = []
        for r in rounds:
            all_vulns.extend(r.vulnerabilities)

        critical_count = sum(1 for v in all_vulns if v.severity == Severity.CRITICAL)
        high_count = sum(1 for v in all_vulns if v.severity == Severity.HIGH)

        return RadarScores(
            completeness=min(100, safety + 10),
            clarity=min(100, max(30, 100 - high_count * 10)),
            enforceability=min(100, max(20, safety + improvement // 2)),
            balance=min(100, max(20, 100 - critical_count * 20)),
            risk_mitigation=min(100, max(20, safety + improvement)),
            compliance=min(100, max(30, 100 - (critical_count + high_count) * 8)),
        )

    @staticmethod
    def _generate_summary(rounds: list[AdversarialRound], final_score: int) -> str:
        """Generate a human-readable summary of the adversarial process."""
        if not rounds:
            return "No adversarial analysis was performed."

        total_vulns = sum(r.vulnerabilities_found for r in rounds)
        total_patches = sum(r.patches_applied for r in rounds)
        first_score = rounds[0].score
        improvement = first_score - final_score

        risk_level = (
            "LOW" if final_score < 15
            else "MODERATE" if final_score < 30
            else "ELEVATED" if final_score < 50
            else "HIGH" if final_score < 70
            else "CRITICAL"
        )

        summary_parts = [
            f"Adversarial analysis completed in {len(rounds)} round(s).",
            f"Initial exploitability score: {first_score}/100.",
            f"Final exploitability score: {final_score}/100 ({risk_level} risk).",
        ]

        if improvement > 0:
            summary_parts.append(
                f"Score improved by {improvement} points through {total_patches} patches."
            )

        summary_parts.append(
            f"Total vulnerabilities identified: {total_vulns}."
        )

        if final_score < 15:
            summary_parts.append(
                "✅ Document meets the safety threshold and is recommended for use."
            )
        elif final_score < 30:
            summary_parts.append(
                "⚠️ Document has minor issues. Review flagged items before signing."
            )
        else:
            summary_parts.append(
                "🚨 Document has significant vulnerabilities. Professional legal review is strongly recommended."
            )

        return " ".join(summary_parts)
