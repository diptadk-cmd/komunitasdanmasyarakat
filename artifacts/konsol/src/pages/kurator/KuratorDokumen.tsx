import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useDb } from "@/lib/auth";
import { dokumenPaketUrl } from "@/lib/dokumen-paket";
import { logActivity, persistAppearance } from "@/lib/store";
import {
  bungkusHtmlDokumenTemplate,
  cssDenganLayoutDokumenTemplate,
  type DokumenTemplateLayoutOverrides,
} from "@sanggar-doc-layout";
import {
  bangunHtmlUnduhanDokumen,
  unduhDokumen,
  type FormatUnduhanDokumen,
} from "@sanggar-doc-export";
import { PagedDocumentPreview } from "@sanggar-paged-preview";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileText,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Redo2,
  RotateCcw,
  Save,
  Shrink,
  StretchHorizontal,
  Table2,
  Type,
  Underline,
  Undo2,
  Wand2,
} from "lucide-react";

interface PaketDokumen {
  id: string;
  judul: string;
  html: string;
  layout?: DokumenTemplateLayoutOverrides;
}

interface PaketData {
  paketId: string;
  label: string;
  dokumen: PaketDokumen[];
}

const PAKET = [
  { id: "mandiri-non-bh", label: "Mandiri · Non-Badan Hukum" },
  { id: "mandiri-bh-yayasan", label: "Mandiri · Yayasan" },
  { id: "mandiri-bh-perkumpulan", label: "Mandiri · Perkumpulan" },
  { id: "mandiri-bh-koperasi", label: "Mandiri · Koperasi" },
  { id: "mandiri-bh-pt", label: "Mandiri · Perseroan Terbatas" },
  { id: "mandiri-bu-firma", label: "Mandiri · Firma" },
  { id: "mandiri-bu-cv", label: "Mandiri · CV" },
  { id: "unit-bh-yayasan", label: "Unit · Yayasan" },
  { id: "unit-bh-perkumpulan", label: "Unit · Perkumpulan" },
  { id: "unit-bh-koperasi", label: "Unit · Koperasi" },
  { id: "unit-bh-pt", label: "Unit · Perseroan Terbatas" },
  { id: "unit-bu-firma", label: "Unit · Firma" },
  { id: "unit-bu-cv", label: "Unit · CV" },
  { id: "unit-non-bh-atribut-induk", label: "Unit Non-BH · Atribut Induk" },
  { id: "unit-non-bh-atribut-khusus", label: "Unit Non-BH · Atribut Khusus" },
] as const;

const DEFAULT_LAYOUT: Required<DokumenTemplateLayoutOverrides> = {
  fontFamily: '"Times New Roman", Times, serif',
  fontSizePt: 11,
  lineHeight: 1.3,
  pageWidthMm: 210,
  pageHeightMm: 297,
  orientation: "portrait",
  marginTopMm: 25,
  marginRightMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 30,
};

const EDITABLE_ATTR = "data-kurator-editable";

function siapkanHtmlEditor(html: string, dokumenId: string): string {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = bungkusHtmlDokumenTemplate(html, { dokumenId });
  const root = template.content.querySelector("[data-dokumen-template-root]");
  root?.setAttribute("data-kurator-root", "true");
  template.content
    .querySelectorAll("table, thead, tbody, tfoot, tr, ol, ul")
    .forEach((element) => element.setAttribute("contenteditable", "false"));
  template.content
    .querySelectorAll("td, th, p, li, h1, h2, h3, h4, h5, h6")
    .forEach((element) => {
      if (element.tagName === "P" && element.closest("td, th")) return;
      element.setAttribute("contenteditable", "true");
      element.setAttribute(EDITABLE_ATTR, "true");
    });
  return template.innerHTML;
}

function ambilHtmlEditor(editor: HTMLDivElement | null): string {
  if (!editor) return "";
  const root = (editor.querySelector("[data-kurator-root]") ?? editor) as HTMLElement;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("data-kurator-root");
  clone.querySelectorAll("[contenteditable]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute(EDITABLE_ATTR);
  });
  // Penanda blok hanya untuk tampilan saat menyunting — jangan ikut tersimpan.
  clone.querySelectorAll("[data-blok],[data-blok-teks]").forEach((element) => {
    element.removeAttribute("data-blok");
    element.removeAttribute("data-blok-teks");
  });
  return clone.innerHTML.trim();
}

function editingHost(node: Node | null): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  return element?.closest(`[${EDITABLE_ATTR}="true"]`) as HTMLElement | null;
}

function sameEditingHost(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return true;
  const anchorHost = editingHost(selection.anchorNode);
  const focusHost = editingHost(selection.focusNode);
  return !!anchorHost && anchorHost === focusHost;
}

function stopUnsafeDelete(event: KeyboardEvent<HTMLDivElement> | FormEvent<HTMLDivElement>) {
  if (event.type === "keydown") {
    const key = (event as KeyboardEvent<HTMLDivElement>).key;
    if ((key === "Backspace" || key === "Delete") && !sameEditingHost()) {
      event.preventDefault();
    }
  } else {
    const native = event.nativeEvent as InputEvent;
    if (native.inputType?.startsWith("delete") && !sameEditingHost()) event.preventDefault();
  }
}

function sisipkanTeksBiasa(text: string) {
  if (!text) return;
  document.execCommand("insertText", false, text);
}

/**
 * Benar bila caret/seleksi sedang berada di dalam salah satu blok yang memang
 * boleh disunting DAN masih di dalam kanvas editor.
 *
 * Wajib dicek sebelum `document.execCommand`: bila caret berada di luar,
 * execCommand tetap jalan tetapi menyunting seleksi milik dokumen lain —
 * termasuk DOM yang dikelola React — dan itulah yang memunculkan error
 * "Failed to execute 'insertBefore' on 'Node'".
 */
function seleksiSiapDisunting(editor: HTMLElement | null): boolean {
  if (!editor) return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const host = editingHost(selection.anchorNode);
  return !!host && editor.contains(host);
}

/** Lebar minimum satu kolom saat digeser, supaya tidak bisa hilang. */
const LEBAR_KOLOM_MIN = 24;

/**
 * Pastikan tabel punya <colgroup> dengan lebar eksplisit per kolom, diukur dari
 * lebar sel yang sedang tampil. Ini yang digeser saat pengguna menarik batas
 * kolom — jauh lebih stabil daripada menulis lebar di tiap <td>.
 */
