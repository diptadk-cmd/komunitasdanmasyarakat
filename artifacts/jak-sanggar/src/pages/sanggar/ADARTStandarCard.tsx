import { useEffect, useRef, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import type { BentukKedudukanId, DokumenArsip, SanggarUser } from "@/lib/types";
import { load, persistDokumenArsip, uid } from "@/lib/store";
import { escapeHtml } from "@/lib/utils";
import {
  bangunHtmlUnduhanDokumen,
  unduhDokumen,
  type FormatUnduhanDokumen,
  type OpsiUnduhanDokumen,
} from "@/lib/dokumen-export";
import {
  ringkasFieldKosong,
} from "@workspace/jaksanggar-core/dokumen-validation";
import {
  bungkusHtmlDokumenTemplate,
  cssDenganLayoutDokumenTemplate,
} from "@/lib/dokumen-template-layout";
import {
  ADART_STANDAR_TEMPLATE_ID,
  SUMBER_ADART_STANDAR,
  TOKEN_INTI_ADART_STANDAR,
  loadAdartStandar,
  prefillAdartStandar,
  renderDokumenAdartStandar,
  fieldAdartStandar,
  validasiDataAdartStandar,
  type DokumenAdartStandarTermuat,
  type JenisDokumenAdartStandar,
  type NilaiIntiAdartStandar,
  type NilaiAdartStandar,
} from "@/lib/adart-standar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ambilHtmlEditorTerstruktur,
  StructuredDocumentEditor,
} from "@/components/dokumen/StructuredDocumentEditor";
import { PagedDocumentPreview } from "@/components/dokumen/PagedDocumentPreview";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpenCheck,
  Download,
  FileText,
  Loader2,
  PencilLine,
  RotateCcw,
  Save,
  Wand2,
  AlertTriangle,
  Eye,
} from "lucide-react";

const KEY_AD = "__html_ad";
const KEY_ART = "__html_art";
const KEY_NOMOR = "__nomor_dokumen_adart";
const KEY_SUMBER = "__sumber_adart";

type NilaiForm = NilaiAdartStandar & { NOMOR_DOKUMEN: string };
type HtmlBuku = Record<JenisDokumenAdartStandar, string>;

const JUDUL_BAB: Record<JenisDokumenAdartStandar, string> = {
  ad: "Anggaran Dasar · 17 Bab",
  art: "Anggaran Rumah Tangga · 19 Bab",
};

function nilaiAwal(
  sg: SanggarUser,
  tersimpan: Record<string, string>,
): NilaiForm {
  const override: Partial<NilaiIntiAdartStandar> = {};
  for (const token of TOKEN_INTI_ADART_STANDAR) {
    if (tersimpan[token]?.trim()) override[token] = tersimpan[token];
  }
  return {
    ...Object.fromEntries(Object.entries(tersimpan).filter(([token]) => /^[A-Z0-9_/]+$/.test(token))),
    ...prefillAdartStandar(sg, override),
    NOMOR_DOKUMEN: tersimpan[KEY_NOMOR] ?? "",
  };
}

function htmlDenganNomor(html: string, nomor: string): string {
  const value = nomor.trim();
  if (!value) return html;
  return `<div style="text-align:right;font-size:10pt;line-height:1.4;margin:0 0 12px">Nomor Pengesahan/Arsip: ${escapeHtml(value)}</div>${html}`;
}

function gabungDokumen(html: HtmlBuku): string {
  return `${bungkusHtmlDokumenTemplate(html.ad, { dokumenId: "04_AD" })}<div style="break-before:page;page-break-before:always;height:0"></div>${bungkusHtmlDokumenTemplate(html.art, { dokumenId: "05_ART" })}`;
}

function layoutAdartStandar(jenis: JenisDokumenAdartStandar) {
  const id = jenis === "ad" ? "04_AD" : "05_ART";
  return load().appearance.dokumenTemplates?.[`mandiri-non-bh:${id}`]?.layout;
}

export function arsipAdartStandarPunyaNaskah(arsip: DokumenArsip): boolean {
  return Boolean(arsip.nilai[KEY_AD]?.trim() && arsip.nilai[KEY_ART]?.trim());
}

