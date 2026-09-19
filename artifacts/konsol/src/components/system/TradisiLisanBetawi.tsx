import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useDb } from "@/lib/auth";
import type { TradisiItem, TradisiKategori, TradisiPosition, TradisiSettings } from "@/lib/types";

const DEFAULT_POOL: TradisiItem[] = [
  { id: "d-pb-1", kategori: "Pantun Betawi", judul: "Pantun Sanggar", isi: "Anak Betawi menabuh rebana,\nIramanya merdu di kala senja.\nKlik tombolmu penuh makna,\nJak Sanggar siap bekerja." },
  { id: "d-pb-2", kategori: "Pantun Betawi", judul: "Pantun Klik", isi: "Pergi ke pasar membeli kain,\nKain batik corak melati.\nSetiap karya seniman lain,\nMenyatu indah di sanggar ini." },
  { id: "d-pb-3", kategori: "Pantun Betawi", judul: "Pantun Honor", isi: "Ke Monas sore naik bajaj,\nLewat Sudirman macetnya panjang.\nHonor cair tepat di hari gajian,\nHati tenang kerja pun lapang." },
  { id: "d-pb-4", kategori: "Pantun Betawi", judul: "Pantun Latihan", isi: "Ondel-ondel berjalan beriring,\nMengikuti irama gendang pengantin.\nLatihan rutin jangan dimiringin,\nBakat tumbuh menjadi terlatih." },
  { id: "d-pb-5", kategori: "Pantun Betawi", judul: "Pantun Tari Topeng", isi: "Kembang kelapa dipasang tinggi,\nMenghias panggung di hari raya.\nTari Betawi penuh berseri,\nMelestarikan budaya pusaka." },
  { id: "d-pr-1", kategori: "Peribahasa", judul: "Tau Diri", isi: "“Aer beriak tande tak dalem,\naer tenang bukan berarti gak ade ikannye.”", sumber: "Peribahasa Betawi" },
  { id: "d-pr-2", kategori: "Peribahasa", judul: "Kerja Bareng", isi: "“Berate same dipikul,\nringen same dijinjing.”", sumber: "Peribahasa Betawi" },
  { id: "d-pr-3", kategori: "Peribahasa", judul: "Hemat", isi: "“Hemat pangkel kaye,\nrajin pangkel pinter.”", sumber: "Petitih Betawi" },
  { id: "d-pr-4", kategori: "Peribahasa", judul: "Sopan Santun", isi: "“Kalo ngomong kudu pake ati,\nkalo ketawe jangan lupe diri.”", sumber: "Peribahasa Betawi" },
  { id: "d-pr-5", kategori: "Peribahasa", judul: "Kebersamaan", isi: "“Same-same ngerasain pait,\nsame-same nikmatin manis.”", sumber: "Peribahasa Betawi" },
  { id: "d-pp-1", kategori: "Palang Pintu", judul: "Sambutan Tamu", isi: "Bang, lewat sini kudu permisi,\nrumah kami punye aturan.\nKlik tombolnye dengen hati,\nbiar berkah dapet sambutan.", sumber: "Buka Palang Pintu" },
  { id: "d-pp-2", kategori: "Palang Pintu", judul: "Tantangan Halus", isi: "Burung kuthilang di atas dahan,\nbersuara nyaring sebelum subuh.\nKalo emang punya kemampuan,\nlanjutin terus jangan berkeluh.", sumber: "Buka Palang Pintu" },
  { id: "d-pp-3", kategori: "Palang Pintu", judul: "Salam Hormat", isi: "Assalamualaikum kami ucapkan,\nsalam hormat penuh ketulusan.\nDi sanggar ini kite kerjakan,\namanat budaye jadi pusaka warisan.", sumber: "Buka Palang Pintu" },
  { id: "d-sh-1", kategori: "Sahibul Hikayat", judul: "Pembuka Cerita", isi: "“Pade jaman dahulu kale,\ndi tanah Betawi nan permai…”\nBegitulah tukang cerite mulai,\nmenuturkan hikayat yang ramai.", sumber: "Tradisi Sahibul Hikayat" },
  { id: "d-sh-2", kategori: "Sahibul Hikayat", judul: "Pesan Tetua", isi: "“Anak muda, dengerin baek-baek,\nilmu itu bukan sekadar tau.\nDikerjain baru jadi berkat,\nbukan cuman omongan doang lho.”", sumber: "Tutur Tetua Betawi" },
  { id: "d-sh-3", kategori: "Sahibul Hikayat", judul: "Penutup Hikayat", isi: "“Demikianlah cerite ini berakhir,\nambil hikmahnye buat bekal.\nYang baek dipegang kuat-kuat,\nyang buruk dibuang jangan kekal.”", sumber: "Tradisi Sahibul Hikayat" },
  { id: "d-cr-1", kategori: "Cerita Rakyat", judul: "Si Pitung", isi: "Si Pitung jago dari Rawabelong,\nbela rakyat kecil tanpa pamrih.\nSemangatnye hidup terus tertolong,\nbiar generasi muda gak letih.", sumber: "Legende Si Pitung" },
  { id: "d-cr-2", kategori: "Cerita Rakyat", judul: "Nyai Dasimah", isi: "Nyai Dasimah cantik jelita,\nkisahnye masyhur sampe sekarang.\nDari die kite belajar nyate,\npilihan hidup mesti dipikir matang.", sumber: "Legende Betawi" },
  { id: "d-cr-3", kategori: "Cerita Rakyat", judul: "Mirah dari Marunda", isi: "Mirah jago silat dari Marunda,\nperempuan Betawi yang berani.\nKarya budaye kudu dijaga,\nbiar tetep idup di hati nurani.", sumber: "Legende Betawi" },
  { id: "d-sb-1", kategori: "Salam Betawi", judul: "Salam Akrab", isi: "“Eh, ape kabar ente, Bang?\nMudah-mudahan sehat selalu ye.\nDi sanggar ini kite berjuang,\nlestariin seni jakartanye.”", sumber: "Ungkapan Sehari-hari" },
  { id: "d-sb-2", kategori: "Salam Betawi", judul: "Doa Mulai Kerja", isi: "“Bismillah, mulai kerja kite,\nmoga lancar gak ade halangan.\nNiat lurus ati senang,\nrejeki dateng dari Tuhan.”", sumber: "Doa Sederhana Betawi" },
  { id: "d-sb-3", kategori: "Salam Betawi", judul: "Pamit", isi: "“Mari Bang, ane permisi dulu,\nente terusin kerjaan ente.\nNanti kalo ade kabar baru,\nente kabarin ane lewat sini.”", sumber: "Ungkapan Pamit" },
  { id: "d-rc-1", kategori: "Rancag", judul: "Rancag Pembuka", isi: "Anak Jakarta naik MRT,\nturun di Bunderan HI yang ramai.\nKalo udah niat jadi seniman sejati,\njangan setengah-setengah ye, sampe rampung sampai.", sumber: "Rancag Tradisi Betawi" },
  { id: "d-rc-2", kategori: "Rancag", judul: "Rancag Tekun", isi: "Burung dare terbang berdua,\nhinggap sebentar di pucuk pohon kelape.\nTekun belajar jangan ade dua,\nfokus satu biar berkah doanye.", sumber: "Rancag Tradisi Betawi" },
  { id: "d-rc-3", kategori: "Rancag", judul: "Rancag Syukur", isi: "Hujan rintik di Kota Tua,\npayung warna-warni meneduhi jalan.\nApe yang ade tetap disyukuri,\nrejeki dikit tetep berkah pamungkas.", sumber: "Rancag Tradisi Betawi" },
  { id: "d-ln-1", kategori: "Lenong", judul: "Dialog Lenong", isi: "“Bang Jampang, ngapain lo bengong?”\n“Nih Mpok, gue lagi mikirin Sanggar.”\n“Pikirin yang bener dong, jangan ngelong,\nbiar Jak Sanggar makin gencar.”", sumber: "Lenong Denes" },
  { id: "d-ln-2", kategori: "Lenong", judul: "Lawakan Lenong", isi: "“Mpok, kenape klik tombolnye lame banget?”\n“Sabar Bang, namenye juga teknologi.”\n“Ye kalo gini terus, tuker hape ane gadget!”\n“Eh udah, klik aje terus, nanti juge jalan sendiri.”", sumber: "Lenong Preman" },
];

