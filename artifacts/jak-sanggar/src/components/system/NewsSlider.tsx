import { useState } from "react";
import { fmtDate } from "@/lib/store";
import type { News } from "@/lib/types";
import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import "./news-slider.css";

export function NewsSlider({ news, title = "Berita komunitas" }: { news: News[]; title?: string }) {
  const [selectedId, setSelectedId] = useState<string>();
  const list = [...news].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const activeIndex = Math.max(0, list.findIndex(item => item.id === selectedId));
  const current = list[activeIndex];
  const select = (offset: number) => setSelectedId(list[(activeIndex + offset + list.length) % list.length].id);

  return <section className="community-news" aria-label={title}>
    <div className="community-news-heading"><h2><Newspaper aria-hidden="true" />{title}</h2>
      {list.length > 1 && <div className="community-news-controls">
        <span aria-live="polite">{activeIndex + 1} dari {list.length}</span>
        <button type="button" data-tradisi="silent" onClick={() => select(-1)} aria-label="Berita sebelumnya"><ChevronLeft aria-hidden="true" /></button>
        <button type="button" data-tradisi="silent" onClick={() => select(1)} aria-label="Berita berikutnya"><ChevronRight aria-hidden="true" /></button>
      </div>}
    </div>
    {current ? <article key={current.id} className="community-news-article">
      {current.imageUrl && <img className="community-news-image" src={current.imageUrl} alt={`Gambar ${current.judul}`} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
      <div><p className="community-news-meta">{current.kategori || "Berita"} <time dateTime={new Date(current.createdAt).toISOString()}>{fmtDate(current.createdAt)}</time></p>
        <h3>{current.judul}</h3><p className="community-news-excerpt">{current.isi}</p>
        {current.isi.length > 0 && <details><summary>Baca selengkapnya</summary><p className="community-news-full">{current.isi}</p></details>}
      </div>
    </article> : <p className="community-news-empty">Belum ada berita. Informasi dari pengelola komunitas akan tampil di sini.</p>}
  </section>;
}
