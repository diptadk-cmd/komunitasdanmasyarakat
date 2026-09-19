// Komponen tata letak dokumen administrasi organisasi sanggar
// ──────────────────────────────────────────────────────────────────────
// Mengadopsi kerapihan teknis dari tata naskah dinas DKI Jakarta, tanpa
// menjadikan dokumen sanggar sebagai naskah dinas atau produk hukum daerah.
//
// Referensi:
// - Peraturan Gubernur DKI Jakarta Nomor 99 Tahun 2021 tentang Tata Naskah Dinas
// - Dokumen sanggar tetap perlu ditelaah/dibakukan oleh pihak berwenang bila
//   akan dipakai sebagai naskah hukum atau naskah dinas resmi pemerintah.

export const TND = {
  font: "'Times New Roman', 'Georgia', 'Cambria', serif",
  fontSans: "'Inter', 'Segoe UI', system-ui, sans-serif",
  ukuranIsi: "12pt",
  ukuranJudul: "14pt",
  ukuranKop: "14pt",
  ukuranKopBaris: "10pt",
  ukuranKecil: "10pt",
  spasi: "1.5",
  margin: {
    atas: "30mm",
    kiri: "30mm",
    kanan: "20mm",
    bawah: "20mm",
  },
  warna: {
    hijauTua: "#005A2B",
    merah: "#FF3D16",
    hitam: "#1A1A1A",
    abu: "#4A4A4A",
    emas: "#D4A64E",
  },
  garisKop: {
    atas: { tebal: "2.5px", warna: "#005A2B" },
    bawah: { tebal: "1px", warna: "#FF3D16" },
    jarak: "4px",
  },
} as const;

export const CETAK_CSS = `
  @page {
    size: A4 portrait;
    margin: ${TND.margin.atas} ${TND.margin.kanan} ${TND.margin.bawah} ${TND.margin.kiri};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${TND.font};
    font-size: ${TND.ukuranIsi};
    line-height: ${TND.spasi};
    color: ${TND.warna.hitam};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    orphans: 3;
    widows: 3;
  }

  /* ── Tabel: otomatis mengikuti margin & menyesuaikan konten ─────────────
     - Lebar mengikuti area cetak (tidak pernah melewati margin @page).
     - Kolom melebar/menyempit mengikuti isi (table-layout:auto).
     - Teks panjang dipenggal agar tidak meluber keluar halaman.
     - Baris tidak terpotong antar-halaman; header tabel diulang tiap halaman. */
  table {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    font-family: inherit;
    font-size: ${TND.ukuranIsi};
    line-height: ${TND.spasi};
    margin: 0 0 12px;
    page-break-inside: auto;
  }
  th, td {
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: normal;
    hyphens: auto;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  h1, h2, h3, h4, .tnd-judul {
    page-break-after: avoid;
    break-after: avoid-page;
  }

  /* Tabel berkerangka (data/lampiran): garis rapi sesuai tata naskah dinas. */
  table.tnd-data { margin: 4px 0 14px; }
  table.tnd-data th, table.tnd-data td {
    border: 1px solid ${TND.warna.hitam};
    padding: 5px 8px;
  }
  table.tnd-data th {
    font-weight: bold;
    text-align: center;
    background: #F2F2F2;
  }
  table.tnd-data td.tnd-num { text-align: center; white-space: nowrap; }

  /* Tabel identitas (label : nilai) — kolom label seperlunya, nilai mengisi sisa. */
  table.tnd-identitas { margin: 0 0 12px; }
  table.tnd-identitas td { padding: 2px 0; }
  table.tnd-identitas td.tnd-label { white-space: nowrap; padding-right: 8px; width: 1%; }
  table.tnd-identitas td.tnd-sep { width: 1%; padding: 2px 6px; }

  img { max-width: 100%; height: auto; }

  @media print {
    body { padding: 0 !important; margin: 0 !important; }
  }
`;

/**
 * CSS penimpa yang dibangun dari pengaturan Tata Naskah Dinas milik kurator.
 * Hanya field yang benar-benar diisi yang menghasilkan aturan, sehingga
 * dokumen tetap memakai nilai baku bila kurator belum mengatur apa pun.
 */
