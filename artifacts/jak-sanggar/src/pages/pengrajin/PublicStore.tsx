import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  ExternalLink,
  Handshake,
  Mail,
  MapPin,
  MessageCircle,
  PackageOpen,
  Store,
  Wrench,
} from "lucide-react";
import { useDb } from "@/lib/auth";
import { publicContentApi } from "@/lib/api";
import type {
  AnyUser,
  MitraPengrajinUser,
  PengrajinUser,
  ProdukKerajinan,
} from "@/lib/types";
import { mapsUrl } from "@/components/system/ShareLocation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface PublicStore {
  id: string;
  namaUsaha: string;
  namaPemilik?: string;
  bentukUsaha?: string;
  namaBadanUsaha?: string;
  jenisKerajinan: string;
  produkUnggulan?: string;
  produk: ProdukKerajinan[];
  alamat: string;
  lat: number;
  lng: number;
  deskripsi?: string;
  website?: string;
  instagram?: string;
  email?: string;
  noHp?: string;
  fotoProfileDataUrl?: string;
  menerimaSewaJasa?: boolean;
  menerimaKerjasama?: boolean;
  marketplaceMitra: PublicMarketplaceMitra[];
}

interface PublicMarketplaceMitra {
  mitraId: string;
  mitraNama: string;
  paketId: string;
  paketNama: string;
  marketplaceNama: string;
  namaToko: string;
  url: string;
}

