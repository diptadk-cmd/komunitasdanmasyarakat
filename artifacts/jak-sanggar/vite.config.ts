import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { localDocumentRendererPlugin } from "./config/local-document-renderer";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const demoMode = process.env.VITE_DEMO_MODE === "true";
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000";
const demoConsoleProxyTarget =
  process.env.DEMO_CONSOLE_PROXY_TARGET ?? "http://127.0.0.1:5181";

function hasPackage(id: string, packageNames: string[]): boolean {
  const normalizedId = id.replace(/\\/g, "/");
  return packageNames.some((packageName) =>
    normalizedId.includes(`/node_modules/${packageName}/`),
  );
}

/** Pisahkan pustaka besar yang dipakai lintas halaman agar tidak masuk ke entry. */
function vendorChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, "/");
  if (!normalizedId.includes("/node_modules/")) return undefined;

  if (hasPackage(normalizedId, ["react", "react-dom", "scheduler"])) {
    return "vendor-react";
  }
  if (
    hasPackage(normalizedId, [
      "framer-motion",
      "motion-dom",
      "motion-utils",
    ])
  ) {
    return "vendor-motion";
  }
  if (
    normalizedId.includes("/node_modules/@radix-ui/") ||
    normalizedId.includes("/node_modules/@floating-ui/")
  ) {
    return "vendor-ui";
  }
  if (
    hasPackage(normalizedId, [
      "recharts",
      "recharts-scale",
      "react-smooth",
      "decimal.js-light",
      "fast-equals",
    ]) ||
    normalizedId.includes("/node_modules/d3-")
  ) {
    return "vendor-charts";
  }
  if (hasPackage(normalizedId, ["jszip"])) return "vendor-archive";

  return undefined;
}

export default defineConfig({
  base: basePath,
  // API-backed and demo servers can run together without replacing each
  // other's optimized React modules during a dependency/config refresh.
  cacheDir: path.resolve(import.meta.dirname, `node_modules/.vite-port-${port}`),
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(demoMode ? [localDocumentRendererPlugin(process.env.DOCUMENT_RENDERER_URL)] : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
      // Entry bawaan html2pdf adalah bundle UMD yang menyertakan ulang jsPDF
      // dan html2canvas. Pakai sumber modular agar Vite dapat berbagi chunk-nya.
      "html2pdf.js": path.resolve(
        import.meta.dirname,
        "node_modules",
        "html2pdf.js",
        "src",
        "index.js",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    ...(demoMode
      ? {
          // Akses Konsol demo melalui origin aplikasi demo supaya keduanya
          // berbagi database browser yang sama (localStorage per origin).
          proxy: {
            "/konsol": {
              target: demoConsoleProxyTarget,
              changeOrigin: true,
              ws: true,
            },
          },
        }
      : {
          proxy: {
            "/api": {
              target: apiProxyTarget,
              changeOrigin: true,
            },
          },
        }),
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
