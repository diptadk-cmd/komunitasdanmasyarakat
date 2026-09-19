/** Local-only harness: deliberately absent from the Vite production input. */
import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { LayoutDashboard, Users, CalendarDays, Wallet, FileText, UserCog, Boxes, Handshake, GraduationCap } from "lucide-react";
import "./src/index.css";

if (!["127.0.0.1", "localhost"].includes(location.hostname) || location.port !== "5182") {
  throw new Error("Halaman uji ini hanya boleh dijalankan di localhost:5182.");
}

// Defensive boundary: neither credentials nor application API data are used.
const blocked: string[] = [];
Object.assign(window, { __sanggarQaBlockedRequests: blocked });
const originalFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  const address = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (address.origin !== location.origin || address.pathname.startsWith("/api")) {
    blocked.push(address.pathname);
    return Promise.reject(new Error("API request blocked by local Sanggar QA harness."));
  }
  return originalFetch(input, options);
};
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: unknown[]) {
  const address = new URL(String(url), location.href);
  if (address.origin !== location.origin || address.pathname.startsWith("/api")) {
    blocked.push(address.pathname);
    throw new Error("API request blocked by local Sanggar QA harness.");
  }
  return Reflect.apply(originalOpen, this, [method, url, ...args]);
} as typeof XMLHttpRequest.prototype.open;

const marker = "qa-sanggar-template-v1";
const ownStorage = localStorage.getItem(marker) === "synthetic-only";
if (!ownStorage && localStorage.getItem("jaksanggar_v1")) {
  throw new Error("Origin ini mempunyai data lain. Gunakan profil browser baru untuk uji lokal.");
}
const { setStoreDemoMode, load, save, SESSION_STORAGE_KEY } = await import("@/lib/store");
const { AuthProvider, useAuth } = await import("@/lib/auth");
const { AppShell } = await import("@/components/layout/AppShell");
const { TooltipProvider } = await import("@/components/ui/tooltip");
const { Toaster } = await import("@/components/ui/toaster");
const { default: SanggarHome } = await import("@/pages/sanggar/SanggarHome");
const userId = "qa-sanggar-template-local";
setStoreDemoMode(true);
if (!ownStorage || new URLSearchParams(location.search).has("reset")) {
  const now = Date.now();
  const day = 86_400_000;
  load();
  save((db) => {
    // Remove every seeded record before inserting explicitly synthetic rows.
    for (const key of Object.keys(db)) {
      if (Array.isArray((db as unknown as Record<string, unknown>)[key])) {
        (db as unknown as Record<string, unknown>)[key] = [];
      }
    }
    const base = { password: "LOCAL_QA_DISABLED", createdAt: now, statusModerasiAkun: "aktif" as const };
    db.users = [{
      ...base, id: userId, role: "sanggar", username: "qa.sanggar.local",
      namaSanggar: "Sanggar Rona Budaya", namaKetua: "Ketua Pengujian",
      email: "sanggar@example.test", noHp: "081200000000", legalitas: "Non-Badan Hukum",
      jenisPemilik: "organisasi", bentukKedudukan: "mandiri-non-bh",
      jenisKesenian: ["Tari", "Musik"], alamat: "Jalan Contoh No. 10, Jakarta",
      rekening: { bank: "DKI", nomor: "0000000000", atasNama: "Sanggar Uji" },
      saldo: 2_850_000, editCount: 0, editPeriodStart: now, tahunBerdiri: 2020,
      deskripsi: "Ruang belajar dan berkarya seni. Seluruh data pada halaman ini adalah data pengujian sintetis.",
    }, ...Array.from({ length: 12 }, (_, index) => ({
      ...base, id: `qa-seniman-${index}`, role: "seniman" as const, username: `qa.anggota${index}`,
      nama: `Anggota Contoh ${index + 1}`, sanggarId: userId, status: index < 10 ? "aktif" as const : "pending" as const,
      jenisKesenian: "Tari" as const, usia: 20 + index, pendidikan: "SMA", iuranBulanan: 50_000,
      rekening: { bank: "DKI" as const, nomor: "0000000000", atasNama: "Anggota Uji" },
    }))];
    db.latihan = [1, 3, 6].map((offset, index) => ({
      id: `qa-latihan-${index}`, sanggarId: userId, tanggal: new Date(now + offset * day).toISOString().slice(0, 10),
      jam: "16:00", tempat: "Ruang Latihan Contoh", kurikulum: ["Tari Topeng Betawi", "Musik Gambang Kromong", "Latihan Bersama"][index], ciriAdat: "Betawi",
    }));
    db.kas = Array.from({ length: 6 }, (_, index) => ({
      id: `qa-kas-${index}`, sanggarId: userId, tanggal: now - (5 - index) * day * 7,
      keterangan: "Transaksi sintetis", debit: 600_000, kredit: 125_000,
      saldo: (index + 1) * 475_000, refType: "manual", refId: `qa-ref-${index}`,
    }));
    db.appearance.theme = "light";
    db.appearance.themePreset = "light";
    db.appearance.dark = false;
    db.appearance.highContrast = false;
    db.appearance.brand = { ...db.appearance.brand, appName: "JAK SANGGAR", appTagline: "Ruang tumbuh seni dan budaya" };
    db.appearance.tradisi = { ...db.appearance.tradisi, enabled: false };
    db.paketIsian = {};
  });
  localStorage.setItem(marker, "synthetic-only");
}
sessionStorage.setItem(SESSION_STORAGE_KEY, userId);

const navigation = [
  ["Beranda", "/sanggar", LayoutDashboard], ["Keanggotaan", "/sanggar/keanggotaan", Users],
  ["Latihan", "/sanggar/latihan", CalendarDays], ["Buku Kas", "/sanggar/buku-kas", Wallet],
  ["Pembinaan", "/sanggar/pembinaan", GraduationCap], ["Aset & Sarana", "/sanggar/aset", Boxes],
  ["Kerjasama", "/sanggar/kerjasama", Handshake], ["Dokumen", "/sanggar/dokumen", FileText],
  ["Profil Sanggar", "/sanggar/profil", UserCog],
] as const;
const { hook } = memoryLocation({ path: "/sanggar" });
function ReadyDashboard() {
  const { ready } = useAuth();
  if (!ready) return <p>Menyiapkan data pengujian lokal…</p>;
  return <AppShell nav={navigation.map(([label, href, Icon]) => ({ label, href, icon: <Icon className="h-4 w-4" /> }))}>
    <SanggarHome />
  </AppShell>;
}
createRoot(document.getElementById("root")!).render(
  <Router hook={hook}>
    <TooltipProvider><AuthProvider demoMode><ReadyDashboard /><Toaster /></AuthProvider></TooltipProvider>
  </Router>,
);
