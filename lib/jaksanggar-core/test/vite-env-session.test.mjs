import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("flag sesi per-tab dibaca langsung agar dapat diinjeksi Vite", () => {
  const apiSource = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
  const storeSource = readFileSync(
    new URL("../src/store.ts", import.meta.url),
    "utf8",
  );

  for (const [name, source] of [
    ["api", apiSource],
    ["store", storeSource],
  ]) {
    assert.match(
      source,
      /import\.meta\.env\?\.VITE_DEMO_SESSION_PER_TAB/,
      `${name} harus mengakses import.meta.env secara langsung`,
    );
    assert.doesNotMatch(
      source,
      /const\s+meta\s*=\s*import\.meta/,
      `${name} tidak boleh mengalias import.meta karena Vite tidak menyuntikkan env`,
    );
  }
});
