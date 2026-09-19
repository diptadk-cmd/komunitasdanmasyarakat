import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import * as previous from '../public/assets/native-ui-20260914-v3.mjs';
import * as autofill from '../public/assets/native-autofill-20260915.mjs';
import * as fields from '../public/assets/native-fields-20260915.mjs';
import * as images from '../public/assets/native-images-20260915.mjs';
import * as documentOrder from '../public/assets/native-document-order-20260919.mjs';

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

async function fixture({ extraFields = [], profile = {}, savedValues = {}, catalogGroups } = {}) {
  const source = await readFile(new URL("../public/assets/native-ui-20260915.mjs", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const catalog = { groups: catalogGroups ?? [{ id: "uji", category: "Mandiri", label: "Sanggar uji", documents: [{ id: "surat", title: "Surat Uji", path: "surat.docx", fields: [{ key: "NAM_SA2" }, { key: "NOM_SUR" }] }] }] };
  catalog.groups[0].documents[0].fields.push(...extraFields);
  const slots = [], effects = [], downloads = [], blobs = [], exports = {};
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
    require: name => name.includes('document-order') ? documentOrder : name.includes('autofill') ? autofill : name.includes('fields') ? fields : name.includes('images') ? images : previous,
    window: {addEventListener() {}, removeEventListener() {}},
    fetch: async (url, options) => url.startsWith("/dokumen-fix/catalog") ? { ok: true, json: async () => catalog } : request ? request(url, options) : documentResponse(JSON.parse(options.body).format),
    AbortSignal,
    TextDecoder,
    URL: { createObjectURL: (blob) => { blobs.push(blob); return "blob:preview-uji"; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { downloads.push(this.download); } }) },
    setTimeout() {},
  });
  const Page = exports.createTemplatePage(React, () => null, () => ({ profile: { id: "uji", namaSanggar: "Sanggar Uji", ...profile }, savedValues }));
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
  return { flush, all, button, downloads, blobs, setRequest: (handler) => { request = handler; }, change: (key, value) => all().find((node) => node.props.id === "nf-field-" + key).props.onChange({ target: { value } }) };
}

test("pratinjau native hilang setelah isian berubah", async () => {
  const app = await fixture();
  await app.button("Pratinjau").props.onClick(); await app.flush();
  assert.equal(app.all().filter((node) => node.type === "iframe").length, 1);
  app.change("NOM_SUR", "001/UJI/2026"); await app.flush();
  assert.equal(app.all().filter((node) => node.type === "iframe").length, 0);
});

test("hasil render yang selesai setelah isian berubah tidak ditampilkan", async () => {
  const app = await fixture(); let finish;
  app.setRequest(() => new Promise((resolve) => { finish = resolve; }));
  const rendering = app.button("Pratinjau").props.onClick(); await app.flush();
  app.change("NOM_SUR", "002/UJI/2026"); await app.flush();
  finish(documentResponse()); await rendering; await app.flush();
  assert.equal(app.all().filter((node) => node.type === "iframe").length, 0);
  assert.ok(app.all().some((node) => node.children.some((text) => typeof text === "string" && text.includes("Isian telah berubah"))));
});

test("isian kosong ditandai sebagai draf pada peringatan dan nama unduhan", async () => {
  const app = await fixture();
  assert.ok(app.all().some((node) => node.children.some((text) => typeof text === "string" && text.includes("Masih ada 1 isian kosong"))));
  await app.button("Unduh Word dengan isian").props.onClick(); await app.flush();
  assert.match(app.downloads[0], / - Draf - Sanggar Uji\.docx$/);
  app.change("NOM_SUR", " - "); await app.flush();
  assert.ok(app.all().some((node) => node.children.some((text) => typeof text === "string" && text.includes("Masih ada 1 isian kosong"))));
  app.change("NOM_SUR", "001/UJI/2026"); await app.flush();
  await app.button("Unduh Word dengan isian").props.onClick(); await app.flush();
  assert.equal(app.downloads[1], "SURAT UJI - Sanggar Uji.docx");
});

test("template kosong melewati renderer agar tata letak dan judul juga dikoreksi", async () => {
  const app = await fixture(); let captured;
  app.setRequest(async (url, options) => { captured = {url, options}; return documentResponse('word'); });
  await app.button("Unduh template kosong").props.onClick(); await app.flush();
  assert.equal(captured.url, '/api/documents/render');
  assert.equal(captured.options.credentials, 'include');
  assert.deepEqual(JSON.parse(captured.options.body), {format:'word',html:'',nativeTemplate:{groupId:'uji',documentId:'surat',values:{}}});
  assert.equal(app.downloads[0], 'SURAT UJI.docx');
});


test("alat arsip tidak muncul dan judul otomatis kapital", async () => {
  const app = await fixture();
  assert.equal(app.button("Arsip dan alat sebelumnya"), undefined);
  assert.ok(app.all().some(node => node.type === 'h2' && node.children.includes('SURAT UJI')));
});

test("isian manual tidak hilang ketika isian lain berubah", async () => {
  const app = await fixture();
  app.change('NOM_SUR', '123/UJI/2026'); await app.flush();
  app.change('NAM_SA2', 'Sanggar Isi Sendiri'); await app.flush();
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NOM_SUR').props.value, '123/UJI/2026');
});

test('autofill atas permintaan mengisi kosong tersimpan tanpa menimpa isian manual', async () => {
  const app = await fixture({ savedValues: { 'uji:native-fix-uji': { NAM_SA2: '', NOM_SUR: '007/ABC' } } });
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NAM_SA2').props.value, '');
  app.button('Isi otomatis yang kosong').props.onClick(); await app.flush();
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NAM_SA2').props.value, 'Sanggar Uji');
  assert.equal(app.all().find(node => node.props.id === 'nf-field-NOM_SUR').props.value, '007/ABC');
});

test('pilihan jamak mempertahankan pilihan profil dan teks tambahan sampai render', async () => {
  const app = await fixture({ extraFields: [{ key: 'BID_SEN' }], profile: { jenisKesenian: ['Tari', 'Musik'] } });
  const input = suffix => app.all().find(node => node.props.id === 'nf-field-BID_SEN' + suffix);
  assert.equal(input('').props.checked, true);
  assert.equal(input('-1').props.checked, true);
  input('-custom').props.onChange({ target: { value: 'Wayang\n' } }); await app.flush();
  assert.equal(input('-custom').props.value, 'Wayang\n');
  input('-2').props.onChange({ target: { checked: true } }); await app.flush();
  input('').props.onChange({ target: { checked: false } }); await app.flush();
  let captured;
  app.setRequest(async (_url, options) => { captured = JSON.parse(options.body); return documentResponse('word'); });
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
