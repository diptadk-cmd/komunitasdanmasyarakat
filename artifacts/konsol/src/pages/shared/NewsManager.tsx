import { useMemo, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { fmtDate, logActivity, save, uid } from "@/lib/store";
import type { News, NewsKategori } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  Image as ImageIcon,
  Megaphone,
  Newspaper,
  Pencil,
  Plus,
  Save as SaveIcon,
  Trash2,
  X,
} from "lucide-react";

const KATEGORI_OPTIONS: NewsKategori[] = ["Berita", "Pengumuman", "Agenda"];

interface DraftState {
  judul: string;
  isi: string;
  imageUrl: string;
  kategori: NewsKategori;
}

const EMPTY_DRAFT: DraftState = {
  judul: "",
  isi: "",
  imageUrl: "",
  kategori: "Pengumuman",
};

function categoryIcon(category: NewsKategori) {
  if (category === "Pengumuman") return <Megaphone className="h-4 w-4" />;
  if (category === "Agenda") return <CalendarDays className="h-4 w-4" />;
  return <Newspaper className="h-4 w-4" />;
}

function categoryTone(category: NewsKategori) {
  if (category === "Pengumuman") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (category === "Agenda") {
    return "border-sky-300 bg-sky-50 text-sky-900";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-900";
}

function categoryOf(item: News): NewsKategori {
  if (item.kategori) return item.kategori;
  const text = `${item.judul} ${item.isi}`.toLowerCase();
  if (/pengumuman|pendaftaran|sertifikasi|kurasi/.test(text)) {
    return "Pengumuman";
  }
  if (/agenda|festival|kegiatan|jadwal/.test(text)) return "Agenda";
  return "Berita";
}

export default function NewsManager() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [filter, setFilter] = useState<"all" | NewsKategori>("all");

  const list = useMemo(() => {
    const items = [...db.news].sort((a, b) => b.createdAt - a.createdAt);
    return filter === "all"
      ? items
      : items.filter((item) => categoryOf(item) === filter);
  }, [db.news, filter]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const startEdit = (item: News) => {
    setEditingId(item.id);
    setDraft({
      judul: item.judul,
      isi: item.isi,
      imageUrl: item.imageUrl ?? "",
      kategori: categoryOf(item),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    if (!user) return;
    const judul = draft.judul.trim();
    const isi = draft.isi.trim();
    if (!judul || !isi) {
      toast({
        title: "Lengkapi dulu",
        description: "Judul dan isi wajib diisi.",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      save((data) => {
        const item = data.news.find((entry) => entry.id === editingId);
        if (!item) return;
        item.judul = judul;
        item.isi = isi;
        item.imageUrl = draft.imageUrl.trim() || undefined;
        item.kategori = draft.kategori;
      });
      logActivity(user.id, user.role, "update-news");
      toast({ title: `${draft.kategori} diperbarui` });
    } else {
      save((data) => {
        data.news.unshift({
          id: uid(),
          judul,
          isi,
          imageUrl: draft.imageUrl.trim() || undefined,
          kategori: draft.kategori,
          createdAt: Date.now(),
          authorId: user.id,
        });
      });
      logActivity(user.id, user.role, "create-news");
      toast({ title: `${draft.kategori} dipublikasikan` });
    }
    resetDraft();
  };

  const remove = (item: News) => {
    if (
      !confirm(
        `Hapus ${categoryOf(item)} “${item.judul}”? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    save((data) => {
      data.news = data.news.filter((entry) => entry.id !== item.id);
    });
    if (editingId === item.id) resetDraft();
    if (user) logActivity(user.id, user.role, "delete-news");
    toast({ title: "Publikasi dihapus" });
  };

  const previewImage = draft.imageUrl.trim();

  return (
    <div>
      <PageHeader
        title="Berita & Pengumuman"
        subtitle="Kelola berita, pengumuman resmi, dan agenda. Bagian ini terpisah dari Media Kreatif dan tampil pada kanal publikasi sistem."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-20 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-serif text-lg">
              {editingId ? (
                <Pencil className="h-4 w-4 text-accent" />
              ) : (
                <Plus className="h-4 w-4 text-accent" />
              )}
              {editingId ? "Ubah Publikasi" : "Publikasi Baru"}
            </h3>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={resetDraft}>
                <X className="mr-1 h-3.5 w-3.5" /> Batal
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Jenis publikasi</Label>
            <Select
              value={draft.kategori}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  kategori: value as NewsKategori,
                }))
              }
            >
              <SelectTrigger data-testid="select-news-kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KATEGORI_OPTIONS.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Judul</Label>
            <Input
              value={draft.judul}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  judul: event.target.value,
                }))
              }
              placeholder="Contoh: Pendaftaran Pembinaan 2026 Dibuka"
              data-testid="input-news-judul"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Isi publikasi</Label>
            <Textarea
              rows={6}
              value={draft.isi}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isi: event.target.value,
                }))
              }
              placeholder="Tulis informasi yang perlu diketahui masyarakat dan pengguna Jak Sanggar."
              data-testid="input-news-isi"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              URL gambar <span className="text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              type="url"
              value={draft.imageUrl}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  imageUrl: event.target.value,
                }))
              }
              placeholder="https://…"
              data-testid="input-news-image"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Gambar hanya menjadi ilustrasi publikasi. Video, musik, dan karya
              multimedia dikelola dari menu Media Kreatif.
            </p>
          </div>

          <Button onClick={submit} className="w-full" data-testid="button-submit-news">
            <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
            {editingId ? "Simpan Perubahan" : "Publikasikan"}
          </Button>
        </Card>

        <div className="space-y-5 lg:col-span-3">
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Pratinjau kartu publikasi
            </div>
            <Card className="overflow-hidden">
              {previewImage ? (
                <div
                  className="h-44 bg-muted bg-cover bg-center"
                  style={{ backgroundImage: `url(${previewImage})` }}
                />
              ) : (
                <div className="grid h-28 place-items-center bg-muted/60 text-muted-foreground">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
              <div className="space-y-2 p-5">
                <Badge
                  variant="outline"
                  className={`gap-1.5 ${categoryTone(draft.kategori)}`}
                >
                  {categoryIcon(draft.kategori)}
                  {draft.kategori}
                </Badge>
                <h3 className="font-serif text-xl">
                  {draft.judul.trim() || "Judul publikasi"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {draft.isi.trim() || "Isi publikasi akan terlihat di sini."}
                </p>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg">Daftar Publikasi</h3>
                <div className="text-xs text-muted-foreground">
                  Total <strong>{db.news.length}</strong> publikasi
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Filter</Label>
                <Select
                  value={filter}
                  onValueChange={(value) =>
                    setFilter(value as "all" | NewsKategori)
                  }
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua publikasi</SelectItem>
                    {KATEGORI_OPTIONS.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Belum ada publikasi untuk filter ini.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((item) => {
                  const category = categoryOf(item);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 py-3"
                      data-testid={`row-news-${item.id}`}
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground">
                        {categoryIcon(category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${categoryTone(category)}`}
                          >
                            {category}
                          </Badge>
                          <span className="font-medium">{item.judul}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.isi}
                        </p>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Diterbitkan {fmtDate(item.createdAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(item)}
                          title="Ubah"
                          aria-label="Ubah"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => remove(item)}
                          title="Hapus"
                          aria-label="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
