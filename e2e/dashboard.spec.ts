import {
  test,
  expect,
  loginSurface,
  openNavigation,
  readLinks,
  targetURL,
  expectRoute,
  expectHealthyPage,
  consoleURL,
  type Surface,
} from "./helpers";

test("kurator: login melalui formulir username dan password", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  // Each test gets a fresh browser context. This verifies the manual form,
  // independently of the one-click demo login used in the navigation suite.
  const home = consoleURL(testInfo);
  await page.goto(home);
  await expect(
    page.getByRole("heading", { name: "Masuk Konsol", exact: true }),
  ).toBeVisible();
  const username = page.getByLabel("Username", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  await expect(username).toBeEditable();
  await username.fill("kurator.demo02");
  await password.fill("kurator123");
  await expect(username).toHaveValue("kurator.demo02");
  await expect(password).toHaveValue("kurator123");
  const submit = page.getByRole("button", {
    name: "Masuk Konsol",
    exact: true,
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByTestId("kurator-home")).toBeVisible();
  await expectRoute(page, new URL(home));
  await expectHealthyPage(page, runtimeErrors);
  await page.getByTestId("button-profile-toggle").click();
  await expect(page.getByText(/@kurator\.demo02/)).toBeVisible();
});

for (const surface of [
  "sanggar",
  "kurator",
] as const satisfies readonly Surface[]) {
  test(`${surface}: pencarian menu, kondisi kosong, tombol reset, dan Escape`, async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    await loginSurface(page, surface, testInfo, runtimeErrors);
    const nav = await openNavigation(page);
    const originalCount = await nav.getByRole("link").count();
    const currentURL = page.url();
    const search = nav.getByRole("textbox", {
      name: "Cari menu navigasi",
      exact: true,
    });
    await search.fill("menu-tidak-ada-987654");
    await expect(nav.getByRole("status")).toContainText(
      "Menu tidak ditemukan.",
    );
    await expect(nav.getByRole("link")).toHaveCount(0);
    await nav
      .getByRole("button", { name: "Tampilkan semua menu", exact: true })
      .click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await expect(nav.getByRole("link")).toHaveCount(originalCount);
    await search.fill("Rekapan");
    await expect(
      nav.getByRole("link", { name: "Rekapan", exact: true }),
    ).toBeVisible();
    await nav
      .getByRole("button", { name: "Hapus pencarian menu", exact: true })
      .click();
    await expect(search).toHaveValue("");
    await search.fill("Rekapan");
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(nav.getByRole("link")).toHaveCount(originalCount);
    expect(page.url()).toBe(currentURL);
  });

  test(`${surface}: drawer seluler tertutup setelah memilih menu`, async ({
    page,
    isMobile,
    runtimeErrors,
  }, testInfo) => {
    test.skip(!isMobile, "Drawer diuji pada proyek mobile 390×844.");
    await loginSurface(page, surface, testInfo, runtimeErrors);
    const nav = await openNavigation(page);
    await expect(page.getByTestId("button-mobile-nav-open")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const label = surface === "kurator" ? "Akun Pengguna" : "Tools Dokumen";
    const link = nav.getByRole("link", { name: label, exact: true });
    const href = await link.getAttribute("href");
    const target = targetURL(page, href!);
    await link.click();
    await expectRoute(page, target);
    await expect(page.getByTestId("button-mobile-nav-close")).toBeHidden();
    await expect(page.getByTestId("button-mobile-nav-open")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expectHealthyPage(page, runtimeErrors);
  });
}

test("sanggar: tombol submenu membuka daftar tanpa mengubah halaman", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  await loginSurface(page, "sanggar", testInfo, runtimeErrors);
  const nav = await openNavigation(page);
  const before = page.url();
  const toggle = nav.getByRole("button", { name: /submenu Keanggotaan$/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Regenerasi", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(before);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Regenerasi", exact: true }),
  ).toHaveCount(0);
  expect(page.url()).toBe(before);
});

test("sanggar: pencarian nama submenu menampilkan induk dan tujuan", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  await loginSurface(page, "sanggar", testInfo, runtimeErrors);
  const nav = await openNavigation(page);
  await nav
    .getByRole("textbox", { name: "Cari menu navigasi", exact: true })
    .fill("Regenerasi");
  await expect(
    nav.getByRole("link", { name: "Keanggotaan", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Regenerasi", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Rapor & Apresiasi", exact: true }),
  ).toHaveCount(0);
});

test("kurator: kartu statistik dan seluruh akses cepat memiliki tujuan yang berjalan", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  test.setTimeout(180_000);
  await loginSurface(page, "kurator", testInfo, runtimeErrors);
  const entries = await readLinks(page.getByTestId("kurator-home"));
  expect(entries.length).toBeGreaterThanOrEqual(15);
  await testInfo.attach("kurator-dashboard-links", {
    body: JSON.stringify(entries, null, 2),
    contentType: "application/json",
  });
  for (const entry of entries) {
    await test.step(entry.label, async () => {
      await page.goto(consoleURL(testInfo));
      const home = page.getByTestId("kurator-home");
      await expect(home).toBeVisible();
      const target = targetURL(page, entry.href);
      await home.getByRole("link", { name: entry.label, exact: true }).click();
      await expectRoute(page, target);
      await expectHealthyPage(page, runtimeErrors);
    });
  }
});

test("kurator: notifikasi membuka ringkasan dan halaman akun pengguna", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  await loginSurface(page, "kurator", testInfo, runtimeErrors);
  // Existing notification button has no test ID; accept its three UI locales.
  await page
    .getByRole("button", { name: /^(Notifikasi|Kabar|Notifications)$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pusat notifikasi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/keanggotaan.*menunggu persetujuan/),
  ).toBeVisible();
  const link = page.getByRole("link", {
    name: "Lihat akun pengguna",
    exact: true,
  });
  const target = targetURL(page, (await link.getAttribute("href"))!);
  await link.click();
  await expectRoute(page, target);
  await expectHealthyPage(page, runtimeErrors);
});
