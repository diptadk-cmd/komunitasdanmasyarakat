import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useLocation } from "wouter";
import { useDb } from "@/lib/auth";
import latarAncol from "@/assets/tradisi-lisan/latar-ancol.png";
import latarMonas from "@/assets/tradisi-lisan/latar-monas.png";
import latarMuseumBahari from "@/assets/tradisi-lisan/latar-museum-bahari.png";
import latarMuseumFatahillah from "@/assets/tradisi-lisan/latar-museum-fatahillah.png";
import latarMuseumNasional from "@/assets/tradisi-lisan/latar-museum-nasional.png";
import latarMuseumWayang from "@/assets/tradisi-lisan/latar-museum-wayang.png";
import latarPulauOnrust from "@/assets/tradisi-lisan/latar-pulau-onrust.png";
import latarPulauTidung from "@/assets/tradisi-lisan/latar-pulau-tidung.png";
import latarRagunan from "@/assets/tradisi-lisan/latar-ragunan.png";
import latarSetuBabakan from "@/assets/tradisi-lisan/latar-setu-babakan.png";
import latarSundaKelapa from "@/assets/tradisi-lisan/latar-sunda-kelapa.png";
import latarTamanMini from "@/assets/tradisi-lisan/latar-taman-mini.png";
import type {
  TradisiItem,
  TradisiKategori,
  TradisiPosition,
  TradisiSettings,
} from "@/lib/types";

