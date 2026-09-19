import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { BackButton } from "@/components/layout/BackButton";
import {
  ArrowRight,
  Boxes,
  Building2,
  GraduationCap,
  Hammer,
  Music,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { HighContrastToggle } from "@/components/system/HighContrastToggle";
import { PucukRebungDivider } from "@/components/betawi/Ornaments";
import brandSeal from "@/assets/brand/jak-sanggar-seal.png";

export default function RegisterChoice() {
  const opts = [
    {
      href: "/daftar/sanggar",
      slug: "sanggar",
      icon: <Building2 className="h-6 w-6" />,
      title: "Sanggar",
      desc: "Lembaga atau organisasi pengelola kegiatan kesenian.",
      note: "Akun tersimpan di server",
    },
    {
      href: "/daftar/pelatih",
      slug: "pelatih",
      icon: <GraduationCap className="h-6 w-6" />,
      title: "Pelatih",
      desc: "Tenaga profesional yang menjadi instruktur sanggar.",
    },
    {
      href: "/daftar/seniman",
      slug: "seniman",
      icon: <Music className="h-6 w-6" />,
      title: "Seniman",
      desc: "Anggota sanggar — penari, pemusik, atau pemeran.",
    },
    {
      href: "/daftar/pengrajin",
      slug: "pengrajin",
      icon: <Hammer className="h-6 w-6" />,
      title: "Pengrajin",
      desc: "Usaha kerajinan khas Jakarta yang ingin tampil pada peta publik.",
      note: "Lokasi terhubung ke peta",
    },
    {
      href: "/daftar/mitra",
      slug: "mitra",
      icon: <Boxes className="h-6 w-6" />,
      title: "Mitra",
      desc: "Mitra yang membeli, menyewa, dan bekerja sama dengan Pengrajin, Sanggar, Seniman, atau Pelatih untuk dijual kembali melalui kanal milik Mitra.",
      note: "Toko offline & dokumen wajib diverifikasi Kurator",
    },
    {
      href: "/daftar/konsumen",
      slug: "konsumen",
      icon: <ShoppingBag className="h-6 w-6" />,
      title: "Konsumen",
      desc: "Pribadi atau organisasi yang membeli produk dan memesan layanan untuk digunakan sendiri, bukan untuk dijual kembali.",
    },
  ];

  return (
    <div
      className="min-h-screen relative overflow-hidden px-4 py-8 sm:py-12"
      style={{
        background:
          "linear-gradient(135deg, hsl(40 33% 96%) 0%, hsl(42 26% 90%) 100%)",
      }}
    >
      <img
        src={brandSeal}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-24 h-[26rem] w-[26rem] object-contain opacity-[0.07]"
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <BackButton to="/" label="Kembali ke Login" />
          <HighContrastToggle />
        </div>

        <header className="mt-8 sm:mt-12 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-1 w-6 rounded-full bg-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
              Pendaftaran Akun
            </span>
            <span className="h-1 w-6 rounded-full bg-accent" />
          </div>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[42px] leading-[1.12] tracking-tight">
            Pilih Tipe Pendaftaran
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto text-pretty leading-relaxed">
            Tentukan peran yang paling sesuai untuk memulai proses pendaftaran.
          </p>
          <div className="mt-6 mx-auto max-w-sm">
            <PucukRebungDivider className="opacity-50" />
          </div>
        </header>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {opts.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-testid={`link-daftar-${o.slug}`}
            >
              <Card className="relative h-full flex flex-col overflow-hidden p-7 cursor-pointer">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="h-14 w-14 rounded-xl grid place-items-center bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors duration-300 group-hover:bg-accent/15 group-hover:text-accent-foreground group-hover:ring-accent/40">
                  {o.icon}
                </div>

                <h2 className="mt-5 font-serif text-xl tracking-tight">
                  {o.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {o.desc}
                </p>

                {o.note && (
                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    {o.note}
                  </p>
                )}

                <div className="mt-6 pt-4 border-t border-border/70 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Mulai Daftar
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <p className="mt-10 flex items-start justify-center gap-2 text-xs text-muted-foreground text-pretty max-w-lg mx-auto text-center">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-px text-accent" />
          <span>
            Akun Kurator dan Admin tetap dikelola khusus dan tidak dapat
            didaftarkan dari halaman ini.
          </span>
        </p>
      </div>
    </div>
  );
}
