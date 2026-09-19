import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import type { SanggarUser } from "@/lib/types";
import { fmtDate, fmtRp } from "@/lib/store";
import { openPrintWindow, rawHtml, safeHtml } from "@/lib/print";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileCheck2,
  Lightbulb,
  PackageCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";

interface Insight {
  id: string;
  label: string;
  detail: string;
  href: string;
  level: "aman" | "perhatian" | "prioritas";
  icon: typeof Users;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export default function PusatKendali() {
  const { user } = useAuth();
  const db = useDb();
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("Saya siap membaca data sanggar dan menyusun prioritas kerja Anda.");

  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;

  const members = db.users.filter(
    (u) => (u.role === "seniman" || u.role === "pelatih") && (u as any).sanggarId === sg.id,
  );
  const activeMembers = members.filter((u) => (u as any).status === "aktif");
  const pendingMembers = members.filter((u) => (u as any).status === "pending");
  const latihan = db.latihan.filter((item) => item.sanggarId === sg.id);
  const kas = db.kas.filter((item) => item.sanggarId === sg.id);
  const assets = db.aset.filter((item) => item.sanggarId === sg.id);
  const facilities = db.sarpras.filter((item) => item.sanggarId === sg.id);
  const publishedAssets = [...assets, ...facilities].filter((item) => item.statusPublish);
  const documents = db.dokumenArsip.filter((item) => item.sanggarId === sg.id);
  const submissions = db.kurasiSubmissions.filter((item) => item.sanggarId === sg.id);
  const coaching = db.pendaftaranPembinaan.filter((item) => item.sanggarId === sg.id);
  const rentals = db.pemesananSewa.filter((item) => item.sanggarId === sg.id);
  const partnerships = db.kerjasama.filter(
    (item) => item.sanggarPenyediaId === sg.id || item.sanggarPeminjamId === sg.id,
  );

  const profileChecks = [
    Boolean(sg.namaSanggar), Boolean(sg.namaKetua), Boolean(sg.alamat), Boolean(sg.legalitas),
    Boolean(sg.rekening?.nomor && sg.rekening.nomor !== "-"), Boolean(sg.deskripsi),
    Boolean(sg.tahunBerdiri), Boolean(sg.fotoProfileDataUrl), Boolean(sg.npwp),
  ];
  const profileScore = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);
  const membershipScore = clamp(activeMembers.length * 8 + (activeMembers.length >= 10 ? 20 : 0));
  const trainingScore = clamp(latihan.length * 12);
  const adminScore = clamp(documents.length * 14 + (sg.bentukKedudukan ? 18 : 0));
  const financialScore = clamp((kas.length > 0 ? 45 : 10) + (sg.saldo > 0 ? 35 : 0) + (sg.rekening?.nomor ? 20 : 0));
  const readinessScore = Math.round(
    profileScore * 0.25 + membershipScore * 0.2 + trainingScore * 0.2 + adminScore * 0.2 + financialScore * 0.15,
  );

  const lastCash = [...kas].sort((a, b) => b.tanggal - a.tanggal)[0];
  const cashIn = kas.reduce((sum, item) => sum + item.debit, 0);
  const cashOut = kas.reduce((sum, item) => sum + item.kredit, 0);
  const cashFlow = cashIn - cashOut;

