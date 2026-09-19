import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Apple,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileCheck2,
  GraduationCap,
  Headphones,
  HelpCircle,
  Image as ImageIcon,
  Landmark,
  Layers3,
  LockKeyhole,
  MapPin,
  Megaphone,
  Music2,
  Navigation,
  Palette,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Smartphone,
  Store,
  User,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { fmtDate, LOCAL_DEMO_USERNAMES } from "@/lib/store";
import {
  DEMO_LOGIN_ACCOUNTS,
  type DemoLoginAccount,
} from "@/lib/demo-accounts";
import { roleHomePath } from "@/lib/role-paths";
import { ApiError, publicContentApi } from "@/lib/api";
import { getDeferredInstallPrompt, isStandalone } from "@/lib/pwa";
import type {
  InfoBudaya,
  News,
  NewsKategori,
  MitraPengrajinUser,
  PengrajinUser,
  SanggarUser,
} from "@/lib/types";
import { HumanCheck } from "@/components/auth/HumanCheck";
import { PublicSanggarDirectory } from "@/components/PublicSanggarDirectory";
import { TumpalSpinner } from "@/components/betawi/Ornaments";
import {
  CreativeMediaPlayer,
  creativeMediaKind,
  type MediaPlaybackState,
} from "@/components/system/CreativeMedia";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import ahuLogo from "@/assets/layanan/menu-ahu.webp";
import ossLogo from "@/assets/layanan/menu-oss.webp";
import coretaxLogo from "@/assets/layanan/menu-coretax.webp";
import bpjsLogo from "@/assets/layanan/menu-bpjs.webp";
import dinasLogo from "@/assets/layanan/menu-dinas.webp";
import spbeLogo from "@/assets/layanan/menu-spbe.webp";
import bankJakartaLogo from "@/assets/layanan/menu-bank-jakarta.webp";
import jakevoLogo from "@/assets/layanan/menu-jakevo.webp";
import heroBetawi from "@/assets/photos/hero-betawi.webp";
import jakSanggarSystemHero from "@/assets/photos/jak-sanggar-system.jpg";
import musikPoster from "@/assets/photos/kategori-alat-musik.webp";
import sanggarPoster from "@/assets/photos/kategori-sanggar.webp";

const SERVICES = [
  { name: "AHU", href: "https://ahu.go.id", logo: ahuLogo },
  { name: "OSS", href: "https://oss.go.id", logo: ossLogo },
  {
    name: "CORETAX",
    href: "https://coretaxdjp.pajak.go.id",
    logo: coretaxLogo,
  },
  {
    name: "BPJS Ketenagakerjaan",
    href: "https://www.bpjsketenagakerjaan.go.id",
    logo: bpjsLogo,
  },
  {
    name: "Dinas Kebudayaan",
    href: "https://dinaskebudayaan.jakarta.go.id/",
    logo: dinasLogo,
  },
  { name: "SPBE", href: "https://bakesbangpol.jakarta.go.id/", logo: spbeLogo },
  {
    name: "Bank Jakarta",
    href: "https://www.bankdki.co.id",
    logo: bankJakartaLogo,
  },
  { name: "JAK EVO", href: "https://jakevo.jakarta.go.id", logo: jakevoLogo },
];

const POSTERS = [heroBetawi, musikPoster, sanggarPoster];
// Kurator hanya boleh masuk melalui Konsol Kurator. Satu-satunya akun demo
// yang dipertahankan adalah Kurator, sehingga login utama tidak menampilkannya.
const MAIN_DEMO_ACCOUNTS = DEMO_LOGIN_ACCOUNTS.filter(
  (account) => account.role !== "kurator",
);

function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-11 shrink-0 place-items-center border border-[#dec076] bg-[#031a3f] px-3 text-center font-serif text-[clamp(22px,2.2vw,34px)] font-black tracking-[0.12em] text-[#fff9e9] shadow-[inset_0_0_0_2px_#06122d,0_2px_8px_rgba(3,26,63,0.16)] [text-shadow:0_2px_0_#000]">
      {children}
    </div>
  );
}

type MapVariant = "sanggar" | "pengrajin";

interface PublicSanggar {
  id: string;
  namaSanggar: string;
  alamat: string;
  lat: number;
  lng: number;
  jenisKesenian?: string[];
  logoDataUrl?: string;
  fotoProfileDataUrl?: string;
}

interface PublicPengrajin {
  id: string;
  namaUsaha: string;
  namaPemilik?: string;
  jenisKerajinan: string;
  produkUnggulan?: string;
  alamat: string;
  lat: number;
  lng: number;
  bentukUsaha?: string;
  noHp?: string;
  menerimaSewaJasa?: boolean;
  menerimaKerjasama?: boolean;
  produk?: Array<{ nama?: string }>;
  logoDataUrl?: string;
  fotoProfileDataUrl?: string;
}

interface PublicMitraOffline {
  id: string;
  namaUsaha: string;
  namaTokoOffline: string;
  alamatTokoOffline: string;
  latTokoOffline: number;
  lngTokoOffline: number;
  marketplace?: Array<{ url?: string; aktif?: boolean }>;
  logoDataUrl?: string;
  fotoProfileDataUrl?: string;
}

interface MapPoint {
  id: string;
  name: string;
  subtitle: string;
  kind: "Sanggar" | "Wisata" | "Pengrajin" | "Mitra" | "Sentra";
  x: number;
  y: number;
  color: string;
  lat: number;
  lng: number;
  storeId?: string;
  productCount?: number;
  menerimaSewaJasa?: boolean;
  menerimaKerjasama?: boolean;
  marketplaceUrl?: string;
  logoUrl?: string;
}

const WISATA_POINTS: MapPoint[] = [
  {
    id: "wisata-kota-tua",
    name: "Kawasan Kota Tua",
    subtitle: "Taman Sari, Jakarta Barat",
    kind: "Wisata",
    x: 43,
    y: 22,
    color: "#243b91",
    lat: -6.1352,
    lng: 106.8133,
  },
  {
    id: "wisata-monas",
    name: "Monumen Nasional",
    subtitle: "Gambir, Jakarta Pusat",
    kind: "Wisata",
    x: 53,
    y: 40,
    color: "#243b91",
    lat: -6.1754,
    lng: 106.8272,
  },
  {
    id: "wisata-setu-babakan",
    name: "Perkampungan Budaya Betawi",
    subtitle: "Setu Babakan, Jakarta Selatan",
    kind: "Wisata",
    x: 57,
    y: 76,
    color: "#243b91",
    lat: -6.3402,
    lng: 106.8218,
  },
  {
    id: "wisata-condet",
    name: "Kawasan Budaya Condet",
    subtitle: "Kramat Jati, Jakarta Timur",
    kind: "Wisata",
    x: 72,
    y: 59,
    color: "#243b91",
    lat: -6.2855,
    lng: 106.8587,
  },
  {
    id: "wisata-ancol",
    name: "Pasar Seni Ancol",
    subtitle: "Pademangan, Jakarta Utara",
    kind: "Wisata",
    x: 62,
    y: 16,
    color: "#243b91",
    lat: -6.1256,
    lng: 106.8424,
  },
];

