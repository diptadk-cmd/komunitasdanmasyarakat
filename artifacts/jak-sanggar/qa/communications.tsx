/** Local-only QA entry. Vite's production input is index.html, never this harness. */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { CallButtons, CallSessionProvider, useCalls } from "../src/components/communications/CallProvider";
import VoiceRecorder from "../src/components/communications/VoiceRecorder";
import type { CommunicationCall, CallSignal } from "../src/components/communications/call-api";
import { MessageAudio } from "../src/components/communications/MessageAudio";
import { authApi } from "@workspace/jaksanggar-core/api";
import { communicationsApi, type CommunicationMessage } from "../src/lib/communications";
import "../src/index.css";

if (!import.meta.env.DEV || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) throw new Error("This synthetic media harness is restricted to local development.");

const role = new URLSearchParams(location.search).get("role") === "b" ? "b" : "a";
const apiTransport = new URLSearchParams(location.search).get("transport") === "api";
const identities = { a: "10000000-0000-4000-8000-000000000001", b: "10000000-0000-4000-8000-000000000002" };
const selfId = identities[role];
const peerId = identities[role === "a" ? "b" : "a"];
const peerName = role === "a" ? "Akun sintetis B" : "Akun sintetis A";
const STORE = "jaksanggar_communications_synthetic_qa_v1";
const mediaTracks: MediaStreamTrack[] = [];
let permission: "allow" | "deny" | "delay" = "allow";
let offline = false;
let sendFailure = false;
let pendingPermissions = 0;
let signalSequence = 0;

/** There is no fallback to the original getUserMedia: physical devices cannot open. */
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  configurable: true,
  value: async (constraints: MediaStreamConstraints) => {
    if (permission === "deny") throw new DOMException("Synthetic permission denied", "NotAllowedError");
    if (permission === "delay") {
      pendingPermissions += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 8000));
      pendingPermissions -= 1;
    }
    const stream = new MediaStream();
    const cleanups: (() => void)[] = [];
    if (constraints.audio) {
      const context = new AudioContext();
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      // Very quiet synthetic tone, never connected to this device's speakers.
      gain.gain.value = 0.0001;
      oscillator.frequency.value = role === "a" ? 220 : 330;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      cleanups.push(() => { oscillator.stop(); void context.close(); });
    }
    if (constraints.video) {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 360;
      const context = canvas.getContext("2d")!;
      const draw = () => {
        context.fillStyle = role === "a" ? "#005a2b" : "#102a43"; context.fillRect(0, 0, 640, 360);
        context.fillStyle = "#d8ae56"; context.font = "bold 36px sans-serif"; context.fillText(`Kamera sintetis ${role.toUpperCase()}`, 45, 150);
        context.fillStyle = "white"; context.font = "22px sans-serif"; context.fillText(new Date().toLocaleTimeString("id-ID"), 45, 205);
        context.fillText("Tanpa akses kamera fisik", 45, 250);
      };
      draw();
      const timer = setInterval(draw, 100);
      canvas.captureStream(10).getVideoTracks().forEach((track) => stream.addTrack(track));
      cleanups.push(() => clearInterval(timer));
    }
    const tracks = stream.getTracks();
    let cleaned = false;
    for (const track of tracks) {
      mediaTracks.push(track);
      const stop = track.stop.bind(track);
      track.stop = () => {
        stop();
        if (!cleaned && tracks.every((candidate) => candidate.readyState === "ended")) { cleaned = true; cleanups.forEach((cleanup) => cleanup()); }
      };
    }
    return stream;
  },
});

