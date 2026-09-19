import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const builds = [
  ["@workspace/api-server", "/", "3000"],
  ["@workspace/jak-sanggar", "/", "5173"],
  ["@workspace/konsol", "/konsol/", "5174"],
];
for (const [name, base, port] of builds) {
  console.log(`\nBuild ${name} (${base})`);
  const code = await new Promise(resolve => {
    const child = spawn(process.platform === "win32" ? "corepack.cmd" : "corepack", ["pnpm", "--filter", name, "run", "build"], {
      cwd, shell: process.platform === "win32", stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production", VITE_DEMO_MODE: "false", VITE_SHOW_DEMO_ACCOUNTS: "false", PORT: port, BASE_PATH: base, VITE_MAIN_APP_URL: "/", VITE_CONSOLE_URL: "/konsol/" },
    });
    child.on("error", error => { console.error(error.message); resolve(1); });
    child.on("exit", code => resolve(code ?? 1));
  });
  if (code !== 0) process.exit(code);
}