function sanggarMapPoint(sanggar: PublicSanggar): MapPoint {
  const x = 10 + ((sanggar.lng - 106.68) / (106.98 - 106.68)) * 80;
  const y = 12 + ((-6.08 - sanggar.lat) / (-6.08 + 6.38)) * 74;
  return {
    id: `sanggar-${sanggar.id}`,
    name: sanggar.namaSanggar,
    subtitle: sanggar.alamat,
    kind: "Sanggar",
    x: Math.max(8, Math.min(92, x)),
    y: Math.max(12, Math.min(86, y)),
    color: "#0b6a34",
    lat: sanggar.lat,
    lng: sanggar.lng,
    logoUrl: sanggar.logoDataUrl ?? sanggar.fotoProfileDataUrl,
  };
}

function pengrajinMapPoint(pengrajin: PublicPengrajin): MapPoint {
  const x = 10 + ((pengrajin.lng - 106.68) / (106.98 - 106.68)) * 80;
  const y = 12 + ((-6.08 - pengrajin.lat) / (-6.08 + 6.38)) * 74;
  return {
    id: `pengrajin-${pengrajin.id}`,
    name: pengrajin.namaUsaha,
    subtitle:
      [pengrajin.jenisKerajinan, pengrajin.produkUnggulan, pengrajin.alamat]
        .filter(Boolean)
        .join(" · ") || "DKI Jakarta",
    kind: "Pengrajin",
    x: Math.max(8, Math.min(92, x)),
    y: Math.max(12, Math.min(86, y)),
    color: "#9e1d32",
    lat: pengrajin.lat,
    lng: pengrajin.lng,
    storeId: pengrajin.id,
    productCount: pengrajin.produk?.length ?? 0,
    menerimaSewaJasa: pengrajin.menerimaSewaJasa,
    menerimaKerjasama: pengrajin.menerimaKerjasama,
    logoUrl: pengrajin.logoDataUrl ?? pengrajin.fotoProfileDataUrl,
  };
}

function mitraMapPoint(mitra: PublicMitraOffline): MapPoint {
  const x = 10 + ((mitra.lngTokoOffline - 106.68) / (106.98 - 106.68)) * 80;
  const y = 12 + ((-6.08 - mitra.latTokoOffline) / (-6.08 + 6.38)) * 74;
  return {
    id: `mitra-${mitra.id}`,
    name: mitra.namaTokoOffline || mitra.namaUsaha,
    subtitle: [mitra.namaUsaha, mitra.alamatTokoOffline]
      .filter(Boolean)
      .join(" · "),
    kind: "Mitra",
    x: Math.max(8, Math.min(92, x)),
    y: Math.max(12, Math.min(86, y)),
    color: "#b7791f",
    lat: mitra.latTokoOffline,
    lng: mitra.lngTokoOffline,
    marketplaceUrl: mitra.marketplace?.find(
      (item) => item.aktif !== false && typeof item.url === "string",
    )?.url,
    logoUrl: mitra.logoDataUrl ?? mitra.fotoProfileDataUrl,
  };
}

