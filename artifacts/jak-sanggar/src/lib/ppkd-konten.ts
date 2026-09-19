// Bank konten edukasi PPKD (Pokok Pikiran Kebudayaan Daerah) untuk verifikasi
// kemanusiaan di halaman masuk.
//
// SUMBER. Setiap fakta di berkas ini ditelusuri ke naskah resmi:
//   - UU No. 5 Tahun 2017 tentang Pemajuan Kebudayaan (LN 2017 No. 104)
//   - Perpres No. 114 Tahun 2022 tentang Strategi Kebudayaan
//   - Perpres No. 115 Tahun 2024 tentang RIPK 2025-2045
//   - PPKD Provinsi DKI Jakarta 2025-2029 (Lampiran Kepgub No. 1003 Tahun 2025)
//   - Renstra Dinas Kebudayaan Provinsi DKI Jakarta 2023-2026
//
// ATURAN PEMELIHARAAN. Jangan menambah butir yang faktanya tidak bisa dikutip
// dari naskah resmi. Nomor pasal sengaja jarang disebut: yang dipakai hanya
// yang naskahnya terbaca verbatim. Bila ragu, buang butirnya.

export type PantunPpkd = {
  /** Tepat empat baris, sudah dalam urutan yang benar. */
  lines: readonly string[];
  /** Ditampilkan sebagai pelajaran setelah pengguna berhasil menyusun. */
  teaches: string;
};

export type SoalPpkd = {
  question: string;
  /** Semua variasi yang diterima; dibandingkan setelah dinormalisasi. */
  acceptedAnswers: readonly string[];
  hint: string;
  explanation: string;
};

export const PANTUN_PPKD: readonly PantunPpkd[] = [
  {
    lines: [
      "Sore-sore kami duduk memandang langit yang berwarna merah,",
      "sekuntum mawar di taman mekar harum sekali wanginya,",
      "Dokumen Pokok Pikiran Kebudayaan Daerah memotret kondisi faktual daerah,",
      "Pokok pikiran memuat masalah budaya beserta usulan penyelesaiannya.",
    ],
    teaches:
      "PPKD adalah dokumen yang memuat kondisi faktual dan permasalahan yang dihadapi daerah dalam upaya Pemajuan Kebudayaan, beserta usulan penyelesaiannya.",
  },
  {
    lines: [
      "Anak menulis di papan tulis dengan rapi dan jelas,",
      "suasana kelas menjadi tenang tanpa gaduh dan keramaian,",
      "Undang-Undang Pemajuan Kebudayaan lahir tahun dua ribu tujuh belas,",
      "Penyusunan pokok pikiran daerah diamanatkan oleh undang-undang pemajuan kebudayaan.",
    ],
    teaches:
      "Dasar hukum PPKD adalah UU No. 5 Tahun 2017 tentang Pemajuan Kebudayaan, yang mewajibkan setiap daerah menyusun Pokok Pikiran Kebudayaan Daerah.",
  },
  {
    lines: [
      "Anak-anak bermain congklak di teras lubangnya berjejer lima,",
      "kalah menang disambut tawa tanpa ada yang kesal,",
      "Sepuluh Objek Pemajuan Kebudayaan tercantum jelas dalam Pasal Lima,",
      "Urutan objek dimulai tradisi lisan dan diakhiri olahraga tradisional.",
    ],
    teaches:
      "Pasal 5 UU No. 5 Tahun 2017 menetapkan 10 Objek Pemajuan Kebudayaan, berurutan: tradisi lisan, manuskrip, adat istiadat, ritus, pengetahuan tradisional, teknologi tradisional, seni, bahasa, permainan rakyat, dan olahraga tradisional.",
  },
  {
    lines: [
      "Perahu kecil berlayar pelan menyusuri pantai beriring bersama,",
      "nelayan menebar jala mencari rezeki di tengah lautan,",
      "Pemajuan kebudayaan ditempuh melalui empat langkah yang utama,",
      "Langkahnya berupa pelindungan, pengembangan, pemanfaatan, serta pembinaan kebudayaan.",
    ],
    teaches:
      "Pemajuan Kebudayaan ditempuh lewat empat langkah: Pelindungan, Pengembangan, Pemanfaatan, dan Pembinaan. Naskah undang-undangnya memakai ejaan 'Pelindungan'.",
  },
  {
    lines: [
      "Rapat di balai kampung dihadiri hampir semua anggota,",
      "warga membahas kerja bakti sambil menyusun daftar jadwal,",
      "Pokok pikiran provinsi disusun dari dokumen kabupaten dan kota,",
      "Dokumen provinsi kemudian menjadi bahan dasar Strategi Kebudayaan nasional.",
    ],
    teaches:
      "Alurnya berjenjang: PPKD kabupaten/kota menjadi bahan PPKD provinsi, lalu PPKD provinsi menjadi bahan dasar penyusunan Strategi Kebudayaan tingkat nasional.",
  },
  {
    lines: [
      "Air mengalir jernih keluar dari mulut sebuah sumur,",
      "ditimba warga setiap pagi untuk bekal sepanjang jalan,",
      "Jakarta menetapkan pokok pikiran kebudayaan lewat keputusan gubernur,",
      "Pokok pikiran Jakarta berlaku hingga tahun dua ribu dua puluh sembilan.",
    ],
    teaches:
      "PPKD Provinsi DKI Jakarta 2025-2029 ditetapkan sebagai lampiran Keputusan Gubernur No. 1003 Tahun 2025. Sebelumnya berlaku PPKD yang ditetapkan lewat Kepgub No. 1531 Tahun 2021.",
  },
  {
    lines: [
      "Pagi-pagi ibu menyapu halaman lalu menyiram deretan tanaman,",
      "adik membantu memetik cabai merah untuk pelengkap nasi,",
      "Isi pokok pikiran mendata sumber daya manusia dan lembaga kebudayaan,",
      "Pokok pikiran juga memuat sarana prasarana, masalah, dan rekomendasi.",
    ],
    teaches:
      "PPKD memotret keadaan tiap Objek Pemajuan Kebudayaan, sumber daya manusia dan lembaga kebudayaan, sarana prasarana, permasalahan, hingga rekomendasi tindak lanjut.",
  },
  {
    lines: [
      "Layang-layang terbang tinggi mengikuti angin ke segala arah,",
      "benangnya dipegang erat agar tidak putus di awan,",
      "Sanggar seni tercatat sebagai lembaga kebudayaan di dokumen daerah,",
      "Sanggar juga terhitung sebagai sarana dan prasarana kebudayaan.",
    ],
    teaches:
      "Dalam PPKD DKI Jakarta, sanggar dihitung dua kali: sebagai modal insan (lembaga kebudayaan) sekaligus sebagai sarana dan prasarana. Dokumen itu menyebut sanggar sebagai tempat keempat langkah pemajuan kebudayaan dijalankan.",
  },
];