export const DEFAULT_KATEGORI_COLOR: Record<TradisiKategori, string> = {
  "Pantun Betawi": "#e3b864",
  "Peribahasa": "#d4a64e",
  "Palang Pintu": "#c2784a",
  "Sahibul Hikayat": "#b89460",
  "Cerita Rakyat": "#d6342a",
  "Salam Betawi": "#caa86a",
  "Rancag": "#daa44e",
  "Lenong": "#e0552f",
};

export const DEFAULT_TRADISI_POOL = DEFAULT_POOL;

const POSITION_CLASS: Record<TradisiPosition, string> = {
  br: "right-0 bottom-0",
  bl: "left-0 bottom-0",
  tr: "right-0 top-0",
  tl: "left-0 top-0",
};

export function TradisiLisanProvider() {
  const db = useDb();
  const settings: TradisiSettings = db.appearance?.tradisi ?? {
    enabled: true, position: "br", cooldownMs: 2200, autoHideMs: 4200,
    cardWidth: 280, showCloseButton: true, source: "default", custom: [],
  };

  const pool = useMemo<TradisiItem[]>(() => {
    if (settings.source === "custom") return settings.custom.length ? settings.custom : DEFAULT_POOL;
    if (settings.source === "merge") return [...DEFAULT_POOL, ...settings.custom];
    return DEFAULT_POOL;
  }, [settings.source, settings.custom]);

  const [active, setActive] = useState<TradisiItem | null>(null);
  const [tick, setTick] = useState(0);
  const lastShownRef = useRef<number>(0);
  const lastIndexRef = useRef<number>(-1);
  const hideTimerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setActive(null);
    if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (!settings.enabled) {
      setActive(null);
      if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      return;
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-tradisi-popup="root"]')) return;

      const btn = target.closest<HTMLElement>(
        'button, [role="button"], a[href], [data-tradisi="trigger"]'
      );
      if (!btn) return;
      if (btn.closest('[data-tradisi="silent"]')) return;
      if (btn.getAttribute("aria-disabled") === "true" || (btn as HTMLButtonElement).disabled) return;

      if (pool.length === 0) return;
      const now = Date.now();
      if (now - lastShownRef.current < settings.cooldownMs) return;
      lastShownRef.current = now;

      let idx = Math.floor(Math.random() * pool.length);
      if (idx === lastIndexRef.current && pool.length > 1) idx = (idx + 1) % pool.length;
      lastIndexRef.current = idx;

      setActive(pool[idx]);
      setTick(t => t + 1);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setActive(null), settings.autoHideMs);
    };

    document.addEventListener("click", handler, true);
    return () => {
      document.removeEventListener("click", handler, true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [settings.enabled, settings.cooldownMs, settings.autoHideMs, pool]);

  if (!settings.enabled) return null;

  return (
    <div data-tradisi-popup="root" className={`pointer-events-none fixed z-[60] p-3 sm:p-4 ${POSITION_CLASS[settings.position]}`}>
      {active && (
        <motion.div
          key={tick}
          initial={{ opacity: 0, y: settings.position.startsWith("t") ? -18 : 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: settings.position.startsWith("t") ? -12 : 12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.7 }}
          className="pointer-events-auto"
          style={{ width: Math.max(220, Math.min(420, settings.cardWidth)) }}
        >
          <Card item={active} onClose={dismiss} progressKey={tick} settings={settings} />
        </motion.div>
      )}
    </div>
  );
}

