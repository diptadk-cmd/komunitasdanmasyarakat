import { type ReactNode, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LogOut,
  Sun,
  Moon,
  Sparkles,
  ChevronDown,
  UserCog,
  Menu,
  X,
  Contrast,
  Search,
  ChevronRight,
} from "lucide-react";
import type { Role, ThemeMode } from "@/lib/types";
import { load, persistAppearance } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import "./dashboard-shell.css";
import brandSeal from "@/assets/brand/jak-sanggar-mark-v2.png";
import { useT, normalizeLang } from "@/lib/i18n";
import { InstallPwaCard } from "@/components/InstallPwaCard";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { GlobalActions } from "@/components/system/GlobalActions";
import { CommunicationAccess } from "@/components/communications/CommunicationAccess";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  children?: NavItem[];
}

function routeMatches(loc: string, href: string) {
  const pathname = loc.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const target = href.replace(/\/$/, "") || "/";
  const isHome = [
    "/",
    "/sanggar",
    "/seniman",
    "/pelatih",
    "/juri",
    "/admin",
    "/pengrajin",
    "/mitra",
    "/konsumen",
  ].includes(target);
  return pathname === target || (!isHome && pathname.startsWith(`${target}/`));
}

function currentNavItem(nav: NavItem[], loc: string) {
  return nav
    .flatMap((item) => [item, ...(item.children ?? [])])
    .filter((item) => routeMatches(loc, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

function navGroup(item: NavItem) {
  const segment = item.href.split("/").filter(Boolean).at(-1) ?? "";
  if (
    [
      "",
      "sanggar",
      "seniman",
      "pelatih",
      "juri",
      "admin",
      "pengrajin",
      "mitra",
      "konsumen",
      "profil",
      "pusat-kendali",
    ].includes(segment)
  )
    return "Ruang Anda";
  if (
    ["pesan", "rekapan", "pengumuman", "berita", "media-kreatif"].includes(
      segment,
    )
  )
    return "Komunikasi & laporan";
  if (["tampilan", "waktu", "staff"].includes(segment)) return "Pengaturan";
  return "Kegiatan & layanan";
}

function SidebarNavList({
  nav,
  loc,
  testIdPrefix,
  onNavigate,
}: {
  nav: NavItem[];
  loc: string;
  testIdPrefix: string;
  onNavigate?: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {},
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const activeHref = currentNavItem(nav, loc)?.href;
  const term = query.trim().toLocaleLowerCase();
  const filtered = nav.flatMap((item) => {
    if (!term || item.label.toLocaleLowerCase().includes(term)) return [item];
    const children = item.children?.filter((child) =>
      child.label.toLocaleLowerCase().includes(term),
    );
    return children?.length ? [{ ...item, children }] : [];
  });
  const groups = [
    "Ruang Anda",
    "Kegiatan & layanan",
    "Komunikasi & laporan",
    "Pengaturan",
  ];

  return (
    <div className="dashboard-navigation">
      <div className="dashboard-menu-search">
        <Search className="h-4 w-4" aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
          }}
          aria-label={t("Cari menu navigasi")}
          placeholder={t("Cari menu...")}
          data-testid={`${testIdPrefix}-search`}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
            aria-label={t("Hapus pencarian menu")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="dashboard-menu-empty" role="status">
          <p>{t("Menu tidak ditemukan.")}</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
          >
            {t("Tampilkan semua menu")}
          </button>
        </div>
      ) : (
        groups.map((group) => {
          const items = filtered.filter((item) => navGroup(item) === group);
          if (!items.length) return null;
          return (
            <section
              className="dashboard-nav-group"
              key={group}
              aria-label={t(group)}
            >
              <h2>{t(group)}</h2>
              <ul>
                {items.map((item) => {
                  const active = activeHref === item.href;
                  const childActive = !!item.children?.some(
                    (child) => child.href === activeHref,
                  );
                  const hasChildren = !!item.children?.length;
                  const expandedKey = `${term}:${item.href}`;
                  const expanded =
                    expandedItems[expandedKey] ??
                    (!!term || active || childActive);
                  const childrenId = `${testIdPrefix}-children-${item.href.replace(/\//g, "-")}`;
                  return (
                    <li key={item.href}>
                      <div
                        className={`dashboard-nav-row${active ? " is-active" : ""}${childActive ? " has-active-child" : ""}`}
                      >
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className="dashboard-nav-link"
                          aria-current={active ? "page" : undefined}
                          data-testid={`${testIdPrefix}-${item.href.replace(/\//g, "-")}`}
                        >
                          <span
                            className="dashboard-nav-icon"
                            aria-hidden="true"
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            className="dashboard-nav-toggle"
                            aria-expanded={expanded}
                            aria-controls={childrenId}
                            aria-label={`${t(expanded ? "Tutup submenu" : "Buka submenu")} ${item.label}`}
                            onClick={() =>
                              setExpandedItems((previous) => ({
                                ...previous,
                                [expandedKey]: !expanded,
                              }))
                            }
                          >
                            <ChevronDown
                              className={`h-4 w-4${expanded ? "" : " -rotate-90"}`}
                            />
                          </button>
                        )}
                      </div>
                      {hasChildren && expanded && (
                        <ul id={childrenId} className="dashboard-subnav">
                          {item.children!.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={onNavigate}
                                className={`dashboard-nav-link${activeHref === child.href ? " is-active" : ""}`}
                                aria-current={
                                  activeHref === child.href ? "page" : undefined
                                }
                                data-testid={`${testIdPrefix}-${child.href.replace(/\//g, "-")}`}
                              >
                                <span
                                  className="dashboard-nav-icon"
                                  aria-hidden="true"
                                >
                                  {child.icon}
                                </span>
                                <span>{child.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

const ROLE_KEY: Record<Role, string> = {
  kurator: "Kurator",
  admin: "Admin",
  sanggar: "Sanggar",
  pelatih: "Pelatih",
  seniman: "Seniman",
  juri: "Juri",
  pengrajin: "Pengrajin",
  mitra_pengrajin: "Mitra",
  sewa: "Konsumen",
};

function applyTheme(theme: ThemeMode, highContrast?: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme !== "light");
  root.classList.toggle("luxury", theme === "luxury");
  root.classList.toggle("high-contrast", !!highContrast);
}

function applyLang(lang: string) {
  if (typeof document !== "undefined")
    document.documentElement.dataset.lang = lang;
}

function applyStudio(studio: any) {
  const root = document.documentElement;
  const cleanWhite = !root.classList.contains("dark");
  const setVar = (name: string, value: string | undefined) => {
    if (value !== undefined && value !== "")
      root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };
  // Saved cream Studio surfaces must not tint the light layout or its portals.
  if (cleanWhite) {
    root.style.removeProperty("--background");
    root.style.removeProperty("--card");
  }
  if (!studio) return;
  setVar(
    "--app-font-serif",
    studio.fontSerif ? `'${studio.fontSerif}', Georgia, serif` : undefined,
  );
  setVar(
    "--app-font-sans",
    studio.fontSans ? `'${studio.fontSans}', system-ui, sans-serif` : undefined,
  );
  setVar(
    "--radius",
    studio.borderRadius != null ? `${studio.borderRadius}rem` : undefined,
  );
  setVar("--foreground", studio.foregroundHsl);
  setVar("--background", cleanWhite ? undefined : studio.backgroundHsl);
  setVar("--card", cleanWhite ? undefined : studio.cardHsl);
  setVar("--border", studio.borderHsl);
  setVar("--sidebar", studio.sidebarHsl);
  setVar("--sidebar-foreground", studio.sidebarFgHsl);
  if (studio.fontScale != null) {
    root.style.setProperty(
      "font-size",
      `${Math.round(studio.fontScale * 16)}px`,
    );
  } else {
    root.style.removeProperty("font-size");
  }
}

export function AppShell({
  nav,
  children,
}: {
  nav: NavItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const db = useDb();
  const [loc, navigate] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const { toast } = useToast();
  const labels = ROLE_KEY;
  const activeNav = currentNavItem(nav, loc);

  // Tutup drawer mobile saat pindah halaman
  useEffect(() => {
    setMobileNavOpen(false);
    setProfileOpen(false);
  }, [loc]);

  useEffect(() => {
    const ap = load().appearance;
    const root = document.documentElement;
    const preset = ap.themePreset ?? ap.theme ?? "light";
    const isBaseTheme =
      preset === "light" || preset === "dark" || preset === "luxury";
    if (isBaseTheme) {
      // Tema dasar memakai token brand (hijau/oranye per mode) di index.css — jangan di-override.
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
    } else {
      if (ap.primaryHsl) root.style.setProperty("--primary", ap.primaryHsl);
      if (ap.accentHsl) root.style.setProperty("--accent", ap.accentHsl);
    }
    const theme: ThemeMode = ap.theme ?? (ap.dark ? "dark" : "light");
    applyTheme(theme, ap.highContrast);
    applyLang(normalizeLang(ap.language));
    applyStudio(ap.studio);
  }, [
    db.appearance.theme,
    db.appearance.themePreset,
    db.appearance.highContrast,
    db.appearance.primaryHsl,
    db.appearance.accentHsl,
    db.appearance.dark,
    db.appearance.language,
    db.appearance.studio,
  ]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        if (profileRef.current?.contains(document.activeElement))
          profileRef.current.querySelector("button")?.focus();
      }
    };
    document.addEventListener("click", handler);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  if (!user) return null;
  const initials = (
    (user as any).namaUsaha ||
    (user as any).namaSanggar ||
    (user as any).nama ||
    user.username
  )
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName =
    (user as any).namaUsaha ||
    (user as any).namaSanggar ||
    (user as any).nama ||
    user.username;

  const brand = db.appearance.brand;
  const appName = brand?.appName || "JakSanggar";
  const footer1 = brand?.sidebarFooterLine1 || "Kebudayaan akan bernyawa";
  const footer2 = brand?.sidebarFooterLine2 || "karena ketulusan";
  const backdrop = db.appearance.backdrop;
  const customTheme = db.appearance.customTheme;
  const studio = db.appearance.studio;

  const currentTheme: ThemeMode =
    db.appearance.theme ?? (db.appearance.dark ? "dark" : "light");
  const cycleTheme = () => {
    const order: ThemeMode[] = ["light", "dark", "luxury"];
    const next = order[(order.indexOf(currentTheme) + 1) % order.length];
    // Lokal-dulu (offline-first); untuk sesi kurator ditulis-balik permanen ke
    // server. Bila server menolak, persistAppearance rollback nilai lokal.
    persistAppearance((ap) => {
      ap.theme = next;
      ap.themePreset = next;
      ap.dark = next !== "light";
      if (ap.customTheme?.enabled) {
        ap.customTheme.enabled = false;
        ap.customTheme.previousBaseline = undefined;
      }
    }).catch(() => {
      toast({
        title: t("Gagal menyimpan tema ke server"),
        variant: "destructive",
      });
    });
  };

  const highContrast = !!db.appearance.highContrast;
  const toggleHighContrast = () => {
    persistAppearance((ap) => {
      ap.highContrast = !ap.highContrast;
    }).catch(() => {
      toast({
        title: t("Gagal menyimpan Kontras Tinggi ke server"),
        variant: "destructive",
      });
    });
  };

  const profilePath =
    user.role === "sanggar"
      ? "/sanggar/profil"
      : user.role === "seniman"
        ? "/seniman/profil"
        : user.role === "juri"
          ? "/juri/profil"
          : user.role === "pengrajin"
            ? "/pengrajin"
            : user.role === "mitra_pengrajin"
              ? "/mitra/profil"
              : user.role === "sewa"
                ? "/konsumen"
                : null;

  return (
    <div className="app-shell-clean dashboard-shell min-h-screen flex bg-background">
      <a href="#dashboard-main" className="dashboard-skip-link">
        {t("Langsung ke konten")}
      </a>
      <aside className="dashboard-sidebar hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {currentTheme !== "light" && studio?.sidebarImageDataUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${studio.sidebarImageDataUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: Math.max(
                0,
                Math.min(1, studio.sidebarImageOpacity ?? 0.18),
              ),
            }}
          />
        )}
        <div className="dashboard-brand relative flex items-center gap-3">
          {brand?.logoDataUrl ? (
            <div
              className="dashboard-brand-mark h-10 w-10 rounded-lg overflow-hidden grid place-items-center bg-white/5"
              style={{
                boxShadow:
                  "0 1px 3px hsl(var(--foreground) / 0.08), 0 0 0 1px hsl(var(--sidebar-border))",
              }}
            >
              <img
                src={brand.logoDataUrl}
                alt={appName}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className="dashboard-brand-mark h-10 w-10 rounded-lg grid place-items-center bg-white"
              style={{
                boxShadow:
                  "0 1px 3px hsl(var(--foreground) / 0.08), 0 0 0 1px hsl(var(--sidebar-border))",
              }}
            >
              <img
                src={brandSeal}
                alt={appName}
                className="h-9 w-9 object-contain"
              />
            </div>
          )}
          <div className="min-w-0">
            <div className="dashboard-brand-name">{appName}</div>
            <div className="dashboard-brand-role">{t(labels[user.role])}</div>
          </div>
        </div>

        <nav
          className="dashboard-nav-container relative flex-1 overflow-y-auto scrollbar-thin"
          aria-label={t("Navigasi utama")}
        >
          <SidebarNavList nav={nav} loc={loc} testIdPrefix="nav" />
        </nav>

        <div className="dashboard-sidebar-footer relative border-t border-sidebar-border p-3 space-y-2">
          <div className="px-1">
            <InstallPwaCard
              variant="button"
              className="w-full justify-center"
            />
          </div>
          <div className="dashboard-footer-copy px-2">{footer1}</div>
          <div className="dashboard-footer-copy px-2">{footer2}</div>
        </div>
      </aside>

      <div className="dashboard-workspace flex-1 flex flex-col min-w-0">
        <header className="dashboard-header sticky top-0 z-30 border-b border-border bg-card">
          <div className="dashboard-header-inner flex items-center justify-between">
            <div className="dashboard-mobile-brand md:hidden flex items-center gap-2 min-w-0">
              <button
                type="button"
                data-tradisi="silent"
                onClick={() => setMobileNavOpen(true)}
                aria-label={t("Buka menu navigasi")}
                aria-expanded={mobileNavOpen}
                className="h-9 w-9 grid place-items-center rounded-md hover:bg-muted text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 shrink-0"
                data-testid="button-mobile-nav-open"
              >
                <Menu className="h-5 w-5" />
              </button>
              {brand?.logoDataUrl ? (
                <img
                  src={brand.logoDataUrl}
                  alt={appName}
                  className="h-8 w-8 rounded-md object-cover shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-md bg-white grid place-items-center shrink-0">
                  <img
                    src={brandSeal}
                    alt={appName}
                    className="h-8 w-8 object-contain"
                  />
                </div>
              )}
              <div className="dashboard-mobile-name">{appName}</div>
            </div>

            <nav
              className="dashboard-breadcrumb hidden md:flex"
              aria-label={t("Jejak navigasi")}
            >
              <Link
                href={
                  nav.find((item) =>
                    [
                      "/",
                      "/sanggar",
                      "/seniman",
                      "/pelatih",
                      "/juri",
                      "/admin",
                      "/pengrajin",
                      "/mitra",
                      "/konsumen",
                    ].includes(item.href),
                  )?.href ??
                  nav[0]?.href ??
                  "/"
                }
              >
                {t(labels[user.role])}
              </Link>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span aria-current="page">
                {activeNav?.label ?? t("Ruang kerja")}
              </span>
            </nav>

            <div className="dashboard-header-actions flex items-center gap-1 sm:gap-1.5">
              <CommunicationAccess />
              <GlobalActions
                nav={nav}
                role={user.role}
                user={user}
                db={db}
                navigate={navigate}
                translate={t}
              />

              <button
                type="button"
                data-tradisi="silent"
                onClick={cycleTheme}
                className="dashboard-theme-toggle h-9 w-9 grid place-items-center rounded-md hover:bg-muted transition-colors text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label={`${t("Ganti tema")} (${currentTheme})`}
                title={`Tema: ${currentTheme}`}
              >
                {currentTheme === "light" ? (
                  <Sun className="h-4 w-4" />
                ) : currentTheme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4 text-accent" />
                )}
              </button>

              <button
                type="button"
                data-tradisi="silent"
                data-testid="button-high-contrast"
                onClick={toggleHighContrast}
                aria-pressed={highContrast}
                className={`dashboard-contrast-toggle h-9 w-9 grid place-items-center rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${highContrast ? "text-accent" : "text-foreground/70 hover:text-foreground"}`}
                aria-label={t(
                  highContrast
                    ? "Nonaktifkan Kontras Tinggi"
                    : "Aktifkan Kontras Tinggi",
                )}
                title={t(
                  highContrast
                    ? "Kontras Tinggi: Aktif"
                    : "Kontras Tinggi: Nonaktif",
                )}
              >
                <Contrast className="h-4 w-4" />
              </button>

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  data-tradisi="silent"
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-label={t("Profil Saya")}
                  data-testid="button-profile-toggle"
                  aria-expanded={profileOpen}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <Avatar className="h-7 w-7 border border-accent/40">
                    {(user as any).fotoProfileDataUrl ? (
                      <img
                        src={(user as any).fotoProfileDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="dashboard-profile-name text-sm truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                {profileOpen && (
                  <div className="dashboard-profile-menu absolute right-0 mt-2 w-60 rounded-xl glass shadow-lg overflow-hidden p-1">
                    <div className="px-3 py-2.5 border-b border-border/60">
                      <div className="text-sm font-medium truncate">
                        {displayName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{user.username} · {t(labels[user.role])}
                      </div>
                    </div>
                    <div className="dashboard-mobile-preferences border-b border-border py-1">
                      <button
                        type="button"
                        onClick={cycleTheme}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted text-left"
                      >
                        <Sun className="h-4 w-4" />
                        {t("Ganti tema")} ({currentTheme})
                      </button>
                      <button
                        type="button"
                        onClick={toggleHighContrast}
                        aria-pressed={highContrast}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted text-left"
                      >
                        <Contrast className="h-4 w-4" />
                        {t(
                          highContrast
                            ? "Nonaktifkan Kontras Tinggi"
                            : "Aktifkan Kontras Tinggi",
                        )}
                      </button>
                    </div>
                    {profilePath && (
                      <button
                        type="button"
                        data-tradisi="silent"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate(profilePath);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted text-left"
                      >
                        <UserCog className="h-4 w-4" /> {t("Profil Saya")}
                      </button>
                    )}
                    <button
                      type="button"
                      data-tradisi="silent"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                        navigate("/");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive text-left"
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" /> {t("Keluar")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          id="dashboard-main"
          className="dashboard-main relative flex-1 min-w-0"
        >
          <ImpersonationBanner />
          {currentTheme !== "light" &&
            customTheme?.enabled &&
            customTheme.bgImageDataUrl && (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                  backgroundImage: `url(${customTheme.bgImageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: Math.max(
                    0,
                    Math.min(1, customTheme.bgOpacity ?? 0.22),
                  ),
                }}
              />
            )}
          {currentTheme !== "light" &&
            backdrop?.enabled &&
            backdrop.imageDataUrl && (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                  backgroundImage: `url(${backdrop.imageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: Math.max(0, Math.min(1, backdrop.opacity ?? 0.18)),
                  mixBlendMode: backdrop.blendMode ?? "soft-light",
                }}
              />
            )}
          <div key={loc} className="dashboard-page relative max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Bottom navigation (mobile only) */}
        <nav
          className="dashboard-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border/60"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label={t("Navigasi bawah")}
        >
          <div className="grid grid-cols-5">
            {nav.slice(0, 4).map((n) => {
              const active =
                activeNav?.href === n.href ||
                !!n.children?.some((child) => child.href === activeNav?.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium leading-none transition-colors ${
                    active
                      ? "text-foreground font-semibold"
                      : "text-foreground/85 hover:text-foreground"
                  }`}
                  data-testid={`bottomnav-${n.href.replace(/\//g, "-")}`}
                >
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
                  )}
                  <span className={active ? "text-accent" : ""}>{n.icon}</span>
                  <span className="truncate max-w-[68px]">{n.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              data-tradisi="silent"
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium leading-none text-foreground/85 hover:text-foreground transition-colors"
              aria-label={t("Buka menu navigasi")}
              data-testid="bottomnav-menu"
            >
              <Menu className="h-5 w-5" />
              <span>{t("Menu")}</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="app-shell-clean dashboard-shell dashboard-drawer w-[88vw] max-w-[340px] p-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{appName}</SheetTitle>
            <SheetDescription>{t("Navigasi utama")}</SheetDescription>
          </SheetHeader>
          <div className="relative flex h-full flex-col">
            {currentTheme !== "light" && studio?.sidebarImageDataUrl && (
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${studio.sidebarImageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: Math.max(
                    0,
                    Math.min(1, studio.sidebarImageOpacity ?? 0.18),
                  ),
                }}
              />
            )}
            <div className="dashboard-brand relative flex items-center gap-3">
              {brand?.logoDataUrl ? (
                <div
                  className="dashboard-brand-mark h-10 w-10 rounded-lg overflow-hidden grid place-items-center bg-white/5"
                  style={{
                    boxShadow:
                      "0 1px 3px hsl(var(--foreground) / 0.08), 0 0 0 1px hsl(var(--sidebar-border))",
                  }}
                >
                  <img
                    src={brand.logoDataUrl}
                    alt={appName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="dashboard-brand-mark h-10 w-10 rounded-lg grid place-items-center bg-white"
                  style={{
                    boxShadow:
                      "0 1px 3px hsl(var(--foreground) / 0.08), 0 0 0 1px hsl(var(--sidebar-border))",
                  }}
                >
                  <img
                    src={brandSeal}
                    alt={appName}
                    className="h-9 w-9 object-contain"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="dashboard-brand-name">{appName}</div>
                <div className="dashboard-brand-role">
                  {t(labels[user.role])}
                </div>
              </div>
              <button
                type="button"
                data-tradisi="silent"
                onClick={() => setMobileNavOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-md hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label={t("Tutup menu navigasi")}
                data-testid="button-mobile-nav-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav
              className="dashboard-nav-container relative flex-1 overflow-y-auto scrollbar-thin"
              aria-label={t("Navigasi utama")}
            >
              <SidebarNavList
                nav={nav}
                loc={loc}
                testIdPrefix="mobile-nav"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </nav>

            <div className="dashboard-sidebar-footer relative border-t border-sidebar-border p-3 space-y-2">
              <div className="px-1">
                <InstallPwaCard
                  variant="button"
                  className="w-full justify-center"
                />
              </div>
              <div className="dashboard-footer-copy px-2">{footer1}</div>
              <div className="dashboard-footer-copy px-2">{footer2}</div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
