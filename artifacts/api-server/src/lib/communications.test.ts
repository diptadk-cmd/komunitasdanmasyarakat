import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { COMM, CommunicationError, CommunicationService, MAX_AUDIO_BYTES, PRESENCE_TTL, conversationId, rtcConfiguration, validateAudio, type CommunicationQuery, type CommunicationRecord, type CommunicationRepository, type CommunicationUser } from "./communications";

const clone = <T>(value: T): T => structuredClone(value);
class MemoryRepository implements CommunicationRepository {
  records = new Map<string, CommunicationRecord>();
  accounts: CommunicationUser[] = [
    { id: "alice", role: "sanggar", status: "aktif", profile: { namaSanggar: "Sanggar Sintetis", email: "private@example.invalid", noHp: "private", alamat: "private" } },
    { id: "bob", role: "seniman", status: "aktif", profile: { nama: "Seniman Uji" } },
    { id: "charlie", role: "admin", status: "aktif", profile: { nama: "Admin Uji" } },
    { id: "blocked", role: "pelatih", status: "diblokir", profile: { nama: "Akun Diblokir" } },
  ];
  async user(id: string) { return clone(this.accounts.find((user) => user.id === id)); }
  async users() { return clone(this.accounts); }
  async get(collection: string, id: string) { return clone(this.records.get(`${collection}:${id}`)); }
  async find(collection: string, query: CommunicationQuery = {}) {
    let rows = [...this.records.values()].filter((row) => row.collection === collection);
    if (query.participantId) rows = rows.filter((row) => row.participantIds.includes(query.participantId!));
    if (query.ownerId) rows = rows.filter((row) => row.ownerId === query.ownerId);
    for (const key of ["conversationId", "callId", "kind", "senderId", "recipientId"] as const) if (query[key]) rows = rows.filter((row) => row.data[key] === query[key]);
    if (query.attachmentId) rows = rows.filter((row) => (row.data.attachment as { id?: string } | undefined)?.id === query.attachmentId);
    if (query.before !== undefined) rows = rows.filter((row) => Number(row.data.createdAt) < query.before!);
    rows.sort((a, b) => Number(b.data.createdAt) - Number(a.data.createdAt) || b.id.localeCompare(a.id));
    return clone(query.limit ? rows.slice(0, query.limit) : rows);
  }
  async create(record: CommunicationRecord) { const key = `${record.collection}:${record.id}`; if (!this.records.has(key)) this.records.set(key, clone(record)); return clone(this.records.get(key)!); }
  async createCall(record: CommunicationRecord) { return this.create(record); }
  async createSignal(record: CommunicationRecord) { const previous = await this.find(COMM.signal, { callId: String(record.data.callId) }); const createdAt = Math.max(Number(record.data.createdAt), ...previous.map((r) => Number(r.data.createdAt) + 1)); return this.create({ ...record, data: { ...record.data, createdAt } }); }
  async replace(record: CommunicationRecord, expectedStatus?: string) { const key = `${record.collection}:${record.id}`; const existing = this.records.get(key); if (!existing || (expectedStatus !== undefined && existing.data.status !== expectedStatus)) return false; this.records.set(key, clone(record)); return true; }
  async readThrough(record: CommunicationRecord) { const key = `${record.collection}:${record.id}`; const old = this.records.get(key); if (!old || Number(old.data.through) < Number(record.data.through)) this.records.set(key, clone(record)); }
}
function setup() { const repository = new MemoryRepository(); let now = 1_800_000_000_000; const service = new CommunicationService(repository, () => now); return { repository, service, advance: (ms = 1000) => { now += ms; }, now: () => now }; }
const send = (peerId = "bob", requestId = "synthetic-request-001", extra = {}) => ({ requestId, peerId, kind: "chat", body: "Pesan sintetis", ...extra });
const rejects = (work: Promise<unknown>, status: number) => assert.rejects(work, (err: unknown) => err instanceof CommunicationError && err.status === status);

