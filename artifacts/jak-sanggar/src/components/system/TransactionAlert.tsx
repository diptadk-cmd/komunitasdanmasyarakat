import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, PackageCheck, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import type { AnyUser, PesananProdukPengrajin } from "@/lib/types";

const ALERT_DURATION_MS = 5_000;
const SEEN_KEY = "jaksanggar_transaction_alert_seen_v1";

interface ActiveAlert {
  token: string;
  orderNumber: string;
  title: string;
  detail: string;
  href: string;
}

function alertForOrder(
  user: AnyUser,
  order: PesananProdukPengrajin,
): Omit<ActiveAlert, "token"> | null {
  if (user.role === "mitra_pengrajin" && order.mitraId === user.id) {
    if (order.status === "menunggu_persetujuan_ongkir") {
      return {
        orderNumber: order.nomor,
        title: "Ongkir sudah dikirim Pengrajin",
        detail: `Periksa dan setujui ongkir Rp ${(order.pengiriman?.biayaOngkir ?? 0).toLocaleString("id-ID")}.`,
        href: "/mitra/pesanan",
      };
    }
    if (order.status === "dikirim") {
      return {
        orderNumber: order.nomor,
        title: "Barang sedang dikirim",
        detail: "Periksa resi atau live location, lalu sahkan BAST setelah barang diterima.",
        href: "/mitra/pesanan",
      };
    }
  }

  if (user.role === "pengrajin" && order.pengrajinId === user.id) {
    if (order.status === "menunggu_ongkir" || order.status === "diajukan") {
      return {
        orderNumber: order.nomor,
        title: "Pesanan produk baru masuk",
        detail:
          order.status === "menunggu_ongkir"
            ? "Hitung dan kirim nominal ongkir kepada Mitra."
            : "Periksa detail pesanan lalu terima atau tolak pesanan.",
        href: "/pengrajin/pesanan-produk",
      };
    }
    if (order.status === "menunggu_ttd") {
      return {
        orderNumber: order.nomor,
        title: "Ongkir disetujui Mitra",
        detail: "Kontrak dan invoice sudah terbit dan menunggu tanda tangan.",
        href: "/pengrajin/pesanan-produk",
      };
    }
    if (order.status === "menunggu_verifikasi_bayar") {
      return {
        orderNumber: order.nomor,
        title: "Bukti pembayaran diterima",
        detail: "Periksa nominal dan dokumen pembayaran dari Mitra.",
        href: "/pengrajin/pesanan-produk",
      };
    }
  }

  return null;
}

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function rememberSeen(orderId: string, token: string) {
  try {
    const seen = readSeen();
    seen[orderId] = token;
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Notifikasi visual tetap bekerja jika sessionStorage tidak tersedia.
  }
}

function playFiveSecondAlarm(): () => void {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return () => undefined;

  let context: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  try {
    context = new AudioContextClass();
    oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + 0.03;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, start);
    gain.gain.setValueAtTime(0.0001, start);
    for (let index = 0; index < 10; index += 1) {
      const pulse = start + index * 0.5;
      oscillator.frequency.setValueAtTime(index % 2 === 0 ? 880 : 740, pulse);
      gain.gain.setValueAtTime(0.075, pulse);
      gain.gain.setValueAtTime(0.075, pulse + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, pulse + 0.42);
    }
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + ALERT_DURATION_MS / 1_000);
    void context.resume().catch(() => undefined);
  } catch {
    void context?.close().catch(() => undefined);
    return () => undefined;
  }

  return () => {
    try {
      oscillator?.stop();
    } catch {
      // Oscillator mungkin sudah berhenti otomatis tepat pada detik kelima.
    }
    void context?.close().catch(() => undefined);
  };
}

export function TransactionAlert() {
  const { user } = useAuth();
  const db = useDb();
  const [, navigate] = useLocation();
  const [active, setActive] = useState<ActiveAlert | null>(null);
  const stopSound = useRef<(() => void) | null>(null);

  const relevantOrders = useMemo(() => {
    if (!user || (user.role !== "mitra_pengrajin" && user.role !== "pengrajin"))
      return [];
    return db.pesananProdukPengrajin
      .filter((order) =>
        user.role === "mitra_pengrajin"
          ? order.mitraId === user.id
          : order.pengrajinId === user.id,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [db.pesananProdukPengrajin, user]);

  useEffect(() => {
    if (!user) return;
    const seen = readSeen();
    for (const order of relevantOrders) {
      const token = `${order.status}:${order.updatedAt}`;
      const definition = alertForOrder(user, order);
      if (!definition || seen[order.id] === token) continue;
      rememberSeen(order.id, token);
      setActive({ ...definition, token: `${order.id}:${token}` });
      break;
    }
  }, [relevantOrders, user]);

  useEffect(() => {
    if (!active) return;
    stopSound.current?.();
    stopSound.current = playFiveSecondAlarm();
    const timer = window.setTimeout(() => setActive(null), ALERT_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      stopSound.current?.();
      stopSound.current = null;
    };
  }, [active?.token]);

  if (!active) return null;

  const close = () => {
    stopSound.current?.();
    stopSound.current = null;
    setActive(null);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-1/2 top-16 z-[350] w-[min(94vw,760px)] -translate-x-1/2 overflow-hidden rounded-2xl border-4 border-yellow-300 bg-red-700 text-white shadow-[0_24px_80px_rgba(127,29,29,0.55)]"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-red-800 via-red-600 to-red-800 opacity-80" />
      <div className="relative flex items-start gap-4 p-5 sm:p-6">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-yellow-300 text-red-800 shadow-lg ring-4 ring-white/40">
          <BellRing className="h-8 w-8 animate-bounce" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-200">
            Notifikasi transaksi penting
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-white/90">
            {active.orderNumber}
          </div>
          <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
            {active.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-white/95 sm:text-base">
            {active.detail}
          </p>
          <button
            type="button"
            onClick={() => {
              close();
              navigate(active.href);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-yellow-300 px-4 py-2 text-sm font-black text-red-900 shadow transition hover:bg-yellow-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
          >
            <PackageCheck className="h-4 w-4" /> Buka Transaksi
          </button>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Tutup notifikasi"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative h-2 bg-red-950/60">
        <div
          className="h-full origin-left bg-yellow-300"
          style={{ animation: "transaction-alert-progress 5s linear forwards" }}
        />
      </div>
    </div>
  );
}
