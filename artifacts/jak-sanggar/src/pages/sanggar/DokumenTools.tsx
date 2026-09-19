// Tools Dokumen Administrasi Sanggar — pembuat dokumen organisasi yang
// isinya menyesuaikan bentuk & kedudukan sanggar (6 varian).
// Tata naskah dinas DKI digunakan hanya sebagai rujukan kerapihan teknis.
import React, { lazy, Suspense, useRef, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import type { SanggarUser, BentukKedudukanId, DokumenArsip } from "@/lib/types";
import {
  persistSanggarProfile,
  persistDokumenArsip,
  deleteDokumenArsip,
  logActivity,
  uid,
  fmtDateTime,
  save,
} from "@/lib/store";
import { waitForServer } from "@workspace/jaksanggar-core/sync";
import {
  BENTUK_KEDUDUKAN,
  bentukById,
  bentukDefault,
  fieldTambahanBentuk,
  templateUntukBentuk,
  TEMPLATE_DOKUMEN,
  ingatanField,
  isiAwalField,
  isiStandarField,
  punyaStandar,
  fieldBerpilihan,
  pecahPilihan,
  gabungPilihan,
  type TemplateDokumen,
  type FieldDef,
  type RenderCtx,
} from "@/lib/dokumen-admin";
import {
  jabatanPemilikDenganNama,
  opsiStempel,
  tanggalCetak,
} from "@/lib/dokumen";
import { rakitDokumenAdministrasi } from "@/lib/dokumen-administrasi-render";
import {
  fieldValidasiStandar,
  validasiFormDokumen,
  nipDokumen,
} from "@/lib/dokumen-form";
import { sanitizeEditableHtml } from "@/lib/print";
import {
  bangunHtmlUnduhanDokumen,
  unduhDokumen,
  type FormatUnduhanDokumen,
  type OpsiUnduhanDokumen,
} from "@/lib/dokumen-export";
import {
  ringkasFieldKosong,
  validasiIsianDokumen,
  type HasilValidasiDokumen,
} from "@workspace/jaksanggar-core/dokumen-validation";

/** Kunci khusus (di dalam `nilai`) untuk menyimpan hasil edit manual output. */
const KEY_HTML_MANUAL = "__html_manual";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  Landmark,
  Building2,
  Archive,
  FolderOpen,
  Trash2,
  Wand2,
  PencilLine,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Eye,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EditableDocument } from "@/components/dokumen/EditableDocument";
import { PagedDocumentPreview } from "@/components/dokumen/PagedDocumentPreview";
import { PaketDokumenCard } from "./PaketDokumenCard";
import {
  ADARTStandarCard,
  arsipAdartStandarPunyaNaskah,
  opsiUnduhanUlangAdartStandar,
} from "./ADARTStandarCard";
import {
  ADART_STANDAR_TEMPLATE_ID,
  validasiDataAdartStandar,
} from "@/lib/adart-standar";

/**
 * Field berpilihan untuk formulir dokumen.
 *
 * - `pilihan-ganda` : daftar centang; nilai disimpan satu baris per pilihan.
 * - `pilihan`       : daftar pilih-satu.
 *
 * Selalu disediakan kotak isian bebas ("Lainnya") agar pengguna dapat menulis
 * rumusan sendiri di luar daftar, sesuai kebutuhan sanggar masing-masing.
 */
