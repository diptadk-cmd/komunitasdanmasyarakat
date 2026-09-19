import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Feather,
  Film,
  Headphones,
  Landmark,
  LockKeyhole,
  Megaphone,
  Menu,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { fmtDate } from "@/lib/store";
import type { InfoBudaya, News } from "@/lib/types";
import { HumanCheck } from "@/components/auth/HumanCheck";
import { TumpalSpinner } from "@/components/betawi/Ornaments";
import { CreativeMediaPlayer } from "@/components/system/CreativeMedia";
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
import budayaJakarta from "@/assets/layanan/budaya-jakarta.webp";

const SERVICES = [
  {
    name: "AHU",
    institution: "KEMENTERIAN HUKUM\nDAN HAM RI",
    href: "https://ahu.go.id",
    logo: ahuLogo,
  },
  {
    name: "OSS",
    institution: "KEMENTERIAN INVESTASI/BKPM",
    href: "https://oss.go.id",
    logo: ossLogo,
  },
  {
    name: "CORETAX",
    institution: "DIREKTORAT JENDERAL PAJAK",
    href: "https://coretaxdjp.pajak.go.id",
    logo: coretaxLogo,
  },
  {
    name: "BPJS Ketenagakerjaan",
    institution: "BPJS KETENAGAKERJAAN",
    href: "https://www.bpjsketenagakerjaan.go.id",
    logo: bpjsLogo,
  },
  {
    name: "Dinas Kebudayaan",
    institution: "DINAS KEBUDAYAAN\nPROVINSI DKI JAKARTA",
    href: "https://dinaskebudayaan.jakarta.go.id/",
    logo: dinasLogo,
  },
  {
    name: "KESBANGPOL",
    institution: "BADAN KESATUAN BANGSA DAN POLITIK",
    href: "https://bakesbangpol.jakarta.go.id/",
    logo: spbeLogo,
    overlayLabel: "KESBANGPOL",
  },
  {
    name: "Bank Jakarta",
    institution: "BANK DKI",
    href: "https://www.bankdki.co.id",
    logo: bankJakartaLogo,
  },
  {
    name: "JAK EVO",
    institution: "JAKARTA\nEVOLUTION",
    href: "https://jakevo.jakarta.go.id",
    logo: jakevoLogo,
  },
];

function ServiceCard({ service }: { service: (typeof SERVICES)[number] }) {
  return (
    <a
      href={service.href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`Buka layanan ${service.name}`}
      className="group relative block w-full max-w-[112px] justify-self-center overflow-hidden rounded-xl text-center transition duration-200 hover:-translate-y-0.5 hover:drop-shadow-[0_8px_12px_rgba(10,45,29,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07552f] focus-visible:ring-offset-2 xl:max-w-[104px]"
    >
      <img
        src={service.logo}
        alt={service.name}
        className="aspect-square w-full object-contain transition-transform duration-200 group-hover:scale-[1.018]"
      />
      {service.overlayLabel && (
        <span className="absolute bottom-[12.6%] left-[9%] right-[8%] grid h-[12.6%] place-items-center rounded-md border border-[#e7d7b5] bg-[#faf9f5] font-sans text-[clamp(8px,0.75vw,11px)] font-bold text-[#1466a2]">
          {service.overlayLabel}
        </span>
      )}
      <span className="sr-only">{service.institution}</span>
    </a>
  );
}

function BeritaShowcase({ items }: { items: News[] }) {
  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_4px_16px_rgba(10,45,29,0.08)]">
      <div className="flex items-center gap-2.5 border-b border-[#e7ece9] px-4 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf7f1] text-[#07552f]">
          <Megaphone className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-[-0.02em] text-[#10231b]">
            Berita & Pengumuman
          </h2>
          <p className="text-[10px] text-[#68756e]">
            Kabar terbaru Jak Sanggar
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#e7ece9] overflow-y-auto">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="px-4 py-3">
              <div className="text-[10px] font-medium text-[#718078]">
                {fmtDate(item.createdAt)}
              </div>
              <h3 className="mt-0.5 text-sm font-semibold leading-5 text-[#10231b]">
                {item.judul}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#526059]">
                {item.isi}
              </p>
            </article>
          ))
        ) : (
          <p className="m-3 rounded-xl bg-[#f3f6f4] p-4 text-sm text-[#526059]">
            Belum ada berita atau pengumuman.
          </p>
        )}
      </div>
    </article>
  );
}