export function cetakCssDariPengaturan(t?: {
  fontKeluarga?: string;
  fontUkuranPt?: number;
  spasiBaris?: number;
  marginAtasMm?: number;
  marginKiriMm?: number;
  marginKananMm?: number;
  marginBawahMm?: number;
}): string {
  if (!t) return "";
  const aturan: string[] = [];

  const m = [t.marginAtasMm, t.marginKananMm, t.marginBawahMm, t.marginKiriMm];
  if (m.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
    aturan.push(
      `@page { size: A4 portrait; margin: ${m[0]}mm ${m[1]}mm ${m[2]}mm ${m[3]}mm; }`,
    );
  }

  const gaya: string[] = [];
  if (t.fontKeluarga?.trim()) {
    // Whitelist ketat: hanya huruf, angka, spasi, dan tanda hubung. Ini
    // mencegah karakter seperti < > / " yang bisa menutup <style> lebih awal
    // dan menyuntikkan HTML aktif (nilai ini masuk ke dalam <style> lalu
    // di-document.write). Nama font resmi tidak butuh karakter lain.
    const nama = t.fontKeluarga.trim().replace(/[^A-Za-z0-9 \-]/g, "");
    if (nama) gaya.push(`font-family: "${nama}", ${TND.font};`);
  }
  if (typeof t.fontUkuranPt === "number" && t.fontUkuranPt > 0) {
    gaya.push(`font-size: ${t.fontUkuranPt}pt;`);
  }
  if (typeof t.spasiBaris === "number" && t.spasiBaris > 0) {
    gaya.push(`line-height: ${t.spasiBaris};`);
  }
  if (gaya.length) aturan.push(`body { ${gaya.join(" ")} }`);
  // Tabel ikut ukuran & spasi dokumen agar tetap serasi.
  if (gaya.length)
    aturan.push(`table { font-size: inherit; line-height: inherit; }`);

  return aturan.join("\n");
}

export function bungkusCetak(opts: {
  title: string;
  bodyHtml: string;
  css?: string;
}): string {
  const extraCss = opts.css ?? "";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(opts.title)}</title>
  <style>
    ${CETAK_CSS}
    ${extraCss}
  </style>
</head>
<body>
${opts.bodyHtml}
</body>
</html>`;
}

// ── Helper HTML ──────────────────────────────────────────────────────────────

function escHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Garis pembatas kop surat (hitam tebal + merah tipis) */
export function garisKopHtml(): string {
  return `<div style="margin:0;padding:0">
    <hr style="border:none;border-top:${TND.garisKop.atas.tebal} solid ${TND.garisKop.atas.warna};margin:0">
    <hr style="border:none;border-top:${TND.garisKop.bawah.tebal} solid ${TND.garisKop.bawah.warna};margin:${TND.garisKop.jarak} 0 0 0">
  </div>`;
}

/**
 * Apakah nilai berupa data URL gambar raster yang sah.
 *
 * Pola dibuat ketat (bukan sekadar memeriksa awalan) karena nilai ini
 * disisipkan ke atribut `src="…"` dokumen cetak:
 * - hanya base64 raster; `image/svg+xml` ditolak sebab SVG dapat memuat skrip;
 * - hanya abjad base64 yang diizinkan sehingga tanda kutip tidak mungkin
 *   lolos dan memutus atribut.
 */
export function gambarSah(url?: string): boolean {
  return (
    !!url &&
    /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/i.test(url)
  );
}

/**
 * Kop surat berupa gambar utuh hasil unggahan kurator.
 * Dipakai ketika lembaga sudah punya berkas kop resmi sehingga tidak perlu
 * disusun ulang dari teks.
 */
export function kopGambarHtml(opts: {
  kopDataUrl: string;
  garis?: boolean;
}): string {
  if (!gambarSah(opts.kopDataUrl)) return "";
  return `<div style="text-align:center;margin-bottom:6px">
  <img src="${opts.kopDataUrl}" alt="Kop Surat" style="width:100%;max-width:100%;height:auto;object-fit:contain">