function FieldPilihan({
  field,
  nilai,
  onChange,
  invalid = false,
}: {
  field: FieldDef;
  nilai: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const opsi = field.opsi ?? [];
  const bolehLainnya = field.izinkanLainnya !== false;

  if (field.type === "pilihan-ganda") {
    const terpilih = pecahPilihan(nilai);
    const dariDaftar = terpilih.filter((t) => opsi.includes(t));
    const lainnya = terpilih.filter((t) => !opsi.includes(t));

    const toggle = (o: string, aktif: boolean) => {
      const berikut = aktif
        ? [...dariDaftar, o]
        : dariDaftar.filter((x) => x !== o);
      // Urutkan mengikuti urutan daftar opsi agar dokumen tetap rapi,
      // lalu tambahkan isian bebas di bagian akhir.
      const urut = opsi.filter((x) => berikut.includes(x));
      onChange(gabungPilihan([...urut, ...lainnya]));
    };

    return (
      <div className="space-y-2">
        <div
          className={`rounded-md border divide-y ${invalid ? "border-destructive" : ""}`}
          aria-invalid={invalid || undefined}
        >
          {opsi.map((o, index) => {
            const aktif = dariDaftar.includes(o);
            return (
              <label
                key={o}
                className="flex items-start gap-2.5 p-2.5 text-sm cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  id={index === 0 ? `f-${field.key}` : undefined}
                  checked={aktif}
                  onCheckedChange={(c) => toggle(o, c === true)}
                  className="mt-0.5"
                  data-testid={`opsi-${field.key}-${o.slice(0, 20)}`}
                />
                <span className="leading-snug">{o}</span>
              </label>
            );
          })}
        </div>
        {bolehLainnya && (
          <div className="space-y-1">
            <Label
              htmlFor={`lain-${field.key}`}
              className="text-xs text-muted-foreground"
            >
              Lainnya (isi sendiri — satu per baris)
            </Label>
            <Textarea
              id={`lain-${field.key}`}
              rows={2}
              value={lainnya.join("\n")}
              placeholder="Tulis rumusan sendiri bila belum ada di daftar."
              onChange={(e) =>
                onChange(
                  gabungPilihan([
                    ...dariDaftar,
                    ...pecahPilihan(e.target.value),
                  ]),
                )
              }
              data-testid={`input-lain-${field.key}`}
            />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {terpilih.length} dipilih.
        </p>
      </div>
    );
  }

  // type === "pilihan" (pilih satu)
  const cocokDaftar = opsi.includes(nilai);
  return (
    <div className="space-y-2">
      <div
        className={`rounded-md border divide-y ${invalid ? "border-destructive" : ""}`}
        aria-invalid={invalid || undefined}
      >
        {opsi.map((o, index) => (
          <label
            key={o}
            className="flex items-start gap-2.5 p-2.5 text-sm cursor-pointer hover:bg-muted/40"
          >
            <input
              id={index === 0 ? `f-${field.key}` : undefined}
              type="radio"
              name={`radio-${field.key}`}
              checked={nilai === o}
              onChange={() => onChange(o)}
              className="mt-1 accent-primary"
              data-testid={`opsi-${field.key}-${o.slice(0, 20)}`}
            />
            <span className="leading-snug">{o}</span>
          </label>
        ))}
      </div>
      {bolehLainnya && (
        <div className="space-y-1">
          <Label
            htmlFor={`lain-${field.key}`}
            className="text-xs text-muted-foreground"
          >
            Lainnya (isi sendiri)
          </Label>
          <Input
            id={`lain-${field.key}`}
            value={cocokDaftar ? "" : nilai}
            placeholder="Tulis rumusan sendiri bila belum ada di daftar."
            onChange={(e) => onChange(e.target.value)}
            data-testid={`input-lain-${field.key}`}
          />
        </div>
      )}
    </div>
  );
}

function DokumenTools() {
  const { user } = useAuth();
  const { toast } = useToast();
  const db = useDb();
  const [bentukId, setBentukId] = useState<BentukKedudukanId | null>(null);
  const [tplAktif, setTplAktif] = useState<TemplateDokumen | null>(null);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  // Bila form dibuka dari arsip, id entri arsip yang sedang diedit — unduhan
  // berikutnya memperbarui entri tersebut, bukan membuat duplikat.
  const [arsipId, setArsipId] = useState<string | null>(null);
  // Field yang nilainya diambil dari dokumen lain (autofill lintas formulir).
  const [dariIngatan, setDariIngatan] = useState<Set<string>>(new Set());
  // Dipakai untuk menampilkan konteks kolom yang sedang diisi pada pratinjau.
  const [fieldAktif, setFieldAktif] = useState<string | null>(null);
  const [validasiDiminta, setValidasiDiminta] = useState(false);
  const [tampilanPembuatan, setTampilanPembuatan] = useState<
    "formulir" | "pratinjau"
  >("formulir");
  const [arsipAdartAktif, setArsipAdartAktif] = useState<DokumenArsip | null>(
    null,
  );
  // Editor manual: dokumen yang sedang diedit bebas (WYSIWYG) sebelum unduh.
  const [editState, setEditState] = useState<{
    t: TemplateDokumen;
    title: string;
    startHtml: string;
    version?: number;
  } | null>(null);
  const [editorKotor, setEditorKotor] = useState(false);
  const [editorMenyimpan, setEditorMenyimpan] = useState(false);
  const [unduhanAktif, setUnduhanAktif] = useState<{
    format: FormatUnduhanDokumen;
    target: string;
  } | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;

  const arsip = db.dokumenArsip
    .filter((a) => a.sanggarId === sg.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const bentukTerpilih = bentukId ?? bentukDefault(sg);
  const bentuk = bentukById(bentukTerpilih);
  const templates = templateUntukBentuk(bentukTerpilih);
  // Untuk bentuk mandiri non-BH, gunakan naskah standar lengkap 17 + 19 bab
  // di kartu khusus agar tidak ada dua jalur AD/ART yang membingungkan.
  const templatesTampil =
    bentukTerpilih === "mandiri-non-bh"
      ? templates.filter((t) => t.id !== "ad-art")
      : templates;
  const tersimpan = sg.bentukKedudukan === bentukTerpilih;

  const simpanBentuk = async () => {
    setMenyimpan(true);
    try {
      const res = await persistSanggarProfile(sg.id, sg.apiId, {
        bentukKedudukan: bentukTerpilih,
      });
      logActivity(sg.id, "sanggar", "profile-edit");
      toast(
        res.server
          ? { title: "Bentuk & kedudukan tersimpan" }
          : {
              title: "Tersimpan sementara (lokal)",
              description:
                "Belum tersinkron ke server. Masuk langsung sebagai sanggar ini agar tersimpan permanen.",
            },
      );
    } catch {
      toast({
        title: "Gagal menyimpan ke server",
        description: "Perubahan dibatalkan. Coba lagi saat koneksi pulih.",
        variant: "destructive",
      });
    } finally {
      setMenyimpan(false);
    }
  };

  // Data yang pernah diisi pada dokumen lain, siap dipakai ulang.
  const ingatan = ingatanField(arsip);

  const bukaTemplate = (t: TemplateDokumen) => {
    const fields = daftarField(t);
    // Prioritas: data profil → data yang pernah diinput di formulir lain → kosong.
    const awal = isiAwalField(fields, sg, ingatan);
    setNilai(awal);
    // Tandai field mana yang berasal dari ingatan agar bisa diberi keterangan.
    setDariIngatan(
      new Set(
        fields
          .filter((f) => !f.isiAwal?.(sg)?.trim() && ingatan[f.key]?.trim())
          .map((f) => f.key),
      ),
    );
    setArsipId(null);
    setFieldAktif(null);
    setValidasiDiminta(false);
    setTampilanPembuatan("formulir");
    setTplAktif(t);
  };

  // Buka entri arsip: prefill form dengan nilai tersimpan.
  const bukaArsip = (a: DokumenArsip) => {
    if (a.templateId === ADART_STANDAR_TEMPLATE_ID) {
      setArsipAdartAktif(a);
      return;
    }
    const t = TEMPLATE_DOKUMEN.find((x) => x.id === a.templateId);
    if (!t) {
      toast({
        title: "Template tidak ditemukan",
        description: "Template dokumen ini sudah tidak tersedia.",
        variant: "destructive",
      });
      return;
    }
    setBentukId(a.bentukId);
    setNilai({ ...a.nilai });
    setDariIngatan(new Set()); // nilai berasal dari arsip itu sendiri
    setArsipId(a.id);
    setFieldAktif(null);
    setValidasiDiminta(false);
    setTampilanPembuatan("formulir");
    setTplAktif(t);
  };

  const daftarFieldUntuk = (
    t: TemplateDokumen,
    idBentuk: BentukKedudukanId,
  ): FieldDef[] => {
    const ekstra =
      t.pakaiFieldBentuk === false
        ? []
        : fieldTambahanBentuk(bentukById(idBentuk));
    const tanggal: FieldDef[] = t.fields.some(
      (f) => f.key === "tanggalPenetapan",
    )
      ? []
      : [
          {
            key: "tanggalSurat",
            label: "Tanggal Dokumen",
            isiAwal: () => tanggalCetak(),
            petunjuk:
              "Tanggal ini dicetak pada tanda tangan dan disimpan bersama dokumen.",
          },
        ];
    return [...t.fields, ...tanggal, ...ekstra];
  };

  const daftarField = (t: TemplateDokumen): FieldDef[] =>
    daftarFieldUntuk(t, bentukTerpilih);

  const validasiArsip = (a: DokumenArsip): HasilValidasiDokumen | null => {
    if (a.templateId === ADART_STANDAR_TEMPLATE_ID) {
      return validasiDataAdartStandar(a.nilai);
    }
    const template = TEMPLATE_DOKUMEN.find((item) => item.id === a.templateId);
    return template
      ? a.nilai[KEY_HTML_MANUAL]?.trim()
        ? validasiIsianDokumen(
            daftarFieldUntuk(template, a.bentukId)
              .filter((field) => !field.opsional)
              .map(fieldValidasiStandar),
            a.nilai,
          )
        : validasiFormDokumen(
            daftarFieldUntuk(template, a.bentukId),
            a.nilai,
            sg,
          )
      : null;
  };

  const fokusFieldKosong = (hasil: HasilValidasiDokumen) => {
    const pertama = hasil.fieldBermasalah[0];
    if (!pertama) return;
    setFieldAktif(pertama.key);
    window.setTimeout(() => {
      document.getElementById(`f-${pertama.key}`)?.focus();
    }, 0);
  };

  const pastikanLengkap = (t: TemplateDokumen): boolean => {
    const hasil = validasiFormDokumen(daftarField(t), nilai, sg);
    if (hasil.lengkap) return true;
    setValidasiDiminta(true);
    fokusFieldKosong(hasil);
    toast({
      title: "Lengkapi dokumen sebelum dilanjutkan",
      description: `Periksa: ${ringkasFieldKosong(hasil.fieldBermasalah)}.`,
      variant: "destructive",
    });
    return false;
  };

  // Simpan isian sebagai entri arsip (buat baru atau perbarui yang dibuka).
  // Lokal-dulu (UI langsung reaktif) lalu write-through ke server supaya
  // arsip tidak hilang saat ganti perangkat.
  const simpanArsip = async (
    t: TemplateDokumen,
    nilaiFinal: Record<string, string> = nilai,
  ): Promise<boolean> => {
    const now = Date.now();
    const ada = arsipId
      ? db.dokumenArsip.find((a) => a.id === arsipId)
      : undefined;
    const entry: DokumenArsip = ada
      ? {
          ...ada,
          nilai: { ...nilaiFinal },
          bentukId: bentukTerpilih,
          updatedAt: now,
        }
      : {
          id: uid(),
          sanggarId: sg.id,
          templateId: t.id,
          judul: t.judul,
          bentukId: bentukTerpilih,
          nilai: { ...nilaiFinal },
          createdAt: now,
          updatedAt: now,
        };
    if (!ada) setArsipId(entry.id);
    try {
      const res = await persistDokumenArsip(entry);
      if (!res.server) {
        toast({
          title: "Draf belum tersimpan di server",
          description: "Periksa koneksi lalu simpan kembali.",
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch (error) {
      toast({
        title: "Arsip tidak tersimpan",
        description:
          error instanceof Error
            ? error.message
            : "Periksa koneksi lalu simpan kembali.",
        variant: "destructive",
      });
      return false;
    }
  };

  const jalankanUnduhan = async (
    format: FormatUnduhanDokumen,
    target: string,
    opsi: OpsiUnduhanDokumen,
  ): Promise<boolean> => {
    setUnduhanAktif({ format, target });
    try {
      await unduhDokumen(format, opsi);
      toast({
        title: `${format === "word" ? "Word" : "PDF"} berhasil diunduh`,
        description:
          "Untuk mencetak, buka berkas hasil unduhan di Microsoft Office atau aplikasi PDF.",
      });
      return true;
    } catch {
      toast({
        title: "Unduhan gagal dibuat",
        description: "Coba kembali setelah halaman selesai memuat.",
        variant: "destructive",
      });
      return false;
    } finally {
      setUnduhanAktif(null);
    }
  };

  // Unduh render otomatis dari field. Penanda edit manual dibuang agar arsip
  // mencerminkan isi field terbaru yang terlihat pada review.
  const unduhOtomatis = async (
    t: TemplateDokumen,
    format: FormatUnduhanDokumen,
  ) => {
    if (!pastikanLengkap(t)) return;
    const ctx: RenderCtx = { sg: sgDenganNip(), bentuk, v: nilai };
    const nilaiFinal = { ...nilai };
    delete nilaiFinal[KEY_HTML_MANUAL];
    if (!(await simpanArsip(t, nilaiFinal))) return;
    const berhasil = await jalankanUnduhan(format, `template:${t.id}`, {
      title: `${t.judul} — ${sg.namaSanggar}`,
      fileName: `${t.judul} - ${sg.namaSanggar}`,
      bodyHtml: rakitDokumen(t, ctx),
    });
    if (!berhasil) return;
    logActivity(sg.id, "sanggar", "dokumen-unduh", {
      template: t.id,
      format,
    });
  };

  // Rakit badan dokumen: kop + isi template + blok tanda tangan.
  const rakitDokumen = (t: TemplateDokumen, ctx: RenderCtx): string => {
    return rakitDokumenAdministrasi(t, ctx, { stempel: opsiStempel() });
  };

  const sgDenganNip = (): SanggarUser => {
    return { ...sg, nip: nipDokumen(nilai, sg.nip) };
  };

  // Buka editor manual (WYSIWYG). Bila dokumen ini pernah diedit manual,
  // muat hasil editnya; kalau belum, rakit versi otomatis sebagai titik awal.
  const bukaEditor = (t: TemplateDokumen) => {
    if (!pastikanLengkap(t)) return;
    const sgUsed = sgDenganNip();
    const ctx: RenderCtx = { sg: sgUsed, bentuk, v: nilai };
    const manual = nilai[KEY_HTML_MANUAL]?.trim();
    const start = sanitizeEditableHtml(
      manual && manual.length > 0 ? manual : rakitDokumen(t, ctx),
    );
    // Tutup form lebih dahulu. Editor dibuka pada tick berikutnya supaya
    // portal/focus trap lama benar-benar terlepas sebelum portal baru dibuat.
    // Ini mencegah NotFoundError removeChild/insertBefore ketika dialog
    // berpindah saat React masih menyelaraskan node.
    setTplAktif(null);
    setEditorKotor(false);
    window.setTimeout(() => {
      setEditState({
        t,
        title: `${t.judul} — ${sg.namaSanggar}`,
        startHtml: start,
      });
    }, 0);
  };

  // Kembalikan editor ke versi otomatis (buang hasil edit manual).
  const resetEditorKeOtomatis = () => {
    if (!editState) return;
    if (
      editorKotor &&
      !window.confirm(
        "Buang seluruh perubahan manual dan kembali ke versi otomatis?",
      )
    )
      return;
    const ctx: RenderCtx = { sg: sgDenganNip(), bentuk, v: nilai };
    const fresh = rakitDokumen(editState.t, ctx);
    setEditState({
      ...editState,
      startHtml: fresh,
      version: (editState.version ?? 0) + 1,
    });
    setEditorKotor(false);
  };

  const htmlEditorBersih = (): string =>
    sanitizeEditableHtml(
      editRef.current?.innerHTML?.trim() || editState?.startHtml || "",
    );

  const tutupEditor = () => {
    if (
      editorKotor &&
      !window.confirm("Perubahan manual belum disimpan. Tetap tutup editor?")
    )
      return;
    setEditorKotor(false);
    setEditState(null);
  };

  const simpanDrafEditor = async () => {
    if (!editState) return;
    const html = htmlEditorBersih();
    const nilaiFinal = { ...nilai, [KEY_HTML_MANUAL]: html };
    setEditorMenyimpan(true);
    setNilai(nilaiFinal);
    try {
      if (await simpanArsip(editState.t, nilaiFinal)) {
        setEditState((state) =>
          state ? { ...state, startHtml: html } : state,
        );
        setEditorKotor(false);
        toast({ title: "Draf manual tersimpan di server" });
      }
    } finally {
      setEditorMenyimpan(false);
    }
  };

  // Unduh persis seperti hasil editor, lalu simpan sebagai versi manual agar
  // unduhan berikutnya dari arsip tetap memakai naskah yang sama.
  const unduhDariEditor = async (format: FormatUnduhanDokumen) => {
    if (!editState) return;
    if (!pastikanLengkap(editState.t)) {
      setEditState(null);
      setTplAktif(editState.t);
      return;
    }
    const html = htmlEditorBersih();
    const nilaiFinal = { ...nilai, [KEY_HTML_MANUAL]: html };
    if (!(await simpanArsip(editState.t, nilaiFinal))) return;
    const berhasil = await jalankanUnduhan(format, `editor:${editState.t.id}`, {
      title: editState.title,
      fileName: `${editState.t.judul} - ${sg.namaSanggar}`,
      bodyHtml: html,
    });
    if (!berhasil) return;
    setNilai(nilaiFinal);
    logActivity(sg.id, "sanggar", "dokumen-unduh", {
      template: editState.t.id,
      manual: true,
      format,
    });
    setEditState((state) => (state ? { ...state, startHtml: html } : state));
    setEditorKotor(false);
  };

  // Unduh ulang langsung dari arsip tanpa membuka editor.
  const unduhUlang = async (a: DokumenArsip, format: FormatUnduhanDokumen) => {
    const hasil = validasiArsip(a);
    if (hasil && !hasil.lengkap) {
      bukaArsip(a);
      toast({
        title: "Draf belum siap diunduh",
        description: `Periksa dahulu: ${ringkasFieldKosong(hasil.fieldBermasalah)}.`,
        variant: "destructive",
      });
      return;
    }
    if (a.templateId === ADART_STANDAR_TEMPLATE_ID) {
      const opsi = opsiUnduhanUlangAdartStandar(a);
      if (!opsi) {
        toast({
          title: "AD/ART belum dapat diunduh",
          description: "Pastikan naskah AD dan ART sudah lengkap.",
          variant: "destructive",
        });
        return;
      }
      if (!(await jalankanUnduhan(format, `arsip:${a.id}`, opsi))) return;
      logActivity(sg.id, "sanggar", "dokumen-unduh-ulang", {
        template: a.templateId,
        arsipId: a.id,
        manual: true,
        format,
      });
      return;
    }
    const t = TEMPLATE_DOKUMEN.find((x) => x.id === a.templateId);
    if (!t) {
      toast({
        title: "Template tidak ditemukan",
        description: "Template dokumen ini sudah tidak tersedia.",
        variant: "destructive",
      });
      return;
    }
    // Bila dokumen ini pernah diedit manual, unduh hasil edit tersebut
    // apa adanya (jangan dirender ulang dari field).
    const manual = a.nilai[KEY_HTML_MANUAL]?.trim();
    if (manual && manual.length > 0) {
      if (
        !(await jalankanUnduhan(format, `arsip:${a.id}`, {
          title: `${t.judul} — ${sg.namaSanggar}`,
          fileName: `${t.judul} - ${sg.namaSanggar}`,
          bodyHtml: manual,
        }))
      ) {
        return;
      }
      logActivity(sg.id, "sanggar", "dokumen-unduh-ulang", {
        template: t.id,
        arsipId: a.id,
        manual: true,
        format,
      });
      return;
    }
    const b = bentukById(a.bentukId);
    const sgUsed = {
      ...sg,
      nip: nipDokumen(a.nilai, sg.nip),
    };
    const ctx: RenderCtx = { sg: sgUsed, bentuk: b, v: a.nilai };
    if (
      !(await jalankanUnduhan(format, `arsip:${a.id}`, {
        title: `${t.judul} — ${sg.namaSanggar}`,
        fileName: `${t.judul} - ${sg.namaSanggar}`,
        bodyHtml: rakitDokumen(t, ctx),
      }))
    ) {
      return;
    }
    logActivity(sg.id, "sanggar", "dokumen-unduh-ulang", {
      template: t.id,
      arsipId: a.id,
      format,
    });
  };

  const hapusArsip = async (a: DokumenArsip) => {
    if (arsipId === a.id) setArsipId(null);
    try {
      const res = await deleteDokumenArsip(a.id);
      toast(
        res.server
          ? { title: "Arsip dihapus", description: a.judul }
          : {
              title: "Arsip dihapus (lokal)",
              description:
                "Server belum terjangkau — arsip bisa muncul lagi saat sinkron berikutnya.",
            },
      );
    } catch {
      toast({
        title: "Gagal menghapus arsip",
        description: "Server menolak penghapusan. Coba lagi.",
        variant: "destructive",
      });
    }
  };

  const fieldsDokumenAktif = tplAktif ? daftarField(tplAktif) : [];
  const validasiDokumenAktif = validasiFormDokumen(
    fieldsDokumenAktif,
    nilai,
    sg,
  );
  const jumlahTerisi = validasiDokumenAktif.terisi;
  const masalahFieldAktif = new Map(
    validasiDokumenAktif.fieldBermasalah.map((field) => [
      field.key,
      field.alasan,
    ]),
  );
  const ctxDokumenAktif = { sg: sgDenganNip(), bentuk, v: nilai };
  const penandatanganAktif = tplAktif?.ttdOverride?.(ctxDokumenAktif);
  const previewDokumenAktif = tplAktif
    ? rakitDokumen(tplAktif, ctxDokumenAktif)
    : "";
  const previewDokumenHtml = tplAktif
    ? bangunHtmlUnduhanDokumen({
        title: `${tplAktif.judul} — ${sg.namaSanggar}`,
        bodyHtml: previewDokumenAktif,
      })
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools Dokumen Administrasi"
        subtitle="Isi dan review dokumen, lalu unduh Word atau PDF. Pencetakan dilakukan di aplikasi Office/PDF setelah berkas diunduh."
      />

      <Card data-testid="card-bentuk-kedudukan">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Bentuk & Kedudukan Sanggar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="select-bentuk">Pilih bentuk & kedudukan</Label>
              <select
                id="select-bentuk"
                value={bentukTerpilih}
                onChange={(event) =>
                  setBentukId(event.target.value as BentukKedudukanId)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="select-bentuk"
              >
                {BENTUK_KEDUDUKAN.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                    data-testid={`option-bentuk-${b.id}`}
                  >
                    {b.nama}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={simpanBentuk}
              disabled={menyimpan || tersimpan}
              data-testid="button-simpan-bentuk"
            >
              {tersimpan
                ? "Tersimpan di Profil"
                : menyimpan
                  ? "Menyimpan…"
                  : "Simpan sebagai Bentuk Sanggar"}
            </Button>
          </div>
          <div
            className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
            data-testid="text-deskripsi-bentuk"
          >
            <span className="font-medium text-foreground">{bentuk.nama}.</span>{" "}
            {bentuk.ringkas} Dasar kedudukan: {bentuk.dasar}.
          </div>
        </CardContent>
      </Card>

      <PaketDokumenCard
        key={bentukTerpilih}
        sg={sg}
        bentukId={bentukTerpilih}
      />
      <ADARTStandarCard
        sg={sg}
        bentukId={bentukTerpilih}
        arsipMasuk={arsipAdartAktif}
        onArsipDibuka={() => setArsipAdartAktif(null)}
      />

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          Template dokumen tersedia ({templatesTampil.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templatesTampil.map((t) => (
            <Card
              key={t.id}
              className="premium-card flex flex-col"
              data-testid={`card-template-${t.id}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-start gap-2">
                  <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{t.judul}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {t.deskripsi}
                </p>
                <div className="flex items-center justify-between gap-2">
                  {t.bentuk === "semua" ? (
                    <Badge variant="outline" className="text-[10px]">
                      Semua bentuk
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Building2 className="h-3 w-3" />
                      Khusus bentuk ini
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={() => bukaTemplate(t)}
                    data-testid={`button-buat-${t.id}`}
                  >
                    Buat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card data-testid="card-arsip-dokumen">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="h-4 w-4 text-primary" />
            Arsip Dokumen ({arsip.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {arsip.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-arsip-kosong"
            >
              Belum ada dokumen tersimpan. Dokumen yang diunduh otomatis masuk
              arsip agar bisa direview dan diunduh ulang.
            </p>
          ) : (
            <div className="space-y-2">
              {arsip.map((a) => {
                const hasil = validasiArsip(a);
                const punyaNaskah =
                  a.templateId !== ADART_STANDAR_TEMPLATE_ID ||
                  arsipAdartStandarPunyaNaskah(a);
                const siapUnduh = hasil?.lengkap === true && punyaNaskah;
                const jumlahMasalah = hasil?.fieldBermasalah.length ?? 0;

                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={`row-arsip-${a.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-sm font-medium truncate"
                          data-testid={`text-arsip-judul-${a.id}`}
                        >
                          {a.judul}
                        </p>
                        {!hasil ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Template tidak tersedia
                          </Badge>
                        ) : !punyaNaskah ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Naskah belum lengkap
                          </Badge>
                        ) : hasil.lengkap ? (
                          <Badge variant="success" className="text-[10px]">
                            Siap diunduh
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Draf · {jumlahMasalah} isian perlu diperiksa
                          </Badge>
                        )}
                        {a.nilai[KEY_HTML_MANUAL]?.trim() && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 font-normal"
                          >
                            <PencilLine className="h-3 w-3" /> Diedit manual
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {bentukById(a.bentukId).nama} · Diperbarui{" "}
                        {fmtDateTime(a.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => bukaArsip(a)}
                        data-testid={`button-buka-arsip-${a.id}`}
                      >
                        <FolderOpen className="h-4 w-4 mr-1.5" />
                        {siapUnduh ? "Review" : "Lengkapi"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void unduhUlang(a, "word")}
                        disabled={!siapUnduh || unduhanAktif !== null}
                        title={
                          siapUnduh
                            ? "Unduh ulang sebagai Word"
                            : "Lengkapi draf sebelum diunduh"
                        }
                        data-testid={`button-unduh-word-arsip-${a.id}`}
                      >
                        {unduhanAktif?.target === `arsip:${a.id}` &&
                        unduhanAktif.format === "word" ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 mr-1.5" />
                        )}
                        Word
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void unduhUlang(a, "pdf")}
                        disabled={!siapUnduh || unduhanAktif !== null}
                        title={
                          siapUnduh
                            ? "Unduh ulang sebagai PDF"
                            : "Lengkapi draf sebelum diunduh"
                        }
                        data-testid={`button-unduh-pdf-arsip-${a.id}`}
                      >
                        {unduhanAktif?.target === `arsip:${a.id}` &&
                        unduhanAktif.format === "pdf" ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-1.5" />
                        )}
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => hapusArsip(a)}
                        aria-label={`Hapus arsip ${a.judul}`}
                        data-testid={`button-hapus-arsip-${a.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!tplAktif} onOpenChange={(o) => !o && setTplAktif(null)}>
        <DialogContent className="flex h-[90vh] max-h-[920px] max-w-7xl flex-col overflow-hidden">
          {tplAktif && (
            <>
              <DialogHeader>
                <DialogTitle>{tplAktif.judul}</DialogTitle>
                <DialogDescription>
                  {tampilanPembuatan === "formulir"
                    ? `${bentuk.nama}. Lengkapi formulir, lalu tekan Preview untuk memeriksa dokumen dalam tampilan besar.`
                    : "Pratinjau hanya menampilkan dokumen yang sedang dibuat sebagai lembar kertas terpisah."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {tampilanPembuatan === "formulir" && (
                  <section className="min-h-0 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Formulir dokumen
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {jumlahTerisi}/{validasiDokumenAktif.total} data
                          dokumen dan profil terisi
                        </p>
                      </div>
                      <Badge
                        variant={
                          validasiDokumenAktif.lengkap ? "default" : "outline"
                        }
                      >
                        {validasiDokumenAktif.lengkap ? "Siap" : "Berproses"}
                      </Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width] duration-200"
                        style={{
                          width: `${validasiDokumenAktif.persentase}%`,
                        }}
                      />
                    </div>

                    {!validasiDokumenAktif.lengkap && (
                      <div
                        className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                        role={validasiDiminta ? "alert" : undefined}
                        data-testid="peringatan-dokumen-belum-lengkap"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                          <span className="font-semibold">
                            Belum siap diunduh.
                          </span>{" "}
                          Lengkapi{" "}
                          {ringkasFieldKosong(
                            validasiDokumenAktif.fieldBermasalah,
                          )}
                          .
                        </p>
                      </div>
                    )}

                    {validasiDokumenAktif.fieldBermasalah.some((f) =>
                      f.key.startsWith("__profil_"),
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        Nama sanggar, nama ketua/pemilik, dan alamat diambil
                        dari profil.{" "}
                        <a
                          href="/sanggar/profil"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                        >
                          Lengkapi profil sanggar
                        </a>{" "}
                        sebelum mengunduh dokumen.
                      </p>
                    )}

                    {punyaStandar(fieldsDokumenAktif) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          Gunakan rumusan standar sebagai awal, lalu pilih
                          alternatif atau ubah sendiri sesuai kebutuhan.
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setNilai((n) =>
                              isiStandarField(fieldsDokumenAktif, n),
                            );
                            setDariIngatan(new Set());
                            setFieldAktif(null);
                            toast({
                              title: "Terisi dengan rumusan standar",
                              description:
                                "Semua pilihan masih dapat diubah atau ditambah sendiri.",
                            });
                          }}
                          data-testid="button-isi-standar"
                        >
                          <Wand2 className="mr-1.5 h-4 w-4" />
                          Isi Standar
                        </Button>
                      </div>
                    )}

                    <div
                      className="rounded-lg border bg-background p-3 space-y-2"
                      onFocusCapture={() => setFieldAktif("__nip_override")}
                    >
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Data Penandatangan
                      </Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="nip-override" className="text-xs">
                            NIP (opsional)
                          </Label>
                          <Input
                            id="nip-override"
                            disabled={Boolean(penandatanganAktif)}
                            value={nilai["__nip_override"] ?? sg.nip ?? ""}
                            placeholder="Nomor Induk Pegawai"
                            onChange={(e) =>
                              setNilai((n) => ({
                                ...n,
                                __nip_override: e.target.value,
                              }))
                            }
                            data-testid="input-nip-override"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {penandatanganAktif
                              ? "NIP dari profil sanggar tidak digunakan untuk penandatangan organisasi induk."
                              : "Kosongkan jika bukan ASN/PNS. Diisi otomatis dari profil jika tersedia."}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            {penandatanganAktif
                              ? "Penandatangan organisasi induk"
                              : "Penandatangan dari profil"}
                          </Label>
                          <div className="text-sm font-medium">
                            {penandatanganAktif?.nama || sg.namaKetua}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {penandatanganAktif?.jabatan ||
                              jabatanPemilikDenganNama(sg)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {fieldsDokumenAktif.map((f) => (
                      <div
                        key={f.key}
                        className="space-y-1.5"
                        onFocusCapture={() => setFieldAktif(f.key)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Label htmlFor={`f-${f.key}`}>
                            {f.label}{" "}
                            {!f.opsional && (
                              <span className="text-destructive">*</span>
                            )}
                          </Label>
                          {!!f.isiAwal?.(sg)?.trim() &&
                            !/^tanggal/.test(f.key) && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal"
                              >
                                Terhubung ke profil sanggar
                              </Badge>
                            )}
                          {dariIngatan.has(f.key) && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              Terisi otomatis dari dokumen sebelumnya
                            </Badge>
                          )}
                        </div>
                        {f.petunjuk && (
                          <p className="text-[11px] text-muted-foreground">
                            {f.petunjuk}
                          </p>
                        )}
                        {fieldBerpilihan(f) ? (
                          <FieldPilihan
                            field={f}
                            nilai={nilai[f.key] ?? ""}
                            invalid={
                              validasiDiminta && masalahFieldAktif.has(f.key)
                            }
                            onChange={(v) =>
                              setNilai((n) => ({ ...n, [f.key]: v }))
                            }
                          />
                        ) : f.type === "textarea" ? (
                          <Textarea
                            id={`f-${f.key}`}
                            rows={4}
                            value={nilai[f.key] ?? ""}
                            placeholder={f.placeholder}
                            aria-invalid={
                              validasiDiminta && masalahFieldAktif.has(f.key)
                            }
                            className={
                              validasiDiminta && masalahFieldAktif.has(f.key)
                                ? "border-destructive"
                                : undefined
                            }
                            onChange={(e) =>
                              setNilai((n) => ({
                                ...n,
                                [f.key]: e.target.value,
                              }))
                            }
                            data-testid={`input-${f.key}`}
                          />
                        ) : (
                          <Input
                            id={`f-${f.key}`}
                            value={nilai[f.key] ?? ""}
                            placeholder={f.placeholder}
                            aria-invalid={
                              validasiDiminta && masalahFieldAktif.has(f.key)
                            }
                            className={
                              validasiDiminta && masalahFieldAktif.has(f.key)
                                ? "border-destructive"
                                : undefined
                            }
                            onChange={(e) =>
                              setNilai((n) => ({
                                ...n,
                                [f.key]: e.target.value,
                              }))
                            }
                            data-testid={`input-${f.key}`}
                          />
                        )}
                        {validasiDiminta && masalahFieldAktif.has(f.key) && (
                          <p className="text-xs text-destructive">
                            {masalahFieldAktif.get(f.key)}.
                          </p>
                        )}
                      </div>
                    ))}
                  </section>
                )}

                {tampilanPembuatan === "pratinjau" && (
                  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-neutral-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">
                          Pratinjau dokumen
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tplAktif.judul} · {sg.namaSanggar}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Format A4 · Administrasi organisasi
                      </Badge>
                    </div>
                    <PagedDocumentPreview
                      documentHtml={previewDokumenHtml}
                      className="min-h-0 flex-1"
                      testId="preview-dokumen"
                    />
                  </section>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => setTplAktif(null)}
                  data-testid="button-batal-dokumen"
                >
                  Batal
                </Button>
                <Button
                  variant="outline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    setTampilanPembuatan((tampilan) =>
                      tampilan === "formulir" ? "pratinjau" : "formulir",
                    )
                  }
                  data-testid="button-preview-dokumen"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  <span
                    className={tampilanPembuatan === "formulir" ? "" : "hidden"}
                  >
                    Preview
                  </span>
                  <span
                    className={
                      tampilanPembuatan === "pratinjau" ? "" : "hidden"
                    }
                  >
                    Kembali ke Formulir
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  disabled={!validasiDokumenAktif.lengkap}
                  onClick={() => bukaEditor(tplAktif)}
                  data-testid="button-edit-manual"
                >
                  <PencilLine className="mr-2 h-4 w-4" />
                  {tplAktif.id === "ad-art"
                    ? "Ubah Seluruh Bab AD/ART"
                    : "Review & Edit Manual"}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !validasiDokumenAktif.lengkap || unduhanAktif !== null
                  }
                  onClick={() => void unduhOtomatis(tplAktif, "word")}
                  data-testid="button-unduh-word-dokumen"
                >
                  {unduhanAktif?.target === `template:${tplAktif.id}` &&
                  unduhanAktif.format === "word" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Unduh Word
                </Button>
                <Button
                  disabled={
                    !validasiDokumenAktif.lengkap || unduhanAktif !== null
                  }
                  onClick={() => void unduhOtomatis(tplAktif, "pdf")}
                  data-testid="button-unduh-pdf-dokumen"
                >
                  {unduhanAktif?.target === `template:${tplAktif.id}` &&
                  unduhanAktif.format === "pdf" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Unduh PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════ EDITOR MANUAL (WYSIWYG) ══════════ */}
      <Dialog open={!!editState} onOpenChange={(o) => !o && tutupEditor()}>
        <DialogContent className="flex h-[92vh] max-h-[920px] max-w-4xl flex-col overflow-hidden">
          {editState && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PencilLine className="h-4 w-4 text-primary" /> Edit Manual
                  Dokumen
                </DialogTitle>
                <DialogDescription>
                  Ubah teks langsung pada dokumen di bawah (klik lalu ketik).
                  Hasil edit inilah yang akan diunduh sebagai Word/PDF dan
                  disimpan ke arsip. Kop serta tanda tangan dikunci agar
                  struktur resminya tidak terhapus.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-neutral-100 p-4">
                {/* Kertas dokumen — hitam di atas putih, meniru hasil unduhan A4 */}
                <EditableDocument
                  initialHtml={editState.startHtml}
                  version={editState.version ?? 0}
                  editorRef={editRef}
                  onChange={() => setEditorKotor(true)}
                />
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={resetEditorKeOtomatis}
                  data-testid="button-reset-editor"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Setel ulang ke versi
                  otomatis
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    disabled={editorMenyimpan || !editorKotor}
                    onClick={() => void simpanDrafEditor()}
                    data-testid="button-simpan-draf-editor"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {editorMenyimpan ? "Menyimpan…" : "Simpan Draf"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={tutupEditor}
                    data-testid="button-tutup-editor"
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="outline"
                    disabled={unduhanAktif !== null}
                    onClick={() => void unduhDariEditor("word")}
                    data-testid="button-unduh-word-editor"
                  >
                    {unduhanAktif?.target === `editor:${editState.t.id}` &&
                    unduhanAktif.format === "word" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Unduh Word
                  </Button>
                  <Button
                    disabled={unduhanAktif !== null}
                    onClick={() => void unduhDariEditor("pdf")}
                    data-testid="button-unduh-pdf-editor"
                  >
                    {unduhanAktif?.target === `editor:${editState.t.id}` &&
                    unduhanAktif.format === "pdf" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Unduh PDF
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Pertahankan halaman template native yang telah dipakai di produksi.
function useNativeDokumenAdapter() {
  const { user } = useAuth();
  const state = useDb();
  // Follow this tab's authenticated identity; a DB refresh must not select a
  // similarly named account or the first sanggar in a curator's local cache.
  const profile = user?.role === "sanggar"
    ? state.users.find((entry): entry is SanggarUser => entry.id === user.id && entry.role === "sanggar") ?? user
    : null;
  const prefix = profile ? `${profile.id}:` : "";
  const savedValues = Object.fromEntries(
    Object.entries(state.paketIsian ?? {}).filter(([key]) => prefix && key.startsWith(prefix)),
  );
  const relatedSources = profile
    ? (state.dokumenArsip ?? [])
        .filter((entry) => entry.sanggarId === profile.id)
        .map((entry) => ({
          sanggarId: entry.sanggarId,
          values: entry.nilai,
          updatedAt: entry.updatedAt,
          groupId: entry.bentukId,
        }))
    : [];
  return {
    profile,
    savedValues,
    relatedSources,
    save: async (key: string, values: Record<string, string>) => {
      if (!profile || !key.startsWith(`${profile.id}:native-fix-`)) {
        throw new Error("Isian harus disimpan pada akun sanggar yang sedang aktif.");
      }
      save((s) => {
        s.paketIsian[key] = { ...values };
      });
      await waitForServer();
    },
  };
}

// Public modules are served verbatim in dev and production. Vite adds an
// `?import` query to relative dynamic imports even with @vite-ignore, which
// makes its dev server reject JS in public/. An absolute URL stays untouched.
const nativeDokumenModule = new URL(
  `${import.meta.env.BASE_URL}assets/native-ui-20260915.mjs?v=workspace-20260920`,
  window.location.origin,
).href;
const NativeTemplatePage = lazy(async () => {
  const { createTemplatePage } = await import(
    /* @vite-ignore */ nativeDokumenModule
  );
  return {
    default: createTemplatePage(React, null, useNativeDokumenAdapter),
  };
});

export default function NativeDokumenPage() {
  return (
    <Suspense fallback={<p>Memuat dokumen sanggar…</p>}>
      <NativeTemplatePage />
    </Suspense>
  );
}
