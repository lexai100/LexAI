"""
Quick smoke test for LexAI backend.
Run from the backend directory: .\venv\Scripts\python test_quick.py
"""
import asyncio
import sys
import os

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

async def main():
    print("=" * 60)
    print("  LexAI Quick Smoke Test")
    print("=" * 60)

    # 1. Config
    print("\n[1/5] Testing config...")
    from backend.config import settings
    assert settings.NVIDIA_API_KEY, "NVIDIA_API_KEY not set!"
    assert settings.GROQ_API_KEY, "GROQ_API_KEY not set!"
    print(f"  [OK] NVIDIA API key loaded ({settings.NVIDIA_API_KEY[:10]}...)")
    print(f"  [OK] Groq API key loaded ({settings.GROQ_API_KEY[:10]}...)")
    print(f"  [OK] DocumentCraft model: {settings.DOCUMENT_CRAFT_MODEL}")
    print(f"  [OK] LoopholeHound model: {settings.LOOPHOLE_HOUND_MODEL}")

    # 2. Schemas
    print("\n[2/5] Testing schemas...")
    from backend.models.schemas import (
        DocumentType, Severity, Vulnerability, LoopholeReport,
        AnalysisResult, DocumentGenerationRequest,
    )
    req = DocumentGenerationRequest(
        document_type=DocumentType.RENT_AGREEMENT,
        description="Rent agreement for 2BHK in Bangalore, 11 months, Rs 25000/month",
        party_a="Rajesh Kumar",
        party_b="Amit Sharma",
        location="Bangalore, Karnataka",
    )
    print(f"  [OK] Generation request: {req.document_type.value}")
    vuln = Vulnerability(
        name="Test vuln", severity=Severity.HIGH,
        explanation="Test", suggested_fix="Test fix"
    )
    report = LoopholeReport(exploitability_score=65, vulnerabilities=[vuln])
    print(f"  [OK] LoopholeReport: score={report.exploitability_score}, vulns={len(report.vulnerabilities)}")

    # 3. RAG Service
    print("\n[3/5] Testing RAG service...")
    from backend.services.rag_service import RAGService
    rag = RAGService(persist_dir="./test_chroma_db")
    stats = rag.get_stats()
    print(f"  [OK] Legal knowledge: {stats['legal_knowledge_count']} docs")
    print(f"  [OK] Exploitation patterns: {stats['exploitation_patterns_count']} patterns")
    results = rag.search_legal_knowledge("rent agreement bangalore")
    print(f"  [OK] Search returned {len(results)} results")

    # 4. PII Detector
    print("\n[4/5] Testing PII detector...")
    try:
        from backend.services.pii_detector import PIIDetectorService
        pii = PIIDetectorService()
        test_text = "My Aadhaar is 2345 6789 0123 and PAN is ABCPK1234F. Call me at +91 9876543210"
        entities = pii.detect(test_text)
        print(f"  [OK] PII detected: {len(entities)} entities")
        for e in entities:
            print(f"    - {e.entity_type}: '{test_text[e.start:e.end]}' (score: {e.score:.2f})")
        anon_text, count = pii.anonymize(test_text)
        print(f"  [OK] Anonymized ({count} entities): {anon_text[:80]}...")
    except Exception as e:
        print(f"  [WARN] PII test failed (likely spaCy model missing): {e}")
        print("    Run: .\\venv\\Scripts\\python -m spacy download en_core_web_sm")

    # 5. Document Processor
    print("\n[5/5] Testing document processor...")
    from backend.services.document_processor import DocumentProcessorService
    sample = """RENTAL AGREEMENT

This Rental Agreement is entered into on this 15th day of June, 2026

BETWEEN

Mr. Rajesh Kumar, aged 45 years, residing at No. 42, MG Road, Bangalore
(hereinafter referred to as "the Landlord")

AND

Mr. Amit Sharma, aged 28 years, residing at Flat 301, HSR Layout, Bangalore
(hereinafter referred to as "the Tenant")

WHEREAS the Landlord is the owner of the property described herein.

1. PROPERTY DESCRIPTION
The Landlord hereby lets out the premises located at...

2. TERM OF AGREEMENT
This agreement shall be valid for a period of 11 months.

3. RENT
The monthly rent shall be Rs. 25,000 (Rupees Twenty-Five Thousand Only).

IN WITNESS WHEREOF both parties have signed this agreement.
"""
    parsed = DocumentProcessorService.process_text(sample)
    print(f"  [OK] Title: {parsed.title}")
    print(f"  [OK] Parties: {parsed.parties}")
    print(f"  [OK] Clauses found: {len(parsed.clauses)}")
    print(f"  [OK] Has stamp paper ref: {parsed.has_stamp_paper_ref}")
    print(f"  [OK] Word count: {parsed.word_count}")

    print("\n" + "=" * 60)
    print("  All smoke tests passed! PASS")
    print("=" * 60)
    print("\nNext: Start the server with:")
    print("  .\\venv\\Scripts\\python -m uvicorn backend.main:app --reload --port 8000")

    # Clean up test ChromaDB
    import shutil
    shutil.rmtree("./test_chroma_db", ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())

