import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import {
  save,
  uid,
  fmtRp,
  fmtDateTime,
  fmtDate,
  logActivity,
} from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { PelatihUser, SanggarUser, Latihan } from "@/lib/types";
import {
  Wallet,
  CheckCircle2,
  FileText,
  Send,
  MapPin,
  Calendar,
} from "lucide-react";

export function PelatihHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "pelatih") return null;
  const p = user as PelatihUser;
  const sg = db.users.find((u) => u.id === p.sanggarId) as
    | SanggarUser
    | undefined;
  const latihan = db.latihan.filter((l) => l.pelatihId === p.id);
  const slips = db.pengajuanHonor.filter(
    (h) => h.pelatihId === p.id && h.status === "disetujui",
  );
  const distrib = db.distribusi.filter((d) => d.penerimaId === p.id);
  return (
    <div>
      <PageHeader
        title={`Halo, ${p.nama}`}
        subtitle={
          sg ? `Pelatih di ${sg.namaSanggar}` : "Belum tergabung di sanggar"
        }
        back={false}
      />
      {p.status === "pending" && (
        <Card className="p-4 bg-accent/15 border-accent/40 mb-6 text-sm">
          Permohonan gabung Anda menunggu validasi Sanggar.
        </Card>
      )}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground tracking-wide">
            Sesi Latihan
          </div>
          <div className="text-3xl font-serif mt-2">{latihan.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground tracking-wide">
            Slip Diterima
          </div>
          <div className="text-3xl font-serif mt-2">{slips.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground tracking-wide">
            Dana Proyek Diterima
          </div>
          <div className="text-3xl font-serif mt-2">{distrib.length}</div>
        </Card>
      </div>
    </div>
  );
}

export function PelatihDaftarLatih() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "pelatih") return null;
  const p = user as PelatihUser;
  const items = db.latihan
    .filter((l) => l.sanggarId === p.sanggarId)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const hadir = (lid: string) => {
    save((d) => {
      const l = d.latihan.find((x) => x.id === lid);
      if (l) l.pelatihId = p.id;
    });
    logActivity(p.id, "pelatih", "hadir-latihan", { lid });
    toast({ title: "Kehadiran tercatat" });
  };

  return (
    <div>
      <PageHeader
        title="Daftar Latih"
        subtitle="Lihat jadwal dan tandai kehadiran sebagai instruktur."
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Tempat</TableHead>
              <TableHead>Kurikulum</TableHead>
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
                  Belum ada jadwal.
                </TableCell>
              </TableRow>
            )}
            {items.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.tanggal}</TableCell>
                <TableCell>{l.jam}</TableCell>
                <TableCell className="text-sm flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {l.tempat}
                </TableCell>
                <TableCell>{l.kurikulum}</TableCell>
                <TableCell className="text-right">
                  {l.pelatihId === p.id ? (
                    <Badge>Hadir</Badge>
                  ) : (
                    <Button size="sm" onClick={() => hadir(l.id)}>
                      Tandai Hadir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function PelatihHonor() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "pelatih") return null;
  const p = user as PelatihUser;
  const myLat = db.latihan.filter((l) => l.pelatihId === p.id);
  const sesiBaru = myLat.filter((l) => l.laporan).length;
  const total = sesiBaru * p.honorPerSesi;

  const ajukan = () => {
    if (sesiBaru === 0) {
      toast({ title: "Belum ada sesi terlapor", variant: "destructive" });
      return;
    }
    save((d) => {
      d.pengajuanHonor.push({
        id: uid(),
        sanggarId: p.sanggarId!,
        pelatihId: p.id,
        jumlahSesi: sesiBaru,
        honorPerSesi: p.honorPerSesi,
        total,
        status: "pending",
        createdAt: Date.now(),
      });
    });
    toast({
      title: "Pengajuan honor terkirim",
      description: "Menunggu validasi Sanggar.",
    });
  };

  const myReq = db.pengajuanHonor
    .filter((h) => h.pelatihId === p.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <PageHeader
        title="Pengajuan Honor"
        subtitle="Rekap otomatis berdasarkan absensi latihan Anda."
      />
      <Card className="p-6 mb-6 bg-primary text-primary-foreground">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs uppercase opacity-75">Sesi Terlapor</div>
            <div className="text-3xl font-serif mt-1">{sesiBaru}</div>
          </div>
          <div>
            <div className="text-xs uppercase opacity-75">Honor / Sesi</div>
            <div className="text-3xl font-serif mt-1">
              {fmtRp(p.honorPerSesi)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase opacity-75">Total Pengajuan</div>
            <div className="text-3xl font-serif mt-1">{fmtRp(total)}</div>
          </div>
        </div>
        <Button variant="secondary" className="mt-5 gap-2" onClick={ajukan}>
          <Send className="h-4 w-4" />
          Ajukan Honor
        </Button>
      </Card>
      <h3 className="font-serif text-lg mb-3">Riwayat Pengajuan</h3>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Sesi</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myReq.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  Belum pernah mengajukan.
                </TableCell>
              </TableRow>
            )}
            {myReq.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{fmtDateTime(h.createdAt)}</TableCell>
                <TableCell>{h.jumlahSesi}</TableCell>
                <TableCell className="text-right">{fmtRp(h.total)}</TableCell>
                <TableCell>
                  <Badge
                    variant={h.status === "disetujui" ? "default" : "secondary"}
                  >
                    {h.status}
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

export function PelatihSlip() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "pelatih") return null;
  const p = user as PelatihUser;
  const sg = db.users.find((u) => u.id === p.sanggarId) as
    | SanggarUser
    | undefined;
  const slips = db.pengajuanHonor
    .filter((h) => h.pelatihId === p.id && h.status === "disetujui")
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));

  return (
    <div>
      <PageHeader
        title="Arsip E-Slip"
        subtitle="Slip gaji digital yang telah dikirim Sanggar."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slips.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3 p-12 text-center text-muted-foreground">
            Belum ada slip gaji.
          </Card>
        )}
        {slips.map((s) => (
          <Dialog key={s.id}>
            <DialogTrigger asChild>
              <Card className="p-5 cursor-pointer hover-elevate">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.paidAt ? fmtDate(s.paidAt) : "—"}
                </div>
                <div className="font-serif text-2xl mt-2">{fmtRp(s.total)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.jumlahSesi} sesi · @ {fmtRp(s.honorPerSesi)}
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                  <FileText className="h-3 w-3" />
                  Lihat Slip
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>E-Slip Honor</DialogTitle>
              </DialogHeader>
              <div className="border-2 border-primary p-6 rounded-md">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Slip Gaji Digital
                  </div>
                  <div className="font-serif text-xl mt-1">
                    {sg?.namaSanggar}
                  </div>
                </div>
                <hr className="my-4" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Pelatih</div>
                    {p.nama}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">
                      Tanggal Bayar
                    </div>
                    {s.paidAt ? fmtDate(s.paidAt) : "-"}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">
                      Jumlah Sesi
                    </div>
                    {s.jumlahSesi}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">
                      Honor / Sesi
                    </div>
                    {fmtRp(s.honorPerSesi)}
                  </div>
                </div>
                <hr className="my-4" />
                <div className="flex justify-between items-center">
                  <div className="text-sm">Total Diterima</div>
                  <div className="font-serif text-2xl text-primary">
                    {fmtRp(s.total)}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-4 text-center">
                  Bukti transfer: {s.buktiTransferDataUrl ?? "-"}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}

export function PelatihDistribusi() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || (user.role !== "pelatih" && user.role !== "seniman"))
    return null;
  const role = user.role;
  const items = db.distribusi
    .filter((d) => d.penerimaId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const konfirm = (id: string) => {
    save((d) => {
      const it = d.distribusi.find((x) => x.id === id);
      if (it) it.konfirmasi = true;
    });
    logActivity(user.id, role, "konfirmasi-honor", { id });
    toast({
      title: "Konfirmasi tercatat",
      description: "Setara e-materai penerimaan dana.",
    });
  };

  return (
    <div>
      <PageHeader
        title="Dana Proyek & Bagi Hasil"
        subtitle="Konfirmasi dana yang diterima sesuai nama proyek atau kegiatan Sanggar."
      />
      <div className="space-y-3">
        {items.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            Belum ada distribusi.
          </Card>
        )}
        {items.map((it) => (
          <Card
            key={it.id}
            className="p-5 flex items-center justify-between gap-4 flex-wrap"
          >
            <div>
              <div className="font-medium">{it.judulJob}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Bukti: {it.buktiTransferDataUrl ?? "-"} ·{" "}
                {fmtDateTime(it.createdAt)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-2xl text-primary">
                {fmtRp(it.nominal)}
              </div>
              {it.konfirmasi ? (
                <Badge className="mt-1 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Terkonfirmasi
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="mt-1 gap-2"
                  onClick={() => konfirm(it.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Konfirmasi Terima
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PelatihSertif() {
  const { user } = useAuth();
  const db = useDb();
  if (!user) return null;
  const items = db.sertifikat.filter((s) => s.pemilikId === user.id);
  return (
    <div>
      <PageHeader
        title="Sertifikat & Penghargaan Saya"
        subtitle="Dokumen profesi, sertifikat internal Sanggar, dan penghargaan."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3 p-12 text-center text-muted-foreground">
            Belum ada sertifikat.
          </Card>
        )}
        {items.map((s) => (
          <Card
            key={s.id}
            className="p-6 bg-gradient-to-br from-accent to-accent/60 text-accent-foreground"
          >
            <div className="text-xs uppercase tracking-widest">
              {s.kategori === "penghargaan" ? "Penghargaan" : "Sertifikat"}
            </div>
            <div className="font-serif text-xl mt-2">{s.jenis}</div>
            <div className="text-sm mt-3 opacity-80">
              Diterbitkan: {fmtDate(s.issuedAt)}
            </div>
            {s.penerbitNama && (
              <div className="text-sm mt-1 opacity-80">
                Oleh: {s.penerbitNama}
              </div>
            )}
            {s.nomor && (
              <div className="text-xs mt-1 opacity-75">Nomor: {s.nomor}</div>
            )}
            {s.predikat && (
              <Badge className="mt-3" variant="secondary">
                {s.predikat}
              </Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
