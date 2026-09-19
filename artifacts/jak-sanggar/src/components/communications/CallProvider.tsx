import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Loader2, Play } from "lucide-react";
import { callApi, type CallMode, type CommunicationCall } from "./call-api";
import { assertMediaSupport, mediaErrorMessage, mediaTime, stopMediaStream } from "./media-utils";

type Stage = "incoming" | "permission" | "ringing" | "connecting" | "connected" | "disconnected" | "ended" | "failed";
interface CallView { peerName: string; mode: CallMode; stage: Stage; incoming: boolean; message: string; muted: boolean; cameraOff: boolean }
interface CallSession {
  call: CommunicationCall | null;
  mode: CallMode;
  incoming: boolean;
  controller: AbortController;
  peer: RTCPeerConnection | null;
  stream: MediaStream | null;
  remote: MediaStream;
  cursor?: string;
  pendingIce: RTCIceCandidateInit[];
  ready: boolean;
  busy: boolean;
  connectingSince: number;
  disconnectedSince: number;
  connectedAt: number;
  lastPollSuccess: number;
  relayConfigured: boolean;
}
interface CallsContextValue {
  active: boolean;
  startCall: (peerId: string, peerName: string, mode: CallMode) => Promise<void>;
}
const CallsContext = createContext<CallsContextValue | null>(null);

export function useCalls() {
  const value = useContext(CallsContext);
  if (!value) throw new Error("CallProvider diperlukan untuk panggilan.");
  return value;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // A session change releases devices and prevents the next account inheriting a call.
  return <CallSessionProvider key={user?.apiId ?? "anonymous"} userId={user?.apiId}>{children}</CallSessionProvider>;
}

function MediaPlayer({ stream, muted = false, video = false, label, className = "" }: { stream: MediaStream; muted?: boolean; video?: boolean; label: string; className?: string }) {
  const element = useRef<HTMLVideoElement | null>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const current = element.current;
    if (!current) return;
    current.srcObject = stream;
    void current.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true));
    return () => { current.srcObject = null; };
  }, [stream]);
  return <div className={className}>
    <video ref={element} autoPlay playsInline muted={muted} aria-label={label} className={video ? "h-full w-full rounded-2xl object-cover" : "hidden"} />
    {needsPlay ? <button type="button" onClick={() => { void element.current?.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true)); }} className="absolute inset-x-4 bottom-3 flex items-center justify-center gap-2 rounded-xl bg-white p-3 text-sm text-slate-900"><Play size={16} /> Aktifkan {video ? "video dan suara" : "suara"}</button> : null}
  </div>;
}

