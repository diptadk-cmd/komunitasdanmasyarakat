import { useAuth, useDb } from "@/lib/auth";
import { fmtRp, fmtDate } from "@/lib/store";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/kerjasama";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SanggarUser } from "@/lib/types";
import { Handshake } from "lucide-react";

export default function PermintaanSdmReadOnly() {
  const { user } = useAuth();
  const db = useDb();
  if (!user) return null;
  const expectedSumber = user.role === "pelatih" ? "sdm-pelatih" : user.role === "seniman" ? "sdm-seniman" : user.role === "juri" ? "sdm-juri" : null;
  const list = db.kerjasama.filter(k => k.sumberType === expectedSumber && k.sumberId === user.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div>
      <PageHeader
        title="Permintaan SDM"
        subtitle="Daftar permintaan kerjasama lintas sanggar yang melibatkan profil Anda."
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>No. Kerjasama</TableHead>
            <TableHead>Penyedia</TableHead>
            <TableHead>Peminjam</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Honor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Handshake className="h-8 w-8 mx-auto mb-2 opacity-30" />Belum ada permintaan kerjasama yang melibatkan Anda.</TableCell></TableRow>}
            {list.map(k => {
              const penyedia = db.users.find(u => u.id === k.sanggarPenyediaId) as SanggarUser | undefined;
              const peminjam = db.users.find(u => u.id === k.sanggarPeminjamId) as SanggarUser | undefined;
              return (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-xs">{k.nomor}</TableCell>
                  <TableCell className="text-sm">{penyedia?.namaSanggar ?? "—"}</TableCell>
                  <TableCell className="text-sm">{peminjam?.namaSanggar ?? "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(k.tanggalMulai)} – {fmtDate(k.tanggalSelesai)}</TableCell>
                  <TableCell className="text-sm">{k.lokasi || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{fmtRp(k.nilaiTotal)}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[k.status]}`}>{STATUS_LABEL[k.status]}</span></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Negosiasi & administrasi pembayaran dikelola oleh sanggar Anda. Halaman ini hanya menampilkan daftar untuk transparansi.</p>
    </div>
  );
}
