import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { fmtDate } from "@/lib/store";
import type { News } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function NewsSlider({ news, title = "Berita Terbaru" }: { news: News[]; title?: string }) {
  const [slide, setSlide] = useState(0);
  const list = [...news].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  useEffect(() => {
    if (list.length === 0) return;
    const t = setInterval(() => setSlide(s => (s + 1) % list.length), 5500);
    return () => clearInterval(t);
  }, [list.length]);

  return (
    <Card className="p-5 relative overflow-hidden premium-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        {list.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button" data-tradisi="silent"
              onClick={() => setSlide((slide - 1 + list.length) % list.length)}
              aria-label="Berita sebelumnya"
              className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            ><ChevronLeft className="h-4 w-4" /></button>
            <button
              type="button" data-tradisi="silent"
              onClick={() => setSlide((slide + 1) % list.length)}
              aria-label="Berita berikutnya"
              className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            ><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada berita.</p>
      ) : (
        <div className="relative min-h-[140px]">
          {list.map((n, i) => (
            <div
              key={n.id}
              className="absolute inset-0 transition-all duration-500"
              style={{
                opacity: i === slide ? 1 : 0,
                transform: i === slide ? "translateY(0)" : "translateY(8px)",
                pointerEvents: i === slide ? "auto" : "none",
              }}
            >
              <div className="border-l-2 border-accent pl-3">
                <div className="text-sm font-medium leading-snug">{n.judul}</div>
                <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{fmtDate(n.createdAt)}</div>
                <div className="text-xs text-muted-foreground mt-2 line-clamp-3">{n.isi}</div>
              </div>
            </div>
          ))}
          {list.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5">
              {list.map((_, i) => (
                <button
                  type="button" data-tradisi="silent" key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Berita ${i + 1} dari ${list.length}`}
                  aria-current={i === slide}
                  className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${i === slide ? "w-6 bg-accent" : "w-2 bg-muted hover:bg-accent/50"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
