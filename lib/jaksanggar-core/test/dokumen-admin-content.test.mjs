import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const app = new URL("../../../artifacts/jak-sanggar/", import.meta.url);
const options = {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL("tsconfig.json", app)),
};
const { TEMPLATE_DOKUMEN, bentukById, ingatanField } = await tsImport(
  new URL("src/lib/dokumen-admin.ts", app).href,
  options,
);
const { rakitDokumenAdministrasi } = await tsImport(
  new URL("src/lib/dokumen-administrasi-render.ts", app).href,
  options,
);
const {
  fieldAdartStandar,
  validasiDataAdartStandar,
  prefillAdartStandar,
  renderDokumenAdartStandar,
} = await tsImport(new URL("src/lib/adart-standar.ts", app).href, options);

const sg = {
  namaSanggar: "Sanggar Uji",
  namaKetua: "Ketua Uji",
  alamat: "Jakarta Selatan",
  wilayah: { provinsi: "DKI Jakarta", kota: "Jakarta Selatan" },
  jenisPemilik: "organisasi",
  tahunBerdiri: 2015,
};
const template = (id) => TEMPLATE_DOKUMEN.find((item) => item.id === id);
const ctx = (v = {}, bentuk = "mandiri-non-bh") => ({
  sg,
  bentuk: bentukById(bentuk),
  v,
});

test("data satu kegiatan tidak mengisi acara atau penugasan berikutnya", () => {
  const ingatan = ingatanField([
    {
      updatedAt: 1,
      nilai: {
        hariTanggal: "14 September 2026",
        acara: "Rapat Lama",
        agenda: "Lama",
        petugas: "Orang Lama",
        tugas: "Tugas Lama",
        jumlahPeserta: "25",
        perihal: "Perihal Lama",
        tanggalPenetapan: "1 Januari 2026",
        namaInduk: "Organisasi Induk",
      },
    },
  ]);
  assert.deepEqual(ingatan, { namaInduk: "Organisasi Induk" });
});

test("tanggal pendirian tidak direka dari tahun profil", () => {
  const dokumen = template("pernyataan-pendirian");
  const tanggal = dokumen.fields.find(
    (field) => field.key === "tanggalPendirian",
  );
  assert.equal(tanggal.isiAwal?.(sg) ?? "", "");
  assert.doesNotMatch(dokumen.deskripsi, /pengganti akta/i);
});

test("penomoran diktum keputusan berurutan pada isi lengkap maupun tanpa lingkup unit", () => {
  const pengurus = template("sk-pengurus").render(
    ctx({ susunanPengurus: "Ketua Uji" }),
  );
  assert.deepEqual(
    [...pengurus.matchAll(/Diktum (\w+):/g)].map((match) => match[1]),
    ["Kesatu", "Kedua"],
  );
  for (const [tugasUnit, expected] of [
    ["", ["Kesatu", "Kedua"]],
    ["Latihan", ["Kesatu", "Kedua", "Ketiga"]],
  ]) {
    const html = template("penetapan-unit").render(
      ctx({ tugasUnit }, "unit-bh"),
    );
    assert.deepEqual(
      [...html.matchAll(/Diktum (\w+):/g)].map((match) => match[1]),
      expected,
    );
  }
});

test("identitas judul AD/ART diperlakukan sebagai teks dan fallback ayat tidak menggandakan nomor", () => {
  const html = template("ad-art").render({
    ...ctx(),
    sg: { ...sg, namaSanggar: "Sanggar <img src=x>" },
  });
  assert.doesNotMatch(html, /<img\b/i);
  assert.match(html, /&lt;IMG SRC=X&gt;/);
  assert.doesNotMatch(
    html,
    /\(2\) Misi:<\/div>\s*<div[^>]*>\s*<span[^>]*>\(1\)/,
  );
});

test("tanggal penetapan identik pada badan keputusan dan tanda tangan", () => {
  const html = rakitDokumenAdministrasi(
    template("sk-pengurus"),
    ctx({ tanggalPenetapan: "1 Februari 2024" }),
  );
  assert.equal((html.match(/1 Februari 2024/g) ?? []).length, 2);
});