const DEFAULT_POOL: TradisiItem[] = [
  {
    id: "d-pb-1",
    kategori: "Pantun Betawi",
    judul: "Pantun Sanggar",
    isi: "Anak Betawi menabuh rebana,\nIramanya merdu di kala senja.\nKlik tombolmu penuh makna,\nJak Sanggar siap bekerja.",
  },
  {
    id: "d-pb-2",
    kategori: "Pantun Betawi",
    judul: "Pantun Klik",
    isi: "Pergi ke pasar membeli kain,\nKain batik corak melati.\nSetiap karya seniman lain,\nMenyatu indah di sanggar ini.",
  },
  {
    id: "d-pb-3",
    kategori: "Pantun Betawi",
    judul: "Pantun Dana",
    isi: "Ke Monas sore naik bajaj,\nLewat Sudirman macetnya panjang.\nDana proyek dicatat yang jelas,\nHati tenang kerja pun lapang.",
  },
  {
    id: "d-pb-4",
    kategori: "Pantun Betawi",
    judul: "Pantun Latihan",
    isi: "Ondel-ondel berjalan beriring,\nMengikuti irama gendang pengantin.\nLatihan rutin jangan dimiringin,\nBakat tumbuh menjadi terlatih.",
  },
  {
    id: "d-pb-5",
    kategori: "Pantun Betawi",
    judul: "Pantun Tari Topeng",
    isi: "Kembang kelapa dipasang tinggi,\nMenghias panggung di hari raya.\nTari Betawi penuh berseri,\nMelestarikan budaya pusaka.",
  },
  {
    id: "d-pb-6",
    kategori: "Pantun Betawi",
    judul: "Pantun Silaturahmi",
    isi: "Jalan-jalan ke Setu Babakan,\nPulangnye bawa kerak telor.\nMari budaya kite lestarikan,\nBiar Betawi makin kesohor.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pb-7",
    kategori: "Pantun Betawi",
    judul: "Pantun Gambang Kromong",
    isi: "Gambang kromong bunyinye terang,\nTanjidor nyaut dari Kemayoran.\nJangan malu belajar sekarang,\nSeni Betawi jadi kebanggaan.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pb-8",
    kategori: "Pantun Betawi",
    judul: "Pantun Kembang Kelapa",
    isi: "Kembang kelapa warna-warni,\nDipasang rapih di depan laman.\nSopan santun dijaga di hati,\nBiar hidup penuh kerukunan.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pb-9",
    kategori: "Pantun Betawi",
    judul: "Pantun Ondel-ondel",
    isi: "Ondel-ondel tinggi berdiri,\nNari keliling Kampung Melayu.\nBudaya Betawi dijaga sendiri,\nBiar anak cucu ikut tahu.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pb-10",
    kategori: "Pantun Betawi",
    judul: "Pantun Silat",
    isi: "Pagi-pagi makan ketupat,\nKuahnye gurih pakai semur.\nBelajar silat badan sehat,\nAdab dijaga sepanjang umur.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pb-11",
    kategori: "Pantun Betawi",
    judul: "Pantun Salak Condet",
    isi: "Salak Condet dibawa Mpok Minah,\nDijual pagi dekat pelabuhan.\nKalau niat jangan setengah,\nTuntaskan kerja penuh kesungguhan.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pb-12",
    kategori: "Pantun Betawi",
    judul: "Pantun Kerja Bareng",
    isi: "Beli roti di Pasar Senen,\nMinumnye kopi di pinggir kali.\nKalau kerja kudu yang bener,\nBiar manfaat dirasain kembali.",
    sumber: "Pantun Betawi",
  },
  {
    id: "d-pr-1",
    kategori: "Peribahasa",
    judul: "Tau Diri",
    isi: "“Aer beriak tande tak dalem,\naer tenang bukan berarti gak ade ikannye.”",
    sumber: "Peribahasa Betawi",
  },
  {
    id: "d-pr-2",
    kategori: "Peribahasa",
    judul: "Kerja Bareng",
    isi: "“Berate same dipikul,\nringen same dijinjing.”",
    sumber: "Peribahasa Betawi",
  },
  {
    id: "d-pr-3",
    kategori: "Peribahasa",
    judul: "Hemat",
    isi: "“Hemat pangkel kaye,\nrajin pangkel pinter.”",
    sumber: "Petitih Betawi",
  },
  {
    id: "d-pr-4",
    kategori: "Peribahasa",
    judul: "Sopan Santun",
    isi: "“Kalo ngomong kudu pake ati,\nkalo ketawe jangan lupe diri.”",
    sumber: "Peribahasa Betawi",
  },
  {
    id: "d-pr-5",
    kategori: "Peribahasa",
    judul: "Kebersamaan",
    isi: "“Same-same ngerasain pait,\nsame-same nikmatin manis.”",
    sumber: "Peribahasa Betawi",
  },
  {
    id: "d-pp-1",
    kategori: "Palang Pintu",
    judul: "Sambutan Tamu",
    isi: "Bang, lewat sini kudu permisi,\nrumah kami punye aturan.\nKlik tombolnye dengen hati,\nbiar berkah dapet sambutan.",
    sumber: "Buka Palang Pintu",
  },
  {
    id: "d-pp-2",
    kategori: "Palang Pintu",
    judul: "Tantangan Halus",
    isi: "Burung kuthilang di atas dahan,\nbersuara nyaring sebelum subuh.\nKalo emang punya kemampuan,\nlanjutin terus jangan berkeluh.",
    sumber: "Buka Palang Pintu",
  },
  {
    id: "d-pp-3",
    kategori: "Palang Pintu",
    judul: "Salam Hormat",
    isi: "Assalamualaikum kami ucapkan,\nsalam hormat penuh ketulusan.\nDi sanggar ini kite kerjakan,\namanat budaye jadi pusaka warisan.",
    sumber: "Buka Palang Pintu",
  },
  {
    id: "d-sh-1",
    kategori: "Sahibul Hikayat",
    judul: "Pembuka Cerita",
    isi: "“Pade jaman dahulu kale,\ndi tanah Betawi nan permai…”\nBegitulah tukang cerite mulai,\nmenuturkan hikayat yang ramai.",
    sumber: "Tradisi Sahibul Hikayat",
  },
  {
    id: "d-sh-2",
    kategori: "Sahibul Hikayat",
    judul: "Pesan Tetua",
    isi: "“Anak muda, dengerin baek-baek,\nilmu itu bukan sekadar tau.\nDikerjain baru jadi berkat,\nbukan cuman omongan doang lho.”",
    sumber: "Tutur Tetua Betawi",
  },
  {
    id: "d-sh-3",
    kategori: "Sahibul Hikayat",
    judul: "Penutup Hikayat",
    isi: "“Demikianlah cerite ini berakhir,\nambil hikmahnye buat bekal.\nYang baek dipegang kuat-kuat,\nyang buruk dibuang jangan kekal.”",
    sumber: "Tradisi Sahibul Hikayat",
  },
  {
    id: "d-cr-1",
    kategori: "Cerita Rakyat",
    judul: "Si Pitung",
    isi: "Si Pitung jago dari Rawabelong,\nbela rakyat kecil tanpa pamrih.\nSemangatnye hidup terus tertolong,\nbiar generasi muda gak letih.",
    sumber: "Legende Si Pitung",
  },
  {
    id: "d-cr-2",
    kategori: "Cerita Rakyat",
    judul: "Nyai Dasimah",
    isi: "Nyai Dasimah cantik jelita,\nkisahnye masyhur sampe sekarang.\nDari die kite belajar nyate,\npilihan hidup mesti dipikir matang.",
    sumber: "Legende Betawi",
  },
  {
    id: "d-cr-3",
    kategori: "Cerita Rakyat",
    judul: "Mirah dari Marunda",
    isi: "Mirah jago silat dari Marunda,\nperempuan Betawi yang berani.\nKarya budaye kudu dijaga,\nbiar tetep idup di hati nurani.",
    sumber: "Legende Betawi",
  },
  {
    id: "d-sb-1",
    kategori: "Salam Betawi",
    judul: "Salam Akrab",
    isi: "“Eh, ape kabar ente, Bang?\nMudah-mudahan sehat selalu ye.\nDi sanggar ini kite berjuang,\nlestariin seni jakartanye.”",
    sumber: "Ungkapan Sehari-hari",
  },
  {
    id: "d-sb-2",
    kategori: "Salam Betawi",
    judul: "Doa Mulai Kerja",
    isi: "“Bismillah, mulai kerja kite,\nmoga lancar gak ade halangan.\nNiat lurus ati senang,\nrejeki dateng dari Tuhan.”",
    sumber: "Doa Sederhana Betawi",
  },
  {
    id: "d-sb-3",
    kategori: "Salam Betawi",
    judul: "Pamit",
    isi: "“Mari Bang, ane permisi dulu,\nente terusin kerjaan ente.\nNanti kalo ade kabar baru,\nente kabarin ane lewat sini.”",
    sumber: "Ungkapan Pamit",
  },
  {
    id: "d-rc-1",
    kategori: "Rancag",
    judul: "Rancag Pembuka",
    isi: "Anak Jakarta naik MRT,\nturun di Bunderan HI yang ramai.\nKalo udah niat jadi seniman sejati,\njangan setengah-setengah ye, sampe rampung sampai.",
    sumber: "Rancag Tradisi Betawi",
  },
  {
    id: "d-rc-2",
    kategori: "Rancag",
    judul: "Rancag Tekun",
    isi: "Burung dare terbang berdua,\nhinggap sebentar di pucuk pohon kelape.\nTekun belajar jangan ade dua,\nfokus satu biar berkah doanye.",
    sumber: "Rancag Tradisi Betawi",
  },
  {
    id: "d-rc-3",
    kategori: "Rancag",
    judul: "Rancag Syukur",
    isi: "Hujan rintik di Kota Tua,\npayung warna-warni meneduhi jalan.\nApe yang ade tetap disyukuri,\nrejeki dikit tetep berkah pamungkas.",
    sumber: "Rancag Tradisi Betawi",
  },
  {
    id: "d-ln-1",
    kategori: "Lenong",
    judul: "Dialog Lenong",
    isi: "“Bang Jampang, ngapain lo bengong?”\n“Nih Mpok, gue lagi mikirin Sanggar.”\n“Pikirin yang bener dong, jangan ngelong,\nbiar Jak Sanggar makin gencar.”",
    sumber: "Lenong Denes",
  },
  {
    id: "d-ln-2",
    kategori: "Lenong",
    judul: "Lawakan Lenong",
    isi: "“Mpok, kenape klik tombolnye lame banget?”\n“Sabar Bang, namenye juga teknologi.”\n“Ye kalo gini terus, tuker hape ane gadget!”\n“Eh udah, klik aje terus, nanti juge jalan sendiri.”",
    sumber: "Lenong Preman",
  },
];

