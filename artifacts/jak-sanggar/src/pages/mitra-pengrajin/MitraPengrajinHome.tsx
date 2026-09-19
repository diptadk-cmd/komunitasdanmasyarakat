import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Download,
  ExternalLink,
  FileCheck2,
  FileSignature,
  ReceiptText,
  PackageCheck,
  Plus,
  Save,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { save } from "@/lib/store";
import { publicContentApi, uploadsApi, usersApi } from "@/lib/api";
import type {
  AlamatTerstruktur,
  DokumenPengrajin,
  JenisDokumenPengrajin,
  MekanismePembayaranProduk,
  MarketplaceMitra,
  MetodePengirimanProduk,
  MitraPengrajinUser,
  PaketProdukMitra,
  PengrajinUser,
  PesananProdukPengrajin,
} from "@/lib/types";
import { RegionSelector } from "@/components/RegionSelector";
import { ShareLocation } from "@/components/system/ShareLocation";
import { formatAlamatWilayah, type AlamatWilayah } from "@/lib/regions";
import {
  STATUS_PESANAN_PRODUK,
  batalkanPesananProduk,
  buatPesananDariPaket,
  buatPesananProduk,
  katalogProdukMitra,
  sahkanBastProduk,
  setujuiOngkirProduk,
  tandaTanganiKontrakProduk,
  unggahBuktiPembayaranProduk,
  unggahDokumenPajakProduk,
} from "@/lib/perdagangan-pengrajin";
import {
  labelMetodePembayaran,
  labelMetodePengiriman,
  sisaPembayaran,
  totalPembayaranTerverifikasi,
} from "@/lib/kebijakan-transaksi";
import { downloadDokumenPesananProduk } from "@/lib/dokumen-perdagangan";
import { ekspedisiUntukMetode } from "@/lib/pengiriman";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardWelcome, DashboardMetrics, DashboardLinks } from "@/components/layout/RoleWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  unduhProfilDokumen,
  type DataProfilDokumen,
} from "@/lib/profil-dokumen";
import type { FormatUnduhanDokumen } from "@/lib/dokumen-export";

type Section = "dashboard" | "katalog" | "pesanan" | "profil";

const DOKUMEN_VERIFIKASI_TOKO_MITRA: JenisDokumenPengrajin[] = [
  "NIB",
  "Surat Domisili 5 Tahun RT/RW",
  "Surat Domisili Kelurahan JAKEVO/PTSP",
];

function wilayahLengkap(wilayah?: AlamatTerstruktur): boolean {
  return Boolean(
    wilayah?.provinsiId &&
    wilayah.kotaId &&
    wilayah.kecamatanId &&
    wilayah.kelurahanId,
  );
}