function phoneForWhatsApp(value?: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function localMarketplace(
  user: PengrajinUser,
  users: AnyUser[],
): PublicMarketplaceMitra[] {
  const productIds = new Set(user.produk.map((produk) => produk.id));
  return users.flatMap((candidate) => {
    if (candidate.role !== "mitra_pengrajin") return [];
    const mitra = candidate as MitraPengrajinUser;
    const markets = new Map(
      mitra.marketplace
        .filter((item) => item.aktif)
        .map((item) => [item.id, item]),
    );
    return mitra.paketProduk.flatMap((bundle) => {
      if (
        !bundle.aktif ||
        !bundle.items.some(
          (item) =>
            item.pengrajinId === user.id ||
            item.pengrajinId === user.apiId ||
            item.pengrajinId === user.username ||
            productIds.has(item.produkId),
        )
      )
        return [];
      return bundle.marketplaceIds.flatMap((marketId) => {
        const market = markets.get(marketId);
        return market
          ? [
              {
                mitraId: mitra.id,
                mitraNama: mitra.namaUsaha,
                paketId: bundle.id,
                paketNama: bundle.nama,
                marketplaceNama: market.nama,
                namaToko: market.namaToko,
                url: market.url,
              },
            ]
          : [];
      });
    });
  });
}

function localStore(user: PengrajinUser, users: AnyUser[]): PublicStore {
  return {
    id: user.id,
    namaUsaha: user.namaUsaha,
    namaPemilik: user.namaPemilik,
    bentukUsaha: user.bentukUsaha,
    namaBadanUsaha: user.namaBadanUsaha,
    jenisKerajinan: user.jenisKerajinan,
    produkUnggulan: user.produkUnggulan,
    produk: (user.produk ?? []).filter(
      (item) => item.khasJakarta === true && item.statusPublish,
    ),
    alamat: user.alamat,
    lat: user.lat,
    lng: user.lng,
    deskripsi: user.deskripsi,
    website: user.website,
    instagram: user.instagram,
    email: user.email,
    noHp: user.noHp,
    fotoProfileDataUrl: user.fotoProfileDataUrl,
    menerimaSewaJasa: user.menerimaSewaJasa,
    menerimaKerjasama: user.menerimaKerjasama,
    marketplaceMitra: localMarketplace(user, users),
  };
}

export default function PublicPengrajinStore() {
  const [match, params] = useRoute("/toko/pengrajin/:id");
  const id = match ? params?.id : undefined;
  const db = useDb();
  const fallback = useMemo(() => {
    const user = db.users.find(
      (item) =>
        item.role === "pengrajin" &&
        (item.id === id || item.apiId === id) &&
        item.tokoDipublikasikan !== false,
    );
    return user?.role === "pengrajin" ? localStore(user, db.users) : null;
  }, [db.users, id]);
  const [store, setStore] = useState<PublicStore | null>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await publicContentApi.pengrajin();
        if (cancelled) return;
        const found = rows.find((row) => row["id"] === id);
        setStore(found ? (found as unknown as PublicStore) : fallback);
      } catch {
        if (!cancelled) setStore(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [fallback, id]);

  if (loading && !store) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/20 text-muted-foreground">
        Memuat toko Pengrajin…
      </div>
    );
  }
  if (!store) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/20 p-6">
        <Card className="max-w-md p-8 text-center">
          <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-serif text-2xl">Toko tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Toko belum dipublikasikan atau sudah tidak aktif.
          </p>
          <Button asChild className="mt-5">
            <Link href="/">Kembali ke halaman depan</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const wa = phoneForWhatsApp(store.noHp);
  return (
    <div className="min-h-screen bg-[#f5f2e9]">
      <header className="border-b bg-[#052f25] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Halaman depan
          </Link>
          <span className="inline-flex items-center gap-2 font-serif font-semibold">
            <Store className="h-5 w-5" /> Profil Pengrajin di Peta Jakarta
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
            <div className="grid min-h-64 place-items-center bg-gradient-to-br from-[#0b6a45] to-[#052f25] p-8 text-white">
              {store.fotoProfileDataUrl ? (
                <img
                  src={store.fotoProfileDataUrl}
                  alt={store.namaUsaha}
                  className="h-52 w-52 rounded-3xl object-cover shadow-xl"
                />
              ) : (
                <Store className="h-24 w-24 opacity-90" />
              )}
            </div>
            <div className="p-6 sm:p-9">
              <div className="flex flex-wrap gap-2">
                <Badge>{store.jenisKerajinan}</Badge>
                <Badge variant="outline">
                  {store.bentukUsaha ?? "Perorangan"}
                </Badge>
                {store.menerimaSewaJasa && (
                  <Badge className="bg-amber-600">
                    <Wrench className="mr-1 h-3 w-3" /> Layanan
                  </Badge>
                )}
                {store.menerimaKerjasama && (
                  <Badge className="bg-blue-700">
                    <Handshake className="mr-1 h-3 w-3" /> Kerja Sama
                  </Badge>
                )}
              </div>
              <h1 className="mt-4 font-serif text-3xl font-bold sm:text-4xl">
                {store.namaUsaha}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Dikelola oleh {store.namaPemilik || "Pengrajin Jakarta"}
                {store.namaBadanUsaha ? ` · ${store.namaBadanUsaha}` : ""}
              </p>
              <p className="mt-5 leading-7 text-muted-foreground">
                {store.deskripsi || store.produkUnggulan}
              </p>
              <div className="mt-5 flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{store.alamat}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {wa && (
                  <Button asChild>
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(`Halo ${store.namaUsaha}, saya melihat toko Anda di Jak Sanggar.`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" /> Hubungi
                      untuk Kerja Sama
                    </a>
                  </Button>
                )}
                {store.email && (
                  <Button asChild variant="outline">
                    <a href={`mailto:${store.email}`}>
                      <Mail className="mr-2 h-4 w-4" /> Email
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <a
                    href={mapsUrl(store.lat, store.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Buka Peta
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-blue-200 bg-blue-50/70">
          <CardContent className="pt-6 text-sm leading-6 text-blue-950">
            Halaman ini adalah profil lokasi dan katalog informasi Pengrajin,
            bukan tempat transaksi marketplace. Pembelian daring dilakukan
            melalui toko marketplace milik Mitra yang tercantum di
            bawah.
          </CardContent>
        </Card>

        <section>
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold">
              Kerajinan dan Layanan
            </h2>
            <p className="text-sm text-muted-foreground">
              Produk khas Jakarta berikut dipublikasikan sebagai informasi
              katalog dan lokasi produksi.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.produk.map((produk) => (
              <Card key={produk.id} className="overflow-hidden">
                {produk.fotoUrl || produk.fotoDataUrl ? (
                  <img
                    src={produk.fotoUrl || produk.fotoDataUrl}
                    alt={produk.nama}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-48 place-items-center bg-muted">
                    <PackageOpen className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="space-y-3 pt-5">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{produk.kategori}</Badge>
                    {produk.tersediaSewaJasa && (
                      <Badge variant="outline">Layanan</Badge>
                    )}
                    {produk.terbukaKerjasama && (
                      <Badge variant="outline">Kerja Sama</Badge>
                    )}
                  </div>
                  <h3 className="font-serif text-lg font-semibold">
                    {produk.nama}
                  </h3>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {produk.deskripsi}
                  </p>
                  <div className="flex items-end justify-between gap-3 border-t pt-3">
                    <div>
                      <div className="font-semibold text-primary">
                        Rp {produk.harga.toLocaleString("id-ID")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        per {produk.satuan}
                        {produk.stok ? ` · stok ${produk.stok}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline">Informasi produk</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {store.produk.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
                Belum ada produk yang ditayangkan.
              </Card>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold">
              Beli melalui Marketplace Mitra
            </h2>
            <p className="text-sm text-muted-foreground">
              Tautan berikut dikelola oleh Mitra, bukan toko internal
              Jak Sanggar.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(store.marketplaceMitra ?? []).map((market) => (
              <Card key={`${market.paketId}-${market.url}`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                  <div>
                    <Badge variant="secondary">{market.marketplaceNama}</Badge>
                    <h3 className="mt-2 font-semibold">{market.paketNama}</h3>
                    <p className="text-xs text-muted-foreground">
                      {market.mitraNama} · {market.namaToko}
                    </p>
                  </div>
                  <Button asChild>
                    <a href={market.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Buka
                      Marketplace
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
            {(store.marketplaceMitra ?? []).length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">
                Belum ada Mitra yang menautkan produk ini ke marketplace.
              </Card>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
