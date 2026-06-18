"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  analyzeDocument,
  generateDocument,
  connectWebSocket,
  getTemplates,
  downloadDocument,
  searchKanoonForType,
  type AnalysisResult,
  type AdversarialRound,
  type WSMessage,
  type TemplateInfo,
  type Vulnerability,
  type KanoonResult,
} from "@/lib/api";
import VoiceInterface from "@/components/VoiceInterface";
import ComplianceRadar from "@/components/ComplianceRadar";
import LoopholeNetwork from "@/components/LoopholeNetwork";
import { generatePDF } from "@/lib/generatePDF";

// ── Icons (inline SVG to avoid deps) ────────────────────────────────────

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SwordIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </svg>
  );
}

function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
    </svg>
  );
}

function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── Severity color helper ───────────────────────────────────────────────

function getSeverityClass(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "severity-critical";
    case "HIGH": return "severity-high";
    case "MEDIUM": return "severity-medium";
    case "LOW": return "severity-low";
    default: return "severity-medium";
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

// ── Main Page Component ─────────────────────────────────────────────────

export default function Home() {
  // Mode
  const [mode, setMode] = useState<"analyze" | "generate">("analyze");

  // Analyze state
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Generate state
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedType, setSelectedType] = useState("RENT_AGREEMENT");
  const [description, setDescription] = useState("");
  const [partyA, setPartyA] = useState("");
  const [partyB, setPartyB] = useState("");
  const [location, setLocation] = useState("");

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [rounds, setRounds] = useState<AdversarialRound[]>([]);
  const [statusText, setStatusText] = useState("");

  // Results
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"overview" | "vulns" | "document" | "rounds" | "caselaw">("overview");

  // Case law
  const [kanoonResults, setKanoonResults] = useState<KanoonResult[]>([]);
  const [kanoonLoading, setKanoonLoading] = useState(false);
  const [kanoonCourt, setKanoonCourt] = useState("");

  // Voice readback text (speaks the summary after analysis)
  const [ttsText, setTtsText] = useState<string | undefined>(undefined);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load templates on mount
  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  // ── WebSocket handler ───────────────────────────────────────────────

  const handleWSMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "round_update":
        setProgress(msg.progress);
        setCurrentRound(msg.round.round_number);
        setRounds((prev) => [...prev, msg.round]);
        setStatusText(
          `Round ${msg.round.round_number}: Found ${msg.round.vulnerabilities_found} vulnerabilities (Score: ${msg.round.score})`
        );
        break;
      case "completed":
        setResult(msg.result);
        setIsProcessing(false);
        setProgress(100);
        setStatusText("Analysis complete!");
        // Speak a brief summary aloud
        setTtsText(
          `Analysis complete. Final risk score: ${msg.result.risk_score} out of 100. ` +
          (msg.result.risk_score < 15
            ? "The document meets the safety threshold."
            : msg.result.risk_score < 40
            ? "Minor issues were found. Review the vulnerabilities."
            : "Significant vulnerabilities remain. Legal review is recommended.")
        );
        // Auto-fetch case law
        fetchCaseLaw("legal document");
        break;
      case "error":
        const rawErr: string = msg.error ?? "Unknown error";
        // Humanize common API errors
        const friendlyErr = rawErr.includes("429") || rawErr.toLowerCase().includes("too many requests")
          ? "⚡ The AI API is rate-limited (too many simultaneous requests). The system will auto-retry — please wait 30–60 seconds and try again."
          : rawErr.includes("timeout") || rawErr.includes("timed out")
          ? "⏱️ The analysis timed out. The document may be too long — try a shorter excerpt."
          : rawErr.length > 200
          ? rawErr.slice(0, 200) + "…"
          : rawErr;
        setError(friendlyErr);
        setIsProcessing(false);
        setStatusText("Error occurred");
        break;
    }
  }, []);

  // ── Voice transcript handler ────────────────────────────────────────

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (mode === "analyze") {
        setTextInput((prev) => (prev ? `${prev}\n${text}` : text));
      } else {
        setDescription((prev) => (prev ? `${prev} ${text}` : text));
      }
    },
    [mode]
  );

  // ── Case law fetch ──────────────────────────────────────────────────

  const fetchCaseLaw = useCallback(
    async (documentType: string, court: string = kanoonCourt) => {
      setKanoonLoading(true);
      try {
        const res = await searchKanoonForType(
          documentType.toLowerCase(),
          court,
        );
        setKanoonResults(res.results);
      } catch {
        setKanoonResults([]);
      } finally {
        setKanoonLoading(false);
      }
    },
    [kanoonCourt]
  );

  // ── Submit handlers ─────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!file && !textInput.trim()) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentRound(0);
    setRounds([]);
    setResult(null);
    setError(null);
    setStatusText("Starting adversarial analysis...");

    try {
      const { task_id } = await analyzeDocument(file || undefined, textInput || undefined);
      wsRef.current = connectWebSocket(task_id, handleWSMessage, () => {
        setError("Connection lost. Please try again.");
        setIsProcessing(false);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      setIsProcessing(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentRound(0);
    setRounds([]);
    setResult(null);
    setError(null);
    setStatusText("Generating document...");

    try {
      const { task_id } = await generateDocument({
        document_type: selectedType,
        description,
        party_a: partyA || undefined,
        party_b: partyB || undefined,
        location: location || undefined,
        run_adversarial: true,
      });
      wsRef.current = connectWebSocket(task_id, handleWSMessage, () => {
        setError("Connection lost. Please try again.");
        setIsProcessing(false);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start generation");
      setIsProcessing(false);
    }
  };

  // ── File drop handlers ──────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleDownload = async () => {
    if (!result?.task_id) return;
    try {
      const text = await downloadDocument(result.task_id);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lexai_hardened_${result.task_id.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen relative">
      {/* ── Hero / Navbar ──────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-lexai-border)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldIcon className="w-8 h-8 text-[var(--color-lexai-accent)]" />
            <SwordIcon className="w-4 h-4 text-[var(--color-lexai-warning)] absolute -bottom-1 -right-1" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-[var(--font-heading)] tracking-tight">
              Lex<span className="text-[var(--color-lexai-accent)]">AI</span>
            </h1>
            <p className="text-xs text-[var(--color-lexai-text-muted)]">
              Adversarial Legal Intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--color-lexai-success)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-lexai-success)] animate-pulse" />
            Backend Connected
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Mode Tabs ─────────────────────────────────────────────── */}
        {!isProcessing && !result && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold font-[var(--font-heading)] mb-3">
                <span className="bg-gradient-to-r from-[var(--color-lexai-accent)] to-purple-400 bg-clip-text text-transparent">
                  Adversarial Document Hardening
                </span>
              </h2>
              <p className="text-[var(--color-lexai-text-muted)] text-lg max-w-2xl mx-auto">
                Two AI agents battle each other — one builds, one attacks — to make your legal documents bulletproof.
              </p>
            </div>

            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setMode("analyze")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  mode === "analyze"
                    ? "bg-[var(--color-lexai-accent)] text-white shadow-lg shadow-indigo-500/20"
                    : "bg-[var(--color-lexai-surface-2)] text-[var(--color-lexai-text-muted)] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <UploadIcon className="w-5 h-5" />
                  Analyze Document
                </span>
              </button>
              <button
                onClick={() => setMode("generate")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  mode === "generate"
                    ? "bg-[var(--color-lexai-accent)] text-white shadow-lg shadow-indigo-500/20"
                    : "bg-[var(--color-lexai-surface-2)] text-[var(--color-lexai-text-muted)] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <SparkleIcon className="w-5 h-5" />
                  Generate Document
                </span>
              </button>
            </div>

            {/* ── Analyze Mode ─────────────────────────────────────── */}
            {mode === "analyze" && (
              <div className="glass-card p-8">
                <div
                  className={`drop-zone mb-6 ${isDragging ? "active" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <UploadIcon className="w-12 h-12 text-[var(--color-lexai-accent)] mx-auto mb-4" />
                  {file ? (
                    <div>
                      <p className="text-lg font-semibold">{file.name}</p>
                      <p className="text-sm text-[var(--color-lexai-text-muted)]">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold mb-1">
                        Drop your document here
                      </p>
                      <p className="text-sm text-[var(--color-lexai-text-muted)]">
                        PDF, TXT, or DOCX — or click to browse
                      </p>
                    </div>
                  )}
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--color-lexai-border)]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[var(--color-lexai-surface)] px-4 text-sm text-[var(--color-lexai-text-muted)]">
                      or paste text
                    </span>
                  </div>
                </div>

                <textarea
                  className="lexai-textarea mb-4"
                  placeholder="Paste your legal document text here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={8}
                />

                {/* Voice input for analyze mode */}
                <div className="mb-6">
                  <p className="text-xs text-[var(--color-lexai-text-muted)] uppercase tracking-wider mb-2">🎙️ Or speak your document / query</p>
                  <VoiceInterface
                    onTranscript={handleVoiceTranscript}
                    textToSpeak={ttsText}
                    placeholder="Speak your document text or describe what you need…"
                  />
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!file && !textInput.trim()}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ShieldIcon className="w-5 h-5" />
                    Start Adversarial Analysis
                  </span>
                </button>
              </div>
            )}

            {/* ── Generate Mode ────────────────────────────────────── */}
            {mode === "generate" && (
              <div className="glass-card p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-[var(--color-lexai-text-muted)]">
                      Document Type
                    </label>
                    <select
                      className="lexai-input"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                    >
                      {templates.length > 0
                        ? templates.map((t) => (
                            <option key={t.document_type} value={t.document_type}>
                              {t.title}
                            </option>
                          ))
                        : (
                            <>
                              <option value="RENT_AGREEMENT">Rental Agreement (11-month)</option>
                              <option value="NDA">Non-Disclosure Agreement</option>
                              <option value="EMPLOYMENT">Employment Contract</option>
                              <option value="FREELANCE">Freelance Contract</option>
                              <option value="PARTNERSHIP">Partnership Deed</option>
                              <option value="SALE">Sale Agreement</option>
                              <option value="MOU">Memorandum of Understanding</option>
                            </>
                          )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-[var(--color-lexai-text-muted)]">
                      Location / Jurisdiction
                    </label>
                    <input
                      className="lexai-input"
                      placeholder="e.g. Bangalore, Karnataka"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-[var(--color-lexai-text-muted)]">
                      Party A (First Party)
                    </label>
                    <input
                      className="lexai-input"
                      placeholder="e.g. Rajesh Kumar"
                      value={partyA}
                      onChange={(e) => setPartyA(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-[var(--color-lexai-text-muted)]">
                      Party B (Second Party)
                    </label>
                    <input
                      className="lexai-input"
                      placeholder="e.g. Amit Sharma"
                      value={partyB}
                      onChange={(e) => setPartyB(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2 text-[var(--color-lexai-text-muted)]">
                    Describe what you need
                  </label>
                  <textarea
                    className="lexai-textarea"
                    placeholder="e.g. 11-month rent agreement for a 2BHK flat in HSR Layout, Bangalore. Monthly rent ₹25,000, security deposit ₹75,000. Tenant is a software engineer working from home..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!description.trim()}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    <SparkleIcon className="w-5 h-5" />
                    Generate & Harden Document
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Processing View ──────────────────────────────────────── */}
        {isProcessing && (
          <div className="glass-card p-12 text-center animate-slide-up">
            <div className="relative w-32 h-32 mx-auto mb-8">
              {/* Shield */}
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldIcon className="w-16 h-16 text-[var(--color-lexai-accent)]" />
              </div>
              {/* Rotating ring */}
              <div className="absolute inset-0 border-2 border-t-[var(--color-lexai-accent)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin-slow" />
              {/* Pulse */}
              <div className="absolute inset-0 border-2 border-[var(--color-lexai-accent)] rounded-full animate-pulse-ring opacity-30" />
            </div>

            <h3 className="text-2xl font-bold mb-2 font-[var(--font-heading)]">
              {currentRound > 0 ? (
                <>
                  Adversarial Round{" "}
                  <span className="text-[var(--color-lexai-accent)]">{currentRound}</span> / 3
                </>
              ) : (
                "Initializing Analysis..."
              )}
            </h3>
            <p className="text-[var(--color-lexai-text-muted)] mb-6">{statusText}</p>

            {/* Progress bar */}
            <div className="max-w-md mx-auto mb-8">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-[var(--color-lexai-text-muted)] mt-2">
                {progress}% complete
              </p>
            </div>

            {/* Round cards */}
            {rounds.length > 0 && (
              <div className="flex flex-col gap-4 max-w-lg mx-auto">
                {rounds.map((round) => (
                  <div
                    key={round.round_number}
                    className="glass-card p-4 flex items-center justify-between animate-slide-up"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-lexai-surface-2)] flex items-center justify-center font-bold text-[var(--color-lexai-accent)]">
                        {round.round_number}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">Round {round.round_number}</p>
                        <p className="text-xs text-[var(--color-lexai-text-muted)]">
                          {round.vulnerabilities_found} vulnerabilities found
                        </p>
                      </div>
                    </div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: getScoreColor(round.score) }}
                    >
                      {round.score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <div className="glass-card p-6 border-[var(--color-lexai-danger)] bg-red-500/5 mb-6">
            <p className="text-[var(--color-lexai-danger)] font-semibold text-lg">Analysis Failed</p>
            <p className="text-sm text-[var(--color-lexai-text-muted)] mt-2 leading-relaxed">{error}</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setError(null);
                  setResult(null);
                  setIsProcessing(false);
                }}
                className="btn-secondary"
              >
                ← Try Again
              </button>
              {error?.includes("rate-limited") && (
                <p className="text-xs text-[var(--color-lexai-text-muted)] self-center">
                  Tip: Wait ~30s before retrying to avoid simultaneous API calls.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Results View ──────────────────────────────────────────── */}
        {result && !isProcessing && (
          <div className="animate-slide-up">
            {/* Score hero */}
            <div className="glass-card p-8 mb-6 text-center glow-accent">
              <div className="flex items-center justify-center gap-8 mb-6">
                {/* Initial score */}
                <div className="text-center">
                  <p className="text-sm text-[var(--color-lexai-text-muted)] mb-2">Initial Risk</p>
                  <div
                    className="text-4xl font-extrabold"
                 style={{ color: getScoreColor(result.rounds[0]?.score ?? result.risk_score) }}
                  >
                    {result.rounds[0]?.score ?? result.risk_score}
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-3xl text-[var(--color-lexai-accent)]">→</div>

                {/* Final score */}
                <div className="text-center">
                  <p className="text-sm text-[var(--color-lexai-text-muted)] mb-2">Final Risk</p>
                  <div
                    className="text-5xl font-extrabold"
                    style={{ color: getScoreColor(result.risk_score) }}
                  >
                    {result.risk_score}
                  </div>
                </div>
              </div>

              <p className="text-lg text-[var(--color-lexai-text-muted)]">
                Hardened through{" "}
                <span className="text-white font-bold">{result.rounds.length}</span>{" "}
                adversarial rounds
              </p>
              {result.pii_entities_found > 0 && (
                <p className="text-sm text-[var(--color-lexai-info)] mt-2">
                  🔒 {result.pii_entities_found} PII entities detected & protected
                </p>
              )}
            </div>

            {/* Result tabs */}
            <div className="flex gap-2 mb-6 border-b border-[var(--color-lexai-border)] pb-1 flex-wrap">
              {(["overview", "vulns", "document", "rounds", "caselaw"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`result-tab-${tab}`}
                  onClick={() => {
                    setActiveResultTab(tab);
                    // Lazy-load case law when tab is opened
                    if (tab === "caselaw" && kanoonResults.length === 0) {
                      fetchCaseLaw("shareholders agreement");
                    }
                  }}
                  className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                    activeResultTab === tab
                      ? "text-[var(--color-lexai-accent)] bg-[var(--color-lexai-surface-2)]"
                      : "text-[var(--color-lexai-text-muted)] hover:text-white"
                  }`}
                >
                  {tab === "overview" && "Overview"}
                  {tab === "vulns" && `Vulnerabilities`}
                  {tab === "document" && "Final Document"}
                  {tab === "rounds" && "Battle Log"}
                  {tab === "caselaw" && "⚖️ Case Law"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="glass-card p-6">
              {activeResultTab === "overview" && (
                <div>
                {/* ── Point-wise Analysis Summary ── */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      📋 Analysis Summary
                    </h3>
                    {(() => {
                      const initScore = result.rounds[0]?.score ?? result.risk_score;
                      const finalScore = result.risk_score;
                      const improvement = initScore - finalScore;
                      const totalVulns = result.rounds.reduce((s, r) => s + (r.vulnerabilities_found ?? 0), 0);
                      const totalPatches = result.rounds.reduce((s, r) => s + (r.patches_applied ?? 0), 0);
                      const allVulns = result.rounds.flatMap(r => r.vulnerabilities ?? []);
                      const critCount = allVulns.filter(v => v.severity === "CRITICAL").length;
                      const highCount = allVulns.filter(v => v.severity === "HIGH").length;
                      const medCount  = allVulns.filter(v => v.severity === "MEDIUM").length;
                      const lowCount  = allVulns.filter(v => v.severity === "LOW").length;
                      const riskLabel = finalScore < 15 ? "✅ LOW — Safe to use"
                        : finalScore < 30 ? "⚠️ MODERATE — Review before signing"
                        : finalScore < 50 ? "🔶 ELEVATED — Significant issues found"
                        : finalScore < 70 ? "🔴 HIGH — Substantial vulnerabilities"
                        : "🚨 CRITICAL — Do NOT sign without professional review";
                      const summaryPoints = [
                        { icon: "🔁", label: "Adversarial Rounds", value: `${result.rounds.length} rounds completed` },
                        { icon: "📉", label: "Risk Reduction", value: improvement > 0 ? `Score improved by ${improvement} pts (${initScore} → ${finalScore})` : `Score: ${finalScore}/100 (no improvement)` },
                        { icon: "🐛", label: "Total Vulnerabilities Found", value: `${totalVulns} vulnerabilities across all rounds` },
                        { icon: "🛡️", label: "Patches Applied", value: `${totalPatches} clauses strengthened` },
                        ...(critCount > 0 ? [{ icon: "💀", label: "Critical Issues", value: `${critCount} CRITICAL vulnerabilities — requires immediate fix` }] : []),
                        ...(highCount > 0 ? [{ icon: "🔴", label: "High Severity", value: `${highCount} HIGH severity issues` }] : []),
                        ...(medCount > 0  ? [{ icon: "🟠", label: "Medium Severity", value: `${medCount} MEDIUM severity issues` }] : []),
                        ...(lowCount > 0  ? [{ icon: "🟡", label: "Low Severity", value: `${lowCount} LOW severity issues` }] : []),
                        { icon: "⚖️", label: "Final Risk Assessment", value: riskLabel },
                        ...(result.pii_entities_found > 0 ? [{ icon: "🔒", label: "PII Protection", value: `${result.pii_entities_found} sensitive entities detected and anonymised` }] : []),
                      ];
                      return (
                        <div className="flex flex-col gap-3">
                          {summaryPoints.map((pt, i) => (
                            <div key={i} className="flex items-start gap-3 bg-[var(--color-lexai-surface)] rounded-lg p-3 border border-[var(--color-lexai-border)]">
                              <span className="text-lg mt-0.5">{pt.icon}</span>
                              <div>
                                <p className="text-xs font-bold text-[var(--color-lexai-text-muted)] uppercase tracking-wider">{pt.label}</p>
                                <p className="text-sm text-white mt-0.5 leading-relaxed">{pt.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Recharts Compliance Radar */}
                  {result.radar && (
                    <div className="mt-8">
                      <h4 className="text-md font-bold mb-4">Compliance Radar</h4>
                      <ComplianceRadar scores={result.radar as unknown as Record<string, number>} />
                    </div>
                  )}
                </div>
              )}

              {activeResultTab === "vulns" && (
                <div>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="text-lg font-bold">Vulnerabilities Found</h3>
                  </div>

                {(() => {
                    const allVulns = result.rounds.flatMap(r => r.vulnerabilities ?? []);
                    return (
                      <>
                        {/* Loophole Network Graph */}
                        {allVulns.length > 0 && (
                          <div className="glass-card p-4 mb-6">
                            <h4 className="text-sm font-bold mb-3 text-[var(--color-lexai-text-muted)] uppercase tracking-wider">
                              🕸️ Vulnerability Network
                            </h4>
                            <LoopholeNetwork
                              vulnerabilities={allVulns.map((v: Vulnerability, i: number) => ({
                                id: `v-${i}`,
                                title: v.name ?? "Unknown",
                                severity: (v.severity?.toLowerCase() ?? "medium") as "critical" | "high" | "medium" | "low",
                                description: v.explanation,
                              }))}
                            />
                          </div>
                        )}

                        {/* Vulnerability cards */}
                        {allVulns.length > 0 ? (
                          <div className="flex flex-col gap-4">
                            {allVulns.map((vuln: Vulnerability, i: number) => (
                              <div
                                key={i}
                                className="bg-[var(--color-lexai-surface)] rounded-xl p-5 border border-[var(--color-lexai-border)]"
                              >
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                  <h4 className="font-semibold">{i + 1}. {vuln.name}</h4>
                                  <span className={getSeverityClass(vuln.severity)}>{vuln.severity}</span>
                                </div>
                                {vuln.affected_clause && (
                                  <p className="text-xs text-[var(--color-lexai-text-muted)] mb-2">
                                    📍 Affected Clause: <strong>{vuln.affected_clause}</strong>
                                  </p>
                                )}
                                <p className="text-sm text-[var(--color-lexai-text-muted)] leading-relaxed mb-3">
                                  {vuln.explanation}
                                </p>
                                {vuln.exploitation_scenario && (
                                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-3">
                                    <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Exploitation Scenario</p>
                                    <p className="text-xs text-[var(--color-lexai-text-muted)] leading-relaxed">{vuln.exploitation_scenario}</p>
                                  </div>
                                )}
                                {vuln.suggested_fix && (
                                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-green-400 mb-1">✅ Suggested Fix</p>
                                    <p className="text-xs text-[var(--color-lexai-text-muted)] leading-relaxed">{vuln.suggested_fix}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-5xl mb-4">✅</p>
                            <p className="text-lg font-semibold text-[var(--color-lexai-success)]">No Vulnerabilities Found</p>
                            <p className="text-sm text-[var(--color-lexai-text-muted)] mt-2">This document passed all adversarial checks.</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}



              {activeResultTab === "document" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Hardened Document</h3>
                    <button
                      onClick={() =>
                        result?.task_id &&
                        generatePDF(result.task_id, result.final_document ?? "", {
                          initial_score: result.rounds[0]?.score ?? result.risk_score,
                          final_score: result.risk_score,
                          rounds: result.rounds.length,
                          document_type: "Legal Document",
                          summary: result.summary,
                        })
                      }
                      className="btn-secondary text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <DownloadIcon className="w-4 h-4" />
                        Download PDF
                      </span>
                    </button>
                  </div>
                  <div className="bg-[var(--color-lexai-surface)] rounded-xl p-6 border border-[var(--color-lexai-border)]">
                    <pre className="text-sm text-[var(--color-lexai-text)] whitespace-pre-wrap font-[var(--font-mono)] leading-relaxed max-h-[600px] overflow-y-auto">
                      {result.final_document}
                    </pre>
                  </div>
                </div>
              )}

              {activeResultTab === "rounds" && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Battle Log — Before vs After Each Round</h3>
                  <div className="diff-wrap">
                    {result.rounds.map((round, idx) => {
                      const prevScore = idx === 0 ? (result.rounds[0]?.score ?? result.risk_score) : result.rounds[idx - 1].score;
                      const vulns = round.vulnerabilities ?? [];
                      return (
                        <div key={round.round_number} className="diff-round-block">
                          {/* Header */}
                          <div className="diff-round-header">
                            <p className="diff-round-title">⚔️ Round {round.round_number}</p>
                            <div className="diff-score-arrow">
                              <span style={{ color: getScoreColor(prevScore), fontWeight: 700 }}>{prevScore}</span>
                              <span style={{ color: "var(--color-lexai-text-muted)" }}>→</span>
                              <span style={{ color: getScoreColor(round.score), fontWeight: 700 }}>{round.score}</span>
                              <span style={{ color: "var(--color-lexai-success)", fontSize: "0.72rem" }}>
                                ↓{prevScore - round.score} pts
                              </span>
                            </div>
                          </div>

                          {/* Body */}
                          <div className="diff-body">
                            {/* Left: vulnerabilities found */}
                            <div className="diff-panel">
                              <p className="diff-panel-label">🔍 LoopholeHound Found ({vulns.length})</p>
                              {vulns.length > 0 ? (
                                <ul className="diff-vuln-list">
                                  {vulns.map((v: Vulnerability, i: number) => (
                                    <li
                                      key={i}
                                      className={`diff-vuln-item diff-vuln-${v.severity?.toLowerCase() ?? "medium"}`}
                                    >
                                      {v.name ?? "Unknown vulnerability"}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ fontSize: "0.8rem", color: "var(--color-lexai-success)" }}>✓ No vulnerabilities found</p>
                              )}
                            </div>

                            {/* Right: patches applied */}
                            <div className="diff-panel">
                              <p className="diff-panel-label">🛡️ DocumentCraft Patched ({round.patches_applied ?? 0})</p>
                              {round.patch_summary ? (
                                <p className="diff-panel-content">{round.patch_summary}</p>
                              ) : (
                                <p style={{ fontSize: "0.8rem", color: "var(--color-lexai-text-muted)" }}>
                                  {round.patches_applied} clauses strengthened
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Case Law Tab ──────────────────────────── */}
              {activeResultTab === "caselaw" && (
                <div>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="text-lg font-bold">Relevant Indian Case Law</h3>
                    <div className="flex gap-2 items-center flex-wrap">
                      <select
                        id="kanoon-court-filter"
                        className="lexai-input text-sm py-1.5"
                        value={kanoonCourt}
                        onChange={(e) => {
                          setKanoonCourt(e.target.value);
                          fetchCaseLaw("legal document", e.target.value);
                        }}
                      >
                        <option value="">All Courts</option>
                        <option value="supremecourt">Supreme Court</option>
                        <option value="delhi">Delhi High Court</option>
                        <option value="delhidc">Delhi District Courts</option>
                        <option value="karnataka">Karnataka High Court</option>
                        <option value="bombay">Bombay High Court</option>
                        <option value="madras">Madras High Court</option>
                      </select>
                      <button
                        id="kanoon-refresh-btn"
                        type="button"
                        className="btn-secondary text-sm py-1.5 px-4"
                        onClick={() => fetchCaseLaw("legal document")}
                        disabled={kanoonLoading}
                      >
                        {kanoonLoading ? "Searching…" : "↻ Refresh"}
                      </button>
                    </div>
                  </div>

                  {kanoonLoading && (
                    <div className="text-center py-10 text-[var(--color-lexai-text-muted)]">
                      <div className="inline-block w-8 h-8 border-2 border-[var(--color-lexai-accent)] border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-sm">Searching Indian Kanoon…</p>
                    </div>
                  )}

                  {!kanoonLoading && kanoonResults.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-[var(--color-lexai-text-muted)] text-sm">
                        No cases found — try a different court filter or click Refresh.
                      </p>
                      <p className="text-xs text-[var(--color-lexai-text-muted)] mt-2 opacity-60">
                        (Indian Kanoon API must be configured on the backend)
                      </p>
                    </div>
                  )}

                  {!kanoonLoading && kanoonResults.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {kanoonResults.map((c) => (
                        <a
                          key={c.tid}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="kanoon-card"
                          id={`kanoon-case-${c.tid}`}
                        >
                          <p className="kanoon-card-title">{c.title}</p>
                          <div className="kanoon-card-meta">
                            {c.court && <span className="kanoon-badge">{c.court}</span>}
                            {c.date && <span>{c.date}</span>}
                            <span className="kanoon-badge" style={{ background: "rgba(34,197,94,0.1)", color: "var(--color-lexai-success)", borderColor: "rgba(34,197,94,0.2)" }}>
                              {c.doc_type}
                            </span>
                          </div>
                          {c.headline && <p className="kanoon-card-headline">{c.headline}</p>}
                        </a>
                      ))}
                    </div>
                  )}

                  <p className="kanoon-attribution">Powered by Indian Kanoon · indiankanoon.org</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  setTextInput("");
                  setRounds([]);
                }}
                className="btn-secondary flex-1"
              >
                Analyze Another Document
              </button>
              <button onClick={handleDownload} className="btn-secondary flex-1">
                <span className="flex items-center justify-center gap-2">
                  <DownloadIcon className="w-5 h-5" />
                  Download as TXT
                </span>
              </button>
              <button
                onClick={() =>
                  result?.task_id &&
                  generatePDF(result.task_id, result.final_document ?? "", {
                    initial_score: result.rounds[0]?.score ?? result.risk_score,
                    final_score: result.risk_score,
                    rounds: result.rounds.length,
                    document_type: "Legal Document",
                    summary: result.summary,
                  })
                }
                className="btn-primary flex-1"
              >
                <span className="flex items-center justify-center gap-2">
                  <DownloadIcon className="w-5 h-5" />
                  Download PDF
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── How It Works (bottom section) ────────────────────────── */}
        {!isProcessing && !result && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <FileIcon className="w-7 h-7 text-[var(--color-lexai-accent)]" />
              </div>
              <h3 className="font-bold mb-2">1. Submit Document</h3>
              <p className="text-sm text-[var(--color-lexai-text-muted)]">
                Upload a PDF, paste text, or generate a new document from a description.
              </p>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <SwordIcon className="w-7 h-7 text-[var(--color-lexai-warning)]" />
              </div>
              <h3 className="font-bold mb-2">2. Adversarial Battle</h3>
              <p className="text-sm text-[var(--color-lexai-text-muted)]">
                LoopholeHound attacks. DocumentCraft patches. 2-3 rounds of GAN-inspired hardening.
              </p>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <ShieldIcon className="w-7 h-7 text-[var(--color-lexai-success)]" />
              </div>
              <h3 className="font-bold mb-2">3. Bulletproof Result</h3>
              <p className="text-sm text-[var(--color-lexai-text-muted)]">
                Get a hardened document with risk score, vulnerability report, and compliance radar.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
