import { useEffect, useState } from "react";
import {
  Download,
  Share2,
  Plus,
  CheckCircle2,
  X,
  Package,
  ChevronRight,
} from "lucide-react";
import { getDeferredInstallPrompt, isStandalone } from "@/lib/pwa";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

const APK_URL = `${import.meta.env.BASE_URL}JakSanggar.apk`;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Logo perangkat — monokrom (currentColor) supaya bersih dan otomatis mengikuti
// warna aksen brand (hijau untuk Android, oranye untuk iPhone). Tanpa biru.
function AndroidLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.69-.4l-1.86 3.22a11.1 11.1 0 0 0-9.78 0L5.25 5.9a.4.4 0 1 0-.69.4L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25A1.25 1.25 0 1 1 8.25 14 1.25 1.25 0 0 1 7 15.25zm10 0A1.25 1.25 0 1 1 18.25 14 1.25 1.25 0 0 1 17 15.25z" />
    </svg>
  );
}

function AppleLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8C3.54 18.38 2.5 15.57 2.5 12.92c0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.957 4.46z" />
    </svg>
  );
}

interface Props {
  variant?: "card" | "button";
  className?: string;
}

export function InstallPwaCard({ variant = "card", className = "" }: Props) {
  const t = useT();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState<BIPEvent | null>(
    getDeferredInstallPrompt(),
  );
  const [installed, setInstalled] = useState<boolean>(isStandalone());
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [apkAvailable, setApkAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(APK_URL, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (cancelled) return;
        const len = res.headers.get("content-length");
        const isApk =
          res.ok &&
          (res.headers
            .get("content-type")
            ?.includes("application/vnd.android") ||
            (len ? Number(len) > 100_000 : true));
        if (isApk) setApkAvailable(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onAvail = (e: Event) => {
      const ce = e as CustomEvent<BIPEvent>;
      setPrompt(ce.detail ?? getDeferredInstallPrompt());
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      toast({
        title: t("Aplikasi terpasang"),
        description: t("Buka dari layar utama HP Abang/Mpok, sat-set!"),
      });
    };
    window.addEventListener(
      "jaksanggar:beforeinstall",
      onAvail as EventListener,
    );
    window.addEventListener("jaksanggar:appinstalled", onInstalled);
    const onMode = () => setInstalled(isStandalone());
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", onMode);
    return () => {
      window.removeEventListener(
        "jaksanggar:beforeinstall",
        onAvail as EventListener,
      );
      window.removeEventListener("jaksanggar:appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMode);
    };
  }, [toast, t]);

  // Android: kalau browser dukung prompt native (Chrome Android), picu langsung.
  // Selain itu tampilkan panduan instalasi manual.
  const handleAndroid = async () => {
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          toast({
            title: t("Mantap!"),
            description: t("Aplikasi lagi dipasang ke HP Abang/Mpok..."),
          });
        }
        setPrompt(null);
        return;
      } catch {
        // fall through ke panduan manual
      }
    }
    setShowAndroidHelp(true);
  };

  // iPhone: iOS tidak pernah memunculkan prompt native → selalu tampilkan panduan.
  const handleIphone = () => setShowIosHelp(true);

  const downloadApk = () => {
    const a = document.createElement("a");
    a.href = APK_URL;
    a.download = "JakSanggar.apk";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast({
      title: t("Mengunduh APK Jak Sanggar..."),
      description: t(
        "Setelah selesai, tap berkas untuk pasang. Aktifkan 'install dari sumber tidak dikenal' bila diminta.",
      ),
    });
  };

  if (installed) {
    if (variant === "button") return null;
    return (
      <div
        className={`flex items-center gap-2.5 rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.07)] px-3.5 py-2.5 text-xs text-[hsl(var(--primary))] backdrop-blur ${className}`}
        data-testid="install-pwa-installed"
      >
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium">
          {t("Aplikasi sudah terpasang di perangkat ini")}
        </span>
      </div>
    );
  }

  if (variant === "button") {
    return (
      <>
        <div className={`grid grid-cols-2 gap-2 ${className}`}>
          <button
            type="button"
            onClick={handleAndroid}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)] px-2.5 py-2 text-xs font-semibold text-[hsl(var(--primary))] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--primary)/0.2)]"
            data-testid="button-install-android"
          >
            <AndroidLogo className="h-4 w-4" />
            Android
          </button>
          <button
            type="button"
            onClick={handleIphone}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--accent)/0.45)] bg-[hsl(var(--accent)/0.12)] px-2.5 py-2 text-xs font-semibold text-[hsl(var(--accent))] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/0.65)] hover:bg-[hsl(var(--accent)/0.2)]"
            data-testid="button-install-ios"
          >
            <AppleLogo className="h-4 w-4" />
            iPhone
          </button>
        </div>
        {showIosHelp && <IosHelpModal onClose={() => setShowIosHelp(false)} />}
        {showAndroidHelp && (
          <AndroidHelpModal
            onClose={() => setShowAndroidHelp(false)}
            apkAvailable={apkAvailable}
            onDownloadApk={downloadApk}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl border border-[hsl(var(--accent)/0.22)] bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-[hsl(var(--accent)/0.06)] p-4 backdrop-blur-xl ${className}`}
        data-testid="install-pwa-card"
      >
        <div className="mb-3 flex items-center gap-2.5">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-border))] text-white shadow-sm">
            <Download className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
              {t("Pasang Aplikasi")}
            </div>
            <div className="font-serif text-base text-foreground">
              {t("Buka di HP Abang/Mpok")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DeviceTile
            icon={<AndroidLogo className="h-5 w-5" />}
            label="Android"
            sub={apkAvailable ? t("Pasang / APK") : t("Pasang aplikasi")}
            onClick={handleAndroid}
            tone="green"
            testId="tile-install-android"
          />
          <DeviceTile
            icon={<AppleLogo className="h-5 w-5" />}
            label="iPhone"
            sub={t("Layar Utama")}
            onClick={handleIphone}
            tone="orange"
            testId="tile-install-ios"
          />
        </div>
      </div>
      {showIosHelp && <IosHelpModal onClose={() => setShowIosHelp(false)} />}
      {showAndroidHelp && (
        <AndroidHelpModal
          onClose={() => setShowAndroidHelp(false)}
          apkAvailable={apkAvailable}
          onDownloadApk={downloadApk}
        />
      )}
    </>
  );
}

const TONE = {
  green: {
    tile: "border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.05)] hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--primary)/0.12)]",
    icon: "text-[hsl(var(--primary))]",
  },
  orange: {
    tile: "border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.06)] hover:border-[hsl(var(--accent)/0.55)] hover:bg-[hsl(var(--accent)/0.13)]",
    icon: "text-[hsl(var(--accent))]",
  },
} as const;

function DeviceTile({
  icon,
  label,
  sub,
  onClick,
  tone,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  tone: keyof typeof TONE;
  testId: string;
}) {
  const c = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2.5 rounded-xl border bg-white/70 px-3 py-2.5 text-left backdrop-blur transition-all hover:-translate-y-0.5 ${c.tile}`}
      data-testid={testId}
    >
      <span
        className={`flex-none transition-transform group-hover:scale-110 ${c.icon}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {sub}
        </span>
      </span>
      <ChevronRight
        className={`h-4 w-4 flex-none transition-transform group-hover:translate-x-0.5 ${c.icon}`}
      />
    </button>
  );
}

function IosHelpModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="ios-help-modal"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label={t("Tutup")}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-2 flex items-center gap-2">
          <AppleLogo className="h-5 w-5 text-[hsl(var(--accent))]" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
            {t("Pasang di iPhone")}
          </span>
        </div>
        <h3 className="font-serif text-xl text-foreground">
          {t("Tiga langkah aja, Bang/Mpok")}
        </h3>
        <ol className="mt-4 space-y-3 text-sm text-foreground">
          <li className="flex items-start gap-3">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[hsl(var(--accent)/0.12)] text-xs font-bold text-[hsl(var(--accent))]">
              1
            </span>
            <span>
              {t("Buka halaman ini di browser Safari (bukan Chrome).")}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[hsl(var(--accent)/0.12)] text-xs font-bold text-[hsl(var(--accent))]">
              2
            </span>
            <span className="flex items-center gap-2">
              {t("Tap ikon")}{" "}
              <Share2 className="h-4 w-4 text-[hsl(var(--accent))]" />{" "}
              {t("Bagikan di bawah layar.")}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[hsl(var(--accent)/0.12)] text-xs font-bold text-[hsl(var(--accent))]">
              3
            </span>
            <span className="flex items-center gap-2">
              {t("Pilih")}{" "}
              <Plus className="h-4 w-4 text-[hsl(var(--accent))]" />{" "}
              <em>{t("Tambahkan ke Layar Utama")}</em>.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function AndroidHelpModal({
  onClose,
  apkAvailable,
  onDownloadApk,
}: {
  onClose: () => void;
  apkAvailable: boolean;
  onDownloadApk: () => void;
}) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="android-help-modal"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          aria-label={t("Tutup")}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-2 flex items-center gap-2">
          <AndroidLogo className="h-5 w-5 text-[hsl(var(--primary))]" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--primary))]">
            {t("Pasang di Android")}
          </span>
        </div>
        <h3 className="font-serif text-xl text-foreground">
          {t("Dua jalur, pilih yang gampang")}
        </h3>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.04)] p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">
              {t("Jalur 1 — Lewat Chrome (paling simpel)")}
            </div>
            <ol className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[11px] font-bold text-[hsl(var(--primary))]">
                  1
                </span>
                <span>{t("Buka halaman ini di Chrome Android.")}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[11px] font-bold text-[hsl(var(--primary))]">
                  2
                </span>
                <span>
                  {t(
                    "Tap menu titik tiga (⋮) di kanan atas → 'Pasang aplikasi' atau 'Add to Home screen'.",
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[hsl(var(--primary)/0.12)] text-[11px] font-bold text-[hsl(var(--primary))]">
                  3
                </span>
                <span>
                  {t("Konfirmasi 'Pasang'. Aplikasi muncul di layar utama.")}
                </span>
              </li>
            </ol>
          </div>

          {apkAvailable && (
            <div className="rounded-xl border border-[hsl(var(--accent)/0.25)] bg-[hsl(var(--accent)/0.05)] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--accent))]">
                {t("Jalur 2 — Unduh berkas APK asli")}
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t(
                  "Cocok kalau Abang/Mpok mau bagi-bagi via WhatsApp/Telegram, atau pasang offline.",
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  onDownloadApk();
                  onClose();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--gold-deep))] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:brightness-105"
                data-testid="button-download-apk-modal"
              >
                <Package className="h-4 w-4" />
                {t("Unduh JakSanggar.apk")}
              </button>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {t(
                  "Kalau ditolak, aktifkan Settings → Apps → Special access → 'Install unknown apps' untuk Chrome/File Manager.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
