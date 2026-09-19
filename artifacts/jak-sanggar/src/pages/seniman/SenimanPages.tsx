import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, fmtRp, fmtDate, fmtDateTime } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardWelcome, DashboardMetrics, DashboardLinks } from "@/components/layout/RoleWorkspace";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { SenimanUser, SanggarUser } from "@/lib/types";
import { readPaymentReceipt } from "@/lib/payment-receipt";
import { ReceiptDownload } from "@/components/documents/ReceiptDownload";
import { Upload, Wallet, Calendar, Receipt, UserRound } from "lucide-react";

export function SenimanHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "seniman") return null;
  const s = user as SenimanUser;
  const sg = db.users.find((u) => u.id === s.sanggarId) as
    | SanggarUser
    | undefined;
  const tagihan = db.iuran.filter((i) => i.senimanId === s.id);
  const honor = db.distribusi.filter((d) => d.penerimaId === s.id);
  return (
    <div className="role-workspace" data-testid="seniman-home">
      <DashboardWelcome
        role="Ruang seniman"
        title={`Halo, ${s.nama}`}
        description={
          sg ? `Anggota di ${sg.namaSanggar}` : "Belum tergabung di sanggar"
        }
        primary={{ href: "/seniman/absen", label: "Absen latihan" }}
        secondary={{ href: "/seniman/profil", label: "Profil saya" }}
      />
      {s.status === "pending" && (
        <div className="rw-notice" role="status">
          Permohonan gabung Anda menunggu validasi Sanggar.
        </div>
      )}
      <DashboardMetrics items={[
        { label: "Tagihan aktif", value: tagihan.filter(t => t.status !== "lunas").length, href: "/seniman/tagihan", attention: tagihan.some(t => t.status !== "lunas") },
        { label: "Tagihan lunas", value: tagihan.filter(t => t.status === "lunas").length, href: "/seniman/tagihan" },
        { label: "Honor diterima", value: honor.filter(h => h.konfirmasi).length, href: "/seniman/honor-komersial" },
      ]} />
      <div className="rw-columns">
        <DashboardLinks title="Kegiatan dan keuangan" items={[
          { href: "/seniman/absen", label: "Kehadiran latihan", description: "Catat kehadiran pada sesi latihan sanggar.", icon: Calendar },
          { href: "/seniman/tagihan", label: "Tagihan saya", description: "Periksa iuran dan unggah bukti pembayaran.", icon: Receipt },
          { href: "/seniman/honor-komersial", label: "Dana proyek seni", description: "Periksa dan konfirmasi honor kegiatan Anda.", icon: Wallet },
        ]} />
        <section className="rw-panel">
          <h2>Ruang untuk karya Anda</h2>
          <div className="rw-empty"><UserRound aria-hidden="true" /><p className="rw-note">Lengkapi profil dan keahlian agar informasi Anda siap digunakan untuk kegiatan bersama sanggar.</p></div>
          <Link className="rw-text-link" href="/seniman/profil">Lengkapi profil seniman</Link>
        </section>
      </div>
    </div>
  );
}

export function SenimanTagihan() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "seniman") return null;
  const s = user as SenimanUser;
  const items = db.iuran
    .filter((i) => i.senimanId === s.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const sg = db.users.find((u) => u.id === s.sanggarId) as
    | SanggarUser
    | undefined;

  return (
    <div>
      <PageHeader
        title="Tagihan Saya"
        subtitle={
          sg
            ? `Iuran yang diterbitkan oleh ${sg.namaSanggar}`
            : "Tagihan diterbitkan oleh sanggar setelah keanggotaan aktif"
        }
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bukti</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  Belum ada tagihan resmi dari sanggar.
                </TableCell>
              </TableRow>
            )}
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <div className="font-medium">{it.judul}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(it.createdAt)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {fmtRp(it.nominal)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      it.status === "lunas"
                        ? "default"
                        : it.status === "ditolak"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {it.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {it.buktiDataUrl ? (
                    <ReceiptDownload value={it.buktiDataUrl} name={`bukti-iuran-${it.id}`} />
                  ) : (
                    <Badge variant="outline">Belum</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {it.status !== "lunas" && <BayarDialog id={it.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function BayarDialog({ id }: { id: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const submit = async () => {
    if (!file) return;
    try {
      const buktiDataUrl = await readPaymentReceipt(file);
      save((d) => {
        const it = d.iuran.find((x) => x.id === id);
        if (!it || user?.role !== "seniman" || it.senimanId !== user.id || it.status === "lunas") throw new Error("Tagihan sudah lunas atau bukan milik Anda.");
        it.buktiDataUrl = buktiDataUrl;
        it.status = "pending";
      });
      toast({
        title: "Bukti terkirim",
        description: "Menunggu validasi Sanggar.",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Bukti belum terkirim",
        description:
          error instanceof Error ? error.message : "Berkas tidak dapat dibaca.",
        variant: "destructive",
      });
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Wallet className="h-3.5 w-3.5" />
          Bayar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bayar Iuran</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Unggah foto bukti transfer atau kwitansi tunai. Sanggar akan
            memvalidasi.
          </div>
          <div className="space-y-1.5">
            <Label>Bukti Pembayaran</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={!file} className="gap-2">
            <Upload className="h-4 w-4" />
            Kirim Bukti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SenimanRiwayat() {
  const { user } = useAuth();
  const db = useDb();
  if (!user) return null;
  const iuran = db.iuran.filter((i) => i.senimanId === user.id);
  const honor = db.distribusi.filter((d) => d.penerimaId === user.id);

  return (
    <div>
      <PageHeader
        title="Riwayat Transaksi"
        subtitle="Arsip e-slip honor dan kwitansi pembayaran."
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {iuran.length === 0 && honor.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  Riwayat kosong.
                </TableCell>
              </TableRow>
            )}
            {iuran.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{fmtDateTime(i.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline">Iuran</Badge>
                </TableCell>
                <TableCell>{i.judul}</TableCell>
                <TableCell className="text-right">{fmtRp(i.nominal)}</TableCell>
                <TableCell>
                  <Badge
                    variant={i.status === "lunas" ? "default" : "secondary"}
                  >
                    {i.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {honor.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{fmtDateTime(h.createdAt)}</TableCell>
                <TableCell>
                  <Badge>Honor</Badge>
                </TableCell>
                <TableCell>{h.judulJob}</TableCell>
                <TableCell className="text-right text-emerald-600">
                  +{fmtRp(h.nominal)}
                </TableCell>
                <TableCell>
                  <Badge variant={h.konfirmasi ? "default" : "secondary"}>
                    {h.konfirmasi ? "Diterima" : "Pending"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
