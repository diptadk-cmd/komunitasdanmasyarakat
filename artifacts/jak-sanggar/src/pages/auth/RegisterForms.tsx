import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BackButton } from "@/components/layout/BackButton";
import { useDb, save, useAuth } from "@/lib/auth";
import {
  API_PASSWORD_PLACEHOLDER,
  uid,
  logActivity,
  createMemberAccount,
  load as loadDb,
} from "@/lib/store";
import {
  authApi,
  publicContentApi,
  uploadsApi,
  usersApi,
  MIN_ACCOUNT_PASSWORD_LENGTH,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type {
  JenisKesenian,
  Bank,
  Legalitas,
  StatusAktaNotaris,
  SanggarUser,
  PelatihUser,
  SenimanUser,
  JuriUser,
  PengrajinUser,
  MitraPengrajinUser,
  JenisKerajinan,
  SewaUser,
  JenisInstansiSewa,
  AlamatTerstruktur,
  BentukUsahaPengrajin,
  DokumenPengrajin,
  JenisDokumenPengrajin,
  SatuanProdukKerajinan,
} from "@/lib/types";
import { ShareLocation } from "@/components/system/ShareLocation";
import { RegionSelector } from "@/components/RegionSelector";
import { HighContrastToggle } from "@/components/system/HighContrastToggle";
import { RegistrationAgreementContent } from "@/components/legal/RegistrationAgreementContent";
import { formatAlamatWilayah } from "@/lib/regions";
import type { AlamatWilayah } from "@/lib/regions";
import {
  getBentukUsahaOptions,
  getDefaultBentukUsaha,
  getDefaultLegalitas,
  getLegalitasOptions,
  STATUS_AKTA_OPTIONS,
} from "@/lib/legalitas";

const EMPTY_WILAYAH: AlamatTerstruktur = {};

interface RegistrationSanggarOption {
  id: string;
  namaSanggar: string;
  alamat: string;
}

function registrationSanggarOptions(
  rows: Array<Record<string, unknown>>,
): RegistrationSanggarOption[] {
  return rows.flatMap((row) => {
    const id = typeof row["id"] === "string" ? row["id"].trim() : "";
    const namaSanggar =
      typeof row["namaSanggar"] === "string"
        ? row["namaSanggar"].trim()
        : "";
    if (!id || !namaSanggar) return [];
    return [
      {
        id,
        namaSanggar,
        alamat:
          typeof row["alamat"] === "string" ? row["alamat"].trim() : "",
      },
    ];
  });
}

function isWilayahLengkap(w: AlamatTerstruktur): boolean {
  return Boolean(w.provinsiId && w.kotaId && w.kecamatanId && w.kelurahanId);
}

function todayInJakarta(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sixMonthsBefore(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - 6;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function useAccountPolicyConfirmation() {
  const [resolver, setResolver] = useState<
    ((accepted: boolean) => void) | null
  >(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAgeAndAuthority, setConfirmedAgeAndAuthority] =
    useState(false);

  const confirmPolicy = () => {
    setAcceptedTerms(false);
    setConfirmedAgeAndAuthority(false);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  };
  const finish = (accepted: boolean) => {
    const current = resolver;
    setResolver(null);
    current?.(accepted);
  };

  const policyDialog = (
    <Dialog
      open={Boolean(resolver)}
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <DialogContent className="flex max-h-[94vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl">
            PERSETUJUAN PENDAFTARAN DAN PENGGUNAAN JAKSANGGAR
          </DialogTitle>
          <DialogDescription>
            Baca seluruh ketentuan, kemudian centang kedua pernyataan
            persetujuan untuk melanjutkan.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-4 pr-3 sm:p-5">
          <RegistrationAgreementContent />
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a
              className="font-semibold text-primary underline underline-offset-4"
              href="/syarat-ketentuan"
              rel="noreferrer"
              target="_blank"
            >
              Baca Syarat dan Ketentuan Lengkap
            </a>
            <a
              className="font-semibold text-primary underline underline-offset-4"
              href="/kebijakan-privasi"
              rel="noreferrer"
              target="_blank"
            >
              Baca Kebijakan Privasi
            </a>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-5">
            <Checkbox
              checked={acceptedTerms}
              className="mt-0.5"
              onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
            />
            <span>
              <strong>Saya telah membaca, memahami, dan menyetujui</strong>{" "}
              Syarat dan Ketentuan serta Kebijakan Privasi JakSanggar.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-5">
            <Checkbox
              checked={confirmedAgeAndAuthority}
              className="mt-0.5"
              onCheckedChange={(checked) =>
                setConfirmedAgeAndAuthority(checked === true)
              }
            />
            <span>
              <strong>
                Saya menyatakan telah berusia sekurang-kurangnya 18 tahun atau
                telah memperoleh persetujuan orang tua/wali.
              </strong>{" "}
              Apabila mewakili sanggar, komunitas, organisasi, atau pihak lain,
              saya memiliki kewenangan yang sah.
            </span>
          </label>

          <p className="text-xs text-muted-foreground">
            Tombol persetujuan akan aktif setelah kedua pernyataan dicentang.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => finish(false)}>
            TIDAK SETUJU
          </Button>
          <Button
            type="button"
            disabled={!acceptedTerms || !confirmedAgeAndAuthority}
            onClick={() => finish(true)}
          >
            SAYA SETUJU DAN DAFTAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirmPolicy, policyDialog };
}

const KESENIAN: JenisKesenian[] = [
  "Tari",
  "Musik",
  "Teater",
  "Rupa",
  "Sastra",
  "Silat",
];
const BANKS: Bank[] = ["BCA", "Mandiri", "DKI", "BRI", "BNI", "BSI", "CIMB"];
const PENDIDIKAN = ["SD", "SMP", "SMA", "D3", "S1", "S2", "S3"];
const JENIS_KERAJINAN: JenisKerajinan[] = [
  "Batik Betawi",
  "Ondel-ondel",
  "Miniatur",
  "Aksesori",
  "Kuliner Tradisional",
  "Alat Musik",
  "Kerajinan Lainnya",
];
const DOKUMEN_PENGRAJIN: JenisDokumenPengrajin[] = [
  "NPWP",
  "NIB",
  "Bukti Rekening",
  "Akta / Legalitas",
];
const DOKUMEN_VERIFIKASI_MITRA: JenisDokumenPengrajin[] = [
  "NIB",
  "Surat Domisili 5 Tahun RT/RW",
  "Surat Domisili Kelurahan JAKEVO/PTSP",
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function RegisterSanggar() {
  const db = useDb();
  const { setSession } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { confirmPolicy, policyDialog } = useAccountPolicyConfirmation();
  const [busy, setBusy] = useState(false);
  const [pendingWilayah, setPendingWilayah] = useState<AlamatWilayah>();
  const [f, setF] = useState({
    namaSanggar: "",
    namaKetua: "",
    username: "",
    email: "",
    password: "",
    konfirmasiPassword: "",
    statusAktaNotaris: "Berakta Notaris" as StatusAktaNotaris,
    legalitas: "Yayasan" as Legalitas,
    namaBadanHukum: "",
    jenisKesenian: [] as JenisKesenian[],
    alamat: "",
    lat: 0,
    lng: 0,
    wilayah: EMPTY_WILAYAH,
    noHp: "",
    bank: "BCA" as Bank,
    nomor: "",
    atasNama: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (
      db.users.some(
        (u) => u.username.toLowerCase() === f.username.toLowerCase(),
      )
    ) {
      toast({ title: "Username sudah digunakan", variant: "destructive" });
      return;
    }
    if (f.jenisKesenian.length === 0) {
      toast({
        title: "Pilih minimal 1 jenis kesenian",
        variant: "destructive",
      });
      return;
    }
    if (!isWilayahLengkap(f.wilayah)) {
      toast({
        title: "Lengkapi alamat wilayah",
        description: "Pilih kota, kecamatan, dan kelurahan.",
        variant: "destructive",
      });
      return;
    }
    if (!f.namaBadanHukum.trim()) {
      toast({
        title: "Lengkapi nama organisasi",
        description: "Nama organisasi wajib diisi sesuai jenis yang dipilih.",
        variant: "destructive",
      });
      return;
    }
    if (f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      toast({
        title: `Password minimal ${MIN_ACCOUNT_PASSWORD_LENGTH} karakter`,
        variant: "destructive",
      });
      return;
    }
    if (f.password !== f.konfirmasiPassword) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Ketik ulang password yang sama pada kedua kolom.",
        variant: "destructive",
      });
      return;
    }
    const alamatGabungan = formatAlamatWilayah(f.wilayah, f.alamat);
    const newUser: SanggarUser = {
      id: uid(),
      role: "sanggar",
      username: f.username,
      password: API_PASSWORD_PLACEHOLDER,
      email: f.email,
      noHp: f.noHp,
      namaSanggar: f.namaSanggar,
      namaKetua: f.namaKetua,
      statusAktaNotaris: f.statusAktaNotaris,
      legalitas: f.legalitas,
      namaBadanHukum: f.namaBadanHukum.trim(),
      jenisKesenian: f.jenisKesenian,
      alamat: alamatGabungan,
      wilayah: f.wilayah,
      lat: f.lat || -6.2,
      lng: f.lng || 106.8,
      rekening: { bank: f.bank, nomor: f.nomor, atasNama: f.atasNama },
      saldo: 0,
      editCount: 0,
      editPeriodStart: Date.now(),
      createdAt: Date.now(),
    };
    if (!(await confirmPolicy())) return;
    setBusy(true);
    try {
      const api = await authApi.register({
        username: f.username,
        password: f.password,
        role: "sanggar",
        profile: {
          namaSanggar: f.namaSanggar,
          namaKetua: f.namaKetua,
          statusAktaNotaris: f.statusAktaNotaris,
          legalitas: f.legalitas,
          namaBadanHukum: f.namaBadanHukum.trim(),
          jenisKesenian: f.jenisKesenian,
          alamat: alamatGabungan,
          wilayah: f.wilayah,
          lat: f.lat || -6.2,
          lng: f.lng || 106.8,
          rekening: { bank: f.bank, nomor: f.nomor, atasNama: f.atasNama },
          email: f.email,
          noHp: f.noHp,
        },
      });
      newUser.apiId = api.id;
      save((d) => {
        d.users.push(newUser);
      });
      logActivity(newUser.id, "sanggar", "register-sanggar");
      setSession(newUser);
      toast({
        title: "Pendaftaran berhasil",
        description: `Selamat datang, ${newUser.namaSanggar}. Akun tersimpan di server.`,
      });
      navigate("/sanggar");
    } catch (err) {
      const pesan =
        err instanceof Error ? err.message : "Server tidak dapat dihubungi.";
      toast({
        title: "Pendaftaran gagal",
        description: pesan,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <BackButton to="/daftar" label="Kembali ke Pilihan Peran" />
          <HighContrastToggle />
        </div>
        {policyDialog}
        <h1 className="mt-3 font-serif text-3xl">Pendaftaran Sanggar</h1>
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-8">
            <Section title="Identitas Sanggar">
              <Field
                label="Nama Ketua Sanggar"
                required
                value={f.namaKetua}
                onChange={(v) => setF({ ...f, namaKetua: v })}
              />
              <div className="space-y-1.5">
                <Label>
                  Status Akta Notaris <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={f.statusAktaNotaris}
                  onValueChange={(value: StatusAktaNotaris) =>
                    setF({
                      ...f,
                      statusAktaNotaris: value,
                      legalitas: getDefaultLegalitas(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_AKTA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Jenis Organisasi <span className="text-destructive">*</span>
                </Label>
                <Select
                  key={f.statusAktaNotaris}
                  value={f.legalitas}
                  onValueChange={(value: Legalitas) =>
                    setF({ ...f, legalitas: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getLegalitasOptions(f.statusAktaNotaris).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nama Badan Hukum / Usaha / Organisasi"
                required
                value={f.namaBadanHukum}
                onChange={(value) => setF({ ...f, namaBadanHukum: value })}
              />
              <Field
                label="Nama Kegiatan / Nama Sanggar / Unit Kegiatan"
                required
                value={f.namaSanggar}
                onChange={(value) => setF({ ...f, namaSanggar: value })}
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Jenis Kesenian <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4 flex-wrap p-3 border rounded-md">
                  {KESENIAN.map((k) => (
                    <label
                      key={k}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={f.jenisKesenian.includes(k)}
                        onCheckedChange={(c) => {
                          setF({
                            ...f,
                            jenisKesenian: c
                              ? [...f.jenisKesenian, k]
                              : f.jenisKesenian.filter((x) => x !== k),
                          });
                        }}
                      />{" "}
                      {k}
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Akun & Kontak">
              <Field
                label="Username"
                required
                value={f.username}
                onChange={(v) => setF({ ...f, username: v })}
              />
              <Field
                label="Email"
                type="email"
                required
                value={f.email}
                onChange={(v) => setF({ ...f, email: v })}
              />
              <PasswordFields
                password={f.password}
                confirmation={f.konfirmasiPassword}
                onPasswordChange={(password) => setF({ ...f, password })}
                onConfirmationChange={(konfirmasiPassword) =>
                  setF({ ...f, konfirmasiPassword })
                }
              />
              <Field
                label="No. HP / WhatsApp"
                required
                value={f.noHp}
                onChange={(v) => setF({ ...f, noHp: v })}
              />
              <RegionSelector
                mode="dki-only"
                value={f.wilayah}
                onChange={(w) => setF((prev) => ({ ...prev, wilayah: w }))}
                required
                pendingWilayah={pendingWilayah}
                onPendingWilayahConsumed={() => setPendingWilayah(undefined)}
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Alamat Detail (Jalan, RT/RW, No.){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  required
                  rows={2}
                  value={f.alamat}
                  onChange={(e) => setF({ ...f, alamat: e.target.value })}
                  placeholder="Jl. Mawar No. 12, RT 03/RW 05"
                />
                <ShareLocation
                  lat={f.lat}
                  lng={f.lng}
                  onChange={(lat, lng) =>
                    setF((previous) => ({ ...previous, lat, lng }))
                  }
                  onAddressResolved={(wilayah, alamatDetail) => {
                    setPendingWilayah(wilayah);
                    if (alamatDetail) {
                      setF((previous) => ({
                        ...previous,
                        alamat: alamatDetail,
                      }));
                    }
                  }}
                />
              </div>
            </Section>

            <Section title="Data Rekening Sanggar">
              <div className="space-y-1.5">
                <Label>Nama Bank</Label>
                <Select
                  value={f.bank}
                  onValueChange={(v: Bank) => setF({ ...f, bank: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nomor Rekening"
                required
                value={f.nomor}
                onChange={(v) => setF({ ...f, nomor: v })}
              />
              <Field
                label="Atas Nama Rekening"
                required
                value={f.atasNama}
                onChange={(v) => setF({ ...f, atasNama: v })}
              />
            </Section>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <BackButton to="/daftar" />
              <Button
                type="submit"
                disabled={busy}
                data-testid="button-submit-register"
              >
                {busy ? "Mendaftar..." : "Daftarkan Sanggar"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function RegisterPelatih() {
  return <RegisterMember kind="pelatih" />;
}
export function RegisterSeniman() {
  return <RegisterMember kind="seniman" />;
}

export function RegisterJuri() {
  const db = useDb();
  const { setSession } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { confirmPolicy, policyDialog } = useAccountPolicyConfirmation();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    nama: "",
    keahlian: "",
    pendidikan: "",
    pengalaman: "",
    bio: "",
    alamat: "",
    username: "",
    email: "",
    password: "",
    konfirmasiPassword: "",
    noHp: "",
    npwp: "",
    bank: "BCA" as Bank,
    nomor: "",
    atasNama: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!f.nama.trim() || !f.keahlian.trim() || !f.username.trim()) {
      toast({
        title: "Lengkapi data juri",
        description: "Nama, bidang keahlian, dan username wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    if (
      db.users.some(
        (u) => u.username.toLowerCase() === f.username.toLowerCase(),
      )
    ) {
      toast({ title: "Username sudah digunakan", variant: "destructive" });
      return;
    }
    if (f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      toast({
        title: `Password minimal ${MIN_ACCOUNT_PASSWORD_LENGTH} karakter`,
        variant: "destructive",
      });
      return;
    }
    if (f.password !== f.konfirmasiPassword) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Ketik ulang password yang sama pada kedua kolom.",
        variant: "destructive",
      });
      return;
    }

    const rekening =
      f.nomor.trim() || f.atasNama.trim()
        ? { bank: f.bank, nomor: f.nomor.trim(), atasNama: f.atasNama.trim() }
        : undefined;

    const newUser: JuriUser = {
      id: uid(),
      role: "juri",
      username: f.username.trim(),
      password: API_PASSWORD_PLACEHOLDER,
      email: f.email.trim() || undefined,
      noHp: f.noHp.trim() || undefined,
      createdAt: Date.now(),
      nama: f.nama.trim(),
      keahlian: f.keahlian.trim(),
      pendidikan: f.pendidikan.trim() || undefined,
      pengalaman: f.pengalaman.trim() || undefined,
      bio: f.bio.trim() || undefined,
      alamat: f.alamat.trim() || undefined,
      npwp: f.npwp.trim() || undefined,
      rekening,
    };

    if (!(await confirmPolicy())) return;
    setBusy(true);
    try {
      const api = await authApi.register({
        username: newUser.username,
        password: f.password,
        role: "juri",
        profile: {
          nama: newUser.nama,
          keahlian: newUser.keahlian,
          pendidikan: newUser.pendidikan,
          pengalaman: newUser.pengalaman,
          bio: newUser.bio,
          alamat: newUser.alamat,
          email: newUser.email,
          noHp: newUser.noHp,
          npwp: newUser.npwp,
          rekening: newUser.rekening,
        },
      });
      newUser.apiId = api.id;
      save((d) => {
        d.users.push(newUser);
      });
      logActivity(newUser.id, "juri", "register");
      setSession(newUser);
      toast({
        title: "Pendaftaran juri berhasil",
        description: `Selamat datang, ${newUser.nama}.`,
      });
      navigate("/juri");
    } catch (err) {
      toast({
        title: "Pendaftaran gagal",
        description:
          err instanceof Error ? err.message : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <BackButton to="/daftar" label="Kembali ke Pilihan Peran" />
          <HighContrastToggle />
        </div>
        {policyDialog}
        <h1 className="mt-3 font-serif text-3xl">Pendaftaran Juri</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Akun untuk penilai independen pada kurasi, lomba, atau seleksi karya
          seni.
        </p>
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-8">
            <Section title="Identitas Juri">
              <Field
                label="Nama Lengkap"
                required
                value={f.nama}
                onChange={(v) => setF({ ...f, nama: v })}
              />
              <Field
                label="Bidang Keahlian"
                required
                value={f.keahlian}
                onChange={(v) => setF({ ...f, keahlian: v })}
              />
              <Field
                label="Pendidikan Terakhir"
                value={f.pendidikan}
                onChange={(v) => setF({ ...f, pendidikan: v })}
              />
              <Field
                label="Pengalaman"
                value={f.pengalaman}
                onChange={(v) => setF({ ...f, pengalaman: v })}
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Alamat</Label>
                <Textarea
                  rows={2}
                  value={f.alamat}
                  onChange={(e) => setF({ ...f, alamat: e.target.value })}
                  placeholder="Alamat domisili juri"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Bio / Profil Singkat</Label>
                <Textarea
                  rows={3}
                  value={f.bio}
                  onChange={(e) => setF({ ...f, bio: e.target.value })}
                  placeholder="Riwayat, sertifikasi, dan pengalaman menilai."
                />
              </div>
            </Section>

            <Section title="Akun & Kontak">
              <Field
                label="Username"
                required
                value={f.username}
                onChange={(v) => setF({ ...f, username: v })}
              />
              <Field
                label="Email"
                type="email"
                value={f.email}
                onChange={(v) => setF({ ...f, email: v })}
              />
              <PasswordFields
                password={f.password}
                confirmation={f.konfirmasiPassword}
                onPasswordChange={(password) => setF({ ...f, password })}
                onConfirmationChange={(konfirmasiPassword) =>
                  setF({ ...f, konfirmasiPassword })
                }
              />
              <Field
                label="No. HP / WhatsApp"
                value={f.noHp}
                onChange={(v) => setF({ ...f, noHp: v })}
              />
              <Field
                label="NPWP"
                value={f.npwp}
                onChange={(v) => setF({ ...f, npwp: v })}
              />
            </Section>

            <Section title="Data Rekening Honor (Opsional)">
              <div className="space-y-1.5">
                <Label>Nama Bank</Label>
                <Select
                  value={f.bank}
                  onValueChange={(v: Bank) => setF({ ...f, bank: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nomor Rekening"
                value={f.nomor}
                onChange={(v) => setF({ ...f, nomor: v })}
              />
              <Field
                label="Atas Nama Rekening"
                value={f.atasNama}
                onChange={(v) => setF({ ...f, atasNama: v })}
              />
            </Section>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <BackButton to="/daftar" />
              <Button type="submit" disabled={busy}>
                {busy ? "Mendaftar..." : "Daftar sebagai Juri"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function RegisterMember({ kind }: { kind: "pelatih" | "seniman" }) {
  const db = useDb();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { confirmPolicy, policyDialog } = useAccountPolicyConfirmation();
  const useServerSanggars = import.meta.env.VITE_DEMO_MODE !== "true";
  const localSanggarList = db.users.filter(
    (u) => u.role === "sanggar",
  ) as SanggarUser[];
  const [serverSanggarList, setServerSanggarList] = useState<
    RegistrationSanggarOption[]
  >([]);
  const [sanggarListLoading, setSanggarListLoading] =
    useState(useServerSanggars);
  const [sanggarListError, setSanggarListError] = useState(false);
  const sanggarList: RegistrationSanggarOption[] = useServerSanggars
    ? serverSanggarList
    : localSanggarList;
  const [pendingWilayah, setPendingWilayah] = useState<AlamatWilayah>();
  const [f, setF] = useState({
    nama: "",
    username: "",
    email: "",
    password: "",
    konfirmasiPassword: "",
    noHp: "",
    usia: 25,
    pendidikan: "S1",
    jenisKesenian: "Tari" as JenisKesenian,
    sanggarId: "",
    menerimaKelasPrivat: kind === "pelatih",
    namaLayananPrivat: "",
    hargaKelasPrivat: 250000,
    alamatDetail: "",
    wilayah: EMPTY_WILAYAH,
    bank: "BCA" as Bank,
    nomor: "",
    atasNama: "",
  });

  useEffect(() => {
    if (!useServerSanggars) return;
    let cancelled = false;
    setSanggarListLoading(true);
    setSanggarListError(false);
    void publicContentApi
      .sanggars()
      .then((rows) => {
        if (cancelled) return;
        setServerSanggarList(registrationSanggarOptions(rows));
      })
      .catch(() => {
        if (cancelled) return;
        setServerSanggarList([]);
        setSanggarListError(true);
      })
      .finally(() => {
        if (!cancelled) setSanggarListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useServerSanggars]);

  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      db.users.some(
        (u) => u.username.toLowerCase() === f.username.toLowerCase(),
      )
    ) {
      toast({ title: "Username sudah digunakan", variant: "destructive" });
      return;
    }
    if (f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      toast({
        title: `Password minimal ${MIN_ACCOUNT_PASSWORD_LENGTH} karakter`,
        variant: "destructive",
      });
      return;
    }
    if (f.password !== f.konfirmasiPassword) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Ketik ulang password yang sama pada kedua kolom.",
        variant: "destructive",
      });
      return;
    }
    if (!f.sanggarId) {
      toast({
        title: "Pilih Sanggar tujuan",
        description:
          kind === "pelatih"
            ? "Pilih Sanggar atau opsi Pelatih mandiri."
            : "Pilih Sanggar yang akan menerima permohonan Anda.",
        variant: "destructive",
      });
      return;
    }
    if (!isWilayahLengkap(f.wilayah)) {
      toast({
        title: "Lengkapi alamat wilayah",
        description: "Pilih kota, kecamatan, dan kelurahan.",
        variant: "destructive",
      });
      return;
    }
    const alamatGabungan = formatAlamatWilayah(f.wilayah, f.alamatDetail);
    const base = {
      id: uid(),
      username: f.username,
      password: API_PASSWORD_PLACEHOLDER,
      email: f.email,
      noHp: f.noHp,
      nama: f.nama,
      usia: Number(f.usia),
      pendidikan: f.pendidikan,
      jenisKesenian: f.jenisKesenian,
      sanggarId: f.sanggarId === "_mandiri" ? undefined : f.sanggarId,
      sanggarServerId:
        useServerSanggars && f.sanggarId !== "_mandiri"
          ? f.sanggarId
          : undefined,
      alamat: alamatGabungan,
      wilayah: f.wilayah,
      status:
        kind === "pelatih" && f.sanggarId === "_mandiri"
          ? ("aktif" as const)
          : ("pending" as const),
      rekening: { bank: f.bank, nomor: f.nomor, atasNama: f.atasNama },
      createdAt: Date.now(),
    };
    const newUser =
      kind === "pelatih"
        ? ({
            ...base,
            role: "pelatih",
            honorPerSesi: db.honorPerSesiDefault,
            menerimaKelasPrivat: f.menerimaKelasPrivat,
            namaLayananPrivat:
              f.namaLayananPrivat.trim() ||
              `Kelas Privat ${f.jenisKesenian} — ${f.nama}`,
            hargaKelasPrivat: Math.max(
              0,
              Number(f.hargaKelasPrivat) || db.honorPerSesiDefault,
            ),
          } as PelatihUser)
        : ({ ...base, role: "seniman" } as SenimanUser);
    if (!(await confirmPolicy())) return;
    setBusy(true);
    try {
      await createMemberAccount(newUser, f.password, { register: true });
      const stored = loadDb().users.find((u) => u.id === newUser.id) ?? newUser;
      logActivity(stored.id, kind, "register");
      toast({
        title: "Pendaftaran terkirim",
        description:
          kind === "pelatih" && f.sanggarId === "_mandiri"
            ? "Akun Pelatih mandiri aktif dan siap menawarkan kelas privat."
            : "Permohonan dikirim ke Sanggar. Anda dapat masuk setelah pendaftaran disetujui.",
      });
      navigate("/");
    } catch (err) {
      toast({
        title: "Pendaftaran gagal",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const title =
    kind === "pelatih" ? "Pendaftaran Pelatih" : "Pendaftaran Seniman";

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <BackButton to="/daftar" label="Kembali ke Pilihan Peran" />
          <HighContrastToggle />
        </div>
        {policyDialog}
        <h1 className="mt-3 font-serif text-3xl">{title}</h1>
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-8">
            <Section title="Identitas">
              <Field
                label="Nama Lengkap"
                required
                value={f.nama}
                onChange={(v) => setF({ ...f, nama: v })}
              />
              <Field
                label="Usia"
                type="number"
                required
                value={String(f.usia)}
                onChange={(v) => setF({ ...f, usia: Number(v) })}
              />
              <div className="space-y-1.5">
                <Label>Pendidikan Terakhir</Label>
                <Select
                  value={f.pendidikan}
                  onValueChange={(v) => setF({ ...f, pendidikan: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PENDIDIKAN.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
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
                    {KESENIAN.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Section>

            <Section title="Akun & Kontak">
              <Field
                label="Username"
                required
                value={f.username}
                onChange={(v) => setF({ ...f, username: v })}
              />
              <Field
                label="Email"
                type="email"
                required
                value={f.email}
                onChange={(v) => setF({ ...f, email: v })}
              />
              <PasswordFields
                password={f.password}
                confirmation={f.konfirmasiPassword}
                onPasswordChange={(password) => setF({ ...f, password })}
                onConfirmationChange={(konfirmasiPassword) =>
                  setF({ ...f, konfirmasiPassword })
                }
              />
              <Field
                label="No. HP / WhatsApp"
                required
                value={f.noHp}
                onChange={(v) => setF({ ...f, noHp: v })}
              />
            </Section>

            <Section
              title={
                kind === "pelatih" ? "Alamat Domisili" : "Alamat (DKI Jakarta)"
              }
            >
              <RegionSelector
                mode={kind === "pelatih" ? "all-id" : "dki-only"}
                value={f.wilayah}
                onChange={(w) => setF((prev) => ({ ...prev, wilayah: w }))}
                required
                pendingWilayah={pendingWilayah}
                onPendingWilayahConsumed={() => setPendingWilayah(undefined)}
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Alamat Detail (Jalan, RT/RW, No.){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  required
                  rows={2}
                  value={f.alamatDetail}
                  onChange={(e) => setF({ ...f, alamatDetail: e.target.value })}
                  placeholder="Jl. Mawar No. 12, RT 03/RW 05"
                />
                <ShareLocation
                  lat={0}
                  lng={0}
                  onChange={() => {}}
                  onAddressResolved={(wilayah, alamatDetail) => {
                    setPendingWilayah(wilayah);
                    if (alamatDetail) {
                      setF((previous) => ({
                        ...previous,
                        alamatDetail,
                      }));
                    }
                  }}
                  mode="address"
                />
              </div>
            </Section>

            <Section
              title={kind === "pelatih" ? "Afiliasi Pelatih" : "Pilih Sanggar"}
            >
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Sanggar Tujuan</Label>
                <Select
                  value={f.sanggarId}
                  onValueChange={(v) => setF({ ...f, sanggarId: v })}
                  disabled={sanggarListLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        sanggarListLoading
                          ? "Memuat daftar Sanggar..."
                          : "Pilih Sanggar..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {kind === "pelatih" && (
                      <SelectItem value="_mandiri">
                        Pelatih mandiri — tanpa afiliasi Sanggar
                      </SelectItem>
                    )}
                    {sanggarList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.namaSanggar}
                        {s.alamat ? ` — ${s.alamat}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sanggarListError && (
                  <p className="text-xs text-destructive">
                    Daftar Sanggar belum dapat dimuat. Periksa koneksi lalu
                    buka ulang halaman ini.
                  </p>
                )}
                {!sanggarListLoading &&
                  !sanggarListError &&
                  sanggarList.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada Sanggar aktif yang tersedia.
                    </p>
                  )}
                <p className="text-xs text-muted-foreground">
                  {kind === "pelatih" && f.sanggarId === "_mandiri"
                    ? "Pelatih mandiri dapat menerima kelas privat langsung dari Konsumen atau Mitra."
                    : "Permohonan gabung Anda akan dikirim ke dasbor Sanggar untuk divalidasi."}
                </p>
              </div>
            </Section>

            {kind === "pelatih" && (
              <Section title="Layanan Kelas Privat">
                <label className="sm:col-span-2 flex items-start gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={f.menerimaKelasPrivat}
                    onChange={(event) =>
                      setF({ ...f, menerimaKelasPrivat: event.target.checked })
                    }
                  />
                  <span>
                    <strong>Terima pesanan kelas privat</strong>
                    <span className="block text-xs text-muted-foreground">
                      Konsumen dan Mitra dapat memesan langsung tanpa melalui
                      Sanggar.
                    </span>
                  </span>
                </label>
                {f.menerimaKelasPrivat && (
                  <>
                    <Field
                      label="Nama layanan privat"
                      value={f.namaLayananPrivat}
                      onChange={(value) =>
                        setF({ ...f, namaLayananPrivat: value })
                      }
                    />
                    <Field
                      label="Tarif per sesi"
                      type="number"
                      value={String(f.hargaKelasPrivat)}
                      onChange={(value) =>
                        setF({
                          ...f,
                          hargaKelasPrivat: Math.max(0, Number(value) || 0),
                        })
                      }
                    />
                  </>
                )}
              </Section>
            )}

            <Section title="Data Rekening Pribadi">
              <div className="space-y-1.5">
                <Label>Nama Bank</Label>
                <Select
                  value={f.bank}
                  onValueChange={(v: Bank) => setF({ ...f, bank: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nomor Rekening"
                required
                value={f.nomor}
                onChange={(v) => setF({ ...f, nomor: v })}
              />
              <Field
                label="Atas Nama"
                required
                value={f.atasNama}
                onChange={(v) => setF({ ...f, atasNama: v })}
              />
            </Section>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <BackButton to="/daftar" />
              <Button type="submit" disabled={busy}>
                {busy ? "Mendaftar..." : "Daftar"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

const JENIS_INSTANSI: JenisInstansiSewa[] = ["Pusat", "Daerah", "SKPD", "UKPD"];

const JENIS_INSTANSI_DESC: Record<JenisInstansiSewa, string> = {
  Pusat: "Kementerian / lembaga pemerintah pusat",
  Daerah: "Pemerintah Provinsi / Kabupaten / Kota",
  SKPD: "Satuan Kerja Perangkat Daerah",
  UKPD: "Unit Kerja Perangkat Daerah",
};

export function RegisterSewa() {
  const db = useDb();
  const { setSession } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { confirmPolicy, policyDialog } = useAccountPolicyConfirmation();
  const [pendingWilayah, setPendingWilayah] = useState<AlamatWilayah>();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    nama: "",
    username: "",
    email: "",
    password: "",
    konfirmasiPassword: "",
    noHp: "",
    alamatDetail: "",
    wilayah: EMPTY_WILAYAH,
    jenisInstansi: "Pusat" as JenisInstansiSewa,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (
      !f.nama.trim() ||
      !f.username.trim() ||
      f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH
    ) {
      toast({
        title: "Lengkapi data",
        description: `Nama, username, dan sandi (≥${MIN_ACCOUNT_PASSWORD_LENGTH} karakter) wajib.`,
        variant: "destructive",
      });
      return;
    }
    if (f.password !== f.konfirmasiPassword) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Ketik ulang password yang sama pada kedua kolom.",
        variant: "destructive",
      });
      return;
    }
    if (
      db.users.some(
        (u) => u.username.toLowerCase() === f.username.toLowerCase(),
      )
    ) {
      toast({ title: "Username sudah digunakan", variant: "destructive" });
      return;
    }
    if (!isWilayahLengkap(f.wilayah)) {
      toast({
        title: "Lengkapi alamat wilayah",
        description: "Pilih provinsi, kota, kecamatan, dan kelurahan.",
        variant: "destructive",
      });
      return;
    }
    const alamatGabungan = formatAlamatWilayah(f.wilayah, f.alamatDetail);
    const newUser: SewaUser = {
      id: uid(),
      role: "sewa",
      username: f.username.trim(),
      password: API_PASSWORD_PLACEHOLDER,
      email: f.email.trim() || undefined,
      noHp: f.noHp.trim() || undefined,
      nama: f.nama.trim(),
      alamat: alamatGabungan || undefined,
      wilayah: f.wilayah,
      jenisInstansi: f.jenisInstansi,
      createdAt: Date.now(),
    };
    if (!(await confirmPolicy())) return;
    setBusy(true);
    try {
      const api = await authApi.register({
        username: newUser.username,
        password: f.password,
        role: "sewa",
        profile: {
          nama: newUser.nama,
          email: newUser.email,
          noHp: newUser.noHp,
          alamat: newUser.alamat,
          wilayah: newUser.wilayah,
          jenisInstansi: newUser.jenisInstansi,
        },
      });
      newUser.apiId = api.id;
      save((d) => {
        d.users.push(newUser);
      });
      const stored =
        loadDb().users.find((item) => item.id === newUser.id) ?? newUser;
      logActivity(stored.id, "sewa", "register");
      setSession(stored);
      toast({
        title: "Akun siap dipakai",
        description: "Akun dan pesanan Anda akan tersinkron ke server.",
      });
      navigate("/konsumen");
    } catch (err) {
      toast({
        title: "Pendaftaran gagal",
        description:
          err instanceof Error ? err.message : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <BackButton to="/daftar" label="Kembali ke Pilihan Peran" />
          <HighContrastToggle />
        </div>
        {policyDialog}
        <h1 className="mt-3 font-serif text-3xl">Pendaftaran Konsumen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Akun untuk penggunaan sendiri: beli produk Pengrajin atau pesan SDM,
          perlengkapan, kostum, dan tempat latihan dari Sanggar.
        </p>
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-8">
            <Section title="Identitas Pemesan">
              <Field
                label="Nama Lengkap / Instansi"
                required
                value={f.nama}
                onChange={(v) => setF({ ...f, nama: v })}
              />
              <div className="space-y-1.5">
                <Label>
                  Jenis Instansi <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={f.jenisInstansi}
                  onValueChange={(v) =>
                    setF({ ...f, jenisInstansi: v as JenisInstansiSewa })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_INSTANSI.map((j) => (
                      <SelectItem key={j} value={j}>
                        {j}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {JENIS_INSTANSI_DESC[f.jenisInstansi]}
                </p>
              </div>
            </Section>

            <Section title="Alamat (Seluruh Indonesia)">
              <RegionSelector
                mode="all-id"
                value={f.wilayah}
                onChange={(w) => setF((prev) => ({ ...prev, wilayah: w }))}
                required
                pendingWilayah={pendingWilayah}
                onPendingWilayahConsumed={() => setPendingWilayah(undefined)}
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Alamat Detail (Jalan, RT/RW, No.){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  required
                  rows={2}
                  value={f.alamatDetail}
                  onChange={(e) => setF({ ...f, alamatDetail: e.target.value })}
                  placeholder="Jl. Sudirman No. 21"
                />
                <ShareLocation
                  lat={0}
                  lng={0}
                  onChange={() => {}}
                  onAddressResolved={(wilayah, alamatDetail) => {
                    setPendingWilayah(wilayah);
                    if (alamatDetail) {
                      setF((previous) => ({
                        ...previous,
                        alamatDetail,
                      }));
                    }
                  }}
                  mode="address"
                />
              </div>
            </Section>

            <Section title="Akun & Kontak">
              <Field
                label="Username"
                required
                value={f.username}
                onChange={(v) => setF({ ...f, username: v })}
              />
              <Field
                label="Email"
                type="email"
                value={f.email}
                onChange={(v) => setF({ ...f, email: v })}
              />
              <PasswordFields
                password={f.password}
                confirmation={f.konfirmasiPassword}
                onPasswordChange={(password) => setF({ ...f, password })}
                onConfirmationChange={(konfirmasiPassword) =>
                  setF({ ...f, konfirmasiPassword })
                }
              />
              <Field
                label="No. HP / WhatsApp"
                value={f.noHp}
                onChange={(v) => setF({ ...f, noHp: v })}
              />
            </Section>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <BackButton to="/daftar" />
              <Button type="submit" disabled={busy}>
                {busy ? "Mendaftar…" : "Daftar"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function RegisterPengrajin() {
  const db = useDb();
  const { setSession } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { confirmPolicy, policyDialog } = useAccountPolicyConfirmation();
  const [pendingWilayah, setPendingWilayah] = useState<AlamatWilayah>();
  const [busy, setBusy] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<
    Partial<Record<JenisDokumenPengrajin, File>>
  >({});
  const [f, setF] = useState({
    namaUsaha: "",
    namaPemilik: "",
    jenisKerajinan: "Batik Betawi" as JenisKerajinan,
    produkUnggulan: "",
    hargaProduk: 0,
    satuanProduk: "buah" as SatuanProdukKerajinan,
    stokProduk: 0,
    deskripsi: "",
    statusAktaNotaris: "Tidak Berakta Notaris" as StatusAktaNotaris,
    bentukUsaha: "Perorangan" as BentukUsahaPengrajin,
    namaBadanUsaha: "",
    npwp: "",
    nib: "",
    bank: "BCA" as Bank,
    nomorRekening: "",
    atasNamaRekening: "",
    tokoDipublikasikan: true,
    menerimaSewaJasa: false,
    menerimaKerjasama: true,
    username: "",
    email: "",
    password: "",
    konfirmasiPassword: "",
    noHp: "",
    alamatDetail: "",
    wilayah: EMPTY_WILAYAH,
    lat: 0,
    lng: 0,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (
      !f.namaUsaha.trim() ||
      !f.namaPemilik.trim() ||
      !f.produkUnggulan.trim() ||
      !f.username.trim() ||
      !f.email.trim() ||
      !f.npwp.trim() ||
      !f.nib.trim() ||
      !f.nomorRekening.trim() ||
      !f.atasNamaRekening.trim() ||
      f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH
    ) {
      toast({
        title: "Lengkapi data wajib",
        description: `Identitas usaha, NPWP, NIB, rekening, email, username, dan sandi (≥${MIN_ACCOUNT_PASSWORD_LENGTH} karakter) wajib diisi.`,
        variant: "destructive",
      });
      return;
    }
    if (f.password !== f.konfirmasiPassword) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Ketik ulang password yang sama pada kedua kolom.",
        variant: "destructive",
      });
      return;
    }
    if (!f.namaBadanUsaha.trim()) {
      toast({
        title: "Lengkapi nama badan hukum, usaha, atau organisasi",
        description:
          "Nama badan hukum, usaha, atau organisasi wajib diisi sesuai jenis yang dipilih.",
        variant: "destructive",
      });
      return;
    }
    if (!isWilayahLengkap(f.wilayah) || !f.alamatDetail.trim()) {
      toast({
        title: "Lengkapi alamat usaha",
        description: "Pilih wilayah DKI Jakarta dan isi alamat detail.",
        variant: "destructive",
      });
      return;
    }
    if (!f.lat || !f.lng) {
      toast({
        title: "Bagikan lokasi usaha",
        description:
          "Koordinat GPS wajib agar usaha dapat tampil tepat di peta.",
        variant: "destructive",
      });
      return;
    }
    if (f.lat < -6.5 || f.lat > -5.3 || f.lng < 106.5 || f.lng > 107.2) {
      toast({
        title: "Lokasi di luar wilayah Jakarta",
        description:
          "Pendaftaran peta Pengrajin saat ini khusus wilayah DKI Jakarta.",
        variant: "destructive",
      });
      return;
    }
    if (
      db.users.some(
        (user) => user.username.toLowerCase() === f.username.toLowerCase(),
      )
    ) {
      toast({ title: "Username sudah digunakan", variant: "destructive" });
      return;
    }

    const alamat = formatAlamatWilayah(f.wilayah, f.alamatDetail);
    const newUser: PengrajinUser = {
      id: uid(),
      role: "pengrajin",
      username: f.username.trim(),
      password: API_PASSWORD_PLACEHOLDER,
      email: f.email.trim(),
      noHp: f.noHp.trim() || undefined,
      namaUsaha: f.namaUsaha.trim(),
      namaPemilik: f.namaPemilik.trim(),
      statusAktaNotaris: f.statusAktaNotaris,
      bentukUsaha: f.bentukUsaha,
      namaBadanUsaha: f.namaBadanUsaha.trim() || undefined,
      jenisKerajinan: f.jenisKerajinan,
      produkUnggulan: f.produkUnggulan.trim(),
      produk: [
        {
          id: uid(),
          nama: f.produkUnggulan.trim(),
          kategori: f.jenisKerajinan,
          deskripsi: f.deskripsi.trim() || f.produkUnggulan.trim(),
          harga: Math.max(0, f.hargaProduk),
          satuan: f.satuanProduk,
          stok: f.stokProduk > 0 ? f.stokProduk : undefined,
          khasJakarta: true,
          statusPublish: true,
          tersediaSewaJasa: f.menerimaSewaJasa,
          terbukaKerjasama: f.menerimaKerjasama,
          ongkirTermasukHarga: false,
          createdAt: Date.now(),
        },
      ],
      deskripsi: f.deskripsi.trim() || undefined,
      alamat,
      wilayah: f.wilayah,
      lat: f.lat,
      lng: f.lng,
      npwp: f.npwp.trim(),
      nib: f.nib.trim(),
      statusPkp: "non_pkp",
      pemotongPajak: false,
      rekening: {
        bank: f.bank,
        nomor: f.nomorRekening.trim(),
        atasNama: f.atasNamaRekening.trim(),
      },
      dokumen: [],
      tokoDipublikasikan: f.tokoDipublikasikan,
      menerimaSewaJasa: f.menerimaSewaJasa,
      menerimaKerjasama: f.menerimaKerjasama,
      createdAt: Date.now(),
    };

    const profile = {
      namaUsaha: newUser.namaUsaha,
      namaPemilik: newUser.namaPemilik,
      statusAktaNotaris: newUser.statusAktaNotaris,
      bentukUsaha: newUser.bentukUsaha,
      namaBadanUsaha: newUser.namaBadanUsaha,
      jenisKerajinan: newUser.jenisKerajinan,
      produkUnggulan: newUser.produkUnggulan,
      produk: newUser.produk,
      deskripsi: newUser.deskripsi,
      email: newUser.email,
      noHp: newUser.noHp,
      alamat: newUser.alamat,
      wilayah: newUser.wilayah,
      lat: newUser.lat,
      lng: newUser.lng,
      npwp: newUser.npwp,
      nib: newUser.nib,
      statusPkp: newUser.statusPkp,
      pemotongPajak: newUser.pemotongPajak,
      rekening: newUser.rekening,
      dokumen: newUser.dokumen,
      tokoDipublikasikan: newUser.tokoDipublikasikan,
      menerimaSewaJasa: newUser.menerimaSewaJasa,
      menerimaKerjasama: newUser.menerimaKerjasama,
    };

    if (!(await confirmPolicy())) return;
    setBusy(true);
    try {
      const api = await authApi.register({
        username: newUser.username,
        password: f.password,
        role: "pengrajin",
        profile,
      });
      newUser.apiId = api.id;
      const uploadedDocuments: DokumenPengrajin[] = [];
      let failedUploads = 0;
      for (const jenis of DOKUMEN_PENGRAJIN) {
        const file = documentFiles[jenis];
        if (!file) continue;
        try {
          const uploaded = await uploadsApi.create(file);
          uploadedDocuments.push({
            id: uploaded.id,
            jenis,
            nama: file.name,
            url: uploaded.url,
            contentType: uploaded.contentType,
            size: uploaded.sizeBytes,
            uploadedAt: Date.now(),
          });
        } catch {
          failedUploads += 1;
        }
      }
      if (uploadedDocuments.length > 0) {
        try {
          await usersApi.update(api.id, {
            profile: { ...profile, dokumen: uploadedDocuments },
          });
          newUser.dokumen = uploadedDocuments;
        } catch {
          failedUploads += uploadedDocuments.length;
          newUser.dokumen = [];
        }
      }
      save((data) => data.users.push(newUser));
      const stored =
        loadDb().users.find((item) => item.id === newUser.id) ?? newUser;
      logActivity(stored.id, "pengrajin", "register", {
        mapPublished: true,
      });
      setSession(stored);
      toast({
        title:
          failedUploads > 0
            ? "Akun berhasil, sebagian dokumen belum terunggah"
            : "Pendaftaran berhasil",
        description:
          failedUploads > 0
            ? "Lengkapi dokumen yang gagal melalui Konsol Pengrajin."
            : "Toko, produk, dan lokasi tersambung ke publikasi Pengrajin.",
      });
      navigate("/pengrajin");
    } catch (error) {
      toast({
        title: "Pendaftaran gagal",
        description:
          error instanceof Error
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <BackButton to="/daftar" label="Kembali ke Pilihan Peran" />
          <HighContrastToggle />
        </div>
        {policyDialog}
        <h1 className="mt-3 font-serif text-3xl">Pendaftaran Pengrajin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Data usaha aktif akan tampil pada Peta Pengrajin Khas Jakarta setelah
          pendaftaran berhasil.
        </p>
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-8">
            <Section title="Identitas Usaha">
              <Field
                label="Nama Usaha"
                required
                value={f.namaUsaha}
                onChange={(value) => setF({ ...f, namaUsaha: value })}
              />
              <Field
                label="Nama Pemilik / Penanggung Jawab"
                required
                value={f.namaPemilik}
                onChange={(value) => setF({ ...f, namaPemilik: value })}
              />
              <div className="space-y-1.5">
                <Label>
                  Jenis Kerajinan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={f.jenisKerajinan}
                  onValueChange={(value) =>
                    setF({ ...f, jenisKerajinan: value as JenisKerajinan })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_KERAJINAN.map((jenis) => (
                      <SelectItem key={jenis} value={jenis}>
                        {jenis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Produk Unggulan"
                required
                value={f.produkUnggulan}
                onChange={(value) => setF({ ...f, produkUnggulan: value })}
              />
              <Field
                label="Harga Awal Produk / Jasa"
                type="number"
                value={String(f.hargaProduk || "")}
                onChange={(value) =>
                  setF({ ...f, hargaProduk: Number(value) || 0 })
                }
              />
              <div className="space-y-1.5">
                <Label>Satuan Harga</Label>
                <Select
                  value={f.satuanProduk}
                  onValueChange={(value) =>
                    setF({
                      ...f,
                      satuanProduk: value as SatuanProdukKerajinan,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["buah", "set", "paket", "hari", "acara"] as const).map(
                      (satuan) => (
                        <SelectItem key={satuan} value={satuan}>
                          per {satuan}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Stok Awal (opsional)"
                type="number"
                value={String(f.stokProduk || "")}
                onChange={(value) =>
                  setF({ ...f, stokProduk: Number(value) || 0 })
                }
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Deskripsi Usaha</Label>
                <Textarea
                  rows={3}
                  value={f.deskripsi}
                  onChange={(event) =>
                    setF({ ...f, deskripsi: event.target.value })
                  }
                  placeholder="Ceritakan produk, proses pembuatan, dan layanan usaha."
                />
              </div>
              <div className="space-y-3 rounded-lg border bg-muted/25 p-4 sm:col-span-2">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={f.tokoDipublikasikan}
                    onCheckedChange={(checked) =>
                      setF({ ...f, tokoDipublikasikan: checked === true })
                    }
                  />
                  <span>
                    <strong>Publikasikan toko di peta</strong>
                    <span className="block text-xs text-muted-foreground">
                      Nama toko, produk tayang, kontak, alamat, dan titik lokasi
                      dapat dilihat masyarakat.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={f.menerimaSewaJasa}
                    onCheckedChange={(checked) =>
                      setF({ ...f, menerimaSewaJasa: checked === true })
                    }
                  />
                  <span>
                    <strong>
                      Tampilkan di katalog layanan Konsumen dan Mitra
                    </strong>
                    <span className="block text-xs text-muted-foreground">
                      Cocok untuk dekorasi acara, paket produksi, workshop, atau
                      layanan kerajinan yang dapat dipesan.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={f.menerimaKerjasama}
                    onCheckedChange={(checked) =>
                      setF({ ...f, menerimaKerjasama: checked === true })
                    }
                  />
                  <span>
                    <strong>Tampilkan di modul Kerja Sama</strong>
                    <span className="block text-xs text-muted-foreground">
                      Membuka peluang kolaborasi produksi, pemasaran, acara, dan
                      kemitraan dengan sanggar.
                    </span>
                  </span>
                </label>
              </div>
            </Section>

            <Section title="Legalitas & Rekening Usaha">
              <div className="space-y-1.5">
                <Label>
                  Status Akta Notaris <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={f.statusAktaNotaris}
                  onValueChange={(value: StatusAktaNotaris) =>
                    setF({
                      ...f,
                      statusAktaNotaris: value,
                      bentukUsaha: getDefaultBentukUsaha(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_AKTA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Jenis Organisasi <span className="text-destructive">*</span>
                </Label>
                <Select
                  key={f.statusAktaNotaris}
                  value={f.bentukUsaha}
                  onValueChange={(value) =>
                    setF({
                      ...f,
                      bentukUsaha: value as BentukUsahaPengrajin,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getBentukUsahaOptions(f.statusAktaNotaris).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nama Badan Hukum / Usaha / Organisasi"
                required
                value={f.namaBadanUsaha}
                onChange={(value) => setF({ ...f, namaBadanUsaha: value })}
              />
              <Field
                label="NPWP"
                required
                value={f.npwp}
                onChange={(value) => setF({ ...f, npwp: value })}
              />
              <Field
                label="NIB"
                required
                value={f.nib}
                onChange={(value) => setF({ ...f, nib: value })}
              />
              <div className="space-y-1.5">
                <Label>Bank</Label>
                <Select
                  value={f.bank}
                  onValueChange={(value) => setF({ ...f, bank: value as Bank })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nomor Rekening"
                required
                value={f.nomorRekening}
                onChange={(value) => setF({ ...f, nomorRekening: value })}
              />
              <Field
                label="Rekening Atas Nama"
                required
                value={f.atasNamaRekening}
                onChange={(value) => setF({ ...f, atasNamaRekening: value })}
              />
            </Section>

            <Section title="Bukti Dokumen (PDF / Gambar, opsional saat daftar)">
              {DOKUMEN_PENGRAJIN.map((jenis) => (
                <div key={jenis} className="space-y-1.5">
                  <Label>{jenis}</Label>
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setDocumentFiles((previous) => ({
                        ...previous,
                        [jenis]: file,
                      }));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Dokumen bersifat privat dan hanya digunakan untuk verifikasi
                    profil.
                  </p>
                </div>
              ))}
            </Section>

            <Section title="Lokasi Usaha di DKI Jakarta">
              <RegionSelector
                mode="dki-only"
                value={f.wilayah}
                onChange={(wilayah) =>
                  setF((previous) => ({ ...previous, wilayah }))
                }
                required
                pendingWilayah={pendingWilayah}
                onPendingWilayahConsumed={() => setPendingWilayah(undefined)}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Alamat Detail <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  required
                  rows={2}
                  value={f.alamatDetail}
                  onChange={(event) =>
                    setF({ ...f, alamatDetail: event.target.value })
                  }
                  placeholder="Nama jalan, nomor, RT/RW, dan patokan lokasi"
                />
              </div>
              <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/25 p-4">
                <Label>
                  Titik Peta Usaha <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ambil GPS saat berada di lokasi usaha. Titik ini yang
                  dipublikasikan pada halaman depan.
                </p>
                <ShareLocation
                  lat={f.lat}
                  lng={f.lng}
                  onChange={(lat, lng) =>
                    setF((previous) => ({ ...previous, lat, lng }))
                  }
                  onAddressResolved={(wilayah, alamatDetail) => {
                    setPendingWilayah(wilayah);
                    if (alamatDetail) {
                      setF((previous) => ({
                        ...previous,
                        alamatDetail,
                      }));
                    }
                  }}
                  mode="gps"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Latitude (alternatif manual)
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min="-6.5"
                      max="-5.3"
                      value={f.lat || ""}
                      onChange={(event) =>
                        setF((previous) => ({
                          ...previous,
                          lat: Number(event.target.value) || 0,
                        }))
                      }
                      placeholder="-6.200000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Longitude (alternatif manual)
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min="106.5"
                      max="107.2"
                      value={f.lng || ""}
                      onChange={(event) =>
                        setF((previous) => ({
                          ...previous,
                          lng: Number(event.target.value) || 0,
                        }))
                      }
                      placeholder="106.816666"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Jika GPS tidak tersedia, salin koordinat titik usaha dari
                  Google Maps. Koordinat tetap harus berada di wilayah Jakarta.
                </p>
              </div>
            </Section>

            <Section title="Akun & Kontak">
              <Field
                label="Username"
                required
                value={f.username}
                onChange={(value) => setF({ ...f, username: value })}
              />
              <Field
                label="Email"
                type="email"
                required
                value={f.email}
                onChange={(value) => setF({ ...f, email: value })}
              />
              <PasswordFields
                password={f.password}
                confirmation={f.konfirmasiPassword}
                onPasswordChange={(password) => setF({ ...f, password })}
                onConfirmationChange={(konfirmasiPassword) =>
                  setF({ ...f, konfirmasiPassword })
                }
              />
              <Field
                label="No. HP / WhatsApp"
                value={f.noHp}
                onChange={(value) => setF({ ...f, noHp: value })}
              />
            </Section>

            <div className="flex justify-between gap-2 border-t pt-4">
              <BackButton to="/daftar" />
              <Button type="submit" disabled={busy}>
                {busy ? "Mendaftar…" : "Daftar dan Tampilkan di Peta"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function RegisterMitraPengrajin() {
  const db = useDb();
  const { setSession } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { confirmPolicy, policyDialog } = useAccountPolicyConfirmation();
  const [pendingWilayahToko, setPendingWilayahToko] = useState<AlamatWilayah>();
  const [documentFiles, setDocumentFiles] = useState<
    Partial<Record<JenisDokumenPengrajin, File>>
  >({});
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    namaUsaha: "",
    namaPenanggungJawab: "",
    statusAktaNotaris: "Tidak Berakta Notaris" as StatusAktaNotaris,
    bentukUsaha: "Perorangan" as BentukUsahaPengrajin,
    namaBadanUsaha: "",
    alamat: "",
    memilikiTokoOffline: false,
    namaTokoOffline: "",
    alamatDetailTokoOffline: "",
    wilayahTokoOffline: EMPTY_WILAYAH,
    latTokoOffline: 0,
    lngTokoOffline: 0,
    npwp: "",
    nib: "",
    tanggalTerbitNib: "",
    bank: "BCA" as Bank,
    nomorRekening: "",
    atasNamaRekening: "",
    marketplaceNama: "Tokopedia",
    marketplaceNamaToko: "",
    marketplaceUrl: "",
    username: "",
    email: "",
    password: "",
    konfirmasiPassword: "",
    noHp: "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (
      !f.namaUsaha.trim() ||
      !f.namaPenanggungJawab.trim() ||
      !f.alamat.trim() ||
      !f.namaTokoOffline.trim() ||
      !f.alamatDetailTokoOffline.trim() ||
      !f.npwp.trim() ||
      !f.nib.trim() ||
      !f.tanggalTerbitNib ||
      !f.nomorRekening.trim() ||
      !f.atasNamaRekening.trim() ||
      !f.username.trim() ||
      !f.email.trim() ||
      f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH
    ) {
      toast({
        title: "Lengkapi data wajib",
        description:
          "Identitas mitra, toko offline, legalitas, rekening, email, username, dan sandi wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    if (f.password !== f.konfirmasiPassword) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Ketik ulang password yang sama pada kedua kolom.",
        variant: "destructive",
      });
      return;
    }
    if (!isWilayahLengkap(f.wilayahTokoOffline)) {
      toast({
        title: "Lengkapi wilayah toko offline",
        description:
          "Pilih provinsi, kota, kecamatan, dan kelurahan toko di DKI Jakarta.",
        variant: "destructive",
      });
      return;
    }
    if (
      !f.latTokoOffline ||
      !f.lngTokoOffline ||
      f.latTokoOffline < -6.5 ||
      f.latTokoOffline > -5.3 ||
      f.lngTokoOffline < 106.5 ||
      f.lngTokoOffline > 107.2
    ) {
      toast({
        title: "Titik toko belum valid",
        description:
          "Ambil GPS atau isi koordinat toko offline yang berada di DKI Jakarta.",
        variant: "destructive",
      });
      return;
    }
    const tanggalPermohonan = todayInJakarta();
    if (
      f.tanggalTerbitNib > tanggalPermohonan ||
      f.tanggalTerbitNib < sixMonthsBefore(tanggalPermohonan)
    ) {
      toast({
        title: "Tanggal terbit NIB tidak memenuhi syarat",
        description:
          "NIB harus terbit dalam enam bulan terakhir dan tidak boleh bertanggal setelah hari pengajuan.",
        variant: "destructive",
      });
      return;
    }
    const missingDocument = DOKUMEN_VERIFIKASI_MITRA.find(
      (jenis) => !documentFiles[jenis],
    );
    if (missingDocument) {
      toast({
        title: "Dokumen verifikasi belum lengkap",
        description: `${missingDocument} wajib diunggah sebelum mengajukan akun Mitra.`,
        variant: "destructive",
      });
      return;
    }
    const invalidDocument = DOKUMEN_VERIFIKASI_MITRA.map(
      (jenis) => documentFiles[jenis],
    ).find(
      (file) =>
        file &&
        (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          file.type,
        ) ||
          file.size > 10 * 1024 * 1024),
    );
    if (invalidDocument) {
      toast({
        title: "Format dokumen tidak didukung",
        description:
          "Gunakan PDF, JPG, PNG, atau WebP dengan ukuran maksimal 10 MB per dokumen.",
        variant: "destructive",
      });
      return;
    }
    if (!f.memilikiTokoOffline) {
      toast({
        title: "Toko offline wajib dimiliki",
        description:
          "Pendaftaran Mitra hanya dapat dilanjutkan oleh usaha yang mempunyai toko offline.",
        variant: "destructive",
      });
      return;
    }
    if (!f.namaBadanUsaha.trim()) {
      toast({
        title: "Nama badan hukum, usaha, atau organisasi wajib diisi",
        variant: "destructive",
      });
      return;
    }
    if (
      db.users.some(
        (item) => item.username.toLowerCase() === f.username.toLowerCase(),
      )
    ) {
      toast({ title: "Username sudah digunakan", variant: "destructive" });
      return;
    }
    let marketplaceUrl = f.marketplaceUrl.trim();
    if (marketplaceUrl && !/^https?:\/\//i.test(marketplaceUrl)) {
      marketplaceUrl = `https://${marketplaceUrl}`;
    }
    const marketplace = marketplaceUrl
      ? [
          {
            id: uid(),
            nama: f.marketplaceNama.trim() || "Marketplace",
            namaToko: f.marketplaceNamaToko.trim() || f.namaUsaha.trim(),
            url: marketplaceUrl,
            aktif: true,
          },
        ]
      : [];
    const alamatTokoOffline = formatAlamatWilayah(
      f.wilayahTokoOffline,
      f.alamatDetailTokoOffline,
    );
    const profile = {
      namaUsaha: f.namaUsaha.trim(),
      namaPenanggungJawab: f.namaPenanggungJawab.trim(),
      statusAktaNotaris: f.statusAktaNotaris,
      bentukUsaha: f.bentukUsaha,
      namaBadanUsaha: f.namaBadanUsaha.trim() || undefined,
      alamat: f.alamat.trim(),
      memilikiTokoOffline: true,
      namaTokoOffline: f.namaTokoOffline.trim(),
      alamatTokoOffline,
      wilayahTokoOffline: f.wilayahTokoOffline,
      latTokoOffline: f.latTokoOffline,
      lngTokoOffline: f.lngTokoOffline,
      statusVerifikasiTokoOffline: "belum_lengkap" as const,
      npwp: f.npwp.trim(),
      nib: f.nib.trim(),
      tanggalTerbitNib: f.tanggalTerbitNib,
      statusPkp: "non_pkp" as const,
      pemotongPajak: false,
      rekening: {
        bank: f.bank,
        nomor: f.nomorRekening.trim(),
        atasNama: f.atasNamaRekening.trim(),
      },
      dokumen: [],
      marketplace,
      paketProduk: [],
      jabatanPenandatangan: "Penanggung Jawab",
      email: f.email.trim(),
      noHp: f.noHp.trim() || undefined,
    };
    if (!(await confirmPolicy())) return;
    setBusy(true);
    try {
      const api = await authApi.register({
        username: f.username.trim(),
        password: f.password,
        role: "mitra_pengrajin",
        profile,
      });
      const uploadedDocuments: DokumenPengrajin[] = [];
      let failedUploads = 0;
      for (const jenis of DOKUMEN_VERIFIKASI_MITRA) {
        const file = documentFiles[jenis];
        if (!file) continue;
        try {
          const uploaded = await uploadsApi.create(file);
          uploadedDocuments.push({
            id: uploaded.id,
            jenis,
            nama: file.name,
            url: uploaded.url,
            contentType: uploaded.contentType,
            size: uploaded.sizeBytes,
            uploadedAt: Date.now(),
          });
        } catch {
          failedUploads += 1;
        }
      }
      const verificationReady =
        failedUploads === 0 &&
        uploadedDocuments.length === DOKUMEN_VERIFIKASI_MITRA.length;
      const statusVerifikasiTokoOffline = verificationReady
        ? ("menunggu_verifikasi" as const)
        : ("belum_lengkap" as const);
      let verificationProfileSaved = false;
      try {
        await usersApi.update(api.id, {
          profile: {
            dokumen: uploadedDocuments,
            statusVerifikasiTokoOffline,
          },
        });
        verificationProfileSaved = true;
      } catch {
        failedUploads += uploadedDocuments.length || 1;
      }
      const newUser: MitraPengrajinUser = {
        id: uid(),
        apiId: api.id,
        role: "mitra_pengrajin",
        username: f.username.trim(),
        password: API_PASSWORD_PLACEHOLDER,
        ...profile,
        dokumen: verificationProfileSaved ? uploadedDocuments : [],
        statusVerifikasiTokoOffline: verificationProfileSaved
          ? statusVerifikasiTokoOffline
          : "belum_lengkap",
        createdAt: Date.now(),
      };
      save((data) => data.users.push(newUser));
      setSession(newUser);
      logActivity(newUser.id, "mitra_pengrajin", "register", {
        marketplaceCount: marketplace.length,
        memilikiTokoOffline: true,
      });
      toast({
        title:
          failedUploads > 0
            ? "Akun dibuat, dokumen perlu diunggah ulang"
            : "Pengajuan Mitra berhasil dikirim",
        description:
          failedUploads > 0
            ? "Buka Profil & Marketplace untuk melengkapi dokumen dan mengajukan verifikasi kembali."
            : "Toko offline menunggu pemeriksaan Kurator dan belum tampil di peta publik.",
      });
      navigate("/mitra/profil");
    } catch (error) {
      toast({
        title: "Pendaftaran gagal",
        description:
          error instanceof Error
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {policyDialog}
        <BackButton to="/daftar" label="Kembali ke Pilihan Peran" />
        <h1 className="mt-3 font-serif text-3xl">Pendaftaran Mitra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mitra dapat memesan beberapa macam barang dari satu Pengrajin dalam
          satu transaksi, satu pengiriman, kontrak, invoice, dan BAST, lalu
          menjualnya di marketplace milik mitra. Kepemilikan toko offline
          merupakan syarat wajib pendaftaran.
        </p>
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-8">
            <Section title="Toko Offline (Syarat Wajib)">
              <Field
                label="Nama Toko Offline"
                required
                value={f.namaTokoOffline}
                onChange={(namaTokoOffline) => setF({ ...f, namaTokoOffline })}
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Wilayah Toko Offline{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <RegionSelector
                  mode="dki-only"
                  value={f.wilayahTokoOffline}
                  onChange={(wilayahTokoOffline) =>
                    setF((previous) => ({
                      ...previous,
                      wilayahTokoOffline,
                    }))
                  }
                  required
                  pendingWilayah={pendingWilayahToko}
                  onPendingWilayahConsumed={() =>
                    setPendingWilayahToko(undefined)
                  }
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Alamat Detail Toko Offline{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  required
                  value={f.alamatDetailTokoOffline}
                  onChange={(event) =>
                    setF({
                      ...f,
                      alamatDetailTokoOffline: event.target.value,
                    })
                  }
                  placeholder="Nama jalan, nomor, RT/RW, dan patokan lokasi"
                />
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/25 p-4 sm:col-span-2">
                <Label>
                  Titik Toko pada Peta{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ambil GPS saat berada di toko. Titik baru dipublikasikan
                  setelah dokumen disetujui Kurator.
                </p>
                <ShareLocation
                  lat={f.latTokoOffline}
                  lng={f.lngTokoOffline}
                  onChange={(latTokoOffline, lngTokoOffline) =>
                    setF((previous) => ({
                      ...previous,
                      latTokoOffline,
                      lngTokoOffline,
                    }))
                  }
                  onAddressResolved={(wilayah, alamatDetail) => {
                    setPendingWilayahToko(wilayah);
                    if (alamatDetail) {
                      setF((previous) => ({
                        ...previous,
                        alamatDetailTokoOffline: alamatDetail,
                      }));
                    }
                  }}
                  mode="gps"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field
                    label="Latitude (manual)"
                    type="number"
                    step="any"
                    min="-6.5"
                    max="-5.3"
                    value={String(f.latTokoOffline || "")}
                    onChange={(value) =>
                      setF({ ...f, latTokoOffline: Number(value) || 0 })
                    }
                  />
                  <Field
                    label="Longitude (manual)"
                    type="number"
                    step="any"
                    min="106.5"
                    max="107.2"
                    value={String(f.lngTokoOffline || "")}
                    onChange={(value) =>
                      setF({ ...f, lngTokoOffline: Number(value) || 0 })
                    }
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:col-span-2">
                <Checkbox
                  checked={f.memilikiTokoOffline}
                  onCheckedChange={(value) =>
                    setF({ ...f, memilikiTokoOffline: Boolean(value) })
                  }
                />
                <span>
                  Saya menyatakan usaha ini memiliki toko offline yang aktif dan
                  dapat dikunjungi pada alamat di atas.
                </span>
              </label>
            </Section>
            <Section title="Identitas & Legalitas Mitra">
              <Field
                label="Nama Usaha Mitra"
                required
                value={f.namaUsaha}
                onChange={(namaUsaha) => setF({ ...f, namaUsaha })}
              />
              <Field
                label="Nama Penanggung Jawab"
                required
                value={f.namaPenanggungJawab}
                onChange={(namaPenanggungJawab) =>
                  setF({ ...f, namaPenanggungJawab })
                }
              />
              <div className="space-y-1.5">
                <Label>
                  Status Akta Notaris <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={f.statusAktaNotaris}
                  onValueChange={(value: StatusAktaNotaris) =>
                    setF({
                      ...f,
                      statusAktaNotaris: value,
                      bentukUsaha: getDefaultBentukUsaha(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_AKTA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Jenis Organisasi <span className="text-destructive">*</span>
                </Label>
                <Select
                  key={f.statusAktaNotaris}
                  value={f.bentukUsaha}
                  onValueChange={(value) =>
                    setF({ ...f, bentukUsaha: value as BentukUsahaPengrajin })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getBentukUsahaOptions(f.statusAktaNotaris).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nama Badan Hukum / Usaha / Organisasi"
                required
                value={f.namaBadanUsaha}
                onChange={(namaBadanUsaha) => setF({ ...f, namaBadanUsaha })}
              />
              <Field
                label="NPWP"
                required
                value={f.npwp}
                onChange={(npwp) => setF({ ...f, npwp })}
              />
              <Field
                label="NIB"
                required
                value={f.nib}
                onChange={(nib) => setF({ ...f, nib })}
              />
              <Field
                label="Tanggal Terbit NIB (maksimal 6 bulan)"
                type="date"
                required
                min={sixMonthsBefore(todayInJakarta())}
                max={todayInJakarta()}
                value={f.tanggalTerbitNib}
                onChange={(tanggalTerbitNib) =>
                  setF({ ...f, tanggalTerbitNib })
                }
              />
              <div className="sm:col-span-2 space-y-1.5">
                <Label>
                  Alamat Usaha <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={f.alamat}
                  onChange={(event) =>
                    setF({ ...f, alamat: event.target.value })
                  }
                  required
                />
              </div>
            </Section>
            <Section title="Dokumen Verifikasi Toko Offline (Wajib)">
              {DOKUMEN_VERIFIKASI_MITRA.map((jenis) => (
                <div key={jenis} className="space-y-1.5 sm:col-span-2">
                  <Label>
                    {jenis} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="file"
                    required
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setDocumentFiles((previous) => ({
                        ...previous,
                        [jenis]: file,
                      }));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {jenis === "Surat Domisili 5 Tahun RT/RW"
                      ? "Surat RT dan RW harus menerangkan usaha telah berdomisili lebih dari 5 tahun."
                      : jenis === "Surat Domisili Kelurahan JAKEVO/PTSP"
                        ? "Unggah surat keterangan domisili dari kelurahan yang diproses melalui JAKEVO atau PTSP setempat."
                        : "Unggah dokumen NIB yang sesuai dengan nomor dan tanggal terbit di atas."}
                  </p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Format PDF/JPG/PNG/WebP, maksimum 10 MB per dokumen. Dokumen
                bersifat privat dan hanya dapat diperiksa pemilik akun serta
                Kurator.
              </p>
            </Section>
            <Section title="Rekening Mitra">
              <div className="space-y-1.5">
                <Label>Bank</Label>
                <Select
                  value={f.bank}
                  onValueChange={(value) => setF({ ...f, bank: value as Bank })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Nomor Rekening"
                required
                value={f.nomorRekening}
                onChange={(nomorRekening) => setF({ ...f, nomorRekening })}
              />
              <Field
                label="Atas Nama"
                required
                value={f.atasNamaRekening}
                onChange={(atasNamaRekening) =>
                  setF({ ...f, atasNamaRekening })
                }
              />
            </Section>
            <Section title="Marketplace Pertama (dapat ditambah lagi)">
              <Field
                label="Nama Marketplace"
                value={f.marketplaceNama}
                onChange={(marketplaceNama) => setF({ ...f, marketplaceNama })}
              />
              <Field
                label="Nama Toko"
                value={f.marketplaceNamaToko}
                onChange={(marketplaceNamaToko) =>
                  setF({ ...f, marketplaceNamaToko })
                }
              />
              <div className="sm:col-span-2">
                <Field
                  label="Tautan Toko Marketplace"
                  value={f.marketplaceUrl}
                  onChange={(marketplaceUrl) => setF({ ...f, marketplaceUrl })}
                />
              </div>
            </Section>
            <Section title="Akun & Kontak">
              <Field
                label="Username"
                required
                value={f.username}
                onChange={(username) => setF({ ...f, username })}
              />
              <Field
                label="Email"
                type="email"
                required
                value={f.email}
                onChange={(email) => setF({ ...f, email })}
              />
              <PasswordFields
                password={f.password}
                confirmation={f.konfirmasiPassword}
                onPasswordChange={(password) => setF({ ...f, password })}
                onConfirmationChange={(konfirmasiPassword) =>
                  setF({ ...f, konfirmasiPassword })
                }
              />
              <Field
                label="No. HP / WhatsApp"
                value={f.noHp}
                onChange={(noHp) => setF({ ...f, noHp })}
              />
            </Section>
            <div className="flex justify-between gap-2 border-t pt-4">
              <BackButton to="/daftar" />
              <Button type="submit" disabled={busy}>
                {busy ? "Mendaftar…" : "Daftar sebagai Mitra"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function PasswordFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
}: {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
}) {
  const doesNotMatch = confirmation.length > 0 && password !== confirmation;

  return (
    <>
      <div className="space-y-1.5">
        <Label>
          Password (minimal {MIN_ACCOUNT_PASSWORD_LENGTH} karakter){" "}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
          minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label>
          Konfirmasi Password <span className="text-destructive">*</span>
        </Label>
        <Input
          type="password"
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.target.value)}
          required
          minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
          autoComplete="new-password"
          aria-invalid={doesNotMatch}
        />
        {doesNotMatch && (
          <p className="text-xs text-destructive">Password belum cocok.</p>
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={step}
        min={min}
        max={max}
      />
    </div>
  );
}