function enamBulanSebelum(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - 6;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function tomorrow(days = 14) {
  const value = new Date(Date.now() + days * 86400000);
  return value.toISOString().slice(0, 10);
}

function KetentuanTransaksi({
  metodePengiriman,
  onMetodePengiriman,
  mekanismePembayaran,
  onMekanismePembayaran,
  dpPersen,
  onDpPersen,
  jatuhTempoHari,
  onJatuhTempoHari,
  setujuPembayaran,
  onSetujuPembayaran,
  setujuPajak,
  onSetujuPajak,
  keteranganOngkir,
}: {
  metodePengiriman: MetodePengirimanProduk;
  onMetodePengiriman: (value: MetodePengirimanProduk) => void;
  mekanismePembayaran: MekanismePembayaranProduk;
  onMekanismePembayaran: (value: MekanismePembayaranProduk) => void;
  dpPersen: number;
  onDpPersen: (value: number) => void;
  jatuhTempoHari: number;
  onJatuhTempoHari: (value: number) => void;
  setujuPembayaran: boolean;
  onSetujuPembayaran: (value: boolean) => void;
  setujuPajak: boolean;
  onSetujuPajak: (value: boolean) => void;
  keteranganOngkir: string;
}) {
  const pilihanPengantaran = ekspedisiUntukMetode(metodePengiriman);

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Metode Pengiriman</Label>
          <Select
            value={metodePengiriman}
            onValueChange={(value) =>
              onMetodePengiriman(value as MetodePengirimanProduk)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">
                Instant — prioritas hari ini
              </SelectItem>
              <SelectItem value="same_day">Same Day — multi tujuan</SelectItem>
              <SelectItem value="kurir_paket">
                Kurir Paket — Next Day s.d. 7 hari
              </SelectItem>
              <SelectItem value="kurir_toko">Kurir Toko</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mekanisme Pembayaran</Label>
          <Select
            value={mekanismePembayaran}
            onValueChange={(value) =>
              onMekanismePembayaran(value as MekanismePembayaranProduk)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lunas">Bayar lunas</SelectItem>
              <SelectItem value="dp">Down payment (DP)</SelectItem>
              <SelectItem value="setelah_barang_diterima">
                Bayar setelah barang diterima
              </SelectItem>
              <SelectItem value="cod">COD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mekanismePembayaran === "dp" && (
          <Field
            label="DP (%)"
            type="number"
            value={String(dpPersen)}
            onChange={(value) =>
              onDpPersen(Math.min(100, Math.max(1, Number(value) || 1)))
            }
          />
        )}
        {mekanismePembayaran === "setelah_barang_diterima" && (
          <Field
            label="Jatuh Tempo Setelah Diterima (hari)"
            type="number"
            value={String(jatuhTempoHari)}
            onChange={(value) =>
              onJatuhTempoHari(Math.max(0, Number(value) || 0))
            }
          />
        )}
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <strong>Ketentuan ongkir:</strong> {keteranganOngkir}
      </div>
      <div className="rounded-lg border bg-background p-3">
        <div className="font-medium">Cek Ongkir Jasa Pengantaran</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pilih penyedia yang mendukung{" "}
          {labelMetodePengiriman(metodePengiriman)}. Tarif final mengikuti
          alamat, berat, dimensi, dan armada pada kanal resmi penyedia.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pilihanPengantaran.map((item) =>
            item.cekOngkirUrl ? (
              <Button key={item.id} asChild size="sm" variant="outline">
                <a
                  href={item.cekOngkirUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cek Ongkir {item.nama}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <span
                key={item.id}
                className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground"
              >
                {item.nama} · hitung manual
              </span>
            ),
          )}
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={setujuPembayaran}
          onCheckedChange={(checked) => onSetujuPembayaran(checked === true)}
        />
        <span>
          Saya menyetujui pembayaran langsung ke rekening penjual. Jak Sanggar
          tidak menampung atau meneruskan dana transaksi.
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={setujuPajak}
          onCheckedChange={(checked) => onSetujuPajak(checked === true)}
        />
        <span>
          Saya memahami pajak dipenuhi masing-masing pihak. Faktur Pajak hanya
          dibuat penjual PKP; bukti potong hanya diunggah bila transaksi memang
          menjadi objek pemotongan.
        </span>
      </label>
    </div>
  );
}

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeUrl(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

export default function MitraPengrajinHome({
  section = "dashboard",
}: {
  section?: Section;
}) {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  useEffect(() => {
    if (
      user?.role !== "mitra_pengrajin" ||
      user.statusVerifikasiTokoOffline !== "terverifikasi"
    )
      return;
    let cancelled = false;
    void publicContentApi
      .pengrajin()
      .then((rows) => {
        if (cancelled) return;
        save((data) => {
          for (const row of rows) {
            const apiId = String(row["id"] ?? "");
            if (!apiId) continue;
            const existing = data.users.find(
              (item) => item.apiId === apiId || item.id === `u_api_${apiId}`,
            );
            const profile = row as Record<string, unknown>;
            const publicUser: PengrajinUser = {
              id: `u_api_${apiId}`,
              apiId,
              role: "pengrajin",
              username: `pengrajin-${apiId}`,
              password: "***api***",
              email:
                typeof profile["email"] === "string"
                  ? profile["email"]
                  : undefined,
              noHp:
                typeof profile["noHp"] === "string"
                  ? profile["noHp"]
                  : undefined,
              namaUsaha: String(profile["namaUsaha"] ?? "Pengrajin Jakarta"),
              namaPemilik: String(profile["namaPemilik"] ?? "-"),
              bentukUsaha: (profile["bentukUsaha"] ??
                "Perorangan") as PengrajinUser["bentukUsaha"],
              namaBadanUsaha:
                typeof profile["namaBadanUsaha"] === "string"
                  ? profile["namaBadanUsaha"]
                  : undefined,
              jenisKerajinan: (profile["jenisKerajinan"] ??
                "Kerajinan Lainnya") as PengrajinUser["jenisKerajinan"],
              produkUnggulan: String(profile["produkUnggulan"] ?? "-"),
              produk: Array.isArray(profile["produk"])
                ? (profile["produk"] as PengrajinUser["produk"])
                : [],
              alamat: String(profile["alamat"] ?? "-"),
              wilayah: {},
              lat: Number(profile["lat"] ?? 0),
              lng: Number(profile["lng"] ?? 0),
              npwp: "",
              statusPkp: profile["statusPkp"] === "pkp" ? "pkp" : "non_pkp",
              pemotongPajak: false,
              nib: "",
              rekening: { bank: "BCA", nomor: "", atasNama: "-" },
              dokumen: [],
              tokoDipublikasikan: true,
              menerimaSewaJasa: profile["menerimaSewaJasa"] === true,
              menerimaKerjasama: profile["menerimaKerjasama"] === true,
              deskripsi:
                typeof profile["deskripsi"] === "string"
                  ? profile["deskripsi"]
                  : undefined,
              createdAt: Date.now(),
            };
            if (existing?.role === "pengrajin")
              Object.assign(existing, publicUser, { id: existing.id });
            else data.users.push(publicUser);
          }
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.role]);
  if (!user || user.role !== "mitra_pengrajin") return null;
  const mitra = user as MitraPengrajinUser;
  const current =
    (db.users.find((item) => item.id === mitra.id) as
      | MitraPengrajinUser
      | undefined) ?? mitra;
  const pesanan = db.pesananProdukPengrajin
    .filter((item) => item.mitraId === current.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const verified = current.statusVerifikasiTokoOffline === "terverifikasi";
  const katalog = verified ? katalogProdukMitra() : [];

  if (section === "dashboard") {
    const aktif = pesanan.filter(
      (item) => !["selesai", "ditolak", "batal"].includes(item.status),
    ).length;
    return (
      <div className="role-workspace" data-testid="mitra-home">
        <DashboardWelcome
          role="Ruang mitra"
          title={current.namaUsaha}
          description="Temukan produk khas Jakarta dan kelola pengadaan bersama pengrajin."
          primary={{ href: verified ? "/mitra/katalog" : "/mitra/profil", label: verified ? "Jelajahi katalog pengrajin" : "Periksa profil dan verifikasi" }}
          secondary={{ href: "/mitra/pesanan", label: "Pesanan produk" }}
        />
        <DashboardMetrics items={[
          { label: "Marketplace aktif", value: current.marketplace.filter(item => item.aktif).length, href: "/mitra/profil" },
          { label: "Pengrajin tersedia", value: new Set(katalog.map(item => item.pengrajin.id)).size, href: "/mitra/katalog" },
          { label: "Pesanan berjalan", value: aktif, href: "/mitra/pesanan" },
          { label: "Produk tersedia", value: katalog.length, href: "/mitra/katalog" },
        ]} />
        {!verified && <div className="rw-notice" role="status">Katalog pengadaan tersedia setelah toko Anda terverifikasi. Periksa kelengkapan dan statusnya di Profil Mitra.</div>}
        <DashboardLinks title="Kelola kemitraan" items={[
          { href: "/mitra/katalog", label: "Katalog pengrajin", description: "Temukan produk untuk pengadaan toko Anda.", icon: Store },
          { href: "/mitra/pesanan", label: "Pesanan produk", description: "Pantau kontrak, pembayaran, dan penerimaan produk.", icon: ShoppingCart },
          { href: "/mitra/kerjasama", label: "Kerja sama", description: "Kelola hubungan dan kesepakatan dengan pengrajin.", icon: FileSignature },
        ]} />
        <div className="rw-notice">
            <strong>Penjualan melalui marketplace.</strong> JakSanggar menyimpan katalog,
            kerja sama, kontrak, dan BAST. Transaksi pembeli akhir tidak
            dilakukan di JakSanggar; tombol publik diarahkan ke toko
            marketplace milik Mitra.
        </div>
      </div>
    );
  }
  if (section === "katalog")
    return <KatalogSection mitra={current} katalog={katalog} />;
  if (section === "pesanan")
    return <PesananSection mitra={current} pesanan={pesanan} />;
  return <ProfilSection mitra={current} />;
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

type ItemKeranjang = ReturnType<typeof katalogProdukMitra>[number] & {
  jumlah: number;
};

function KatalogSection({
  mitra,
  katalog,
}: {
  mitra: MitraPengrajinUser;
  katalog: ReturnType<typeof katalogProdukMitra>;
}) {
  const { toast } = useToast();
  const [keranjang, setKeranjang] = useState<ItemKeranjang[]>([]);
  const [produkTambahId, setProdukTambahId] = useState("");
  const [alamat, setAlamat] = useState(mitra.alamat);
  const [target, setTarget] = useState(tomorrow());
  const [metodePengiriman, setMetodePengiriman] =
    useState<MetodePengirimanProduk>("kurir_paket");
  const [mekanismePembayaran, setMekanismePembayaran] =
    useState<MekanismePembayaranProduk>("lunas");
  const [dpPersen, setDpPersen] = useState(30);
  const [jatuhTempoHari, setJatuhTempoHari] = useState(0);
  const [setujuPembayaran, setSetujuPembayaran] = useState(false);
  const [setujuPajak, setSetujuPajak] = useState(false);
  const [catatan, setCatatan] = useState("");

  const pengrajinKeranjang = keranjang[0]?.pengrajin;
  const produkPengrajin = pengrajinKeranjang
    ? katalog.filter((item) => item.pengrajin.id === pengrajinKeranjang.id)
    : [];
  const produkTambahan = produkPengrajin.filter(
    (item) => !keranjang.some((row) => row.produk.id === item.produk.id),
  );
  const subtotal = keranjang.reduce(
    (total, item) => total + item.produk.harga * item.jumlah,
    0,
  );
  const seluruhOngkirTermasuk =
    keranjang.length > 0 &&
    keranjang.every((item) => item.produk.ongkirTermasukHarga === true);

  const tambahBarang = (
    item: ReturnType<typeof katalogProdukMitra>[number],
  ) => {
    if (pengrajinKeranjang && pengrajinKeranjang.id !== item.pengrajin.id) {
      toast({
        title: "Pengrajin berbeda",
        description:
          "Satu transaksi dan satu pengiriman hanya boleh berisi barang dari Pengrajin yang sama.",
        variant: "destructive",
      });
      return;
    }
    setKeranjang((current) => {
      const existing = current.find((row) => row.produk.id === item.produk.id);
      return existing
        ? current.map((row) =>
            row.produk.id === item.produk.id
              ? { ...row, jumlah: row.jumlah + 1 }
              : row,
          )
        : [...current, { ...item, jumlah: 1 }];
    });
    setProdukTambahId("");
  };

  const ubahJumlah = (produkId: string, jumlah: number) => {
    setKeranjang((current) =>
      current.map((item) =>
        item.produk.id === produkId
          ? { ...item, jumlah: Math.max(1, Math.floor(jumlah) || 1) }
          : item,
      ),
    );
  };

  const hapusBarang = (produkId: string) => {
    setKeranjang((current) =>
      current.filter((item) => item.produk.id !== produkId),
    );
    setProdukTambahId("");
  };

  const order = () => {
    if (!pengrajinKeranjang || keranjang.length === 0) return;
    try {
      const result = buatPesananProduk({
        mitra,
        pengrajin: pengrajinKeranjang,
        items: keranjang.map((item) => ({
          produk: item.produk,
          jumlah: item.jumlah,
        })),
        alamatPengiriman: alamat,
        targetSelesai: target,
        catatan,
        metodePengiriman,
        mekanismePembayaran,
        dpPersen,
        jatuhTempoHari,
      });
      toast({
        title: "Pesanan dikirim ke Pengrajin",
        description: `${result.nomor} · ${result.items.length} macam barang · 1 pengiriman`,
      });
      setKeranjang([]);
      setProdukTambahId("");
      setCatatan("");
      setSetujuPembayaran(false);
      setSetujuPajak(false);
    } catch (error) {
      toast({
        title: "Pesanan gagal dibuat",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalog Pengrajin Khas Jakarta"
        subtitle="Tambahkan beberapa macam barang dari Pengrajin yang sama ke satu transaksi dan satu pengiriman."
      />
      {keranjang.length > 0 && pengrajinKeranjang && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">
              Pesanan ke {pengrajinKeranjang.namaUsaha}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Satu checkout menerbitkan satu nomor order, kontrak, invoice,
              ongkir, pengiriman, kwitansi, dan BAST untuk seluruh barang.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              {keranjang.map((item) => (
                <div
                  key={item.produk.id}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                >
                  <div>
                    <div className="font-medium">{item.produk.nama}</div>
                    <div className="text-xs text-muted-foreground">
                      Rp {item.produk.harga.toLocaleString("id-ID")} /{" "}
                      {item.produk.satuan}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`jumlah-${item.produk.id}`}>Jumlah</Label>
                    <Input
                      id={`jumlah-${item.produk.id}`}
                      aria-label={`Jumlah ${item.produk.nama}`}
                      type="number"
                      min={1}
                      step={1}
                      value={item.jumlah}
                      onChange={(event) =>
                        ubahJumlah(item.produk.id, Number(event.target.value))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={`Hapus ${item.produk.nama}`}
                    onClick={() => hapusBarang(item.produk.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {produkTambahan.length > 0 && (
              <div className="rounded-lg border border-dashed p-3 sm:col-span-2">
                <Label>Tambah barang lain dari Pengrajin ini</Label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={produkTambahId}
                    onValueChange={setProdukTambahId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Pilih barang tambahan" />
                    </SelectTrigger>
                    <SelectContent>
                      {produkTambahan.map((item) => (
                        <SelectItem key={item.produk.id} value={item.produk.id}>
                          {item.produk.nama} · Rp{" "}
                          {item.produk.harga.toLocaleString("id-ID")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!produkTambahId}
                    onClick={() => {
                      const item = produkTambahan.find(
                        (row) => row.produk.id === produkTambahId,
                      );
                      if (item) tambahBarang(item);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Tambah Barang
                  </Button>
                </div>
              </div>
            )}
            <Field
              label="Target Selesai"
              type="date"
              value={target}
              onChange={setTarget}
            />
            <div className="sm:col-span-2">
              <Field
                label="Alamat Pengiriman"
                value={alamat}
                onChange={setAlamat}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Catatan Mutu / Produksi</Label>
              <Textarea
                value={catatan}
                onChange={(event) => setCatatan(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>Subtotal {keranjang.length} macam barang</span>
                <strong>Rp {subtotal.toLocaleString("id-ID")}</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Status penjual:{" "}
                {pengrajinKeranjang.statusPkp === "pkp" ? "PKP" : "Non-PKP"}.
                Pajak dan satu ongkir final membentuk snapshot invoice setelah
                ongkir disepakati.
              </p>
            </div>
            <KetentuanTransaksi
              metodePengiriman={metodePengiriman}
              onMetodePengiriman={setMetodePengiriman}
              mekanismePembayaran={mekanismePembayaran}
              onMekanismePembayaran={setMekanismePembayaran}
              dpPersen={dpPersen}
              onDpPersen={setDpPersen}
              jatuhTempoHari={jatuhTempoHari}
              onJatuhTempoHari={setJatuhTempoHari}
              setujuPembayaran={setujuPembayaran}
              onSetujuPembayaran={setSetujuPembayaran}
              setujuPajak={setujuPajak}
              onSetujuPajak={setSetujuPajak}
              keteranganOngkir={
                seluruhOngkirTermasuk
                  ? "Termasuk harga dan ditanggung penjual untuk seluruh barang dalam transaksi ini."
                  : "Dihitung satu kali untuk seluruh barang. Penjual memasukkan total ongkir transaksi, lalu pembeli menyetujuinya sebelum invoice terbit."
              }
            />
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button
                onClick={order}
                disabled={!setujuPembayaran || !setujuPajak}
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> Ajukan 1 Pesanan
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setKeranjang([]);
                  setProdukTambahId("");
                }}
              >
                Kosongkan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {katalog.map(({ pengrajin, produk }) => {
          const bedaPengrajin = Boolean(
            pengrajinKeranjang && pengrajinKeranjang.id !== pengrajin.id,
          );
          const sudahDipilih = keranjang.some(
            (item) => item.produk.id === produk.id,
          );
          return (
            <Card
              key={`${pengrajin.id}-${produk.id}`}
              className="overflow-hidden"
            >
              {produk.fotoUrl || produk.fotoDataUrl ? (
                <img
                  src={produk.fotoUrl || produk.fotoDataUrl}
                  alt={produk.nama}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="grid h-44 place-items-center bg-muted">
                  <PackageCheck className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap gap-2">
                  <Badge>{produk.kategori}</Badge>
                  <Badge variant="outline">Khas Jakarta</Badge>
                  <Badge variant="secondary">
                    {produk.ongkirTermasukHarga
                      ? "Harga termasuk ongkir"
                      : "Ongkir dihitung penjual"}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold">
                    {produk.nama}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    oleh {pengrajin.namaUsaha}
                  </p>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {produk.deskripsi}
                </p>
                <div className="flex items-center justify-between gap-3 border-t pt-3">
                  <span className="font-semibold text-primary">
                    Rp {produk.harga.toLocaleString("id-ID")} / {produk.satuan}
                  </span>
                  <Button
                    size="sm"
                    disabled={bedaPengrajin}
                    title={
                      bedaPengrajin
                        ? "Kosongkan pesanan untuk memilih Pengrajin lain"
                        : undefined
                    }
                    onClick={() => tambahBarang({ pengrajin, produk })}
                  >
                    {bedaPengrajin
                      ? "Pengrajin berbeda"
                      : sudahDipilih
                        ? "Tambah 1"
                        : keranjang.length > 0
                          ? "Tambah"
                          : "Order"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {katalog.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
            Belum ada produk khas Jakarta yang dibuka untuk kerja sama.
          </Card>
        )}
      </div>
    </div>
  );
}

function PaketSection({
  mitra,
  katalog,
}: {
  mitra: MitraPengrajinUser;
  katalog: ReturnType<typeof katalogProdukMitra>;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [harga, setHarga] = useState(0);
  const [marketIds, setMarketIds] = useState<string[]>([]);
  const [orderPaket, setOrderPaket] = useState<PaketProdukMitra | null>(null);
  const [alamat, setAlamat] = useState(mitra.alamat);
  const [target, setTarget] = useState(tomorrow());
  const [metodePengiriman, setMetodePengiriman] =
    useState<MetodePengirimanProduk>("kurir_paket");
  const [mekanismePembayaran, setMekanismePembayaran] =
    useState<MekanismePembayaranProduk>("lunas");
  const [dpPersen, setDpPersen] = useState(30);
  const [jatuhTempoHari, setJatuhTempoHari] = useState(0);
  const [setujuPembayaran, setSetujuPembayaran] = useState(false);
  const [setujuPajak, setSetujuPajak] = useState(false);

  const saveProfile = async (next: MitraPengrajinUser) => {
    save((db) => {
      const user = db.users.find((item) => item.id === next.id);
      if (user?.role === "mitra_pengrajin") Object.assign(user, next);
    });
    if (next.apiId) {
      await usersApi.update(next.apiId, {
        profile: { paketProduk: next.paketProduk },
      });
    }
  };

  const create = async () => {
    if (!nama.trim() || selected.length === 0 || marketIds.length === 0) {
      toast({
        title: "Lengkapi paket",
        description: "Pilih produk, marketplace, dan isi nama paket.",
        variant: "destructive",
      });
      return;
    }
    const items = selected
      .map((key) =>
        katalog.find(
          ({ pengrajin, produk }) => `${pengrajin.id}:${produk.id}` === key,
        ),
      )
      .filter((item): item is (typeof katalog)[number] => Boolean(item))
      .map(({ pengrajin, produk }) => ({
        pengrajinId: pengrajin.id,
        produkId: produk.id,
        namaPengrajin: pengrajin.namaUsaha,
        namaProduk: produk.nama,
        jumlah: 1,
        hargaDasar: produk.harga,
        satuan: produk.satuan,
      }));
    const now = Date.now();
    const bundle: PaketProdukMitra = {
      id: `paket-${now.toString(36)}`,
      nama: nama.trim(),
      deskripsi: deskripsi.trim(),
      items,
      hargaJual: Math.max(0, harga),
      marketplaceIds: marketIds,
      aktif: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await saveProfile({
        ...mitra,
        paketProduk: [...mitra.paketProduk, bundle],
      });
      toast({ title: "Paket gabungan disimpan" });
      setSelected([]);
      setNama("");
      setDeskripsi("");
      setHarga(0);
      setMarketIds([]);
    } catch (error) {
      toast({
        title: "Gagal menyimpan paket",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const remove = async (id: string) => {
    await saveProfile({
      ...mitra,
      paketProduk: mitra.paketProduk.filter((item) => item.id !== id),
    });
    toast({ title: "Paket dihapus" });
  };

  const submitBundleOrder = () => {
    if (!orderPaket) return;
    try {
      const result = buatPesananDariPaket(
        mitra,
        orderPaket,
        alamat,
        target,
        "",
        {
          metodePengiriman,
          mekanismePembayaran,
          dpPersen,
          jatuhTempoHari,
        },
      );
      toast({
        title: `${result.length} pesanan Pengrajin dibuat`,
        description: "Setiap Pengrajin menerima pesanan sesuai produknya.",
      });
      setOrderPaket(null);
      setSetujuPembayaran(false);
      setSetujuPajak(false);
    } catch (error) {
      toast({
        title: "Gagal membuat pesanan",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paket Produk Gabungan"
        subtitle="Gabungkan produk dari beberapa Pengrajin, lalu tautkan ke toko marketplace Mitra."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Susun Paket Baru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Paket" value={nama} onChange={setNama} />
            <Field
              label="Harga Jual di Marketplace"
              type="number"
              value={String(harga || "")}
              onChange={(value) => setHarga(Number(value) || 0)}
            />
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={deskripsi}
                onChange={(event) => setDeskripsi(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Pilih Produk Pengrajin</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {katalog.map(({ pengrajin, produk }) => {
                const key = `${pengrajin.id}:${produk.id}`;
                return (
                  <label
                    key={key}
                    className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={selected.includes(key)}
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked
                            ? [...selected, key]
                            : selected.filter((item) => item !== key),
                        )
                      }
                    />
                    <span>
                      <strong>{produk.nama}</strong>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {pengrajin.namaUsaha} · Rp{" "}
                        {produk.harga.toLocaleString("id-ID")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Marketplace Tujuan</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {mitra.marketplace
                .filter((item) => item.aktif)
                .map((market) => (
                  <label
                    key={market.id}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={marketIds.includes(market.id)}
                      onCheckedChange={(checked) =>
                        setMarketIds(
                          checked
                            ? [...marketIds, market.id]
                            : marketIds.filter((id) => id !== market.id),
                        )
                      }
                    />
                    {market.nama} · {market.namaToko}
                  </label>
                ))}
            </div>
          </div>
          <Button onClick={() => void create()}>
            <Plus className="mr-2 h-4 w-4" /> Simpan Paket
          </Button>
        </CardContent>
      </Card>
      {orderPaket && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">
              Order stok untuk {orderPaket.nama}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Alamat Pengiriman"
              value={alamat}
              onChange={setAlamat}
            />
            <Field
              label="Target Selesai"
              type="date"
              value={target}
              onChange={setTarget}
            />
            <div className="sm:col-span-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>Subtotal pembelian stok</span>
                <strong>
                  Rp{" "}
                  {orderPaket.items
                    .reduce(
                      (total, item) => total + item.hargaDasar * item.jumlah,
                      0,
                    )
                    .toLocaleString("id-ID")}
                </strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Invoice, pajak, ongkir, dan pembayaran dibuat terpisah untuk
                setiap Pengrajin.
              </p>
            </div>
            <KetentuanTransaksi
              metodePengiriman={metodePengiriman}
              onMetodePengiriman={setMetodePengiriman}
              mekanismePembayaran={mekanismePembayaran}
              onMekanismePembayaran={setMekanismePembayaran}
              dpPersen={dpPersen}
              onDpPersen={setDpPersen}
              jatuhTempoHari={jatuhTempoHari}
              onJatuhTempoHari={setJatuhTempoHari}
              setujuPembayaran={setujuPembayaran}
              onSetujuPembayaran={setSetujuPembayaran}
              setujuPajak={setujuPajak}
              onSetujuPajak={setSetujuPajak}
              keteranganOngkir="Diperiksa per Pengrajin. Produk yang mencantumkan harga termasuk ongkir ditanggung penjual sesuai cakupan/batas; selain itu nominal dimasukkan penjual dan wajib disetujui pembeli."
            />
            <div className="sm:col-span-2 flex gap-2">
              <Button
                onClick={submitBundleOrder}
                disabled={!setujuPembayaran || !setujuPajak}
              >
                Kirim Pesanan per Pengrajin
              </Button>
              <Button variant="outline" onClick={() => setOrderPaket(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {mitra.paketProduk.map((bundle) => (
          <Card key={bundle.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-semibold">
                    {bundle.nama}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {bundle.deskripsi || "Tanpa deskripsi"}
                  </p>
                </div>
                <Badge>{bundle.aktif ? "Aktif" : "Nonaktif"}</Badge>
              </div>
              <ul className="space-y-1 text-sm">
                {bundle.items.map((item) => (
                  <li key={`${item.pengrajinId}-${item.produkId}`}>
                    {item.jumlah}× {item.namaProduk}{" "}
                    <span className="text-muted-foreground">
                      — {item.namaPengrajin}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="font-semibold">
                Harga jual Rp {bundle.hargaJual.toLocaleString("id-ID")}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setOrderPaket(bundle)}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Order ke Pengrajin
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => void remove(bundle.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PesananSection({
  mitra,
  pesanan,
}: {
  mitra: MitraPengrajinUser;
  pesanan: PesananProdukPengrajin[];
}) {
  const db = useDb();
  const { toast } = useToast();
  const pengrajinFor = (order: PesananProdukPengrajin) =>
    db.users.find(
      (item): item is PengrajinUser =>
        item.role === "pengrajin" && item.id === order.pengrajinId,
    );
  const action = (fn: () => unknown, title: string) => {
    try {
      fn();
      toast({ title });
    } catch (error) {
      toast({
        title: "Aksi gagal",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };
  const download = (
    type: "kontrak" | "invoice" | "kwitansi" | "bast",
    order: PesananProdukPengrajin,
  ) => {
    const pengrajin = pengrajinFor(order);
    if (!pengrajin) return;
    const label = {
      kontrak: "Kontrak",
      invoice: "Invoice",
      kwitansi: "Kwitansi",
      bast: "BAST",
    }[type];
    action(
      () => downloadDokumenPesananProduk(type, order, pengrajin, mitra),
      `Pratinjau ${label} dibuka`,
    );
  };
  const uploadPayment = async (order: PesananProdukPengrajin, file?: File) => {
    if (!file) return;
    if (
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 4_000_000
    ) {
      toast({
        title: "Bukti pembayaran tidak valid",
        description: "Gunakan PDF/JPG/PNG/WebP maksimal 4 MB.",
        variant: "destructive",
      });
      return;
    }
    const total =
      order.ringkasanPajak?.dibayarLangsungKePenjual ?? order.nilaiTotal;
    const outstanding = sisaPembayaran(total, order.riwayatPembayaran);
    const dataUrl = await asDataUrl(file);
    action(
      () =>
        unggahBuktiPembayaranProduk(order.id, mitra, {
          nama: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
          nominal: outstanding,
        }),
      "Bukti pembayaran dikirim kepada Pengrajin",
    );
  };
  const uploadTax = async (order: PesananProdukPengrajin, file?: File) => {
    if (!file) return;
    if (file.size > 4_000_000) {
      toast({ title: "Dokumen maksimal 4 MB", variant: "destructive" });
      return;
    }
    const dataUrl = await asDataUrl(file);
    action(
      () =>
        unggahDokumenPajakProduk(order.id, mitra, "bukti_potong", {
          nama: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        }),
      "Bukti potong disimpan",
    );
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesanan & Dokumen Transaksi"
        subtitle="Pantau kontrak, invoice, pembayaran, kwitansi, produksi, pengiriman, dan BAST."
      />
      <div className="space-y-4">
        {pesanan.map((order) => {
          const pengrajin = pengrajinFor(order);
          const signed = order.ttd.some((item) => item.pihak === "mitra");
          const pajak = order.ringkasanPajak;
          const totalBayar =
            pajak?.dibayarLangsungKePenjual ?? order.nilaiTotal;
          const verified = totalPembayaranTerverifikasi(
            order.riwayatPembayaran,
          );
          const outstanding = sisaPembayaran(
            totalBayar,
            order.riwayatPembayaran,
          );
          const canUploadPayment =
            Boolean(order.invoice) &&
            outstanding > 0 &&
            order.pembayaran?.mekanisme !== "cod" &&
            (order.status === "menunggu_bayar" ||
              order.status === "kontrak_aktif" ||
              order.status === "diproses");
          return (
            <Card key={order.id}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {order.nomor}
                    </div>
                    <h3 className="font-serif text-lg font-semibold">
                      {order.items.map((item) => item.nama).join(", ")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Pengrajin: {pengrajin?.namaUsaha ?? "-"}
                    </p>
                  </div>
                  <Badge>{STATUS_PESANAN_PRODUK[order.status]}</Badge>
                </div>
                <div className="grid gap-3 rounded-lg bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <span>
                    Target: <strong>{order.targetSelesai}</strong>
                  </span>
                  <span>
                    Nilai:{" "}
                    <strong>
                      Rp {order.nilaiTotal.toLocaleString("id-ID")}
                    </strong>
                  </span>
                  <span>
                    Tujuan: <strong>{order.alamatPengiriman}</strong>
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border p-3 text-sm">
                    <strong>Pengiriman</strong>
                    <p>
                      {labelMetodePengiriman(order.pengiriman?.metode ?? "-")}
                    </p>
                    {order.pengiriman?.ekspedisi && (
                      <p>
                        Kurir: {order.pengiriman.ekspedisi}
                        {order.pengiriman.layanan
                          ? ` · ${order.pengiriman.layanan}`
                          : ""}
                      </p>
                    )}
                    {order.pengiriman?.estimasiTiba && (
                      <p>Estimasi: {order.pengiriman.estimasiTiba}</p>
                    )}
                    <p>
                      Ongkir:{" "}
                      {order.pengiriman?.ongkirTermasukHarga
                        ? "Termasuk harga, ditanggung penjual"
                        : order.pengiriman?.statusOngkir === "menunggu_penjual"
                          ? "Menunggu nominal penjual"
                          : `Rp ${(order.pengiriman?.biayaOngkir ?? 0).toLocaleString("id-ID")} ditanggung pembeli`}
                    </p>
                    {order.pengiriman?.nomorResi && (
                      <p>
                        Resi: <strong>{order.pengiriman.nomorResi}</strong>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="ml-1 h-6 px-2 text-xs"
                          onClick={() =>
                            void navigator.clipboard?.writeText(
                              order.pengiriman?.nomorResi ?? "",
                            )
                          }
                        >
                          Salin
                        </Button>
                      </p>
                    )}
                    {order.pengiriman?.buktiResi &&
                      (order.pengiriman.buktiResi.dataUrl ||
                        order.pengiriman.buktiResi.url) && (
                        <a
                          href={
                            order.pengiriman.buktiResi.dataUrl ||
                            order.pengiriman.buktiResi.url
                          }
                          download={order.pengiriman.buktiResi.nama}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-primary underline"
                        >
                          Lihat / unduh bukti resi
                        </a>
                      )}
                    {order.pengiriman?.liveLocationUrl && (
                      <a
                        href={order.pengiriman.liveLocationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Buka live location
                      </a>
                    )}
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <strong>Harga & Pajak</strong>
                    <p>
                      Subtotal: Rp{" "}
                      {(
                        pajak?.subtotal ??
                        order.subtotalProduk ??
                        order.nilaiTotal
                      ).toLocaleString("id-ID")}
                    </p>
                    <p>
                      Ongkir: Rp {(pajak?.ongkir ?? 0).toLocaleString("id-ID")}
                    </p>
                    <p>
                      DPP PPN: Rp {(pajak?.dppPpn ?? 0).toLocaleString("id-ID")}
                    </p>
                    <p>PPN: Rp {(pajak?.ppn ?? 0).toLocaleString("id-ID")}</p>
                    <p className="font-semibold">
                      Total invoice: Rp{" "}
                      {(pajak?.totalInvoice ?? order.nilaiTotal).toLocaleString(
                        "id-ID",
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <strong>Pembayaran langsung</strong>
                    <p>
                      {labelMetodePembayaran(
                        order.pembayaran?.mekanisme ?? "lunas",
                      )}
                    </p>
                    <p>
                      Rekening:{" "}
                      {order.rekeningTujuan?.bank ??
                        pengrajin?.rekening.bank ??
                        "-"}{" "}
                      ·{" "}
                      {order.rekeningTujuan?.nomor ??
                        pengrajin?.rekening.nomor ??
                        "-"}
                    </p>
                    <p>Terverifikasi: Rp {verified.toLocaleString("id-ID")}</p>
                    <p>Sisa: Rp {outstanding.toLocaleString("id-ID")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dana dibayar langsung kepada Pengrajin. Jak Sanggar tidak
                      menampung dana atau menyetorkan pajak.
                    </p>
                  </div>
                </div>
                {order.alasanTolak && (
                  <p className="text-sm text-destructive">
                    Alasan: {order.alasanTolak}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {order.status === "menunggu_persetujuan_ongkir" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(
                          () => setujuiOngkirProduk(order.id, mitra),
                          "Ongkir disetujui; kontrak dan invoice diterbitkan",
                        )
                      }
                    >
                      Setujui Ongkir Rp{" "}
                      {(order.pengiriman?.biayaOngkir ?? 0).toLocaleString(
                        "id-ID",
                      )}
                    </Button>
                  )}
                  {order.kontrak && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("kontrak", order)}
                    >
                      <FileSignature className="mr-2 h-4 w-4" /> Kontrak
                    </Button>
                  )}
                  {order.invoice && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("invoice", order)}
                    >
                      <ReceiptText className="mr-2 h-4 w-4" /> Invoice
                    </Button>
                  )}
                  {order.kwitansi && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("kwitansi", order)}
                    >
                      <ReceiptText className="mr-2 h-4 w-4" /> Kwitansi
                    </Button>
                  )}
                  {order.bast && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("bast", order)}
                    >
                      <FileCheck2 className="mr-2 h-4 w-4" /> BAST
                    </Button>
                  )}
                  {order.status === "menunggu_ttd" && !signed && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(
                          () => tandaTanganiKontrakProduk(order.id, mitra),
                          "Kontrak ditandatangani",
                        )
                      }
                    >
                      Setujui & Tanda Tangani
                    </Button>
                  )}
                  {[
                    "menunggu_ongkir",
                    "menunggu_persetujuan_ongkir",
                    "diajukan",
                    "menunggu_ttd",
                  ].includes(order.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        action(
                          () => batalkanPesananProduk(order.id, mitra),
                          "Pesanan dibatalkan dan dihapus",
                        )
                      }
                    >
                      Batalkan
                    </Button>
                  )}
                  {order.status === "dikirim" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(
                          () => sahkanBastProduk(order.id, mitra),
                          "BAST disahkan; pesanan selesai",
                        )
                      }
                    >
                      Terima Barang & Sahkan BAST
                    </Button>
                  )}
                </div>
                {canUploadPayment && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <Label>Unggah Bukti Pembayaran Langsung ke Pengrajin</Label>
                    <Input
                      className="mt-2"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        void uploadPayment(order, event.target.files?.[0])
                      }
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pengrajin harus memverifikasi dana benar-benar masuk
                      sebelum kwitansi dianggap final.
                    </p>
                  </div>
                )}
                {Boolean(pajak?.pphDipotong) && !order.buktiPotongPph && (
                  <div className="rounded-lg border p-3">
                    <Label>Unggah Bukti Potong/e-Bupot oleh Pembeli</Label>
                    <Input
                      className="mt-2"
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(event) =>
                        void uploadTax(order, event.target.files?.[0])
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {pesanan.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            Belum ada pesanan produk.
          </Card>
        )}
      </div>
    </div>
  );
}

function ProfilSection({ mitra }: { mitra: MitraPengrajinUser }) {
  const { toast } = useToast();
  const { setSession } = useAuth();
  const [draft, setDraft] = useState(structuredClone(mitra));
  const [offlineDirty, setOfflineDirty] = useState(false);
  const [pendingWilayahToko, setPendingWilayahToko] = useState<AlamatWilayah>();
  const [saving, setSaving] = useState(false);
  const [market, setMarket] = useState({ nama: "", namaToko: "", url: "" });
  const marketplaces = useMemo(
    () => draft.marketplace ?? [],
    [draft.marketplace],
  );

  const downloadProfile = async (format: FormatUnduhanDokumen) => {
    const safeName = mitra.namaUsaha
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const daftarMarketplace = (mitra.marketplace ?? [])
      .filter((item) => item.aktif)
      .map((item) => `${item.nama}: ${item.namaToko}${item.url ? ` — ${item.url}` : ""}`)
      .join("\n");
    const data: DataProfilDokumen = {
      fileName: `Profil_Mitra_${safeName || mitra.id}`,
      title: `Profil Mitra — ${mitra.namaUsaha}`,
      namaUtama: mitra.namaUsaha,
      labelLogo: "LOGO",
      logoDataUrl: mitra.logoDataUrl,
      alamat: mitra.alamat,
      telepon: mitra.noHp,
      email: mitra.email,
      bidang: "Mitra Pengrajin",
      pembuka: `Profil ini disusun untuk memberikan gambaran singkat mengenai identitas, toko, marketplace, serta informasi administrasi ${mitra.namaUsaha} sebagai mitra pengrajin.`,
      sections: [
        {
          heading: "Identitas Mitra",
          rows: [
            { label: "Nama Usaha", value: mitra.namaUsaha },
            { label: "Penanggung Jawab", value: mitra.namaPenanggungJawab },
            { label: "Bentuk Usaha", value: mitra.bentukUsaha },
            { label: "Nama Badan Usaha", value: mitra.namaBadanUsaha },
            { label: "NPWP", value: mitra.npwp },
            {
              label: "Status PKP",
              value: mitra.statusPkp === "pkp" ? "PKP" : "Non-PKP",
            },
            { label: "NIB", value: mitra.nib },
            { label: "Tanggal Terbit NIB", value: mitra.tanggalTerbitNib },
          ],
        },
        {
          heading: "Kontak & Alamat",
          rows: [
            { label: "Email", value: mitra.email },
            { label: "No. HP", value: mitra.noHp },
            { label: "Alamat Usaha", value: mitra.alamat },
          ],
        },
        {
          heading: "Toko Offline",
          rows: [
            { label: "Nama Toko", value: mitra.namaTokoOffline },
            { label: "Alamat Toko", value: mitra.alamatTokoOffline },
            {
              label: "Status Verifikasi",
              value: (mitra.statusVerifikasiTokoOffline ?? "belum_lengkap")
                .replace(/_/g, " "),
            },
          ],
        },
        {
          heading: "Deskripsi Usaha",
          paragraphs: [mitra.deskripsi ?? "-"],
        },
        {
          heading: "Marketplace",
          paragraphs: [daftarMarketplace || "-"],
        },
        {
          heading: "Rekening Bank",
          rows: [
            { label: "Bank", value: mitra.rekening.bank },
            { label: "No. Rekening", value: mitra.rekening.nomor },
            { label: "Atas Nama", value: mitra.rekening.atasNama },
          ],
        },
      ],
      jabatanTandaTangan:
        mitra.jabatanPenandatangan ?? "Penanggung Jawab",
      namaTandaTangan: mitra.namaPenanggungJawab,
    };
    try {
      await unduhProfilDokumen(format, data);
      toast({
        title: `Profil ${format === "word" ? "Word" : "PDF"} berhasil diunduh`,
      });
    } catch (error) {
      toast({
        title: "Gagal mengunduh profil",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    }
  };

  const persist = async () => {
    if (
      draft.memilikiTokoOffline !== true ||
      !draft.namaTokoOffline?.trim() ||
      !draft.alamatTokoOffline?.trim() ||
      !wilayahLengkap(draft.wilayahTokoOffline) ||
      !draft.latTokoOffline ||
      !draft.lngTokoOffline ||
      draft.latTokoOffline < -6.5 ||
      draft.latTokoOffline > -5.3 ||
      draft.lngTokoOffline < 106.5 ||
      draft.lngTokoOffline > 107.2
    ) {
      toast({
        title: "Data toko offline wajib dilengkapi",
        description:
          "Lengkapi nama, alamat, wilayah DKI Jakarta, dan titik peta toko.",
        variant: "destructive",
      });
      return;
    }
    const tanggalPermohonan =
      draft.tanggalPermohonanMitra ?? new Date().toISOString().slice(0, 10);
    if (
      !draft.tanggalTerbitNib ||
      draft.tanggalTerbitNib > tanggalPermohonan ||
      draft.tanggalTerbitNib < enamBulanSebelum(tanggalPermohonan)
    ) {
      toast({
        title: "Tanggal NIB tidak memenuhi syarat",
        description:
          "Tanggal terbit NIB harus berada dalam enam bulan sebelum tanggal permohonan dan tidak boleh sesudahnya.",
        variant: "destructive",
      });
      return;
    }
    const missingDocument = DOKUMEN_VERIFIKASI_TOKO_MITRA.find(
      (jenis) => !draft.dokumen?.some((dokumen) => dokumen.jenis === jenis),
    );
    if (missingDocument) {
      toast({
        title: "Dokumen verifikasi belum lengkap",
        description: `${missingDocument} wajib diunggah.`,
        variant: "destructive",
      });
      return;
    }
    const nextDraft: MitraPengrajinUser = offlineDirty
      ? {
          ...draft,
          tanggalPermohonanMitra: tanggalPermohonan,
          statusVerifikasiTokoOffline: "menunggu_verifikasi",
          catatanVerifikasiTokoOffline: undefined,
          diverifikasiTokoOfflineAt: undefined,
          diverifikasiTokoOfflineOleh: undefined,
        }
      : draft;
    setSaving(true);
    try {
      if (nextDraft.apiId) {
        const {
          id: _id,
          apiId: _apiId,
          role: _role,
          username: _username,
          password: _password,
          createdAt: _createdAt,
          ...profile
        } = nextDraft;
        await usersApi.update(nextDraft.apiId, { profile });
      }
      save((db) => {
        const target = db.users.find((item) => item.id === mitra.id);
        if (target?.role === "mitra_pengrajin")
          Object.assign(target, nextDraft);
      });
      setDraft(nextDraft);
      setSession(nextDraft);
      setOfflineDirty(false);
      toast({
        title: offlineDirty
          ? "Verifikasi toko diajukan"
          : "Profil Mitra tersimpan",
        description: offlineDirty
          ? "Kurator akan memeriksa titik toko, NIB, dan dua surat domisili."
          : undefined,
      });
    } catch (error) {
      toast({
        title: "Profil belum tersimpan",
        description:
          error instanceof Error
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateOffline = (patch: Partial<MitraPengrajinUser>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setOfflineDirty(true);
  };

  const uploadVerificationDocument = async (
    jenis: JenisDokumenPengrajin,
    file?: File,
  ) => {
    if (!file) return;
    if (
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 10 * 1024 * 1024
    ) {
      toast({
        title: "Dokumen tidak valid",
        description: "Gunakan PDF/JPG/PNG/WebP maksimal 10 MB.",
        variant: "destructive",
      });
      return;
    }
    try {
      let document: DokumenPengrajin;
      if (draft.apiId) {
        const uploaded = await uploadsApi.create(file);
        document = {
          id: uploaded.id,
          jenis,
          nama: file.name,
          url: uploaded.url,
          contentType: uploaded.contentType,
          size: uploaded.sizeBytes,
          uploadedAt: Date.now(),
        };
      } else {
        document = {
          id: `dok-${Date.now().toString(36)}`,
          jenis,
          nama: file.name,
          dataUrl: await asDataUrl(file),
          contentType: file.type,
          size: file.size,
          uploadedAt: Date.now(),
        };
      }
      setDraft((previous) => ({
        ...previous,
        dokumen: [
          ...(previous.dokumen ?? []).filter((item) => item.jenis !== jenis),
          document,
        ],
      }));
      setOfflineDirty(true);
      toast({ title: `${jenis} siap disimpan` });
    } catch (error) {
      toast({
        title: "Unggah dokumen gagal",
        description:
          error instanceof Error
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    }
  };

  const uploadImage = async (
    key: "logoDataUrl" | "stempelDataUrl",
    file?: File,
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_500_000) {
      toast({
        title: "Gambar tidak valid",
        description: "Gunakan PNG/JPG/WebP maksimal 1,5 MB.",
        variant: "destructive",
      });
      return;
    }
    setDraft({ ...draft, [key]: await asDataUrl(file) });
  };

  const addMarket = () => {
    const url = normalizeUrl(market.url);
    if (!market.nama.trim() || !market.namaToko.trim() || !url) return;
    const item: MarketplaceMitra = {
      id: `market-${Date.now().toString(36)}`,
      nama: market.nama.trim(),
      namaToko: market.namaToko.trim(),
      url,
      aktif: true,
    };
    setDraft({ ...draft, marketplace: [...marketplaces, item] });
    setMarket({ nama: "", namaToko: "", url: "" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil, Kop & Marketplace Mitra"
        subtitle="Toko offline dan dokumen wajib diverifikasi sebelum titik toko dapat tampil pada peta publik."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void downloadProfile("word")}
              data-testid="button-download-word"
            >
              <Download className="mr-2 h-4 w-4" />
              <span>Unduh Word</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadProfile("pdf")}
              data-testid="button-download-pdf"
            >
              <Download className="mr-2 h-4 w-4" />
              <span>Unduh PDF</span>
            </Button>
          </div>
        }
      />
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5" /> Verifikasi Toko Offline
            </CardTitle>
            <Badge
              variant={
                draft.statusVerifikasiTokoOffline === "terverifikasi"
                  ? "default"
                  : draft.statusVerifikasiTokoOffline === "ditolak"
                    ? "destructive"
                    : "secondary"
              }
            >
              {draft.statusVerifikasiTokoOffline === "terverifikasi"
                ? "Akun aktif · terverifikasi"
                : draft.statusVerifikasiTokoOffline === "menunggu_verifikasi"
                  ? "Akun belum aktif · menunggu Kurator"
                  : draft.statusVerifikasiTokoOffline === "ditolak"
                    ? "Akun belum aktif · perlu diperbaiki"
                    : "Akun belum aktif · belum lengkap"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {draft.catatanVerifikasiTokoOffline && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm sm:col-span-2">
              <strong>Catatan Kurator:</strong>{" "}
              {draft.catatanVerifikasiTokoOffline}
            </div>
          )}
          <Field
            label="Nama Toko Offline"
            value={draft.namaTokoOffline ?? ""}
            onChange={(namaTokoOffline) => updateOffline({ namaTokoOffline })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Alamat Lengkap Toko Offline"
              value={draft.alamatTokoOffline ?? ""}
              onChange={(alamatTokoOffline) =>
                updateOffline({ alamatTokoOffline })
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Wilayah Administrasi Toko (DKI Jakarta)</Label>
            <RegionSelector
              mode="dki-only"
              value={draft.wilayahTokoOffline ?? {}}
              onChange={(wilayahTokoOffline) =>
                updateOffline({ wilayahTokoOffline })
              }
              required
              pendingWilayah={pendingWilayahToko}
              onPendingWilayahConsumed={() => setPendingWilayahToko(undefined)}
            />
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/25 p-4 sm:col-span-2">
            <Label>Titik Toko pada Peta</Label>
            <ShareLocation
              lat={draft.latTokoOffline ?? 0}
              lng={draft.lngTokoOffline ?? 0}
              onChange={(latTokoOffline, lngTokoOffline) =>
                updateOffline({ latTokoOffline, lngTokoOffline })
              }
              onAddressResolved={(wilayah, alamatDetail) => {
                setPendingWilayahToko(wilayah);
                updateOffline({
                  ...(alamatDetail
                    ? {
                        alamatTokoOffline: formatAlamatWilayah(
                          wilayah,
                          alamatDetail,
                        ),
                      }
                    : {}),
                });
              }}
              mode="gps"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Latitude"
                type="number"
                step="any"
                min="-6.5"
                max="-5.3"
                value={String(draft.latTokoOffline || "")}
                onChange={(value) =>
                  updateOffline({ latTokoOffline: Number(value) || 0 })
                }
              />
              <Field
                label="Longitude"
                type="number"
                step="any"
                min="106.5"
                max="107.2"
                value={String(draft.lngTokoOffline || "")}
                onChange={(value) =>
                  updateOffline({ lngTokoOffline: Number(value) || 0 })
                }
              />
            </div>
            {draft.latTokoOffline && draft.lngTokoOffline ? (
              <a
                className="inline-flex text-xs text-primary underline"
                href={`https://www.google.com/maps?q=${draft.latTokoOffline},${draft.lngTokoOffline}`}
                target="_blank"
                rel="noreferrer"
              >
                Periksa titik di peta <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            ) : null}
          </div>
          <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
            <Checkbox
              checked={draft.memilikiTokoOffline === true}
              onCheckedChange={(value) =>
                updateOffline({ memilikiTokoOffline: Boolean(value) })
              }
            />
            <span>
              Saya menyatakan Mitra mempunyai toko offline aktif yang dapat
              dikunjungi pada alamat tersebut.
            </span>
          </label>
          <div className="space-y-1.5">
            <Label>Nomor NIB</Label>
            <Input
              value={draft.nib}
              onChange={(event) => updateOffline({ nib: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal Terbit NIB</Label>
            <Input
              type="date"
              min={enamBulanSebelum(
                draft.tanggalPermohonanMitra ??
                  new Date().toISOString().slice(0, 10),
              )}
              max={
                draft.tanggalPermohonanMitra ??
                new Date().toISOString().slice(0, 10)
              }
              value={draft.tanggalTerbitNib ?? ""}
              onChange={(event) =>
                updateOffline({ tanggalTerbitNib: event.target.value })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Tanggal permohonan:{" "}
              {draft.tanggalPermohonanMitra ?? "dicatat saat pengajuan"}. NIB
              maksimal berusia 6 bulan pada tanggal tersebut.
            </p>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label>Dokumen Wajib Verifikasi</Label>
            {DOKUMEN_VERIFIKASI_TOKO_MITRA.map((jenis) => {
              const document = draft.dokumen?.find(
                (item) => item.jenis === jenis,
              );
              return (
                <div
                  key={jenis}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium">{jenis}</p>
                    <p className="text-xs text-muted-foreground">
                      {document
                        ? `${document.nama} · ${(document.size / 1024 / 1024).toFixed(2)} MB`
                        : jenis === "Surat Domisili 5 Tahun RT/RW"
                          ? "Surat RT/RW yang menerangkan domisili usaha lebih dari 5 tahun."
                          : jenis === "Surat Domisili Kelurahan JAKEVO/PTSP"
                            ? "Surat kelurahan yang diproses melalui JAKEVO atau PTSP setempat."
                            : "Salinan NIB sesuai nomor dan tanggal terbit."}
                    </p>
                    {document?.url || document?.dataUrl ? (
                      <a
                        href={document.url ?? document.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        Lihat dokumen
                      </a>
                    ) : null}
                  </div>
                  <Input
                    className="sm:w-72"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      void uploadVerificationDocument(
                        jenis,
                        event.target.files?.[0],
                      )
                    }
                  />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Setelah dokumen atau lokasi diubah, klik Simpan Permanen untuk
              mengajukan pemeriksaan ulang. Toko tidak tampil publik sebelum
              disetujui Kurator.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" /> Identitas Usaha
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nama Usaha"
            value={draft.namaUsaha}
            onChange={(namaUsaha) => setDraft({ ...draft, namaUsaha })}
          />
          <Field
            label="Penanggung Jawab"
            value={draft.namaPenanggungJawab}
            onChange={(namaPenanggungJawab) =>
              setDraft({ ...draft, namaPenanggungJawab })
            }
          />
          <Field
            label="Jabatan Penandatangan"
            value={draft.jabatanPenandatangan ?? ""}
            onChange={(jabatanPenandatangan) =>
              setDraft({ ...draft, jabatanPenandatangan })
            }
          />
          <Field
            label="Nama Badan Usaha"
            value={draft.namaBadanUsaha ?? ""}
            onChange={(namaBadanUsaha) =>
              setDraft({ ...draft, namaBadanUsaha })
            }
          />
          <Field
            label="NPWP"
            value={draft.npwp}
            onChange={(npwp) => setDraft({ ...draft, npwp })}
          />
          <div className="space-y-1.5">
            <Label>Status Pengusaha Kena Pajak</Label>
            <Select
              value={draft.statusPkp ?? "non_pkp"}
              onValueChange={(statusPkp) =>
                setDraft({
                  ...draft,
                  statusPkp: statusPkp as "pkp" | "non_pkp",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="non_pkp">Non-PKP</SelectItem>
                <SelectItem value="pkp">PKP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={draft.pemotongPajak === true}
              onCheckedChange={(value) =>
                setDraft({ ...draft, pemotongPajak: Boolean(value) })
              }
            />
            Memiliki kewajiban sebagai pemotong pajak
          </label>
          <div className="sm:col-span-2">
            <Field
              label="Alamat"
              value={draft.alamat}
              onChange={(alamat) => setDraft({ ...draft, alamat })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Logo Kop Mitra</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                void uploadImage("logoDataUrl", event.target.files?.[0])
              }
            />
            {draft.logoDataUrl && (
              <img
                src={draft.logoDataUrl}
                alt="Logo Mitra"
                className="h-20 max-w-40 rounded border object-contain p-2"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Stempel Mitra</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                void uploadImage("stempelDataUrl", event.target.files?.[0])
              }
            />
            {draft.stempelDataUrl && (
              <img
                src={draft.stempelDataUrl}
                alt="Stempel Mitra"
                className="h-20 w-20 rounded border object-contain p-1"
              />
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5" /> Toko Marketplace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Marketplace"
              value={market.nama}
              onChange={(nama) => setMarket({ ...market, nama })}
            />
            <Field
              label="Nama Toko"
              value={market.namaToko}
              onChange={(namaToko) => setMarket({ ...market, namaToko })}
            />
            <Field
              label="URL Toko"
              value={market.url}
              onChange={(url) => setMarket({ ...market, url })}
            />
          </div>
          <Button variant="outline" onClick={addMarket}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Marketplace
          </Button>
          <div className="space-y-2">
            {marketplaces.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <strong>{item.nama}</strong> · {item.namaToko}
                  <br />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    {item.url}
                  </a>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Buka
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        marketplace: marketplaces.filter(
                          (marketplace) => marketplace.id !== item.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => void persist()} disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Menyimpan…" : "Simpan Permanen"}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