function pastikanColgroup(table: HTMLTableElement): HTMLTableColElement[] {
  const barisTerlebar = Array.from(table.rows).reduce<HTMLTableRowElement | null>(
    (terpanjang, baris) => (baris.cells.length > (terpanjang?.cells.length ?? 0) ? baris : terpanjang),
    null,
  );
  const jumlahKolom = barisTerlebar?.cells.length ?? 0;
  if (!jumlahKolom) return [];

  let group = table.querySelector("colgroup");
  if (!group || group.querySelectorAll("col").length !== jumlahKolom) {
    group?.remove();
    group = document.createElement("colgroup");
    for (let i = 0; i < jumlahKolom; i += 1) group.appendChild(document.createElement("col"));
    table.insertBefore(group, table.firstChild);
  }

  const cols = Array.from(group.querySelectorAll("col"));
  let total = 0;
  cols.forEach((col, i) => {
    const terpasang = parseFloat(col.style.width);
    const lebar = Number.isFinite(terpasang) && terpasang > 0
      ? terpasang
      : (barisTerlebar?.cells[i]?.getBoundingClientRect().width ?? 0);
    const dipakai = Math.max(LEBAR_KOLOM_MIN, Math.round(lebar));
    col.style.width = `${dipakai}px`;
    total += dipakai;
  });

  // Lebar kolom hanya dipatuhi browser saat tata letak tabel "fixed".
  table.style.tableLayout = "fixed";
  table.style.width = `${total}px`;
  table.style.maxWidth = "100%";
  return cols;
}

