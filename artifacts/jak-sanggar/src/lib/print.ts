import { escapeHtml } from "@/lib/utils";
import { bungkusCetak, cetakCssDariPengaturan } from "@/lib/dokumen-dki";
import { bukaPratinjauHtml } from "@/lib/document-preview";
import { load } from "@/lib/store";

export function safeHtml(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const escaped =
      typeof v === "object" &&
      v !== null &&
      "__rawHtml" in (v as Record<string, unknown>)
        ? String((v as { __rawHtml: unknown }).__rawHtml)
        : escapeHtml(v);
    out += escaped + strings[i + 1];
  }
  return out;
}

export function rawHtml(html: string): { __rawHtml: string } {
  return { __rawHtml: html };
}

/**
 * Bersihkan HTML hasil editor manual sebelum disimpan atau dicetak. Struktur
 * dan style dokumen dipertahankan, tetapi elemen aktif, event handler, serta
 * URL javascript dibuang.
 */
export function sanitizeEditableHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(
    `<div id="dokumen-editor-root">${html}</div>`,
    "text/html",
  );
  const root = parsed.getElementById("dokumen-editor-root");
  if (!root) return "";

  root
    .querySelectorAll(
      "script, iframe, object, embed, link, meta, base, form, input, button, textarea, select",
    )
    .forEach((node) => node.remove());

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const atribut of Array.from(element.attributes)) {
      const nama = atribut.name.toLowerCase();
      const nilai = atribut.value.trim().toLowerCase();
      if (
        nama.startsWith("on") ||
        nama === "srcdoc" ||
        nama === "formaction" ||
        ((nama === "href" || nama === "src" || nama === "xlink:href") &&
          nilai.startsWith("javascript:"))
      ) {
        element.removeAttribute(atribut.name);
      }
    }
    if (element.hasAttribute("data-editor-protected")) {
      element.setAttribute("contenteditable", "false");
    } else {
      element.removeAttribute("contenteditable");
    }
  });
  return root.innerHTML.trim();
}

/**
 * Tunggu font, gambar, dan dua frame tata letak sebelum membuka dialog cetak.
 * Batas waktu mencegah satu aset rusak menahan pengguna tanpa akhir.
 */
export async function tungguDokumenSiapCetak(
  w: Window,
  batasMs = 5000,
): Promise<void> {
  const dokumen = w.document;
  const fontSiap = dokumen.fonts?.ready
    ? dokumen.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve();
  const gambarSiap = Array.from(dokumen.images).map((gambar) => {
    if (gambar.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const selesai = () => resolve();
      gambar.addEventListener("load", selesai, { once: true });
      gambar.addEventListener("error", selesai, { once: true });
    });
  });
  let timer = 0;
  await Promise.race([
    Promise.all([fontSiap, ...gambarSiap]),
    new Promise<void>((resolve) => {
      timer = w.setTimeout(resolve, batasMs);
    }),
  ]);
  if (timer) w.clearTimeout(timer);
  if (w.closed) return;
  await new Promise<void>((resolve) => {
    w.requestAnimationFrame(() => w.requestAnimationFrame(() => resolve()));
  });
  dokumen.documentElement.dataset.printReady = "true";
}

/**
 * Buka pratinjau terpusat dengan format Tata Naskah Dinas DKI Jakarta.
 * Tombol Download PDF pada modal menghasilkan berkas dari sumber yang sama.
 */
export function openPrintWindow(opts: {
  title: string;
  bodyHtml: string;
  bodyStyle?: string;
  extraCss?: string;
  /**
   * Gaya yang harus diterapkan paling akhir. Dipakai untuk template Word yang
   * memiliki ukuran kertas/margin bawaan sendiri dan sudah diverifikasi dari
   * dokumen sumber.
   */
  finalCss?: string;
  autoPrint?: boolean;
}): boolean {
  // Pengaturan Tata Naskah Dinas dari kurator (margin, huruf, spasi) menimpa
  // gaya umum. Template Word terverifikasi boleh memberikan finalCss khusus
  // untuk mempertahankan geometri yang memang berasal dari naskah sumber.
  let cssPengaturan = "";
  try {
    cssPengaturan = cetakCssDariPengaturan(load().appearance?.tataNaskah);
  } catch {
    // Pengaturan tidak wajib — dokumen tetap tercetak dengan format baku.
  }
  // bodyStyle berisi DEKLARASI css (mis. "font-family:serif;padding:32px"),
  // bukan aturan utuh — harus dibungkus selektor agar stylesheet tetap sah.
  const gayaBody = opts.bodyStyle?.trim()
    ? `body { ${opts.bodyStyle.trim()} }`
    : "";
  const gayaDokumen = opts.extraCss?.trim() ?? "";
  const gayaFinal = opts.finalCss?.trim() ?? "";
  const html = bungkusCetak({
    title: opts.title,
    bodyHtml: opts.bodyHtml,
    // Urutan penting: gaya khusus pemanggil dulu, pengaturan kurator terakhir
    // supaya kaidah tata naskah dinas yang menang.
    css: [gayaBody, gayaDokumen, cssPengaturan, gayaFinal]
      .filter(Boolean)
      .join("\n"),
  });
  bukaPratinjauHtml({
    title: opts.title,
    fileName: `${opts.title}.pdf`,
    html,
    createPdfBlob: async () => {
      const { buatBlobDokumenPdf } = await import("@/lib/dokumen-export");
      return buatBlobDokumenPdf({
        title: opts.title,
        fileName: opts.title,
        bodyHtml: opts.bodyHtml,
        bodyStyle: opts.bodyStyle,
        extraCss: [gayaDokumen, cssPengaturan].filter(Boolean).join("\n"),
        finalCss: opts.finalCss,
      });
    },
  });
  return true;
}