  const insights = useMemo<Insight[]>(() => {
    const rows: Insight[] = [];
    if (profileScore < 80) rows.push({
      id: "profil", label: "Lengkapi profil kelembagaan", detail: `Kelengkapan profil baru ${profileScore}%. Data legalitas, NPWP, foto, dan deskripsi meningkatkan kredibilitas katalog.`, href: "/sanggar/profil", level: profileScore < 55 ? "prioritas" : "perhatian", icon: ShieldCheck,
    });
    if (pendingMembers.length > 0) rows.push({
      id: "anggota", label: "Validasi permohonan anggota", detail: `${pendingMembers.length} anggota menunggu keputusan.`, href: "/sanggar/keanggotaan", level: "prioritas", icon: Users,
    });
    if (latihan.length < 4) rows.push({
      id: "latihan", label: "Perkuat kalender latihan", detail: `Baru ${latihan.length} sesi tercatat. Jadwal dan laporan latihan menjadi bukti aktivitas kelembagaan.`, href: "/sanggar/latihan", level: latihan.length === 0 ? "prioritas" : "perhatian", icon: CalendarCheck2,
    });
    if (documents.length < 3) rows.push({
      id: "dokumen", label: "Bangun arsip administrasi", detail: `${documents.length} dokumen tersimpan. Gunakan generator resmi untuk BA, AD/ART, SK, dan lampiran.`, href: "/sanggar/dokumen", level: "perhatian", icon: FileCheck2,
    });
    if (publishedAssets.length === 0 && assets.length + facilities.length > 0) rows.push({
      id: "aset", label: "Publikasikan aset yang layak", detail: "Aset sudah didata tetapi belum masuk katalog sewa.", href: "/sanggar/aset", level: "perhatian", icon: PackageCheck,
    });
    if (submissions.length === 0) rows.push({
      id: "kurasi", label: "Siapkan berkas kurasi", detail: "Belum ada pengajuan kurasi. Pusat kendali akan menilai kesiapan data dukung Anda.", href: "/sanggar/kurasi", level: "perhatian", icon: ClipboardCheck,
    });
    if (rows.length === 0) rows.push({
      id: "aman", label: "Operasional sanggar dalam kondisi baik", detail: "Tidak ada risiko kritis yang terdeteksi dari data lokal saat ini.", href: "/sanggar", level: "aman", icon: CheckCircle2,
    });
    return rows;
  }, [assets.length, documents.length, facilities.length, latihan.length, pendingMembers.length, profileScore, publishedAssets.length, submissions.length]);

  const runAssistant = (value = prompt) => {
    const q = value.trim().toLowerCase();
    if (!q) return;
    if (q.includes("prioritas") || q.includes("harus saya kerjakan")) {
      const first = insights[0];
      setAnswer(`Prioritas utama: ${first.label}. ${first.detail} Setelah itu, lanjutkan ke ${insights[1]?.label ?? "pemantauan rutin"}.`);
    } else if (q.includes("keuangan") || q.includes("kas") || q.includes("saldo")) {
      setAnswer(`Saldo tercatat ${fmtRp(sg.saldo)}. Total arus masuk ${fmtRp(cashIn)}, arus keluar ${fmtRp(cashOut)}, sehingga arus bersih ${fmtRp(cashFlow)}. ${lastCash ? `Transaksi terakhir pada ${fmtDate(lastCash.tanggal)}: ${lastCash.keterangan}.` : "Belum ada jurnal kas; segera catat transaksi awal."}`);
    } else if (q.includes("kurasi") || q.includes("nilai")) {
      setAnswer(`Skor kesiapan internal saat ini ${readinessScore}/100. Komponen administrasi ${adminScore}, latihan ${trainingScore}, keanggotaan ${membershipScore}, profil ${profileScore}, dan keuangan ${financialScore}. Fokuskan perbaikan pada komponen dengan nilai terendah sebelum mengirim kurasi.`);
    } else if (q.includes("anggota") || q.includes("sdm")) {
      setAnswer(`Terdapat ${activeMembers.length} anggota aktif dan ${pendingMembers.length} permohonan menunggu. Komposisi: ${members.filter((m) => m.role === "pelatih").length} pelatih dan ${members.filter((m) => m.role === "seniman").length} seniman.`);
    } else if (q.includes("sewa") || q.includes("pendapatan") || q.includes("usaha")) {
      const activeRental = rentals.filter((item) => !["selesai", "ditolak", "batal"].includes(item.status));
      setAnswer(`Ada ${publishedAssets.length} item katalog aktif dan ${activeRental.length} pesanan berjalan. Nilai potensi pesanan berjalan ${fmtRp(activeRental.reduce((sum, item) => sum + item.nilaiTotal, 0))}. Publikasikan aset berkondisi baik dan pastikan harga serta akomodasi terisi.`);
    } else if (q.includes("ringkasan") || q.includes("laporan")) {
      setAnswer(`Ringkasan eksekutif: kesiapan ${readinessScore}%, anggota aktif ${activeMembers.length}, latihan ${latihan.length}, dokumen ${documents.length}, aset terpublikasi ${publishedAssets.length}, kerja sama ${partnerships.length}, dan pembinaan ${coaching.length}. Gunakan tombol Preview Laporan untuk memeriksa dan menyimpan hasilnya.`);
    } else {
      setAnswer(`Saya membaca permintaan “${value.trim()}”. Berdasarkan data sanggar, tindakan paling berdampak sekarang adalah ${insights[0].label.toLowerCase()}. Skor kesiapan keseluruhan Anda ${readinessScore}/100.`);
    }
    setPrompt(value);
  };