export const DEFAULT_KATEGORI_COLOR: Record<TradisiKategori, string> = {
  "Pantun Betawi": "#e3b864",
  Peribahasa: "#d4a64e",
  "Palang Pintu": "#c2784a",
  "Sahibul Hikayat": "#b89460",
  "Cerita Rakyat": "#d6342a",
  "Salam Betawi": "#caa86a",
  Rancag: "#daa44e",
  Lenong: "#e0552f",
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
  const [location] = useLocation();
  const halamanDokumen = location.startsWith("/sanggar/dokumen");
  const settings: TradisiSettings = db.appearance?.tradisi ?? {
    enabled: true,
    position: "br",
    cooldownMs: 2200,
    autoHideMs: 4200,
    cardWidth: 280,
    showCloseButton: true,
    source: "default",
    custom: [],
  };

  const pool = useMemo<TradisiItem[]>(() => {
    if (settings.source === "custom")
      return settings.custom.length ? settings.custom : DEFAULT_POOL;
    if (settings.source === "merge")
      return [...DEFAULT_POOL, ...settings.custom];
    return DEFAULT_POOL;
  }, [settings.source, settings.custom]);

  const [active, setActive] = useState<TradisiItem | null>(null);
  const [tick, setTick] = useState(0);
  const lastShownRef = useRef<number>(0);
  const lastIndexRef = useRef<number>(-1);
  const hideTimerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setActive(null);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!settings.enabled || halamanDokumen) {
      setActive(null);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-tradisi-popup="root"]')) return;

      const interactiveTarget = target.closest<HTMLElement>(
        'button, [role="button"], a[href], [data-tradisi="trigger"]',
      );
      if (target.closest('[data-tradisi="silent"]')) return;
      if (
        interactiveTarget?.getAttribute("aria-disabled") === "true" ||
        (interactiveTarget as HTMLButtonElement | null)?.disabled
      )
        return;

      if (pool.length === 0) return;
      const now = Date.now();
      if (now - lastShownRef.current < settings.cooldownMs) return;
      lastShownRef.current = now;

      let idx = Math.floor(Math.random() * pool.length);
      if (idx === lastIndexRef.current && pool.length > 1)
        idx = (idx + 1) % pool.length;
      lastIndexRef.current = idx;

      setActive(pool[idx]);
      setTick((t) => t + 1);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(
        () => setActive(null),
        settings.autoHideMs,
      );
    };

    document.addEventListener("click", handler, true);
    return () => {
      document.removeEventListener("click", handler, true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [
    settings.enabled,
    settings.cooldownMs,
    settings.autoHideMs,
    pool,
    halamanDokumen,
  ]);

  if (!settings.enabled || halamanDokumen) return null;

  const imageAnchor = document.getElementById("tradisi-lisan-image-anchor");
  const popup = (
    <div
      data-tradisi-popup="root"
      className={
        imageAnchor
          ? "pointer-events-none absolute inset-0 z-[60] flex justify-center"
          : `pointer-events-none fixed z-[60] p-3 sm:p-4 ${POSITION_CLASS[settings.position]}`
      }
    >
      {active && (
        <motion.div
          key={tick}
          initial={{
            opacity: imageAnchor ? 1 : 0,
            y: imageAnchor
              ? 0
              : settings.position.startsWith("t")
                ? -18
                : 18,
            scale: imageAnchor ? 1 : 0.97,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: imageAnchor
              ? 0
              : settings.position.startsWith("t")
                ? -12
                : 12,
            scale: imageAnchor ? 1 : 0.97,
          }}
          transition={
            imageAnchor
              ? { duration: 0.12, ease: "easeOut" }
              : {
                  type: "spring",
                  stiffness: 360,
                  damping: 30,
                  mass: 0.7,
                }
          }
          className={`pointer-events-auto ${imageAnchor ? "h-full" : ""}`}
          style={{
            width: imageAnchor
              ? "100%"
              : Math.max(220, Math.min(420, settings.cardWidth)),
            height: imageAnchor ? "100%" : undefined,
          }}
        >
          <Card
            item={active}
            onClose={dismiss}
            progressKey={tick}
            settings={settings}
            compact={Boolean(imageAnchor)}
          />
        </motion.div>
      )}
    </div>
  );
  return imageAnchor ? createPortal(popup, imageAnchor) : popup;
}

