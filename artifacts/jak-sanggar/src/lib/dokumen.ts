// Helper bersama untuk kop surat & blok tanda tangan pada dokumen cetak
// Sanggar. Format mengikuti Tata Naskah Dinas Pemerintah Provinsi DKI Jakarta.
// Referensi: Pergub DKI tentang Tata Naskah Dinas.
import type { SanggarUser, TataNaskahSettings } from "./types";
import type { KopSurat, BlokTtd } from "./pdf";
import {
  kopSuratDkiHtml,
  kopGambarHtml,
  ttdDkiHtml,
  gambarSah,
  type OpsiStempel,
} from "./dokumen-dki";
import { load } from "./store";

// Re-export safeHtml/rawHtml dari print.ts untuk kompatibilitas
export { safeHtml, rawHtml } from "./print";
import { safeHtml } from "./print";

// Bila belum dipilih, sanggar diperlakukan sebagai organisasi (nilai default
// pada form profil) — kop surat tampil sampai pemilik menyatakan Perorangan.
export function isOrganisasi(sg: SanggarUser): boolean {
  return (sg.jenisPemilik ?? "organisasi") === "organisasi";
}

export function jabatanPemilik(sg: SanggarUser): string {
  return isOrganisasi(sg) ? "Ketua Sanggar" : "Pemilik";
}

/** Jabatan beserta nama lembaga tanpa menghasilkan "Sanggar Sanggar". */
export function jabatanPemilikDenganNama(sg: SanggarUser): string {
  const jabatan = jabatanPemilik(sg);
  const nama = sg.namaSanggar.trim();
  const jabatanRapi = /^sanggar\b/i.test(nama)
    ? jabatan.replace(/\s+sanggar$/i, "")
    : jabatan;
  return `${jabatanRapi} ${nama}`.trim();
}

export function tanggalCetak(): string {
  return new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Baris kontak & daring (TANPA alamat) untuk kop surat. */
function barisKontak(sg: SanggarUser): string[] {
  const kontak = [
    sg.noHp?.trim() ? `Telp: ${sg.noHp.trim()}` : "",
    sg.email?.trim() ? `Email: ${sg.email.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const daring = [
    sg.website?.trim() ? `Website: ${sg.website.trim()}` : "",
    sg.instagram?.trim() ? `Instagram: ${sg.instagram.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return [kontak, daring].filter(Boolean);
}

function barisKop(sg: SanggarUser): string[] {
  // Alamat + baris kontak, untuk pemakai yang butuh seluruh baris kop (PDF).
  return [sg.alamat?.trim() ?? "", ...barisKontak(sg)].filter(Boolean);
}

/** Kop surat untuk PDF — undefined bila pemilik profil Perorangan. */
export function kopSanggar(sg: SanggarUser): KopSurat | undefined {
  if (!isOrganisasi(sg)) return undefined;
  return {
    nama: sg.namaSanggar,
    baris: barisKop(sg),
    logoDataUrl: sg.logoDataUrl ?? sg.fotoProfileDataUrl,
    kopDataUrl: gambarSah(sg.kopSuratDataUrl) ? sg.kopSuratDataUrl : undefined,
  };
}

/** Blok tanda tangan untuk PDF — selalu ada, apa pun jenis pemiliknya. */
export function ttdSanggar(sg: SanggarUser): BlokTtd {
  return {
    kota: "Jakarta",
    tanggal: tanggalCetak(),
    jabatan: jabatanPemilik(sg),
    nama: sg.namaKetua,
  };
}

/** Opsi siap-spread untuk downloadLockedPdf: { kop?, ttd }. */
export function dokumenSanggarPdf(sg: SanggarUser): {
  kop?: KopSurat;
  ttd: BlokTtd;
} {
  return { kop: kopSanggar(sg), ttd: ttdSanggar(sg) };
}

/**
 * Kop surat varian HTML untuk openPrintWindow.
 * Format mengikuti Tata Naskah Dinas DKI Jakarta:
 * - Nama sanggar (tebal, tengah, kapital)
 * - Alamat dan kontak di bawah nama
 * - Garis pembatas: hitam tebal + merah tipis
 * Kosong bila Perorangan.
 */
/**
 * Pengaturan Tata Naskah Dinas yang ditetapkan kurator.
 * Dibaca dari store bersama; aman dipanggil kapan pun karena selalu
 * mengembalikan objek (kosong bila belum pernah diatur).
 */
export function tataNaskah(): TataNaskahSettings {
  try {
    return load().appearance?.tataNaskah ?? {};
  } catch {
    return {};
  }
}

/** Opsi stempel siap pakai dari pengaturan kurator (undefined bila nonaktif). */
export function opsiStempel(): OpsiStempel | undefined {
  const t = tataNaskah();
  if (!t.pakaiStempel || !gambarSah(t.stempelDataUrl)) return undefined;
  return {
    dataUrl: t.stempelDataUrl,
    lebarMm: t.stempelLebarMm,
    opacity: t.stempelOpacity,
    posisi: t.stempelPosisi,
  };
}

/**
 * Kop surat varian HTML untuk openPrintWindow.
 *
 * Urutan prioritas:
 *   1. Berkas kop surat utuh yang diunggah Sanggar.
 *   2. Berkas kop surat default yang diunggah kurator.
 *   3. Kop tersusun: logo (kurator → profil sanggar) + nama & kontak lembaga.
 * Kosong bila pemilik berstatus Perorangan.
 */
export function kopHtml(sg: SanggarUser): string {
  if (!isOrganisasi(sg)) return "";
  const t = tataNaskah();

  const sanggarKop = sg.kopSuratDataUrl;
  if (typeof sanggarKop === "string" && gambarSah(sanggarKop)) {
    return "<div data-editor-protected=\"true\" contenteditable=\"false\">" + kopGambarHtml({ kopDataUrl: sanggarKop, garis: t.garisKop !== false }) + "</div>";
  }

  if (gambarSah(t.kopDataUrl)) {
    return `<div data-editor-protected="true" contenteditable="false">${kopGambarHtml({ kopDataUrl: t.kopDataUrl!, garis: t.garisKop !== false })}</div>`;
  }

  const isi = kopSuratDkiHtml({
    nama: t.namaInstansi?.trim() || sg.namaSanggar,
    alamat: sg.alamat?.trim(),
    // Alamat dikirim terpisah di atas; di sini hanya baris kontak/daring.
    kontak: t.barisKop?.length ? t.barisKop : barisKontak(sg),
    logoDataUrl: gambarSah(t.logoDataUrl)
      ? t.logoDataUrl
      : sg.logoDataUrl ?? sg.fotoProfileDataUrl,
    garis: t.garisKop !== false,
  });
  return `<div data-editor-protected="true" contenteditable="false">${isi}</div>`;
}

/**
 * Blok tanda tangan varian HTML untuk openPrintWindow.
 * Format TND DKI Jakarta:
 * - Rata kanan
 * - "Jakarta, [tanggal]"
 * - [Jabatan]
 * - [ruang tanda tangan basah]
 * - [Nama — tebal, garis bawah]
 * - NIP. [nomor] (jika tersedia)
 */
export function ttdHtml(sg: SanggarUser): string {
  return ttdDkiHtml({
    kota: "Jakarta",
    tanggal: tanggalCetak(),
    jabatan: jabatanPemilik(sg),
    nama: sg.namaKetua,
    nip: sg.nip,
    stempel: opsiStempel(),
  });
}
