import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { ensureDocumentRenderer, usesBundledDocumentRenderer } from "./start-document-renderer.mjs";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
for (const filename of [".env", ".env.smtp"]) {
  const envPath = resolve(workspaceRoot, filename);
  if (existsSync(envPath)) loadEnvFile(envPath);
}

const target = process.argv[2];
const configs = {
  app: {
    filter: "@workspace/jak-sanggar",
    env: {
      NODE_ENV: "development",
      VITE_DEMO_MODE: "false",
      VITE_SHOW_DEMO_ACCOUNTS: "false",
      VITE_CONSOLE_URL: "http://localhost:5174/konsol/",
      PORT: "5173",
      BASE_PATH: "/",
    },
  },
  konsol: {
    filter: "@workspace/konsol",
    env: {
      NODE_ENV: "development",
      VITE_DEMO_MODE: "false",
      VITE_SHOW_DEMO_ACCOUNTS: "false",
      VITE_MAIN_APP_URL: "http://localhost:5173/",
      PORT: "5174",
      BASE_PATH: "/konsol/",
    },
  },
  "demo-app": {
    filter: "@workspace/jak-sanggar",
    env: {
      NODE_ENV: "development",
      VITE_DEMO_MODE: "true",
      VITE_SHOW_DEMO_ACCOUNTS: "true",
      VITE_CONSOLE_URL: "/konsol/",
      DEMO_CONSOLE_PROXY_TARGET: "http://127.0.0.1:5181",
      PORT: "5180",
      BASE_PATH: "/",
    },
  },
  "demo-konsol": {
    filter: "@workspace/konsol",
    env: {
      NODE_ENV: "development",
      VITE_DEMO_MODE: "true",
      VITE_SHOW_DEMO_ACCOUNTS: "true",
      VITE_MAIN_APP_URL: "http://localhost:5180/",
      PORT: "5181",
      BASE_PATH: "/konsol/",
    },
  },
  api: {
    filter: "@workspace/api-server",
    env: {
      NODE_ENV: "development", PORT: "3000",
      MARIADB_URL: process.env.MARIADB_URL || process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/jaksanggar",
    },
  },
};

const config = configs[target];
if (!config) {
  console.error(
    "Target tidak dikenal. Gunakan: app, konsol, demo-app, demo-konsol, atau api.",
  );
  process.exit(1);
}

if ((target === "api" && usesBundledDocumentRenderer()) || target === "demo-app") {
  await ensureDocumentRenderer();
}

// Node >=18.20.2 refuses to spawn .cmd shims without a shell (EINVAL), so
// Windows needs shell:true. Every argument here is a hardcoded constant.
const isWindows = process.platform === "win32";
const child = spawn(
  isWindows ? "corepack.cmd" : "corepack",
  ["pnpm", "--filter", config.filter, "run", "dev"],
  {
    stdio: "inherit",
    shell: isWindows,
    env: { ...process.env, ...config.env },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
