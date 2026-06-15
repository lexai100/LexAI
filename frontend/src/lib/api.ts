/**
 * LexAI API Client
 * Handles all communication with the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Vulnerability {
  name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  affected_clause: string;
  explanation: string;
  exploitation_scenario: string;
  suggested_fix: string;
}

export interface LoopholeReport {
  exploitability_score: number;
  summary: string;
  vulnerabilities: Vulnerability[];
}

export interface AdversarialRound {
  round_number: number;
  score: number;
  vulnerabilities_found: number;
  patches_applied: number;
  attack_report: LoopholeReport;
}

export interface RadarScores {
  completeness: number;
  clarity: number;
  enforceability: number;
  fairness: number;
  compliance: number;
  risk_mitigation: number;
}

export interface AnalysisResult {
  task_id: string;
  summary: string;
  risk_score: number;
  initial_score: number;
  final_score: number;
  rounds: AdversarialRound[];
  final_document: string;
  original_document: string;
  radar_scores: RadarScores;
  pii_entities_found: number;
  document_type: string;
}

export interface TaskStatus {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  current_round: number;
  result?: AnalysisResult;
  error?: string;
}

export interface TemplateInfo {
  document_type: string;
  title: string;
  description: string;
  sample_fields: string[];
}

export interface GenerationRequest {
  document_type: string;
  description: string;
  party_a?: string;
  party_b?: string;
  location?: string;
  additional_context?: string;
  run_adversarial?: boolean;
}

// ── REST API ────────────────────────────────────────────────────────────────

export async function analyzeDocument(
  file?: File,
  text?: string,
  anonymizePii: boolean = true
): Promise<{ task_id: string; ws_url: string }> {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (text) formData.append("text", text);
  formData.append("anonymize_pii", String(anonymizePii));

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Analysis failed");
  }

  return res.json();
}

export async function generateDocument(
  request: GenerationRequest
): Promise<{ task_id: string; ws_url: string }> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Generation failed");
  }

  return res.json();
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const res = await fetch(`${API_BASE}/api/status/${taskId}`);
  if (!res.ok) throw new Error("Failed to fetch task status");
  return res.json();
}

export async function getTemplates(): Promise<TemplateInfo[]> {
  const res = await fetch(`${API_BASE}/api/templates`);
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export async function downloadDocument(taskId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/download/${taskId}`);
  if (!res.ok) throw new Error("Failed to download document");
  return res.text();
}

export async function getHealthCheck(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend not available");
  return res.json();
}

// ── WebSocket ───────────────────────────────────────────────────────────────

export type WSMessage =
  | { type: "status"; task_id: string; status: string; progress: number }
  | { type: "round_update"; task_id: string; round: AdversarialRound; progress: number }
  | { type: "completed"; task_id: string; result: AnalysisResult }
  | { type: "error"; task_id: string; error: string }
  | { type: "pong" };

export function connectWebSocket(
  taskId: string,
  onMessage: (msg: WSMessage) => void,
  onError?: (err: Event) => void,
  onClose?: () => void
): WebSocket {
  const wsBase = API_BASE.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/api/ws/${taskId}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WSMessage;
      onMessage(msg);
    } catch (e) {
      console.error("Failed to parse WS message:", e);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    onError?.(err);
  };

  ws.onclose = () => {
    onClose?.();
  };

  // Keepalive ping every 30s
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  return ws;
}