const JAKARTA_LANDMARK_BACKGROUNDS = [
  { src: latarMonas, name: "Monumen Nasional" },
  { src: latarMuseumFatahillah, name: "Museum Fatahillah dan Kota Tua" },
  { src: latarMuseumNasional, name: "Museum Nasional Indonesia" },
  { src: latarMuseumBahari, name: "Museum Bahari" },
  { src: latarMuseumWayang, name: "Museum Wayang" },
  { src: latarPulauOnrust, name: "Pulau Onrust" },
  { src: latarSetuBabakan, name: "Setu Babakan" },
  { src: latarAncol, name: "Ancol" },
  { src: latarTamanMini, name: "Taman Mini Indonesia Indah" },
  { src: latarPulauTidung, name: "Pulau Tidung" },
  { src: latarRagunan, name: "Taman Margasatwa Ragunan" },
  { src: latarSundaKelapa, name: "Pelabuhan Sunda Kelapa" },
] as const;

function JakartaLandmarkBackdrop({ variant }: { variant: number }) {
  const landmark =
    JAKARTA_LANDMARK_BACKGROUNDS[
      Math.abs(variant) % JAKARTA_LANDMARK_BACKGROUNDS.length
    ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <img
        src={landmark.src}
        alt=""
        data-tradisi-landmark={landmark.name}
        className="h-full w-full object-cover object-center"
        decoding="async"
      />
      <div className="absolute inset-0 bg-[#031632]/55" />
    </div>
  );
}

