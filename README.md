# LexAI — Adversarial Legal Intelligence Platform ⚖️🛡️

LexAI is a cutting-edge legal tech platform that uses a **GAN-inspired adversarial AI architecture** to generate, analyze, and mathematically harden Indian legal documents. 

Instead of relying on a single AI to draft a contract, LexAI pits two specialized AI agents against each other in a continuous loop until the document is virtually bulletproof.

![LexAI Concept](https://img.shields.io/badge/Status-Hackathon_Ready-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js_|_FastAPI_|_DeepSeek_V4-blue?style=for-the-badge)

---

## 🧠 The Adversarial Architecture (How It Works)

LexAI operates on a continuous feedback loop between two specialized agents:

1. **DocumentCraft (The Builder) 🏗️**
   - Trained on legitimate legal templates and successful agreements.
   - **Goal:** Draft legally sound contracts and patch vulnerabilities.
2. **LoopholeHound (The Attacker) 🐺**
   - Trained specifically on documents that *failed* (loopholes, disputes, fraud).
   - **Goal:** Aggressively attack the document, finding edge cases, missing clauses, and exploitation scenarios.

### The Loop
1. User uploads a document OR requests a new one to be generated.
2. **LoopholeHound** attacks the document and generates a vulnerability report with an "Exploitability Score".
3. **DocumentCraft** reads the report and rewrites the document to patch the vulnerabilities.
4. This cycle repeats (up to 3 rounds) until the Exploitability Score drops below a safe threshold.
5. The final document is presented to the user alongside a detailed compliance radar and battle log.

---

## ✨ Features

- **Upload or Generate:** Drop an existing PDF/Word file to harden it, or describe what you need (e.g., "11-month rental agreement in Bangalore") to generate one from scratch.
- **Real-Time Battle Log:** Watch the agents fight in real-time via WebSockets. See vulnerabilities being found and patched round-by-round.
- **Indian Legal Context:** Pre-configured with knowledge of the Indian Contract Act 1872, Transfer of Property Act, and regional templates.
- **PII Anonymization:** Integrated with Microsoft Presidio. Automatically detects and redacts Aadhaar, PAN, IFSC, and Indian phone numbers before sending data to the LLM.
- **Compliance Radar:** Visual breakdown of the document's Completeness, Clarity, Enforceability, Fairness, and Risk Mitigation.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router), React
- **Styling:** Tailwind CSS (Premium Dark Theme, Glassmorphism, CSS Animations)
- **Real-time:** Native WebSockets

### Backend
- **Framework:** FastAPI, Python 3.11
- **AI/LLM Orchestration:** LangChain (LangChain Core)
- **Models:** DeepSeek V4 Pro & DeepSeek V4 Flash (via NVIDIA NIM)
- **Vector Database (RAG):** ChromaDB (Local persistent storage with ONNX embeddings)
- **Document Processing:** PyMuPDF (fitz)
- **Data Security:** Microsoft Presidio (PII detection), Cryptography (Fernet symmetric encryption)
---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.11+)
- NVIDIA NIM API Key (for DeepSeek models)

### 1. Backend Setup

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model (required for PII detection)
python -m spacy download en_core_web_sm

# Set up environment variables
cp .env.example .env
# Edit .env and add your NVIDIA_API_KEY

# Start the FastAPI server
python -m uvicorn backend.main:app --reload --port 8000
```
*The backend will be available at `http://localhost:8000`.*

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the Next.js development server
npm run dev
```
*The frontend will be available at `http://localhost:3000`.*

---

## 🧪 Running Smoke Tests

To verify that the backend is configured correctly (API keys, RAG DB, PII detectors), run the included smoke test script:

```bash
cd backend
.\venv\Scripts\python test_quick.py
```
This tests the configuration, Pydantic schemas, RAG vector retrieval, and PII anonymization pipelines.

---

## 🏆 Built For
This project was designed for the AI & Automation track of a competitive hackathon. It prioritizes data privacy (PII masking), adversarial robustness, and a highly polished user experience.
