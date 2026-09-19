import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const unresolved = Symbol("unresolved expression");
const appDefinitions = [
  {
    id: "jak-sanggar",
    base: "/",
    navRoles: {
      sanggarNav: "sanggar",
      pelatihNav: "pelatih",
      senimanNav: "seniman",
      juriNav: "juri",
      adminNav: "admin",
      konsumenNav: "sewa",
      pengrajinNav: "pengrajin",
      mitraNav: "mitra_pengrajin",
    },
  },
  { id: "konsol", base: "/konsol", navRoles: { kuratorNav: "kurator" } },
];

export const roleChecklist = [
  {
    role: "kurator",
    label: "Kurator",
    api: "Sesi dan pembatasan akses; akun/blokir; kurasi; penugasan juri; dokumen; data, berita, tampilan, waktu, rekapan",
    device: "Ekspor/cetak dokumen, unggah media, panggilan audio/video",
  },
  {
    role: "admin",
    label: "Admin",
    api: "Hak kelola berita, banner, slider, info budaya; publikasi tampil di akun lain",
    device: "Unggah gambar/video dan tampilan responsif",
  },
  {
    role: "sanggar",
    label: "Sanggar",
    api: "Profil; keanggotaan; jadwal/absensi; kas/iuran/honor; kurasi; aset; kerja sama; pesanan sewa; dokumen",
    device: "Dokumen PDF/DOCX, geolokasi, unggah, PWA, panggilan",
  },
  {
    role: "pelatih",
    label: "Pelatih",
    api: "Daftar latih; profil; honor/slip; penugasan; kelas privat; sertifikat",
    device: "Unggah bukti, unduh/cetak slip dan sertifikat, panggilan",
  },
  {
    role: "seniman",
    label: "Seniman",
    api: "Profil; absensi; tagihan/iuran; honor; penugasan; riwayat; sertifikat",
    device:
      "Kamera/geolokasi absensi jika dipakai, unggah bukti, unduh, panggilan",
  },
  {
    role: "juri",
    label: "Juri",
    api: "Sanggar yang ditugaskan; simpan skor; finalisasi; batas akses penilaian",
    device: "Baca lampiran, cetak laporan, panggilan",
  },
  {
    role: "pengrajin",
    label: "Pengrajin",
    api: "Produk/stok/harga; pesanan; ongkir; verifikasi bayar; pengiriman; kanal dan kerja sama",
    device:
      "Foto produk, dokumen transaksi/tanda tangan, notifikasi, panggilan",
  },
  {
    role: "mitra_pengrajin",
    label: "Mitra pengrajin",
    api: "Verifikasi toko dan pembatasan katalog; katalog/pesanan; kerja sama; layanan; pembayaran/penerimaan",
    device: "Geolokasi toko, unggah NIB/surat, dokumen, panggilan",
  },
  {
    role: "sewa",
    label: "Konsumen",
    api: "Katalog lintas kategori; pesanan sewa; persetujuan; kontrak; pembayaran; status transaksi",
    device: "Tanda tangan, unggah bukti, PDF/DOCX, panggilan",
  },
];

function readSource(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function nameOf(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node))
    ? node.text
    : undefined;
}

// This is a deliberately limited literal reader. It never executes application code.
function literal(node, values) {
  if (!node) return unresolved;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node)) return values.get(node.text) ?? unresolved;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    return literal(node.expression, values);
  if (ts.isJsxExpression(node)) return literal(node.expression, values);
  if (ts.isArrayLiteralExpression(node)) {
    const result = [];
    for (const element of node.elements) {
      const value = literal(
        ts.isSpreadElement(element) ? element.expression : element,
        values,
      );
      if (ts.isSpreadElement(element) && Array.isArray(value))
        result.push(...value);
      else result.push(value);
    }
    return result;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property))
        result[nameOf(property.name)] = literal(property.initializer, values);
      if (ts.isShorthandPropertyAssignment(property))
        result[property.name.text] = literal(property.name, values);
    }
    return result;
  }
  return unresolved;
}