  const downloadReport = () => {
    const generatedAt = new Date().toLocaleString("id-ID");
    const rows = insights
      .map((item) => safeHtml`<li><strong>${item.label}</strong><br>${item.detail}</li>`)
      .join("");
    const body = safeHtml`<h1>Laporan Pusat Kendali JAK SANGGAR NEXT</h1><p><strong>${sg.namaSanggar}</strong><br>Dibuat ${generatedAt}</p><div class="score">${readinessScore}/100</div><p>Skor kesiapan kelembagaan</p><div class="grid"><div class="box">Profil<br><strong>${profileScore}%</strong></div><div class="box">Keanggotaan<br><strong>${membershipScore}%</strong></div><div class="box">Latihan<br><strong>${trainingScore}%</strong></div><div class="box">Administrasi<br><strong>${adminScore}%</strong></div><div class="box">Keuangan<br><strong>${financialScore}%</strong></div><div class="box">Saldo<br><strong>${fmtRp(sg.saldo)}</strong></div></div><h2>Rekomendasi</h2><ol>${rawHtml(rows)}</ol><h2>Ringkasan Data</h2><p>Anggota aktif: ${activeMembers.length}<br>Latihan: ${latihan.length}<br>Dokumen: ${documents.length}<br>Aset terpublikasi: ${publishedAssets.length}<br>Kerja sama: ${partnerships.length}<br>Pesanan sewa: ${rentals.length}</p>`;
    openPrintWindow({
      title: `Laporan Pusat Kendali ${sg.namaSanggar}`,
      bodyHtml: body,
      extraCss:
        "body{font-family:Arial,sans-serif;color:#17211c}h1{color:#14532d}.score{font-size:48px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.box{border:1px solid #d5ddd8;border-radius:10px;padding:16px}li{margin-bottom:12px}",
      autoPrint: false,
    });
  };

  const scoreTone = readinessScore >= 80 ? "text-emerald-500" : readinessScore >= 60 ? "text-amber-500" : "text-destructive";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Kendali Cerdas"
        subtitle="Analitik operasional, rekomendasi otomatis, dan asisten data dalam satu layar."
        actions={<Button onClick={downloadReport} variant="outline"><Download className="h-4 w-4 mr-2" />Preview Laporan</Button>}
      />

