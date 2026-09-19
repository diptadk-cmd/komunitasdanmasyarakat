// Jak Sanggar service worker — minimal cache-first untuk app shell.
// Tujuan utama: memenuhi syarat installability PWA + offline shell sederhana.

// ---------- DEV KILL SWITCH ----------
// Pratinjau Replit (`*.replit.dev`) atau localhost = environment dev.
// SW di dev menyebabkan halaman lama tetap tersaji walau kode sudah berubah
// (misal pilihan "Sewa Jasa" di /daftar tidak muncul karena halaman ter-cache).
// Maka: kalau dev, SW ini langsung *self-destruct* — unregister diri sendiri
// dan hapus semua cache, lalu lewati semua handler fetch.
const HOST = self.location.hostname;
const IS_DEV =
  HOST === "localhost" ||
  HOST === "127.0.0.1" ||
  HOST.endsWith(".replit.dev") ||
  HOST.endsWith(".repl.co") ||
  HOST.endsWith(".kirk.replit.dev");

if (IS_DEV) {
  self.addEventListener("install", () => {
    self.skipWaiting();
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch {}
        try {
          await self.registration.unregister();
        } catch {}
        // Reload semua tab agar mendapatkan respon langsung dari network.
        try {
          const clientsList = await self.clients.matchAll({ type: "window" });
          for (const client of clientsList) {
            try {
              client.navigate(client.url);
            } catch {}
          }
        } catch {}
      })(),
    );
  });
  // JANGAN respond ke fetch — biarkan browser ambil dari network langsung.
} else {
  // ---------- PRODUCTION ----------
  const CACHE_NAME = "jak-sanggar-shell-dashboard-20260919-v1";
  const APP_SHELL = [
    "./",
    "./manifest.webmanifest",
    "./favicon.png",
    "./icon-192.png",
    "./icon-512.png",
    "./icon-maskable-512.png",
    "./apple-touch-icon.png",
  ];

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        cache.addAll(APP_SHELL).catch(() => {
          // Beberapa entry mungkin gagal — biarkan saja.
        }),
      ),
    );
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
          ),
        )
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Jangan intersep Konsol Kurator (/konsol/), API (/api/), maupun paket
    // dokumen (/dokumen-paket/) — layanan/data terpisah yang tidak boleh
    // tersaji dari cache shell app utama (template harus selalu terbaru).
    if (
      url.pathname === "/konsol" ||
      url.pathname.startsWith("/konsol/") ||
      url.pathname === "/api" ||
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/dokumen-paket/") ||
      url.pathname.startsWith("/dokumen-fix/")
    ) return;

    // Navigasi (SPA): network-first, fallback ke shell yang dicache.
    if (req.mode === "navigate") {
      event.respondWith(
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() =>
            caches.match(req).then((cached) => cached || caches.match("./")),
          ),
      );
      return;
    }

    // Asset statis: cache-first, lalu network.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res.ok && (res.type === "basic" || res.type === "default")) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
      }),
    );
  });
}
