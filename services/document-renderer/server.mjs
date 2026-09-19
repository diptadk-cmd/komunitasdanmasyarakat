import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nativeRender } from "./native-render.mjs";
import { rendererHealth, serviceName, badInput } from "./runtime.mjs";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
let htmlModule;

function respond(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

export function validateRenderInput(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !["word", "pdf"].includes(input.format)
  )
    throw badInput("Format dokumen tidak valid.");
  if (input.nativeTemplate !== undefined) {
    const native = input.nativeTemplate;
    if (
      !native ||
      typeof native !== "object" ||
      Array.isArray(native) ||
      typeof native.groupId !== "string" ||
      typeof native.documentId !== "string"
    )
      throw badInput("Identitas template tidak valid.");
  } else if (typeof input.html !== "string")
    throw badInput("Isi HTML dokumen tidak valid.");
  return input;
}

async function readInput(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0,
      oversized = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (oversized) return;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        reject(
          Object.assign(new Error("Dokumen terlalu besar (maksimal 8 MB)."), {
            status: 413,
          }),
        );
      } else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (oversized) return;
      try {
        resolve(
          validateRenderInput(
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          ),
        );
      } catch (error) {
        reject(
          error instanceof SyntaxError
            ? badInput("JSON dokumen tidak valid.")
            : error,
        );
      }
    });
  });
}

export function createRendererServer() {
  let active = 0;
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      const health = await rendererHealth();
      return respond(res, health.ok ? 200 : 503, health);
    }
    if (req.method !== "POST" || req.url !== "/render")
      return respond(res, 404, { error: "Tidak ditemukan" });
    if (active >= 2)
      return respond(res, 429, {
        error: "Generator sedang digunakan. Coba lagi sebentar.",
      });
    active++;
    try {
      const input = await readInput(req);
      let output;
      if (input.nativeTemplate) output = await nativeRender(input);
      else {
        // Native Word and LibreOffice PDF requests never import or launch a browser.
        htmlModule ??= import("./html-render.mjs");
        output = await (await htmlModule).renderHtml(input);
      }
      res.writeHead(200, {
        "Content-Type":
          input.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Cache-Control": "no-store",
      });
      res.end(output);
    } catch (error) {
      console.error("Document rendering failed:", error.message);
      if (!res.headersSent)
        respond(res, error.status || 500, {
          error: [400, 413, 429, 503, 504].includes(error.status)
            ? error.message
            : "Dokumen belum berhasil dibuat. Periksa isian lalu coba kembali.",
        });
    } finally {
      active--;
    }
  });
  server.requestTimeout = 60_000;
  return server;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const host = process.env.DOCUMENT_RENDERER_HOST || "127.0.0.1";
  const port = Number(
    process.env.DOCUMENT_RENDERER_PORT || process.env.PORT || 3001,
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("DOCUMENT_RENDERER_PORT tidak valid.");
  const server = createRendererServer();
  server.listen(port, host, () =>
    console.log(`${serviceName} listening at http://${host}:${port}`),
  );
  const stop = () => {
    server.close(async () => {
      if (htmlModule) await (await htmlModule).closeHtmlRenderer();
      process.exit(0);
    });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