function Card({
  item,
  onClose,
  progressKey,
  settings,
  compact = false,
}: {
  item: TradisiItem;
  onClose: () => void;
  progressKey: number;
  settings: TradisiSettings;
  compact?: boolean;
}) {
  const accent =
    settings.kategoriColors?.[item.kategori] ??
    DEFAULT_KATEGORI_COLOR[item.kategori];

  return (
    <div
      className={`group relative overflow-hidden border backdrop-blur-md ${
        compact
          ? "flex h-full w-full flex-col justify-center rounded-none border-2"
          : "rounded-xl"
      }`}
      style={{
        containerType: compact ? "size" : undefined,
        background: compact
          ? "#031632"
          : "linear-gradient(140deg, hsl(150 55% 9% / 0.93) 0%, hsl(150 45% 13% / 0.92) 60%, hsl(18 55% 16% / 0.93) 100%)",
        borderColor: compact ? "rgba(255,255,255,0.92)" : `${accent}55`,
        boxShadow: compact
          ? "0 -8px 24px -10px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.18)"
          : `0 12px 30px -10px rgba(0,0,0,0.5), 0 0 0 1px ${accent}1a, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: compact
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)"
            : `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      {compact && <JakartaLandmarkBackdrop variant={progressKey} />}

      {settings.showCloseButton && (
        <button
          type="button"
          onClick={onClose}
          data-tradisi="silent"
          aria-label="Tutup"
          className={`absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full opacity-100 transition hover:bg-white/15 sm:h-5 sm:w-5 sm:opacity-0 sm:group-hover:opacity-100 ${
            compact
              ? "text-white/85 hover:text-white"
              : "text-amber-100/70 hover:text-amber-100"
          }`}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div
        className={
          compact
            ? "relative z-[1] flex items-center justify-center gap-1 px-3 pb-1 pt-2"
            : "px-3.5 pt-3 pb-1 flex items-center gap-1.5"
        }
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase ${
            compact
              ? "px-2 py-0.5 text-[10px] tracking-[0.12em]"
              : "px-1.5 py-0.5 text-[11px] tracking-[0.14em]"
          }`}
          style={{
            fontSize: compact
              ? "clamp(11px, min(3cqw, 5cqh), 16px)"
              : undefined,
            background: compact ? "rgba(255,255,255,0.1)" : `${accent}1f`,
            color: compact ? "#ffffff" : accent,
            border: compact
              ? "1px solid rgba(255,255,255,0.4)"
              : `1px solid ${accent}44`,
          }}
        >
          <span
            className="h-[3px] w-[3px] rounded-full"
            style={{ background: compact ? "#ffffff" : accent }}
          />
          {item.kategori}
        </span>
      </div>

      <div className={compact ? "relative z-[1] px-3 text-center" : "px-3.5 pb-0.5"}>
        <h3
          className={`font-serif leading-tight ${
            compact
              ? "text-balance font-bold text-white"
              : "text-[13px] text-amber-50/95"
          }`}
          style={{
            fontSize: compact
              ? "clamp(20px, min(7cqw, 12cqh), 42px)"
              : undefined,
          }}
        >
          {item.judul}
        </h3>
      </div>

      <div
        className={
          compact
            ? "relative z-[1] px-3 pb-2 pt-1 text-center"
            : "px-3.5 pb-3 pt-1"
        }
      >
        <p
          className={`font-serif italic whitespace-pre-line ${
            compact
              ? "line-clamp-4 break-words text-white"
              : "line-clamp-4 text-[11.5px] leading-[1.55] text-amber-50/85"
          }`}
          style={{
            fontSize: compact
              ? "clamp(14px, min(4.5cqw, 7cqh), 26px)"
              : undefined,
            lineHeight: compact ? 1.15 : undefined,
          }}
        >
          {item.isi}
        </p>
        {item.sumber && (
          <div
            className={`font-medium uppercase ${
              compact
                ? "mt-1 text-center tracking-[0.12em] text-white"
                : "mt-1.5 text-right text-[11px] tracking-[0.14em] text-amber-100/85"
            }`}
            style={{
              fontSize: compact
                ? "clamp(10px, min(3cqw, 5cqh), 16px)"
                : undefined,
            }}
          >
            — {item.sumber}
          </div>
        )}
      </div>

      <div
        className={
          compact
            ? "absolute inset-x-0 bottom-0 h-[2px] bg-white/10"
            : "h-[2px] w-full bg-white/5"
        }
      >
        <motion.div
          key={`bar-${progressKey}`}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: settings.autoHideMs / 1000, ease: "linear" }}
          className="h-full"
          style={{
            background: compact
              ? "linear-gradient(90deg, #ffffff, rgba(255,255,255,0.4))"
              : `linear-gradient(90deg, ${accent}, ${accent}88)`,
          }}
        />
      </div>
    </div>
  );
}
