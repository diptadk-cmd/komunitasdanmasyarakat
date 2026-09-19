// Paket Dokumen Resmi — dokumen administrasi lengkap (hasil konversi paket
// docx) yang menyesuaikan bentuk & kedudukan sanggar. Isian formulir dibagi
// bersama seluruh dokumen dalam satu paket dan disimpan lokal (db.paketIsian).
import { useEffect, useState } from "react";
import { useDb } from "@/lib/auth";
import type { BentukKedudukanId, SanggarUser } from "@/lib/types";
import { save, logActivity } from "@/lib/store";
import {
  paketUntukBentuk,
  fetchPaket,
  fieldDokumenPaket,
  fieldWajibDokumenPaket,
  fieldPaket,
  opsiToken,
  tokenPanjang,
  jenisFieldToken,
  prefillDariProfil,
  nilaiFieldPaket,
  substitusiDokumenPaket,
  progresDokumenPaket,
  type PaketData,
  type PaketDokumen,
  type PaketField,
  type PaketInfo,
} from "@/lib/dokumen-paket";
import {
  bangunHtmlUnduhanDokumen,
  unduhDokumen,
  type FormatUnduhanDokumen,
  type OpsiUnduhanDokumen,
} from "@/lib/dokumen-export";
import { waitForServer } from "@workspace/jaksanggar-core/sync";
import {
  bungkusHtmlDokumenTemplate,
  cssDenganLayoutDokumenTemplate,
} from "@/lib/dokumen-template-layout";
import { PagedDocumentPreview } from "@/components/dokumen/PagedDocumentPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  BookOpenCheck,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
} from "lucide-react";
import {
  ringkasFieldKosong,
  validasiIsianDokumen,
} from "@workspace/jaksanggar-core/dokumen-validation";

type ModeFormulir = "paket" | "dokumen";

const TOKEN_BIDANG_SENI = new Set([
  "TARI/MUSIK/TEATER/SASTRA/RUPA/MULTIDISIPLIN",
  "TARI/MUSIK/TEATER/SASTRA/SENI_RUPA/MULTIDISIPLIN/LAINNYA",
]);

const OPSI_BIDANG_SENI = [
  "Tari",
  "Musik",
  "Teater",
  "Rupa",
  "Sastra",
  "Silat",
  "Multidisiplin",
  "Lainnya",
];

// Token dengan garis miring tidak selalu berarti pilih satu. Dua token ini
// memang menggambarkan daftar aktivitas/bidang yang dapat dimiliki sekaligus.
const TOKEN_PILIHAN_GANDA = new Set([
  ...TOKEN_BIDANG_SENI,
  "PELATIHAN/PRODUKSI/PERTUNJUKAN/LAINNYA",
]);

