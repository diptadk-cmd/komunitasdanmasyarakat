import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Trash2, Loader2 } from "lucide-react";
import { assertMediaSupport, MAX_VOICE_BYTES, MAX_VOICE_SECONDS, mediaErrorMessage, mediaTime, stopMediaStream, voiceMimeType } from "./media-utils";

interface VoiceRecorderProps {
  onSend: (blob: Blob, durationSeconds: number) => Promise<void>;
  disabled?: boolean;
}

/** The parent uploads the approved recording through the authenticated attachment API. */
export default function VoiceRecorder({ onSend, disabled = false }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<"idle" | "permission" | "recording" | "preview" | "sending">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);

  const clearTimers = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (limitTimer.current) clearTimeout(limitTimer.current);
    timer.current = null;
    limitTimer.current = null;
  }, []);

  const dispose = useCallback(() => {
    generation.current += 1;
    busy.current = false;
    clearTimers();
    const activeRecorder = recorder.current;
    recorder.current = null;
    if (activeRecorder) {
      activeRecorder.ondataavailable = null;
      activeRecorder.onstop = null;
      activeRecorder.onerror = null;
      if (activeRecorder.state !== "inactive") activeRecorder.stop();
    }
    stopMediaStream(stream.current);
    stream.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  }, [clearTimers]);

  const discard = useCallback(() => {
    dispose();
    setPreview(null);
    setElapsed(0);
    setPhase("idle");
  }, [dispose]);

  useEffect(() => dispose, [dispose]);
  useEffect(() => { if (disabled && (phase === "permission" || phase === "recording")) discard(); }, [disabled, phase, discard]);

  async function start() {
    if (disabled || busy.current) return;
    discard();
    const attempt = generation.current;
    busy.current = true;
    setPhase("permission");
    setError("");
    try {
      assertMediaSupport(true);
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation.current !== attempt) { stopMediaStream(media); return; }
      stream.current = media;
      const mimeType = voiceMimeType();
      if (!mimeType) throw new Error("Browser ini tidak menyediakan format rekaman suara yang didukung.");
      const current = new MediaRecorder(media, { mimeType, audioBitsPerSecond: 64000 });
      recorder.current = current;
      const chunks: Blob[] = [];
      let bytes = 0;
      let exceeded = false;
      const started = performance.now();
      const stop = () => { if (current.state !== "inactive") current.stop(); clearTimers(); };
      current.ondataavailable = ({ data }) => {
        if (attempt !== generation.current || !data.size) return;
        bytes += data.size;
        if (bytes > MAX_VOICE_BYTES) { exceeded = true; stop(); return; }
        chunks.push(data);
      };
      current.onerror = () => {
        if (attempt !== generation.current) return;
        discard();
        setError("Rekaman terhenti karena perangkat tidak dapat dibaca. Coba rekam kembali.");
      };
      current.onstop = () => {
        stopMediaStream(media);
        if (attempt !== generation.current) return;
        stream.current = null;
        recorder.current = null;
        busy.current = false;
        clearTimers();
        const duration = Math.min(MAX_VOICE_SECONDS, (performance.now() - started) / 1000);
        const blob = new Blob(chunks, { type: current.mimeType });
        if (exceeded || !blob.size || duration < 0.3) {
          setError(exceeded ? "Rekaman melebihi 8 MB. Rekam ulang dengan durasi lebih singkat." : "Rekaman terlalu singkat atau kosong. Silakan rekam lagi.");
          setPhase("idle");
          return;
        }
        const url = URL.createObjectURL(blob);
        previewUrl.current = url;
        setPreview({ blob, url, duration });
        setElapsed(duration);
        setPhase("preview");
      };
      current.start(250);
      setPhase("recording");
      timer.current = setInterval(() => {
        const seconds = (performance.now() - started) / 1000;
        setElapsed(Math.min(MAX_VOICE_SECONDS, seconds));
        if (seconds >= MAX_VOICE_SECONDS) stop();
      }, 250);
      limitTimer.current = setTimeout(stop, MAX_VOICE_SECONDS * 1000);
    } catch (reason) {
      if (attempt !== generation.current) return;
      discard();
      setError(mediaErrorMessage(reason));
    }
  }

  async function send() {
    if (!preview || busy.current || disabled) return;
    const attempt = generation.current;
    busy.current = true;
    setPhase("sending");
    setError("");
    try {
      await onSend(preview.blob, preview.duration);
      if (attempt === generation.current) discard();
    } catch (reason) {
      if (attempt !== generation.current) return;
      busy.current = false;
      setPhase("preview");
      setError(mediaErrorMessage(reason));
    }
  }

  return <div className="min-w-0 space-y-2" data-testid="voice-recorder">
    <div className="flex flex-wrap items-center gap-2">
      {phase === "idle" ? <button type="button" onClick={() => void start()} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"><Mic size={17} /> Rekam suara</button> : null}
      {phase === "permission" ? <><span className="inline-flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Menunggu izin mikrofon…</span><button type="button" onClick={discard} className="rounded-lg px-3 py-2 text-sm underline">Batal</button></> : null}
      {phase === "recording" ? <><span role="status" className="inline-flex items-center gap-2 text-sm font-medium text-red-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Merekam {mediaTime(elapsed)} / 2:00</span><button type="button" onClick={() => { if (recorder.current?.state === "recording") recorder.current.stop(); }} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm text-white"><Square size={15} /> Selesai merekam</button><button type="button" onClick={discard} aria-label="Batalkan rekaman" className="rounded-lg p-2 text-slate-600"><Trash2 size={18} /></button></> : null}
      {preview ? <><audio controls src={preview.url} aria-label="Pratinjau pesan suara" className="h-10 w-full max-w-[280px]" /><span className="text-xs text-slate-500">{mediaTime(preview.duration)}</span><button type="button" onClick={() => void send()} disabled={phase === "sending" || disabled} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-3 py-2 text-sm text-white disabled:opacity-50">{phase === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{phase === "sending" ? "Mengirim…" : "Kirim suara"}</button><button type="button" onClick={discard} disabled={phase === "sending"} aria-label="Hapus rekaman" className="rounded-lg p-2 text-slate-600 disabled:opacity-50"><Trash2 size={18} /></button></> : null}
    </div>
    {phase === "idle" && !error ? <p className="text-xs text-slate-500">Rekam hingga 2 menit. Dengarkan sebelum mengirim.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </div>;
}
