import { useId, useState } from "react";
import {
  Award,
  Download,
  GraduationCap,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { load as loadDb, logActivity, persistMember, uid } from "@/lib/store";
import type {
  JenisKesenian,
  JenjangPendidikanAnggota,
  PelatihUser,
  PortofolioAnggota,
  RekamJejakItem,
  Rekening,
  RiwayatPendidikanAnggota,
  SenimanUser,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfilePhotoUploader } from "@/components/profile/ProfilePhotoUploader";
import { GaleriUploader } from "@/components/profile/GaleriUploader";
import { RekeningEditor } from "@/components/profile/RekeningEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  unduhProfilDokumen,
  type BarisProfilDokumen,
  type DataProfilDokumen,
} from "@/lib/profil-dokumen";
import type { FormatUnduhanDokumen } from "@/lib/dokumen-export";

type Anggota = PelatihUser | SenimanUser;
type PortofolioKey = keyof PortofolioAnggota;
const KESENIAN: JenisKesenian[] = [
  "Tari",
  "Musik",
  "Teater",
  "Rupa",
  "Sastra",
  "Silat",
];
const JENJANG: JenjangPendidikanAnggota[] = [
  "SD",
  "SMP",
  "SMA/Setara",
  "D3",
  "D4/S1",
  "S2",
  "S3",
];
const BAGIAN: Array<{ key: PortofolioKey; label: string }> = [
  { key: "karya", label: "Karya" },
  { key: "prestasi", label: "Prestasi" },
  { key: "sertifikasi", label: "Sertifikasi" },
  { key: "piagam", label: "Piagam" },
  { key: "penghargaan", label: "Penghargaan" },
];
const normalizePortfolio = (
  value: PortofolioAnggota | undefined,
): PortofolioAnggota => ({
  karya: value?.karya ?? [],
  prestasi: value?.prestasi ?? [],
  sertifikasi: value?.sertifikasi ?? [],
  piagam: value?.piagam ?? [],
  penghargaan: value?.penghargaan ?? [],
});

