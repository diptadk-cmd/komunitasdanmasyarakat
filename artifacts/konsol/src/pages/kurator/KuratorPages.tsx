import { useEffect, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import {
  API_PASSWORD_PLACEHOLDER,
  save,
  uid,
  fmtDate,
  logActivity,
  persistSetting,
  persistAppearance,
} from "@/lib/store";
import { usersApi, ApiError, MIN_ACCOUNT_PASSWORD_LENGTH } from "@/lib/api";
import { createKurasiAssignment } from "@/lib/kurasi-sync";
import { mainAppRolePath, mainAppUrl } from "@/lib/app-links";
import {
  gantiIndikatorHasilInjek,
  parseKurasiXlsx,
} from "@/lib/kurasi-matrix-import";
import {
  buildKurasiTemplateXlsx,
  KURASI_TEMPLATE_MIME,
  namaFileTemplateKurasi,
} from "@/lib/kurasi-template-xlsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type {
  AdminUser,
  JuriUser,
  SanggarUser,
  PelatihUser,
  SenimanUser,
  PengrajinUser,
  MitraPengrajinUser,
  Indikator,
  Pilar,
  Variabel,
  PatokanNilaiKurasi,
  PredikatBand,
  AdminPermissions,
  TradisiKategori,
  TradisiItem,
  ThemeMode,
  StudioSettings,
  AnyUser,
  Role,
  Bank,
  JenisKesenian,
  JenisKerajinan,
  Legalitas,
  TataNaskahSettings,
} from "@/lib/types";
import {
  DEFAULT_PATOKAN_NILAI,
  predikatBands,
  DEFAULT_PREDIKAT,
  normalisasiBobotVariabel,
  patokanNilaiKurasi,
  persyaratanBuktiDukungOf,
} from "@/lib/kurasi";
import {
  Trash2,
  Eye,
  FileDown,
  Plus,
  Palette,
  Clock,
  Shield,
  X,
  Crown,
  Users,
  GraduationCap,
  UserCog,
  Wallet,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  Type,
  Sparkles,
  ScrollText,
  Languages,
  Check,
  Wand2,
  LayoutTemplate,
  LogIn,
  Save,
  Paperclip,
  FileText,
} from "lucide-react";
import { useT, normalizeLang } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { BRAND_ICON_KEYS, getBrandIcon } from "@/lib/brandIcons";
import {
  DEFAULT_KATEGORI_COLOR,
  DEFAULT_TRADISI_POOL,
} from "@/components/system/TradisiLisanBetawi";
import { Textarea } from "@/components/ui/textarea";
export { default as KuratorHome } from "./KuratorHome";

type EditableRole = Exclude<Role, "kurator" | "sewa">;
const ROLE_LABEL: Record<Role, string> = {
  kurator: "Kurator",
  admin: "Admin",
  sanggar: "Sanggar",
  pelatih: "Pelatih",
  seniman: "Seniman",
  juri: "Juri",
  pengrajin: "Pengrajin",
  mitra_pengrajin: "Mitra",
  sewa: "Konsumen",
};
const BANK_OPTIONS: Bank[] = [
  "BCA",
  "Mandiri",
  "DKI",
  "BRI",
  "BNI",
  "BSI",
  "CIMB",
];
const JENIS_OPTIONS: JenisKesenian[] = [
  "Tari",
  "Musik",
  "Teater",
  "Rupa",
  "Sastra",
  "Silat",
];
const JENIS_KERAJINAN_OPTIONS: JenisKerajinan[] = [
  "Batik Betawi",
  "Ondel-ondel",
  "Miniatur",
  "Aksesori",
  "Kuliner Tradisional",
  "Alat Musik",
  "Kerajinan Lainnya",
];
const LEGALITAS_OPTIONS: Legalitas[] = [
  "Yayasan",
  "PT",
  "CV",
  "Non-Badan Hukum",
];

