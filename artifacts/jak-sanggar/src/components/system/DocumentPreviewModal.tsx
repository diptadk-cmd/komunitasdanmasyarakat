import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DOCUMENT_PREVIEW_EVENT,
  type DocumentPreviewRequest,
} from "@/lib/document-preview";

function namaPdf(fileName: string): string {
  const name =
    fileName
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim() || "dokumen.pdf";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

function unduhBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = namaPdf(fileName);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function DocumentPreviewModal() {
  const [request, setRequest] = useState<DocumentPreviewRequest | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = (event: Event) => {
      const next = (event as CustomEvent<DocumentPreviewRequest>).detail;
      if (!next) return;
      setError("");
      setDownloading(false);
      setRequest(next);
    };
    window.addEventListener(DOCUMENT_PREVIEW_EVENT, handle);
    return () => window.removeEventListener(DOCUMENT_PREVIEW_EVENT, handle);
  }, []);

  const pdfUrl = useMemo(
    () => (request?.kind === "pdf" ? URL.createObjectURL(request.blob) : ""),
    [request],
  );

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const close = useCallback(() => {
    if (downloading) return;
    setRequest(null);
    setError("");
  }, [downloading]);

  useEffect(() => {
    if (!request) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, request]);

  const download = async () => {
    if (!request || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const blob =
        request.kind === "pdf" ? request.blob : await request.createPdfBlob();
      unduhBlob(blob, request.fileName);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "PDF gagal dibuat. Silakan coba kembali.",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
      data-testid="document-preview-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section className="flex h-[82vh] w-[94vw] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl sm:w-[86vw] lg:w-[50vw]">
        <header className="flex shrink-0 items-center gap-3 border-b bg-slate-950 px-4 py-3 text-white">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Pratinjau Dokumen
            </p>
            <h2 id="document-preview-title" className="truncate text-sm font-semibold sm:text-base">
              {request.title}
            </h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={close}
            disabled={downloading}
            aria-label="Tutup pratinjau dokumen"
            data-testid="button-close-document-preview"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 bg-slate-200 p-2 sm:p-3">
          {request.kind === "pdf" ? (
            <iframe
              title={`Pratinjau ${request.title}`}
              src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              className="h-full w-full rounded-md border bg-white"
              data-testid="document-preview-pdf"
            />
          ) : (
            <iframe
              title={`Pratinjau ${request.title}`}
              srcDoc={request.html}
              sandbox=""
              className="h-full w-full rounded-md border bg-white"
              data-testid="document-preview-html"
            />
          )}
        </div>

        <footer className="shrink-0 border-t bg-white px-4 py-3">
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Periksa isi dokumen sebelum mengunduh berkas PDF.
            </p>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={downloading}>
                Tutup
              </Button>
              <Button
                type="button"
                onClick={() => void download()}
                disabled={downloading}
                data-testid="button-download-preview-pdf"
              >
                {downloading ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {downloading ? "Membuat PDF…" : "Download PDF"}
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
