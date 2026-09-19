import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function muatModul(relativePath, context = {}, modules = {}) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => modules[name] ?? {},
    ...context,
  });
  return exports;
}

const { bagianKanvasKosong } = await muatModul("../src/lib/dokumen-export.ts");

function kanvasDenganPiksel(pixels) {
  return {
    width: pixels.length / 4,
    getContext: () => ({
      getImageData: () => ({ data: Uint8ClampedArray.from(pixels) }),
    }),
  };
}

test("halaman akhir pendek berisi satu piksel tulisan tetap dipertahankan", () => {
  const kanvas = kanvasDenganPiksel([255, 255, 255, 255, 20, 20, 20, 255]);
  assert.equal(bagianKanvasKosong(kanvas, 100, 1), false);
});

test("sisa halaman hanya boleh dihapus ketika seluruh piksel kosong", () => {
  const kanvas = kanvasDenganPiksel([255, 255, 255, 255, 0, 0, 0, 0]);
  assert.equal(bagianKanvasKosong(kanvas, 100, 1), true);
});

test("halaman dipertahankan bila pemeriksaan piksel gagal", () => {
  assert.equal(bagianKanvasKosong({ getContext: () => null }, 100, 1), false);
  assert.equal(
    bagianKanvasKosong(
      {
        getContext: () => ({
          getImageData() {
            throw new Error("SecurityError");
          },
        }),
      },
      100,
      1,
    ),
    false,
  );
});

async function mulaiPreview(documentHtml = "<p>Dokumen</p>") {
  const frame = {};
  const state = [];
  const effects = [];
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const react = {
    memo: (component) => component,
    useId: () => "preview-uji",
    useRef: () => ({ current: { contentWindow: frame } }),
    useMemo: () => "",
    useEffect: (effect) => effects.push(effect),
    useState: (initial) => {
      const index = state.push(initial) - 1;
      return [
        initial,
        (value) => {
          state[index] =
            typeof value === "function" ? value(state[index]) : value;
        },
      ];
    },
  };
  const { PagedDocumentPreview } = await muatModul(
    "../src/components/dokumen/PagedDocumentPreview.tsx",
    {
      window: {
        addEventListener: (name, handler) => listeners.set(name, handler),
        removeEventListener: (name) => listeners.delete(name),
        setTimeout: (handler) => {
          timers.set(++timerId, handler);
          return timerId;
        },
        clearTimeout: (id) => timers.delete(id),
      },
    },
    { react, "react/jsx-runtime": { jsx: () => null, jsxs: () => null } },
  );
  PagedDocumentPreview({ documentHtml });
  const cleanup = effects[0]();
  return {
    state,
    timers,
    cleanup,
    kirim: (data) =>
      listeners.get("message")({
        source: frame,
        data: {
          source: "jak-sanggar-paged-preview",
          id: "preview-uji",
          ...data,
        },
      }),
  };
}

test("preview sukses tidak berubah gagal setelah batas waktu 20 detik", async () => {
  const preview = await mulaiPreview();
  const timeout = [...preview.timers.values()][0];
  preview.kirim({ total: 2 });
  assert.equal(preview.timers.size, 0);
  timeout();
  assert.deepEqual(preview.state, [false, "", 2]);
  preview.cleanup();
});

test("preview yang belum selesai tetap memberi pesan batas waktu", async () => {
  const preview = await mulaiPreview();
  [...preview.timers.values()][0]();
  assert.equal(preview.state[0], false);
  assert.match(preview.state[1], /terlalu lama/);
  preview.cleanup();
});

test("preview kosong tidak memasang timer kegagalan", async () => {
  const preview = await mulaiPreview("");
  assert.equal(preview.timers.size, 0);
  assert.deepEqual(preview.state, [false, "", 0]);
});