</div>
${opts.garis === false ? "" : garisKopHtml()}
<div style="height:16px"></div>`;
}

/**
 * Kop surat standar TND DKI Jakarta.
 *
 * Tata letak mengikuti kaidah naskah dinas: logo lembaga diletakkan pada sisi
 * KIRI kop, sedangkan nama lembaga dan baris keterangan berada di tengah.
 * Bila `logoTengah` diaktifkan, logo kembali ditempatkan di atas-tengah
 * (bentuk lama) agar dokumen yang sudah terbiasa memakainya tidak berubah.
 */
export function kopSuratDkiHtml(opts: {
  nama: string;
  alamat?: string;
  kontak?: string[];
  logoDataUrl?: string;
  logoTengah?: boolean;
  garis?: boolean;
}): string {
  const adaLogo = gambarSah(opts.logoDataUrl);
  const logoImg = adaLogo
    ? `<img src="${opts.logoDataUrl}" alt="" style="height:72px;width:72px;object-fit:contain;flex:0 0 auto">`
    : "";

  const kontakBaris =
    opts.kontak
      ?.filter(Boolean)
      .map(
        (b) =>
          `<div style="font-size:${TND.ukuranKopBaris};color:${TND.warna.abu};line-height:1.4">${escHtml(b)}</div>`,
      )
      .join("") ?? "";

  const blokTeks = `<div style="font-size:${TND.ukuranKop};font-weight:bold;letter-spacing:0.5px;color:${TND.warna.hijauTua};text-transform:uppercase;line-height:1.2">
    ${escHtml(opts.nama)}
  </div>
  ${opts.alamat ? `<div style="font-size:${TND.ukuranKopBaris};color:${TND.warna.abu};line-height:1.4;margin-top:2px">${escHtml(opts.alamat)}</div>` : ""}
  ${kontakBaris}`;

  const garis = opts.garis === false ? "" : garisKopHtml();

  // Logo di kiri (kaidah naskah dinas) — teks tetap rata tengah pada sisa ruang.
  if (adaLogo && !opts.logoTengah) {
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:6px">
  <tr>
    <td style="width:80px;vertical-align:middle;padding:0">${logoImg}</td>
    <td style="text-align:center;vertical-align:middle;padding:0">${blokTeks}</td>
    <td style="width:80px;padding:0"></td>
  </tr>
</table>
${garis}
<div style="height:16px"></div>`;
  }

  return `<div style="text-align:center;margin-bottom:6px">
  ${logoImg ? `<div style="display:flex;justify-content:center;margin-bottom:6px">${logoImg}</div>` : ""}
  ${blokTeks}
</div>
${garis}
<div style="height:16px"></div>`;
}

/**
 * Format nomor surat DKI Jakarta
 * Format: [Nomor Urut]/[Kode Jenis]/[Kode Unit]/[Bulan Romawi]/[Tahun]
 */
export function formatNomorSurat(opts: {
  nomorUrut: string;
  kodeJenis: string;
  kodeUnit?: string;
  bulan?: number;
  tahun?: number;
}): string {
  const bulanRomawi = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  const now = new Date();
  const b = opts.bulan ?? now.getMonth() + 1;
  const t = opts.tahun ?? now.getFullYear();
  return [
    opts.nomorUrut.padStart(3, "0"),
    opts.kodeJenis,
    opts.kodeUnit ?? "SGR",
    bulanRomawi[b],
    String(t),
  ].join("/");
}

/** Blok nomor surat */
export function blokNomorHtml(nomor: string, perihal?: string): string {
  let html = `<div style="display:flex;gap:8px;font-size:${TND.ukuranIsi};margin-bottom:16px">
    <span style="white-space:nowrap">Nomor</span>
    <span>:</span>
    <span>${escHtml(nomor)}</span>
  </div>`;
  if (perihal?.trim()) {
    html += `<div style="display:flex;gap:8px;font-size:${TND.ukuranIsi};margin-bottom:16px">
      <span style="white-space:nowrap">Perihal</span>
      <span>:</span>
      <span>${escHtml(perihal)}</span>
    </div>`;
  }
  return html;
}

/** Tujuan surat (Kepada Yth. ...) */
export function tujuanHtml(tujuan: string, diTempat?: boolean): string {
  const diTempatText = diTempat !== false ? " di tempat." : "";
  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin-bottom:4px">
    Kepada Yth.<br>
    ${escHtml(tujuan)}${diTempatText}
  </div>`;
}

/** Salam pembuka standar */
export function salamHtml(): string {
  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:12px 0">
    Dengan hormat,
  </div>`;
}

/** Paragraf isi surat (justify, spasi 1.5) */
export function paragrafHtml(teks: string): string {
  return `<p style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};text-align:justify;text-indent:40px;margin:0 0 10px 0">
    ${escHtml(teks)}
  </p>`;
}

