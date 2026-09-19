import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

const configured = process.env["COMMUNICATIONS_QA_DATABASE_URL"];
test("real API sessions, MariaDB persistence, private audio, presence, calls and generic-sync isolation", { skip: !configured }, async (t) => {
  const target = new URL(configured!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "3308"); assert.equal(target.pathname, "/communications_qa");
  process.env["MARIADB_URL"] = configured;
  process.env["NODE_ENV"] = "test";
  process.env["LOCAL_STORAGE_DIR"] = new URL("../../../../output/communications-qa-uploads", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
  const [{ db, pool, usersTable, syncRecordsTable, sessionsTable, uploadsTable }, { hashPassword, createSession }, { default: app }, { eq, inArray, and }] = await Promise.all([import("@workspace/db"), import("./auth"), import("../app"), import("drizzle-orm")]);
  const ids = { alice: randomUUID(), bob: randomUUID(), outsider: randomUUID(), blocked: randomUUID() };
  const suffix = randomUUID().slice(0, 8); const password = "synthetic-test-only-password"; const passwordHash = await hashPassword(password);
  await db.insert(usersTable).values([
    { id: ids.alice, username: `qa-int-alice-${suffix}`, passwordHash, role: "sanggar", status: "aktif", profile: { namaSanggar: "Sanggar Integrasi", jenisKesenian: ["Tari"], alamat: "Data sintetis", email: "hidden@example.invalid" } },
    { id: ids.bob, username: `qa-int-bob-${suffix}`, passwordHash, role: "seniman", status: "aktif", profile: { nama: "Seniman Integrasi", jenisKesenian: "Tari" } },
    { id: ids.outsider, username: `qa-int-admin-${suffix}`, passwordHash, role: "admin", status: "aktif", profile: { nama: "Admin Luar Percakapan" } },
    { id: ids.blocked, username: `qa-int-blocked-${suffix}`, passwordHash, role: "sanggar", status: "diblokir", profile: { namaSanggar: "Sanggar Diblokir" } },
  ]);
  const tokenEntries = await Promise.all(Object.entries(ids).map(async ([key, id]) => [key, (await createSession(id)).token] as const)); const tokens = Object.fromEntries(tokenEntries);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve)); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const call = async (path: string, who?: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); let data: any; try { data = JSON.parse(text); } catch { data = text; } return { response, data, status: response.status };
  };
  const reqId = () => randomUUID(); let message: any; let attachmentId = ""; let callId = "";
  try {
    await t.test("public directory includes an unmapped registration, excludes blocked roles, and exposes only public fields", async () => {
      const directory = await call("/public/sanggar-directory");
      assert.equal(directory.status, 200); assert.ok(Array.isArray(directory.data));
      const item = directory.data.find((row: any) => row.id === ids.alice);
      assert.deepEqual(item, { id: ids.alice, namaSanggar: "Sanggar Integrasi", jenisKesenian: ["Tari"] });
      assert.ok(!directory.data.some((row: any) => [ids.bob, ids.outsider, ids.blocked].includes(row.id)));
      const allowed = new Set(["id", "namaSanggar", "jenisKesenian", "kelurahan", "kecamatan", "kota", "provinsi", "logoDataUrl", "fotoProfileDataUrl"]);
      assert.ok(directory.data.every((row: any) => Object.keys(row).every((key) => allowed.has(key))));
      assert.deepEqual(directory.data, [...directory.data].sort((a, b) => a.namaSanggar.localeCompare(b.namaSanggar, "id") || a.id.localeCompare(b.id)));
      const map = await call("/public/sanggars"); assert.equal(map.status, 200); assert.ok(!map.data.some((row: any) => row.id === ids.alice));
    });
    await t.test("anonymous and blocked sessions cannot access communications; actual cookie login works", async () => {
      assert.equal((await call("/communications/contacts")).status, 401); assert.equal((await call("/communications/contacts", "blocked")).status, 401);
      const login = await call("/auth/login", undefined, "POST", { username: `qa-int-alice-${suffix}`, password, expectedRole: "sanggar" }); assert.equal(login.status, 200, JSON.stringify(login.data));
      const cookie = login.response.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie);
      const contacts = await fetch(`${base}/communications/contacts`, { headers: { Cookie: cookie! } }); assert.equal(contacts.status, 200); const data = await contacts.json() as any; assert.equal(data.selfId, ids.alice); assert.ok(data.contacts.every((x: any) => !["email", "alamat", "noHp", "username", "passwordHash"].some((key) => key in x)));
    });
    await t.test("server identity rejects forgery; concurrent idempotent sends persist once", async () => {
      assert.equal((await call("/communications/messages", "alice", "POST", { requestId: reqId(), peerId: ids.bob, kind: "chat", body: "forged", senderId: ids.outsider })).status, 403);
      const requestId = reqId(); const payload = { requestId, peerId: ids.bob, kind: "chat", body: "Pesan uji integrasi" };
      const sends = await Promise.all([call("/communications/messages", "alice", "POST", payload), call("/communications/messages", "alice", "POST", payload)]); assert.ok(sends.every((r) => r.status === 201), JSON.stringify(sends.map((r) => r.data))); assert.equal(sends[0]!.data.message.id, sends[1]!.data.message.id); message = sends[0]!.data.message;
      const saved = await db.select().from(syncRecordsTable).where(and(eq(syncRecordsTable.collection, "comm.message.v1"), eq(syncRecordsTable.recordId, message.id))); assert.equal(saved.length, 1);
      assert.equal((await call("/communications/messages", "alice", "POST", { ...payload, body: "different" })).status, 409);
      assert.equal((await call(`/communications/messages?peerId=${ids.alice}&kind=chat`, "bob")).data.messages.length, 1);
      assert.equal((await call(`/communications/messages?peerId=${ids.alice}&kind=chat`, "outsider")).data.messages.length, 0);
    });
    await t.test("inbox/sent plus read-through persist independently", async () => {
      const mail = await call("/communications/messages", "alice", "POST", { requestId: reqId(), peerId: ids.bob, kind: "mail", body: "Surat uji", subject: "Undangan" }); assert.equal(mail.status, 201);
      assert.equal((await call("/communications/mail?folder=inbox", "bob")).data.messages.length, 1); assert.equal((await call("/communications/mail?folder=sent", "alice")).data.messages[0].subject, "Undangan"); assert.equal((await call("/communications/mail?folder=inbox", "alice")).data.messages.length, 0);
      const read = await call("/communications/read", "bob", "POST", { peerId: ids.alice, kind: "chat", through: message.createdAt }); assert.equal(read.status, 200, JSON.stringify(read.data));
      assert.equal((await call("/communications/threads?kind=chat", "bob")).data.threads[0].unread, 0); assert.ok((await call(`/communications/messages?peerId=${ids.bob}&kind=chat`, "alice")).data.messages[0].readAt);
      await call("/communications/read", "bob", "POST", { peerId: ids.alice, kind: "chat", through: message.createdAt - 1 }); assert.ok((await call(`/communications/messages?peerId=${ids.bob}&kind=chat`, "alice")).data.messages[0].readAt);
    });
    await t.test("presence comes from heartbeat; missing TURN configuration is explicit", async () => {
      assert.equal((await call("/communications/presence", "bob", "POST", {})).status, 200); const contacts = await call("/communications/contacts", "alice"); assert.equal(contacts.data.contacts.find((c: any) => c.id === ids.bob).online, true);
      const rtc = await call("/communications/rtc-config", "alice"); assert.equal(rtc.status, 200); assert.equal(rtc.data.relayConfigured, false);
    });
    await t.test("voice file is persistent, private and recipient-authorized with range support", async () => {
      const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 2, 3, 4, 5]); const data = new FormData(); data.append("file", new Blob([bytes], { type: "audio/webm" }), "voice.webm"); data.append("durationMs", "1000");
      const upload = await fetch(`${base}/communications/attachments`, { method: "POST", headers: { Authorization: `Bearer ${tokens.alice}` }, body: data }); const result = await upload.json() as any; assert.equal(upload.status, 201, JSON.stringify(result)); attachmentId = result.attachment.id;
      assert.equal((await call(`/communications/attachments/${attachmentId}/raw`, "bob")).status, 403);
      assert.equal((await call("/communications/messages", "bob", "POST", { requestId: reqId(), peerId: ids.alice, kind: "chat", body: "", attachmentId })).status, 403);
      assert.equal((await call("/communications/messages", "alice", "POST", { requestId: reqId(), peerId: ids.bob, kind: "chat", body: "", attachmentId })).status, 201);
      const raw = await fetch(`${base}/communications/attachments/${attachmentId}/raw`, { headers: { Authorization: `Bearer ${tokens.bob}`, Range: "bytes=0-3" } }); assert.equal(raw.status, 206); assert.deepEqual(new Uint8Array(await raw.arrayBuffer()), bytes.slice(0, 4));
      assert.equal((await call(`/communications/attachments/${attachmentId}/raw`, "outsider")).status, 403); assert.equal((await call(`/communications/attachments/${attachmentId}/raw`)).status, 401);
      for (const who of ["alice", "bob", "outsider"]) {
        assert.equal((await call(`/uploads/${attachmentId}`, who)).status, 403, "Generic upload metadata must not bypass private communications ACL");
        assert.equal((await call(`/uploads/${attachmentId}/raw`, who)).status, 403, "Generic upload download must not bypass private communications ACL");
      }
      assert.equal((await call(`/public/media/${attachmentId}`)).status, 404);
      await db.insert(syncRecordsTable).values({ collection: "infoBudaya", recordId: `qa-private-reference-${suffix}`, scope: "global", ownerId: ids.outsider, participantIds: [], createdBy: ids.outsider, updatedBy: ids.outsider, data: { id: `qa-private-reference-${suffix}`, active: true, publicationStatus: "published", judul: "Private audio reference QA", mediaUrl: `/api/public/media/${attachmentId}` } });
      assert.equal((await call(`/public/media/${attachmentId}`)).status, 404, "Even a published generic media reference cannot publish a private voice message");
      const forged = new FormData(); forged.append("file", new Blob(["<html>not audio</html>"], { type: "audio/webm" }), "fake.webm"); const invalid = await fetch(`${base}/communications/attachments`, { method: "POST", headers: { Authorization: `Bearer ${tokens.alice}` }, body: forged }); assert.equal(invalid.status, 415);
    });
    await t.test("persistent calls ring, signal both ways with ACL, then end", async () => {
      const started = await call("/communications/calls", "alice", "POST", { requestId: reqId(), peerId: ids.bob, mode: "video" }); assert.equal(started.status, 201, JSON.stringify(started.data)); callId = started.data.call.id;
      assert.equal((await call("/communications/calls", "bob")).data.calls[0].id, callId); assert.equal((await call(`/communications/calls/${callId}/signals`, "outsider")).status, 403);
      const offer = { requestId: reqId(), type: "offer", payload: { type: "offer", sdp: "v=0\r\n" } }; const sent = await call(`/communications/calls/${callId}/signals`, "alice", "POST", offer); assert.equal(sent.status, 201, JSON.stringify(sent.data));
      const incoming = await call(`/communications/calls/${callId}/signals`, "bob"); assert.equal(incoming.data.signals.length, 1); assert.equal((await call(`/communications/calls/${callId}/signals?after=${encodeURIComponent(incoming.data.cursor)}`, "bob")).data.signals.length, 0);
      const ice = await Promise.all(Array.from({ length: 8 }, (_, n) => call(`/communications/calls/${callId}/signals`, "alice", "POST", { requestId: reqId(), type: "ice", payload: { candidate: `candidate:${n} 1 udp 1 192.0.2.${n + 1} 5000 typ host`, sdpMid: "0", sdpMLineIndex: 0 } })));
      assert.ok(ice.every((r) => r.status === 201), JSON.stringify(ice.map((r) => r.data)));
      const afterIce = await call(`/communications/calls/${callId}/signals?after=${encodeURIComponent(incoming.data.cursor)}`, "bob"); assert.equal(afterIce.data.signals.length, 8); assert.equal(new Set(afterIce.data.signals.map((s: any) => s.createdAt)).size, 8);
      assert.equal((await call(`/communications/calls/${callId}`, "alice", "PATCH", { status: "accepted" })).status, 403); assert.equal((await call(`/communications/calls/${callId}`, "bob", "PATCH", { status: "accepted" })).status, 200);
      assert.equal((await call(`/communications/calls/${callId}/signals`, "bob", "POST", { requestId: reqId(), type: "answer", payload: { type: "answer", sdp: "v=0\r\n" } })).status, 201); assert.equal((await call(`/communications/calls/${callId}/signals`, "alice")).data.signals[0].type, "answer");
      assert.equal((await call(`/communications/calls/${callId}`, "bob", "PATCH", { status: "ended" })).status, 200); assert.equal((await call("/communications/calls", "alice")).data.calls.length, 0);
    });
    await t.test("generic admin bootstrap does not leak comm messages, audio, calls or signals", async () => {
      const bootstrap = await call("/sync/bootstrap", "outsider"); assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap.data)); assert.ok(bootstrap.data.records.every((r: any) => !r.collection.startsWith("comm.")));
      const forged = await call("/sync/mutations", "outsider", "POST", { mutations: [{ mutationId: reqId(), collection: "comm.message.v1", id: message.id, op: "upsert", data: { body: "stolen" } }] }); assert.equal(forged.status, 200); assert.equal(forged.data.results[0].status, "rejected");
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.delete(syncRecordsTable).where(inArray(syncRecordsTable.ownerId, Object.values(ids)));
    await db.delete(uploadsTable).where(inArray(uploadsTable.uploaderId, Object.values(ids)));
    await db.delete(sessionsTable).where(inArray(sessionsTable.userId, Object.values(ids)));
    await db.delete(usersTable).where(inArray(usersTable.id, Object.values(ids)));
    await pool.end();
  }
});
