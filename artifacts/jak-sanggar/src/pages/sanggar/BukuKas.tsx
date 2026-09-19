import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, uid, fmtRp, fmtDateTime, pushKas, logActivity } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { SanggarUser, PelatihUser, SenimanUser } from "@/lib/types";
import { FileDown, Check, X, Upload, ArrowUpRight, ArrowDownRight, Share2, TrendingUp } from "lucide-react";
import { ComposedChart, Bar, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { AnimatedCounter } from "@/components/system/AnimatedCounter";
import { openPrintWindow, safeHtml, rawHtml } from "@/lib/print";
import { kopHtml, ttdHtml } from "@/lib/dokumen";

const KAT_PEMASUKAN = ["Job Pementasan", "Donasi", "Tiket", "Hibah", "Lainnya"];
const KAT_PENGELUARAN = ["PLN/Air", "Sewa", "Vendor", "Konsumsi", "Operasional", "Lainnya"];

export default function BukuKas() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const kas = db.kas.filter(k => k.sanggarId === sg.id).sort((a, b) => b.tanggal - a.tanggal);
  const iuran = db.iuran.filter(i => i.sanggarId === sg.id);
  const honor = db.pengajuanHonor.filter(h => h.sanggarId === sg.id);

  const validateIuran = (id: string, ok: boolean) => {
    const it = db.iuran.find(x => x.id === id);
    if (!it) return;
    save(d => {
      const i = d.iuran.find(x => x.id === id);
      if (!i) return;
      i.status = ok ? "lunas" : "ditolak";
      i.validatedAt = Date.now();
    });
    if (ok) pushKas(sg.id, `Iuran: ${it.judul}`, it.nominal, 0, "iuran", id);
    toast({ title: ok ? "Iuran divalidasi" : "Iuran ditolak" });
  };

  const payHonor = (id: string, fileName: string) => {
    const it = db.pengajuanHonor.find(x => x.id === id);
    if (!it) return;
    save(d => {
      const h = d.pengajuanHonor.find(x => x.id === id);
      if (!h) return;
      h.status = "disetujui"; h.paidAt = Date.now(); h.buktiTransferDataUrl = fileName;
    });
    pushKas(sg.id, `Honor Pelatih`, 0, it.total, "honor", id);
    toast({ title: "Honor dibayarkan", description: "E-slip terbit di akun Pelatih." });
  };

  const csvExport = () => {
    const rows = [["Tanggal", "Keterangan", "Debit", "Kredit", "Saldo"]];
    [...kas].reverse().forEach(k => rows.push([fmtDateTime(k.tanggal), k.keterangan, String(k.debit), String(k.kredit), String(k.saldo)]));
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `buku-kas-${sg.namaSanggar}.csv`; a.click();
  };

  const printPdf = () => {
    const rows = [...kas].reverse()
      .map(k => safeHtml`<tr><td>${fmtDateTime(k.tanggal)}</td><td>${k.keterangan}</td><td style="text-align:right">${k.debit ? fmtRp(k.debit) : ""}</td><td style="text-align:right">${k.kredit ? fmtRp(k.kredit) : ""}</td><td style="text-align:right">${fmtRp(k.saldo)}</td></tr>`)
      .join("");
    const body = safeHtml`${rawHtml(kopHtml(sg))}<h1>Buku Kas — ${sg.namaSanggar}</h1><p>Saldo Akhir: <b>${fmtRp(sg.saldo)}</b></p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Debit</th><th>Kredit</th><th>Saldo</th></tr></thead><tbody>${rawHtml(rows)}</tbody></table>${rawHtml(ttdHtml(sg))}`;
    openPrintWindow({ title: `Buku Kas ${sg.namaSanggar}`, bodyHtml: body });
  };

  return (
    <div>
      <PageHeader title="Buku Kas" subtitle={`Saldo akhir: ${fmtRp(sg.saldo)}`} actions={
        <>
          <Button variant="outline" className="gap-2" onClick={csvExport}><FileDown className="h-4 w-4" />Excel/CSV</Button>
          <Button variant="outline" className="gap-2" onClick={printPdf}><FileDown className="h-4 w-4" />Preview PDF</Button>
        </>
      } />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <SmallStat label="Saldo Akhir" value={sg.saldo} accent />
        <SmallStat label="Total Pemasukan" value={kas.reduce((s, k) => s + k.debit, 0)} icon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />} tone="up" />
        <SmallStat label="Total Pengeluaran" value={kas.reduce((s, k) => s + k.kredit, 0)} icon={<ArrowDownRight className="h-4 w-4 text-destructive" />} tone="down" />
      </div>

      {/* Fintech-style line + bar chart */}
      <Card className="p-5 mb-6 premium-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent-foreground" />Analitik Arus Kas</h3>
            <p className="text-xs text-muted-foreground">Pemasukan vs Pengeluaran + saldo (dalam ribu Rupiah)</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, hsl(42 75% 55%), hsl(38 60% 42%))", boxShadow: "0 0 6px hsl(42 75% 55% / 0.5)" }} />Saldo</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "linear-gradient(180deg, hsl(145 55% 50%), hsl(145 55% 38%))" }} />Pemasukan</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "linear-gradient(180deg, hsl(8 65% 55%), hsl(8 60% 42%))" }} />Pengeluaran</span>
          </div>
        </div>
        <div className="h-72 mt-4">
          {kas.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">Belum ada transaksi.</div>
          ) : (() => {
            const series = [...kas].reverse().map(k => {
              const d = new Date(k.tanggal);
              return {
                tgl: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
                masuk: k.debit / 1000,
                keluar: k.kredit / 1000,
                saldo: k.saldo / 1000,
              };
            });
            return (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} barGap={2}>
                  <defs>
                    <linearGradient id="bkMasuk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(145 55% 50%)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(145 55% 38%)" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="bkKeluar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(8 65% 55%)" stopOpacity={0.92} />
                      <stop offset="100%" stopColor="hsl(8 60% 42%)" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tgl" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent) / 0.07)" }}
                    contentStyle={{
                      background: "hsl(var(--popover) / 0.92)",
                      border: "1px solid hsl(var(--accent) / 0.35)",
                      borderRadius: 12,
                      backdropFilter: "blur(14px)",
                      boxShadow: "0 14px 32px -10px hsl(150 45% 10% / 0.35)",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ fontWeight: 600, fontSize: 11 }}
                    itemStyle={{ fontSize: 12 }}
                    formatter={(v: number, n: string) => [`${v.toLocaleString("id-ID")} rb`, n === "masuk" ? "Pemasukan" : n === "keluar" ? "Pengeluaran" : "Saldo"]}
                  />
                  <Bar dataKey="masuk" fill="url(#bkMasuk)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="keluar" fill="url(#bkKeluar)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="saldo" stroke="hsl(42 75% 55%)" strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(42 80% 60%)", stroke: "hsl(38 60% 38%)", strokeWidth: 1 }}
                    activeDot={{ r: 5, fill: "hsl(42 85% 65%)" }}
                    style={{ filter: "drop-shadow(0 0 6px hsl(42 75% 55% / 0.5))" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </Card>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="validasi">Validasi ({iuran.filter(i => i.status === "pending" && i.buktiDataUrl).length + honor.filter(h => h.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="manual">Input Manual</TabsTrigger>
          <TabsTrigger value="distribusi">Bagi Hasil Job</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Kredit</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
              <TableBody>
                {kas.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada transaksi.</TableCell></TableRow>}
                {kas.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="text-sm">{fmtDateTime(k.tanggal)}</TableCell>
                    <TableCell>{k.keterangan}</TableCell>
                    <TableCell className="text-right text-emerald-600">{k.debit ? fmtRp(k.debit) : ""}</TableCell>
                    <TableCell className="text-right text-destructive">{k.kredit ? fmtRp(k.kredit) : ""}</TableCell>
                    <TableCell className="text-right font-medium">{fmtRp(k.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="validasi" className="space-y-6">
          <div>
            <h3 className="font-serif text-lg mb-3">Iuran Anggota</h3>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Anggota</TableHead><TableHead>Judul</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead>Bukti</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {iuran.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Tidak ada iuran.</TableCell></TableRow>}
                  {iuran.map(i => {
                    const m = db.users.find(u => u.id === i.senimanId) as SenimanUser | undefined;
                    return (
                      <TableRow key={i.id}>
                        <TableCell>{m?.nama ?? "-"}</TableCell>
                        <TableCell>{i.judul}</TableCell>
                        <TableCell className="text-right">{fmtRp(i.nominal)}</TableCell>
                        <TableCell>{i.buktiDataUrl ? <Badge variant="secondary">Ada</Badge> : <Badge variant="outline">Belum</Badge>}</TableCell>
                        <TableCell><Badge variant={i.status === "lunas" ? "default" : i.status === "ditolak" ? "destructive" : "secondary"}>{i.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {i.status === "pending" && i.buktiDataUrl ? (
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => validateIuran(i.id, false)}><X className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" onClick={() => validateIuran(i.id, true)}><Check className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
          <div>
            <h3 className="font-serif text-lg mb-3">Pengajuan Honor Pelatih</h3>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Pelatih</TableHead><TableHead>Sesi</TableHead><TableHead className="text-right">Honor/Sesi</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {honor.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Tidak ada pengajuan.</TableCell></TableRow>}
                  {honor.map(h => {
                    const p = db.users.find(u => u.id === h.pelatihId) as PelatihUser | undefined;
                    return (
                      <TableRow key={h.id}>
                        <TableCell>{p?.nama ?? "-"}</TableCell>
                        <TableCell>{h.jumlahSesi}</TableCell>
                        <TableCell className="text-right">{fmtRp(h.honorPerSesi)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtRp(h.total)}</TableCell>
                        <TableCell><Badge variant={h.status === "disetujui" ? "default" : "secondary"}>{h.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {h.status === "pending" && <PayHonorDialog onSubmit={(f) => payHonor(h.id, f)} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="grid lg:grid-cols-2 gap-6">
          <ManualForm sg={sg} jenis="pemasukan" />
          <ManualForm sg={sg} jenis="pengeluaran" />
        </TabsContent>

        <TabsContent value="distribusi"><DistribusiForm sg={sg} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SmallStat({ label, value, icon, accent, tone }: { label: string; value: number; icon?: React.ReactNode; accent?: boolean; tone?: "up" | "down" }) {
  if (accent) {
    return (
      <Card className="p-4 relative overflow-hidden border-2 border-[hsl(38_55%_50%/0.35)]"
        style={{
          background: "linear-gradient(135deg, hsl(150 55% 12%) 0%, hsl(18 58% 22%) 100%)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, transparent, hsl(42 80% 60%), transparent)" }} />
        <div className="relative">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "hsl(42 70% 70%)" }}>{label}</div>
          <div className="mt-2 font-serif text-2xl tabular-nums" style={{
            background: "linear-gradient(135deg, hsl(45 90% 82%), hsl(42 75% 55%))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Rp <AnimatedCounter value={value} />
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-4 premium-card">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className={`mt-2 text-xl font-serif tabular-nums ${tone === "up" ? "text-emerald-700 dark:text-emerald-400" : tone === "down" ? "text-[hsl(8_60%_50%)]" : ""}`}>
        Rp <AnimatedCounter value={value} />
      </div>
    </Card>
  );
}

function PayHonorDialog({ onSubmit }: { onSubmit: (filename: string) => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1"><Upload className="h-3.5 w-3.5" />Bayar</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Pembayaran Honor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Unggah bukti transfer bank untuk menyelesaikan pembayaran.</div>
          <Input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button disabled={!file} onClick={() => { if (file) { onSubmit(file.name); setOpen(false); } }}>Setujui & Bayar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualForm({ sg, jenis }: { sg: SanggarUser; jenis: "pemasukan" | "pengeluaran" }) {
  const [f, setF] = useState({ tanggal: new Date().toISOString().slice(0, 10), kategori: jenis === "pemasukan" ? KAT_PEMASUKAN[0] : KAT_PENGELUARAN[0], nominal: "", sumberAtauTujuan: "", keterangan: "" });
  const [bukti, setBukti] = useState<File | null>(null);
  const { toast } = useToast();
  const submit = () => {
    const n = Number(f.nominal); if (!n || n <= 0) { toast({ title: "Nominal tidak valid", variant: "destructive" }); return; }
    save(d => {
      d.transaksi.push({ id: uid(), sanggarId: sg.id, jenis, tanggal: f.tanggal, kategori: f.kategori, nominal: n, sumberAtauTujuan: f.sumberAtauTujuan, keterangan: f.keterangan, buktiDataUrl: bukti?.name, createdAt: Date.now() });
    });
    pushKas(sg.id, `${jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran"}: ${f.kategori}${f.keterangan ? " — " + f.keterangan : ""}`, jenis === "pemasukan" ? n : 0, jenis === "pengeluaran" ? n : 0, "manual", "");
    logActivity(sg.id, "sanggar", `manual-${jenis}`);
    toast({ title: jenis === "pemasukan" ? "Pemasukan tercatat" : "Pengeluaran tercatat" });
    setF({ ...f, nominal: "", sumberAtauTujuan: "", keterangan: "" }); setBukti(null);
  };
  const opts = jenis === "pemasukan" ? KAT_PEMASUKAN : KAT_PENGELUARAN;
  return (
    <Card className="p-5">
      <h3 className="font-serif text-lg">{jenis === "pemasukan" ? "Pemasukan Eksternal" : "Pengeluaran Eksternal"}</h3>
      <div className="mt-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Kategori</Label>
            <Select value={f.kategori} onValueChange={v => setF({ ...f, kategori: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Nominal (Rp)</Label><Input type="number" value={f.nominal} onChange={e => setF({ ...f, nominal: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>{jenis === "pemasukan" ? "Sumber Dana" : "Bayar Ke"}</Label><Input value={f.sumberAtauTujuan} onChange={e => setF({ ...f, sumberAtauTujuan: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Keterangan</Label><Textarea rows={2} value={f.keterangan} onChange={e => setF({ ...f, keterangan: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Bukti (Struk/Nota)</Label><Input type="file" onChange={e => setBukti(e.target.files?.[0] ?? null)} /></div>
        <Button className="w-full" onClick={submit}>Simpan {jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran"}</Button>
      </div>
    </Card>
  );
}

function DistribusiForm({ sg }: { sg: SanggarUser }) {
  const db = useDb();
  const { toast } = useToast();
  const members = db.users.filter(u => (u.role === "seniman" || u.role === "pelatih") && (u as any).sanggarId === sg.id && (u as any).status === "aktif") as (PelatihUser | SenimanUser)[];
  const [judul, setJudul] = useState("Pentas HUT DKI 2026");
  const [rows, setRows] = useState<{ id: string; nominal: string }[]>([{ id: members[0]?.id ?? "", nominal: "" }]);
  const [bukti, setBukti] = useState<File | null>(null);

  const addRow = () => setRows([...rows, { id: members[0]?.id ?? "", nominal: "" }]);
  const total = rows.reduce((s, r) => s + (Number(r.nominal) || 0), 0);

  const submit = () => {
    if (!bukti) { toast({ title: "Unggah bukti transfer dulu", variant: "destructive" }); return; }
    save(d => {
      rows.forEach(r => {
        const n = Number(r.nominal); if (!n || !r.id) return;
        const role = (members.find(m => m.id === r.id)?.role) as "pelatih" | "seniman";
        d.distribusi.push({ id: uid(), sanggarId: sg.id, penerimaId: r.id, penerimaRole: role, judulJob: judul, nominal: n, buktiTransferDataUrl: bukti.name, konfirmasi: false, createdAt: Date.now() });
      });
    });
    pushKas(sg.id, `Bagi Hasil: ${judul}`, 0, total, "distribusi", "");
    toast({ title: "Honor terkirim", description: "Notifikasi dikirim ke akun penerima." });
    setRows([{ id: members[0]?.id ?? "", nominal: "" }]); setBukti(null);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between"><h3 className="font-serif text-lg">Distribusi Bagi Hasil Pementasan</h3><Share2 className="h-5 w-5 text-muted-foreground" /></div>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5"><Label>Judul Job/Pementasan</Label><Input value={judul} onChange={e => setJudul(e.target.value)} /></div>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1.5"><Label className="text-xs">Penerima</Label>
                <Select value={r.id} onValueChange={v => setRows(rows.map((x, i) => i === idx ? { ...x, id: v } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.nama} ({m.role})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Nominal</Label><Input type="number" className="w-32" value={r.nominal} onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, nominal: e.target.value } : x))} /></div>
              <Button size="icon" variant="outline" onClick={() => setRows(rows.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addRow}>+ Tambah Penerima</Button>
        </div>
        <div className="text-sm text-muted-foreground">Total: <b className="text-foreground">{fmtRp(total)}</b></div>
        <div className="space-y-1.5"><Label>Bukti Transfer</Label><Input type="file" onChange={e => setBukti(e.target.files?.[0] ?? null)} /></div>
        <Button className="w-full" onClick={submit}>Kirim Honor ke Anggota</Button>
      </div>
    </Card>
  );
}