/** Paragraf dengan whitespace pre-wrap */
export function paragrafPreHtml(teks: string): string {
  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};text-align:justify;white-space:pre-wrap;margin:0 0 10px 0">
    ${escHtml(teks)}
  </div>`;
}

/** Daftar bernomor/berbutir */
export function daftarHtml(items: string[], ordered = true): string {
  const tag = ordered ? "ol" : "ul";
  const lis = items
    .filter(Boolean)
    .map((i) => `<li style="margin:3px 0">${escHtml(i)}</li>`)
    .join("");
  return `<${tag} style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:0 0 10px 0;padding-left:30px">${lis}</${tag}>`;
}

/**
 * Tabel identitas (label : nilai).
 * Kolom label selebar isinya, kolom nilai mengisi sisa lebar area cetak
 * sehingga tabel selalu mengikuti margin halaman.
 */
export function tabelIdentitasHtml(
  baris: { label: string; nilai?: string }[],
): string {
  const rows = baris
    .filter((b) => b.nilai?.trim())
    .map(
      (b) => `<tr>
      <td class="tnd-label">${escHtml(b.label)}</td>
      <td class="tnd-sep">:</td>
      <td>${escHtml(b.nilai)}</td>
    </tr>`,
    )
    .join("");
  if (!rows) return "";
  return `<table class="tnd-identitas"><tbody>${rows}</tbody></table>`;
}

/**
 * Tabel data berkerangka (berjudul kolom) sesuai tata naskah dinas.
 *
 * - Lebar tabel mengikuti margin halaman, kolom menyesuaikan panjang isi.
 * - Header diulang otomatis bila tabel berlanjut ke halaman berikutnya.
 * - Kolom nomor urut ditambahkan otomatis bila `nomor` aktif.
 *
 * @param kolom  Judul kolom.
 * @param baris  Isi baris; tiap baris berupa larik sel mengikuti urutan kolom.
 * @param opts.nomor  Tambahkan kolom "No." di depan (default: true).
 * @param opts.rataTengah  Indeks kolom (setelah kolom No.) yang dirata-tengah.
 */
