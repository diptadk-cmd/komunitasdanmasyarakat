import { useMemo, useState } from "react";
import { Award, Download, FileBadge, GraduationCap } from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { logActivity, persistMember, save, uid } from "@/lib/store";
import type {
  PelatihUser,
  PredikatRaporAnggota,
  RaporAnggota,
  SenimanUser,
  Sertifikat,
} from "@/lib/types";
import { downloadLockedPdf } from "@/lib/pdf";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Anggota = PelatihUser | SenimanUser;
type NilaiKey =
  | "nilaiDisiplin"
  | "nilaiTeknik"
  | "nilaiKreativitas"
  | "nilaiKerjaSama";
const NILAI: Array<{ key: NilaiKey; label: string }> = [
  { key: "nilaiDisiplin", label: "Disiplin" },
  { key: "nilaiTeknik", label: "Kemampuan Teknik" },
  { key: "nilaiKreativitas", label: "Kreativitas" },
  { key: "nilaiKerjaSama", label: "Kerja Sama" },
];
const predikat = (value: number): PredikatRaporAnggota =>
  value >= 85
    ? "Sangat Baik"
    : value >= 75
      ? "Baik"
      : value >= 60
        ? "Cukup"
        : "Perlu Pembinaan";

export default function PengembanganAnggota() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const sanggar = user?.role === "sanggar" ? user : null;
  const anggota = useMemo(
    () =>
      db.users.filter(
        (item): item is Anggota =>
          (item.role === "pelatih" || item.role === "seniman") &&
          item.sanggarId === sanggar?.id &&
          item.status === "aktif",
      ),
    [db.users, sanggar?.id],
  );
  const [anggotaId, setAnggotaId] = useState(anggota[0]?.id ?? "");
  const selected = anggota.find((item) => item.id === anggotaId) ?? anggota[0];
  const [busy, setBusy] = useState(false);
  const [rapor, setRapor] = useState({
    judul: "Rapor Pembinaan",
    periode: "",
    catatan: "",
    nilaiDisiplin: 80,
    nilaiTeknik: 80,
    nilaiKreativitas: 80,
    nilaiKerjaSama: 80,
  });
  const [credential, setCredential] = useState({
    kategori: "sertifikat" as "sertifikat" | "penghargaan",
    jenis: "",
    nomor: "",
    predikat: "",
    keterangan: "",
  });
  if (!sanggar) return null;
  const reports = selected?.rapor ?? [];
  const credentials = selected
    ? db.sertifikat.filter(
        (item) =>
          item.pemilikId === selected.id &&
          (item.penerbitId === sanggar.id || item.sanggarId === sanggar.id),
      )
    : [];

  const issueReport = async () => {
    if (!selected || !rapor.periode.trim() || !rapor.judul.trim()) {
      toast({
        title: "Pilih anggota dan isi periode rapor",
        variant: "destructive",
      });
      return;
    }
    const values = NILAI.map(({ key }) => rapor[key]);
    if (values.some((value) => value < 0 || value > 100)) {
      toast({ title: "Nilai harus 0–100", variant: "destructive" });
      return;
    }
    const average = Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
    const item: RaporAnggota = {
      id: uid(),
      sanggarId: sanggar.id,
      sanggarNama: sanggar.namaSanggar,
      judul: rapor.judul.trim(),
      periode: rapor.periode.trim(),
      catatan: rapor.catatan.trim() || undefined,
      nilaiDisiplin: rapor.nilaiDisiplin,
      nilaiTeknik: rapor.nilaiTeknik,
      nilaiKreativitas: rapor.nilaiKreativitas,
      nilaiKerjaSama: rapor.nilaiKerjaSama,
      nilaiRataRata: average,
      predikat: predikat(average),
      issuedAt: Date.now(),
    };
    setBusy(true);
    try {
      await persistMember(selected.id, (member) => {
        member.rapor = [item, ...(member.rapor ?? [])];
      });
      logActivity(sanggar.id, "sanggar", "rapor-issue", {
        memberId: selected.id,
        reportId: item.id,
        average,
      });
      toast({
        title: "Rapor berhasil diterbitkan",
        description: `${selected.nama} memperoleh ${average} (${item.predikat}).`,
      });
      setRapor((state) => ({ ...state, periode: "", catatan: "" }));
    } catch (error) {
      toast({
        title: "Rapor gagal diterbitkan",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const issueCredential = async () => {
    if (!selected || !credential.jenis.trim() || !credential.nomor.trim()) {
      toast({
        title: "Judul dan nomor dokumen wajib diisi",
        variant: "destructive",
      });
      return;
    }
    if (
      db.sertifikat.some(
        (item) =>
          item.nomor?.toLowerCase() === credential.nomor.trim().toLowerCase(),
      )
    ) {
      toast({
        title: "Nomor dokumen sudah digunakan",
        variant: "destructive",
      });
      return;
    }
    const item: Sertifikat = {
      id: uid(),
      pemilikId: selected.id,
      pemilikNama: selected.nama,
      jenis: credential.jenis.trim(),
      kategori: credential.kategori,
      nomor: credential.nomor.trim(),
      predikat: credential.predikat.trim() || undefined,
      keterangan: credential.keterangan.trim() || undefined,
      issuedAt: Date.now(),
      sanggarId: sanggar.id,
      penerbitId: sanggar.id,
      penerbitNama: sanggar.namaSanggar,
      penerbitRole: "sanggar",
    };
    setBusy(true);
    try {
      await persistMember(selected.id, (member) => {
        const portfolio = member.portofolio ?? {
          karya: [],
          prestasi: [],
          sertifikasi: [],
          piagam: [],
          penghargaan: [],
        };
        const key =
          credential.kategori === "penghargaan" ? "penghargaan" : "sertifikasi";
        portfolio[key] = [
          {
            id: item.id,
            tahun: String(new Date(item.issuedAt).getFullYear()),
            nama: item.jenis,
            keterangan: `${item.nomor}${item.predikat ? ` · ${item.predikat}` : ""} · ${sanggar.namaSanggar}`,
          },
          ...portfolio[key],
        ];
        member.portofolio = portfolio;
      });
      save((data) => data.sertifikat.unshift(item));
      logActivity(sanggar.id, "sanggar", `${credential.kategori}-issue`, {
        memberId: selected.id,
        credentialId: item.id,
      });
      toast({
        title:
          credential.kategori === "penghargaan"
            ? "Penghargaan diterbitkan"
            : "Sertifikat diterbitkan",
        description: `Dokumen tercatat di profil ${selected.nama}.`,
      });
      setCredential((state) => ({
        ...state,
        jenis: "",
        nomor: "",
        predikat: "",
        keterangan: "",
      }));
    } catch (error) {
      toast({
        title: "Dokumen gagal diterbitkan",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = (item: RaporAnggota) =>
    downloadLockedPdf({
      filename: `Rapor_${selected?.nama ?? "Anggota"}_${item.periode.replace(/\W+/g, "_")}.pdf`,
      title: item.judul,
      subtitle: `${sanggar.namaSanggar} · ${item.periode}`,
      ownerPassword: db.exportPassword || "kurator123",
      sections: [
        {
          heading: "Penerima",
          body: `Nama: ${selected?.nama}\nPeran: ${selected?.role === "pelatih" ? "Pelatih" : "Seniman"}\nJenis Kesenian: ${selected?.jenisKesenian}`,
        },
        {
          heading: "Penilaian",
          body: `Disiplin: ${item.nilaiDisiplin}\nKemampuan Teknik: ${item.nilaiTeknik}\nKreativitas: ${item.nilaiKreativitas}\nKerja Sama: ${item.nilaiKerjaSama}\n\nNilai Rata-rata: ${item.nilaiRataRata}\nPredikat: ${item.predikat}`,
        },
        {
          heading: "Catatan Sanggar",
          body: item.catatan || "Tidak ada catatan.",
        },
      ],
    });
  const downloadCredential = (item: Sertifikat) =>
    downloadLockedPdf({
      filename: `${item.kategori === "penghargaan" ? "Penghargaan" : "Sertifikat"}_${selected?.nama ?? "Anggota"}.pdf`,
      title: item.kategori === "penghargaan" ? "Penghargaan" : "Sertifikat",
      subtitle: `${sanggar.namaSanggar} · Nomor ${item.nomor ?? "-"}`,
      ownerPassword: db.exportPassword || "kurator123",
      sections: [
        {
          heading: "Diberikan Kepada",
          body: `${selected?.nama}\n${selected?.role === "pelatih" ? "Pelatih" : "Seniman"} · ${selected?.jenisKesenian}`,
        },
        {
          heading: item.jenis,
          body: `${item.predikat ? `Predikat: ${item.predikat}\n` : ""}${item.keterangan || "Diterbitkan sebagai bagian dari pembinaan Sanggar."}\n\nTanggal terbit: ${new Date(item.issuedAt).toLocaleDateString("id-ID")}`,
        },
      ],
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapor & Apresiasi Anggota"
        subtitle="Terbitkan rapor, sertifikat internal Sanggar, dan penghargaan untuk Seniman atau Pelatih aktif."
      />
      <Card className="p-5">
        <Label>Pilih Seniman / Pelatih Aktif</Label>
        <Select value={selected?.id ?? ""} onValueChange={setAnggotaId}>
          <SelectTrigger className="mt-2 max-w-xl">
            <SelectValue placeholder="Belum ada anggota aktif" />
          </SelectTrigger>
          <SelectContent>
            {anggota.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.nama} · {item.role === "pelatih" ? "Pelatih" : "Seniman"}{" "}
                · {item.jenisKesenian}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {anggota.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada Seniman atau Pelatih berstatus aktif.
          </p>
        )}
      </Card>
      <Tabs defaultValue="rapor">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="rapor">Rapor</TabsTrigger>
          <TabsTrigger value="dokumen">Sertifikat & Penghargaan</TabsTrigger>
          <TabsTrigger value="arsip">Arsip Terbit</TabsTrigger>
        </TabsList>
        <TabsContent value="rapor">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Terbitkan Rapor Pembinaan
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                label="Judul Rapor"
                value={rapor.judul}
                onChange={(judul) => setRapor({ ...rapor, judul })}
              />
              <Field
                label="Periode"
                placeholder="Contoh: Semester I 2026"
                value={rapor.periode}
                onChange={(periode) => setRapor({ ...rapor, periode })}
              />
              {NILAI.map(({ key, label }) => (
                <Field
                  key={key}
                  label={`${label} (0–100)`}
                  type="number"
                  value={String(rapor[key])}
                  onChange={(value) =>
                    setRapor({
                      ...rapor,
                      [key]: Math.max(0, Math.min(100, Number(value) || 0)),
                    })
                  }
                />
              ))}
              <div className="space-y-1.5 md:col-span-2">
                <Label>Catatan Pembinaan</Label>
                <Textarea
                  rows={4}
                  value={rapor.catatan}
                  onChange={(event) =>
                    setRapor({ ...rapor, catatan: event.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={() => void issueReport()}
                  disabled={busy || !selected}
                >
                  Terbitkan Rapor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dokumen">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBadge className="h-5 w-5" />
                Terbitkan Dokumen Apresiasi
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Jenis Dokumen</Label>
                <Select
                  value={credential.kategori}
                  onValueChange={(kategori) =>
                    setCredential({
                      ...credential,
                      kategori: kategori as typeof credential.kategori,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sertifikat">
                      Sertifikat Internal Sanggar
                    </SelectItem>
                    <SelectItem value="penghargaan">Penghargaan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nomor Dokumen"
                placeholder="Contoh: 001/SGR/VIII/2026"
                value={credential.nomor}
                onChange={(nomor) => setCredential({ ...credential, nomor })}
              />
              <Field
                label="Judul / Nama"
                value={credential.jenis}
                onChange={(jenis) => setCredential({ ...credential, jenis })}
              />
              <Field
                label="Predikat (opsional)"
                value={credential.predikat}
                onChange={(value) =>
                  setCredential({ ...credential, predikat: value })
                }
              />
              <div className="space-y-1.5 md:col-span-2">
                <Label>Keterangan</Label>
                <Textarea
                  rows={4}
                  value={credential.keterangan}
                  onChange={(event) =>
                    setCredential({
                      ...credential,
                      keterangan: event.target.value,
                    })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={() => void issueCredential()}
                  disabled={busy || !selected}
                >
                  <Award className="mr-2 h-4 w-4" />
                  Terbitkan Dokumen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="arsip" className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg">Rapor {selected?.nama}</h2>
            <div className="space-y-3">
              {reports.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <b>{item.judul}</b>
                    <div className="text-sm text-muted-foreground">
                      {item.periode} · {item.nilaiRataRata} ({item.predikat})
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadReport(item)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Belum ada rapor.
                </p>
              )}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg">
              Sertifikat & Penghargaan
            </h2>
            <div className="space-y-3">
              {credentials.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <Badge variant="outline">
                      {item.kategori === "penghargaan"
                        ? "Penghargaan"
                        : "Sertifikat"}
                    </Badge>
                    <b className="ml-2">{item.jenis}</b>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Nomor {item.nomor ?? "-"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadCredential(item)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              ))}
              {credentials.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Belum ada dokumen.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