function Card({ item, onClose, progressKey, settings }: { item: TradisiItem; onClose: () => void; progressKey: number; settings: TradisiSettings }) {
  const accent = settings.kategoriColors?.[item.kategori] ?? DEFAULT_KATEGORI_COLOR[item.kategori];

  return (
    <div
      className="group relative overflow-hidden rounded-xl backdrop-blur-md border"
      style={{
        background: "linear-gradient(140deg, hsl(150 55% 9% / 0.93) 0%, hsl(150 45% 13% / 0.92) 60%, hsl(18 55% 16% / 0.93) 100%)",
        borderColor: `${accent}55`,
        boxShadow: `0 12px 30px -10px rgba(0,0,0,0.5), 0 0 0 1px ${accent}1a, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      {settings.showCloseButton && (
        <button
          type="button"
          onClick={onClose}
          data-tradisi="silent"
          aria-label="Tutup"
          className="absolute right-1.5 top-1.5 grid place-items-center h-5 w-5 rounded-full text-amber-100/40 opacity-0 group-hover:opacity-100 hover:text-amber-100 hover:bg-white/10 transition z-10"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="px-3.5 pt-3 pb-1 flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full"
          style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}44` }}
        >
          <span className="h-[3px] w-[3px] rounded-full" style={{ background: accent }} />
          {item.kategori}
        </span>
      </div>

      <div className="px-3.5 pb-0.5">
        <h3 className="font-serif text-[13px] leading-tight text-amber-50/95">{item.judul}</h3>
      </div>

      <div className="px-3.5 pb-3 pt-1">
        <p className="font-serif italic text-[11.5px] leading-[1.55] text-amber-50/85 whitespace-pre-line line-clamp-4">
          {item.isi}
        </p>
        {item.sumber && (
          <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-100/85 text-right">
            — {item.sumber}
          </div>
        )}
      </div>

      <div className="h-[2px] w-full bg-white/5">
        <motion.div
          key={`bar-${progressKey}`}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: settings.autoHideMs / 1000, ease: "linear" }}
          className="h-full"
          style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }}
        />
      </div>
    </div>
  );
}
