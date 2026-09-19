import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { createLocalDocumentRenderMiddleware, localRendererURL, LOCAL_DOCUMENT_LIMIT } from "../config/local-document-renderer.ts";

const native = { format: "pdf", html: "", nativeTemplate: { groupId: "mandiri-nonbadan-hukum", documentId: "data-induk-sanggar", values: { NAMA: "Sanggar Uji" } } };

async function request(options = {}) {
  const calls = [];
  const body = options.body ?? JSON.stringify(native);
  const req = Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(body)]);
  req.method = options.method ?? "POST";
  req.url = options.url ?? "/api/documents/render";
  req.socket = { remoteAddress: options.address ?? "127.0.0.1" };
  req.headers = { host: "localhost:5180", origin: "http://localhost:5180", "content-type": "application/json", ...options.headers };
  const res = { statusCode: 200, headers: {}, body: null, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(value) { this.body = value; } };
  let next = 0;
  const fetcher = options.fetcher ?? (async (url, init) => { calls.push({ url, init }); return new Response("%PDF-local-test", { headers: { "content-type": "application/pdf" } }); });
  const middleware = createLocalDocumentRenderMiddleware({ fetcher, rendererUrl: options.rendererUrl });
  await middleware(req, res, () => { next++; });
  return { res, next, calls };
}

test("middleware hanya menangani POST endpoint dokumen", async () => {
  for (const options of [{ url: "/api/auth/login" }, { method: "GET" }, { url: "/api/documents/render-extra" }]) {
    const result = await request(options);
    assert.equal(result.next, 1);
    assert.equal(result.calls.length, 0);
    assert.equal(result.res.body, null);
  }
});

test("generator demo menolak alamat jaringan, host asing, origin asing dan port origin berbeda", async () => {
  for (const options of [
    { address: "192.168.1.20" },
    { headers: { host: "example.invalid:5180" } },
    { headers: { origin: "https://example.invalid" } },
    { headers: { origin: "http://localhost:9000" } },
    { headers: { origin: "null" } },
    { headers: { origin: undefined, "sec-fetch-site": "cross-site" } },
  ]) {
    const result = await request(options);
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.calls.length, 0);
  }
});

test("target renderer hanya HTTP loopback /render dan tidak menerima redirect remote", () => {
  assert.equal(localRendererURL(), "http://127.0.0.1:3001/render");
  assert.equal(localRendererURL("http://[::1]:3001/render"), "http://[::1]:3001/render");
  for (const target of ["https://localhost:3001/render", "http://renderer:3001/render", "http://localhost.example.invalid/render", "http://localhost:3001/other", "http://user:password@localhost:3001/render", "http://127.0.0.1:3001/render?url=external"]) {
    assert.throws(() => localRendererURL(target), /loopback/);
  }
});

test("request harus JSON template native Word/PDF tanpa HTML arbitrer", async () => {
  const nonJson = await request({ headers: { "content-type": "text/plain" } });
  assert.equal(nonJson.res.statusCode, 415);
  for (const body of ["broken JSON", "[]", JSON.stringify({ format: "pdf", html: "<h1>HTML</h1>" }), JSON.stringify({ ...native, html: "<p>HTML</p>" }), JSON.stringify({ ...native, format: "xlsx" }), JSON.stringify({ ...native, format: ["pdf"] }), JSON.stringify({ ...native, nativeTemplate: { ...native.nativeTemplate, groupId: "../outside" } }), JSON.stringify({ ...native, nativeTemplate: { ...native.nativeTemplate, values: { NAMA: 123 } } })]) {
    const result = await request({ body });
    assert.equal(result.res.statusCode, 400);
    assert.equal(result.calls.length, 0);
  }
});

test("batas 8 MB berlaku pada Content-Length dan body stream tanpa header ukuran", async () => {
  for (const options of [
    { headers: { "content-length": String(LOCAL_DOCUMENT_LIMIT + 1) } },
    { body: Buffer.alloc(LOCAL_DOCUMENT_LIMIT + 1, 32) },
  ]) {
    const result = await request(options);
    assert.equal(result.res.statusCode, 413);
    assert.equal(result.calls.length, 0);
  }
});

test("template lokal diteruskan tanpa cookie, header auth atau HTML dan mengembalikan dokumen", async () => {
  for (const format of ["word", "pdf"]) {
    const result = await request({ address: "::ffff:127.0.0.1", body: JSON.stringify({ ...native, format, title: "tidak perlu diteruskan" }), headers: { cookie: "session=local-fixture", authorization: "Bearer local-fixture" } });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].url, "http://127.0.0.1:3001/render");
    assert.deepEqual(JSON.parse(result.calls[0].init.body), { format, nativeTemplate: native.nativeTemplate });
    assert.deepEqual(result.calls[0].init.headers, { "Content-Type": "application/json" });
    assert.equal(result.calls[0].init.redirect, "error");
    assert.equal(result.res.headers["cache-control"], "no-store");
    assert.equal(result.res.body.toString(), "%PDF-local-test");
  }
});

test("renderer tidak tersedia menghasilkan 503 JSON yang jelas, bukan fallback SPA", async () => {
  const result = await request({ fetcher: async () => { throw new Error("connect refused"); } });
  assert.equal(result.res.statusCode, 503);
  assert.match(result.res.headers["content-type"], /application\/json/);
  assert.match(JSON.parse(result.res.body).error, /Generator dokumen lokal belum tersedia/);
});

test("status validasi renderer dipertahankan untuk template yang tidak dikenali", async () => {
  const result = await request({ fetcher: async () => new Response(JSON.stringify({ error: "Template tidak ditemukan" }), { status: 400, headers: { "content-type": "application/json" } }) });
  assert.equal(result.res.statusCode, 400);
  assert.equal(JSON.parse(result.res.body).error, "Template tidak ditemukan");
});
