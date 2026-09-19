// =============================================================
// Halaman alur layanan Konsumen dan pengadaan Mitra:
//   - SewaItemDetail   : detail item katalog + form buat pesanan
//   - SewaPesananList  : daftar pesanan milik penyewa
//   - SewaPesananDetail: detail kontrak + tombol Setuju, bayar, dsb.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp } from "@/lib/store";
import {
  getKatalogItem,
  MAX_BUKTI_PEMBAYARAN_BYTES,
  SATUAN_LABEL,
} from "@/lib/kerjasama";
import {
  AKOMODASI_LABEL,
  KONDISI_PENGEMBALIAN_LABEL,
  MAX_BUKTI_SERAH_TERIMA_BYTES,
  STATUS_PEMESANAN_LABEL,
  STATUS_PEMESANAN_COLOR,
  defaultAkomodasi,
  hitungTotal,
  listPemesananForActor,
  createPemesanan,
  tandaTangan,
  batalkanPemesanan,
  uploadBuktiBayar,
  ajukanPengembalianSewa,
  memerlukanPengembalianSewa,
  pihakWajib,
  sudahTtd,
  namaPihak,
  progressTtd,
} from "@/lib/sewa-flow";
import { layananBasePath, pemesanLabel } from "@/lib/role-paths";
import {
  downloadDokumenPemesananSewa,
  nomorKwitansiPemesananSewa,
} from "@/lib/dokumen-perdagangan";
import type { JenisDokumenTransaksi } from "@/lib/dokumen-transaksi-template";
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
  Building2,
  MapPin,
  ShoppingBag,
  ArrowRight,
  Calendar as CalendarIcon,
  Receipt,
  FileSignature,
  Upload,
  CheckCircle2,
  XCircle,
  Banknote,
  FileText,
} from "lucide-react";
import type {
  AkomodasiMode,
  MitraPengrajinUser,
  PelatihUser,
  PemesananSewa,
  PihakSewa,
  SanggarUser,
  SewaUser,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

type PemesanKatalog = SewaUser | MitraPengrajinUser;

function isPemesanKatalog(user: unknown): user is PemesanKatalog {
  if (!user || typeof user !== "object" || !("role" in user)) return false;
  const role = (user as { role?: string }).role;
  return role === "sewa" || role === "mitra_pengrajin";
}

// ============= DETAIL ITEM + FORM PESAN =============

export function SewaItemDetail() {
  const { user } = useAuth();
  const db = useDb();
  const [, navigate] = useLocation();
  const [matchKonsumen, konsumenParams] = useRoute("/konsumen/item/:id");
  const [matchMitra, mitraParams] = useRoute("/mitra/layanan/item/:id");
  const { toast } = useToast();
  const itemId = matchKonsumen
    ? (konsumenParams?.id ?? "")
    : matchMitra
      ? (mitraParams?.id ?? "")
      : "";
  const item = useMemo(
    () => getKatalogItem(itemId),
    [itemId, db.users, db.aset, db.sarpras],
  );

  const def = useMemo(
    () =>
      item
        ? defaultAkomodasi(item)
        : { mode: "diluar" as AkomodasiMode, biaya: 0 },
    [item],
  );

  const [tanggalMulai, setTanggalMulai] = useState(todayStr());
  const [tanggalSelesai, setTanggalSelesai] = useState(todayStr());
  const [lokasi, setLokasi] = useState("");
  const [jumlah, setJumlah] = useState(1);
  const [catatan, setCatatan] = useState("");
  const [setujuTujuan, setSetujuTujuan] = useState(false);
  const [akom, setAkom] = useState<AkomodasiMode>(def.mode);
  const [biaya, setBiaya] = useState(def.biaya);

  useEffect(() => {
    const current = todayStr();
    setTanggalMulai(current);
    setTanggalSelesai(current);
    setLokasi("");
    setJumlah(1);
    setCatatan("");
    setSetujuTujuan(false);
    setAkom(def.mode);
    setBiaya(def.biaya);
  }, [itemId, item?.id]);

  if (!isPemesanKatalog(user)) return null;
  const pemesan = user;
  const basePath = layananBasePath(pemesan.role);
  if (!item) {
    return (
      <div>
        <PageHeader title="Item tidak ditemukan" backTo={basePath} />
        <Card className="p-8 text-center text-muted-foreground">
          Item katalog tidak ditemukan atau sudah dihapus.
        </Card>
      </div>
    );
  }

  const total = hitungTotal({
    hargaDasar: item.hargaSewa,
    jumlah,
    akomodasiPP: akom,
    biayaAkomodasi: biaya,
  });

  function submit() {
    if (!item) return;
    if (pemesan.role === "sewa" && !setujuTujuan) {
      toast({
        title: "Konfirmasi tujuan transaksi",
        description:
          "Konsumen wajib menyatakan bahwa layanan digunakan sendiri dan tidak untuk dijual kembali.",
        variant: "destructive",
      });
      return;
    }
    const r = createPemesanan({
      katalog: item,
      sewaId: pemesan.id,
      tanggalMulai,
      tanggalSelesai,
      lokasi,
      jumlah,
      catatan,
      akomodasiPP: akom,
      biayaAkomodasi: biaya,
      actor: { id: pemesan.id, role: pemesan.role },
    });
    if (!r.ok || !r.pemesanan) {
      toast({
        title: "Gagal membuat pesanan",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Pesanan terkirim",
      description: `Nomor ${r.pemesanan.nomor} menunggu konfirmasi sanggar.`,
    });
    navigate(`${basePath}/pesanan/${r.pemesanan.id}`);
  }

  return (
    <div>
      <PageHeader
        title={item.judul}
        subtitle={`Penyedia: ${item.sanggarNama}`}
        back
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="overflow-hidden lg:col-span-1">
          {item.fotoDataUrl ? (
            <img
              src={item.fotoDataUrl}
              className="w-full h-56 object-cover"
              alt=""
            />
          ) : (
            <div className="w-full h-56 bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-primary/40">
              <ShoppingBag className="h-10 w-10" />
            </div>
          )}
          <div className="p-4 space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {item.sanggarNama}
            </div>
            <div className="text-sm">{item.deskripsi}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {item.jenisKesenian.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px]">
                  {k}
                </Badge>
              ))}
            </div>
            <div className="pt-3 border-t mt-3">
              <div className="text-xs text-muted-foreground">Harga Dasar</div>
              <div className="text-xl font-semibold text-primary">
                {fmtRp(item.hargaSewa)}{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  {SATUAN_LABEL[item.satuanHarga]}
                </span>
              </div>
              <Badge
                variant="outline"
                className={`mt-2 text-[10px] ${item.akomodasiPP === "termasuk" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}
              >
                Default: {AKOMODASI_LABEL[item.akomodasiPP]}
                {item.akomodasiPP === "diluar" &&
                  item.biayaAkomodasi > 0 &&
                  ` (+${fmtRp(item.biayaAkomodasi)})`}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2 space-y-3">
          <div className="font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Form Pemesanan
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                min={todayStr()}
                value={tanggalMulai}
                onChange={(e) => {
                  const next = e.target.value;
                  setTanggalMulai(next);
                  if (tanggalSelesai < next) setTanggalSelesai(next);
                }}
                data-testid="input-tgl-mulai"
              />
            </div>
            <div>
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                min={tanggalMulai || todayStr()}
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                data-testid="input-tgl-selesai"
              />
            </div>
          </div>
          <div>
            <Label>Lokasi Acara</Label>
            <Input
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Alamat lengkap acara"
              data-testid="input-lokasi"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jumlah ({SATUAN_LABEL[item.satuanHarga]})</Label>
              <Input
                type="number"
                min={1}
                value={jumlah}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setJumlah(Number.isFinite(next) ? Math.max(1, next) : 1);
                }}
                data-testid="input-jumlah"
              />
            </div>
            <div>
              <Label>Akomodasi PP</Label>
              <Select
                value={akom}
                onValueChange={(v) => setAkom(v as AkomodasiMode)}
              >
                <SelectTrigger data-testid="select-akomodasi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="termasuk">
                    Termasuk akomodasi PP
                  </SelectItem>
                  <SelectItem value="diluar">Di luar akomodasi PP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Biaya Akomodasi (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={biaya}
              disabled={akom === "termasuk"}
              onChange={(e) => setBiaya(Math.max(0, Number(e.target.value)))}
              data-testid="input-biaya-akomodasi"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Default dari sanggar: {AKOMODASI_LABEL[def.mode]}
              {def.mode === "diluar" &&
                def.biaya > 0 &&
                ` — ${fmtRp(def.biaya)}`}
            </p>
          </div>
          <div>
            <Label>Catatan untuk Penyedia (opsional)</Label>
            <Textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              data-testid="input-catatan"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            {pemesan.role === "sewa" ? (
              <>
                <input
                  type="checkbox"
                  checked={setujuTujuan}
                  onChange={(event) => setSetujuTujuan(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                  data-testid="check-tujuan-konsumen"
                />
                <span>
                  Saya memesan untuk penggunaan sendiri/pribadi atau kebutuhan
                  organisasi dan tidak untuk dijual kembali.
                </span>
              </>
            ) : (
              <span>
                Tujuan transaksi: pengadaan oleh Mitra untuk kerja sama,
                penyewaan, atau dijual kembali melalui kanal milik Mitra.
              </span>
            )}
          </label>
          <div className="rounded-md bg-muted/40 p-3 mt-2 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">
                Estimasi Total
              </div>
              <div
                className="text-2xl font-semibold text-primary"
                data-testid="text-total"
              >
                {fmtRp(total)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                ({fmtRp(item.hargaSewa)} × {jumlah})
                {akom === "diluar" &&
                  biaya > 0 &&
                  ` + akomodasi ${fmtRp(biaya)}`}
              </div>
            </div>
            <Button
              onClick={submit}
              className="gap-2"
              data-testid="button-pesan"
            >
              Kirim Pesanan <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============= LIST PESANAN PENYEWA =============

export function SewaPesananList() {
  const { user } = useAuth();
  const db = useDb();
  if (!isPemesanKatalog(user)) return null;
  const basePath = layananBasePath(user.role);
  const list = useMemo(
    () => listPemesananForActor({ id: user.id, role: user.role }),
    [db.pemesananSewa, user.id, user.role],
  );

  return (
    <div>
      <PageHeader
        title="Pesanan Saya"
        subtitle="Pantau alur pemesanan sampai pelaksanaan, pengembalian objek sewa, dan BAST final."
        backTo={basePath}
      />
      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <div className="mb-3">
            Belum ada pesanan. Telusuri katalog dan klik item yang ingin
            dipesan.
          </div>
          <Button asChild>
            <Link href={basePath}>Buka Katalog</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <PesananRow key={p.id} p={p} basePath={basePath} />
          ))}
        </div>
      )}
    </div>
  );
}

function PesananRow({ p, basePath }: { p: PemesananSewa; basePath: string }) {
  const prog = progressTtd(p);
  return (
    <Link href={`${basePath}/pesanan/${p.id}`}>
      <Card
        className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-all"
        data-testid={`row-pesanan-${p.id}`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-medium leading-tight">{p.judul}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {p.nomor} · {p.tanggalMulai}
              {p.tanggalSelesai !== p.tanggalMulai
                ? ` → ${p.tanggalSelesai}`
                : ""}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {p.lokasi}
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
            {p.status === "menunggu_ttd" && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                TTD {prog.selesai}/{prog.total}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ============= DETAIL PESANAN (PENYEWA) =============

export function SewaPesananDetail() {
  const { user } = useAuth();
  const [matchKonsumen, konsumenParams] = useRoute("/konsumen/pesanan/:id");
  const [matchMitra, mitraParams] = useRoute("/mitra/layanan/pesanan/:id");
  const db = useDb();
  if (!isPemesanKatalog(user)) return null;
  const basePath = layananBasePath(user.role);
  const id = matchKonsumen
    ? (konsumenParams?.id ?? "")
    : matchMitra
      ? (mitraParams?.id ?? "")
      : "";
  const p = db.pemesananSewa.find((x) => x.id === id);
  if (!p) {
    return (
      <div>
        <PageHeader
          title="Pesanan tidak ditemukan"
          backTo={`${basePath}/pesanan`}
        />
        <Card className="p-8 text-center text-muted-foreground">
          Pesanan tidak ditemukan.
        </Card>
      </div>
    );
  }
  if (p.sewaId !== user.id || (p.pemesanRole ?? "sewa") !== user.role) {
    return (
      <div>
        <PageHeader title="Akses ditolak" backTo={`${basePath}/pesanan`} />
        <Card className="p-8 text-center text-muted-foreground">
          Anda tidak memiliki akses ke pesanan ini.
        </Card>
      </div>
    );
  }
  return <PesananDetailView p={p} actorRole="sewa" />;
}

// =====================================================================
// VIEW UMUM detail pesanan — dipakai oleh sewa, sanggar, dan SDM dengan
// aksi yang berbeda berdasarkan `actorRole`.
// =====================================================================
export function PesananDetailView({
  p,
  actorRole,
}: {
  p: PemesananSewa;
  actorRole: "sewa" | "sanggar" | "sdm";
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const db = useDb();
  const { toast } = useToast();
  const [showBatal, setShowBatal] = useState(false);
  const [showBayar, setShowBayar] = useState(false);
  const [bayarNominal, setBayarNominal] = useState(p.nilaiTotal);
  const [bayarTgl, setBayarTgl] = useState(todayStr());
  const [bayarBukti, setBayarBukti] = useState<string | undefined>();
  const [showPengembalian, setShowPengembalian] = useState(false);
  const [catatanPengembalian, setCatatanPengembalian] = useState("");
  const [buktiPengembalian, setBuktiPengembalian] = useState<
    string | undefined
  >();
  if (!user) return null;

  const wajib = pihakWajib(p);
  const inv = p.invoiceId
    ? db.invoices.find((i) => i.id === p.invoiceId)
    : undefined;
  const contract = db.contracts.find((c) => c.kerjasamaId === p.id);
  const bast = p.bastId ? db.bast.find((b) => b.id === p.bastId) : undefined;
  const payments = inv ? db.payments.filter((x) => x.invoiceId === inv.id) : [];
  const perluPengembalian = memerlukanPengembalianSewa(p);
  const penyediaDokumen = db.users.find(
    (item): item is SanggarUser | PelatihUser =>
      item.id === p.sanggarId &&
      (item.role === "sanggar" || item.role === "pelatih"),
  );
  const pemesanDokumen = db.users.find(
    (item): item is SewaUser | MitraPengrajinUser =>
      item.id === p.sewaId &&
      (item.role === "sewa" || item.role === "mitra_pengrajin"),
  );

  function unduhDokumen(jenis: JenisDokumenTransaksi) {
    if (!penyediaDokumen || !pemesanDokumen) {
      toast({
        title: "Data para pihak belum lengkap",
        description: "Profil penyedia atau pemesan tidak ditemukan.",
        variant: "destructive",
      });
      return;
    }
    try {
      downloadDokumenPemesananSewa(
        jenis,
        p,
        penyediaDokumen,
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

  const myPihak: PihakSewa | null =
    actorRole === "sewa" && p.sewaId === user.id
      ? "sewa"
      : actorRole === "sanggar" && p.sanggarId === user.id
        ? "sanggar"
        : actorRole === "sdm" && p.sdmUserId === user.id
          ? "sdm"
          : null;

  function doSign() {
    const r = tandaTangan({
      id: p.id,
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
  function doBatal() {
    const r = batalkanPemesanan(p.id, { id: user!.id, role: user!.role });
    if (!r.ok) {
      toast({
        title: "Gagal batalkan",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Pesanan dibatalkan dan dihapus" });
    setShowBatal(false);
    if (user?.role === "sewa" || user?.role === "mitra_pengrajin") {
      navigate(`${layananBasePath(user.role)}/pesanan`);
    }
  }
  async function doUploadBukti() {
    const r = uploadBuktiBayar({
      pemesananId: p.id,
      nominal: bayarNominal,
      tanggalBayar: new Date(bayarTgl).getTime(),
      buktiDataUrl: bayarBukti,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal kirim bukti bayar",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Bukti bayar terkirim",
      description: "Menunggu verifikasi sanggar.",
    });
    setShowBayar(false);
  }
  function doAjukanPengembalian() {
    const r = ajukanPengembalianSewa({
      pemesananId: p.id,
      catatan: catatanPengembalian,
      buktiDataUrl: buktiPengembalian,
      actor: { id: user!.id, role: user!.role },
    });
    if (!r.ok) {
      toast({
        title: "Gagal mengajukan pengembalian",
        description: r.reason,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Pengembalian diajukan",
      description:
        "Menunggu penyedia memeriksa kondisi dan menerima pengembalian.",
    });
    setShowPengembalian(false);
    setCatatanPengembalian("");
    setBuktiPengembalian(undefined);
  }

  return (
    <div>
      <PageHeader
        title={`Pesanan ${p.nomor}`}
        subtitle={p.judul}
        backTo={
          actorRole === "sewa"
            ? `${layananBasePath(user.role)}/pesanan`
            : actorRole === "sanggar"
              ? "/sanggar/permintaan-sewa"
              : `/${user.role}/penugasan-sewa`
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
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
              <div className="col-span-2 rounded bg-muted/40 p-2">
                <div className="text-xs text-muted-foreground">
                  Tujuan transaksi
                </div>
                <div className="font-medium">
                  {(p.tujuanTransaksi ??
                    ((p.pemesanRole ?? "sewa") === "mitra_pengrajin"
                      ? "dijual_kembali"
                      : "penggunaan_sendiri")) === "dijual_kembali"
                    ? "Pengadaan Mitra untuk dijual/disalurkan kembali"
                    : "Penggunaan sendiri oleh Konsumen"}
                </div>
              </div>
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
                  <div className="text-xs text-muted-foreground">Catatan</div>
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

          {/* Kontrak / TTD */}
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
            <p className="text-xs text-muted-foreground mb-3">
              Kontrak menjadi aktif setelah {wajib.length} pihak menekan tombol{" "}
              <span className="font-medium">Setuju</span>.
            </p>
            <div className="space-y-2">
              {wajib.map((pihak) => {
                const ttd = p.ttd.find((t) => t.pihak === pihak);
                const labelMap: Record<PihakSewa, string> = {
                  sewa: pemesanLabel(p.pemesanRole ?? "sewa"),
                  sanggar: "Sanggar Penyedia",
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
                      ) : myPihak === pihak && p.status === "menunggu_ttd" ? (
                        <Button
                          size="sm"
                          onClick={doSign}
                          data-testid={`button-setuju-${pihak}`}
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

          {/* Invoice */}
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
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Riwayat Pembayaran:
                  </div>
                  {payments.map((pay) => (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between text-xs border rounded p-2"
                    >
                      <div>
                        <div>
                          {fmtRp(pay.nominal)} ·{" "}
                          {new Date(pay.tanggalBayar).toLocaleDateString(
                            "id-ID",
                          )}
                        </div>
                        {pay.catatanVerifikator && (
                          <div className="text-muted-foreground">
                            Catatan: {pay.catatanVerifikator}
                          </div>
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
                  ))}
                </div>
              )}
              {actorRole === "sewa" &&
                p.status === "menunggu_bayar" &&
                !payments.some(
                  (x) => x.status === "menunggu" || x.status === "disetujui",
                ) && (
                  <div className="mt-3">
                    <Button
                      onClick={() => setShowBayar((s) => !s)}
                      className="gap-2"
                      data-testid="button-toggle-bayar"
                    >
                      <Banknote className="h-4 w-4" />{" "}
                      {showBayar ? "Tutup Form Bayar" : "Kirim Bukti Bayar"}
                    </Button>
                    {showBayar && (
                      <div className="mt-3 space-y-2 border rounded p-3 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Nominal (Rp)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={bayarNominal}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                setBayarNominal(
                                  Number.isFinite(next) ? Math.max(1, next) : 1,
                                );
                              }}
                              data-testid="input-bayar-nominal"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tanggal Bayar</Label>
                            <Input
                              type="date"
                              max={todayStr()}
                              value={bayarTgl}
                              onChange={(e) => setBayarTgl(e.target.value)}
                              data-testid="input-bayar-tgl"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Bukti Pembayaran (gambar)
                          </Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              if (!/^image\/(png|jpeg|webp)$/i.test(f.type)) {
                                toast({
                                  title: "Format tidak didukung",
                                  description:
                                    "Gunakan gambar JPG, PNG, atau WebP.",
                                  variant: "destructive",
                                });
                                e.target.value = "";
                                return;
                              }
                              if (f.size > MAX_BUKTI_PEMBAYARAN_BYTES) {
                                toast({
                                  title: "Ukuran terlalu besar",
                                  description:
                                    "Bukti pembayaran maksimal 2 MB.",
                                  variant: "destructive",
                                });
                                e.target.value = "";
                                return;
                              }
                              const url = await fileToDataUrl(f);
                              setBayarBukti(url);
                            }}
                            data-testid="input-bayar-bukti"
                          />
                          {bayarBukti && (
                            <img
                              src={bayarBukti}
                              className="mt-2 h-24 rounded border object-cover"
                              alt=""
                            />
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={doUploadBukti}
                          className="gap-2"
                          data-testid="button-kirim-bayar"
                        >
                          <Upload className="h-4 w-4" /> Kirim Bukti
                        </Button>
                      </div>
                    )}
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
                Pesanan tetap aktif sampai penyedia menerima pengembalian dan
                memfinalkan BAST.
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
                      Menunggu penyerahan dari penyedia.
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
                      Belum diajukan.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* BAST */}
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
              <div className="text-sm">
                Status:{" "}
                <Badge
                  variant={bast.status === "final" ? "default" : "secondary"}
                >
                  {bast.status}
                </Badge>
              </div>
              {bast.finalAt && (
                <div className="text-xs text-muted-foreground mt-1">
                  Difinalkan: {new Date(bast.finalAt).toLocaleString("id-ID")}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Aksi sidebar */}
        <div>
          <Card className="p-4 space-y-2">
            <div className="font-medium text-sm">Aksi</div>
            {actorRole === "sewa" &&
              ["menunggu_sanggar", "menunggu_sdm", "menunggu_ttd"].includes(
                p.status,
              ) && (
                <>
                  {!showBatal ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowBatal(true)}
                      data-testid="button-batal"
                    >
                      <XCircle className="h-4 w-4" /> Batalkan Pesanan
                    </Button>
                  ) : (
                    <div className="rounded border p-2 space-y-2">
                      <p className="text-xs">
                        Pesanan akan dibatalkan permanen. Lanjutkan?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={doBatal}
                          data-testid="button-batal-confirm"
                        >
                          Batalkan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowBatal(false)}
                        >
                          Tidak
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            {actorRole === "sewa" &&
              perluPengembalian &&
              p.status === "lunas" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Pembayaran sudah lunas. Menunggu penyedia mencatat penyerahan
                  barang atau akses tempat.
                </div>
              )}

            {actorRole === "sewa" &&
              perluPengembalian &&
              p.status === "sedang_disewa" && (
                <div className="space-y-2">
                  {p.pengembalianSewa?.status === "perlu_tindak_lanjut" &&
                    p.pengembalianSewa.catatanPenyedia && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                        Tindak lanjut dari penyedia:{" "}
                        <strong>{p.pengembalianSewa.catatanPenyedia}</strong>
                      </div>
                    )}
                  <Button
                    variant={showPengembalian ? "outline" : "default"}
                    className="w-full"
                    onClick={() => setShowPengembalian((current) => !current)}
                    data-testid="button-toggle-pengembalian"
                  >
                    {showPengembalian
                      ? "Tutup Form Pengembalian"
                      : "Ajukan Pengembalian / Selesai Pemakaian"}
                  </Button>
                  {showPengembalian && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <div>
                        <Label className="text-xs">
                          Catatan kondisi dan kelengkapan
                        </Label>
                        <Textarea
                          rows={3}
                          value={catatanPengembalian}
                          onChange={(event) =>
                            setCatatanPengembalian(event.target.value)
                          }
                          placeholder="Jelaskan jumlah, kondisi, kelengkapan, atau penyerahan kembali akses/kunci"
                          data-testid="input-catatan-pengembalian"
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
                            setBuktiPengembalian(await fileToDataUrl(file));
                          }}
                          data-testid="input-bukti-pengembalian"
                        />
                      </div>
                      <Button
                        className="w-full gap-2"
                        onClick={doAjukanPengembalian}
                        data-testid="button-ajukan-pengembalian"
                      >
                        <Upload className="h-4 w-4" /> Kirim Pengajuan
                        Pengembalian
                      </Button>
                    </div>
                  )}
                </div>
              )}

            {actorRole === "sewa" &&
              p.status === "menunggu_konfirmasi_pengembalian" && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800">
                  Pengembalian sudah diajukan. Menunggu pemeriksaan dan
                  konfirmasi penyedia.
                </div>
              )}

            {actorRole === "sewa" && p.status === "dikembalikan" && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800">
                Pengembalian telah diterima penyedia. Menunggu finalisasi BAST
                agar transaksi dinyatakan selesai.
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