export function tabelDataHtml(
  kolom: string[],
  baris: (string | number | undefined)[][],
  opts?: { nomor?: boolean; rataTengah?: number[] },
): string {
  const pakaiNomor = opts?.nomor !== false;
  const tengah = new Set(opts?.rataTengah ?? []);
  const head =
    (pakaiNomor ? `<th style="width:1%;white-space:nowrap">No.</th>` : "") +
    kolom.map((k) => `<th>${escHtml(k)}</th>`).join("");
  const body = baris
    .map((r, i) => {
      const sel = kolom
        .map((_, ci) => {
          const isi = r[ci];
          const teks =
            isi === undefined || isi === null || String(isi).trim() === ""
              ? "-"
              : String(isi);
          const cls = tengah.has(ci) ? ' class="tnd-num"' : "";
          return `<td${cls}>${escHtml(teks)}</td>`;
        })
        .join("");
      return `<tr>${pakaiNomor ? `<td class="tnd-num">${i + 1}.</td>` : ""}${sel}</tr>`;
    })
    .join("");
  if (!body) return "";
  return `<table class="tnd-data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Pengaturan stempel/cap pada blok tanda tangan. */
export interface OpsiStempel {
  /** Gambar stempel (data URL). */
  dataUrl?: string;
  /** Lebar stempel dalam milimeter (baku 35 mm). */
  lebarMm?: number;
  /** Opasitas 0–1 agar tanda tangan di bawahnya tetap terbaca. */
  opacity?: number;
  /** Posisi terhadap blok tanda tangan. */
  posisi?: "kiri-ttd" | "tengah-ttd" | "kanan-ttd";
}

/**
 * Blok tanda tangan sesuai TND DKI Jakarta.
 *
 * Bila `stempel` diisi, gambar cap ditempatkan membayangi ruang tanda tangan
 * (menumpuk, bukan menggeser tata letak) sehingga hasil cetak menyerupai
 * dokumen yang dibubuhi cap basah.
 */
export function ttdDkiHtml(opts: {
  kota?: string;
  tanggal?: string;
  jabatan: string;
  nama: string;
  nip?: string;
  stempel?: OpsiStempel;
}): string {
  const kota = opts.kota ?? "Jakarta";
  const tanggal =
    opts.tanggal ??
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const nipBaris = opts.nip?.trim()
    ? `<div style="font-size:${TND.ukuranKecil};margin-top:2px">NIP. ${escHtml(opts.nip)}</div>`
    : "";

  const st = opts.stempel;
  let stempelHtml = "";
  // Tinggi ruang tanda tangan: baku 80px, dilebarkan bila stempel lebih besar
  // agar cap tidak menindih nama penanda tangan sampai tak terbaca.
  let tinggiRuang = "80px";
  if (st && gambarSah(st.dataUrl)) {
    const lebar = st.lebarMm ?? 35;
    const opacity = st.opacity ?? 0.85;
    // Posisi horizontal stempel relatif terhadap kolom tanda tangan.
    const posisi = st.posisi ?? "kiri-ttd";
    const geser =
      posisi === "kanan-ttd"
        ? "right:-6mm"
        : posisi === "tengah-ttd"
          ? "left:50%;transform:translateX(-50%)"
          : "left:-6mm";
    // Stempel umumnya bulat, jadi tingginya ≈ lebarnya. Sisakan 4 mm napas.
    tinggiRuang = `max(80px, ${lebar + 4}mm)`;
    stempelHtml = `<img src="${st.dataUrl}" alt="" style="position:absolute;${geser};top:1mm;width:${lebar}mm;height:auto;opacity:${opacity};object-fit:contain;pointer-events:none;z-index:0">`;
  }

  // Ruang tanda tangan jadi konteks posisi agar stempel bisa menumpuk di
  // belakang. Nama & NIP diberi z-index lebih tinggi supaya tetap terbaca
  // meski sebagian tertutup cap — seperti dokumen bercap basah.
  const ruangTtd = `<div style="position:relative;height:${tinggiRuang}">${stempelHtml}</div>`;

  return `<div data-editor-protected="true" contenteditable="false" style="display:flex;justify-content:flex-end;margin-top:36px;page-break-inside:avoid">
  <div style="text-align:center;min-width:240px;font-size:${TND.ukuranIsi};line-height:${TND.spasi};position:relative">
    <div>${escHtml(kota)}, ${escHtml(tanggal)}</div>
    <div>${escHtml(opts.jabatan)}</div>
    ${ruangTtd}
    <div style="font-weight:bold;text-decoration:underline;position:relative;z-index:1">${escHtml(opts.nama)}</div>
    ${nipBaris ? `<div style="position:relative;z-index:1">${nipBaris}</div>` : ""}
  </div>
</div>`;
}

/** Blok tembusan (CC) */
export function tembusanHtml(daftar: string[]): string {
  const items = daftar.filter(Boolean);
  if (items.length === 0) return "";
  const lis = items
    .map((d, i) => `<div style="margin:1px 0">${i + 1}. ${escHtml(d)}</div>`)
    .join("");
  return `<div style="margin-top:24px;font-size:${TND.ukuranIsi};line-height:${TND.spasi}">
  <div style="font-style:italic">Tembusan:</div>
  ${lis}
</div>`;
}

/** Blok lampiran */
export function lampiranHtml(jumlah: number, deskripsi?: string): string {
  const desc = deskripsi?.trim() ? ` (${escHtml(deskripsi)})` : "";
  return `<div style="display:flex;gap:8px;font-size:${TND.ukuranIsi};margin-bottom:4px">
    <span style="white-space:nowrap">Lampiran</span>
    <span>:</span>
    <span>${jumlah} berkas${desc}</span>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT BERPASAL (Peraturan / Keputusan dengan Pasal)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format dokumen berpasal untuk AD/ART dan pedoman organisasi.
 *
 * Struktur hierarki:
 * - BAB (Roman uppercase) — "BAB I", "BAB II", dst.
 *   - Bagian (opsional) — "Bagian Kesatu", "Bagian Kedua", dst.
 *     - Paragraf (opsional) — "Paragraf 1", "Paragraf 2", dst.
 *       - Pasal (angka) — "Pasal 1", "Pasal 2", dst.
 *         - Ayat — "(1)", "(2)", dst.
 *           - Huruf — "a.", "b.", "c.", dst.
 *             - Angka — "1.", "2.", "3.", dst.
 *               - Huruf dalam kurung — "a)", "b)", "c)", dst.
 */

/** Format BAB heading (Roman uppercase, centered) */
export function babHtml(judul: string): string {
  return `<div data-dokumen-heading="title" style="text-align:center;font-size:${TND.ukuranJudul};font-weight:bold;margin:24px 0 16px;page-break-after:avoid">
  ${escHtml(judul.toLocaleUpperCase("id-ID"))}
</div>`;
}

/** Format Bagian heading (centered, italic) */
export function bagianHtml(judul: string): string {
  return `<div style="text-align:center;font-size:${TND.ukuranIsi};font-weight:bold;font-style:italic;margin:16px 0 12px;page-break-after:avoid">
  ${escHtml(judul)}
</div>`;
}

/** Format Paragraf heading (centered) */
export function paragrafHeadingHtml(judul: string): string {
  return `<div style="text-align:center;font-size:${TND.ukuranIsi};font-weight:bold;margin:12px 0 8px;page-break-after:avoid">
  ${escHtml(judul)}
</div>`;
}

/** Format Pasal heading (bold, left-aligned) */
export function pasalHtml(nomor: number | string, teks?: string): string {
  const teksHtml = teks?.trim()
    ? `<div style="margin-bottom:8px">${escHtml(teks)}</div>`
    : "";
  return `<div style="font-size:${TND.ukuranIsi};font-weight:bold;margin:16px 0 8px;page-break-after:avoid">
  Pasal ${escHtml(String(nomor))}
</div>${teksHtml}`;
}

/** Penanda huruf berurutan; daftar panjang tetap memakai huruf setelah z. */
export function nomorHurufDokumen(index: number): string {
  let nilai = (Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0) + 1;
  let hasil = "";
  while (nilai > 0) {
    nilai -= 1;
    hasil = String.fromCharCode(97 + (nilai % 26)) + hasil;
    nilai = Math.floor(nilai / 26);
  }
  return hasil;
}

function intiPenanda(nomor: number | string): string {
  return String(nomor)
    .trim()
    .replace(/^\(\s*([^()]+?)\s*\)$/, "$1")
    .replace(/[.)]$/, "")
    .trim();
}