function MediaKreatifShowcase({ items }: { items: InfoBudaya[] }) {
  const [active, setActive] = useState(() => {
    const firstPlayable = items.findIndex((item) => Boolean(item.mediaUrl));
    return Math.max(0, firstPlayable);
  });
  const current = items.length ? items[active % items.length] : null;

  useEffect(() => {
    if (items.length <= 1 || current?.mediaUrl) return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % items.length),
      7000,
    );
    return () => window.clearTimeout(timer);
  }, [active, current?.mediaUrl, items.length]);

  return (
    <article className="overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_4px_16px_rgba(10,45,29,0.10)]">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf7f1] text-[#07552f]">
            <Film className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[#10231b]">
              Media Kreatif
            </h2>
            <p className="text-[10px] text-[#617069]">
              Sajian sanggar diputar langsung
            </p>
          </div>
        </div>
        {current?.mediaUrl && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e8f5ed] px-2 py-0.5 text-[10px] font-semibold text-[#076239]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a8b4d]" />{" "}
            Aktif
          </span>
        )}
      </div>

      {current ? (
        <>
          <div className="h-[220px] overflow-hidden bg-[#082c1d] sm:h-[235px] xl:h-[clamp(190px,31vh,245px)]">
            <CreativeMediaPlayer
              key={current.id}
              item={current}
              autoplay
              className="h-full w-full"
            />
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#087242]">
              {current.kategori}
            </div>
            <h3 className="mt-0.5 text-base font-semibold text-[#10231b]">
              {current.judul}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#526059]">
              {current.ringkasan}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              {current.sumber ? (
                <span className="truncate text-[11px] text-[#758079]">
                  Sumber: {current.sumber}
                </span>
              ) : (
                <span />
              )}
              {items.length > 1 && (
                <div
                  className="flex shrink-0 items-center gap-1.5"
                  aria-label="Pilih media kreatif"
                >
                  {items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActive(index)}
                      aria-label={`Tampilkan ${item.judul}`}
                      aria-current={index === active % items.length}
                      className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07552f] ${index === active % items.length ? "w-7 bg-[#07552f]" : "w-2 bg-[#c7d4cd] hover:bg-[#7ea38f]"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="grid min-h-[260px] place-items-center bg-[#f2f7f4] px-6 text-center">
          <div>
            <Film className="mx-auto h-10 w-10 text-[#7d9588]" />
            <p className="mt-3 text-sm font-medium text-[#405148]">
              Belum ada media kreatif yang dipublikasikan.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { login } = useAuth();
  const db = useDb();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const budaya = [...db.infoBudaya]
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order || b.createdAt - a.createdAt)
    .slice(0, 6);
  const berita = [...db.news]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!verified) {
      toast({
        title: t("Selesaikan verifikasi terlebih dahulu."),
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      if (!user) {
        toast({
          title: t("Gagal masuk"),
          description: t("Username atau password tidak cocok."),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: `${t("Selamat Datang Kembali")}, ${(user as any).nama || (user as any).namaSanggar || user.username}`,
      });
      navigate(`/${user.role}`);
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

  return (
    <div className="min-h-screen bg-[#fbfcfb] font-sans text-[#101916]">
      <main className="grid min-h-screen xl:h-screen xl:grid-cols-[minmax(0,1fr)_410px] xl:overflow-hidden">
        <section
          id="layanan"
          className="order-2 min-w-0 px-4 py-5 sm:px-6 lg:px-6 lg:py-5 xl:order-1 xl:h-screen xl:overflow-hidden xl:p-3"
        >
          <h1 className="sr-only">Portal Layanan Pemerintah dan Jak Sanggar</h1>
          <div
            id="kolaborasi"
            className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4"
          >
            {SERVICES.map((service) => (
              <ServiceCard key={service.name} service={service} />
            ))}
          </div>

          <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
            <MediaKreatifShowcase items={budaya} />
            <BeritaShowcase items={berita} />
          </div>
        </section>

        <aside
          id="masuk"
          className="relative order-1 border-t border-[#e5e8e6] bg-white xl:order-2 xl:h-screen xl:overflow-y-auto xl:border-l xl:border-t-0"
        >
          <div className="relative h-[150px] overflow-hidden bg-white xl:h-[132px]">
            <img
              src={budayaJakarta}
              alt="Ilustrasi budaya Jakarta dan Monas"
              className="h-full w-full object-cover object-center"
            />
          </div>

          <div className="relative z-10 -mt-2 px-3 pb-3">
            <div className="rounded-2xl border border-[#e2e5e3] bg-white p-3 shadow-[0_3px_12px_rgba(8,47,29,0.09)]">
              <form onSubmit={onSubmit} className="space-y-2.5">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Nama Pengguna
                  </label>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <User
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0d1d17]"
                        fill="currentColor"
                      />
                      <input
                        id="login-username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="Masukkan nama pengguna"
                        autoComplete="username"
                        required
                        data-testid="input-username"
                        className="h-10 w-full rounded-lg border border-[#ccd1ce] bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-[#69716d] focus:border-[#087242] focus:ring-2 focus:ring-[#087242]/15"
                      />
                    </div>
                    <Link
                      href="/daftar"
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#003d24] px-4 text-sm font-semibold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] transition hover:bg-[#075a35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07552f] focus-visible:ring-offset-2"
                    >
                      Daftar
                    </Link>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0d1d17]"
                      fill="currentColor"
                    />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Masukkan kata sandi"
                      autoComplete="current-password"
                      required
                      data-testid="input-password"
                      className="h-10 w-full rounded-lg border border-[#ccd1ce] bg-white pl-10 pr-10 text-sm outline-none transition placeholder:text-[#69716d] focus:border-[#087242] focus:ring-2 focus:ring-[#087242]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((show) => !show)}
                      aria-label={
                        showPassword
                          ? "Sembunyikan kata sandi"
                          : "Tampilkan kata sandi"
                      }
                      className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md transition hover:bg-[#eef3f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07552f]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-right">
                    <Link
                      href="/lupa-password"
                      className="text-xs font-medium text-[#07552f] hover:underline"
                    >
                      Lupa Password?
                    </Link>
                  </div>
                </div>

                <HumanCheck onVerifiedChange={setVerified} />

                <button
                  type="submit"
                  disabled={busy || !verified}
                  data-testid="button-login"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#eaa516] via-[#e3a526] to-[#eca919] text-base font-bold text-white shadow-[inset_0_-2px_0_rgba(133,86,0,0.12),0_4px_10px_rgba(185,125,14,0.18)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {busy ? (
                    <TumpalSpinner size={19} />
                  ) : (
                    <ShieldCheck className="h-5 w-5 fill-[#07552f] text-[#07552f]" />
                  )}
                  {busy ? t("Memverifikasi...") : "Masuk Akun"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="mt-2 flex h-11 w-full items-center gap-3 rounded-xl border border-[#dde2df] px-4 text-left transition hover:border-[#aac0b4] hover:bg-[#f8fbf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07552f]"
              >
                <Headphones
                  className="h-6 w-6 shrink-0 text-[#052e1d]"
                  strokeWidth={2.2}
                />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-xs text-[#37433e]">
                    Butuh Bantuan?
                  </span>
                  <span className="block text-[15px] font-semibold">
                    Tanya BangDipta
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-[#07552f]" />
              </button>

              <div
                className="mt-2 flex items-center justify-center gap-3 text-[#d99a19]"
                aria-hidden="true"
              >
                <Feather className="h-5 w-20" />
                <Landmark className="h-8 w-10 text-[#092f20]" fill="#d99a19" />
                <Feather className="h-5 w-20 -scale-x-100" />
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-[#123727]">
                <span>BUDAYA</span>
                <span className="h-1 w-1 rounded-full bg-[#07552f]" />
                <span>KREATIVITAS</span>
                <span className="h-1 w-1 rounded-full bg-[#07552f]" />
                <span>KEBERSAMAAN</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[#617069] xl:hidden">
              <Menu className="h-4 w-4" /> Geser ke bawah untuk melihat seluruh
              layanan
            </div>
          </div>
        </aside>
      </main>

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
            <p className="rounded-xl bg-[#f3f6f4] p-4 text-sm leading-6 text-[#526059]">
              Jika akun dinonaktifkan atau data pendaftaran perlu diperbaiki,
              hubungi pengelola Jak Sanggar di instansi Anda.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
