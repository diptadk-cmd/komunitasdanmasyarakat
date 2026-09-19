import { chromium } from "playwright";
import HTMLtoDOCX from "@turbodocx/html-to-docx";
import JSZip from "jszip";
import { create } from "xmlbuilder2";
import {
  preserveDocumentTextBlocks,
  compactListTableSeparator,
  spaceWordPageNumber,
} from "./word-layout.mjs";
import { unavailable } from "./runtime.mjs";

let browserPromise;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        executablePath:
          process.env.DOCUMENT_RENDERER_CHROMIUM_PATH || undefined,
        args:
          process.platform === "linux"
            ? ["--no-sandbox", "--disable-dev-shm-usage"]
            : [],
      })
      .catch((error) => {
        browserPromise = undefined;
        console.error("HTML renderer browser unavailable:", error.message);
        throw unavailable(
          "Renderer HTML membutuhkan Chromium. Jalankan playwright install chromium atau atur DOCUMENT_RENDERER_CHROMIUM_PATH.",
        );
      });
  }
  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = undefined;
    return getBrowser();
  }
  return browser;
}
export async function closeHtmlRenderer() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
}
const styles = `
html, body { margin:0!important; padding:0!important; background:white!important; color:#111; }
body { font-family:Georgia,'Liberation Serif',serif; font-size:11pt; line-height:1.25; }
*, *::before, *::after { box-sizing:border-box; }
.dokumen-template, [data-dokumen-template-root], .paged-document-source { width:auto!important; max-width:100%!important; min-height:0!important; margin:0!important; padding:0!important; box-shadow:none!important; background:white!important; }
table { max-width:100%!important; border-collapse:collapse; }
td,th { vertical-align:top; overflow-wrap:break-word; }
img { max-width:100%; object-fit:contain; }
p { orphans:3; widows:3; }
h1,h2,h3,h4,.dokumen-template__paragraph--judul,.dokumen-template__paragraph--bab,.dokumen-template__paragraph--pasal { break-after:avoid; }
tr,.tnd-ttd,.dokumen-template__table--tanda-tangan,.dokumen-template__table--tanda-tangan-ringkas { break-inside:avoid; }
thead { display:table-header-group; }
.dokumen-template + .dokumen-template,[data-dokumen-boundary='true'],[data-dokumen-lampiran='true'],[data-mulai-halaman='true'],.dokumen-template__mulai-halaman { break-before:page; }
.dokumen-template__page-break { display:block; height:0; margin:0; padding:0; border:0; break-after:page; }
@media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
`;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export async function renderHtml(input) {
  const browser = await getBrowser();
  let context, deadline;
  try {
    context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 794, height: 1123 },
    });
    deadline = setTimeout(() => context?.close().catch(() => {}), 55000);
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(input.html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.evaluate(() => {
      document
        .querySelectorAll(
          "script,iframe,object,embed,link,base,form,meta[http-equiv]",
        )
        .forEach((e) => e.remove());
      document.querySelectorAll("*").forEach((e) => {
        for (const a of [...e.attributes])
          if (/^on/i.test(a.name)) e.removeAttribute(a.name);
      });
      document.querySelectorAll("img").forEach((e) => {
        if (
          !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(
            e.getAttribute("src") || "",
          )
        )
          e.remove();
      });
    });
    await page.evaluate((css) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    }, styles);
    const margins = await page.evaluate((explicit) => {
      let result = { top: 30, right: 20, bottom: 25, left: 30 };
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (rule.type !== CSSRule.PAGE_RULE) continue;
          for (const edge of Object.keys(result)) {
            const v = rule.style.getPropertyValue("margin-" + edge);
            if (/^\d+(\.\d+)?mm$/.test(v)) result[edge] = parseFloat(v);
          }
        }
      }
      const names = {
        atas: "top",
        kanan: "right",
        bawah: "bottom",
        kiri: "left",
      };
      for (const [key, value] of Object.entries(explicit || {}))
        if (names[key] && Number.isFinite(value)) result[names[key]] = value;
      for (const key of Object.keys(result))
        result[key] = Math.max(10, Math.min(50, result[key]));
      return result;
    }, input.pageMarginsMm);
    await page.evaluate((css) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    }, `@page {size:A4 portrait!important;margin:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm!important}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of [...document.images]) {
        try {
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(img.naturalWidth, 2400);
          canvas.height = Math.round(
            (img.naturalHeight * canvas.width) / img.naturalWidth,
          );
          if (!canvas.width || canvas.height > 4000)
            throw new Error("Ukuran gambar tidak valid");
          canvas
            .getContext("2d")
            .drawImage(img, 0, 0, canvas.width, canvas.height);
          img.src = canvas.toDataURL("image/png");
          await img.decode();
        } catch {
          throw new Error(
            "Gambar dokumen tidak valid atau terlalu besar. Perbarui gambar pada profil.",
          );
        }
      }
    });
    let output;
    if (input.format === "pdf") {
      const footer = escape(input.footer?.text || "Halaman {page} dari {pages}")
        .replaceAll("{page}", '<span class="pageNumber"></span>')
        .replaceAll("{pages}", '<span class="totalPages"></span>');
      output = await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="width:100%;text-align:center;font-family:serif;font-size:9px;color:#444">${footer}</div>`,
        timeout: 45000,
      });
    } else {
      await page.setViewportSize({
        width: Math.round(((210 - margins.left - margins.right) * 96) / 25.4),
        height: 1123,
      });
      const word = await page.evaluate(() => {
        const properties = [
          "font-family",
          "font-size",
          "font-weight",
          "font-style",
          "text-decoration",
          "text-align",
          "text-indent",
          "line-height",
          "color",
          "background-color",
          "border-top",
          "border-right",
          "border-bottom",
          "border-left",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left",
          "margin-top",
          "margin-right",
          "margin-bottom",
          "margin-left",
          "vertical-align",
        ];
        const tables = [...document.querySelectorAll("table")].map((table) => ({
          isDocumentList: table.classList.contains("tnd-daftar"),
          listGapPx: table.classList.contains("tnd-daftar")
            ? parseFloat(getComputedStyle(table.parentElement).marginBottom) ||
              0
            : 0,
          rows: [...table.rows].map((row) =>
            [...row.cells].map((cell) => ({
              width: cell.getBoundingClientRect().width,
              span: cell.colSpan,
              pad: ["top", "right", "bottom", "left"].map(
                (edge) =>
                  parseFloat(
                    getComputedStyle(cell).getPropertyValue("padding-" + edge),
                  ) || 0,
              ),
              borders: ["top", "right", "bottom", "left"].map((edge) => {
                const css = getComputedStyle(cell);
                return {
                  edge,
                  width: parseFloat(
                    css.getPropertyValue("border-" + edge + "-width"),
                  ),
                  style: css.getPropertyValue("border-" + edge + "-style"),
                };
              }),
            })),
          ),
        }));
        const elements = [...document.body.querySelectorAll("*")];
        const computed = elements.map((el) => {
          const s = getComputedStyle(el);
          return {
            el,
            css: properties
              .map((p) => {
                let value = s.getPropertyValue(p);
                if (
                  p === "background-color" &&
                  (/rgba\([^)]*,\s*0\)/.test(value) || value === "transparent")
                )
                  return "";
                if (
                  p.startsWith("border-") &&
                  (value.includes("none") || value.startsWith("0px"))
                )
                  return `${p}:none`;
                if (p === "font-family")
                  value = value
                    .split(",")[0]
                    .replace(/[\"']/g, "")
                    .replace(
                      /Georgia|Bookman Old Style|Bookman/g,
                      "Times New Roman",
                    );
                if (p === "font-weight")
                  value = Number(value) >= 600 ? "bold" : "normal";
                return `${p}:${value}`;
              })
              .filter(Boolean)
              .join(";"),
            before: s.breakBefore,
            after: s.breakAfter,
            width: el.getBoundingClientRect().width,
            display: s.display,
          };
        });
        for (const item of computed) {
          const { el } = item;
          if (item.display === "none") {
            el.remove();
            continue;
          }
          el.setAttribute("style", item.css);
          if (["TD", "TH", "TABLE", "IMG"].includes(el.tagName) && item.width)
            el.style.width = `${item.width}px`;
          if (["page", "always"].includes(item.before)) {
            const br = document.createElement("div");
            br.className = "page-break";
            el.before(br);
          }
          if (["page", "always"].includes(item.after)) {
            const br = document.createElement("div");
            br.className = "page-break";
            el.after(br);
          }
          el.removeAttribute("contenteditable");
        }
        document.querySelectorAll("style,script").forEach((e) => e.remove());
        return { html: document.body.innerHTML, tables };
      });
      await page.evaluate(preserveDocumentTextBlocks);
      word.html = await page.evaluate(() => document.body.innerHTML);
      const twip = (value) => Math.round(value * 56.692913);
      output = await HTMLtoDOCX(
        word.html,
        null,
        {
          title: String(input.title || "Dokumen Jak Sanggar").slice(0, 200),
          creator: "Jak Sanggar",
          pageSize: { width: 11906, height: 16838 },
          margins: Object.fromEntries(
            Object.entries(margins).map(([k, v]) => [k, twip(v)]),
          ),
          font: "Times New Roman",
          fontSize: 22,
          table: { row: { cantSplit: true } },
          footer: true,
          pageNumber: true,
        },
        '<p style="text-align:center;font-size:9pt">Halaman </p>',
      );
      const zip = await JSZip.loadAsync(output),
        xml = await zip.file("word/document.xml").async("string"),
        tree = create(xml),
        doc = tree.node;
      const children = (node, name) =>
        Array.from(node.childNodes).filter((n) => n.nodeName === name);
      const element = (name, attrs = {}) => {
        const node = doc.createElementNS(
          "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
          name,
        );
        for (const [k, v] of Object.entries(attrs))
          node.setAttribute(k, String(v));
        return node;
      };
      for (const font of Array.from(doc.getElementsByTagName("w:rFonts")))
        for (const attr of ["w:ascii", "w:hAnsi"])
          if (/quot|&/.test(font.getAttribute(attr) || ""))
            font.setAttribute(attr, "Times New Roman");
      Array.from(doc.getElementsByTagName("w:tbl")).forEach((table, index) => {
        const source = word.tables[index];
        if (!source) return;
        compactListTableSeparator(table, source);
        const tableProps = children(table, "w:tblPr")[0];
        if (tableProps) {
          children(tableProps, "w:tblLayout").forEach((n) =>
            tableProps.removeChild(n),
          );
          tableProps.appendChild(element("w:tblLayout", { "w:type": "fixed" }));
        }
        const grid = children(table, "w:tblGrid")[0];
        if (grid) {
          while (grid.firstChild) grid.removeChild(grid.firstChild);
          const gridRow = (source.rows || []).reduce(
            (best, row) => {
              const score =
                row.length * (row.every((c) => c.span === 1) ? 100 : 1);
              return score > best.score ? { row, score } : best;
            },
            { row: source.rows[0] || [], score: -1 },
          ).row;
          for (const cell of gridRow)
            for (let i = 0; i < cell.span; i++)
              grid.appendChild(
                element("w:gridCol", {
                  "w:w": Math.round((cell.width * 15) / cell.span),
                }),
              );
        }
        children(table, "w:tr").forEach((row, ri) =>
          children(row, "w:tc").forEach((cell, ci) => {
            const original = source.rows[ri]?.[ci];
            if (!original) return;
            const props = children(cell, "w:tcPr")[0];
            if (!props) return;
            children(props, "w:tcMar").forEach((n) => props.removeChild(n));
            const padding = element("w:tcMar");
            ["top", "right", "bottom", "left"].forEach((edge, pi) =>
              padding.appendChild(
                element("w:" + edge, {
                  "w:w": Math.max(
                    0,
                    Math.round((original.pad?.[pi] ?? 4.7) * 15),
                  ),
                  "w:type": "dxa",
                }),
              ),
            );
            props.appendChild(padding);
            children(props, "w:tcBorders").forEach((n) => props.removeChild(n));
            const borders = element("w:tcBorders");
            for (const border of original.borders)
              borders.appendChild(
                element("w:" + border.edge, {
                  "w:val":
                    border.width && border.style !== "none" ? "single" : "nil",
                  "w:sz": Math.max(1, Math.round(border.width * 6)),
                  "w:color": "555555",
                }),
              );
            props.appendChild(borders);
          }),
        );
      });
      for (const node of Array.from(doc.getElementsByTagName("w:t"))) {
        const text = node.textContent;
        if (text && text.includes("&")) {
          const decoded = text.replace(
            /&(amp|lt|gt|quot|apos|nbsp|#39);/g,
            (m, entity) =>
              ({
                amp: "&",
                lt: "<",
                gt: ">",
                quot: '"',
                apos: "'",
                nbsp: "\u00a0",
                "#39": "'",
              })[entity] ?? m,
          );
          if (decoded !== text) node.textContent = decoded;
        }
      }
      zip.file("word/document.xml", tree.end());
      for (const name of Object.keys(zip.files).filter((name) =>
        /^word\/footer\d+\.xml$/.test(name),
      ))
        zip.file(
          name,
          spaceWordPageNumber(await zip.file(name).async("string")),
        );
      output = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
      });
    }

    return Buffer.from(output);
  } finally {
    clearTimeout(deadline);
    await context?.close().catch(() => {});
  }
}