function getDisplayName(u: AnyUser): string {
  if (u.role === "sanggar") return (u as SanggarUser).namaSanggar;
  if (u.role === "pengrajin") return (u as PengrajinUser).namaUsaha;
  if (u.role === "mitra_pengrajin") return (u as MitraPengrajinUser).namaUsaha;
  if ("nama" in u && typeof (u as { nama?: unknown }).nama === "string") {
    return (u as { nama: string }).nama;
  }
  return u.username;
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AnyUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const { demoMode } = useAuth();
  const [draft, setDraft] = useState<AnyUser>(user);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(user);
      setNewPassword("");
    }
  }, [open, user]);

  const upd = <K extends keyof AnyUser>(key: K, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }) as AnyUser);
  };
  const updRekening = (
    patch: Partial<{ bank: Bank; nomor: string; atasNama: string }>,
  ) => {
    setDraft((d) => {
      const base = ("rekening" in d
        ? (d as { rekening?: { bank: Bank; nomor: string; atasNama: string } })
            .rekening
        : null) ?? { bank: "BCA" as Bank, nomor: "", atasNama: "" };
      return { ...d, rekening: { ...base, ...patch } } as AnyUser;
    });
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const apiId =
        draft.apiId ??
        (draft.id.startsWith("u_api_")
          ? draft.id.slice("u_api_".length)
          : null);
      if (!demoMode && !apiId)
        throw new Error("Akun belum terhubung ke server.");

      const profile = { ...draft } as Record<string, unknown>;
      for (const key of [
        "id",
        "apiId",
        "username",
        "password",
        "role",
        "createdAt",
      ]) {
        delete profile[key];
      }
      if (!demoMode) {
        await usersApi.update(apiId!, {
          profile,
          ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
        });
      }
      save((db) => {
        db.users = db.users.map((user) =>
          user.id === draft.id
            ? demoMode
              ? ({
                  ...draft,
                  password: newPassword.trim() || draft.password,
                } as AnyUser)
              : ({
                  ...draft,
                  apiId: apiId!,
                  password: API_PASSWORD_PLACEHOLDER,
                } as AnyUser)
            : user,
        );
      });
      logActivity(draft.id, draft.role, "kurator-edit-profil", {
        byKurator: true,
      });
      toast({
        title: "Akun diperbarui",
        description: newPassword
          ? "Profil & kata sandi disimpan."
          : "Profil disimpan.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Akun belum diperbarui",
        description:
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const role = draft.role;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {ROLE_LABEL[role]} — {getDisplayName(draft)}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Username</Label>
            <Input
              value={draft.username}
              onChange={(e) => upd("username", e.target.value)}
              data-testid="input-edit-username"
              disabled={draft.id.startsWith("u_api_")}
            />
            {draft.id.startsWith("u_api_") && (
              <p className="text-xs text-muted-foreground mt-1">
                Username terkunci karena akun terhubung ke server (mencegah
                duplikasi identitas).
              </p>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={draft.email ?? ""}
              onChange={(e) => upd("email", e.target.value)}
              data-testid="input-edit-email"
            />
          </div>
          <div>
            <Label>No HP</Label>
            <Input
              value={draft.noHp ?? ""}
              onChange={(e) => upd("noHp", e.target.value)}
              data-testid="input-edit-nohp"
            />
          </div>
          {role === "sanggar" && (
            <>
              <div>
                <Label>Nama Sanggar</Label>
                <Input
                  value={(draft as SanggarUser).namaSanggar}
                  onChange={(e) =>
                    upd("namaSanggar" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Nama Ketua</Label>
                <Input
                  value={(draft as SanggarUser).namaKetua}
                  onChange={(e) =>
                    upd("namaKetua" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Legalitas</Label>
                <Select
                  value={(draft as SanggarUser).legalitas}
                  onValueChange={(v) => upd("legalitas" as keyof AnyUser, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGALITAS_OPTIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Alamat</Label>
                <Textarea
                  value={(draft as SanggarUser).alamat}
                  onChange={(e) =>
                    upd("alamat" as keyof AnyUser, e.target.value)
                  }
                  rows={2}
                />
              </div>
              <div>
                <Label>Tahun Berdiri</Label>
                <Input
                  type="number"
                  value={(draft as SanggarUser).tahunBerdiri ?? ""}
                  onChange={(e) =>
                    upd(
                      "tahunBerdiri" as keyof AnyUser,
                      Number(e.target.value) || undefined,
                    )
                  }
                />
              </div>
              <div>
                <Label>NPWP</Label>
                <Input
                  value={(draft as SanggarUser).npwp ?? ""}
                  onChange={(e) => upd("npwp" as keyof AnyUser, e.target.value)}
                />
              </div>
            </>
          )}
          {(role === "pelatih" || role === "seniman") && (
            <>
              <div>
                <Label>Nama</Label>
                <Input
                  value={(draft as PelatihUser | SenimanUser).nama}
                  onChange={(e) => upd("nama" as keyof AnyUser, e.target.value)}
                />
              </div>
              <div>
                <Label>Usia</Label>
                <Input
                  type="number"
                  value={(draft as PelatihUser | SenimanUser).usia}
                  onChange={(e) =>
                    upd("usia" as keyof AnyUser, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <Label>Pendidikan</Label>
                <Input
                  value={(draft as PelatihUser | SenimanUser).pendidikan}
                  onChange={(e) =>
                    upd("pendidikan" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Jenis Kesenian</Label>
                <Select
                  value={(draft as PelatihUser | SenimanUser).jenisKesenian}
                  onValueChange={(v) =>
                    upd("jenisKesenian" as keyof AnyUser, v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_OPTIONS.map((j) => (
                      <SelectItem key={j} value={j}>
                        {j}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={(draft as PelatihUser | SenimanUser).status}
                  onValueChange={(v) => upd("status" as keyof AnyUser, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["pending", "aktif", "ditolak", "keluar"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Alamat</Label>
                <Textarea
                  value={(draft as PelatihUser | SenimanUser).alamat ?? ""}
                  onChange={(e) =>
                    upd("alamat" as keyof AnyUser, e.target.value)
                  }
                  rows={2}
                />
              </div>
              <div>
                <Label>NPWP</Label>
                <Input
                  value={(draft as PelatihUser | SenimanUser).npwp ?? ""}
                  onChange={(e) => upd("npwp" as keyof AnyUser, e.target.value)}
                />
              </div>
              {role === "pelatih" && (
                <div>
                  <Label>Honor / Sesi</Label>
                  <Input
                    type="number"
                    value={(draft as PelatihUser).honorPerSesi}
                    onChange={(e) =>
                      upd(
                        "honorPerSesi" as keyof AnyUser,
                        Number(e.target.value) || 0,
                      )
                    }
                  />
                </div>
              )}
              {role === "seniman" && (
                <div>
                  <Label>Profesi</Label>
                  <Input
                    value={(draft as SenimanUser).profesi ?? ""}
                    onChange={(e) =>
                      upd("profesi" as keyof AnyUser, e.target.value)
                    }
                  />
                </div>
              )}
            </>
          )}
          {role === "juri" && (
            <>
              <div>
                <Label>Nama</Label>
                <Input
                  value={(draft as JuriUser).nama}
                  onChange={(e) => upd("nama" as keyof AnyUser, e.target.value)}
                />
              </div>
              <div>
                <Label>Keahlian</Label>
                <Input
                  value={(draft as JuriUser).keahlian}
                  onChange={(e) =>
                    upd("keahlian" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Alamat</Label>
                <Textarea
                  value={(draft as JuriUser).alamat ?? ""}
                  onChange={(e) =>
                    upd("alamat" as keyof AnyUser, e.target.value)
                  }
                  rows={2}
                />
              </div>
            </>
          )}
          {role === "pengrajin" && (
            <>
              <div>
                <Label>Nama Usaha</Label>
                <Input
                  value={(draft as PengrajinUser).namaUsaha}
                  onChange={(e) =>
                    upd("namaUsaha" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Nama Pemilik</Label>
                <Input
                  value={(draft as PengrajinUser).namaPemilik}
                  onChange={(e) =>
                    upd("namaPemilik" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Jenis Kerajinan</Label>
                <Select
                  value={(draft as PengrajinUser).jenisKerajinan}
                  onValueChange={(value) =>
                    upd("jenisKerajinan" as keyof AnyUser, value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_KERAJINAN_OPTIONS.map((jenis) => (
                      <SelectItem key={jenis} value={jenis}>
                        {jenis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produk Unggulan</Label>
                <Input
                  value={(draft as PengrajinUser).produkUnggulan}
                  onChange={(e) =>
                    upd("produkUnggulan" as keyof AnyUser, e.target.value)
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Alamat</Label>
                <Textarea
                  value={(draft as PengrajinUser).alamat}
                  onChange={(e) =>
                    upd("alamat" as keyof AnyUser, e.target.value)
                  }
                  rows={2}
                />
              </div>
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={(draft as PengrajinUser).lat}
                  onChange={(e) =>
                    upd("lat" as keyof AnyUser, Number(e.target.value))
                  }
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={(draft as PengrajinUser).lng}
                  onChange={(e) =>
                    upd("lng" as keyof AnyUser, Number(e.target.value))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={(draft as PengrajinUser).deskripsi ?? ""}
                  onChange={(e) =>
                    upd("deskripsi" as keyof AnyUser, e.target.value)
                  }
                  rows={3}
                />
              </div>
            </>
          )}
          {role === "admin" && (
            <div className="md:col-span-2">
              <Label>Nama</Label>
              <Input
                value={(draft as AdminUser).nama}
                onChange={(e) => upd("nama" as keyof AnyUser, e.target.value)}
              />
            </div>
          )}
          {(role === "sanggar" ||
            role === "pelatih" ||
            role === "seniman" ||
            role === "juri") && (
            <>
              <div className="md:col-span-2 mt-2 pt-3 border-t">
                <div className="text-sm font-semibold mb-2">Rekening Bank</div>
              </div>
              <div>
                <Label>Bank</Label>
                <Select
                  value={
                    ("rekening" in draft
                      ? (draft as { rekening?: { bank: Bank } }).rekening?.bank
                      : undefined) ?? "BCA"
                  }
                  onValueChange={(v) => updRekening({ bank: v as Bank })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_OPTIONS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>No Rekening</Label>
                <Input
                  value={
                    ("rekening" in draft
                      ? (draft as { rekening?: { nomor: string } }).rekening
                          ?.nomor
                      : "") ?? ""
                  }
                  onChange={(e) => updRekening({ nomor: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Atas Nama</Label>
                <Input
                  value={
                    ("rekening" in draft
                      ? (draft as { rekening?: { atasNama: string } }).rekening
                          ?.atasNama
                      : "") ?? ""
                  }
                  onChange={(e) => updRekening({ atasNama: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="md:col-span-2 mt-2 pt-3 border-t">
            <Label>Reset Kata Sandi (kosongkan jika tidak diubah)</Label>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Sandi baru..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="input-edit-newpassword"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimal {MIN_ACCOUNT_PASSWORD_LENGTH} karakter. Jika akun
              terhubung server, sandi akan diubah di server.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              busy ||
              (newPassword.length > 0 &&
                newPassword.length < MIN_ACCOUNT_PASSWORD_LENGTH)
            }
            data-testid="button-save-edit-user"
          >
            {busy ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const { demoMode } = useAuth();
  const db = useDb();
  const [role, setRole] = useState<EditableRole>("sanggar");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [noHp, setNoHp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRole("sanggar");
      setUsername("");
      setPassword("");
      setNama("");
      setEmail("");
      setNoHp("");
    }
  }, [open]);

  const handleCreate = async () => {
    if (
      !username.trim() ||
      password.length < MIN_ACCOUNT_PASSWORD_LENGTH ||
      !nama.trim()
    ) {
      toast({
        title: "Lengkapi data",
        description: `Username, sandi (>=${MIN_ACCOUNT_PASSWORD_LENGTH} karakter), dan nama wajib diisi.`,
        variant: "destructive",
      });
      return;
    }
    if (
      db.users.some(
        (user) => user.username.toLowerCase() === username.trim().toLowerCase(),
      )
    ) {
      toast({
        title: "Username sudah digunakan",
        description: "Gunakan username lain untuk akun baru.",
        variant: "destructive",
      });
      return;
    }
    if (
      !window.confirm(
        "PERINGATAN KEBIJAKAN AKUN\n\nAkun dapat diblokir Kurator dan seluruh sesinya dicabut apabila terdapat pengaduan, aktivitas atau potensi mencurigakan, manipulasi data, upaya maupun tindakan penipuan, atau dugaan tindak kriminal lainnya sesuai ketentuan peraturan perundang-undangan yang berlaku.\n\nLanjutkan pembuatan akun?",
      )
    )
      return;
    setBusy(true);
    try {
      const sharedProfile = {
        email: email.trim() || undefined,
        noHp: noHp.trim() || undefined,
      };
      const profile =
        role === "sanggar"
          ? {
              ...sharedProfile,
              namaSanggar: nama.trim(),
              namaKetua: nama.trim(),
              legalitas: "Non-Badan Hukum",
              jenisKesenian: ["Tari"],
              alamat: "",
            }
          : role === "pelatih"
            ? {
                ...sharedProfile,
                nama: nama.trim(),
                usia: 0,
                pendidikan: "",
                jenisKesenian: "Tari",
                status: "aktif",
                honorPerSesi: 0,
              }
            : role === "seniman"
              ? {
                  ...sharedProfile,
                  nama: nama.trim(),
                  usia: 0,
                  pendidikan: "",
                  jenisKesenian: "Tari",
                  status: "aktif",
                }
              : role === "juri"
                ? { ...sharedProfile, nama: nama.trim(), keahlian: "" }
                : { ...sharedProfile, nama: nama.trim() };
      const created = demoMode
        ? null
        : await usersApi.create({
            username: username.trim(),
            password,
            role,
            status: "aktif",
            profile,
          });
      const baseId = created ? `u_api_${created.id}` : `u_demo_${uid()}`;
      save((db) => {
        const now = Date.now();
        const baseFields = {
          id: baseId,
          ...(created ? { apiId: created.id } : {}),
          username: username.trim(),
          password: created ? API_PASSWORD_PLACEHOLDER : password,
          email: email.trim() || undefined,
          noHp: noHp.trim() || undefined,
          createdAt: now,
        };
        let newUser: AnyUser;
        if (role === "sanggar") {
          newUser = {
            ...baseFields,
            role: "sanggar",
            namaSanggar: nama.trim(),
            namaKetua: nama.trim(),
            legalitas: "Non-Badan Hukum",
            jenisKesenian: ["Tari"],
            alamat: "",
            rekening: { bank: "BCA", nomor: "", atasNama: nama.trim() },
            saldo: 0,
            editCount: 0,
            editPeriodStart: now,
          } as SanggarUser;
        } else if (role === "pelatih") {
          newUser = {
            ...baseFields,
            role: "pelatih",
            nama: nama.trim(),
            usia: 0,
            pendidikan: "",
            jenisKesenian: "Tari",
            status: "aktif",
            rekening: { bank: "BCA", nomor: "", atasNama: nama.trim() },
            honorPerSesi: 0,
          } as PelatihUser;
        } else if (role === "seniman") {
          newUser = {
            ...baseFields,
            role: "seniman",
            nama: nama.trim(),
            usia: 0,
            pendidikan: "",
            jenisKesenian: "Tari",
            status: "aktif",
            rekening: { bank: "BCA", nomor: "", atasNama: nama.trim() },
          } as SenimanUser;
        } else if (role === "juri") {
          newUser = {
            ...baseFields,
            role: "juri",
            nama: nama.trim(),
            keahlian: "",
          } as JuriUser;
        } else {
          newUser = {
            ...baseFields,
            role: "admin",
            nama: nama.trim(),
            permissions: {
              kelolaBerita: true,
              kelolaBanner: true,
              kelolaSlider: true,
              kelolaJamPembinaan: true,
              kelolaInfoBudaya: true,
            },
          } as AdminUser;
        }
        db.users.push(newUser);
      });
      logActivity(baseId, role, "kurator-create-akun", {
        username: username.trim(),
      });
      toast({
        title: "Akun dibuat",
        description: `${ROLE_LABEL[role]} ${nama} berhasil dibuat.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Gagal buat akun",
        description:
          error instanceof ApiError
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Akun Baru</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Peran</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as EditableRole)}
            >
              <SelectTrigger data-testid="select-create-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sanggar">Sanggar</SelectItem>
                <SelectItem value="pelatih">Pelatih</SelectItem>
                <SelectItem value="seniman">Seniman</SelectItem>
                <SelectItem value="juri">Juri</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nama {role === "sanggar" ? "Sanggar" : "Lengkap"}</Label>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              data-testid="input-create-nama"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                data-testid="input-create-username"
              />
            </div>
            <div>
              <Label>Sandi Awal</Label>
              <Input
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-create-password"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email (opsional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>No HP (opsional)</Label>
              <Input value={noHp} onChange={(e) => setNoHp(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Batal
          </Button>
          <Button
            onClick={handleCreate}
            disabled={busy}
            data-testid="button-confirm-create-user"
          >
            {busy ? "Membuat..." : "Buat Akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const REQUIRED_MITRA_DOCUMENTS = [
  "NIB",
  "Surat Domisili 5 Tahun RT/RW",
  "Surat Domisili Kelurahan JAKEVO/PTSP",
] as const;

function sixMonthsBeforeMitra(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - 6;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function mitraApprovalError(mitra: MitraPengrajinUser): string | null {
  if (mitra.statusModerasiAkun === "diblokir")
    return "Akun sedang diblokir Kurator dan harus dibuka terlebih dahulu.";
  if (
    mitra.memilikiTokoOffline !== true ||
    !mitra.namaTokoOffline?.trim() ||
    !mitra.alamatTokoOffline?.trim()
  )
    return "Pernyataan, nama, atau alamat toko offline belum lengkap.";
  if (
    !mitra.wilayahTokoOffline?.provinsiId ||
    !mitra.wilayahTokoOffline.kotaId ||
    !mitra.wilayahTokoOffline.kecamatanId ||
    !mitra.wilayahTokoOffline.kelurahanId
  )
    return "Wilayah administrasi toko belum lengkap.";
  if (
    !mitra.latTokoOffline ||
    !mitra.lngTokoOffline ||
    mitra.latTokoOffline < -6.5 ||
    mitra.latTokoOffline > -5.3 ||
    mitra.lngTokoOffline < 106.5 ||
    mitra.lngTokoOffline > 107.2
  )
    return "Titik toko tidak valid atau berada di luar DKI Jakarta.";
  if (!mitra.tanggalPermohonanMitra || !mitra.tanggalTerbitNib)
    return "Tanggal permohonan atau tanggal terbit NIB belum tercatat.";
  if (
    mitra.tanggalTerbitNib > mitra.tanggalPermohonanMitra ||
    mitra.tanggalTerbitNib < sixMonthsBeforeMitra(mitra.tanggalPermohonanMitra)
  )
    return "Tanggal terbit NIB tidak berada dalam enam bulan sebelum permohonan.";
  const missing = REQUIRED_MITRA_DOCUMENTS.find(
    (jenis) => !mitra.dokumen?.some((document) => document.jenis === jenis),
  );
  return missing ? `${missing} belum diunggah.` : null;
}

function MitraVerificationDialog({
  mitra,
  open,
  onOpenChange,
}: {
  mitra: MitraPengrajinUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user: curator } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState(
    mitra.catatanVerifikasiTokoOffline ?? "",
  );
  const [busy, setBusy] = useState(false);
  const validationError = mitraApprovalError(mitra);

  const updateVerification = async (approved: boolean) => {
    if (approved && validationError) {
      toast({
        title: "Pengajuan belum dapat disetujui",
        description: validationError,
        variant: "destructive",
      });
      return;
    }
    if (!approved && !reason.trim()) {
      toast({
        title: "Isi alasan perbaikan",
        variant: "destructive",
      });
      return;
    }
    const now = Date.now();
    const patch = {
      statusVerifikasiTokoOffline: approved
        ? ("terverifikasi" as const)
        : ("ditolak" as const),
      catatanVerifikasiTokoOffline: approved ? "" : reason.trim(),
      diverifikasiTokoOfflineAt: now,
      diverifikasiTokoOfflineOleh: curator?.id ?? "kurator",
    };
    setBusy(true);
    try {
      if (mitra.apiId) {
        await usersApi.update(mitra.apiId, { profile: patch });
      }
      save((db) => {
        const target = db.users.find((item) => item.id === mitra.id);
        if (target?.role === "mitra_pengrajin") Object.assign(target, patch);
      });
      if (curator) {
        logActivity(
          curator.id,
          curator.role,
          approved
            ? "mitra-verification-approved"
            : "mitra-verification-rejected",
          { targetId: mitra.id, reason: approved ? undefined : reason.trim() },
        );
      }
      toast({
        title: approved
          ? "Akun Mitra diaktifkan"
          : "Pengajuan dikembalikan untuk diperbaiki",
        description: approved
          ? "Katalog, layanan, dan publikasi toko di peta kini terbuka."
          : "Akun tetap belum aktif dan hanya dapat membuka profil verifikasi.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Status verifikasi gagal disimpan",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verifikasi Toko Mitra — {mitra.namaUsaha}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Toko Offline</p>
              <p className="font-medium">{mitra.namaTokoOffline || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status Saat Ini</p>
              <Badge variant="outline">
                {mitra.statusVerifikasiTokoOffline ?? "belum_lengkap"}
              </Badge>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Alamat</p>
              <p>{mitra.alamatTokoOffline || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Koordinat</p>
              <p>
                {mitra.latTokoOffline ?? "-"}, {mitra.lngTokoOffline ?? "-"}
              </p>
              {mitra.latTokoOffline && mitra.lngTokoOffline ? (
                <a
                  href={`https://www.google.com/maps?q=${mitra.latTokoOffline},${mitra.lngTokoOffline}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Periksa lokasi di peta
                </a>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NIB</p>
              <p>{mitra.nib || "-"}</p>
              <p className="text-xs text-muted-foreground">
                Terbit {mitra.tanggalTerbitNib || "-"} · Permohonan{" "}
                {mitra.tanggalPermohonanMitra || "-"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dokumen Privat</Label>
            {REQUIRED_MITRA_DOCUMENTS.map((jenis) => {
              const document = mitra.dokumen?.find(
                (item) => item.jenis === jenis,
              );
              return (
                <div
                  key={jenis}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{jenis}</p>
                    <p className="text-xs text-muted-foreground">
                      {document?.nama ?? "Belum diunggah"}
                    </p>
                  </div>
                  {document?.url || document?.dataUrl ? (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={document.url ?? document.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Periksa
                      </a>
                    </Button>
                  ) : (
                    <Badge variant="destructive">Tidak ada</Badge>
                  )}
                </div>
              );
            })}
          </div>
          {validationError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              Belum memenuhi validasi sistem: {validationError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Catatan jika dikembalikan</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Jelaskan dokumen atau data yang harus diperbaiki."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void updateVerification(false)}
          >
            Kembalikan untuk Perbaikan
          </Button>
          <Button
            disabled={busy || Boolean(validationError)}
            onClick={() => void updateVerification(true)}
          >
            <Check className="mr-1 h-4 w-4" /> Setujui & Aktifkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountBlockDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AnyUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user: curator } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState<
    "pengaduan" | "mencurigakan" | "manipulasi_data" | "penipuan_kriminalitas"
  >(account.kategoriBlokirAkun ?? "pengaduan");
  const [reason, setReason] = useState(account.alasanBlokirAkun ?? "");
  const [busy, setBusy] = useState(false);
  const blocked = account.statusModerasiAkun === "diblokir";

  const submit = async () => {
    if (!blocked && !reason.trim()) {
      toast({
        title: "Alasan pemblokiran wajib diisi",
        variant: "destructive",
      });
      return;
    }
    const patch = blocked
      ? {
          statusModerasiAkun: "aktif" as const,
          kategoriBlokirAkun: undefined,
          alasanBlokirAkun: "",
          diblokirAt: undefined,
          diblokirOleh: undefined,
        }
      : {
          statusModerasiAkun: "diblokir" as const,
          kategoriBlokirAkun: category,
          alasanBlokirAkun: reason.trim(),
          diblokirAt: Date.now(),
          diblokirOleh: curator?.id ?? "kurator",
        };
    setBusy(true);
    try {
      if (account.apiId) {
        await usersApi.update(account.apiId, {
          status: blocked ? "aktif" : "diblokir",
          profile: {
            ...patch,
            // Nilai kosong eksplisit membersihkan jejak blokir lama di server.
            kategoriBlokirAkun: blocked ? "" : category,
            diblokirAt: blocked ? 0 : patch.diblokirAt,
            diblokirOleh: blocked ? "" : patch.diblokirOleh,
          },
        });
      }
      save((db) => {
        const target = db.users.find((item) => item.id === account.id);
        if (target) Object.assign(target, patch);
      });
      if (curator) {
        logActivity(
          curator.id,
          curator.role,
          blocked ? "account-unblocked" : "account-blocked",
          {
            targetId: account.id,
            category: blocked ? undefined : category,
            reason: blocked ? undefined : reason.trim(),
          },
        );
      }
      toast({
        title: blocked ? "Blokir akun dibuka" : "Akun berhasil diblokir",
        description: blocked
          ? "Pengguna dapat masuk kembali karena akun sudah aktif."
          : "Seluruh sesi akun telah dicabut dan layanan langsung dihentikan.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Status akun gagal diperbarui",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {blocked ? "Buka Blokir Akun" : "Blokir Akun"} —{" "}
            {getDisplayName(account)}
          </DialogTitle>
        </DialogHeader>
        {blocked ? (
          <div className="space-y-3 text-sm">
            <p>
              Akun sedang diblokir. Membuka blokir akan mengizinkan pengguna
              masuk kembali. Status keanggotaan tetap dikelola terpisah pada
              profil pengguna.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">Alasan sebelumnya</p>
              <p className="text-muted-foreground">
                {account.alasanBlokirAkun || "Tidak tercatat"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Dasar Pemblokiran</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(
                    value as
                      | "pengaduan"
                      | "mencurigakan"
                      | "manipulasi_data"
                      | "penipuan_kriminalitas",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pengaduan">Terdapat Pengaduan</SelectItem>
                  <SelectItem value="mencurigakan">
                    Aktivitas/Potensi Mencurigakan
                  </SelectItem>
                  <SelectItem value="manipulasi_data">
                    Dugaan Manipulasi Data
                  </SelectItem>
                  <SelectItem value="penipuan_kriminalitas">
                    Penipuan atau Tindak Kriminal
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Alasan dan Bukti Awal</Label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Tuliskan nomor pengaduan, temuan, atau indikasi manipulasi yang menjadi dasar tindakan."
              />
            </div>
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              Pemblokiran langsung mencabut seluruh sesi dan menghentikan akses
              layanan akun.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant={blocked ? "default" : "destructive"}
            disabled={busy}
            onClick={() => void submit()}
          >
            {blocked ? "Buka Blokir" : "Blokir & Cabut Sesi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KuratorAccounts() {
  const db = useDb();
  const { toast } = useToast();
  const { impersonate, user: curator } = useAuth();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Role>("sanggar");
  const [editing, setEditing] = useState<AnyUser | null>(null);
  const [verifying, setVerifying] = useState<MitraPengrajinUser | null>(null);
  const [blocking, setBlocking] = useState<AnyUser | null>(null);
  const [creating, setCreating] = useState(false);
  const verificationRequests = db.users
    .filter(
      (user): user is MitraPengrajinUser =>
        user.role === "mitra_pengrajin" &&
        user.statusModerasiAkun !== "diblokir" &&
        user.statusVerifikasiTokoOffline === "menunggu_verifikasi",
    )
    .sort(
      (a, b) =>
        (a.tanggalPermohonanMitra ?? "").localeCompare(
          b.tanggalPermohonanMitra ?? "",
        ) || a.createdAt - b.createdAt,
    );
  const items = db.users
    .filter((u) => u.role === filter)
    .filter((u) => {
      if (!q) return true;
      const name = getDisplayName(u).toLowerCase();
      return (
        name.includes(q.toLowerCase()) ||
        u.username.toLowerCase().includes(q.toLowerCase())
      );
    });
  const hapus = (id: string) => {
    if (!confirm("Hapus akun ini? Tindakan ini tidak bisa dibatalkan.")) return;
    save((d) => {
      d.users = d.users.filter((u) => u.id !== id);
    });
    toast({ title: "Akun dihapus" });
  };
  const handleLoginAs = async (target: AnyUser) => {
    if (await impersonate(target.id)) {
      toast({
        title: `Masuk sebagai ${getDisplayName(target)}`,
        description: `Peran: ${ROLE_LABEL[target.role]}. Pakai banner emas untuk kembali.`,
      });
      // Dasbor peran lain berada di aplikasi utama (bukan konsol) — pindah app.
      const targetUrl =
        target.role === "kurator"
          ? import.meta.env.BASE_URL
          : mainAppUrl(mainAppRolePath(target.role));
      const separator = targetUrl.includes("?") ? "&" : "?";
      // Nonce mencegah dokumen aplikasi utama versi lama dipulihkan dari
      // back-forward cache ketika berpindah dari Konsol ke dasbor target.
      window.location.href = `${targetUrl}${separator}login_as=${Date.now()}`;
    } else {
      toast({ title: "Gagal login-as", variant: "destructive" });
    }
  };
  return (
    <div>
      <PageHeader
        title="Pengelolaan Akun"
        subtitle="Kelola seluruh akun dan verifikasi dokumen toko offline Mitra sebelum akun serta layanannya diaktifkan."
      />
      <Card className="mb-5 border-primary/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl font-bold">
              Permintaan Verifikasi Terbaru
            </h2>
            <p className="text-xs text-muted-foreground">
              Diprioritaskan sebelum pengelolaan akun lainnya.
            </p>
          </div>
          <Badge>{verificationRequests.length} menunggu</Badge>
        </div>
        <div className="space-y-2">
          {verificationRequests.map((mitra) => (
            <div
              key={mitra.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
            >
              <div>
                <p className="font-medium">{mitra.namaUsaha}</p>
                <p className="text-xs text-muted-foreground">
                  {mitra.namaTokoOffline || "Toko belum diberi nama"} · diajukan{" "}
                  {mitra.tanggalPermohonanMitra || "-"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setVerifying(mitra)}
                className="gap-1"
              >
                <FileText className="h-3.5 w-3.5" /> Periksa Sekarang
              </Button>
            </div>
          ))}
          {verificationRequests.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              Tidak ada permintaan verifikasi yang sedang menunggu Kurator.
            </div>
          )}
        </div>
      </Card>
      <div className="mb-2">
        <h2 className="font-serif text-xl font-bold">Akun per Jenis</h2>
        <p className="text-xs text-muted-foreground">
          Setiap daftar dipisahkan berdasarkan peran akun.
        </p>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="Cari nama / username..."
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="input-search-akun"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as Role)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sanggar">Sanggar</SelectItem>
            <SelectItem value="pelatih">Pelatih</SelectItem>
            <SelectItem value="seniman">Seniman</SelectItem>
            <SelectItem value="juri">Juri</SelectItem>
            <SelectItem value="pengrajin">Pengrajin</SelectItem>
            <SelectItem value="mitra_pengrajin">Mitra</SelectItem>
            <SelectItem value="sewa">Konsumen</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="kurator">Kurator</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          onClick={() => setCreating(true)}
          className="gap-1"
          data-testid="button-tambah-akun"
        >
          <Plus className="h-4 w-4" />
          Tambah Akun
        </Button>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Daftar</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  Tidak ada akun yang cocok.
                </TableCell>
              </TableRow>
            )}
            {items.map((u) => (
              <TableRow key={u.id} data-testid={`row-akun-${u.id}`}>
                <TableCell className="font-medium">
                  {getDisplayName(u)}
                  {u.role === "mitra_pengrajin" && (
                    <div className="mt-1">
                      <Badge
                        variant={
                          u.statusVerifikasiTokoOffline === "terverifikasi"
                            ? "default"
                            : u.statusVerifikasiTokoOffline === "ditolak"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {u.statusVerifikasiTokoOffline === "terverifikasi"
                          ? "Aktif"
                          : "Belum aktif"}
                      </Badge>
                    </div>
                  )}
                  {u.statusModerasiAkun === "diblokir" && (
                    <div className="mt-1">
                      <Badge variant="destructive">Diblokir Kurator</Badge>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABEL[u.role]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {u.username}
                </TableCell>
                <TableCell className="text-sm">
                  {u.noHp ?? u.email ?? "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {fmtDate(u.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    {u.role === "mitra_pengrajin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => setVerifying(u)}
                      >
                        <FileText className="h-3.5 w-3.5" /> Verifikasi
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setEditing(u)}
                      data-testid={`button-edit-${u.id}`}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {u.role !== "kurator" && (
                      <Button
                        size="sm"
                        variant={
                          u.statusModerasiAkun === "diblokir"
                            ? "outline"
                            : "destructive"
                        }
                        className="gap-1"
                        onClick={() => setBlocking(u)}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {u.statusModerasiAkun === "diblokir"
                          ? "Buka Blokir"
                          : "Blokir"}
                      </Button>
                    )}
                    {u.id !== curator?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleLoginAs(u)}
                        data-testid={`button-loginas-${u.id}`}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Login As
                      </Button>
                    )}
                    {u.role !== "kurator" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => hapus(u.id)}
                        data-testid={`button-hapus-${u.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {editing && (
        <EditUserDialog
          user={editing}
          open={!!editing}
          onOpenChange={(v) => {
            if (!v) setEditing(null);
          }}
        />
      )}
      {verifying && (
        <MitraVerificationDialog
          mitra={verifying}
          open={Boolean(verifying)}
          onOpenChange={(open) => {
            if (!open) setVerifying(null);
          }}
        />
      )}
      {blocking && (
        <AccountBlockDialog
          account={blocking}
          open={Boolean(blocking)}
          onOpenChange={(open) => {
            if (!open) setBlocking(null);
          }}
        />
      )}
      <CreateUserDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function salinPatokan(
  items: PatokanNilaiKurasi[],
  perbaruiId = false,
): PatokanNilaiKurasi[] {
  return items.map((item) => ({
    ...item,
    id: perbaruiId ? uid() : item.id,
  }));
}

function patokanBawaanBaru(): PatokanNilaiKurasi[] {
  return salinPatokan(DEFAULT_PATOKAN_NILAI, true);
}

function angkaPatokanBaru(items: PatokanNilaiKurasi[]): number {
  const terpakai = new Set(items.map((item) => item.nilai));
  for (let nilai = 0; nilai <= 100; nilai += 1) {
    if (!terpakai.has(nilai)) return nilai;
  }
  return 100;
}

function bobotPatokanBaru(items: PatokanNilaiKurasi[]): number {
  const terpakai = new Set(items.map((item) => item.persentaseBobot));
  for (let bobot = 0; bobot <= 100; bobot += 1) {
    if (!terpakai.has(bobot)) return bobot;
  }
  return 100;
}

function PatokanNilaiEditor({
  judul,
  items,
  onChange,
}: {
  judul: string;
  items: PatokanNilaiKurasi[];
  onChange: (items: PatokanNilaiKurasi[]) => void;
}) {
  const setItem = (index: number, patch: Partial<PatokanNilaiKurasi>) =>
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : { ...item },
      ),
    );

  return (
    <div className="mt-1.5 space-y-1.5 rounded-md border border-primary/20 bg-primary/[0.03] p-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div>
          <div className="text-xs font-semibold text-foreground">{judul}</div>
          <div className="text-[9px] leading-snug text-muted-foreground">
            Angka dipilih Juri; bobot diperoleh dipakai dalam perhitungan.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={() => onChange(patokanBawaanBaru())}
        >
          <RotateCcw className="h-3 w-3" />
          Reset 0/5/10
        </Button>
      </div>

      {items.length === 0 && (
        <div className="rounded border border-dashed px-2 py-1.5 text-center text-[10px] text-muted-foreground">
          Belum ada patokan. Tambahkan minimal satu sebelum menyimpan matriks.
        </div>
      )}

      <div
        className="flex items-stretch gap-1.5 overflow-x-auto pb-0.5"
        data-testid="daftar-patokan-nilai"
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className="min-w-[225px] flex-1 rounded border bg-background/80 p-1.5"
            data-testid="patokan-nilai-item"
          >
            <div className="grid grid-cols-[48px_minmax(88px,1fr)_66px_26px] items-end gap-1.5">
              <div className="space-y-0.5">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Angka
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="h-7 px-1.5 text-xs"
                  value={item.nilai}
                  onChange={(event) =>
                    setItem(index, { nilai: Number(event.target.value) })
                  }
                  aria-label={`Angka ${item.nama}`}
                />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Nama
                </div>
                <Input
                  className="h-7 min-w-0 px-1.5 text-xs"
                  value={item.nama}
                  onChange={(event) =>
                    setItem(index, { nama: event.target.value })
                  }
                  placeholder="Sesuai"
                  aria-label={`Nama patokan ${item.nilai}`}
                />
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Bobot
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className="h-7 px-1.5 pr-5 text-xs"
                    value={item.persentaseBobot}
                    onChange={(event) =>
                      setItem(index, {
                        persentaseBobot: Number(event.target.value),
                      })
                    }
                    aria-label={`Bobot diperoleh ${item.nama}`}
                  />
                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() =>
                  onChange(items.filter((_, itemIndex) => itemIndex !== index))
                }
                aria-label={`Hapus patokan ${item.nama}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-[48px] min-w-[96px] shrink-0 flex-col gap-0.5 border-dashed px-2 text-[10px]"
          onClick={() =>
            onChange([
              ...items.map((item) => ({ ...item })),
              {
                id: uid(),
                nilai: angkaPatokanBaru(items),
                nama: "Patokan Baru",
                persentaseBobot: bobotPatokanBaru(items),
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah Patokan
        </Button>
      </div>
    </div>
  );
}

export function KuratorMatriks() {
  const db = useDb();
  const { toast } = useToast();
  const [m, setM] = useState<Indikator[]>(db.kurasiMatrix.indikator);
  const [membacaExcel, setMembacaExcel] = useState(false);
  const [mengunduhTemplate, setMengunduhTemplate] = useState(false);
  const [menyimpanMatriks, setMenyimpanMatriks] = useState(false);
  const [statusInjek, setStatusInjek] = useState<{
    status: "belum-disimpan" | "tersimpan";
    jenis: Indikator["tipe"] | "lengkap";
    namaFile: string;
    namaSheet?: string;
    jumlahBaris: number;
    jumlahPilar?: number;
  } | null>(null);
  const [bands, setBands] = useState<PredikatBand[]>(
    predikatBands(db.kurasiMatrix).map((b) => ({ ...b })),
  );
  const [patokanWarisan, setPatokanWarisan] = useState<PatokanNilaiKurasi[]>(
    patokanNilaiKurasi(db.kurasiMatrix).map((item) => ({ ...item })),
  );
  const totalBobot = m.reduce((s, i) => s + i.bobot, 0);
  const totalValid = (value: number, target = 100) =>
    Math.abs(value - target) < 0.001;
  const indikatorMemakaiBobotSumber = (indikator: Indikator) =>
    indikator.pilar.some((pilar) => pilar.bobotSumber !== undefined);
  const pilarMemakaiBobotSumber = (pilar: Pilar) =>
    pilar.bobotSumber !== undefined ||
    pilar.variabel.some((variabel) => variabel.bobotSumber !== undefined);
  const indikatorMemakaiBobotVariabelSumber = (indikator: Indikator) =>
    indikator.pilar.some((pilar) => pilarMemakaiBobotSumber(pilar));
  const bobotPilarRincian = (pilar: Pilar) => pilar.bobotSumber ?? pilar.bobot;
  const targetBobotPilar = (indikator: Indikator) =>
    indikatorMemakaiBobotSumber(indikator) ? indikator.bobot : 100;
  const totalBobotPilar = (indikator: Indikator) =>
    indikator.pilar.reduce(
      (total, pilar) => total + bobotPilarRincian(pilar),
      0,
    );
  const targetBobotRincian = (pilar: Pilar) =>
    pilar.bobotSumber ??
    (pilar.variabel.some((variabel) => variabel.bobotSumber !== undefined)
      ? pilar.bobot
      : 100);
  const bobotRincian = (
    _indikator: Indikator,
    pilar: Pilar,
    variabel: Variabel,
  ) =>
    variabel.bobotSumber ??
    (pilarMemakaiBobotSumber(pilar)
      ? Number(((variabel.bobot * targetBobotRincian(pilar)) / 100).toFixed(6))
      : variabel.bobot);
  const totalBobotRincian = (indikator: Indikator, pilar: Pilar) =>
    pilar.variabel.reduce(
      (total, variabel) => total + bobotRincian(indikator, pilar, variabel),
      0,
    );
  const normalisasiPilarBersumber = (indikator: Indikator): Pilar[] => {
    if (!indikatorMemakaiBobotSumber(indikator)) return indikator.pilar;
    const sumberTarget = indikator.bobot;
    return normalisasiBobotVariabel(
      indikator.pilar.map((pilar) => ({
        ...pilar,
        bobotSumber:
          pilar.bobotSumber ??
          Number(((pilar.bobot * sumberTarget) / 100).toFixed(6)),
      })),
    );
  };
  const normalisasiVariabelBersumber = (pilar: Pilar): Variabel[] => {
    if (!pilarMemakaiBobotSumber(pilar)) return pilar.variabel;
    const sumberTarget = targetBobotRincian(pilar);
    return normalisasiBobotVariabel(
      pilar.variabel.map((variabel) => ({
        ...variabel,
        bobotSumber:
          variabel.bobotSumber ??
          Number(((variabel.bobot * sumberTarget) / 100).toFixed(6)),
      })),
    );
  };
  const normalisasiMatriksBersumber = (indikator: Indikator[]): Indikator[] =>
    indikator.map((item) => {
      const pilar = normalisasiPilarBersumber(item).map((pilarItem) => ({
        ...pilarItem,
        variabel: normalisasiVariabelBersumber(pilarItem),
      }));
      return { ...item, pilar };
    });
  const tampilBobot = (value: number) =>
    Number.isInteger(value)
      ? String(value)
      : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

  const patokanVariabel = (variabel: Variabel): PatokanNilaiKurasi[] =>
    Array.isArray(variabel.patokanNilai)
      ? variabel.patokanNilai
      : patokanWarisan;

  const patokanPersyaratan = (
    variabel: Variabel,
    persyaratan: NonNullable<Variabel["persyaratanBuktiDukung"]>[number],
  ): PatokanNilaiKurasi[] =>
    Array.isArray(persyaratan.patokanNilai)
      ? persyaratan.patokanNilai
      : patokanVariabel(variabel);

  const validasiPatokan = (
    items: PatokanNilaiKurasi[],
    konteks: string,
  ): string | null => {
    if (items.length === 0)
      return `${konteks} harus memiliki minimal satu patokan penilaian`;
    for (const item of items) {
      if (!item.nama.trim())
        return `Nama patokan pada ${konteks} tidak boleh kosong`;
      if (!Number.isFinite(item.nilai) || item.nilai < 0 || item.nilai > 100)
        return `Angka patokan "${item.nama}" pada ${konteks} harus antara 0–100`;
      if (
        !Number.isFinite(item.persentaseBobot) ||
        item.persentaseBobot < 0 ||
        item.persentaseBobot > 100
      ) {
        return `Bobot patokan "${item.nama}" pada ${konteks} harus antara 0–100%`;
      }
    }
    if (new Set(items.map((item) => item.id)).size !== items.length)
      return `ID patokan pada ${konteks} harus berbeda`;
    if (new Set(items.map((item) => item.nilai)).size !== items.length)
      return `Angka patokan pada ${konteks} harus berbeda`;
    if (
      new Set(items.map((item) => item.persentaseBobot)).size !== items.length
    )
      return `Persentase bobot patokan pada ${konteks} harus berbeda`;
    return null;
  };

  const patokanSiapSimpan = (items: PatokanNilaiKurasi[]) =>
    items
      .map((item) => ({ ...item, nama: item.nama.trim() }))
      .sort((a, b) => a.nilai - b.nilai);

  const setBand = (i: number, patch: Partial<PredikatBand>) =>
    setBands((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    );

  const validatePredikat = (): string | null => {
    if (bands.length === 0)
      return "Tambahkan minimal satu predikat hasil akhir";
    for (const b of bands) {
      if (!b.nama.trim()) return "Nama predikat tidak boleh kosong";
      if (!Number.isFinite(b.min) || b.min < 0 || b.min > 100)
        return `Ambang predikat "${b.nama}" harus antara 0–100`;
    }
    if (!bands.some((b) => b.min === 0))
      return "Harus ada satu predikat dengan ambang 0 (predikat terendah)";
    const mins = bands.map((b) => b.min);
    if (new Set(mins).size !== mins.length)
      return "Ambang bawah tiap predikat harus berbeda";
    return null;
  };

  const simpanPredikat = async () => {
    const err = validatePredikat();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    const predikat = [...bands].sort((a, b) => a.min - b.min);
    const next = { ...db.kurasiMatrix, predikat, updatedAt: Date.now() };
    try {
      await persistSetting("kurasiMatrix", next);
      toast({ title: "Predikat hasil akhir disimpan" });
    } catch (error) {
      toast({
        title: "Predikat belum tersimpan",
        description:
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    }
  };

  // Helper update immutable per tingkat.
  const setInd = (i: number, patch: Partial<Indikator>) =>
    setM((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const setPilar = (i: number, pi: number, patch: Partial<Pilar>) =>
    setM((prev) =>
      prev.map((x, idx) =>
        idx === i
          ? {
              ...x,
              pilar: x.pilar.map((p, pidx) =>
                pidx === pi ? { ...p, ...patch } : p,
              ),
            }
          : x,
      ),
    );
  const setBobotPilarRincian = (i: number, pi: number, bobot: number) =>
    setM((prev) =>
      prev.map((indikator, indikatorIndex) => {
        if (indikatorIndex !== i) return indikator;
        if (!indikatorMemakaiBobotSumber(indikator)) {
          return {
            ...indikator,
            pilar: indikator.pilar.map((pilar, pilarIndex) =>
              pilarIndex === pi ? { ...pilar, bobot } : pilar,
            ),
          };
        }
        const sumberTarget = indikator.bobot;
        const pilarDenganSumber = indikator.pilar.map((pilar, pilarIndex) => ({
          ...pilar,
          bobotSumber:
            pilarIndex === pi
              ? bobot
              : (pilar.bobotSumber ??
                Number(((pilar.bobot * sumberTarget) / 100).toFixed(6))),
        }));
        return {
          ...indikator,
          pilar: normalisasiBobotVariabel(pilarDenganSumber),
        };
      }),
    );
  const setVar = (
    i: number,
    pi: number,
    vi: number,
    patch: Partial<Variabel>,
  ) =>
    setM((prev) =>
      prev.map((x, idx) =>
        idx === i
          ? {
              ...x,
              pilar: x.pilar.map((p, pidx) =>
                pidx === pi
                  ? {
                      ...p,
                      variabel: p.variabel.map((v, vidx) =>
                        vidx === vi ? { ...v, ...patch } : v,
                      ),
                    }
                  : p,
              ),
            }
          : x,
      ),
    );

  const setPersyaratanBukti = (
    i: number,
    pi: number,
    vi: number,
    persyaratanIndex: number,
    nama: string,
  ) => {
    const variabel = m[i]?.pilar[pi]?.variabel[vi];
    if (!variabel) return;
    const persyaratanBuktiDukung = persyaratanBuktiDukungOf(variabel).map(
      (item, index) =>
        index === persyaratanIndex ? { ...item, nama } : { ...item },
    );
    setVar(i, pi, vi, {
      persyaratanBuktiDukung,
      persyaratanDataDukung: undefined,
    });
  };

  const setPatokanPersyaratan = (
    i: number,
    pi: number,
    vi: number,
    persyaratanIndex: number,
    patokanNilai: PatokanNilaiKurasi[],
  ) => {
    const variabel = m[i]?.pilar[pi]?.variabel[vi];
    if (!variabel) return;
    setVar(i, pi, vi, {
      persyaratanBuktiDukung: persyaratanBuktiDukungOf(variabel).map(
        (item, index) =>
          index === persyaratanIndex
            ? { ...item, patokanNilai: salinPatokan(patokanNilai) }
            : { ...item },
      ),
      persyaratanDataDukung: undefined,
    });
  };

  const setPatokanVariabel = (
    i: number,
    pi: number,
    vi: number,
    patokanNilai: PatokanNilaiKurasi[],
  ) =>
    setVar(i, pi, vi, {
      patokanNilai: salinPatokan(patokanNilai),
    });

  const tambahPersyaratanBukti = (i: number, pi: number, vi: number) => {
    const variabel = m[i]?.pilar[pi]?.variabel[vi];
    if (!variabel) return;
    const persyaratanSaatIni = persyaratanBuktiDukungOf(variabel);
    const patokanSumber =
      persyaratanSaatIni.length > 0
        ? patokanPersyaratan(
            variabel,
            persyaratanSaatIni[persyaratanSaatIni.length - 1],
          )
        : patokanVariabel(variabel);
    setVar(i, pi, vi, {
      persyaratanBuktiDukung: [
        ...persyaratanSaatIni.map((item) => ({ ...item })),
        {
          id: uid(),
          nama: "Persyaratan bukti dukung baru",
          patokanNilai:
            patokanSumber.length > 0
              ? salinPatokan(patokanSumber, true)
              : patokanBawaanBaru(),
        },
      ],
      persyaratanDataDukung: undefined,
    });
  };

  const hapusPersyaratanBukti = (
    i: number,
    pi: number,
    vi: number,
    persyaratanIndex: number,
  ) => {
    const variabel = m[i]?.pilar[pi]?.variabel[vi];
    if (!variabel) return;
    const persyaratanSaatIni = persyaratanBuktiDukungOf(variabel);
    const dihapus = persyaratanSaatIni[persyaratanIndex];
    const tersisa = persyaratanSaatIni
      .filter((_, index) => index !== persyaratanIndex)
      .map((item) => ({ ...item }));
    const patokanFallback =
      tersisa.length === 0 && !Array.isArray(variabel.patokanNilai)
        ? salinPatokan(
            dihapus && patokanPersyaratan(variabel, dihapus).length > 0
              ? patokanPersyaratan(variabel, dihapus)
              : DEFAULT_PATOKAN_NILAI,
            true,
          )
        : variabel.patokanNilai;
    setVar(i, pi, vi, {
      persyaratanBuktiDukung: tersisa,
      ...(patokanFallback !== undefined
        ? { patokanNilai: patokanFallback }
        : {}),
      persyaratanDataDukung: undefined,
    });
  };

  const setBobotRincian = (i: number, pi: number, vi: number, bobot: number) =>
    setM((prev) =>
      prev.map((indikator, indikatorIndex) => {
        if (indikatorIndex !== i) return indikator;
        return {
          ...indikator,
          pilar: indikator.pilar.map((pilar, pilarIndex) => {
            if (pilarIndex !== pi) return pilar;
            if (!pilarMemakaiBobotSumber(pilar)) {
              return {
                ...pilar,
                variabel: pilar.variabel.map((variabel, variabelIndex) =>
                  variabelIndex === vi ? { ...variabel, bobot } : variabel,
                ),
              };
            }
            const sumberTarget = targetBobotRincian(pilar);
            const variabel = pilar.variabel.map((item, variabelIndex) => ({
              ...item,
              bobotSumber:
                variabelIndex === vi
                  ? bobot
                  : (item.bobotSumber ??
                    Number(((item.bobot * sumberTarget) / 100).toFixed(6))),
            }));
            return {
              ...pilar,
              variabel: normalisasiBobotVariabel(variabel),
            };
          }),
        };
      }),
    );

  const setVarContoh = (
    i: number,
    pi: number,
    vi: number,
    files: FileList | null,
  ) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Berkas terlalu besar",
        description: "Berkas contoh maksimal 2 MB.",
        variant: "destructive",
      });
      return;
    }
    const MAX_CONTOH_TOTAL = 8 * 1024 * 1024;
    const existing = m[i]?.pilar[pi]?.variabel[vi]?.contoh?.size ?? 0;
    const total = m
      .flatMap((ind) => ind.pilar.flatMap((p) => p.variabel))
      .reduce((a, v) => a + (v.contoh?.size ?? 0), 0);
    if (total - existing + file.size > MAX_CONTOH_TOTAL) {
      toast({
        title: "Kuota contoh penuh",
        description: `Total berkas contoh dibatasi 8 MB. ${file.name} tidak diunggah.`,
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setVar(i, pi, vi, {
        contoh: {
          name: file.name,
          dataUrl: reader.result as string,
          size: file.size,
        },
      });
    reader.readAsDataURL(file);
  };

  const simpan = async () => {
    if (m.length === 0) {
      toast({
        title: "Tambahkan minimal satu Indikator",
        variant: "destructive",
      });
      return;
    }
    const matriksTernormalisasi = normalisasiMatriksBersumber(m);
    if (!totalValid(totalBobot)) {
      toast({
        title: "Bobot Indikator harus total 100%",
        variant: "destructive",
      });
      return;
    }
    for (const ind of matriksTernormalisasi) {
      if (!ind.nama.trim()) {
        toast({
          title: "Nama Indikator tidak boleh kosong",
          variant: "destructive",
        });
        return;
      }
      if (!Number.isFinite(ind.bobot) || ind.bobot < 0) {
        toast({
          title: `Bobot Indikator "${ind.nama}" tidak valid`,
          variant: "destructive",
        });
        return;
      }
      if (ind.pilar.length === 0) {
        toast({
          title: `Indikator "${ind.nama}" harus punya minimal satu Pilar`,
          variant: "destructive",
        });
        return;
      }
      const totalPilar = totalBobotPilar(ind);
      const targetPilar = targetBobotPilar(ind);
      if (!totalValid(totalPilar, targetPilar)) {
        toast({
          title: `Bobot Pilar pada "${ind.nama}" harus total ${tampilBobot(targetPilar)}%`,
          variant: "destructive",
        });
        return;
      }
      for (const p of ind.pilar) {
        if (!p.nama.trim()) {
          toast({
            title: `Nama Pilar pada "${ind.nama}" tidak boleh kosong`,
            variant: "destructive",
          });
          return;
        }
        const bobotPilar = bobotPilarRincian(p);
        if (!Number.isFinite(bobotPilar) || bobotPilar < 0) {
          toast({
            title: `Bobot Pilar "${p.nama}" tidak valid`,
            variant: "destructive",
          });
          return;
        }
        if (p.variabel.length === 0) {
          toast({
            title: `Pilar "${p.nama}" harus punya minimal satu Variabel`,
            variant: "destructive",
          });
          return;
        }
        for (const variabel of p.variabel) {
          if (!variabel.nama.trim()) {
            toast({
              title: `Nama Variabel pada "${p.nama}" tidak boleh kosong`,
              variant: "destructive",
            });
            return;
          }
          const bobot = bobotRincian(ind, p, variabel);
          if (!Number.isFinite(bobot) || bobot < 0) {
            toast({
              title: `Bobot Variabel "${variabel.nama}" tidak valid`,
              variant: "destructive",
            });
            return;
          }
          const persyaratan = persyaratanBuktiDukungOf(variabel);
          if (persyaratan.some((item) => !item.nama.trim())) {
            toast({
              title: `Persyaratan bukti pada "${variabel.nama}" tidak boleh kosong`,
              variant: "destructive",
            });
            return;
          }
          if (
            new Set(persyaratan.map((item) => item.id)).size !==
            persyaratan.length
          ) {
            toast({
              title: `ID persyaratan bukti pada "${variabel.nama}" harus berbeda`,
              variant: "destructive",
            });
            return;
          }
          if (persyaratan.length > 0) {
            for (const item of persyaratan) {
              const patokanError = validasiPatokan(
                patokanPersyaratan(variabel, item),
                `persyaratan "${item.nama}"`,
              );
              if (patokanError) {
                toast({ title: patokanError, variant: "destructive" });
                return;
              }
            }
          } else {
            const patokanError = validasiPatokan(
              patokanVariabel(variabel),
              `variabel "${variabel.nama}"`,
            );
            if (patokanError) {
              toast({ title: patokanError, variant: "destructive" });
              return;
            }
          }
        }
        const totalRincian = totalBobotRincian(ind, p);
        const targetRincian = targetBobotRincian(p);
        if (Math.abs(totalRincian - targetRincian) >= 0.001) {
          toast({
            title: `Bobot rincian pada pilar "${p.nama}" harus total ${tampilBobot(targetRincian)}%`,
            variant: "destructive",
          });
          return;
        }
      }
    }
    if (bands.length === 0) {
      toast({
        title: "Tambahkan minimal satu predikat hasil akhir",
        variant: "destructive",
      });
      return;
    }
    for (const b of bands) {
      if (!b.nama.trim()) {
        toast({
          title: "Nama predikat tidak boleh kosong",
          variant: "destructive",
        });
        return;
      }
      if (!Number.isFinite(b.min) || b.min < 0 || b.min > 100) {
        toast({
          title: `Ambang predikat "${b.nama}" harus antara 0–100`,
          variant: "destructive",
        });
        return;
      }
    }
    if (!bands.some((b) => b.min === 0)) {
      toast({
        title: "Harus ada satu predikat dengan ambang 0 (predikat terendah)",
        variant: "destructive",
      });
      return;
    }
    const mins = bands.map((b) => b.min);
    if (new Set(mins).size !== mins.length) {
      toast({
        title: "Ambang bawah tiap predikat harus berbeda",
        variant: "destructive",
      });
      return;
    }
    const predikat = [...bands].sort((a, b) => a.min - b.min);
    const indikator = matriksTernormalisasi.map((ind) => ({
      ...ind,
      nama: ind.nama.trim(),
      pilar: ind.pilar.map((pilar) => {
        const variabel = pilar.variabel.map((item) => {
          const { persyaratanDataDukung: _legacy, ...tanpaLegacy } = item;
          const persyaratanBuktiDukung = persyaratanBuktiDukungOf(item).map(
            (persyaratan) => ({
              ...persyaratan,
              nama: persyaratan.nama.trim(),
              patokanNilai: patokanSiapSimpan(
                patokanPersyaratan(item, persyaratan),
              ),
            }),
          );
          return {
            ...tanpaLegacy,
            nama: item.nama.trim(),
            persyaratanBuktiDukung,
            ...(persyaratanBuktiDukung.length === 0
              ? {
                  patokanNilai: patokanSiapSimpan(patokanVariabel(item)),
                }
              : { patokanNilai: undefined }),
          };
        });
        return {
          ...pilar,
          nama: pilar.nama.trim(),
          variabel: pilarMemakaiBobotSumber(pilar)
            ? normalisasiBobotVariabel(variabel)
            : variabel,
        };
      }),
    }));
    setMenyimpanMatriks(true);
    try {
      await persistSetting("kurasiMatrix", {
        indikator,
        predikat,
        patokanNilai: salinPatokan(patokanWarisan),
        updatedAt: Date.now(),
      });
      setM(indikator);
      setStatusInjek((status) =>
        status ? { ...status, status: "tersimpan" } : status,
      );
      toast({ title: "Sistem kurasi disimpan" });
    } catch (error) {
      toast({
        title: "Matriks belum tersimpan",
        description:
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Server tidak dapat dihubungi. Draf tetap tersedia untuk dicoba kembali.",
        variant: "destructive",
      });
    } finally {
      setMenyimpanMatriks(false);
    }
  };

  const downloadTemplate = async () => {
    setMengunduhTemplate(true);
    try {
      const generatedAt = Date.now();
      const bytes = await buildKurasiTemplateXlsx(
        {
          indikator: m,
          patokanNilai: patokanWarisan,
          predikat: bands,
          updatedAt: db.kurasiMatrix.updatedAt,
        },
        generatedAt,
      );
      const arrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(arrayBuffer).set(bytes);
      const blob = new Blob([arrayBuffer], { type: KURASI_TEMPLATE_MIME });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = namaFileTemplateKurasi(generatedAt);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      const jumlahPilar = m.reduce(
        (total, indikator) => total + indikator.pilar.length,
        0,
      );
      const jumlahVariabel = m.reduce(
        (total, indikator) =>
          total +
          indikator.pilar.reduce(
            (pilarTotal, pilar) => pilarTotal + pilar.variabel.length,
            0,
          ),
        0,
      );
      toast({
        title: "Template Excel kurasi diunduh",
        description: `${m.length} indikator, ${jumlahPilar} pilar, dan ${jumlahVariabel} variabel mengikuti draf saat ini.`,
      });
    } catch (error) {
      toast({
        title: "Template Excel belum dapat dibuat",
        description:
          error instanceof Error
            ? error.message
            : "Coba unduh kembali beberapa saat lagi.",
        variant: "destructive",
      });
    } finally {
      setMengunduhTemplate(false);
    }
  };

  const handleInjek = async (file: File) => {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setMembacaExcel(true);
      try {
        const hasil = await parseKurasiXlsx(file);
        if (hasil.jenis === "lengkap") {
          setM(hasil.indikator);
          setBands(hasil.predikat.map((item) => ({ ...item })));
          setPatokanWarisan(hasil.patokanNilai.map((item) => ({ ...item })));
          setStatusInjek({
            status: "belum-disimpan",
            jenis: "lengkap",
            namaFile: file.name,
            namaSheet: hasil.namaSheet,
            jumlahBaris: hasil.jumlahBaris,
            jumlahPilar: hasil.jumlahPilar,
          });
          toast({
            title: "Template Excel kurasi lengkap dimuat",
            description: `${hasil.indikator.length} indikator, ${hasil.jumlahPilar} pilar, dan ${hasil.jumlahBaris} variabel dipulihkan beserta bukti, patokan, dan predikat. Perubahan belum tersimpan; tekan Simpan Matriks.`,
          });
          return;
        }
        const jenisLabel =
          hasil.jenis === "manajemen"
            ? "Manajemen Sanggar"
            : "Seni Pertunjukan";
        setM((current) => gantiIndikatorHasilInjek(current, hasil.indikator));
        setStatusInjek({
          status: "belum-disimpan",
          jenis: hasil.indikator.tipe,
          namaFile: file.name,
          namaSheet: hasil.namaSheet,
          jumlahBaris: hasil.jumlahBaris,
          jumlahPilar: hasil.jumlahPilar,
        });
        toast({
          title: `Indikator ${jenisLabel} dimuat dari Excel`,
          description: `${hasil.jumlahBaris} butir dari ${hasil.jumlahPilar} pilar pada sheet “${hasil.namaSheet}”. Indikator lain tetap dipertahankan.${
            hasil.peringatan.length > 0
              ? ` ${hasil.peringatan.length} ketidaksesuaian bobot dinormalisasi.`
              : ""
          } Perubahan belum tersimpan; tekan Simpan Matriks.`,
        });
      } catch (error) {
        toast({
          title: "Excel indikator tidak dapat dimuat",
          description:
            error instanceof Error
              ? error.message
              : "Periksa format dan header sheet pertama.",
          variant: "destructive",
        });
      } finally {
        setMembacaExcel(false);
      }
      return;
    }

    setMembacaExcel(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const rows = text
        .split(/\r?\n/)
        .slice(1)
        .filter(Boolean)
        .map((r) => r.split(",").map((c) => c.trim()));
      const indMap: Record<string, Indikator> = {};
      const pilarMap: Record<string, Pilar> = {};
      rows.forEach(([ind, bInd, tipe, pil, bPil, varN, bVar]) => {
        if (!ind) return;
        if (!indMap[ind]) {
          const t =
            tipe === "manajemen" || tipe === "seni"
              ? tipe
              : /(manaj|organisasi|administ|kelembagaan)/i.test(ind)
                ? "manajemen"
                : "seni";
          indMap[ind] = {
            id: uid(),
            nama: ind,
            bobot: Number(bInd) || 0,
            tipe: t,
            pilar: [],
          };
        }
        if (!pil) return;
        const pkey = `${ind}||${pil}`;
        if (!pilarMap[pkey]) {
          pilarMap[pkey] = {
            id: uid(),
            nama: pil,
            bobot: Number(bPil) || 0,
            variabel: [],
          };
          indMap[ind].pilar.push(pilarMap[pkey]);
        }
        if (varN)
          pilarMap[pkey].variabel.push({
            id: uid(),
            nama: varN,
            bobot: Number(bVar) || 0,
          });
      });
      const indikator = Object.values(indMap);
      setM(indikator);
      setStatusInjek({
        status: "belum-disimpan",
        jenis: "lengkap",
        namaFile: file.name,
        jumlahBaris: rows.length,
        jumlahPilar: indikator.reduce(
          (total, item) => total + item.pilar.length,
          0,
        ),
      });
      toast({
        title: "Draf matriks lengkap dimuat dari CSV",
        description: `${rows.length} baris diproses. CSV mengganti seluruh draf; tekan Simpan Matriks untuk menyimpan.`,
      });
      setMembacaExcel(false);
    };
    reader.onerror = () => {
      setMembacaExcel(false);
      toast({
        title: "CSV matriks tidak dapat dibaca",
        description: "Pilih ulang file CSV dan coba lagi.",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <PageHeader
        title="Setup Sistem Kurasi"
        subtitle="Kelola matriks Indikator → Pilar → Variabel, unduh template Excel lengkap, atau masukkan workbook kurasi dengan deteksi otomatis."
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void downloadTemplate()}
              disabled={mengunduhTemplate || membacaExcel || menyimpanMatriks}
              data-testid="btn-unduh-template-kurasi"
            >
              <FileDown className="h-4 w-4" />
              {mengunduhTemplate ? "Membuat Excel..." : "Unduh Template Excel"}
            </Button>
            <label
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                membacaExcel || menyimpanMatriks
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover-elevate"
              }`}
            >
              <Upload className="h-4 w-4" />
              {membacaExcel ? "Membaca berkas..." : "Masukkan Excel/CSV"}
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                disabled={membacaExcel || menyimpanMatriks}
                data-testid="input-injek-matriks"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleInjek(file);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              onClick={simpan}
              disabled={membacaExcel || menyimpanMatriks}
              data-testid="btn-simpan-matriks"
            >
              {menyimpanMatriks ? "Menyimpan..." : "Simpan Matriks"}
            </Button>
          </>
        }
      />

      <Card className="mb-4 border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Template Excel:</span>{" "}
        hasil unduhan mengikuti seluruh draf saat ini, termasuk indikator,
        pilar, variabel, persyaratan bukti, patokan nilai, predikat, bobot
        internal, dan bobot sumber. Template tersebut dapat dimasukkan kembali
        untuk memulihkan matriks lengkap. Excel sumber Manajemen atau Seni tetap
        dideteksi otomatis dan hanya mengganti indikator yang sesuai. Hasil baru
        berlaku setelah Anda menekan{" "}
        <span className="font-semibold text-foreground">Simpan Matriks</span>.
      </Card>

      {statusInjek && (
        <Card
          role="status"
          data-testid="status-injek-matriks"
          className={`mb-4 flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
            statusInjek.status === "tersimpan"
              ? "border-emerald-500/35 bg-emerald-500/5"
              : "border-amber-500/35 bg-amber-500/5"
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {statusInjek.jenis === "manajemen"
                  ? "Excel Manajemen Sanggar"
                  : statusInjek.jenis === "seni"
                    ? "Excel Seni Pertunjukan"
                    : statusInjek.namaFile.toLowerCase().endsWith(".xlsx")
                      ? "Template Excel Kurasi Lengkap"
                      : "CSV Matriks Lengkap"}
              </span>
              <Badge
                variant={
                  statusInjek.status === "tersimpan" ? "default" : "secondary"
                }
              >
                {statusInjek.status === "tersimpan"
                  ? "Tersimpan"
                  : "Belum tersimpan"}
              </Badge>
            </div>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {statusInjek.namaFile}
              {statusInjek.namaSheet
                ? ` • ${statusInjek.namaSheet}`
                : ""} • {statusInjek.jumlahBaris} butir
              {statusInjek.jumlahPilar !== undefined
                ? ` • ${statusInjek.jumlahPilar} pilar`
                : ""}
              .{" "}
              {statusInjek.status === "tersimpan"
                ? "Perubahan sudah berlaku."
                : "Periksa hasil di bawah, lalu simpan matriks."}
            </p>
          </div>
          {statusInjek.status === "belum-disimpan" && (
            <Button
              size="sm"
              className="shrink-0 gap-1"
              onClick={simpan}
              disabled={membacaExcel || menyimpanMatriks}
            >
              <Save className="h-3.5 w-3.5" />
              {menyimpanMatriks ? "Menyimpan..." : "Simpan Matriks Sekarang"}
            </Button>
          )}
        </Card>
      )}

      <Card className="p-3 mb-4 flex items-center justify-between text-sm">
        <div>Total Bobot Indikator (harus 100%)</div>
        <Badge variant={totalValid(totalBobot) ? "default" : "destructive"}>
          {tampilBobot(totalBobot)}%
        </Badge>
      </Card>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div>
            <div className="font-semibold">Predikat Hasil Akhir</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atur penamaan dan ambang bawah (bobot) tiap predikat. Predikat
              dipilih dari band tertinggi yang ambang bawahnya ≤ Nilai Akhir.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 shrink-0"
            onClick={() =>
              setBands(DEFAULT_PREDIKAT.map((b) => ({ ...b, id: uid() })))
            }
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Bawaan
          </Button>
        </div>
        <div className="hidden sm:grid grid-cols-[1fr_110px_1.4fr_auto] gap-2 px-1 mt-3 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div>Nama Predikat</div>
          <div>Ambang ≥</div>
          <div>Keterangan Tingkat</div>
          <div></div>
        </div>
        <div className="space-y-2">
          {[...bands]
            .sort((a, b) => a.min - b.min)
            .map((b) => {
              const i = bands.indexOf(b);
              return (
                <div
                  key={b.id}
                  className="grid grid-cols-2 sm:grid-cols-[1fr_110px_1.4fr_auto] gap-2 items-center"
                >
                  <Input
                    value={b.nama}
                    onChange={(e) => setBand(i, { nama: e.target.value })}
                    placeholder="Nama Predikat"
                  />
                  <Input
                    type="number"
                    value={b.min}
                    onChange={(e) =>
                      setBand(i, { min: Number(e.target.value) })
                    }
                    placeholder="Ambang"
                  />
                  <Input
                    value={b.tingkat}
                    onChange={(e) => setBand(i, { tingkat: e.target.value })}
                    placeholder="Keterangan tingkat"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setBands(bands.filter((_, idx) => idx !== i))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() =>
              setBands([
                ...bands,
                {
                  id: uid(),
                  nama: "Predikat Baru",
                  min: 0,
                  warna: "hsl(150 60% 30%)",
                  tingkat: "",
                },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Predikat
          </Button>
          <Button size="sm" className="gap-1 btn-gold" onClick={simpanPredikat}>
            <Save className="h-3.5 w-3.5" />
            Simpan Predikat
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {m.map((ind, i) => {
          const pilarTotal = totalBobotPilar(ind);
          const targetPilarTotal = targetBobotPilar(ind);
          return (
            <Card key={ind.id} className="p-4">
              <div className="grid sm:grid-cols-[1fr_150px_120px_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Nama Indikator</Label>
                  <Input
                    value={ind.nama}
                    onChange={(e) => setInd(i, { nama: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipe</Label>
                  <Select
                    value={ind.tipe}
                    onValueChange={(val) =>
                      setInd(i, { tipe: val as Indikator["tipe"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manajemen">
                        Manajemen (Tahap 1)
                      </SelectItem>
                      <SelectItem value="seni">Seni Pertunjukan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bobot %</Label>
                  <Input
                    type="number"
                    value={ind.bobot}
                    onChange={(e) =>
                      setInd(i, { bobot: Number(e.target.value) })
                    }
                  />
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setM(m.filter((_, idx) => idx !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {(ind.sumber || ind.catatanBobot) && (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  {ind.sumber && (
                    <div>
                      <span className="font-semibold text-foreground">
                        Sumber:
                      </span>{" "}
                      {ind.sumber}
                    </div>
                  )}
                  {ind.catatanBobot && (
                    <div className="mt-1">{ind.catatanBobot}</div>
                  )}
                </div>
              )}

              <div className="mt-4 ml-1 sm:ml-4 border-l-2 border-primary/40 pl-3 sm:pl-4 space-y-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  Pilar{" "}
                  <Badge
                    variant={
                      totalValid(pilarTotal, targetPilarTotal) ||
                      ind.pilar.length === 0
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    Total {tampilBobot(pilarTotal)}% /{" "}
                    {tampilBobot(targetPilarTotal)}%
                  </Badge>
                </div>
                {ind.pilar.map((p, pi) => {
                  const varTotal = totalBobotRincian(ind, p);
                  const targetVarTotal = targetBobotRincian(p);
                  const memakaiBobotSumberVariabel =
                    pilarMemakaiBobotSumber(p) ||
                    indikatorMemakaiBobotVariabelSumber(ind);
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-2"
                    >
                      <div className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                        <Input
                          value={p.nama}
                          onChange={(e) =>
                            setPilar(i, pi, { nama: e.target.value })
                          }
                          placeholder="Nama Pilar"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={bobotPilarRincian(p)}
                          onChange={(e) =>
                            setBobotPilarRincian(i, pi, Number(e.target.value))
                          }
                          title="Bobot pilar dalam persen sesuai dokumen sumber"
                          aria-label={`Bobot pilar ${p.nama} dalam persen`}
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            setInd(i, {
                              pilar: ind.pilar.filter((_, idx) => idx !== pi),
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="ml-2 border-l-2 border-accent/40 pl-3 space-y-2">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          Variabel{" "}
                          <Badge
                            variant={
                              Math.abs(varTotal - targetVarTotal) < 0.001 ||
                              p.variabel.length === 0
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            Total Bobot {tampilBobot(varTotal)}%
                          </Badge>
                        </div>
                        {p.variabel.map((v, vi) => (
                          <div key={v.id} className="space-y-1">
                            <div className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
                              <Input
                                value={v.nama}
                                onChange={(e) =>
                                  setVar(i, pi, vi, { nama: e.target.value })
                                }
                                placeholder="Komponen penilaian"
                              />
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="pr-8"
                                  value={bobotRincian(ind, p, v)}
                                  onChange={(e) =>
                                    setBobotRincian(
                                      i,
                                      pi,
                                      vi,
                                      Number(e.target.value),
                                    )
                                  }
                                  title="Bobot dalam persen sesuai dokumen sumber"
                                  aria-label={`Bobot ${v.nama} dalam persen`}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  %
                                </span>
                              </div>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() =>
                                  setPilar(i, pi, {
                                    variabel: p.variabel.filter(
                                      (_, idx) => idx !== vi,
                                    ),
                                  })
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-2 rounded-lg border bg-background/60 p-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label className="text-xs">
                                  Persyaratan Bukti Dukung
                                </Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() =>
                                    tambahPersyaratanBukti(i, pi, vi)
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                  Tambah Persyaratan
                                </Button>
                              </div>
                              {persyaratanBuktiDukungOf(v).length === 0 && (
                                <div className="space-y-2">
                                  <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                    Belum ada persyaratan bukti dukung. Juri
                                    menilai langsung Variabel dengan patokan
                                    fallback berikut.
                                  </div>
                                  <PatokanNilaiEditor
                                    judul="Patokan Nilai (tanpa bukti dukung)"
                                    items={patokanVariabel(v)}
                                    onChange={(items) =>
                                      setPatokanVariabel(i, pi, vi, items)
                                    }
                                  />
                                </div>
                              )}
                              {persyaratanBuktiDukungOf(v).map(
                                (persyaratan, persyaratanIndex) => (
                                  <div
                                    key={persyaratan.id}
                                    className="rounded-lg border bg-muted/20 p-2.5"
                                  >
                                    <div className="flex items-start gap-2">
                                      <Textarea
                                        rows={2}
                                        value={persyaratan.nama}
                                        onChange={(event) =>
                                          setPersyaratanBukti(
                                            i,
                                            pi,
                                            vi,
                                            persyaratanIndex,
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Nama atau keterangan bukti dukung"
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="shrink-0"
                                        onClick={() =>
                                          hapusPersyaratanBukti(
                                            i,
                                            pi,
                                            vi,
                                            persyaratanIndex,
                                          )
                                        }
                                        aria-label={`Hapus persyaratan ${persyaratan.nama}`}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <PatokanNilaiEditor
                                      judul="Patokan Nilai"
                                      items={patokanPersyaratan(v, persyaratan)}
                                      onChange={(items) =>
                                        setPatokanPersyaratan(
                                          i,
                                          pi,
                                          vi,
                                          persyaratanIndex,
                                          items,
                                        )
                                      }
                                    />
                                  </div>
                                ),
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                id={`contoh-${v.id}`}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  setVarContoh(i, pi, vi, e.target.files);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs"
                                onClick={() =>
                                  document
                                    .getElementById(`contoh-${v.id}`)
                                    ?.click()
                                }
                              >
                                <Paperclip className="h-3 w-3" />
                                {v.contoh ? "Ganti Contoh" : "Unggah Contoh"}
                              </Button>
                              {v.contoh && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <FileText className="h-3 w-3 flex-none" />
                                  <a
                                    href={v.contoh.dataUrl}
                                    download={v.contoh.name}
                                    className="max-w-[160px] truncate font-medium text-primary hover:underline"
                                    title={v.contoh.name}
                                  >
                                    {v.contoh.name}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVar(i, pi, vi, { contoh: undefined })
                                    }
                                    className="rounded p-0.5 hover:text-destructive"
                                    aria-label="Hapus contoh"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            setPilar(i, pi, {
                              variabel: [
                                ...p.variabel,
                                {
                                  id: uid(),
                                  nama: "Variabel Baru",
                                  bobot: 0,
                                  patokanNilai: patokanBawaanBaru(),
                                  ...(memakaiBobotSumberVariabel
                                    ? { bobotSumber: 0 }
                                    : {}),
                                },
                              ],
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah Variabel
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    setInd(i, {
                      pilar: [
                        ...ind.pilar,
                        {
                          id: uid(),
                          nama: "Pilar Baru",
                          bobot: 0,
                          ...(indikatorMemakaiBobotSumber(ind)
                            ? { bobotSumber: 0 }
                            : {}),
                          variabel: [],
                        },
                      ],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Pilar
                </Button>
              </div>
            </Card>
          );
        })}
        <Button
          variant="outline"
          className="gap-2"
          onClick={() =>
            setM([
              ...m,
              {
                id: uid(),
                nama: "Indikator Baru",
                bobot: 0,
                tipe: "seni",
                pilar: [],
              },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Tambah Indikator
        </Button>
      </div>
    </div>
  );
}

export function KuratorAssign() {
  const db = useDb();
  const { toast } = useToast();
  const juris = db.users.filter((u) => u.role === "juri") as JuriUser[];
  const sanggars = db.users.filter(
    (u) => u.role === "sanggar",
  ) as SanggarUser[];
  const [juri, setJuri] = useState(juris[0]?.id ?? "");
  const [sg, setSg] = useState(sanggars[0]?.id ?? "");
  const [periode, setPeriode] = useState("Kurasi 2026 Tahap I");
  const participantUsage = new Map<string, Set<string>>();
  for (const submission of db.kurasiSubmissions) {
    for (const participant of submission.pesertaSeni ?? []) {
      const accountKey = `akun:${(
        participant.username || participant.userId
      ).toLowerCase()}`;
      const nikKey = participant.nik ? `nik:${participant.nik}` : null;
      for (const key of [accountKey, nikKey].filter(Boolean) as string[]) {
        const sanggarIds = participantUsage.get(key) ?? new Set<string>();
        sanggarIds.add(submission.sanggarId);
        participantUsage.set(key, sanggarIds);
      }
    }
  }

  const tugaskan = async () => {
    if (!juri || !sg) return;
    const juriUser = db.users.find((user) => user.id === juri) as
      | JuriUser
      | undefined;
    const sanggarUser = db.users.find((user) => user.id === sg) as
      | SanggarUser
      | undefined;
    if (!juriUser || !sanggarUser) return;
    try {
      await createKurasiAssignment(
        juriUser.username,
        sanggarUser.username,
        periode,
      );
      toast({ title: "Penugasan tersimpan dan disinkronkan" });
    } catch (error) {
      toast({
        title: "Gagal menyimpan penugasan",
        description: "Pastikan koneksi API aktif dan gunakan sesi Kurator.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Penugasan Juri"
        subtitle="Tetapkan Juri ke Sanggar tertentu untuk periode kurasi."
      />
      <Card className="mb-6 overflow-hidden border-amber-300">
        <div className="border-b bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-lg font-semibold text-amber-950">
                Pengawasan Disposisi Peserta & Anti-Joki
              </h2>
              <p className="mt-1 text-sm text-amber-900/80">
                Pantau peserta, NIK tersamar, bukti KTP, dan selfie memegang KTP
                sebelum Juri ditugaskan.
              </p>
            </div>
            <Badge variant="outline">
              {db.kurasiSubmissions.length} pengajuan
            </Badge>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sanggar</TableHead>
              <TableHead>Status Disposisi</TableHead>
              <TableHead>Peserta & Bukti Identitas</TableHead>
              <TableHead>Pengawasan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.kurasiSubmissions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  Belum ada disposisi peserta kurasi.
                </TableCell>
              </TableRow>
            )}
            {db.kurasiSubmissions.map((submission) => {
              const sanggar = sanggars.find(
                (item) => item.id === submission.sanggarId,
              );
              const participants = submission.pesertaSeni ?? [];
              const conflicts = participants.filter((participant) => {
                const accountKey = `akun:${(
                  participant.username || participant.userId
                ).toLowerCase()}`;
                const nikKey = participant.nik
                  ? `nik:${participant.nik}`
                  : null;
                return (
                  (participantUsage.get(accountKey)?.size ?? 0) > 1 ||
                  (nikKey
                    ? (participantUsage.get(nikKey)?.size ?? 0) > 1
                    : false)
                );
              });
              return (
                <TableRow key={`disposisi-${submission.id}`}>
                  <TableCell className="align-top font-medium">
                    {sanggar?.namaSanggar ?? submission.sanggarId}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1.5">
                      <Badge
                        variant={
                          participants.length >= 5 && participants.length <= 8
                            ? "default"
                            : "destructive"
                        }
                      >
                        {participants.length}/8 peserta
                      </Badge>
                      <div>
                        <Badge
                          variant={
                            submission.deklarasiAntiJokiAt
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {submission.deklarasiAntiJokiAt
                            ? "Deklarasi tercatat"
                            : "Belum deklarasi"}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-3">
                      {participants.map((participant) => {
                        const accountKey = `akun:${(
                          participant.username || participant.userId
                        ).toLowerCase()}`;
                        const nikKey = participant.nik
                          ? `nik:${participant.nik}`
                          : null;
                        const conflict =
                          (participantUsage.get(accountKey)?.size ?? 0) > 1 ||
                          (nikKey
                            ? (participantUsage.get(nikKey)?.size ?? 0) > 1
                            : false);
                        const maskedNik = participant.nik
                          ? `••••••••••••${participant.nik.slice(-4)}`
                          : "NIK belum diisi";
                        return (
                          <div
                            key={`${submission.id}-${participant.userId}`}
                            className="rounded-lg border p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {participant.nama}
                              </span>
                              {conflict && (
                                <Badge variant="destructive">
                                  Konflik lintas Sanggar
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {participant.username || participant.userId} ·{" "}
                              {maskedNik}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              {(participant.ktpUrl ||
                                participant.ktpDataUrl) && (
                                <a
                                  href={
                                    participant.ktpUrl || participant.ktpDataUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline"
                                >
                                  Periksa KTP
                                </a>
                              )}
                              {(participant.selfieUrl ||
                                participant.selfieDataUrl) && (
                                <a
                                  href={
                                    participant.selfieUrl ||
                                    participant.selfieDataUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline"
                                >
                                  Periksa Selfie + KTP
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {conflicts.length > 0 ? (
                      <Badge variant="destructive">
                        {conflicts.length} konflik terdeteksi
                      </Badge>
                    ) : participants.length >= 5 &&
                      participants.length <= 8 &&
                      submission.deklarasiAntiJokiAt ? (
                      <Badge variant="default">Siap diverifikasi</Badge>
                    ) : (
                      <Badge variant="outline">Belum lengkap</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Card className="p-5 max-w-xl space-y-3 mb-6">
        <div className="space-y-1.5">
          <Label>Pilih Juri</Label>
          <Select value={juri} onValueChange={setJuri}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {juris.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Pilih Sanggar</Label>
          <Select value={sg} onValueChange={setSg}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sanggars.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.namaSanggar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Periode</Label>
          <Input value={periode} onChange={(e) => setPeriode(e.target.value)} />
        </div>
        <Button onClick={tugaskan}>Tugaskan</Button>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Juri</TableHead>
              <TableHead>Sanggar</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.penugasanJuri.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  Belum ada penugasan.
                </TableCell>
              </TableRow>
            )}
            {db.penugasanJuri.map((p) => {
              const j = db.users.find((u) => u.id === p.juriId);
              const s = db.users.find((u) => u.id === p.sanggarId);
              return (
                <TableRow key={p.id}>
                  <TableCell>{(j as any)?.nama}</TableCell>
                  <TableCell>{(s as any)?.namaSanggar}</TableCell>
                  <TableCell>{p.periode}</TableCell>
                  <TableCell>{fmtDate(p.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        save((d) => {
                          d.penugasanJuri = d.penugasanJuri.filter(
                            (x) => x.id !== p.id,
                          );
                        })
                      }
                    >
                      Hapus
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function KuratorStaff() {
  const db = useDb();
  const { demoMode } = useAuth();
  const { toast } = useToast();
  const admins = db.users.filter((u) => u.role === "admin") as AdminUser[];
  const juris = db.users.filter((u) => u.role === "juri") as JuriUser[];

  const tambahAdmin = async (
    nama: string,
    username: string,
    password: string,
  ) => {
    const permissions: AdminPermissions = {
      kelolaBerita: true,
      kelolaBanner: true,
      kelolaSlider: true,
      kelolaJamPembinaan: false,
      kelolaInfoBudaya: true,
    };
    try {
      if (
        db.users.some(
          (user) => user.username.toLowerCase() === username.toLowerCase(),
        )
      ) {
        throw new Error("Username sudah digunakan.");
      }
      const created = demoMode
        ? null
        : await usersApi.create({
            username,
            password,
            role: "admin",
            status: "aktif",
            profile: { nama, permissions },
          });
      save((d) => {
        d.users.push({
          id: created ? `u_api_${created.id}` : `u_demo_${uid()}`,
          ...(created ? { apiId: created.id } : {}),
          role: "admin",
          username,
          password: created ? API_PASSWORD_PLACEHOLDER : password,
          nama,
          permissions,
          createdAt: Date.now(),
        } as AdminUser);
      });
      toast({ title: "Admin ditambahkan" });
      return true;
    } catch (error) {
      toast({
        title: "Admin belum dibuat",
        description:
          error instanceof ApiError
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
      return false;
    }
  };
  const tambahJuri = async (
    nama: string,
    username: string,
    password: string,
    keahlian: string,
  ) => {
    try {
      if (
        db.users.some(
          (user) => user.username.toLowerCase() === username.toLowerCase(),
        )
      ) {
        throw new Error("Username sudah digunakan.");
      }
      const created = demoMode
        ? null
        : await usersApi.create({
            username,
            password,
            role: "juri",
            status: "aktif",
            profile: { nama, keahlian },
          });
      save((d) => {
        d.users.push({
          id: created ? `u_api_${created.id}` : `u_demo_${uid()}`,
          ...(created ? { apiId: created.id } : {}),
          role: "juri",
          username,
          password: created ? API_PASSWORD_PLACEHOLDER : password,
          nama,
          keahlian,
          createdAt: Date.now(),
        } as JuriUser);
      });
      toast({ title: "Juri ditambahkan" });
      return true;
    } catch (error) {
      toast({
        title: "Juri belum dibuat",
        description:
          error instanceof ApiError
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
      return false;
    }
  };
  const removeStaff = async (user: AdminUser | JuriUser) => {
    const apiId =
      user.apiId ?? (user.id.startsWith("u_api_") ? user.id.slice(6) : null);
    if (!demoMode && !apiId) {
      toast({ title: "Akun belum terhubung server", variant: "destructive" });
      return;
    }
    try {
      if (!demoMode) await usersApi.remove(apiId!);
      save((d) => {
        d.users = d.users.filter((item) => item.id !== user.id);
      });
      toast({ title: "Akun dihapus" });
    } catch (error) {
      toast({
        title: "Akun belum dihapus",
        description:
          error instanceof ApiError
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    }
  };
  const togglePerm = async (
    admin: AdminUser,
    key: keyof AdminPermissions,
    value: boolean,
  ) => {
    const apiId =
      admin.apiId ?? (admin.id.startsWith("u_api_") ? admin.id.slice(6) : null);
    if (!demoMode && !apiId) return;
    const permissions = { ...admin.permissions, [key]: value };
    try {
      if (!demoMode) {
        await usersApi.update(apiId!, {
          profile: { nama: admin.nama, permissions },
        });
      }
      save((d) => {
        const item = d.users.find((user) => user.id === admin.id) as
          | AdminUser
          | undefined;
        if (item) item.permissions = permissions;
      });
    } catch (error) {
      toast({
        title: "Hak akses belum berubah",
        description:
          error instanceof ApiError
            ? error.message
            : "Server tidak dapat dihubungi.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Manajemen Admin & Juri"
        subtitle="Buat akun staff secara manual dan atur hak aksesnya."
      />
      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="juri">Juri</TabsTrigger>
        </TabsList>
        <TabsContent value="admin" className="space-y-4">
          <NewAccountForm onSubmit={tambahAdmin} kind="admin" />
          {admins.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{a.nama}</div>
                  <div className="text-xs text-muted-foreground">
                    @{a.username}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void removeStaff(a)}
                >
                  Hapus
                </Button>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {(Object.keys(a.permissions) as (keyof AdminPermissions)[]).map(
                  (k) => (
                    <label
                      key={k}
                      className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
                    >
                      <span>{k}</span>
                      <Switch
                        checked={a.permissions[k]}
                        onCheckedChange={(value) =>
                          void togglePerm(a, k, value)
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="juri" className="space-y-4">
          <NewAccountForm
            onSubmit={(n, u, p, extra) => tambahJuri(n, u, p, extra ?? "")}
            kind="juri"
          />
          {juris.map((j) => (
            <Card
              key={j.id}
              className="p-5 flex items-center justify-between gap-4"
            >
              <div>
                <div className="font-medium">{j.nama}</div>
                <div className="text-xs text-muted-foreground">
                  @{j.username} · {j.keahlian}
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void removeStaff(j)}
              >
                Hapus
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewAccountForm({
  onSubmit,
  kind,
}: {
  onSubmit: (
    nama: string,
    username: string,
    password: string,
    extra?: string,
  ) => Promise<boolean>;
  kind: "admin" | "juri";
}) {
  const [f, setF] = useState({
    nama: "",
    username: "",
    password: "",
    keahlian: "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (
      !f.nama.trim() ||
      !f.username.trim() ||
      f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH ||
      (kind === "juri" && !f.keahlian.trim())
    )
      return;
    setBusy(true);
    try {
      const created = await onSubmit(
        f.nama.trim(),
        f.username.trim(),
        f.password,
        f.keahlian.trim(),
      );
      if (created) setF({ nama: "", username: "", password: "", keahlian: "" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-5">
      <h3 className="font-serif text-lg flex items-center gap-2">
        <Shield className="h-5 w-5" />
        Buat Akun {kind === "admin" ? "Admin" : "Juri"}
      </h3>
      <div className="mt-3 grid sm:grid-cols-4 gap-3">
        <Input
          placeholder="Nama lengkap"
          value={f.nama}
          onChange={(e) => setF({ ...f, nama: e.target.value })}
        />
        <Input
          placeholder="Username"
          value={f.username}
          onChange={(e) => setF({ ...f, username: e.target.value })}
        />
        <Input
          placeholder="Password"
          type="password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        {kind === "juri" ? (
          <Input
            placeholder="Keahlian"
            value={f.keahlian}
            onChange={(e) => setF({ ...f, keahlian: e.target.value })}
          />
        ) : (
          <Button
            disabled={busy || f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH}
            onClick={() => void submit()}
          >
            {busy ? "Membuat..." : "Buat"}
          </Button>
        )}
        {kind === "juri" && (
          <Button
            className="sm:col-span-4"
            disabled={busy || f.password.length < MIN_ACCOUNT_PASSWORD_LENGTH}
            onClick={() => void submit()}
          >
            {busy ? "Membuat..." : "Buat Juri"}
          </Button>
        )}
      </div>
    </Card>
  );
}

const SWATCHES: { name: string; primary: string; accent: string }[] = [
  { name: "Navy Emas (Default)", primary: "220 55% 18%", accent: "42 65% 53%" },
  { name: "Maroon Klasik", primary: "4 70% 38%", accent: "41 75% 50%" },
  { name: "Hijau Daun", primary: "145 50% 30%", accent: "41 75% 50%" },
  { name: "Biru Lautan", primary: "215 60% 35%", accent: "41 75% 55%" },
  { name: "Ungu Sastra", primary: "275 45% 38%", accent: "41 75% 55%" },
  { name: "Sepia Hangat", primary: "28 55% 32%", accent: "32 70% 58%" },
  { name: "Mocha Latte", primary: "20 35% 28%", accent: "30 60% 55%" },
  { name: "Pink Pastel", primary: "330 50% 45%", accent: "320 70% 70%" },
  { name: "Hutan Tropis", primary: "150 45% 22%", accent: "85 65% 50%" },
  { name: "Senja Karang", primary: "12 60% 32%", accent: "20 80% 60%" },
];

type ThemePresetDef = {
  id: string;
  name: string;
  desc: string;
  mode: "light" | "dark" | "luxury";
  primary: string;
  accent: string;
  preview: string;
};

const THEMES: ThemePresetDef[] = [
  {
    id: "light",
    name: "Terang",
    desc: "Putih kehijauan + hijau + oranye. Cocok pemakaian siang & cetak.",
    mode: "light",
    primary: "146 78% 34%",
    accent: "10 100% 54%",
    preview:
      "linear-gradient(135deg, hsl(150 30% 96%) 0%, hsl(146 30% 86%) 100%)",
  },
  {
    id: "dark",
    name: "Gelap",
    desc: "Hijau gelap + oranye hangat. Nyaman di mata.",
    mode: "dark",
    primary: "10 95% 56%",
    accent: "10 95% 56%",
    preview:
      "linear-gradient(135deg, hsl(150 45% 10%) 0%, hsl(149 45% 18%) 100%)",
  },
  {
    id: "luxury",
    name: "Dark Luxury",
    desc: "Hijau pekat + glow oranye premium.",
    mode: "luxury",
    primary: "12 95% 58%",
    accent: "12 100% 60%",
    preview:
      "linear-gradient(135deg, hsl(150 55% 6%) 0%, hsl(149 50% 14%) 55%, hsl(18 62% 28%) 100%)",
  },
  {
    id: "sepia",
    name: "Sepia Klasik",
    desc: "Aksen kayu manis & cream — terasa hangat & vintage.",
    mode: "light",
    primary: "28 55% 32%",
    accent: "32 70% 58%",
    preview:
      "linear-gradient(135deg, hsl(36 60% 92%) 0%, hsl(28 55% 78%) 100%)",
  },
  {
    id: "ocean",
    name: "Lautan Biru",
    desc: "Biru laut dalam + cyan terang. Tegas dan modern.",
    mode: "dark",
    primary: "210 80% 22%",
    accent: "190 80% 55%",
    preview:
      "linear-gradient(135deg, hsl(210 70% 8%) 0%, hsl(200 60% 18%) 100%)",
  },
  {
    id: "hutan",
    name: "Hutan Tropis",
    desc: "Hijau lumut + lime. Segar dan natural.",
    mode: "dark",
    primary: "150 45% 22%",
    accent: "85 65% 50%",
    preview:
      "linear-gradient(135deg, hsl(150 50% 8%) 0%, hsl(145 45% 16%) 100%)",
  },
  {
    id: "senja",
    name: "Senja Maroon",
    desc: "Maroon dramatis + peach. Hangat dan elegan.",
    mode: "dark",
    primary: "350 55% 25%",
    accent: "20 80% 60%",
    preview:
      "linear-gradient(135deg, hsl(350 50% 8%) 0%, hsl(20 60% 22%) 100%)",
  },
  {
    id: "pastel",
    name: "Pastel Lembut",
    desc: "Pink & lavender lembut — friendly & ringan.",
    mode: "light",
    primary: "330 50% 45%",
    accent: "320 70% 70%",
    preview:
      "linear-gradient(135deg, hsl(330 60% 95%) 0%, hsl(280 50% 92%) 100%)",
  },
  {
    id: "mocha",
    name: "Mocha Latte",
    desc: "Cokelat susu + krim. Klasik dan elegan.",
    mode: "light",
    primary: "20 35% 28%",
    accent: "30 60% 55%",
    preview:
      "linear-gradient(135deg, hsl(35 40% 92%) 0%, hsl(25 30% 80%) 100%)",
  },
];

const KATEGORI_LIST: TradisiKategori[] = [
  "Pantun Betawi",
  "Peribahasa",
  "Palang Pintu",
  "Sahibul Hikayat",
  "Cerita Rakyat",
  "Salam Betawi",
  "Rancag",
  "Lenong",
];

function readImageFile(file: File, maxBytes = 2_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes)
      return reject(
        new Error(
          `Ukuran file melebihi ${Math.round(maxBytes / 1_000_000)} MB.`,
        ),
      );
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Gagal membaca file"));
    r.readAsDataURL(file);
  });
}

// Read any image (no size cap on input) and auto-compress it to under
// `targetBytes` by scaling down to max dimension and stepping JPEG quality.
// Returns { dataUrl, width, height, finalBytes, originalBytes }.
async function compressImageFile(
  file: File,
  opts: {
    targetBytes?: number;
    maxDimension?: number;
    transparan?: boolean;
  } = {},
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  finalBytes: number;
  originalBytes: number;
}> {
  const targetBytes = opts.targetBytes ?? 900_000; // ~0.9 MB after base64 inflation stays well under 2 MB
  const maxDimension = opts.maxDimension ?? 1920;
  // transparan: keluarkan PNG agar area transparan (logo/stempel) tetap tembus
  // pandang. Default JPEG mengisi latar putih supaya area transparan tidak
  // menjadi hitam (JPEG tak punya alpha).
  const transparan = opts.transparan ?? false;
  if (!file.type.startsWith("image/")) throw new Error("File bukan gambar.");

  const originalDataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Gagal membaca file"));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Gambar tidak bisa dimuat."));
    im.src = originalDataUrl;
  });

  let { width, height } = {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  let curW = Math.max(1, Math.round(width * scale));
  let curH = Math.max(1, Math.round(height * scale));

  const tryEncode = (w: number, h: number, q: number): string => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    if (transparan) {
      // Pertahankan transparansi → PNG (parameter kualitas diabaikan PNG).
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/png");
    }
    // JPEG tak punya alpha: isi latar putih dulu agar transparan → putih,
    // bukan hitam.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", q);
  };

  const dataUrlBytes = (s: string) =>
    Math.ceil(((s.length - s.indexOf(",") - 1) * 3) / 4);

  let dataUrl = tryEncode(curW, curH, 0.88);
  let finalBytes = dataUrlBytes(dataUrl);
  const qualitySteps = [0.78, 0.68, 0.58, 0.48, 0.4, 0.33];
  for (const q of qualitySteps) {
    if (finalBytes <= targetBytes) break;
    dataUrl = tryEncode(curW, curH, q);
    finalBytes = dataUrlBytes(dataUrl);
  }
  // If still too large, progressively shrink dimensions
  let safety = 0;
  while (
    finalBytes > targetBytes &&
    Math.max(curW, curH) > 480 &&
    safety++ < 6
  ) {
    curW = Math.round(curW * 0.8);
    curH = Math.round(curH * 0.8);
    dataUrl = tryEncode(curW, curH, 0.7);
    finalBytes = dataUrlBytes(dataUrl);
    if (finalBytes > targetBytes) {
      dataUrl = tryEncode(curW, curH, 0.5);
      finalBytes = dataUrlBytes(dataUrl);
    }
  }

  return {
    dataUrl,
    width: curW,
    height: curH,
    finalBytes,
    originalBytes: file.size,
  };
}

export function KuratorAppearance() {
  const db = useDb();
  const { toast } = useToast();
  const ap = db.appearance;
  const t = useT();
  const currentPreset = ap.themePreset ?? ap.theme ?? "light";

  const applyMode = (mode: "light" | "dark" | "luxury") => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode !== "light");
    root.classList.toggle("luxury", mode === "luxury");
  };

  const apply = async (primary: string, accent: string) => {
    try {
      await persistAppearance((ap) => {
        ap.primaryHsl = primary;
        ap.accentHsl = accent;
        if (ap.customTheme) ap.customTheme.enabled = false;
      });
      document.documentElement.style.setProperty("--primary", primary);
      document.documentElement.style.setProperty("--accent", accent);
      toast({ title: t("Tema diperbarui") });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan ke server",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const setPreset = async (preset: ThemePresetDef) => {
    try {
      await persistAppearance((ap) => {
        ap.theme = preset.mode;
        ap.themePreset = preset.id;
        ap.dark = preset.mode !== "light";
        ap.primaryHsl = preset.primary;
        ap.accentHsl = preset.accent;
        if (ap.customTheme) ap.customTheme.enabled = false;
      });
      applyMode(preset.mode);
      document.documentElement.style.setProperty("--primary", preset.primary);
      document.documentElement.style.setProperty("--accent", preset.accent);
      toast({ title: `${t("Tema diperbarui")}: ${preset.name}` });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan ke server",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title={t("Pengaturan Tampilan")}
        subtitle="Kustomisasi identitas brand, warna, latar belakang, bahasa, hingga isi & perilaku pop-up Tradisi."
      />

      <Tabs defaultValue="brand" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="brand" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {t("Brand & Logo")}
          </TabsTrigger>
          <TabsTrigger value="tema" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            {t("Tema & Warna")}
          </TabsTrigger>
          <TabsTrigger value="backdrop" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            {t("Backdrop")}
          </TabsTrigger>
          <TabsTrigger value="tradisi" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            {t("Pop-up Tradisi")}
          </TabsTrigger>
          <TabsTrigger
            value="studio"
            className="gap-1.5"
            data-testid="tab-studio"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {t("Studio Lanjutan")}
          </TabsTrigger>
          <TabsTrigger
            value="bahasa"
            className="gap-1.5"
            data-testid="tab-bahasa"
          >
            <Languages className="h-3.5 w-3.5" />
            {t("Bahasa")}
          </TabsTrigger>
          <TabsTrigger
            value="naskah"
            className="gap-1.5"
            data-testid="tab-naskah"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("Tata Naskah Dinas")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandTab />
        </TabsContent>
        <TabsContent value="naskah">
          <TataNaskahTab />
        </TabsContent>

        <TabsContent value="tema">
          <Card className="p-5 mb-4">
            <h3 className="font-serif text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("Mode Tampilan")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pilih atmosfer yang paling nyaman. Berlaku untuk semua pengguna.
            </p>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {THEMES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p)}
                  className={`text-left rounded-2xl border p-3 transition-all ${
                    currentPreset === p.id
                      ? "border-accent ring-2 ring-accent/40"
                      : "border-border hover:border-accent/50 hover:-translate-y-0.5"
                  }`}
                  data-testid={`theme-${p.id}`}
                >
                  <div
                    className="h-20 w-full rounded-xl mb-3 relative overflow-hidden"
                    style={{
                      background: p.preview,
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    <div
                      className="absolute inset-x-3 top-3 h-2 rounded-full"
                      style={{ background: `hsl(${p.accent})` }}
                    />
                    <div className="absolute left-3 right-1/2 bottom-3 h-1.5 rounded-full bg-white/40" />
                    <div className="absolute right-3 left-2/3 bottom-3 h-1.5 rounded-full bg-white/20" />
                  </div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {t("Kontras Tinggi")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mode aksesibilitas untuk pengguna low-vision atau kondisi
                  silau (outdoor): teks kecil ditebalkan, border dipertegas, dan
                  panel transparan dijadikan solid. Berlaku di semua tema
                  (Light/Dark/Luxury) dan untuk semua pengguna.
                </p>
              </div>
              <Switch
                checked={!!ap.highContrast}
                onCheckedChange={async (v) => {
                  try {
                    await persistAppearance((ap) => {
                      ap.highContrast = v;
                    });
                    document.documentElement.classList.toggle(
                      "high-contrast",
                      v,
                    );
                    toast({
                      title: v
                        ? t("Kontras Tinggi diaktifkan")
                        : t("Kontras Tinggi dinonaktifkan"),
                    });
                  } catch (e: any) {
                    document.documentElement.classList.toggle(
                      "high-contrast",
                      !v,
                    );
                    toast({
                      title: "Gagal menyimpan ke server",
                      description: e?.message ?? "",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="switch-high-contrast"
              />
            </div>
          </Card>

          <CustomThemeCard />

          <Card className="p-5 mt-4">
            <h3 className="font-serif text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("Aksen Warna")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ganti hanya warna primer & aksen tanpa mengubah mode. Klik salah
              satu untuk menerapkan langsung.
            </p>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {SWATCHES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => apply(s.primary, s.accent)}
                  className={`text-left rounded-xl border p-3 transition hover:-translate-y-0.5 ${ap.primaryHsl === s.primary ? "ring-2 ring-accent border-accent" : "hover:border-accent/40"}`}
                >
                  <div className="flex gap-1.5">
                    <div
                      className="h-9 flex-1 rounded-md"
                      style={{ background: `hsl(${s.primary})` }}
                    />
                    <div
                      className="h-9 flex-1 rounded-md"
                      style={{ background: `hsl(${s.accent})` }}
                    />
                  </div>
                  <div className="text-sm mt-2 font-medium">{s.name}</div>
                </button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="backdrop">
          <BackdropTab />
        </TabsContent>
        <TabsContent value="tradisi">
          <TradisiTab />
        </TabsContent>
        <TabsContent value="studio">
          <StudioTab />
        </TabsContent>
        <TabsContent value="bahasa">
          <BahasaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomThemeCard() {
  const db = useDb();
  const { toast } = useToast();
  const t = useT();
  const ct = db.appearance.customTheme ?? {
    enabled: false,
    mode: "light" as const,
    primaryHsl: "220 55% 18%",
    accentHsl: "42 65% 53%",
    bgOpacity: 0.22,
  };
  const [draft, setDraft] = useState(ct);
  const [busy, setBusy] = useState(false);

  const hslToHex = (hsl: string): string => {
    const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (!m) return "#1f3a72";
    const h = +m[1],
      s = +m[2] / 100,
      l = +m[3] / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const mm = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (n: number) =>
      Math.round((n + mm) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };
  const hexToHsl = (hex: string): string => {
    const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
    if (!m) return draft.primaryHsl;
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const onUpload = async (file: File) => {
    try {
      setBusy(true);
      const r = await compressImageFile(file, {
        targetBytes: 900_000,
        maxDimension: 1920,
      });
      setDraft((d) => ({ ...d, bgImageDataUrl: r.dataUrl }));
      toast({ title: "Gambar tema siap. Tekan Simpan untuk menerapkan." });
    } catch (e: any) {
      toast({
        title: "Gagal memuat gambar",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const simpan = async () => {
    try {
      await persistAppearance((ap) => {
        const wasEnabled = ap.customTheme?.enabled ?? false;
        const baseline = wasEnabled
          ? ap.customTheme?.previousBaseline
          : {
              theme: (ap.theme ?? "light") as ThemeMode,
              themePreset: ap.themePreset ?? ap.theme ?? "light",
              primaryHsl: ap.primaryHsl,
              accentHsl: ap.accentHsl,
              dark: ap.dark,
            };
        ap.customTheme = {
          ...draft,
          enabled: true,
          previousBaseline: baseline,
        };
        ap.theme = draft.mode;
        ap.themePreset = "custom";
        ap.dark = draft.mode !== "light";
        ap.primaryHsl = draft.primaryHsl;
        ap.accentHsl = draft.accentHsl;
      });
      const root = document.documentElement;
      root.classList.toggle("dark", draft.mode !== "light");
      root.classList.toggle("luxury", draft.mode === "luxury");
      root.style.setProperty("--primary", draft.primaryHsl);
      root.style.setProperty("--accent", draft.accentHsl);
      toast({ title: t("Tema kustom diterapkan") });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const matikan = async () => {
    try {
      const restoredBox: Array<{
        mode: ThemeMode;
        primary: string;
        accent: string;
      }> = [];
      await persistAppearance((ap) => {
        const baseline = ap.customTheme?.previousBaseline;
        if (baseline) {
          ap.theme = baseline.theme;
          ap.themePreset = baseline.themePreset;
          ap.primaryHsl = baseline.primaryHsl;
          ap.accentHsl = baseline.accentHsl;
          ap.dark = baseline.dark;
          restoredBox.push({
            mode: baseline.theme,
            primary: baseline.primaryHsl,
            accent: baseline.accentHsl,
          });
        }
        if (ap.customTheme) {
          ap.customTheme.enabled = false;
          ap.customTheme.previousBaseline = undefined;
        }
      });
      setDraft((d) => ({ ...d, enabled: false }));
      const restored = restoredBox[0];
      if (restored) {
        const root = document.documentElement;
        root.classList.toggle("dark", restored.mode !== "light");
        root.classList.toggle("luxury", restored.mode === "luxury");
        root.style.setProperty("--primary", restored.primary);
        root.style.setProperty("--accent", restored.accent);
      }
      toast({ title: "Tema kustom dimatikan" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-5 mt-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t("Tema Kustom Anda")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pilih warna primer + aksen sendiri, ditambah opsi gambar latar tema.
            Sistem akan otomatis mengecilkan gambar.
          </p>
        </div>
        {ct.enabled && (
          <div className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            Aktif
          </div>
        )}
      </div>

      <div className="mt-4 grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Mode Dasar</Label>
              <Select
                value={draft.mode}
                onValueChange={(v: any) => setDraft({ ...draft, mode: v })}
              >
                <SelectTrigger data-testid="select-custom-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Terang</SelectItem>
                  <SelectItem value="dark">Gelap</SelectItem>
                  <SelectItem value="luxury">Dark Luxury</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Warna Primer</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hslToHex(draft.primaryHsl)}
                  onChange={(e) =>
                    setDraft({ ...draft, primaryHsl: hexToHsl(e.target.value) })
                  }
                  className="h-9 w-12 rounded cursor-pointer"
                  data-testid="color-custom-primary"
                />
                <Input
                  value={draft.primaryHsl}
                  onChange={(e) =>
                    setDraft({ ...draft, primaryHsl: e.target.value })
                  }
                  className="font-mono text-xs"
                  placeholder="220 55% 18%"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna Aksen</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hslToHex(draft.accentHsl)}
                  onChange={(e) =>
                    setDraft({ ...draft, accentHsl: hexToHsl(e.target.value) })
                  }
                  className="h-9 w-12 rounded cursor-pointer"
                  data-testid="color-custom-accent"
                />
                <Input
                  value={draft.accentHsl}
                  onChange={(e) =>
                    setDraft({ ...draft, accentHsl: e.target.value })
                  }
                  className="font-mono text-xs"
                  placeholder="42 65% 53%"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Gambar Latar Tema (opsional)</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
              Berlaku saat tema kustom aktif. Akan ditampilkan di seluruh
              halaman setelah login.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-20 w-32 rounded-md border bg-muted/30 grid place-items-center overflow-hidden">
                {draft.bgImageDataUrl ? (
                  <img
                    src={draft.bgImageDataUrl}
                    alt="bg"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Tanpa gambar
                  </span>
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer hover-elevate">
                <Upload className="h-4 w-4" />
                {busy
                  ? "Memproses..."
                  : draft.bgImageDataUrl
                    ? "Ganti Gambar"
                    : "Unggah Gambar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && onUpload(e.target.files[0])
                  }
                  data-testid="input-custom-bg"
                />
              </label>
              {draft.bgImageDataUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((d) => ({ ...d, bgImageDataUrl: undefined }))
                  }
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Hapus
                </Button>
              )}
            </div>
            {draft.bgImageDataUrl && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Opasitas Gambar</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round((draft.bgOpacity ?? 0.22) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={Math.round((draft.bgOpacity ?? 0.22) * 100)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bgOpacity: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={simpan}
              className="gap-1.5"
              data-testid="button-save-custom-theme"
            >
              <Sparkles className="h-4 w-4" />
              {t("Simpan Tema Kustom")}
            </Button>
            {ct.enabled && (
              <Button variant="outline" onClick={matikan} className="gap-1.5">
                <X className="h-4 w-4" />
                Matikan
              </Button>
            )}
          </div>
        </div>

        <div
          className="rounded-xl border overflow-hidden h-fit"
          style={{
            background: draft.bgImageDataUrl
              ? `url(${draft.bgImageDataUrl}) center/cover`
              : `hsl(${draft.primaryHsl})`,
          }}
        >
          <div
            className="p-4"
            style={{
              background: draft.bgImageDataUrl
                ? `hsl(${draft.primaryHsl} / ${1 - (draft.bgOpacity ?? 0.22)})`
                : "transparent",
              minHeight: 180,
            }}
          >
            <div className="text-[11px] font-medium uppercase tracking-widest text-white/85 mb-2">
              Pratinjau
            </div>
            <div className="font-serif text-xl text-white">
              Halo, ini tema kustom
            </div>
            <div
              className="mt-3 inline-block px-3 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: `hsl(${draft.accentHsl})`,
                color: "hsl(150 55% 10%)",
              }}
            >
              Tombol Aksen
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const SERIF_FONTS = [
  { id: "Playfair Display", label: "Playfair Display" },
  { id: "DM Serif Display", label: "DM Serif Display" },
  { id: "Lora", label: "Lora" },
  { id: "Cormorant Garamond", label: "Cormorant Garamond" },
  { id: "Merriweather", label: "Merriweather" },
];
const SANS_FONTS = [
  { id: "Inter", label: "Inter" },
  { id: "Manrope", label: "Manrope" },
  { id: "Plus Jakarta Sans", label: "Plus Jakarta Sans" },
  { id: "Poppins", label: "Poppins" },
];

function _hslToHex(hsl?: string, fallback = "#1f3a72"): string {
  if (!hsl) return fallback;
  const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!m) return fallback;
  const h = +m[1],
    s = +m[2] / 100,
    l = +m[3] / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + mm) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function _hexToHsl(hex: string, fallback = "220 50% 20%"): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function ColorRow({
  label,
  hsl,
  onChange,
  fallbackHex,
  testid,
}: {
  label: string;
  hsl?: string;
  onChange: (v: string) => void;
  fallbackHex: string;
  testid?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm flex-1">{label}</div>
      <input
        type="color"
        value={_hslToHex(hsl, fallbackHex)}
        onChange={(e) => onChange(_hexToHsl(e.target.value))}
        className="h-9 w-12 rounded cursor-pointer border border-border"
        data-testid={testid}
      />
      {hsl && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => onChange("")}
          data-testid={testid ? `${testid}-reset` : undefined}
        >
          reset
        </button>
      )}
    </div>
  );
}

function StudioTab() {
  const db = useDb();
  const { toast } = useToast();
  const t = useT();
  const initial: StudioSettings = db.appearance.studio ?? {
    fontScale: 1,
    sidebarImageOpacity: 0.18,
    loginHeroOverlayOpacity: 0.55,
  };
  const [draft, setDraft] = useState<StudioSettings>(initial);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<StudioSettings>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const onUploadSidebar = async (file: File) => {
    try {
      setBusy(true);
      const r = await compressImageFile(file, {
        targetBytes: 800_000,
        maxDimension: 1600,
      });
      set({ sidebarImageDataUrl: r.dataUrl });
      toast({ title: t("Gambar siap. Tekan Simpan untuk menerapkan.") });
    } catch (e: any) {
      toast({
        title: t("Gagal memuat gambar"),
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };
  const onUploadHero = async (file: File) => {
    try {
      setBusy(true);
      const r = await compressImageFile(file, {
        targetBytes: 1_000_000,
        maxDimension: 1920,
      });
      set({ loginHeroImageDataUrl: r.dataUrl });
      toast({ title: t("Gambar siap. Tekan Simpan untuk menerapkan.") });
    } catch (e: any) {
      toast({
        title: t("Gagal memuat gambar"),
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const simpan = async () => {
    try {
      await persistAppearance((ap) => {
        ap.studio = { ...(ap.studio ?? {}), ...draft };
      });
      toast({ title: t("Studio diperbarui") });
    } catch (e: any) {
      toast({
        title: t("Gagal menyimpan"),
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };
  const resetSemua = async () => {
    const fresh: StudioSettings = {
      fontScale: 1,
      sidebarImageOpacity: 0.18,
      loginHeroOverlayOpacity: 0.55,
    };
    try {
      await persistAppearance((ap) => {
        ap.studio = fresh;
      });
      setDraft(fresh);
      toast({ title: t("Studio dikembalikan ke bawaan") });
    } catch (e: any) {
      toast({
        title: t("Gagal menyimpan"),
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-serif text-lg flex items-center gap-2">
              <Type className="h-5 w-5" />
              {t("Tipografi")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "Pilih jenis huruf untuk judul dan teks isi, serta atur skala teks global.",
              )}
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Font Judul")}
            </Label>
            <Select
              value={draft.fontSerif ?? "__default"}
              onValueChange={(v) =>
                set({ fontSerif: v === "__default" ? undefined : v })
              }
            >
              <SelectTrigger className="mt-2" data-testid="select-font-serif">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">
                  {t("Bawaan")} (Playfair Display)
                </SelectItem>
                {SERIF_FONTS.map((f) => (
                  <SelectItem
                    key={f.id}
                    value={f.id}
                    style={{ fontFamily: `'${f.id}', serif` }}
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className="mt-3 p-3 rounded border border-border bg-muted/40 text-2xl"
              style={{
                fontFamily: draft.fontSerif
                  ? `'${draft.fontSerif}', serif`
                  : undefined,
              }}
            >
              Aa Bb 123
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Font Isi")}
            </Label>
            <Select
              value={draft.fontSans ?? "__default"}
              onValueChange={(v) =>
                set({ fontSans: v === "__default" ? undefined : v })
              }
            >
              <SelectTrigger className="mt-2" data-testid="select-font-sans">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">{t("Bawaan")} (Inter)</SelectItem>
                {SANS_FONTS.map((f) => (
                  <SelectItem
                    key={f.id}
                    value={f.id}
                    style={{ fontFamily: `'${f.id}', sans-serif` }}
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className="mt-3 p-3 rounded border border-border bg-muted/40 text-base"
              style={{
                fontFamily: draft.fontSans
                  ? `'${draft.fontSans}', sans-serif`
                  : undefined,
              }}
            >
              Aa Bb 123 — kalimat contoh.
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Skala Teks")} ({Math.round((draft.fontScale ?? 1) * 100)}%)
            </Label>
            <input
              type="range"
              min={0.85}
              max={1.2}
              step={0.05}
              value={draft.fontScale ?? 1}
              onChange={(e) => set({ fontScale: parseFloat(e.target.value) })}
              className="w-full mt-3"
              data-testid="range-font-scale"
            />
            <div className="text-xs text-muted-foreground mt-2">
              {t("Berlaku ke seluruh aplikasi.")}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5" />
          {t("Permukaan & Sudut")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Atur warna halaman, kartu, garis batas, serta tingkat kelengkungan sudut.",
          )}
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <ColorRow
            label={t("Warna Halaman")}
            hsl={draft.backgroundHsl}
            onChange={(v) => set({ backgroundHsl: v || undefined })}
            fallbackHex="#ffffff"
            testid="color-bg"
          />
          <ColorRow
            label={t("Warna Teks")}
            hsl={draft.foregroundHsl}
            onChange={(v) => set({ foregroundHsl: v || undefined })}
            fallbackHex="#0f1a33"
            testid="color-fg"
          />
          <ColorRow
            label={t("Warna Kartu")}
            hsl={draft.cardHsl}
            onChange={(v) => set({ cardHsl: v || undefined })}
            fallbackHex="#ffffff"
            testid="color-card"
          />
          <ColorRow
            label={t("Warna Garis")}
            hsl={draft.borderHsl}
            onChange={(v) => set({ borderHsl: v || undefined })}
            fallbackHex="#d6cdb8"
            testid="color-border"
          />
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Sudut")} ({(draft.borderRadius ?? 0.625).toFixed(3)} rem)
            </Label>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.125}
              value={draft.borderRadius ?? 0.625}
              onChange={(e) =>
                set({ borderRadius: parseFloat(e.target.value) })
              }
              className="w-full mt-2"
              data-testid="range-radius"
            />
            <div className="mt-3 flex gap-3">
              <div
                className="h-12 w-24 bg-primary text-primary-foreground grid place-items-center text-xs"
                style={{ borderRadius: `${draft.borderRadius ?? 0.625}rem` }}
              >
                Tombol
              </div>
              <div
                className="h-12 w-24 bg-card border border-border grid place-items-center text-xs"
                style={{ borderRadius: `${draft.borderRadius ?? 0.625}rem` }}
              >
                Kartu
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          {t("Sidebar")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Ganti warna, atau unggah gambar latar untuk sidebar navigasi.")}
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <ColorRow
            label={t("Warna Sidebar")}
            hsl={draft.sidebarHsl}
            onChange={(v) => set({ sidebarHsl: v || undefined })}
            fallbackHex="#0f1a33"
            testid="color-sidebar"
          />
          <ColorRow
            label={t("Warna Teks Sidebar")}
            hsl={draft.sidebarFgHsl}
            onChange={(v) => set({ sidebarFgHsl: v || undefined })}
            fallbackHex="#f4eee2"
            testid="color-sidebar-fg"
          />
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Gambar Latar Sidebar")}
            </Label>
            <div className="flex items-center gap-3 mt-2">
              <label className="inline-flex items-center gap-2 px-3 h-9 rounded border border-border cursor-pointer bg-muted/40 hover:bg-muted text-sm">
                <Upload className="h-4 w-4" /> {t("Unggah")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) =>
                    e.target.files?.[0] && onUploadSidebar(e.target.files[0])
                  }
                  data-testid="file-sidebar-bg"
                />
              </label>
              {draft.sidebarImageDataUrl && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
                  onClick={() => set({ sidebarImageDataUrl: undefined })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("Hapus")}
                </button>
              )}
              {draft.sidebarImageDataUrl && (
                <img
                  src={draft.sidebarImageDataUrl}
                  alt=""
                  className="h-9 w-14 object-cover rounded border border-border"
                />
              )}
            </div>
            <div className="mt-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("Opasitas Gambar")} (
                {Math.round((draft.sidebarImageOpacity ?? 0.18) * 100)}%)
              </Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.sidebarImageOpacity ?? 0.18}
                onChange={(e) =>
                  set({ sidebarImageOpacity: parseFloat(e.target.value) })
                }
                className="w-full mt-2"
                data-testid="range-sidebar-opacity"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          {t("Halaman Masuk")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Ganti gambar dan warna lapisan panel kiri halaman masuk.")}
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Gambar Hero")}
            </Label>
            <div className="flex items-center gap-3 mt-2">
              <label className="inline-flex items-center gap-2 px-3 h-9 rounded border border-border cursor-pointer bg-muted/40 hover:bg-muted text-sm">
                <Upload className="h-4 w-4" /> {t("Unggah")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) =>
                    e.target.files?.[0] && onUploadHero(e.target.files[0])
                  }
                  data-testid="file-login-hero"
                />
              </label>
              {draft.loginHeroImageDataUrl && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
                  onClick={() => set({ loginHeroImageDataUrl: undefined })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("Hapus")}
                </button>
              )}
              {draft.loginHeroImageDataUrl && (
                <img
                  src={draft.loginHeroImageDataUrl}
                  alt=""
                  className="h-9 w-14 object-cover rounded border border-border"
                />
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <ColorRow
              label={t("Warna Lapisan")}
              hsl={draft.loginHeroOverlayHsl}
              onChange={(v) => set({ loginHeroOverlayHsl: v || undefined })}
              fallbackHex="#0f1a33"
              testid="color-login-overlay"
            />
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("Opasitas Lapisan")} (
                {Math.round((draft.loginHeroOverlayOpacity ?? 0.55) * 100)}%)
              </Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.loginHeroOverlayOpacity ?? 0.55}
                onChange={(e) =>
                  set({ loginHeroOverlayOpacity: parseFloat(e.target.value) })
                }
                className="w-full mt-2"
                data-testid="range-login-overlay-opacity"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="sticky bottom-3 z-10 flex justify-between gap-2 pt-2">
        <Button
          variant="outline"
          onClick={resetSemua}
          className="gap-2"
          data-testid="btn-studio-reset"
        >
          <RotateCcw className="h-4 w-4" /> {t("Kembalikan Bawaan")}
        </Button>
        <Button
          onClick={simpan}
          className="gap-2"
          data-testid="btn-studio-simpan"
        >
          <Check className="h-4 w-4" /> {t("Simpan Studio")}
        </Button>
      </div>
    </div>
  );
}

function BahasaTab() {
  const db = useDb();
  const { toast } = useToast();
  const t = useT();
  const [lang, setLang] = useState<Language>(
    normalizeLang(db.appearance.language),
  );

  const simpan = async () => {
    try {
      await persistAppearance((ap) => {
        ap.language = lang;
      });
      toast({ title: t("Bahasa berhasil diganti") });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan ke server",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-5 max-w-2xl">
      <h3 className="font-serif text-lg flex items-center gap-2">
        <Languages className="h-5 w-5" />
        {t("Pilih Bahasa Antarmuka")}
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        Tersedia tiga bahasa antarmuka. Pilihan bawaan aplikasi adalah bahasa
        daerah.
      </p>

      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {[
          {
            id: "btw" as const,
            label: t("Bahasa Betawi"),
            desc: "Logat khas warga asli Jakarta. Ramah, hangat, dan bercita rasa lokal.",
          },
          {
            id: "jkt" as const,
            label: t("Bahasa Jakarta"),
            desc: "Bahasa resmi nasional. Cocok untuk dokumen, pelaporan, dan kebutuhan formal.",
          },
          {
            id: "en" as const,
            label: t("Bahasa Inggris"),
            desc: "English interface for international partners and cross-border collaboration.",
          },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLang(opt.id)}
            className={`text-left rounded-2xl border p-4 transition-all ${lang === opt.id ? "border-accent ring-2 ring-accent/40 bg-accent/5" : "border-border hover:border-accent/50 hover:-translate-y-0.5"}`}
            data-testid={`bahasa-${opt.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-serif text-lg">{opt.label}</div>
              {lang === opt.id && <Check className="h-4 w-4 text-accent" />}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
              {opt.desc}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          onClick={simpan}
          className="gap-1.5"
          data-testid="button-save-bahasa"
        >
          <Sparkles className="h-4 w-4" />
          {t("Simpan Bahasa")}
        </Button>
      </div>

      <div className="mt-5 p-3 border rounded-lg bg-muted/40 text-[12px] text-muted-foreground">
        <strong>Catatan:</strong> Pilihan bahasa berlaku untuk halaman login,
        navigasi sidebar, label peran, dan tombol-tombol utama. Sebagian besar
        konten editorial (nama dokumen, nama acara, dll.) tetap mengikuti
        aslinya.
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TATA NASKAH DINAS — pengaturan dokumen resmi (kop, logo, stempel, format)
// Ditetapkan kurator, otomatis dipakai seluruh dokumen cetak milik sanggar.
// Mengikuti kaidah Tata Naskah Dinas Pemerintah Provinsi DKI Jakarta.
// ═══════════════════════════════════════════════════════════════════════════

/** Nilai baku tata naskah dinas: Times New Roman 12 pt, A4, margin 3-2-2-3 cm. */
const DEF_TATA_NASKAH: TataNaskahSettings = {
  pakaiStempel: false,
  stempelOpacity: 0.85,
  stempelLebarMm: 35,
  stempelPosisi: "kiri-ttd",
  fontKeluarga: "Times New Roman",
  fontUkuranPt: 12,
  spasiBaris: 1.5,
  marginAtasMm: 30,
  marginKiriMm: 30,
  marginKananMm: 20,
  marginBawahMm: 20,
  garisKop: true,
};

/** Kotak unggah gambar dengan pratinjau dan tombol hapus. */
function UnggahGambar({
  judul,
  keterangan,
  nilai,
  onPilih,
  onHapus,
  testId,
  tinggiPratinjau = "h-24",
}: {
  judul: string;
  keterangan: string;
  nilai?: string;
  onPilih: (f: File) => void;
  onHapus: () => void;
  testId: string;
  tinggiPratinjau?: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <Label className="text-sm font-medium">{judul}</Label>
        <p className="text-[11px] text-muted-foreground mt-0.5">{keterangan}</p>
      </div>
      {nilai ? (
        <div
          className={`rounded-md border bg-muted/30 p-2 flex items-center justify-center ${tinggiPratinjau}`}
        >
          <img
            src={nilai}
            alt={judul}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <div
          className={`rounded-md border border-dashed bg-muted/20 flex items-center justify-center text-xs text-muted-foreground ${tinggiPratinjau}`}
        >
          Belum ada berkas
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs cursor-pointer hover-elevate">
          <Upload className="h-3.5 w-3.5" /> {nilai ? "Ganti" : "Unggah"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            data-testid={testId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPilih(f);
              e.target.value = "";
            }}
          />
        </label>
        {nilai && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive h-auto py-1.5"
            onClick={onHapus}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
          </Button>
        )}
      </div>
    </div>
  );
}

function TataNaskahTab() {
  const db = useDb();
  const { toast } = useToast();
  const tersimpan = db.appearance.tataNaskah ?? DEF_TATA_NASKAH;
  const [draft, setDraft] = useState<TataNaskahSettings>({
    ...DEF_TATA_NASKAH,
    ...tersimpan,
  });
  const [busy, setBusy] = useState(false);

  const ubah = <K extends keyof TataNaskahSettings>(
    k: K,
    v: TataNaskahSettings[K],
  ) => setDraft((d) => ({ ...d, [k]: v }));

  // Batas kompresi per jenis berkas. Logo & stempel dicetak kecil sehingga
  // tidak perlu resolusi besar; kop surat membentang selebar halaman.
  // Pengaturan appearance dikirim utuh setiap kali disimpan, jadi ukurannya
  // dijaga agar tidak menembus kuota penyimpanan peramban maupun batas body API.
  const BATAS_UNGGAH = {
    // Logo & stempel wajib transparan (PNG) agar tidak muncul kotak latar —
    // stempel harus tembus pandang saat membayangi tanda tangan.
    logoDataUrl: { targetBytes: 300_000, maxDimension: 512, transparan: true },
    stempelDataUrl: {
      targetBytes: 300_000,
      maxDimension: 600,
      transparan: true,
    },
    // Kop surat umumnya lembar opaque penuh → JPEG (latar putih) lebih ringkas.
    kopDataUrl: { targetBytes: 600_000, maxDimension: 1600 },
  } as const;

  const unggah = async (k: keyof typeof BATAS_UNGGAH, file: File) => {
    try {
      setBusy(true);
      const { dataUrl } = await compressImageFile(file, BATAS_UNGGAH[k]);
      ubah(k, dataUrl);
      toast({ title: "Berkas siap. Tekan Simpan untuk menerapkan." });
    } catch (e: any) {
      toast({
        title: "Gagal memuat gambar",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  /** Perkiraan besar gambar tata naskah saja (logo + kop + stempel). */
  const totalGambarBytes = [
    draft.logoDataUrl,
    draft.kopDataUrl,
    draft.stempelDataUrl,
  ]
    .filter(Boolean)
    .reduce((n, s) => n + Math.ceil(((s as string).length * 3) / 4), 0);

  const simpan = async () => {
    // persistAppearance mengirim SELURUH objek appearance (brand/backdrop/
    // studio/tema + tata naskah). Guard harus menakar seluruhnya, bukan hanya
    // 3 gambar tata naskah — kalau tidak, guard bisa "meloloskan" padahal total
    // sudah menembus kuota localStorage dan simpan gagal di belakang.
    const perkiraanAppearance = JSON.stringify({
      ...db.appearance,
      tataNaskah: draft,
    }).length;
    if (perkiraanAppearance > 3_800_000) {
      toast({
        title: "Total pengaturan terlalu besar",
        description: `Perkiraan ${(perkiraanAppearance / 1_000_000).toFixed(1)} MB (termasuk brand, latar, & tata naskah) — melebihi ambang aman ~3,8 MB. Kurangi ukuran logo/kop/stempel atau gambar brand/latar.`,
        variant: "destructive",
      });
      return;
    }
    if (totalGambarBytes > 1_500_000) {
      toast({
        title: "Berkas tata naskah terlalu besar",
        description: `Total logo, kop, dan stempel ${(totalGambarBytes / 1_000_000).toFixed(1)} MB — maksimal 1,5 MB. Ganti dengan berkas beresolusi lebih kecil.`,
        variant: "destructive",
      });
      return;
    }
    try {
      setBusy(true);
      await persistAppearance((ap) => {
        ap.tataNaskah = { ...draft };
      });
      toast({
        title: "Pengaturan tata naskah disimpan",
        description:
          "Seluruh dokumen sanggar otomatis mengikuti pengaturan ini.",
      });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const kembalikanBaku = async () => {
    if (
      !confirm(
        "Kembalikan format ke standar Tata Naskah Dinas DKI Jakarta? Berkas logo, kop, dan stempel tetap tersimpan.",
      )
    )
      return;
    const next: TataNaskahSettings = {
      ...DEF_TATA_NASKAH,
      logoDataUrl: draft.logoDataUrl,
      kopDataUrl: draft.kopDataUrl,
      stempelDataUrl: draft.stempelDataUrl,
      namaInstansi: draft.namaInstansi,
    };
    setDraft(next);
    try {
      await persistAppearance((ap) => {
        ap.tataNaskah = next;
      });
      toast({ title: "Format dikembalikan ke standar DKI Jakarta" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const barisKopTeks = (draft.barisKop ?? []).join("\n");

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <div className="space-y-4">
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-serif text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo, Kop Surat & Stempel
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Unggah berkas resmi lembaga. Dokumen yang dibuat sanggar otomatis
              memakai berkas ini.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <UnggahGambar
              judul="Logo Lembaga"
              keterangan="Ditempatkan pada sisi kiri kop surat. Disarankan berlatar transparan (PNG)."
              nilai={draft.logoDataUrl}
              onPilih={(f) => unggah("logoDataUrl", f)}
              onHapus={() => ubah("logoDataUrl", undefined)}
              testId="input-naskah-logo"
            />
            <UnggahGambar
              judul="Stempel / Cap Dinas"
              keterangan="Ditempel membayangi ruang tanda tangan, tidak menggeser tata letak."
              nilai={draft.stempelDataUrl}
              onPilih={(f) => unggah("stempelDataUrl", f)}
              onHapus={() => ubah("stempelDataUrl", undefined)}
              testId="input-naskah-stempel"
            />
          </div>

          <UnggahGambar
            judul="Kop Surat Utuh (opsional)"
            keterangan="Bila lembaga sudah punya berkas kop resmi, unggah di sini. Kop ini menggantikan kop tersusun di atas."
            nilai={draft.kopDataUrl}
            onPilih={(f) => unggah("kopDataUrl", f)}
            onHapus={() => ubah("kopDataUrl", undefined)}
            testId="input-naskah-kop"
            tinggiPratinjau="h-28"
          />
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Penggunaan Stempel
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Bubuhkan stempel pada dokumen</Label>
              <p className="text-[11px] text-muted-foreground">
                Stempel muncul pada blok tanda tangan setiap dokumen cetak.
              </p>
            </div>
            <Switch
              checked={draft.pakaiStempel ?? false}
              onCheckedChange={(v) => ubah("pakaiStempel", v)}
              data-testid="switch-pakai-stempel"
            />
          </div>
          {draft.pakaiStempel && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Posisi</Label>
                <Select
                  value={draft.stempelPosisi ?? "kiri-ttd"}
                  onValueChange={(v) =>
                    ubah(
                      "stempelPosisi",
                      v as TataNaskahSettings["stempelPosisi"],
                    )
                  }
                >
                  <SelectTrigger data-testid="select-stempel-posisi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kiri-ttd">Kiri tanda tangan</SelectItem>
                    <SelectItem value="tengah-ttd">
                      Menimpa tanda tangan
                    </SelectItem>
                    <SelectItem value="kanan-ttd">
                      Kanan tanda tangan
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lebar (mm)</Label>
                <Input
                  type="number"
                  min={15}
                  max={80}
                  value={draft.stempelLebarMm ?? 35}
                  onChange={(e) =>
                    ubah("stempelLebarMm", Number(e.target.value) || 35)
                  }
                  data-testid="input-stempel-lebar"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Ketebalan warna (
                  {Math.round((draft.stempelOpacity ?? 0.85) * 100)}%)
                </Label>
                <Input
                  type="range"
                  min={20}
                  max={100}
                  value={Math.round((draft.stempelOpacity ?? 0.85) * 100)}
                  onChange={(e) =>
                    ubah("stempelOpacity", Number(e.target.value) / 100)
                  }
                  data-testid="input-stempel-opacity"
                />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-serif text-lg flex items-center gap-2">
              <Type className="h-5 w-5" />
              Format Naskah
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Nilai baku mengikuti kaidah naskah dinas: Times New Roman 12 pt,
              kertas A4, margin 3 cm (atas/kiri) dan 2 cm (kanan/bawah).
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Jenis Huruf</Label>
              <Select
                value={draft.fontKeluarga ?? "Times New Roman"}
                onValueChange={(v) => ubah("fontKeluarga", v)}
              >
                <SelectTrigger data-testid="select-font">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Times New Roman">
                    Times New Roman (baku)
                  </SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Cambria">Cambria</SelectItem>
                  <SelectItem value="Bookman Old Style">
                    Bookman Old Style
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ukuran Huruf (pt)</Label>
              <Input
                type="number"
                min={9}
                max={16}
                step={0.5}
                value={draft.fontUkuranPt ?? 12}
                onChange={(e) =>
                  ubah("fontUkuranPt", Number(e.target.value) || 12)
                }
                data-testid="input-font-size"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Jarak Baris</Label>
              <Select
                value={String(draft.spasiBaris ?? 1.5)}
                onValueChange={(v) => ubah("spasiBaris", Number(v))}
              >
                <SelectTrigger data-testid="select-spasi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (rapat)</SelectItem>
                  <SelectItem value="1.15">1,15</SelectItem>
                  <SelectItem value="1.5">1,5 (baku)</SelectItem>
                  <SelectItem value="1.8">1,8</SelectItem>
                  <SelectItem value="2">2 (renggang)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Margin Halaman (mm)</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {(
                [
                  ["marginAtasMm", "Atas"],
                  ["marginKananMm", "Kanan"],
                  ["marginBawahMm", "Bawah"],
                  ["marginKiriMm", "Kiri"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {label}
                  </Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={draft[k] ?? 20}
                    onChange={(e) => ubah(k, Number(e.target.value) || 0)}
                    data-testid={`input-${k}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Isi Kop Surat
          </h3>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Nama Lembaga pada Kop (kosongkan untuk memakai nama sanggar)
            </Label>
            <Input
              value={draft.namaInstansi ?? ""}
              placeholder="mis. Dinas Kebudayaan Provinsi DKI Jakarta"
              onChange={(e) =>
                ubah("namaInstansi", e.target.value || undefined)
              }
              data-testid="input-nama-instansi"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Baris Keterangan Kop (satu per baris — kosongkan untuk memakai
              data sanggar)
            </Label>
            <Textarea
              rows={3}
              value={barisKopTeks}
              placeholder={
                "Jalan ... No. ..., Jakarta\nTelepon (021) ... · Laman: ..."
              }
              onChange={(e) => {
                const baris = e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                ubah("barisKop", baris.length ? baris : undefined);
              }}
              data-testid="input-baris-kop"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Garis pembatas kop</Label>
              <p className="text-[11px] text-muted-foreground">
                Garis ganda di bawah kop sesuai kaidah naskah dinas.
              </p>
            </div>
            <Switch
              checked={draft.garisKop !== false}
              onCheckedChange={(v) => ubah("garisKop", v)}
              data-testid="switch-garis-kop"
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={simpan}
            disabled={busy}
            data-testid="button-simpan-naskah"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {busy ? "Menyimpan…" : "Simpan Pengaturan"}
          </Button>
          <Button
            variant="outline"
            onClick={kembalikanBaku}
            disabled={busy}
            data-testid="button-reset-naskah"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Kembalikan ke Standar DKI
          </Button>
        </div>
      </div>

      {/* Pratinjau */}
      <div className="space-y-3">
        <Card className="p-4 space-y-3 lg:sticky lg:top-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Pratinjau Dokumen
          </h4>
          <div
            className="rounded-md border bg-white text-black p-3 overflow-hidden"
            style={{
              fontFamily: `"${draft.fontKeluarga ?? "Times New Roman"}", serif`,
              fontSize: `${Math.max(7, (draft.fontUkuranPt ?? 12) * 0.62)}pt`,
              lineHeight: draft.spasiBaris ?? 1.5,
            }}
          >
            {draft.kopDataUrl ? (
              <img
                src={draft.kopDataUrl}
                alt="Kop"
                className="w-full object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                {draft.logoDataUrl && (
                  <img
                    src={draft.logoDataUrl}
                    alt=""
                    className="h-10 w-10 object-contain shrink-0"
                  />
                )}
                <div className="flex-1 text-center leading-tight">
                  <div className="font-bold uppercase text-[10px]">
                    {draft.namaInstansi?.trim() || "Nama Sanggar"}
                  </div>
                  <div className="text-[8px] text-neutral-600">
                    {(draft.barisKop ?? ["Alamat sanggar, Jakarta"])[0]}
                  </div>
                </div>
              </div>
            )}
            {draft.garisKop !== false && (
              <div className="mt-1.5">
                <div className="border-t-2 border-[#005A2B]" />
                <div className="border-t border-[#FF3D16] mt-[2px]" />
              </div>
            )}
            <div className="mt-2 text-center font-bold underline text-[9px]">
              SURAT KETERANGAN
            </div>
            <div className="mt-1.5 text-[8px] text-justify text-neutral-800">
              Yang bertanda tangan di bawah ini menerangkan bahwa dokumen ini
              dibuat sesuai ketentuan tata naskah dinas yang berlaku.
            </div>
            <div className="mt-3 flex justify-end">
              <div
                className="text-center text-[8px] relative"
                style={{ minWidth: 96 }}
              >
                <div>Jakarta, 29 Juli 2026</div>
                <div>Ketua Sanggar</div>
                <div className="relative" style={{ height: 34 }}>
                  {draft.pakaiStempel && draft.stempelDataUrl && (
                    <img
                      src={draft.stempelDataUrl}
                      alt=""
                      className="absolute object-contain"
                      style={{
                        width: `${(draft.stempelLebarMm ?? 35) * 0.9}px`,
                        opacity: draft.stempelOpacity ?? 0.85,
                        top: 2,
                        ...(draft.stempelPosisi === "kanan-ttd"
                          ? { right: -6 }
                          : draft.stempelPosisi === "tengah-ttd"
                            ? { left: "50%", transform: "translateX(-50%)" }
                            : { left: -6 }),
                      }}
                    />
                  )}
                </div>
                <div className="font-bold underline">Nama Ketua</div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pratinjau bersifat perkiraan. Ukuran sebenarnya mengikuti kertas A4
            saat dicetak.
          </p>
        </Card>
      </div>
    </div>
  );
}

function BrandTab() {
  const db = useDb();
  const { toast } = useToast();
  const b = db.appearance.brand ?? {
    appName: "Jak Sanggar",
    appTagline: "",
    sidebarFooterLine1: "",
    sidebarFooterLine2: "",
    iconKey: "Sparkles",
  };
  const [draft, setDraft] = useState(b);
  const [busy, setBusy] = useState(false);

  const onUpload = async (file: File) => {
    try {
      setBusy(true);
      const url = await readImageFile(file, 1_500_000);
      setDraft((d) => ({ ...d, logoDataUrl: url }));
      toast({ title: "Logo siap. Tekan Simpan untuk menerapkan." });
    } catch (e: any) {
      toast({
        title: "Gagal memuat gambar",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeLogo = () => setDraft((d) => ({ ...d, logoDataUrl: undefined }));

  const simpan = async () => {
    if (!draft.appName.trim()) {
      toast({ title: "Nama aplikasi wajib diisi", variant: "destructive" });
      return;
    }
    try {
      await persistAppearance((ap) => {
        ap.brand = { ...draft, appName: draft.appName.trim() };
      });
      toast({ title: "Identitas brand disimpan" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const reset = async () => {
    if (!confirm("Kembalikan semua identitas brand ke default Jak Sanggar?"))
      return;
    const def = {
      appName: "Jak Sanggar",
      appTagline: "Budaya Naik Kelas, Digital Tanpa Batas",
      sidebarFooterLine1: "Budaya Naik Kelas,",
      sidebarFooterLine2: "Digital Tanpa Batas",
      iconKey: "Sparkles",
      loginEyebrow: "Konsorsium Sanggar Seni",
    };
    try {
      await persistAppearance((ap) => {
        ap.brand = def;
      });
      setDraft(def);
      toast({ title: "Brand dikembalikan ke default" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const PreviewIcon = getBrandIcon(draft.iconKey);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4">
        <Card className="p-5 space-y-4">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Type className="h-5 w-5" />
            Teks Identitas
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nama Aplikasi</Label>
              <Input
                value={draft.appName}
                onChange={(e) =>
                  setDraft({ ...draft, appName: e.target.value })
                }
                data-testid="input-brand-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Eyebrow Login</Label>
              <Input
                value={draft.loginEyebrow ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, loginEyebrow: e.target.value })
                }
                placeholder="mis. Konsorsium Sanggar Seni"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tagline Utama (ditampilkan di halaman login & header)</Label>
            <Textarea
              rows={2}
              value={draft.appTagline}
              onChange={(e) =>
                setDraft({ ...draft, appTagline: e.target.value })
              }
              placeholder="Budaya Naik Kelas, Digital Tanpa Batas"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Footer Sidebar — Baris 1</Label>
              <Input
                value={draft.sidebarFooterLine1}
                onChange={(e) =>
                  setDraft({ ...draft, sidebarFooterLine1: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer Sidebar — Baris 2</Label>
              <Input
                value={draft.sidebarFooterLine2}
                onChange={(e) =>
                  setDraft({ ...draft, sidebarFooterLine2: e.target.value })
                }
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Ikon Brand
          </h3>
          <p className="text-xs text-muted-foreground">
            Pilih satu ikon untuk identitas. Jika logo diunggah, logo otomatis
            menggantikan ikon.
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {BRAND_ICON_KEYS.map(({ key, label }) => {
              const Ico = getBrandIcon(key);
              const active = draft.iconKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft({ ...draft, iconKey: key })}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 transition ${active ? "border-accent ring-2 ring-accent/40 bg-accent/10" : "border-border hover:border-accent/50"}`}
                  title={label}
                  data-testid={`icon-${key}`}
                >
                  <Ico className="h-5 w-5" />
                  <span className="text-[9.5px] leading-tight text-muted-foreground">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Logo (PNG/JPG, maks 1.5 MB)
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-16 w-16 rounded-lg border bg-muted/30 grid place-items-center overflow-hidden">
              {draft.logoDataUrl ? (
                <img
                  src={draft.logoDataUrl}
                  alt="logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <PreviewIcon className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer hover-elevate">
              <Upload className="h-4 w-4" />
              {busy
                ? "Memproses..."
                : draft.logoDataUrl
                  ? "Ganti Logo"
                  : "Unggah Logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && onUpload(e.target.files[0])
                }
              />
            </label>
            {draft.logoDataUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={removeLogo}
                className="gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Hapus Logo
              </Button>
            )}
          </div>
        </Card>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={simpan}
            className="gap-1.5"
            data-testid="button-save-brand"
          >
            <Sparkles className="h-4 w-4" />
            Simpan Identitas
          </Button>
          <Button variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Kembalikan Default
          </Button>
        </div>
      </div>

      <Card className="p-4 h-fit lg:sticky lg:top-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Pratinjau
        </div>
        <div
          className="rounded-xl p-4 text-amber-50"
          style={{
            background:
              "linear-gradient(135deg, hsl(150 60% 9%) 0%, hsl(18 60% 20%) 100%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-10 w-10 rounded-lg overflow-hidden grid place-items-center"
              style={{
                background:
                  "linear-gradient(135deg, hsl(42 80% 60%), hsl(38 65% 42%))",
              }}
            >
              {draft.logoDataUrl ? (
                <img
                  src={draft.logoDataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <PreviewIcon
                  className="h-5 w-5"
                  style={{ color: "hsl(150 55% 12%)" }}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-serif text-base truncate">
                {draft.appName || "—"}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-100/85 truncate">
                {draft.loginEyebrow || "—"}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[12px] italic text-amber-100/80 leading-snug min-h-[36px]">
            "{draft.appTagline || "—"}"
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-[11px] font-medium uppercase tracking-widest text-amber-100/85">
              {draft.sidebarFooterLine1 || "—"}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-amber-100/85">
              {draft.sidebarFooterLine2 || "—"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BackdropTab() {
  const db = useDb();
  const { toast } = useToast();
  const bd = db.appearance.backdrop ?? {
    enabled: false,
    opacity: 0.18,
    blendMode: "soft-light" as const,
  };
  const [draft, setDraft] = useState(bd);
  const [busy, setBusy] = useState(false);

  const fmtKB = (b: number) =>
    b >= 1_000_000
      ? `${(b / 1_000_000).toFixed(2)} MB`
      : `${Math.round(b / 1024)} KB`;

  const onUpload = async (file: File) => {
    try {
      setBusy(true);
      const r = await compressImageFile(file, {
        targetBytes: 900_000,
        maxDimension: 1920,
      });
      setDraft((d) => ({ ...d, imageDataUrl: r.dataUrl, enabled: true }));
      const ratio =
        r.originalBytes > 0
          ? Math.round((r.finalBytes / r.originalBytes) * 100)
          : 100;
      toast({
        title: "Backdrop siap dipakai",
        description: `Gambar dikecilkan otomatis: ${fmtKB(r.originalBytes)} → ${fmtKB(r.finalBytes)} (${ratio}%) pada ${r.width}×${r.height}px. Tekan Simpan untuk menerapkan.`,
      });
    } catch (e: any) {
      toast({
        title: "Gagal memuat gambar",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const simpan = async () => {
    try {
      await persistAppearance((ap) => {
        ap.backdrop = draft;
      });
      toast({ title: "Backdrop disimpan" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description:
          e?.message ?? "Gambar terlalu besar untuk penyimpanan lokal.",
        variant: "destructive",
      });
    }
  };

  const reset = async () => {
    if (!confirm("Hapus backdrop & kembalikan ke default?")) return;
    const def = {
      enabled: false,
      opacity: 0.18,
      blendMode: "soft-light" as const,
      imageDataUrl: undefined,
    };
    try {
      await persistAppearance((ap) => {
        ap.backdrop = def;
      });
      setDraft(def);
      toast({ title: "Backdrop dihapus" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <Card className="p-5 space-y-4">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Gambar Latar Belakang
        </h3>
        <p className="text-sm text-muted-foreground">
          Unggah gambar apa pun (PNG/JPG/WebP) — sistem akan otomatis
          mengecilkan & mengoptimasi (resize ≤ 1920px, kompresi JPEG) supaya
          hemat penyimpanan tanpa Anda repot. Ideal: 1920×1080 atau lebih.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-20 w-32 rounded-md border bg-muted/30 grid place-items-center overflow-hidden">
            {draft.imageDataUrl ? (
              <img
                src={draft.imageDataUrl}
                alt="backdrop"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Belum ada
              </span>
            )}
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer hover-elevate">
            <Upload className="h-4 w-4" />
            {busy
              ? "Memproses..."
              : draft.imageDataUrl
                ? "Ganti Gambar"
                : "Unggah Gambar"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && onUpload(e.target.files[0])
              }
            />
          </label>
          {draft.imageDataUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  imageDataUrl: undefined,
                  enabled: false,
                }))
              }
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Hapus
            </Button>
          )}
        </div>

        <label className="flex items-center justify-between border rounded-md px-3 py-2.5 text-sm">
          <div>
            <div className="font-medium">Aktifkan Backdrop</div>
            <div className="text-[11px] text-muted-foreground">
              Hanya berlaku jika gambar sudah diunggah.
            </div>
          </div>
          <Switch
            checked={!!draft.enabled}
            disabled={!draft.imageDataUrl}
            onCheckedChange={(c) => setDraft({ ...draft, enabled: c })}
            data-testid="switch-backdrop"
          />
        </label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Opasitas</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round((draft.opacity ?? 0.18) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((draft.opacity ?? 0.18) * 100)}
            onChange={(e) =>
              setDraft({ ...draft, opacity: Number(e.target.value) / 100 })
            }
            className="w-full"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Mode Pencampuran</Label>
          <Select
            value={draft.blendMode ?? "soft-light"}
            onValueChange={(v: any) => setDraft({ ...draft, blendMode: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="soft-light">Soft Light (lembut)</SelectItem>
              <SelectItem value="overlay">Overlay (dramatis)</SelectItem>
              <SelectItem value="multiply">Multiply (gelap)</SelectItem>
              <SelectItem value="screen">Screen (terang)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button onClick={simpan} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Simpan Backdrop
          </Button>
          <Button variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </Card>

      <Card className="p-4 h-fit lg:sticky lg:top-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Pratinjau Halaman
        </div>
        <div className="relative rounded-xl overflow-hidden border h-56 bg-background">
          {draft.imageDataUrl && draft.enabled && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${draft.imageDataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: draft.opacity ?? 0.18,
                mixBlendMode: (draft.blendMode ?? "soft-light") as any,
              }}
            />
          )}
          <div className="relative p-3 space-y-2">
            <div className="h-3 w-32 rounded bg-foreground/20" />
            <div className="h-2 w-48 rounded bg-foreground/10" />
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-md border bg-card/70 backdrop-blur-sm"
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TradisiTab() {
  const db = useDb();
  const { toast } = useToast();
  const t = db.appearance.tradisi ?? {
    enabled: true,
    position: "br" as const,
    cooldownMs: 2200,
    autoHideMs: 4200,
    cardWidth: 280,
    showCloseButton: true,
    source: "default" as const,
    custom: [] as TradisiItem[],
    kategoriColors: {},
  };
  const [draft, setDraft] = useState(t);

  const dirty = JSON.stringify(draft) !== JSON.stringify(t);

  const simpanSemua = async () => {
    try {
      await persistAppearance((ap) => {
        ap.tradisi = { ...draft };
      });
      toast({ title: "Pengaturan tradisi disimpan" });
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };
  const batalkan = () => {
    setDraft(t);
    toast({ title: "Perubahan dibatalkan" });
  };

  const setKategoriColor = (k: TradisiKategori, color: string) => {
    setDraft((d) => ({
      ...d,
      kategoriColors: { ...d.kategoriColors, [k]: color },
    }));
  };
  const resetWarna = () => {
    setDraft((d) => ({ ...d, kategoriColors: { ...DEFAULT_KATEGORI_COLOR } }));
  };

  const addItem = () => {
    const next: TradisiItem = {
      id: uid(),
      kategori: "Pantun Betawi",
      judul: "Judul Baru",
      isi: "Tulis isi pantun di sini...",
      sumber: "",
    };
    setDraft((d) => ({ ...d, custom: [next, ...d.custom] }));
  };
  const updateItem = (id: string, patch: Partial<TradisiItem>) => {
    setDraft((d) => ({
      ...d,
      custom: d.custom.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  };
  const removeItem = (id: string) => {
    if (
      !confirm(
        "Hapus pantun ini? (Belum tersimpan permanen sampai Anda menekan Simpan)",
      )
    )
      return;
    setDraft((d) => ({ ...d, custom: d.custom.filter((x) => x.id !== id) }));
  };
  const importDefault = () => {
    if (
      !confirm(
        `Salin ${DEFAULT_TRADISI_POOL.length} pantun bawaan ke daftar custom (untuk diedit)?`,
      )
    )
      return;
    const copied: TradisiItem[] = DEFAULT_TRADISI_POOL.map((x) => ({
      ...x,
      id: uid(),
    }));
    setDraft((d) => ({ ...d, custom: [...copied, ...d.custom] }));
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Perilaku Pop-up
        </h3>

        <label className="flex items-center justify-between border rounded-md px-3 py-2.5 text-sm">
          <div>
            <div className="font-medium">Aktifkan Pop-up Tradisi</div>
            <div className="text-[11px] text-muted-foreground">
              Muncul ketika pengguna mengklik tombol/tautan apa pun.
            </div>
          </div>
          <Switch
            checked={!!draft.enabled}
            onCheckedChange={(c) => setDraft({ ...draft, enabled: c })}
            data-testid="switch-tradisi-enabled"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Posisi Pop-up</Label>
            <Select
              value={draft.position}
              onValueChange={(v: any) => setDraft({ ...draft, position: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="br">Kanan Bawah</SelectItem>
                <SelectItem value="bl">Kiri Bawah</SelectItem>
                <SelectItem value="tr">Kanan Atas</SelectItem>
                <SelectItem value="tl">Kiri Atas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sumber Pantun</Label>
            <Select
              value={draft.source}
              onValueChange={(v: any) => setDraft({ ...draft, source: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Bawaan (28 pantun)</SelectItem>
                <SelectItem value="custom">Hanya Custom</SelectItem>
                <SelectItem value="merge">Bawaan + Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Jeda Antar Pop-up (ms)</Label>
            <Input
              type="number"
              min={500}
              max={20000}
              step={100}
              value={draft.cooldownMs}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  cooldownMs: Number(e.target.value) || 2200,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Durasi Tampil (ms)</Label>
            <Input
              type="number"
              min={1000}
              max={30000}
              step={100}
              value={draft.autoHideMs}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  autoHideMs: Number(e.target.value) || 4200,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lebar Kartu (px)</Label>
            <Input
              type="number"
              min={220}
              max={420}
              step={10}
              value={draft.cardWidth}
              onChange={(e) =>
                setDraft({ ...draft, cardWidth: Number(e.target.value) || 280 })
              }
            />
          </div>
        </div>

        <label className="flex items-center justify-between border rounded-md px-3 py-2.5 text-sm">
          <div>
            <div className="font-medium">Tampilkan Tombol Tutup (×)</div>
            <div className="text-[11px] text-muted-foreground">
              Muncul saat pop-up dihover.
            </div>
          </div>
          <Switch
            checked={!!draft.showCloseButton}
            onCheckedChange={(c) => setDraft({ ...draft, showCloseButton: c })}
          />
        </label>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-serif text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Warna per Kategori
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tentukan warna aksen untuk setiap kategori pantun.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={resetWarna}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Warna
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {KATEGORI_LIST.map((k) => {
            const c = draft.kategoriColors?.[k] ?? DEFAULT_KATEGORI_COLOR[k];
            return (
              <div key={k} className="border rounded-lg p-3 space-y-2">
                <div className="text-xs font-medium">{k}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => setKategoriColor(k, e.target.value)}
                    className="h-9 w-12 rounded cursor-pointer"
                  />
                  <Input
                    value={c}
                    onChange={(e) => setKategoriColor(k, e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div
                  className="rounded-md px-2 py-1 text-[10px] uppercase tracking-wider inline-block"
                  style={{
                    background: `${c}1f`,
                    color: c,
                    border: `1px solid ${c}55`,
                  }}
                >
                  contoh
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-serif text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Daftar Pantun Custom ({draft.custom.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kelola isi tradisi lisan. Aktif sesuai pilihan "Sumber Pantun" di
              atas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={importDefault}
              className="gap-1"
            >
              <FileDown className="h-3.5 w-3.5" />
              Salin Bawaan
            </Button>
            <Button
              size="sm"
              onClick={addItem}
              className="gap-1"
              data-testid="button-add-pantun"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </Button>
          </div>
        </div>

        {draft.custom.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg">
            Belum ada pantun custom. Klik "Tambah" atau "Salin Bawaan" untuk
            memulai.
          </div>
        )}

        <div className="space-y-3">
          {draft.custom.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 space-y-2">
              <div className="grid sm:grid-cols-[180px_1fr_auto] gap-2 items-start">
                <Select
                  value={item.kategori}
                  onValueChange={(v: any) =>
                    updateItem(item.id, { kategori: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORI_LIST.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={item.judul}
                  onChange={(e) =>
                    updateItem(item.id, { judul: e.target.value })
                  }
                  placeholder="Judul"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => removeItem(item.id)}
                  title="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                rows={3}
                value={item.isi}
                onChange={(e) => updateItem(item.id, { isi: e.target.value })}
                placeholder="Isi pantun (gunakan Enter untuk baris baru)"
                className="font-serif"
              />
              <Input
                value={item.sumber ?? ""}
                onChange={(e) =>
                  updateItem(item.id, { sumber: e.target.value })
                }
                placeholder="Sumber (opsional)"
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-2 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="text-amber-600 dark:text-amber-400">
              ● Ada perubahan belum tersimpan
            </span>
          ) : (
            <span>Semua tersimpan</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={batalkan}
            disabled={!dirty}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Batalkan
          </Button>
          <Button
            onClick={simpanSemua}
            disabled={!dirty}
            className="gap-1.5"
            data-testid="button-save-tradisi"
          >
            <Sparkles className="h-4 w-4" />
            Simpan Semua
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KuratorWaktu() {
  const db = useDb();
  const { toast } = useToast();
  const [j, setJ] = useState(db.jamPembinaan);
  const [pwd, setPwd] = useState(db.exportPassword);
  return (
    <div>
      <PageHeader
        title="Pengaturan Jam Pembinaan & Sistem"
        subtitle="Atur batas waktu absensi dan password unduhan."
      />
      <Card className="p-5 max-w-2xl space-y-4">
        <h3 className="font-serif text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Window Absensi
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            l="Pagi (maks)"
            v={j.pagiMax}
            on={(v) => setJ({ ...j, pagiMax: v })}
          />
          <Field
            l="Siang Mulai"
            v={j.siangStart}
            on={(v) => setJ({ ...j, siangStart: v })}
          />
          <Field
            l="Siang Selesai"
            v={j.siangEnd}
            on={(v) => setJ({ ...j, siangEnd: v })}
          />
          <Field
            l="Pulang Mulai"
            v={j.pulangStart}
            on={(v) => setJ({ ...j, pulangStart: v })}
          />
          <Field
            l="Pulang Selesai"
            v={j.pulangEnd}
            on={(v) => setJ({ ...j, pulangEnd: v })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Password Edit PDF (digunakan oleh seluruh Sanggar)</Label>
          <Input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Minimal 6 karakter. PDF yang diekspor dapat dibuka langsung tanpa
            password; password ini hanya diperlukan ketika seseorang ingin
            mengedit isi PDF tersebut.
          </p>
        </div>
        <Button
          onClick={async () => {
            if (pwd.trim().length < 6) {
              toast({
                title: "Password edit terlalu pendek",
                description:
                  "Gunakan minimal 6 karakter agar perlindungan edit PDF efektif.",
                variant: "destructive",
              });
              return;
            }
            save((d) => {
              d.exportPassword = pwd.trim();
            });
            try {
              await persistSetting("jamPembinaan", j);
              toast({ title: "Pengaturan disimpan" });
            } catch {
              toast({
                title: "Gagal menyimpan ke server. Coba lagi.",
                variant: "destructive",
              });
            }
          }}
        >
          Simpan
        </Button>
      </Card>
    </div>
  );
}
function Field({
  l,
  v,
  on,
}: {
  l: string;
  v: string;
  on: (s: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{l}</Label>
      <Input type="time" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
