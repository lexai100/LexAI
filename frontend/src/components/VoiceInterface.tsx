"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type VoiceLanguage = "auto" | "en" | "hi" | "kn" | "ta" | "te" | "mr";

interface VoiceInterfaceProps {
  /** Called with the final transcript text */
  onTranscript: (text: string, language: string) => void;
  /** Optional: read this text aloud via TTS */
  textToSpeak?: string;
  /** Language hint for Whisper */
  language?: VoiceLanguage;
  /** Placeholder shown in the transcript area */
  placeholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "transcribing" | "done" | "error";

// ── Browser SpeechSynthesis helper ──────────────────────────────────────────

function speakText(text: string, langBcp47: string = "en-IN"): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langBcp47;

  // Try to find an Indian voice
  const voices = window.speechSynthesis.getVoices();
  const indianVoice =
    voices.find((v) => v.lang === langBcp47) ||
    voices.find((v) => v.lang.startsWith(langBcp47.split("-")[0])) ||
    voices.find((v) => v.lang.includes("IN")) ||
    null;

  if (indianVoice) utterance.voice = indianVoice;
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ── Waveform bars (CSS animation) ───────────────────────────────────────────

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="voice-waveform" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="voice-waveform-bar"
          style={{
            animationDelay: `${i * 0.08}s`,
            animationPlayState: active ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}

// ── Language selector ────────────────────────────────────────────────────────

const LANGUAGES: { code: VoiceLanguage; label: string }[] = [
  { code: "auto", label: "Auto" },
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function VoiceInterface({
  onTranscript,
  textToSpeak,
  language = "auto",
  placeholder = "Speak your query…",
  disabled = false,
}: VoiceInterfaceProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [selectedLang, setSelectedLang] = useState<VoiceLanguage>(language);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // ── TTS: speak when textToSpeak changes ────────────────────────────────────
  useEffect(() => {
    if (!textToSpeak) return;
    const langMap: Record<string, string> = {
      hi: "hi-IN", kn: "kn-IN", ta: "ta-IN", te: "te-IN", mr: "mr-IN", en: "en-IN",
    };
    const bcp47 = langMap[selectedLang] ?? "en-IN";

    // Wait for voices to load (Chrome loads async)
    const doSpeak = () => {
      setIsSpeaking(true);
      const utt = new SpeechSynthesisUtterance(textToSpeak);
      utt.lang = bcp47;
      utt.rate = 0.92;
      const voices = window.speechSynthesis.getVoices();
      const indian =
        voices.find((v) => v.lang === bcp47) ||
        voices.find((v) => v.lang.includes("IN")) ||
        null;
      if (indian) utt.voice = indian;
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = doSpeak;
    }

    return () => { window.speechSynthesis.cancel(); };
  }, [textToSpeak, selectedLang]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopStream();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (disabled || state === "recording" || state === "transcribing") return;
    setError("");
    setTranscript("");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionDenied(false);
    } catch {
      setPermissionDenied(true);
      setError("Microphone access denied. Please allow microphone and try again.");
      setState("error");
      return;
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stopStream();
      handleTranscribe(blob);
    };

    recorder.start(100); // collect chunks every 100ms
    setState("recording");
  }, [disabled, state]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setState("transcribing");
    }
  }, []);

  // ── Send to backend STT ────────────────────────────────────────────────────
  const handleTranscribe = async (blob: Blob) => {
    setState("transcribing");
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("language", selectedLang);

    try {
      const res = await fetch(`${API_BASE}/api/voice/stt`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Transcription failed");
      }

      const data = await res.json();
      const text: string = data.text || "";
      const lang: string = data.language || selectedLang;

      setTranscript(text);
      setState("done");
      onTranscript(text, lang);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      setError(msg);
      setState("error");
    }
  };

  // ── Retry ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setState("idle");
    setTranscript("");
    setError("");
  };

  // ── Stop speaking ──────────────────────────────────────────────────────────
  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const isBusy = isRecording || isTranscribing;

  return (
    <div className="voice-interface">
      {/* Language selector */}
      <div className="voice-lang-row">
        <span className="voice-lang-label">Language:</span>
        <div className="voice-lang-pills">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              id={`voice-lang-${l.code}`}
              className={`voice-lang-pill ${selectedLang === l.code ? "active" : ""}`}
              onClick={() => setSelectedLang(l.code)}
              disabled={isBusy}
              type="button"
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main controls */}
      <div className="voice-controls">
        {/* Mic button */}
        <button
          id="voice-mic-btn"
          type="button"
          className={`voice-mic-btn ${isRecording ? "recording" : ""} ${isTranscribing ? "transcribing" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isTranscribing || permissionDenied}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          title={permissionDenied ? "Microphone permission denied" : isRecording ? "Click to stop" : "Click to speak"}
        >
          {isTranscribing ? (
            <svg className="voice-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : isRecording ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Waveform / status */}
        <div className="voice-status-area">
          {isRecording && (
            <>
              <WaveformBars active />
              <p className="voice-status-text recording">Recording… click mic to stop</p>
            </>
          )}
          {isTranscribing && (
            <p className="voice-status-text transcribing">Transcribing with Groq Whisper…</p>
          )}
          {state === "idle" && !error && (
            <p className="voice-status-text idle">
              {permissionDenied ? "⚠️ Mic blocked — check browser permissions" : placeholder}
            </p>
          )}
          {state === "done" && transcript && (
            <p className="voice-status-text done">✓ Transcript ready</p>
          )}
          {state === "error" && (
            <p className="voice-status-text error">{error}</p>
          )}
        </div>

        {/* TTS play/stop button */}
        {isSpeaking ? (
          <button
            id="voice-tts-stop-btn"
            type="button"
            className="voice-tts-btn speaking"
            onClick={stopSpeaking}
            aria-label="Stop speaking"
            title="Stop speaking"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : textToSpeak ? (
          <button
            id="voice-tts-play-btn"
            type="button"
            className="voice-tts-btn"
            onClick={() => speakText(textToSpeak, selectedLang === "auto" ? "en-IN" : `${selectedLang}-IN`)}
            aria-label="Read result aloud"
            title="Read result aloud"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Transcript display */}
      {transcript && (
        <div className="voice-transcript">
          <p className="voice-transcript-text">{transcript}</p>
          <button
            id="voice-reset-btn"
            type="button"
            className="voice-reset-btn"
            onClick={reset}
            aria-label="Clear transcript"
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}