export const SOAL_PPKD: readonly SoalPpkd[] = [
  {
    question:
      "Dokumen daerah yang memuat kondisi faktual, permasalahan pemajuan kebudayaan, beserta usulan penyelesaiannya disebut apa? (jawab dengan singkatannya)",
    acceptedAnswers: ["ppkd", "pokok pikiran kebudayaan daerah", "pokok pikiran kebudayaan"],
    hint: "Empat huruf, diawali huruf P.",
    explanation:
      "PPKD adalah Pokok Pikiran Kebudayaan Daerah, dokumen yang memuat kondisi faktual dan permasalahan daerah dalam upaya Pemajuan Kebudayaan beserta usulan penyelesaiannya.",
  },
  {
    question: "Undang-Undang Nomor 5 Tahun 2017 mengatur tentang ... Kebudayaan. Kata apa yang hilang?",
    acceptedAnswers: ["pemajuan", "pemajuan kebudayaan"],
    hint: "Bukan 'pelestarian', melainkan kata yang berarti upaya memajukan.",
    explanation:
      "UU No. 5 Tahun 2017 tentang Pemajuan Kebudayaan adalah payung hukum yang mewajibkan daerah menyusun PPKD.",
  },
  {
    question: "Berapa jumlah Objek Pemajuan Kebudayaan yang disebutkan dalam Pasal 5 UU No. 5 Tahun 2017?",
    acceptedAnswers: ["10", "sepuluh", "10 opk", "sepuluh opk"],
    hint: "Jumlahnya sama dengan banyaknya jari tangan.",
    explanation:
      "Pasal 5 menyebut 10 Objek Pemajuan Kebudayaan: tradisi lisan, manuskrip, adat istiadat, ritus, pengetahuan tradisional, teknologi tradisional, seni, bahasa, permainan rakyat, dan olahraga tradisional.",
  },
  {
    question: "Objek Pemajuan Kebudayaan yang tercantum paling awal (huruf a) dalam Pasal 5 adalah?",
    acceptedAnswers: ["tradisi lisan", "tradisilisan"],
    hint: "Bentuk tuturan yang diwariskan turun-temurun, misalnya pantun dan cerita rakyat.",
    explanation:
      "Urutan resmi Pasal 5 dibuka oleh tradisi lisan (huruf a), lalu manuskrip (huruf b), dan ditutup olahraga tradisional (huruf j).",
  },
  {
    question: "Objek Pemajuan Kebudayaan yang contohnya berupa serat, babad, hikayat, dan kitab disebut apa?",
    acceptedAnswers: ["manuskrip", "naskah kuno", "naskah"],
    hint: "Berupa naskah tulisan tangan bernilai budaya dan sejarah.",
    explanation:
      "Manuskrip adalah naskah beserta segala informasi di dalamnya yang memiliki nilai budaya dan sejarah, misalnya serat, babad, hikayat, dan kitab.",
  },
  {
    question:
      "Pemajuan Kebudayaan ditempuh lewat empat langkah: Pelindungan, Pengembangan, Pemanfaatan, dan ...?",
    acceptedAnswers: ["pembinaan", "pembinaan kebudayaan"],
    hint: "Berkaitan dengan pemberdayaan sumber daya manusia, lembaga, dan pranata kebudayaan.",
    explanation:
      "Pembinaan adalah upaya pemberdayaan sumber daya manusia, lembaga, dan pranata kebudayaan — langkah keempat dalam Pemajuan Kebudayaan.",
  },
  {
    question: "PPKD tingkat provinsi ditetapkan melalui Keputusan pejabat mana?",
    acceptedAnswers: ["gubernur", "keputusan gubernur", "kepgub"],
    hint: "Kepala daerah tingkat provinsi.",
    explanation:
      "PPKD provinsi ditetapkan dengan Keputusan Gubernur. Contohnya PPKD Provinsi DKI Jakarta 2025-2029 yang ditetapkan lewat Kepgub No. 1003 Tahun 2025.",
  },
  {
    question: "PPKD provinsi menjadi bahan dasar penyusunan dokumen kebudayaan tingkat nasional yang bernama apa?",
    acceptedAnswers: ["strategi kebudayaan", "strategi budaya"],
    hint: "Dua kata, dokumen nasional yang ditetapkan Presiden.",
    explanation:
      "PPKD provinsi menjadi bahan dasar penyusunan Strategi Kebudayaan, yang ditetapkan lewat Perpres No. 114 Tahun 2022.",
  },
  {
    question:
      "Dokumen nasional yang disusun berdasarkan Strategi Kebudayaan bernama Rencana ... Pemajuan Kebudayaan. Kata apa yang hilang?",
    acceptedAnswers: ["induk", "rencana induk", "ripk"],
    hint: "Satu kata, berarti 'utama' atau 'pokok'; singkatan dokumennya RIPK.",
    explanation:
      "Rencana Induk Pemajuan Kebudayaan (RIPK) disusun berdasarkan Strategi Kebudayaan. RIPK 2025-2045 ditetapkan lewat Perpres No. 115 Tahun 2024 untuk jangka 20 tahun.",
  },
  {
    question: "PPKD Provinsi DKI Jakarta yang berlaku saat ini disusun untuk periode 2025 sampai tahun berapa?",
    acceptedAnswers: ["2029", "tahun 2029", "2025 2029"],
    hint: "Berlaku lima tahun sejak 2025.",
    explanation:
      "PPKD Provinsi DKI Jakarta 2025-2029 ditetapkan sebagai lampiran Keputusan Gubernur No. 1003 Tahun 2025, menggantikan dokumen sebelumnya dari tahun 2021.",
  },
  {
    question:
      "Dalam dokumen PPKD, tempat berlatih dan berkarya seni yang menjadi lokus pemajuan kebudayaan disebut apa?",
    acceptedAnswers: ["sanggar", "sanggar seni", "sanggar budaya"],
    hint: "Kata yang juga jadi nama aplikasi ini.",
    explanation:
      "PPKD DKI Jakarta menempatkan sanggar sebagai tempat keempat langkah pemajuan kebudayaan dijalankan, sekaligus mendatanya sebagai lembaga kebudayaan dan sarana prasarana.",
  },
];
