import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Handshake,
  MapPin,
  PackageCheck,
  PlayCircle,
  Send,
  Store,
  Video,
  XCircle,
} from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { save } from "@/lib/store";
import { publicContentApi, usersApi } from "@/lib/api";
import type {
  KerjasamaMitraPengrajin,
  MekanismePembayaranProduk,
  MetodePeninjauanMitra,
  MetodePengirimanProduk,
  MitraPengrajinUser,
  PengrajinUser,
  ProdukKerajinan,
} from "@/lib/types";
import {
  STATUS_KERJASAMA_MITRA,
  ajukanJadwalPeninjauan,
  ajukanKerjasamaMitra,
  buatPembelianKerjasama,
  putuskanKerjasamaMitra,
  selesaikanPeninjauan,
  sepakatiJadwalPeninjauan,
  sepakatiKerjasama,
} from "@/lib/kerjasama-mitra-pengrajin";
import {
  hitungRingkasanPajakTransaksi,
  labelMetodePembayaran,
} from "@/lib/kebijakan-transaksi";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function defaultMeetingTime() {
  const value = new Date(Date.now() + 3 * 86400000);
  value.setMinutes(0, 0, 0);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function defaultTarget() {
  return new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
}

function actionToast(
  fn: () => unknown,
  title: string,
  toast: ReturnType<typeof useToast>["toast"],
) {
  try {
    fn();
    toast({ title });
    return true;
  } catch (error) {
    toast({
      title: "Aksi gagal",
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    });
    return false;
  }
}

function ScheduleSummary({ item }: { item: KerjasamaMitraPengrajin }) {
  if (!item.jadwal) return null;
  return (
    <div className="space-y-1 rounded-lg border bg-muted/25 p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        {item.jadwal.metode === "langsung" ? (
          <MapPin className="h-4 w-4" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        {item.jadwal.metode === "langsung"
          ? "Peninjauan Langsung"
          : "Rapat Daring"}
      </div>
      <p>
        <strong>Waktu:</strong>{" "}
        {new Date(item.jadwal.tanggalWaktu).toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        })}
      </p>
      {item.jadwal.tempat && (
        <p>
          <strong>Tempat:</strong> {item.jadwal.tempat}
        </p>
      )}
      {item.jadwal.tautanRapat && (
        <a
          href={item.jadwal.tautanRapat}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary underline"
        >
          <ExternalLink className="h-3 w-3" /> Buka ruang rapat
        </a>
      )}
      {item.jadwal.catatan && (
        <p>
          <strong>Catatan:</strong> {item.jadwal.catatan}
        </p>
      )}
    </div>
  );
}

