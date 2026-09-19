import { defineConfig, devices } from "@playwright/test";

// These smoke tests use local demo data only. They do not verify production,
// server-backed CRUD, payments, messages/calls, or third-party integrations.
function localDemoURL(value: string, port: string, pathname: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== port ||
    url.pathname.replace(/\/$/, "") !== pathname.replace(/\/$/, "") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `E2E hanya mendukung demo lokal http://localhost:${port}${pathname}. URL eksternal ditolak.`,
    );
  }
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

// Validate every supported override, including lower-priority values, so a
// production BASEURL cannot silently be ignored or accidentally selected.
for (const value of [
  process.env.E2E_BASE_URL,
  process.env.BASEURL,
  process.env.PLAYWRIGHT_BASE_URL,
]) {
  if (value) localDemoURL(value, "5180", "/");
}
const mainURL = localDemoURL(
  process.env.E2E_BASE_URL ||
    process.env.BASEURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    "http://localhost:5180/",
  "5180",
  "/",
);
const consoleURL = localDemoURL(
  process.env.E2E_CONSOLE_URL || "http://localhost:5181/konsol/",
  "5181",
  "/konsol/",
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "output/test-reports/e2e/artifacts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/test-reports/e2e/html", open: "never" }],
    ["json", { outputFile: "output/test-reports/e2e/results.json" }],
  ],
  metadata: {
    scope:
      "Local demo navigation and dashboard smoke checks; not full CRUD coverage",
    mainURL,
    consoleURL,
  },
  use: {
    baseURL: mainURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: "node scripts/run-dev.mjs demo-app",
      url: mainURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "node scripts/run-dev.mjs demo-konsol",
      url: consoleURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
