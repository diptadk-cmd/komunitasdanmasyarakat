import { createHash, createHmac } from "node:crypto";
import type { CommunicationAttachment, CommunicationCall, CommunicationContact, CommunicationIceServer, CommunicationKind, CommunicationMessage, CommunicationSignal, CommunicationThread } from "./communications-contract";

export const COMMUNICATION_COLLECTION_PREFIX = "comm.";
export const COMM = { message: "comm.message.v1", read: "comm.read.v1", presence: "comm.presence.v1", attachment: "comm.attachment.v1", call: "comm.call.v1", signal: "comm.signal.v1" } as const;
export const PRESENCE_TTL = 65_000;
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_DURATION = 120_000;
export interface CommunicationUser { id: string; role: string; status: string; profile: Record<string, unknown> }
export interface CommunicationRecord { id: string; collection: string; ownerId: string; participantIds: string[]; data: Record<string, unknown> }
export interface CommunicationQuery { participantId?: string; ownerId?: string; conversationId?: string; attachmentId?: string; callId?: string; kind?: string; senderId?: string; recipientId?: string; before?: number; limit?: number }
export interface CommunicationRepository {
  user(id: string): Promise<CommunicationUser | undefined>;
  users(): Promise<CommunicationUser[]>;
  get(collection: string, id: string): Promise<CommunicationRecord | undefined>;
  find(collection: string, query?: CommunicationQuery): Promise<CommunicationRecord[]>;
  create(record: CommunicationRecord): Promise<CommunicationRecord>;
  createCall(record: CommunicationRecord): Promise<CommunicationRecord>;
  createSignal(record: CommunicationRecord): Promise<CommunicationRecord>;
  replace(record: CommunicationRecord, expectedStatus?: string): Promise<boolean>;
  readThrough(record: CommunicationRecord): Promise<void>;
}
export class CommunicationError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new CommunicationError(status, message); }
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail(400, "Data permintaan tidak valid.");
const text = (value: unknown, max: number, label: string, required = true): string => {
  if (typeof value !== "string") return required ? fail(400, `${label} wajib diisi.`) : "";
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) fail(400, `${label} tidak valid (maksimal ${max} karakter).`);
  return clean;
};
const kindOf = (value: unknown): CommunicationKind => value === "chat" || value === "mail" ? value : fail(400, "Jenis pesan tidak valid.");
const allowedRoles = new Set(["kurator", "admin", "sanggar", "pelatih", "seniman", "juri", "pengrajin", "mitra_pengrajin", "sewa"]);
const active = (u: CommunicationUser | undefined): u is CommunicationUser => Boolean(u && u.status === "aktif" && allowedRoles.has(u.role));
const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 40);
const requestId = (value: unknown): string => {
  const id = text(value, 128, "ID permintaan");
  return /^[A-Za-z0-9_-]{12,128}$/.test(id) ? id : fail(400, "ID permintaan tidak valid.");
};
export const conversationId = (a: string, b: string, kind: CommunicationKind) => `${kind}-${hash([a, b].sort().join(":"))}`;
const record = (collection: string, id: string, ownerId: string, participantIds: string[], data: object): CommunicationRecord => ({ collection, id, ownerId, participantIds, data: data as Record<string, unknown> });
const dataAs = <T>(row: CommunicationRecord): T => row.data as T;
const timestamp = (value: unknown, fallback: number): number => value === undefined || value === "" ? fallback : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fail(400, "Waktu tidak valid.");
const pageSize = (value: unknown): number => value === undefined ? 50 : Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 100 ? Number(value) : fail(400, "Batas daftar harus 1–100.");
const sortMessages = (a: CommunicationMessage, b: CommunicationMessage) => a.createdAt - b.createdAt || a.id.localeCompare(b.id);
export function validateAudio(contentType: string, bytes: Uint8Array, duration: unknown): { contentType: string; durationMs: number } {
  const mime = contentType.toLowerCase().split(";")[0]!.trim();
  const durationMs = timestamp(duration, 0);
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES || durationMs > MAX_AUDIO_DURATION) fail(413, "Pesan suara maksimal 8 MB dan 2 menit.");
  const lead = Buffer.from(bytes.subarray(0, 16));
  const supported =
    (mime === "audio/webm" && lead.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) ||
    (mime === "audio/ogg" && lead.subarray(0, 4).toString() === "OggS") ||
    (["audio/wav", "audio/x-wav"].includes(mime) && lead.subarray(0, 4).toString() === "RIFF" && lead.subarray(8, 12).toString() === "WAVE") ||
    (mime === "audio/mp4" && lead.subarray(4, 8).toString() === "ftyp") ||
    (mime === "audio/mpeg" && (lead.subarray(0, 3).toString() === "ID3" || (lead[0] === 0xff && ((lead[1] ?? 0) & 0xe0) === 0xe0)));
  if (!supported) fail(415, "Rekaman audio tidak didukung. Gunakan WebM, OGG, MP4 audio, MP3, atau WAV.");
  return { contentType: mime, durationMs };
}
export function rtcConfiguration(raw: string | undefined, rest: { turnUrls?: string; turnSecret?: string; userId?: string; now?: number } = {}): { iceServers: CommunicationIceServer[]; relayConfigured: boolean; expiresAt?: number } {
  // Coturn TURN REST: base64(HMAC-SHA1(secret, expiry-seconds:userId)).
  // Only the derived short-lived credential leaves this server.
  const turnUrls = (rest.turnUrls ?? "").split(",").map((url) => url.trim()).filter((url) => /^turns?:[^\s]{1,500}$/.test(url)).slice(0, 8);
  if (turnUrls.length && rest.turnSecret && rest.turnSecret.length >= 16 && rest.userId && /^[a-zA-Z0-9_-]{1,80}$/.test(rest.userId)) {
    const expiresAt = (Math.floor((rest.now ?? Date.now()) / 1000) + 3600) * 1000;
    const username = `${expiresAt / 1000}:${rest.userId}`;
    const credential = createHmac("sha1", rest.turnSecret).update(username).digest("base64");
    return { iceServers: [{ urls: turnUrls, username, credential }], relayConfigured: true, expiresAt };
  }
  if (!raw?.trim()) return { iceServers: [], relayConfigured: false };
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { return { iceServers: [], relayConfigured: false }; }
  if (!Array.isArray(entries) || entries.length > 8) return { iceServers: [], relayConfigured: false };
  const iceServers: CommunicationIceServer[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const urls = typeof entry.urls === "string" ? [entry.urls] : Array.isArray(entry.urls) ? entry.urls : [];
    const valid = urls.filter((url: unknown): url is string => typeof url === "string" && /^(stun|stuns|turn|turns):[^\s]{1,500}$/.test(url));
    if (!valid.length) continue;
    const server: CommunicationIceServer = { urls: valid };
    if (typeof entry.username === "string") server.username = entry.username.slice(0, 256);
    if (typeof entry.credential === "string") server.credential = entry.credential.slice(0, 1024);
    iceServers.push(server);
  }
  return { iceServers, relayConfigured: iceServers.some((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) => /^turns?:/.test(url)) && Boolean(server.username && server.credential)) };
}

