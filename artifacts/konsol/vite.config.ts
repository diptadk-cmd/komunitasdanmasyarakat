import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const dokumenPaketDir = path.resolve(
  import.meta.dirname,
  "..",
  "jak-sanggar",
  "public",
  "dokumen-paket",
  "katalog",
);

/** Bagikan paket template sumber ke konsol kurator saat dev maupun build. */
export function dokumenPaketAssets(): Plugin {
  return {
    name: "konsol-dokumen-paket-assets",
    configureServer(server) {
      const base = server.config.base.replace(/\/$/, "");
      const routePrefixes = [
        `${base}/dokumen-paket/`,
        "/dokumen-paket/",
      ].filter((value, index, values) => values.indexOf(value) === index);

      server.middlewares.use((req, res, next) => {
        let pathname: string;
        try {
          pathname = decodeURIComponent(
            (req.url ?? "/").split("?")[0],
          );
        } catch {
          res.statusCode = 400;
          res.end("Nama template tidak valid.");
          return;
        }

        const routePrefix = routePrefixes.find((prefix) =>
          pathname.startsWith(prefix),
        );
        if (!routePrefix) return next();

        const requestPath = pathname.slice(routePrefix.length);
        if (!requestPath.endsWith(".json")) return next();
        const filePath = path.resolve(dokumenPaketDir, requestPath);
        const relativePath = path.relative(dokumenPaketDir, filePath);
        if (
          relativePath.startsWith("..") ||
          path.isAbsolute(relativePath) ||
          !fs.existsSync(filePath) ||
          !fs.statSync(filePath).isFile()
        ) {
          return next();
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    generateBundle(this: {
      emitFile: (asset: {
        type: "asset";
        fileName: string;
        source: Buffer;
      }) => void;
    }) {
      if (!fs.existsSync(dokumenPaketDir)) return;
      for (const fileName of fs.readdirSync(dokumenPaketDir)) {
        if (!fileName.endsWith(".json")) continue;
        this.emitFile({
          type: "asset",
          fileName: `dokumen-paket/${fileName}`,
          source: fs.readFileSync(path.join(dokumenPaketDir, fileName)),
        });
      }
    },
  };
}

const rawPort = process.env.PORT ?? "5174";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/konsol/";
const demoMode = process.env.VITE_DEMO_MODE === "true";
const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000";

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
  cacheDir: path.resolve(import.meta.dirname, `node_modules/.vite-port-${port}`),
  plugins: [
    react(),
    tailwindcss(),
    dokumenPaketAssets(),
    runtimeErrorOverlay(),
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
      "@/components/communications": path.resolve(import.meta.dirname, "../jak-sanggar/src/components/communications"),
      "@/lib/communications": path.resolve(import.meta.dirname, "../jak-sanggar/src/lib/communications.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
      "@sanggar-doc-layout": path.resolve(
        import.meta.dirname,
        "..",
        "jak-sanggar",
        "src",
        "lib",
        "dokumen-template-layout.ts",
      ),
      "@sanggar-doc-export": path.resolve(
        import.meta.dirname,
        "..",
        "jak-sanggar",
        "src",
        "lib",
        "dokumen-export.ts",
      ),
      "@sanggar-paged-preview": path.resolve(
        import.meta.dirname,
        "..",
        "jak-sanggar",
        "src",
        "components",
        "dokumen",
        "PagedDocumentPreview.tsx",
      ),
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
      ? {}
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
