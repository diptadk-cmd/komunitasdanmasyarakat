export const DOCUMENT_PREVIEW_EVENT = "jak-sanggar:document-preview";

interface DocumentPreviewBase {
  title: string;
  fileName: string;
}

export interface PdfDocumentPreviewRequest extends DocumentPreviewBase {
  kind: "pdf";
  blob: Blob;
}

export interface HtmlDocumentPreviewRequest extends DocumentPreviewBase {
  kind: "html";
  html: string;
  createPdfBlob: () => Promise<Blob>;
}

export type DocumentPreviewRequest =
  | PdfDocumentPreviewRequest
  | HtmlDocumentPreviewRequest;

function emitPreview(request: DocumentPreviewRequest): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DocumentPreviewRequest>(DOCUMENT_PREVIEW_EVENT, {
      detail: request,
    }),
  );
}

export function bukaPratinjauPdf(request: Omit<PdfDocumentPreviewRequest, "kind">) {
  emitPreview({ ...request, kind: "pdf" });
}

export function bukaPratinjauHtml(
  request: Omit<HtmlDocumentPreviewRequest, "kind">,
) {
  emitPreview({ ...request, kind: "html" });
}

