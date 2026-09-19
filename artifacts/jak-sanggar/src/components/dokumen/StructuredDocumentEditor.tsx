import {
  useLayoutEffect,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { tataNaskah } from "@/lib/dokumen";

const EDITABLE_ATTR = "data-structured-document-editable";

/**
 * Siapkan HTML naskah agar struktur (terutama tabel AD/ART) tidak menjadi
 * editing host. Teks tetap dapat diedit di dalam sel tabel, paragraf, judul,
 * dan butir daftar masing-masing.
 *
 * Menjadikan seluruh root `contentEditable` akan membolehkan Backspace/paste
 * menghapus atau memecah `<tr>`/`<td>`. Di sini tabel tetap non-editable dan
 * hanya `<td>/<th>` yang menerima input, sehingga grid tabel bertahan.
 */
export function siapkanHtmlEditorTerstruktur(html: string): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  // Elemen ini hanya menjadi wadah struktur. Child editing host di bawahnya
  // (td/th, p, li, dan heading) tetap bisa aktif secara eksplisit.
  template.content
    .querySelectorAll("table, thead, tbody, tfoot, tr, ol, ul")
    .forEach((element) => element.setAttribute("contenteditable", "false"));

  template.content
    .querySelectorAll("td, th, p, li, h1, h2, h3, h4, h5, h6")
    .forEach((element) => {
      // Paragraf yang berada di dalam sel mewarisi editing host td/th. Tidak
      // dibuat host kedua agar seleksi dan Enter di dalam sel tetap stabil.
      if (element.tagName === "P" && element.closest("td, th")) {
        return;
      }
      element.setAttribute("contenteditable", "true");
      element.setAttribute(EDITABLE_ATTR, "true");
    });

  return template.innerHTML;
}

/**
 * Ambil snapshot HTML tanpa atribut editor sementara. Snapshot ini dapat
 * disimpan atau dicetak tanpa mengubah tabel/struktur dokumen asal.
 */
export function ambilHtmlEditorTerstruktur(
  editor: HTMLDivElement | null,
): string {
  if (!editor) return "";
  const salinan = editor.cloneNode(true) as HTMLDivElement;
  salinan.querySelectorAll("[contenteditable]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute(EDITABLE_ATTR);
  });
  return salinan.innerHTML.trim();
}

function nearestEditingHost(node: Node | null): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  return element?.closest(`[${EDITABLE_ATTR}="true"]`) as HTMLElement | null;
}

function selectionDiHostYangSama(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return true;
  const awal = nearestEditingHost(selection.anchorNode);
  const akhir = nearestEditingHost(selection.focusNode);
  return !!awal && awal === akhir;
}

function sisipkanTeksBiasa(text: string): void {
  if (!text) return;
  // Chrome/Edge mendukung insertText pada editing host. Ini sengaja dipakai
  // agar HTML, tabel, style, dan event handler dari clipboard tidak ikut masuk.
  document.execCommand("insertText", false, text);
}

export function StructuredDocumentEditor({
  initialHtml,
  version,
  editorRef,
  className = "",
  testId = "editor-dokumen-terstruktur",
  pagePreset,
  onInput,
}: {
  initialHtml: string;
  version: number;
  editorRef: RefObject<HTMLDivElement | null>;
  className?: string;
  testId?: string;
  /** Gunakan lembar A4 yang diatur oleh CSS template Word di dalam editor. */
  pagePreset?: "template-a4";
  /** Dipanggil setelah teks berubah; caller boleh menandai status draf saja. */
  onInput?: () => void;
}) {
  const memakaiTemplateA4 = pagePreset === "template-a4";
  const kelasTabelGenerik = memakaiTemplateA4
    ? ""
    : "[&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_td]:align-top [&_td]:p-1 [&_th]:p-1";
  useLayoutEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = siapkanHtmlEditorTerstruktur(initialHtml);
    }
  }, [editorRef, initialHtml, version]);

  const handleBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    const inputType = nativeEvent.inputType ?? "";
    if (!nearestEditingHost(event.target as Node)) {
      event.preventDefault();
      return;
    }
    // Jangan biarkan penghapusan terhadap rentang yang melewati dua sel /
    // paragraf karena browser dapat menyatukan atau membuang node struktur.
    if (inputType.startsWith("delete") && !selectionDiHostYangSama()) {
      event.preventDefault();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      !selectionDiHostYangSama()
    ) {
      event.preventDefault();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!nearestEditingHost(event.target as Node)) {
      event.preventDefault();
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    event.preventDefault();
    sisipkanTeksBiasa(text);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    // Sama seperti paste: hanya teks biasa boleh masuk agar drop tidak
    // menyisipkan tabel/foto/HTML yang dapat merusak struktur naskah.
    event.preventDefault();
    if (!nearestEditingHost(event.target as Node)) return;
    sisipkanTeksBiasa(event.dataTransfer.getData("text/plain"));
  };

  return (
    <div
      ref={editorRef}
      contentEditable={false}
      suppressContentEditableWarning
      spellCheck={false}
      data-testid={testId}
      className={`mx-auto w-full max-w-[820px] bg-white text-black shadow-md outline-none ${kelasTabelGenerik} ${className}`}
      style={{
        minHeight: memakaiTemplateA4 ? "297mm" : "60vh",
        padding: memakaiTemplateA4 ? 0 : "28px 32px",
        fontFamily: memakaiTemplateA4
          ? '"Bookman Old Style", "Book Antiqua", "Palatino Linotype", Georgia, "Times New Roman", serif'
          : `"${tataNaskah().fontKeluarga || "Times New Roman"}", serif`,
        fontSize: memakaiTemplateA4
          ? "11pt"
          : `${tataNaskah().fontUkuranPt || 12}pt`,
        lineHeight: memakaiTemplateA4
          ? "1.1"
          : String(tataNaskah().spasiBaris ?? 1.5),
      }}
      onBeforeInput={handleBeforeInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onInput={onInput}
    />
  );
}
