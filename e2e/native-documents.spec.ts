import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { APIResponse, Page, Response, TestInfo } from "@playwright/test";
import {
  test,
  expect,
  MAIN_ACCOUNTS,
  loginMain,
  openNavigation,
  targetURL,
  expectRoute,
  expectHealthyPage,
} from "./helpers";

// Use the app's installed archive dependency without introducing a second copy.
const appRequire = createRequire(
  path.resolve(process.cwd(), "artifacts/jak-sanggar/package.json"),
);
const JSZip = appRequire(
  "jszip",
) as typeof import("../artifacts/jak-sanggar/node_modules/jszip");

async function openDocuments(page: Page, errors: string[]) {
  await loginMain(page, MAIN_ACCOUNTS[0], errors);
  const nav = await openNavigation(page);
  const link = nav.getByRole("link", { name: "Tools Dokumen", exact: true });
  const target = targetURL(page, (await link.getAttribute("href"))!);
  await link.click();
  await expectRoute(page, target);
  const documents = page.getByTestId("native-template-page");
  await expect(documents).toBeVisible();
  const list = documents.getByRole("navigation", {
    name: "Daftar dokumen",
    exact: true,
  });
  await expect(list.getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(list.getByRole("button").first()).toContainText(
    /Berita Acara (Pembentukan|Forum Penetapan)/,
  );
  return documents;
}

function waitForRender(page: Page, format: "word" | "pdf") {
  return page.waitForResponse(
    (response) => {
      const request = response.request();
      return (
        new URL(response.url()).pathname === "/api/documents/render" &&
        request.method() === "POST" &&
        request.postDataJSON()?.format === format
      );
    },
    { timeout: 90_000 },
  );
}

async function assertResponse(response: Response | APIResponse) {
  expect(
    response.status(),
    "Renderer lokal harus benar-benar menghasilkan dokumen",
  ).toBe(200);
}

function assertPdf(bytes: Buffer) {
  expect(bytes.length).toBeGreaterThan(500);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.subarray(-1024).toString()).toContain("%%EOF");
}

test("dokumen native: Pratinjau memuat PDF asli pada iframe", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  test.setTimeout(180_000);
  const documents = await openDocuments(page, runtimeErrors);
  const responsePromise = waitForRender(page, "pdf");
  await documents
    .getByRole("button", { name: "Pratinjau", exact: true })
    .click();
  const response = await responsePromise;
  await assertResponse(response);
  expect(response.headers()["content-type"]).toMatch(
    /^application\/pdf(?:;|$)/,
  );
  const bytes = await response.body();
  assertPdf(bytes);
  await expect(
    documents.locator('iframe[title="Pratinjau dokumen beserta lampiran"]'),
  ).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
  await expect(documents.getByRole("alert")).toHaveCount(0);
  await testInfo.attach("preview.pdf", {
    body: bytes,
    contentType: "application/pdf",
  });
  await expectHealthyPage(page, runtimeErrors);
});

for (const format of ["word", "pdf"] as const) {
  test(`dokumen native: unduhan ${format === "word" ? "Word" : "PDF"} berisi berkas yang valid`, async ({
    page,
    runtimeErrors,
  }, testInfo: TestInfo) => {
    test.setTimeout(180_000);
    const documents = await openDocuments(page, runtimeErrors);
    const responsePromise = waitForRender(page, format);
    const downloadPromise = page.waitForEvent("download", { timeout: 100_000 });
    const action = format === "word" ? "Unduh Word dengan isian" : "Unduh PDF";
    await documents.getByRole("button", { name: action, exact: true }).click();
    const response = await responsePromise;
    await assertResponse(response);
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    const extension = format === "word" ? "docx" : "pdf";
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`\\.${extension}$`, "i"),
    );
    const outputPath = testInfo.outputPath(`dokumen-sanggar.${extension}`);
    await download.saveAs(outputPath);
    const bytes = await readFile(outputPath);
    expect(bytes.length).toBeGreaterThan(500);
    if (format === "word") {
      expect(bytes.subarray(0, 2).toString()).toBe("PK");
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
      expect(zip.file("[Content_Types].xml")).not.toBeNull();
      expect(zip.file("word/document.xml")).not.toBeNull();
      expect(await zip.file("word/document.xml")!.async("string")).toContain(
        "<w:body",
      );
    } else assertPdf(bytes);
    await testInfo.attach(`unduhan.${extension}`, {
      path: outputPath,
      contentType:
        format === "word"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
    });
    await expect(documents.getByRole("alert")).toHaveCount(0);
    await expectHealthyPage(page, runtimeErrors);
  });
}
