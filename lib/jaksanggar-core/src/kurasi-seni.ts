import type {
  Indikator,
  KurasiPersyaratanBuktiDukung,
  PatokanNilaiKurasi,
  Variabel,
} from "./types";

export const VERSI_INDIKATOR_SENI_PERTUNJUKAN =
  "indikator-seni-pertunjukan-2026-08-23-v1";

export const SUMBER_INDIKATOR_SENI_PERTUNJUKAN =
  "Instrumen_Penilaian_Seni_Pertunjukan_70_Persen.xlsx";

export const CATATAN_BOBOT_SENI_PERTUNJUKAN =
  "Bobot sumber Seni Pertunjukan berjumlah 70% dan dinormalisasi secara internal menjadi 100% agar kontribusinya terhadap Nilai Akhir tetap tepat 70%. Patokan setiap bukti dapat diubah oleh Kurator.";

const PATOKAN_NILAI_BAWAAN: PatokanNilaiKurasi[] = [
  {
    id: "patokan-tidak-ada",
    nilai: 0,
    nama: "Tidak ada",
    persentaseBobot: 0,
  },
  {
    id: "patokan-tidak-sesuai",
    nilai: 5,
    nama: "Tidak sesuai",
    persentaseBobot: 50,
  },
  {
    id: "patokan-sesuai",
    nilai: 10,
    nama: "Sesuai",
    persentaseBobot: 100,
  },
];

interface DefinisiVariabelSeni {
  id: string;
  nama: string;
  bukti: string;
}

function buatPersyaratan(
  variabelId: string,
  nama: string,
): KurasiPersyaratanBuktiDukung {
  return {
    id: `${variabelId}-persyaratan-1`,
    nama,
    patokanNilai: PATOKAN_NILAI_BAWAAN.map((patokan) => ({ ...patokan })),
  };
}

function buatVariabel(definisi: DefinisiVariabelSeni, bobot: number): Variabel {
  return {
    id: definisi.id,
    nama: definisi.nama,
    bobot,
    bobotSumber: 5,
    persyaratanBuktiDukung: [buatPersyaratan(definisi.id, definisi.bukti)],
  };
}

const PILAR_IDE: DefinisiVariabelSeni[] = [
  {
    id: "seni-p1-01",
    nama: "Kejelasan tema dan konsep karya",
    bukti:
      "Sinopsis atau deskripsi karya yang menjelaskan tema dan konsep penciptaan",
  },
  {
    id: "seni-p1-02",
    nama: "Kedalaman pengolahan nilai budaya",
    bukti:
      "Penjelasan nilai, tradisi, sejarah, atau unsur budaya yang diangkat",
  },
  {
    id: "seni-p1-03",
    nama: "Orisinalitas gagasan",
    bukti:
      "Konsep penciptaan dan penjelasan mengenai kebaruan atau ciri khas karya",
  },
  {
    id: "seni-p1-04",
    nama: "Kesesuaian konsep dengan bentuk penyajian",
    bukti:
      "Kesesuaian antara konsep tertulis dengan video atau penampilan langsung",
  },
];

const PILAR_KREATIVITAS: DefinisiVariabelSeni[] = [
  {
    id: "seni-p2-01",
    nama: "Inovasi koreografi",
    bukti:
      "Video atau penampilan langsung yang memperlihatkan kebaruan pengembangan koreografi",
  },
  {
    id: "seni-p2-02",
    nama: "Eksplorasi gerak",
    bukti: "Susunan, variasi, dan pengembangan ragam gerak dalam karya",
  },
  {
    id: "seni-p2-03",
    nama: "Komposisi",
    bukti: "Pola lantai, penggunaan ruang, dinamika, fokus, dan susunan penari",
  },
  {
    id: "seni-p2-04",
    nama: "Garapan musik",
    bukti:
      "Rekaman atau iringan musik serta kesesuaiannya dengan konsep dan gerak tari",
  },
  {
    id: "seni-p2-05",
    nama: "Kostum, properti, dan tata artistik",
    bukti:
      "Kostum, properti, dokumentasi, dan penataan artistik yang mendukung pertunjukan",
  },
];