function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-1.5 text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Satu grup pada panel, meniru kelompok bertajuk di ribbon Word. */
function Grup({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{judul}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** Tombol ringkas di dalam grup panel. */
function TombolPanel({
  label,
  title,
  onClick,
  disabled,
  children,
}: {
  label?: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded border border-transparent px-1.5 text-[11px] text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
      {label}
    </button>
  );
}

export function KuratorDokumen() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [paketId, setPaketId] = useState<string>(PAKET[0].id);
  const [paket, setPaket] = useState<PaketData | null>(null);
  const [dokumenId, setDokumenId] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState<string | null>(null);
  const [muatUlang, setMuatUlang] = useState(0);
  const [htmlDraft, setHtmlDraft] = useState("");
  const [layout, setLayout] = useState<Required<DokumenTemplateLayoutOverrides>>(DEFAULT_LAYOUT);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mengunduh, setMengunduh] = useState<FormatUnduhanDokumen | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [pratinjauTerbuka, setPratinjauTerbuka] = useState(false);
  const [tableContext, setTableContext] = useState<HTMLTableElement | null>(null);
  const [tableCellContext, setTableCellContext] = useState<HTMLTableCellElement | null>(null);
  // Naik setiap kali blok berubah, supaya tombol panel ikut aktif/nonaktif.
  const [blokVersi, setBlokVersi] = useState(0);
  // Apakah caret sedang berada di dalam tabel — menentukan panel tabel aktif.
  const [caretDiTabel, setCaretDiTabel] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setMemuat(true);
    setGagal(null);
    setPaket(null);
    fetch(dokumenPaketUrl(import.meta.env.BASE_URL, paketId), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Gagal memuat template (${response.status})`);
        return response.json() as Promise<PaketData>;
      })
      .then((data) => {
        if (!Array.isArray(data.dokumen) || data.dokumen.length === 0) {
          throw new Error("Paket template tidak memiliki dokumen.");
        }
        setPaket(data);
        setDokumenId(data.dokumen[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGagal(error instanceof Error ? error.message : "Template belum dapat dimuat.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMemuat(false);
      });
    return () => {
      controller.abort();
    };
  }, [paketId, muatUlang]);

  const dokumen = useMemo(
    () => paket?.dokumen.find((item) => item.id === dokumenId) ?? paket?.dokumen[0] ?? null,
    [paket, dokumenId],
  );
  const templateKey = dokumen ? `${paketId}:${dokumen.id}` : "";
  const storedOverride = templateKey ? db.appearance.dokumenTemplates?.[templateKey] : undefined;
  const storedVersion = storedOverride?.updatedAt ?? 0;

  useEffect(() => {
    if (!dokumen || !templateKey) return;
    setHtmlDraft(storedOverride?.html ?? dokumen.html);
    setLayout({
      ...DEFAULT_LAYOUT,
      ...(dokumen.layout ?? {}),
      ...(storedOverride?.layout ?? {}),
    });
    setDirty(false);
    setEditorVersion((value) => value + 1);
  }, [dokumen?.id, dokumen?.html, templateKey, storedVersion]);

  useLayoutEffect(() => {
    if (!editorRef.current || !dokumen) return;
    editorRef.current.innerHTML = siapkanHtmlEditor(htmlDraft, dokumen.id);
  }, [editorVersion]);

  /**
   * Geser batas kolom tabel dengan mouse.
   *
   * Tabel sengaja dibuat contentEditable="false" agar susunan naskah tidak
   * rusak — konsekuensinya pegangan resize bawaan browser tidak muncul. Jadi
   * pegangannya dibuat sendiri di sini: listener dipasang sekali di wadah
   * editor (event delegation) supaya tetap hidup meski isi editor diganti.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const AMBANG_PX = 6;
    let geser: {
      kolom: HTMLTableColElement;
      berikut: HTMLTableColElement | null;
      mulaiX: number;
      lebar: number;
      lebarBerikut: number;
    } | null = null;

    const batasKolomDi = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const cell = target?.closest("td,th") as HTMLTableCellElement | null;
      if (!cell || !editor.contains(cell)) return null;
      const rect = cell.getBoundingClientRect();
      if (event.clientX < rect.right - AMBANG_PX) return null;
      const table = cell.closest("table") as HTMLTableElement | null;
      if (!table || cell.cellIndex < 0) return null;
      return { table, indeks: cell.cellIndex };
    };

    const saatBergerak = (event: MouseEvent) => {
      if (geser) return;
      editor.style.cursor = batasKolomDi(event) ? "col-resize" : "";
    };

    const saatMenarik = (event: MouseEvent) => {
      if (!geser) return;
      const selisih = event.clientX - geser.mulaiX;
      let lebarBaru = Math.max(LEBAR_KOLOM_MIN, geser.lebar + selisih);
      if (geser.berikut) {
        // Kolom tetangga menyusut sebesar penambahan kolom ini, jadi lebar
        // tabel tidak ikut melar saat digeser.
        const tetanggaBaru = Math.max(LEBAR_KOLOM_MIN, geser.lebarBerikut - selisih);
        lebarBaru = geser.lebar + geser.lebarBerikut - tetanggaBaru;
        geser.berikut.style.width = `${Math.round(tetanggaBaru)}px`;
      }
      geser.kolom.style.width = `${Math.round(lebarBaru)}px`;
    };

    const saatLepas = () => {
      if (!geser) return;
      geser = null;
      editor.style.cursor = "";
      document.removeEventListener("mousemove", saatMenarik);
      document.removeEventListener("mouseup", saatLepas);
      syncDraft();
    };

    const saatTekan = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const batas = batasKolomDi(event);
      if (!batas) return;
      event.preventDefault();
      const cols = pastikanColgroup(batas.table);
      const kolom = cols[batas.indeks];
      if (!kolom) return;
      geser = {
        kolom,
        berikut: cols[batas.indeks + 1] ?? null,
        mulaiX: event.clientX,
        lebar: parseFloat(kolom.style.width) || LEBAR_KOLOM_MIN,
        lebarBerikut: parseFloat(cols[batas.indeks + 1]?.style.width ?? "") || 0,
      };
      document.addEventListener("mousemove", saatMenarik);
      document.addEventListener("mouseup", saatLepas);
    };

    editor.addEventListener("mousemove", saatBergerak);
    editor.addEventListener("mousedown", saatTekan);
    return () => {
      editor.removeEventListener("mousemove", saatBergerak);
      editor.removeEventListener("mousedown", saatTekan);
      document.removeEventListener("mousemove", saatMenarik);
      document.removeEventListener("mouseup", saatLepas);
      editor.style.cursor = "";
    };
  }, [editorVersion]);

  // Pantau posisi caret supaya panel tabel hidup/mati seperti ribbon kontekstual
  // "Tata Letak Tabel" di Word yang hanya muncul saat kursor ada di tabel.
  useEffect(() => {
    const perbarui = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const node = selection?.anchorNode ?? null;
      const element = node instanceof HTMLElement ? node : node?.parentElement;
      const cell = element?.closest("td,th") ?? null;
      setCaretDiTabel(!!cell && !!editor?.contains(cell));
    };
    document.addEventListener("selectionchange", perbarui);
    return () => document.removeEventListener("selectionchange", perbarui);
  }, []);

  const activeHtml = htmlDraft || dokumen?.html || "";
  const previewHtml = dokumen
    ? bungkusHtmlDokumenTemplate(activeHtml, { dokumenId: dokumen.id })
    : "";
  const previewCss = cssDenganLayoutDokumenTemplate(layout);
  const previewDocumentHtml = dokumen
    ? bangunHtmlUnduhanDokumen({
        title: dokumen.judul,
        fileName: `${dokumen.id}-${dokumen.judul}`,
        bodyHtml: previewHtml,
        finalCss: previewCss,
      })
    : "";
  const editorCss = `${previewCss}
    @media screen {
      [data-kurator-root="true"] {
        background: #fff !important;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2) !important;
      }
      /* Sel yang sedang diblok — meniru sorotan biru pada blok tabel di Word. */
      [data-blok="1"] {
        outline: 2px solid #2f6fd0 !important;
        outline-offset: -2px;
        background-color: rgba(47, 111, 208, 0.12) !important;
      }
      /* Paragraf yang sedang diblok. */
      [data-blok-teks="1"] {
        background-color: rgba(47, 111, 208, 0.10) !important;
      }
    }
  `;

  const syncDraft = () => {
    setHtmlDraft(ambilHtmlEditor(editorRef.current));
    setDirty(true);
  };

  const command = (name: string, value?: string) => {
    // Kanvas editor sendiri contentEditable={false}, jadi memfokuskannya TIDAK
    // menaruh caret di blok yang bisa disunting. Bila tetap dipaksa,
    // execCommand akan mengobrak-abrik seleksi di luar editor — termasuk node
    // milik React — dan memicu error insertBefore.
    if (!seleksiSiapDisunting(editorRef.current)) {
      toast({
        title: "Letakkan kursor di teks dulu",
        description: "Klik pada paragraf atau sel tabel yang ingin diubah, lalu tekan tombolnya kembali.",
      });
      return;
    }
    document.execCommand(name, false, value);
    syncDraft();
  };

  const handleEditorContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const element = event.target instanceof Element ? event.target : null;
    const table = element?.closest("table") as HTMLTableElement | null;
    const cell = element?.closest("td,th") as HTMLTableCellElement | null;
    setTableContext(table);
    setTableCellContext(cell && cell.closest("table") === table ? cell : null);
  };

  const updateTable = (operation: (table: HTMLTableElement) => void) => {
    if (!tableContext) return;
    operation(tableContext);
    syncDraft();
    setTableContext(null);
    setTableCellContext(null);
  };

  const resetTableCells = (table: HTMLTableElement) => {
    table.querySelectorAll<HTMLElement>("td,th").forEach((cell) => {
      cell.style.width = "";
      cell.style.maxWidth = "";
    });
  };

  /** Lebar kolom mengikuti panjang isi tiap sel (AutoFit to contents). */
  const autofitKonten = (table: HTMLTableElement) => {
    table.querySelector("colgroup")?.remove();
    table.style.width = "auto";
    table.style.maxWidth = "100%";
    table.style.tableLayout = "auto";
    resetTableCells(table);
  };

  /** Tabel dilebarkan penuh selebar area teks halaman (AutoFit to window). */
  const autofitJendela = (table: HTMLTableElement) => {
    table.querySelector("colgroup")?.remove();
    table.style.width = "100%";
    table.style.maxWidth = "100%";
    table.style.tableLayout = "fixed";
    resetTableCells(table);
  };

  /** Buang semua penyesuaian, kembali ke ukuran bawaan template sumber. */
  const ukuranSumber = (table: HTMLTableElement) => {
    table.querySelector("colgroup")?.remove();
    table.style.width = "";
    table.style.maxWidth = "";
    table.style.tableLayout = "";
    resetTableCells(table);
  };

  /** Tabel tempat caret berada, bila ada. */
  const tabelDariSeleksi = (): HTMLTableElement | null => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const node = selection?.anchorNode ?? null;
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    const table = element?.closest("table") as HTMLTableElement | null;
    return table && editor?.contains(table) ? table : null;
  };

  /**
   * Tombol perapian tabel di toolbar. Bila caret sedang di dalam sebuah tabel,
   * hanya tabel itu yang dirapikan; bila tidak, seluruh tabel di dokumen.
   */
  const terapkanAutofit = (mode: "konten" | "jendela") => {
    const editor = editorRef.current;
    if (!editor) return;
    const terfokus = tabelDariSeleksi();
    const daftar = terfokus
      ? [terfokus]
      : Array.from(editor.querySelectorAll<HTMLTableElement>("table"));
    if (!daftar.length) {
      toast({ title: "Tidak ada tabel", description: "Dokumen ini belum memuat tabel." });
      return;
    }
    daftar.forEach((table) => (mode === "konten" ? autofitKonten(table) : autofitJendela(table)));
    syncDraft();
    toast({
      title: mode === "konten" ? "Tabel dirapikan pas konten" : "Tabel dirapikan pas jendela",
      description: terfokus ? "Berlaku untuk tabel tempat kursor berada." : `${daftar.length} tabel diperbarui.`,
    });
  };

  /** "Lebar Kolom Tetap" di Word — kunci lebar kolom pada ukurannya saat ini. */
  const kunciLebarKolom = () => {
    const table = tabelDariSeleksi();
    if (!table) {
      toast({ title: "Letakkan kursor di dalam tabel dulu" });
      return;
    }
    pastikanColgroup(table);
    syncDraft();
    toast({ title: "Lebar kolom dikunci", description: "Kolom tidak lagi menyesuaikan diri saat isi bertambah." });
  };

  // ── Blok (meniru menu "Pilih" pada Tata Letak Tabel di Word) ──────────────

  /** Sel tempat caret berada. */
  const selDariSeleksi = (): HTMLTableCellElement | null => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const node = selection?.anchorNode ?? null;
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    const cell = element?.closest("td,th") as HTMLTableCellElement | null;
    return cell && editor?.contains(cell) ? cell : null;
  };

  /** Sel-sel yang sedang diblok. */
  const selBlok = (): HTMLTableCellElement[] =>
    Array.from(editorRef.current?.querySelectorAll<HTMLTableCellElement>('[data-blok="1"]') ?? []);

  const bersihkanBlok = () => {
    editorRef.current?.querySelectorAll("[data-blok]").forEach((el) => el.removeAttribute("data-blok"));
    editorRef.current?.querySelectorAll("[data-blok-teks]").forEach((el) => el.removeAttribute("data-blok-teks"));
    setBlokVersi((v) => v + 1);
  };

  const pilihBlok = (mode: "sel" | "kolom" | "baris" | "tabel") => {
    const cell = selDariSeleksi();
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (!cell || !table) {
      toast({ title: "Klik dulu di dalam sel tabel", description: "Blok dihitung dari posisi kursor." });
      return;
    }
    bersihkanBlok();
    const tandai = (daftar: Iterable<Element>) =>
      Array.from(daftar).forEach((el) => el.setAttribute("data-blok", "1"));

    if (mode === "sel") tandai([cell]);
    if (mode === "baris") tandai(cell.closest("tr")?.cells ?? []);
    if (mode === "kolom") {
      const indeks = cell.cellIndex;
      tandai(Array.from(table.rows).map((r) => r.cells[indeks]).filter(Boolean) as Element[]);
    }
    if (mode === "tabel") tandai(table.querySelectorAll("td,th"));
    setBlokVersi((v) => v + 1);
  };

  /** Terapkan gaya ke seluruh sel yang diblok (atau ke sel tempat caret bila belum ada blok). */
  const gayaBlokSel = (patch: Partial<CSSStyleDeclaration>) => {
    const daftar = selBlok();
    const sasaran = daftar.length ? daftar : ([selDariSeleksi()].filter(Boolean) as HTMLTableCellElement[]);
    if (!sasaran.length) {
      toast({ title: "Belum ada sel yang diblok" });
      return;
    }
    sasaran.forEach((cell) => Object.assign(cell.style, patch));
    syncDraft();
  };

  /** Gabungkan sel-sel yang diblok dalam satu baris (Gabung Sel di Word). */
  const gabungSel = () => {
    const daftar = selBlok();
    if (daftar.length < 2) {
      toast({ title: "Blok minimal dua sel", description: "Gunakan Pilih Baris atau Pilih Kolom lebih dulu." });
      return;
    }
    const baris = daftar[0].closest("tr");
    if (!baris || daftar.some((cell) => cell.closest("tr") !== baris)) {
      toast({
        title: "Hanya bisa dalam satu baris",
        description: "Penggabungan antar-baris belum didukung agar susunan naskah tetap aman.",
        variant: "destructive",
      });
      return;
    }
    const urut = daftar.slice().sort((a, b) => a.cellIndex - b.cellIndex);
    const utama = urut[0];
    const rentang = urut.reduce((jumlah, cell) => jumlah + (cell.colSpan || 1), 0);
    utama.innerHTML = urut.map((cell) => cell.innerHTML).join(" ");
    urut.slice(1).forEach((cell) => cell.remove());
    utama.colSpan = rentang;
    bersihkanBlok();
    syncDraft();
  };

  /** Pecah kembali sel bergabung menjadi beberapa sel (Pisahkan Sel di Word). */
  const pisahkanSel = () => {
    const cell = selBlok()[0] ?? selDariSeleksi();
    if (!cell || (cell.colSpan || 1) < 2) {
      toast({ title: "Sel ini tidak tergabung", description: "Pilih sel hasil penggabungan lebih dulu." });
      return;
    }
    const jumlah = cell.colSpan;
    cell.colSpan = 1;
    const baris = cell.closest("tr");
    for (let i = 1; i < jumlah; i += 1) {
      const baru = baris?.insertCell(cell.cellIndex + i);
      if (!baru) break;
      baru.setAttribute("contenteditable", "true");
      baru.setAttribute(EDITABLE_ATTR, "true");
      baru.innerHTML = "<p><br></p>";
    }
    bersihkanBlok();
    syncDraft();
  };

  // ── Blok tulisan (paragraf) ───────────────────────────────────────────────

  /** Paragraf/judul yang bersinggungan dengan seleksi saat ini. */
  const hostTulisan = (): HTMLElement[] => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    return Array.from(editor.querySelectorAll<HTMLElement>(`[${EDITABLE_ATTR}="true"]`)).filter((el) =>
      range.intersectsNode(el),
    );
  };

  const gayaParagraf = (patch: Partial<CSSStyleDeclaration>) => {
    const sasaran = hostTulisan();
    if (!sasaran.length) {
      toast({ title: "Blok tulisannya dulu", description: "Sorot teks atau klik di paragraf yang ingin diatur." });
      return;
    }
    sasaran.forEach((el) => Object.assign(el.style, patch));
    syncDraft();
  };

  /** Hapus baris tempat caret berada (bukan lewat menu klik-kanan). */
  const hapusBarisAktif = () => {
    const cell = selDariSeleksi();
    const table = cell?.closest("table") as HTMLTableElement | null;
    const row = cell?.closest("tr");
    if (!table || !row) return;
    if (table.rows.length <= 1) {
      toast({ title: "Baris terakhir tidak bisa dihapus" });
      return;
    }
    row.remove();
    bersihkanBlok();
    syncDraft();
  };

  /** Hapus kolom tempat caret berada, termasuk entri <col> yang menyertainya. */
  const hapusKolomAktif = () => {
    const cell = selDariSeleksi();
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (!table || !cell || cell.cellIndex < 0) return;
    if ((table.rows[0]?.cells.length ?? 0) <= 1) {
      toast({ title: "Kolom terakhir tidak bisa dihapus" });
      return;
    }
    const indeks = cell.cellIndex;
    Array.from(table.rows).forEach((row) => row.cells[indeks]?.remove());
    table.querySelector("colgroup")?.querySelectorAll("col")[indeks]?.remove();
    bersihkanBlok();
    syncDraft();
  };

  // Dihitung ulang tiap blok berubah atau dokumen dimuat ulang.
  const jumlahBlok = useMemo(() => selBlok().length, [blokVersi, editorVersion]);

  const tambahBaris = () => updateTable((table) => {
    const firstRow = table.rows[0];
    const columnCount = firstRow?.cells.length ?? 1;
    const body = table.tBodies[0] ?? table.createTBody();
    const row = body.insertRow(-1);
    for (let index = 0; index < columnCount; index += 1) {
      const cell = row.insertCell(-1);
      cell.setAttribute("contenteditable", "true");
      cell.setAttribute(EDITABLE_ATTR, "true");
      cell.innerHTML = "<p><br></p>";
    }
  });

  const tambahKolom = () => updateTable((table) => {
    Array.from(table.rows).forEach((row) => {
      const cell = row.insertCell(-1);
      cell.setAttribute("contenteditable", "true");
      cell.setAttribute(EDITABLE_ATTR, "true");
      cell.innerHTML = "<p><br></p>";
    });
  });

  const hapusBaris = () => updateTable((table) => {
    const row = tableCellContext?.closest("tr");
    if (row && table.rows.length > 1) row.remove();
  });

  const hapusKolom = () => updateTable((table) => {
    const cell = tableCellContext;
    if (!cell || cell.cellIndex < 0) return;
    const index = cell.cellIndex;
    Array.from(table.rows).forEach((row) => row.cells[index]?.remove());
  });

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    stopUnsafeDelete(event);
    if (event.defaultPrevented) return;

    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier || event.altKey) return;

    const shortcuts: Record<string, string> = {
      b: "bold",
      i: "italic",
      u: "underline",
      z: "undo",
      y: "redo",
    };
    const commandName = shortcuts[event.key.toLowerCase()];
    if (!commandName) return;
    event.preventDefault();
    command(commandName);
  };

  const setLayoutValue = <K extends keyof Required<DokumenTemplateLayoutOverrides>>(
    key: K,
    value: Required<DokumenTemplateLayoutOverrides>[K],
  ) => {
    setLayout((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };

  const simpan = async () => {
    if (!dokumen || !templateKey) return;
    const html = ambilHtmlEditor(editorRef.current) || htmlDraft;
    setSaving(true);
    try {
      await persistAppearance((appearance) => {
        appearance.dokumenTemplates = {
          ...(appearance.dokumenTemplates ?? {}),
          [templateKey]: {
            html,
            updatedAt: Date.now(),
            layout: { ...layout },
          },
        };
      });
      logActivity(user?.id ?? "kurator", "kurator", "template-dokumen-diperbarui", {
        template: templateKey,
        judul: dokumen.judul,
      });
      setHtmlDraft(html);
      setDirty(false);
      toast({ title: "Template tersimpan", description: "Perubahan akan dipakai pada keluaran dokumen sanggar." });
    } catch (error: unknown) {
      toast({
        title: "Template belum tersimpan",
        description: error instanceof Error ? error.message : "Periksa koneksi lalu coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!dokumen || !templateKey) return;
    setSaving(true);
    try {
      await persistAppearance((appearance) => {
        const next = { ...(appearance.dokumenTemplates ?? {}) };
        delete next[templateKey];
        appearance.dokumenTemplates = next;
      });
      toast({ title: "Dikembalikan ke template sumber", description: "Draf kurator untuk dokumen ini telah dihapus." });
    } catch (error: unknown) {
      toast({ title: "Gagal mengembalikan template", description: error instanceof Error ? error.message : "Coba lagi.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const unduh = async (format: FormatUnduhanDokumen) => {
    if (!dokumen) return;
    const html = ambilHtmlEditor(editorRef.current) || htmlDraft;
    setMengunduh(format);
    try {
      await unduhDokumen(format, {
        title: dokumen.judul,
        fileName: `${dokumen.id}-${dokumen.judul}`,
        bodyHtml: bungkusHtmlDokumenTemplate(html, { dokumenId: dokumen.id }),
        finalCss: previewCss,
      });
      toast({
        title: `${format === "word" ? "Word" : "PDF"} berhasil diunduh`,
        description:
          format === "word"
            ? "Berkas berupa DOCX Office asli dan dapat diedit di Microsoft Word."
            : "Berkas berupa PDF asli dengan halaman terpisah.",
      });
    } catch (error: unknown) {
      toast({
        title: "Berkas belum dapat dibuat",
        description: error instanceof Error ? error.message : "Coba lagi setelah halaman selesai dimuat.",
        variant: "destructive",
      });
    } finally {
      setMengunduh(null);
    }
  };

  // Pustaka/ribbon Office adalah alat administrasi Kurator. Akun lain tidak
  // pernah menerima panel ini meskipun mencoba membuka URL secara langsung.
  if (!user || user.role !== "kurator") return null;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Studio Template Dokumen"
        subtitle="Atur isi dan tampilan keluaran dokumen seperti mengetik di Microsoft Word. Tabel sumber dilindungi agar susunan naskah tidak rusak."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={dirty ? "outline" : "secondary"} className="gap-1.5">
              {dirty ? <Wand2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {dirty ? "Ada perubahan" : "Tersimpan"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void unduh("word")} disabled={!dokumen || mengunduh !== null}>
              <Loader2 className={`mr-1.5 h-4 w-4 animate-spin ${mengunduh === "word" ? "" : "hidden"}`} />
              <FileText className={`mr-1.5 h-4 w-4 ${mengunduh === "word" ? "hidden" : ""}`} />
              <span>Unduh Word</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void unduh("pdf")} disabled={!dokumen || mengunduh !== null}>
              <Loader2 className={`mr-1.5 h-4 w-4 animate-spin ${mengunduh === "pdf" ? "" : "hidden"}`} />
              <Download className={`mr-1.5 h-4 w-4 ${mengunduh === "pdf" ? "hidden" : ""}`} />
              <span>Unduh PDF</span>
            </Button>
            <Button size="sm" onClick={simpan} disabled={!dokumen || saving || !dirty}>
              <Loader2 className={`mr-1.5 h-4 w-4 animate-spin ${saving ? "" : "hidden"}`} />
              <Save className={`mr-1.5 h-4 w-4 ${saving ? "hidden" : ""}`} />
              <span>Simpan template</span>
            </Button>
          </div>
        }
      />

      <div className={pratinjauTerbuka ? "grid gap-4" : "grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]"}>
        <Card className={`min-h-[720px] overflow-hidden ${pratinjauTerbuka ? "hidden" : ""}`}>
          <div className="border-b bg-muted/25 p-4">
            <Label htmlFor="paket-template" className="text-xs uppercase tracking-wide text-muted-foreground">Paket dokumen</Label>
            <div className="relative mt-2">
              <select
                id="paket-template"
                value={paketId}
                onChange={(event) => setPaketId(event.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {PAKET.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="border-b px-4 py-3 text-xs text-muted-foreground">
            {paket
              ? `${paket.dokumen.length} template dalam paket`
              : gagal
                ? "Daftar template gagal dimuat"
                : "Memuat daftar template…"}
          </div>
          <div className="max-h-[590px] overflow-y-auto p-2">
            {paket?.dokumen.map((item, index) => {
              const key = `${paketId}:${item.id}`;
              const hasOverride = !!db.appearance.dokumenTemplates?.[key];
              const active = item.id === dokumen?.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setDokumenId(item.id)}
                  className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left transition ${active ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/60"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">{item.judul}</span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileText className="h-3 w-3" /> {item.id}
                        {hasOverride && <Badge variant="outline" className="ml-1 px-1 py-0 text-[9px]">Diubah</Badge>}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> {dokumen?.judul ?? "Template dokumen"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{templateKey || "Pilih dokumen di kiri"} · {storedOverride ? "Menggunakan draf kurator" : "Menggunakan sumber standar"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1"><Table2 className="h-3.5 w-3.5" /> Tabel terlindungi · tarik batas kolom untuk melebarkan</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPratinjauTerbuka((value) => !value)}
                  onMouseDown={(event) => event.preventDefault()}
                  aria-pressed={pratinjauTerbuka}
                  title={pratinjauTerbuka ? "Kembali ke editor" : "Tampilkan pratinjau"}
                >
                  <Eye className={`mr-1.5 h-4 w-4 ${pratinjauTerbuka ? "hidden" : ""}`} />
                  <EyeOff className={`mr-1.5 h-4 w-4 ${pratinjauTerbuka ? "" : "hidden"}`} />
                  <span className={pratinjauTerbuka ? "hidden" : ""}>Preview</span>
                  <span className={pratinjauTerbuka ? "" : "hidden"}>Kembali ke Editor</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} disabled={!storedOverride || saving} title="Kembali ke sumber Word">
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Reset sumber
                </Button>
              </div>
            </div>
            <div
              className={pratinjauTerbuka ? "hidden" : ""}
              data-testid="kurator-office-library"
              aria-label="Pustaka Office Kurator"
            >
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 p-2">
              <ToolbarButton title="Batalkan" onClick={() => command("undo")}><Undo2 className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Ulangi" onClick={() => command("redo")}><Redo2 className="h-4 w-4" /></ToolbarButton>
              <span className="mx-1 h-6 w-px bg-border" />
              <ToolbarButton title="Tebal" onClick={() => command("bold")}><Bold className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Miring" onClick={() => command("italic")}><Italic className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Garis bawah" onClick={() => command("underline")}><Underline className="h-4 w-4" /></ToolbarButton>
              <span className="mx-1 h-6 w-px bg-border" />
              <select title="Jenis huruf" value={layout.fontFamily} onChange={(event) => { setLayoutValue("fontFamily", event.target.value); command("fontName", event.target.value); }} className="h-8 max-w-[190px] rounded-md border border-input bg-background px-2 text-xs">
                <option value={'"Bookman Old Style", "Book Antiqua", Georgia, "Times New Roman", serif'}>Bookman Old Style</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Times New Roman, serif">Times New Roman</option>
              </select>
              <select title="Ukuran huruf" value={layout.fontSizePt} onChange={(event) => setLayoutValue("fontSizePt", Number(event.target.value))} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs">
                {[10, 11, 12, 13, 14, 16, 18].map((size) => <option key={size} value={size}>{size} pt</option>)}
              </select>
              <span className="mx-1 h-6 w-px bg-border" />
              <ToolbarButton title="Rata kiri" onClick={() => command("justifyLeft")}><AlignLeft className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Tengah" onClick={() => command("justifyCenter")}><AlignCenter className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Rata kanan" onClick={() => command("justifyRight")}><AlignRight className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Rata kiri-kanan" onClick={() => command("justifyFull")}><AlignJustify className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Daftar bernomor" onClick={() => command("insertOrderedList")}><ListOrdered className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Daftar poin" onClick={() => command("insertUnorderedList")}><List className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Hapus format pilihan" onClick={() => command("removeFormat")}><Type className="h-4 w-4" /></ToolbarButton>
              <span className="mx-1 h-6 w-px bg-border" />
              <ToolbarButton
                title="Rapikan tabel: lebar kolom mengikuti isi sel"
                onClick={() => terapkanAutofit("konten")}
              >
                <Shrink className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                title="Rapikan tabel: penuh selebar margin halaman"
                onClick={() => terapkanAutofit("jendela")}
              >
                <StretchHorizontal className="h-4 w-4" />
              </ToolbarButton>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Tampilan halaman</span>
              <Label className="ml-2 flex items-center gap-1">Atas <Input className="h-7 w-14 px-2 text-xs" type="number" min={0} max={50} value={layout.marginTopMm} onChange={(event) => setLayoutValue("marginTopMm", Number(event.target.value))} /> mm</Label>
              <Label className="flex items-center gap-1">Kanan <Input className="h-7 w-14 px-2 text-xs" type="number" min={0} max={50} value={layout.marginRightMm} onChange={(event) => setLayoutValue("marginRightMm", Number(event.target.value))} /> mm</Label>
              <Label className="flex items-center gap-1">Bawah <Input className="h-7 w-14 px-2 text-xs" type="number" min={0} max={50} value={layout.marginBottomMm} onChange={(event) => setLayoutValue("marginBottomMm", Number(event.target.value))} /> mm</Label>
              <Label className="flex items-center gap-1">Kiri <Input className="h-7 w-14 px-2 text-xs" type="number" min={0} max={50} value={layout.marginLeftMm} onChange={(event) => setLayoutValue("marginLeftMm", Number(event.target.value))} /> mm</Label>
              <Label className="ml-2 flex items-center gap-1">Spasi <Input className="h-7 w-14 px-2 text-xs" type="number" min={0.8} max={3} step={0.1} value={layout.lineHeight} onChange={(event) => setLayoutValue("lineHeight", Number(event.target.value))} /></Label>
            </div>

            {/* ══ Panel tata letak tabel — mengikuti ribbon "Tata Letak Tabel" Word ══ */}
            <div className="border-b bg-muted/10 px-3 py-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Table2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Tata letak tabel</span>
                {caretDiTabel ? (
                  jumlahBlok > 0 && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{jumlahBlok} sel diblok</Badge>
                  )
                ) : (
                  <span className="text-[11px] text-muted-foreground">— klik di dalam sel tabel untuk mengaktifkan</span>
                )}
                {jumlahBlok > 0 && (
                  <TombolPanel title="Lepaskan blok" label="Lepas blok" onClick={bersihkanBlok} />
                )}
              </div>

              <div className="flex flex-wrap items-start gap-2">
                <Grup judul="Blok">
                  <TombolPanel title="Blok satu sel" label="Sel" disabled={!caretDiTabel} onClick={() => pilihBlok("sel")} />
                  <TombolPanel title="Blok satu kolom penuh" label="Kolom" disabled={!caretDiTabel} onClick={() => pilihBlok("kolom")} />
                  <TombolPanel title="Blok satu baris penuh" label="Baris" disabled={!caretDiTabel} onClick={() => pilihBlok("baris")} />
                  <TombolPanel title="Blok seluruh tabel" label="Tabel" disabled={!caretDiTabel} onClick={() => pilihBlok("tabel")} />
                </Grup>

                <Grup judul="Baris & kolom">
                  <TombolPanel title="Sisipkan baris di bawah" label="+ Baris" disabled={!caretDiTabel} onClick={tambahBaris} />
                  <TombolPanel title="Sisipkan kolom di kanan" label="+ Kolom" disabled={!caretDiTabel} onClick={tambahKolom} />
                  <TombolPanel title="Hapus baris tempat kursor berada" label="− Baris" disabled={!caretDiTabel} onClick={hapusBarisAktif} />
                  <TombolPanel title="Hapus kolom tempat kursor berada" label="− Kolom" disabled={!caretDiTabel} onClick={hapusKolomAktif} />
                </Grup>

                <Grup judul="Gabung">
                  <TombolPanel title="Gabungkan sel yang diblok (dalam satu baris)" label="Gabung sel" disabled={jumlahBlok < 2} onClick={gabungSel} />
                  <TombolPanel title="Pecah kembali sel yang tergabung" label="Pisahkan sel" disabled={!caretDiTabel} onClick={pisahkanSel} />
                </Grup>

                <Grup judul="Ukuran sel">
                  <TombolPanel title="Lebar kolom mengikuti isi sel" disabled={!caretDiTabel} onClick={() => terapkanAutofit("konten")}>
                    <Shrink className="h-3.5 w-3.5" />
                  </TombolPanel>
                  <TombolPanel title="Tabel penuh selebar margin halaman" disabled={!caretDiTabel} onClick={() => terapkanAutofit("jendela")}>
                    <StretchHorizontal className="h-3.5 w-3.5" />
                  </TombolPanel>
                  <TombolPanel title="Kunci lebar kolom pada ukuran sekarang" label="Lebar tetap" disabled={!caretDiTabel} onClick={kunciLebarKolom} />
                </Grup>

                <Grup judul="Perataan sel">
                  <TombolPanel title="Rata kiri" disabled={!caretDiTabel} onClick={() => gayaBlokSel({ textAlign: "left" })}>
                    <AlignLeft className="h-3.5 w-3.5" />
                  </TombolPanel>
                  <TombolPanel title="Rata tengah" disabled={!caretDiTabel} onClick={() => gayaBlokSel({ textAlign: "center" })}>
                    <AlignCenter className="h-3.5 w-3.5" />
                  </TombolPanel>
                  <TombolPanel title="Rata kanan" disabled={!caretDiTabel} onClick={() => gayaBlokSel({ textAlign: "right" })}>
                    <AlignRight className="h-3.5 w-3.5" />
                  </TombolPanel>
                  <span className="mx-0.5 h-5 w-px bg-border" />
                  <TombolPanel title="Rata atas" label="Atas" disabled={!caretDiTabel} onClick={() => gayaBlokSel({ verticalAlign: "top" })} />
                  <TombolPanel title="Rata tengah vertikal" label="Tengah" disabled={!caretDiTabel} onClick={() => gayaBlokSel({ verticalAlign: "middle" })} />
                  <TombolPanel title="Rata bawah" label="Bawah" disabled={!caretDiTabel} onClick={() => gayaBlokSel({ verticalAlign: "bottom" })} />
                </Grup>

                <Grup judul="Batas & bayangan">
                  <select
                    title="Tebal garis batas"
                    disabled={!caretDiTabel}
                    defaultValue=""
                    onChange={(event) => {
                      const nilai = event.target.value;
                      if (!nilai) return;
                      gayaBlokSel({ borderStyle: "solid", borderColor: "#000000", borderWidth: nilai });
                      event.currentTarget.value = "";
                    }}
                    className="h-7 rounded border border-input bg-background px-1 text-[11px] disabled:opacity-40"
                  >
                    <option value="">Tebal garis…</option>
                    <option value="0">Tanpa garis</option>
                    <option value="0.5pt">½ pt</option>
                    <option value="1pt">1 pt</option>
                    <option value="1.5pt">1½ pt</option>
                    <option value="2.25pt">2¼ pt</option>
                  </select>
                  <label className="inline-flex h-7 items-center gap-1 rounded border border-input px-1.5 text-[11px]" title="Warna garis batas">
                    Garis
                    <input
                      type="color"
                      disabled={!caretDiTabel}
                      defaultValue="#000000"
                      onChange={(event) => gayaBlokSel({ borderStyle: "solid", borderColor: event.target.value })}
                      className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                    />
                  </label>
                  <label className="inline-flex h-7 items-center gap-1 rounded border border-input px-1.5 text-[11px]" title="Warna latar sel (bayangan)">
                    Latar
                    <input
                      type="color"
                      disabled={!caretDiTabel}
                      defaultValue="#ffffff"
                      onChange={(event) => gayaBlokSel({ backgroundColor: event.target.value })}
                      className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                    />
                  </label>
                  <TombolPanel
                    title="Hapus warna latar sel"
                    label="Tanpa latar"
                    disabled={!caretDiTabel}
                    onClick={() => gayaBlokSel({ backgroundColor: "" })}
                  />
                </Grup>
              </div>
            </div>

            {/* ══ Panel blok tulisan — setara grup Paragraf di Word ══ */}
            <div className="flex flex-wrap items-start gap-2 border-b bg-muted/10 px-3 py-2">
              <div className="flex items-center gap-2 self-center pr-1">
                <Type className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Blok tulisan</span>
                <span className="text-[11px] text-muted-foreground">— sorot teks lebih dulu, pengaturan berlaku untuk semua paragraf dalam sorotan</span>
              </div>
              <Grup judul="Spasi baris">
                <TombolPanel title="Spasi 1" label="1,0" onClick={() => gayaParagraf({ lineHeight: "1" })} />
                <TombolPanel title="Spasi 1,15" label="1,15" onClick={() => gayaParagraf({ lineHeight: "1.15" })} />
                <TombolPanel title="Spasi 1,5" label="1,5" onClick={() => gayaParagraf({ lineHeight: "1.5" })} />
                <TombolPanel title="Spasi ganda" label="2,0" onClick={() => gayaParagraf({ lineHeight: "2" })} />
              </Grup>
              <Grup judul="Jarak paragraf">
                <TombolPanel title="Tambah jarak sebelum paragraf" label="Sebelum +" onClick={() => gayaParagraf({ marginTop: "6pt" })} />
                <TombolPanel title="Tambah jarak sesudah paragraf" label="Sesudah +" onClick={() => gayaParagraf({ marginBottom: "6pt" })} />
                <TombolPanel title="Hapus jarak sebelum & sesudah" label="Rapatkan" onClick={() => gayaParagraf({ marginTop: "0", marginBottom: "0" })} />
              </Grup>
              <Grup judul="Inden kiri">
                <TombolPanel title="Tambah inden 1 cm" label="→ 1 cm" onClick={() => gayaParagraf({ marginLeft: "1cm" })} />
                <TombolPanel title="Tambah inden 2 cm" label="→ 2 cm" onClick={() => gayaParagraf({ marginLeft: "2cm" })} />
                <TombolPanel title="Hapus inden" label="Reset" onClick={() => gayaParagraf({ marginLeft: "0" })} />
              </Grup>
            </div>
            </div>
          </Card>

          {gagal ? (
            <Card className="grid min-h-[480px] place-items-center p-8 text-center">
              <div className="space-y-3">
                <p className="text-sm font-medium text-destructive">{gagal}</p>
                <p className="text-xs text-muted-foreground">Periksa paket dokumen, lalu coba muat kembali.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setMuatUlang((value) => value + 1)}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Coba lagi
                </Button>
              </div>
            </Card>
          ) : memuat || !dokumen ? (
            <Card className="grid min-h-[480px] place-items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Memuat naskah template…</Card>
          ) : (
            <div className="grid gap-4">
              <Card className={`min-w-0 overflow-hidden ${pratinjauTerbuka ? "hidden" : ""}`}>
                <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-primary" /> Kanvas penyuntingan</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">A4 · Pemisah halaman</Badge>
                    <span className="text-[11px] text-muted-foreground">Mode fokus · klik teks untuk mulai mengetik</span>
                  </div>
                </div>
                <div
                  className="h-[calc(100dvh-250px)] min-h-[520px] max-h-[900px] overflow-auto overscroll-contain scroll-smooth bg-neutral-100 p-4 [scrollbar-gutter:stable_both-edges]"
                  data-testid="kanvas-penyunting-scroll"
                  aria-label="Kanvas penyuntingan yang dapat digulir"
                  tabIndex={0}
                >
                  <style>{editorCss}</style>
                  <ContextMenu onOpenChange={(open) => { if (!open) { setTableContext(null); setTableCellContext(null); } }}>
                    <ContextMenuTrigger asChild>
                      <div
                        ref={editorRef}
                        contentEditable={false}
                        suppressContentEditableWarning
                        spellCheck={false}
                        className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white text-black outline-none"
                        onContextMenuCapture={handleEditorContextMenu}
                        onBeforeInput={(event) => stopUnsafeDelete(event)}
                        onKeyDown={handleEditorKeyDown}
                        onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
                          if (!editingHost(event.target as Node)) { event.preventDefault(); return; }
                          event.preventDefault();
                          sisipkanTeksBiasa(event.clipboardData.getData("text/plain"));
                          syncDraft();
                        }}
                        onDrop={(event: DragEvent<HTMLDivElement>) => {
                          event.preventDefault();
                          if (!editingHost(event.target as Node)) return;
                          sisipkanTeksBiasa(event.dataTransfer.getData("text/plain"));
                          syncDraft();
                        }}
                        onInput={syncDraft}
                      />
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-72">
                      <ContextMenuLabel>{tableContext ? "Pengaturan tabel" : "Pengaturan editor"}</ContextMenuLabel>
                      <ContextMenuItem disabled={!tableContext} onSelect={() => updateTable(autofitJendela)}>
                        Sesuaikan tabel ke margin
                      </ContextMenuItem>
                      <ContextMenuItem disabled={!tableContext} onSelect={() => updateTable(autofitKonten)}>
                        Sesuaikan tabel dengan isi
                      </ContextMenuItem>
                      <ContextMenuItem disabled={!tableContext} onSelect={() => updateTable(ukuranSumber)}>
                        Kembalikan ukuran sumber
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem disabled={!tableContext} onSelect={tambahBaris}>Tambah baris</ContextMenuItem>
                      <ContextMenuItem disabled={!tableContext} onSelect={tambahKolom}>Tambah kolom</ContextMenuItem>
                      <ContextMenuItem disabled={!tableCellContext} onSelect={hapusBaris}>Hapus baris yang dipilih</ContextMenuItem>
                      <ContextMenuItem disabled={!tableCellContext} onSelect={hapusKolom}>Hapus kolom yang dipilih</ContextMenuItem>
                      {!tableContext && <ContextMenuLabel className="font-normal text-muted-foreground">Klik kanan di dalam tabel untuk membuka pengaturan tabel.</ContextMenuLabel>}
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </Card>

              <Card
                className={`min-w-0 overflow-hidden ${
                  pratinjauTerbuka
                    ? ""
                    : "pointer-events-none fixed left-[-200vw] top-0 w-[1200px] opacity-0"
                }`}
              >
                <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Maximize2 className="h-4 w-4 text-primary" /> Pratinjau keluaran</div>
                  <span className="text-[11px] text-muted-foreground">Halaman berupa lembar kertas terpisah</span>
                </div>
                <PagedDocumentPreview
                  documentHtml={previewDocumentHtml}
                  className="max-h-[calc(100vh-250px)] min-h-[680px]"
                  testId="preview-kurator-dokumen"
                />
              </Card>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
