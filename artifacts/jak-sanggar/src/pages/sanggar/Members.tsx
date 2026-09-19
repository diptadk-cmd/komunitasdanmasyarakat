import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import {
  API_PASSWORD_PLACEHOLDER,
  save,
  logActivity,
  uid,
  load as loadDb,
  persistMember,
  createMemberAccount,
} from "@/lib/store";
import { MIN_ACCOUNT_PASSWORD_LENGTH, uploadsApi } from "@/lib/api";
import { downloadLockedPdf } from "@/lib/pdf";
import { dokumenSanggarPdf, tanggalCetak } from "@/lib/dokumen";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SanggarUser,
  PelatihUser,
  SenimanUser,
  JenisKesenian,
  Bank,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Check,
  X,
  ArrowRightLeft,
  Star,
  FileUp,
  FileDown,
} from "lucide-react";

export default function Members() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const list = db.users.filter(
    (u) =>
      (u.role === "seniman" || u.role === "pelatih") &&
      (u as any).sanggarId === sg.id,
  ) as (PelatihUser | SenimanUser)[];

  const aktif = list.filter((u) => u.status === "aktif");
  const pending = list.filter((u) => u.status === "pending");
  const arsip = list.filter(
    (u) => u.status === "keluar" || u.status === "ditolak",
  );

  // Semua aksi keanggotaan write-through ke server (lokal-dulu + rollback).
  // Toast jujur: bedakan tersimpan permanen (server) vs sementara (lokal).
  const run = async (
    id: string,
    mutate: Parameters<typeof persistMember>[1],
    okTitle: string,
    okDesc?: string,
  ) => {
    try {
      const { server } = await persistMember(id, mutate);
      if (server) toast({ title: okTitle, description: okDesc });
      else
        toast({
          title: `${okTitle} (tersimpan lokal)`,
          description:
            "Akun anggota belum tersinkron ke server; perubahan tersimpan sementara di perangkat ini.",
        });
      return true;
    } catch (err) {
      toast({
        title: "Gagal menyimpan ke server",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
      return false;
    }
  };
  const approve = async (id: string) => {
    if (
      await run(
        id,
        (u) => {
          u.status = "aktif";
        },
        "Anggota diterima",
      )
    ) {
      logActivity(sg.id, "sanggar", "approve-member", { id });
    }
  };
  const reject = (id: string) => {
    void run(
      id,
      (u) => {
        u.status = "ditolak";
      },
      "Permohonan ditolak",
    );
  };
  const promote = async (id: string) => {
    const ok = await run(
      id,
      (u, d) => {
        if (u.role === "seniman") {
          (u as any).role = "pelatih";
          (u as any).honorPerSesi = d.honorPerSesiDefault;
        }
      },
      "Promosi peran berhasil",
      "Seniman dipromosikan menjadi Pelatih.",
    );
    if (ok) logActivity(sg.id, "sanggar", "promote-pelatih", { id });
  };
  const mutasi = (id: string, newSanggarId: string) => {
    const target = db.users.find(
      (u) => u.id === newSanggarId && u.role === "sanggar",
    );
    if (!target) {
      toast({ title: "Sanggar tujuan tidak ditemukan", variant: "destructive" });
      return;
    }
    void run(
      id,
      (u) => {
        const record = u as unknown as Record<string, unknown>;
        record["mutasiTujuanUsername"] = target.username;
        record["mutasiDiajukanAt"] = Date.now();
      },
      "Pengajuan mutasi terkirim",
      "Anggota tetap berada di Sanggar ini sampai Kurator menyetujui mutasi.",
    );
  };
  const dismiss = async (id: string, file: File): Promise<boolean> => {
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) {
      toast({
        title: "Berkas tidak valid",
        description: "Gunakan PDF dengan ukuran maksimal 5 MB.",
        variant: "destructive",
      });
      return false;
    }
    let proofUrl: string;
    try {
      const uploaded = await uploadsApi.create(file);
      proofUrl = uploaded.url;
    } catch (err) {
      toast({
        title: "Surat gagal diunggah",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
      return false;
    }
    const ok = await run(
      id,
      (u) => {
        u.status = "keluar";
        const record = u as unknown as Record<string, unknown>;
        record["pemberhentianBuktiUrl"] = proofUrl;
        record["pemberhentianBuktiNama"] = file.name;
        record["pemberhentianAt"] = Date.now();
      },
      "Anggota diberhentikan",
      `Surat keterangan tersimpan: ${file.name}`,
    );
    if (ok) {
      save((d) => {
        d.activity.unshift({
          id: uid(),
          actorId: sg.id,
          actorRole: "sanggar",
          action: "dismiss-member",
          meta: { id, fileName: file.name },
          ts: Date.now(),
        });
      });
    }
    return ok;
  };

  return (
    <div>
      <PageHeader
        title="Keanggotaan & Regenerasi"
        subtitle="Kelola anggota, permohonan gabung, mutasi, promosi, dan pemberhentian."
        actions={<DirectAddDialog sg={sg} />}
      />
      <Tabs defaultValue="aktif">
        <TabsList>
          <TabsTrigger value="aktif">
            Anggota Aktif ({aktif.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Permohonan Gabung ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="arsip">Arsip ({arsip.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="aktif">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Usia</TableHead>
                  <TableHead>Pendidikan</TableHead>
                  <TableHead>Profesi/Kesenian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aktif.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Belum ada anggota aktif.
                    </TableCell>
                  </TableRow>
                )}
                {aktif.map((m) => (
                  <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                    <TableCell className="font-medium">{m.nama}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.role}</Badge>
                    </TableCell>
                    <TableCell>{m.usia}</TableCell>
                    <TableCell>{m.pendidikan}</TableCell>
                    <TableCell className="text-sm">
                      {(m as SenimanUser).profesi ?? m.jenisKesenian}
                    </TableCell>
                    <TableCell>
                      <Badge>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <MutasiDialog
                          member={m}
                          onSubmit={(s) => mutasi(m.id, s)}
                        />
                        {m.role === "seniman" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => promote(m.id)}
                          >
                            <Star className="h-3.5 w-3.5" />
                            Promosi
                          </Button>
                        )}
                        <DismissDialog
                          sg={sg}
                          member={m}
                          onSubmit={(f) => dismiss(m.id, f)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Kesenian</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Tidak ada permohonan baru.
                    </TableCell>
                  </TableRow>
                )}
                {pending.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nama}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.noHp}</TableCell>
                    <TableCell>{m.jenisKesenian}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 mr-2"
                        onClick={() => reject(m.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => approve(m.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Terima
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="arsip">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Peran Terakhir</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arsip.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Arsip kosong.
                    </TableCell>
                  </TableRow>
                )}
                {arsip.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.nama}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MutasiDialog({
  member,
  onSubmit,
}: {
  member: PelatihUser | SenimanUser;
  onSubmit: (sanggarId: string) => void;
}) {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const others = (
    db.users.filter((u) => u.role === "sanggar") as SanggarUser[]
  ).filter((s) => s.id !== member.sanggarId);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Mutasi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mutasi Anggota</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Ajukan pemindahan{" "}
            <span className="font-medium text-foreground">{member.nama}</span>{" "}
            ke sanggar lain. Perpindahan baru berlaku setelah disetujui
            Kurator.
          </div>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.namaSanggar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => {
              onSubmit(target);
              setOpen(false);
            }}
          >
            Ajukan Mutasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DismissDialog({
  sg,
  member,
  onSubmit,
}: {
  sg: SanggarUser;
  member: PelatihUser | SenimanUser;
  onSubmit: (file: File) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const unduhSurat = () => {
    const ownerPwd = loadDb().exportPassword || "kurator123";
    const safeName =
      member.nama
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_") || "Anggota";
    downloadLockedPdf({
      filename: `Surat_Pemberhentian_${safeName}.pdf`,
      title: "SURAT KETERANGAN PEMBERHENTIAN",
      subtitle: `${sg.namaSanggar} · Dicetak ${tanggalCetak()}`,
      ownerPassword: ownerPwd,
      sections: [
        {
          heading: "Pernyataan",
          body:
            `Dengan ini ${sg.namaSanggar} menerangkan bahwa Saudara/Saudari ${member.nama} ` +
            `(peran terakhir: ${member.role === "pelatih" ? "Pelatih" : "Seniman"}) diberhentikan dari keanggotaan sanggar ` +
            `terhitung sejak tanggal surat ini diterbitkan.\n\n` +
            `Surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.`,
        },
      ],
      ...dokumenSanggarPdf(sg),
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive" className="gap-1">
          <FileUp className="h-3.5 w-3.5" />
          Berhentikan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pemberhentian Anggota</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Unggah Surat Keterangan (PDF) untuk memberhentikan{" "}
            <span className="font-medium text-foreground">{member.nama}</span>.
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={unduhSurat}
            data-testid="button-unduh-surat-pemberhentian"
          >
            <FileDown className="h-4 w-4" />
            Preview Draf Surat
          </Button>
          <p className="text-xs text-muted-foreground">
            Draf surat dibuat otomatis dengan kop dan blok tanda tangan sesuai
            profil sanggar. Cetak, tandatangani basah, lalu unggah hasil
            pindaiannya di bawah ini.
          </p>
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(
                next &&
                  next.type === "application/pdf" &&
                  next.size <= 5 * 1024 * 1024
                  ? next
                  : null,
              );
            }}
          />
          <p className="text-xs text-muted-foreground">PDF maksimal 5 MB.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              const ok = await onSubmit(file);
              setBusy(false);
              if (ok) {
                setOpen(false);
                setFile(null);
              }
            }}
          >
            {busy ? "Mengunggah..." : "Konfirmasi Pemberhentian"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DirectAddDialog({ sg }: { sg: SanggarUser }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    nama: "",
    username: "",
    password: "",
    email: "",
    noHp: "",
    usia: 20,
    pendidikan: "SMA",
    role: "seniman" as "seniman" | "pelatih",
    jenisKesenian: "Tari" as JenisKesenian,
  });
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const nama = f.nama.trim();
    const username = f.username.trim();
    const email = f.email.trim().toLowerCase();
    const noHp = f.noHp.trim();
    if (nama.length < 3) {
      toast({ title: "Nama minimal 3 karakter", variant: "destructive" });
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      toast({
        title: "Username tidak valid",
        description: "Gunakan 3–32 huruf, angka, titik, garis bawah, atau tanda hubung.",
        variant: "destructive",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Email tidak valid", variant: "destructive" });
      return;
    }
    if (!/^\+?[0-9][0-9\s-]{7,18}$/.test(noHp)) {
      toast({ title: "Nomor HP tidak valid", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(f.usia) || f.usia < 15 || f.usia > 100) {
      toast({ title: "Usia harus 15–100 tahun", variant: "destructive" });
      return;
    }
    if (f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      toast({
        title: `Password minimal ${MIN_ACCOUNT_PASSWORD_LENGTH} karakter`,
        variant: "destructive",
      });
      return;
    }
    const base = {
      id: uid(),
      username,
      password: API_PASSWORD_PLACEHOLDER,
      email,
      noHp,
      nama,
      usia: f.usia,
      pendidikan: f.pendidikan,
      jenisKesenian: f.jenisKesenian,
      sanggarId: sg.id,
      status: "aktif" as const,
      rekening: { bank: "BCA" as Bank, nomor: "-", atasNama: nama },
      createdAt: Date.now(),
    };
    const newU =
      f.role === "pelatih"
        ? ({ ...base, role: "pelatih", honorPerSesi: 250000 } as PelatihUser)
        : ({ ...base, role: "seniman" } as SenimanUser);
    setBusy(true);
    try {
      await createMemberAccount(newU, f.password);
      logActivity(sg.id, "sanggar", "create-member-direct", { id: newU.id });
      toast({
        title: "Akun dibuat",
        description: "Akun anggota tersimpan permanen di server.",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Gagal membuat akun",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-member">
          <UserPlus className="h-4 w-4" />
          Buat Akun Anggota
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Akun Anggota Langsung</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <I l="Nama" v={f.nama} on={(v) => setF({ ...f, nama: v })} />
          <I
            l="Username"
            v={f.username}
            on={(v) => setF({ ...f, username: v })}
          />
          <I
            l="Password"
            v={f.password}
            on={(v) => setF({ ...f, password: v })}
            type="password"
          />
          <I
            l="Email untuk OTP"
            v={f.email}
            on={(v) => setF({ ...f, email: v })}
            type="email"
          />
          <I l="No. HP" v={f.noHp} on={(v) => setF({ ...f, noHp: v })} />
          <I
            l="Usia"
            v={String(f.usia)}
            on={(v) => setF({ ...f, usia: Number(v) })}
            type="number"
          />
          <I
            l="Pendidikan"
            v={f.pendidikan}
            on={(v) => setF({ ...f, pendidikan: v })}
          />
          <div className="space-y-1.5">
            <Label>Peran</Label>
            <Select
              value={f.role}
              onValueChange={(v: any) => setF({ ...f, role: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seniman">Seniman</SelectItem>
                <SelectItem value="pelatih">Pelatih</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jenis Kesenian</Label>
            <Select
              value={f.jenisKesenian}
              onValueChange={(v: JenisKesenian) =>
                setF({ ...f, jenisKesenian: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "Tari",
                    "Musik",
                    "Teater",
                    "Rupa",
                    "Sastra",
                    "Silat",
                  ] as JenisKesenian[]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || !f.nama || !f.username || !f.password || !f.email}
          >
            {busy ? "Menyimpan..." : "Buat Akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function I({
  l,
  v,
  on,
  type = "text",
}: {
  l: string;
  v: string;
  on: (s: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{l}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