test("penetapan induk memakai kop dan penandatangan induk tanpa cap atau NIP sanggar", () => {
  const data = ctx(
    {
      namaInduk: "Yayasan Induk Uji",
      alamatInduk: "Bandung, Jawa Barat",
      pimpinanInduk: "Pimpinan Uji",
      jabatanPimpinanInduk: "Ketua Yayasan",
    },
    "unit-bh",
  );
  data.sg = { ...sg, nip: "123456789012345678" };
  const html = rakitDokumenAdministrasi(template("penetapan-unit"), data, {
    stempel: { dataUrl: "data:image/png;base64,c3RlbXBlbA==" },
  });
  assert.ok(html.indexOf("Yayasan Induk Uji") < html.indexOf("Sanggar Uji"));
  assert.match(html, /Pimpinan Uji/);
  assert.match(html, /Jawa Barat/);
  assert.doesNotMatch(html, /123456789012345678|c3RlbXBlbA==/);
  assert.notEqual(
    template("penetapan-unit").ttdOverride(ctx({}, "unit-bh")),
    undefined,
  );
});

const paket = JSON.parse(
  await readFile(
    new URL("public/dokumen-paket/katalog/mandiri-non-bh.json", app),
    "utf8",
  ),
);
const sumber = {
  dokumen: {
    ad: paket.dokumen.find((item) => item.id === "04_AD"),
    art: paket.dokumen.find((item) => item.id === "05_ART"),
  },
};
const lengkap = {
  NAMA_SANGGAR: sg.namaSanggar,
  NAMA_KETUA: sg.namaKetua,
  NAMA_SEKRETARIS: "Sekretaris Uji",
  ALAMAT_LENGKAP_SANGGAR: sg.alamat,
  KOTA: "Jakarta",
  TANGGAL_MUSYAWARAH: "17 Agustus 2015",
  HARI_KEBERATAN: "7",
  HARI_UNDANGAN: "7",
  HARI_MUSYAWARAH_KEDUA: "7",
  HARI_LPJ_UANG_MUKA: "7",
  PERSEN_PELAKU: "40",
  PERSEN_TIM_KREATIF: "20%",
  PERSEN_PRODUKSI: "10",
  PERSEN_KAS_OPERASIONAL: "10",
  PERSEN_PENGEMBANGAN: "10",
  PERSEN_CADANGAN: "10",
};

test("AD/ART memerlukan seluruh ketentuan ART, bukan hanya enam identitas", () => {
  assert.equal(fieldAdartStandar(sumber).length, 16);
  assert.equal(prefillAdartStandar(sg).TANGGAL_MUSYAWARAH, "");
  const identitas = {
    ...prefillAdartStandar(sg),
    NAMA_SEKRETARIS: "Sekretaris",
    TANGGAL_MUSYAWARAH: "17 Agustus 2015",
  };
  const hasil = validasiDataAdartStandar(identitas, sumber);
  assert.equal(hasil.lengkap, false);
  assert.equal(hasil.fieldKosong.length, 10);
  assert.equal(validasiDataAdartStandar(lengkap, sumber).lengkap, true);
  assert.equal(validasiDataAdartStandar(lengkap).lengkap, true);
  const dinamis = {
    dokumen: {
      ...sumber.dokumen,
      art: {
        ...sumber.dokumen.art,
        html: sumber.dokumen.art.html + "{{KETENTUAN_TAMBAHAN}}",
      },
    },
  };
  assert.equal(
    validasiDataAdartStandar(lengkap, dinamis).fieldKosong[0].key,
    "KETENTUAN_TAMBAHAN",
  );
});

test("batas hari harus bulat dan pembagian penghasilan harus berjumlah 100%", () => {
  for (const ganti of [
    { HARI_UNDANGAN: "2,5" },
    { PERSEN_PELAKU: "50" },
    { PERSEN_PELAKU: "-40" },
    { PERSEN_PELAKU: "140" },
  ]) {
    assert.equal(
      validasiDataAdartStandar({ ...lengkap, ...ganti }, sumber).lengkap,
      false,
    );
  }
});

test("ART lengkap tercetak tanpa titik isian dan persentase mempunyai satu tanda persen", () => {
  const html = renderDokumenAdartStandar(sumber.dokumen.art, lengkap);
  assert.doesNotMatch(html, /\{\{|………………………|%%/);
  assert.match(html, /40%/);
  assert.match(html, /20%/);
});
