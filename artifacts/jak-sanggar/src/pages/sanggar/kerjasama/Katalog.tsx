import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp } from "@/lib/store";
import {
  buildKatalog,
  buildKatalogPengrajin,
  createKerjasama,
  SATUAN_LABEL,
  type KatalogItem,
  type KatalogPengrajinItem,
} from "@/lib/kerjasama";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SanggarUser, KerjasamaKategori } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Music2,
  Shirt,
  Users as UsersIcon,
  Building2,
  Search,
  Send,
  MapPin,
  ExternalLink,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";
import { mapsUrl, hasKoordinat } from "@/components/system/ShareLocation";

import katSanggarImg from "@/assets/photos/kategori-sanggar.webp";
import katSdmImg from "@/assets/photos/kategori-sdm.webp";
import katAlatImg from "@/assets/photos/kategori-alat-musik.webp";
import katKostumImg from "@/assets/photos/kategori-kostum.webp";
import katTempatImg from "@/assets/photos/kategori-tempat.webp";

type KategoriTab = KerjasamaKategori | "all" | "kerajinan";
const KATEGORI_TABS: { key: KategoriTab; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "sdm", label: "SDM" },
  { key: "alat_musik", label: "Alat Musik" },
  { key: "kostum", label: "Kostum" },
  { key: "tempat_latihan", label: "Tempat Latihan" },
  { key: "kerajinan", label: "Pengrajin" },
];

function KategoriIcon({ k }: { k: KerjasamaKategori }) {
  if (k === "sdm") return <UsersIcon className="h-4 w-4" />;
  if (k === "alat_musik") return <Music2 className="h-4 w-4" />;
  if (k === "kostum") return <Shirt className="h-4 w-4" />;
  return <Building2 className="h-4 w-4" />;
}

