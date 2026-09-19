import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp } from "@/lib/store";
import {
  buildKatalog,
  buildKatalogPengrajin,
  SATUAN_LABEL,
  type KatalogItem,
  type KatalogPengrajinItem,
} from "@/lib/kerjasama";
import { AKOMODASI_LABEL } from "@/lib/sewa-flow";
import { layananBasePath, pemesanLabel } from "@/lib/role-paths";
import { mapsUrl, hasKoordinat } from "@/components/system/ShareLocation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Users as UsersIcon,
  Music2,
  Shirt,
  MapPin,
  Search,
  Sparkles,
  ArrowRight,
  ShoppingBag,
  ExternalLink,
  Phone,
  Mail,
} from "lucide-react";
import type {
  JenisKesenian,
  MitraPengrajinUser,
  SewaUser,
} from "@/lib/types";

import heroBetawiImg from "@/assets/photos/hero-betawi.webp";
import katSanggarImg from "@/assets/photos/kategori-sanggar.webp";
import katSdmImg from "@/assets/photos/kategori-sdm.webp";
import katAlatImg from "@/assets/photos/kategori-alat-musik.webp";
import katKostumImg from "@/assets/photos/kategori-kostum.webp";
import katTempatImg from "@/assets/photos/kategori-tempat.webp";

type Kategori =
  | "sanggar"
  | "sdm"
  | "perlengkapan"
  | "kostum"
  | "tempat"
  | "kerajinan";

const KATEGORI_META: Record<
  Kategori,
  { label: string; desc: string; icon: React.ReactNode; image: string }
> = {
  sanggar: {
    label: "Sanggar",
    desc: "Daftar sanggar yang siap menerima permintaan kolaborasi atau pertunjukan.",
    icon: <Building2 className="h-7 w-7" />,
    image: katSanggarImg,
  },
  sdm: {
    label: "SDM",
    desc: "Pelatih dan seniman yang dapat dipesan untuk mengisi acara.",
    icon: <UsersIcon className="h-7 w-7" />,
    image: katSdmImg,
  },
  perlengkapan: {
    label: "Perlengkapan",
    desc: "Alat musik dan perlengkapan pentas yang bisa disewa.",
    icon: <Music2 className="h-7 w-7" />,
    image: katAlatImg,
  },
  kostum: {
    label: "Kostum",
    desc: "Kostum tradisional siap pakai untuk acara dan pertunjukan.",
    icon: <Shirt className="h-7 w-7" />,
    image: katKostumImg,
  },
  tempat: {
    label: "Tempat Latihan",
    desc: "Aula, studio, dan tempat latihan beserta fasilitasnya.",
    icon: <MapPin className="h-7 w-7" />,
    image: katTempatImg,
  },
  kerajinan: {
    label: "Kerajinan & Jasa",
    desc: "Produk, dekorasi, workshop, dan layanan dari Pengrajin Jakarta.",
    icon: <ShoppingBag className="h-7 w-7" />,
    image: katAlatImg,
  },
};

const KATEGORI_LIST: Kategori[] = [
  "sanggar",
  "sdm",
  "perlengkapan",
  "kostum",
  "tempat",
  "kerajinan",
];
const KESENIAN_OPTIONS: JenisKesenian[] = [
  "Tari",
  "Musik",
  "Teater",
  "Rupa",
  "Sastra",
  "Silat",
];

type PemesanKatalog = SewaUser | MitraPengrajinUser;

function isPemesanKatalog(user: unknown): user is PemesanKatalog {
  if (!user || typeof user !== "object" || !("role" in user)) return false;
  const role = (user as { role?: string }).role;
  return role === "sewa" || role === "mitra_pengrajin";
}

function namaPemesan(user: PemesanKatalog): string {
  return user.role === "mitra_pengrajin" ? user.namaUsaha : user.nama;
}

