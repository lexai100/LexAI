"""
LexAI Pydantic Schemas
All request/response models, enums, and data-transfer objects.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────


class DocumentType(str, Enum):
    """Supported Indian legal document types."""
    RENT_AGREEMENT = "rent_agreement"
    NDA = "nda"
    EMPLOYMENT = "employment_contract"
    PARTNERSHIP = "partnership_deed"
    FREELANCE = "freelance_contract"
    SALE = "sale_agreement"
    MOU = "memorandum_of_understanding"


class Severity(str, Enum):
    """Vulnerability severity levels."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class TaskStatus(str, Enum):
    """Background task lifecycle states."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ── Request Models ────────────────────────────────────────────────────────────


class DocumentAnalysisRequest(BaseModel):
    """Request to analyse an uploaded document (PDF bytes sent via multipart)."""
    text: Optional[str] = Field(None, description="Raw text if not uploading a PDF")
    context: str = Field("", description="Optional user context / instructions")
    anonymize_pii: bool = Field(True, description="Redact PII before sending to LLM")


class DocumentGenerationRequest(BaseModel):
    """Request to generate a brand-new legal document."""
    document_type: DocumentType
    description: str = Field(..., min_length=10, description="Plain-English description of the document")
    party_a: str = Field("", description="First party name / placeholder")
    party_b: str = Field("", description="Second party name / placeholder")
    location: str = Field("Bangalore, Karnataka", description="Jurisdiction / city")
    additional_clauses: list[str] = Field(default_factory=list, description="Extra clauses to include")
    run_adversarial: bool = Field(True, description="Run adversarial loop after generation")


# ── Vulnerability / Attack Models ─────────────────────────────────────────────


class Vulnerability(BaseModel):
    """A single vulnerability found by LoopholeHound."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    name: str
    affected_clause: str = ""
    severity: Severity = Severity.MEDIUM
    explanation: str = ""
    exploitation_scenario: str = ""
    suggested_fix: str = ""


class LoopholeReport(BaseModel):
    """Full attack report produced by LoopholeHound for one round."""
    exploitability_score: int = Field(0, ge=0, le=100, description="Overall exploitability 0-100")
    vulnerabilities: list[Vulnerability] = Field(default_factory=list)
    summary: str = ""
    raw_analysis: str = ""


# ── Adversarial Round ─────────────────────────────────────────────────────────


class AdversarialRound(BaseModel):
    """Data captured for a single attack-patch round."""
    round_number: int
    score: int = Field(0, ge=0, le=100)
    vulnerabilities_found: int = 0
    vulnerabilities: list[Vulnerability] = Field(default_factory=list)
    patches_applied: int = 0
    document_snapshot: str = ""


# ── Radar / Heat-map helpers ─────────────────────────────────────────────────


class RadarScores(BaseModel):
    """Radar-chart dimension scores (0-100, higher is better)."""
    completeness: int = 50
    clarity: int = 50
    enforceability: int = 50
    balance: int = 50
    risk_mitigation: int = 50
    compliance: int = 50


class HeatMapEntry(BaseModel):
    """Per-clause heat-map row."""
    clause: str
    risk_level: Severity = Severity.LOW
    score: int = 0  # 0-100 (0 = safe, 100 = critical)


# ── Final Analysis ────────────────────────────────────────────────────────────


class AnalysisResult(BaseModel):
    """Complete result returned after the adversarial loop finishes."""
    task_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    status: TaskStatus = TaskStatus.COMPLETED
    summary: str = ""
    risk_score: int = Field(0, ge=0, le=100)
    rounds: list[AdversarialRound] = Field(default_factory=list)
    heat_map: list[HeatMapEntry] = Field(default_factory=list)
    radar: RadarScores = Field(default_factory=RadarScores)
    final_document: str = ""
    original_document: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    pii_entities_found: int = 0


# ── Task wrapper (in-memory store) ───────────────────────────────────────────


class TaskRecord(BaseModel):
    """Wraps a long-running task stored in the in-memory task store."""
    task_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0  # 0-100
    current_round: int = 0
    result: Optional[AnalysisResult] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── STT ───────────────────────────────────────────────────────────────────────


class STTResponse(BaseModel):
    """Speech-to-text result."""
    text: str
    language: str = "en"
    duration_seconds: float = 0.0


# ── Template listing ─────────────────────────────────────────────────────────


class TemplateInfo(BaseModel):
    """Metadata for a document template shown in the UI."""
    document_type: DocumentType
    title: str
    description: str
    sample_fields: list[str] = Field(default_factory=list)