/** Hanya hapus penanda yang sama; angka desimal dan rujukan pasal tetap utuh. */
function tanpaPenandaGanda(teks: string, nomor: string): string {
  const polaNomor = nomor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return teks.replace(
    new RegExp(
      `^\\s*(?:\\(\\s*${polaNomor}\\s*\\)|${polaNomor}[.)])(?=\\s|$)\\s*`,
      "i",
    ),
    "",
  );
}

/**
 * Tabel tanpa garis menjaga kolom penanda dan awal baris lanjutan di Word,
 * pratinjau, serta PDF. Margin ditempatkan pada pembungkus agar lebar tabel
 * tetap berada di dalam area cetak pada setiap tingkat daftar.
 */
function barisDaftarHtml(
  penanda: string,
  isiHtml: string,
  indentasi: number,
  jarak = 2,
): string {
  // Ruang tetap sampai tiga digit: (1), (10), dan (100) mulai pada kolom sama.
  const lebarBaku = /^\(\d+\)$/.test(penanda)
    ? 36
    : /^\d+\.$/.test(penanda)
      ? 30
      : 24;
  const lebarPenanda = Math.max(lebarBaku, penanda.length * 6 + 6);
  return `<div style="margin:${jarak}px 0 ${jarak}px ${indentasi}px">
  <table class="tnd-daftar" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;border:0;margin:0;font-size:${TND.ukuranIsi};line-height:${TND.spasi}">
    <colgroup><col style="width:${lebarPenanda}pt"><col></colgroup>
    <tbody><tr>
      <td class="tnd-daftar-penanda" style="width:${lebarPenanda}pt;border:0;padding:0 6pt 0 0;vertical-align:top;text-align:left;white-space:nowrap;overflow-wrap:normal;word-break:keep-all">${escHtml(penanda)}</td>
      <td class="tnd-daftar-isi" style="border:0;padding:0;vertical-align:top;text-align:justify">${isiHtml}</td>
    </tr></tbody>
  </table>
</div>`;
}

/** Format Ayat — "(1)", "(2)", dst. dengan indentasi */
export function ayatHtml(nomor: number | string, teks: string): string {
  const inti = intiPenanda(nomor);
  return barisDaftarHtml(
    `(${inti})`,
    escHtml(tanpaPenandaGanda(teks, inti)),
    0,
    4,
  );
}