export function SewaHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!isPemesanKatalog(user)) return null;
  const basePath = layananBasePath(user.role);

  // Hitung jumlah item per kategori untuk preview di kartu.
  const items = useMemo(() => buildKatalog(), [db.users, db.aset, db.sarpras]);
  const sanggarCount = useMemo(
    () => db.users.filter((u) => u.role === "sanggar").length,
    [db.users],
  );
  const counts: Record<Kategori, number> = {
    sanggar: sanggarCount,
    sdm: items.filter((i) => i.kategori === "sdm").length,
    perlengkapan: items.filter((i) => i.kategori === "alat_musik").length,
    kostum: items.filter((i) => i.kategori === "kostum").length,
    tempat: items.filter((i) => i.kategori === "tempat_latihan").length,
    kerajinan: buildKatalogPengrajin("sewa").length,
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl mb-8 group">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
          style={{ backgroundImage: `url(${heroBetawiImg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-transparent" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative p-8 lg:p-12 text-white max-w-3xl">
          <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 border-none mb-4">
            Katalog Sanggar, Jasa & Aset
          </Badge>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl mb-4 leading-tight">
            Selamat datang, {namaPemesan(user)}
          </h1>
          <p className="text-white/80 text-lg sm:text-xl leading-relaxed">
            Telusuri katalog jasa kesenian dari sanggar-sanggar Jakarta. Klik
            kategori untuk membuka katalog lengkap dengan filter dan pencarian.
          </p>
        </div>
      </div>

      <Card className="p-4 mb-8 bg-gradient-to-br from-primary/10 via-amber-500/10 to-transparent border-primary/20">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 text-primary grid place-items-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-sm">
            <div className="font-medium">Mode {pemesanLabel(user.role)}</div>
            <p className="text-muted-foreground mt-0.5">
              Telusuri katalog, klik item yang Anda butuhkan, lalu kirim
              permintaan langsung ke sanggar. Pantau alur (TTD → invoice → bayar
              → BAST) di menu{" "}
              <Link href={`${basePath}/pesanan`} className="underline font-medium">
                Pesanan Saya
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {KATEGORI_LIST.map((k) => {
          const meta = KATEGORI_META[k];
          return (
            <Link
              key={k}
              href={`${basePath}/${basePath === "/konsumen" ? "katalog/" : ""}${k}`}
            >
              <Card
                className="overflow-hidden cursor-pointer group premium-card flex flex-col h-full"
                data-testid={`card-kategori-${k}`}
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                  <img
                    src={meta.image}
                    alt={meta.label}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-3 right-3 z-20">
                    <Badge className="bg-black/50 text-white backdrop-blur-md border-none">
                      {counts[k]} item
                    </Badge>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-2 text-primary">
                    {meta.icon}
                    <div className="font-serif text-2xl font-semibold">
                      {meta.label}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground flex-1 leading-relaxed">
                    {meta.desc}
                  </p>
                  <div className="mt-4 flex items-center text-sm font-medium text-accent transition-colors group-hover:text-primary">
                    Buka katalog{" "}
                    <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function isKategori(v: string | undefined): v is Kategori {
  return !!v && (KATEGORI_LIST as string[]).includes(v);
}

export function SewaKatalog() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [matchKonsumen, konsumenParams] = useRoute(
    "/konsumen/katalog/:kategori",
  );
  const [matchMitra, mitraParams] = useRoute("/mitra/layanan/:kategori");
  const db = useDb();

  const kategoriParam = matchKonsumen
    ? konsumenParams?.kategori
    : matchMitra
      ? mitraParams?.kategori
      : undefined;
  const kategori: Kategori = isKategori(kategoriParam)
    ? kategoriParam
    : "sanggar";

  const [q, setQ] = useState("");
  const [filterKesenian, setFilterKesenian] = useState<"all" | JenisKesenian>(
    "all",
  );
  const [filterSanggar, setFilterSanggar] = useState<"all" | string>("all");
  const [hargaMin, setHargaMin] = useState("");
  const [hargaMax, setHargaMax] = useState("");

  const sanggarList = useMemo(
    () =>
      db.users.filter((u) => u.role === "sanggar") as Array<{
        id: string;
        namaSanggar: string;
      }>,
    [db.users],
  );

  const items = useMemo(() => buildKatalog(), [db.users, db.aset, db.sarpras]);
  const kerajinanItems = useMemo(
    () => buildKatalogPengrajin("sewa"),
    [db.users],
  );

  if (!isPemesanKatalog(user)) return null;
  const basePath = layananBasePath(user.role);

  // Mapping kategori UI → kategori internal KatalogItem.
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const min = hargaMin ? Number(hargaMin) : null;
    const max = hargaMax ? Number(hargaMax) : null;

    if (kategori === "kerajinan") {
      return kerajinanItems.filter((item) => {
        if (
          term &&
          !`${item.produk.nama} ${item.namaUsaha} ${item.produk.deskripsi} ${item.jenisKerajinan}`
            .toLowerCase()
            .includes(term)
        )
          return false;
        if (min !== null && item.produk.harga < min) return false;
        if (max !== null && item.produk.harga > max) return false;
        return true;
      });
    }
    if (kategori === "sanggar") {
      // Untuk kategori "sanggar" tampilkan langsung daftar sanggar.
      const sanggars = (
        db.users.filter((u) => u.role === "sanggar") as any[]
      ).map((s) => ({
        id: s.id,
        nama: s.namaSanggar as string,
        alamat: (s.alamat ?? "-") as string,
        jenisKesenian: (s.jenisKesenian ?? []) as JenisKesenian[],
        deskripsi: (s.deskripsi ?? "") as string,
        foto: s.fotoProfileDataUrl as string | undefined,
        noHp: s.noHp as string | undefined,
        email: s.email as string | undefined,
        lat: s.lat as number | undefined,
        lng: s.lng as number | undefined,
      }));
      return sanggars.filter((s) => {
        if (
          term &&
          !`${s.nama} ${s.alamat} ${s.deskripsi}`.toLowerCase().includes(term)
        )
          return false;
        if (filterSanggar !== "all" && s.id !== filterSanggar) return false;
        if (
          filterKesenian !== "all" &&
          !s.jenisKesenian.includes(filterKesenian)
        )
          return false;
        return true;
      });
    }

    const internalKat =
      kategori === "sdm"
        ? "sdm"
        : kategori === "perlengkapan"
          ? "alat_musik"
          : kategori === "kostum"
            ? "kostum"
            : "tempat_latihan";
    return items.filter((i: KatalogItem) => {
      if (i.kategori !== internalKat) return false;
      if (term) {
        const hay =
          `${i.judul} ${i.sanggarNama} ${i.deskripsi} ${i.namaSdm ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (filterSanggar !== "all" && i.sanggarId !== filterSanggar)
        return false;
      if (filterKesenian !== "all" && !i.jenisKesenian.includes(filterKesenian))
        return false;
      if (min !== null && i.hargaSewa < min) return false;
      if (max !== null && i.hargaSewa > max) return false;
      return true;
    });
  }, [
    items,
    kerajinanItems,
    db.users,
    q,
    kategori,
    filterKesenian,
    filterSanggar,
    hargaMin,
    hargaMax,
  ]);

  const meta = KATEGORI_META[kategori];

  return (
    <div>
      <PageHeader
        title={`Katalog ${meta.label}`}
        subtitle={meta.desc}
        backTo={basePath}
        actions={
          <div className="flex gap-2">
            {KATEGORI_LIST.map((k) => (
              <Button
                key={k}
                size="sm"
                variant={k === kategori ? "default" : "outline"}
                onClick={() =>
                  navigate(
                    `${basePath}/${basePath === "/konsumen" ? "katalog/" : ""}${k}`,
                  )
                }
                data-testid={`button-tab-${k}`}
              >
                {KATEGORI_META[k].label}
              </Button>
            ))}
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Pencarian</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  kategori === "kerajinan"
                    ? "Cari produk, jasa, atau Pengrajin..."
                    : kategori === "sdm"
                      ? "Cari nama seniman / pelatih..."
                      : kategori === "sanggar"
                        ? "Cari nama sanggar / alamat..."
                        : "Cari nama / sanggar / fasilitas..."
                }
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>
          {kategori !== "kerajinan" && (
            <div>
              <Label className="text-xs">Jenis Kesenian</Label>
              <Select
                value={filterKesenian}
                onValueChange={(v) =>
                  setFilterKesenian(v as typeof filterKesenian)
                }
              >
                <SelectTrigger data-testid="select-kesenian">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {KESENIAN_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {kategori !== "kerajinan" && (
            <div>
              <Label className="text-xs">Sanggar</Label>
              <Select value={filterSanggar} onValueChange={setFilterSanggar}>
                <SelectTrigger data-testid="select-sanggar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua sanggar</SelectItem>
                  {sanggarList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.namaSanggar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {kategori !== "sanggar" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Harga Min</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={hargaMin}
                  onChange={(e) => setHargaMin(e.target.value)}
                  placeholder="0"
                  data-testid="input-harga-min"
                />
              </div>
              <div>
                <Label className="text-xs">Harga Maks</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={hargaMax}
                  onChange={(e) => setHargaMax(e.target.value)}
                  placeholder="∞"
                  data-testid="input-harga-max"
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Menampilkan{" "}
          <span className="font-semibold text-foreground">
            {filtered.length}
          </span>{" "}
          hasil.
        </div>
      </Card>

      {/* Render hasil */}
      {kategori === "sanggar" ? (
        <SanggarGrid items={filtered as any} />
      ) : kategori === "kerajinan" ? (
        <PengrajinGrid items={filtered as KatalogPengrajinItem[]} />
      ) : (
        <ItemGrid items={filtered as KatalogItem[]} basePath={basePath} />
      )}
    </div>
  );
}

function ItemGrid({
  items,
  basePath,
}: {
  items: KatalogItem[];
  basePath: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <div>Tidak ada item yang cocok dengan filter.</div>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => (
        <Link key={item.id} href={`${basePath}/item/${item.id}`}>
          <Card
            className="group overflow-hidden flex flex-col cursor-pointer hover-elevate active-elevate-2 transition-all h-full"
            data-testid={`card-item-${item.id}`}
          >
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
              className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt={item.judul}
            />
            <div className="p-3 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm leading-tight">
                  {item.judul}
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {item.jenisKesenian.slice(0, 2).map((k) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {item.sanggarNama}
              </div>
              {item.sanggarAlamat && (
                <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 flex-none" />{" "}
                  <span className="line-clamp-1">{item.sanggarAlamat}</span>
                </div>
              )}
              {hasKoordinat(item.lat, item.lng) && (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(
                      mapsUrl(item.lat as number, item.lng as number),
                      "_blank",
                      "noopener",
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(
                        mapsUrl(item.lat as number, item.lng as number),
                        "_blank",
                        "noopener",
                      );
                    }
                  }}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 w-fit cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3" /> Lihat Lokasi (Maps)
                </span>
              )}
              <div className="text-xs mt-2 flex-1 line-clamp-2 text-muted-foreground">
                {item.deskripsi}
              </div>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${item.akomodasiPP === "termasuk" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}
                  data-testid={`badge-akomodasi-${item.id}`}
                >
                  {AKOMODASI_LABEL[item.akomodasiPP]}
                  {item.akomodasiPP === "diluar" &&
                    item.biayaAkomodasi > 0 &&
                    ` (+${fmtRp(item.biayaAkomodasi)})`}
                </Badge>
              </div>
              <div className="mt-3 pt-2 border-t flex items-center justify-between">
                <div className="text-base font-semibold text-primary">
                  {fmtRp(item.hargaSewa)}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {SATUAN_LABEL[item.satuanHarga]}
                  </span>
                </div>
                <span className="text-xs text-primary font-medium flex items-center">
                  Pesan <ArrowRight className="h-3 w-3 ml-1" />
                </span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function whatsappNumber(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function PengrajinGrid({ items }: { items: KatalogPengrajinItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <div>Belum ada produk Pengrajin untuk katalog Konsumen/Mitra.</div>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const wa = whatsappNumber(item.noHp);
        return (
          <Card
            key={item.id}
            className="overflow-hidden flex flex-col premium-card"
          >
            {item.produk.fotoUrl || item.produk.fotoDataUrl ? (
              <img
                src={item.produk.fotoUrl || item.produk.fotoDataUrl}
                alt={item.produk.nama}
                className="h-40 w-full object-cover"
              />
            ) : (
              <img
                src={katAlatImg}
                alt={item.produk.nama}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{item.jenisKerajinan}</Badge>
                <Badge variant="outline">Katalog Konsumen & Mitra</Badge>
              </div>
              <h3 className="mt-3 font-serif text-lg font-semibold">
                {item.produk.nama}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.namaUsaha} · {item.bentukUsaha}
              </p>
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {item.produk.deskripsi}
              </p>
              <div className="mt-3 text-sm font-semibold text-primary">
                Rp {item.produk.harga.toLocaleString("id-ID")} /{" "}
                {item.produk.satuan}
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
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`Halo ${item.namaUsaha}, saya tertarik menyewa/memesan ${item.produk.nama} melalui Jak Sanggar.`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Hubungi Pengrajin
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

function SanggarGrid({
  items,
}: {
  items: Array<{
    id: string;
    nama: string;
    alamat: string;
    jenisKesenian: JenisKesenian[];
    deskripsi: string;
    foto?: string;
    noHp?: string;
    email?: string;
    lat?: number;
    lng?: number;
  }>;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <div>Tidak ada sanggar yang cocok.</div>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((s) => (
        <Card
          key={s.id}
          className="overflow-hidden flex flex-col group premium-card"
          data-testid={`card-sanggar-${s.id}`}
        >
          <div className="relative h-40 overflow-hidden">
            <img
              src={s.foto || katSanggarImg}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt={s.nama}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <div className="font-serif text-lg leading-tight font-semibold line-clamp-1">
                {s.nama}
              </div>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <div className="text-xs text-muted-foreground flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />{" "}
              <span className="line-clamp-2">{s.alamat}</span>
            </div>
            {hasKoordinat(s.lat, s.lng) && (
              <a
                href={mapsUrl(s.lat, s.lng as number)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 w-fit"
              >
                <ExternalLink className="h-3 w-3" /> Lihat Lokasi (Maps)
              </a>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {s.jenisKesenian.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px]">
                  {k}
                </Badge>
              ))}
            </div>
            {s.deskripsi && (
              <div className="text-xs mt-2 flex-1 line-clamp-2 text-muted-foreground">
                {s.deskripsi}
              </div>
            )}
            <div className="mt-4 pt-3 border-t text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-md">
              {s.noHp && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {s.noHp}
                </div>
              )}
              {s.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {s.email}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
