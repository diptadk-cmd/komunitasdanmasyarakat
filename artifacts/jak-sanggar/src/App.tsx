import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { TradisiLisanProvider } from "@/components/system/TradisiLisanBetawi";
import { DocumentPreviewModal } from "@/components/system/DocumentPreviewModal";
import { TransactionAlert } from "@/components/system/TransactionAlert";
import { SyncFailureNotifier } from "@/components/system/SyncFailureNotifier";
import { AppShell } from "@/components/layout/AppShell";
import { CallProvider } from "@/components/communications/CallProvider";
import { consoleUrl } from "@/lib/app-links";
import { roleHomePath } from "@/lib/role-paths";
import { LEGACY_CONSUMER_ROUTE, LEGACY_CURATOR_ROUTE, LEGACY_PARTNER_ROUTE, legacyConsumerPath, legacyPartnerPath } from "@/lib/legacy-routes";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  BookOpen,
  Award,
  GraduationCap,
  Receipt,
  ScrollText,
  FileText,
  Send,
  Newspaper,
  Image as ImageIcon,
  MessageSquare,
  ClipboardList,
  Trophy,
  UserCog,
  Package,
  Building2,
  Handshake,
  Inbox,
  Landmark,
  ShoppingBag,
  BrainCircuit,
  Store,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";

function lazyNamed<T extends ComponentType<any>>(
  loader: () => Promise<object>,
  exportName: string,
) {
  return lazy(async () => {
    const module = (await loader()) as Record<string, unknown>;
    return { default: module[exportName] as T };
  });
}

