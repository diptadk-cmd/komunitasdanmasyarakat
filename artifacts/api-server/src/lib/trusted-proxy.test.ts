import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express, { type Express } from "express";
import bcrypt from "bcryptjs";
import { configureTrustedProxy } from "./trusted-proxy";
import { createRateLimit } from "./rate-limit";

async function listen(app: Express) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

test("trusted proxy defaults off and rejects values outside 0 or 1", () => {
  const app = express();
  configureTrustedProxy(app);
  assert.equal(app.get("trust proxy"), false);
  for (const value of ["", "2", "true", "-1", "1.0", " 1"]) {
    assert.throws(() => configureTrustedProxy(app, value), /TRUST_PROXY_HOPS/);
  }
});

test("one proxy hop keeps rate limits separate and ignores client-supplied earlier hops", async () => {
  const app = express();
  configureTrustedProxy(app, "1");
  app.use(createRateLimit({ name: "trusted-hop-http", windowMs: 60_000, max: 1 }));
  app.get("/", (req, res) => res.json({ ip: req.ip, secure: req.secure }));
  const server = await listen(app);
  try {
    const first = await fetch(server.url, { headers: {
      "X-Forwarded-For": "203.0.113.10", "X-Forwarded-Proto": "https",
    } });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { ip: "203.0.113.10", secure: true });
    const repeated = await fetch(server.url, { headers: { "X-Forwarded-For": "203.0.113.10" } });
    assert.equal(repeated.status, 429);
    const other = await fetch(server.url, { headers: { "X-Forwarded-For": "203.0.113.20" } });
    assert.equal(other.status, 200);
    const spoofed = await fetch(server.url, { headers: {
      "X-Forwarded-For": "198.51.100.99, 203.0.113.10",
    } });
    assert.equal(spoofed.status, 429);
  } finally {
    await server.close();
  }
});

test("without a trusted proxy forwarded headers cannot change the rate-limit identity", async () => {
  const app = express();
  configureTrustedProxy(app, "0");
  app.use(createRateLimit({ name: "untrusted-hop-http", windowMs: 60_000, max: 1 }));
  app.get("/", (req, res) => res.json({ ip: req.ip, secure: req.secure }));
  const server = await listen(app);
  try {
    const first = await fetch(server.url, { headers: {
      "X-Forwarded-For": "203.0.113.30", "X-Forwarded-Proto": "https",
    } });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { ip: "127.0.0.1", secure: false });
    const second = await fetch(server.url, { headers: { "X-Forwarded-For": "203.0.113.40" } });
    assert.equal(second.status, 429);
  } finally {
    await server.close();
  }
});

test("production login through the proxy sets a secure cookie and does not return a tab token", async (t) => {
  const keys = ["NODE_ENV", "MARIADB_URL", "TRUST_PROXY_HOPS", "LOCAL_STORAGE_DIR", "S3_ENDPOINT"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env["NODE_ENV"] = "production";
  process.env["MARIADB_URL"] = "mysql://test@127.0.0.1:1/synthetic_test";
  process.env["TRUST_PROXY_HOPS"] = "1";
  process.env["LOCAL_STORAGE_DIR"] = "./.synthetic-test-uploads-unused";
  process.env["S3_ENDPOINT"] = "";
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  const { db, pool } = await import("@workspace/db");
  t.after(async () => { await pool.end(); });
  const user = {
    id: "synthetic-http-test", username: "synthetic-http-test", role: "sanggar",
    status: "aktif", profile: {}, createdAt: new Date(), updatedAt: new Date(),
    passwordHash: await bcrypt.hash("synthetic-test-password", 4),
  };
  // No database connection is made: only this synthetic user and session are used.
  t.mock.method(db, "select", (() => ({ from: () => ({
    where: () => ({ limit: async () => [user] }),
  }) })) as unknown as typeof db.select);
  t.mock.method(db, "insert", (() => ({ values: async () => undefined })) as unknown as typeof db.insert);
  t.mock.method(db, "delete", (() => ({ where: () => Promise.resolve() })) as unknown as typeof db.delete);
  const { default: app } = await import("../app");
  assert.equal(app.get("trust proxy"), 1);
  const server = await listen(app);
  try {
    const response = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", "X-Forwarded-For": "203.0.113.50" },
      body: JSON.stringify({ username: user.username, password: "synthetic-test-password", tabSession: true }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith("jak_session="));
    assert.ok(cookie);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /; SameSite=Lax/);
    assert.match(cookie, /; Path=\//);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body["username"], user.username);
    assert.equal("sessionToken" in body, false);
    assert.equal("passwordHash" in body, false);
  } finally {
    await server.close();
  }
});
