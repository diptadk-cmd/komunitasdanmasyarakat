import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { clearRateLimitBucketsForTests, createRateLimit } from "./rate-limit";

function createResponse() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  };

  return {
    response: response as unknown as Response,
    headers,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

test("rate limiter allows requests up to the limit then returns 429", () => {
  clearRateLimitBucketsForTests();
  const middleware = createRateLimit({
    name: "test",
    windowMs: 60_000,
    max: 2,
  });
  const request = {
    ip: "127.0.0.99",
    socket: { remoteAddress: "127.0.0.99" },
  } as Request;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = createResponse();
    let nextCalled = false;
    middleware(request, result.response, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(
      result.headers.get("X-RateLimit-Remaining"),
      String(2 - attempt),
    );
  }

  const blocked = createResponse();
  let nextCalled = false;
  middleware(request, blocked.response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(blocked.statusCode, 429);
  assert.deepEqual(blocked.body, {
    error: "Terlalu banyak percobaan. Coba lagi nanti.",
  });
  assert.equal(blocked.headers.get("Retry-After"), "60");
});
