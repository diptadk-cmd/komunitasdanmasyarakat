import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import * as previous from '../public/assets/native-ui-20260914-v3.mjs';
import * as autofill from '../public/assets/native-autofill-20260915.mjs';
import * as fields from '../public/assets/native-fields-20260915.mjs';
import * as images from '../public/assets/native-images-20260915.mjs';

async function fixture({ extraFields = [], profile = {}, savedValues = {} } = {}) {
  const source = await readFile(new URL("../public/assets/native-ui-20260915.mjs", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const catalog = { groups: [{ id: "uji", category: "Mandiri", label: "Sanggar uji", documents: [{ id: "surat", title: "Surat Uji", path: "surat.docx", fields: [{ key: "NAM_SA2" }, { key: "NOM_SUR" }] }] }] };
  catalog.groups[0].documents[0].fields.push(...extraFields);
  const slots = [], effects = [], downloads = [], exports = {};
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
    require: name => name.includes('autofill') ? autofill : name.includes('fields') ? fields : name.includes('images') ? images : previous,
    window: {addEventListener() {}, removeEventListener() {}},
    fetch: async (url, options) => url.startsWith("/dokumen-fix/catalog") ? { ok: true, json: async () => catalog } : request ? request(url, options) : { ok: true, blob: async () => ({}) },
    URL: { createObjectURL: () => "blob:preview-uji", revokeObjectURL() {} },
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
  return { flush, all, button, downloads, setRequest: (handler) => { request = handler; }, change: (key, value) => all().find((node) => node.props.id === "nf-field-" + key).props.onChange({ target: { value } }) };
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
  finish({ ok: true, blob: async () => ({}) }); await rendering; await app.flush();
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
  app.setRequest(async (url, options) => { captured = {url, options}; return {ok:true, blob:async()=>({})}; });
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
  app.setRequest(async (_url, options) => { captured = JSON.parse(options.body); return { ok: true, blob: async () => ({}) }; });
  await app.button('Unduh Word dengan isian').props.onClick();
  assert.deepEqual(captured.nativeTemplate.values.BID_SEN.split('\n'), ['Musik', 'Teater', 'Wayang']);
});