test("directory exposes only active safe contact fields and no fabricated online users", async () => {
  const { service } = setup(); const result = await service.contacts("bob");
  assert.deepEqual(result.contacts.map((c) => c.id).sort(), ["alice", "charlie"]);
  assert.equal(result.selfId, "bob"); assert.ok(result.contacts.every((c) => c.online === false));
  assert.deepEqual(Object.keys(result.contacts.find((c) => c.id === "alice")!).sort(), ["id", "name", "online", "role"]);
});
test("presence expires from authenticated heartbeat and cannot be used by blocked actor", async () => {
  const { service, advance } = setup(); await service.presence("bob"); assert.equal((await service.contacts("alice")).contacts.find((c) => c.id === "bob")?.online, true);
  advance(PRESENCE_TTL + 1); assert.equal((await service.contacts("alice")).contacts.find((c) => c.id === "bob")?.online, false); await rejects(service.presence("blocked"), 403);
});
test("every registered active role can send cross-role messages", async () => {
  const { service, repository } = setup();
  for (const role of ["kurator", "admin", "sanggar", "pelatih", "seniman", "juri", "pengrajin", "mitra_pengrajin", "sewa"]) { repository.accounts.push({ id: role, role, status: "aktif", profile: { nama: `QA ${role}` } }); const result = await service.send(role, send("alice")); assert.equal(result.message.senderId, role); }
});
test("messages survive service recreation and retries do not duplicate", async () => {
  const { service, repository, now } = setup(); const first = await service.send("alice", send()); const duplicate = await service.send("alice", send()); assert.equal(duplicate.message.id, first.message.id);
  const fresh = new CommunicationService(repository, now); const result = await fresh.messages("bob", { peerId: "alice", kind: "chat" }); assert.equal(result.messages.length, 1); assert.equal(result.messages[0]?.body, "Pesan sintetis");
  await rejects(service.send("alice", send("bob", "synthetic-request-001", { body: "changed" })), 409);
});
test("sender identity is server-bound; self, blocked target and blocked actor denied", async () => {
  const { service } = setup(); await rejects(service.send("alice", send("bob", undefined, { senderId: "charlie" })), 403); await rejects(service.send("alice", send("alice")), 400); await rejects(service.send("alice", send("blocked")), 404); await rejects(service.send("blocked", send("alice")), 403); await rejects(service.send("missing", send("alice")), 403);
});
test("admin outsider cannot read a private conversation, threads, mail or voice", async () => {
  const { service } = setup(); await service.send("alice", send());
  assert.deepEqual((await service.messages("charlie", { peerId: "alice", kind: "chat" })).messages, []); assert.deepEqual((await service.threads("charlie", "chat")).threads, []); assert.deepEqual((await service.mail("charlie", { folder: "inbox" })).messages, []);
});
test("mail inbox and sent are separate across recipients; chat excluded", async () => {
  const { service, advance } = setup(); await service.send("alice", send()); advance(); const mail = await service.send("alice", send("bob", "synthetic-request-002", { kind: "mail", subject: "Undangan", body: "Isi surat" }));
  assert.equal((await service.mail("alice", { folder: "sent" })).messages[0]?.id, mail.message.id); assert.equal((await service.mail("bob", { folder: "inbox" })).messages[0]?.subject, "Undangan"); assert.equal((await service.mail("alice", { folder: "inbox" })).messages.length, 0); assert.equal((await service.mail("bob", { folder: "sent" })).messages.length, 0);
});
test("unread/read receipts are per recipient and monotonic", async () => {
  const { service, advance, now } = setup(); const first = await service.send("alice", send()); advance(); const last = await service.send("alice", send("bob", "synthetic-request-002"));
  assert.equal((await service.threads("bob", "chat")).threads[0]?.unread, 2);
  await service.read("bob", { peerId: "alice", kind: "chat", through: first.message.createdAt }); assert.equal((await service.threads("bob", "chat")).threads[0]?.unread, 1);
  await service.read("bob", { peerId: "alice", kind: "chat", through: last.message.createdAt }); await service.read("bob", { peerId: "alice", kind: "chat", through: first.message.createdAt }); assert.equal((await service.threads("bob", "chat")).threads[0]?.unread, 0);
  assert.ok((await service.messages("alice", { peerId: "bob", kind: "chat" })).messages.every((m) => m.readAt === now()));
});
test("message pagination is chronological and never returns the other kind", async () => {
  const { service, advance } = setup(); const ids: string[] = [];
  for (let i = 0; i < 5; i++) { advance(); ids.push((await service.send("alice", send("bob", `synthetic-request-${i}`))).message.id); }
  const recent = await service.messages("bob", { peerId: "alice", kind: "chat", limit: 2 }); assert.deepEqual(recent.messages.map((m) => m.id), ids.slice(3)); assert.equal(recent.hasMore, true);
  const older = await service.messages("bob", { peerId: "alice", kind: "chat", limit: 2, before: recent.messages[0]!.createdAt }); assert.deepEqual(older.messages.map((m) => m.id), ids.slice(1, 3));
});
test("empty/oversized messages, invalid idempotency and unbounded paging rejected", async () => {
  const { service } = setup(); await rejects(service.send("alice", send("bob", undefined, { body: "" })), 400); await rejects(service.send("alice", send("bob", undefined, { body: "x".repeat(4001) })), 400); await rejects(service.send("alice", send("bob", "short")), 400); await rejects(service.messages("alice", { peerId: "bob", kind: "chat", limit: 10000 }), 400);
});
test("voice attachment is private before send, shared only with actual recipient, cannot be stolen", async () => {
  const { service } = setup(); const attachment = { id: "voice-qa", url: "/api/communications/attachments/voice-qa/raw", contentType: "audio/webm", sizeBytes: 100, durationMs: 1000 };
  await service.registerAttachment("alice", attachment); await service.authorizeAttachment("alice", attachment.id); await rejects(service.authorizeAttachment("bob", attachment.id), 403);
  await rejects(service.send("bob", send("alice", undefined, { body: "", attachmentId: attachment.id })), 403);
  await service.send("alice", send("bob", undefined, { body: "", attachmentId: attachment.id })); assert.equal((await service.authorizeAttachment("bob", attachment.id)).id, attachment.id); await rejects(service.authorizeAttachment("charlie", attachment.id), 403);
});
test("audio validation checks actual container, supported MIME, bytes and duration", () => {
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 1]); assert.deepEqual(validateAudio("audio/webm;codecs=opus", webm, 1234), { contentType: "audio/webm", durationMs: 1234 });
  assert.throws(() => validateAudio("audio/webm", Buffer.from("<html>fake</html>"), 100), (e) => e instanceof CommunicationError && e.status === 415);
  assert.throws(() => validateAudio("audio/webm", Buffer.alloc(MAX_AUDIO_BYTES + 1), 100), (e) => e instanceof CommunicationError && e.status === 413); assert.throws(() => validateAudio("audio/webm", webm, 120001), (e) => e instanceof CommunicationError && e.status === 413);
  assert.throws(() => validateAudio("text/html", webm, 100), (e) => e instanceof CommunicationError && e.status === 415);
});
test("incoming call rings receiver; only recipient accepts and unrelated admin is denied", async () => {
  const { service } = setup(); const { call } = await service.startCall("alice", { peerId: "bob", mode: "video", requestId: "synthetic-call-request" });
  assert.equal((await service.calls("bob")).calls[0]?.status, "ringing"); assert.equal((await service.calls("charlie")).calls.length, 0);
  await rejects(service.updateCall("alice", call.id, { status: "accepted" }), 403); await rejects(service.updateCall("charlie", call.id, { status: "ended" }), 403);
  assert.equal((await service.updateCall("bob", call.id, { status: "accepted" })).call.status, "accepted"); assert.equal((await service.updateCall("alice", call.id, { status: "ended" })).call.status, "ended"); assert.equal((await service.calls("bob")).calls.length, 0);
});
test("call retries are idempotent, busy rejected and ringing expires", async () => {
  const { service, advance } = setup(); const input = { peerId: "bob", mode: "audio", requestId: "synthetic-call-request" }; const first = await service.startCall("alice", input); assert.equal((await service.startCall("alice", input)).call.id, first.call.id);
  await rejects(service.startCall("charlie", { ...input, requestId: "another-call-request" }), 409); advance(60_001); assert.deepEqual((await service.calls("bob")).calls, []); await rejects(service.updateCall("bob", first.call.id, { status: "accepted" }), 409);
});
test("signaling is authenticated, directional, bounded, idempotent and cursor-based", async () => {
  const { service, advance } = setup(); const { call } = await service.startCall("alice", { peerId: "bob", mode: "video", requestId: "synthetic-call-request" });
  const offer = { requestId: "synthetic-offer-request", type: "offer", payload: { type: "offer", sdp: "v=0\r\n" } };
  await rejects(service.signal("charlie", call.id, offer), 403); await rejects(service.signal("bob", call.id, offer), 403);
  const sent = await service.signal("alice", call.id, offer); assert.equal((await service.signal("alice", call.id, offer)).signal.id, sent.signal.id);
  const received = await service.signals("bob", call.id, ""); assert.equal(received.signals.length, 1); assert.equal((await service.signals("bob", call.id, received.cursor)).signals.length, 0); assert.equal((await service.signals("alice", call.id, "")).signals.length, 0);
  await rejects(service.signal("bob", call.id, { requestId: "synthetic-answer-request", type: "answer", payload: { type: "answer", sdp: "v=0" } }), 403);
  await service.updateCall("bob", call.id, { status: "accepted" }); advance(); await service.signal("bob", call.id, { requestId: "synthetic-answer-request", type: "answer", payload: { type: "answer", sdp: "v=0" } }); assert.equal((await service.signals("alice", call.id, "")).signals[0]?.type, "answer");
  await rejects(service.signal("alice", call.id, { ...offer, requestId: "oversized-offer-request", payload: { type: "offer", sdp: "x".repeat(70_000) } }), 413);
  await service.updateCall("bob", call.id, { status: "ended" }); await rejects(service.signal("alice", call.id, offer), 409);
});
test("ICE config honestly identifies missing relay and excludes arbitrary protocols", () => {
  assert.deepEqual(rtcConfiguration(undefined), { iceServers: [], relayConfigured: false }); assert.equal(rtcConfiguration("invalid-json").relayConfigured, false);
  assert.deepEqual(rtcConfiguration(JSON.stringify([{ urls: "https://private.example.invalid" }])), { iceServers: [], relayConfigured: false });
  assert.equal(rtcConfiguration(JSON.stringify([{ urls: "turn:relay.example.invalid:3478", username: "synthetic", credential: "synthetic" }])).relayConfigured, true);
});
test("TURN REST credentials expire after one hour, are scoped to session user, and never expose secret", () => {
  const now = 1_800_000_000_123; const secret = "synthetic-shared-secret-used-only-by-test";
  const first = rtcConfiguration(undefined, { turnUrls: "turn:relay.example.invalid:3478,turns:relay.example.invalid:5349", turnSecret: secret, userId: "alice", now });
  const second = rtcConfiguration(undefined, { turnUrls: "turn:relay.example.invalid:3478", turnSecret: secret, userId: "bob", now });
  assert.equal(first.relayConfigured, true); assert.equal(first.expiresAt, 1_800_003_600_000); assert.equal(first.iceServers[0]?.username, "1800003600:alice");
  assert.equal(first.iceServers[0]?.credential, createHmac("sha1", secret).update("1800003600:alice").digest("base64")); assert.notEqual(first.iceServers[0]?.credential, second.iceServers[0]?.credential); assert.ok(!JSON.stringify(first).includes(secret));
  assert.equal(rtcConfiguration(undefined, { turnUrls: "turn:relay.example.invalid", userId: "alice", now }).relayConfigured, false);
});
test("generic sync bootstrap excludes private comm collections before role ACL and identity enumeration", () => {
  const source = readFileSync(new URL("../routes/sync.ts", import.meta.url), "utf8");
  const filterAt = source.indexOf('!record.collection.startsWith("comm.")'); const ownerAt = source.indexOf("const ownerIds", source.indexOf('"/sync/bootstrap"'));
  assert.ok(filterAt > 0 && filterAt < ownerAt, "Private communication filter must precede generic overseer/member ACL and identity hydration");
  const allowedSection = source.slice(source.indexOf("const COLLECTIONS"), source.indexOf("const COLLECTIONS") + 3000); assert.ok(!allowedSection.includes('"comm.message.v1"'));
});
