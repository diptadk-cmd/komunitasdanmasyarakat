import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { logActivity, persistSanggarProfile } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { SanggarUser, FotoGaleriItem, Rekening, RekamJejakItem, JenisPemilik } from "@/lib/types";
import { RekamJejakEditor } from "@/components/profile/RekamJejakEditor";
import { normalisasiRekamJejak } from "@/lib/rekam-jejak";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { ProfilePhotoUploader } from "@/components/profile/ProfilePhotoUploader";
import { GaleriUploader } from "@/components/profile/GaleriUploader";
import { RekeningEditor } from "@/components/profile/RekeningEditor";
import {
  unduhProfilDokumen,
  type DataProfilDokumen,
} from "@/lib/profil-dokumen";
import type { FormatUnduhanDokumen } from "@/lib/dokumen-export";
import { ShareLocation, mapsUrl, hasKoordinat } from "@/components/system/ShareLocation";
import { RegionSelector } from "@/components/RegionSelector";
import { ExternalLink } from "lucide-react";
import { formatAlamatWilayah } from "@/lib/regions";
import type { AlamatWilayah } from "@/lib/regions";

export default function SanggarProfile() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [editMode, setEdit] = useState(false);
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const galeri: FotoGaleriItem[] = sg.fotoGaleri ?? [];

  const [pendingWilayah, setPendingWilayah] = useState<AlamatWilayah>();
  const [draft, setDraft] = useState({
    namaKetua: sg.namaKetua,
    jenisPemilik: (sg.jenisPemilik ?? "organisasi") as JenisPemilik,
    alamat: sg.alamat,
    wilayah: sg.wilayah ?? {},
    noHp: sg.noHp ?? "",
    email: sg.email ?? "",
    deskripsi: sg.deskripsi ?? "",
    tahunBerdiri: String(sg.tahunBerdiri ?? ""),
    website: sg.website ?? "",
    instagram: sg.instagram ?? "",
    npwp: sg.npwp ?? "",
    lat: sg.lat,
    lng: sg.lng,
    fotoProfileDataUrl: sg.fotoProfileDataUrl,
    logoDataUrl: sg.logoDataUrl,
    kopSuratDataUrl: sg.kopSuratDataUrl,
    stempelDataUrl: sg.stempelDataUrl,
    fotoGaleri: galeri,
    rekening: { ...sg.rekening } as Rekening,
    rekamJejak: normalisasiRekamJejak(sg.rekamJejak),
  });

  const aktif = db.users.filter(u => (u.role === "seniman" || u.role === "pelatih") && (u as any).sanggarId === sg.id && (u as any).status === "aktif").length;

  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const currentYear = new Date().getFullYear();
    const year = draft.tahunBerdiri ? Number(draft.tahunBerdiri) : undefined;
    if (draft.namaKetua.trim().length < 3 || draft.namaKetua.trim().length > 150) {
      toast({ title: "Nama ketua tidak valid", description: "Isi 3–150 karakter.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      toast({ title: "Email tidak valid", variant: "destructive" });
      return;
    }
    if (!/^\+?[0-9][0-9\s-]{7,18}$/.test(draft.noHp.trim())) {
      toast({ title: "Nomor HP tidak valid", variant: "destructive" });
      return;
    }
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > currentYear)) {
      toast({ title: "Tahun berdiri tidak valid", description: `Gunakan tahun 1900–${currentYear}.`, variant: "destructive" });
      return;
    }
    if (draft.alamat.trim().length < 10 || draft.alamat.trim().length > 500) {
      toast({ title: "Alamat tidak valid", description: "Isi alamat lengkap 10–500 karakter.", variant: "destructive" });
      return;
    }
    if (draft.website.trim() && !isHttpUrl(draft.website.trim())) {
      toast({ title: "Alamat website tidak valid", description: "Gunakan URL lengkap, misalnya https://contoh.id.", variant: "destructive" });
      return;
    }
    if (draft.instagram.trim() && !/^@?[A-Za-z0-9._]{1,30}$/.test(draft.instagram.trim()) && !isHttpUrl(draft.instagram.trim())) {
      toast({ title: "Instagram tidak valid", description: "Gunakan @namaakun atau URL Instagram.", variant: "destructive" });
      return;
    }
    if (!draft.rekening.bank || draft.rekening.nomor.trim().length < 5 || draft.rekening.atasNama.trim().length < 3) {
      toast({ title: "Data rekening belum lengkap", variant: "destructive" });
      return;
    }
    if ((draft.lat === undefined) !== (draft.lng === undefined)) {
      toast({ title: "Koordinat lokasi belum lengkap", description: "Bagikan ulang lokasi agar latitude dan longitude tersimpan bersama.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await persistSanggarProfile(sg.id, sg.apiId, {
        namaKetua: draft.namaKetua.trim(),
        jenisPemilik: draft.jenisPemilik,
        alamat: draft.alamat.trim(),
        wilayah: draft.wilayah,
        noHp: draft.noHp.trim(),
        email: draft.email.trim().toLowerCase(),
        deskripsi: draft.deskripsi.trim() || undefined,
        tahunBerdiri: year,
        website: draft.website.trim() || undefined,
        instagram: draft.instagram.trim() || undefined,
        npwp: draft.npwp.trim() || undefined,
        lat: draft.lat,
        lng: draft.lng,
        fotoProfileDataUrl: draft.fotoProfileDataUrl,
        logoDataUrl: draft.logoDataUrl,
        kopSuratDataUrl: draft.kopSuratDataUrl,
        stempelDataUrl: draft.stempelDataUrl,
        fotoGaleri: draft.fotoGaleri,
        rekening: { ...draft.rekening, nomor: draft.rekening.nomor.trim(), atasNama: draft.rekening.atasNama.trim() },
        rekamJejak: {
          karya: bersihkanRekamJejak(draft.rekamJejak.karya),
          keterlibatan: bersihkanRekamJejak(draft.rekamJejak.keterlibatan),
          juara: bersihkanRekamJejak(draft.rekamJejak.juara),
          penghargaan: bersihkanRekamJejak(draft.rekamJejak.penghargaan),
        },
      });
      logActivity(sg.id, "sanggar", "profile-edit");
      setEdit(false);
      toast(
        res.server
          ? { title: "Profil tersimpan" }
          : {
              title: "Tersimpan sementara (lokal)",
              description:
                "Belum tersinkron ke server. Masuk langsung sebagai sanggar ini agar profil tersimpan permanen.",
            },
      );
    } catch (error) {
      toast({
        title: "Gagal menyimpan ke server",
        description: error instanceof Error ? error.message : "Perubahan dibatalkan. Coba lagi saat koneksi pulih.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft({
      namaKetua: sg.namaKetua,
      jenisPemilik: (sg.jenisPemilik ?? "organisasi") as JenisPemilik,
      alamat: sg.alamat,
      wilayah: sg.wilayah ?? {},
      noHp: sg.noHp ?? "",
      email: sg.email ?? "",
      deskripsi: sg.deskripsi ?? "",
      tahunBerdiri: String(sg.tahunBerdiri ?? ""),
      website: sg.website ?? "",
      instagram: sg.instagram ?? "",
      npwp: sg.npwp ?? "",
      lat: sg.lat,
      lng: sg.lng,
      fotoProfileDataUrl: sg.fotoProfileDataUrl,
      logoDataUrl: sg.logoDataUrl,
      kopSuratDataUrl: sg.kopSuratDataUrl,
      stempelDataUrl: sg.stempelDataUrl,
      fotoGaleri: galeri,
      rekening: { ...sg.rekening },
      rekamJejak: normalisasiRekamJejak(sg.rekamJejak),
    });
    setEdit(false);
  };

  const downloadProfile = async (format: FormatUnduhanDokumen) => {
    const rj = normalisasiRekamJejak(sg.rekamJejak);
    const fmtRj = (items: RekamJejakItem[]) =>
      items
        .map(it => `${it.tahun ? `${it.tahun} · ` : ""}${it.nama}${it.keterangan ? ` — ${it.keterangan}` : ""}`)
        .join("\n") || "-";
    const safeName = sg.namaSanggar.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    const penghargaan = [...rj.juara, ...rj.penghargaan];
    const data: DataProfilDokumen = {
      fileName: `Profil_${safeName || "Sanggar"}`,
      title: `Profil Sanggar — ${sg.namaSanggar}`,
      namaUtama: sg.namaSanggar,
      labelLogo: "LOGO",
      logoDataUrl: sg.logoDataUrl ?? sg.fotoProfileDataUrl,
      alamat: sg.alamat,
      telepon: sg.noHp,
      email: sg.email,
      mediaSosial: [sg.instagram, sg.website].filter(Boolean).join(" · "),
      bidang: sg.jenisKesenian.join(", "),
      pembuka: `Profil ini disusun untuk memberikan gambaran singkat mengenai identitas, kegiatan, rekam jejak, serta informasi administrasi ${sg.namaSanggar} sebagai sanggar yang bergerak di bidang ${sg.jenisKesenian.join(", ")}.`,
      sections: [
        {
          heading: "Identitas Sanggar",
          rows: [
            { label: "Nama Sanggar", value: sg.namaSanggar },
            { label: "Nama Ketua", value: sg.namaKetua },
            { label: "Legalitas", value: `${sg.legalitas}${sg.namaBadanHukum ? ` — ${sg.namaBadanHukum}` : ""}` },
            { label: "Tahun Berdiri", value: sg.tahunBerdiri },
            { label: "Jenis Kesenian", value: sg.jenisKesenian.join(", ") },
            { label: "Anggota Aktif", value: `${aktif} orang` },
            { label: "NPWP", value: sg.npwp },
          ],
        },
        {
          heading: "Kontak & Profil Publik",
          rows: [
            { label: "Email", value: sg.email },
            { label: "No. HP", value: sg.noHp },
            { label: "Website", value: sg.website },
            { label: "Instagram", value: sg.instagram },
            { label: "Alamat", value: sg.alamat },
          ],
        },
        { heading: "Deskripsi Sanggar", paragraphs: [sg.deskripsi ?? "-"] },
        {
          heading: "Rekam Jejak & Prestasi",
          rows: [
            { label: "Karya", value: fmtRj(rj.karya) },
            { label: "Keterlibatan", value: fmtRj(rj.keterlibatan) },
            { label: "Penghargaan Lain", value: fmtRj(penghargaan) },
          ],
        },
        {
          heading: "Rekening Bank",
          rows: [
            { label: "Bank", value: sg.rekening.bank },
            { label: "No. Rekening", value: sg.rekening.nomor },
            { label: "Atas Nama", value: sg.rekening.atasNama },
          ],
        },
      ],
      jabatanTandaTangan: "Ketua Sanggar",
      namaTandaTangan: sg.namaKetua,
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

  return (
    <div>
      <PageHeader
        title="Profil Sanggar"
        subtitle="Identitas Sanggar yang sinkron dengan seluruh sistem."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void downloadProfile("word")} data-testid="button-download-word">
              <Download className="h-4 w-4 mr-1" /> <span>Unduh Word</span>
            </Button>
            <Button variant="outline" onClick={() => void downloadProfile("pdf")} data-testid="button-download-pdf">
              <Download className="h-4 w-4 mr-1" /> <span>Unduh PDF</span>
            </Button>
            {!editMode && (
              <Button onClick={() => setEdit(true)} data-testid="button-edit">Edit Profil</Button>
            )}
          </div>
        }
      />

      <Card className="p-6 mb-6">
        <h3 className="font-serif text-lg mb-4">Identitas & Foto Profil</h3>
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center">
          <ProfilePhotoUploader
            value={editMode ? draft.fotoProfileDataUrl : sg.fotoProfileDataUrl}
            onChange={v => editMode && setDraft({ ...draft, fotoProfileDataUrl: v })}
            fallbackText={sg.namaSanggar}
            editable={editMode}
          />
          <div className="flex-1 grid sm:grid-cols-2 gap-4">
            <Field label="Nama Sanggar" value={sg.namaSanggar} />
            <Field label="Legalitas" value={`${sg.legalitas}${sg.namaBadanHukum ? ` — ${sg.namaBadanHukum}` : ""}`} />
            <Field label="Jenis Kesenian" value={sg.jenisKesenian.join(", ")} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Anggota Aktif</Label>
              <div className="flex items-center gap-2"><span className="text-2xl font-serif">{aktif}</span><Badge variant="secondary">otomatis</Badge></div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-serif text-lg mb-2">Identitas Visual Sanggar</h3>
        <p className="mb-5 text-sm text-muted-foreground">
          Logo tampil pada penanda Sanggar di peta publik setelah profil disimpan.
          Kop surat dipakai pada dokumen resmi Sanggar.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Label className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground">
              Logo Sanggar
            </Label>
            <p className="mb-3 text-xs text-muted-foreground">
              Gunakan logo yang mudah terbaca pada ukuran kecil di peta.
            </p>
            <ProfilePhotoUploader
              value={editMode ? draft.logoDataUrl : sg.logoDataUrl}
              onChange={(value) =>
                editMode && setDraft({ ...draft, logoDataUrl: value })
              }
              fallbackText={sg.namaSanggar}
              appearance="square"
              uploadLabel="Unggah Logo"
              imageLabel="Logo Sanggar"
              editable={editMode}
            />
          </div>
          <div>
            <Label className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground">
              Stempel Sanggar
            </Label>
            <ProfilePhotoUploader
              value={editMode ? draft.stempelDataUrl : sg.stempelDataUrl}
              onChange={(value) =>
                editMode && setDraft({ ...draft, stempelDataUrl: value })
              }
              fallbackText="ST"
              appearance="square"
              uploadLabel="Unggah Stempel"
              imageLabel="Stempel Sanggar"
              editable={editMode}
            />
          </div>
          <div className="lg:col-span-2">
            <Label className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground">
              Kop Surat
            </Label>
            <p className="mb-3 text-xs text-muted-foreground">
              Unggah gambar kop surat lengkap dalam format lebar. Kop ini dipakai
              pada dokumen resmi Sanggar dan tidak ditampilkan di peta.
            </p>
            <ProfilePhotoUploader
              value={editMode ? draft.kopSuratDataUrl : sg.kopSuratDataUrl}
              onChange={(value) =>
                editMode && setDraft({ ...draft, kopSuratDataUrl: value })
              }
              fallbackText="KOP"
              appearance="wide"
              uploadLabel="Unggah Kop Surat"
              imageLabel="Kop Surat"
              maxDimension={1600}
              maxBytes={600 * 1024}
              editable={editMode}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-serif text-lg mb-4">Data Kontak & Profil Publik</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {editMode ? (
            <>
              <Edit label="Nama Ketua" v={draft.namaKetua} on={v => setDraft({ ...draft, namaKetua: v })} />
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jenis Pemilik Profil</Label>
                <Select value={draft.jenisPemilik} onValueChange={(v: JenisPemilik) => setDraft({ ...draft, jenisPemilik: v })}>
                  <SelectTrigger data-testid="select-jenis-pemilik"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organisasi">Organisasi</SelectItem>
                    <SelectItem value="perorangan">Perorangan</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Organisasi: dokumen cetak memakai kop surat sanggar. Perorangan: tanpa kop surat.
                </p>
              </div>
              <Edit label="Tahun Berdiri" v={draft.tahunBerdiri} on={v => setDraft({ ...draft, tahunBerdiri: v.replace(/\D/g, "").slice(0, 4) })} />
              <Edit label="Email" v={draft.email} on={v => setDraft({ ...draft, email: v })} />
              <Edit label="No. HP" v={draft.noHp} on={v => setDraft({ ...draft, noHp: v })} />
              <Edit label="Website" v={draft.website} on={v => setDraft({ ...draft, website: v })} />
              <Edit label="Instagram" v={draft.instagram} on={v => setDraft({ ...draft, instagram: v })} />
              <Edit label="NPWP" v={draft.npwp} on={v => setDraft({ ...draft, npwp: v.replace(/[^\d.\-]/g, "").slice(0, 25) })} />
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wilayah (opsional)</Label>
                <RegionSelector
                  mode="dki-only"
                  value={draft.wilayah ?? {}}
                  onChange={(w) => setDraft((prev) => ({ ...prev, wilayah: w }))}
                  pendingWilayah={pendingWilayah}
                  onPendingWilayahConsumed={() => setPendingWilayah(undefined)}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Alamat</Label>
                <Textarea rows={2} value={draft.alamat} onChange={e => setDraft({ ...draft, alamat: e.target.value })} />
                <ShareLocation
                  lat={draft.lat}
                  lng={draft.lng}
                  onChange={(lat, lng) =>
                    setDraft((previous) => ({ ...previous, lat, lng }))
                  }
                  onAddressResolved={(wilayah, alamatDetail) => {
                    setPendingWilayah(wilayah);
                    const alamat = formatAlamatWilayah(wilayah, alamatDetail);
                    if (alamat) {
                      setDraft((previous) => ({ ...previous, alamat }));
                    }
                  }}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Deskripsi Sanggar</Label>
                <Textarea rows={3} value={draft.deskripsi} onChange={e => setDraft({ ...draft, deskripsi: e.target.value })} placeholder="Sejarah singkat, visi, dan misi sanggar..." />
              </div>
            </>
          ) : (
            <>
              <Field label="Nama Ketua" value={sg.namaKetua} />
              <Field label="Jenis Pemilik Profil" value={(sg.jenisPemilik ?? "organisasi") === "organisasi" ? "Organisasi" : "Perorangan"} />
              <Field label="Tahun Berdiri" value={sg.tahunBerdiri ? String(sg.tahunBerdiri) : "-"} />
              <Field label="Email" value={sg.email ?? "-"} />
              <Field label="No. HP" value={sg.noHp ?? "-"} />
              <Field label="Website" value={sg.website ?? "-"} />
              <Field label="Instagram" value={sg.instagram ?? "-"} />
              <Field label="NPWP" value={sg.npwp ?? "-"} />
              <div className="sm:col-span-2">
                <Field label="Alamat" value={sg.alamat} />
                {hasKoordinat(sg.lat, sg.lng) && (
                  <a
                    href={mapsUrl(sg.lat, sg.lng as number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Lihat Lokasi di Google Maps
                  </a>
                )}
              </div>
              <div className="sm:col-span-2"><Field label="Deskripsi Sanggar" value={sg.deskripsi ?? "-"} long /></div>
            </>
          )}
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-serif text-lg mb-4">Rekening Bank Sanggar</h3>
        <RekeningEditor value={editMode ? draft.rekening : sg.rekening} onChange={r => editMode && setDraft({ ...draft, rekening: r })} editable={editMode} />
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-serif text-lg mb-4">Rekam Jejak & Prestasi</h3>
        <p className="text-sm text-muted-foreground mb-4 -mt-2">
          Karya, keterlibatan kegiatan, juara, dan penghargaan lain yang pernah diraih sanggar.
        </p>
        <RekamJejakEditor
          value={editMode ? draft.rekamJejak : normalisasiRekamJejak(sg.rekamJejak)}
          onChange={v => editMode && setDraft({ ...draft, rekamJejak: v })}
          editable={editMode}
        />
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-serif text-lg mb-4">Galeri Karya & Dokumentasi</h3>
        <GaleriUploader items={editMode ? draft.fotoGaleri : galeri} onChange={items => editMode && setDraft({ ...draft, fotoGaleri: items })} editable={editMode} />
      </Card>

      {editMode && (
        <div className="mt-6 flex gap-2 justify-end sticky bottom-4">
          <Button variant="outline" onClick={cancel} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Perubahan"}</Button>
        </div>
      )}
    </div>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function bersihkanRekamJejak(items: RekamJejakItem[]): RekamJejakItem[] {
  return items
    .filter(it => it.nama.trim())
    .map(it => ({
      ...it,
      nama: it.nama.trim(),
      keterangan: it.keterangan?.trim() || undefined,
    }));
}

function Field({ label, value, long }: { label: string; value: string; long?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className={`text-sm ${long ? "whitespace-pre-wrap" : ""}`}>{value}</div>
    </div>
  );
}
function Edit({ label, v, on }: { label: string; v: string; on: (s: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={v} onChange={e => on(e.target.value)} />
    </div>
  );
}
