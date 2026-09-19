import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const quick = process.argv.includes("--quick");
const reportDir = path.join(root, "output", "test-reports");
await mkdir(reportDir, { recursive: true });
const checks = [
  { id: "unit", label: "Logika, dokumen, API & regresi", args: ["pnpm", "-r", "--if-present", "run", "test"] },
  { id: "routes", label: "Cakupan rute dan menu", args: ["pnpm", "run", "test:navigation"] },
  { id: "types", label: "TypeScript seluruh workspace", args: ["pnpm", "run", "typecheck"] },
  { id: "build", label: "Build produksi kedua aplikasi dan API", args: ["pnpm", "run", "build:production"] },
  { id: "e2e", label: "Browser: 9 peran, navigasi, desktop & ponsel", args: ["pnpm", "run", "test:e2e"], omit: quick },
];
const results = [];
for (const check of checks) {
  if (check.omit) { results.push({ ...check, status: "belum dijalankan", seconds: 0 }); continue; }
  console.log(`\n▶ ${check.label}`);
  const started = Date.now();
  let output = "";
  const code = await new Promise(resolve => {
    const child = spawn(process.platform === "win32" ? "corepack.cmd" : "corepack", check.args, { cwd: root, shell: process.platform === "win32", env: process.env });
    child.stdout.on("data", data => { const chunk = data.toString(); output += chunk; process.stdout.write(chunk); });
    child.stderr.on("data", data => { const chunk = data.toString(); output += chunk; process.stderr.write(chunk); });
    child.on("error", error => { output += error.message; resolve(1); });
    child.on("close", code => resolve(code ?? 1));
  });
  await writeFile(path.join(reportDir, `${check.id}.log`), output);
  const counts = [...output.matchAll(/# (tests|pass|fail|skipped) (\d+)/g)].reduce((sum, [, name, count]) => ({ ...sum, [name]: (sum[name] ?? 0) + Number(count) }), {});
  results.push({ id: check.id, label: check.label, status: code === 0 ? "lulus" : "gagal", exitCode: code, seconds: Math.round((Date.now() - started) / 1000), counts });
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const generatedAt = new Date().toISOString();
const browserReportLink = quick ? "Browser belum dijalankan pada pengujian ini" : '<a href="e2e/html/index.html">Laporan browser</a>';
await writeFile(path.join(reportDir, "summary.json"), JSON.stringify({ generatedAt, mode: quick ? "quick" : "all", results }, null, 2));
await writeFile(path.join(reportDir, "index.html"), `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hasil pengujian JakSanggar</title><style>body{font:15px/1.6 system-ui;background:#f4f7fa;color:#123047;max-width:1000px;margin:40px auto;padding:24px}h1{font-size:30px}table{width:100%;border-collapse:collapse;background:white}th,td{padding:14px;text-align:left;border-bottom:1px solid #dce6eb}a{color:#147d73}.lulus{color:#09634e}.gagal{color:#aa2727}small{color:#526775}</style><h1>Hasil pengujian JakSanggar</h1><p>${escape(generatedAt)} · Mode ${quick ? "cepat, tanpa browser" : "lengkap"}</p><table><tr><th>Pemeriksaan</th><th>Hasil</th><th>Waktu</th><th>Bukti</th></tr>${results.map(r => `<tr><td>${escape(r.label)}</td><td class="${escape(r.status)}">${escape(r.status)}${r.counts?.skipped ? ` (${r.counts.skipped} tes bersyarat dilewati)` : ""}</td><td>${r.seconds} dtk</td><td>${r.status === "belum dijalankan" ? "—" : `<a href="${r.id}.log">Log</a>`}</td></tr>`).join("")}</table><p>${browserReportLink} · <a href="summary.json">Ringkasan JSON</a></p><p><small>Kelulusan tes lokal tidak membuktikan semua alur produksi. Integrasi MariaDB, email, kamera, GPS, unggahan server dan panggilan memerlukan lingkungan uji/perangkat yang sesuai. Lihat docs/PETA-PENGUJIAN.md dan docs/PENGUJIAN.md.</small></p></html>`);
console.log(`\nLaporan: ${path.join(reportDir, "index.html")}`);
process.exitCode = results.some(r => r.status === "gagal") ? 1 : 0;

