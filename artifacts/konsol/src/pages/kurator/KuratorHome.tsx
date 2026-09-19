import { Link } from "wouter";
import { useDb } from "@/lib/auth";
import { fmtRp } from "@/lib/store";
import { cashOverview } from "@/lib/cash-overview";
import { Users, GraduationCap, Palette, Wallet, ArrowUpRight, ShieldCheck, FileText, Sliders, Trophy, Images, FileSpreadsheet, CheckCircle2, Activity, CalendarDays } from "lucide-react";
import { ComposedChart, Bar, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import "./kurator-home.css";

const shortcuts = [
  { href: "/akun", label: "Akun pengguna", text: "Kelola profil & akses", icon: Users },
  { href: "/dokumen", label: "Studio dokumen", text: "Template & administrasi", icon: FileText },
  { href: "/kurasi", label: "Sistem kurasi", text: "Indikator & penilaian", icon: Sliders },
  { href: "/penugasan", label: "Penugasan juri", text: "Atur tim penilai", icon: Trophy },
  { href: "/media-kreatif", label: "Media kreatif", text: "Karya & publikasi", icon: Images },
  { href: "/rekapan", label: "Rekapan", text: "Transaksi & pencatatan", icon: FileSpreadsheet },
];

const activityLabels: Record<string, string> = {
  "login": "Masuk ke aplikasi", "auth.login": "Sesi masuk dimulai", "profile-edit": "Profil diperbarui",
  "http.post": "Data dikirim", "http.patch": "Data diperbarui", "http.put": "Data disimpan",
  "http.delete": "Data dihapus", "auth.impersonate.start": "Pendampingan akun dimulai",
  "impersonate-start": "Pendampingan akun dimulai", "auth.logout": "Keluar dari aplikasi",
};

export default function KuratorHome() {
  const db = useDb();
  const sanggar = db.users.filter(u => u.role === "sanggar");
  const pendingVerification = db.users.filter(u => u.role === "mitra_pengrajin" && u.statusVerifikasiTokoOffline === "menunggu_verifikasi").length;
  const pendingCooperation = db.kerjasama.filter(k => k.status === "menunggu" || k.status === "negosiasi").length;
  const stats = [
    { label: "Sanggar terdaftar", value: sanggar.length.toLocaleString("id-ID"), icon: Users, href: "/akun" },
    { label: "Pelatih", value: db.users.filter(u => u.role === "pelatih").length.toLocaleString("id-ID"), icon: GraduationCap, href: "/akun" },
    { label: "Seniman", value: db.users.filter(u => u.role === "seniman").length.toLocaleString("id-ID"), icon: Palette, href: "/akun" },
    { label: "Total saldo sanggar", value: fmtRp(sanggar.reduce((total, u) => total + u.saldo, 0)), icon: Wallet, href: "/manajemen" },
  ];
  const chart = cashOverview(db.kas);
  const activities = [...db.activity].sort((a, b) => b.ts - a.ts).slice(0, 6);

  return (
    <div className="kurator-home" data-testid="kurator-home">
      <header className="kh-heading">
        <div><p className="kh-context">Konsol kurator</p><h1>Ruang kerja kebudayaan.</h1><p>Pantau ekosistem, tindak lanjuti kebutuhan, dan beri ruang bagi karya.</p></div>
        <div className="kh-date"><CalendarDays aria-hidden="true" /><span>{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div>
      </header>

      <section className="kh-stats" aria-label="Ringkasan ekosistem">
        {stats.map(({ label, value, icon: Icon, href }) => <Link href={href} key={label} className="kh-stat"><div><Icon aria-hidden="true" /><ArrowUpRight aria-hidden="true" /></div><span>{label}</span><strong>{value}</strong></Link>)}
      </section>

      <div className="kh-workspace">
        <section className="kh-priorities" aria-labelledby="kh-priority-title">
          <div className="kh-section-heading"><h2 id="kh-priority-title">Perlu ditinjau</h2><ShieldCheck aria-hidden="true" /></div>
          <p>Tindak lanjut yang menjaga layanan tetap berjalan.</p>
          <Link href="/akun" className="kh-task"><span className="kh-task-icon"><Users aria-hidden="true" /></span><span><strong>Verifikasi akun mitra</strong><small>{pendingVerification ? `${pendingVerification} permintaan menunggu pemeriksaan` : "Tidak ada permintaan menunggu"}</small></span><span className="kh-count">{pendingVerification}</span><ArrowUpRight aria-hidden="true" /></Link>
          <Link href="/kerjasama" className="kh-task"><span className="kh-task-icon"><FileText aria-hidden="true" /></span><span><strong>Kerja sama sanggar</strong><small>{pendingCooperation ? `${pendingCooperation} pengajuan atau negosiasi` : "Tidak ada kerja sama tertunda"}</small></span><span className="kh-count">{pendingCooperation}</span><ArrowUpRight aria-hidden="true" /></Link>
          {pendingVerification + pendingCooperation === 0 && <div className="kh-clear"><CheckCircle2 aria-hidden="true" /><span>Antrean verifikasi dan kerja sama sudah tertangani.</span></div>}
          <Link href="/manajemen" className="kh-primary-link">Buka manajemen data<ArrowUpRight aria-hidden="true" /></Link>
        </section>

        <section className="kh-shortcuts" aria-labelledby="kh-shortcut-title"><div className="kh-section-heading"><h2 id="kh-shortcut-title">Akses cepat</h2><span>Pekerjaan sehari-hari</span></div><div className="kh-shortcut-grid">{shortcuts.map(({ href, label, text, icon: Icon }) => <Link href={href} key={href}><Icon aria-hidden="true" /><strong>{label}</strong><span>{text}</span><ArrowUpRight className="kh-shortcut-arrow" aria-hidden="true" /></Link>)}</div></section>
      </div>

      <div className="kh-insights">
        <section className="kh-panel" aria-labelledby="kh-cash-title">
          <div className="kh-section-heading"><div><h2 id="kh-cash-title">Arus kas sistem</h2><p>Akumulasi transaksi seluruh sanggar, dalam ribu rupiah.</p></div><Link href="/rekapan">Lihat rekapan<ArrowUpRight aria-hidden="true" /></Link></div>
          {chart.length ? <><div className="kh-legend"><span><i className="kh-in" />Pemasukan</span><span><i className="kh-out" />Pengeluaran</span><span><i className="kh-net" />Arus bersih kumulatif</span></div><div className="kh-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} accessibilityLayer margin={{ top: 12, right: 6, left: -15, bottom: 0 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="tgl" tick={{ fontSize: 10 }} minTickGap={30} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" }} formatter={(value: number, name: string) => [`${value.toLocaleString("id-ID")} rb`, name === "masuk" ? "Pemasukan" : name === "keluar" ? "Pengeluaran" : "Arus bersih kumulatif"]} /><Bar dataKey="masuk" fill="#147D73" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} /><Bar dataKey="keluar" fill="#C57455" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} /><Line dataKey="bersih" stroke="#BC8B32" strokeWidth={2.5} dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div></> : <div className="kh-empty"><Wallet aria-hidden="true" /><h3>Transaksi akan tampil di sini</h3><p>Grafik terisi setelah sanggar mencatat pemasukan atau pengeluaran.</p><Link href="/manajemen">Lihat pencatatan kas<ArrowUpRight aria-hidden="true" /></Link></div>}
        </section>
        <section className="kh-panel" aria-labelledby="kh-activity-title"><div className="kh-section-heading"><h2 id="kh-activity-title">Aktivitas terbaru</h2><Activity aria-hidden="true" /></div>{activities.length ? <ol className="kh-activity">{activities.map(a => <li key={a.id}><span className="kh-activity-dot" /><div><strong>{activityLabels[a.action] ?? a.action.replace(/[._-]/g, " ")}</strong><span>{a.actorRole === "sewa" ? "Konsumen" : a.actorRole.replace(/_/g, " ")}</span><time dateTime={new Date(a.ts).toISOString()}>{new Date(a.ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div></li>)}</ol> : <div className="kh-empty kh-empty-small"><Activity aria-hidden="true" /><p>Belum ada aktivitas tercatat.</p></div>}</section>
      </div>
      <aside className="kh-publication"><div><Images aria-hidden="true" /><span><strong>Berita untuk komunitas</strong><small>Kelola pengumuman dan agenda yang tampil di portal.</small></span></div><Link href="/pengumuman">Kelola publikasi<ArrowUpRight aria-hidden="true" /></Link></aside>
    </div>
  );
}
