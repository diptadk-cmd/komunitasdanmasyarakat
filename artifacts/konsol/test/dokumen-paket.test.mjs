import assert from "node:assert/strict";
import { once } from "node:events";
import { Writable } from "node:stream";
import test from "node:test";

import { dokumenPaketUrl } from "../src/lib/dokumen-paket.ts";
import { dokumenPaketAssets } from "../vite.config.ts";

function setupMiddleware(base = "/konsol/") {
  const plugin = dokumenPaketAssets();
  let middleware;
  plugin.configureServer({
    config: { base },
    middlewares: {
      use(handler) {
        middleware = handler;
      },
    },
  });
  assert.equal(typeof middleware, "function");
  return middleware;
}

function responseStream() {
  const chunks = [];
  const headers = new Map();
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  response.statusCode = 200;
  response.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
  return {
    body: () => Buffer.concat(chunks).toString("utf8"),
    headers,
    response,
  };
}

test("URL paket dokumen selalu mengikuti base path Konsol", () => {
  assert.equal(
    dokumenPaketUrl("/konsol/", "mandiri-non-bh"),
    "/konsol/dokumen-paket/mandiri-non-bh.json",
  );
  assert.equal(
    dokumenPaketUrl("/konsol", "paket dengan spasi"),
    "/konsol/dokumen-paket/paket%20dengan%20spasi.json",
  );
});

test("middleware menyajikan katalog JSON di bawah base path", async () => {
  const middleware = setupMiddleware();
  const { body, headers, response } = responseStream();
  let nextCalled = false;

  middleware(
    { url: "/konsol/dokumen-paket/mandiri-non-bh.json" },
    response,
    () => {
      nextCalled = true;
    },
  );
  await once(response, "finish");

  assert.equal(nextCalled, false);
  assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  const paket = JSON.parse(body());
  assert.equal(paket.paketId, "mandiri-non-bh");
  assert.ok(paket.dokumen.length > 0);
});

test("middleware menolak lintasan keluar direktori katalog", () => {
  const middleware = setupMiddleware();
  const { response } = responseStream();
  let nextCalled = false;

  middleware(
    { url: "/konsol/dokumen-paket/%2e%2e/rahasia.json" },
    response,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
});
