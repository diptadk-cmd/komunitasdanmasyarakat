import { useState } from "react";
import {
  FileCheck2,
  FileSignature,
  ExternalLink,
  PackageCheck,
  ReceiptText,
  Send,
} from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import type {
  MitraPengrajinUser,
  PengrajinUser,
  PesananProdukPengrajin,
} from "@/lib/types";
import {
  STATUS_PESANAN_PRODUK,
  kirimProduk,
  konfirmasiCodProduk,
  mulaiProduksiProduk,
  tandaTanganiKontrakProduk,
  terimaPesananProduk,
  tetapkanOngkirProduk,
  tolakPesananProduk,
  unggahDokumenPajakProduk,
  verifikasiPembayaranProduk,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PesananProdukPengrajinPage() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "pengrajin") return null;
  const pengrajin =
    (db.users.find((item) => item.id === user.id) as
      | PengrajinUser
      | undefined) ?? (user as PengrajinUser);
  const orders = db.pesananProdukPengrajin
    .filter((item) => item.pengrajinId === pengrajin.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const mitraFor = (order: PesananProdukPengrajin) =>
    db.users.find(
      (item): item is MitraPengrajinUser =>
        item.role === "mitra_pengrajin" && item.id === order.mitraId,
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
    const mitra = mitraFor(order);
    if (!mitra) {
      toast({ title: "Data Mitra tidak ditemukan", variant: "destructive" });
      return;
    }
    action(
      () => downloadDokumenPesananProduk(type, order, pengrajin, mitra),
      `Pratinjau ${{ kontrak: "Kontrak", invoice: "Invoice", kwitansi: "Kwitansi", bast: "BAST" }[type]} dibuka`,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order & Dokumen Transaksi Produk"
        subtitle="Kelola kontrak, invoice, pembayaran, kwitansi, produksi, dan BAST tanpa kop Jak Sanggar."
      />
      <div className="space-y-4">
        {orders.map((order) => {
          const mitra = mitraFor(order);
          const signed = order.ttd.some((item) => item.pihak === "pengrajin");
          const totalBayar =
            order.ringkasanPajak?.dibayarLangsungKePenjual ?? order.nilaiTotal;
          const verified = totalPembayaranTerverifikasi(
            order.riwayatPembayaran,
          );
          const outstanding = sisaPembayaran(
            totalBayar,
            order.riwayatPembayaran,
          );
          const pendingPayment = order.riwayatPembayaran?.some(
            (row) => !row.diverifikasiAt,
          );
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
                      Mitra: {mitra?.namaUsaha ?? "-"}
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
                <ul className="space-y-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.produkId}>
                      {item.jumlah} {item.satuan} × {item.nama} — Rp{" "}
                      {(item.jumlah * item.harga).toLocaleString("id-ID")}
                    </li>
                  ))}
                </ul>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border p-3 text-sm">
                    <strong>Pengiriman</strong>
                    <p>
                      {labelMetodePengiriman(order.pengiriman?.metode ?? "-")}
                    </p>
                    <p>
                      {order.pengiriman?.ongkirTermasukHarga
                        ? "Harga sudah termasuk ongkir; ditanggung penjual"
                        : order.pengiriman?.statusOngkir === "menunggu_penjual"
                          ? "Penjual wajib memeriksa dan memasukkan ongkir"
                          : `Ongkir Rp ${(order.pengiriman?.biayaOngkir ?? 0).toLocaleString("id-ID")} ditanggung pembeli`}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <strong>Rekap pajak</strong>
                    <p>
                      Subtotal: Rp{" "}
                      {(
                        order.ringkasanPajak?.subtotal ??
                        order.subtotalProduk ??
                        order.nilaiTotal
                      ).toLocaleString("id-ID")}
                    </p>
                    <p>
                      DPP PPN: Rp{" "}
                      {(order.ringkasanPajak?.dppPpn ?? 0).toLocaleString(
                        "id-ID",
                      )}
                    </p>
                    <p>
                      PPN: Rp{" "}
                      {(order.ringkasanPajak?.ppn ?? 0).toLocaleString("id-ID")}
                    </p>
                    <p className="font-semibold">
                      Invoice: Rp {order.nilaiTotal.toLocaleString("id-ID")}
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
                      Ke rekening:{" "}
                      {order.rekeningTujuan?.bank ?? pengrajin.rekening.bank} ·{" "}
                      {order.rekeningTujuan?.nomor ?? pengrajin.rekening.nomor}
                    </p>
                    <p>Diterima: Rp {verified.toLocaleString("id-ID")}</p>
                    <p>Sisa: Rp {outstanding.toLocaleString("id-ID")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Jak Sanggar tidak menerima dana dan tidak membayar pajak
                      transaksi.
                    </p>
                  </div>
                </div>
                {order.catatan && (
                  <p className="text-sm text-muted-foreground">
                    Catatan Mitra: {order.catatan}
                  </p>
                )}
                {order.alasanTolak && (
                  <p className="text-sm text-destructive">
                    Alasan: {order.alasanTolak}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {order.status === "menunggu_ongkir" && (
                    <OngkirForm order={order} pengrajin={pengrajin} />
                  )}
                  {order.status === "diajukan" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          action(
                            () => terimaPesananProduk(order.id, pengrajin),
                            "Pesanan diterima; kontrak dan invoice diterbitkan",
                          )
                        }
                      >
                        <PackageCheck className="mr-2 h-4 w-4" /> Terima Order
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason = window.prompt(
                            "Alasan penolakan pesanan:",
                            "Kapasitas produksi tidak tersedia.",
                          );
                          if (reason !== null)
                            action(
                              () =>
                                tolakPesananProduk(order.id, pengrajin, reason),
                              "Pesanan ditolak",
                            );
                        }}
                      >
                        Tolak
                      </Button>
                    </>
                  )}
                  {order.kontrak && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("kontrak", order)}
                    >
                      <FileSignature className="mr-2 h-4 w-4" /> Preview Kontrak
                    </Button>
                  )}
                  {order.invoice && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("invoice", order)}
                    >
                      <ReceiptText className="mr-2 h-4 w-4" /> Preview Invoice
                    </Button>
                  )}
                  {order.kwitansi && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("kwitansi", order)}
                    >
                      <ReceiptText className="mr-2 h-4 w-4" /> Preview Kwitansi
                    </Button>
                  )}
                  {order.status === "menunggu_ttd" && !signed && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(
                          () => tandaTanganiKontrakProduk(order.id, pengrajin),
                          "Kontrak ditandatangani",
                        )
                      }
                    >
                      Tanda Tangani Kontrak
                    </Button>
                  )}
                  {pendingPayment && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(
                          () => verifikasiPembayaranProduk(order.id, pengrajin),
                          "Dana masuk diverifikasi; kwitansi diperbarui",
                        )
                      }
                    >
                      Konfirmasi Dana Diterima
                    </Button>
                  )}
                  {order.status === "menunggu_bayar" &&
                    order.pembayaran?.mekanisme === "cod" &&
                    order.bast?.finalAt && (
                      <Button
                        size="sm"
                        onClick={() =>
                          action(
                            () => konfirmasiCodProduk(order.id, pengrajin),
                            "Pembayaran COD dikonfirmasi",
                          )
                        }
                      >
                        Konfirmasi COD Diterima
                      </Button>
                    )}
                  {order.status === "kontrak_aktif" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(
                          () => mulaiProduksiProduk(order.id, pengrajin),
                          "Produksi dimulai",
                        )
                      }
                    >
                      Mulai Produksi
                    </Button>
                  )}
                  {order.status === "diproses" && (
                    <PengirimanForm order={order} pengrajin={pengrajin} />
                  )}
                  {order.bast && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download("bast", order)}
                    >
                      <FileCheck2 className="mr-2 h-4 w-4" /> Preview BAST
                    </Button>
                  )}
                </div>
                {Boolean(order.ringkasanPajak?.ppn) && !order.fakturPajak && (
                  <FakturPajakUpload order={order} pengrajin={pengrajin} />
                )}
              </CardContent>
            </Card>
          );
        })}
        {orders.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            Belum ada order produk dari Mitra.
          </Card>
        )}
      </div>
    </div>
  );
}

