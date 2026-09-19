// Follow the establishment and management workflow. Sorting only returns new
// arrays; the catalog records and original document files remain unchanged.
const workflow = [
  [
    "berita-acara-pembentukan-organisasi-induk",
    "berita-acara-pembentukan-sanggar",
  ],
  ["berita-acara-forum-penetapan"],
  [
    "keputusan-pembentukan-sanggar",
    "keputusan-pembentukan-dan-penetapan-sanggar",
  ],
  ["anggaran-dasar-organisasi-induk", "anggaran-dasar-sanggar"],
  ["anggaran-rumah-tangga-organisasi-induk", "anggaran-rumah-tangga-sanggar"],
  ["pedoman-dasar"],
  ["pedoman-pelaksanaan"],
  [
    "surat-pernyataan-status-dan-kewenangan",
    "surat-pernyataan-kedudukan-dan-kewenangan",
  ],
  [
    "data-induk-sanggar",
    "formulir-data-badan-dan-operasional-sanggar",
    "formulir-data-induk-dan-unit-sanggar",
  ],
  ["keputusan-pengelola-masa-bakti"],
  ["keputusan-penugasan-pelatih", "keputusan-pelatih-dan-lampiran"],
  ["keputusan-atribut-sanggar", "keputusan-atribut-dan-identitas"],
  [
    "keputusan-keuangan-dan-komponen-biaya",
    "keputusan-keuangan-dan-hasil-kegiatan",
  ],
  ["buku-administrasi-operasional"],
  ["perjanjian-kerja-sama-kegiatan-seni"],
  ["laporan-pertanggungjawaban-kegiatan"],
  ["berita-acara-serah-terima-pengelolaan"],
];
const rank = new Map(
  workflow.flatMap((ids, index) => ids.map((id) => [id, index])),
);

export function orderNativeDocuments(documents) {
  return documents
    .map((document, index) => ({ document, index }))
    .sort(
      (a, b) =>
        (rank.get(a.document.id) ?? workflow.length) -
          (rank.get(b.document.id) ?? workflow.length) || a.index - b.index,
    )
    .map((entry) => entry.document);
}

export function orderNativeCatalog(catalog) {
  return {
    ...catalog,
    groups: catalog.groups.map((group) => ({
      ...group,
      documents: orderNativeDocuments(group.documents),
    })),
  };
}
