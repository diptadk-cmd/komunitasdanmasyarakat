import { useState } from "react";
import { Link } from "wouter";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Download,
  ExternalLink,
  FileCheck2,
  FileUp,
  Handshake,
  ImagePlus,
  MapPin,
  PackagePlus,
  Pencil,
  Save,
  ShoppingBag,
  Store,
  Stamp,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { logActivity, save, uid } from "@/lib/store";
import { uploadsApi, usersApi } from "@/lib/api";
import type {
  Bank,
  BentukUsahaPengrajin,
  DokumenPengrajin,
  JenisDokumenPengrajin,
  JenisKerajinan,
  PengrajinUser,
  ProdukKerajinan,
  SatuanProdukKerajinan,
} from "@/lib/types";
import { DashboardWelcome, DashboardMetrics, DashboardLinks } from "@/components/layout/RoleWorkspace";
import { ShareLocation, mapsUrl } from "@/components/system/ShareLocation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatAlamatWilayah } from "@/lib/regions";
import {
  unduhProfilDokumen,
  type DataProfilDokumen,
} from "@/lib/profil-dokumen";
import type { FormatUnduhanDokumen } from "@/lib/dokumen-export";

const JENIS_KERAJINAN: JenisKerajinan[] = [
  "Batik Betawi",
  "Ondel-ondel",
  "Miniatur",
  "Aksesori",
  "Kuliner Tradisional",
  "Alat Musik",
  "Kerajinan Lainnya",
];
const BANKS: Bank[] = ["BCA", "Mandiri", "DKI", "BRI", "BNI", "BSI", "CIMB"];
const DOKUMEN: JenisDokumenPengrajin[] = [
  "NPWP",
  "NIB",
  "Bukti Rekening",
  "Akta / Legalitas",
  "Dokumen Lainnya",
];
const SATUAN: SatuanProdukKerajinan[] = [
  "buah",
  "set",
  "paket",
  "hari",
  "acara",
];
const demoLokal = import.meta.env.VITE_DEMO_MODE === "true";

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Berkas tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

export type PengrajinSection = "dashboard" | "profil" | "produk";

const SECTION_TITLE: Record<
  PengrajinSection,
  { title: string; subtitle: string }
> = {
  dashboard: { title: "Beranda pengrajin", subtitle: "Kelola produk dan kebutuhan toko Anda." },
  profil: {
    title: "Profil Toko",
    subtitle:
      "Kelola identitas, toko dan peta, legalitas, rekening, serta dokumen usaha dalam satu halaman.",
  },
  produk: {
    title: "Produk Khas Jakarta",
    subtitle:
      "Kelola kerajinan; hanya produk khas Jakarta yang dapat dipublikasikan.",
  },
};

