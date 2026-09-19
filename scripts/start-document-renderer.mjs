import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const rendererEnvFile = path.join(root, ".env");
if (existsSync(rendererEnvFile)) loadEnvFile(rendererEnvFile);
const healthURL = "http://127.0.0.1:3001/healthz";

export function usesBundledDocumentRenderer(value = process.env.DOCUMENT_RENDERER_URL) {
  if (!value?.trim()) return true;
  const url = new URL(value);
  return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "3001" && url.pathname === "/render";
}

async function rendererStatus() {
  try {
    const response = await fetch(healthURL, { signal: AbortSignal.timeout(1500) });
    // An unhealthy service still owns the port: do not launch a duplicate.
    try { return await response.json(); }
    catch { return { service: "unknown", ok: false }; }
  } catch { return null; }
}

export async function ensureDocumentRenderer() {
  const status = await rendererStatus();
  if (status?.service === "jaksanggar-document-renderer" && status.ok) return status;
  if (status) throw new Error("Port 3001 dipakai layanan lain atau generator belum siap. Periksa output/renderer.log.");
  await mkdir(path.join(root, "output"), { recursive: true });
  const log = await open(path.join(root, "output", "renderer.log"), "a");
  const child = spawn(process.execPath, [path.join(root, "services", "document-renderer", "server.mjs")], {
    cwd: root, detached: true, windowsHide: true,
    stdio: ["ignore", log.fd, log.fd],
    env: { ...process.env, DOCUMENT_RENDERER_HOST: "127.0.0.1", DOCUMENT_RENDERER_PORT: "3001" },
  });
  let launchError;
  child.on("error", error => { launchError = error; });
  child.unref();
  await log.close();
  for (let attempt = 0; attempt < 30; attempt++) {
    if (launchError) throw launchError;
    const ready = await rendererStatus();
    if (ready?.service === "jaksanggar-document-renderer" && ready.ok) return ready;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Generator belum siap. Lihat output/renderer.log; pastikan dependensi dan LibreOffice tersedia.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes("--api") && !usesBundledDocumentRenderer()) {
      console.log("API memakai alamat generator dokumen yang dikonfigurasi; layanan lokal tidak dijalankan.");
    } else {
      await ensureDocumentRenderer();
      console.log("Generator Word/PDF siap di komputer ini (127.0.0.1:3001).");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
