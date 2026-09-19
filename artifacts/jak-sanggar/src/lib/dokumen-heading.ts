/** Kapitalisasi isi judul; atribut, URL, dan entitas HTML tetap utuh. */
export function kapitalisasiIsiJudul(html: string): string {
  return html.split(/(<br\b[^>]*>|<\/(?:p|div|h[1-6])\s*>|\r?\n)/gi).map((baris) => {
    const teks = baris.replace(/<[^>]*>/g, "").replace(/&(?:nbsp|#160);/gi, " ").trim();
    if (/^(?:nomor|tanggal)\s*:/i.test(teks) || /^Pasal\s+\d+[a-z]?$/i.test(teks)) return baris;
    return baris.replace(/<!--[^]*?-->|<(?:script|style)\b[^]*?<\/(?:script|style)>|<(?:[^>"']|"[^"]*"|'[^']*')*>|&(?:#[xX][\da-fA-F]+|#\d+|\w+);|[^<&]+|[<&]/gi, (bagian) =>
      bagian.startsWith("<") || bagian.startsWith("&") ? bagian : bagian.toLocaleUpperCase("id-ID"),
    );
  }).join("");
}

/** Dipanggil saat ekspor juga, agar judul yang diedit tetap kapital. */
export function normalisasiJudulDokumen(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const calon = parsed.body.querySelectorAll<HTMLElement>(
    'h1,h2,h3,h4,h5,h6,[data-dokumen-heading="title"],[style*="text-transform"],.dokumen-template__table--judul p',
  );
  for (const elemen of calon) {
    if (elemen.hasAttribute("style") && !elemen.matches('h1,h2,h3,h4,h5,h6,[data-dokumen-heading="title"],.dokumen-template__table--judul p') && elemen.style.textTransform !== "uppercase") continue;
    const teks = (elemen.textContent ?? "").trim();
    if (/^(?:Pasal\s+\d+[a-z]?|Nomor\s*:[\s\S]*|Tanggal\s*:[\s\S]*)$/i.test(teks)) continue;
    // Per baris logis agar kode setelah Nomor: tetap utuh meskipun terpisah span.
    elemen.innerHTML = kapitalisasiIsiJudul(elemen.innerHTML);
  }
  return parsed.body.innerHTML;
}