      <Card className="relative overflow-hidden border-accent/30 p-6 sm:p-8">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 90% 10%, hsl(var(--accent) / 0.18), transparent 38%), linear-gradient(135deg, hsl(var(--primary) / 0.08), transparent 55%)" }} />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> JAK SANGGAR Intelligence
            </div>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Kondisi kelembagaan terbaca secara otomatis</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Sistem menggabungkan profil, anggota, latihan, kas, dokumen, aset, pembinaan, kurasi, dan transaksi jasa untuk menyusun tindakan prioritas.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline"><Activity className="mr-1 h-3.5 w-3.5" />{kas.length + latihan.length + documents.length} rekam operasional</Badge>
              <Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Audit lokal aktif</Badge>
              <Badge variant="outline"><BrainCircuit className="mr-1 h-3.5 w-3.5" />Tanpa API wajib</Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-5 backdrop-blur">
            <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Skor Kesiapan</span><Badge variant={readinessScore >= 80 ? "success" : "secondary"}>{readinessScore >= 80 ? "Siap" : "Perlu penguatan"}</Badge></div>
            <div className={`mt-3 font-serif text-6xl ${scoreTone}`}>{readinessScore}<span className="text-xl text-muted-foreground">/100</span></div>
            <Progress className="mt-4" value={readinessScore} />
            <p className="mt-3 text-xs text-muted-foreground">Dihitung dari 5 dimensi utama dan diperbarui langsung saat data berubah.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ScoreCard label="Profil" score={profileScore} icon={ShieldCheck} href="/sanggar/profil" onOpen={navigate} />
        <ScoreCard label="Keanggotaan" score={membershipScore} icon={Users} href="/sanggar/keanggotaan" onOpen={navigate} />
        <ScoreCard label="Latihan" score={trainingScore} icon={CalendarCheck2} href="/sanggar/latihan" onOpen={navigate} />
        <ScoreCard label="Administrasi" score={adminScore} icon={FileCheck2} href="/sanggar/dokumen" onOpen={navigate} />
        <ScoreCard label="Keuangan" score={financialScore} icon={CircleDollarSign} href="/sanggar/buku-kas" onOpen={navigate} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_.92fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10"><Bot className="h-5 w-5 text-accent" /></div>
            <div><h3 className="font-serif text-xl">Asisten Operasional</h3><p className="text-sm text-muted-foreground">Tanyakan kondisi sanggar dengan bahasa biasa.</p></div>
          </div>
          <div className="mt-5 rounded-xl border border-border/70 bg-muted/35 p-4 text-sm leading-relaxed min-h-[92px]">{answer}</div>
          <div className="mt-4 flex gap-2">
            <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runAssistant(); }} placeholder="Contoh: Apa prioritas saya hari ini?" />
            <Button onClick={() => runAssistant()} aria-label="Kirim pertanyaan"><Send className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Apa prioritas saya?", "Analisis keuangan", "Kesiapan kurasi", "Ringkasan anggota", "Potensi pendapatan sewa"].map((item) => (
              <button key={item} type="button" onClick={() => runAssistant(item)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground">{item}</button>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h3 className="font-serif text-xl">Snapshot Operasional</h3><p className="text-sm text-muted-foreground">Data penting saat ini</p></div><WandSparkles className="h-5 w-5 text-accent" /></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Anggota aktif" value={activeMembers.length.toString()} />
            <Metric label="Latihan" value={latihan.length.toString()} />
            <Metric label="Dokumen" value={documents.length.toString()} />
            <Metric label="Aset tayang" value={publishedAssets.length.toString()} />
            <Metric label="Kerja sama" value={partnerships.length.toString()} />
            <Metric label="Pesanan jasa" value={rentals.length.toString()} />
          </div>
          <div className="mt-4 rounded-xl border border-border/70 p-4">
            <div className="flex items-center justify-between text-sm"><span>Arus kas bersih</span><strong className={cashFlow >= 0 ? "text-emerald-500" : "text-destructive"}>{fmtRp(cashFlow)}</strong></div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>Saldo tercatat</span><span>{fmtRp(sg.saldo)}</span></div>
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><h3 className="font-serif text-xl">Prioritas Otomatis</h3><p className="text-sm text-muted-foreground">Disusun berdasarkan risiko dan dampak terhadap kesiapan sanggar.</p></div><Lightbulb className="h-5 w-5 text-amber-500" /></div>
        <div className="mt-5 space-y-3">
          {insights.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => navigate(item.href)} className="group w-full rounded-xl border border-border/70 p-4 text-left transition-all hover:border-accent/45 hover:bg-muted/25">
                <div className="flex gap-4">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.level === "prioritas" ? "bg-destructive/10 text-destructive" : item.level === "perhatian" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-500"}`}>
                    {item.level === "prioritas" ? <AlertTriangle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span><h4 className="font-medium">{item.label}</h4><Badge variant="outline" className="ml-auto hidden sm:inline-flex">{item.level}</Badge></div><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p></div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ScoreCard({ label, score, icon: Icon, href, onOpen }: { label: string; score: number; icon: typeof Users; href: string; onOpen: (href: string) => void }) {
  const tone = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-destructive";
  return (
    <button type="button" onClick={() => onOpen(href)} className="text-left">
      <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-md">
        <div className="flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><Icon className="h-4 w-4" /></div><span className={`font-serif text-2xl ${tone}`}>{score}</span></div>
        <div className="mt-3 text-sm font-medium">{label}</div><Progress value={score} className="mt-2 h-1.5" />
      </Card>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-serif text-2xl">{value}</div></div>;
}
