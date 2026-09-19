import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, fmtRp, fmtDate, fmtDateTime } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Upload, Wallet } from "lucide-react";

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
    <div>
      <PageHeader
        title={`Halo, ${s.nama}`}
        subtitle={
          sg ? `Anggota di ${sg.namaSanggar}` : "Belum tergabung di sanggar"
        }
        back={false}
      />
      {s.status === "pending" && (
        <Card className="p-4 bg-accent/15 border-accent/40 mb-6 text-sm">
          Permohonan gabung Anda menunggu validasi Sanggar.
        </Card>
      )}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Tagihan Aktif
          </div>
          <div className="text-3xl font-serif mt-2">
            {tagihan.filter((t) => t.status !== "lunas").length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Lunas
          </div>
          <div className="text-3xl font-serif mt-2">
            {tagihan.filter((t) => t.status === "lunas").length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Honor Diterima
          </div>
          <div className="text-3xl font-serif mt-2">
            {honor.filter((h) => h.konfirmasi).length}
          </div>
        </Card>
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
                    <Badge variant="outline">Terkirim</Badge>
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
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const submit = async () => {
    if (!file) return;
    try {
      const buktiDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Berkas tidak dapat dibaca."));
        reader.onerror = () =>
          reject(reader.error ?? new Error("Berkas tidak dapat dibaca."));
        reader.readAsDataURL(file);
      });
      save((d) => {
        const it = d.iuran.find((x) => x.id === id);
        if (it) {
          it.buktiDataUrl = buktiDataUrl;
          it.status = "pending";
        }
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
              accept="image/*,.pdf"
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
