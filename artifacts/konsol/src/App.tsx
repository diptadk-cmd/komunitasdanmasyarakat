import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { TradisiLisanProvider } from "@/components/system/TradisiLisanBetawi";
import { AppShell } from "@/components/layout/AppShell";
import { CallProvider } from "@/components/communications/CallProvider";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

import {
  LayoutDashboard,
  Users,
  Sliders,
  Clock,
  Palette,
  Shield,
  Trophy,
  Handshake,
  Images,
  Megaphone,
  Database,
  FileText,
  FileSpreadsheet,
  MessageSquare,
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

const Login = lazy(() => import("@/pages/auth/Login"));
const Pesan = lazy(() => import("../../jak-sanggar/src/pages/Pesan"));
const loadKuratorPages = () => import("@/pages/kurator/KuratorPages");
const KuratorHome = lazyNamed(loadKuratorPages, "KuratorHome");
const KuratorAccounts = lazyNamed(loadKuratorPages, "KuratorAccounts");
const KuratorMatriks = lazyNamed(loadKuratorPages, "KuratorMatriks");
const KuratorAssign = lazyNamed(loadKuratorPages, "KuratorAssign");
const KuratorStaff = lazyNamed(loadKuratorPages, "KuratorStaff");
const KuratorAppearance = lazyNamed(loadKuratorPages, "KuratorAppearance");
const KuratorWaktu = lazyNamed(loadKuratorPages, "KuratorWaktu");
const loadKuratorDokumen = () => import("@/pages/kurator/KuratorDokumen");
const KuratorDokumen = lazyNamed(loadKuratorDokumen, "KuratorDokumen");
const KuratorKerjasama = lazy(() => import("@/pages/kurator/KuratorKerjasama"));
const loadKuratorManajemenData = () =>
  import("@/pages/kurator/KuratorManajemenData");
const KuratorManajemenData = lazyNamed(
  loadKuratorManajemenData,
  "KuratorManajemenData",
);
const InfoBudayaManager = lazy(
  () => import("@/pages/shared/InfoBudayaManager"),
);
const NewsManager = lazy(() => import("@/pages/shared/NewsManager"));
const KuratorRekapan = lazy(() => import("@/pages/kurator/KuratorRekapan"));

const queryClient = new QueryClient();
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

function DemoModeBadge() {
  if (!demoMode) return null;
  return (
    <div
      role="status"
      title="Mode demo: perubahan disimpan di browser ini"
      className="pointer-events-none fixed left-1/2 top-2 z-[200] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-100/95 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-amber-900 shadow-md backdrop-blur"
    >
      MODE DEMO
    </div>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Memuat sesi…
      </div>
    );
  }
  if (!user || user.role !== "kurator") return <Redirect to="/" />;
  return <>{children}</>;
}

const kuratorNav = [
  { label: "Dasbor", href: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
  {
    label: "Akun Pengguna",
    href: "/akun",
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: "Manajemen Data",
    href: "/manajemen",
    icon: <Database className="h-4 w-4" />,
  },
  {
    label: "Studio Dokumen",
    href: "/dokumen",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: "Sistem Kurasi",
    href: "/kurasi",
    icon: <Sliders className="h-4 w-4" />,
  },
  {
    label: "Penugasan Juri",
    href: "/penugasan",
    icon: <Trophy className="h-4 w-4" />,
  },
  {
    label: "Pengawasan Kerjasama",
    href: "/kerjasama",
    icon: <Handshake className="h-4 w-4" />,
  },
  {
    label: "Media Kreatif",
    href: "/media-kreatif",
    icon: <Images className="h-4 w-4" />,
  },
  {
    label: "Berita & Pengumuman",
    href: "/pengumuman",
    icon: <Megaphone className="h-4 w-4" />,
  },
  {
    label: "Admin & Juri",
    href: "/staff",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    label: "Tampilan",
    href: "/tampilan",
    icon: <Palette className="h-4 w-4" />,
  },
  {
    label: "Waktu & Sistem",
    href: "/waktu",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    label: "Rekapan",
    href: "/rekapan",
    icon: <FileSpreadsheet className="h-4 w-4" />,
  },
];

kuratorNav.push({ label: "Pesan & Percakapan", href: "/pesan", icon: <MessageSquare className="h-4 w-4" /> });

function RootRoute() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Memuat sesi…
      </div>
    );
  }
  if (!user || user.role !== "kurator") return <Login />;
  return (
    <AppShell nav={kuratorNav}>
      <KuratorHome />
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/pesan">
        {() => <Guard><AppShell nav={kuratorNav}><Pesan /></AppShell></Guard>}
      </Route>
      <Route path="/akun">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorAccounts />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/manajemen">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorManajemenData />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/dokumen">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorDokumen />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/kurasi">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorMatriks />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/penugasan">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorAssign />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/kerjasama">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorKerjasama />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/info-budaya">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <InfoBudayaManager audience="kurator" />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/media-kreatif">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <InfoBudayaManager audience="kurator" />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/pengumuman">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <NewsManager />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/staff">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorStaff />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/tampilan">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorAppearance />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/waktu">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorWaktu />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route path="/rekapan">
        {() => (
          <Guard>
            <AppShell nav={kuratorNav}>
              <KuratorRekapan />
            </AppShell>
          </Guard>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider mode="konsol" demoMode={demoMode}>
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
            </CallProvider>
          </WouterRouter>
          <TradisiLisanProvider />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
