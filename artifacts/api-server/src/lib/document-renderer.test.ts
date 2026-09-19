import { test } from "node:test";
import assert from "node:assert/strict";
import { documentRendererUrl } from "./document-renderer";

test("local API reaches the local renderer instead of a Docker-only hostname", () => {
  assert.equal(documentRendererUrl({ NODE_ENV: "development" }), "http://127.0.0.1:3001/render");
  assert.equal(documentRendererUrl({}), "http://127.0.0.1:3001/render");
});
test("production service discovery and explicit renderer configuration are preserved", () => {
  assert.equal(documentRendererUrl({ NODE_ENV: "production" }), "http://renderer:3001/render");
  assert.equal(documentRendererUrl({ NODE_ENV: "production", DOCUMENT_RENDERER_URL: "http://custom:3010/render" }), "http://custom:3010/render");
});
