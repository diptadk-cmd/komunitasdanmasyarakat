import { useAuth, useDb } from "@/lib/auth";
import { fmtRp, fmtDate } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import type { SanggarUser } from "@/lib/types";
import {
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Bar,
  Line,
} from "recharts";
import {
  Users,
  CalendarDays,
  Wallet,
  Bell,
  ArrowRight,
  GraduationCap,
  Boxes,
  Handshake,
  UserPlus,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Clock3,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { SanggarCover } from "@/components/profile/SanggarCover";
import { NewsSlider } from "@/components/system/NewsSlider";
const sanggarIllustration = `${import.meta.env.BASE_URL}brand/jaksanggar-community-banner-20260920-v1.webp`;
import { ImagePlus, MessageSquare, ChevronRight } from "lucide-react";
import "./sanggar-home.css";

const agendaDate = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
});

export default function SanggarHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "sanggar") return null;
  const sg = (db.users.find(
    (item) => item.id === user.id && item.role === "sanggar",
  ) ?? user) as SanggarUser;

  const members = db.users.filter(
    (u) =>
      (u.role === "seniman" || u.role === "pelatih") &&
      u.sanggarId === sg.id &&
      u.status === "aktif",
  );
  const kas = db.kas
    .filter((k) => k.sanggarId === sg.id)
    .sort((a, b) => a.tanggal - b.tanggal);
  const chartData = kas.map((k) => ({
    tgl: fmtDate(k.tanggal),
    saldo: k.saldo / 1000,
    masuk: k.debit / 1000,
    keluar: k.kredit / 1000,
  }));
  const pendingReq = db.users.filter(
    (u) =>
      (u.role === "seniman" || u.role === "pelatih") &&
      u.sanggarId === sg.id &&
      u.status === "pending",
  ).length;
  const pendingIuran = db.iuran.filter(
    (i) => i.sanggarId === sg.id && i.status === "pending" && i.buktiDataUrl,
  ).length;
  const pendingHonor = db.pengajuanHonor.filter(
    (h) => h.sanggarId === sg.id && h.status === "pending",
  ).length;
  const banner = db.banners.find((b) => b.active);

  const asetCount =
    db.aset.filter((a) => a.sanggarId === sg.id).length +
    db.sarpras.filter((s) => s.sanggarId === sg.id).length;
  const kerjasamaPending = db.kerjasama.filter(
    (k) =>
      (k.sanggarPenyediaId === sg.id || k.sanggarPeminjamId === sg.id) &&
      (k.status === "menunggu" || k.status === "negosiasi"),
  ).length;
  const latihan = db.latihan.filter((item) => item.sanggarId === sg.id);
  const now = Date.now();
  const upcomingLatihan = latihan
    .map((item) => ({
      ...item,
      startsAt: new Date(`${item.tanggal}T${item.jam}:00+07:00`).getTime(),
    }))
    .filter((item) => Number.isFinite(item.startsAt) && item.startsAt >= now)
    .sort((a, b) => a.startsAt - b.startsAt);
  const pembinaanTerdaftar = db.pendaftaranPembinaan.some(
    (item) => item.sanggarId === sg.id,
  );
  const pendingActions = [
    {
      href: "/sanggar/keanggotaan",
      label: "Permohonan gabung",
      description: "Tinjau tab Permohonan Gabung di Keanggotaan.",
      count: pendingReq,
      icon: UserPlus,
    },
    {
      href: "/sanggar/buku-kas",
      label: "Bukti pembayaran iuran",
      description: "Periksa bukti pada tab Validasi di Buku Kas.",
      count: pendingIuran,
      icon: ShieldCheck,
    },
    {
      href: "/sanggar/buku-kas",
      label: "Pengajuan honor pelatih",
      description: "Tinjau pengajuan pada tab Validasi di Buku Kas.",
      count: pendingHonor,
      icon: Wallet,
    },
    {
      href: "/sanggar/kerjasama/permintaan",
      label: "Kerjasama berlangsung",
      description: "Pantau permintaan yang menunggu atau dalam negosiasi.",
      count: kerjasamaPending,
      icon: Handshake,
    },
  ].filter((action) => action.count > 0);
  const pendingTotal =
    pendingReq + pendingIuran + pendingHonor + kerjasamaPending;

  const tiles = [
    {
      href: "/sanggar/keanggotaan",
      label: "Keanggotaan",
      icon: Users,
      description: `${members.length} anggota aktif`,
    },
    {
      href: "/sanggar/latihan",
      label: "Latihan",
      icon: CalendarDays,
      description: `${upcomingLatihan.length} jadwal mendatang`,
    },
    {
      href: "/sanggar/pembinaan",
      label: "Pembinaan",
      icon: GraduationCap,
      description: pembinaanTerdaftar
        ? "Sanggar sudah terdaftar"
        : "Daftar & kelola delegasi",
    },
    {
      href: "/sanggar/aset",
      label: "Aset & Sarana",
      icon: Boxes,
      description: `${asetCount} aset & sarana tercatat`,
    },
    {
      href: "/sanggar/kerjasama",
      label: "Kerjasama",
      icon: Handshake,
      description: "Katalog & permintaan",
    },
    {
      href: "/sanggar/buku-kas",
      label: "Buku Kas",
      icon: Wallet,
      description: "Transaksi & validasi",
    },
    {
      href: "/sanggar/dokumen",
      label: "Dokumen",
      icon: FileText,
      description: "Surat & administrasi",
    },
    {
      href: "/sanggar/karya",
      label: "Karya sanggar",
      icon: ImagePlus,
      description: "Kelola publikasi karya",
    },
  ];

  return (
    <div className="sanggar-home space-y-6" data-testid="sanggar-home">
      <header className="sg-heading">
        <div>
          <p>Beranda sanggar</p>
          <span>Kelola kegiatan dan kebutuhan sanggar hari ini.</span>
        </div>
        <Link href="/pesan" className="sg-message-link">
          <MessageSquare aria-hidden="true" />
          Pesan & chat
        </Link>
      </header>
      <section className="sg-hero" aria-labelledby="sanggar-name">
        <div className="sg-identity">
          <p className="sg-greeting">Selamat datang kembali</p>
          <h1 id="sanggar-name">{sg.namaSanggar}</h1>
          <p className="sg-chair">Dikelola oleh {sg.namaKetua}</p>
          {sg.jenisKesenian.length > 0 && (
            <div className="sg-arts">
              {sg.jenisKesenian.map((art) => (
                <span key={art}>{art}</span>
              ))}
            </div>
          )}
          <div className="sg-hero-actions">
            <Link href="/sanggar/profil" className="sg-profile-link">
              Profil sanggar
              <ChevronRight aria-hidden="true" />
            </Link>
            <Link href="/sanggar/karya" className="sg-work-link">
              <ImagePlus aria-hidden="true" />
              Publikasi karya
            </Link>
          </div>
        </div>
        <SanggarCover
          key={sg.id}
          sanggar={sg}
          fallbackSrc={sanggarIllustration}
        />
      </section>

      {banner && (
        <div className="sg-announcement flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.05] p-4">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm text-foreground/85">{banner.teks}</div>
        </div>
      )}

      {/* KPI cards */}
      <div className="sg-stats grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={Wallet}
          label="Saldo kas"
          value={sg.saldo}
          format={(n) => fmtRp(n)}
        />
        <Stat icon={Users} label="Anggota aktif" value={members.length} />
        <Stat
          icon={UserPlus}
          label="Permohonan gabung"
          value={pendingReq}
          pending={pendingReq > 0}
        />
        <Stat
          icon={ShieldCheck}
          label="Validasi tertunda"
          value={pendingIuran + pendingHonor}
          pending={pendingIuran + pendingHonor > 0}
        />
      </div>

      <section className="sg-attention" aria-labelledby="sg-attention-title">
        <div className="sg-section-heading">
          <div>
            <h2 id="sg-attention-title">Perlu ditindaklanjuti</h2>
            <p>Permohonan dan validasi untuk sanggar Anda.</p>
          </div>
          {pendingTotal > 0 ? (
            <span className="sg-pending-total">{pendingTotal} menunggu</span>
          ) : null}
        </div>
        {pendingActions.length > 0 ? (
          <div className="sg-action-list">
            {pendingActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="sg-action-row"
              >
                <span className="sg-action-icon">
                  <action.icon aria-hidden="true" />
                </span>
                <span className="sg-action-copy">
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </span>
                <span
                  className="sg-action-count"
                  aria-label={`${action.count} menunggu`}
                >
                  {action.count}
                </span>
                <ChevronRight className="sg-action-arrow" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="sg-attention-empty">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <strong>Belum ada tindak lanjut yang menunggu</strong>
              <p>
                Permohonan gabung, bukti iuran, honor, dan kerjasama yang
                menunggu akan muncul di sini.
              </p>
            </div>
          </div>
        )}
      </section>

      <NewsSlider news={db.news} title="Berita komunitas" />

      <section className="sg-services">
        <div className="sg-section-heading">
          <h2>Kelola sanggar</h2>
          <span>Semua kebutuhan dalam satu tempat</span>
        </div>
        <div className="sg-service-grid">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href}>
              <Card
                data-testid={`tile-${t.href.split("/").pop()}`}
                className="h-full cursor-pointer p-4 transition-colors hover:border-primary/25"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="h-12 w-12 rounded-xl grid place-items-center"
                    style={{
                      background: "hsl(var(--primary) / 0.08)",
                      border: "1px solid hsl(var(--primary) / 0.12)",
                      color: "hsl(var(--primary))",
                    }}
                  >
                    <t.icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="sg-service-arrow" aria-hidden="true" />
                </div>
                <div className="mt-3 font-medium leading-tight">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group">
                  {t.description}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="sg-overview">
        <section className="sg-finance" aria-labelledby="sg-finance-title">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="sg-finance-title" className="font-serif text-lg">
                  Perjalanan kas sanggar
                </h2>
                <p className="text-xs text-muted-foreground">
                  Riwayat saldo (dalam ribu Rupiah)
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-6 rounded-sm"
                    style={{
                      background: "#123047",
                    }}
                  />
                  Saldo
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{
                      background: "#147D73",
                    }}
                  />
                  Pemasukan
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{
                      background: "#C17445",
                    }}
                  />
                  Pengeluaran
                </span>
              </div>
            </div>
            <div className="sg-chart h-56 mt-4">
              {chartData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">
                  <div className="sg-empty-cash">
                    <Wallet aria-hidden="true" />
                    <h3>Mulai catat perjalanan kas sanggar</h3>
                    <p>
                      Riwayat pemasukan dan pengeluaran akan tampil di sini.
                    </p>
                    <Link href="/sanggar/buku-kas">
                      Catat transaksi pertama
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} barGap={2} accessibilityLayer>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="tgl"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent) / 0.07)" }}
                      contentStyle={{
                        background: "hsl(var(--popover) / 0.92)",
                        border: "1px solid hsl(var(--accent) / 0.35)",
                        borderRadius: 12,
                        backdropFilter: "blur(14px)",
                        boxShadow:
                          "0 12px 28px -18px hsl(var(--foreground) / 0.28)",
                        padding: "8px 12px",
                      }}
                      labelStyle={{
                        color: "hsl(var(--foreground))",
                        fontWeight: 600,
                        fontSize: 11,
                        marginBottom: 4,
                      }}
                      itemStyle={{ fontSize: 12 }}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString("id-ID")} rb`,
                        name === "masuk"
                          ? "Pemasukan"
                          : name === "keluar"
                            ? "Pengeluaran"
                            : "Saldo",
                      ]}
                    />
                    <Bar
                      dataKey="masuk"
                      isAnimationActive={false}
                      fill="#147D73"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="keluar"
                      isAnimationActive={false}
                      fill="#C17445"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      type="monotone"
                      isAnimationActive={false}
                      dataKey="saldo"
                      stroke="var(--sg-ink)"
                      strokeWidth={2.5}
                      dot={{
                        r: 3,
                        fill: "hsl(var(--card))",
                        stroke: "var(--sg-ink)",
                        strokeWidth: 1,
                      }}
                      activeDot={{
                        r: 5,
                        fill: "var(--sg-ink)",
                        stroke: "hsl(var(--card))",
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <Link href="/sanggar/buku-kas" className="sg-section-link">
              Buka buku kas
              <ArrowRight aria-hidden="true" />
            </Link>
          </Card>
        </section>
        <section className="sg-agenda" aria-labelledby="sg-agenda-title">
          <div className="sg-section-heading">
            <div>
              <h2 id="sg-agenda-title">Latihan berikutnya</h2>
              <p>Jadwal mendatang dalam waktu WIB.</p>
            </div>
            <CalendarDays aria-hidden="true" />
          </div>
          {upcomingLatihan.length > 0 ? (
            <ul className="sg-agenda-list">
              {upcomingLatihan.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <time dateTime={`${item.tanggal}T${item.jam}:00+07:00`}>
                    {agendaDate.format(item.startsAt)}
                    <span>
                      <Clock3 aria-hidden="true" />
                      {item.jam} WIB
                    </span>
                  </time>
                  <h3>{item.kurikulum || "Latihan sanggar"}</h3>
                  <p>
                    <MapPin aria-hidden="true" />
                    {item.tempat || "Tempat belum ditentukan"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="sg-agenda-empty">
              <CalendarDays aria-hidden="true" />
              <h3>Belum ada jadwal mendatang</h3>
              <p>
                Tambahkan jadwal agar anggota dapat menyiapkan latihan
                berikutnya.
              </p>
            </div>
          )}
          <Link href="/sanggar/latihan" className="sg-section-link">
            {upcomingLatihan.length > 0
              ? "Lihat semua jadwal"
              : "Atur jadwal latihan"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  pending,
  format,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  pending?: boolean;
  format?: (n: number) => string;
}) {
  return (
    <Card className="sg-stat relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {label}
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/10 bg-primary/[0.07] text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <div
        className={`mt-2 font-serif text-2xl sm:text-3xl ${pending ? "text-destructive" : "text-foreground"}`}
      >
        {format ? format(value) : value.toLocaleString("id-ID")}
      </div>
    </Card>
  );
}
