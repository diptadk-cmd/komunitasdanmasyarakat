// PWA helpers: register service worker + ekspos beforeinstallprompt event.

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    "jaksanggar:beforeinstall": CustomEvent<BIPEvent>;
    "jaksanggar:appinstalled": Event;
  }
}

let cachedPrompt: BIPEvent | null = null;

export function getDeferredInstallPrompt(): BIPEvent | null {
  return cachedPrompt;
}

export function setupPwa() {
  if (typeof window === "undefined") return;

  // Tangkap beforeinstallprompt sedini mungkin (sebelum React render kelar).
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cachedPrompt = e as BIPEvent;
    window.dispatchEvent(
      new CustomEvent("jaksanggar:beforeinstall", { detail: cachedPrompt }),
    );
  });

  window.addEventListener("appinstalled", () => {
    cachedPrompt = null;
    window.dispatchEvent(new Event("jaksanggar:appinstalled"));
  });

  // Service worker:
  //  - PRODUCTION: register agar PWA installable & shell offline tersedia.
  //  - DEV: JANGAN register (HMR + cache shell sering bertabrakan → 404 hantu
  //    setelah navigasi kedua). Jika browser masih punya registrasi lama
  //    dari sesi sebelumnya, unregister + bersihkan cache supaya dev clean.
  if ("serviceWorker" in navigator) {
    if (import.meta.env.PROD) {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      const scope = import.meta.env.BASE_URL;
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register(swUrl, { scope, updateViaCache: "none" })
          .catch((err) => {
            console.warn("[Jak Sanggar] SW register gagal:", err);
          });
      });
    } else {
      // DEV: pastikan tidak ada SW stale.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister().catch(() => {});
      }).catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error - non-standard tapi umum
  if (window.navigator.standalone) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