export class CommunicationService {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(public readonly repository: CommunicationRepository, private readonly now = () => Date.now()) {}
  private limit(actorId: string, action: string, max: number): void {
    const key = `${actorId}:${action}`; const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + 60_000 }; this.buckets.set(key, bucket); }
    if (++bucket.count > max) fail(429, "Terlalu banyak permintaan. Coba lagi sebentar.");
    if (this.buckets.size > 5000) for (const [key, value] of this.buckets) if (value.until <= now) this.buckets.delete(key);
  }
  async actor(id: string): Promise<CommunicationUser> { const u = await this.repository.user(id); return active(u) ? u : fail(403, "Akun tidak aktif atau tidak memiliki akses komunikasi."); }
  private async peer(actorId: string, id: unknown): Promise<CommunicationUser> { const peerId = text(id, 36, "Penerima"); if (peerId === actorId) fail(400, "Pilih akun penerima lain."); const peer = await this.repository.user(peerId); return active(peer) ? peer : fail(404, "Akun penerima tidak tersedia."); }
  private identity(actorId: string, body: Record<string, unknown>): void { for (const field of ["senderId", "callerId", "userId", "actorId"]) if (body[field] !== undefined && body[field] !== actorId) fail(403, "Identitas pengirim tidak cocok dengan sesi aktif."); }
  private contact(user: CommunicationUser, lastSeenAt?: number): CommunicationContact {
    const p = user.profile; const name = [p.namaSanggar, p.namaUsaha, p.nama, p.namaPemilik, p.namaKetua, p.namaPenanggungJawab].find((v) => typeof v === "string" && v.trim());
    const image = typeof p.fotoProfileDataUrl === "string" ? p.fotoProfileDataUrl : undefined;
    const avatarUrl = image && image.length <= 400_000 && (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image) || /^\/api\/public\/media\/[a-z0-9-]+$/i.test(image)) ? image : undefined;
    return { id: user.id, name: typeof name === "string" ? name.slice(0, 120) : "Akun terdaftar", role: user.role, ...(avatarUrl ? { avatarUrl } : {}), online: lastSeenAt !== undefined && this.now() - lastSeenAt < PRESENCE_TTL, ...(lastSeenAt ? { lastSeenAt } : {}) };
  }
  async contacts(actorId: string) {
    await this.actor(actorId); this.limit(actorId, "contacts", 40);
    const [users, presence] = await Promise.all([this.repository.users(), this.repository.find(COMM.presence)]);
    const seen = new Map(presence.map((r) => [r.ownerId, Number(r.data.lastSeenAt)]));
    return { contacts: users.filter((u) => active(u) && u.id !== actorId).map((u) => this.contact(u, seen.get(u.id))).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "id")), selfId: actorId, serverTime: this.now() };
  }
  async presence(actorId: string) {
    await this.actor(actorId); this.limit(actorId, "presence", 10); const now = this.now();
    const r = record(COMM.presence, actorId, actorId, [actorId], { lastSeenAt: now, createdAt: now });
    await this.repository.create(r); await this.repository.replace(r); return { online: true as const, expiresAt: now + PRESENCE_TTL };
  }
  async prepareAttachment(actorId: string) { await this.actor(actorId); this.limit(actorId, "attachment", 12); }
  async registerAttachment(actorId: string, attachment: CommunicationAttachment) { await this.actor(actorId); await this.repository.create(record(COMM.attachment, attachment.id, actorId, [actorId], { ...attachment, createdAt: this.now() })); return { attachment }; }
  async authorizeAttachment(actorId: string, id: string) {
    await this.actor(actorId); const attachment = await this.repository.get(COMM.attachment, id);
    if (!attachment) fail(404, "Rekaman tidak ditemukan.");
    if (attachment.ownerId !== actorId && !(await this.repository.find(COMM.message, { participantId: actorId, attachmentId: id, limit: 1 })).length) fail(403, "Rekaman bukan bagian percakapan Anda.");
    return dataAs<CommunicationAttachment>(attachment);
  }
  async send(actorId: string, raw: unknown) {
    await this.actor(actorId); const input = object(raw); this.identity(actorId, input);
    const peer = await this.peer(actorId, input.peerId); const kind = kindOf(input.kind); const reqId = requestId(input.requestId);
    const body = text(input.body, kind === "mail" ? 20_000 : 4_000, "Isi pesan", false); const subject = kind === "mail" ? text(input.subject, 160, "Subjek", false) : "";
    const id = `message-${hash(`${actorId}:${reqId}`)}`; const existing = await this.repository.get(COMM.message, id);
    let attachment: CommunicationAttachment | undefined;
    if (input.attachmentId !== undefined) { const row = await this.repository.get(COMM.attachment, text(input.attachmentId, 80, "Lampiran")); if (!row || row.ownerId !== actorId) fail(403, "Lampiran harus diunggah oleh pengirim."); attachment = dataAs<CommunicationAttachment>(row); }
    if (!body && !attachment) fail(400, "Isi pesan atau rekaman suara wajib diisi.");
    const same = (message: CommunicationMessage) => message.recipientId === peer.id && message.kind === kind && message.body === body && (message.subject ?? "") === subject && message.attachment?.id === attachment?.id;
    if (existing) { const message = dataAs<CommunicationMessage>(existing); if (!same(message)) fail(409, "ID permintaan sudah digunakan untuk pesan lain."); return { message }; }
    this.limit(actorId, "send", 40);
    const message: CommunicationMessage = { id, conversationId: conversationId(actorId, peer.id, kind), senderId: actorId, recipientId: peer.id, kind, body, ...(subject ? { subject } : {}), ...(attachment ? { attachment: { id: attachment.id, url: attachment.url, contentType: attachment.contentType, sizeBytes: attachment.sizeBytes, durationMs: attachment.durationMs } } : {}), createdAt: this.now() };
    const saved = dataAs<CommunicationMessage>(await this.repository.create(record(COMM.message, id, actorId, [actorId, peer.id], message)));
    if (!same(saved)) fail(409, "ID permintaan sudah digunakan untuk pesan lain."); return { message: saved };
  }
  private async annotate(messages: CommunicationMessage[]): Promise<CommunicationMessage[]> {
    const keys = [...new Set(messages.map((m) => `${m.recipientId}:${m.conversationId}`))];
    const rows = await Promise.all(keys.map((id) => this.repository.get(COMM.read, id)));
    const marks = new Map(keys.map((key, i) => [key, rows[i]?.data]));
    return messages.map((message) => { const mark = marks.get(`${message.recipientId}:${message.conversationId}`); return mark && Number(mark.through) >= message.createdAt ? { ...message, readAt: Number(mark.readAt) } : message; });
  }
  async messages(actorId: string, query: Record<string, unknown>) {
    await this.actor(actorId); this.limit(actorId, "messages", 100); const peer = await this.peer(actorId, query.peerId); const kind = kindOf(query.kind); const limit = pageSize(query.limit);
    const rows = await this.repository.find(COMM.message, { participantId: actorId, conversationId: conversationId(actorId, peer.id, kind), before: timestamp(query.before, this.now() + 1), limit: limit + 1 });
    const messages = rows.slice(0, limit).map(dataAs<CommunicationMessage>).sort(sortMessages);
    return { messages: await this.annotate(messages), hasMore: rows.length > limit };
  }
  async mail(actorId: string, query: Record<string, unknown>) {
    await this.actor(actorId); this.limit(actorId, "messages", 100); if (query.folder !== "inbox" && query.folder !== "sent") fail(400, "Folder surat tidak valid."); const limit = pageSize(query.limit);
    const rows = await this.repository.find(COMM.message, { participantId: actorId, kind: "mail", ...(query.folder === "inbox" ? { recipientId: actorId } : { senderId: actorId }), before: timestamp(query.before, this.now() + 1), limit: limit + 1 });
    return { messages: await this.annotate(rows.slice(0, limit).map(dataAs<CommunicationMessage>)), hasMore: rows.length > limit };
  }
  async read(actorId: string, raw: unknown) {
    await this.actor(actorId); this.limit(actorId, "read", 100); const input = object(raw); this.identity(actorId, input); const peer = await this.peer(actorId, input.peerId); const kind = kindOf(input.kind); const through = Math.min(timestamp(input.through, 0), this.now());
    if (!through) fail(400, "Waktu pesan terakhir wajib diisi.");
    const pair = conversationId(actorId, peer.id, kind); const id = `${actorId}:${pair}`;
    await this.repository.readThrough(record(COMM.read, id, actorId, [actorId], { through, readAt: this.now(), conversationId: pair, createdAt: this.now() })); return { ok: true as const };
  }
  async threads(actorId: string, kindRaw: unknown) {
    await this.actor(actorId); this.limit(actorId, "threads", 60); const kind = kindOf(kindRaw);
    const [rows, users, marks, presence] = await Promise.all([this.repository.find(COMM.message, { participantId: actorId, kind }), this.repository.users(), this.repository.find(COMM.read, { ownerId: actorId }), this.repository.find(COMM.presence)]);
    const usersById = new Map(users.filter(active).map((u) => [u.id, u])); const seen = new Map(presence.map((r) => [r.ownerId, Number(r.data.lastSeenAt)])); const through = new Map(marks.map((r) => [String(r.data.conversationId), Number(r.data.through)]));
    const grouped = new Map<string, CommunicationThread>();
    for (const row of rows) { const message = dataAs<CommunicationMessage>(row); const peerId = message.senderId === actorId ? message.recipientId : message.senderId; const peer = usersById.get(peerId); if (!peer) continue;
      let thread = grouped.get(message.conversationId); if (!thread) { thread = { id: message.conversationId, peer: this.contact(peer, seen.get(peerId)), kind, lastMessage: message, unread: 0 }; grouped.set(message.conversationId, thread); }
      if (sortMessages(message, thread.lastMessage) > 0) thread.lastMessage = message;
      if (message.recipientId === actorId && message.createdAt > (through.get(message.conversationId) ?? 0)) thread.unread++;
    }
    return { threads: [...grouped.values()].sort((a, b) => sortMessages(b.lastMessage, a.lastMessage)) };
  }
  private async call(actorId: string, id: string): Promise<CommunicationCall> {
    const row = await this.repository.get(COMM.call, text(id, 80, "Panggilan")); if (!row) fail(404, "Panggilan tidak ditemukan.");
    if (!row.participantIds.includes(actorId)) fail(403, "Panggilan bukan milik Anda.");
    let call = dataAs<CommunicationCall>(row);
    if (["ringing", "accepted"].includes(call.status) && call.expiresAt <= this.now()) { const status = call.status === "ringing" ? "missed" as const : "ended" as const; const expired = { ...call, status, updatedAt: this.now() }; if (await this.repository.replace(record(COMM.call, call.id, call.callerId, [call.callerId, call.calleeId], expired), call.status)) call = expired; else call = dataAs<CommunicationCall>((await this.repository.get(COMM.call, id))!); }
    return call;
  }
  async calls(actorId: string) {
    await this.actor(actorId); this.limit(actorId, "calls", 100); const rows = await this.repository.find(COMM.call, { participantId: actorId });
    const activeCalls: CommunicationCall[] = [];
    for (const row of rows) { const old = dataAs<CommunicationCall>(row); if (!["ringing", "accepted"].includes(old.status)) continue; const call = await this.call(actorId, old.id); if (["ringing", "accepted"].includes(call.status)) activeCalls.push(call); }
    return { calls: activeCalls.sort((a, b) => b.createdAt - a.createdAt) };
  }
  async startCall(actorId: string, raw: unknown) {
    await this.actor(actorId); const input = object(raw); this.identity(actorId, input); const peer = await this.peer(actorId, input.peerId); if (input.mode !== "audio" && input.mode !== "video") fail(400, "Mode panggilan tidak valid."); const id = `call-${hash(`${actorId}:${requestId(input.requestId)}`)}`;
    const old = await this.repository.get(COMM.call, id); if (old) { const call = await this.call(actorId, id); if (call.calleeId !== peer.id || call.mode !== input.mode) fail(409, "ID permintaan sudah digunakan."); return { call }; }
    this.limit(actorId, "start-call", 8);
    const callerActive = await this.calls(actorId); const receiverActive = await this.calls(peer.id); if (callerActive.calls.length || receiverActive.calls.length) fail(409, "Salah satu akun sedang menerima atau menjalani panggilan.");
    const now = this.now(); const call: CommunicationCall = { id, callerId: actorId, calleeId: peer.id, mode: input.mode, status: "ringing", createdAt: now, updatedAt: now, expiresAt: now + 60_000 };
    const saved = dataAs<CommunicationCall>(await this.repository.createCall(record(COMM.call, id, actorId, [actorId, peer.id], call)));
    if (saved.calleeId !== peer.id || saved.mode !== input.mode) fail(409, "ID permintaan sudah digunakan untuk panggilan lain."); return { call: saved };
  }
  async updateCall(actorId: string, id: string, raw: unknown) {
    await this.actor(actorId); const input = object(raw); this.identity(actorId, input); const call = await this.call(actorId, id);
    const status = input.status; if (status !== "accepted" && status !== "rejected" && status !== "ended") fail(400, "Status panggilan tidak valid.");
    if ((status === "accepted" || status === "rejected") && call.calleeId !== actorId) fail(403, "Hanya penerima yang dapat menjawab panggilan.");
    if (call.status === status) return { call }; if (!["ringing", "accepted"].includes(call.status) || (status !== "ended" && call.status !== "ringing")) fail(409, "Panggilan sudah berubah atau berakhir.");
    const next: CommunicationCall = { ...call, status, updatedAt: this.now(), expiresAt: status === "accepted" ? this.now() + 2 * 60 * 60_000 : this.now() };
    if (!await this.repository.replace(record(COMM.call, id, call.callerId, [call.callerId, call.calleeId], next), call.status)) fail(409, "Status panggilan berubah. Muat ulang panggilan."); return { call: next };
  }
  async signal(actorId: string, id: string, raw: unknown) {
    await this.actor(actorId); const input = object(raw); this.identity(actorId, input); const call = await this.call(actorId, id); if (!["ringing", "accepted"].includes(call.status)) fail(409, "Panggilan sudah berakhir.");
    const type = input.type; if (type !== "offer" && type !== "answer" && type !== "ice") fail(400, "Sinyal tidak valid.");
    if ((type === "offer" && actorId !== call.callerId) || (type === "answer" && (actorId !== call.calleeId || call.status !== "accepted"))) fail(403, "Arah sinyal panggilan tidak sesuai.");
    const payload = object(input.payload); const serialized = JSON.stringify(payload); if (serialized.length > (type === "ice" ? 4096 : 65_536)) fail(413, "Sinyal terlalu besar.");
    let normalized: Record<string, unknown>;
    if (type === "ice") { const candidate = text(payload.candidate, 3000, "ICE candidate", false); if (payload.sdpMid !== undefined && payload.sdpMid !== null && typeof payload.sdpMid !== "string") fail(400, "ICE media tidak valid."); const line = payload.sdpMLineIndex; if (line !== undefined && line !== null && (!Number.isInteger(line) || Number(line) < 0 || Number(line) > 100)) fail(400, "ICE index tidak valid."); normalized = { candidate, sdpMid: payload.sdpMid ?? null, sdpMLineIndex: line ?? null, ...(typeof payload.usernameFragment === "string" ? { usernameFragment: payload.usernameFragment.slice(0, 256) } : {}) }; }
    else { if (payload.type !== type) fail(400, "Jenis deskripsi sesi tidak sesuai."); text(payload.sdp, 65_000, "Deskripsi sesi"); normalized = { type, sdp: payload.sdp }; }
    const signalId = `signal-${hash(`${actorId}:${id}:${requestId(input.requestId)}`)}`; const prior = await this.repository.get(COMM.signal, signalId);
    if (prior) { const signal = dataAs<CommunicationSignal>(prior); if (signal.type !== type || JSON.stringify(signal.payload) !== JSON.stringify(normalized)) fail(409, "ID sinyal sudah digunakan."); return { signal }; }
    this.limit(actorId, "signal", 240); const count = await this.repository.find(COMM.signal, { callId: id, limit: 513 }); if (count.length >= 512) fail(429, "Batas sinyal panggilan tercapai.");
    const signal: CommunicationSignal = { id: signalId, senderId: actorId, type, payload: normalized, createdAt: this.now() };
    const saved = dataAs<CommunicationSignal>(await this.repository.createSignal(record(COMM.signal, signalId, actorId, [call.callerId, call.calleeId], { ...signal, callId: id })));
    if (saved.type !== type || JSON.stringify(saved.payload) !== JSON.stringify(normalized)) fail(409, "ID sinyal sudah digunakan untuk sinyal lain.");
    return { signal: { id: saved.id, senderId: saved.senderId, type: saved.type, payload: saved.payload, createdAt: saved.createdAt } };
  }
  async signals(actorId: string, id: string, afterRaw: unknown) {
    await this.actor(actorId); this.limit(actorId, "signals-read", 100); const call = await this.call(actorId, id); const after = text(afterRaw, 140, "Curseur", false);
    const rows = await this.repository.find(COMM.signal, { callId: id, participantId: actorId });
    const signals = rows.map(dataAs<CommunicationSignal>).filter((s) => s.senderId !== actorId).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const cursorOf = (s: CommunicationSignal) => `${String(s.createdAt).padStart(16, "0")}:${s.id}`;
    return { call, signals: signals.filter((s) => cursorOf(s) > after).map(({ id, senderId, type, payload, createdAt }) => ({ id, senderId, type, payload, createdAt })), cursor: signals.length ? cursorOf(signals[signals.length - 1]!) : after };
  }
}
