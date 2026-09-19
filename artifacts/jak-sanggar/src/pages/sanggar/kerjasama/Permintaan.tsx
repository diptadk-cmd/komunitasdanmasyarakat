import { useMemo } from "react";
import { Link } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp, fmtDate } from "@/lib/store";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/kerjasama";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { SanggarUser, Kerjasama } from "@/lib/types";
import { ArrowRight } from "lucide-react";

function rowsTable(rows: Kerjasama[], db: ReturnType<typeof useDb>, sgId: string) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader><TableRow>
          <TableHead>No.</TableHead><TableHead>Item</TableHead><TableHead>Pihak Lain</TableHead>
          <TableHead>Periode</TableHead><TableHead>Nilai</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data.</TableCell></TableRow>}
          {rows.map(k => {
            const lawanId = k.sanggarPenyediaId === sgId ? k.sanggarPeminjamId : k.sanggarPenyediaId;
            const lawan = db.users.find(u => u.id === lawanId) as SanggarUser | undefined;
            const role = k.sanggarPenyediaId === sgId ? "Anda penyedia" : "Anda peminjam";
            return (
              <TableRow key={k.id}>
                <TableCell className="font-mono text-xs">{k.nomor}</TableCell>
                <TableCell className="text-sm">{k.judul}</TableCell>
                <TableCell className="text-sm">
                  <div>{lawan?.namaSanggar ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{role}</div>
                </TableCell>
                <TableCell className="text-xs">{fmtDate(k.tanggalMulai)} – {fmtDate(k.tanggalSelesai)}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{fmtRp(k.nilaiTotal)}</TableCell>
                <TableCell><span className={`inline-block text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[k.status]}`}>{STATUS_LABEL[k.status]}</span></TableCell>
                <TableCell className="text-right">
                  <Link href={`/sanggar/kerjasama/${k.id}`}><Button size="sm" variant="ghost">Detail<ArrowRight className="h-3.5 w-3.5 ml-1" /></Button></Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function PermintaanKerjasama() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const all = useMemo(() =>
    db.kerjasama.filter(k => k.sanggarPenyediaId === sg.id || k.sanggarPeminjamId === sg.id)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [db.kerjasama, sg.id]);
  const inbound = all.filter(k => k.sanggarPenyediaId === sg.id);
  const outbound = all.filter(k => k.sanggarPeminjamId === sg.id);
  const aktif = all.filter(k => ["diterima", "negosiasi", "berjalan"].includes(k.status));
  const arsip = all.filter(k => ["selesai", "ditolak", "batal"].includes(k.status));

  return (
    <div>
      <PageHeader title="Permintaan Kerjasama" subtitle="Daftar transaksi kerjasama yang melibatkan sanggar Anda." />
      <Tabs defaultValue="aktif">
        <TabsList>
          <TabsTrigger value="aktif">Aktif ({aktif.length})</TabsTrigger>
          <TabsTrigger value="inbound">Masuk ({inbound.length})</TabsTrigger>
          <TabsTrigger value="outbound">Diajukan ({outbound.length})</TabsTrigger>
          <TabsTrigger value="arsip">Arsip ({arsip.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="aktif">{rowsTable(aktif, db, sg.id)}</TabsContent>
        <TabsContent value="inbound">{rowsTable(inbound, db, sg.id)}</TabsContent>
        <TabsContent value="outbound">{rowsTable(outbound, db, sg.id)}</TabsContent>
        <TabsContent value="arsip">{rowsTable(arsip, db, sg.id)}</TabsContent>
      </Tabs>
    </div>
  );
}
