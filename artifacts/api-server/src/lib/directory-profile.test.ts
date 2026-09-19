import assert from "node:assert/strict";
import test from "node:test";
import { summarizeProfileForDirectory } from "./directory-profile";

test("ringkasan direktori membuang blob data URL tanpa mengubah profil DB", () => {
  const profile = {
    namaSanggar: "Sanggar Produksi",
    logoDataUrl: "data:image/png;base64,AAAA",
    fotoGaleri: [
      {
        id: "foto-1",
        nama: "Pentas",
        dataUrl: "data:image/jpeg;base64,BBBB",
        url: "https://cdn.example/foto-1.jpg",
      },
    ],
    dokumen: [
      { id: "dok-1", dataUrl: "data:application/pdf;base64,CCCC" },
    ],
  };

  const summary = summarizeProfileForDirectory(profile);

  assert.equal(summary.namaSanggar, "Sanggar Produksi");
  assert.equal("logoDataUrl" in summary, false);
  assert.deepEqual(summary.fotoGaleri, [
    { id: "foto-1", nama: "Pentas", url: "https://cdn.example/foto-1.jpg" },
  ]);
  assert.deepEqual(summary.dokumen, [{ id: "dok-1" }]);
  assert.equal(profile.fotoGaleri[0]?.dataUrl.startsWith("data:"), true);
});
