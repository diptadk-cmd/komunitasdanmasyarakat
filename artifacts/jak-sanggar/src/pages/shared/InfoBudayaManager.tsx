import { useMemo, useRef, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import {
  applyInfoBudayaModeration,
  save,
  uid,
  fmtDate,
  logActivity,
} from "@/lib/store";
import { uploadsApi } from "@/lib/api";

async function compressImage(
  file: File,
  maxW = 1600,
  maxH = 1000,
  quality = 0.82,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Gagal membaca berkas"));
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onerror = () => reject(new Error("Gagal memuat gambar"));
    i.onload = () => resolve(i);
    i.src = dataUrl;
  });
  let { width: w, height: h } = img;
  const ratio = Math.min(1, maxW / w, maxH / h);
  w = Math.round(w * ratio);
  h = Math.round(h * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type {
  InfoBudaya,
  InfoBudayaKategori,
  InfoBudayaMediaKind,
  AdminUser,
  SanggarUser,
} from "@/lib/types";
import { BudayaSlider } from "@/components/system/BudayaSlider";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save as SaveIcon,
  Trash2,
  X,
  Lock,
  UploadCloud,
  CircleCheck,
  CircleX,
} from "lucide-react";

const KATEGORI_OPTIONS: InfoBudayaKategori[] = [
  "Tari",
  "Musik",
  "Teater",
  "Kuliner",
  "Pakaian",
  "Upacara",
  "Sejarah",
  "Bahasa",
  "Permainan",
];

interface DraftState {
  judul: string;
  ringkasan: string;
  isi: string;
  mediaUrl: string;
  mediaContentType?: string;
  mediaKind?: InfoBudayaMediaKind;
  imageUrl: string;
  imageDataUrl?: string;
  kategori: InfoBudayaKategori;
  sumber: string;
}

const EMPTY_DRAFT: DraftState = {
  judul: "",
  ringkasan: "",
  isi: "",
  mediaUrl: "",
  mediaContentType: undefined,
  mediaKind: undefined,
  imageUrl: "",
  imageDataUrl: undefined,
  kategori: "Tari",
  sumber: "",
};

function publicationStatusOf(item: InfoBudaya) {
  return item.publicationStatus ?? (item.active ? "published" : "pending");
}

interface Props {
  /** Subtitle/role hint shown in PageHeader */
  audience: "kurator" | "admin" | "sanggar";
}