function OngkirForm({
  order,
  pengrajin,
}: {
  order: PesananProdukPengrajin;
  pengrajin: PengrajinUser;
}) {
  const { toast } = useToast();
  const pilihanEkspedisi = ekspedisiUntukMetode(order.pengiriman?.metode);
  const [biaya, setBiaya] = useState(0);
  const [ekspedisi, setEkspedisi] = useState(pilihanEkspedisi[0]?.nama ?? "");
  const [layanan, setLayanan] = useState(pilihanEkspedisi[0]?.layanan[0] ?? "");
  const [estimasi, setEstimasi] = useState("");
  const penyediaTerpilih = pilihanEkspedisi.find(
    (item) => item.nama === ekspedisi,
  );
  const submit = () => {
    try {
      tetapkanOngkirProduk(order.id, pengrajin, {
        biayaOngkir: biaya,
        ekspedisi,
        layanan,
        estimasiTiba: estimasi,
      });
      toast({ title: "Ongkir dikirim untuk persetujuan pembeli" });
    } catch (error) {
      toast({
        title: "Ongkir gagal disimpan",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };
  return (
    <div className="w-full rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="mb-2 font-medium">
        Masukkan ongkir setelah memeriksa tarif kurir
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Input
          aria-label="Nominal ongkos kirim"
          type="number"
          min={0}
          placeholder="Nominal ongkir"
          value={biaya || ""}
          onChange={(event) =>
            setBiaya(Math.max(0, Number(event.target.value) || 0))
          }
        />
        <Select
          value={ekspedisi}
          onValueChange={(value) => {
            setEkspedisi(value);
            const selected = pilihanEkspedisi.find(
              (item) => item.nama === value,
            );
            setLayanan(selected?.layanan[0] ?? "");
          }}
        >
          <SelectTrigger aria-label="Nama ekspedisi">
            <SelectValue placeholder="Pilih ekspedisi" />
          </SelectTrigger>
          <SelectContent>
            {pilihanEkspedisi.map((item) => (
              <SelectItem key={item.id} value={item.nama}>
                {item.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={layanan} onValueChange={setLayanan}>
          <SelectTrigger aria-label="Layanan pengiriman">
            <SelectValue placeholder="Pilih layanan" />
          </SelectTrigger>
          <SelectContent>
            {(
              pilihanEkspedisi.find((item) => item.nama === ekspedisi)
                ?.layanan ?? []
            ).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Estimasi tiba"
          placeholder="Estimasi tiba"
          value={estimasi}
          onChange={(event) => setEstimasi(event.target.value)}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {penyediaTerpilih?.cekOngkirUrl && (
          <Button asChild size="sm" variant="outline">
            <a
              href={penyediaTerpilih.cekOngkirUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cek Ongkir di {penyediaTerpilih.nama}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button size="sm" onClick={submit}>
          Kirim Ongkir ke Pembeli
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Tombol cek ongkir membuka kanal resmi penyedia. Salin nominal tarif yang
        tampil, lalu kirim untuk persetujuan pembeli.
      </p>
    </div>
  );
}

function PengirimanForm({
  order,
  pengrajin,
}: {
  order: PesananProdukPengrajin;
  pengrajin: PengrajinUser;
}) {
  const { toast } = useToast();
  const [nomorResi, setNomorResi] = useState("");
  const [liveLocationUrl, setLiveLocationUrl] = useState("");
  const [namaKurir, setNamaKurir] = useState("");
  const [noHpKurir, setNoHpKurir] = useState("");
  const [resiFile, setResiFile] = useState<File | undefined>();
  const pilihResi = (file?: File) => {
    if (!file) return;
    if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/i.test(file.type)) {
      toast({
        title: "Format resi tidak didukung",
        description: "Gunakan JPG, PNG, WebP, atau PDF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 4_000_000) {
      toast({ title: "Bukti resi maksimal 4 MB", variant: "destructive" });
      return;
    }
    setResiFile(file);
  };
  const submit = async () => {
    try {
      const buktiResi = resiFile
        ? {
            nama: resiFile.name,
            type: resiFile.type,
            size: resiFile.size,
            dataUrl: await asDataUrl(resiFile),
          }
        : undefined;
      kirimProduk(order.id, pengrajin, {
        nomorResi,
        liveLocationUrl,
        namaKurir,
        noHpKurir,
        buktiResi,
      });
      toast({ title: "Barang dikirim; BAST draft diterbitkan" });
    } catch (error) {
      toast({
        title: "Pengiriman belum dapat diproses",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };
  const metode = order.pengiriman?.metode;
  return (
    <div className="w-full rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="mb-2 font-medium">
        Data pengiriman {labelMetodePengiriman(metode ?? "-")}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {metode === "kurir_paket" && (
          <>
            <Input
              aria-label="Nomor resi"
              placeholder="Nomor resi wajib"
              value={nomorResi}
              onChange={(event) => setNomorResi(event.target.value)}
            />
            <label className="flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-sm">
              Pilih dari galeri/PDF
              <input
                aria-label="Pilih foto atau PDF resi dari galeri"
                className="sr-only"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(event) => pilihResi(event.target.files?.[0])}
              />
            </label>
            <label className="flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-sm">
              Ambil foto resi
              <input
                aria-label="Ambil foto resi dengan kamera"
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => pilihResi(event.target.files?.[0])}
              />
            </label>
            {resiFile && (
              <div className="rounded-md bg-muted px-3 py-2 text-xs">
                {resiFile.name} · {(resiFile.size / 1024).toFixed(0)} KB
              </div>
            )}
          </>
        )}
        {metode && (
          <Input
            aria-label="Tautan live location"
            placeholder={
              metode === "instant"
                ? "Tautan live location wajib"
                : "Tautan live status (opsional)"
            }
            value={liveLocationUrl}
            onChange={(event) => setLiveLocationUrl(event.target.value)}
          />
        )}
        {(metode === "same_day" ||
          metode === "kurir_toko" ||
          metode === "instant") && (
          <>
            <Input
              aria-label="Nama kurir"
              placeholder="Nama kurir"
              value={namaKurir}
              onChange={(event) => setNamaKurir(event.target.value)}
            />
            <Input
              aria-label="Nomor kurir"
              placeholder="Nomor kurir"
              value={noHpKurir}
              onChange={(event) => setNoHpKurir(event.target.value)}
            />
          </>
        )}
      </div>
      <Button className="mt-2" size="sm" onClick={() => void submit()}>
        <Send className="mr-2 h-4 w-4" /> Kirim & Terbitkan BAST
      </Button>
    </div>
  );
}

function FakturPajakUpload({
  order,
  pengrajin,
}: {
  order: PesananProdukPengrajin;
  pengrajin: PengrajinUser;
}) {
  const { toast } = useToast();
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 4_000_000) {
      toast({ title: "Dokumen maksimal 4 MB", variant: "destructive" });
      return;
    }
    try {
      unggahDokumenPajakProduk(order.id, pengrajin, "faktur_pajak", {
        nama: file.name,
        type: file.type,
        size: file.size,
        dataUrl: await asDataUrl(file),
      });
      toast({ title: "Faktur Pajak disimpan sebagai dokumen penjual" });
    } catch (error) {
      toast({
        title: "Faktur Pajak gagal disimpan",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };
  return (
    <div className="rounded-lg border p-3">
      <Label>Faktur Pajak dari Pengrajin PKP</Label>
      <Input
        className="mt-2"
        type="file"
        accept="application/pdf,image/*"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Jak Sanggar hanya menyimpan dokumen; penerbitan dan pelaporan tetap
        menjadi tanggung jawab penjual.
      </p>
    </div>
  );
}
