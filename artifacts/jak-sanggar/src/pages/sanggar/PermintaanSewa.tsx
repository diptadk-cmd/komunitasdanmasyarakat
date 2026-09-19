// =============================================================
// Halaman SANGGAR untuk menangani permintaan dari penyewa eksternal:
//   - PermintaanSewaMasuk : daftar pesanan masuk
//   - PermintaanSewaDetail: detail + aksi (assign SDM, terima/tolak,
//                           setuju, terbitkan invoice, verifikasi bayar,
//                           finalisasi BAST)
// =============================================================
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp } from "@/lib/store";
import { SATUAN_LABEL } from "@/lib/kerjasama";
import {
  STATUS_PEMESANAN_LABEL,
  STATUS_PEMESANAN_COLOR,
  AKOMODASI_LABEL,
  KONDISI_PENGEMBALIAN_LABEL,
  MAX_BUKTI_SERAH_TERIMA_BYTES,
  listPemesananForActor,
  terimaPemesanan,
  tolakPemesanan,
  terbitkanInvoice,
  verifikasiPembayaran,
  konfirmasiPenyerahanSewa,
  verifikasiPengembalianSewa,
  memerlukanPengembalianSewa,
  finalkanBast,
  pihakWajib,
  namaPihak,
  tandaTangan,
} from "@/lib/sewa-flow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  FileSignature,
  Receipt,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar as CalendarIcon,
  Inbox,
  UserCheck,
} from "lucide-react";
import type {
  MitraPengrajinUser,
  KondisiPengembalianSewa,
  PelatihUser,
  PemesananSewa,
  PihakSewa,
  SanggarUser,
  SenimanUser,
  SewaUser,
} from "@/lib/types";
import { pemesanLabel } from "@/lib/role-paths";
import {
  downloadDokumenPemesananSewa,
  nomorKwitansiPemesananSewa,
} from "@/lib/dokumen-perdagangan";
import type { JenisDokumenTransaksi } from "@/lib/dokumen-transaksi-template";
import { useToast } from "@/hooks/use-toast";