/** Format Ayat dengan sub-huruf — "a.", "b.", "c.", dst. */
export function ayatDenganHuruf(
  nomor: number | string,
  hurufList: string[],
): string {
  const inti = intiPenanda(nomor);
  const items = hurufList.filter((h) => h.trim());
  if (!items.length) return "";
  const penandaAyat = `(${inti})`;
  const lebarAyat = Math.max(36, penandaAyat.length * 6 + 6);
  const lebarHuruf = Math.max(
    24,
    (nomorHurufDokumen(items.length - 1).length + 1) * 6 + 6,
  );
  const gayaPenanda =
    "border:0;padding:0 6pt 0 0;vertical-align:top;text-align:left;white-space:nowrap;overflow-wrap:normal;word-break:keep-all";
  // Satu tabel, satu baris per subhuruf: konverter Word tidak perlu membaca
  // tabel bersarang dan daftar panjang dapat berpaginasi di antara butir.
  const rows = items
    .map((item, i) => {
      const huruf = nomorHurufDokumen(i);
      return `<tr>
      <td class="${i === 0 ? "tnd-daftar-penanda" : "tnd-daftar-indent"}" style="width:${lebarAyat}pt;${gayaPenanda}">${i === 0 ? escHtml(penandaAyat) : ""}</td>
      <td class="tnd-daftar-penanda" style="width:${lebarHuruf}pt;${gayaPenanda}">${huruf}.</td>
      <td class="tnd-daftar-isi" style="border:0;padding:0;vertical-align:top;text-align:justify">${escHtml(tanpaPenandaGanda(item, huruf))}</td>
    </tr>`;
    })
    .join("");
  return `<div style="margin:4px 0">
  <table class="tnd-daftar tnd-daftar-bertingkat" role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;border:0;margin:0;font-size:${TND.ukuranIsi};line-height:${TND.spasi}">
    <colgroup><col style="width:${lebarAyat}pt"><col style="width:${lebarHuruf}pt"><col></colgroup>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

/** Format Huruf — "a.", "b.", "c.", dst. */
export function hurufHtml(nomor: string, teks: string): string {
  const inti = intiPenanda(nomor).toLocaleLowerCase("id-ID");
  return barisDaftarHtml(
    `${inti}.`,
    escHtml(tanpaPenandaGanda(teks, inti)),
    24,
  );
}

/** Format Angka — "1.", "2.", "3.", dst. */
export function angkaHtml(nomor: number | string, teks: string): string {
  const inti = intiPenanda(nomor);
  return barisDaftarHtml(
    `${inti}.`,
    escHtml(tanpaPenandaGanda(teks, inti)),
    48,
  );
}

/** Format Huruf dalam kurung — "a)", "b)", "c)", dst. */
export function hurufKurungHtml(nomor: string, teks: string): string {
  const inti = intiPenanda(nomor).toLocaleLowerCase("id-ID");
  return barisDaftarHtml(
    `${inti})`,
    escHtml(tanpaPenandaGanda(teks, inti)),
    72,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT BERDIKTUM (Keputusan dengan Diktum)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format keputusan organisasi dengan konsiderans dan diktum.
 *
 * Struktur:
 * - Menimbang — huruf a., b., c.
 * - Mengingat — angka 1., 2., 3.
 * - MEMUTUSKAN:
 * - Menetapkan:
 * - Diktum Kesatu, Diktum Kedua, dst.
 */

/** Format "Menimbang:" dengan huruf a., b., c. */
export function menimbangHtml(items: string[]): string {
  const lis = items
    .filter((item) => item.trim())
    .map((item, i) => hurufHtml(nomorHurufDokumen(i), item))
    .join("");

  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:16px 0 8px">
  <div style="page-break-after:avoid">Menimbang:</div>
  ${lis}
</div>`;
}

/** Format "Mengingat:" dengan angka 1., 2., 3. */
export function mengingatHtml(items: string[]): string {
  const lis = items
    .filter((item) => item.trim())
    .map((item, i) =>
      barisDaftarHtml(
        `${i + 1}.`,
        escHtml(tanpaPenandaGanda(item, String(i + 1))),
        24,
        4,
      ),
    )
    .join("");

  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:16px 0 8px">
  <div style="page-break-after:avoid">Mengingat:</div>
  ${lis}
</div>`;
}

/** Format "MEMUTUSKAN:" (centered, bold) */
export function memutuskanHtml(): string {
  return `<div style="text-align:center;font-size:${TND.ukuranIsi};font-weight:bold;margin:24px 0 16px">
  MEMUTUSKAN:
</div>`;
}

/** Format "Menetapkan:" dengan isi */
export function menetapkanHtml(teks: string): string {
  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:8px 0">
  <div style="page-break-after:avoid">Menetapkan:</div>
  <div style="margin-left:24px;margin-top:4px">${escHtml(teks)}</div>
</div>`;
}