const Login = lazy(() => import("@/pages/auth/PortalLogin"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const RegisterChoice = lazy(() => import("@/pages/auth/RegisterChoice"));
const loadRegisterForms = () => import("@/pages/auth/RegisterForms");
const RegisterSanggar = lazyNamed(loadRegisterForms, "RegisterSanggar");
const RegisterPelatih = lazyNamed(loadRegisterForms, "RegisterPelatih");
const RegisterSeniman = lazyNamed(loadRegisterForms, "RegisterSeniman");
const RegisterJuri = lazyNamed(loadRegisterForms, "RegisterJuri");
const RegisterSewa = lazyNamed(loadRegisterForms, "RegisterSewa");
const RegisterPengrajin = lazyNamed(loadRegisterForms, "RegisterPengrajin");
const RegisterMitraPengrajin = lazyNamed(
  loadRegisterForms,
  "RegisterMitraPengrajin",
);
const loadLegalPages = () => import("@/pages/legal/LegalPages");
const TermsAndConditionsPage = lazyNamed(
  loadLegalPages,
  "TermsAndConditionsPage",
);
const PrivacyPolicyPage = lazyNamed(loadLegalPages, "PrivacyPolicyPage");

const SanggarHome = lazy(() => import("@/pages/sanggar/SanggarHome"));
const Pesan = lazy(() => import("@/pages/Pesan"));
const SanggarProfile = lazy(() => import("@/pages/sanggar/Profile"));
const Members = lazy(() => import("@/pages/sanggar/Members"));
const PengembanganAnggota = lazy(
  () => import("@/pages/sanggar/PengembanganAnggota"),
);
const LatihanPage = lazy(() => import("@/pages/sanggar/Latihan"));
const BukuKas = lazy(() => import("@/pages/sanggar/BukuKas"));
const Pembinaan = lazy(() => import("@/pages/sanggar/Pembinaan"));
const KurasiPage = lazy(() => import("@/pages/sanggar/Kurasi"));
const Regenerasi = lazy(() => import("@/pages/sanggar/Regenerasi"));
const AsetPage = lazy(() => import("@/pages/sanggar/Aset"));
const SarprasPage = lazy(() => import("@/pages/sanggar/Sarpras"));
const KatalogKerjasama = lazy(
  () => import("@/pages/sanggar/kerjasama/Katalog"),
);
const PermintaanKerjasama = lazy(
  () => import("@/pages/sanggar/kerjasama/Permintaan"),
);
const KerjasamaDetail = lazy(() => import("@/pages/sanggar/kerjasama/Detail"));

const loadPelatihPages = () => import("@/pages/pelatih/PelatihPages");
const PelatihHome = lazyNamed(loadPelatihPages, "PelatihHome");
const PelatihDaftarLatih = lazyNamed(loadPelatihPages, "PelatihDaftarLatih");
const PelatihHonor = lazyNamed(loadPelatihPages, "PelatihHonor");
const PelatihSlip = lazyNamed(loadPelatihPages, "PelatihSlip");
const PelatihDistribusi = lazyNamed(loadPelatihPages, "PelatihDistribusi");
const PelatihSertif = lazyNamed(loadPelatihPages, "PelatihSertif");

const loadSenimanPages = () => import("@/pages/seniman/SenimanPages");
const SenimanHome = lazyNamed(loadSenimanPages, "SenimanHome");
const SenimanTagihan = lazyNamed(loadSenimanPages, "SenimanTagihan");
const SenimanRiwayat = lazyNamed(loadSenimanPages, "SenimanRiwayat");
const AbsensiLatihan = lazy(() => import("@/pages/seniman/AbsensiLatihan"));
const SenimanProfile = lazy(() => import("@/pages/seniman/Profile"));
const PermintaanSdmReadOnly = lazy(
  () => import("@/pages/seniman/PermintaanSdm"),
);

const loadJuriPages = () => import("@/pages/juri/JuriPages");
const JuriHome = lazyNamed(loadJuriPages, "JuriHome");
const JuriScoring = lazyNamed(loadJuriPages, "JuriScoring");
const JuriProfile = lazy(() => import("@/pages/juri/Profile"));

const loadAdminPages = () => import("@/pages/admin/AdminPages");
const AdminHome = lazyNamed(loadAdminPages, "AdminHome");
const AdminBerita = lazyNamed(loadAdminPages, "AdminBerita");
const AdminBanner = lazyNamed(loadAdminPages, "AdminBanner");
const AdminSlider = lazyNamed(loadAdminPages, "AdminSlider");

const loadSewaPages = () => import("@/pages/sewa/SewaPages");
const SewaHome = lazyNamed(loadSewaPages, "SewaHome");
const SewaKatalog = lazyNamed(loadSewaPages, "SewaKatalog");
const loadSewaPemesanan = () => import("@/pages/sewa/SewaPemesanan");
const SewaItemDetail = lazyNamed(loadSewaPemesanan, "SewaItemDetail");
const SewaPesananList = lazyNamed(loadSewaPemesanan, "SewaPesananList");
const SewaPesananDetail = lazyNamed(loadSewaPemesanan, "SewaPesananDetail");

const loadPermintaanSewa = () => import("@/pages/sanggar/PermintaanSewa");
const PermintaanSewaMasuk = lazyNamed(
  loadPermintaanSewa,
  "PermintaanSewaMasuk",
);
const PermintaanSewaDetail = lazyNamed(
  loadPermintaanSewa,
  "PermintaanSewaDetail",
);
const DokumenTools = lazy(() => import("@/pages/sanggar/DokumenTools"));
const PusatKendali = lazy(() => import("@/pages/sanggar/PusatKendali"));

const loadPenugasanSewa = () => import("@/pages/sdm/PenugasanSewa");
const PenugasanSewaInbox = lazyNamed(loadPenugasanSewa, "PenugasanSewaInbox");
const PenugasanSewaDetail = lazyNamed(loadPenugasanSewa, "PenugasanSewaDetail");
const InfoBudayaManager = lazy(
  () => import("@/pages/shared/InfoBudayaManager"),
);
const PengrajinHome = lazy(() => import("@/pages/pengrajin/PengrajinHome"));
const PublicPengrajinStore = lazy(
  () => import("@/pages/pengrajin/PublicStore"),
);
const PesananProdukPengrajin = lazy(
  () => import("@/pages/pengrajin/PesananProduk"),
);
const loadKerjasamaMitra = () => import("@/pages/pengrajin/KerjasamaMitra");
const KerjasamaPengrajin = lazyNamed(
  loadKerjasamaMitra,
  "KerjasamaPengrajinPage",
);
const KerjasamaMitra = lazyNamed(loadKerjasamaMitra, "KerjasamaMitraPage");
const MitraPengrajinHome = lazy(
  () => import("@/pages/mitra-pengrajin/MitraPengrajinHome"),
);
const Rekapan = lazy(() => import("@/pages/shared/Rekapan"));

const queryClient = new QueryClient();
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const showDemoAccounts = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true";

function DemoModeBadge() {
  if (!demoMode && !showDemoAccounts) return null;
  const label = demoMode ? "DEMO LOKAL" : "DEMO API + MARIADB";
  return (
    <div
      role="status"
      title={
        demoMode
          ? "Mode demo lokal: perubahan disimpan di browser ini"
          : "Mode demo server: perubahan disimpan melalui API ke MariaDB"
      }
      className="pointer-events-none fixed left-1/2 top-2 z-[200] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-100/95 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-amber-900 shadow-md backdrop-blur"
    >
      {label}
    </div>
  );
}

function Guard({
  role,
  children,
}: {
  role: string | string[];
  children: ReactNode;
}) {
  const { user, ready, logout } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Memuat sesi…
      </div>
    );
  }
  if (!user) return <Redirect to="/" />;
  if (user.statusModerasiAkun === "diblokir") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/20 px-4">
        <div className="max-w-lg rounded-xl border border-destructive/30 bg-background p-8 text-center shadow-lg">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 font-serif text-2xl font-bold">Akun Diblokir</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Kurator menghentikan akses karena pengaduan, aktivitas mencurigakan,
            manipulasi data, upaya atau tindakan penipuan, atau dugaan tindak
            kriminal sesuai peraturan perundang-undangan yang berlaku. Seluruh
            layanan akun tidak dapat digunakan.
          </p>
          {user.alasanBlokirAkun && (
            <p className="mt-3 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
              {user.alasanBlokirAkun}
            </p>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role))
    return <Redirect to={roleHomePath(user.role)} />;
  return <>{children}</>;
}