function pecahPilihan(nilai: string | undefined): string[] {
  return (nilai ?? "")
    .split(/\n|,\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function gabungPilihan(daftar: string[]): string {
  return daftar
    .map((v) => v.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Prefill paket melengkapi helper umum dengan rekening dan penyamaan opsi
 * bidang seni. Nilai ini hanya dipakai jika pengguna belum menyimpan isian.
 */
function prefillPaketDariProfil(sg: SanggarUser): Record<string, string> {
  const nilai = { ...prefillDariProfil(sg) };
  const rekening = sg.rekening;
  if (rekening?.bank) nilai.BANK = rekening.bank;
  if (rekening?.nomor) nilai.NOMOR_REKENING = rekening.nomor;
  if (rekening?.atasNama) nilai.NAMA_REKENING = rekening.atasNama;

  for (const token of TOKEN_BIDANG_SENI) {
    const opsi = opsiToken(token) ?? [];
    const bidang = sg.jenisKesenian.map((jenis) =>
      jenis === "Rupa" && opsi.includes("Seni Rupa") ? "Seni Rupa" : jenis,
    );
    if (bidang.length > 0) nilai[token] = gabungPilihan(bidang);
  }
  return nilai;
}

function pilihanGandaToken(token: string): boolean {
  return TOKEN_PILIHAN_GANDA.has(token) || token === "BIDANG_SENI";
}

function opsiUntukToken(token: string): string[] | null {
  return (
    opsiToken(token) ?? (token === "BIDANG_SENI" ? OPSI_BIDANG_SENI : null)
  );
}

type BagianToken =
  | "identitas"
  | "legalitas"
  | "pengurus"
  | "tabel"
  | "rapat"
  | "keuangan"
  | "kegiatan";

const JUDUL_BAGIAN: Record<BagianToken, string> = {
  identitas: "Identitas & kontak sanggar",
  legalitas: "Legalitas & organisasi induk",
  pengurus: "Pengurus, pelatih & penandatangan",
  tabel: "Daftar & tabel berulang",
  rapat: "Rapat, keputusan & administrasi",
  keuangan: "Keuangan & rekening",
  kegiatan: "Kegiatan, operasional & laporan",
};

function bagianUntukField(field: PaketField): BagianToken {
  if (field.perBaris) return "tabel";
  const token = field.token;
  if (
    /AKTA|NOTARIS|SK_|PENGESAHAN|PENDAFTARAN|NIB|NPWP|KBLI|IN(DUK)?|YAYASAN|PERKUMPULAN|KOPERASI|PERSEROAN|\bPT\b|\bCV\b|FIRMA|KEWENANGAN|PEMILIK_MANFAAT|PASAL_AD/.test(
      token,
    )
  )
    return "legalitas";
  if (
    /BANK|REKENING|BIAYA|IURAN|DANA|HONORARIUM|NOMINAL|TOTAL|PERSENTASE|KEUANGAN|BULANAN|PERTEMUAN/.test(
      token,
    )
  )
    return "keuangan";
  if (
    /NAMA_(KETUA|WAKIL|SEKRETARIS|BENDAHARA|PIMPINAN|PENETAP|PENANGGUNG|KOORDINATOR|PELATIH)|JABATAN|NIK|IDENTITAS|KONTAK|ORGAN|PENGELOLA|PELATIH|PEKERJA|PENANGGUNG_JAWAB/.test(
      token,
    )
  )
    return "pengurus";
  if (
    /NOMOR|HARI|TANGGAL|PUKUL|WAKTU|TEMPAT|RAPAT|MUSYAWARAH|AGENDA|POKOK_PEMBAHASAN|KEPUTUSAN|BATAS|NOTULIS|PESERTA|UNDANGAN/.test(
      token,
    )
  )
    return "rapat";
  if (
    /KEGIATAN|PELATIHAN|PRODUKSI|PERTUNJUKAN|BIDANG_SENI|WILAYAH|PROGRAM|OUTPUT|KENDALA|TINDAK_LANJUT|MITRA|LAPORAN/.test(
      token,
    )
  )
    return "kegiatan";
  return "identitas";
}

function kelompokkanField(
  fields: PaketField[],
): Array<{ id: BagianToken; judul: string; fields: PaketField[] }> {
  const kelompok = new Map<BagianToken, PaketField[]>();
  for (const field of fields) {
    const id = bagianUntukField(field);
    kelompok.set(id, [...(kelompok.get(id) ?? []), field]);
  }
  return (Object.keys(JUDUL_BAGIAN) as BagianToken[])
    .filter((id) => (kelompok.get(id) ?? []).length > 0)
    .map((id) => ({
      id,
      judul: JUDUL_BAGIAN[id],
      fields: kelompok.get(id) ?? [],
    }));
}

function domIdFieldPaket(key: string): string {
  return `pt-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function fieldUntukValidasi(field: PaketField) {
  return {
    key: field.key,
    label: field.dokumenJudul
      ? `${field.label} (${field.dokumenJudul})`
      : field.label,
    jenis: jenisFieldToken(field.token),
  } as const;
}

function FieldTokenPaket({
  field,
  nilai,
  onChange,
  invalid = false,
}: {
  field: PaketField;
  nilai: string;
  onChange: (nilai: string) => void;
  invalid?: boolean;
}) {
  const token = field.token;
  const inputId = domIdFieldPaket(field.key);
  const opsi = opsiUntukToken(token);
  const ganda = pilihanGandaToken(token);
  const jenis = jenisFieldToken(token);

  if (opsi && ganda) {
    const terpilih = pecahPilihan(nilai);
    const dariDaftar = terpilih.filter((v) => opsi.includes(v));
    const lainnya = terpilih.filter((v) => !opsi.includes(v));
    const toggle = (opsiAktif: string, aktif: boolean) => {
      const berikut = aktif
        ? [...dariDaftar, opsiAktif]
        : dariDaftar.filter((v) => v !== opsiAktif);
      onChange(
        gabungPilihan([...opsi.filter((v) => berikut.includes(v)), ...lainnya]),
      );
    };
    return (
      <div className="space-y-2">
        <div className="rounded-md border divide-y">
          {opsi.map((opsiAktif, index) => (
            <label
              key={opsiAktif}
              className="flex items-start gap-2.5 p-2.5 text-sm cursor-pointer hover:bg-muted/40"
            >
              <Checkbox
                id={index === 0 ? inputId : undefined}
                checked={dariDaftar.includes(opsiAktif)}
                onCheckedChange={(aktif) => toggle(opsiAktif, aktif === true)}
                className="mt-0.5"
                data-testid={`opsi-paket-${field.key}-${opsiAktif.slice(0, 20)}`}
              />
              <span className="leading-snug">{opsiAktif}</span>
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`${inputId}-lain`}
            className="text-xs text-muted-foreground"
          >
            Lainnya (satu per baris)
          </Label>
          <Textarea
            id={`${inputId}-lain`}
            rows={2}
            value={lainnya.join("\n")}
            onChange={(e) =>
              onChange(
                gabungPilihan([...dariDaftar, ...pecahPilihan(e.target.value)]),
              )
            }
            data-testid={`input-lain-paket-${field.key}`}
          />
        </div>
      </div>
    );
  }

  if (opsi) {
    return (
      <select
        id={inputId}
        value={nilai}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-invalid={invalid || undefined}
        data-testid={`input-paket-${field.key}`}
      >
        <option value="">Pilih salah satu</option>
        {opsi.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (tokenPanjang(token)) {
    return (
      <Textarea
        id={inputId}
        rows={3}
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={invalid ? "border-destructive" : undefined}
        data-testid={`input-paket-${field.key}`}
      />
    );
  }

  return (
    <Input
      id={inputId}
      type={jenis === "email" ? "email" : "text"}
      inputMode={
        jenis === "telepon" || jenis === "nik" || jenis === "npwp"
          ? "numeric"
          : jenis === "angka" || jenis === "nominal"
            ? "decimal"
            : undefined
      }
      value={nilai}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={invalid ? "border-destructive" : undefined}
      placeholder={
        jenis === "tanggal"
          ? "Contoh: 20 Agustus 2026"
          : jenis === "nik"
            ? "16 digit NIK"
            : jenis === "npwp"
              ? "15 atau 16 digit NPWP"
              : undefined
      }
      data-testid={`input-paket-${field.key}`}
    />
  );
}

function FieldPaketItem({
  field,
  nilai,
  invalid,
  tampilkanDokumen = false,
  onChange,
}: {
  field: PaketField;
  nilai: string;
  invalid: boolean;
  tampilkanDokumen?: boolean;
  onChange: (nilai: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={domIdFieldPaket(field.key)}>{field.label}</Label>
      {tampilkanDokumen && field.dokumenJudul && (
        <p className="text-[11px] text-muted-foreground">
          {field.dokumenJudul}
        </p>
      )}
      <FieldTokenPaket
        field={field}
        nilai={nilai}
        invalid={invalid}
        onChange={onChange}
      />
      {invalid && (
        <p className="text-xs text-destructive">
          Periksa format atau lengkapi isian ini.
        </p>
      )}
    </div>
  );
}

function kelompokFieldPerDokumen(fields: PaketField[]) {
  const kelompok = new Map<string, PaketField[]>();
  for (const field of fields) {
    const judul = field.dokumenJudul ?? "Dokumen";
    kelompok.set(judul, [...(kelompok.get(judul) ?? []), field]);
  }
  return Array.from(kelompok.entries());
}

function PratinjauPaket({
  dokumen,
  isian,
}: {
  dokumen: PaketDokumen;
  isian: Record<string, string>;
}) {
  const documentHtml = bangunHtmlUnduhanDokumen({
    title: dokumen.judul,
    bodyHtml: bungkusHtmlDokumenTemplate(
      substitusiDokumenPaket(dokumen, isian),
      { dokumenId: dokumen.id },
    ),
    finalCss: cssDenganLayoutDokumenTemplate(dokumen.layout),
  });
  return (
    <PagedDocumentPreview
      key={dokumen.id}
      documentHtml={documentHtml}
      className="h-full min-h-[480px] rounded-md border"
      testId="preview-paket-dokumen"
    />
  );
}

function opsiUnduhanDokumenPaket(
  dokumen: PaketDokumen,
  isian: Record<string, string>,
  namaSanggar: string,
): OpsiUnduhanDokumen {
  return {
    title: `${dokumen.judul} — ${namaSanggar}`,
    fileName: `${dokumen.judul} - ${namaSanggar}`,
    bodyHtml: bungkusHtmlDokumenTemplate(
      substitusiDokumenPaket(dokumen, isian),
      { dokumenId: dokumen.id },
    ),
    finalCss: cssDenganLayoutDokumenTemplate(dokumen.layout),
  };
}

function opsiUnduhanPaketLengkap(
  data: PaketData,
  isian: Record<string, string>,
  namaSanggar: string,
): OpsiUnduhanDokumen {
  const jedaHalaman =
    '<div style="height:0;break-before:page;page-break-before:always"></div>';
  return {
    title: `Paket Dokumen ${data.label} — ${namaSanggar}`,
    fileName: `Paket Dokumen Kelembagaan dan Administrasi - ${namaSanggar}`,
    bodyHtml: data.dokumen
      .map((dokumen) =>
        bungkusHtmlDokumenTemplate(
          substitusiDokumenPaket(dokumen, isian),
          { dokumenId: dokumen.id },
        ),
      )
      .join(jedaHalaman),
    finalCss: cssDenganLayoutDokumenTemplate(data.dokumen[0]?.layout),
  };
}

export function PaketDokumenCard({
  sg,
  bentukId,
}: {
  sg: SanggarUser;
  bentukId: BentukKedudukanId;
}) {
  const db = useDb();
  const { toast } = useToast();
  const daftarPaket = paketUntukBentuk(bentukId);
  const [paketPilihan, setPaketPilihan] = useState<string | null>(null);
  const paket: PaketInfo | undefined =
    daftarPaket.find((p) => p.paketId === paketPilihan) ?? daftarPaket[0];

  const [data, setData] = useState<PaketData | null>(null);
  const [gagal, setGagal] = useState<string | null>(null);

  const [dokAktif, setDokAktif] = useState<PaketDokumen | null>(null);
  const [modeFormulir, setModeFormulir] = useState<ModeFormulir | null>(null);
  const [tampilanDialog, setTampilanDialog] = useState<
    "formulir" | "pratinjau"
  >("formulir");
  const [dokPratinjauId, setDokPratinjauId] = useState<string | null>(null);
  const [bagianTerbuka, setBagianTerbuka] = useState<Record<string, boolean>>(
    {},
  );
  const [isianForm, setIsianForm] = useState<Record<string, string>>({});
  const [validasiDiminta, setValidasiDiminta] = useState(false);
  const [mengunduh, setMengunduh] =
    useState<FormatUnduhanDokumen | null>(null);

  // Tanpa useMemo: save() menyalin dangkal objek db sehingga referensi
  // db.paketIsian tidak berubah — memo akan basi setelah simpan.
  const kunciIsian = paket ? `${sg.id}:${paket.paketId}` : "";
  const isianTersimpan: Record<string, string> = kunciIsian
    ? (db.paketIsian[kunciIsian] ?? {})
    : {};

  useEffect(() => {
    if (!paket) return;
    let batal = false;
    setData(null);
    setGagal(null);
    fetchPaket(paket.paketId)
      .then((d) => {
        if (!batal) setData(d);
      })
      .catch(() => {
        if (!batal)
          setGagal(
            "Paket dokumen gagal dimuat. Periksa koneksi lalu coba lagi.",
          );
      });
    return () => {
      batal = true;
    };
  }, [paket?.paketId]);

  if (!paket) return null;

  const buatIsianAwal = (fields: PaketField[]): Record<string, string> => {
    const prefill = prefillPaketDariProfil(sg);
    const awal: Record<string, string> = {};
    for (const field of fields) {
      const nilaiBaru = isianTersimpan[field.key];
      const nilaiLama =
        field.perBaris && field.kemunculan === 1
          ? isianTersimpan[field.token]
          : undefined;
      const tersimpan = nilaiBaru ?? nilaiLama;
      awal[field.key] =
        tersimpan !== undefined && tersimpan.trim() !== ""
          ? tersimpan
          : field.perBaris
            ? ""
            : (prefill[field.token] ?? "");
    }
    return awal;
  };

  const bukaFormulir = (dok: PaketDokumen) => {
    setIsianForm(buatIsianAwal(fieldDokumenPaket(dok)));
    setDokAktif(dok);
    setDokPratinjauId(dok.id);
    setBagianTerbuka({});
    setValidasiDiminta(false);
    setTampilanDialog("formulir");
    setModeFormulir("dokumen");
  };

  const bukaFormulirPaket = () => {
    if (!data) return;
    setIsianForm(buatIsianAwal(fieldPaket(data)));
    setDokAktif(null);
    setDokPratinjauId(data.dokumen[0]?.id ?? null);
    setBagianTerbuka({});
    setValidasiDiminta(false);
    setTampilanDialog("formulir");
    setModeFormulir("paket");
  };

  const tutupFormulir = () => {
    setDokAktif(null);
    setTampilanDialog("formulir");
    setModeFormulir(null);
  };

  const simpanIsian = async (): Promise<boolean> => {
    try {
      save((d) => {
        const ada = d.paketIsian[kunciIsian] ?? {};
        d.paketIsian[kunciIsian] = { ...ada, ...isianForm };
      });
      await waitForServer();
      return true;
    } catch {
      toast({
        title: "Isian tidak tersimpan",
        description: "Belum dikonfirmasi server. Periksa koneksi lalu simpan kembali.",
        variant: "destructive",
      });
      return false;
    }
  };

  const simpan = async () => {
    if (await simpanIsian()) {
      toast({
        title: "Isian tersimpan",
        description: "Berlaku untuk seluruh dokumen dalam paket ini.",
      });
      tutupFormulir();
    }
  };

  // Isian tersimpan menang; token kosong diisi dari profil agar review dan
  // unduhan selalu memakai data yang sama.
  const isianSiapPakai = (): Record<string, string> => {
    const gab = { ...prefillPaketDariProfil(sg) };
    for (const [k, v] of Object.entries(isianTersimpan)) {
      if (v.trim() !== "") gab[k] = v;
    }
    return gab;
  };

  const unduhDariForm = async (format: FormatUnduhanDokumen) => {
    if (!data || !dokPratinjau) return;
    const isianUntukUnduhan = { ...isianSiapPakai(), ...isianForm };
    const dokumenYangDiunduh =
      modeFormulir === "paket" ? data.dokumen : [dokPratinjau];
    const hasilSemua = dokumenYangDiunduh.map((dokumen) => ({
      dokumen,
      hasil: validasiIsianDokumen(
        fieldWajibDokumenPaket(dokumen).map(fieldUntukValidasi),
        isianUntukUnduhan,
      ),
    }));
    const gagalPertama = hasilSemua.find(({ hasil }) => !hasil.lengkap);
    if (gagalPertama) {
      const tokenPertama = gagalPertama.hasil.fieldBermasalah[0]?.key;
      setDokPratinjauId(gagalPertama.dokumen.id);
      setValidasiDiminta(true);
      setBagianTerbuka(
        Object.fromEntries(bagianForm.map((bagian) => [bagian.id, true])),
      );
      window.setTimeout(
        () =>
          tokenPertama &&
          document.getElementById(domIdFieldPaket(tokenPertama))?.focus(),
        0,
      );
      toast({
        title: "Dokumen belum siap diunduh",
        description: `Periksa ${ringkasFieldKosong(gagalPertama.hasil.fieldBermasalah)} pada ${gagalPertama.dokumen.judul}.`,
        variant: "destructive",
      });
      return;
    }

    if (!(await simpanIsian())) return;
    setMengunduh(format);
    try {
      const opsi =
        modeFormulir === "paket"
          ? opsiUnduhanPaketLengkap(data, isianUntukUnduhan, sg.namaSanggar)
          : opsiUnduhanDokumenPaket(
              dokPratinjau,
              isianUntukUnduhan,
              sg.namaSanggar,
            );
      await unduhDokumen(format, opsi);
      logActivity(sg.id, "sanggar", "dokumen-paket-unduh", {
        paket: paket.paketId,
        dokumen:
          modeFormulir === "paket" ? "paket-lengkap" : dokPratinjau.id,
        format,
      });
      toast({
        title: `${format === "word" ? "Word" : "PDF"} berhasil diunduh`,
        description:
          "Untuk mencetak, buka berkas hasil unduhan di Microsoft Office atau aplikasi PDF.",
      });
    } catch {
      toast({
        title: "Unduhan gagal dibuat",
        description: "Coba kembali setelah halaman selesai memuat.",
        variant: "destructive",
      });
    } finally {
      setMengunduh(null);
    }
  };

  const fieldsPaket = data ? fieldPaket(data) : [];
  const dokPratinjau =
    data?.dokumen.find((dok) => dok.id === dokPratinjauId) ??
    dokAktif ??
    data?.dokumen[0] ??
    null;
  const fieldsForm =
    modeFormulir === "paket"
      ? fieldsPaket
      : dokAktif
        ? fieldDokumenPaket(dokAktif)
        : [];
  const bagianForm = kelompokkanField(fieldsForm);
  const isianPratinjau = { ...isianSiapPakai(), ...isianForm };
  const terisiPaket = fieldsPaket.filter(
    (field) => nilaiFieldPaket(field, isianSiapPakai()).trim() !== "",
  ).length;
  const validasiPratinjau = dokPratinjau
    ? validasiIsianDokumen(
        fieldWajibDokumenPaket(dokPratinjau).map(fieldUntukValidasi),
        isianPratinjau,
      )
    : null;
  const fieldBermasalah = new Set(
    validasiPratinjau?.fieldBermasalah.map((field) => field.key) ?? [],
  );

  return (
    <Card data-testid="card-paket-dokumen">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-primary" />
          Paket Dokumen Resmi ({paket.label})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Rangkaian dokumen administrasi lengkap sesuai bentuk &amp; kedudukan
          yang dipilih di atas. Isian formulir dibagi bersama seluruh dokumen
          dalam satu paket — data yang sama cukup diisi sekali.
        </p>

        {daftarPaket.length > 1 && (
          <div className="space-y-1.5 max-w-sm">
            <Label htmlFor="select-varian-paket">Varian badan/organisasi</Label>
            <select
              id="select-varian-paket"
              value={paket.paketId}
              onChange={(event) => setPaketPilihan(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="select-varian-paket"
            >
              {daftarPaket.map((p) => (
                <option
                  key={p.paketId}
                  value={p.paketId}
                  data-testid={`option-varian-${p.paketId}`}
                >
                  {p.variantLabel ?? p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {gagal ? (
          <p
            className="text-sm text-destructive"
            data-testid="text-paket-gagal"
          >
            {gagal}
          </p>
        ) : !data ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="text-paket-memuat"
          >
            Memuat paket dokumen…
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Formulir data bersama</p>
                <p className="text-xs text-muted-foreground">
                  {terisiPaket}/{fieldsPaket.length} data paket terisi. Data
                  profil dan rekening yang tersedia sudah diisikan otomatis.
                </p>
              </div>
              <Button
                size="sm"
                onClick={bukaFormulirPaket}
                data-testid="button-isi-seluruh-paket"
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Buat Paket
              </Button>
            </div>
            {data.dokumen.map((dok, i) => {
              const pr = progresDokumenPaket(dok, isianSiapPakai());
              const lengkap = validasiIsianDokumen(
                fieldWajibDokumenPaket(dok).map(fieldUntukValidasi),
                isianSiapPakai(),
              ).lengkap;
              return (
                <div
                  key={dok.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`row-paket-dok-${dok.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {i + 1}. {dok.judul}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pr.total === 0 ? (
                        "Tanpa isian — siap direview"
                      ) : (
                        <>
                          Isian terisi {pr.terisi}/{pr.total}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pr.total > 0 && (
                      <Badge
                        variant={lengkap ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {lengkap ? "Lengkap" : "Belum lengkap"}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant={lengkap ? "default" : "outline"}
                      onClick={() => bukaFormulir(dok)}
                      data-testid={`button-review-paket-${dok.id}`}
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      Buat
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={modeFormulir !== null}
        onOpenChange={(o) => !o && tutupFormulir()}
      >
        <DialogContent className="flex h-[92vh] max-h-[920px] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden">
          {modeFormulir && data && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {modeFormulir === "paket"
                    ? "Formulir Data Bersama Paket"
                    : dokAktif?.judul}
                </DialogTitle>
                <DialogDescription>
                  {tampilanDialog === "formulir"
                    ? `${paket.label}. Lengkapi formulir, lalu tekan Preview untuk melihat dokumen yang sedang dibuat.`
                    : "Pratinjau besar menampilkan satu dokumen aktif dalam lembar kertas terpisah."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden py-2">
                {tampilanDialog === "formulir" && (
                <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto pr-1">
                  {bagianForm.map((bagian, index) => (
                    <details
                      key={bagian.id}
                      className="rounded-lg border bg-background"
                      open={
                        bagianTerbuka[bagian.id] ??
                        (index === 0 || modeFormulir === "dokumen")
                      }
                      onToggle={(e) =>
                        setBagianTerbuka((sebelumnya) => ({
                          ...sebelumnya,
                          [bagian.id]: e.currentTarget.open,
                        }))
                      }
                    >
                      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium marker:hidden">
                        <div className="flex items-center justify-between gap-2">
                          <span>{bagian.judul}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {bagian.fields.length} kolom
                          </Badge>
                        </div>
                      </summary>
                      <div className="grid gap-3 border-t p-3">
                        {bagian.id === "tabel" && modeFormulir === "paket"
                          ? kelompokFieldPerDokumen(bagian.fields).map(
                              ([judul, fields]) => (
                                <details
                                  key={judul}
                                  className="rounded-md border bg-muted/20"
                                >
                                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">
                                    {judul} · {fields.length} isian tabel
                                  </summary>
                                  <div className="grid gap-3 border-t bg-background p-3 sm:grid-cols-2">
                                    {fields.map((field) => (
                                      <FieldPaketItem
                                        key={field.key}
                                        field={field}
                                        nilai={isianForm[field.key] ?? ""}
                                        invalid={
                                          validasiDiminta &&
                                          fieldBermasalah.has(field.key)
                                        }
                                        onChange={(v) =>
                                          setIsianForm((n) => ({
                                            ...n,
                                            [field.key]: v,
                                          }))
                                        }
                                      />
                                    ))}
                                  </div>
                                </details>
                              ),
                            )
                          : bagian.fields.map((field) => (
                              <FieldPaketItem
                                key={field.key}
                                field={field}
                                nilai={isianForm[field.key] ?? ""}
                                invalid={
                                  validasiDiminta &&
                                  fieldBermasalah.has(field.key)
                                }
                                tampilkanDokumen={modeFormulir === "paket"}
                                onChange={(v) =>
                                  setIsianForm((n) => ({
                                    ...n,
                                    [field.key]: v,
                                  }))
                                }
                              />
                            ))}
                      </div>
                    </details>
                  ))}
                </div>
                )}
                {tampilanDialog === "pratinjau" && (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Pratinjau dokumen aktif</p>
                  </div>
                  {data.dokumen.length > 1 && (
                    <select
                      value={dokPratinjau?.id}
                      onChange={(event) =>
                        setDokPratinjauId(event.target.value)
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      data-testid="select-preview-paket"
                    >
                      {data.dokumen.map((dok) => (
                        <option key={dok.id} value={dok.id}>
                          {dok.judul}
                        </option>
                      ))}
                    </select>
                  )}
                  {dokPratinjau ? (
                    <PratinjauPaket
                      dokumen={dokPratinjau}
                      isian={isianPratinjau}
                    />
                  ) : (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Belum ada dokumen yang dapat dipratinjau.
                    </p>
                  )}
                </div>
                )}
              </div>
              {tampilanDialog === "formulir" &&
                validasiPratinjau &&
                !validasiPratinjau.lengkap && (
                <p
                  className="text-xs text-amber-700 dark:text-amber-300"
                  data-testid="peringatan-paket-belum-valid"
                >
                  Dokumen pratinjau belum siap diunduh. Periksa{" "}
                  {ringkasFieldKosong(validasiPratinjau.fieldBermasalah)}.
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={tutupFormulir}
                  data-testid="button-batal-paket"
                >
                  Batal
                </Button>
                <Button
                  variant="outline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    setTampilanDialog((tampilan) =>
                      tampilan === "formulir" ? "pratinjau" : "formulir",
                    )
                  }
                  data-testid="button-preview-paket"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  <span className={tampilanDialog === "formulir" ? "" : "hidden"}>Preview</span>
                  <span className={tampilanDialog === "pratinjau" ? "" : "hidden"}>Kembali ke Formulir</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={simpan}
                  data-testid="button-simpan-paket"
                >
                  Simpan Isian
                </Button>
                <Button
                  variant="outline"
                  disabled={!dokPratinjau || mengunduh !== null}
                  onClick={() => void unduhDariForm("word")}
                  data-testid="button-unduh-word-paket"
                >
                  {mengunduh === "word" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {mengunduh === "word"
                    ? "Membuat Word…"
                    : modeFormulir === "paket"
                      ? "Unduh Paket Word"
                      : "Unduh Word"}
                </Button>
                <Button
                  disabled={!dokPratinjau || mengunduh !== null}
                  onClick={() => void unduhDariForm("pdf")}
                  data-testid="button-unduh-pdf-paket"
                >
                  {mengunduh === "pdf" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {mengunduh === "pdf"
                    ? "Membuat PDF…"
                    : modeFormulir === "paket"
                      ? "Unduh Paket PDF"
                      : "Unduh PDF"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