function MediaReview({ item }: { item: KerjasamaMitraPengrajin }) {
  if (item.media.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada foto atau video tambahan.
      </p>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {item.media.map((media) => (
        <div
          key={media.id}
          className="overflow-hidden rounded-lg border bg-card"
        >
          {media.jenis === "foto" ? (
            <img
              src={media.url}
              alt={media.judul}
              className="h-36 w-full object-cover"
            />
          ) : (
            <div className="grid h-36 place-items-center bg-muted">
              <PlayCircle className="h-10 w-10 text-primary" />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 p-2 text-xs">
            <span className="truncate font-medium">{media.judul}</span>
            <a
              href={media.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Lihat
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KerjasamaPengrajinPage() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [selectedMitra, setSelectedMitra] = useState<MitraPengrajinUser | null>(
    null,
  );
  const [judul, setJudul] = useState("");
  const [pesan, setPesan] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [produkIds, setProdukIds] = useState<string[]>([]);
  useEffect(() => {
    if (user?.role !== "pengrajin") return;
    let cancelled = false;
    void publicContentApi
      .mitraPengrajin()
      .then((rows) => {
        if (cancelled) return;
        save((data) => {
          for (const row of rows) {
            const apiId = String(row["id"] ?? "");
            if (!apiId) continue;
            const existing = data.users.find(
              (item) => item.apiId === apiId || item.id === `u_api_${apiId}`,
            );
            const publicMitra = {
              id: `u_api_${apiId}`,
              apiId,
              role: "mitra_pengrajin" as const,
              username: `mitra-${apiId}`,
              password: "***api***",
              namaUsaha: String(row["namaUsaha"] ?? "Mitra"),
              namaPenanggungJawab: String(row["namaPenanggungJawab"] ?? "-"),
              bentukUsaha: (row["bentukUsaha"] ??
                "Perorangan") as MitraPengrajinUser["bentukUsaha"],
              namaBadanUsaha:
                typeof row["namaBadanUsaha"] === "string"
                  ? row["namaBadanUsaha"]
                  : undefined,
              alamat: String(row["alamat"] ?? "-"),
              statusPkp: row["statusPkp"] === "pkp" ? "pkp" : "non_pkp",
              pemotongPajak: row["pemotongPajak"] === true,
              npwp: "",
              nib: "",
              rekening: { bank: "BCA" as const, nomor: "", atasNama: "-" },
              dokumen: [],
              marketplace: Array.isArray(row["marketplace"])
                ? row["marketplace"]
                : [],
              paketProduk: [],
              deskripsi:
                typeof row["deskripsi"] === "string"
                  ? row["deskripsi"]
                  : undefined,
              createdAt: Date.now(),
            } satisfies MitraPengrajinUser;
            if (existing?.role === "mitra_pengrajin")
              Object.assign(existing, publicMitra, { id: existing.id });
            else data.users.push(publicMitra);
          }
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.role]);
  if (!user || user.role !== "pengrajin") return null;
  const pengrajin =
    (db.users.find((item) => item.id === user.id) as
      | PengrajinUser
      | undefined) ?? user;
  const mitraList = db.users.filter(
    (item): item is MitraPengrajinUser => item.role === "mitra_pengrajin",
  );
  const pengajuan = db.kerjasamaMitraPengrajin
    .filter((item) => item.pengrajinId === pengrajin.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const products = (pengrajin.produk ?? []).filter(
    (item) => item.khasJakarta && item.terbukaKerjasama,
  );

  const submit = () => {
    if (!selectedMitra) return;
    const submitted = actionToast(
      () =>
        ajukanKerjasamaMitra({
          pengrajin,
          mitra: selectedMitra,
          judul,
          pesan,
          produkIds,
          videoUrl,
        }),
      "Pengajuan kerja sama dikirim",
      toast,
    );
    if (!submitted) return;
    setSelectedMitra(null);
    setJudul("");
    setPesan("");
    setVideoUrl("");
    setProdukIds([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Layanan & Kerja Sama Mitra"
        subtitle="Temukan Mitra terdaftar, ajukan kerja sama, sepakati peninjauan, lalu lanjutkan ke pembelian."
      />
      <ChannelSettings pengrajin={pengrajin} />
      {selectedMitra && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Ajukan kepada {selectedMitra.namaUsaha}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Judul Kerja Sama"
                value={judul}
                onChange={setJudul}
              />
              <Field
                label="Tautan Video Produk/Proses (opsional)"
                value={videoUrl}
                onChange={setVideoUrl}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tujuan dan Penawaran</Label>
                <Textarea
                  rows={4}
                  value={pesan}
                  onChange={(event) => setPesan(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Produk yang Ditawarkan</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {products.map((produk) => (
                  <label
                    key={produk.id}
                    className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={produkIds.includes(produk.id)}
                      onCheckedChange={(checked) =>
                        setProdukIds(
                          checked
                            ? [...produkIds, produk.id]
                            : produkIds.filter((id) => id !== produk.id),
                        )
                      }
                    />
                    <span>
                      <strong>{produk.nama}</strong>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        Rp {produk.harga.toLocaleString("id-ID")} /{" "}
                        {produk.satuan}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={submit}>
                <Send className="mr-2 h-4 w-4" /> Kirim Pengajuan
              </Button>
              <Button variant="outline" onClick={() => setSelectedMitra(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Mitra Terdaftar
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mitraList.map((mitra) => (
            <div key={mitra.id} className="space-y-3 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">{mitra.namaUsaha}</h3>
                <p className="text-xs text-muted-foreground">
                  {mitra.namaBadanUsaha || mitra.bentukUsaha} · {mitra.alamat}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {mitra.marketplace
                  .filter((item) => item.aktif)
                  .map((market) => (
                    <Badge key={market.id} variant="outline">
                      {market.nama}
                    </Badge>
                  ))}
              </div>
              <Button size="sm" onClick={() => setSelectedMitra(mitra)}>
                <Handshake className="mr-2 h-4 w-4" /> Ajukan Kerja Sama
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        {pengajuan.map((item) => {
          const mitra = mitraList.find((value) => value.id === item.mitraId);
          return (
            <Card key={item.id}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {item.nomor}
                    </div>
                    <h3 className="font-semibold">{item.judul}</h3>
                    <p className="text-sm text-muted-foreground">
                      Mitra: {mitra?.namaUsaha ?? "-"}
                    </p>
                  </div>
                  <Badge>{STATUS_KERJASAMA_MITRA[item.status]}</Badge>
                </div>
                <p className="text-sm">{item.pesan}</p>
                <MediaReview item={item} />
                <ScheduleSummary item={item} />
                {item.alasanTolak && (
                  <p className="text-sm text-destructive">
                    Alasan: {item.alasanTolak}
                  </p>
                )}
                {item.status === "jadwal_diajukan" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      actionToast(
                        () => sepakatiJadwalPeninjauan(item.id, pengrajin),
                        "Waktu dan tempat disepakati",
                        toast,
                      )
                    }
                  >
                    <CalendarClock className="mr-2 h-4 w-4" /> Setujui Waktu &
                    Tempat
                  </Button>
                )}
                {item.pesananId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/pengrajin/pesanan-produk">
                      <PackageCheck className="mr-2 h-4 w-4" /> Buka Pembelian &
                      Dokumen
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {pengajuan.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            Belum ada pengajuan kerja sama.
          </Card>
        )}
      </div>
    </div>
  );
}

function ChannelSettings({ pengrajin }: { pengrajin: PengrajinUser }) {
  const { toast } = useToast();
  const [sewa, setSewa] = useState(pengrajin.menerimaSewaJasa);
  const [kerjasama, setKerjasama] = useState(pengrajin.menerimaKerjasama);
  const persist = async () => {
    save((db) => {
      const target = db.users.find((item) => item.id === pengrajin.id);
      if (target?.role === "pengrajin")
        Object.assign(target, {
          menerimaSewaJasa: sewa,
          menerimaKerjasama: kerjasama,
        });
    });
    if (pengrajin.apiId)
      await usersApi.update(pengrajin.apiId, {
        profile: { menerimaSewaJasa: sewa, menerimaKerjasama: kerjasama },
      });
    toast({ title: "Pengaturan layanan tersimpan" });
  };
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={sewa}
              onCheckedChange={(value) => setSewa(value === true)}
            />{" "}
            Menerima Layanan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={kerjasama}
              onCheckedChange={(value) => setKerjasama(value === true)}
            />{" "}
            Terbuka Kerja Sama Mitra
          </label>
        </div>
        <Button size="sm" variant="outline" onClick={() => void persist()}>
          Simpan Layanan
        </Button>
      </CardContent>
    </Card>
  );
}

export function KerjasamaMitraPage() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [metode, setMetode] = useState<MetodePeninjauanMitra>("langsung");
  const [tanggalWaktu, setTanggalWaktu] = useState(defaultMeetingTime());
  const [tempat, setTempat] = useState("");
  const [tautanRapat, setTautanRapat] = useState("");
  const [catatan, setCatatan] = useState("");
  if (!user || user.role !== "mitra_pengrajin") return null;
  const mitra =
    (db.users.find((item) => item.id === user.id) as
      | MitraPengrajinUser
      | undefined) ?? user;
  const requests = db.kerjasamaMitraPengrajin
    .filter((item) => item.mitraId === mitra.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const pengrajinFor = (item: KerjasamaMitraPengrajin) =>
    db.users.find(
      (value): value is PengrajinUser =>
        value.role === "pengrajin" && value.id === item.pengrajinId,
    );

  const schedule = (item: KerjasamaMitraPengrajin) => {
    actionToast(
      () =>
        ajukanJadwalPeninjauan({
          id: item.id,
          mitra,
          metode,
          tanggalWaktu,
          tempat,
          tautanRapat,
          catatan,
        }),
      "Permintaan jadwal dikirim",
      toast,
    );
    setScheduleId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kerja Sama Masuk"
        subtitle="Tinjau foto/video, sepakati kunjungan atau rapat daring, lalu lanjutkan ke pembelian."
      />
      <div className="space-y-4">
        {requests.map((item) => {
          const pengrajin = pengrajinFor(item);
          return (
            <Card key={item.id}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {item.nomor}
                    </div>
                    <h3 className="font-semibold">{item.judul}</h3>
                    <p className="text-sm text-muted-foreground">
                      Pengrajin: {pengrajin?.namaUsaha ?? "-"}
                    </p>
                  </div>
                  <Badge>{STATUS_KERJASAMA_MITRA[item.status]}</Badge>
                </div>
                <p className="text-sm">{item.pesan}</p>
                <MediaReview item={item} />
                <ScheduleSummary item={item} />
                {item.catatanPeninjauan && (
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    <strong>Hasil peninjauan:</strong> {item.catatanPeninjauan}
                  </p>
                )}
                {item.status === "diajukan" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        actionToast(
                          () =>
                            putuskanKerjasamaMitra(item.id, mitra, "setujui"),
                          "Pengajuan disetujui",
                          toast,
                        )
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const reason = window.prompt(
                          "Alasan penolakan:",
                          "Belum sesuai kebutuhan Mitra.",
                        );
                        if (reason !== null)
                          actionToast(
                            () =>
                              putuskanKerjasamaMitra(
                                item.id,
                                mitra,
                                "tolak",
                                reason,
                              ),
                            "Pengajuan ditolak",
                            toast,
                          );
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Tolak
                    </Button>
                  </div>
                )}
                {item.status === "disetujui" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setScheduleId(item.id)}
                    >
                      <CalendarClock className="mr-2 h-4 w-4" /> Minta
                      Peninjauan / Rapat
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        actionToast(
                          () =>
                            selesaikanPeninjauan(
                              item.id,
                              mitra,
                              "Foto, video, dan kapasitas produksi telah ditinjau.",
                            ),
                          "Peninjauan media selesai",
                          toast,
                        )
                      }
                    >
                      <PlayCircle className="mr-2 h-4 w-4" /> Tinjauan Media
                      Selesai
                    </Button>
                  </div>
                )}
                {scheduleId === item.id && (
                  <Card className="bg-muted/20">
                    <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Metode</Label>
                        <Select
                          value={metode}
                          onValueChange={(value) =>
                            setMetode(value as MetodePeninjauanMitra)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="langsung">
                              Peninjauan Langsung
                            </SelectItem>
                            <SelectItem value="rapat_daring">
                              Rapat Daring
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Field
                        label="Waktu"
                        type="datetime-local"
                        value={tanggalWaktu}
                        onChange={setTanggalWaktu}
                      />
                      {metode === "langsung" ? (
                        <Field
                          label="Tempat"
                          value={tempat}
                          onChange={setTempat}
                        />
                      ) : (
                        <Field
                          label="Tautan Rapat Daring"
                          value={tautanRapat}
                          onChange={setTautanRapat}
                        />
                      )}
                      <Field
                        label="Catatan"
                        value={catatan}
                        onChange={setCatatan}
                      />
                      <div className="sm:col-span-2 flex gap-2">
                        <Button size="sm" onClick={() => schedule(item)}>
                          Kirim Jadwal
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setScheduleId(null)}
                        >
                          Batal
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {item.status === "jadwal_disepakati" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      actionToast(
                        () =>
                          selesaikanPeninjauan(
                            item.id,
                            mitra,
                            "Peninjauan selesai dan kebutuhan telah dibahas.",
                          ),
                        "Peninjauan selesai",
                        toast,
                      )
                    }
                  >
                    Tandai Peninjauan / Rapat Selesai
                  </Button>
                )}
                {item.status === "peninjauan_selesai" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      actionToast(
                        () => sepakatiKerjasama(item.id, mitra),
                        "Bersepakat; lanjut pilih barang",
                        toast,
                      )
                    }
                  >
                    <Handshake className="mr-2 h-4 w-4" /> Bersepakat & Lanjut
                    Pembelian
                  </Button>
                )}
                {item.status === "bersepakat" && pengrajin && (
                  <PurchaseForm
                    item={item}
                    mitra={mitra}
                    pengrajin={pengrajin}
                  />
                )}
                {item.pesananId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/mitra/pesanan">
                      <PackageCheck className="mr-2 h-4 w-4" /> Buka Kontrak,
                      Invoice & Pembayaran
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {requests.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            Belum ada pengajuan dari Pengrajin.
          </Card>
        )}
      </div>
    </div>
  );
}

function PurchaseForm({
  item,
  mitra,
  pengrajin,
}: {
  item: KerjasamaMitraPengrajin;
  mitra: MitraPengrajinUser;
  pengrajin: PengrajinUser;
}) {
  const { toast } = useToast();
  const products = (pengrajin.produk ?? []).filter((produk) =>
    item.produkIds.includes(produk.id),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [alamat, setAlamat] = useState(mitra.alamat);
  const [target, setTarget] = useState(defaultTarget());
  const [catatan, setCatatan] = useState("");
  const [metodePengiriman, setMetodePengiriman] =
    useState<MetodePengirimanProduk>("kurir_paket");
  const [mekanismePembayaran, setMekanismePembayaran] =
    useState<MekanismePembayaranProduk>("lunas");
  const [dpPersen, setDpPersen] = useState(30);
  const [jatuhTempoHari, setJatuhTempoHari] = useState(0);
  const [setujuLangsung, setSetujuLangsung] = useState(false);
  const [setujuPajak, setSetujuPajak] = useState(false);
  const selectedProducts = products.filter(
    (produk) => (quantities[produk.id] ?? 0) > 0,
  );
  const subtotal = selectedProducts.reduce(
    (total, produk) => total + produk.harga * (quantities[produk.id] ?? 0),
    0,
  );
  const ongkirTermasuk =
    selectedProducts.length > 0 &&
    selectedProducts.every((produk) => produk.ongkirTermasukHarga === true);
  const pajak = hitungRingkasanPajakTransaksi({
    subtotal,
    statusPkpPenjual: pengrajin.statusPkp ?? "non_pkp",
  });
  const submit = () =>
    actionToast(
      () =>
        buatPembelianKerjasama({
          id: item.id,
          mitra,
          pengrajin,
          items: products.map((produk) => ({
            produk,
            jumlah: quantities[produk.id] ?? 0,
          })),
          alamatPengiriman: alamat,
          targetSelesai: target,
          catatan,
          metodePengiriman,
          mekanismePembayaran,
          dpPersen,
          jatuhTempoHari,
        }),
      ongkirTermasuk
        ? "Pembelian dikirim kepada Pengrajin"
        : "Pembelian dibuat; menunggu ongkos kirim dari Pengrajin",
      toast,
    );
  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
      <div>
        <h4 className="font-semibold">Pilih Barang & Kuantitas</h4>
        <p className="text-xs text-muted-foreground">
          Kontrak dan invoice langsung terbit setelah pembelian dibuat.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((produk) => (
          <ProductQuantity
            key={produk.id}
            produk={produk}
            value={quantities[produk.id] ?? 0}
            onChange={(jumlah) =>
              setQuantities({ ...quantities, [produk.id]: jumlah })
            }
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Alamat Pengiriman" value={alamat} onChange={setAlamat} />
        <Field
          label="Target Selesai"
          type="date"
          value={target}
          onChange={setTarget}
        />
        <div className="sm:col-span-2">
          <Field
            label="Catatan Pesanan"
            value={catatan}
            onChange={setCatatan}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Metode Pengiriman</Label>
          <Select
            value={metodePengiriman}
            onValueChange={(value) =>
              setMetodePengiriman(value as MetodePengirimanProduk)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">
                Instant — prioritas, hari yang sama
              </SelectItem>
              <SelectItem value="same_day">
                Same Day — multi-drop, hari yang sama
              </SelectItem>
              <SelectItem value="kurir_paket">
                Kurir Paket — Next Day sampai 7 hari
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
              setMekanismePembayaran(value as MekanismePembayaranProduk)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lunas">Bayar lunas</SelectItem>
              <SelectItem value="dp">Down payment (DP)</SelectItem>
              <SelectItem value="setelah_barang_diterima">
                Barang diterima baru bayar
              </SelectItem>
              <SelectItem value="cod">COD saat serah terima</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mekanismePembayaran === "dp" && (
          <Field
            label="DP (%)"
            type="number"
            value={String(dpPersen)}
            onChange={(value) =>
              setDpPersen(Math.min(100, Math.max(1, Number(value) || 30)))
            }
          />
        )}
        {mekanismePembayaran === "setelah_barang_diterima" && (
          <Field
            label="Jatuh Tempo setelah BAST (hari)"
            type="number"
            value={String(jatuhTempoHari)}
            onChange={(value) =>
              setJatuhTempoHari(Math.max(0, Number(value) || 0))
            }
          />
        )}
      </div>
      <div className="space-y-2 rounded-lg border bg-background p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal produk</span>
          <strong>Rp {subtotal.toLocaleString("id-ID")}</strong>
        </div>
        <div className="flex justify-between">
          <span>Ongkos kirim</span>
          <strong>
            {ongkirTermasuk
              ? "Termasuk harga (penjual)"
              : "Menunggu nominal penjual"}
          </strong>
        </div>
        <div className="flex justify-between">
          <span>DPP PPN</span>
          <strong>Rp {pajak.dppPpn.toLocaleString("id-ID")}</strong>
        </div>
        <div className="flex justify-between">
          <span>
            PPN sesuai deklarasi {pajak.statusPkpPenjual.toUpperCase()}
          </span>
          <strong>Rp {pajak.ppn.toLocaleString("id-ID")}</strong>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span>Perkiraan total sebelum ongkir tambahan</span>
          <strong>Rp {pajak.totalInvoice.toLocaleString("id-ID")}</strong>
        </div>
        <div className="text-xs text-muted-foreground">
          Pembayaran: {labelMetodePembayaran(mekanismePembayaran)}. Pajak
          dihitung berdasarkan deklarasi pihak; Jak Sanggar tidak memungut atau
          menyetorkannya.
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={setujuLangsung}
          onCheckedChange={(value) => setSetujuLangsung(Boolean(value))}
        />
        <span>
          Saya memahami pembayaran dilakukan langsung ke rekening Pengrajin dan
          Jak Sanggar tidak menampung dana.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={setujuPajak}
          onCheckedChange={(value) => setSetujuPajak(Boolean(value))}
        />
        <span>
          Saya memahami kewajiban pajak dilaksanakan masing-masing pihak sesuai
          status dan transaksinya.
        </span>
      </label>
      <Button
        onClick={submit}
        disabled={!setujuLangsung || !setujuPajak || subtotal <= 0}
      >
        <PackageCheck className="mr-2 h-4 w-4" /> Buat Pembelian
      </Button>
    </div>
  );
}

function ProductQuantity({
  produk,
  value,
  onChange,
}: {
  produk: ProdukKerajinan;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      {produk.fotoUrl || produk.fotoDataUrl ? (
        <img
          src={produk.fotoUrl || produk.fotoDataUrl}
          alt={produk.nama}
          className="h-14 w-14 rounded object-cover"
        />
      ) : (
        <PackageCheck className="h-8 w-8 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm">{produk.nama}</strong>
        <span className="text-xs text-muted-foreground">
          Rp {produk.harga.toLocaleString("id-ID")} / {produk.satuan}
        </span>
      </div>
      <Input
        aria-label={`Jumlah ${produk.nama}`}
        type="number"
        min={0}
        className="w-20"
        value={value || ""}
        onChange={(event) =>
          onChange(Math.max(0, Number(event.target.value) || 0))
        }
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
