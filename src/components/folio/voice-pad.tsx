import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import type { VoiceNote } from "@/lib/folio/types";

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

function speechCtor(): (new () => SpeechRec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSrc(v: Pick<VoiceNote, "audioUrl" | "audioB64" | "mime">): string {
  if (v.audioUrl) return v.audioUrl;
  if (v.audioB64) return `data:${v.mime || "audio/webm"};base64,${v.audioB64}`;
  return "";
}

export function formatMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoicePad({
  onSave,
  busy,
  compact,
  label,
}: {
  onSave: (v: { audioB64: string; mime: string; durationMs: number; transcript: string }) => Promise<void>;
  busy?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const [mode, setMode] = useState<"idle" | "rec">("idle");
  const [hold, setHold] = useState(false);
  const [live, setLive] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRef = useRef<SpeechRec | null>(null);
  const transcriptRef = useRef("");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHold = useRef(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        speechRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  async function begin() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunks.current = [];
    transcriptRef.current = "";
    setLive("");
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.start();
    recRef.current = rec;
    started.current = Date.now();
    setMode("rec");
    const Ctor = speechCtor();
    if (Ctor) {
      const s = new Ctor();
      s.continuous = true;
      s.interimResults = true;
      s.lang = "en-US";
      s.onresult = (ev) => {
        let t = "";
        for (let i = 0; i < ev.results.length; i++) {
          t += ev.results[i]?.[0]?.transcript ?? "";
        }
        transcriptRef.current = t.trim();
        setLive(t.trim());
      };
      try {
        s.start();
        speechRef.current = s;
      } catch {
        speechRef.current = null;
      }
    }
  }

  async function end() {
    const rec = recRef.current;
    recRef.current = null;
    setMode("idle");
    setHold(false);
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRef.current = null;
    if (!rec) return;
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks.current, { type: rec.mimeType }));
      if (rec.state !== "inactive") rec.stop();
      else resolve(new Blob(chunks.current, { type: rec.mimeType }));
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const durationMs = Date.now() - started.current;
    if (durationMs < 280 || blob.size < 200) return;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    await onSave({
      audioB64: btoa(binary),
      mime: blob.type || "audio/webm",
      durationMs,
      transcript: transcriptRef.current,
    });
    setLive("");
  }

  function onPointerDown() {
    isHold.current = false;
    holdTimer.current = setTimeout(() => {
      isHold.current = true;
      setHold(true);
      if (mode === "idle") void begin();
    }, 180);
  }

  function onPointerUp() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (isHold.current) {
      if (mode === "rec") void end();
      return;
    }
    if (mode === "idle") void begin();
    else void end();
  }

  return (
    <div className={compact ? "" : "mt-4"}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "grid place-items-center rounded-full border border-ink text-ink transition-transform duration-150 active:scale-[0.96]",
            compact ? "size-14" : "size-16",
            mode === "rec" && "voice-pulse bg-ink text-paper",
          )}
          aria-label={mode === "rec" ? "Stop recording" : "Record a voice note"}
        >
          {mode === "rec" ? <Square className="size-5" fill="currentColor" /> : <Mic className="size-6" strokeWidth={1.5} />}
        </button>
        <div className="min-w-0 font-ui text-[12px] leading-snug text-ink-soft">
          {mode === "rec"
            ? hold
              ? "Holding · lift to stop"
              : "Listening · tap to stop"
            : label || "Hold to talk, or tap once to start"}
          {live && <div className="mt-1 font-serif text-[14px] text-ink">{live}</div>}
        </div>
      </div>
    </div>
  );
}

export function VoiceBubble({
  note,
  mine,
  autoPlay,
}: {
  note: VoiceNote;
  mine: boolean;
  autoPlay?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const src = voiceSrc(note);

  useEffect(() => {
    const a = new Audio(src);
    audioRef.current = a;
    const onTime = () => {
      const d = a.duration || note.durationMs / 1000;
      setProgress(d ? a.currentTime / d : 0);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    if (autoPlay) {
      void a.play().then(() => setPlaying(true)).catch(() => {});
    }
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [src, note.durationMs, autoPlay]);

  function toggle() {
    const a = audioRef.current;
    if (!a || !src) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  }

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] border px-3 py-2.5",
          mine ? "border-ink bg-ink text-paper" : "border-rule bg-paper-2 text-ink",
        )}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full border",
              mine ? "border-paper/40" : "border-ink/30",
            )}
            aria-label={playing ? "Pause" : "Play voice"}
          >
            {playing ? <Pause className="size-3.5" fill="currentColor" /> : <Play className="size-3.5" fill="currentColor" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className={cn("font-ui text-[10px] tracking-[0.14em] uppercase", mine ? "text-paper/70" : "text-ink-soft")}>
              {note.authorName || (mine ? "You" : "A friend")} · {formatMs(note.durationMs)}
            </div>
            <div className={cn("mt-1 h-[3px] w-full", mine ? "bg-paper/25" : "bg-rule")}>
              <div
                className={cn("h-full", mine ? "bg-paper" : "bg-ink")}
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
        {note.transcript && (
          <p className={cn("mt-2 font-serif text-[14px] leading-snug", mine ? "text-paper/90" : "text-ink")}>
            {note.transcript}
          </p>
        )}
      </div>
    </div>
  );
}