export function opsiUnduhanUlangAdartStandar(
  arsip: DokumenArsip,
): OpsiUnduhanDokumen | null {
  const ad = arsip.nilai[KEY_AD]?.trim();
  const art = arsip.nilai[KEY_ART]?.trim();
  if (!ad || !art) return null;
  const namaSanggar = arsip.nilai.NAMA_SANGGAR || "Sanggar";
  return {
    title: `${arsip.judul} — ${arsip.nilai.NAMA_SANGGAR || "Sanggar"}`,
    fileName: `AD ART - ${namaSanggar}`,
    bodyHtml: gabungDokumen({ ad, art }),
    finalCss: cssDenganLayoutDokumenTemplate(layoutAdartStandar("ad")),
  };
}

export function ADARTStandarCard({
  sg,
  bentukId,
  arsipMasuk,
  onArsipDibuka,
}: {
  sg: SanggarUser;
  bentukId: BentukKedudukanId;
  arsipMasuk?: DokumenArsip | null;
  onArsipDibuka?: () => void;
}) {
  const db = useDb();
  const { demoMode } = useAuth();
  const { toast } = useToast();
  const [terbuka, setTerbuka] = useState(false);
  const [tahap, setTahap] = useState<"form" | "editor">("form");
  const [tampilanForm, setTampilanForm] = useState<
    "formulir" | "pratinjau"
  >("formulir");
  const [sumber, setSumber] = useState<DokumenAdartStandarTermuat | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [nilai, setNilai] = useState<NilaiForm>(() => nilaiAwal(sg, {}));
  const [htmlBuku, setHtmlBuku] = useState<HtmlBuku | null>(null);
  const [bukuAktif, setBukuAktif] = useState<JenisDokumenAdartStandar>("ad");
  const [versiEditor, setVersiEditor] = useState(0);
  const [arsipId, setArsipId] = useState<string | null>(null);
  const [fieldAktif, setFieldAktif] = useState<string | null>(null);
  const [validasiDiminta, setValidasiDiminta] = useState(false);
  const [dataIntiPerluDiterapkan, setDataIntiPerluDiterapkan] = useState(false);
  const [mengunduh, setMengunduh] =
    useState<FormatUnduhanDokumen | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const bisaStandar = bentukId === SUMBER_ADART_STANDAR.bentukId;
  const kunciPaket = `${sg.id}:${SUMBER_ADART_STANDAR.paketId}`;
  const isianPaket = db.paketIsian[kunciPaket] ?? {};

  const muatSumber = async (): Promise<DokumenAdartStandarTermuat | null> => {
    if (sumber) return sumber;
    setMemuat(true);
    setGagal(null);
    try {
      const result = await loadAdartStandar();
      setSumber(result);
      return result;
    } catch {
      setGagal(
        "Dokumen standar AD/ART belum dapat dimuat. Periksa koneksi lalu coba lagi.",
      );
      return null;
    } finally {
      setMemuat(false);
    }
  };

  const mulaiBaru = () => {
    if (!bisaStandar) return;
    setNilai(nilaiAwal(sg, isianPaket));
    setHtmlBuku(null);
    setArsipId(null);
    setBukuAktif("ad");
    setTahap("form");
    setTampilanForm("formulir");
    setFieldAktif(null);
    setValidasiDiminta(false);
    setDataIntiPerluDiterapkan(false);
    setTerbuka(true);
    void muatSumber();
  };

  useEffect(() => {
    if (!arsipMasuk || arsipMasuk.templateId !== ADART_STANDAR_TEMPLATE_ID)
      return;
    const nilaiArsip = nilaiAwal(sg, arsipMasuk.nilai);
    const validasiArsip = validasiDataAdartStandar(nilaiArsip, sumber);
    const ad = arsipMasuk.nilai[KEY_AD]?.trim() ?? "";
    const art = arsipMasuk.nilai[KEY_ART]?.trim() ?? "";
    setNilai(nilaiArsip);
    setHtmlBuku(ad && art ? { ad, art } : null);
    setArsipId(arsipMasuk.id);
    setBukuAktif("ad");
    setTahap(validasiArsip.lengkap && ad && art ? "editor" : "form");
    setTampilanForm("formulir");
    setValidasiDiminta(!validasiArsip.lengkap);
    setDataIntiPerluDiterapkan(!validasiArsip.lengkap && Boolean(ad && art));
    setVersiEditor((n) => n + 1);
    setTerbuka(true);
    void muatSumber();
    if (!validasiArsip.lengkap) {
      toast({
        title: "Draf AD/ART perlu dilengkapi",
        description: `Periksa: ${ringkasFieldKosong(validasiArsip.fieldBermasalah)}.`,
        variant: "destructive",
      });
    } else if (!ad || !art) {
      toast({
        title: "Naskah AD/ART akan dibuat ulang",
        description:
          "Data inti masih tersedia, tetapi isi AD atau ART belum tersimpan.",
      });
    }
    onArsipDibuka?.();
  }, [arsipMasuk?.id]);

  const fieldsInti = fieldAdartStandar(sumber);
  const validasiDataInti = validasiDataAdartStandar(nilai, sumber);
  const masalahDataInti = new Map(
    validasiDataInti.fieldBermasalah.map((field) => [field.key, field.alasan]),
  );
  const nilaiTerisi = validasiDataInti.terisi;
  const previewDasar = sumber
    ? renderDokumenAdartStandar(sumber.dokumen[bukuAktif], nilai)
    : "";
  const previewHtml = htmlDenganNomor(previewDasar, nilai.NOMOR_DOKUMEN);
  const previewDocumentHtml = sumber
    ? bangunHtmlUnduhanDokumen({
        title: `${JUDUL_BAB[bukuAktif]} — ${sg.namaSanggar}`,
        bodyHtml: bungkusHtmlDokumenTemplate(previewHtml, {
          dokumenId: bukuAktif === "ad" ? "04_AD" : "05_ART",
        }),
        finalCss: cssDenganLayoutDokumenTemplate(
          sumber.dokumen[bukuAktif].layout,
        ),
      })
    : "";

  const pastikanDataIntiLengkap = (): boolean => {
    if (!sumber) {
      toast({ title: "Tunggu naskah AD/ART selesai dimuat" });
      return false;
    }
    if (validasiDataInti.lengkap) return true;
    const pertama = validasiDataInti.fieldBermasalah[0];
    setValidasiDiminta(true);
    setTahap("form");
    if (pertama) {
      setFieldAktif(pertama.key);
      window.setTimeout(() => {
        document.getElementById(`adart-${pertama.key}`)?.focus();
      }, 0);
    }
    toast({
      title: "Lengkapi identitas dan ketentuan AD/ART",
      description: `Periksa: ${ringkasFieldKosong(validasiDataInti.fieldBermasalah)}.`,
      variant: "destructive",
    });
    return false;
  };

  const lanjutKeEditor = () => {
    if (!sumber) return;
    if (!pastikanDataIntiLengkap()) return;
    // Jangan menimpa suntingan manual bila pengguna kembali sebentar ke
    // formulir data inti. Untuk menerapkan data baru ke satu buku, pengguna
    // dapat memakai "Setel ulang buku ini" di editor secara sadar.
    if (!htmlBuku || dataIntiPerluDiterapkan) {
      setHtmlBuku({
        ad: htmlDenganNomor(
          renderDokumenAdartStandar(sumber.dokumen.ad, nilai),
          nilai.NOMOR_DOKUMEN,
        ),
        art: htmlDenganNomor(
          renderDokumenAdartStandar(sumber.dokumen.art, nilai),
          nilai.NOMOR_DOKUMEN,
        ),
      });
      setDataIntiPerluDiterapkan(false);
    }
    setBukuAktif("ad");
    setVersiEditor((n) => n + 1);
    setTahap("editor");
  };

  const simpanIsiEditor = (): HtmlBuku | null => {
    if (!htmlBuku) return null;
    // Snapshot dikeluarkan tanpa atribut contenteditable sementara, sehingga
    // arsip dan hasil unduhan tetap merupakan HTML dokumen yang bersih.
    const htmlSaatIni = ambilHtmlEditorTerstruktur(editorRef.current);
    if (!htmlSaatIni) return htmlBuku;
    const hasil = { ...htmlBuku, [bukuAktif]: htmlSaatIni };
    setHtmlBuku(hasil);
    return hasil;
  };

  const pindahBuku = (tujuan: JenisDokumenAdartStandar) => {
    if (tujuan === bukuAktif) return;
    simpanIsiEditor();
    setBukuAktif(tujuan);
    setVersiEditor((n) => n + 1);
  };

  const setelUlangBab = () => {
    if (!sumber || !htmlBuku) return;
    const htmlBaku = htmlDenganNomor(
      renderDokumenAdartStandar(sumber.dokumen[bukuAktif], nilai),
      nilai.NOMOR_DOKUMEN,
    );
    setHtmlBuku({ ...htmlBuku, [bukuAktif]: htmlBaku });
    setVersiEditor((n) => n + 1);
  };

  const simpanDraf = async (
    htmlOverride?: HtmlBuku,
  ): Promise<HtmlBuku | null> => {
    const html = htmlOverride ?? simpanIsiEditor();
    if (!html) return null;
    const now = Date.now();
    const entry: DokumenArsip = {
      id: arsipId ?? uid(),
      sanggarId: sg.id,
      templateId: ADART_STANDAR_TEMPLATE_ID,
      judul: "Anggaran Dasar & Anggaran Rumah Tangga (Standar Lengkap)",
      bentukId,
      nilai: {
        ...nilai,
        [KEY_NOMOR]: nilai.NOMOR_DOKUMEN,
        [KEY_AD]: html.ad,
        [KEY_ART]: html.art,
        [KEY_SUMBER]: SUMBER_ADART_STANDAR.paketId,
      },
      createdAt: arsipId
        ? (db.dokumenArsip.find((item) => item.id === arsipId)?.createdAt ??
          now)
        : now,
      updatedAt: now,
    };
    try {
      const result = await persistDokumenArsip(entry);
      if (!result.server && !demoMode) {
        toast({
          title: "Draf belum tersimpan di server",
          description: "Periksa koneksi dan sesi masuk, lalu coba simpan kembali.",
          variant: "destructive",
        });
        return null;
      }
      setArsipId(entry.id);
      toast(
        result.server
          ? { title: "Draf AD/ART tersimpan" }
          : {
              title: "Draf tersimpan di perangkat ini",
              description: "Mode demo menggunakan penyimpanan lokal.",
            },
      );
      return html;
    } catch {
      toast({
        title: "Draf tidak tersimpan",
        description: "Coba lagi setelah koneksi tersedia.",
        variant: "destructive",
      });
      return null;
    }
  };

  const unduh = async (format: FormatUnduhanDokumen) => {
    if (!pastikanDataIntiLengkap()) return;
    if (dataIntiPerluDiterapkan) {
      toast({
        title: "Terapkan data inti terlebih dahulu",
        description:
          "Kembali ke data inti lalu buka editor agar AD dan ART diperbarui.",
        variant: "destructive",
      });
      return;
    }
    const html = simpanIsiEditor();
    if (!html) return;
    if (!(await simpanDraf(html))) return;
    setMengunduh(format);
    try {
      await unduhDokumen(format, {
        title: `AD/ART — ${nilai.NAMA_SANGGAR || sg.namaSanggar}`,
        fileName: `AD ART - ${nilai.NAMA_SANGGAR || sg.namaSanggar}`,
        bodyHtml: gabungDokumen(html),
        finalCss: cssDenganLayoutDokumenTemplate(layoutAdartStandar("ad")),
      });
      toast({
        title: `${format === "word" ? "Word" : "PDF"} berhasil diunduh`,
        description:
          "Untuk mencetak, buka berkas hasil unduhan di Microsoft Office atau aplikasi PDF.",
      });
    } catch {
      toast({
        title: "Unduhan gagal dibuat",
        description: "Draf sudah tersimpan. Coba unduh kembali.",
        variant: "destructive",
      });
    } finally {
      setMengunduh(null);
    }
  };

  return (
    <Card data-testid="card-adart-standar">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenCheck className="h-4 w-4 text-primary" />
          AD/ART Dokumen Standar Lengkap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bisaStandar ? (
          <>
            <p className="text-sm text-muted-foreground">
              Naskah standar lengkap berisi Anggaran Dasar 17 Bab dan Anggaran
              Rumah Tangga 19 Bab. Data identitas diisi sekali, lalu setiap bab
              dapat diedit langsung.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">
                Form terintegrasi · pratinjau langsung · draf dapat dibuka
                kembali
              </span>
              <Button
                size="sm"
                onClick={mulaiBaru}
                data-testid="button-buat-adart-standar"
              >
                <Wand2 className="mr-1.5 h-4 w-4" />
                Buat AD/ART
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Naskah lengkap standar saat ini khusus untuk Sanggar Mandiri Non
            Badan Hukum. Pilih kedudukan tersebut bila naskahnya memang sesuai;
            bentuk lain tidak akan memakai naskah ini secara keliru.
          </p>
        )}
      </CardContent>

      <Dialog open={terbuka} onOpenChange={setTerbuka}>
        <DialogContent className="flex h-[90vh] max-h-[920px] max-w-7xl flex-col overflow-hidden">
          {tahap === "form" ? (
            <>
              <DialogHeader>
                <DialogTitle>Dokumen Standar AD/ART</DialogTitle>
                <DialogDescription>
                  {tampilanForm === "formulir"
                    ? "Isi identitas dan ketentuan organisasi, lalu tekan Preview untuk memeriksa naskah."
                    : "Pratinjau hanya menampilkan buku AD atau ART yang sedang dibuat sebagai lembar kertas terpisah."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {tampilanForm === "formulir" && (
                <section className="min-h-0 overflow-y-auto rounded-lg border bg-muted/20 p-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Data AD/ART</p>
                      <p className="text-xs text-muted-foreground">
                        {nilaiTerisi}/{fieldsInti.length} isian valid
                      </p>
                    </div>
                    <Badge
                      variant={
                        validasiDataInti.lengkap
                          ? "success"
                          : "outline"
                      }
                    >
                      {validasiDataInti.lengkap
                        ? "Siap"
                        : "Dalam pengisian"}
                    </Badge>
                  </div>

                  {!validasiDataInti.lengkap && (
                    <div
                      className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                      role={validasiDiminta ? "alert" : undefined}
                      data-testid="peringatan-adart-belum-lengkap"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        <span className="font-semibold">
                          Identitas atau ketentuan belum lengkap.
                        </span>{" "}
                        Periksa{" "}
                        {ringkasFieldKosong(validasiDataInti.fieldBermasalah)}
                        sebelum membuka editor atau mengunduh.
                      </p>
                    </div>
                  )}

                  {dataIntiPerluDiterapkan && validasiDataInti.lengkap && (
                    <div className="mb-4 flex gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Data inti berubah. Saat editor dibuka, AD dan ART akan
                        dibuat ulang dengan data terbaru agar tidak ada bagian
                        yang tertinggal kosong.
                      </p>
                    </div>
                  )}

                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-[width] duration-200"
                      style={{
                        width: `${validasiDataInti.persentase}%`,
                      }}
                    />
                  </div>

                  <p className="mb-3 text-xs text-muted-foreground">
                    Nama sanggar, ketua, alamat, dan kota sudah ditarik dari
                    profil/paket data bersama. Perubahan di sini berlaku untuk
                    dokumen ini tanpa menanyakan data yang sama per bab.
                  </p>

                  <div className="space-y-3">
                    {fieldsInti.map(({ key: token, label }, index) => (
                      <div
                        key={token}
                        className="space-y-1.5"
                        onFocusCapture={() => setFieldAktif(token)}
                      >
                        {index === TOKEN_INTI_ADART_STANDAR.length && (
                          <div className="border-t pt-4 pb-2">
                            <p className="font-semibold">Ketentuan organisasi</p>
                            <p className="text-xs text-muted-foreground">
                              Isi sesuai hasil musyawarah. Jumlah pembagian penghasilan harus 100%.
                            </p>
                          </div>
                        )}
                        <Label htmlFor={`adart-${token}`}>
                          {label}{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`adart-${token}`}
                          value={nilai[token] ?? ""}
                          inputMode={/^HARI_/.test(token) ? "numeric" : /^PERSEN_/.test(token) ? "decimal" : undefined}
                          aria-invalid={
                            validasiDiminta && masalahDataInti.has(token)
                          }
                          className={
                            validasiDiminta && masalahDataInti.has(token)
                              ? "border-destructive"
                              : undefined
                          }
                          onChange={(event) => {
                            setNilai((old) => ({
                              ...old,
                              [token]: event.target.value,
                            }));
                            if (htmlBuku) setDataIntiPerluDiterapkan(true);
                          }}
                          data-testid={`input-adart-${token}`}
                        />
                        {validasiDiminta && masalahDataInti.has(token) && (
                          <p className="text-xs text-destructive">
                            {masalahDataInti.get(token)}.
                          </p>
                        )}
                      </div>
                    ))}
                    <div
                      className="space-y-1.5"
                      onFocusCapture={() => setFieldAktif("NOMOR_DOKUMEN")}
                    >
                      <Label htmlFor="adart-nomor">
                        Nomor pengesahan/arsip (opsional)
                      </Label>
                      <Input
                        id="adart-nomor"
                        value={nilai.NOMOR_DOKUMEN}
                        placeholder="Contoh: 001/ADART/SGR/VII/2026"
                        onChange={(event) => {
                          setNilai((old) => ({
                            ...old,
                            NOMOR_DOKUMEN: event.target.value,
                          }));
                          if (htmlBuku) setDataIntiPerluDiterapkan(true);
                        }}
                        data-testid="input-adart-nomor"
                      />
                    </div>
                  </div>
                </section>
                )}

                {tampilanForm === "pratinjau" && (
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-neutral-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Pratinjau dokumen
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {JUDUL_BAB[bukuAktif]} · {sg.namaSanggar}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(
                        Object.keys(JUDUL_BAB) as JenisDokumenAdartStandar[]
                      ).map((jenis) => (
                        <Button
                          key={jenis}
                          size="sm"
                          variant={bukuAktif === jenis ? "default" : "outline"}
                          onClick={() => setBukuAktif(jenis)}
                        >
                          {jenis === "ad" ? "AD" : "ART"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    {memuat ? (
                      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat
                        naskah standar…
                      </div>
                    ) : gagal ? (
                      <p className="text-sm text-destructive">{gagal}</p>
                    ) : (
                      <PagedDocumentPreview
                        documentHtml={previewDocumentHtml}
                        className="h-full min-h-0"
                        testId="preview-adart-standar"
                      />
                    )}
                  </div>
                </section>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setTerbuka(false)}>
                  Batal
                </Button>
                <Button
                  variant="outline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    setTampilanForm((tampilan) =>
                      tampilan === "formulir" ? "pratinjau" : "formulir",
                    )
                  }
                  data-testid="button-preview-adart"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  <span className={tampilanForm === "formulir" ? "" : "hidden"}>Preview</span>
                  <span className={tampilanForm === "pratinjau" ? "" : "hidden"}>Kembali ke Formulir</span>
                </Button>
                <Button
                  onClick={lanjutKeEditor}
                  disabled={!sumber || memuat}
                  data-testid="button-lanjut-edit-adart"
                >
                  <PencilLine className="mr-2 h-4 w-4" />
                  {dataIntiPerluDiterapkan
                    ? "Terapkan Data & Buka Editor"
                    : "Ubah Seluruh Bab AD/ART"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PencilLine className="h-4 w-4 text-primary" /> Edit Seluruh
                  Bab AD/ART
                </DialogTitle>
                <DialogDescription>
                  Pilih AD atau ART, lalu klik teks atau isi sel untuk mengedit.
                  Struktur tabel terkunci agar tidak rusak; isi teks dan sel
                  tetap dapat diubah. Semua perubahan disimpan sebagai draf dan
                  dipakai pada hasil Word dan PDF.
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-neutral-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white p-2">
                  <div className="flex gap-2">
                    {(Object.keys(JUDUL_BAB) as JenisDokumenAdartStandar[]).map(
                      (jenis) => (
                        <Button
                          key={jenis}
                          size="sm"
                          variant={bukuAktif === jenis ? "default" : "outline"}
                          onClick={() => pindahBuku(jenis)}
                        >
                          {JUDUL_BAB[jenis]}
                        </Button>
                      ),
                    )}
                  </div>
                  <Badge variant="secondary">
                    Tabel terlindungi · teks & sel dapat diubah
                  </Badge>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <style>
                    {cssDenganLayoutDokumenTemplate(
                      sumber?.dokumen[bukuAktif].layout,
                    )}
                  </style>
                  {htmlBuku && (
                    <StructuredDocumentEditor
                      initialHtml={bungkusHtmlDokumenTemplate(
                        htmlBuku[bukuAktif],
                        {
                          dokumenId: bukuAktif === "ad" ? "04_AD" : "05_ART",
                        },
                      )}
                      version={versiEditor}
                      editorRef={editorRef}
                      pagePreset="template-a4"
                      className="max-w-none bg-transparent shadow-none"
                    />
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={setelUlangBab}
                  disabled={!sumber}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Setel ulang buku ini
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setTahap("form")}>
                    Kembali ke data inti
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void simpanDraf();
                    }}
                    data-testid="button-simpan-adart"
                  >
                    <Save className="mr-2 h-4 w-4" /> Simpan Draf
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void unduh("word")}
                    disabled={
                      !validasiDataInti.lengkap ||
                      dataIntiPerluDiterapkan ||
                      mengunduh !== null
                    }
                    title="Unduh AD/ART sebagai dokumen Word"
                    data-testid="button-unduh-word-adart"
                  >
                    {mengunduh === "word" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Unduh Word
                  </Button>
                  <Button
                    onClick={() => void unduh("pdf")}
                    disabled={
                      !validasiDataInti.lengkap ||
                      dataIntiPerluDiterapkan ||
                      mengunduh !== null
                    }
                    title="Unduh AD/ART sebagai PDF"
                    data-testid="button-unduh-pdf-adart"
                  >
                    {mengunduh === "pdf" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Unduh PDF
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