const sanggarNav = [
  {
    label: "Beranda",
    href: "/sanggar",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Pusat Kendali AI",
    href: "/sanggar/pusat-kendali",
    icon: <BrainCircuit className="h-4 w-4" />,
  },
  {
    label: "Profil Sanggar",
    href: "/sanggar/profil",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    label: "Publikasi Karya",
    href: "/sanggar/karya",
    icon: <ImageIcon className="h-4 w-4" />,
  },
  {
    label: "Keanggotaan",
    href: "/sanggar/keanggotaan",
    icon: <Users className="h-4 w-4" />,
    children: [
      {
        label: "Rapor & Apresiasi",
        href: "/sanggar/rapor-apresiasi",
        icon: <Award className="h-4 w-4" />,
      },
      {
        label: "Regenerasi",
        href: "/sanggar/regenerasi",
        icon: <ScrollText className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Latihan",
    href: "/sanggar/latihan",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    label: "Pembinaan",
    href: "/sanggar/pembinaan",
    icon: <GraduationCap className="h-4 w-4" />,
    children: [
      {
        label: "Kurasi Sanggar",
        href: "/sanggar/kurasi",
        icon: <Trophy className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Aset & Sarana",
    href: "/sanggar/aset",
    icon: <Package className="h-4 w-4" />,
    children: [
      {
        label: "Sarana & Prasarana",
        href: "/sanggar/sarpras",
        icon: <Building2 className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Kerjasama",
    href: "/sanggar/kerjasama",
    icon: <Handshake className="h-4 w-4" />,
    children: [
      {
        label: "Permintaan",
        href: "/sanggar/kerjasama/permintaan",
        icon: <Inbox className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Permintaan Layanan Masuk",
    href: "/sanggar/permintaan-sewa",
    icon: <ShoppingBag className="h-4 w-4" />,
  },
  {
    label: "Buku Kas",
    href: "/sanggar/buku-kas",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    label: "Tools Dokumen",
    href: "/sanggar/dokumen",
    icon: <FileText className="h-4 w-4" />,
  },
];
const pelatihNav = [
  {
    label: "Beranda",
    href: "/pelatih",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Profil Saya",
    href: "/pelatih/profil",
    icon: <UserCog className="h-4 w-4" />,
  },
  {
    label: "Daftar Latih",
    href: "/pelatih/daftar-latih",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    label: "Pengajuan Honor",
    href: "/pelatih/honor",
    icon: <Send className="h-4 w-4" />,
  },
  {
    label: "Arsip E-Slip",
    href: "/pelatih/slip",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: "Dana Proyek",
    href: "/pelatih/honor-proyek",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    label: "Permintaan SDM",
    href: "/pelatih/permintaan-sdm",
    icon: <Handshake className="h-4 w-4" />,
  },
  {
    label: "Penugasan Sewa",
    href: "/pelatih/penugasan-sewa",
    icon: <ShoppingBag className="h-4 w-4" />,
  },
  {
    label: "Pesanan Kelas Privat",
    href: "/pelatih/kelas-privat",
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    label: "Sertifikat & Penghargaan",
    href: "/pelatih/sertifikat",
    icon: <Award className="h-4 w-4" />,
  },
];
const senimanNav = [
  {
    label: "Beranda",
    href: "/seniman",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Profil Saya",
    href: "/seniman/profil",
    icon: <UserCog className="h-4 w-4" />,
  },
  {
    label: "Absen Latihan",
    href: "/seniman/absen",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    label: "Keuangan",
    href: "/seniman/keuangan",
    icon: <Wallet className="h-4 w-4" />,
    children: [
      {
        label: "Tagihan Saya",
        href: "/seniman/tagihan",
        icon: <Receipt className="h-4 w-4" />,
      },
      {
        label: "Dana Proyek Seni",
        href: "/seniman/honor-komersial",
        icon: <Wallet className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Permintaan SDM",
    href: "/seniman/permintaan-sdm",
    icon: <Handshake className="h-4 w-4" />,
  },
  {
    label: "Penugasan Sewa",
    href: "/seniman/penugasan-sewa",
    icon: <ShoppingBag className="h-4 w-4" />,
  },
  {
    label: "Riwayat",
    href: "/seniman/riwayat",
    icon: <ScrollText className="h-4 w-4" />,
  },
  {
    label: "Sertifikat & Penghargaan",
    href: "/seniman/sertifikat",
    icon: <Award className="h-4 w-4" />,
  },
];
const juriNav = [
  {
    label: "Tugas Penilaian",
    href: "/juri",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    label: "Profil Saya",
    href: "/juri/profil",
    icon: <UserCog className="h-4 w-4" />,
  },
];
const adminNav = [
  {
    label: "Beranda",
    href: "/admin",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Konten",
    href: "/admin/berita",
    icon: <Newspaper className="h-4 w-4" />,
    children: [
      {
        label: "Banner",
        href: "/admin/banner",
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        label: "Slider",
        href: "/admin/slider",
        icon: <ImageIcon className="h-4 w-4" />,
      },
      {
        label: "Informasi Kebudayaan",
        href: "/admin/info-budaya",
        icon: <Landmark className="h-4 w-4" />,
      },
    ],
  },
];
const konsumenNav = [
  {
    label: "Beranda Konsumen",
    href: "/konsumen",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Sanggar",
    href: "/konsumen/katalog/sanggar",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    label: "SDM",
    href: "/konsumen/katalog/sdm",
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: "Perlengkapan",
    href: "/konsumen/katalog/perlengkapan",
    icon: <Package className="h-4 w-4" />,
  },
  {
    label: "Kostum",
    href: "/konsumen/katalog/kostum",
    icon: <ShoppingBag className="h-4 w-4" />,
  },
  {
    label: "Tempat Latihan",
    href: "/konsumen/katalog/tempat",
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    label: "Kerajinan & Jasa",
    href: "/konsumen/katalog/kerajinan",
    icon: <Package className="h-4 w-4" />,
  },
  {
    label: "Pesanan Saya",
    href: "/konsumen/pesanan",
    icon: <Receipt className="h-4 w-4" />,
  },
];
const pengrajinNav = [
  {
    label: "Beranda",
    href: "/pengrajin",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Profil Toko",
    href: "/pengrajin/profil",
    icon: <Store className="h-4 w-4" />,
  },
  {
    label: "Produk Khas Jakarta",
    href: "/pengrajin/produk",
    icon: <Package className="h-4 w-4" />,
  },
  {
    label: "Order & Dokumen Transaksi",
    href: "/pengrajin/pesanan-produk",
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    label: "Layanan & Kerja Sama",
    href: "/pengrajin/kanal",
    icon: <Handshake className="h-4 w-4" />,
  },
];
const mitraNav = [
  {
    label: "Profil & Marketplace",
    href: "/mitra/profil",
    icon: <Store className="h-4 w-4" />,
  },
  {
    label: "Ringkasan Mitra",
    href: "/mitra",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Katalog Pengrajin",
    href: "/mitra/katalog",
    icon: <Package className="h-4 w-4" />,
  },
  {
    label: "Sanggar & Layanan",
    href: "/mitra/layanan",
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    label: "Kerja Sama Masuk",
    href: "/mitra/kerjasama",
    icon: <Handshake className="h-4 w-4" />,
  },
  {
    label: "Pesanan & Dokumen Transaksi",
    href: "/mitra/pesanan",
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    label: "Pesanan Layanan",
    href: "/mitra/layanan/pesanan",
    icon: <Receipt className="h-4 w-4" />,
  },
];

const rekapanNavItem = {
  label: "Rekapan",
  href: "/rekapan",
  icon: <FileSpreadsheet className="h-4 w-4" />,
};

sanggarNav.push(rekapanNavItem);
pelatihNav.push(rekapanNavItem);
senimanNav.push(rekapanNavItem);
juriNav.push(rekapanNavItem);
adminNav.push(rekapanNavItem);
konsumenNav.push(rekapanNavItem);
pengrajinNav.push(rekapanNavItem);
mitraNav.push(rekapanNavItem);

const pesanNavItem = { label: "Pesan & Percakapan", href: "/pesan", icon: <MessageSquare className="h-4 w-4" /> };
for (const nav of [sanggarNav, pelatihNav, senimanNav, juriNav, adminNav, konsumenNav, pengrajinNav, mitraNav]) nav.push(pesanNavItem);

function MitraShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const verified =
    user?.role === "mitra_pengrajin" &&
    user.statusVerifikasiTokoOffline === "terverifikasi";
  const nav = verified
    ? mitraNav
    : mitraNav.filter((item) => item.href === "/mitra/profil");
  return <AppShell nav={nav}>{children}</AppShell>;
}

function MitraCatalogGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (
    user?.role === "mitra_pengrajin" &&
    user.statusVerifikasiTokoOffline !== "terverifikasi"
  ) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="font-serif text-2xl font-bold">
          Akun Mitra belum aktif
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Profil verifikasi masih belum lengkap, menunggu pemeriksaan, atau
          perlu diperbaiki. Seluruh katalog dan layanan baru terbuka setelah
          Kurator menyetujui titik toko, NIB, serta kedua surat domisili.
        </p>
        <a
          href="/mitra/profil"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Buka Profil & Verifikasi
        </a>
      </div>
    );
  }
  return <>{children}</>;
}

const rekapanRoles = [
  "sanggar",
  "pelatih",
  "seniman",
  "juri",
  "admin",
  "sewa",
  "pengrajin",
  "mitra_pengrajin",
];

function navUntukRole(role: string) {
  switch (role) {
    case "sanggar":
      return sanggarNav;
    case "pelatih":
      return pelatihNav;
    case "seniman":
      return senimanNav;
    case "juri":
      return juriNav;
    case "admin":
      return adminNav;
    case "sewa":
      return konsumenNav;
    case "pengrajin":
      return pengrajinNav;
    case "mitra_pengrajin":
      return mitraNav;
    default:
      return [];
  }
}

function RekapanShell() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <AppShell nav={navUntukRole(user.role)}>
      <Rekapan />
    </AppShell>
  );
}

function PesanShell() {
  const { user } = useAuth();
  if (!user) return null;
  return <AppShell nav={navUntukRole(user.role)}><Pesan /></AppShell>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/lupa-password" component={ForgotPassword} />
      <Route path="/daftar" component={RegisterChoice} />
      <Route path="/daftar/sanggar" component={RegisterSanggar} />
      <Route path="/daftar/pelatih" component={RegisterPelatih} />
      <Route path="/daftar/seniman" component={RegisterSeniman} />
      <Route path="/daftar/konsumen" component={RegisterSewa} />
      <Route path="/daftar/sewa">
        <Redirect to="/daftar/konsumen" />
      </Route>
      <Route path="/daftar/pengrajin" component={RegisterPengrajin} />
      <Route path="/daftar/mitra" component={RegisterMitraPengrajin} />
      <Route path="/daftar/mitra-pengrajin">
        <Redirect to="/daftar/mitra" />
      </Route>
      <Route path="/syarat-ketentuan" component={TermsAndConditionsPage} />
      <Route path="/kebijakan-privasi" component={PrivacyPolicyPage} />
      <Route path="/toko/pengrajin/:id" component={PublicPengrajinStore} />

      <Route path="/rekapan">
        {() => (
          <Guard role={rekapanRoles}>
            <MitraCatalogGate>
              <RekapanShell />
            </MitraCatalogGate>
          </Guard>
        )}
      </Route>

      <Route path="/pesan">
        {() => <Guard role={rekapanRoles}><PesanShell /></Guard>}
      </Route>

      <Route path="/mitra/layanan/pesanan/:id">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <SewaPesananDetail />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/layanan/pesanan">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <SewaPesananList />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/layanan/item/:id">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <SewaItemDetail />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/layanan/:kategori">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <SewaKatalog />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/layanan">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <SewaHome />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/katalog">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <MitraPengrajinHome section="katalog" />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/kerjasama">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <KerjasamaMitra />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/paket">
        <Redirect to="/mitra/katalog" />
      </Route>
      <Route path="/mitra/pesanan">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <MitraPengrajinHome section="pesanan" />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra/profil">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraPengrajinHome section="profil" />
            </MitraShell>
          </Guard>
        )}
      </Route>
      <Route path="/mitra">
        {() => (
          <Guard role="mitra_pengrajin">
            <MitraShell>
              <MitraCatalogGate>
                <MitraPengrajinHome section="dashboard" />
              </MitraCatalogGate>
            </MitraShell>
          </Guard>
        )}
      </Route>

      <Route path={LEGACY_PARTNER_ROUTE}>
        {(params) => <Redirect to={legacyPartnerPath(params["*"])} />}
      </Route>

      <Route path="/pengrajin/pesanan-produk">
        {() => (
          <Guard role="pengrajin">
            <AppShell nav={pengrajinNav}>
              <PesananProdukPengrajin />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/pengrajin/toko-peta">
        <Redirect to="/pengrajin/profil" />
      </Route>
      <Route path="/pengrajin/produk">
        {() => (
          <Guard role="pengrajin">
            <AppShell nav={pengrajinNav}>
              <PengrajinHome section="produk" />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pengrajin/kanal">
        {() => (
          <Guard role="pengrajin">
            <AppShell nav={pengrajinNav}>
              <KerjasamaPengrajin />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pengrajin/dokumen">
        <Redirect to="/pengrajin/profil" />
      </Route>

      <Route path="/pengrajin/profil">
        {() => (
          <Guard role="pengrajin">
            <AppShell nav={pengrajinNav}>
              <PengrajinHome section="profil" />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/pengrajin">
        {() => (
          <Guard role="pengrajin">
            <AppShell nav={pengrajinNav}>
              <PengrajinHome section="dashboard" />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/sanggar">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <SanggarHome />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/pusat-kendali">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <PusatKendali />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/profil">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <SanggarProfile />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/karya">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <InfoBudayaManager audience="sanggar" />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/dokumen">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <DokumenTools />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/keanggotaan">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <Members />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/rapor-apresiasi">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <PengembanganAnggota />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/regenerasi">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <Regenerasi />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/latihan">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <LatihanPage />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/pembinaan">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <Pembinaan />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/kurasi">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <KurasiPage />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/aset">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <AsetPage />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/sarpras">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <SarprasPage />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/kerjasama">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <KatalogKerjasama />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/kerjasama/permintaan">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <PermintaanKerjasama />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/kerjasama/:id">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <KerjasamaDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/permintaan-sewa">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <PermintaanSewaMasuk />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/permintaan-sewa/:id">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <PermintaanSewaDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/sanggar/buku-kas">
        {() => (
          <Guard role="sanggar">
            <AppShell nav={sanggarNav}>
              <BukuKas />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/pelatih">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PelatihHome />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/daftar-latih">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PelatihDaftarLatih />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/profil">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <SenimanProfile />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/absen">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <AbsensiLatihan />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/honor">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PelatihHonor />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/slip">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PelatihSlip />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/honor-proyek">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PelatihDistribusi />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/permintaan-sdm">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PermintaanSdmReadOnly />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/penugasan-sewa">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PenugasanSewaInbox />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/penugasan-sewa/:id">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PenugasanSewaDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/kelas-privat/:id">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PermintaanSewaDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/kelas-privat">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PermintaanSewaMasuk />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pelatih/sertifikat">
        {() => (
          <Guard role="pelatih">
            <AppShell nav={pelatihNav}>
              <PelatihSertif />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/seniman">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <SenimanHome />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/profil">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <SenimanProfile />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/absen">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <AbsensiLatihan />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/keuangan">
        {() => (
          <Guard role="seniman">
            <Redirect to="/seniman/tagihan" />
          </Guard>
        )}
      </Route>
      <Route path="/seniman/tagihan">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <SenimanTagihan />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/honor-komersial">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <PelatihDistribusi />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/riwayat">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <SenimanRiwayat />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/permintaan-sdm">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <PermintaanSdmReadOnly />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/penugasan-sewa">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <PenugasanSewaInbox />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/penugasan-sewa/:id">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <PenugasanSewaDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/seniman/sertifikat">
        {() => (
          <Guard role="seniman">
            <AppShell nav={senimanNav}>
              <PelatihSertif />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/juri">
        {() => (
          <Guard role="juri">
            <AppShell nav={juriNav}>
              <JuriHome />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/juri/profil">
        {() => (
          <Guard role="juri">
            <AppShell nav={juriNav}>
              <JuriProfile />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/juri/:id">
        {() => (
          <Guard role="juri">
            <AppShell nav={juriNav}>
              <JuriScoring />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path="/admin">
        {() => (
          <Guard role="admin">
            <AppShell nav={adminNav}>
              <AdminHome />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/admin/berita">
        {() => (
          <Guard role="admin">
            <AppShell nav={adminNav}>
              <AdminBerita />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/admin/banner">
        {() => (
          <Guard role="admin">
            <AppShell nav={adminNav}>
              <AdminBanner />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/admin/slider">
        {() => (
          <Guard role="admin">
            <AppShell nav={adminNav}>
              <AdminSlider />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/admin/info-budaya">
        {() => (
          <Guard role="admin">
            <AppShell nav={adminNav}>
              <InfoBudayaManager audience="admin" />
            </AppShell>
          </Guard>
        )}
      </Route>

      {/* Fitur Kurator kini di Konsol Kurator terpisah (/konsol/). */}
      <Route path={LEGACY_CURATOR_ROUTE}>
        {() => {
          window.location.href = consoleUrl;
          return null;
        }}
      </Route>

      <Route path="/konsumen/pesanan/:id">
        {() => (
          <Guard role="sewa">
            <AppShell nav={konsumenNav}>
              <SewaPesananDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/konsumen/pesanan">
        {() => (
          <Guard role="sewa">
            <AppShell nav={konsumenNav}>
              <SewaPesananList />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/konsumen/item/:id">
        {() => (
          <Guard role="sewa">
            <AppShell nav={konsumenNav}>
              <SewaItemDetail />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/konsumen/katalog/:kategori">
        {() => (
          <Guard role="sewa">
            <AppShell nav={konsumenNav}>
              <SewaKatalog />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/konsumen">
        {() => (
          <Guard role="sewa">
            <AppShell nav={konsumenNav}>
              <SewaHome />
            </AppShell>
          </Guard>
        )}
      </Route>

      <Route path={LEGACY_CONSUMER_ROUTE}>
        {(params) => <Redirect to={legacyConsumerPath(params["*"])} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider demoMode={demoMode}>
          <DemoModeBadge />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <CallProvider>
            <Suspense
              fallback={
                <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
                  Memuat halaman…
                </div>
              }
            >
              <Router />
            </Suspense>
            <TransactionAlert />
            </CallProvider>
          </WouterRouter>
          <DocumentPreviewModal />
          <SyncFailureNotifier />
          <TradisiLisanProvider />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