interface SyntheticState { calls: CommunicationCall[]; signals: (CallSignal & { callId: string; sequence: number })[] }
const readState = (): SyntheticState => {
  const raw = localStorage.getItem(STORE);
  return raw ? JSON.parse(raw) as SyntheticState : { calls: [], signals: [] };
};
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const actualFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (apiTransport || !url.pathname.startsWith("/api/communications")) return actualFetch(input, init);
  if (init.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (offline) return response({ error: "Synthetic signaling outage" }, 503);
  return navigator.locks.request("jaksanggar-synthetic-signaling", () => {
    const state = readState();
    for (const call of state.calls) if (call.status === "ringing" && call.expiresAt <= Date.now()) call.status = "missed";
    const persist = () => localStorage.setItem(STORE, JSON.stringify(state));
    const path = url.pathname.replace("/api/communications", "");
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
    if (path === "/rtc-config") return response({ iceServers: [], relayConfigured: false });
    if (path === "/contacts") return response({ contacts: [{ id: identities.a, name: "Akun sintetis A" }, { id: identities.b, name: "Akun sintetis B" }], selfId, serverTime: Date.now() });
    if (path === "/calls" && method === "GET") { persist(); return response({ calls: state.calls.filter((call) => [call.callerId, call.calleeId].includes(selfId) && ["ringing", "accepted"].includes(call.status)) }); }
    if (path === "/calls" && method === "POST") {
      if (state.calls.some((call) => ["ringing", "accepted"].includes(call.status) && [call.callerId, call.calleeId].some((id) => id === selfId || id === body.peerId))) return response({ error: "Akun sintetis sedang dalam panggilan" }, 409);
      const call: CommunicationCall = { id: crypto.randomUUID(), callerId: selfId, calleeId: body.peerId, mode: body.mode, status: "ringing", createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 60000 };
      state.calls.push(call); persist(); return response({ call });
    }
    const match = path.match(/^\/calls\/([^/]+)(\/signals)?$/);
    if (!match) return response({ error: "Unknown synthetic route" }, 404);
    const call = state.calls.find((item) => item.id === match[1]);
    if (!call || ![call.callerId, call.calleeId].includes(selfId)) return response({ error: "Synthetic call missing" }, 404);
    if (!match[2] && method === "PATCH") {
      call.status = body.status; call.updatedAt = Date.now();
      call.expiresAt = body.status === "accepted" ? Date.now() + 7200000 : Date.now();
      persist(); return response({ call });
    }
    if (match[2] && method === "POST") {
      const sequence = Math.max(signalSequence, ...state.signals.map((signal) => signal.sequence), 0) + 1;
      signalSequence = sequence;
      const signal = { id: crypto.randomUUID(), callId: call.id, senderId: selfId, type: body.type, payload: body.payload, createdAt: Date.now(), sequence };
      state.signals.push(signal); persist(); return response({ signal });
    }
    const all = state.signals.filter((signal) => signal.callId === call.id && signal.senderId !== selfId);
    persist(); return response({ call, signals: all.filter((signal) => signal.sequence > Number(url.searchParams.get("after") ?? 0)), cursor: String(Math.max(...all.map((signal) => signal.sequence), 0)) });
  });
};

