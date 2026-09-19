import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, uid, fmtDate, logActivity } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardWelcome, DashboardMetrics, DashboardLinks } from "@/components/layout/RoleWorkspace";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { AdminUser, NewsKategori } from "@/lib/types";
import {
  Newspaper,
  Image as ImageIcon,
  MessageSquare,
  Lock,
  Shield,
} from "lucide-react";
import { NewsSlider } from "@/components/system/NewsSlider";

export function AdminHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "admin") return null;
  const a = user as AdminUser;
  const activePerms = Object.values(a.permissions).filter(Boolean).length;
  const totalPerms = Object.keys(a.permissions).length;
  const permissionLabels: Record<string, string> = {
    kelolaBerita: "Kelola berita", kelolaBanner: "Kelola pengumuman", kelolaSlider: "Kelola slider",
    kelolaJamPembinaan: "Kelola jam pembinaan", kelolaInfoBudaya: "Kelola info budaya",
  };
  const actions = [
    { allowed: a.permissions.kelolaBerita, href: "/admin/berita", label: "Berita komunitas", description: "Tulis, perbarui, dan kelola berita yang ditayangkan.", icon: Newspaper },
    { allowed: a.permissions.kelolaBanner, href: "/admin/banner", label: "Pengumuman", description: "Atur pesan penting untuk pengguna portal.", icon: MessageSquare },
    { allowed: a.permissions.kelolaSlider, href: "/admin/slider", label: "Slider portal", description: "Kelola gambar utama dan tautan di halaman depan.", icon: ImageIcon },
    { allowed: a.permissions.kelolaInfoBudaya, href: "/admin/info-budaya", label: "Info budaya", description: "Kelola publikasi karya dan kegiatan budaya.", icon: ImageIcon },
  ].filter(action => action.allowed);
  return (
    <div className="role-workspace" data-testid="admin-home">
      <DashboardWelcome role="Ruang administrator" title={`Selamat datang, ${a.nama}`} description="Kelola publikasi dan informasi untuk komunitas JakSanggar."
        primary={actions[0] ? { href: actions[0].href, label: actions[0].label } : undefined} />
      <DashboardMetrics label="Ringkasan publikasi" items={[
        { label: "Berita", value: db.news.length, href: a.permissions.kelolaBerita ? "/admin/berita" : undefined },
        { label: "Pengumuman aktif", value: db.banners.filter(b => b.active).length, href: a.permissions.kelolaBanner ? "/admin/banner" : undefined },
        { label: "Slide portal", value: db.slider.length, href: a.permissions.kelolaSlider ? "/admin/slider" : undefined },
      ]} />
      {actions.length > 0 ? <DashboardLinks title="Kelola publikasi" items={actions} /> : <div className="rw-notice">Belum ada akses pengelolaan publikasi yang aktif. Hubungi kurator untuk pengaturan akses.</div>}
      <section className="rw-panel" aria-label="Hak akses Anda">
        <div className="rw-permission-summary"><h2>Hak akses Anda</h2><span>{activePerms} dari {totalPerms} aktif</span></div>
        <div className="rw-access">{Object.entries(a.permissions).map(([key, enabled]) => <div key={key}>
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Aktif" : "Nonaktif"}</Badge>
          <span>{permissionLabels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase())}</span>
        </div>)}</div>
      </section>
      <NewsSlider news={db.news} title="Berita untuk komunitas" />
    </div>
  );
}