export default function PengrajinHome({
  section = "dashboard",
}: {
  section?: PengrajinSection;
}) {
  const { user, setSession } = useAuth();
  const { toast } = useToast();
  const pengrajin = user?.role === "pengrajin" ? (user as PengrajinUser) : null;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [produkEdit, setProdukEdit] = useState<ProdukKerajinan | null>(null);
  const [jenisDokumen, setJenisDokumen] =
    useState<JenisDokumenPengrajin>("NPWP");
  const [draft, setDraft] = useState(() => ({
    namaUsaha: pengrajin?.namaUsaha ?? "",
    namaPemilik: pengrajin?.namaPemilik ?? "",
    bentukUsaha:
      pengrajin?.bentukUsaha ?? ("Perorangan" as BentukUsahaPengrajin),
    namaBadanUsaha: pengrajin?.namaBadanUsaha ?? "",
    jenisKerajinan:
      pengrajin?.jenisKerajinan ?? ("Kerajinan Lainnya" as JenisKerajinan),
    produkUnggulan: pengrajin?.produkUnggulan ?? "",
    produk: [...(pengrajin?.produk ?? [])],
    alamat: pengrajin?.alamat ?? "",
    wilayah: pengrajin?.wilayah ?? {},
    lat: pengrajin?.lat ?? 0,
    lng: pengrajin?.lng ?? 0,
    deskripsi: pengrajin?.deskripsi ?? "",
    website: pengrajin?.website ?? "",
    instagram: pengrajin?.instagram ?? "",
    email: pengrajin?.email ?? "",
    noHp: pengrajin?.noHp ?? "",
    npwp: pengrajin?.npwp ?? "",
    statusPkp: pengrajin?.statusPkp ?? "non_pkp",
    pemotongPajak: pengrajin?.pemotongPajak ?? false,
    nib: pengrajin?.nib ?? "",
    rekening: pengrajin?.rekening ?? {
      bank: "BCA" as Bank,
      nomor: "",
      atasNama: pengrajin?.namaPemilik ?? "",
    },
    dokumen: [...(pengrajin?.dokumen ?? [])],
    tokoDipublikasikan: pengrajin?.tokoDipublikasikan ?? true,
    menerimaSewaJasa: pengrajin?.menerimaSewaJasa ?? false,
    menerimaKerjasama: pengrajin?.menerimaKerjasama ?? false,
    logoDataUrl: pengrajin?.logoDataUrl ?? pengrajin?.fotoProfileDataUrl ?? "",
    stempelDataUrl: pengrajin?.stempelDataUrl ?? "",
    jabatanPenandatangan:
      pengrajin?.jabatanPenandatangan ?? "Pemilik / Penanggung Jawab",
  }));
  const [produkBaru, setProdukBaru] = useState({
    nama: "",
    kategori:
      pengrajin?.jenisKerajinan ?? ("Kerajinan Lainnya" as JenisKerajinan),
    deskripsi: "",
    harga: 0,
    satuan: "buah" as SatuanProdukKerajinan,
    stok: 0,
    fotoUrl: "",
    fotoDataUrl: "",
    khasJakarta: false,
    tersediaSewaJasa: false,
    terbukaKerjasama: true,
    ongkirTermasukHarga: false,
    cakupanOngkir: "DKI Jakarta sesuai kesepakatan transaksi",
    batasOngkir: 0,
  });

  if (!pengrajin) return null;

  const profile = {
    namaUsaha: draft.namaUsaha.trim(),
    namaPemilik: draft.namaPemilik.trim(),
    bentukUsaha: draft.bentukUsaha,
    namaBadanUsaha: draft.namaBadanUsaha.trim() || undefined,
    jenisKerajinan: draft.jenisKerajinan,
    produkUnggulan: draft.produkUnggulan.trim(),
    produk: draft.produk.map((item) => ({
      ...item,
      statusPublish: item.khasJakarta === true && item.statusPublish,
      tersediaSewaJasa: item.khasJakarta === true && item.tersediaSewaJasa,
      terbukaKerjasama: item.khasJakarta === true && item.terbukaKerjasama,
    })),
    alamat: draft.alamat.trim(),
    wilayah: draft.wilayah,
    lat: draft.lat,
    lng: draft.lng,
    deskripsi: draft.deskripsi.trim() || undefined,
    website: draft.website.trim() || undefined,
    instagram: draft.instagram.trim() || undefined,
    email: draft.email.trim(),
    noHp: draft.noHp.trim() || undefined,
    npwp: draft.npwp.trim(),
    statusPkp: draft.statusPkp,
    pemotongPajak: draft.pemotongPajak,
    nib: draft.nib.trim(),
    rekening: draft.rekening,
    dokumen: draft.dokumen,
    tokoDipublikasikan: draft.tokoDipublikasikan,
    menerimaSewaJasa: draft.menerimaSewaJasa,
    menerimaKerjasama: draft.menerimaKerjasama,
    logoDataUrl: draft.logoDataUrl || undefined,
    stempelDataUrl: draft.stempelDataUrl || undefined,
    jabatanPenandatangan:
      draft.jabatanPenandatangan.trim() || "Pemilik / Penanggung Jawab",
    fotoProfileDataUrl: pengrajin.fotoProfileDataUrl,
  };

  const downloadProfile = async (format: FormatUnduhanDokumen) => {
    const safeName = pengrajin.namaUsaha
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const produkTayang = pengrajin.produk.filter(
      (item) => item.khasJakarta === true && item.statusPublish,
    );
    const data: DataProfilDokumen = {
      fileName: `Profil_Pengrajin_${safeName || pengrajin.id}`,
      title: `Profil Pengrajin — ${pengrajin.namaUsaha}`,
      namaUtama: pengrajin.namaUsaha,
      labelLogo: "LOGO",
      logoDataUrl:
        pengrajin.logoDataUrl ?? pengrajin.fotoProfileDataUrl,
      alamat: pengrajin.alamat,
      telepon: pengrajin.noHp,
      email: pengrajin.email,
      mediaSosial: [pengrajin.instagram, pengrajin.website]
        .filter(Boolean)
        .join(" · "),
      bidang: pengrajin.jenisKerajinan,
      pembuka: `Profil ini disusun untuk memberikan gambaran singkat mengenai identitas, produk, layanan, serta informasi administrasi ${pengrajin.namaUsaha} sebagai usaha pengrajin ${pengrajin.jenisKerajinan}.`,
      sections: [
        {
          heading: "Identitas Pengrajin",
          rows: [
            { label: "Nama Usaha", value: pengrajin.namaUsaha },
            { label: "Pemilik", value: pengrajin.namaPemilik },
            { label: "Bentuk Usaha", value: pengrajin.bentukUsaha },
            { label: "Nama Badan Usaha", value: pengrajin.namaBadanUsaha },
            { label: "Jenis Kerajinan", value: pengrajin.jenisKerajinan },
            { label: "Produk Unggulan", value: pengrajin.produkUnggulan },
            { label: "NPWP", value: pengrajin.npwp },
            {
              label: "Status PKP",
              value: pengrajin.statusPkp === "pkp" ? "PKP" : "Non-PKP",
            },
            { label: "NIB", value: pengrajin.nib },
          ],
        },
        {
          heading: "Kontak & Profil Publik",
          rows: [
            { label: "Email", value: pengrajin.email },
            { label: "No. HP", value: pengrajin.noHp },
            { label: "Website", value: pengrajin.website },
            { label: "Instagram", value: pengrajin.instagram },
            { label: "Alamat", value: pengrajin.alamat },
          ],
        },
        {
          heading: "Deskripsi Usaha",
          paragraphs: [pengrajin.deskripsi ?? "-"],
        },
        {
          heading: "Produk & Layanan",
          rows: [
            { label: "Jumlah Produk", value: `${pengrajin.produk.length} produk` },
            { label: "Produk Tayang", value: `${produkTayang.length} produk` },
            {
              label: "Sewa Jasa",
              value: pengrajin.menerimaSewaJasa ? "Tersedia" : "Tidak tersedia",
            },
            {
              label: "Kerja Sama",
              value: pengrajin.menerimaKerjasama ? "Terbuka" : "Tidak tersedia",
            },
          ],
        },
        {
          heading: "Rekening Bank",
          rows: [
            { label: "Bank", value: pengrajin.rekening.bank },
            { label: "No. Rekening", value: pengrajin.rekening.nomor },
            { label: "Atas Nama", value: pengrajin.rekening.atasNama },
          ],
        },
      ],
      jabatanTandaTangan:
        pengrajin.jabatanPenandatangan ?? "Pemilik / Penanggung Jawab",
      namaTandaTangan: pengrajin.namaPemilik,
    };
    try {
      await unduhProfilDokumen(format, data);
      toast({
        title: `Profil ${format === "word" ? "Word" : "PDF"} berhasil diunduh`,
      });
    } catch (error) {
      toast({
        title: "Gagal mengunduh profil",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    }
  };

  const uploadIdentitasVisual = async (
    key: "logoDataUrl" | "stempelDataUrl",
    file?: File,
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_500_000) {
      toast({
        title: "Gambar tidak valid",
        description: "Gunakan PNG/JPG/WebP maksimal 1,5 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileAsDataUrl(file);
      setDraft((current) => ({ ...current, [key]: dataUrl }));
      toast({
        title: "Gambar siap disimpan",
        description: "Klik Simpan Permanen untuk menerapkan perubahan.",
      });
    } catch (error) {
      toast({
        title: "Gambar gagal dibaca",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const simpanProfil = async () => {
    if (saving) return;
    if (
      !profile.namaUsaha ||
      !profile.namaPemilik ||
      !profile.produkUnggulan ||
      !profile.alamat ||
      !profile.email ||
      !profile.npwp ||
      !profile.nib ||
      !profile.rekening.nomor.trim() ||
      !profile.rekening.atasNama.trim()
    ) {
      toast({
        title: "Lengkapi profil usaha",
        description:
          "Identitas, produk unggulan, alamat, email, NPWP, NIB, dan rekening wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    if (profile.bentukUsaha !== "Perorangan" && !profile.namaBadanUsaha) {
      toast({ title: "Nama badan usaha belum diisi", variant: "destructive" });
      return;
    }
    if (
      profile.tokoDipublikasikan &&
      (!profile.lat ||
        !profile.lng ||
        profile.lat < -6.5 ||
        profile.lat > -5.3 ||
        profile.lng < 106.5 ||
        profile.lng > 107.2)
    ) {
      toast({
        title: "Titik peta tidak valid",
        description:
          "Toko publik harus memakai koordinat usaha di DKI Jakarta.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (pengrajin.apiId && !demoLokal)
        await usersApi.update(pengrajin.apiId, { profile });
      save((data) => {
        const current = data.users.find((item) => item.id === pengrajin.id);
        if (current?.role === "pengrajin") Object.assign(current, profile);
      });
      setSession({ ...pengrajin, ...profile } as PengrajinUser);
      logActivity(pengrajin.id, "pengrajin", "profile-update", {
        mapPublished: profile.tokoDipublikasikan,
        productCount: profile.produk.filter((item) => item.statusPublish)
          .length,
        sewaJasa: profile.menerimaSewaJasa,
        kerjasama: profile.menerimaKerjasama,
      });
      toast({
        title:
          pengrajin.apiId && !demoLokal
            ? "Profil tersimpan permanen"
            : "Profil tersimpan lokal",
        description: profile.tokoDipublikasikan
          ? "Toko dan produk tayang segera diperbarui pada kanal publik."
          : "Toko sedang disembunyikan dari halaman publik.",
      });
    } catch (error) {
      toast({
        title: "Gagal menyimpan profil",
        description:
          error instanceof Error ? error.message : "Coba lagi beberapa saat.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadDokumen = async (file?: File) => {
    if (!file) return;
    if (
      !(file.type === "application/pdf" || file.type.startsWith("image/")) ||
      file.size > 10 * 1024 * 1024
    ) {
      toast({
        title: "Dokumen tidak valid",
        description: "Gunakan PDF/JPG/PNG/WebP maksimal 10 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      let dokumen: DokumenPengrajin;
      if (pengrajin.apiId && !demoLokal) {
        const uploaded = await uploadsApi.create(file);
        dokumen = {
          id: uploaded.id,
          jenis: jenisDokumen,
          nama: file.name,
          url: uploaded.url,
          contentType: uploaded.contentType,
          size: uploaded.sizeBytes,
          uploadedAt: Date.now(),
        };
      } else {
        dokumen = {
          id: uid(),
          jenis: jenisDokumen,
          nama: file.name,
          dataUrl: await fileAsDataUrl(file),
          contentType: file.type,
          size: file.size,
          uploadedAt: Date.now(),
        };
      }
      setDraft((current) => ({
        ...current,
        dokumen: [
          ...current.dokumen.filter((item) => item.jenis !== jenisDokumen),
          dokumen,
        ],
      }));
      toast({
        title: "Dokumen siap disimpan",
        description: "Klik Simpan Permanen untuk mengikat dokumen ke profil.",
      });
    } catch (error) {
      toast({
        title: "Unggah dokumen gagal",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadFotoProduk = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast({
        title: "Foto tidak valid",
        description: "Gunakan JPG/PNG/WebP maksimal 5 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      if (pengrajin.apiId && !demoLokal) {
        const uploaded = await uploadsApi.create(file);
        setProdukBaru((current) => ({
          ...current,
          fotoUrl: uploaded.publicUrl,
          fotoDataUrl: "",
        }));
      } else {
        const fotoDataUrl = await fileAsDataUrl(file);
        setProdukBaru((current) => ({ ...current, fotoDataUrl, fotoUrl: "" }));
      }
      toast({ title: "Foto produk siap digunakan" });
    } catch (error) {
      toast({
        title: "Unggah foto gagal",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadFotoProdukEdit = async (file?: File) => {
    if (!file || !produkEdit) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast({
        title: "Foto tidak valid",
        description: "Gunakan JPG/PNG/WebP maksimal 5 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      if (pengrajin.apiId && !demoLokal) {
        const uploaded = await uploadsApi.create(file);
        setProdukEdit((current) =>
          current
            ? {
                ...current,
                fotoUrl: uploaded.publicUrl,
                fotoDataUrl: undefined,
              }
            : null,
        );
      } else {
        const fotoDataUrl = await fileAsDataUrl(file);
        setProdukEdit((current) =>
          current ? { ...current, fotoDataUrl, fotoUrl: undefined } : null,
        );
      }
      toast({ title: "Foto pengganti siap disimpan" });
    } catch (error) {
      toast({
        title: "Unggah foto gagal",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const tambahProduk = () => {
    if (!produkBaru.nama.trim() || !produkBaru.deskripsi.trim()) {
      toast({
        title: "Lengkapi produk",
        description: "Nama dan deskripsi produk/jasa wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    const produk: ProdukKerajinan = {
      id: uid(),
      nama: produkBaru.nama.trim(),
      kategori: produkBaru.kategori,
      deskripsi: produkBaru.deskripsi.trim(),
      harga: Math.max(0, produkBaru.harga),
      satuan: produkBaru.satuan,
      stok: produkBaru.stok > 0 ? produkBaru.stok : undefined,
      fotoUrl: produkBaru.fotoUrl || undefined,
      fotoDataUrl: produkBaru.fotoDataUrl || undefined,
      khasJakarta: produkBaru.khasJakarta,
      statusPublish: false,
      tersediaSewaJasa: produkBaru.tersediaSewaJasa,
      terbukaKerjasama: produkBaru.terbukaKerjasama,
      ongkirTermasukHarga: produkBaru.ongkirTermasukHarga,
      cakupanOngkir: produkBaru.ongkirTermasukHarga
        ? produkBaru.cakupanOngkir.trim()
        : undefined,
      batasOngkir:
        produkBaru.ongkirTermasukHarga && produkBaru.batasOngkir > 0
          ? produkBaru.batasOngkir
          : undefined,
      createdAt: Date.now(),
    };
    setDraft((current) => ({
      ...current,
      produk: [produk, ...current.produk],
    }));
    setProdukBaru({
      nama: "",
      kategori: draft.jenisKerajinan,
      deskripsi: "",
      harga: 0,
      satuan: "buah",
      stok: 0,
      fotoUrl: "",
      fotoDataUrl: "",
      khasJakarta: false,
      tersediaSewaJasa: false,
      terbukaKerjasama: true,
      ongkirTermasukHarga: false,
      cakupanOngkir: "DKI Jakarta sesuai kesepakatan transaksi",
      batasOngkir: 0,
    });
  };

  const ubahProduk = (id: string, patch: Partial<ProdukKerajinan>) => {
    const currentProduct = draft.produk.find((item) => item.id === id);
    if (patch.statusPublish === true && currentProduct?.khasJakarta !== true) {
      toast({
        title: "Publikasi ditolak",
        description:
          "Hanya kerajinan yang dikonfirmasi khas Jakarta yang dapat dipublikasikan.",
        variant: "destructive",
      });
      return;
    }
    setDraft((current) => ({
      ...current,
      produk: current.produk.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              ...(patch.khasJakarta === false
                ? {
                    statusPublish: false,
                    tersediaSewaJasa: false,
                    terbukaKerjasama: false,
                  }
                : {}),
            }
          : item,
      ),
    }));
  };

  const simpanEditProduk = () => {
    if (!produkEdit) return;
    if (!produkEdit.nama.trim() || !produkEdit.deskripsi.trim()) {
      toast({
        title: "Produk belum lengkap",
        description: "Nama dan deskripsi produk wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    ubahProduk(produkEdit.id, {
      ...produkEdit,
      nama: produkEdit.nama.trim(),
      deskripsi: produkEdit.deskripsi.trim(),
      harga: Math.max(0, produkEdit.harga),
      stok:
        produkEdit.stok && produkEdit.stok > 0 ? produkEdit.stok : undefined,
    });
    setProdukEdit(null);
    toast({
      title: "Perubahan produk siap disimpan",
      description:
        "Klik Simpan Permanen agar perubahan diterapkan ke toko publik.",
    });
  };

  const hapusProduk = (produk: ProdukKerajinan) => {
    setDraft((current) => ({
      ...current,
      produk: current.produk.filter((item) => item.id !== produk.id),
    }));
    if (produkEdit?.id === produk.id) setProdukEdit(null);
    toast({
      title: `${produk.nama} dihapus dari daftar`,
      description: "Klik Simpan Permanen untuk menghapusnya dari toko publik.",
    });
  };

  const publishedCount = draft.produk.filter(
    (item) => item.khasJakarta === true && item.statusPublish,
  ).length;
  const storeId = pengrajin.apiId ?? pengrajin.id;

  if (section === "dashboard") return <div className="role-workspace" data-testid="pengrajin-home">
    <DashboardWelcome role="Ruang pengrajin" title={pengrajin.namaUsaha || "Toko pengrajin"} description="Rawat karya khas Jakarta dan kelola perjalanan usaha Anda."
      primary={{ href: "/pengrajin/produk", label: "Kelola produk" }} secondary={{ href: "/pengrajin/profil", label: "Profil toko" }} />
    <DashboardMetrics items={[
      { label: "Produk tercatat", value: draft.produk.length, href: "/pengrajin/produk" },
      { label: "Produk tayang", value: publishedCount, href: "/pengrajin/produk" },
      { label: "Status toko", value: draft.tokoDipublikasikan ? "Tayang" : "Disembunyikan", href: "/pengrajin/profil" },
    ]} />
    <div className="rw-columns">
      <DashboardLinks title="Kelola usaha" items={[
        { href: "/pengrajin/produk", label: "Produk khas Jakarta", description: "Tambahkan produk, harga, dan foto karya Anda.", icon: ShoppingBag },
        { href: "/pengrajin/pesanan-produk", label: "Pesanan produk", description: "Tindak lanjuti pesanan dan pengiriman ke mitra.", icon: PackagePlus },
        { href: "/pengrajin/kanal", label: "Kanal kerja sama", description: "Kelola kesepakatan penjualan bersama mitra.", icon: Handshake },
      ]} />
      <section className="rw-panel"><h2>Etalase Anda</h2>
        {draft.produk.length ? <ul className="rw-record-list">{draft.produk.slice(0,3).map(produk => <li key={produk.id}><strong>{produk.nama}</strong><span>{produk.khasJakarta && produk.statusPublish ? "Tayang di katalog" : "Belum ditayangkan"}</span></li>)}</ul> : <div className="rw-empty"><Store aria-hidden="true" /><p className="rw-note">Belum ada produk di etalase. Tambahkan karya pertama Anda untuk mulai mengisi katalog.</p></div>}
        <Link className="rw-text-link" href="/pengrajin/produk">Buka daftar produk</Link>
      </section>
    </div>
  </div>;

  return (
    <div className="role-workspace" data-testid="pengrajin-editor">
      <DashboardWelcome
        role="Ruang pengrajin"
        title={SECTION_TITLE[section].title}
        description={SECTION_TITLE[section].subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            {section === "profil" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void downloadProfile("word")}
                  data-testid="button-download-word"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Unduh Word</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void downloadProfile("pdf")}
                  data-testid="button-download-pdf"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Unduh PDF</span>
                </Button>
              </>
            )}
            {draft.tokoDipublikasikan && (
              <Button asChild variant="outline">
                <Link href={`/toko/pengrajin/${storeId}`} target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" /> Lihat Toko Publik
                </Link>
              </Button>
            )}
            <Button onClick={simpanProfil} disabled={saving || uploading}>
              <Save className="mr-2 h-4 w-4" />{" "}
              {saving ? "Menyimpan…" : "Simpan Permanen"}
            </Button>
          </div>
        }
      />

      <div className="rw-status-strip" aria-label="Ringkasan toko">
        <StatusCard
          icon={<Store className="h-5 w-5" />}
          label="Toko & Peta"
          value={draft.tokoDipublikasikan ? "Dipublikasikan" : "Disembunyikan"}
          active={draft.tokoDipublikasikan}
        />
        <StatusCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Produk Tayang"
          value={`${publishedCount} produk`}
          active={publishedCount > 0}
        />
        <StatusCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label="Katalog Layanan"
          value={draft.menerimaSewaJasa ? "Terhubung" : "Nonaktif"}
          active={draft.menerimaSewaJasa}
        />
        <StatusCard
          icon={<Handshake className="h-5 w-5" />}
          label="Kerja Sama"
          value={draft.menerimaKerjasama ? "Terhubung" : "Nonaktif"}
          active={draft.menerimaKerjasama}
        />
      </div>

      <Tabs value={section} className="space-y-5">
        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle>Identitas Toko dan Kontak</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Nama Usaha"
                required
                value={draft.namaUsaha}
                onChange={(namaUsaha) => setDraft({ ...draft, namaUsaha })}
              />
              <FormField
                label="Nama Pemilik / Penanggung Jawab"
                required
                value={draft.namaPemilik}
                onChange={(namaPemilik) => setDraft({ ...draft, namaPemilik })}
              />
              <SelectField
                label="Jenis Kerajinan Utama"
                value={draft.jenisKerajinan}
                options={JENIS_KERAJINAN}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    jenisKerajinan: value as JenisKerajinan,
                  })
                }
              />
              <FormField
                label="Produk Unggulan"
                required
                value={draft.produkUnggulan}
                onChange={(produkUnggulan) =>
                  setDraft({ ...draft, produkUnggulan })
                }
              />
              <FormField
                label="Email Publik"
                required
                type="email"
                value={draft.email}
                onChange={(email) => setDraft({ ...draft, email })}
              />
              <FormField
                label="WhatsApp Publik"
                value={draft.noHp}
                onChange={(noHp) => setDraft({ ...draft, noHp })}
              />
              <FormField
                label="Website"
                value={draft.website}
                onChange={(website) => setDraft({ ...draft, website })}
              />
              <FormField
                label="Instagram"
                value={draft.instagram}
                onChange={(instagram) => setDraft({ ...draft, instagram })}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Deskripsi Usaha</Label>
                <Textarea
                  rows={5}
                  value={draft.deskripsi}
                  onChange={(event) =>
                    setDraft({ ...draft, deskripsi: event.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>
          <Card className="mt-5 border-emerald-200 bg-emerald-50/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stamp className="h-5 w-5" /> Kop & Stempel Pengrajin
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Logo Kop Usaha</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    void uploadIdentitasVisual(
                      "logoDataUrl",
                      event.target.files?.[0],
                    )
                  }
                />
                {draft.logoDataUrl && (
                  <img
                    src={draft.logoDataUrl}
                    alt="Logo Pengrajin"
                    className="h-20 max-w-40 rounded-lg border bg-white object-contain p-2"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Logo ini juga menjadi penanda toko Pengrajin pada peta publik.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Stempel Usaha</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    void uploadIdentitasVisual(
                      "stempelDataUrl",
                      event.target.files?.[0],
                    )
                  }
                />
                {draft.stempelDataUrl && (
                  <img
                    src={draft.stempelDataUrl}
                    alt="Stempel Pengrajin"
                    className="h-20 w-20 rounded-lg border bg-white object-contain p-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Jabatan Penandatangan</Label>
                <Input
                  value={draft.jabatanPenandatangan}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      jabatanPenandatangan: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Kop, stempel, dan jabatan dipakai pada kontrak, invoice,
                  kwitansi, serta BAST transaksi.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profil" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Publikasi dan Kanal</CardTitle>
            </CardHeader>
            <CardContent>
              <ToggleCard
                checked={draft.tokoDipublikasikan}
                onChange={(tokoDipublikasikan) =>
                  setDraft({ ...draft, tokoDipublikasikan })
                }
                title="Toko dan Peta Publik"
                description="Tampilkan profil, produk khas Jakarta yang berstatus tayang, kontak, alamat, dan titik toko kepada masyarakat."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Lokasi Toko
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-1.5">
                <Label>Alamat Lengkap</Label>
                <Textarea
                  rows={7}
                  value={draft.alamat}
                  onChange={(event) =>
                    setDraft({ ...draft, alamat: event.target.value })
                  }
                />
              </div>
              <div className="space-y-4 rounded-xl border bg-muted/25 p-4">
                <ShareLocation
                  lat={draft.lat}
                  lng={draft.lng}
                  onChange={(lat, lng) =>
                    setDraft((current) => ({ ...current, lat, lng }))
                  }
                  onAddressResolved={(wilayah, alamatDetail) => {
                    const alamat = formatAlamatWilayah(wilayah, alamatDetail);
                    setDraft((current) => ({
                      ...current,
                      wilayah,
                      alamat: alamat || current.alamat,
                    }));
                  }}
                  mode="gps"
                />
                {draft.lat !== 0 && draft.lng !== 0 && (
                  <a
                    href={mapsUrl(draft.lat, draft.lng)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" /> Periksa titik di Google
                    Maps
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produk" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="h-5 w-5" /> Tambah Produk / Jasa
                Kerajinan
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Nama Produk / Jasa"
                required
                value={produkBaru.nama}
                onChange={(nama) => setProdukBaru({ ...produkBaru, nama })}
              />
              <SelectField
                label="Kategori"
                value={produkBaru.kategori}
                options={JENIS_KERAJINAN}
                onChange={(value) =>
                  setProdukBaru({
                    ...produkBaru,
                    kategori: value as JenisKerajinan,
                  })
                }
              />
              <FormField
                label="Harga"
                type="number"
                value={String(produkBaru.harga || "")}
                onChange={(value) =>
                  setProdukBaru({ ...produkBaru, harga: Number(value) || 0 })
                }
              />
              <SelectField
                label="Satuan"
                value={produkBaru.satuan}
                options={SATUAN}
                onChange={(value) =>
                  setProdukBaru({
                    ...produkBaru,
                    satuan: value as SatuanProdukKerajinan,
                  })
                }
              />
              <FormField
                label="Stok (opsional)"
                type="number"
                value={String(produkBaru.stok || "")}
                onChange={(value) =>
                  setProdukBaru({ ...produkBaru, stok: Number(value) || 0 })
                }
              />
              <div className="space-y-1.5">
                <Label>Foto Produk</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) =>
                    void uploadFotoProduk(event.target.files?.[0])
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>Deskripsi</Label>
                <Textarea
                  rows={3}
                  value={produkBaru.deskripsi}
                  onChange={(event) =>
                    setProdukBaru({
                      ...produkBaru,
                      deskripsi: event.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-5 sm:col-span-2 lg:col-span-3">
                <CheckOption
                  checked={produkBaru.khasJakarta}
                  onChange={(khasJakarta) =>
                    setProdukBaru({ ...produkBaru, khasJakarta })
                  }
                  label="Kerajinan khas Jakarta"
                />
                <CheckOption
                  checked={produkBaru.tersediaSewaJasa}
                  onChange={(tersediaSewaJasa) =>
                    setProdukBaru({ ...produkBaru, tersediaSewaJasa })
                  }
                  label="Masuk Katalog Layanan"
                />
                <CheckOption
                  checked={produkBaru.terbukaKerjasama}
                  onChange={(terbukaKerjasama) =>
                    setProdukBaru({ ...produkBaru, terbukaKerjasama })
                  }
                  label="Terbuka Kerja Sama"
                />
                <CheckOption
                  checked={produkBaru.ongkirTermasukHarga}
                  onChange={(ongkirTermasukHarga) =>
                    setProdukBaru({ ...produkBaru, ongkirTermasukHarga })
                  }
                  label="Harga sudah termasuk ongkir"
                />
              </div>
              {produkBaru.ongkirTermasukHarga && (
                <>
                  <FormField
                    label="Cakupan Ongkir dalam Harga"
                    value={produkBaru.cakupanOngkir}
                    onChange={(cakupanOngkir) =>
                      setProdukBaru({ ...produkBaru, cakupanOngkir })
                    }
                  />
                  <FormField
                    label="Batas Ongkir Ditanggung Penjual"
                    type="number"
                    value={String(produkBaru.batasOngkir || "")}
                    onChange={(value) =>
                      setProdukBaru({
                        ...produkBaru,
                        batasOngkir: Number(value) || 0,
                      })
                    }
                  />
                </>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="button" onClick={tambahProduk}>
                  <PackagePlus className="mr-2 h-4 w-4" /> Tambahkan ke Katalog
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {draft.produk.map((produk) => (
              <Card key={produk.id} className="overflow-hidden">
                {produk.fotoUrl || produk.fotoDataUrl ? (
                  <img
                    src={produk.fotoUrl || produk.fotoDataUrl}
                    alt={produk.nama}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-44 place-items-center bg-muted">
                    <ImagePlus className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="space-y-3 pt-5">
                  {produkEdit?.id === produk.id ? (
                    <div className="space-y-4 rounded-lg border bg-muted/10 p-3">
                      <h3 className="font-semibold">Edit Produk Tayang</h3>
                      <FormField
                        label="Nama Produk / Jasa"
                        required
                        value={produkEdit.nama}
                        onChange={(nama) =>
                          setProdukEdit({ ...produkEdit, nama })
                        }
                      />
                      <SelectField
                        label="Kategori"
                        value={produkEdit.kategori}
                        options={JENIS_KERAJINAN}
                        onChange={(kategori) =>
                          setProdukEdit({
                            ...produkEdit,
                            kategori: kategori as JenisKerajinan,
                          })
                        }
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          label="Harga"
                          type="number"
                          value={String(produkEdit.harga || "")}
                          onChange={(harga) =>
                            setProdukEdit({
                              ...produkEdit,
                              harga: Number(harga) || 0,
                            })
                          }
                        />
                        <SelectField
                          label="Satuan"
                          value={produkEdit.satuan}
                          options={SATUAN}
                          onChange={(satuan) =>
                            setProdukEdit({
                              ...produkEdit,
                              satuan: satuan as SatuanProdukKerajinan,
                            })
                          }
                        />
                        <FormField
                          label="Stok (opsional)"
                          type="number"
                          value={String(produkEdit.stok || "")}
                          onChange={(stok) =>
                            setProdukEdit({
                              ...produkEdit,
                              stok: Number(stok) || undefined,
                            })
                          }
                        />
                        <div className="space-y-1.5">
                          <Label>Ganti Foto</Label>
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={uploading}
                            onChange={(event) =>
                              void uploadFotoProdukEdit(event.target.files?.[0])
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Deskripsi</Label>
                        <Textarea
                          rows={4}
                          value={produkEdit.deskripsi}
                          onChange={(event) =>
                            setProdukEdit({
                              ...produkEdit,
                              deskripsi: event.target.value,
                            })
                          }
                        />
                      </div>
                      <CheckOption
                        checked={produkEdit.ongkirTermasukHarga === true}
                        onChange={(ongkirTermasukHarga) =>
                          setProdukEdit({
                            ...produkEdit,
                            ongkirTermasukHarga,
                          })
                        }
                        label="Harga sudah termasuk ongkir"
                      />
                      {produkEdit.ongkirTermasukHarga && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField
                            label="Cakupan Ongkir"
                            value={produkEdit.cakupanOngkir ?? ""}
                            onChange={(cakupanOngkir) =>
                              setProdukEdit({ ...produkEdit, cakupanOngkir })
                            }
                          />
                          <FormField
                            label="Batas Ongkir Penjual"
                            type="number"
                            value={String(produkEdit.batasOngkir ?? "")}
                            onChange={(value) =>
                              setProdukEdit({
                                ...produkEdit,
                                batasOngkir: Number(value) || undefined,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={simpanEditProduk}>
                          <Save className="mr-2 h-4 w-4" /> Simpan Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setProdukEdit(null)}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-semibold">{produk.nama}</h3>
                        <p className="text-sm font-medium text-primary">
                          Rp {produk.harga.toLocaleString("id-ID")} /{" "}
                          {produk.satuan}
                        </p>
                        {produk.stok !== undefined && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Stok: {produk.stok}
                          </p>
                        )}
                      </div>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {produk.deskripsi}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setProdukEdit(structuredClone(produk))}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit Produk
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => hapusProduk(produk)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </Button>
                      </div>
                    </>
                  )}
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <CheckOption
                      checked={produk.khasJakarta === true}
                      onChange={(khasJakarta) =>
                        ubahProduk(produk.id, { khasJakarta })
                      }
                      label="Kerajinan khas Jakarta"
                    />
                    <CheckOption
                      checked={produk.statusPublish}
                      onChange={(statusPublish) =>
                        ubahProduk(produk.id, { statusPublish })
                      }
                      label={
                        produk.khasJakarta === true
                          ? "Tayang di toko publik"
                          : "Publikasi terkunci: bukan khas Jakarta"
                      }
                    />
                    <CheckOption
                      checked={produk.tersediaSewaJasa}
                      onChange={(tersediaSewaJasa) =>
                        ubahProduk(produk.id, { tersediaSewaJasa })
                      }
                      label="Tayang di Katalog Layanan"
                    />
                    <CheckOption
                      checked={produk.terbukaKerjasama}
                      onChange={(terbukaKerjasama) =>
                        ubahProduk(produk.id, { terbukaKerjasama })
                      }
                      label="Tayang di Kerja Sama"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            {draft.produk.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
                Belum ada produk. Tambahkan kerajinan pertama melalui formulir
                di atas.
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="kanal">
          <Card>
            <CardHeader>
              <CardTitle>Layanan dan Kerja Sama</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              <ToggleCard
                checked={draft.menerimaSewaJasa}
                onChange={(menerimaSewaJasa) =>
                  setDraft({ ...draft, menerimaSewaJasa })
                }
                title="Katalog Layanan"
                description="Produk khas Jakarta berlabel layanan muncul sebagai dekorasi atau perlengkapan yang dapat dipesan."
              />
              <ToggleCard
                checked={draft.menerimaKerjasama}
                onChange={(menerimaKerjasama) =>
                  setDraft({ ...draft, menerimaKerjasama })
                }
                title="Modul Kerja Sama"
                description="Produk khas Jakarta berlabel Kerja Sama muncul bagi sanggar yang mencari mitra produksi atau acara."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profil" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Legalitas dan Rekening</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Bentuk Usaha"
                value={draft.bentukUsaha}
                options={["Badan Hukum", "Non Badan Hukum", "Perorangan"]}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    bentukUsaha: value as BentukUsahaPengrajin,
                  })
                }
              />
              {draft.bentukUsaha !== "Perorangan" && (
                <FormField
                  label="Nama Badan / Organisasi"
                  required
                  value={draft.namaBadanUsaha}
                  onChange={(namaBadanUsaha) =>
                    setDraft({ ...draft, namaBadanUsaha })
                  }
                />
              )}
              <FormField
                label="NPWP"
                required
                value={draft.npwp}
                onChange={(npwp) => setDraft({ ...draft, npwp })}
              />
              <div className="space-y-1.5">
                <Label>Status Pengusaha Kena Pajak</Label>
                <Select
                  value={draft.statusPkp}
                  onValueChange={(statusPkp) =>
                    setDraft({
                      ...draft,
                      statusPkp: statusPkp as "pkp" | "non_pkp",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_pkp">Non-PKP</SelectItem>
                    <SelectItem value="pkp">PKP</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  PPN hanya ditampilkan apabila penjual menyatakan berstatus
                  PKP.
                </p>
              </div>
              <div className="flex items-center pt-6">
                <CheckOption
                  checked={draft.pemotongPajak}
                  onChange={(pemotongPajak) =>
                    setDraft({ ...draft, pemotongPajak })
                  }
                  label="Usaha memiliki kewajiban sebagai pemotong pajak"
                />
              </div>
              <FormField
                label="NIB"
                required
                value={draft.nib}
                onChange={(nib) => setDraft({ ...draft, nib })}
              />
              <SelectField
                label="Bank"
                value={draft.rekening.bank}
                options={BANKS}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    rekening: { ...draft.rekening, bank: value as Bank },
                  })
                }
              />
              <FormField
                label="Nomor Rekening"
                required
                value={draft.rekening.nomor}
                onChange={(nomor) =>
                  setDraft({ ...draft, rekening: { ...draft.rekening, nomor } })
                }
              />
              <FormField
                label="Rekening Atas Nama"
                required
                value={draft.rekening.atasNama}
                onChange={(atasNama) =>
                  setDraft({
                    ...draft,
                    rekening: { ...draft.rekening, atasNama },
                  })
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" /> Unggah Bukti Dokumen Privat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                <Select
                  value={jenisDokumen}
                  onValueChange={(value) =>
                    setJenisDokumen(value as JenisDokumenPengrajin)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOKUMEN.map((jenis) => (
                      <SelectItem key={jenis} value={jenis}>
                        {jenis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) =>
                    void uploadDokumen(event.target.files?.[0])
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Maksimal 10 MB per dokumen. Bukti NPWP, NIB, rekening, dan
                akta/legalitas tidak ditampilkan pada toko publik.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {draft.dokumen.map((dokumen) => (
                  <div
                    key={dokumen.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{dokumen.jenis}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {dokumen.nama} · {(dokumen.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    {(dokumen.url || dokumen.dataUrl) && (
                      <a
                        href={dokumen.url || dokumen.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Buka
                      </a>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          dokumen: current.dokumen.filter(
                            (item) => item.id !== dokumen.id,
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {draft.dokumen.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">
                    Belum ada bukti dokumen yang diunggah.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.08] via-card to-accent/[0.08] p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg">Privasi data usaha</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Halaman publik hanya menampilkan toko, lokasi, kontak publik, dan
              produk berstatus tayang. NPWP, NIB, nomor rekening, dan berkas
              bukti tetap privat.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
        >
          {icon}
        </span>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${checked ? "border-primary/40 bg-primary/[0.05]" : "bg-muted/20"}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function CheckOption({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span>{label}</span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