function MapPanel({
  variant,
  sanggars = [],
  pengrajin = [],
  mitra = [],
}: {
  variant: MapVariant;
  sanggars?: PublicSanggar[];
  pengrajin?: PublicPengrajin[];
  mitra?: PublicMitraOffline[];
}) {
  const isSanggar = variant === "sanggar";
  const [query, setQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const points = useMemo(
    () =>
      isSanggar
        ? [...sanggars.map(sanggarMapPoint), ...WISATA_POINTS]
        : [...pengrajin.map(pengrajinMapPoint), ...mitra.map(mitraMapPoint)],
    [isSanggar, mitra, pengrajin, sanggars],
  );
  const visiblePoints = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return points;
    return points.filter((point) =>
      `${point.name} ${point.subtitle} ${point.kind}`
        .toLowerCase()
        .includes(term),
    );
  }, [points, query]);
  const selected = points.find((point) => point.id === selectedId);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || mapRef.current) return;

    const map = L.map(element, {
      attributionControl: false,
      center: [-6.2, 106.8167],
      doubleClickZoom: true,
      dragging: true,
      keyboard: true,
      maxBounds: [
        [-6.75, 106.25],
        [-5.55, 107.45],
      ],
      maxBoundsViscosity: 0.6,
      maxZoom: 18,
      minZoom: 9,
      scrollWheelZoom: true,
      touchZoom: true,
      zoom: 10,
      zoomControl: false,
    });
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const updateZoom = () => setZoomLevel(map.getZoom());
    map.on("zoomend", updateZoom);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver?.observe(element);
    const frame = window.requestAnimationFrame(() =>
      map.invalidateSize({ pan: false }),
    );

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      map.off("zoomend", updateZoom);
      markerRefs.current.clear();
      markerLayerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    markerRefs.current.clear();
    visiblePoints.forEach((point) => {
      const isSelected = selectedId === point.id;
      const markerNode = document.createElement("span");
      markerNode.setAttribute("aria-hidden", "true");
      markerNode.style.cssText = `display:grid;width:${isSelected ? 38 : 34}px;height:${isSelected ? 38 : 34}px;place-items:center;overflow:hidden;border:3px solid white;border-radius:50% 50% 50% 0;background:${point.color};box-shadow:0 2px 8px rgba(0,0,0,.42);color:white;transform:rotate(-45deg)`;
      const markerFace = document.createElement("span");
      markerFace.style.cssText =
        "display:grid;width:100%;height:100%;place-items:center;overflow:hidden;transform:rotate(45deg);font:800 15px/1 sans-serif";
      if (point.logoUrl) {
        const image = document.createElement("img");
        image.src = point.logoUrl;
        image.alt = "";
        image.style.cssText =
          "width:100%;height:100%;display:block;background:white;object-fit:cover";
        markerFace.appendChild(image);
      } else {
        markerFace.textContent =
          point.kind === "Wisata"
            ? "◆"
            : point.kind === "Sanggar"
              ? "S"
              : point.kind === "Pengrajin"
                ? "P"
                : "M";
      }
      markerNode.appendChild(markerFace);
      const icon = L.divIcon({
        className: "jak-sanggar-map-pin",
        html: markerNode,
        iconAnchor: [isSelected ? 19 : 17, isSelected ? 36 : 32],
        iconSize: [isSelected ? 38 : 34, isSelected ? 38 : 34],
      });
      const marker = L.marker([point.lat, point.lng], {
        alt: `${point.kind} ${point.name}`,
        icon,
        keyboard: true,
        riseOnHover: true,
        title: `${point.name} — ${point.subtitle}`,
      }).addTo(markerLayer);
      marker.on("click", () => {
        setSelectedId(point.id);
        map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 13), {
          duration: 0.45,
        });
      });
      markerRefs.current.set(point.id, marker);
    });
  }, [selectedId, visiblePoints]);

  useEffect(() => {
    const map = mapRef.current;
    const term = query.trim();
    if (!map) return;
    if (!term) {
      map.flyTo([-6.2, 106.8167], 10, { duration: 0.35 });
      return;
    }
    if (visiblePoints.length === 1) {
      const point = visiblePoints[0]!;
      map.flyTo([point.lat, point.lng], 14, { duration: 0.45 });
      return;
    }
    if (visiblePoints.length > 1) {
      map.fitBounds(
        L.latLngBounds(
          visiblePoints.map(
            (point) => [point.lat, point.lng] as [number, number],
          ),
        ),
        { animate: true, duration: 0.45, maxZoom: 13, padding: [28, 28] },
      );
    }
  }, [query, visiblePoints]);

  const changeZoom = (offset: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(Math.max(9, Math.min(18, map.getZoom() + offset)), {
      animate: true,
    });
  };

  const selectFirstSearchResult = () => {
    const point = visiblePoints[0];
    const map = mapRef.current;
    if (!point || !map) return;
    setSelectedId(point.id);
    map.flyTo([point.lat, point.lng], 14, { duration: 0.45 });
  };

  return (
    <section
      id={`map-${variant}`}
      className="relative h-[clamp(170px,25vh,245px)] shrink-0 overflow-hidden rounded-xl border border-[#d8dfe2] bg-[#edf3f5] shadow-sm"
    >
      <div className="absolute inset-x-0 top-0 z-20 flex h-8 items-center justify-center gap-2 border-b border-[#dce3e6] bg-white px-2 text-sm font-black tracking-[0.04em] text-[#0f151a]">
        <MapPin className="h-4 w-4 fill-black" />
        {isSanggar
          ? "PETA SANGGAR & WISATA BUDAYA"
          : "PETA PENGRAJIN & TOKO MITRA"}
      </div>

      <div
        ref={mapElementRef}
        role="region"
        aria-label={
          isSanggar
            ? "Peta interaktif sanggar dan wisata budaya"
            : "Peta interaktif pengrajin dan toko offline Mitra terverifikasi"
        }
        data-testid={`interactive-map-${variant}`}
        className="absolute inset-x-0 bottom-0 top-8 z-0 bg-[#eaf1f4] [&_.leaflet-control-attribution]:!bg-white/80 [&_.leaflet-control-attribution]:!px-1 [&_.leaflet-control-attribution]:!text-[6px] [&_.leaflet-control-attribution]:!leading-3"
      />
      <div className="absolute left-3 top-12 z-20 overflow-hidden rounded-md border bg-white shadow">
        <button
          type="button"
          aria-label="Perbesar peta"
          onClick={() => changeZoom(1)}
          disabled={zoomLevel >= 18}
          className="grid h-7 w-7 place-items-center border-b text-lg font-bold disabled:cursor-not-allowed disabled:opacity-35"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Perkecil peta"
          onClick={() => changeZoom(-1)}
          disabled={zoomLevel <= 9}
          className="grid h-7 w-7 place-items-center text-lg font-bold disabled:cursor-not-allowed disabled:opacity-35"
        >
          −
        </button>
      </div>
      <div className="absolute right-3 top-11 z-20 flex h-7 w-40 items-center gap-1.5 rounded-md border bg-white px-2 text-[10px] text-[#59645f] shadow-sm focus-within:border-[#0b6038] focus-within:ring-2 focus-within:ring-[#0b6038]/15">
        <Search className="h-3 w-3 shrink-0" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedId(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              selectFirstSearchResult();
            }
          }}
          aria-label={
            isSanggar
              ? "Cari sanggar atau wisata"
              : "Cari pengrajin atau toko Mitra"
          }
          placeholder={isSanggar ? "Cari lokasi…" : "Cari toko…"}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#59645f]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedId(null);
            }}
            aria-label="Hapus pencarian peta"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {query && (
        <span className="absolute right-3 top-[72px] z-20 rounded bg-white px-1.5 py-0.5 text-[8px] font-semibold text-[#334b42] shadow-sm">
          {visiblePoints.length} lokasi ditemukan
        </span>
      )}
      {!isSanggar && points.length === 0 && (
        <div className="absolute inset-x-12 bottom-3 z-20 rounded-lg border border-[#b7c8c0] bg-white p-2 text-center text-[10px] font-medium text-[#334b42] shadow-sm">
          Belum ada Pengrajin atau toko Mitra terverifikasi dengan koordinat
          yang dipublikasikan.
        </div>
      )}
      {!selected && (isSanggar || points.length > 0) && (
        <div className="absolute bottom-2 right-3 z-20 flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-[9px] shadow-sm">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 fill-[#0b6a34] text-[#0b6a34]" />
            {isSanggar ? "Sanggar" : "Pengrajin"}
          </span>
          {!isSanggar && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 fill-[#b7791f] text-[#b7791f]" />
              Toko Mitra
            </span>
          )}
          {isSanggar && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 fill-[#242279] text-[#242279]" />
              Wisata
            </span>
          )}
        </div>
      )}
      {selected && (
        <div className="absolute bottom-2 left-12 right-3 z-30 flex items-center gap-2 rounded-lg border border-[#b7c8c0] bg-white p-2 shadow-lg backdrop-blur-sm">
          <MapPin
            className="h-5 w-5 shrink-0 fill-current"
            style={{ color: selected.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-bold text-[#10251d]">
              {selected.name}
            </div>
            <div className="truncate text-[8px] text-[#52645c]">
              {selected.kind} · {selected.subtitle}
            </div>
            {selected.storeId && (
              <div className="mt-0.5 flex gap-1 text-[7px] font-semibold text-[#0b6038]">
                <span>{selected.productCount ?? 0} produk</span>
                {selected.menerimaSewaJasa && <span>· Layanan</span>}
                {selected.menerimaKerjasama && <span>· Kerja Sama</span>}
              </div>
            )}
          </div>
          {selected.storeId && (
            <Link
              href={`/toko/pengrajin/${selected.storeId}`}
              aria-label={`Buka toko ${selected.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#9e1d32] text-white"
            >
              <Store className="h-3.5 w-3.5" />
            </Link>
          )}
          {selected.marketplaceUrl && (
            <a
              href={selected.marketplaceUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Buka marketplace ${selected.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#b7791f] text-white"
            >
              <Store className="h-3.5 w-3.5" />
            </a>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Buka petunjuk arah ke ${selected.name}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#0b6038] text-white"
          >
            <Navigation className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Tutup detail lokasi"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-[#eef3f0]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}

function CommunityPanel() {
  return (
    <section className="shrink-0 overflow-hidden rounded-lg border border-[#e5e5e0] bg-white shadow-sm">
      <SectionBar>KOMUNITAS</SectionBar>
      <div id="kolaborasi" className="grid grid-cols-4 gap-1.5 p-1.5">
        {SERVICES.map((service) => (
          <a
            key={service.name}
            href={service.href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Buka layanan ${service.name}`}
            className="group overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6038]"
          >
            <img
              src={service.logo}
              alt={service.name}
              className="h-[78px] w-full object-contain transition group-hover:scale-[1.025] 2xl:h-[92px]"
            />
          </a>
        ))}
      </div>
    </section>
  );
}

type MediaFilter = "Semua" | "Video" | "Foto" | "Musik";

function matchesMediaFilter(item: InfoBudaya, filter: MediaFilter) {
  if (filter === "Semua") return true;
  const kind = creativeMediaKind(item);
  if (filter === "Video") return kind === "youtube" || kind === "video";
  if (filter === "Musik")
    return (
      kind === "audio" ||
      kind === "spotify" ||
      kind === "soundcloud" ||
      (item.kategori === "Musik" && (kind === "youtube" || kind === "video"))
    );
  return kind === "image";
}

function posterFor(item: InfoBudaya, index: number) {
  if (item.imageDataUrl) return item.imageDataUrl;
  if (item.imageUrl) return item.imageUrl;
  return POSTERS[index % POSTERS.length];
}

function playbackStatusText(
  kind: ReturnType<typeof creativeMediaKind>,
  state: MediaPlaybackState,
  muted: boolean,
) {
  if (kind === "image") return "Galeri foto budaya";
  if (kind === "link") return "Tautan media siap dibuka";
  if (state === "playing")
    return muted ? "Diputar otomatis tanpa suara" : "Sedang diputar";
  if (state === "blocked") return "Tekan Putar untuk memulai";
  if (state === "paused") return "Media dijeda";
  if (state === "ended") return "Pemutaran selesai";
  if (state === "error") return "Media gagal dimuat";
  if (state === "ready") return "Pemutar siap · gunakan kontrol media";
  return "Memuat media…";
}

function MediaKreatif({ items }: { items: InfoBudaya[] }) {
  const [filter, setFilter] = useState<MediaFilter>("Semua");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playbackState, setPlaybackState] =
    useState<MediaPlaybackState>("idle");
  const visible = useMemo(
    () => items.filter((item) => matchesMediaFilter(item, filter)),
    [items, filter],
  );
  const current = visible.length ? visible[active % visible.length] : null;
  const currentKind = current ? creativeMediaKind(current) : "image";
  const visibleSignature = visible
    .map((item) => `${item.id}:${creativeMediaKind(item)}`)
    .join("|");

  useEffect(() => {
    const autoplayIndex = visible.findIndex((item) =>
      ["youtube", "audio", "video", "soundcloud"].includes(
        creativeMediaKind(item),
      ),
    );
    setActive(autoplayIndex >= 0 ? autoplayIndex : 0);
    setPaused(false);
    setMuted(true);
  }, [filter, visibleSignature]);

  useEffect(() => {
    if (
      paused ||
      visible.length <= 1 ||
      (currentKind !== "image" && currentKind !== "link")
    )
      return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % visible.length),
      7000,
    );
    return () => window.clearTimeout(timer);
  }, [active, currentKind, paused, visible.length]);

  const next = (offset: number) => {
    if (!visible.length) return;
    setMuted(true);
    setActive((index) => (index + offset + visible.length) % visible.length);
  };

  const displayCurrent = current
    ? {
        ...current,
        imageUrl: posterFor(current, active),
        imageDataUrl: undefined,
      }
    : null;
  const sideOffsets = Array.from(
    { length: Math.min(2, Math.max(0, visible.length - 1)) },
    (_, index) => index + 1,
  );
  const mediaStatus = playbackStatusText(currentKind, playbackState, muted);
  const canControlSound = ["youtube", "audio", "video"].includes(currentKind);
  const progress = visible.length
    ? (((active % visible.length) + 1) / visible.length) * 100
    : 0;

  return (
    <section
      id="media"
      className="flex min-h-[250px] flex-1 flex-col overflow-hidden rounded-lg border border-[#e1e5e2] bg-white p-2 shadow-sm"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="mr-auto text-lg font-black tracking-[-0.03em] text-[#0b1726]">
          Media Kreatif
        </h2>
        <div className="flex overflow-hidden rounded-md border bg-[#f7f8f8] text-[9px] font-medium">
          {(["Semua", "Video", "Foto", "Musik"] as MediaFilter[]).map(
            (name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setFilter(name);
                  setPaused(false);
                  setMuted(true);
                }}
                className={`px-2 py-1 ${filter === name ? "bg-[#031a3f] text-white" : "text-[#26384b] hover:bg-white"}`}
              >
                {name}
              </button>
            ),
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#031a3f] px-2 py-1 text-[9px] font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
          {visible.length} karya
        </span>
      </div>

      {displayCurrent ? (
        <>
          <div
            className={`grid min-h-0 flex-1 gap-1.5 ${sideOffsets.length ? "grid-cols-[1.55fr_.95fr]" : "grid-cols-1"}`}
          >
            <div className="relative min-h-0 overflow-hidden rounded-lg bg-[#071d18]">
              <CreativeMediaPlayer
                key={displayCurrent.id}
                item={displayCurrent}
                autoplay={!paused}
                muted={muted}
                onEnded={() => next(1)}
                onPlaybackStateChange={setPlaybackState}
                className="absolute inset-0 h-full w-full"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 text-white">
                <div className="text-sm font-bold leading-tight">
                  {displayCurrent.judul}
                </div>
                <div className="mt-0.5 text-[9px] text-white/75">
                  {displayCurrent.kategori} · Sajian terbaru
                </div>
              </div>
            </div>
            {sideOffsets.length > 0 && (
              <div
                className={`grid min-h-0 gap-1.5 ${sideOffsets.length === 1 ? "grid-rows-1" : "grid-rows-2"}`}
              >
                {sideOffsets.map((offset) => {
                  const item = visible[(active + offset) % visible.length];
                  if (!item) return null;
                  return (
                    <button
                      key={`${item.id}-${offset}`}
                      type="button"
                      onClick={() => next(offset)}
                      className="relative overflow-hidden rounded-lg bg-[#102b22] text-left text-white"
                      style={{
                        backgroundImage: `url(${posterFor(item, active + offset)}), url(${POSTERS[(active + offset) % POSTERS.length]})`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                      }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 p-2 text-[10px] font-bold leading-tight">
                        {item.judul}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-1.5 flex h-10 shrink-0 items-center gap-2 rounded-lg border bg-white px-2">
            <img
              src={posterFor(displayCurrent, active)}
              alt=""
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = POSTERS[active % POSTERS.length];
              }}
              className="h-8 w-8 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-bold text-[#16251f]">
                {displayCurrent.judul}
              </div>
              <div className="truncate text-[8px] text-[#6d7772]">
                {mediaStatus}
              </div>
            </div>
            <button
              type="button"
              onClick={() => next(-1)}
              aria-label="Media sebelumnya"
              disabled={visible.length <= 1}
              className="disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {(currentKind === "image" || currentKind === "link") && (
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? "Putar carousel" : "Jeda carousel"}
                className="grid h-7 w-7 place-items-center rounded-full bg-[#031a3f] text-white"
              >
                {paused ? (
                  <Play className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => next(1)}
              aria-label="Media berikutnya"
              disabled={visible.length <= 1}
              className="disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span
              role="progressbar"
              aria-label="Posisi media"
              aria-valuemin={1}
              aria-valuemax={Math.max(1, visible.length)}
              aria-valuenow={visible.length ? (active % visible.length) + 1 : 1}
              className="h-1 w-16 overflow-hidden rounded-full bg-[#d5ded9]"
            >
              <span
                className="block h-full rounded-full bg-[#0d7950] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="text-[8px] tabular-nums text-[#607068]">
              {visible.length ? (active % visible.length) + 1 : 0}/
              {visible.length}
            </span>
            {canControlSound && playbackState !== "error" && (
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Aktifkan suara" : "Matikan suara"}
                title={muted ? "Aktifkan suara" : "Matikan suara"}
                className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#eef3f0]"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center rounded-lg bg-[#eef3f0] text-sm text-[#607068]">
          Belum ada media untuk kategori ini.
        </div>
      )}
    </section>
  );
}

function BrandHero() {
  return (
    <section className="relative shrink-0 overflow-hidden rounded-lg bg-[#031a3f] shadow-sm">
      <img
        src={jakSanggarSystemHero}
        alt="Jak Sanggar — Komunitas dan Masyarakat"
        className="block h-auto w-full"
      />
      <div
        id="tradisi-lisan-image-anchor"
        aria-label="Posisi Tradisi Lisan pada gambar Jak Sanggar"
        className="pointer-events-none absolute inset-0 z-20"
      />
    </section>
  );
}

function StoreBadge({ kind }: { kind: "play" | "apple" }) {
  const { toast } = useToast();
  const install = async () => {
    if (isStandalone()) {
      toast({ title: "Jak Sanggar sudah terpasang di perangkat ini." });
      return;
    }
    if (kind === "play") {
      const prompt = getDeferredInstallPrompt();
      if (prompt) {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        toast({
          title:
            choice.outcome === "accepted"
              ? "Pemasangan Jak Sanggar dimulai"
              : "Pemasangan dibatalkan",
        });
        return;
      }
      toast({
        title: "Pasang di Android",
        description:
          "Buka menu Chrome (tiga titik), lalu pilih Pasang aplikasi.",
      });
      return;
    }
    toast({
      title: "Pasang di iPhone",
      description:
        "Buka di Safari, tekan Bagikan, lalu pilih Tambahkan ke Layar Utama.",
    });
  };
  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label={kind === "apple" ? "Pasang di iPhone" : "Pasang di Android"}
      className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#172a4b] bg-white px-3 text-[#111] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {kind === "apple" ? (
        <Apple className="h-5 w-5 fill-black" />
      ) : (
        <Smartphone className="h-5 w-5 text-[#1b9b54]" />
      )}
      <span className="leading-none">
        <span className="block text-[7px] uppercase">
          {kind === "apple" ? "Download di" : "Dapatkan di"}
        </span>
        <span className="block text-xs font-semibold">
          {kind === "apple" ? "App Store" : "Google Play"}
        </span>
      </span>
    </button>
  );
}

interface LoginCardProps {
  username: string;
  password: string;
  showPassword: boolean;
  busy: boolean;
  verified: boolean;
  verificationRequired: boolean;
  showDemoAccounts: boolean;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  setVerified: (value: boolean) => void;
  setHelpOpen: (value: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDemoLogin: (account: DemoLoginAccount) => void;
}

function LoginCard(props: LoginCardProps) {
  const t = useT();
  const demoRoles = useMemo(
    () =>
      Array.from(
        new Map(
          MAIN_DEMO_ACCOUNTS.map((account) => [
            account.role,
            account.label.split(" · ")[0],
          ]),
        ),
      ),
    [],
  );
  const [selectedDemoRole, setSelectedDemoRole] = useState(
    MAIN_DEMO_ACCOUNTS[0]?.role ?? "sanggar",
  );
  const visibleDemoAccounts = useMemo(
    () =>
      MAIN_DEMO_ACCOUNTS.filter((account) => account.role === selectedDemoRole),
    [selectedDemoRole],
  );
  return (
    <section
      id="masuk"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-[#e1e2de] bg-white p-3 shadow-sm"
    >
      <h1 className="text-xl font-black leading-tight tracking-[-0.04em] text-[#0b1630]">
        Selamat Datang
      </h1>
      <p className="text-xs text-[#364139]">
        Masuk untuk mengelola layanan Jak Sanggar
      </p>
      <form onSubmit={props.onSubmit} className="mt-1.5 space-y-1.5">
        <div>
          <label
            htmlFor="portal-username"
            className="mb-0.5 block text-[11px] font-semibold"
          >
            Nama Pengguna
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-current text-[#07162f]" />
            <input
              id="portal-username"
              value={props.username}
              onChange={(event) => props.setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Masukkan nama pengguna"
              required
              data-testid="input-username"
              className="h-9 w-full rounded-md border border-[#c8d2db] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#0a603a] focus:ring-2 focus:ring-[#0a603a]/15"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="portal-password"
            className="mb-0.5 block text-[11px] font-semibold"
          >
            Kata Sandi
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-current text-[#07162f]" />
            <input
              id="portal-password"
              type={props.showPassword ? "text" : "password"}
              value={props.password}
              onChange={(event) => props.setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              required
              data-testid="input-password"
              className="h-9 w-full rounded-md border border-[#c8d2db] bg-white pl-10 pr-10 text-sm outline-none focus:border-[#0a603a] focus:ring-2 focus:ring-[#0a603a]/15"
            />
            <button
              type="button"
              onClick={() => props.setShowPassword((value) => !value)}
              aria-label={
                props.showPassword
                  ? "Sembunyikan kata sandi"
                  : "Tampilkan kata sandi"
              }
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center"
            >
              {props.showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-0.5 text-right leading-none">
            <Link
              href="/lupa-password"
              className="text-[11px] font-medium text-[#07552f] hover:underline"
            >
              Lupa Password?
            </Link>
          </div>
        </div>
        {props.verificationRequired ? (
          <HumanCheck onVerifiedChange={props.setVerified} />
        ) : (
          <div className="rounded-md border border-[#0a653c]/25 bg-[#eef7f1] px-3 py-2 text-center text-[11px] font-medium text-[#0a4e31]">
            Akun demo dikenali — verifikasi manusia dilewati.
          </div>
        )}
        <button
          type="submit"
          disabled={
            props.busy || (props.verificationRequired && !props.verified)
          }
          data-testid="button-login"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-[#ffa91f] to-[#f18800] text-lg font-black tracking-[0.08em] text-[#07214b] shadow-[inset_0_1px_0_rgba(255,255,255,.6)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {props.busy ? (
            <TumpalSpinner size={18} />
          ) : (
            <LockKeyhole className="h-5 w-5 fill-current" />
          )}
          {props.busy ? t("Memverifikasi...") : "MASUK"}
        </button>
      </form>
      {props.showDemoAccounts && MAIN_DEMO_ACCOUNTS.length > 0 && (
        <div className="mt-2 rounded-lg border border-[#d8bd72] bg-white p-2">
          <div className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#62470b]">
            Masuk cepat akun demo
          </div>
          <div className="mb-2 flex flex-wrap justify-center gap-1">
            {demoRoles.map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedDemoRole(role)}
                aria-pressed={selectedDemoRole === role}
                className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                  selectedDemoRole === role
                    ? "border-[#0a653c] bg-[#0a653c] text-white"
                    : "border-[#d8bd72] bg-white text-[#62470b] hover:border-[#0a653c]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {visibleDemoAccounts.map((account) => (
              <button
                key={account.username}
                type="button"
                disabled={props.busy}
                onClick={() => props.onDemoLogin(account)}
                data-testid={`button-demo-${account.username.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                className="rounded-md border border-[#d8bd72] bg-white px-2 py-1.5 text-left transition hover:border-[#0a653c] hover:bg-[#eef7f1] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="block text-[11px] font-bold text-[#0a4e31]">
                  {account.label}
                </span>
                <span className="block truncate text-[10px] text-[#615b4a]">
                  {account.username}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[#665a38]">
            Sepuluh skenario per tipe akun. Klik untuk masuk pada tab ini.
          </p>
        </div>
      )}
      <div className="mt-1.5 text-center text-[11px] text-[#404b46]">
        Belum memiliki akun?
      </div>
      <div className="mt-1">
        <Link
          href="/daftar"
          data-testid="link-pendaftaran"
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-[#0a653c] px-3 text-[11px] font-bold text-[#0a4e31] transition-colors hover:bg-[#eef7f1]"
        >
          <UserPlus className="h-3.5 w-3.5" /> PENDAFTARAN
        </Link>
      </div>
      <button
        type="button"
        onClick={() => props.setHelpOpen(true)}
        className="mt-1.5 flex h-8 items-center gap-3 rounded-md border border-[#d5dcd8] px-4 text-left text-[11px] hover:bg-[#f5f8f6]"
      >
        <Headphones className="h-5 w-5" />
        <span className="flex-1">
          Butuh Bantuan?{" "}
          <strong className="ml-1 text-[#083c80]">Tanya BangDipta</strong>
        </span>
        <ArrowRight className="h-4 w-4" />
      </button>
      <div className="mt-auto grid grid-cols-2 gap-4 pt-2">
        <StoreBadge kind="play" />
        <StoreBadge kind="apple" />
      </div>
    </section>
  );
}

type NewsFilter = "Semua" | NewsKategori;

interface PublicMenuItem {
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  newsFilter?: NewsFilter;
}

const PUBLIC_MENU: PublicMenuItem[] = [
  { label: "Beranda", icon: Landmark, href: "#masuk", color: "#ef3f2c" },
  {
    label: "Direktori Sanggar",
    icon: MapPin,
    href: "#direktori-sanggar",
    color: "#067434",
  },
  {
    label: "Pendaftaran Akun",
    icon: FileCheck2,
    href: "/daftar",
    color: "#174ae5",
  },
  {
    label: "Agenda dan Regulasi",
    icon: CalendarDays,
    href: "#berita",
    color: "#ff4b1f",
    newsFilter: "Agenda",
  },
  {
    label: "Pembinaan dan Sertifikasi",
    icon: GraduationCap,
    href: "#berita",
    color: "#172139",
    newsFilter: "Pengumuman",
  },
  {
    label: "Karya dan Galeri Kreatif",
    icon: Palette,
    href: "#media",
    color: "#2b279b",
  },
  {
    label: "Berita & Pengumuman",
    icon: Megaphone,
    href: "#berita",
    color: "#1669db",
    newsFilter: "Semua",
  },
  { label: "Bantuan", icon: HelpCircle, href: "#bantuan", color: "#125430" },
  {
    label: "Program dan Kegiatan",
    icon: Users,
    href: "#berita",
    color: "#f15a24",
    newsFilter: "Agenda",
  },
];

function MasyarakatPanel({
  onHelp,
  onDirectory,
  onNewsFilter,
}: {
  onHelp: () => void;
  onDirectory: () => void;
  onNewsFilter: (filter: NewsFilter) => void;
}) {
  return (
    <section className="shrink-0 overflow-hidden rounded-lg border border-[#e3e4df] bg-white shadow-sm">
      <SectionBar>MASYARAKAT</SectionBar>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {PUBLIC_MENU.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="h-7 w-7" style={{ color: item.color }} />
              <span className="text-center text-[9px] font-semibold leading-tight text-[#102a5a]">
                {item.label}
              </span>
            </>
          );
          const className =
            "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border border-[#edf0ed] bg-white px-1 shadow-[0_1px_4px_rgba(20,40,30,.05)] transition hover:-translate-y-0.5 hover:border-[#b9cbc1] hover:shadow";
          if (item.label === "Direktori Sanggar")
            return (
              <button id="open-sanggar-directory" key={item.label} type="button" onClick={onDirectory} className={className} aria-haspopup="dialog">
                {content}
              </button>
            );
          if (item.label === "Bantuan")
            return (
              <button
                id="bantuan"
                key={item.label}
                type="button"
                onClick={onHelp}
                className={className}
              >
                {content}
              </button>
            );
          if (item.newsFilter)
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onNewsFilter(item.newsFilter!);
                  document
                    .getElementById("berita")
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
                className={className}
              >
                {content}
              </button>
            );
          if (item.href.startsWith("/"))
            return (
              <Link key={item.label} href={item.href} className={className}>
                {content}
              </Link>
            );
          return (
            <a key={item.label} href={item.href} className={className}>
              {content}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function newsGroup(item: News): NewsKategori {
  if (
    item.kategori === "Berita" ||
    item.kategori === "Pengumuman" ||
    item.kategori === "Agenda"
  )
    return item.kategori;
  const text = `${item.judul} ${item.isi}`.toLowerCase();
  if (/pengumuman|pendaftaran|sertifikasi|kurasi/.test(text))
    return "Pengumuman";
  if (/agenda|jadwal|festival|kegiatan/.test(text)) return "Agenda";
  return "Berita";
}

function BeritaPanel({
  items,
  filter,
  onFilterChange,
}: {
  items: News[];
  filter: NewsFilter;
  onFilterChange: (filter: NewsFilter) => void;
}) {
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const visible = items.filter(
    (item) => filter === "Semua" || newsGroup(item) === filter,
  );
  const featured = visible[0];
  return (
    <>
      <section
        id="berita"
        className="flex min-h-[255px] flex-1 flex-col overflow-hidden rounded-lg border border-[#e2e5e2] bg-white p-2 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <h2 className="mr-auto text-lg font-black tracking-[-0.03em] text-[#111c2b]">
            Berita & Pengumuman
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#031a3f] px-2 py-1 text-[9px] font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {visible.length} publikasi
          </span>
        </div>
        <div className="mt-1 flex w-fit overflow-hidden rounded-md border bg-[#f7f8f8] text-[9px]">
          {(["Semua", "Berita", "Pengumuman", "Agenda"] as NewsFilter[]).map(
            (name) => (
              <button
                key={name}
                type="button"
                onClick={() => onFilterChange(name)}
                aria-pressed={filter === name}
                className={`px-2.5 py-1 ${filter === name ? "bg-[#031a3f] font-semibold text-white" : "text-[#183254] hover:bg-white"}`}
              >
                {name}
              </button>
            ),
          )}
        </div>
        {featured ? (
          <div className="mt-1.5 grid min-h-0 flex-1 grid-cols-[1.18fr_.92fr] gap-2">
            <button
              type="button"
              onClick={() => setSelectedNews(featured)}
              className="flex min-h-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174ee4]/40"
              aria-label={`Buka ${newsGroup(featured)} ${featured.judul}`}
            >
              <span
                className="relative min-h-[80px] w-full flex-1 overflow-hidden rounded-md bg-cover bg-center"
                style={{
                  backgroundImage: `url(${featured.imageUrl || heroBetawi})`,
                }}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-[#174ee4] px-1.5 py-0.5 text-[8px] font-semibold text-white">
                  {newsGroup(featured)}
                </span>
              </span>
              <h3 className="mt-1.5 text-sm font-bold leading-tight text-[#111d2b]">
                {featured.judul}
              </h3>
              <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-[#334d7d]">
                {featured.isi}
              </p>
              <span className="mt-auto flex w-full items-center justify-between pt-1.5 text-[9px] text-[#38528a]">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {fmtDate(featured.createdAt)}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
            <div className="min-h-0 divide-y overflow-y-auto rounded-md border">
              {visible.slice(1).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedNews(item)}
                  className="flex w-full gap-2 p-2 text-left transition hover:bg-[#f5f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#174ee4]/40"
                  aria-label={`Buka ${newsGroup(item)} ${item.judul}`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#fff2e9] text-[#f15a24]">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[10px] font-bold leading-4 text-[#15233b]">
                      {item.judul}
                    </span>
                    <span className="line-clamp-2 text-[8px] leading-3 text-[#53647a]">
                      {item.isi}
                    </span>
                    <span className="mt-0.5 block text-[8px] text-[#53647a]">
                      {newsGroup(item)} · {fmtDate(item.createdAt)}
                    </span>
                  </span>
                  <ArrowRight className="mt-2 h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 grid flex-1 place-items-center rounded-md bg-[#f2f5f3] px-4 text-center text-sm text-[#607068]">
            Belum ada {filter === "Semua" ? "publikasi" : filter.toLowerCase()}.
          </div>
        )}
      </section>

      <Dialog
        open={selectedNews !== null}
        onOpenChange={(open) => !open && setSelectedNews(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selectedNews && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedNews.judul}</DialogTitle>
                <DialogDescription>
                  {newsGroup(selectedNews)} · {fmtDate(selectedNews.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <img
                src={selectedNews.imageUrl || heroBetawi}
                alt={selectedNews.judul}
                className="max-h-64 w-full rounded-xl object-cover"
              />
              <p className="whitespace-pre-line text-sm leading-6 text-[#33423b]">
                {selectedNews.isi}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PortalLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [publicBudaya, setPublicBudaya] = useState<InfoBudaya[] | null>(null);
  const [publicNews, setPublicNews] = useState<News[] | null>(null);
  const [publicSanggars, setPublicSanggars] = useState<PublicSanggar[]>([]);
  const [publicPengrajin, setPublicPengrajin] = useState<
    PublicPengrajin[] | null
  >(null);
  const [publicMitra, setPublicMitra] = useState<PublicMitraOffline[] | null>(
    null,
  );
  const [newsFilter, setNewsFilter] = useState<NewsFilter>("Semua");
  const { login } = useAuth();
  const db = useDb();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const localPublicSanggars = useMemo(
    () =>
      db.users
        .filter(
          (item): item is SanggarUser =>
            item.role === "sanggar" &&
            !!item.alamat?.trim() &&
            typeof item.lat === "number" &&
            Number.isFinite(item.lat) &&
            typeof item.lng === "number" &&
            Number.isFinite(item.lng),
        )
        .map((item) => ({
          id: item.apiId ?? item.id,
          namaSanggar: item.namaSanggar,
          alamat: item.alamat,
          lat: item.lat!,
          lng: item.lng!,
          jenisKesenian: item.jenisKesenian,
          logoDataUrl: item.logoDataUrl,
          fotoProfileDataUrl: item.fotoProfileDataUrl,
        })),
    [db.users],
  );
  const localPublicPengrajin = useMemo(
    () =>
      db.users
        .filter(
          (item): item is PengrajinUser =>
            item.role === "pengrajin" && item.tokoDipublikasikan !== false,
        )
        .map((item) => ({
          id: item.apiId ?? item.id,
          namaUsaha: item.namaUsaha,
          namaPemilik: item.namaPemilik,
          jenisKerajinan: item.jenisKerajinan,
          produkUnggulan: item.produkUnggulan,
          alamat: item.alamat,
          lat: item.lat,
          lng: item.lng,
          bentukUsaha: item.bentukUsaha,
          noHp: item.noHp,
          menerimaSewaJasa: item.menerimaSewaJasa,
          menerimaKerjasama: item.menerimaKerjasama,
          logoDataUrl: item.logoDataUrl,
          fotoProfileDataUrl: item.fotoProfileDataUrl,
          produk: (item.produk ?? [])
            .filter((produk) => produk.statusPublish)
            .map((produk) => ({ nama: produk.nama })),
        })),
    [db.users],
  );
  const localDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const localPublicMitra = useMemo(
    () =>
      db.users
        .filter(
          (item): item is MitraPengrajinUser =>
            item.role === "mitra_pengrajin" &&
            item.statusVerifikasiTokoOffline === "terverifikasi" &&
            typeof item.latTokoOffline === "number" &&
            typeof item.lngTokoOffline === "number",
        )
        .map((item) => ({
          id: item.apiId ?? item.id,
          namaUsaha: item.namaUsaha,
          namaTokoOffline: item.namaTokoOffline ?? item.namaUsaha,
          alamatTokoOffline: item.alamatTokoOffline ?? item.alamat,
          latTokoOffline: item.latTokoOffline!,
          lngTokoOffline: item.lngTokoOffline!,
          marketplace: item.marketplace,
          logoDataUrl: item.logoDataUrl,
        })),
    [db.users],
  );
  const mapPengrajin = useMemo(() => {
    if (!localDemoMode) return publicPengrajin ?? [];
    // Demo lokal harus selalu memakai ID store lokal agar marker peta membuka
    // profil/toko Pengrajin pada browser yang sama. Data API hanya melengkapi
    // nama yang belum tersedia di store lokal.
    const merged = new Map<string, PublicPengrajin>();
    for (const item of localPublicPengrajin) {
      merged.set(item.namaUsaha.trim().toLowerCase(), item);
    }
    for (const item of publicPengrajin ?? []) {
      const key = item.namaUsaha.trim().toLowerCase();
      if (!merged.has(key)) merged.set(key, item);
    }
    return [...merged.values()];
  }, [localDemoMode, localPublicPengrajin, publicPengrajin]);
  const mapMitra = useMemo(() => {
    if (!localDemoMode) return publicMitra ?? [];
    const merged = new Map<string, PublicMitraOffline>();
    for (const item of localPublicMitra) {
      merged.set(item.namaTokoOffline.trim().toLowerCase(), item);
    }
    for (const item of publicMitra ?? []) {
      const key = item.namaTokoOffline.trim().toLowerCase();
      if (!merged.has(key)) merged.set(key, item);
    }
    return [...merged.values()];
  }, [localDemoMode, localPublicMitra, publicMitra]);
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const showDemoAccounts =
    import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true" && isLocalHost;
  const isDemoAccount =
    showDemoAccounts && LOCAL_DEMO_USERNAMES.has(username.trim().toLowerCase());
  const verificationRequired = !isDemoAccount;
  useEffect(() => {
    let cancelled = false;
    const refreshPublicContent = async () => {
      const [
        budayaResult,
        newsResult,
        sanggarResult,
        pengrajinResult,
        mitraResult,
      ] = await Promise.allSettled([
        publicContentApi.infoBudaya(),
        publicContentApi.news(),
        publicContentApi.sanggars(),
        publicContentApi.pengrajin(),
        publicContentApi.mitraPengrajin(),
      ]);
      if (cancelled) return;
      if (budayaResult.status === "fulfilled") {
        const valid = budayaResult.value
          .filter(
            (record) =>
              typeof record["id"] === "string" &&
              typeof record["judul"] === "string" &&
              typeof record["ringkasan"] === "string" &&
              typeof record["isi"] === "string" &&
              typeof record["kategori"] === "string" &&
              record["active"] === true,
          )
          .map((record) => record as unknown as InfoBudaya);
        setPublicBudaya(valid);
      }
      if (newsResult.status === "fulfilled") {
        const valid = newsResult.value
          .filter(
            (record) =>
              typeof record["id"] === "string" &&
              typeof record["judul"] === "string" &&
              typeof record["isi"] === "string" &&
              typeof record["createdAt"] === "number",
          )
          .map((record) => record as unknown as News);
        setPublicNews(valid);
      }
      if (sanggarResult.status === "fulfilled") {
        const valid = sanggarResult.value
          .filter(
            (record) =>
              typeof record["id"] === "string" &&
              typeof record["namaSanggar"] === "string" &&
              typeof record["alamat"] === "string" &&
              record["alamat"].trim().length > 0 &&
              typeof record["lat"] === "number" &&
              Number.isFinite(record["lat"]) &&
              typeof record["lng"] === "number" &&
              Number.isFinite(record["lng"]),
          )
          .map((record) => record as unknown as PublicSanggar);
        setPublicSanggars(valid);
      }
      if (pengrajinResult.status === "fulfilled") {
        const valid = pengrajinResult.value
          .filter(
            (record) =>
              typeof record["id"] === "string" &&
              typeof record["namaUsaha"] === "string" &&
              typeof record["jenisKerajinan"] === "string" &&
              typeof record["alamat"] === "string" &&
              typeof record["lat"] === "number" &&
              Number.isFinite(record["lat"]) &&
              typeof record["lng"] === "number" &&
              Number.isFinite(record["lng"]),
          )
          .map((record) => record as unknown as PublicPengrajin);
        setPublicPengrajin(valid);
      }
      if (mitraResult.status === "fulfilled") {
        const valid = mitraResult.value
          .filter(
            (record) =>
              typeof record["id"] === "string" &&
              typeof record["namaUsaha"] === "string" &&
              typeof record["namaTokoOffline"] === "string" &&
              typeof record["alamatTokoOffline"] === "string" &&
              record["statusVerifikasiTokoOffline"] === "terverifikasi" &&
              typeof record["latTokoOffline"] === "number" &&
              Number.isFinite(record["latTokoOffline"]) &&
              typeof record["lngTokoOffline"] === "number" &&
              Number.isFinite(record["lngTokoOffline"]),
          )
          .map((record) => record as unknown as PublicMitraOffline);
        setPublicMitra(valid);
      }
    };
    void refreshPublicContent();
    const timer = window.setInterval(refreshPublicContent, 30_000);
    const refreshOnFocus = () => void refreshPublicContent();
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void refreshPublicContent();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, []);

  const budaya = useMemo(() => {
    // Setelah request publik berhasil (termasuk hasil kosong), server adalah
    // sumber utama. Store lokal hanya menjadi fallback saat server belum bisa
    // dijangkau, bukan digabung berdasarkan judul/isi yang dapat berubah.
    const source = publicBudaya ?? db.infoBudaya;
    const byId = new Map<string, InfoBudaya>();
    for (const item of source) {
      if (!item.active) continue;
      byId.set(item.id, item);
    }
    return [...byId.values()].sort(
      (a, b) => a.order - b.order || b.createdAt - a.createdAt,
    );
  }, [db.infoBudaya, publicBudaya]);
  const berita = useMemo(() => {
    // Begitu endpoint publik berhasil (termasuk hasil kosong), server menjadi
    // sumber utama. Data demo/cache lokal tidak boleh membangkitkan kembali
    // berita yang sudah ditombstone di database.
    const source = publicNews ?? db.news;
    const byId = new Map<string, News>();
    for (const item of source) byId.set(item.id, item);
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [db.news, publicNews]);
  const sanggars = useMemo(() => {
    // Produksi hanya memakai akun database dari endpoint publik. Seed lokal
    // tidak boleh muncul kembali sebagai Sanggar demo di peta.
    return localDemoMode ? localPublicSanggars : publicSanggars;
  }, [localDemoMode, localPublicSanggars, publicSanggars]);

  const submitCredentials = async (
    loginUsername: string,
    loginPassword: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const user = await login(loginUsername.trim(), loginPassword);
      if (!user) {
        toast({
          title: t("Gagal masuk"),
          description: t("Username atau password tidak cocok."),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: `${t("Selamat Datang Kembali")}, ${(user as any).namaUsaha || (user as any).namaSanggar || (user as any).nama || user.username}`,
      });
      navigate(roleHomePath(user.role));
    } catch (error) {
      console.error("Login error", error);
      const description =
        error instanceof ApiError
          ? error.status >= 500
            ? "Server sedang bermasalah. Coba lagi beberapa saat."
            : error.message
          : error instanceof TypeError
            ? "Server tidak dapat dihubungi. Pastikan API aktif dan koneksi jaringan tersedia."
            : error instanceof Error && error.message
              ? error.message
              : "Server tidak dapat dihubungi.";
      toast({
        title: t("Gagal masuk"),
        description: t(description),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (verificationRequired && !verified) {
      toast({
        title: t("Selesaikan verifikasi terlebih dahulu."),
        variant: "destructive",
      });
      return;
    }
    await submitCredentials(username, password);
  };

  const onDemoLogin = async (account: DemoLoginAccount) => {
    if (busy) return;
    setUsername(account.username);
    setPassword(account.password);
    setVerified(true);
    await submitCredentials(account.username, account.password);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-[#101916]">
      <main className="grid min-h-screen gap-1.5 p-1.5 xl:h-screen xl:grid-cols-[1fr_1.05fr_1fr] xl:overflow-hidden">
        <div className="order-2 flex min-h-0 flex-col gap-1.5 xl:order-1 xl:h-full">
          <MapPanel variant="sanggar" sanggars={sanggars} />
          <CommunityPanel />
          <MediaKreatif items={budaya} />
        </div>

        <div className="order-1 flex min-h-0 flex-col gap-1.5 xl:order-2 xl:h-full">
          <BrandHero />
          <LoginCard
            username={username}
            password={password}
            showPassword={showPassword}
            busy={busy}
            verified={verified}
            verificationRequired={verificationRequired}
            showDemoAccounts={showDemoAccounts}
            setUsername={setUsername}
            setPassword={setPassword}
            setShowPassword={setShowPassword}
            setVerified={setVerified}
            setHelpOpen={setHelpOpen}
            onSubmit={onSubmit}
            onDemoLogin={(account) => void onDemoLogin(account)}
          />
        </div>

        <div className="order-3 flex min-h-0 flex-col gap-1.5 xl:h-full">
          <MapPanel
            variant="pengrajin"
            pengrajin={mapPengrajin}
            mitra={mapMitra}
          />
          <MasyarakatPanel
            onHelp={() => setHelpOpen(true)}
            onDirectory={() => setDirectoryOpen(true)}
            onNewsFilter={setNewsFilter}
          />
          <BeritaPanel
            items={berita}
            filter={newsFilter}
            onFilterChange={setNewsFilter}
          />
        </div>
      </main>

      <PublicSanggarDirectory open={directoryOpen} onOpenChange={setDirectoryOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bantuan BangDipta</DialogTitle>
            <DialogDescription>
              Pilih bantuan yang Abang/Mpok perlukan untuk mulai menggunakan Jak
              Sanggar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <Link
              href="/lupa-password"
              onClick={() => setHelpOpen(false)}
              className="rounded-xl border border-[#dce5e0] p-4 transition hover:border-[#82a693] hover:bg-[#f5faf7]"
            >
              <span className="block font-semibold text-[#103426]">
                Lupa kata sandi
              </span>
              <span className="mt-1 block text-sm text-[#526059]">
                Minta kode OTP dan buat kata sandi baru.
              </span>
            </Link>
            <Link
              href="/daftar"
              onClick={() => setHelpOpen(false)}
              className="rounded-xl border border-[#dce5e0] p-4 transition hover:border-[#82a693] hover:bg-[#f5faf7]"
            >
              <span className="block font-semibold text-[#103426]">
                Belum punya akun
              </span>
              <span className="mt-1 block text-sm text-[#526059]">
                Daftar sesuai peran dan kebutuhan Abang/Mpok.
              </span>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
