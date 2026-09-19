import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

export const LOCAL_DOCUMENT_LIMIT = 8 * 1024 * 1024;
const endpoint = "/api/documents/render";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function localRendererURL(value = "http://127.0.0.1:3001/render"): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || !localHosts.has(url.hostname) || url.pathname !== "/render" || url.username || url.password || url.search || url.hash) {
    throw new Error("Generator demo harus memakai HTTP loopback dengan path /render.");
  }
  return url.href;
}

function localRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress?.replace(/^::ffff:/, "");
  if (address !== "127.0.0.1" && address !== "::1") return false;
  try {
    const host = new URL(`http://${req.headers.host ?? ""}`);
    if (!localHosts.has(host.hostname) || host.pathname !== "/" || host.username || host.password) return false;
    const origin = req.headers.origin;
    if (!origin) return req.headers["sec-fetch-site"] !== "cross-site";
    const source = new URL(origin);
    return source.protocol === "http:" && localHosts.has(source.hostname) && source.port === host.port && source.origin === origin;
  } catch {
    return false;
  }
}

function reply(res: ServerResponse, status: number, error: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error }));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const clear = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    };
    const onError = (error: Error) => { clear(); reject(error); };
    const onAborted = () => onError(new Error("Permintaan dibatalkan."));
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > LOCAL_DOCUMENT_LIMIT) {
        clear();
        req.resume();
        reject(new RangeError("Dokumen terlalu besar (maksimal 8 MB)."));
        return;
      }
      chunks.push(bytes);
    };
    const onEnd = () => { clear(); resolve(Buffer.concat(chunks)); };
    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
    req.once("aborted", onAborted);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nativePayload(input: unknown) {
  if (!isRecord(input) || (input.format !== "word" && input.format !== "pdf") || (input.html !== undefined && input.html !== "")) return null;
  const native = input.nativeTemplate;
  if (!isRecord(native) || typeof native.groupId !== "string" || typeof native.documentId !== "string") return null;
  if (![native.groupId, native.documentId].every(value => /^[a-z0-9_-]{1,160}$/i.test(value))) return null;
  const values = native.values ?? {};
  if (!isRecord(values) || Object.values(values).some(value => typeof value !== "string" || value.length > 10000)) return null;
  if (native.images !== undefined && !isRecord(native.images)) return null;
  return {
    format: input.format,
    nativeTemplate: {
      groupId: native.groupId,
      documentId: native.documentId,
      values,
      ...(native.images !== undefined ? { images: native.images } : {}),
    },
  };
}

/** Only installed by the local demo Vite server. Production keeps API auth. */
export function createLocalDocumentRenderMiddleware(options: { rendererUrl?: string; fetcher?: typeof fetch } = {}) {
  const rendererUrl = localRendererURL(options.rendererUrl);
  const requestRenderer = options.fetcher ?? fetch;
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    if (req.method !== "POST" || req.url?.split("?")[0] !== endpoint) { next(); return; }
    if (!localRequest(req)) { reply(res, 403, "Generator demo hanya dapat digunakan dari browser lokal."); return; }
    if (req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      reply(res, 415, "Permintaan dokumen harus berupa JSON."); return;
    }
    if (Number(req.headers["content-length"] ?? 0) > LOCAL_DOCUMENT_LIMIT) {
      req.resume(); reply(res, 413, "Dokumen terlalu besar (maksimal 8 MB)."); return;
    }
    let payload;
    try {
      payload = nativePayload(JSON.parse((await readBody(req)).toString("utf8")));
    } catch (error) {
      reply(res, error instanceof RangeError ? 413 : 400, error instanceof RangeError ? error.message : "Isian dokumen tidak valid."); return;
    }
    if (!payload) { reply(res, 400, "Demo lokal hanya mendukung template Word/PDF yang tersedia."); return; }
    try {
      const result = await requestRenderer(rendererUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
        redirect: "error",
      });
      const body = Buffer.from(await result.arrayBuffer());
      res.statusCode = result.status;
      res.setHeader("Content-Type", result.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      res.end(body);
    } catch {
      reply(res, 503, "Generator dokumen lokal belum tersedia. Jalankan layanan renderer lalu coba kembali.");
    }
  };
}

export function localDocumentRendererPlugin(rendererUrl?: string): Plugin {
  return {
    name: "local-demo-native-document-renderer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(createLocalDocumentRenderMiddleware({ rendererUrl }));
    },
  };
}
