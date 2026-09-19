import assert from "node:assert/strict";
import test from "node:test";
import { communicationsApi, mergeCommunicationMessages } from "../src/lib/communications.ts";

test("polling merges server read receipts without duplicating or losing older messages", () => {
  const old = [{ id: "one", createdAt: 1, body: "one" }, { id: "two", createdAt: 2, body: "two" }];
  const merged = mergeCommunicationMessages(old, [{ id: "two", createdAt: 2, body: "two", readAt: 5 }, { id: "three", createdAt: 3, body: "three" }]);
  assert.deepEqual(merged.map((message) => message.id), ["one", "two", "three"]);
  assert.equal(merged[1].readAt, 5);
  assert.equal(old[1].readAt, undefined);
});

test("mail and pair history use isolated server filters with exclusive before cursor", async (t) => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return Response.json({ messages: [], hasMore: false }); };
  t.after(() => { globalThis.fetch = original; });
  await communicationsApi.mail("inbox", 42);
  await communicationsApi.mail("sent");
  await communicationsApi.messages("peer&unsafe", "chat", 50);
  assert.equal(requests[0].url, "/api/communications/mail?folder=inbox&limit=50&before=42");
  assert.equal(requests[1].url, "/api/communications/mail?folder=sent&limit=50");
  assert.equal(new URL(requests[2].url, "https://example.test").searchParams.get("peerId"), "peer&unsafe");
  assert.equal(requests[0].options.credentials, "include");
  assert.equal(requests[0].options.cache, "no-store");
});

test("send preserves idempotency token and explicit receiver; voice upload retains browser multipart boundary", async (t) => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return Response.json(url.endsWith("/attachments") ? { attachment: { id: "audio" } } : { message: { id: "sent" } }); };
  t.after(() => { globalThis.fetch = original; });
  await communicationsApi.send({ requestId: "stable-request", peerId: "receiver", kind: "chat", body: "hello" });
  await communicationsApi.uploadVoice(new Blob(["voice"], { type: "audio/webm" }), 1.25);
  assert.deepEqual(JSON.parse(requests[0].options.body), { requestId: "stable-request", peerId: "receiver", kind: "chat", body: "hello" });
  assert.equal(requests[1].url, "/api/communications/attachments");
  assert.ok(requests[1].options.body instanceof FormData);
  assert.equal(requests[1].options.headers.has("content-type"), false);
  assert.equal(requests[1].options.body.get("durationMs"), "1250");
});

test("missing API HTML response is reported as unavailable instead of fabricated empty mail", async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>app</html>", { headers: { "content-type": "text/html" } });
  t.after(() => { globalThis.fetch = original; });
  await assert.rejects(communicationsApi.contacts(), /Layanan pesan belum tersedia/);
});