/** Format Diktum — "Diktum Kesatu:", "Diktum Kedua:", dst. */
export function diktumHtml(nomor: string, teks: string): string {
  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:12px 0;text-align:justify">
  <div style="font-weight:bold;margin-bottom:4px;page-break-after:avoid">Diktum ${escHtml(nomor)}:</div>
  <div style="margin-left:24px">${escHtml(teks)}</div>
</div>`;
}

/** Format Diktum dengan sub-huruf */
export function diktumDenganHuruf(nomor: string, hurufList: string[]): string {
  const hurufHtmlStr = hurufList
    .filter((h) => h.trim())
    .map((h, i) => hurufHtml(nomorHurufDokumen(i), h))
    .join("");

  return `<div style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};margin:12px 0">
  <div style="font-weight:bold;margin-bottom:4px;page-break-after:avoid">Diktum ${escHtml(nomor)}:</div>
  ${hurufHtmlStr}
</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT SURAT BIASA (Undangan, Permohonan, Pernyataan, dll.)
// ═══════════════════════════════════════════════════════════════════════════════

/** Format judul surat (centered, bold, underline) */
export function judulSuratHtml(judul: string): string {
  return `<div data-dokumen-heading="title" style="text-align:center;font-size:${TND.ukuranJudul};font-weight:bold;text-decoration:underline;text-transform:uppercase;margin-bottom:16px;letter-spacing:0.5px;page-break-after:avoid">
  ${escHtml(judul.toLocaleUpperCase("id-ID"))}
</div>`;
}

/** Format judul surat dengan nomor */
export function judulSuratDenganNomorHtml(
  judul: string,
  nomor?: string,
): string {
  const nomorHtml = nomor?.trim()
    ? `<div style="text-align:center;font-size:${TND.ukuranIsi};margin-top:4px">Nomor: ${escHtml(nomor)}</div>`
    : "";
  return `<div style="text-align:center;margin-bottom:16px">
  <div data-dokumen-heading="title" style="font-size:${TND.ukuranJudul};font-weight:bold;text-decoration:underline;text-transform:uppercase;letter-spacing:0.5px;page-break-after:avoid">
    ${escHtml(judul.toLocaleUpperCase("id-ID"))}
  </div>
  ${nomorHtml}
</div>`;
}

/** Format "TENTANG:" (centered, bold) */
export function tentangHtml(teks: string): string {
  return `<div data-dokumen-heading="title" style="text-align:center;font-size:${TND.ukuranIsi};font-weight:bold;margin:8px 0 16px;page-break-after:avoid">
  TENTANG<br>
  ${escHtml(teks.toLocaleUpperCase("id-ID"))}
</div>`;
}

/** Format "DENGAN RAHMAT TUHAN YANG MAHA ESA" */
export function bismillahHtml(): string {
  return `<div style="text-align:center;font-size:${TND.ukuranIsi};margin:16px 0">
  DENGAN RAHMAT TUHAN YANG MAHA ESA
</div>`;
}

/** Format penutup surat "Demikian..." */
export function penutupHtml(teks?: string): string {
  const isi =
    teks?.trim() ||
    "Demikian surat ini dibuat untuk dapat dipergunakan sebagaimana mestinya.";
  return `<p style="font-size:${TND.ukuranIsi};line-height:${TND.spasi};text-align:justify;text-indent:40px;margin:16px 0 0 0">
    ${escHtml(isi)}
  </p>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER KONVERSI
// ═══════════════════════════════════════════════════════════════════════════════

/** Konversi angka ke Romawi (1-20) */
export function keRomawi(n: number): string {
  const romawi = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
    "XVII",
    "XVIII",
    "XIX",
    "XX",
  ];
  return romawi[n] ?? String(n);
}

/** Konversi angka ke kata Indonesia (1-20) */
export function keKata(n: number): string {
  const kata = [
    "",
    "Kesatu",
    "Kedua",
    "Ketiga",
    "Keempat",
    "Kelima",
    "Keenam",
    "Ketujuh",
    "Kedelapan",
    "Kesembilan",
    "Kesepuluh",
    "Kesebelas",
    "Keduabelas",
    "Ketigabelas",
    "Keempatbelas",
    "Kelimabelas",
    "Keenambelas",
    "Ketujuhbelas",
    "Kedelapanbelas",
    "Kesembilanbelas",
    "Keduapuluh",
  ];
  return kata[n] ?? `Ke${n}`;
}

/** Huruf pertama kapital */
export function kapital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
