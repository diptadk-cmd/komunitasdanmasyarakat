import { useLayoutEffect, type RefObject } from "react";

/**
 * Area editor naskah yang sengaja tidak memiliki anak JSX.
 *
 * Browser dan React sama-sama dapat mengubah subtree contentEditable apabila
 * isi editor dirender sebagai children. Dengan menjaga elemennya kosong dari
 * sisi React, seluruh perubahan DOM di dalamnya menjadi milik editor dan
 * transisi dialog tidak lagi mencoba menghapus node yang sudah dipindahkan
 * browser.
 */
export function EditableDocument({
  initialHtml,
  version,
  editorRef,
  onChange,
  className = "",
}: {
  initialHtml: string;
  version: number;
  editorRef: RefObject<HTMLDivElement | null>;
  onChange?: () => void;
  className?: string;
}) {
  useLayoutEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      editorRef.current
        .querySelectorAll<HTMLElement>("[data-editor-protected]")
        .forEach((element) => element.setAttribute("contenteditable", "false"));
    }
  }, [editorRef, initialHtml, version]);

  const seleksiMenyentuhBagianTerkunci = (): boolean => {
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return Array.from(root.querySelectorAll("[data-editor-protected]")).some(
      (node) => range.intersectsNode(node),
    );
  };

  return (
    <>
      <style>{`
        .editable-document { box-sizing: border-box; }
        .editable-document p { margin: 0 0 0.75em; }
        .editable-document table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: auto; margin: 0 0 12px; font: inherit; }
        .editable-document th, .editable-document td { vertical-align: top; overflow-wrap: anywhere; }
        .editable-document table.tnd-data th, .editable-document table.tnd-data td { border: 1px solid #111; padding: 5px 8px; }
        .editable-document table.tnd-data th { background: #f2f2f2; text-align: center; }
        .editable-document table.tnd-identitas td { padding: 2px 0; }
        .editable-document table.tnd-identitas td.tnd-label { width: 1%; padding-right: 8px; white-space: nowrap; }
        .editable-document table.tnd-identitas td.tnd-sep { width: 1%; padding: 2px 6px; }
        .editable-document [data-editor-protected] { cursor: not-allowed; user-select: text; }
      `}</style>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={onChange}
        onBeforeInput={(event) => {
          if (seleksiMenyentuhBagianTerkunci()) event.preventDefault();
        }}
        onPaste={(event) => {
          if (seleksiMenyentuhBagianTerkunci()) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
        }}
        data-testid="editor-dokumen"
        className={`editable-document mx-auto w-[210mm] max-w-full bg-white text-black shadow-md outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
        style={{
          minHeight: "297mm",
          padding: "40mm 30mm 30mm 40mm",
          fontFamily: '"Bookman Old Style", Bookman, serif',
          fontSize: "11pt",
          lineHeight: "1.15",
        }}
      />
    </>
  );
}