function collectValues(source, directory, visited = new Set()) {
  const values = new Map();
  if (visited.has(source.fileName)) return values;
  visited.add(source.fileName);
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      const base = specifier.startsWith("@/")
        ? path.join(directory, specifier.slice(2))
        : path.resolve(path.dirname(source.fileName), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      const bindings = statement.importClause?.namedBindings;
      if (resolved && bindings && ts.isNamedImports(bindings)) {
        // Only importing literal constants is necessary for route declarations.
        const imported = readSource(resolved);
        const constants = new Map();
        for (const declaration of imported.statements) {
          if (ts.isVariableStatement(declaration))
            for (const variable of declaration.declarationList.declarations)
              constants.set(
                nameOf(variable.name),
                literal(variable.initializer, constants),
              );
        }
        for (const binding of bindings.elements)
          if (constants.has(binding.propertyName?.text ?? binding.name.text))
            values.set(
              binding.name.text,
              constants.get(binding.propertyName?.text ?? binding.name.text),
            );
      }
    }
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        values.set(
          nameOf(declaration.name),
          literal(declaration.initializer, values),
        );
    applyPush(statement, values);
  }
  return values;
}

function applyPush(statement, values) {
  if (
    ts.isExpressionStatement(statement) &&
    ts.isCallExpression(statement.expression)
  ) {
    const call = statement.expression;
    if (
      ts.isPropertyAccessExpression(call.expression) &&
      call.expression.name.text === "push"
    ) {
      const target = literal(call.expression.expression, values);
      if (Array.isArray(target))
        for (const argument of call.arguments)
          target.push(literal(argument, values));
    }
  }
  if (
    ts.isForOfStatement(statement) &&
    ts.isVariableDeclarationList(statement.initializer)
  ) {
    const targets = literal(statement.expression, values);
    const variable = nameOf(statement.initializer.declarations[0]?.name);
    if (!Array.isArray(targets) || !variable) return;
    for (const target of targets) {
      const scoped = new Map(values).set(variable, target);
      if (ts.isBlock(statement.statement))
        for (const child of statement.statement.statements)
          applyPush(child, scoped);
      else applyPush(statement.statement, scoped);
    }
  }
}

function visit(node, fn) {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
}

function jsxAttributes(node) {
  return new Map(
    node.attributes.properties
      .filter(ts.isJsxAttribute)
      .map((attribute) => [nameOf(attribute.name), attribute.initializer]),
  );
}

function sourceLocation(source, node) {
  return {
    file: path
      .relative(repositoryRoot, source.fileName)
      .replaceAll(path.sep, "/"),
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  };
}

function extractRoutes(source, values, definition) {
  const routes = [];
  const unknown = [];
  visit(source, (node) => {
    if (
      !(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) ||
      node.tagName.getText(source) !== "Route"
    )
      return;
    const attributes = jsxAttributes(node);
    if (!attributes.has("path")) return; // The catch-all NotFound is not proof a target exists.
    const pattern = literal(attributes.get("path"), values);
    if (typeof pattern !== "string") {
      unknown.push({
        ...sourceLocation(source, node),
        expression: attributes.get("path")?.getText(source),
      });
      return;
    }
    const roles = new Set();
    const element = ts.isJsxOpeningElement(node) ? node.parent : node;
    visit(element, (child) => {
      if (
        (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) &&
        child.tagName.getText(source) === "Guard"
      ) {
        if (definition.id === "konsol") roles.add("kurator");
        const role = literal(jsxAttributes(child).get("role"), values);
        for (const value of Array.isArray(role) ? role : [role])
          if (typeof value === "string") roles.add(value);
      }
    });
    if (definition.id === "konsol" && pattern === "/") {
      roles.add("kurator");
      roles.add("publik");
    }
    if (!roles.size) roles.add("publik");
    routes.push({
      pattern,
      roles: [...roles].sort(),
      ...sourceLocation(source, node),
      parameterized: /[:*]/.test(pattern),
      status: "inventaris; kontrak rute diuji, alur bisnis belum dibuktikan",
    });
  });
  return { routes, unknown };
}

function flattenNav(items, role, parentLabel) {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.href !== "string")
      return [];
    return [
      {
        role,
        label: typeof item.label === "string" ? item.label : item.href,
        href: item.href,
        ...(parentLabel ? { parent: parentLabel } : {}),
      },
      ...flattenNav(
        Array.isArray(item.children) ? item.children : [],
        role,
        item.label,
      ),
    ];
  });
}

function sourceFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory())
        return ["node_modules", "dist", "test", "tests", "__tests__"].includes(
          entry.name,
        )
          ? []
          : sourceFiles(file);
      return /\.tsx?$/.test(entry.name) &&
        !/\.(test|spec|d)\.ts$/.test(entry.name)
        ? [file]
        : [];
    });
}

