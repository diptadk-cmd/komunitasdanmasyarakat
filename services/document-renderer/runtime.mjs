import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const directory = path.dirname(fileURLToPath(import.meta.url));
const catalogs = new Map();
const officeChecks = new Map();
export const serviceName = "jaksanggar-document-renderer";
export const badInput = (message) =>
  Object.assign(new Error(message), { status: 400 });
export const unavailable = (message) =>
  Object.assign(new Error(message), { status: 503 });

export function nativeTemplateRoot() {
  return path.resolve(
    process.env.NATIVE_TEMPLATE_ROOT ||
      path.join(directory, "../../artifacts/jak-sanggar/public/dokumen-fix"),
  );
}

export function templatePath(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath.endsWith(".docx"))
    throw badInput("Jalur template tidak valid.");
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), resolved);
  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  )
    throw badInput("Jalur template di luar katalog.");
  return resolved;
}

export async function loadNativeCatalog(root = nativeTemplateRoot()) {
  if (!catalogs.has(root)) {
    const pending = fs
      .readFile(path.join(root, "catalog.json"), "utf8")
      .then((text) => {
        const catalog = JSON.parse(text.replace(/^\uFEFF/, ""));
        if (
          !Array.isArray(catalog.groups) ||
          !catalog.groups.length ||
          catalog.groups.some((group) => !Array.isArray(group.documents))
        )
          throw new Error("Katalog template tidak valid.");
        return catalog;
      })
      .catch((error) => {
        catalogs.delete(root);
        throw error;
      });
    catalogs.set(root, pending);
  }
  return catalogs.get(root);
}

export function libreOfficeCandidates() {
  if (process.env.LIBREOFFICE_PATH) return [process.env.LIBREOFFICE_PATH];
  if (process.platform === "win32") {
    return [
      ...new Set([
        path.join(
          process.env.ProgramFiles || "C:\\Program Files",
          "LibreOffice/program/soffice.com",
        ),
        path.join(
          process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
          "LibreOffice/program/soffice.com",
        ),
        "soffice.com",
      ]),
    ];
  }
  return process.platform === "darwin"
    ? [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "libreoffice",
        "soffice",
      ]
    : ["/usr/bin/libreoffice", "libreoffice", "soffice"];
}

export async function libreOfficeStatus() {
  const candidates = libreOfficeCandidates();
  const key = JSON.stringify(candidates);
  // Successful probes are stable until restart. Missing tools can be installed
  // while this service is running, so failed probes are not cached.
  if (!officeChecks.has(key)) {
    const pending = (async () => {
      for (const executable of candidates) {
        try {
          const { stdout, stderr } = await execute(executable, ["--version"], {
            timeout: 10_000,
            maxBuffer: 64 * 1024,
            windowsHide: true,
          });
          const version = `${stdout}\n${stderr}`.trim();
          if (/LibreOffice/i.test(version))
            return { available: true, executable, version };
        } catch {
          /* Try the next standard installation path. */
        }
      }
      return {
        available: false,
        error:
          "LibreOffice belum tersedia. Pasang LibreOffice atau atur LIBREOFFICE_PATH.",
      };
    })();
    officeChecks.set(key, pending);
  }
  const result = await officeChecks.get(key);
  if (!result.available) officeChecks.delete(key);
  return result;
}

export function officePdfArguments(directory, file) {
  return [
    `-env:UserInstallation=${pathToFileURL(path.join(directory, "profile")).href}`,
    "--headless",
    "--nologo",
    "--nodefault",
    "--nofirststartwizard",
    "--convert-to",
    "pdf:writer_pdf_Export",
    "--outdir",
    directory,
    file,
  ];
}

export async function convertNativePdf(directory, file) {
  const office = await libreOfficeStatus();
  if (!office.available) throw unavailable(office.error);
  try {
    await execute(office.executable, officePdfArguments(directory, file), {
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const output = await fs.readFile(path.join(directory, "document.pdf"));
    if (output.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("Hasil konversi bukan PDF.");
    return output;
  } catch (error) {
    if (error.killed || error.code === "ETIMEDOUT")
      throw Object.assign(
        new Error("Konversi PDF melewati batas waktu. Coba kembali."),
        { status: 504 },
      );
    throw new Error("LibreOffice tidak berhasil menghasilkan PDF.", {
      cause: error,
    });
  }
}

export async function removeNativeTemp(directory) {
  const resolved = path.resolve(directory);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (
    !relative.startsWith("sanggar-native-") ||
    relative.includes(path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error("Direktori sementara renderer tidak valid.");
  await fs.rm(resolved, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}

export async function rendererHealth() {
  const root = nativeTemplateRoot();
  const libreOffice = await libreOfficeStatus();
  let nativeTemplates;
  try {
    const catalog = await loadNativeCatalog(root);
    const documents = catalog.groups.flatMap((group) => group.documents);
    const missing = [];
    await Promise.all(
      documents.map(async (item) => {
        try {
          await fs.access(templatePath(root, item.path));
        } catch {
          missing.push(item.path);
        }
      }),
    );
    nativeTemplates = {
      available: documents.length > 0 && missing.length === 0,
      root,
      groups: catalog.groups.length,
      documents: documents.length,
      missing,
    };
  } catch (error) {
    nativeTemplates = {
      available: false,
      root,
      groups: 0,
      documents: 0,
      error: error.message,
    };
  }
  return {
    service: serviceName,
    ok: nativeTemplates.available && libreOffice.available,
    capabilities: {
      nativeWord: nativeTemplates.available,
      nativePdf: nativeTemplates.available && libreOffice.available,
      html: "lazy-browser-not-probed",
    },
    nativeTemplates,
    libreOffice,
  };
}