export function CallSessionProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const [view, setView] = useState<CallView | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const session = useRef<CallSession | null>(null);
  const mounted = useRef(true);
  const previousFocus = useRef<HTMLElement | null>(null);

  const updateView = useCallback((patch: Partial<CallView>) => {
    if (mounted.current) setView((current) => current ? { ...current, ...patch } : current);
  }, []);

  const dispose = useCallback((current: CallSession) => {
    current.controller.abort();
    current.peer?.close();
    stopMediaStream(current.stream);
    stopMediaStream(current.remote);
    current.peer = null;
    current.stream = null;
    if (session.current === current) session.current = null;
    if (mounted.current) { setLocalStream(null); setRemoteStream(null); setElapsed(0); }
  }, []);

  const finish = useCallback((stage: "ended" | "failed", message: string, notify = true) => {
    const current = session.current;
    if (!current) return;
    const call = current.call;
    dispose(current);
    updateView({ stage, message });
    if (notify && call && !["ended", "rejected", "missed"].includes(call.status)) {
      const status = current.incoming && call.status === "ringing" ? "rejected" : "ended";
      void callApi.update(call.id, status).catch(() => {
        updateView({ message: `${message} Status akhir belum tersimpan di server; sesi akan kedaluwarsa otomatis.` });
      });
    }
  }, [dispose, updateView]);

  const assertCurrent = (current: CallSession) => {
    if (!mounted.current || session.current !== current || current.controller.signal.aborted) throw new DOMException("Call cancelled", "AbortError");
  };

  const createSession = (mode: CallMode, incoming: boolean, call: CommunicationCall | null = null): CallSession => ({
    call, mode, incoming, controller: new AbortController(), peer: null, stream: null, remote: new MediaStream(), pendingIce: [], ready: false, busy: false, connectingSince: 0, disconnectedSince: 0, connectedAt: 0, lastPollSuccess: Date.now(), relayConfigured: false,
  });

  async function acquire(current: CallSession) {
    assertMediaSupport();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: current.mode === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false });
    if (session.current !== current || !mounted.current) { stopMediaStream(stream); throw new DOMException("Call cancelled", "AbortError"); }
    current.stream = stream;
    setLocalStream(stream);
    const config = await callApi.config(current.controller.signal);
    assertCurrent(current);
    current.relayConfigured = config.relayConfigured;
    return config;
  }

  function preparePeer(current: CallSession, iceServers: RTCIceServer[]) {
    assertCurrent(current);
    const peer = new RTCPeerConnection({ iceServers });
    current.peer = peer;
    current.stream?.getTracks().forEach((track) => peer.addTrack(track, current.stream!));
    peer.onicecandidate = (event) => {
      if (session.current !== current || !current.call || !event.candidate) return;
      void callApi.signal(current.call.id, "ice", event.candidate.toJSON(), current.controller.signal).catch((error) => {
        if (session.current === current) finish("failed", `Sinyal panggilan gagal dikirim. ${mediaErrorMessage(error)}`);
      });
    };
    peer.ontrack = ({ track, streams }) => {
      if (session.current !== current) return;
      if (!current.remote.getTracks().some((entry) => entry.id === track.id)) current.remote.addTrack(track);
      if (streams[0]) streams[0].getTracks().forEach((entry) => { if (!current.remote.getTracks().some((existing) => existing.id === entry.id)) current.remote.addTrack(entry); });
      setRemoteStream(current.remote);
    };
    peer.onconnectionstatechange = () => {
      if (session.current !== current) return;
      if (peer.connectionState === "connected") {
        if (!current.connectedAt) current.connectedAt = Date.now();
        current.disconnectedSince = 0;
        updateView({ stage: "connected", message: "Terhubung" });
      } else if (peer.connectionState === "disconnected") {
        current.disconnectedSince ||= Date.now();
        updateView({ stage: "disconnected", message: "Koneksi terputus. Mencoba menyambungkan kembali…" });
      } else if (peer.connectionState === "failed") {
        finish("failed", current.relayConfigured ? "Koneksi media gagal. Periksa jaringan, lalu coba kembali." : "Koneksi media gagal. Jaringan ini mungkin memerlukan relay TURN; hubungi pengelola aplikasi.");
      } else if (peer.connectionState === "connecting") updateView({ stage: "connecting", message: "Menghubungkan media…" });
    };
    current.stream?.getTracks().forEach((track) => { track.onended = () => { if (session.current === current) finish("ended", "Perangkat mikrofon atau kamera berhenti."); }; });
  }

  async function startCall(peerId: string, peerName: string, mode: CallMode) {
    if (session.current || !userId || peerId === userId) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = createSession(mode, false);
    session.current = current;
    setView({ peerName, mode, stage: "permission", incoming: false, message: "Menunggu izin perangkat…", muted: false, cameraOff: false });
    try {
      const config = await acquire(current);
      const { call } = await callApi.create(peerId, mode, crypto.randomUUID());
      if (session.current !== current || !mounted.current) { void callApi.update(call.id, "ended").catch(() => undefined); return; }
      current.call = call;
      preparePeer(current, config.iceServers);
      const offer = await current.peer!.createOffer();
      assertCurrent(current);
      await current.peer!.setLocalDescription(offer);
      assertCurrent(current);
      await callApi.signal(call.id, "offer", { type: "offer", sdp: current.peer!.localDescription!.sdp }, current.controller.signal);
      assertCurrent(current);
      current.ready = true;
      updateView({ stage: "ringing", message: "Memanggil…" });
    } catch (error) { if (session.current === current) finish("failed", mediaErrorMessage(error)); }
  }

  async function accept() {
    const current = session.current;
    if (!current?.call || !current.incoming || current.busy || current.ready) return;
    current.busy = true;
    updateView({ stage: "permission", message: "Menunggu izin perangkat…" });
    try {
      const config = await acquire(current);
      const { call } = await callApi.update(current.call.id, "accepted");
      assertCurrent(current);
      current.call = call;
      preparePeer(current, config.iceServers);
      current.ready = true;
      current.connectingSince = Date.now();
      updateView({ stage: "connecting", message: "Menghubungkan media…" });
    } catch (error) { if (session.current === current) finish("failed", mediaErrorMessage(error)); }
    finally { current.busy = false; }
  }

  // One sequential poll loop avoids overlapping SDP changes and duplicate listeners.
  useEffect(() => {
    mounted.current = true;
    if (!userId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const idleController = new AbortController();
    async function poll() {
      let delay = session.current ? 1200 : 4000;
      try {
        const current = session.current;
        if (!current) {
          const { calls } = await callApi.list(idleController.signal);
          if (stopped || session.current) return;
          const incoming = calls.find((call) => call.calleeId === userId && call.status === "ringing" && call.expiresAt > Date.now());
          if (incoming) {
            previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const incomingSession = createSession(incoming.mode, true, incoming);
            session.current = incomingSession;
            setView({ peerName: "Akun terdaftar", mode: incoming.mode, stage: "incoming", incoming: true, message: `Panggilan ${incoming.mode === "video" ? "video" : "suara"} masuk`, muted: false, cameraOff: false });
            void callApi.contacts(incomingSession.controller.signal).then(({ contacts }) => {
              if (session.current === incomingSession) updateView({ peerName: contacts.find((contact) => contact.id === incoming.callerId)?.name || "Akun terdaftar" });
            }).catch(() => undefined);
          }
          return;
        }
        if (!current.call) return;
        const result = await callApi.signals(current.call.id, current.ready ? current.cursor : undefined, current.controller.signal);
        if (stopped || session.current !== current) return;
        current.lastPollSuccess = Date.now();
        current.call = result.call;
        if (current.peer?.connectionState === "connected") updateView({ stage: "connected", message: "Terhubung" });
        if (["ended", "rejected", "missed"].includes(result.call.status)) {
          finish("ended", result.call.status === "rejected" ? "Panggilan ditolak." : result.call.status === "missed" ? "Panggilan tidak dijawab." : "Panggilan diakhiri.", false);
          return;
        }
        if (result.call.status === "accepted" && !current.connectingSince) {
          current.connectingSince = Date.now();
          if (!current.connectedAt) updateView({ stage: "connecting", message: "Menghubungkan media…" });
        }
        if (current.disconnectedSince && Date.now() - current.disconnectedSince > 15000) { finish("failed", "Koneksi tidak pulih. Silakan panggil kembali."); return; }
        if (current.connectingSince && !current.connectedAt && Date.now() - current.connectingSince > 45000) { finish("failed", "Waktu menghubungkan media habis. Periksa jaringan atau konfigurasi relay TURN."); return; }
        if (result.call.status === "ringing" && result.call.expiresAt <= Date.now()) { finish("ended", "Panggilan tidak dijawab."); return; }
        if (!current.ready || !current.peer) return;
        const peer = current.peer;
        for (const signal of result.signals) {
          assertCurrent(current);
          if (signal.type === "ice") {
            if (peer.remoteDescription) await peer.addIceCandidate(signal.payload as RTCIceCandidateInit);
            else current.pendingIce.push(signal.payload as RTCIceCandidateInit);
          } else if (signal.type === "offer" && current.incoming && peer.signalingState === "stable" && !peer.remoteDescription) {
            await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            assertCurrent(current);
            for (const ice of current.pendingIce.splice(0)) await peer.addIceCandidate(ice);
            const answer = await peer.createAnswer();
            assertCurrent(current);
            await peer.setLocalDescription(answer);
            assertCurrent(current);
            await callApi.signal(current.call.id, "answer", { type: "answer", sdp: peer.localDescription!.sdp }, current.controller.signal);
          } else if (signal.type === "answer" && !current.incoming && peer.signalingState === "have-local-offer") {
            await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            assertCurrent(current);
            for (const ice of current.pendingIce.splice(0)) await peer.addIceCandidate(ice);
          }
        }
        current.cursor = result.cursor;
      } catch (error) {
        const current = session.current;
        if (stopped || (error instanceof DOMException && error.name === "AbortError" && current?.controller.signal.aborted)) return;
        if (current) {
          if (Date.now() - current.lastPollSuccess > 20000) finish("failed", "Hubungan dengan server terputus. Panggilan dihentikan.");
          else updateView({ message: "Sinyal server terganggu. Mencoba kembali…" });
        }
        delay = 4000;
      } finally { if (!stopped) timer = setTimeout(() => void poll(), delay); }
    }
    void poll();
    const clock = setInterval(() => {
      const current = session.current;
      if (current?.connectedAt) setElapsed((Date.now() - current.connectedAt) / 1000);
    }, 1000);
    const unload = () => {
      const current = session.current;
      if (!current) return;
      const call = current.call;
      if (mounted.current) updateView({ stage: "ended", message: "Panggilan berakhir karena halaman ditinggalkan." });
      dispose(current);
      if (call) void callApi.update(call.id, current.incoming && call.status === "ringing" ? "rejected" : "ended", true).catch(() => undefined);
    };
    window.addEventListener("pagehide", unload);
    return () => {
      stopped = true;
      mounted.current = false;
      idleController.abort();
      clearTimeout(timer);
      clearInterval(clock);
      window.removeEventListener("pagehide", unload);
      unload();
    };
  }, [userId, dispose, finish, updateView]);

  function toggle(kind: "audio" | "video") {
    const tracks = session.current?.stream?.getTracks().filter((track) => track.kind === kind) ?? [];
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((track) => { track.enabled = enabled; });
    updateView(kind === "audio" ? { muted: !enabled } : { cameraOff: !enabled });
  }

  function close() {
    if (session.current) finish("ended", "Panggilan diakhiri.");
    setView(null);
    previousFocus.current?.focus();
  }

  const active = Boolean(view && !["ended", "failed"].includes(view.stage));
  return <CallsContext.Provider value={{ active, startCall }}>
    {children}
    <Dialog open={Boolean(view)} onOpenChange={(open) => { if (!open) close(); }}>
      {view ? <DialogContent data-tradisi="silent" className="max-h-[95dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto" onPointerDownOutside={(event) => event.preventDefault()}>
        <div className="space-y-5 pt-1">
          <div className="pr-7"><DialogTitle>{view.stage === "incoming" ? "Panggilan masuk" : `Panggilan ${view.mode === "video" ? "video" : "suara"}`}</DialogTitle><DialogDescription className="mt-2">{view.peerName}</DialogDescription></div>
          <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-[#102A43] text-white">
            {remoteStream && view.mode === "video" ? <MediaPlayer stream={remoteStream} video label="Video lawan bicara" className="relative h-[290px] w-full" /> : <div className="flex flex-col items-center gap-4 p-8"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">{view.mode === "video" ? <Video size={32} /> : <Phone size={32} />}</div><span className="font-medium">{view.peerName}</span></div>}
            {remoteStream && view.mode === "audio" ? <MediaPlayer stream={remoteStream} label="Suara lawan bicara" className="absolute inset-x-0 bottom-0" /> : null}
            {localStream && view.mode === "video" ? <div className="absolute bottom-3 right-3 h-24 w-32 overflow-hidden rounded-xl border border-white/30 bg-slate-900">{!view.cameraOff ? <MediaPlayer stream={localStream} muted video label="Video Anda" className="h-full w-full" /> : <div className="flex h-full items-center justify-center"><VideoOff size={24} /></div>}<span className="absolute bottom-1 left-2 rounded bg-black/50 px-1 text-[10px]">Anda</span></div> : null}
          </div>
          <p role="status" aria-live="polite" className={`text-center text-sm ${view.stage === "failed" ? "text-red-700" : "text-slate-600"}`}>{["permission", "connecting"].includes(view.stage) ? <Loader2 className="mr-2 inline-block animate-spin" size={15} /> : null}{view.message}{view.stage === "connected" ? ` · ${mediaTime(elapsed)}` : ""}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {view.stage === "incoming" ? <><button type="button" onClick={() => finish("ended", "Panggilan ditolak.")} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white"><PhoneOff size={18} /> Tolak</button><button type="button" onClick={() => void accept()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white"><Phone size={18} /> Terima</button></> : active ? <>
              {localStream ? <button type="button" onClick={() => toggle("audio")} aria-pressed={view.muted} aria-label={view.muted ? "Aktifkan mikrofon" : "Bisukan mikrofon"} className="rounded-full border p-3 hover:bg-slate-100">{view.muted ? <MicOff size={21} /> : <Mic size={21} />}</button> : null}
              {localStream && view.mode === "video" ? <button type="button" onClick={() => toggle("video")} aria-pressed={view.cameraOff} aria-label={view.cameraOff ? "Aktifkan kamera" : "Matikan kamera"} className="rounded-full border p-3 hover:bg-slate-100">{view.cameraOff ? <VideoOff size={21} /> : <Video size={21} />}</button> : null}
              <button type="button" onClick={() => finish("ended", "Panggilan diakhiri.")} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white"><PhoneOff size={18} /> Akhiri</button>
            </> : <button type="button" onClick={close} className="rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white">Tutup</button>}
          </div>
          {view.stage === "incoming" ? <p className="text-center text-xs text-slate-500">Mikrofon{view.mode === "video" ? " dan kamera" : ""} diaktifkan setelah Anda menerima.</p> : null}
        </div>
      </DialogContent> : null}
    </Dialog>
  </CallsContext.Provider>;
}

export function CallButtons({ peerId, peerName, disabled = false }: { peerId: string; peerName: string; disabled?: boolean }) {
  const { active, startCall } = useCalls();
  return <div className="flex shrink-0 items-center gap-1">
    <button type="button" disabled={disabled || active} onClick={() => void startCall(peerId, peerName, "audio")} title="Panggilan suara" aria-label={`Panggilan suara ke ${peerName}`} className="rounded-xl p-2.5 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"><Phone size={20} /></button>
    <button type="button" disabled={disabled || active} onClick={() => void startCall(peerId, peerName, "video")} title="Panggilan video" aria-label={`Panggilan video ke ${peerName}`} className="rounded-xl p-2.5 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"><Video size={20} /></button>
  </div>;
}
