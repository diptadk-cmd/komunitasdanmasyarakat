import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { InfoBudaya, InfoBudayaKategori } from "@/lib/types";
import { CreativeMediaPlayer } from "@/components/system/CreativeMedia";

const KAT_COLORS: Record<
  InfoBudayaKategori,
  { bg: string; fg: string; border: string }
> = {
  Tari: {
    bg: "hsl(8 65% 55% / 0.12)",
    fg: "hsl(8 65% 45%)",
    border: "hsl(8 60% 50% / 0.4)",
  },
  Musik: {
    bg: "hsl(0 72% 52% / 0.12)",
    fg: "hsl(0 70% 46%)",
    border: "hsl(0 65% 52% / 0.4)",
  },
  Teater: {
    bg: "hsl(345 60% 50% / 0.12)",
    fg: "hsl(345 65% 45%)",
    border: "hsl(345 60% 50% / 0.4)",
  },
  Kuliner: {
    bg: "hsl(28 70% 55% / 0.14)",
    fg: "hsl(28 75% 42%)",
    border: "hsl(28 65% 50% / 0.4)",
  },
  Pakaian: {
    bg: "hsl(168 50% 45% / 0.12)",
    fg: "hsl(168 60% 35%)",
    border: "hsl(168 50% 45% / 0.4)",
  },
  Upacara: {
    bg: "hsl(42 75% 50% / 0.14)",
    fg: "hsl(38 70% 40%)",
    border: "hsl(42 70% 50% / 0.45)",
  },
  Sejarah: {
    bg: "hsl(35 62% 46% / 0.12)",
    fg: "hsl(35 65% 38%)",
    border: "hsl(35 60% 46% / 0.4)",
  },
  Bahasa: {
    bg: "hsl(95 50% 42% / 0.12)",
    fg: "hsl(95 55% 32%)",
    border: "hsl(95 50% 45% / 0.4)",
  },
  Permainan: {
    bg: "hsl(115 45% 45% / 0.12)",
    fg: "hsl(115 50% 35%)",
    border: "hsl(115 45% 45% / 0.4)",
  },
};

interface Props {
  items: InfoBudaya[];
  title?: string;
  eyebrow?: string;
  autoplayMs?: number;
}

export function BudayaSlider({
  items,
  title = "Informasi Kebudayaan",
  eyebrow = "Khazanah Budaya",
  autoplayMs = 6500,
}: Props) {
  const list = useMemo(
    () =>
      [...items]
        .filter((i) => i.active)
        .sort((a, b) => a.order - b.order || b.createdAt - a.createdAt),
    [items],
  );
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slide >= list.length) setSlide(0);
  }, [list.length, slide]);

  useEffect(() => {
    // Jangan memindahkan slide saat pengunjung sedang menikmati media aktif.
    if (paused || list.length <= 1 || list[slide]?.mediaUrl) return;
    const t = setInterval(
      () => setSlide((s) => (s + 1) % list.length),
      autoplayMs,
    );
    return () => clearInterval(t);
  }, [paused, list, slide, autoplayMs]);

  const current = list[slide];

  return (
    <Card
      className="relative overflow-hidden premium-card"
      data-testid="budaya-slider"
    >
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
            {eyebrow}
          </div>
          <h3 className="font-serif text-lg leading-tight">{title}</h3>
        </div>
        {list.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-tradisi="silent"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Mainkan otomatis" : "Jeda otomatis"}
              title={paused ? "Mainkan otomatis" : "Jeda otomatis"}
              className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {paused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              data-tradisi="silent"
              onClick={() =>
                setSlide((s) => (s - 1 + list.length) % list.length)
              }
              aria-label="Kebudayaan sebelumnya"
              className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-tradisi="silent"
              onClick={() => setSlide((s) => (s + 1) % list.length)}
              aria-label="Kebudayaan berikutnya"
              className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="px-5 pb-5">
          <p className="text-sm text-muted-foreground">
            Belum ada informasi kebudayaan. Kurator atau admin dapat menambahkan
            dari panelnya.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Media utama atau gambar sampul */}
          <div className="relative h-48 sm:h-56 overflow-hidden bg-muted">
            {current?.mediaUrl ? (
              <CreativeMediaPlayer
                key={current.id}
                item={current}
                autoplay
                className="absolute inset-0"
              />
            ) : (
              <>
                {list.map((it, i) => {
                  const src = it.imageDataUrl || it.imageUrl;
                  return (
                    <div
                      key={it.id}
                      className="absolute inset-0 transition-opacity duration-700"
                      style={{
                        opacity: i === slide ? 1 : 0,
                        pointerEvents: i === slide ? "auto" : "none",
                      }}
                    >
                      {src ? (
                        <div
                          className="absolute inset-0 bg-cover bg-center scale-105"
                          style={{
                            backgroundImage: `url(${src})`,
                            transition: "transform 6s ease-out",
                            transform:
                              i === slide ? "scale(1.08)" : "scale(1.02)",
                          }}
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(135deg, hsl(150 55% 18%), hsl(18 55% 26%))",
                          }}
                        />
                      )}
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(180deg, hsl(0 0% 0% / 0) 30%, hsl(0 0% 0% / 0.85) 100%)",
                        }}
                      />
                    </div>
                  );
                })}

                {current && (
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
                    <Badge
                      className="border mb-2"
                      style={{
                        background: KAT_COLORS[current.kategori].bg,
                        color: KAT_COLORS[current.kategori].fg,
                        borderColor: KAT_COLORS[current.kategori].border,
                      }}
                    >
                      {current.kategori}
                    </Badge>
                    <h4 className="font-serif text-xl sm:text-2xl leading-tight drop-shadow-lg">
                      {current.judul}
                    </h4>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Body */}
          {current && (
            <div className="p-4 sm:p-5 space-y-3">
              {current.mediaUrl && (
                <div>
                  <Badge
                    className="mb-2 border"
                    style={{
                      background: KAT_COLORS[current.kategori].bg,
                      color: KAT_COLORS[current.kategori].fg,
                      borderColor: KAT_COLORS[current.kategori].border,
                    }}
                  >
                    {current.kategori}
                  </Badge>
                  <h4 className="font-serif text-xl leading-tight">
                    {current.judul}
                  </h4>
                </div>
              )}
              <p className="text-sm text-foreground/85 leading-relaxed">
                {current.isi || current.ringkasan}
              </p>
              {current.sumber && (
                <div className="text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sumber: {current.sumber}
                </div>
              )}
            </div>
          )}

          {/* Dots */}
          {list.length > 1 && (
            <div className="px-5 pb-4 flex items-center justify-center gap-1.5">
              {list.map((_, i) => (
                <button
                  type="button"
                  data-tradisi="silent"
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Kebudayaan ${i + 1} dari ${list.length}`}
                  aria-current={i === slide}
                  className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    i === slide
                      ? "w-7 bg-accent"
                      : "w-2 bg-muted-foreground/30 hover:bg-accent/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
