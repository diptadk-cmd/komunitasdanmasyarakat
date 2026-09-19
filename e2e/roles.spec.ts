import {
  test,
  expect,
  MAIN_ACCOUNTS,
  loginMain,
  loginCurator,
  visitSidebar,
  consoleURL,
} from "./helpers";

// Smoke scope: home rendering, UI sidebar navigation including nested links,
// unauthenticated guards and uncaught runtime exceptions. No CRUD is claimed.
test.describe("Sembilan peran — beranda dan seluruh menu demo lokal", () => {
  for (const account of MAIN_ACCOUNTS) {
    test(`${account.role}: beranda, menu utama, dan submenu`, async ({
      page,
      runtimeErrors,
    }, testInfo) => {
      test.setTimeout(180_000);
      await loginMain(page, account, runtimeErrors);
      await visitSidebar(page, account.minimumLinks, runtimeErrors, testInfo);
    });
  }

  test("kurator: beranda dan seluruh menu konsol", async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginCurator(page, testInfo, runtimeErrors);
    await visitSidebar(page, 14, runtimeErrors, testInfo);
  });
});

test.describe("Akses tanpa sesi", () => {
  for (const account of MAIN_ACCOUNTS) {
    test(`halaman ${account.role} mengembalikan pengunjung ke login`, async ({
      page,
    }) => {
      await page.goto(account.home);
      await expect(page).toHaveURL((url) => url.pathname === "/");
      await expect(
        page.getByLabel("Nama Pengguna", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("#dashboard-main")).toHaveCount(0);
    });
  }

  test("halaman akun kurator mengembalikan pengunjung ke login konsol", async ({
    page,
  }, testInfo) => {
    const home = consoleURL(testInfo);
    await page.goto(new URL("akun", home).href);
    await expect(page).toHaveURL(home);
    await expect(
      page.getByRole("heading", { name: "Masuk Konsol", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#dashboard-main")).toHaveCount(0);
  });
});