export default function AnggotaProfile() {
  const { user, setSession } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!user || (user.role !== "seniman" && user.role !== "pelatih"))
    return null;
  // Sesi bisa tertinggal ketika Sanggar baru menerbitkan rapor. Gunakan
  // rekaman store terbaru agar perubahan lintas akun/tab langsung terlihat.
  const storedMember = db.users.find(
    (item): item is Anggota =>
      item.id === user.id &&
      (item.role === "seniman" || item.role === "pelatih"),
  );
  const anggota = storedMember ?? (user as Anggota);
  const seniman = anggota.role === "seniman" ? anggota : null;
  const pelatih = anggota.role === "pelatih" ? anggota : null;
  const sanggar = db.users.find(
    (item) => item.id === anggota.sanggarId && item.role === "sanggar",
  );
  const namaSanggar = sanggar?.role === "sanggar" ? sanggar.namaSanggar : "—";
  const credentials = db.sertifikat.filter(
    (item) => item.pemilikId === anggota.id,
  );
  const [draft, setDraft] = useState(() => ({
    nama: anggota.nama,
    usia: String(anggota.usia ?? ""),
    profesi: seniman?.profesi ?? "",
    jenisKesenian: anggota.jenisKesenian,
    email: anggota.email ?? "",
    noHp: anggota.noHp ?? "",
    bio: anggota.bio ?? "",
    alamat: anggota.alamat ?? "",
    npwp: anggota.npwp ?? "",
    jenisKelamin: seniman?.jenisKelamin ?? "",
    tanggalLahir: seniman?.tanggalLahir ?? "",
    fotoProfileDataUrl: anggota.fotoProfileDataUrl,
    fotoGaleri: [...(anggota.fotoGaleri ?? [])],
    rekening: { ...anggota.rekening } as Rekening,
    riwayat: structuredClone(anggota.riwayatPendidikan ?? []),
    portofolio: structuredClone(normalizePortfolio(anggota.portofolio)),
    menerimaKelasPrivat: pelatih?.menerimaKelasPrivat ?? false,
    namaLayananPrivat: pelatih?.namaLayananPrivat ?? "Kelas Privat Seni Betawi",
    hargaKelasPrivat: String(pelatih?.hargaKelasPrivat ?? ""),
  }));

  const saveProfile = async () => {
    const invalidEducation = draft.riwayat.some(
      (item) =>
        !item.namaInstitusi.trim() ||
        !item.nomorIjazah.trim() ||
        !/^\d{4}$/.test(item.tahunLulus),
    );
    const invalidPortfolio = BAGIAN.some(({ key }) =>
      draft.portofolio[key].some((item) => !item.nama.trim()),
    );
    const invalidPrivateClass =
      anggota.role === "pelatih" &&
      draft.menerimaKelasPrivat &&
      (!draft.namaLayananPrivat.trim() || Number(draft.hargaKelasPrivat) <= 0);
    if (
      !draft.nama.trim() ||
      invalidEducation ||
      invalidPortfolio ||
      invalidPrivateClass
    ) {
      toast({
        title: "Data belum lengkap",
        description: invalidPrivateClass
          ? "Layanan privat wajib memiliki nama layanan dan tarif lebih dari Rp0."
          : invalidEducation
            ? "Setiap pendidikan wajib berisi sekolah/kampus, nomor ijazah, dan tahun lulus 4 digit."
            : "Nama dan setiap entri portofolio wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const result = await persistMember(anggota.id, (current) => {
        current.nama = draft.nama.trim();
        current.usia = Number(draft.usia) || current.usia;
        current.pendidikan =
          draft.riwayat.at(-1)?.jenjang ?? current.pendidikan;
        current.jenisKesenian = draft.jenisKesenian;
        current.email = draft.email.trim() || undefined;
        current.noHp = draft.noHp.trim() || undefined;
        current.bio = draft.bio.trim() || undefined;
        current.alamat = draft.alamat.trim() || undefined;
        current.npwp = draft.npwp.trim() || undefined;
        current.fotoProfileDataUrl = draft.fotoProfileDataUrl;
        current.fotoGaleri = draft.fotoGaleri;
        current.rekening = draft.rekening;
        current.riwayatPendidikan = draft.riwayat;
        current.portofolio = draft.portofolio;
        if (current.role === "seniman") {
          current.profesi = draft.profesi.trim() || undefined;
          current.jenisKelamin =
            (draft.jenisKelamin as SenimanUser["jenisKelamin"]) || undefined;
          current.tanggalLahir = draft.tanggalLahir || undefined;
        }
        if (current.role === "pelatih") {
          current.menerimaKelasPrivat = draft.menerimaKelasPrivat;
          current.namaLayananPrivat = draft.menerimaKelasPrivat
            ? draft.namaLayananPrivat.trim()
            : undefined;
          current.hargaKelasPrivat = draft.menerimaKelasPrivat
            ? Number(draft.hargaKelasPrivat)
            : undefined;
        }
      });
      const updated = loadDb().users.find((item) => item.id === anggota.id);
      if (updated) setSession(updated);
      logActivity(anggota.id, anggota.role, "profile-edit", {
        educationCount: draft.riwayat.length,
      });
      toast({
        title: result.server
          ? "Profil tersimpan permanen"
          : "Profil tersimpan lokal",
        description: "Pendidikan dan portofolio profesional telah diperbarui.",
      });
      setEditing(false);
    } catch (error) {
      toast({
        title: "Profil gagal disimpan",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadProfile = async (format: FormatUnduhanDokumen) => {
    const profile = loadDb().users.find((item) => item.id === anggota.id) as
      | Anggota
      | undefined;
    if (!profile) return;
    const education = profile.riwayatPendidikan ?? [],
      portfolio = normalizePortfolio(profile.portofolio);
    const safeName = profile.nama
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const namaPeran = profile.role === "pelatih" ? "Pelatih" : "Seniman";
    const identitas: BarisProfilDokumen[] = [
      { label: "Nama Lengkap", value: profile.nama },
      { label: "Peran", value: namaPeran },
      { label: "Usia", value: `${profile.usia} tahun` },
      { label: "Pendidikan Terakhir", value: profile.pendidikan },
      { label: "Jenis Kesenian", value: profile.jenisKesenian },
      { label: "Sanggar", value: `${namaSanggar} (${profile.status})` },
      { label: "NPWP", value: profile.npwp },
    ];
    if (profile.role === "seniman") {
      identitas.splice(3, 0,
        { label: "Profesi", value: profile.profesi },
        { label: "Jenis Kelamin", value: profile.jenisKelamin },
        { label: "Tanggal Lahir", value: profile.tanggalLahir },
      );
    }
    if (profile.role === "pelatih") {
      identitas.splice(3, 0, {
        label: "Layanan Privat",
        value: profile.menerimaKelasPrivat
          ? `${profile.namaLayananPrivat ?? "Kelas Privat"} · Rp ${Number(profile.hargaKelasPrivat ?? 0).toLocaleString("id-ID")} / pertemuan`
          : "Tidak menerima kelas privat",
      });
    }
    const daftar = (items: RekamJejakItem[]) =>
      items.length
        ? items
            .map(
              (item) =>
                `${item.tahun || "-"} · ${item.nama}${item.keterangan ? ` — ${item.keterangan}` : ""}`,
            )
            .join("\n")
        : "Belum diisi.";
    const data: DataProfilDokumen = {
      fileName: `Profil_${profile.role}_${safeName || profile.id}`,
      title: `Profil ${namaPeran} — ${profile.nama}`,
      namaUtama: profile.nama,
      labelLogo: "FOTO",
      logoDataUrl: profile.fotoProfileDataUrl,
      alamat: profile.alamat,
      telepon: profile.noHp,
      email: profile.email,
      mediaSosial: `${namaPeran} · ${namaSanggar}`,
      bidang: profile.jenisKesenian,
      pembuka: `Profil ini disusun untuk memberikan gambaran singkat mengenai identitas, pendidikan, karya, prestasi, serta informasi profesional ${profile.nama} sebagai ${namaPeran.toLowerCase()} di bidang ${profile.jenisKesenian}.`,
      sections: [
        {
          heading: `Identitas ${namaPeran}`,
          rows: identitas,
        },
        {
          heading: "Kontak & Bio",
          rows: [
            { label: "Email", value: profile.email },
            { label: "No. HP", value: profile.noHp },
            { label: "Alamat", value: profile.alamat },
          ],
          paragraphs: [profile.bio ?? "-"],
        },
        {
          heading: "Riwayat Pendidikan",
          paragraphs: [education.length
            ? education
                .map(
                  (item) =>
                    `${item.jenjang} · ${item.namaInstitusi}\nNomor Ijazah: ${item.nomorIjazah} · Tahun: ${item.tahunLulus}`,
                )
                .join("\n\n")
            : "Belum diisi."],
        },
        {
          heading: "Portofolio & Rekam Jejak",
          rows: BAGIAN.map(({ key, label }) => ({
            label,
            value: daftar(portfolio[key]),
          })),
        },
        {
          heading: "Rapor Sanggar",
          paragraphs: [(profile.rapor ?? []).length
            ? (profile.rapor ?? [])
                .map(
                  (item) =>
                    `${item.judul} · ${item.periode}\nNilai ${item.nilaiRataRata} (${item.predikat})\n${item.catatan ?? ""}`,
                )
                .join("\n\n")
            : "Belum ada rapor."],
        },
        {
          heading: "Sertifikat & Penghargaan",
          paragraphs: [credentials.length
            ? credentials
                .map(
                  (item) =>
                    `${item.kategori === "penghargaan" ? "Penghargaan" : "Sertifikat"}: ${item.jenis}\nNomor: ${item.nomor ?? "-"} · Penerbit: ${item.penerbitNama ?? "Kurator/Sanggar"}`,
                )
                .join("\n\n")
            : "Belum ada."],
        },
        {
          heading: "Rekening Bank",
          rows: [
            { label: "Bank", value: profile.rekening.bank },
            { label: "No. Rekening", value: profile.rekening.nomor },
            { label: "Atas Nama", value: profile.rekening.atasNama },
          ],
        },
      ],
      jabatanTandaTangan: "Pemilik Profil",
      namaTandaTangan: profile.nama,
    };
    try {
      await unduhProfilDokumen(format, data);
      toast({ title: `Profil ${format === "word" ? "Word" : "PDF"} berhasil diunduh` });
    } catch (error) {
      toast({
        title: "Gagal mengunduh profil",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    }
  };

  const addEducation = () =>
    setDraft((state) => ({
      ...state,
      riwayat: [
        ...state.riwayat,
        {
          id: uid(),
          jenjang: "SMA/Setara",
          namaInstitusi: "",
          nomorIjazah: "",
          tahunLulus: "",
        },
      ],
    }));
  const updateEducation = (
    id: string,
    patch: Partial<RiwayatPendidikanAnggota>,
  ) =>
    setDraft((state) => ({
      ...state,
      riwayat: state.riwayat.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  const addPortfolio = (key: PortofolioKey) =>
    setDraft((state) => ({
      ...state,
      portofolio: {
        ...state.portofolio,
        [key]: [
          ...state.portofolio[key],
          { id: uid(), tahun: "", nama: "", keterangan: "" },
        ],
      },
    }));
  const updatePortfolio = (
    key: PortofolioKey,
    id: string,
    patch: Partial<RekamJejakItem>,
  ) =>
    setDraft((state) => ({
      ...state,
      portofolio: {
        ...state.portofolio,
        [key]: state.portofolio[key].map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      },
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Profesional Saya"
        subtitle="Identitas, pendidikan, karya, prestasi, sertifikasi, penghargaan, dan dokumen pembinaan Sanggar."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void downloadProfile("word")} data-testid="button-download-word">
              <Download className="mr-2 h-4 w-4" />
              <span>Unduh Word</span>
            </Button>
            <Button variant="outline" onClick={() => void downloadProfile("pdf")} data-testid="button-download-pdf">
              <Download className="mr-2 h-4 w-4" />
              <span>Unduh PDF</span>
            </Button>
            {!editing && (
              <Button onClick={() => setEditing(true)}>Edit Profil</Button>
            )}
          </div>
        }
      />
      <Card className="p-6">
        <h2 className="mb-4 font-serif text-lg">Foto & Identitas</h2>
        <div className="flex flex-col gap-6 lg:flex-row">
          <ProfilePhotoUploader
            value={
              editing ? draft.fotoProfileDataUrl : anggota.fotoProfileDataUrl
            }
            onChange={(value) =>
              editing && setDraft({ ...draft, fotoProfileDataUrl: value })
            }
            fallbackText={anggota.nama}
          />
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            {editing ? (
              <>
                <Edit
                  label="Nama Lengkap"
                  value={draft.nama}
                  onChange={(nama) => setDraft({ ...draft, nama })}
                />
                <Edit
                  label="Usia"
                  value={draft.usia}
                  onChange={(usia) =>
                    setDraft({
                      ...draft,
                      usia: usia.replace(/\D/g, "").slice(0, 3),
                    })
                  }
                />
                {seniman && (
                  <Edit
                    label="Profesi"
                    value={draft.profesi}
                    onChange={(profesi) => setDraft({ ...draft, profesi })}
                  />
                )}
                <div className="space-y-1.5">
                  <Label>Jenis Kesenian</Label>
                  <Select
                    value={draft.jenisKesenian}
                    onValueChange={(jenisKesenian) =>
                      setDraft({
                        ...draft,
                        jenisKesenian: jenisKesenian as JenisKesenian,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KESENIAN.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {seniman && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Jenis Kelamin</Label>
                      <Select
                        value={draft.jenisKelamin}
                        onValueChange={(jenisKelamin) =>
                          setDraft({ ...draft, jenisKelamin })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                          <SelectItem value="Perempuan">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Edit
                      label="Tanggal Lahir"
                      type="date"
                      value={draft.tanggalLahir}
                      onChange={(tanggalLahir) =>
                        setDraft({ ...draft, tanggalLahir })
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <Field label="Nama Lengkap" value={anggota.nama} />
                <Field label="Usia" value={String(anggota.usia)} />
                {seniman && (
                  <Field label="Profesi" value={seniman.profesi ?? "-"} />
                )}
                <Field label="Jenis Kesenian" value={anggota.jenisKesenian} />
                {seniman && (
                  <>
                    <Field
                      label="Jenis Kelamin"
                      value={seniman.jenisKelamin ?? "-"}
                    />
                    <Field
                      label="Tanggal Lahir"
                      value={seniman.tanggalLahir ?? "-"}
                    />
                  </>
                )}
              </>
            )}
            <div>
              <Label>Sanggar</Label>
              <div className="mt-1 text-sm">
                {namaSanggar}
                <Badge variant="outline" className="ml-2">
                  {anggota.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {pelatih && (
        <Card className="p-6">
          <h2 className="font-serif text-lg">Layanan Kelas Privat</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pelatih dapat menerima pesanan privat langsung dari Konsumen atau
            Mitra, tanpa menghapus keterhubungan dengan Sanggar.
          </p>
          {editing ? (
            <div className="mt-4 space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={draft.menerimaKelasPrivat}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      menerimaKelasPrivat: event.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <strong className="block">Terima kelas privat</strong>
                  <span className="text-xs text-muted-foreground">
                    Layanan akan muncul pada katalog Konsumen dan Mitra.
                  </span>
                </span>
              </label>
              {draft.menerimaKelasPrivat && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Edit
                    label="Nama Layanan Privat"
                    value={draft.namaLayananPrivat}
                    onChange={(namaLayananPrivat) =>
                      setDraft({ ...draft, namaLayananPrivat })
                    }
                  />
                  <Edit
                    label="Tarif per Pertemuan (Rp)"
                    value={draft.hargaKelasPrivat}
                    onChange={(hargaKelasPrivat) =>
                      setDraft({
                        ...draft,
                        hargaKelasPrivat: hargaKelasPrivat.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                label="Status"
                value={
                  pelatih.menerimaKelasPrivat
                    ? "Menerima kelas privat"
                    : "Tidak menerima kelas privat"
                }
              />
              {pelatih.menerimaKelasPrivat && (
                <>
                  <Field
                    label="Nama Layanan"
                    value={pelatih.namaLayananPrivat ?? "Kelas Privat"}
                  />
                  <Field
                    label="Tarif"
                    value={`Rp ${Number(pelatih.hargaKelasPrivat ?? 0).toLocaleString("id-ID")} / pertemuan`}
                  />
                </>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg">
              <GraduationCap className="h-5 w-5" />
              Riwayat Pendidikan
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              SD hingga S3, sekolah/kampus, nomor ijazah, dan tahun lulus.
            </p>
          </div>
          {editing && (
            <Button size="sm" variant="outline" onClick={addEducation}>
              <Plus className="mr-1 h-4 w-4" />
              Tambah
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {(editing ? draft.riwayat : (anggota.riwayatPendidikan ?? [])).map(
            (item) =>
              editing ? (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-lg border p-3 md:grid-cols-[140px_1fr_1fr_120px_auto]"
                >
                  <Select
                    value={item.jenjang}
                    onValueChange={(jenjang) =>
                      updateEducation(item.id, {
                        jenjang: jenjang as JenjangPendidikanAnggota,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JENJANG.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Sekolah / kampus"
                    value={item.namaInstitusi}
                    onChange={(e) =>
                      updateEducation(item.id, {
                        namaInstitusi: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Nomor ijazah"
                    value={item.nomorIjazah}
                    onChange={(e) =>
                      updateEducation(item.id, { nomorIjazah: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Tahun"
                    value={item.tahunLulus}
                    onChange={(e) =>
                      updateEducation(item.id, {
                        tahunLulus: e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 4),
                      })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setDraft((state) => ({
                        ...state,
                        riwayat: state.riwayat.filter(
                          (entry) => entry.id !== item.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div key={item.id} className="rounded-lg border p-3">
                  <b>
                    {item.jenjang} · {item.namaInstitusi}
                  </b>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Nomor Ijazah: {item.nomorIjazah} · Tahun {item.tahunLulus}
                  </div>
                </div>
              ),
          )}
          {(editing ? draft.riwayat : (anggota.riwayatPendidikan ?? []))
            .length === 0 && <Empty text="Riwayat pendidikan belum diisi." />}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {BAGIAN.map(({ key, label }) => {
          const items = editing
            ? draft.portofolio[key]
            : (anggota.portofolio?.[key] ?? []);
          return (
            <Card key={key} className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg">{label}</h2>
                {editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addPortfolio(key)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Tambah
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {items.map((item) =>
                  editing ? (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <div className="grid grid-cols-[110px_1fr_auto] gap-2">
                        <Input
                          placeholder="Tahun"
                          value={item.tahun ?? ""}
                          onChange={(e) =>
                            updatePortfolio(key, item.id, {
                              tahun: e.target.value.slice(0, 20),
                            })
                          }
                        />
                        <Input
                          placeholder={`Nama ${label.toLowerCase()}`}
                          value={item.nama}
                          onChange={(e) =>
                            updatePortfolio(key, item.id, {
                              nama: e.target.value,
                            })
                          }
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setDraft((state) => ({
                              ...state,
                              portofolio: {
                                ...state.portofolio,
                                [key]: state.portofolio[key].filter(
                                  (entry) => entry.id !== item.id,
                                ),
                              },
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Keterangan"
                        value={item.keterangan ?? ""}
                        onChange={(e) =>
                          updatePortfolio(key, item.id, {
                            keterangan: e.target.value,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div key={item.id} className="rounded-lg border p-3">
                      <b>{item.nama}</b>
                      <div className="text-xs text-muted-foreground">
                        {item.tahun || "Tahun belum diisi"}
                      </div>
                      {item.keterangan && (
                        <p className="mt-2 text-sm">{item.keterangan}</p>
                      )}
                    </div>
                  ),
                )}
                {items.length === 0 && <Empty text={`${label} belum diisi.`} />}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg">
          <Trophy className="h-5 w-5" />
          Rapor Sanggar
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(anggota.rapor ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <b>{item.judul}</b>
                  <div className="text-sm text-muted-foreground">
                    {item.periode} · {item.sanggarNama}
                  </div>
                </div>
                <Badge>
                  {item.nilaiRataRata} · {item.predikat}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
                <span>Disiplin {item.nilaiDisiplin}</span>
                <span>Teknik {item.nilaiTeknik}</span>
                <span>Kreativitas {item.nilaiKreativitas}</span>
                <span>Kerja Sama {item.nilaiKerjaSama}</span>
              </div>
              {item.catatan && <p className="mt-3 text-sm">{item.catatan}</p>}
            </div>
          ))}
          {(anggota.rapor ?? []).length === 0 && (
            <Empty text="Belum ada rapor dari Sanggar." />
          )}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg">
          <Award className="h-5 w-5" />
          Sertifikat & Penghargaan
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {credentials.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <Badge variant="outline">
                {item.kategori === "penghargaan" ? "Penghargaan" : "Sertifikat"}
              </Badge>
              <div className="mt-2 font-semibold">{item.jenis}</div>
              <div className="text-sm text-muted-foreground">
                Nomor {item.nomor ?? "-"} ·{" "}
                {item.penerbitNama ?? "Kurator/Sanggar"}
              </div>
              {item.keterangan && (
                <p className="mt-2 text-sm">{item.keterangan}</p>
              )}
            </div>
          ))}
          {credentials.length === 0 && (
            <Empty text="Belum ada sertifikat atau penghargaan." />
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-serif text-lg">Kontak, Bio & Rekening</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {editing ? (
            <>
              <Edit
                label="Email"
                value={draft.email}
                onChange={(email) => setDraft({ ...draft, email })}
              />
              <Edit
                label="No. HP"
                value={draft.noHp}
                onChange={(noHp) => setDraft({ ...draft, noHp })}
              />
              <Edit
                label="NPWP"
                value={draft.npwp}
                onChange={(npwp) => setDraft({ ...draft, npwp })}
              />
              <Area
                label="Alamat"
                value={draft.alamat}
                onChange={(alamat) => setDraft({ ...draft, alamat })}
              />
              <Area
                label="Bio"
                value={draft.bio}
                onChange={(bio) => setDraft({ ...draft, bio })}
              />
            </>
          ) : (
            <>
              <Field label="Email" value={anggota.email ?? "-"} />
              <Field label="No. HP" value={anggota.noHp ?? "-"} />
              <Field label="NPWP" value={anggota.npwp ?? "-"} />
              <Field label="Alamat" value={anggota.alamat ?? "-"} />
              <Field label="Bio" value={anggota.bio ?? "-"} />
            </>
          )}
        </div>
        <div className="mt-6 border-t pt-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Rekening ini digunakan untuk menerima dana sesuai proyek atau
            pembagian hasil Sanggar.
          </p>
          <RekeningEditor
            value={editing ? draft.rekening : anggota.rekening}
            onChange={(rekening) => editing && setDraft({ ...draft, rekening })}
            editable={editing}
          />
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 font-serif text-lg">Galeri Karya</h2>
        <GaleriUploader
          items={editing ? draft.fotoGaleri : (anggota.fotoGaleri ?? [])}
          onChange={(fotoGaleri) =>
            editing && setDraft({ ...draft, fotoGaleri })
          }
          editable={editing}
        />
      </Card>
      {editing && (
        <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-lg">
          <Button variant="outline" onClick={() => setEditing(false)}>
            Batal
          </Button>
          <Button onClick={() => void saveProfile()} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan Perubahan"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="whitespace-pre-wrap text-sm">{value}</div>
    </div>
  );
}
function Edit({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
