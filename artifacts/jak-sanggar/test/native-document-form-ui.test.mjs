import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import * as previous from '../public/assets/native-ui-20260914-v3.mjs';
import * as autofill from '../public/assets/native-autofill-20260915.mjs';
import * as workspaceAutofill from '../public/assets/native-autofill-workspace-20260920.mjs';
import * as fields from '../public/assets/native-fields-20260915.mjs';
import * as images from '../public/assets/native-images-20260915.mjs';
import * as documentOrder from '../public/assets/native-document-order-20260919.mjs';
import * as workspaceStyles from '../public/assets/native-document-workspace-20260920.mjs';

const pdf = await PDFDocument.create();
pdf.addPage().drawText("Dokumen uji");
const validPdf = await pdf.save();
const docx = new JSZip();
docx.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
docx.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
docx.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Dokumen uji</w:t></w:r></w:p></w:body></w:document>');
const validDocx = await docx.generateAsync({ type: 'uint8array' });
const wordMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const documentResponse = (format = 'pdf', mime = format === 'word' ? wordMime : 'application/pdf') => new Response(format === 'word' ? validDocx : validPdf, { headers: { 'Content-Type': mime } });

async function fixture({ extraFields = [], profile = {}, savedValues = {}, catalogGroups, imageRenderer, onSave } = {}) {
  const source = await readFile(new URL("../public/assets/native-ui-20260915.mjs", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const catalog = { groups: catalogGroups ?? [{ id: "uji", category: "Mandiri", label: "Sanggar uji", documents: [{ id: "surat", title: "Surat Uji", path: "surat.docx", fields: [{ key: "NAM_SA2" }, { key: "NOM_SUR" }] }] }] };
  catalog.groups[0].documents[0].fields.push(...extraFields);
  const slots = [], effects = [], downloads = [], blobs = [], focused = [], exports = {};
  let cursor = 0, dirty = true, tree, request;
  const React = {
    Fragment: "fragment",
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, (update) => {
        const value = typeof update === "function" ? update(slots[index].value) : update;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(effect, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: name => name.includes('document-workspace') ? workspaceStyles : name.includes('document-order') ? documentOrder : name.includes('autofill-workspace') ? workspaceAutofill : name.includes('autofill') ? autofill : name.includes('fields') ? fields : name.includes('images') ? { ...images, renderImages: imageRenderer ?? images.renderImages } : previous,
    window: {addEventListener() {}, removeEventListener() {}},
    fetch: async (url, options) => url.startsWith("/dokumen-fix/catalog") ? { ok: true, json: async () => catalog } : request ? request(url, options) : documentResponse(JSON.parse(options.body).format),
    AbortSignal,
    TextDecoder,
    URL: { createObjectURL: (blob) => { blobs.push(blob); return "blob:preview-uji"; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { downloads.push(this.download); } }), getElementById: id => ({ focus() { focused.push(id); }, scrollIntoView() {} }) },
    setTimeout() {},
  });
  const Page = exports.createTemplatePage(React, () => null, () => ({ profile: { id: "uji", namaSanggar: "Sanggar Uji", ...profile }, savedValues, save: onSave }));
  async function flush() {
    for (let step = 0; step < 15; step++) {
      if (dirty) { dirty = false; cursor = 0; tree = Page(); while (effects.length) effects.shift()(); }
      await new Promise(setImmediate);
      if (!dirty) return;
    }
    throw new Error("Komponen tidak mencapai keadaan stabil");
  }
  function all(node = tree) {
    if (!node || typeof node !== "object") return [];
    return [node, ...node.children.filter((child) => child !== undefined).flatMap((child) => all(child))];
  }
  function button(text) { return all().find((node) => node.type === "button" && node.children.includes(text)); }
  await flush();
  async function edit() {
    if (button('Kembali ke isian')) { button('Kembali ke isian').props.onClick(); await flush(); }
  }
  async function showField(key) {
    await edit();
    if (!all().find(node => node.props.id === 'nf-field-' + key)) {
      all().find(node => node.props.id === 'nf-field-search').props.onChange({ target: { value: key } });
      await flush();
    }
    return all().find(node => node.props.id === 'nf-field-' + key);
  }
  async function change(key, value) { const control = await showField(key); control.props.onChange({ target: { value } }); await flush(); }
  async function review() { if (tree.props['data-view'] === 'edit') { await button('Pratinjau').props.onClick(); await flush(); } }
  return { flush, all, button, downloads, blobs, focused, showField, change, edit, review, setRequest: (handler) => { request = handler; } };
}

test("pratinjau native hilang setelah isian berubah", async () => {
  const app = await fixture();
  await app.button("Pratinjau").props.onClick(); await app.flush();
  assert.equal(app.all().filter((node) => node.type === "iframe").length, 1);
  await app.change("NOM_SUR", "001/UJI/2026"); await app.flush();
  assert.equal(app.all().filter((node) => node.type === "iframe").length, 0);
});

test("hasil render yang selesai setelah isian berubah tidak ditampilkan", async () => {
  const app = await fixture(); let finish;
  app.setRequest(() => new Promise((resolve) => { finish = resolve; }));
  const rendering = app.button("Pratinjau").props.onClick(); await app.flush();
  await app.change("NOM_SUR", "002/UJI/2026"); await app.flush();
  finish(documentResponse()); await rendering; await app.flush();
  assert.equal(app.all().filter((node) => node.type === "iframe").length, 0);
  assert.ok(app.all().some((node) => node.children.some((text) => typeof text === "string" && text.includes("Isian telah berubah"))));
});

test("isian kosong ditandai sebagai draf pada peringatan dan nama unduhan", async () => {
  const app = await fixture();
  assert.ok(app.all().some((node) => node.children.some((text) => typeof text === "string" && text.includes("Masih ada 1 isian kosong"))));
  await app.review();
  await app.button("Unduh Word dengan isian").props.onClick(); await app.flush();
  assert.match(app.downloads[0], / - Draf - Sanggar Uji\.docx$/);
  await app.change("NOM_SUR", " - "); await app.flush();
  assert.ok(app.all().some((node) => node.children.some((text) => typeof text === "string" && text.includes("Masih ada 1 isian kosong"))));
  await app.change("NOM_SUR", "001/UJI/2026"); await app.flush();
  await app.review();
  await app.button("Unduh Word dengan isian").props.onClick(); await app.flush();
  assert.equal(app.downloads[1], "SURAT UJI - Sanggar Uji.docx");
});

test("template kosong melewati renderer agar tata letak dan judul juga dikoreksi", async () => {
  const app = await fixture(); let captured;
  app.setRequest(async (url, options) => { captured = {url, options}; return documentResponse('word'); });
  await app.review();
  await app.button("Unduh template kosong").props.onClick(); await app.flush();
  assert.equal(captured.url, '/api/documents/render');
  assert.equal(captured.options.credentials, 'include');
  assert.deepEqual(JSON.parse(captured.options.body), {format:'word',html:'',nativeTemplate:{groupId:'uji',documentId:'surat',values:{}}});
  assert.equal(app.downloads[0], 'SURAT UJI.docx');
});


test("alat arsip tidak muncul dan judul dokumen mudah dibaca", async () => {
  const app = await fixture();
  assert.equal(app.button("Arsip dan alat sebelumnya"), undefined);
  assert.ok(app.all().some(node => node.type === 'h1' && node.children.includes('Surat Uji')));
});

test("isian manual tidak hilang ketika isian lain berubah", async () => {
  const app = await fixture();
  await app.change('NOM_SUR', '123/UJI/2026'); await app.flush();
  await app.change('NAM_SA2', 'Sanggar Isi Sendiri'); await app.flush();
  assert.equal((await app.showField('NOM_SUR')).props.value, '123/UJI/2026');
});

test('autofill atas permintaan mengisi kosong tersimpan tanpa menimpa isian manual', async () => {
  const app = await fixture({ savedValues: { 'uji:native-fix-uji': { NAM_SA2: '', NOM_SUR: '007/ABC' } } });
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NAM_SA2').props.value, '');
  app.button('Isi otomatis yang kosong').props.onClick(); await app.flush();
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NAM_SA2').props.value, 'Sanggar Uji');
  assert.equal((await app.showField('NOM_SUR')).props.value, '007/ABC');
});

test('hari forum otomatis mengikuti tanggal dan nilai yang sama dikirim ke renderer serta simpan', async () => {
  let payload, saved;
  const app = await fixture({ extraFields: [{ key: 'TGL_FOR' }, { key: 'HAR_FOR' }, { key: 'BLN' }, { key: 'THN' }], onSave: async (_key, values) => { saved = values; } });
  await app.change('TGL_FOR', '2026-09-20');
  assert.equal((await app.showField('HAR_FOR')).props.value, 'Minggu');
  await app.change('TGL_FOR', '2026-09-21');
  assert.equal((await app.showField('HAR_FOR')).props.value, 'Senin');
  app.setRequest(async (_url, options) => { payload = JSON.parse(options.body); return documentResponse(); });
  await app.review();
  assert.equal(payload.nativeTemplate.values.HAR_FOR, 'Senin');
  assert.equal(payload.nativeTemplate.values.BLN, 'IX');
  assert.equal(payload.nativeTemplate.values.THN, '2026');
  assert.equal(payload.nativeTemplate.values.__autofill_generated, undefined);
  await app.button('Simpan isian').props.onClick(); await app.flush();
  assert.equal(saved.HAR_FOR, 'Senin');
  assert.equal(JSON.parse(saved.__autofill_generated).HAR_FOR, 'Senin');
  await app.change('HAR_FOR', 'Sabtu');
  await app.change('TGL_FOR', '2026-09-22');
  assert.equal((await app.showField('HAR_FOR')).props.value, 'Sabtu');
});

test('ikon bantuan memberi pilihan mandat atas klik dan mempertahankan rincian multiline sampai render', async () => {
  const app = await fixture({ extraFields: [{ key: 'DAS_MAN', context: 'Berdasarkan {{DAS_MAN}}.' }] });
  const control = await app.showField('DAS_MAN');
  assert.equal(control.type, 'textarea');
  assert.equal(control.props.value, '');
  const help = app.all().find(node => typeof node.type === 'function' && node.props.name === 'Dasar pemberian mandat');
  assert.ok(help.props.guidance.meaning);
  assert.ok(help.props.guidance.sourceHint);
  const helpTree = help.type(help.props);
  const choice = app.all(helpTree).find(node => node.type === 'button' && node.props['aria-label']?.startsWith('Gunakan '));
  assert.ok(choice);
  choice.props.onClick({ currentTarget: { closest: () => ({ removeAttribute() {} }) } });
  await app.flush();
  assert.equal((await app.showField('DAS_MAN')).props.value, help.props.choices[0].value);
  const manual = 'Keputusan rapat pengurus\nNomor QA/01, 20 September 2026, untuk tugas uji.';
  await app.change('DAS_MAN', manual);
  let payload;
  app.setRequest(async (_url, options) => { payload = JSON.parse(options.body); return documentResponse(); });
  await app.review();
  assert.equal(payload.nativeTemplate.values.DAS_MAN, manual);
});

test('isian pilihan sendiri yang tersimpan beberapa baris tetap dapat diedit sebagai textarea', async () => {
  const app = await fixture({ extraFields: [{ key: 'BLN' }], savedValues: { 'uji:native-fix-uji': { BLN: 'Catatan lama\nPeriode khusus' } } });
  await app.showField('BLN');
  const control = app.all().find(node => node.props.id === 'nf-field-BLN-custom');
  assert.equal(control.type, 'textarea');
  assert.equal(control.props.value, 'Catatan lama\nPeriode khusus');
});

test('pilihan jamak mempertahankan pilihan profil dan teks tambahan sampai render', async () => {
  const app = await fixture({ extraFields: [{ key: 'BID_SEN' }], profile: { jenisKesenian: ['Tari', 'Musik'] } });
  await app.showField('BID_SEN');
  const input = suffix => app.all().find(node => node.props.id === 'nf-field-BID_SEN' + suffix);
  assert.equal(input('').props.checked, true);
  assert.equal(input('-1').props.checked, true);
  input('-custom').props.onChange({ target: { value: 'Wayang\n' } }); await app.flush();
  assert.equal(input('-custom').props.value, 'Wayang\n');
  input('-2').props.onChange({ target: { checked: true } }); await app.flush();
  input('').props.onChange({ target: { checked: false } }); await app.flush();
  let captured;
  app.setRequest(async (_url, options) => { captured = JSON.parse(options.body); return documentResponse('word'); });
  await app.review();
  await app.button('Unduh Word dengan isian').props.onClick();
  assert.deepEqual(captured.nativeTemplate.values.BID_SEN.split('\n'), ['Musik', 'Teater', 'Wayang']);
});

function alertText(app) {
  return app.all().filter(node => node.props.role === 'alert').flatMap(node => node.children).join(' ');
}

test('layanan 503 menghentikan loading, menampilkan pesan, dan bisa dicoba lagi', async () => {
  const app = await fixture(); let finish;
  app.setRequest(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.button('Pratinjau').props.onClick(); await app.flush();
  assert.equal(app.button('Menyiapkan pratinjau…').props.disabled, true);
  assert.equal(app.button('Unduh Word dengan isian').props.disabled, true);
  finish(new Response(JSON.stringify({ error: 'Generator dokumen belum tersedia. Coba lagi sebentar.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
  await pending; await app.flush();
  assert.match(alertText(app), /Generator dokumen belum tersedia/);
  assert.equal(app.button('Pratinjau').props.disabled, false);
  assert.equal(app.blobs.length, 0);
  app.setRequest(() => documentResponse());
  await app.button('Pratinjau').props.onClick(); await app.flush();
  assert.equal(alertText(app), '');
  assert.equal(app.all().filter(node => node.type === 'iframe').length, 1);
});

for (const [action, expectedFormat] of [['Pratinjau', 'PDF'], ['Unduh PDF', 'PDF'], ['Unduh Word dengan isian', 'Word'], ['Unduh template kosong', 'Word']]) {
  test(`${action}: HTML SPA berstatus 200 tidak menjadi dokumen`, async () => {
    const app = await fixture();
    app.setRequest(() => new Response('<!doctype html><html><body><div id="root"></div></body></html>', { headers: { 'Content-Type': 'text/html' } }));
    if (action !== 'Pratinjau') await app.review();
    await app.button(action).props.onClick(); await app.flush();
    assert.match(alertText(app), new RegExp(`file ${expectedFormat} yang valid`));
    assert.equal(app.downloads.length, 0);
    assert.equal(app.blobs.length, 0);
    assert.equal(app.all().filter(node => node.type === 'iframe').length, 0);
    assert.equal(app.button(action).props.disabled, false);
  });
}

test('header PDF palsu, respons kosong, dan PDF terpotong ditolak', async () => {
  for (const data of ['<html>Bukan PDF</html>', '', '%PDF-1.7\nfile terputus']) {
    const app = await fixture();
    app.setRequest(() => new Response(data, { headers: { 'Content-Type': 'application/pdf' } }));
    await app.button('Pratinjau').props.onClick(); await app.flush();
    assert.match(alertText(app), /file PDF yang valid/);
    assert.equal(app.blobs.length, 0);
  }
});

test('ZIP biasa dan DOCX terpotong tidak diunduh sebagai Word', async () => {
  const otherZip = await new JSZip().file('report.txt', 'bukan dokumen Word').generateAsync({ type: 'uint8array' });
  for (const data of [otherZip, validDocx.slice(0, -24), '<html>Gagal</html>']) {
    const app = await fixture();
    app.setRequest(() => new Response(data, { headers: { 'Content-Type': wordMime } }));
    await app.review();
  await app.button('Unduh Word dengan isian').props.onClick(); await app.flush();
    assert.match(alertText(app), /file Word yang valid/);
    assert.equal(app.downloads.length, 0);
    assert.equal(app.blobs.length, 0);
  }
});

test('file biner valid tetap bisa dipakai ketika renderer mengirim octet-stream', async () => {
  const app = await fixture();
  app.setRequest((_url, options) => documentResponse(JSON.parse(options.body).format, 'application/octet-stream'));
  await app.button('Pratinjau').props.onClick(); await app.flush();
  assert.equal(app.blobs[0].type, 'application/pdf');
  await app.review();
  await app.button('Unduh Word dengan isian').props.onClick(); await app.flush();
  assert.equal(app.blobs[1].type, wordMime);
  assert.equal(app.downloads.length, 1);
  assert.equal(alertText(app), '');
});

test('batas waktu dan body unduhan terputus mengembalikan tombol ke keadaan siap', async () => {
  for (const kind of ['timeout', 'body']) {
    const app = await fixture();
    app.setRequest((_url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      if (kind === 'timeout') return Promise.reject(new DOMException('timeout', 'TimeoutError'));
      return { ok: true, headers: new Headers({ 'Content-Type': 'application/pdf' }), blob: async () => { throw new Error('stream closed'); } };
    });
    await app.button('Pratinjau').props.onClick(); await app.flush();
    assert.match(alertText(app), kind === 'timeout' ? /terlalu lama/ : /Unduhan dokumen terputus/);
    assert.equal(app.button('Pratinjau').props.disabled, false);
    assert.equal(app.blobs.length, 0);
  }
});

test('pilihan awal dan perpindahan kategori atau bentuk memakai berita acara pertama', async () => {
  const document = (id, title) => ({ id, title, path: `${id}.docx`, fields: [] });
  const makeDocuments = (suffix) => [
    document(`anggaran-dasar-${suffix}`, `Anggaran Dasar ${suffix}`),
    document(`keputusan-pembentukan-${suffix}`, `Keputusan Pembentukan ${suffix}`),
    document(`berita-acara-pembentukan-${suffix}`, `Berita Acara Pembentukan ${suffix}`),
  ];
  const app = await fixture({ catalogGroups: [
    { id: 'mandiri-nonbadan-hukum', category: 'Mandiri', label: 'Mandiri Nonbadan Hukum', documents: makeDocuments('sanggar') },
    { id: 'uji-usaha', category: 'Mandiri', label: 'Mandiri / Usaha', documents: [document('pedoman-dasar', 'Pedoman Dasar'), document('berita-acara-forum-penetapan', 'Berita Acara Forum Penetapan')] },
    { id: 'unit-nonbadan-hukum', category: 'Unit', label: 'Unit Nonbadan Hukum', documents: makeDocuments('organisasi-induk') },
  ] });
  app.button('Ganti dokumen').props.onClick(); await app.flush();
  const selected = () => app.all().find(node => node.type === 'button' && node.props['aria-pressed'] === true)?.children[0];
  assert.equal(selected(), 'Berita Acara Pembentukan sanggar');
  app.all().find(node => node.props.id === 'nf-group').props.onChange({ target: { value: 'uji-usaha' } });
  await app.flush();
  assert.equal(selected(), 'Berita Acara Forum Penetapan');
  app.all().find(node => node.props.id === 'nf-category').props.onChange({ target: { value: 'Unit' } });
  await app.flush();
  assert.equal(selected(), 'Berita Acara Pembentukan organisasi-induk');
  app.all().find(node => node.props.id === 'nf-search').props.onChange({ target: { value: 'Pembentukan' } });
  await app.flush();
  const documentButtons = app.all().find(node => node.props['aria-label'] === 'Daftar dokumen').children.filter(node => node?.type === 'button');
  assert.equal(documentButtons[0].children[0], 'Berita Acara Pembentukan organisasi-induk');
});

const actualCatalog = JSON.parse(await readFile(new URL('../public/dokumen-fix/catalog.json', import.meta.url), 'utf8'));
async function largeForm() {
  const group = actualCatalog.groups.find(group => group.id === 'mandiri-badan-usaha-firma');
  const document = group.documents.find(document => document.id === 'data-induk-sanggar');
  return fixture({ catalogGroups: [{ ...structuredClone(group), documents: [structuredClone(document)] }] });
}
const hasClass = (node, name) => node.props.className?.split(' ').includes(name);
const controls = app => app.all().filter(node => hasClass(node, 'nf-field'));
const sectionToggles = app => app.all().filter(node => hasClass(node, 'nf-section-toggle'));
const searchField = app => app.all().find(node => node.props.id === 'nf-field-search');
const textPresent = (app, text) => app.all().some(node => node.children.includes(text));

test('formulir besar dimulai ringkas: picker dan gambar tertutup, satu bagian dengan enam isian', async () => {
  const app = await largeForm();
  assert.equal(app.button('Ganti dokumen').props['aria-expanded'], false);
  assert.equal(app.all().some(node => node.props.id === 'nf-document-picker'), false);
  assert.equal(app.all().find(node => hasClass(node, 'nf-images-disclosure')).props.open, false);
  assert.equal(app.button('Unduh Word dengan isian'), undefined);
  assert.equal(app.button('Unduh PDF'), undefined);
  assert.equal(sectionToggles(app).length, 5);
  assert.equal(sectionToggles(app).filter(node => node.props['aria-expanded']).length, 1);
  assert.equal(controls(app).length, 6);
  assert.ok(textPresent(app, 'Bagian 1 dari 4'));
  assert.equal(app.button('Isian sebelumnya').props.disabled, true);
});

test('halaman bagian diingat saat berpindah bagian dan kembali dari review tanpa kehilangan isian', async () => {
  const app = await largeForm();
  sectionToggles(app)[3].props.onClick(); await app.flush();
  assert.ok(textPresent(app, 'Bagian 1 dari 6'));
  app.button('Isian berikutnya').props.onClick(); await app.flush();
  assert.ok(textPresent(app, 'Bagian 2 dari 6'));
  assert.equal(app.focused.at(-1), 'nf-section-3-toggle');
  assert.equal(controls(app).length, 6);
  await app.change('BEN', 'Bendahara Uji');
  sectionToggles(app)[0].props.onClick(); await app.flush();
  sectionToggles(app)[3].props.onClick(); await app.flush();
  assert.ok(textPresent(app, 'Bagian 2 dari 6'));
  assert.equal((await app.showField('BEN')).props.value, 'Bendahara Uji');
  await app.review();
  assert.equal(app.all()[0].props['data-view'], 'review');
  assert.ok(app.button('Unduh Word dengan isian'));
  const fullPdf = app.all().find(node => node.type === 'a' && node.children.includes('Buka PDF penuh'));
  assert.equal(fullPdf.props.href, 'blob:preview-uji');
  assert.equal(fullPdf.props.target, '_blank');
  assert.equal(fullPdf.props.rel, 'noopener noreferrer');
  await app.edit();
  assert.ok(textPresent(app, 'Bagian 2 dari 6'));
  assert.equal((await app.showField('BEN')).props.value, 'Bendahara Uji');
  assert.equal(app.focused.at(-1), 'nf-section-3-toggle');
  assert.equal(app.button('Unduh Word dengan isian'), undefined);
});

test('pencarian menjangkau isian dari bagian tertutup dan mengembalikan bagian semula', async () => {
  const app = await largeForm();
  app.button('Isian berikutnya').props.onClick(); await app.flush();
  searchField(app).props.onChange({ target: { value: 'NOTULIS' } }); await app.flush();
  assert.ok(app.all().find(node => node.props.id === 'nf-field-NOTULIS'));
  assert.equal(controls(app).length, 1);
  assert.equal(app.button('Isian berikutnya'), undefined);
  await app.change('NOTULIS', 'Nama Notulis Uji');
  app.button('Tampilkan semua bagian').props.onClick(); await app.flush();
  assert.equal(app.focused.at(-1), 'nf-field-search');
  assert.ok(textPresent(app, 'Bagian 2 dari 4'));
  assert.equal(sectionToggles(app)[0].props['aria-expanded'], true);
  assert.equal((await app.showField('NOTULIS')).props.value, 'Nama Notulis Uji');
});

test('filter kosong mempertahankan isian yang sedang diketik sampai fokus meninggalkan bidangnya', async () => {
  const app = await fixture();
  const filterLabel = app.all().find(node => hasClass(node, 'nf-filter'));
  app.all(filterLabel).find(node => node.type === 'input').props.onChange({ target: { checked: true } }); await app.flush();
  const field = controls(app).find(node => app.all(node).some(child => child.props.id === 'nf-field-NOM_SUR'));
  field.props.onFocus(); await app.flush();
  await app.change('NOM_SUR', '0');
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NOM_SUR').props.value, '0');
  await app.change('NOM_SUR', '007/UJI/2026');
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NOM_SUR').props.value, '007/UJI/2026');
  controls(app)[0].props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null }); await app.flush();
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NOM_SUR'), undefined);
  assert.ok(textPresent(app, 'Semua isian sudah terisi. Dokumen siap diperiksa.'));
});

test('tautan gambar membuka panel opsional dan meminta fokus tombol unggah yang terlihat', async () => {
  const app = await fixture({ extraFields: [{ key: 'LOGO' }] });
  const link = app.all().find(node => node.type === 'a' && node.children.includes('Buka unggah logo'));
  let prevented = false;
  link.props.onClick({ preventDefault() { prevented = true; } }); await app.flush();
  assert.equal(prevented, true);
  assert.equal(app.all().find(node => hasClass(node, 'nf-images-disclosure')).props.open, true);
  assert.equal(app.focused.at(-1), 'nf-upload-trigger-logo');
  assert.equal(app.all().find(node => node.props.id === 'nf-upload-trigger-logo').type, 'button');
  assert.equal(app.all().find(node => node.props.id === 'nf-upload-logo').props.hidden, true);
});

test('lanjut bagian memindahkan permintaan fokus ke judul bagian tujuan', async () => {
  const app = await fixture();
  app.button('Lanjut ke bagian berikutnya').props.onClick(); await app.flush();
  assert.equal(sectionToggles(app)[1].props['aria-expanded'], true);
  assert.equal(app.focused.at(-1), 'nf-section-1-toggle');
});

test('ganti dokumen mereset workspace dan preview tetapi mempertahankan draf lintas dokumen', async () => {
  const app = await fixture({ catalogGroups: [{ id: 'uji', category: 'Mandiri', label: 'Sanggar uji', documents: [
    { id: 'berita-acara-pembentukan', title: 'Berita Acara Pembentukan', fields: [{ key: 'NAM_SA2' }, { key: 'NOM_SUR' }] },
    { id: 'keputusan-pembentukan', title: 'Keputusan Pembentukan', fields: [{ key: 'NAM_SA2' }, { key: 'KETUA' }] },
  ] }] });
  await app.change('NOM_SUR', '009/DRAF');
  await app.review();
  app.button('Ganti dokumen').props.onClick(); await app.flush();
  app.button('Keputusan Pembentukan').props.onClick(); await app.flush();
  assert.equal(app.all()[0].props['data-view'], 'edit');
  assert.equal(app.button('Ganti dokumen').props['aria-expanded'], false);
  assert.equal(searchField(app).props.value, '');
  assert.equal(sectionToggles(app)[0].props['aria-expanded'], true);
  assert.equal(app.all().filter(node => node.type === 'iframe').length, 0);
  assert.equal(app.focused.at(-1), 'nf-document-title');
  app.button('Ganti dokumen').props.onClick(); await app.flush();
  app.button('Berita Acara Pembentukan').props.onClick(); await app.flush();
  assert.equal((await app.showField('NOM_SUR')).props.value, '009/DRAF');
});

test('dokumen tanpa isian tetap bisa diperiksa tanpa progres nol atau pencarian kosong', async () => {
  const group = actualCatalog.groups.find(group => group.documents.some(document => !document.fields.length));
  const document = group.documents.find(document => !document.fields.length);
  const app = await fixture({ catalogGroups: [{ ...structuredClone(group), documents: [structuredClone(document)] }] });
  assert.equal(searchField(app), undefined);
  assert.equal(app.all().some(node => node.type === 'progress'), false);
  assert.ok(textPresent(app, 'Dokumen ini tidak memerlukan isian.'));
  await app.review();
  assert.equal(app.all().filter(node => node.type === 'iframe').length, 1);
  assert.ok(app.button('Unduh Word dengan isian'));
  assert.ok(app.button('Unduh PDF'));
});

test('kop builder diterapkan ke slot letterhead tanpa menghapus isian, lalu dikirim dan disimpan', async () => {
  const png = 'data:image/png;base64,' + (await readFile(new URL('../../../services/document-renderer/test-assets/letterhead.png', import.meta.url))).toString('base64');
  let saved, request;
  const app = await fixture({ imageRenderer: async imageMap => imageMap, onSave: async (key, values) => { saved = { key, values }; } });
  await app.change('NOM_SUR', '025/KOP/2026');
  await app.review();
  assert.equal(app.all().filter(node => node.type === 'iframe').length, 1);
  app.button('Buat kop surat').props.onClick(); await app.flush();
  let builder = app.all().find(node => typeof node.props.onApply === 'function');
  assert.equal(builder.props.open, true);
  assert.equal(builder.props.profile.id, 'uji');
  builder.props.onApply(png); await app.flush();
  assert.equal(app.all()[0].props['data-view'], 'edit');
  assert.equal(app.all().filter(node => node.type === 'iframe').length, 0);
  assert.equal(app.all().find(node => typeof node.props.onApply === 'function').props.open, false);
  assert.equal((await app.showField('NOM_SUR')).props.value, '025/KOP/2026');
  assert.ok(app.all().some(node => node.type === 'img' && node.props.src === png));
  await app.button('Simpan isian').props.onClick(); await app.flush();
  assert.equal(saved.key, 'uji:native-fix-uji');
  assert.equal(saved.values.__image_letterhead, png);
  assert.equal(saved.values.NOM_SUR, '025/KOP/2026');
  app.setRequest(async (_url, options) => { request = JSON.parse(options.body); return documentResponse(); });
  await app.review();
  assert.equal(request.nativeTemplate.images.letterhead, png);
  assert.equal(request.nativeTemplate.values.NOM_SUR, '025/KOP/2026');
});

test('tutup kop builder tidak mengubah isian dan data gambar yang tidak valid ditolak', async () => {
  const app = await fixture();
  await app.change('NOM_SUR', '026/KOP/2026');
  app.button('Buat kop surat').props.onClick(); await app.flush();
  let builder = app.all().find(node => typeof node.props.onApply === 'function');
  builder.props.onApply('https://example.com/kop.png'); await app.flush();
  assert.ok(textPresent(app, 'Kop surat belum valid. Buat ulang kop sebelum digunakan.'));
  builder = app.all().find(node => typeof node.props.onApply === 'function');
  assert.equal(builder.props.open, true);
  builder.props.onClose(); await app.flush();
  assert.equal((await app.showField('NOM_SUR')).props.value, '026/KOP/2026');
  assert.equal(app.all().some(node => node.type === 'img' && node.props.src === 'https://example.com/kop.png'), false);
});