function Harness() {
  const calls = useCalls();
  const [tick, setTick] = useState(0);
  const [showRecorder, setShowRecorder] = useState(true);
  const [recordings, setRecordings] = useState<{ id: string; url: string; size: number; duration: number; mime: string }[]>([]);
  const [permissionMode, setPermissionMode] = useState(permission);
  const [offlineMode, setOfflineMode] = useState(offline);
  const [failSend, setFailSend] = useState(sendFailure);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 250);
    return () => clearInterval(timer);
  }, []);
  const live = mediaTracks.filter((track) => track.readyState === "live");
  useEffect(() => { document.title = `QA ${role.toUpperCase()} · ${live.length} live tracks · ${pendingPermissions} pending`; }, [tick, live.length]);
  const state = readState();
  return <main className="mx-auto max-w-4xl space-y-6 p-5 pb-20">
    <header className="space-y-2"><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Local synthetic QA</p><h1 className="text-3xl font-bold">Komunikasi · akun {role.toUpperCase()}</h1><p className="text-sm text-slate-600">Komponen produksi, media buatan, sinyal simulasi antar tab. Tidak membuka kamera atau mikrofon fisik, tidak memakai akun asli, tidak mengirim ke server.</p></header>
    <nav className="flex flex-wrap gap-3"><a className="rounded-lg border p-3 underline" href="/communications-qa.html?role=a" target="_blank" rel="noreferrer">Buka akun A</a><a className="rounded-lg border p-3 underline" href="/communications-qa.html?role=b" target="_blank" rel="noreferrer">Buka akun B</a><button className="rounded-lg border p-3" disabled={calls.active} onClick={() => { localStorage.removeItem(STORE); setTick((value) => value + 1); }}>Reset sinyal sintetis</button></nav>
    <section className="space-y-3 rounded-2xl border bg-slate-50 p-5"><h2 className="font-bold">Kontrol pengujian</h2><label className="flex flex-wrap items-center gap-3">Izin media <select value={permissionMode} onChange={(event) => { permission = event.target.value as typeof permission; setPermissionMode(permission); }} className="rounded-lg border bg-white p-2"><option value="allow">Izinkan media sintetis</option><option value="deny">Tolak izin sintetis</option><option value="delay">Tunda izin 8 detik</option></select></label><label className="flex items-center gap-2"><input type="checkbox" checked={offlineMode} onChange={(event) => { offline = event.target.checked; setOfflineMode(offline); }} /> Simulasikan sinyal server terputus</label><label className="flex items-center gap-2"><input type="checkbox" checked={failSend} onChange={(event) => { sendFailure = event.target.checked; setFailSend(sendFailure); }} /> Simulasikan gagal kirim rekaman</label><p className="text-sm">Track aktif: <strong>{live.length}</strong> ({live.filter((track) => track.kind === "audio").length} audio / {live.filter((track) => track.kind === "video").length} video). Izin tertunda: <strong>{pendingPermissions}</strong>. Track dibuat: {mediaTracks.length}.</p></section>
    <section className="rounded-2xl border p-5"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">Panggil {peerName}</h2><CallButtons peerId={peerId} peerName={peerName} /></div><p className="text-sm text-slate-600">Buka akun lain pada tab kedua; terima atau tolak di sana. Status terhubung berasal dari RTCPeerConnection asli.</p></section>
    <section className="space-y-4 rounded-2xl border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Rekaman suara</h2><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setShowRecorder((value) => !value)}>{showRecorder ? "Unmount recorder" : "Mount recorder"}</button></div>{showRecorder ? <VoiceRecorder disabled={calls.active} onSend={async (blob, duration) => { await new Promise((resolve) => setTimeout(resolve, 400)); if (sendFailure) throw new Error("Gagal kirim sintetis — pratinjau harus tetap tersedia untuk coba ulang."); setRecordings((current) => [...current, { id: crypto.randomUUID(), url: URL.createObjectURL(blob), size: blob.size, duration, mime: blob.type }]); }} /> : <p>Recorder dilepas; semua track rekaman harus berhenti.</p>}{recordings.map((recording) => <div key={recording.id} className="rounded-xl bg-emerald-50 p-3"><p className="mb-2 text-sm">Terkirim sintetis: {recording.size} bytes · {recording.duration.toFixed(2)} detik · {recording.mime}</p><audio controls src={recording.url} aria-label="Rekaman terkirim sintetis" /></div>)}</section>
    <section className="rounded-2xl border p-5"><h2 className="mb-3 font-bold">Status sinyal</h2><pre className="overflow-auto text-xs">{JSON.stringify({ calls: state.calls.map(({ mode, status, callerId, calleeId }) => ({ mode, status, callerId, calleeId })), signals: state.signals.map(({ senderId, type, sequence }) => ({ senderId, type, sequence })) }, null, 2)}</pre></section>
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[100] bg-amber-200 p-2 text-center text-xs font-bold text-slate-900">QA {role.toUpperCase()} · {live.length} track aktif · {pendingPermissions} izin tertunda · semua media sintetis</div>
  </main>;
}