function extractLinks(source, values) {
  const links = [];
  const dynamic = [];
  const record = (node, valueNode, kind) => {
    const value = literal(valueNode, values);
    if (typeof value === "string")
      links.push({ target: value, kind, ...sourceLocation(source, node) });
    else
      dynamic.push({
        expression: valueNode?.getText(source).slice(0, 200) ?? "",
        kind,
        ...sourceLocation(source, node),
      });
  };
  visit(source, (node) => {
    if (
      ts.isJsxAttribute(node) &&
      ["href", "to", "backTo"].includes(nameOf(node.name))
    )
      record(node, node.initializer, `jsx:${nameOf(node.name)}`);
    if (ts.isPropertyAssignment(node) && nameOf(node.name) === "href")
      record(node, node.initializer, "object:href");
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["navigate", "setLocation"].includes(node.expression.text) &&
      node.arguments[0]
    )
      record(node, node.arguments[0], `call:${node.expression.text}`);
  });
  return { links, dynamic };
}

export async function routerMatcher(appId) {
  const appRequire = createRequire(
    path.join(repositoryRoot, "artifacts", appId, "package.json"),
  );
  const wouterEntry = appRequire.resolve("wouter");
  const wouterRequire = createRequire(wouterEntry);
  const [{ matchRoute }, { parse }] = await Promise.all([
    import(pathToFileURL(wouterEntry).href),
    import(pathToFileURL(wouterRequire.resolve("regexparam")).href),
  ]);
  return (pattern, target) =>
    matchRoute(parse, pattern, target.split(/[?#]/)[0] || "/")[0];
}

function classifyLink(link, app, matches) {
  const target = link.target;
  if (
    /^(https?:\/\/|mailto:|tel:|data:|blob:)/i.test(target) ||
    target.startsWith("//")
  )
    return {
      ...link,
      result: "external-or-browser-resource",
      reason:
        "Skema eksternal diizinkan untuk inventaris; jaringan/ketersediaan tidak diuji.",
    };
  if (target.startsWith("#") || target === "")
    return {
      ...link,
      result: "same-document",
      reason: "Anchor/dokumen yang sama; keberadaan elemen target belum diuji.",
    };
  if (!target.startsWith("/"))
    return {
      ...link,
      result: "unresolved-relative",
      reason: "Target relatif perlu konteks halaman; bukan bukti lulus.",
    };
  if (target === "/konsol" || target.startsWith("/konsol/"))
    return {
      ...link,
      result: "cross-app",
      app: "konsol",
      pathname: target.slice(7) || "/",
    };
  if (target.startsWith("/api/"))
    return {
      ...link,
      result: "api-endpoint",
      reason: "Endpoint API memerlukan pengujian server terpisah.",
    };
  if (
    /\.(pdf|docx?|xlsx?|zip|png|jpe?g|svg|webp|ico|mp[34]|ogg|woff2?)(?:[?#]|$)/i.test(
      target,
    ) ||
    target.startsWith("/dokumen-paket/")
  ) {
    const pathname = target.split(/[?#]/)[0];
    const localPath = path.resolve(
      repositoryRoot,
      "artifacts",
      app.id,
      "public",
      `.${pathname}`,
    );
    const exists = fs.existsSync(localPath) && fs.statSync(localPath).isFile();
    return {
      ...link,
      result: exists ? "local-asset-found" : "asset-needs-runtime",
      reason: exists
        ? "File ditemukan di public."
        : "Aset tidak ditemukan di public aplikasi ini; dapat dipasok runtime/API/build.",
    };
  }
  const matched = app.routes.find((route) => matches(route.pattern, target));
  return {
    ...link,
    result: matched ? "route-matched" : "missing-route",
    ...(matched ? { route: matched.pattern } : {}),
  };
}

export async function collectCoverage() {
  const applications = [];
  for (const definition of appDefinitions) {
    const directory = path.join(
      repositoryRoot,
      "artifacts",
      definition.id,
      "src",
    );
    const source = readSource(path.join(directory, "App.tsx"));
    const values = collectValues(source, directory);
    const { routes, unknown } = extractRoutes(source, values, definition);
    const navigation = Object.entries(definition.navRoles).flatMap(
      ([variable, role]) => flattenNav(values.get(variable) ?? [], role),
    );
    const links = [];
    const dynamicLinks = [];
    for (const file of sourceFiles(directory)) {
      const current = file === source.fileName ? source : readSource(file);
      const extracted = extractLinks(
        current,
        collectValues(current, directory),
      );
      links.push(...extracted.links);
      dynamicLinks.push(...extracted.dynamic);
    }
    const application = {
      id: definition.id,
      base: definition.base,
      routes,
      unresolvedRoutes: unknown,
      navigation,
      links,
      dynamicLinks,
    };
    const matches = await routerMatcher(definition.id);
    application.links = links.map((link) =>
      classifyLink(link, application, matches),
    );
    application.navigation = navigation.map((item) => ({
      ...item,
      route:
        routes.find((route) => matches(route.pattern, item.href))?.pattern ??
        null,
    }));
    applications.push(application);
  }
  // Validate explicitly linked /konsol paths against the console routes, not against a catch-all.
  const consoleApp = applications.find((app) => app.id === "konsol");
  const consoleMatches = await routerMatcher("konsol");
  for (const app of applications)
    for (const link of app.links)
      if (link.result === "cross-app") {
        const route = consoleApp.routes.find((candidate) =>
          consoleMatches(candidate.pattern, link.pathname),
        );
        link.result = route ? "cross-app-matched" : "missing-route";
        if (route) link.route = route.pattern;
      }
  return {
    schemaVersion: 1,
    method:
      "AST TypeScript dari kode produksi; pencocokan matchRoute Wouter dan parser regexparam terpasang; tanpa server, browser, atau eksekusi transaksi.",
    limitations: [
      "Rute yang cocok belum membuktikan halaman berhasil dimuat atau proses bisnis berhasil.",
      "Tautan dinamis belum dievaluasi; nilainya dapat bergantung pada data, peran, dan server.",
      "Guard autentikasi/otorisasi belum dijalankan oleh tes statis ini.",
      "Fallback NotFound tidak dihitung sebagai rute valid.",
      "Skema http/https/mailto/tel/data/blob dan URL // diinventaris sebagai pengecualian jaringan, bukan lulus fungsi.",
      "Inventaris seluruh src mencakup komponen yang mungkin tidak lagi dijangkau dari App.",
    ],
    roles: roleChecklist,
    applications,
    summary: {
      routePatterns: applications.reduce((n, app) => n + app.routes.length, 0),
      navigationItems: applications.reduce(
        (n, app) => n + app.navigation.length,
        0,
      ),
      staticLinks: applications.reduce((n, app) => n + app.links.length, 0),
      dynamicLinks: applications.reduce(
        (n, app) => n + app.dynamicLinks.length,
        0,
      ),
      missingRoutes: applications.flatMap((app) =>
        app.links
          .filter((link) => link.result === "missing-route")
          .map((link) => ({ app: app.id, ...link })),
      ),
      unresolvedRoutes: applications.flatMap((app) =>
        app.unresolvedRoutes.map((route) => ({ app: app.id, ...route })),
      ),
    },
  };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderMarkdown(report) {
  const lines = [
    "# Peta pengujian JakSanggar",
    "",
    "Dokumen ini dihasilkan oleh `node scripts/feature-coverage.mjs` dari kode produksi. **Terdaftar dalam inventaris tidak berarti seluruh fitur telah lulus uji.**",
    "",
    "## Menjalankan",
    "",
    "```powershell",
    "node scripts/feature-coverage.mjs",
    "node --test tests/navigation-coverage.test.mjs",
    "```",
    "",
    "Hasil terstruktur: `reports/feature-coverage.json`. Perbarui inventaris setiap rute/menu berubah. Tes memakai paket Wouter dan regexparam yang dipakai aplikasi, bukan implementasi pencocokan tiruan.",
    "",
    "## Cakupan otomatis lokal",
    "",
    `Ditemukan ${report.summary.routePatterns} pola rute, ${report.summary.navigationItems} item menu per peran, ${report.summary.staticLinks} target statis, dan ${report.summary.dynamicLinks} ekspresi target dinamis.`,
    "",
    "Tes memeriksa pola rute dapat dikompilasi, contoh parameter diterima router, urutan rute tidak menelan rute statis, menu setiap peran menunjuk rute dengan peran yang sesuai, target internal statis menemukan rute, dan kedua aplikasi tidak mempunyai deklarasi rute yang belum dapat dibaca. Tautan jaringan, aset, anchor dan ekspresi dinamis dilaporkan terpisah.",
    "",
    "Tes ini tidak mengirim data ke website produksi. Data demo lokal tidak membuktikan transaksi tersimpan di server.",
    "",
    "## Matriks sembilan peran",
    "",
    "| Peran | Menu terinventaris | Otomatis lokal | Perlu API dan akun uji | Perlu perangkat / pemeriksaan nyata |",
    "| --- | ---: | --- | --- | --- |",
  ];
  for (const role of report.roles) {
    const count = report.applications.reduce(
      (n, app) =>
        n + app.navigation.filter((item) => item.role === role.role).length,
      0,
    );
    lines.push(
      `| ${role.label} | ${count} | Kontrak rute dan target menu; bukan alur transaksi | ${role.api} | ${role.device} |`,
    );
  }
  lines.push(
    "",
    "## Prosedur verifikasi fungsi",
    "",
    "1. Jalankan unit test dan typecheck repository, kemudian jalankan tes navigasi di atas.",
    "2. Jalankan browser smoke test pada mode demo lokal untuk halaman, klik menu, pencarian, submenu, tema, drawer, dan ukuran layar. Catat hasil tes browser terpisah; inventaris ini tidak mengklaim tes tersebut telah dijalankan.",
    "3. Pada API/database uji yang terisolasi, periksa CRUD → muat ulang → baca dari akun pasangan. Uji keberhasilan, validasi, akses peran lain, kegagalan jaringan, dan rollback.",
    "4. Verifikasi dokumen berisi data yang benar; buka hasil PDF/DOCX, periksa halaman, tanda tangan, angka dan cetak.",
    "5. Uji komunikasi dengan dua akun/perangkat: pesan, lampiran, indikator belum dibaca, mikrofon/kamera, panggilan masuk/tolak/berakhir, dan jaringan terputus.",
    "6. Uji izin perangkat, instalasi PWA, unggah besar, email pemulihan, pembayaran dan penyimpanan server di lingkungan uji yang sesuai. Jangan menganggap stub atau demo sebagai pengujian layanan nyata.",
    "",
    "## Rute dan menu dari source",
  );
  for (const app of report.applications) {
    const counts = Object.groupBy(app.links, (link) => link.result);
    lines.push(
      "",
      `### ${app.id} (base ${app.base})`,
      "",
      `Rute: ${app.routes.length}; menu: ${app.navigation.length}; tautan statis: ${app.links.length}; target dinamis: ${app.dynamicLinks.length}.`,
      "",
      "| Klasifikasi target statis | Jumlah |",
      "| --- | ---: |",
      ...Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, rows]) => `| ${status} | ${rows.length} |`),
      "",
      "| Pola rute | Peran yang terdeteksi dari Guard | Lokasi |",
      "| --- | --- | --- |",
    );
    for (const route of app.routes)
      lines.push(
        `| \`${escapeCell(route.pattern)}\` | ${route.roles.join(", ")} | ${route.file}:${route.line} |`,
      );
    lines.push(
      "",
      "| Peran | Menu | Target | Rute cocok |",
      "| --- | --- | --- | --- |",
    );
    for (const item of app.navigation)
      lines.push(
        `| ${item.role} | ${escapeCell(item.parent ? `${item.parent} / ${item.label}` : item.label)} | \`${escapeCell(item.href)}\` | ${item.route ? `\`${escapeCell(item.route)}\`` : "**TIDAK DITEMUKAN**"} |`,
      );
  }
  lines.push(
    "",
    "## Temuan dan batas cakupan",
    "",
    ...report.limitations.map((value) => `- ${value}`),
    "",
    `Target statis tanpa rute: **${report.summary.missingRoutes.length}**. Deklarasi rute tidak terbaca: **${report.summary.unresolvedRoutes.length}**.`,
    "",
  );
  if (report.summary.missingRoutes.length)
    lines.push(
      "| Aplikasi | Target tidak cocok | Lokasi |",
      "| --- | --- | --- |",
      ...report.summary.missingRoutes.map(
        (link) =>
          `| ${link.app} | \`${escapeCell(link.target)}\` | ${link.file}:${link.line} |`,
      ),
      "",
    );
  lines.push(
    "Ekspresi dinamis dan seluruh target beserta lokasi tersedia di JSON. Pengecualian tidak dihapus diam-diam: setiap target mempunyai klasifikasi dan alasan bila tidak dicocokkan dengan router.",
    "",
  );
  return lines.join("\n");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const report = await collectCoverage();
  fs.mkdirSync(path.join(repositoryRoot, "reports"), { recursive: true });
  fs.mkdirSync(path.join(repositoryRoot, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(repositoryRoot, "reports", "feature-coverage.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(repositoryRoot, "docs", "PETA-PENGUJIAN.md"),
    renderMarkdown(report),
  );
  console.log(
    JSON.stringify(
      {
        routePatterns: report.summary.routePatterns,
        navigationItems: report.summary.navigationItems,
        staticLinks: report.summary.staticLinks,
        dynamicLinks: report.summary.dynamicLinks,
        missingRoutes: report.summary.missingRoutes.length,
        unresolvedRoutes: report.summary.unresolvedRoutes.length,
        files: ["reports/feature-coverage.json", "docs/PETA-PENGUJIAN.md"],
      },
      null,
      2,
    ),
  );
}
