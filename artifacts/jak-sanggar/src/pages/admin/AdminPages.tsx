import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, uid, fmtDate, logActivity } from "@/lib/store";
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
import { PremiumHero } from "@/components/system/PremiumHero";
import { AnimatedCounter } from "@/components/system/AnimatedCounter";
import { NewsSlider } from "@/components/system/NewsSlider";

export function AdminHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "admin") return null;
  const a = user as AdminUser;
  const activePerms = Object.values(a.permissions).filter(Boolean).length;
  const totalPerms = Object.keys(a.permissions).length;
  return (
    <div>
      <PremiumHero
        eyebrow="Panel Operasional"
        icon={<Shield className="h-4 w-4" />}
        title={`Selamat datang, ${a.nama}`}
        subtitle="Kelola berita, banner pengumuman, dan slider carousel untuk seluruh ekosistem Jak Sanggar."
        right={
          <div className="text-right">
            <div
              className="text-[11px] font-medium uppercase tracking-[0.2em]"
              style={{ color: "hsl(42 70% 70%)" }}
            >
              Hak Akses Aktif
            </div>
            <div
              className="font-serif text-4xl mt-1"
              style={{
                background:
                  "linear-gradient(135deg, hsl(45 90% 80%), hsl(42 75% 55%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              <AnimatedCounter value={activePerms} />{" "}
              <span className="text-2xl opacity-70">/ {totalPerms}</span>
            </div>
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5 premium-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Berita
              </div>
              <div className="text-3xl font-serif mt-2">
                <AnimatedCounter value={db.news.length} />
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg grid place-items-center bg-accent/15 border border-accent/30">
              <Newspaper className="h-5 w-5 text-accent-foreground" />
            </div>
          </div>
        </Card>
        <Card className="p-5 premium-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Banner Aktif
              </div>
              <div className="text-3xl font-serif mt-2">
                <AnimatedCounter
                  value={db.banners.filter((b) => b.active).length}
                />
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg grid place-items-center bg-accent/15 border border-accent/30">
              <MessageSquare className="h-5 w-5 text-accent-foreground" />
            </div>
          </div>
        </Card>
        <Card className="p-5 premium-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Slider
              </div>
              <div className="text-3xl font-serif mt-2">
                <AnimatedCounter value={db.slider.length} />
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg grid place-items-center bg-accent/15 border border-accent/30">
              <ImageIcon className="h-5 w-5 text-accent-foreground" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <NewsSlider news={db.news} title="Berita Aktif Saat Ini" />
      </div>

      <div className="mt-6">
        <h3 className="font-serif text-lg mb-3">Hak Akses Anda</h3>
        <Card className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            Object.entries(a.permissions) as [
              keyof typeof a.permissions,
              boolean,
            ][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              {v ? (
                <Badge variant="success">Aktif</Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Nonaktif
                </Badge>
              )}
              <span className="text-muted-foreground">{k}</span>
            </div>
          ))}
        </Card>
      </div>
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
            <Label>Kategori</Label>
            <Select
              value={kategori}
              onValueChange={(value) => setKategori(value as NewsKategori)}
            >
              <SelectTrigger>
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
            <Label>Judul</Label>
            <Input value={judul} onChange={(e) => setJudul(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Isi</Label>
            <Textarea
              rows={4}
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL Gambar (opsional)</Label>
            <Input
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
          <Label>Teks Banner</Label>
          <Textarea
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
          <Label>URL Gambar</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Caption</Label>
          <Input value={cap} onChange={(e) => setCap(e.target.value)} />
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