export default function InfoBudayaManager({ audience }: Props) {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [filterKat, setFilterKat] = useState<"all" | InfoBudayaKategori>("all");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const isSanggar = audience === "sanggar";

  const ownedItems = useMemo(() => {
    const arr = isSanggar
      ? db.infoBudaya.filter((item) => item.authorId === user?.id)
      : [...db.infoBudaya];
    arr.sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
    return arr;
  }, [db.infoBudaya, isSanggar, user?.id]);

  const list = useMemo(
    () =>
      filterKat === "all"
        ? ownedItems
        : ownedItems.filter((item) => item.kategori === filterKat),
    [filterKat, ownedItems],
  );

  const aktifCount = ownedItems.filter((i) => i.active).length;

  const resetDraft = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setMediaPreviewUrl(undefined);
    if (fileRef.current) fileRef.current.value = "";
    if (mediaFileRef.current) mediaFileRef.current.value = "";
  };

  const startEdit = (it: InfoBudaya) => {
    if (isSanggar && it.authorId !== user?.id) return;
    setEditingId(it.id);
    setDraft({
      judul: it.judul,
      ringkasan: it.ringkasan,
      isi: it.isi,
      mediaUrl: it.mediaUrl ?? "",
      mediaContentType: it.mediaContentType,
      mediaKind: it.mediaKind,
      imageUrl: it.imageUrl ?? "",
      imageDataUrl: it.imageDataUrl,
      kategori: it.kategori,
      sumber: it.sumber ?? "",
    });
    setMediaPreviewUrl(undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    if (!user) return;
    if (isSanggar && user.role !== "sanggar") return;
    const j = draft.judul.trim();
    const r = draft.ringkasan.trim();
    const i = draft.isi.trim();
    if (!j || !r || !i) {
      toast({
        title: "Lengkapi dulu",
        description: "Judul, ringkasan, dan isi wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    if (
      isSanggar &&
      !draft.mediaUrl.trim() &&
      !draft.imageUrl.trim() &&
      !draft.imageDataUrl
    ) {
      toast({
        title: "Media karya belum ada",
        description:
          "Unggah MP3/MP4, tempel URL media, atau tambahkan foto karya.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (editingId) {
        save((d) => {
          const it = d.infoBudaya.find((x) => x.id === editingId);
          if (!it) return;
          if (isSanggar && it.authorId !== user.id) return;
          it.judul = j;
          it.ringkasan = r;
          it.isi = i;
          it.mediaUrl = draft.mediaUrl.trim() || undefined;
          it.mediaContentType = draft.mediaContentType;
          it.mediaKind = draft.mediaKind;
          it.imageUrl = draft.imageUrl.trim() || undefined;
          it.imageDataUrl = draft.imageDataUrl;
          it.kategori = draft.kategori;
          it.sumber =
            draft.sumber.trim() ||
            (isSanggar ? (user as SanggarUser).namaSanggar : undefined);
          if (isSanggar) {
            it.active = false;
            it.publicationStatus = "pending";
            it.reviewNote = undefined;
          }
          it.updatedAt = Date.now();
        });
        logActivity(
          user.id,
          user.role,
          isSanggar ? "resubmit-karya-budaya" : "update-info-budaya",
        );
        toast({
          title: isSanggar
            ? "Karya dikirim ulang untuk ditinjau"
            : "Perubahan tersimpan",
        });
      } else {
        save((d) => {
          const maxOrder = d.infoBudaya.reduce(
            (m, x) => Math.max(m, x.order),
            0,
          );
          d.infoBudaya.push({
            id: uid(),
            judul: j,
            ringkasan: r,
            isi: i,
            mediaUrl: draft.mediaUrl.trim() || undefined,
            mediaContentType: draft.mediaContentType,
            mediaKind: draft.mediaKind,
            imageUrl: draft.imageUrl.trim() || undefined,
            imageDataUrl: draft.imageDataUrl,
            kategori: draft.kategori,
            sumber:
              draft.sumber.trim() ||
              (isSanggar ? (user as SanggarUser).namaSanggar : undefined),
            publicationStatus: isSanggar ? "pending" : "published",
            active: !isSanggar,
            order: maxOrder + 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            authorId: user.id,
          });
        });
        logActivity(
          user.id,
          user.role,
          isSanggar ? "submit-karya-budaya" : "create-info-budaya",
        );
        toast({
          title: isSanggar
            ? "Karya dikirim untuk ditinjau"
            : "Informasi kebudayaan ditambahkan",
          description: isSanggar
            ? "Karya akan tampil di halaman depan setelah disetujui Admin atau Kurator."
            : undefined,
        });
      }
      resetDraft();
    } catch (e: any) {
      toast({
        title: "Gagal menyimpan",
        description: e?.message ?? "Periksa kembali isian.",
        variant: "destructive",
      });
    }
  };

  const toggleActive = (id: string) => {
    if (isSanggar) return;
    let published = false;
    save((d) => {
      const it = d.infoBudaya.find((x) => x.id === id);
      if (it) {
        published = publicationStatusOf(it) !== "published" || !it.active;
        applyInfoBudayaModeration(
          it,
          published ? "published" : "pending",
        );
      }
    });
    if (user) {
      logActivity(
        user.id,
        user.role,
        published ? "approve-karya-budaya" : "unpublish-karya-budaya",
      );
    }
    toast({
      title: published
        ? "Karya disetujui dan diterbitkan"
        : "Karya ditarik dari publikasi",
    });
  };

  const rejectItem = (id: string) => {
    if (isSanggar) return;
    save((d) => {
      const it = d.infoBudaya.find((x) => x.id === id);
      if (!it) return;
      applyInfoBudayaModeration(it, "rejected", {
        note: "Perlu diperbaiki sebelum dapat diterbitkan.",
      });
    });
    if (user) logActivity(user.id, user.role, "reject-karya-budaya");
    toast({ title: "Karya dikembalikan ke Sanggar" });
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    if (isSanggar) return;
    save((d) => {
      const sorted = [...d.infoBudaya].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((x) => x.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swap];
      const tmp = a.order;
      a.order = b.order;
      b.order = tmp;
      a.updatedAt = Date.now();
      b.updatedAt = Date.now();
    });
  };

  const remove = (id: string) => {
    const target = db.infoBudaya.find((item) => item.id === id);
    if (isSanggar && target?.authorId !== user?.id) return;
    if (
      !confirm(
        "Hapus informasi kebudayaan ini? Tindakan ini tidak bisa dibatalkan.",
      )
    )
      return;
    save((d) => {
      d.infoBudaya = d.infoBudaya.filter((x) => x.id !== id);
    });
    if (editingId === id) resetDraft();
    if (user) logActivity(user.id, user.role, "delete-info-budaya");
    toast({ title: "Dihapus" });
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 1600, 1000, 0.82);
      setDraft((d) => ({ ...d, imageDataUrl: dataUrl }));
      toast({
        title: "Gambar siap",
        description:
          "Gambar dikompres dan akan tersimpan saat Anda klik Simpan.",
      });
    } catch {
      toast({ title: "Gagal memuat gambar", variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      toast({
        title: "Berkas terlalu besar",
        description: "Ukuran maksimum media adalah 60 MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    setUploadingMedia(true);
    try {
      const uploaded = await uploadsApi.create(file);
      setDraft((d) => ({
        ...d,
        mediaUrl: uploaded.publicUrl,
        mediaContentType: uploaded.contentType,
        mediaKind:
          uploaded.mediaKind === "document" || uploaded.mediaKind === "other"
            ? "link"
            : uploaded.mediaKind,
      }));
      setMediaPreviewUrl(uploaded.url);
      toast({
        title: "Media berhasil diunggah",
        description: `${file.name} siap dikirim untuk ditinjau.`,
      });
    } catch (error) {
      toast({
        title: "Gagal mengunggah media",
        description:
          error instanceof Error
            ? error.message
            : "Periksa koneksi dan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploadingMedia(false);
      if (mediaFileRef.current) mediaFileRef.current.value = "";
    }
  };

  const previewItems: InfoBudaya[] = useMemo(() => {
    if (!draft.judul.trim() && !editingId) {
      return isSanggar ? [] : db.infoBudaya;
    }
    const previewItem: InfoBudaya = {
      id: editingId ?? "preview",
      judul: draft.judul || "(Tanpa judul)",
      ringkasan: draft.ringkasan || "(Belum ada ringkasan)",
      isi: draft.isi || "(Belum ada isi)",
      mediaUrl: mediaPreviewUrl || draft.mediaUrl || undefined,
      mediaContentType: draft.mediaContentType,
      mediaKind: draft.mediaKind,
      imageUrl: draft.imageUrl || undefined,
      imageDataUrl: draft.imageDataUrl,
      kategori: draft.kategori,
      sumber: draft.sumber || undefined,
      active: true,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      authorId: user?.id ?? "",
    };
    return [previewItem];
  }, [draft, editingId, db.infoBudaya, isSanggar, mediaPreviewUrl, user?.id]);

  const subtitle =
    audience === "kurator"
      ? "Kelola konten Informasi Kebudayaan yang muncul di dasbor seluruh sanggar. Anda dapat menambah, mengubah, mengaktifkan, dan mengatur urutannya."
      : audience === "sanggar"
        ? "Unggah karya sanggar untuk ditinjau. Karya yang disetujui akan tampil otomatis di Media Kreatif halaman depan."
        : "Tinjau, terbitkan, dan kelola karya budaya dari seluruh sanggar.";

  // Permission gate khusus admin — kurator selalu boleh
  if (audience === "admin") {
    if (!user || user.role !== "admin") return null;
    const a = user as AdminUser;
    if (!a.permissions.kelolaInfoBudaya) {
      return (
        <div>
          <PageHeader title="Informasi Kebudayaan" subtitle="Akses dikunci." />
          <Card
            className="p-8 text-center max-w-md mx-auto"
            data-testid="locked-info-budaya"
          >
            <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-serif text-lg mb-1">Akses Dikunci</h3>
            <p className="text-sm text-muted-foreground">
              Anda belum diberi izin untuk mengelola Informasi Kebudayaan.
              Silakan hubungi kurator untuk mengaktifkan izin{" "}
              <code className="text-xs">kelolaInfoBudaya</code>.
            </p>
          </Card>
        </div>
      );
    }
  }

  if (audience === "sanggar" && (!user || user.role !== "sanggar")) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title={isSanggar ? "Publikasi Karya Sanggar" : "Informasi Kebudayaan"}
        subtitle={subtitle}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <Card className="p-5 lg:col-span-2 space-y-4 h-fit lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg flex items-center gap-2">
              {editingId ? (
                <Pencil className="h-4 w-4 text-accent" />
              ) : (
                <Plus className="h-4 w-4 text-accent" />
              )}
              {editingId
                ? isSanggar
                  ? "Ubah Karya"
                  : "Ubah Informasi"
                : isSanggar
                  ? "Karya Baru"
                  : "Informasi Baru"}
            </h3>
            {editingId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetDraft}
                data-testid="button-cancel-edit"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Batal
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select
              value={draft.kategori}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, kategori: v as InfoBudayaKategori }))
              }
            >
              <SelectTrigger data-testid="select-kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KATEGORI_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Judul</Label>
            <Input
              value={draft.judul}
              onChange={(e) =>
                setDraft((d) => ({ ...d, judul: e.target.value }))
              }
              placeholder="Contoh: Tari Topeng Betawi"
              data-testid="input-judul"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Ringkasan singkat{" "}
              <span className="text-muted-foreground">(1–2 kalimat)</span>
            </Label>
            <Textarea
              rows={2}
              value={draft.ringkasan}
              onChange={(e) =>
                setDraft((d) => ({ ...d, ringkasan: e.target.value }))
              }
              placeholder="Kalimat pendek yang muncul di kartu utama."
              data-testid="input-ringkasan"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Isi lengkap</Label>
            <Textarea
              rows={6}
              value={draft.isi}
              onChange={(e) => setDraft((d) => ({ ...d, isi: e.target.value }))}
              placeholder="Cerita lengkap, sejarah, deskripsi kebudayaan…"
              data-testid="input-isi"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Sumber <span className="text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              value={draft.sumber}
              onChange={(e) =>
                setDraft((d) => ({ ...d, sumber: e.target.value }))
              }
              placeholder="Misal: Lembaga Kebudayaan Betawi"
              data-testid="input-sumber"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Media karya{" "}
              <span className="text-muted-foreground">
                {isSanggar ? "(wajib jika tanpa foto)" : "(opsional)"}
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => mediaFileRef.current?.click()}
                disabled={uploadingMedia}
                data-testid="button-upload-media"
              >
                <UploadCloud className="mr-1.5 h-4 w-4" />
                {uploadingMedia ? "Mengunggah…" : "Unggah MP3 / MP4"}
              </Button>
              {draft.mediaUrl.startsWith("/api/public/media/") && (
                <Badge className="bg-emerald-600 text-white">Media siap</Badge>
              )}
            </div>
            <input
              ref={mediaFileRef}
              type="file"
              accept="audio/*,video/*,image/*"
              className="hidden"
              onChange={onPickMedia}
            />
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> atau tempel tautan
              <span className="h-px flex-1 bg-border" />
            </div>
            <Input
              type="url"
              value={draft.mediaUrl}
              onChange={(e) => {
                setMediaPreviewUrl(undefined);
                setDraft((d) => ({
                  ...d,
                  mediaUrl: e.target.value,
                  mediaContentType: undefined,
                  mediaKind: undefined,
                }));
              }}
              placeholder="URL YouTube, MP3, MP4, Spotify, atau SoundCloud"
              data-testid="input-media-url"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Maksimum unggahan 60 MB. Setelah disetujui, media tampil langsung
              di halaman depan. Video diputar otomatis tanpa suara.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Gambar sampul</Label>
            <div className="flex flex-col gap-2">
              <Input
                value={draft.imageUrl}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    imageUrl: e.target.value,
                    imageDataUrl: undefined,
                  }))
                }
                placeholder="URL gambar untuk sampul media (https://…)"
                data-testid="input-image-url"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  data-testid="button-upload-image"
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Unggah gambar
                  sampul
                </Button>
                {(draft.imageDataUrl || draft.imageUrl) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        imageDataUrl: undefined,
                        imageUrl: "",
                      }))
                    }
                  >
                    Hapus gambar
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />
            </div>
            {(draft.imageDataUrl || draft.imageUrl) && (
              <div
                className="mt-2 h-32 rounded-lg bg-muted bg-cover bg-center border border-border"
                style={{
                  backgroundImage: `url(${draft.imageDataUrl || draft.imageUrl})`,
                }}
              />
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              onClick={submit}
              disabled={uploadingMedia}
              data-testid="button-submit-info"
            >
              <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
              {isSanggar
                ? editingId
                  ? "Kirim Ulang untuk Ditinjau"
                  : "Kirim untuk Ditinjau"
                : editingId
                  ? "Simpan Perubahan"
                  : "Tambah Informasi"}
            </Button>
          </div>
        </Card>

        {/* Preview + List */}
        <div className="lg:col-span-3 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
              {isSanggar ? "Pratinjau Karya" : "Pratinjau Slider Sanggar"}
            </div>
            <BudayaSlider
              items={previewItems}
              title={isSanggar ? "Karya Sanggar" : "Informasi Kebudayaan"}
              eyebrow="Pratinjau"
              autoplayMs={9999999}
              emptyText={
                isSanggar
                  ? "Isi formulir untuk melihat pratinjau karya sebelum dikirim."
                  : undefined
              }
            />
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <h3 className="font-serif text-lg">
                  {isSanggar ? "Karya Sanggar Saya" : "Daftar Informasi"}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Total <strong>{ownedItems.length}</strong> · Terbit{" "}
                  <strong>{aktifCount}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Filter</Label>
                <Select
                  value={filterKat}
                  onValueChange={(v) => setFilterKat(v as any)}
                >
                  <SelectTrigger
                    className="h-8 w-40"
                    data-testid="select-filter-kategori"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua kategori</SelectItem>
                    {KATEGORI_OPTIONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Belum ada data untuk filter ini.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((it, idx) => {
                  const src = it.imageDataUrl || it.imageUrl;
                  const status = publicationStatusOf(it);
                  return (
                    <li
                      key={it.id}
                      className="py-3 flex items-start gap-3"
                      data-testid={`row-info-${it.id}`}
                    >
                      <div
                        className="h-14 w-20 rounded-md bg-muted bg-cover bg-center shrink-0 border border-border"
                        style={
                          src ? { backgroundImage: `url(${src})` } : undefined
                        }
                      >
                        {!src && (
                          <div className="h-full w-full grid place-items-center text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {it.kategori}
                          </Badge>
                          <span className="font-medium truncate">
                            {it.judul}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              status === "published"
                                ? "bg-emerald-100 text-emerald-800"
                                : status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {status === "published"
                              ? "Terbit"
                              : status === "rejected"
                                ? "Perlu diperbaiki"
                                : status === "draft"
                                  ? "Draf"
                                  : "Menunggu tinjauan"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {it.ringkasan}
                        </div>
                        {it.mediaUrl && (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                            Media langsung aktif
                          </div>
                        )}
                        {it.reviewNote && (
                          <div className="mt-1 text-[10px] text-destructive">
                            Catatan: {it.reviewNote}
                          </div>
                        )}
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                          Diubah {fmtDate(it.updatedAt)} · Urutan #{it.order}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          {!isSanggar && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={idx === 0}
                                onClick={() => moveItem(it.id, -1)}
                                title="Naikkan urutan"
                                aria-label="Naikkan urutan"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={idx === list.length - 1}
                                onClick={() => moveItem(it.id, 1)}
                                title="Turunkan urutan"
                                aria-label="Turunkan urutan"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-emerald-700"
                                onClick={() => toggleActive(it.id)}
                                title={
                                  it.active
                                    ? "Tarik dari publikasi"
                                    : "Setujui dan terbitkan"
                                }
                                aria-label={
                                  it.active
                                    ? "Tarik dari publikasi"
                                    : "Setujui dan terbitkan"
                                }
                              >
                                {it.active ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <CircleCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              {!it.active && status !== "rejected" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => rejectItem(it.id)}
                                  title="Kembalikan untuk diperbaiki"
                                  aria-label="Kembalikan untuk diperbaiki"
                                >
                                  <CircleX className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(it)}
                            title="Ubah"
                            aria-label="Ubah"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => remove(it.id)}
                            title="Hapus"
                            aria-label="Hapus"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {!isSanggar && (
                          <Switch
                            checked={it.active}
                            onCheckedChange={() => toggleActive(it.id)}
                            aria-label="Terbit"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
