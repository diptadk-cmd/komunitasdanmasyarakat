import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import pagedPolyfillUrl from "../../../node_modules/pagedjs/dist/paged.polyfill.js?url";

const CSS_LEMBAR_TERPISAH = `
  .paged-document-source .dokumen-template {
    width: auto !important;
    max-width: none !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  .paged-document-source .dokumen-template + .dokumen-template,
  .paged-document-source .dokumen-template__mulai-halaman,
  .paged-document-source [data-mulai-halaman="true"],
  .paged-document-source [data-dokumen-boundary="true"],
  .paged-document-source [data-dokumen-lampiran="true"] {
    break-before: page !important;
    page-break-before: always !important;
  }
  .paged-document-source .dokumen-template__page-break {
    display: none !important;
  }
  .paged-document-source img,
  .paged-document-source table {
    max-width: 100% !important;
  }
  .paged-document-source img { height: auto !important; }
  .paged-document-source p,
  .paged-document-source td,
  .paged-document-source th {
    overflow-wrap: anywhere;
  }
`;

const CSS_KANVAS_PREVIEW = `
  html, body {
    min-height: 100%;
    margin: 0;
    background: #e5e7eb;
  }
  body { padding: 28px 20px; }
  .pagedjs_pages {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    width: max-content;
    min-width: 100%;
  }
  .pagedjs_page {
    flex: none;
    margin: 0 !important;
    background: #fff;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.20),
      0 1px 3px rgba(15, 23, 42, 0.20);
  }
  .pagedjs_sheet,
  .pagedjs_pagebox { background: #fff; }
  .pagedjs_pagebox { overflow: hidden; }
`;

function pecahDokumenHtml(documentHtml: string): {
  css: string;
  body: string;
} {
  const parsed = new DOMParser().parseFromString(documentHtml, "text/html");

  // Preview dijalankan di sandbox. Tetap bersihkan skrip dan event handler
  // karena isi formulir dapat berasal dari akun pengguna.
  parsed
    .querySelectorAll("script, iframe, object, embed, base")
    .forEach((element) => element.remove());
  parsed.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      if (
        /^(href|src|xlink:href)$/i.test(attribute.name) &&
        /^\s*javascript:/i.test(attribute.value)
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  const css = Array.from(parsed.head.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");
  return {
    css: `${css}\n${CSS_LEMBAR_TERPISAH}`,
    body: `<div class="paged-document-source">${parsed.body.innerHTML}</div>`,
  };
}

function amanUntukStyle(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

/**
 * Pratinjau berhalaman nyata. Mesin Paged.js sengaja dijalankan di iframe
 * sandbox agar perubahan DOM halaman tidak berbenturan dengan DOM React.
 */
export const PagedDocumentPreview = memo(function PagedDocumentPreview({
  documentHtml,
  className = "",
  testId = "paged-document-preview",
}: {
  documentHtml: string;
  className?: string;
  testId?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [memuat, setMemuat] = useState(true);
  const [pesanGagal, setPesanGagal] = useState("");
  const [jumlahHalaman, setJumlahHalaman] = useState(0);

  const iframeHtml = useMemo(() => {
    if (!documentHtml.trim()) return "";
    const { css, body } = pecahDokumenHtml(documentHtml);
    const payloadId = JSON.stringify(instanceId);
    return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${amanUntukStyle(css)}\n${CSS_KANVAS_PREVIEW}</style>
    <script>
      window.PagedConfig = {
        auto: true,
        after: function (flow) {
          parent.postMessage({
            source: "jak-sanggar-paged-preview",
            id: ${payloadId},
            total: Number(flow && flow.total) || 0
          }, "*");
        }
      };
      window.addEventListener("error", function (event) {
        parent.postMessage({
          source: "jak-sanggar-paged-preview",
          id: ${payloadId},
          error: event.message || "Paginasi tidak tersedia"
        }, "*");
      });
    </script>
  </head>
  <body>
    ${body}
    <script src="${pagedPolyfillUrl}"></script>
  </body>
</html>`;
  }, [documentHtml, instanceId]);

  useEffect(() => {
    setMemuat(Boolean(documentHtml.trim()));
    setPesanGagal("");
    setJumlahHalaman(0);
    if (!documentHtml.trim()) return;
    let selesai = false;

    const terimaStatus = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as
        | { source?: string; id?: string; total?: number; error?: string }
        | undefined;
      if (
        data?.source !== "jak-sanggar-paged-preview" ||
        data.id !== instanceId
      ) {
        return;
      }
      selesai = true;
      window.clearTimeout(batasWaktu);
      if (data.error) {
        setPesanGagal(data.error);
      } else {
        setPesanGagal("");
      }
      setJumlahHalaman(Math.max(0, Number(data.total) || 0));
      setMemuat(false);
    };

    window.addEventListener("message", terimaStatus);
    const batasWaktu = window.setTimeout(() => {
      if (selesai) return;
      setMemuat(false);
      setPesanGagal(
        (current) => current || "Paginasi membutuhkan waktu terlalu lama",
      );
    }, 20_000);
    return () => {
      window.removeEventListener("message", terimaStatus);
      window.clearTimeout(batasWaktu);
    };
  }, [documentHtml, instanceId]);

  return (
    <div
      className={`paged-document-preview relative min-h-[720px] overflow-hidden bg-neutral-200 ${className}`}
      data-testid={testId}
      data-page-count={jumlahHalaman}
      data-pagination-error={pesanGagal || undefined}
    >
      <div
        className={`absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow ${memuat ? "" : "hidden"}`}
      >
        Menyusun lembar dokumen…
      </div>
      <div
        className={`absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow ${pesanGagal ? "" : "hidden"}`}
      >
        Preview belum selesai dipaginasi. Silakan coba muat ulang.
      </div>
      {iframeHtml ? (
        <iframe
          ref={iframeRef}
          className="h-[calc(100vh-12rem)] min-h-[720px] w-full border-0 bg-neutral-200"
          title="Pratinjau lembar dokumen"
          sandbox="allow-scripts"
          srcDoc={iframeHtml}
        />
      ) : (
        <div className="grid min-h-[720px] place-items-center text-sm text-muted-foreground">
          Isi formulir untuk melihat preview dokumen.
        </div>
      )}
    </div>
  );
});
