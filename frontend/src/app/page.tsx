"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  analyzeDocument,
  generateDocument,
  connectWebSocket,
  getTemplates,
  downloadDocument,
  type AnalysisResult,
  type AdversarialRound,
  type WSMessage,
  type TemplateInfo,
  type Vulnerability,
} from "@/lib/api";

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
  const [activeResultTab, setActiveResultTab] = useState<"overview" | "vulns" | "document" | "rounds">("overview");

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
        break;
      case "error":
        setError(msg.error);
        setIsProcessing(false);
        setStatusText("Error occurred");
        break;
    }
  }, []);

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
                  className="lexai-textarea mb-6"
                  placeholder="Paste your legal document text here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={8}
                />

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
            <p className="text-[var(--color-lexai-danger)] font-semibold">Error</p>
            <p className="text-sm text-[var(--color-lexai-text-muted)] mt-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setResult(null);
                setIsProcessing(false);
              }}
              className="btn-secondary mt-4"
            >
              Try Again
            </button>
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
                    style={{ color: getScoreColor(result.initial_score) }}
                  >
                    {result.initial_score}
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-3xl text-[var(--color-lexai-accent)]">→</div>

                {/* Final score */}
                <div className="text-center">
                  <p className="text-sm text-[var(--color-lexai-text-muted)] mb-2">Final Risk</p>
                  <div
                    className="text-5xl font-extrabold"
                    style={{ color: getScoreColor(result.final_score) }}
                  >
                    {result.final_score}
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
            <div className="flex gap-2 mb-6 border-b border-[var(--color-lexai-border)] pb-1">
              {(["overview", "vulns", "document", "rounds"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveResultTab(tab)}
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
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="glass-card p-6">
              {activeResultTab === "overview" && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Analysis Summary</h3>
                  <p className="text-[var(--color-lexai-text-muted)] leading-relaxed whitespace-pre-wrap">
                    {result.summary}
                  </p>

                  {/* Radar scores */}
                  {result.radar_scores && (
                    <div className="mt-8">
                      <h4 className="text-md font-bold mb-4">Compliance Radar</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(result.radar_scores).map(([key, value]) => (
                          <div key={key} className="bg-[var(--color-lexai-surface)] rounded-xl p-4">
                            <p className="text-xs text-[var(--color-lexai-text-muted)] uppercase tracking-wider mb-2">
                              {key.replace(/_/g, " ")}
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="progress-bar">
                                  <div
                                    className="progress-fill"
                                    style={{
                                      width: `${value}%`,
                                      background:
                                        value >= 70
                                          ? "linear-gradient(90deg, #22c55e, #4ade80)"
                                          : value >= 40
                                          ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                                          : "linear-gradient(90deg, #ef4444, #f87171)",
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-lg font-bold" style={{ color: getScoreColor(100 - value) }}>
                                {value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeResultTab === "vulns" && (
                <div>
                  <h3 className="text-lg font-bold mb-4">
                    Vulnerabilities Found
                  </h3>
                  {result.rounds.length > 0 &&
                    result.rounds[0]?.attack_report?.vulnerabilities?.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {result.rounds[0].attack_report.vulnerabilities.map(
                        (vuln: Vulnerability, i: number) => (
                          <div
                            key={i}
                            className="bg-[var(--color-lexai-surface)] rounded-xl p-5 border border-[var(--color-lexai-border)]"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">{vuln.name}</h4>
                              <span className={getSeverityClass(vuln.severity)}>
                                {vuln.severity}
                              </span>
                            </div>
                            {vuln.affected_clause && (
                              <p className="text-xs text-[var(--color-lexai-text-muted)] mb-2">
                                Affected: {vuln.affected_clause}
                              </p>
                            )}
                            <p className="text-sm text-[var(--color-lexai-text-muted)] mb-3">
                              {vuln.explanation}
                            </p>
                            {vuln.exploitation_scenario && (
                              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-3">
                                <p className="text-xs font-semibold text-red-300 mb-1">
                                  Exploitation Scenario
                                </p>
                                <p className="text-xs text-[var(--color-lexai-text-muted)]">
                                  {vuln.exploitation_scenario}
                                </p>
                              </div>
                            )}
                            {vuln.suggested_fix && (
                              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                                <p className="text-xs font-semibold text-green-300 mb-1">
                                  Suggested Fix
                                </p>
                                <p className="text-xs text-[var(--color-lexai-text-muted)]">
                                  {vuln.suggested_fix}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-[var(--color-lexai-text-muted)]">
                      No vulnerability data available.
                    </p>
                  )}
                </div>
              )}

              {activeResultTab === "document" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Hardened Document</h3>
                    <button onClick={handleDownload} className="btn-secondary text-sm">
                      <span className="flex items-center gap-2">
                        <DownloadIcon className="w-4 h-4" />
                        Download
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
                  <h3 className="text-lg font-bold mb-4">Battle Log</h3>
                  <div className="flex flex-col gap-4">
                    {result.rounds.map((round) => (
                      <div
                        key={round.round_number}
                        className="bg-[var(--color-lexai-surface)] rounded-xl p-5 border border-[var(--color-lexai-border)]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--color-lexai-surface-2)] flex items-center justify-center font-bold text-[var(--color-lexai-accent)]">
                              {round.round_number}
                            </div>
                            <div>
                              <p className="font-semibold">Round {round.round_number}</p>
                              <p className="text-xs text-[var(--color-lexai-text-muted)]">
                                {round.vulnerabilities_found} vulnerabilities • {round.patches_applied} patches
                              </p>
                            </div>
                          </div>
                          <div
                            className="text-3xl font-extrabold"
                            style={{ color: getScoreColor(round.score) }}
                          >
                            {round.score}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
              <button onClick={handleDownload} className="btn-primary flex-1">
                <span className="flex items-center justify-center gap-2">
                  <DownloadIcon className="w-5 h-5" />
                  Download Hardened Document
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