function ApiHarness() {
  const [username, setUsername] = useState("qa.sanggar");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [recipient, setRecipient] = useState(identities.b);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [status, setStatus] = useState("Masuk memakai akun QA pada API lokal terisolasi.");
  const [tick, setTick] = useState(0);
  useEffect(() => { const timer = setInterval(() => setTick((value) => value + 1), 250); return () => clearInterval(timer); }, []);
  const live = mediaTracks.filter((track) => track.readyState === "live").length;
  useEffect(() => { document.title = `API media QA · ${live} live tracks`; }, [tick, live]);
  async function refresh(peer = recipient) {
    const result = await communicationsApi.messages(peer, "chat");
    setMessages(result.messages);
  }
  return <main className="mx-auto max-w-3xl space-y-5 p-6">
    <header><h1 className="text-2xl font-bold">Media QA · API lokal</h1><p className="mt-2 text-sm">Media tetap sintetis. Unggahan dan pesan memakai API lokal nyata. Gunakan akun QA terisolasi saja.</p></header>
    <form className="grid gap-3 rounded-xl border p-5" onSubmit={(event) => { event.preventDefault(); void (async () => { try { const account = await authApi.login(username, password); setUser(account); const peer = account.id === identities.a ? identities.b : identities.a; setRecipient(peer); setMessages([]); setStatus(`Masuk: ${account.username}`); await refresh(peer); } catch (error) { setStatus(String(error)); } })(); }}>
      <label>Username QA <input value={username} onChange={(event) => setUsername(event.target.value)} className="ml-3 rounded border p-2" /></label>
      <label>Password QA <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="ml-3 rounded border p-2" /></label>
      <button type="submit" className="rounded-xl bg-emerald-800 p-3 text-white">Masuk akun QA</button>
    </form>
    <p role="status" className="rounded-xl bg-amber-100 p-3 text-sm">{status} · {live} track aktif</p>
    {user ? <section className="space-y-4 rounded-xl border p-5"><h2 className="font-bold">Pengguna: {user.username}</h2><label>Penerima <select className="ml-3 rounded border p-2" value={recipient} onChange={(event) => { setRecipient(event.target.value); setMessages([]); }}><option value={identities.a}>QA sanggar</option><option value={identities.b}>QA seniman</option></select></label><VoiceRecorder key={`${user.id}:${recipient}`} onSend={async (blob, duration) => { const { attachment } = await communicationsApi.uploadVoice(blob, duration); const { message } = await communicationsApi.send({ requestId: crypto.randomUUID(), peerId: recipient, kind: "chat", body: "", attachmentId: attachment.id }); setStatus(`Audio tersimpan dan pesan terkirim: ${message.id}; ${attachment.sizeBytes} bytes; ${attachment.durationMs} ms`); await refresh(); }} /><button type="button" className="rounded border p-2" onClick={() => void refresh().catch((error) => setStatus(String(error)))}>Muat pesan dari API</button></section> : null}
    <section className="space-y-3">{messages.map((message) => <article key={`${user?.id}:${message.id}`} className="rounded-xl border p-4"><p className="mb-2 text-xs">{message.senderId === user?.id ? "Dikirim" : "Diterima"} · {message.id}</p>{message.body ? <p>{message.body}</p> : null}{message.attachment ? <><p className="mb-2 text-xs">{message.attachment.sizeBytes} bytes · {message.attachment.durationMs} ms</p><MessageAudio src={message.attachment.url} senderName={message.senderId === user?.id ? "akun sendiri" : "akun QA lain"} /></> : null}</article>)}</section>
  </main>;
}

createRoot(document.getElementById("root")!).render(apiTransport ? <ApiHarness /> : <CallSessionProvider userId={selfId}><Harness /></CallSessionProvider>);