function RequestDialog({
  item,
  sg,
  onCreated,
}: {
  item: KatalogItem;
  sg: SanggarUser;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [tanggalMulai, setTM] = useState(today);
  const [tanggalSelesai, setTS] = useState(today);
  const [lokasi, setLok] = useState("");
  const [jumlah, setJum] = useState(1);
  const [deskripsi, setDes] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="h-3.5 w-3.5 mr-1" />
          Ajukan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan Kerjasama</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Card className="p-3 bg-muted/40">
            <div className="font-medium">{item.judul}</div>
            <div className="text-xs text-muted-foreground">
              {item.sanggarNama}
            </div>
            <div className="text-xs mt-1">
              {fmtRp(item.hargaSewa)}{" "}
              <span className="text-muted-foreground">
                {SATUAN_LABEL[item.satuanHarga]}
              </span>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                min={today}
                value={tanggalMulai}
                onChange={(e) => {
                  const next = e.target.value;
                  setTM(next);
                  if (tanggalSelesai < next) setTS(next);
                }}
              />
            </div>
            <div>
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                min={tanggalMulai || today}
                value={tanggalSelesai}
                onChange={(e) => setTS(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Lokasi Kegiatan</Label>
            <Input
              value={lokasi}
              onChange={(e) => setLok(e.target.value)}
              placeholder="Mis. Aula RW 03 Condet"
            />
          </div>
          <div>
            <Label>Jumlah ({SATUAN_LABEL[item.satuanHarga]})</Label>
            <Input
              type="number"
              min={1}
              value={jumlah}
              onChange={(e) => {
                const next = Number(e.target.value);
                setJum(Number.isFinite(next) ? Math.max(1, next) : 1);
              }}
            />
          </div>
          <div>
            <Label>Deskripsi Kebutuhan</Label>
            <Textarea
              rows={3}
              value={deskripsi}
              onChange={(e) => setDes(e.target.value)}
              placeholder="Konteks kegiatan, kebutuhan teknis, dll."
            />
          </div>
          <div className="text-xs p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded">
            Estimasi nilai awal:{" "}
            <span className="font-semibold">
              {fmtRp(item.hargaSewa * Math.max(1, jumlah))}
            </span>
            . Nilai akhir bisa berubah lewat negosiasi.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => {
              if (item.sanggarId === sg.id) {
                toast({
                  title: "Tidak bisa ajukan ke sanggar sendiri",
                  variant: "destructive",
                });
                return;
              }
              if (!lokasi.trim()) {
                toast({ title: "Lokasi wajib diisi", variant: "destructive" });
                return;
              }
              const r = createKerjasama({
                katalog: item,
                peminjamSanggarId: sg.id,
                actor: { id: sg.id, role: "sanggar" },
                tanggalMulai,
                tanggalSelesai,
                lokasi,
                jumlah,
                deskripsi,
              });
              if (!r.ok || !r.kerjasama) {
                toast({
                  title: "Gagal",
                  description: r.reason,
                  variant: "destructive",
                });
                return;
              }
              toast({
                title: "Permintaan terkirim",
                description: `Nomor ${r.kerjasama.nomor}`,
              });
              setOpen(false);
              onCreated(r.kerjasama.id);
            }}
          >
            <Send className="h-4 w-4 mr-1" />
            Kirim Permintaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function KatalogKerjasama() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const sg = user as SanggarUser;
  const db = useDb();
  const [q, setQ] = useState("");
  // Recompute when DB changes (users / aset / sarpras / kerjasama)
  const items = useMemo(
    () => buildKatalog(),
    [db.users, db.aset, db.sarpras, db.kerjasama],
  );
  const kerajinanItems = useMemo(
    () => buildKatalogPengrajin("kerjasama"),
    [db.users],
  );
  if (!user || user.role !== "sanggar") return null;

  const filterFn = (k: KatalogItem) => {
    if (k.sanggarId === sg.id) return false; // jangan tampilkan punya sendiri
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      k.judul.toLowerCase().includes(t) ||
      k.sanggarNama.toLowerCase().includes(t) ||
      k.deskripsi.toLowerCase().includes(t)
    );
  };

  const byKategori = (kat: KerjasamaKategori | "all") =>
    items.filter(filterFn).filter((i) => kat === "all" || i.kategori === kat);
  const kerajinanTersaring = kerajinanItems.filter((item) => {
    if (!q) return true;
    const term = q.toLowerCase();
    return `${item.produk.nama} ${item.namaUsaha} ${item.produk.deskripsi} ${item.jenisKerajinan}`
      .toLowerCase()
      .includes(term);
  });

  return (
    <div>
      <PageHeader
        title="Katalog Kerjasama"
        subtitle="Temukan SDM, aset, tempat, serta Pengrajin untuk kolaborasi produksi, pemasaran, dekorasi, dan kegiatan budaya."
      />
      <div className="mb-4 flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari sanggar / SDM / aset / tempat / Pengrajin..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Tabs defaultValue="all">
        <TabsList className="flex-wrap">
          {KATEGORI_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label} (
              {t.key === "kerajinan"
                ? kerajinanTersaring.length
                : byKategori(t.key as KerjasamaKategori | "all").length}
              )
            </TabsTrigger>
          ))}
        </TabsList>
        {KATEGORI_TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {t.key === "kerajinan" ? (
              <PengrajinKerjasamaGrid items={kerajinanTersaring} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byKategori(t.key as KerjasamaKategori | "all").length ===
                  0 && (
                  <div className="col-span-full text-center text-muted-foreground py-12">
                    Belum ada item.
                  </div>
                )}
                {byKategori(t.key as KerjasamaKategori | "all").map((item) => (
                  <Card
                    key={item.id}
                    className="overflow-hidden flex flex-col group premium-card"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={
                          item.fotoDataUrl ||
                          (item.kategori === "sdm"
                            ? katSdmImg
                            : item.kategori === "alat_musik"
                              ? katAlatImg
                              : item.kategori === "kostum"
                                ? katKostumImg
                                : item.kategori === "tempat_latihan"
                                  ? katTempatImg
                                  : katSanggarImg)
                        }
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        alt={item.judul}
                      />
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-black/60 backdrop-blur text-white border-none shadow-sm gap-1">
                          <KategoriIcon k={item.kategori} />
                          {item.kategori.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="font-medium text-base leading-tight font-serif">
                        {item.judul}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.sanggarNama}
                      </div>
                      {item.sanggarAlamat && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                          <MapPin className="h-3 w-3 mt-0.5 flex-none" />
                          <span className="line-clamp-1">
                            {item.sanggarAlamat}
                          </span>
                        </div>
                      )}
                      {hasKoordinat(item.lat, item.lng) && (
                        <a
                          href={mapsUrl(item.lat, item.lng as number)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 w-fit"
                        >
                          <ExternalLink className="h-3 w-3" /> Lihat Lokasi
                          (Maps)
                        </a>
                      )}
                      <div className="text-xs mt-2 flex-1 line-clamp-2">
                        {item.deskripsi}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {fmtRp(item.hargaSewa)}{" "}
                          <span className="text-xs text-muted-foreground font-normal">
                            {SATUAN_LABEL[item.satuanHarga]}
                          </span>
                        </div>
                        <RequestDialog
                          item={item}
                          sg={sg}
                          onCreated={(id) =>
                            navigate(`/sanggar/kerjasama/${id}`)
                          }
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function waNumber(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function PengrajinKerjasamaGrid({ items }: { items: KatalogPengrajinItem[] }) {
  if (items.length === 0)
    return (
      <div className="py-12 text-center text-muted-foreground">
        Belum ada Pengrajin yang membuka kanal kerja sama.
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const wa = waNumber(item.noHp);
        return (
          <Card
            key={item.id}
            className="overflow-hidden flex flex-col premium-card"
          >
            <img
              src={item.produk.fotoUrl || item.produk.fotoDataUrl || katAlatImg}
              className="h-40 w-full object-cover"
              alt={item.produk.nama}
            />
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge className="gap-1">
                  <ShoppingBag className="h-3 w-3" /> Pengrajin
                </Badge>
                <Badge variant="outline">{item.bentukUsaha}</Badge>
              </div>
              <h3 className="mt-3 font-serif text-lg font-semibold">
                {item.produk.nama}
              </h3>
              <p className="text-xs text-muted-foreground">
                {item.namaUsaha} · {item.jenisKerajinan}
              </p>
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {item.produk.deskripsi}
              </p>
              <div className="mt-3 font-semibold">
                {fmtRp(item.produk.harga)} / {item.produk.satuan}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/toko/pengrajin/${item.publicId}`}>
                    Lihat Toko
                  </Link>
                </Button>
                {wa && (
                  <Button asChild size="sm">
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`Halo ${item.namaUsaha}, Sanggar kami tertarik bekerja sama untuk ${item.produk.nama} melalui Jak Sanggar.`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-1 h-3.5 w-3.5" /> Ajukan
                      Kontak
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
