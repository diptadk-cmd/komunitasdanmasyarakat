import {
  test as base,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export { expect };

export const MAIN_ACCOUNTS = [
  {
    role: "sanggar",
    username: "sanggar.demo02",
    password: "sanggar123",
    home: "/sanggar",
    minimumLinks: 19,
  },
  {
    role: "pelatih",
    username: "pelatih.demo02",
    password: "pelatih123",
    home: "/pelatih",
    minimumLinks: 12,
  },
  {
    role: "seniman",
    username: "seniman.demo02",
    password: "seniman123",
    home: "/seniman",
    minimumLinks: 12,
  },
  {
    role: "juri",
    username: "juri.demo02",
    password: "juri123",
    home: "/juri",
    minimumLinks: 4,
  },
  {
    role: "admin",
    username: "admin.demo02",
    password: "admin123",
    home: "/admin",
    minimumLinks: 7,
  },
  {
    role: "pengrajin",
    username: "pengrajin.demo02",
    password: "pengrajin123",
    home: "/pengrajin",
    minimumLinks: 6,
  },
  {
    role: "mitra",
    username: "mitra.demo02",
    password: "mitra1234",
    home: "/mitra",
    minimumLinks: 9,
  },
  {
    role: "konsumen",
    username: "konsumen.demo02",
    password: "sewa1234",
    home: "/konsumen",
    minimumLinks: 10,
  },
] as const;

type DemoAccount = (typeof MAIN_ACCOUNTS)[number];
export type Surface = "sanggar" | "kurator";
export type NavigationEntry = { label: string; href: string };

/** Fresh browser contexts and normal UI login; no stored-session/auth injection. */
export const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [
    async ({ page, context }, use, testInfo) => {
      const errors: string[] = [];
      const observedPages = new Set<Page>();
      const observe = (opened: Page) => {
        if (observedPages.has(opened)) return;
        observedPages.add(opened);
        opened.on("pageerror", (error) =>
          errors.push(`${opened.url()}: ${error.message}`),
        );
      };
      observe(page);
      context.on("page", observe);
      const blockedOrigins = new Set<string>();
      // Fonts, external maps/media, and third-party links are outside this local
      // smoke suite. No request is sent to an external host from these contexts.
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        const allowed =
          ["localhost", "127.0.0.1"].includes(url.hostname) &&
          ["5180", "5181"].includes(url.port);
        if (allowed || ["data:", "blob:"].includes(url.protocol))
          return route.continue();
        blockedOrigins.add(url.origin);
        return route.fulfill({
          status: 204,
          body: "",
          headers: { "access-control-allow-origin": "*" },
        });
      });
      await use(errors);
      if (blockedOrigins.size) {
        await testInfo.attach("external-resources-disabled", {
          body: JSON.stringify([...blockedOrigins], null, 2),
          contentType: "application/json",
        });
      }
      if (errors.length)
        await testInfo.attach("uncaught-runtime-errors", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
      expect(
        errors,
        "Tidak boleh ada exception JavaScript yang tidak tertangani",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export function consoleURL(testInfo: TestInfo) {
  return String(testInfo.config.metadata.consoleURL);
}

function normalizedPath(url: URL) {
  return url.pathname.replace(/\/$/, "") || "/";
}

export function targetURL(page: Page, href: string) {
  const url = new URL(href, page.url());
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !["5180", "5181"].includes(url.port)
  ) {
    throw new Error(`Tautan menu tidak lokal: ${url.origin}`);
  }
  // Existing public alias intentionally redirects to the canonical finance tab.
  if (url.pathname === "/seniman/keuangan") url.pathname = "/seniman/tagihan";
  return url;
}

export async function expectRoute(page: Page, target: URL) {
  await expect(page).toHaveURL(
    (actual) =>
      actual.origin === target.origin &&
      normalizedPath(actual) === normalizedPath(target),
  );
}

export async function expectHealthyPage(page: Page, errors: string[]) {
  const main = page.locator("#dashboard-main");
  await expect(main).toBeVisible();
  await expect(main.getByRole("heading").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "404 Page Not Found", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  // Wide tables may scroll inside their own containers; the page itself must
  // still fit the viewport. Allow one pixel for fractional layout rounding.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) - document.documentElement.clientWidth,
        ),
      { message: `Halaman tidak boleh meluap horizontal: ${page.url()}` },
    )
    .toBeLessThanOrEqual(1);
  expect(errors, `Runtime errors at ${page.url()}`).toEqual([]);
}

export async function loginMain(
  page: Page,
  account: DemoAccount,
  errors: string[],
) {
  await page.goto("/");
  await page
    .getByLabel("Nama Pengguna", { exact: true })
    .fill(account.username);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(account.password);
  await expect(
    page.getByText("Akun demo dikenali — verifikasi manusia dilewati.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "MASUK", exact: true }).click();
  await expectRoute(page, targetURL(page, account.home));
  await expectHealthyPage(page, errors);
}

export async function loginCurator(
  page: Page,
  testInfo: TestInfo,
  errors: string[],
) {
  const home = consoleURL(testInfo);
  await page.goto(home);
  await page
    .getByRole("button", { name: "Masuk sebagai Kurator Demo", exact: true })
    .click();
  await expectRoute(page, new URL(home));
  await expect(page.getByTestId("kurator-home")).toBeVisible();
  await expectHealthyPage(page, errors);
  const profile = page.getByTestId("button-profile-toggle");
  await profile.click();
  await expect(page.getByText(/@kurator\.demo02/)).toBeVisible();
  await profile.click();
}

export async function loginSurface(
  page: Page,
  surface: Surface,
  testInfo: TestInfo,
  errors: string[],
) {
  if (surface === "kurator") return loginCurator(page, testInfo, errors);
  return loginMain(page, MAIN_ACCOUNTS[0], errors);
}

export async function openNavigation(page: Page) {
  const open = page.getByTestId("button-mobile-nav-open");
  if (
    (await open.isVisible()) &&
    (await open.getAttribute("aria-expanded")) !== "true"
  )
    await open.click();
  const nav = page.getByRole("navigation", {
    name: "Navigasi utama",
    exact: true,
  });
  await expect(nav).toBeVisible();
  return nav;
}

export async function expandSubmenus(page: Page, nav: Locator) {
  // Expansion is a UI action; child links are not scraped from source or state.
  const closed = nav.getByRole("button", { name: /^Buka submenu / });
  while (await closed.count()) {
    const before = page.url();
    const control = closed.first();
    const controlledId = await control.getAttribute("aria-controls");
    expect(controlledId).toBeTruthy();
    await control.click();
    await expect(page.locator(`[id="${controlledId}"]`)).toBeVisible();
    expect(page.url(), "Membuka submenu tidak boleh memindahkan halaman").toBe(
      before,
    );
  }
}

export async function readLinks(
  container: Locator,
): Promise<NavigationEntry[]> {
  const result: NavigationEntry[] = [];
  for (const link of await container.getByRole("link").all()) {
    const href = await link.getAttribute("href");
    expect(href, "Setiap tautan memiliki tujuan").toBeTruthy();
    result.push({
      href: href!,
      label: (await link.innerText()).replace(/\s+/g, " ").trim(),
    });
  }
  return result;
}

export async function visitSidebar(
  page: Page,
  minimumLinks: number,
  errors: string[],
  testInfo: TestInfo,
) {
  let nav = await openNavigation(page);
  await expandSubmenus(page, nav);
  const entries = await readLinks(nav);
  expect(
    entries.length,
    "Menu utama dan submenu harus tercakup",
  ).toBeGreaterThanOrEqual(minimumLinks);
  await testInfo.attach("sidebar-routes", {
    body: JSON.stringify(entries, null, 2),
    contentType: "application/json",
  });
  for (const entry of entries) {
    await test.step(`${entry.label}: ${entry.href}`, async () => {
      nav = await openNavigation(page);
      await expandSubmenus(page, nav);
      const target = targetURL(page, entry.href);
      const link = nav.getByRole("link", { name: entry.label, exact: true });
      await expect(link).toHaveAttribute("href", entry.href);
      await link.click();
      await expectRoute(page, target);
      await expect(page.getByTestId("button-mobile-nav-close")).toBeHidden();
      await expectHealthyPage(page, errors);
    });
  }
}