export function AdminBerita() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "admin") return null;
  const a = user as AdminUser;
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [img, setImg] = useState("");
  const [kategori, setKategori] = useState<NewsKategori>("Berita");

  if (!a.permissions.kelolaBerita) return <Locked />;

  const tambah = () => {
    const cleanJudul = judul.trim();
    const cleanIsi = isi.trim();
    if (!cleanJudul || !cleanIsi) {
      toast({ title: "Judul dan isi wajib diisi", variant: "destructive" });
      return;
    }
    save((d) => {
      d.news.unshift({
        id: uid(),
        judul: cleanJudul,
        isi: cleanIsi,
        imageUrl: img.trim() || undefined,
        kategori,
        createdAt: Date.now(),
        authorId: a.id,
      });
    });
    logActivity(a.id, "admin", "create-news");
    toast({ title: `${kategori} dipublikasikan` });
    setJudul("");
    setIsi("");
    setImg("");
    setKategori("Berita");
  };

  return (
    <div>
      <PageHeader
        title="Kelola Berita"
        subtitle="Berita ini muncul di dasbor seluruh Sanggar."
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1 space-y-3 h-fit">
          <h3 className="font-serif text-lg">Berita Baru</h3>
          <div className="space-y-1.5">
            <Label htmlFor="admin-news-category">Kategori</Label>
            <Select
              value={kategori}
              onValueChange={(value) => setKategori(value as NewsKategori)}
            >
              <SelectTrigger id="admin-news-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Berita", "Pengumuman", "Agenda"] as NewsKategori[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-news-title">Judul</Label>
            <Input id="admin-news-title" value={judul} onChange={(e) => setJudul(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-news-body">Isi</Label>
            <Textarea
              id="admin-news-body"
              rows={4}
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-news-image">URL Gambar (opsional)</Label>
            <Input
              id="admin-news-image"
              value={img}
              onChange={(e) => setImg(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <Button onClick={tambah} disabled={!judul.trim() || !isi.trim()}>
            Publikasikan
          </Button>
        </Card>
        <div className="lg:col-span-2 space-y-3">
          {db.news.map((n) => (
            <Card
              key={n.id}
              className="p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{n.kategori ?? "Berita"}</Badge>
                  {fmtDate(n.createdAt)}
                </div>
                <div className="font-medium mt-0.5">{n.judul}</div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {n.isi}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  save((d) => {
                    d.news = d.news.filter((x) => x.id !== n.id);
                  })
                }
              >
                Hapus
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminBanner() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "admin") return null;
  const a = user as AdminUser;
  if (!a.permissions.kelolaBanner) return <Locked />;
  const [teks, setTeks] = useState("");
  return (
    <div>
      <PageHeader
        title="Kelola Banner Pengumuman"
        subtitle="Banner muncul di atas dasbor pengguna."
      />
      <Card className="p-5 max-w-xl space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="admin-banner-text">Teks Banner</Label>
          <Textarea
            id="admin-banner-text"
            rows={2}
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
          />
        </div>
        <Button
          disabled={!teks}
          onClick={() => {
            save((d) => {
              d.banners.forEach((b) => (b.active = false));
              d.banners.unshift({
                id: uid(),
                teks,
                start: Date.now(),
                end: Date.now() + 30 * 86400000,
                active: true,
              });
            });
            toast({ title: "Banner dipublikasi" });
            setTeks("");
          }}
        >
          Publikasi
        </Button>
      </Card>
      <div className="mt-6 space-y-2">
        {db.banners.map((b) => (
          <Card
            key={b.id}
            className="p-4 flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-sm">{b.teks}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {fmtDate(b.start)} – {fmtDate(b.end)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                aria-label={`Tampilkan pengumuman ${b.teks}`}
                checked={b.active}
                onCheckedChange={(c) =>
                  save((d) => {
                    const x = d.banners.find((y) => y.id === b.id);
                    if (x) x.active = c;
                  })
                }
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  save((d) => {
                    d.banners = d.banners.filter((x) => x.id !== b.id);
                  })
                }
              >
                Hapus
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminSlider() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "admin") return null;
  const a = user as AdminUser;
  if (!a.permissions.kelolaSlider) return <Locked />;
  const [url, setUrl] = useState("");
  const [cap, setCap] = useState("");
  return (
    <div>
      <PageHeader title="Kelola Slider Carousel" />
      <Card className="p-5 max-w-xl grid sm:grid-cols-2 gap-3 mb-6">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="admin-slide-image">URL Gambar</Label>
          <Input
            id="admin-slide-image"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="admin-slide-caption">Caption</Label>
          <Input id="admin-slide-caption" value={cap} onChange={(e) => setCap(e.target.value)} />
        </div>
        <Button
          className="sm:col-span-2"
          disabled={!url}
          onClick={() => {
            save((d) => {
              d.slider.push({ id: uid(), imageUrl: url, caption: cap });
            });
            setUrl("");
            setCap("");
          }}
        >
          Tambah Slide
        </Button>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {db.slider.map((s) => (
          <Card key={s.id} className="overflow-hidden">
            <div
              className="aspect-video bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url(${s.imageUrl})` }}
            />
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="text-sm truncate">{s.caption}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  save((d) => {
                    d.slider = d.slider.filter((x) => x.id !== s.id);
                  })
                }
              >
                Hapus
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Locked() {
  return (
    <div>
      <PageHeader title="Akses Dibatasi" />
      <Card className="p-12 text-center">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <div className="text-sm text-muted-foreground">
          Hak akses untuk modul ini belum diaktifkan oleh Kurator.
        </div>
      </Card>
    </div>
  );
}
