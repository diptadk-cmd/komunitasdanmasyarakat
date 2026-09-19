import { useMemo, useState } from "react";
import { useDb } from "@/lib/auth";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/store";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/kerjasama";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SanggarUser, Kerjasama, KerjasamaStatus } from "@/lib/types";
import { Search, Handshake, FileWarning, Receipt, Star } from "lucide-react";

const STATUSES: (KerjasamaStatus | "all")[] = ["all", "menunggu", "negosiasi", "diterima", "berjalan", "selesai", "ditolak", "batal"];

export default function KuratorKerjasama() {
  const db = useDb();
  const [q, setQ] = useState("");
  const all = useMemo(() => [...db.kerjasama].sort((a, b) => b.updatedAt - a.updatedAt), [db.kerjasama]);

  const sg = (id: string) => (db.users.find(u => u.id === id) as SanggarUser | undefined)?.namaSanggar ?? "—";
  const filterFn = (k: Kerjasama) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return k.nomor.toLowerCase().includes(t) || k.judul.toLowerCase().includes(t) ||
      sg(k.sanggarPenyediaId).toLowerCase().includes(t) || sg(k.sanggarPeminjamId).toLowerCase().includes(t);
  };

  const totalNilai = all.reduce((s, k) => s + (k.status === "selesai" ? k.nilaiTotal : 0), 0);
  const totalMenunggu = all.filter(k => k.status === "menunggu" || k.status === "negosiasi").length;
  const totalSelesai = all.filter(k => k.status === "selesai").length;
  const ratingAvg = (() => {
    const r = db.ratings; if (r.length === 0) return 0;
    return Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10;
  })();

  return (
    <div>
      <PageHeader title="Pengawasan Kerjasama" subtitle="Pantau seluruh transaksi kerjasama antar sanggar di ekosistem Jak Sanggar." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Handshake className="h-3.5 w-3.5" />Total Transaksi</div><div className="text-2xl font-serif mt-1">{all.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><FileWarning className="h-3.5 w-3.5" />Aktif / Negosiasi</div><div className="text-2xl font-serif mt-1">{totalMenunggu}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3.5 w-3.5" />Nilai Selesai</div><div className="text-base font-semibold mt-1">{fmtRp(totalNilai)}</div><div className="text-xs text-muted-foreground">{totalSelesai} kerjasama</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3.5 w-3.5" />Rating Rata-rata</div><div className="text-2xl font-serif mt-1">{ratingAvg.toFixed(1)}<span className="text-xs text-muted-foreground"> / 5</span></div></Card>
      </div>

      <div className="mb-3 flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nomor / objek / nama sanggar..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <Tabs defaultValue="all">
        <TabsList className="flex-wrap">
          {STATUSES.map(s => <TabsTrigger key={s} value={s}>{s === "all" ? "Semua" : STATUS_LABEL[s]}</TabsTrigger>)}
        </TabsList>
        {STATUSES.map(s => {
          const rows = all.filter(filterFn).filter(k => s === "all" || k.status === s);
          return (
            <TabsContent key={s} value={s}>
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>No.</TableHead><TableHead>Objek</TableHead><TableHead>Penyedia</TableHead>
                    <TableHead>Peminjam</TableHead><TableHead>Periode</TableHead><TableHead>Nilai</TableHead>
                    <TableHead>Status</TableHead><TableHead>Diperbarui</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada data.</TableCell></TableRow>}
                    {rows.map(k => (
                      <TableRow key={k.id}>
                        <TableCell className="font-mono text-xs">{k.nomor}</TableCell>
                        <TableCell className="text-sm"><div>{k.judul}</div><div className="text-xs text-muted-foreground"><Badge variant="outline" className="text-[10px]">{k.kategori.replace("_", " ")}</Badge></div></TableCell>
                        <TableCell className="text-sm">{sg(k.sanggarPenyediaId)}</TableCell>
                        <TableCell className="text-sm">{sg(k.sanggarPeminjamId)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(k.tanggalMulai)} – {fmtDate(k.tanggalSelesai)}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{fmtRp(k.nilaiTotal)}</TableCell>
                        <TableCell><span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[k.status]}`}>{STATUS_LABEL[k.status]}</span></TableCell>
                        <TableCell className="text-xs">{fmtDateTime(k.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