function todayStr() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PermintaanSewaMasuk() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || (user.role !== "sanggar" && user.role !== "pelatih"))
    return null;
  const privateProvider = user.role === "pelatih";
  const basePath = privateProvider
    ? "/pelatih/kelas-privat"
    : "/sanggar/permintaan-sewa";
  const list = useMemo(
    () =>
      listPemesananForActor({ id: user.id, role: user.role })
        .filter((item) =>
          privateProvider
            ? item.penyediaRole === "pelatih" && item.sanggarId === user.id
            : (item.penyediaRole ?? "sanggar") === "sanggar",
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [db.pemesananSewa, user.id, user.role, privateProvider],
  );

  const tabs: {
    key: "aktif" | "selesai" | "ditolak";
    label: string;
    filter: (p: PemesananSewa) => boolean;
  }[] = [
    {
      key: "aktif",
      label: "Aktif",
      filter: (p) => !["selesai", "ditolak", "batal"].includes(p.status),
    },
    { key: "selesai", label: "Selesai", filter: (p) => p.status === "selesai" },
    {
      key: "ditolak",
      label: "Ditolak/Batal",
      filter: (p) => p.status === "ditolak" || p.status === "batal",
    },
  ];
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("aktif");
  const tabList = list.filter(tabs.find((t) => t.key === tab)!.filter);

  return (
    <div>
      <PageHeader
        title={
          privateProvider ? "Pesanan Kelas Privat" : "Permintaan Layanan Masuk"
        }
        subtitle={
          privateProvider
            ? "Pesanan langsung dari Konsumen atau Mitra untuk kelas privat Anda."
            : "Kelola pesanan sampai pelaksanaan, pengembalian objek sewa, pemeriksaan kondisi, dan BAST final."
        }
      />
      <div className="flex gap-2 mb-3">
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={t.key === tab ? "default" : "outline"}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
          >
            {t.label} ({list.filter(t.filter).length})
          </Button>
        ))}
      </div>
      {tabList.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Belum ada permintaan pada kategori ini.
        </Card>
      ) : (
        <div className="space-y-2">
          {tabList.map((p) => (
            <Link key={p.id} href={`${basePath}/${p.id}`}>
              <Card
                className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-all"
                data-testid={`row-permintaan-${p.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium leading-tight">{p.judul}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.nomor} · {pemesanLabel(p.pemesanRole ?? "sewa")}:{" "}
                      {namaPihak(p, "sewa")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> {p.tanggalMulai} →{" "}
                      {p.tanggalSelesai}
                      <MapPin className="h-3 w-3 ml-2" /> {p.lokasi}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={STATUS_PEMESANAN_COLOR[p.status]}
                    >
                      {STATUS_PEMESANAN_LABEL[p.status]}
                    </Badge>
                    <div className="text-sm font-semibold text-primary mt-1">
                      {fmtRp(p.nilaiTotal)}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PermintaanSewaDetail() {
  const { user } = useAuth();
  const db = useDb();
  const [matchSanggar, sanggarParams] = useRoute(
    "/sanggar/permintaan-sewa/:id",
  );
  const [matchPelatih, pelatihParams] = useRoute("/pelatih/kelas-privat/:id");
  const { toast } = useToast();
  const [alasan, setAlasan] = useState("");
  const [showTolak, setShowTolak] = useState(false);
  const [assignId, setAssignId] = useState<string>("");
  const [dueDays, setDueDays] = useState(7);
  const [verCatatan, setVerCatatan] = useState("");
  const [serahCatatan, setSerahCatatan] = useState("");
  const [serahBukti, setSerahBukti] = useState<string | undefined>();
  const [kondisiKembali, setKondisiKembali] =
    useState<KondisiPengembalianSewa>("baik");
  const [catatanPemeriksaan, setCatatanPemeriksaan] = useState("");
  if (!user || (user.role !== "sanggar" && user.role !== "pelatih"))
    return null;
  const privateProvider = user.role === "pelatih";
  const basePath = privateProvider
    ? "/pelatih/kelas-privat"
    : "/sanggar/permintaan-sewa";

  const id = matchSanggar
    ? (sanggarParams?.id ?? "")
    : matchPelatih
      ? (pelatihParams?.id ?? "")
      : "";
  const p = db.pemesananSewa.find((x) => x.id === id);
  if (!p) {
    return (
      <div>
        <PageHeader title="Pesanan tidak ditemukan" backTo={basePath} />
        <Card className="p-8 text-center text-muted-foreground">
          Pesanan tidak ditemukan.
        </Card>
      </div>
    );
  }
  if (p.sanggarId !== user.id || (p.penyediaRole ?? "sanggar") !== user.role) {
    return (
      <div>
        <PageHeader title="Akses ditolak" backTo={basePath} />
        <Card className="p-8 text-center text-muted-foreground">
          Pesanan ini bukan milik sanggar Anda.
        </Card>
      </div>
    );
  }

  const sg = user.role === "sanggar" ? (user as SanggarUser) : null;
  const isSdm =
    !privateProvider &&
    (p.sumberType === "sdm-pelatih" || p.sumberType === "sdm-seniman");
  const wajib = pihakWajib(p);
  const inv = p.invoiceId
    ? db.invoices.find((i) => i.id === p.invoiceId)
    : undefined;
  const contract = db.contracts.find((c) => c.kerjasamaId === p.id);
  const bast = p.bastId ? db.bast.find((b) => b.id === p.bastId) : undefined;
  const payments = inv ? db.payments.filter((x) => x.invoiceId === inv.id) : [];
  const perluPengembalian = memerlukanPengembalianSewa(p);
  const pendingPay = payments.find((pay) => pay.status === "menunggu");
  const pemesanDokumen = db.users.find(
    (item): item is SewaUser | MitraPengrajinUser =>
      item.id === p.sewaId &&
      (item.role === "sewa" || item.role === "mitra_pengrajin"),
  );

  // Daftar SDM untuk assign (jika sumber SDM tanpa target spesifik).
  const sdmOptions: Array<{ id: string; label: string }> = [];
  for (const u of db.users) {
    if (u.role === "pelatih" || u.role === "seniman") {
      const m = u as PelatihUser | SenimanUser;
      if (sg && m.sanggarId === sg.id && m.status === "aktif") {
        sdmOptions.push({
          id: m.id,
          label: `${m.nama} (${u.role}, ${m.jenisKesenian})`,
        });
      }
    }
  }

  function doTerima() {
    const r = terimaPemesanan({
      id: p!.id,
      assignSdmUserId: assignId || undefined,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal terima",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Pesanan diterima" });
  }
  function doTolak() {
    if (!alasan.trim()) {
      toast({ title: "Isi alasan", variant: "destructive" });
      return;
    }
    const r = tolakPemesanan(p!.id, alasan, { id: user!.id, role: user!.role });
    if (!r.ok) {
      toast({
        title: "Gagal tolak",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Pesanan ditolak" });
    setShowTolak(false);
  }
  function doSign() {
    const r = tandaTangan({
      id: p!.id,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal tanda tangan",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Tanda tangan tersimpan",
      description: r.semuaTtd
        ? "Semua pihak sudah setuju — kontrak aktif."
        : "Menunggu pihak lain.",
    });
  }
  function doInvoice() {
    const r = terbitkanInvoice(p!.id, dueDays, {
      id: user!.id,
      role: user!.role,
    });
    if (!r.ok) {
      toast({
        title: "Gagal terbitkan invoice",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Invoice diterbitkan", description: r.invoice?.nomor });
  }
  function doVerifikasi(terima: boolean) {
    if (!pendingPay) return;
    const r = verifikasiPembayaran({
      pemesananId: p!.id,
      paymentId: pendingPay.id,
      terima,
      catatan: verCatatan || undefined,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal verifikasi",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({ title: terima ? "Pembayaran disetujui" : "Pembayaran ditolak" });
    setVerCatatan("");
  }
  function doPenyerahan() {
    const r = konfirmasiPenyerahanSewa({
      pemesananId: p!.id,
      catatan: serahCatatan,
      buktiDataUrl: serahBukti,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal mencatat penyerahan",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Penyerahan tercatat",
      description:
        "Pesanan tetap aktif sampai pengembalian diperiksa dan diterima.",
    });
    setSerahCatatan("");
    setSerahBukti(undefined);
  }
  function doVerifikasiPengembalian(terima: boolean) {
    const r = verifikasiPengembalianSewa({
      pemesananId: p!.id,
      terima,
      kondisi: terima ? kondisiKembali : undefined,
      catatan: catatanPemeriksaan,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal memeriksa pengembalian",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: terima
        ? "Pengembalian diterima"
        : "Pengembalian memerlukan tindak lanjut",
      description: terima
        ? "BAST pengembalian sekarang dapat difinalkan."
        : "Pesanan tetap berstatus sedang disewa sampai diajukan kembali.",
    });
    setCatatanPemeriksaan("");
  }
  function doBast() {
    const r = finalkanBast(p!.id, { id: user!.id, role: user!.role });
    if (!r.ok) {
      toast({
        title: "Gagal BAST",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "BAST difinalkan", description: r.bast?.nomor });
  }

  function unduhDokumen(jenis: JenisDokumenTransaksi) {
    if (!pemesanDokumen) {
      toast({
        title: "Profil pemesan tidak ditemukan",
        description:
          "Dokumen belum dapat dibuat karena data pemesan tidak lengkap.",
        variant: "destructive",
      });
      return;
    }
    try {
      downloadDokumenPemesananSewa(
        jenis,
        p!,
        user as SanggarUser | PelatihUser,
        pemesanDokumen,
        "dokumenusaha",
        {
          invoice: inv,
          pembayaran: payments,
          kontrakNomor: contract?.nomor,
          bast,
        },
      );
    } catch (error) {
      toast({
        title: "Dokumen belum dapat dipratinjau",
        description:
          error instanceof Error
            ? error.message
            : "Data dokumen belum lengkap.",
        variant: "destructive",
      });
    }
  }

  const myTtd = p.ttd.find((t) => t.pihak === "sanggar");

  return (
    <div>
      <PageHeader
        title={`Pesanan ${p.nomor}`}
        subtitle={`${p.judul} — ${pemesanLabel(p.pemesanRole ?? "sewa")}: ${namaPihak(p, "sewa")}`}
        backTo={basePath}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Ringkasan */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge
                variant="outline"
                className={STATUS_PEMESANAN_COLOR[p.status]}
                data-testid="badge-status"
              >
                {STATUS_PEMESANAN_LABEL[p.status]}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {new Date(p.createdAt).toLocaleString("id-ID")}
              </div>
            </div>
            {p.alasanTolak && (
              <div className="rounded bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 text-xs p-2 border border-rose-200">
                Alasan: {p.alasanTolak}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm pt-2 border-t mt-2">
              <div>
                <div className="text-xs text-muted-foreground">Tanggal</div>
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> {p.tanggalMulai} →{" "}
                  {p.tanggalSelesai}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lokasi</div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {p.lokasi}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Jumlah</div>
                <div>
                  {p.jumlah} {SATUAN_LABEL[p.satuanHarga]}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Akomodasi PP
                </div>
                <div>
                  {AKOMODASI_LABEL[p.akomodasiPP]}
                  {p.akomodasiPP === "diluar" &&
                    ` — ${fmtRp(p.biayaAkomodasi)}`}
                </div>
              </div>
              {p.catatan && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">
                    Catatan Penyewa
                  </div>
                  <div className="whitespace-pre-wrap">{p.catatan}</div>
                </div>
              )}
            </div>
            <div className="rounded bg-muted/40 p-3 mt-2 flex items-center justify-between">
              <div className="text-sm">
                <div>
                  {fmtRp(p.hargaDasar)} × {p.jumlah}
                  {p.akomodasiPP === "diluar" &&
                    p.biayaAkomodasi > 0 &&
                    ` + ${fmtRp(p.biayaAkomodasi)}`}
                </div>
              </div>
              <div className="text-xl font-semibold text-primary">
                {fmtRp(p.nilaiTotal)}
              </div>
            </div>
          </Card>

          {/* Kontrak */}
          {p.status !== "menunggu_sanggar" && p.status !== "menunggu_sdm" && (
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium flex items-center gap-2">
                  <FileSignature className="h-4 w-4" /> Kontrak Para Pihak
                  {contract && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {contract.nomor}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => unduhDokumen("kontrak")}
                >
                  <FileText className="h-3.5 w-3.5" /> Preview Kontrak
                </Button>
              </div>
              <div className="space-y-2">
                {wajib.map((pihak) => {
                  const ttd = p.ttd.find((t) => t.pihak === pihak);
                  const labelMap: Record<PihakSewa, string> = {
                    sewa: pemesanLabel(p.pemesanRole ?? "sewa"),
                    sanggar: privateProvider
                      ? "Pelatih Privat"
                      : "Sanggar Penyedia",
                    sdm: "Seniman / Pelatih",
                  };
                  return (
                    <div
                      key={pihak}
                      className="flex items-center justify-between rounded border p-2.5"
                    >
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {labelMap[pihak]}
                        </div>
                        <div className="text-sm font-medium">
                          {namaPihak(p, pihak)}
                        </div>
                        {ttd && (
                          <div className="text-[10px] text-muted-foreground">
                            TTD: {new Date(ttd.ts).toLocaleString("id-ID")}
                          </div>
                        )}
                      </div>
                      <div>
                        {ttd ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Sudah Setuju
                          </Badge>
                        ) : pihak === "sanggar" &&
                          p.status === "menunggu_ttd" ? (
                          <Button
                            size="sm"
                            onClick={doSign}
                            data-testid="button-setuju-sanggar"
                          >
                            Setuju
                          </Button>
                        ) : (
                          <Badge variant="secondary">Menunggu</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Invoice + Pembayaran */}
          {inv && (
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Invoice {inv.nomor}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unduhDokumen("invoice")}
                  >
                    Preview Invoice
                  </Button>
                  {inv.status === "lunas" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unduhDokumen("kwitansi")}
                    >
                      Preview {nomorKwitansiPemesananSewa(inv).split("/")[0]}
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Total: </span>
                  {fmtRp(inv.total)}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">
                    Status:{" "}
                  </span>
                  {inv.status}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  Batas bayar:{" "}
                  {new Date(inv.batasPembayaran).toLocaleDateString("id-ID")}
                </div>
              </div>
              {payments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Riwayat Pembayaran:
                  </div>
                  {payments.map((pay) => (
                    <div
                      key={pay.id}
                      className="border rounded p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          {fmtRp(pay.nominal)} ·{" "}
                          {new Date(pay.tanggalBayar).toLocaleDateString(
                            "id-ID",
                          )}
                        </div>
                        <Badge
                          variant={
                            pay.status === "disetujui"
                              ? "default"
                              : pay.status === "ditolak"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {pay.status}
                        </Badge>
                      </div>
                      {pay.buktiDataUrl && (
                        <img
                          src={pay.buktiDataUrl}
                          className="h-24 rounded border object-contain mt-1"
                          alt=""
                        />
                      )}
                      {pay.catatanVerifikator && (
                        <div className="text-muted-foreground">
                          Catatan: {pay.catatanVerifikator}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {pendingPay && (
                <div className="mt-3 border rounded p-3 bg-muted/30 space-y-2">
                  <div className="text-sm font-medium">
                    Verifikasi Pembayaran
                  </div>
                  <div>
                    <Label className="text-xs">Catatan (opsional)</Label>
                    <Textarea
                      rows={2}
                      value={verCatatan}
                      onChange={(e) => setVerCatatan(e.target.value)}
                      data-testid="input-verifikasi-catatan"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => doVerifikasi(true)}
                      className="gap-1"
                      data-testid="button-verifikasi-terima"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Setujui Pembayaran
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => doVerifikasi(false)}
                      className="gap-1"
                      data-testid="button-verifikasi-tolak"
                    >
                      <XCircle className="h-4 w-4" /> Tolak
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {perluPengembalian && (
            <Card className="p-4 space-y-3">
              <div className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Kontrol Penyerahan dan
                Pengembalian
              </div>
              <p className="text-xs text-muted-foreground">
                Transaksi objek sewa tetap aktif sampai pengembalian diterima,
                kondisi dicatat, dan BAST difinalkan.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Penyerahan / Akses
                  </div>
                  {p.penyerahanSewa ? (
                    <div className="mt-2 space-y-1">
                      <Badge
                        variant="outline"
                        className="bg-sky-50 text-sky-700"
                      >
                        Sudah diserahkan
                      </Badge>
                      <p>
                        {new Date(p.penyerahanSewa.diserahkanAt).toLocaleString(
                          "id-ID",
                        )}
                      </p>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {p.penyerahanSewa.catatan}
                      </p>
                      {p.penyerahanSewa.buktiDataUrl && (
                        <img
                          src={p.penyerahanSewa.buktiDataUrl}
                          className="mt-2 h-28 rounded border object-contain"
                          alt="Bukti penyerahan objek sewa"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-muted-foreground">
                      Belum diserahkan.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pengembalian / Selesai Pemakaian
                  </div>
                  {p.pengembalianSewa ? (
                    <div className="mt-2 space-y-1">
                      <Badge
                        variant="outline"
                        className={
                          p.pengembalianSewa.status === "diterima"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.pengembalianSewa.status ===
                                "perlu_tindak_lanjut"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-violet-50 text-violet-700"
                        }
                      >
                        {p.pengembalianSewa.status.replaceAll("_", " ")}
                      </Badge>
                      <p>
                        Diajukan{" "}
                        {new Date(p.pengembalianSewa.diajukanAt).toLocaleString(
                          "id-ID",
                        )}
                      </p>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {p.pengembalianSewa.catatanPenyewa}
                      </p>
                      {p.pengembalianSewa.buktiDataUrl && (
                        <img
                          src={p.pengembalianSewa.buktiDataUrl}
                          className="mt-2 h-28 rounded border object-contain"
                          alt="Bukti pengembalian objek sewa"
                        />
                      )}
                      {p.pengembalianSewa.kondisi && (
                        <p>
                          Kondisi:{" "}
                          <strong>
                            {
                              KONDISI_PENGEMBALIAN_LABEL[
                                p.pengembalianSewa.kondisi
                              ]
                            }
                          </strong>
                        </p>
                      )}
                      {p.pengembalianSewa.catatanPenyedia && (
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          Catatan penyedia: {p.pengembalianSewa.catatanPenyedia}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-muted-foreground">
                      Belum ada pengajuan pengembalian.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {bast && (
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" /> BAST {bast.nomor}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unduhDokumen("bast")}
                >
                  Preview BAST
                </Button>
              </div>
              <Badge
                variant={bast.status === "final" ? "default" : "secondary"}
              >
                {bast.status}
              </Badge>
              {bast.finalAt && (
                <div className="text-xs text-muted-foreground mt-1">
                  Difinalkan: {new Date(bast.finalAt).toLocaleString("id-ID")}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar Aksi */}
        <div className="space-y-3">
          <Card className="p-4 space-y-2">
            <div className="font-medium text-sm">Aksi</div>

            {p.status === "menunggu_sanggar" && (
              <>
                {isSdm && !p.sdmUserId && (
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Tugaskan
                    </Label>
                    <Select value={assignId} onValueChange={setAssignId}>
                      <SelectTrigger data-testid="select-assign-sdm">
                        <SelectValue placeholder="Pilih anggota" />
                      </SelectTrigger>
                      <SelectContent>
                        {sdmOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {p.sumberType === "aset" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Stok otomatis tersedia kembali hanya jika kondisi baik.
                        Aset rusak tetap tidak tersedia sampai diperbaiki dan
                        diperbarui oleh Sanggar.
                      </p>
                    )}
                  </div>
                )}
                {isSdm && p.sdmUserId && (
                  <div className="text-xs text-muted-foreground">
                    Sudah otomatis ditugaskan ke{" "}
                    <span className="font-medium">{namaPihak(p, "sdm")}</span>.
                  </div>
                )}
                <Button
                  onClick={doTerima}
                  className="w-full gap-2"
                  data-testid="button-terima"
                >
                  <CheckCircle2 className="h-4 w-4" /> Terima Pesanan
                </Button>
                {!showTolak ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowTolak(true)}
                    data-testid="button-toggle-tolak"
                  >
                    <XCircle className="h-4 w-4" /> Tolak
                  </Button>
                ) : (
                  <div className="border rounded p-2 space-y-2">
                    <Label className="text-xs">Alasan Penolakan</Label>
                    <Textarea
                      rows={2}
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      data-testid="input-alasan-tolak"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={doTolak}
                        data-testid="button-tolak-confirm"
                      >
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowTolak(false)}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {p.status === "menunggu_sdm" && (
              <div className="text-xs text-muted-foreground">
                Menunggu konfirmasi dari{" "}
                <span className="font-medium">{namaPihak(p, "sdm")}</span>.
              </div>
            )}

            {p.status === "menunggu_ttd" && !myTtd && (
              <Button
                onClick={doSign}
                className="w-full"
                data-testid="button-setuju-sidebar"
              >
                Setuju Kontrak
              </Button>
            )}

            {p.status === "kontrak_aktif" && (
              <div className="space-y-2">
                <Label className="text-xs">Tenggat Bayar (hari)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={dueDays}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setDueDays(
                      Number.isFinite(next)
                        ? Math.min(365, Math.max(1, Math.trunc(next)))
                        : 1,
                    );
                  }}
                  data-testid="input-due-days"
                />
                <Button
                  onClick={doInvoice}
                  className="w-full gap-2"
                  data-testid="button-terbitkan-invoice"
                >
                  <Receipt className="h-4 w-4" /> Terbitkan Invoice
                </Button>
              </div>
            )}

            {p.status === "lunas" && perluPengembalian && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-sm font-medium">
                  Konfirmasi Penyerahan / Akses
                </div>
                <p className="text-xs text-muted-foreground">
                  Stok aset berkurang setelah penyerahan dicatat. Pesanan belum
                  selesai sampai dikembalikan.
                </p>
                <div>
                  <Label className="text-xs">Catatan penyerahan</Label>
                  <Textarea
                    rows={3}
                    value={serahCatatan}
                    onChange={(event) => setSerahCatatan(event.target.value)}
                    placeholder="Kondisi, jumlah, kelengkapan, atau akses yang diserahkan"
                    data-testid="input-catatan-penyerahan"
                  />
                </div>
                <div>
                  <Label className="text-xs">Foto bukti (opsional)</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
                        toast({
                          title: "Format tidak didukung",
                          description: "Gunakan JPG, PNG, atau WebP.",
                          variant: "destructive",
                        });
                        event.target.value = "";
                        return;
                      }
                      if (file.size > MAX_BUKTI_SERAH_TERIMA_BYTES) {
                        toast({
                          title: "Ukuran terlalu besar",
                          description: "Foto bukti maksimal 2 MB.",
                          variant: "destructive",
                        });
                        event.target.value = "";
                        return;
                      }
                      setSerahBukti(await fileToDataUrl(file));
                    }}
                    data-testid="input-bukti-penyerahan"
                  />
                </div>
                <Button
                  onClick={doPenyerahan}
                  className="w-full gap-2"
                  data-testid="button-konfirmasi-penyerahan"
                >
                  <CheckCircle2 className="h-4 w-4" /> Konfirmasi Sudah
                  Diserahkan
                </Button>
              </div>
            )}

            {p.status === "lunas" && !perluPengembalian && (
              <div className="space-y-2">
                <Button
                  disabled={p.tanggalSelesai > todayStr()}
                  onClick={doBast}
                  className="w-full gap-2"
                  data-testid="button-finalkan-bast"
                >
                  <FileText className="h-4 w-4" /> Finalisasi BAST
                </Button>
                {p.tanggalSelesai > todayStr() && (
                  <p className="text-xs text-muted-foreground">
                    BAST dapat difinalkan setelah {p.tanggalSelesai}.
                  </p>
                )}
              </div>
            )}

            {p.status === "sedang_disewa" && perluPengembalian && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                Objek sedang berada pada penyewa. Menunggu pengajuan
                pengembalian atau pernyataan selesai pemakaian.
                {p.pengembalianSewa?.status === "perlu_tindak_lanjut" &&
                  p.pengembalianSewa.catatanPenyedia && (
                    <p className="mt-2 font-medium">
                      Tindak lanjut terakhir:{" "}
                      {p.pengembalianSewa.catatanPenyedia}
                    </p>
                  )}
              </div>
            )}

            {p.status === "menunggu_konfirmasi_pengembalian" &&
              perluPengembalian && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="text-sm font-medium">
                    Pemeriksaan Pengembalian
                  </div>
                  <div>
                    <Label className="text-xs">Kondisi saat diterima</Label>
                    <Select
                      value={kondisiKembali}
                      onValueChange={(value) =>
                        setKondisiKembali(value as KondisiPengembalianSewa)
                      }
                    >
                      <SelectTrigger data-testid="select-kondisi-pengembalian">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(KONDISI_PENGEMBALIAN_LABEL).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">
                      Catatan pemeriksaan / alasan tindak lanjut
                    </Label>
                    <Textarea
                      rows={3}
                      value={catatanPemeriksaan}
                      onChange={(event) =>
                        setCatatanPemeriksaan(event.target.value)
                      }
                      data-testid="input-catatan-pemeriksaan"
                    />
                  </div>
                  <Button
                    onClick={() => doVerifikasiPengembalian(true)}
                    className="w-full gap-2"
                    data-testid="button-terima-pengembalian"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Terima Pengembalian
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => doVerifikasiPengembalian(false)}
                    className="w-full"
                    data-testid="button-tindak-lanjut-pengembalian"
                  >
                    Perlu Tindak Lanjut
                  </Button>
                </div>
              )}

            {p.status === "dikembalikan" && perluPengembalian && (
              <div className="space-y-2">
                <Button
                  onClick={doBast}
                  className="w-full gap-2"
                  data-testid="button-finalkan-bast-pengembalian"
                >
                  <FileText className="h-4 w-4" /> Finalisasi BAST Pengembalian
                </Button>
                <p className="text-xs text-muted-foreground">
                  Pengembalian telah diterima. Transaksi baru selesai setelah
                  BAST difinalkan.
                </p>
              </div>
            )}

            {["selesai", "ditolak", "batal"].includes(p.status) && (
              <div className="text-xs text-muted-foreground">
                Pesanan sudah final.
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Status terakhir diperbarui{" "}
              {new Date(p.updatedAt).toLocaleString("id-ID")}.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