const PILAR_TEKNIK: DefinisiVariabelSeni[] = [
  {
    id: "seni-p3-01",
    nama: "Penguasaan teknik gerak",
    bukti:
      "Penampilan langsung atau rekaman yang menunjukkan ketepatan teknik gerak",
  },
  {
    id: "seni-p3-02",
    nama: "Kualitas penari",
    bukti:
      "Ketepatan, keluwesan, kekuatan, keseimbangan, dan konsistensi gerak penari",
  },
  {
    id: "seni-p3-03",
    nama: "Kerja sama kelompok",
    bukti: "Kekompakan, keseragaman, koordinasi, dan interaksi antarpemain",
  },
  {
    id: "seni-p3-04",
    nama: "Musikalitas",
    bukti: "Ketepatan gerak terhadap tempo, ritme, dinamika, dan iringan musik",
  },
  {
    id: "seni-p3-05",
    nama: "Ekspresi dan penghayatan",
    bukti:
      "Ekspresi, karakter, penjiwaan, dan kemampuan menyampaikan makna karya",
  },
];

export function createDefaultSeniPertunjukanIndikator(): Indikator {
  return {
    id: "indikator-seni-pertunjukan",
    nama: "Seni Pertunjukan",
    bobot: 70,
    tipe: "seni",
    versi: VERSI_INDIKATOR_SENI_PERTUNJUKAN,
    sumber: SUMBER_INDIKATOR_SENI_PERTUNJUKAN,
    catatanBobot: CATATAN_BOBOT_SENI_PERTUNJUKAN,
    pilar: [
      {
        id: "seni-pilar-1",
        nama: "Ide, Gagasan, dan Identitas Budaya",
        bobot: 28.571429,
        bobotSumber: 20,
        variabel: PILAR_IDE.map((definisi) => buatVariabel(definisi, 25)),
      },
      {
        id: "seni-pilar-2",
        nama: "Kreativitas, Koreografi, dan Keutuhan Estetika",
        bobot: 35.714286,
        bobotSumber: 25,
        variabel: PILAR_KREATIVITAS.map((definisi) =>
          buatVariabel(definisi, 20),
        ),
      },
      {
        id: "seni-pilar-3",
        nama: "Teknik dan Kualitas Penyajian Pertunjukan",
        bobot: 35.714285,
        bobotSumber: 25,
        variabel: PILAR_TEKNIK.map((definisi) => buatVariabel(definisi, 20)),
      },
    ],
  };
}

const PLACEHOLDER_SENI_LAMA = [
  {
    nama: "Penguasaan Teknik",
    bobot: 40,
    variabel: [
      { nama: "Teknik & Ketepatan Gerak", bobot: 50 },
      { nama: "Sinkronisasi & Kekompakan", bobot: 50 },
    ],
  },
  {
    nama: "Kualitas Artistik",
    bobot: 35,
    variabel: [
      { nama: "Penghayatan & Ekspresi", bobot: 50 },
      { nama: "Originalitas & Kekayaan Budaya", bobot: 50 },
    ],
  },
  {
    nama: "Penyajian",
    bobot: 25,
    variabel: [
      { nama: "Kontrol Tenaga & Tempo", bobot: 50 },
      { nama: "Tata Penyajian & Kostum", bobot: 50 },
    ],
  },
] as const;

/** Hanya mengenali placeholder enam variabel bawaan lama, bukan matriks kustom. */
export function perluPembaruanIndikatorSeniPertunjukan(
  indikator: Indikator,
): boolean {
  if (
    indikator.versi ||
    indikator.sumber ||
    indikator.catatanBobot ||
    indikator.tipe !== "seni" ||
    indikator.nama !== "Seni Pertunjukan" ||
    indikator.bobot !== 70 ||
    indikator.pilar.length !== PLACEHOLDER_SENI_LAMA.length
  ) {
    return false;
  }

  return PLACEHOLDER_SENI_LAMA.every((pilarLama, pilarIndex) => {
    const pilar = indikator.pilar[pilarIndex];
    if (
      pilar.nama !== pilarLama.nama ||
      pilar.bobot !== pilarLama.bobot ||
      pilar.bobotSumber !== undefined ||
      pilar.variabel.length !== pilarLama.variabel.length
    ) {
      return false;
    }

    return pilarLama.variabel.every((variabelLama, variabelIndex) => {
      const variabel = pilar.variabel[variabelIndex];
      return (
        variabel.nama === variabelLama.nama &&
        variabel.bobot === variabelLama.bobot &&
        variabel.bobotSumber === undefined &&
        (variabel.persyaratanBuktiDukung?.length ?? 0) === 0 &&
        !variabel.persyaratanDataDukung &&
        (variabel.patokanNilai?.length ?? 0) === 0 &&
        variabel.halamanSumber === undefined &&
        variabel.contoh === undefined
      );
    });
  });
}
