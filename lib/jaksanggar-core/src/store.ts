import type {
  AnyUser,
  KuratorUser,
  AdminUser,
  SanggarUser,
  PelatihUser,
  SenimanUser,
  JuriUser,
  PengrajinUser,
  MitraPengrajinUser,
  SewaUser,
  News,
  Banner,
  SliderImage,
  Latihan,
  Iuran,
  PengajuanHonor,
  DistribusiHonor,
  TransaksiManual,
  KasEntry,
  KurasiMatrix,
  PenugasanJuri,
  KurasiSubmission,
  Sertifikat,
  ActivityLog,
  JamPembinaan,
  AbsensiPembinaan,
  PendaftaranPembinaan,
  AbsensiLatihan,
  AppearanceSettings,
  Role,
  Aset,
  Sarpras,
  Kerjasama,
  ChatMessage,
  Negosiasi,
  Invoice,
  Payment,
  Contract,
  Bast,
  Rating,
  InfoBudaya,
  PemesananSewa,
  KerjasamaMitraPengrajin,
  PesananProdukPengrajin,
  DokumenArsip,
  DokumenPengrajin,
} from "./types";
import { normalizeLang } from "./types";
import {
  createDefaultManajemenIndikator,
  createDefaultSeniPertunjukanIndikator,
  migrateMatrix,
} from "./kurasi";
import { hitungRingkasanPajakTransaksi } from "./kebijakan-transaksi";
import {
  settingsApi,
  usersApi,
  membersApi,
  authApi,
  dokumenArsipApi,
  kurasiApi,
  activityAuditApi,
  ApiError,
  type ApiAuthUser,
  type ApiDokumenArsip,
} from "./api";

const KEY = "jaksanggar_v1";
let storeDemoMode = false;

/**
 * Menentukan tujuan penulisan data untuk satu bundle aplikasi.
 * Demo menyimpan seluruh perubahan di browser, sedangkan mode utama tetap
 * melakukan write-through ke API/server.
 */
export function setStoreDemoMode(demoMode: boolean) {
  storeDemoMode = demoMode;
  if (!demoMode || !cache) return;
  const before = JSON.stringify(cache);
  ensureLocalDemoAccounts(cache);
  applyDemoTransactionReset(cache);
  const after = JSON.stringify(cache);
  if (before === after) return;
  lastSerialized = after;
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, after);
  notify();
}

export function isStoreDemoMode() {
  return storeDemoMode;
}

export const INFO_BUDAYA_TOMBSTONES_KEY =
  "jaksanggar_info_budaya_tombstones_v1";
const LEGACY_DEMO_INFO_BUDAYA_IDS = new Set([
  "demo-info-tari-topeng-betawi-v1",
  "demo-info-gambang-kromong-v1",
  "demo-info-lenong-v1",
  "demo-info-kerak-telor-v1",
  "demo-info-palang-pintu-v1",
]);
const LEGACY_DEMO_NEWS_IDS = new Set([
  "seed-news-pembinaan-2026",
  "seed-news-festival-betawi-2026",
]);
const LEGACY_DEMO_SLIDER_URLS = new Set([
  "https://images.unsplash.com/photo-1583294131-9c11d4d4b4e3?w=1200",
  "https://images.unsplash.com/photo-1604881991720-f91add269bed?w=1200",
]);
const LEGACY_DEMO_BANNER_TEXT =
  "Periode kurasi sanggar 2026 akan dimulai 1 Mei 2026.";
export const API_PASSWORD_PLACEHOLDER = "***api***";
export const LOCAL_DEMO_USERNAMES = new Set([
  "admin1",
  "juri1",
  "betawi.merah",
  "kembang.setaman",
  "pelatih.iwan",
  "pelatih.nia",
  "ayu.tari",
  "budi.gambang",
  "citra.teater",
  "dewi.calon",
  "pengrajin.demo",
  "mitra.demo",
  "sewa.demo",
]);

for (const prefix of [
  "kurator",
  "admin",
  "sanggar",
  "pelatih",
  "seniman",
  "juri",
  "pengrajin",
  "mitra",
  "konsumen",
]) {
  for (let index = 2; index <= 10; index += 1) {
    LOCAL_DEMO_USERNAMES.add(`${prefix}.demo${String(index).padStart(2, "0")}`);
  }
}

export interface DBShape {
  users: AnyUser[];
  news: News[];
  banners: Banner[];
  slider: SliderImage[];
  latihan: Latihan[];
  iuran: Iuran[];
  pengajuanHonor: PengajuanHonor[];
  distribusi: DistribusiHonor[];
  transaksi: TransaksiManual[];
  kas: KasEntry[];
  kurasiMatrix: KurasiMatrix;
  penugasanJuri: PenugasanJuri[];
  kurasiSubmissions: KurasiSubmission[];
  sertifikat: Sertifikat[];
  activity: ActivityLog[];
  jamPembinaan: JamPembinaan;
  absensiPembinaan: AbsensiPembinaan[];
  absensiLatihan: AbsensiLatihan[];
  pendaftaranPembinaan: PendaftaranPembinaan[];
  appearance: AppearanceSettings;
  exportPassword: string;
  honorPerSesiDefault: number;
  // Kerjasama Sanggar
  aset: Aset[];
  sarpras: Sarpras[];
  kerjasama: Kerjasama[];
  chatMessages: ChatMessage[];
  negosiasi: Negosiasi[];
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
  bast: Bast[];
  ratings: Rating[];
  // Pemesanan oleh akun "sewa" terhadap katalog sanggar (terpisah dari
  // kerjasama antar-sanggar di atas).
  pemesananSewa: PemesananSewa[];
  // Pengadaan produk antara Mitra dan Pengrajin, termasuk kontrak/BAST.
  kerjasamaMitraPengrajin: KerjasamaMitraPengrajin[];
  pesananProdukPengrajin: PesananProdukPengrajin[];
  // Informasi Kebudayaan (replaces "Berita Sanggar Aktif" on Sanggar dashboard)
  infoBudaya: InfoBudaya[];
  // Arsip dokumen administrasi (Tools Dokumen Sanggar) — lokal-dulu.
  dokumenArsip: DokumenArsip[];
  // Isian formulir Paket Dokumen Resmi (Tools Dokumen Sanggar) — lokal-dulu.
  // Kunci: `${sanggarId}:${paketId}` → token → nilai. Isian dibagi bersama
  // seluruh dokumen dalam satu paket (token yang sama terisi sekali).
  paketIsian: Record<string, Record<string, string>>;
}

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function demoMitraApplicationDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function demoMitraNibDate(): string {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - 3);
  return date.toISOString().slice(0, 10);
}

function demoMitraVerificationDocuments(suffix: string): DokumenPengrajin[] {
  return (
    [
      "NIB",
      "Surat Domisili 5 Tahun RT/RW",
      "Surat Domisili Kelurahan JAKEVO/PTSP",
    ] as const
  ).map((jenis, index) => ({
    id: `dok-verifikasi-mitra-${suffix}-${index + 1}`,
    jenis,
    nama: `${jenis} - DEMO.pdf`,
    dataUrl: `data:application/pdf;charset=utf-8,${encodeURIComponent(`DOKUMEN DEMO ${jenis} - BUKAN DOKUMEN ASLI`)}`,
    contentType: "application/pdf",
    size: 1024,
    uploadedAt: Date.now(),
  }));
}

function seed(): DBShape {
  const now = Date.now();
  const kurator: KuratorUser = {
    id: uid(),
    role: "kurator",
    username: "demo.kurator",
    password: "DEMO_DISABLED",
    createdAt: now,
  };
  const admin: AdminUser = {
    id: uid(),
    role: "admin",
    username: "admin1",
    password: "admin123",
    nama: "Sari Admin",
    createdAt: now,
    permissions: {
      kelolaBerita: true,
      kelolaBanner: true,
      kelolaSlider: true,
      kelolaJamPembinaan: false,
      kelolaInfoBudaya: true,
    },
  };
  const juri: JuriUser = {
    id: uid(),
    role: "juri",
    username: "juri1",
    password: "juri123",
    nama: "Bpk. Hidayat, M.Sn.",
    keahlian: "Tari Tradisional",
    createdAt: now,
  };
  const sanggar1: SanggarUser = {
    id: uid(),
    role: "sanggar",
    username: "betawi.merah",
    password: "sanggar123",
    email: "betawi@example.com",
    noHp: "081234567890",
    namaSanggar: "Sanggar Betawi Merah",
    namaKetua: "H. Mahmud Saliman",
    legalitas: "Yayasan",
    namaBadanHukum: "Yayasan Budaya Betawi Merah",
    jenisKesenian: ["Tari", "Musik"],
    alamat: "Jl. Condet Raya No. 12, Jakarta Timur",
    lat: -6.2615,
    lng: 106.8645,
    rekening: {
      bank: "DKI",
      nomor: "10300012345",
      atasNama: "Yayasan Betawi Merah",
    },
    saldo: 0,
    editCount: 0,
    editPeriodStart: now,
    createdAt: now,
  };
  const sanggar2: SanggarUser = {
    id: uid(),
    role: "sanggar",
    username: "kembang.setaman",
    password: "sanggar123",
    email: "setaman@example.com",
    noHp: "082134567891",
    namaSanggar: "Sanggar Kembang Setaman",
    namaKetua: "Ibu Rini Astuti",
    legalitas: "CV",
    namaBadanHukum: "CV Kembang Setaman",
    jenisKesenian: ["Tari", "Teater"],
    alamat: "Jl. Kebon Jeruk Raya No. 88, Jakarta Barat",
    lat: -6.1865,
    lng: 106.772,
    rekening: {
      bank: "BCA",
      nomor: "8801234567",
      atasNama: "CV Kembang Setaman",
    },
    saldo: 0,
    editCount: 0,
    editPeriodStart: now,
    createdAt: now,
  };
  const pelatih1: PelatihUser = {
    id: uid(),
    role: "pelatih",
    username: "pelatih.iwan",
    password: "pelatih123",
    nama: "Iwan Setiawan",
    noHp: "081298765432",
    usia: 38,
    pendidikan: "S1 Seni Tari",
    jenisKesenian: "Tari",
    sanggarId: sanggar1.id,
    status: "aktif",
    rekening: {
      bank: "Mandiri",
      nomor: "1300012345",
      atasNama: "Iwan Setiawan",
    },
    honorPerSesi: 250_000,
    menerimaKelasPrivat: true,
    namaLayananPrivat: "Kelas Privat Tari Betawi bersama Iwan",
    hargaKelasPrivat: 300_000,
    createdAt: now,
  };
  const pelatih2: PelatihUser = {
    id: uid(),
    role: "pelatih",
    username: "pelatih.nia",
    password: "pelatih123",
    nama: "Nia Permata",
    noHp: "081298765433",
    usia: 32,
    pendidikan: "S1 Seni Musik",
    jenisKesenian: "Musik",
    sanggarId: sanggar1.id,
    status: "aktif",
    rekening: { bank: "BNI", nomor: "0012345678", atasNama: "Nia Permata" },
    honorPerSesi: 200_000,
    menerimaKelasPrivat: true,
    namaLayananPrivat: "Kelas Privat Musik Betawi bersama Nia",
    hargaKelasPrivat: 250_000,
    createdAt: now,
  };
  const seniman1: SenimanUser = {
    id: uid(),
    role: "seniman",
    username: "ayu.tari",
    password: "seniman123",
    nama: "Ayu Lestari",
    noHp: "081377889900",
    usia: 22,
    pendidikan: "SMA",
    profesi: "Mahasiswa",
    jenisKesenian: "Tari",
    sanggarId: sanggar1.id,
    status: "aktif",
    rekening: { bank: "BRI", nomor: "0023456789", atasNama: "Ayu Lestari" },
    createdAt: now,
  };
  const seniman2: SenimanUser = {
    id: uid(),
    role: "seniman",
    username: "budi.gambang",
    password: "seniman123",
    nama: "Budi Hartono",
    noHp: "081377889901",
    usia: 28,
    pendidikan: "S1",
    profesi: "Karyawan Swasta",
    jenisKesenian: "Musik",
    sanggarId: sanggar1.id,
    status: "aktif",
    rekening: { bank: "BCA", nomor: "5512348877", atasNama: "Budi Hartono" },
    createdAt: now,
  };
  const seniman3: SenimanUser = {
    id: uid(),
    role: "seniman",
    username: "citra.teater",
    password: "seniman123",
    nama: "Citra Wulandari",
    noHp: "081377889902",
    usia: 25,
    pendidikan: "S1 Sastra",
    profesi: "Penulis Lepas",
    jenisKesenian: "Teater",
    sanggarId: sanggar2.id,
    status: "aktif",
    rekening: { bank: "BSI", nomor: "7700123456", atasNama: "Citra Wulandari" },
    createdAt: now,
  };
  const pengrajinDemo: PengrajinUser = {
    id: uid(),
    role: "pengrajin",
    username: "pengrajin.demo",
    password: "pengrajin123",
    email: "pengrajin.demo@example.com",
    noHp: "081200004321",
    namaUsaha: "Rumah Kriya Betawi",
    namaPemilik: "Raka Saputra",
    bentukUsaha: "Perorangan",
    jenisKerajinan: "Ondel-ondel",
    produkUnggulan:
      "Miniatur Ondel-ondel, Batik Betawi, dan aksesori Kembang Kelapa",
    produk: [
      {
        id: "produk-demo-ondel",
        nama: "Miniatur Ondel-ondel Betawi",
        kategori: "Ondel-ondel",
        deskripsi:
          "Miniatur buatan tangan untuk cendera mata, dekorasi, dan paket acara.",
        harga: 175000,
        satuan: "buah",
        stok: 24,
        khasJakarta: true,
        statusPublish: true,
        tersediaSewaJasa: true,
        terbukaKerjasama: true,
        createdAt: now,
      },
      {
        id: "produk-demo-kembang-kelapa",
        nama: "Dekorasi Kembang Kelapa",
        kategori: "Aksesori",
        deskripsi:
          "Paket dekorasi khas Betawi untuk panggung, hajatan, dan kegiatan budaya.",
        harga: 850000,
        satuan: "acara",
        khasJakarta: true,
        statusPublish: true,
        tersediaSewaJasa: true,
        terbukaKerjasama: true,
        createdAt: now,
      },
    ],
    alamat: "Jl. Setu Babakan No. 8, Jakarta Selatan",
    wilayah: {
      provinsi: "DKI Jakarta",
      kota: "Jakarta Selatan",
      kecamatan: "Jagakarsa",
      kelurahan: "Srengseng Sawah",
      kodePos: "12640",
    },
    lat: -6.3416,
    lng: 106.8235,
    npwp: "1234567890123456",
    statusPkp: "pkp",
    pemotongPajak: false,
    nib: "9123456789012",
    rekening: { bank: "DKI", nomor: "7012345678", atasNama: "Raka Saputra" },
    dokumen: [],
    tokoDipublikasikan: true,
    menerimaSewaJasa: true,
    menerimaKerjasama: true,
    deskripsi:
      "Pengrajin kriya Betawi yang mengolah ikon budaya menjadi produk dekorasi dan cendera mata.",
    instagram: "rumahkriyabetawi",
    createdAt: now,
  };
  const sewaDemo: SewaUser = {
    id: uid(),
    role: "sewa",
    username: "sewa.demo",
    password: "sewa1234",
    email: "sewa.demo@example.com",
    noHp: "081200001234",
    nama: "EO Cahaya Jakarta",
    alamat: "Jl. Sudirman No. 21, Jakarta Pusat",
    jenisInstansi: "Daerah",
    createdAt: now,
  };
  const mitraDemo: MitraPengrajinUser = {
    id: uid(),
    role: "mitra_pengrajin",
    username: "mitra.demo",
    password: "mitra1234",
    email: "mitra.demo@example.com",
    noHp: "081299998877",
    namaUsaha: "Mitra Kriya Jakarta",
    namaPenanggungJawab: "Nadia Prameswari",
    bentukUsaha: "Badan Hukum",
    namaBadanUsaha: "PT Mitra Kriya Jakarta",
    alamat: "Jl. Kebon Sirih No. 18, Jakarta Pusat",
    memilikiTokoOffline: true,
    namaTokoOffline: "Toko Mitra Kriya Jakarta",
    alamatTokoOffline: "Jl. Kebon Sirih No. 18, Jakarta Pusat",
    wilayahTokoOffline: {
      provinsi: "DKI Jakarta",
      provinsiId: "31",
      kota: "Jakarta Pusat",
      kotaId: "3171",
      kecamatan: "Menteng",
      kecamatanId: "3171020",
      kelurahan: "Kebon Sirih",
      kelurahanId: "3171020004",
    },
    latTokoOffline: -6.1812,
    lngTokoOffline: 106.8286,
    statusVerifikasiTokoOffline: "terverifikasi",
    tanggalPermohonanMitra: demoMitraApplicationDate(),
    tanggalTerbitNib: demoMitraNibDate(),
    npwp: "9876543210123456",
    statusPkp: "pkp",
    pemotongPajak: true,
    nib: "8123456789012",
    rekening: {
      bank: "DKI",
      nomor: "7019988776",
      atasNama: "PT Mitra Kriya Jakarta",
    },
    dokumen: demoMitraVerificationDocuments("utama"),
    marketplace: [
      {
        id: "marketplace-demo-tokopedia",
        nama: "Tokopedia",
        namaToko: "Mitra Kriya Jakarta",
        url: "https://www.tokopedia.com/",
        aktif: true,
      },
    ],
    paketProduk: [
      {
        id: "paket-demo-kriya-betawi",
        nama: "Paket Kriya Betawi",
        deskripsi: "Paket gabungan cendera mata dan dekorasi khas Jakarta.",
        items: [
          {
            pengrajinId: pengrajinDemo.id,
            produkId: "produk-demo-ondel",
            namaPengrajin: pengrajinDemo.namaUsaha,
            namaProduk: "Miniatur Ondel-ondel Betawi",
            jumlah: 2,
            hargaDasar: 175000,
            satuan: "buah",
          },
        ],
        hargaJual: 425000,
        marketplaceIds: ["marketplace-demo-tokopedia"],
        aktif: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    deskripsi:
      "Mitra penjualan paket gabungan produk khas Jakarta melalui marketplace resmi milik mitra.",
    jabatanPenandatangan: "Direktur",
    createdAt: now,
  };

  const senimanPending: SenimanUser = {
    id: uid(),
    role: "seniman",
    username: "dewi.calon",
    password: "seniman123",
    nama: "Dewi Maharani",
    noHp: "081377889903",
    usia: 19,
    pendidikan: "SMA",
    jenisKesenian: "Tari",
    sanggarId: sanggar1.id,
    status: "pending",
    rekening: { bank: "DKI", nomor: "10322224444", atasNama: "Dewi Maharani" },
    createdAt: now,
  };

  // Konten global harus berasal dari server. Seed lokal pernah diunggah kembali
  // sesudah dihapus dan tampil sesaat sebelum bootstrap selesai.
  const news: News[] = [];
  const slider: SliderImage[] = [];
  const banners: Banner[] = [];
  const infoBudaya: InfoBudaya[] = [];

  const kasEntries: KasEntry[] = [
    {
      id: uid(),
      sanggarId: sanggar1.id,
      tanggal: now - 86400000 * 20,
      keterangan: "Honor Pentas HUT DKI",
      debit: 5_000_000,
      kredit: 0,
      saldo: 5_000_000,
      refType: "manual",
      refId: "",
    },
    {
      id: uid(),
      sanggarId: sanggar1.id,
      tanggal: now - 86400000 * 15,
      keterangan: "Iuran Anggota Mei",
      debit: 1_500_000,
      kredit: 0,
      saldo: 6_500_000,
      refType: "iuran",
      refId: "",
    },
    {
      id: uid(),
      sanggarId: sanggar1.id,
      tanggal: now - 86400000 * 10,
      keterangan: "Sewa Sanggar",
      debit: 0,
      kredit: 1_000_000,
      saldo: 5_500_000,
      refType: "manual",
      refId: "",
    },
    {
      id: uid(),
      sanggarId: sanggar1.id,
      tanggal: now - 86400000 * 7,
      keterangan: "Donasi Komunitas",
      debit: 4_000_000,
      kredit: 0,
      saldo: 9_500_000,
      refType: "manual",
      refId: "",
    },
    {
      id: uid(),
      sanggarId: sanggar1.id,
      tanggal: now - 86400000 * 3,
      keterangan: "Honor Pelatih April",
      debit: 0,
      kredit: 1_000_000,
      saldo: 8_500_000,
      refType: "honor",
      refId: "",
    },
  ];

  const iuran: Iuran[] = [
    {
      id: uid(),
      sanggarId: sanggar1.id,
      senimanId: seniman1.id,
      judul: "Iuran Bulanan Mei 2026",
      nominal: 75_000,
      status: "pending",
      buktiDataUrl: undefined,
      createdAt: now - 86400000,
    },
  ];

  const pengajuanHonor: PengajuanHonor[] = [
    {
      id: uid(),
      sanggarId: sanggar1.id,
      pelatihId: pelatih1.id,
      jumlahSesi: 8,
      honorPerSesi: 250_000,
      total: 2_000_000,
      status: "pending",
      createdAt: now - 86400000 * 2,
    },
  ];

  const matrix: KurasiMatrix = {
    updatedAt: now,
    predikat: [
      {
        id: uid(),
        nama: "MUDA",
        min: 0,
        warna: "hsl(8 65% 55%)",
        tingkat: "Tingkat Kecamatan",
      },
      {
        id: uid(),
        nama: "TERAMPIL",
        min: 60,
        warna: "hsl(42 80% 52%)",
        tingkat: "Tingkat Kota/Kabupaten Administrasi",
      },
      {
        id: uid(),
        nama: "MAHIR",
        min: 80,
        warna: "hsl(145 60% 45%)",
        tingkat: "Tingkat Provinsi",
      },
      {
        id: uid(),
        nama: "PROFESIONAL",
        min: 95,
        warna: "hsl(149 62% 34%)",
        tingkat: "Tingkat Nasional & Internasional",
      },
    ],
    indikator: [
      createDefaultManajemenIndikator(),
      createDefaultSeniPertunjukanIndikator(),
    ],
  };

  const penugasanJuri: PenugasanJuri[] = [
    {
      id: uid(),
      juriId: juri.id,
      sanggarId: sanggar1.id,
      periode: "Kurasi 2026 Tahap I",
      createdAt: now,
    },
  ];

  // Kerjasama seed
  const aset: Aset[] = [
    {
      id: uid(),
      sanggarId: sanggar1.id,
      kategori: "alat_musik",
      nama: "Gambang Kromong",
      jenis: "Set lengkap 7 alat",
      jumlahTotal: 1,
      jumlahTersedia: 1,
      kondisi: "baik",
      hargaSewa: 1_500_000,
      satuanHarga: "per_event",
      statusPublish: true,
      createdAt: now,
    },
    {
      id: uid(),
      sanggarId: sanggar1.id,
      kategori: "kostum",
      nama: "Kostum Tari Topeng",
      jenis: "Pria & Wanita",
      jumlahTotal: 12,
      jumlahTersedia: 12,
      kondisi: "baik",
      hargaSewa: 75_000,
      satuanHarga: "per_hari",
      statusPublish: true,
      createdAt: now,
    },
    {
      id: uid(),
      sanggarId: sanggar2.id,
      kategori: "kostum",
      nama: "Kostum Lenong Klasik",
      jenis: "Set 8 pemain",
      jumlahTotal: 8,
      jumlahTersedia: 8,
      kondisi: "baik",
      hargaSewa: 90_000,
      satuanHarga: "per_hari",
      statusPublish: true,
      createdAt: now,
    },
  ];
  const sarpras: Sarpras[] = [
    {
      id: uid(),
      sanggarId: sanggar1.id,
      namaTempat: "Aula Betawi Merah",
      jenisTempat: "aula",
      kapasitas: 80,
      fasilitas: "AC, Sound, Cermin",
      alamat: "Jl. Condet Raya No. 12",
      hargaSewa: 350_000,
      satuanHarga: "per_jam",
      statusPublish: true,
      createdAt: now,
    },
    {
      id: uid(),
      sanggarId: sanggar2.id,
      namaTempat: "Studio Kembang Setaman",
      jenisTempat: "studio",
      kapasitas: 30,
      fasilitas: "Lantai parket, cermin, sound",
      alamat: "Jl. Kebon Jeruk Raya 88",
      hargaSewa: 200_000,
      satuanHarga: "per_jam",
      statusPublish: true,
      createdAt: now,
    },
  ];

  const demoImage = (label: string, color: string) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="46%" text-anchor="middle" fill="white" font-family="Arial" font-size="30">${label}</text><text x="50%" y="58%" text-anchor="middle" fill="white" font-family="Arial" font-size="18">DATA DEMO - TIDAK SAH</text></svg>`,
    )}`;
  const demoDocument = (label: string, index: number) => ({
    id: `doc-demo-${label.toLowerCase().replace(/\W+/g, "-")}-${index}`,
    jenis: label as "NPWP" | "NIB" | "Bukti Rekening" | "Akta / Legalitas",
    nama: `${label}-DATA-DEMO.pdf`,
    dataUrl: `data:application/pdf;charset=utf-8,${encodeURIComponent(
      `DATA DEMO - TIDAK SAH\n${label}\nAkun skenario ${index}`,
    )}`,
    contentType: "application/pdf",
    size: 128,
    uploadedAt: now,
  });
  const scenarioName = [
    "",
    "",
    "Data Lengkap",
    "Lengkap Non-PKP",
    "Data Minimum",
    "Profil 50 Persen",
    "Identitas Belum Lengkap",
    "Tanpa Dokumen",
    "Dokumen Lengkap",
    "Banyak Transaksi",
    "Data Sangat Minimum",
  ];
  const demoScenarioUsers: AnyUser[] = [];
  for (let index = 2; index <= 10; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const complete = index <= 3;
    const photo = demoImage(
      `Profil Demo ${suffix}`,
      index % 2 ? "#0a653c" : "#9a6b24",
    );
    const dokumen = complete
      ? [
          demoDocument("NPWP", index),
          demoDocument("NIB", index),
          demoDocument("Bukti Rekening", index),
          demoDocument("Akta / Legalitas", index),
        ]
      : [];
    const base = {
      id: `demo-${suffix}-${uid()}`,
      email: `demo${suffix}@example.invalid`,
      noHp: `08120000${suffix.padStart(4, "0")}`,
      createdAt: now - index * 86_400_000,
    };

    demoScenarioUsers.push(
      {
        ...base,
        role: "kurator",
        username: `kurator.demo${suffix}`,
        password: "kurator123",
      } as KuratorUser,
      {
        ...base,
        id: `admin-demo-${suffix}`,
        role: "admin",
        username: `admin.demo${suffix}`,
        password: "admin123",
        nama: `Admin Demo ${scenarioName[index]}`,
        permissions: {
          kelolaBerita: index !== 10,
          kelolaBanner: index <= 8,
          kelolaSlider: index <= 7,
          kelolaJamPembinaan: index <= 6,
          kelolaInfoBudaya: index <= 9,
        },
      } as AdminUser,
      {
        ...base,
        id: `sanggar-demo-${suffix}`,
        role: "sanggar",
        username: `sanggar.demo${suffix}`,
        password: "sanggar123",
        namaSanggar: `Sanggar Demo ${scenarioName[index]}`,
        namaKetua: `Ketua Sanggar Demo ${suffix}`,
        legalitas: index % 3 === 0 ? "Yayasan" : "Perorangan",
        jenisKesenian: [index % 2 ? "Tari" : "Musik"],
        alamat: `Jl. Budaya Jakarta No. ${index}`,
        lat: -6.2 - index / 10_000,
        lng: 106.8 + index / 10_000,
        rekening: {
          bank: "DKI",
          nomor: `70000000${suffix}`,
          atasNama: `Sanggar Demo ${suffix}`,
        },
        saldo: 0,
        editCount: 0,
        editPeriodStart: now,
        fotoProfileDataUrl: complete ? photo : undefined,
        logoDataUrl: complete
          ? demoImage(`Logo Sanggar ${suffix}`, "#7b1f28")
          : undefined,
        stempelDataUrl: complete
          ? demoImage(`Stempel Sanggar ${suffix}`, "#244d73")
          : undefined,
        deskripsi: complete
          ? "Profil Sanggar lengkap untuk pengujian demo."
          : "Data minimal demo.",
      } as SanggarUser,
      {
        ...base,
        id: `pelatih-demo-${suffix}`,
        role: "pelatih",
        username: `pelatih.demo${suffix}`,
        password: "pelatih123",
        nama: `Pelatih Demo ${scenarioName[index]}`,
        usia: 25 + index,
        pendidikan: index % 2 ? "S1" : "SMA/Setara",
        jenisKesenian: index % 2 ? "Tari" : "Musik",
        sanggarId: index === 4 ? undefined : sanggar1.id,
        status: "aktif",
        rekening: {
          bank: "BCA",
          nomor: `88000000${suffix}`,
          atasNama: `Pelatih Demo ${suffix}`,
        },
        honorPerSesi: 200_000 + index * 10_000,
        fotoProfileDataUrl: complete ? photo : undefined,
        bio: complete
          ? "Pelatih demo dengan portofolio dan dokumen lengkap."
          : undefined,
        menerimaKelasPrivat: index !== 10,
        namaLayananPrivat: `Kelas Privat Demo ${suffix}`,
        hargaKelasPrivat: 225_000 + index * 10_000,
      } as PelatihUser,
      {
        ...base,
        id: `seniman-demo-${suffix}`,
        role: "seniman",
        username: `seniman.demo${suffix}`,
        password: "seniman123",
        nama: `Seniman Demo ${scenarioName[index]}`,
        usia: 18 + index,
        pendidikan: index % 2 ? "SMA/Setara" : "S1",
        profesi: "Seniman",
        jenisKesenian: index % 2 ? "Tari" : "Teater",
        sanggarId: sanggar1.id,
        status: "aktif",
        rekening: {
          bank: "BRI",
          nomor: `33000000${suffix}`,
          atasNama: `Seniman Demo ${suffix}`,
        },
        fotoProfileDataUrl: complete ? photo : undefined,
      } as SenimanUser,
      {
        ...base,
        id: `juri-demo-${suffix}`,
        role: "juri",
        username: `juri.demo${suffix}`,
        password: "juri123",
        nama: `Juri Demo ${scenarioName[index]}`,
        keahlian: index % 2 ? "Tari Tradisional" : "Musik Tradisional",
        pendidikan: complete ? "S2 Seni" : "S1",
        fotoProfileDataUrl: complete ? photo : undefined,
      } as JuriUser,
      {
        ...base,
        id: `pengrajin-demo-${suffix}`,
        role: "pengrajin",
        username: `pengrajin.demo${suffix}`,
        password: "pengrajin123",
        namaUsaha: `Kriya Jakarta Demo ${scenarioName[index]}`,
        namaPemilik: `Pemilik Demo ${suffix}`,
        bentukUsaha:
          index % 3 === 0
            ? "Badan Hukum"
            : index % 3 === 1
              ? "Non Badan Hukum"
              : "Perorangan",
        jenisKerajinan: index % 2 ? "Batik Betawi" : "Ondel-ondel",
        produkUnggulan: "Produk khas Jakarta untuk pengujian.",
        produk: [
          {
            id: `produk-demo-${suffix}`,
            nama: `Produk Khas Jakarta Demo ${suffix}`,
            kategori: index % 2 ? "Batik Betawi" : "Ondel-ondel",
            deskripsi: "Produk contoh khas Jakarta dengan watermark demo.",
            harga: 100_000 + index * 25_000,
            satuan: "buah",
            stok: index === 10 ? 0 : 10 + index,
            fotoDataUrl: complete
              ? demoImage(`Produk Jakarta ${suffix}`, "#b04a35")
              : undefined,
            khasJakarta: true,
            statusPublish: index !== 10,
            tersediaSewaJasa: true,
            terbukaKerjasama: true,
            createdAt: now,
          },
        ],
        alamat: `Jl. Pengrajin Jakarta No. ${index}`,
        lat: -6.25 - index / 10_000,
        lng: 106.82 + index / 10_000,
        npwp: `00000000000000${suffix}`,
        statusPkp: index % 2 ? "pkp" : "non_pkp",
        pemotongPajak: index % 2 === 0,
        nib: `90000000000${suffix}`,
        rekening: {
          bank: "DKI",
          nomor: `71000000${suffix}`,
          atasNama: `Kriya Demo ${suffix}`,
        },
        dokumen,
        tokoDipublikasikan: index !== 10,
        menerimaSewaJasa: true,
        menerimaKerjasama: true,
        logoDataUrl: complete
          ? demoImage(`Logo Kriya ${suffix}`, "#41615c")
          : undefined,
        stempelDataUrl: complete
          ? demoImage(`Stempel Kriya ${suffix}`, "#244d73")
          : undefined,
      } as PengrajinUser,
      {
        ...base,
        id: `mitra-demo-${suffix}`,
        role: "mitra_pengrajin",
        username: `mitra.demo${suffix}`,
        password: "mitra1234",
        namaUsaha: `Mitra Jakarta Demo ${scenarioName[index]}`,
        namaPenanggungJawab: `Penanggung Jawab ${suffix}`,
        bentukUsaha: index % 2 ? "Badan Hukum" : "Perorangan",
        alamat: `Jl. Mitra Jakarta No. ${index}`,
        memilikiTokoOffline: true,
        namaTokoOffline: `Toko Mitra Demo ${suffix}`,
        alamatTokoOffline: `Jl. Mitra Jakarta No. ${index}`,
        wilayahTokoOffline: {
          provinsi: "DKI Jakarta",
          provinsiId: "31",
          kota: "Jakarta Selatan",
          kotaId: "3174",
          kecamatan: "Pasar Minggu",
          kecamatanId: "3174010",
          kelurahan: "Pejaten Timur",
          kelurahanId: "3174010005",
        },
        latTokoOffline: -6.27 - index / 10_000,
        lngTokoOffline: 106.84 + index / 10_000,
        statusVerifikasiTokoOffline: "terverifikasi",
        tanggalPermohonanMitra: demoMitraApplicationDate(),
        tanggalTerbitNib: demoMitraNibDate(),
        npwp: `10000000000000${suffix}`,
        statusPkp: index % 2 ? "pkp" : "non_pkp",
        pemotongPajak: index % 2 === 1,
        nib: `80000000000${suffix}`,
        rekening: {
          bank: "Mandiri",
          nomor: `13000000${suffix}`,
          atasNama: `Mitra Demo ${suffix}`,
        },
        dokumen: demoMitraVerificationDocuments(suffix),
        marketplace: complete
          ? [
              {
                id: `market-${suffix}`,
                nama: "Marketplace Demo",
                namaToko: `Mitra Demo ${suffix}`,
                url: "https://example.invalid/toko-demo",
                aktif: true,
              },
            ]
          : [],
        paketProduk: [],
        logoDataUrl: complete
          ? demoImage(`Logo Mitra ${suffix}`, "#76512f")
          : undefined,
        stempelDataUrl: complete
          ? demoImage(`Stempel Mitra ${suffix}`, "#244d73")
          : undefined,
        jabatanPenandatangan: "Penanggung Jawab",
      } as MitraPengrajinUser,
      {
        ...base,
        id: `konsumen-demo-${suffix}`,
        role: "sewa",
        username: `konsumen.demo${suffix}`,
        password: "sewa1234",
        nama: `Konsumen Demo ${scenarioName[index]}`,
        alamat: `Jl. Konsumen Jakarta No. ${index}`,
        jenisInstansi: index % 2 ? "Daerah" : "Pusat",
        fotoProfileDataUrl: complete ? photo : undefined,
      } as SewaUser,
    );
  }

  return {
    users: [
      kurator,
      admin,
      juri,
      sanggar1,
      sanggar2,
      pelatih1,
      pelatih2,
      seniman1,
      seniman2,
      seniman3,
      senimanPending,
      pengrajinDemo,
      mitraDemo,
      sewaDemo,
      ...demoScenarioUsers,
    ],
    news,
    banners,
    slider,
    latihan: [],
    iuran: [],
    pengajuanHonor: [],
    distribusi: [],
    transaksi: [],
    kas: [],
    kurasiMatrix: matrix,
    penugasanJuri,
    kurasiSubmissions: [],
    sertifikat: [],
    activity: [],
    jamPembinaan: {
      pagiMax: "08:00",
      siangStart: "13:00",
      siangEnd: "17:00",
      pulangStart: "17:00",
      pulangEnd: "21:00",
    },
    absensiPembinaan: [],
    absensiLatihan: [],
    pendaftaranPembinaan: [],
    appearance: {
      primaryHsl: "146 78% 34%",
      accentHsl: "10 100% 54%",
      dark: false,
      theme: "light",
      themePreset: "light",
      language: "btw",
      customTheme: {
        enabled: false,
        mode: "light",
        primaryHsl: "146 78% 34%",
        accentHsl: "10 100% 54%",
        bgOpacity: 0.22,
      },
      brand: {
        appName: "JAK SANGGAR NEXT",
        appTagline: "Kebudayaan akan bernyawa karena ketulusan",
        sidebarFooterLine1: "Kebudayaan akan bernyawa",
        sidebarFooterLine2: "karena ketulusan",
        iconKey: "Sparkles",
        loginEyebrow: "Konsorsium Sanggar Seni",
      },
      backdrop: { enabled: false, opacity: 0.18, blendMode: "soft-light" },
      tradisi: {
        enabled: true,
        position: "br",
        cooldownMs: 2200,
        autoHideMs: 4200,
        cardWidth: 280,
        showCloseButton: true,
        source: "default",
        custom: [],
        kategoriColors: {
          "Pantun Betawi": "#e3b864",
          Peribahasa: "#d4a64e",
          "Palang Pintu": "#c2784a",
          "Sahibul Hikayat": "#b89460",
          "Cerita Rakyat": "#d6342a",
          "Salam Betawi": "#caa86a",
          Rancag: "#daa44e",
          Lenong: "#e0552f",
        },
      },
    },
    exportPassword: "kurator123",
    honorPerSesiDefault: 250_000,
    aset,
    sarpras,
    kerjasama: [],
    chatMessages: [],
    negosiasi: [],
    invoices: [],
    payments: [],
    contracts: [],
    bast: [],
    ratings: [],
    pemesananSewa: [],
    kerjasamaMitraPengrajin: [],
    pesananProdukPengrajin: [],
    infoBudaya,
    dokumenArsip: [],
    paketIsian: {},
  };
}

const NON_KURATOR_DEMO_GROUPS = [
  {
    role: "sanggar",
    primary: "betawi.merah",
    prefix: "sanggar",
    password: "sanggar123",
  },
  {
    role: "admin",
    primary: "admin1",
    prefix: "admin",
    password: "admin123",
  },
  {
    role: "pelatih",
    primary: "pelatih.iwan",
    prefix: "pelatih",
    password: "pelatih123",
  },
  {
    role: "seniman",
    primary: "ayu.tari",
    prefix: "seniman",
    password: "seniman123",
  },
  {
    role: "juri",
    primary: "juri1",
    prefix: "juri",
    password: "juri123",
  },
  {
    role: "pengrajin",
    primary: "pengrajin.demo",
    prefix: "pengrajin",
    password: "pengrajin123",
  },
  {
    role: "mitra_pengrajin",
    primary: "mitra.demo",
    prefix: "mitra",
    password: "mitra1234",
  },
  {
    role: "sewa",
    primary: "sewa.demo",
    prefix: "konsumen",
    password: "sewa1234",
  },
] as const;

const DEMO_TRANSACTION_RESET_KEY =
  "jaksanggar_demo_transaction_reset_20260823_v1";

/**
 * Pastikan cache demo lama tetap memiliki 80 akun non-kurator yang dapat
 * login: delapan jenis akun, masing-masing satu akun utama dan sembilan
 * variasi kelengkapan data. Kurator sengaja tidak disentuh di sini.
 */
export function ensureLocalDemoAccounts(db: DBShape): void {
  const templates = seed();
  const templateByUsername = new Map(
    templates.users.map((user) => [user.username.toLowerCase(), user]),
  );

  for (const group of NON_KURATOR_DEMO_GROUPS) {
    const credentials = [
      { username: group.primary, password: group.password },
      ...Array.from({ length: 9 }, (_, offset) => ({
        username: `${group.prefix}.demo${String(offset + 2).padStart(2, "0")}`,
        password: group.password,
      })),
    ];

    for (const credential of credentials) {
      const usernameKey = credential.username.toLowerCase();
      let user = db.users.find(
        (candidate) => candidate.username.toLowerCase() === usernameKey,
      );
      if (!user) {
        const template = templateByUsername.get(usernameKey);
        if (!template) continue;
        const copy = structuredClone(template);
        if (db.users.some((candidate) => candidate.id === copy.id)) {
          copy.id = uid();
        }
        if (
          (copy.role === "pelatih" || copy.role === "seniman") &&
          copy.sanggarId
        ) {
          const templateOwner = templates.users.find(
            (candidate) => candidate.id === copy.sanggarId,
          );
          const currentOwner = templateOwner
            ? db.users.find(
                (candidate) =>
                  candidate.username.toLowerCase() ===
                  templateOwner.username.toLowerCase(),
              )
            : undefined;
          if (currentOwner?.role === "sanggar") {
            copy.sanggarId = currentOwner.id;
          }
        }
        db.users.push(copy);
        user = copy;
      }

      if (user.role !== group.role) continue;
      user.password = credential.password;
      if (user.role === "pelatih" || user.role === "seniman") {
        user.status = "aktif";
      }
    }
  }
}

/** Hapus transaksi milik akun demo tanpa menyentuh data akun non-demo. */
export function clearLocalDemoTransactions(db: DBShape): void {
  const demoUserIds = new Set(
    db.users
      .filter((user) => LOCAL_DEMO_USERNAMES.has(user.username.toLowerCase()))
      .map((user) => user.id),
  );
  const belongsToDemo = (id: string | undefined) =>
    Boolean(id && demoUserIds.has(id));

  db.iuran = db.iuran.filter(
    (item) => !belongsToDemo(item.sanggarId) && !belongsToDemo(item.senimanId),
  );
  db.pengajuanHonor = db.pengajuanHonor.filter(
    (item) => !belongsToDemo(item.sanggarId) && !belongsToDemo(item.pelatihId),
  );
  db.distribusi = db.distribusi.filter(
    (item) => !belongsToDemo(item.sanggarId) && !belongsToDemo(item.penerimaId),
  );
  db.transaksi = db.transaksi.filter((item) => !belongsToDemo(item.sanggarId));
  db.kas = db.kas.filter((item) => !belongsToDemo(item.sanggarId));

  const removedKerjasamaIds = new Set(
    db.kerjasama
      .filter(
        (item) =>
          belongsToDemo(item.sanggarPenyediaId) ||
          belongsToDemo(item.sanggarPeminjamId),
      )
      .map((item) => item.id),
  );
  const removedInvoiceIds = new Set(
    db.invoices
      .filter((item) => removedKerjasamaIds.has(item.kerjasamaId))
      .map((item) => item.id),
  );
  db.kerjasama = db.kerjasama.filter(
    (item) => !removedKerjasamaIds.has(item.id),
  );
  db.chatMessages = db.chatMessages.filter(
    (item) => !removedKerjasamaIds.has(item.kerjasamaId),
  );
  db.negosiasi = db.negosiasi.filter(
    (item) => !removedKerjasamaIds.has(item.kerjasamaId),
  );
  db.invoices = db.invoices.filter(
    (item) => !removedKerjasamaIds.has(item.kerjasamaId),
  );
  db.payments = db.payments.filter(
    (item) => !removedInvoiceIds.has(item.invoiceId),
  );
  db.contracts = db.contracts.filter(
    (item) => !removedKerjasamaIds.has(item.kerjasamaId),
  );
  db.bast = db.bast.filter(
    (item) => !removedKerjasamaIds.has(item.kerjasamaId),
  );
  db.ratings = db.ratings.filter(
    (item) => !removedKerjasamaIds.has(item.kerjasamaId),
  );
  db.pemesananSewa = db.pemesananSewa.filter(
    (item) =>
      !belongsToDemo(item.sewaId) &&
      !belongsToDemo(item.sanggarId) &&
      !belongsToDemo(item.sdmUserId),
  );
  db.kerjasamaMitraPengrajin = db.kerjasamaMitraPengrajin.filter(
    (item) => !belongsToDemo(item.pengrajinId) && !belongsToDemo(item.mitraId),
  );
  db.pesananProdukPengrajin = db.pesananProdukPengrajin.filter(
    (item) => !belongsToDemo(item.pengrajinId) && !belongsToDemo(item.mitraId),
  );

  for (const user of db.users) {
    if (
      user.role === "sanggar" &&
      LOCAL_DEMO_USERNAMES.has(user.username.toLowerCase())
    ) {
      user.saldo = 0;
    }
  }
}

function applyDemoTransactionReset(db: DBShape): void {
  if (typeof localStorage === "undefined") {
    clearLocalDemoTransactions(db);
    return;
  }
  if (localStorage.getItem(DEMO_TRANSACTION_RESET_KEY) === "done") return;
  clearLocalDemoTransactions(db);
  localStorage.setItem(DEMO_TRANSACTION_RESET_KEY, "done");
}

function demoAccountsEnabled(): boolean {
  const runtimeMeta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };
  return (
    storeDemoMode || runtimeMeta.env?.["VITE_SHOW_DEMO_ACCOUNTS"] === "true"
  );
}

export function normalizeInfoBudayaForStore(item: InfoBudaya): void {
  if (!item.publicationStatus) {
    item.publicationStatus = item.active ? "published" : "pending";
  }
  if (item.publicationStatus !== "published") item.active = false;

  if (!item.mediaKind) {
    const contentType = item.mediaContentType?.trim().toLowerCase();
    if (contentType?.startsWith("audio/")) item.mediaKind = "audio";
    else if (contentType?.startsWith("video/")) {
      item.mediaKind = contentType === "video/youtube" ? "youtube" : "video";
    } else if (contentType?.startsWith("image/")) item.mediaKind = "image";
    else if (/youtu(?:\.be|be\.com)/i.test(item.mediaUrl ?? "")) {
      item.mediaKind = "youtube";
    }
  }
}

export type InfoBudayaModerationStatus = "published" | "pending" | "rejected";

/** Terapkan transisi moderasi secara atomik agar status dan flag publik konsisten. */
export function applyInfoBudayaModeration(
  item: InfoBudaya,
  status: InfoBudayaModerationStatus,
  options: { note?: string; updatedAt?: number } = {},
): void {
  item.publicationStatus = status;
  item.active = status === "published";
  item.reviewNote = status === "rejected" ? options.note : undefined;
  item.updatedAt = options.updatedAt ?? Date.now();
}

export function isLegacyGlobalSeedRecord(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): boolean {
  if (collection === "infoBudaya") return LEGACY_DEMO_INFO_BUDAYA_IDS.has(id);
  if (collection === "news") return LEGACY_DEMO_NEWS_IDS.has(id);
  if (collection === "slider") {
    return (
      typeof data.imageUrl === "string" &&
      LEGACY_DEMO_SLIDER_URLS.has(data.imageUrl)
    );
  }
  if (collection === "banners") {
    return data.teks === LEGACY_DEMO_BANNER_TEXT;
  }
  return false;
}

/**
 * Pesanan yang dibatalkan tidak dipertahankan sebagai kartu transaksi aktif.
 * Riwayat pembatalannya tetap tersedia melalui activity log.
 */
export function hapusPesananDibatalkan(db: DBShape): {
  kerjasama: number;
  pemesananSewa: number;
  pesananProdukPengrajin: number;
} {
  const sebelum = {
    kerjasama: db.kerjasama?.length ?? 0,
    pemesananSewa: db.pemesananSewa?.length ?? 0,
    pesananProdukPengrajin: db.pesananProdukPengrajin?.length ?? 0,
  };

  db.kerjasama = (db.kerjasama ?? []).filter(
    (pesanan) => pesanan.status !== "batal",
  );
  db.pemesananSewa = (db.pemesananSewa ?? []).filter(
    (pesanan) => pesanan.status !== "batal",
  );
  db.pesananProdukPengrajin = (db.pesananProdukPengrajin ?? []).filter(
    (pesanan) => pesanan.status !== "batal",
  );

  return {
    kerjasama: sebelum.kerjasama - db.kerjasama.length,
    pemesananSewa: sebelum.pemesananSewa - db.pemesananSewa.length,
    pesananProdukPengrajin:
      sebelum.pesananProdukPengrajin - db.pesananProdukPengrajin.length,
  };
}

/**
 * Versi lama menentukan nomor ORDER dari jumlah record. Penghapusan pesanan
 * atau pembuatan paket beberapa Pengrajin dapat menghasilkan nomor yang sama.
 * Pertahankan nomor milik transaksi tertua dan beri nomor baru yang stabil
 * hanya kepada duplikatnya.
 */
function repairDuplicateKriyaOrderNumbers(db: DBShape): void {
  const pattern = /^ORDER\/KRIYA\/(\d{4})\/(\d+)$/;
  const maxByYear = new Map<string, number>();
  for (const pesanan of db.pesananProdukPengrajin ?? []) {
    const match = pesanan.nomor.match(pattern);
    if (!match) continue;
    maxByYear.set(
      match[1],
      Math.max(maxByYear.get(match[1]) ?? 0, Number(match[2])),
    );
  }

  const used = new Set<string>();
  const ordered = [...(db.pesananProdukPengrajin ?? [])].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  for (const pesanan of ordered) {
    const match = pesanan.nomor.match(pattern);
    if (!match || !used.has(pesanan.nomor)) {
      used.add(pesanan.nomor);
      continue;
    }
    const year = match[1];
    let next = (maxByYear.get(year) ?? 0) + 1;
    let candidate = `ORDER/KRIYA/${year}/${String(next).padStart(4, "0")}`;
    while (used.has(candidate)) {
      next += 1;
      candidate = `ORDER/KRIYA/${year}/${String(next).padStart(4, "0")}`;
    }
    pesanan.nomor = candidate;
    maxByYear.set(year, next);
    used.add(candidate);
  }
}

function migrate(db: DBShape): DBShape {
  // Backfill new collections for existing localStorage seeds.
  db.aset ||= [];
  db.sarpras ||= [];
  db.kerjasama ||= [];
  db.chatMessages ||= [];
  db.negosiasi ||= [];
  db.invoices ||= [];
  db.payments ||= [];
  db.contracts ||= [];
  db.bast ||= [];
  db.ratings ||= [];
  db.pemesananSewa ||= [];
  db.kerjasamaMitraPengrajin ||= [];
  db.pesananProdukPengrajin ||= [];
  hapusPesananDibatalkan(db);
  repairDuplicateKriyaOrderNumbers(db);
  for (const pesanan of db.pesananProdukPengrajin) {
    pesanan.subtotalProduk ||= pesanan.items.reduce(
      (total, item) => total + item.harga * item.jumlah,
      0,
    );
    pesanan.pengiriman ||= {
      metode: "kurir_paket",
      ongkirTermasukHarga: true,
      penanggungOngkir: "penjual",
      statusOngkir: "termasuk_harga",
      biayaOngkir: 0,
      layanan: "Layanan sesuai kesepakatan lama",
    };
    pesanan.pembayaran ||= {
      mekanisme: "lunas",
      pembayaranLangsung: true,
      penampungDanaJakSanggar: false,
      disepakatiPembeliAt: pesanan.createdAt,
      disepakatiPenjualAt: pesanan.kontrak?.dibuatAt,
    };
    // Cache versi lama sempat menyimpan status utama dan status ongkir secara
    // terpisah. Jika proposal ongkir penjual sudah ada, jangan biarkan reload
    // mengembalikan transaksi ke "menunggu perhitungan penjual".
    const ongkirSudahDikirim =
      !pesanan.pengiriman.ongkirTermasukHarga &&
      (pesanan.pengiriman.statusOngkir === "disepakati" ||
        Boolean(pesanan.pembayaran.disepakatiPenjualAt));
    if (ongkirSudahDikirim) {
      pesanan.pengiriman.statusOngkir = "disepakati";
      if (pesanan.status === "menunggu_ongkir") {
        pesanan.status = "menunggu_persetujuan_ongkir";
      }
    }
    pesanan.ringkasanPajak ||= hitungRingkasanPajakTransaksi({
      subtotal: pesanan.subtotalProduk,
      ongkir: pesanan.pengiriman.biayaOngkir,
      statusPkpPenjual: "non_pkp",
    });
    pesanan.nilaiTotal = pesanan.ringkasanPajak.totalInvoice;
    pesanan.riwayatPembayaran ||= pesanan.pembayaranAt
      ? [
          {
            id: `bayar-migrasi-${pesanan.id}`,
            tahap: "lunas",
            nominal: pesanan.ringkasanPajak.dibayarLangsungKePenjual,
            diajukanAt: pesanan.pembayaranAt,
            diverifikasiAt: pesanan.pembayaranAt,
            diverifikasiOleh: pesanan.pengrajinId,
          },
        ]
      : [];
    if (pesanan.kontrak && !pesanan.invoice) {
      pesanan.invoice = {
        nomor: pesanan.kontrak.nomor.replace(/^KONTRAK/i, "INVOICE"),
        dibuatAt: pesanan.kontrak.dibuatAt,
        finalAt: pesanan.kontrak.dibuatAt,
      };
    }
  }
  db.news ||= [];
  db.infoBudaya ||= [];
  db.absensiPembinaan ||= [];
  db.absensiLatihan ||= [];
  db.dokumenArsip ||= [];
  db.paketIsian ||= {};
  if (demoAccountsEnabled()) {
    ensureLocalDemoAccounts(db);
    applyDemoTransactionReset(db);
  }
  const demoMedia: Record<
    string,
    {
      id: string;
      source: string;
      kind: InfoBudaya["mediaKind"];
      url?: string;
      contentType?: string;
    }
  > = {
    "tari topeng betawi": {
      id: "demo-info-tari-topeng-betawi-v1",
      source: "Dinas Kebudayaan DKI Jakarta",
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=kzB-1SfD2wk",
      contentType: "video/youtube",
    },
    "gambang kromong": {
      id: "demo-info-gambang-kromong-v1",
      source: "Lembaga Kebudayaan Betawi",
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=6asiKnZ3WZ4",
      contentType: "video/youtube",
    },
    "lenong denes & lenong preman": {
      id: "demo-info-lenong-v1",
      source: "Pusat Studi Betawi UI",
      kind: "image",
    },
    "kerak telor — kuliner identitas": {
      id: "demo-info-kerak-telor-v1",
      source: "Kompendium Kuliner Nusantara",
      kind: "image",
    },
    "palang pintu — tradisi pernikahan": {
      id: "demo-info-palang-pintu-v1",
      source: "Lembaga Kebudayaan Betawi",
      kind: "image",
    },
  };
  for (const item of db.infoBudaya) {
    const demo = demoMedia[item.judul.trim().toLowerCase()];
    if (demo && item.sumber === demo.source) {
      item.id = demo.id;
      item.mediaUrl ||= demo.url;
      item.mediaContentType ||= demo.contentType;
      item.mediaKind ||= demo.kind;
    }
    normalizeInfoBudayaForStore(item);
  }
  // Hapus seed demo versi lama dari cache browser. Bila server memang masih
  // mempunyai record dengan ID ini, bootstrap akan menambahkannya kembali;
  // client sendiri tidak lagi menjadi sumber karya tersebut.
  db.infoBudaya = db.infoBudaya.filter(
    (item) => !LEGACY_DEMO_INFO_BUDAYA_IDS.has(item.id),
  );
  db.news = db.news.filter((item) => !LEGACY_DEMO_NEWS_IDS.has(item.id));
  db.slider = db.slider.filter(
    (item) => !LEGACY_DEMO_SLIDER_URLS.has(item.imageUrl),
  );
  db.banners = db.banners.filter(
    (item) => item.teks !== LEGACY_DEMO_BANNER_TEXT,
  );
  for (const item of db.news) {
    const text = `${item.judul} ${item.isi}`.toLowerCase();
    if (/agenda|festival|kegiatan/.test(item.judul.toLowerCase())) {
      item.kategori = "Agenda";
    } else if (!item.kategori) {
      item.kategori = /pengumuman|pendaftaran|sertifikasi|kurasi/.test(text)
        ? "Pengumuman"
        : /jadwal/.test(text)
          ? "Agenda"
          : "Berita";
    }
  }
  // Migrasi matriks kurasi lama (Indikator → Variabel) ke 3 level (Indikator → Pilar → Variabel).
  db.kurasiMatrix = migrateMatrix(db.kurasiMatrix);
  for (const submission of db.kurasiSubmissions) {
    // Rincian per bukti diperkenalkan setelah skor agregat per variabel.
    // Map kosong mempertahankan skor agregat lama sampai Juri mengisi rincian.
    submission.requirementScores ??= {};
    if (submission.matrixSnapshot) {
      submission.matrixSnapshot = migrateMatrix(submission.matrixSnapshot, {
        preserveExistingContent: true,
      });
    }
  }
  // Backfill kelolaInfoBudaya permission untuk admin yang sudah ada
  for (const u of db.users) {
    if (u.apiId && !LOCAL_DEMO_USERNAMES.has(u.username.toLowerCase())) {
      u.password = API_PASSWORD_PLACEHOLDER;
    }
    if (u.role === "admin") {
      const a = u as AdminUser;
      const existing = (a.permissions ?? {}) as Partial<
        AdminUser["permissions"]
      >;
      a.permissions = {
        kelolaBerita: existing.kelolaBerita ?? true,
        kelolaBanner: existing.kelolaBanner ?? true,
        kelolaSlider: existing.kelolaSlider ?? true,
        kelolaJamPembinaan: existing.kelolaJamPembinaan ?? false,
        kelolaInfoBudaya: existing.kelolaInfoBudaya ?? true,
      };
    }
    if (u.role === "pelatih" || u.role === "seniman") {
      const anggota = u as PelatihUser | SenimanUser;
      anggota.riwayatPendidikan ||= [];
      anggota.portofolio ||= {
        karya: [],
        prestasi: [],
        sertifikasi: [],
        piagam: [],
        penghargaan: [],
      };
      anggota.portofolio.karya ||= [];
      anggota.portofolio.prestasi ||= [];
      anggota.portofolio.sertifikasi ||= [];
      anggota.portofolio.piagam ||= [];
      anggota.portofolio.penghargaan ||= [];
      anggota.rapor ||= [];
      if (u.role === "pelatih") {
        const pelatih = u as PelatihUser;
        if (
          pelatih.username === "pelatih.iwan" ||
          pelatih.username === "pelatih.nia"
        ) {
          pelatih.menerimaKelasPrivat ??= true;
          pelatih.namaLayananPrivat ||=
            pelatih.jenisKesenian === "Musik"
              ? "Kelas Privat Musik Betawi"
              : "Kelas Privat Tari Betawi";
          pelatih.hargaKelasPrivat ??=
            pelatih.jenisKesenian === "Musik" ? 300_000 : 350_000;
        }
      }
    }
    if (u.role === "pengrajin") {
      const p = u as PengrajinUser;
      p.bentukUsaha ||= "Perorangan";
      p.produk ||= [];
      p.npwp ||= "";
      p.statusPkp ||= p.username === "pengrajin.demo" ? "pkp" : "non_pkp";
      p.pemotongPajak ??= false;
      p.nib ||= "";
      p.rekening ||= { bank: "BCA", nomor: "", atasNama: p.namaPemilik };
      p.dokumen ||= [];
      p.tokoDipublikasikan ??= true;
      p.menerimaSewaJasa ??= false;
      p.menerimaKerjasama ??= false;
      if (p.username === "pengrajin.demo") {
        p.email ||= "pengrajin.demo@example.com";
        p.noHp ||= "081200004321";
        p.npwp ||= "1234567890123456";
        p.nib ||= "9123456789012";
      }
      for (const produk of p.produk) {
        // Produk demo telah diketahui sebagai kriya Betawi. Produk lama lain
        // harus dikonfirmasi pemilik sebelum bisa kembali dipublikasikan.
        if (p.username === "pengrajin.demo") produk.khasJakarta = true;
        if (produk.khasJakarta !== true) produk.statusPublish = false;
        produk.ongkirTermasukHarga ??= false;
        produk.cakupanOngkir ||= "DKI Jakarta sesuai kesepakatan transaksi";
      }
      if (p.username === "pengrajin.demo" && p.produk.length === 0) {
        if (!p.rekening.nomor) {
          p.rekening = {
            bank: "DKI",
            nomor: "7012345678",
            atasNama: p.namaPemilik,
          };
        }
        p.produk = [
          {
            id: "produk-demo-ondel",
            nama: "Miniatur Ondel-ondel Betawi",
            kategori: "Ondel-ondel",
            deskripsi:
              "Miniatur buatan tangan untuk cendera mata, dekorasi, dan paket acara.",
            harga: 175000,
            satuan: "buah",
            stok: 24,
            khasJakarta: true,
            statusPublish: true,
            tersediaSewaJasa: true,
            terbukaKerjasama: true,
            createdAt: Date.now(),
          },
          {
            id: "produk-demo-kembang-kelapa",
            nama: "Dekorasi Kembang Kelapa",
            kategori: "Aksesori",
            deskripsi:
              "Paket dekorasi khas Betawi untuk panggung, hajatan, dan kegiatan budaya.",
            harga: 850000,
            satuan: "acara",
            khasJakarta: true,
            statusPublish: true,
            tersediaSewaJasa: true,
            terbukaKerjasama: true,
            createdAt: Date.now(),
          },
        ];
        p.tokoDipublikasikan = true;
        p.menerimaSewaJasa = true;
        p.menerimaKerjasama = true;
      }
    }
    if (u.role === "mitra_pengrajin") {
      const mitra = u as MitraPengrajinUser;
      mitra.bentukUsaha ||= "Perorangan";
      // Akun lama sudah diwajibkan mengisi alamat usaha. Gunakan identitas
      // tersebut sebagai data awal toko offline agar migrasi tidak mengunci
      // akun aktif; pendaftaran baru tetap wajib mengisi pernyataan khusus.
      mitra.memilikiTokoOffline ??= true;
      mitra.namaTokoOffline ||= mitra.namaUsaha;
      mitra.alamatTokoOffline ||= mitra.alamat;
      const isDemoMitra = /^mitra\.demo(?:\d{2})?$/i.test(mitra.username);
      if (isDemoMitra) {
        mitra.wilayahTokoOffline ||= {
          provinsi: "DKI Jakarta",
          provinsiId: "31",
          kota: "Jakarta Selatan",
          kotaId: "3174",
          kecamatan: "Pasar Minggu",
          kecamatanId: "3174010",
          kelurahan: "Pejaten Timur",
          kelurahanId: "3174010005",
        };
        mitra.latTokoOffline ||= -6.27;
        mitra.lngTokoOffline ||= 106.84;
        mitra.tanggalPermohonanMitra ||= demoMitraApplicationDate();
        mitra.tanggalTerbitNib ||= demoMitraNibDate();
        const required = demoMitraVerificationDocuments(
          mitra.username.replace(/\W/g, "-").toLowerCase(),
        );
        for (const document of required) {
          if (!mitra.dokumen?.some((item) => item.jenis === document.jenis)) {
            (mitra.dokumen ??= []).push(document);
          }
        }
      }
      mitra.statusVerifikasiTokoOffline ??= isDemoMitra
        ? "terverifikasi"
        : "belum_lengkap";
      mitra.npwp ||= "";
      mitra.statusPkp ||= mitra.username === "mitra.demo" ? "pkp" : "non_pkp";
      mitra.pemotongPajak ??= mitra.bentukUsaha !== "Perorangan";
      mitra.nib ||= "";
      mitra.rekening ||= {
        bank: "BCA",
        nomor: "",
        atasNama: mitra.namaPenanggungJawab,
      };
      mitra.dokumen ||= [];
      mitra.marketplace ||= [];
      mitra.paketProduk ||= [];
      mitra.jabatanPenandatangan ||= "Penanggung Jawab";
    }
  }
  // Backfill akun demo Konsumen untuk localStorage lama.
  if (!db.users.some((u) => u.role === "sewa" && u.username === "sewa.demo")) {
    const demo: SewaUser = {
      id: `sewa_demo_${Date.now()}`,
      role: "sewa",
      username: "sewa.demo",
      password: "sewa1234",
      email: "sewa.demo@example.com",
      noHp: "081200001234",
      nama: "EO Cahaya Jakarta",
      alamat: "Jl. Sudirman No. 21, Jakarta Pusat",
      jenisInstansi: "Daerah",
      createdAt: Date.now(),
    };
    db.users.push(demo);
  }
  // Backfill akun demo Pengrajin untuk localStorage versi lama.
  if (
    !db.users.some(
      (u) => u.role === "pengrajin" && u.username === "pengrajin.demo",
    )
  ) {
    const demo: PengrajinUser = {
      id: `pengrajin_demo_${Date.now()}`,
      role: "pengrajin",
      username: "pengrajin.demo",
      password: "pengrajin123",
      email: "pengrajin.demo@example.com",
      noHp: "081200004321",
      namaUsaha: "Rumah Kriya Betawi",
      namaPemilik: "Raka Saputra",
      bentukUsaha: "Perorangan",
      jenisKerajinan: "Ondel-ondel",
      produkUnggulan:
        "Miniatur Ondel-ondel, Batik Betawi, dan aksesori Kembang Kelapa",
      produk: [],
      alamat: "Jl. Setu Babakan No. 8, Jakarta Selatan",
      wilayah: {
        provinsi: "DKI Jakarta",
        kota: "Jakarta Selatan",
        kecamatan: "Jagakarsa",
        kelurahan: "Srengseng Sawah",
        kodePos: "12640",
      },
      lat: -6.3416,
      lng: 106.8235,
      npwp: "1234567890123456",
      statusPkp: "pkp",
      pemotongPajak: false,
      nib: "9123456789012",
      rekening: { bank: "DKI", nomor: "7012345678", atasNama: "Raka Saputra" },
      dokumen: [],
      tokoDipublikasikan: true,
      menerimaSewaJasa: true,
      menerimaKerjasama: true,
      deskripsi:
        "Pengrajin kriya Betawi yang mengolah ikon budaya menjadi produk dekorasi dan cendera mata.",
      instagram: "rumahkriyabetawi",
      createdAt: Date.now(),
    };
    db.users.push(demo);
  }
  // Backfill akun demo Mitra untuk localStorage versi lama.
  if (
    !db.users.some(
      (u) => u.role === "mitra_pengrajin" && u.username === "mitra.demo",
    )
  ) {
    const pengrajin = db.users.find(
      (u): u is PengrajinUser =>
        u.role === "pengrajin" && u.username === "pengrajin.demo",
    );
    const now = Date.now();
    const demo: MitraPengrajinUser = {
      id: `mitra_demo_${now}`,
      role: "mitra_pengrajin",
      username: "mitra.demo",
      password: "mitra1234",
      email: "mitra.demo@example.com",
      noHp: "081299998877",
      namaUsaha: "Mitra Kriya Jakarta",
      namaPenanggungJawab: "Nadia Prameswari",
      bentukUsaha: "Badan Hukum",
      namaBadanUsaha: "PT Mitra Kriya Jakarta",
      alamat: "Jl. Kebon Sirih No. 18, Jakarta Pusat",
      memilikiTokoOffline: true,
      namaTokoOffline: "Toko Mitra Kriya Jakarta",
      alamatTokoOffline: "Jl. Kebon Sirih No. 18, Jakarta Pusat",
      wilayahTokoOffline: {
        provinsi: "DKI Jakarta",
        provinsiId: "31",
        kota: "Jakarta Pusat",
        kotaId: "3171",
        kecamatan: "Menteng",
        kecamatanId: "3171020",
        kelurahan: "Kebon Sirih",
        kelurahanId: "3171020004",
      },
      latTokoOffline: -6.1812,
      lngTokoOffline: 106.8286,
      statusVerifikasiTokoOffline: "terverifikasi",
      tanggalPermohonanMitra: demoMitraApplicationDate(),
      tanggalTerbitNib: demoMitraNibDate(),
      npwp: "9876543210123456",
      statusPkp: "pkp",
      pemotongPajak: true,
      nib: "8123456789012",
      rekening: {
        bank: "DKI",
        nomor: "7019988776",
        atasNama: "PT Mitra Kriya Jakarta",
      },
      dokumen: demoMitraVerificationDocuments("utama-backfill"),
      marketplace: [
        {
          id: "marketplace-demo-tokopedia",
          nama: "Tokopedia",
          namaToko: "Mitra Kriya Jakarta",
          url: "https://www.tokopedia.com/",
          aktif: true,
        },
      ],
      paketProduk: pengrajin
        ? [
            {
              id: "paket-demo-kriya-betawi",
              nama: "Paket Kriya Betawi",
              deskripsi:
                "Paket gabungan cendera mata dan dekorasi khas Jakarta.",
              items: [
                {
                  pengrajinId: pengrajin.id,
                  produkId: "produk-demo-ondel",
                  namaPengrajin: pengrajin.namaUsaha,
                  namaProduk: "Miniatur Ondel-ondel Betawi",
                  jumlah: 2,
                  hargaDasar: 175000,
                  satuan: "buah",
                },
              ],
              hargaJual: 425000,
              marketplaceIds: ["marketplace-demo-tokopedia"],
              aktif: true,
              createdAt: now,
              updatedAt: now,
            },
          ]
        : [],
      deskripsi:
        "Mitra penjualan paket gabungan produk khas Jakarta melalui marketplace resmi milik mitra.",
      jabatanPenandatangan: "Direktur",
      createdAt: now,
    };
    db.users.push(demo);
  }
  const runtimeMeta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };
  // Akun demo dimulai tanpa transaksi. Pengguna tetap dapat membuat transaksi
  // baru selama sesi demo, tetapi data contoh lama tidak disuntikkan kembali.
  const exposeDemoTransactions = false;
  const demoPengrajin = db.users.find(
    (user): user is PengrajinUser =>
      user.role === "pengrajin" && user.username === "pengrajin.demo",
  );
  const demoMitra = db.users.find(
    (user): user is MitraPengrajinUser =>
      user.role === "mitra_pengrajin" && user.username === "mitra.demo",
  );
  // Pastikan localStorage demo versi lama tetap memiliki toko yang benar-benar
  // terhubung ke marker peta dan halaman publik Pengrajin.
  if (demoPengrajin) {
    const koordinatPengrajinDiJakarta =
      Number.isFinite(demoPengrajin.lat) &&
      Number.isFinite(demoPengrajin.lng) &&
      demoPengrajin.lat >= -6.5 &&
      demoPengrajin.lat <= -5.3 &&
      demoPengrajin.lng >= 106.5 &&
      demoPengrajin.lng <= 107.2;
    demoPengrajin.lat = koordinatPengrajinDiJakarta
      ? demoPengrajin.lat
      : -6.3416;
    demoPengrajin.lng = koordinatPengrajinDiJakarta
      ? demoPengrajin.lng
      : 106.8235;
    demoPengrajin.tokoDipublikasikan = true;
    demoPengrajin.menerimaSewaJasa = true;
    demoPengrajin.menerimaKerjasama = true;
    if (!demoPengrajin.produk?.length) {
      demoPengrajin.produk = [
        {
          id: "produk-demo-ondel",
          nama: "Miniatur Ondel-ondel Betawi",
          kategori: "Ondel-ondel",
          deskripsi:
            "Miniatur buatan tangan khas Jakarta untuk cendera mata dan dekorasi.",
          harga: 175000,
          satuan: "buah",
          stok: 24,
          khasJakarta: true,
          statusPublish: true,
          tersediaSewaJasa: true,
          terbukaKerjasama: true,
          createdAt: Date.now(),
        },
        {
          id: "produk-demo-kembang-kelapa",
          nama: "Dekorasi Kembang Kelapa",
          kategori: "Aksesori",
          deskripsi:
            "Dekorasi khas Betawi untuk panggung, hajatan, dan kegiatan budaya.",
          harga: 850000,
          satuan: "acara",
          khasJakarta: true,
          statusPublish: true,
          tersediaSewaJasa: true,
          terbukaKerjasama: true,
          createdAt: Date.now(),
        },
      ];
    }
  }
  if (exposeDemoTransactions && demoPengrajin && demoMitra) {
    const now = Date.now();
    const targetSelesai = new Date(now + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const item = {
      produkId: "produk-demo-ondel",
      nama: "Miniatur Ondel-ondel Betawi",
      jumlah: 2,
      harga: 175_000,
      satuan: "buah" as const,
    };
    if (
      !db.pesananProdukPengrajin.some(
        (order) => order.id === "demo-order-cek-ongkir-v1",
      )
    ) {
      const ringkasan = hitungRingkasanPajakTransaksi({
        subtotal: 350_000,
        ongkir: 0,
        statusPkpPenjual: demoPengrajin.statusPkp ?? "non_pkp",
        objekPajak: "barang_non_mewah",
      });
      db.pesananProdukPengrajin.push({
        id: "demo-order-cek-ongkir-v1",
        nomor: "ORDER/DEMO/CEK-ONGKIR",
        mitraId: demoMitra.id,
        tujuanTransaksi: "dijual_kembali",
        pengrajinId: demoPengrajin.id,
        items: [item],
        alamatPengiriman: demoMitra.alamat,
        targetSelesai,
        catatan:
          "Skenario demo untuk menguji pilihan ekspedisi, layanan, dan nominal ongkir.",
        subtotalProduk: 350_000,
        nilaiTotal: ringkasan.totalInvoice,
        pengiriman: {
          metode: "kurir_paket",
          ongkirTermasukHarga: false,
          penanggungOngkir: "pembeli",
          statusOngkir: "menunggu_penjual",
          biayaOngkir: 0,
        },
        pembayaran: {
          mekanisme: "lunas",
          pembayaranLangsung: true,
          penampungDanaJakSanggar: false,
          disepakatiPembeliAt: now,
        },
        ringkasanPajak: ringkasan,
        rekeningTujuan: structuredClone(demoPengrajin.rekening),
        riwayatPembayaran: [],
        status: "menunggu_ongkir",
        ttd: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    if (
      !db.pesananProdukPengrajin.some(
        (order) => order.id === "demo-order-upload-resi-v1",
      )
    ) {
      const ringkasan = hitungRingkasanPajakTransaksi({
        subtotal: 350_000,
        ongkir: 45_000,
        statusPkpPenjual: demoPengrajin.statusPkp ?? "non_pkp",
        objekPajak: "barang_non_mewah",
      });
      db.pesananProdukPengrajin.push({
        id: "demo-order-upload-resi-v1",
        nomor: "ORDER/DEMO/UPLOAD-RESI",
        mitraId: demoMitra.id,
        tujuanTransaksi: "dijual_kembali",
        pengrajinId: demoPengrajin.id,
        items: [item],
        alamatPengiriman: demoMitra.alamat,
        targetSelesai,
        catatan:
          "Skenario demo siap kirim untuk menguji nomor resi, galeri/kamera, dan live status.",
        subtotalProduk: 350_000,
        nilaiTotal: ringkasan.totalInvoice,
        pengiriman: {
          metode: "kurir_paket",
          ongkirTermasukHarga: false,
          penanggungOngkir: "pembeli",
          statusOngkir: "disepakati",
          biayaOngkir: 45_000,
          ekspedisi: "JNE",
          layanan: "REG",
          estimasiTiba: "2–3 hari",
        },
        pembayaran: {
          mekanisme: "setelah_barang_diterima",
          pembayaranLangsung: true,
          penampungDanaJakSanggar: false,
          disepakatiPembeliAt: now - 20_000,
          disepakatiPenjualAt: now - 10_000,
        },
        ringkasanPajak: ringkasan,
        rekeningTujuan: structuredClone(demoPengrajin.rekening),
        riwayatPembayaran: [],
        status: "diproses",
        ttd: [
          {
            pihak: "mitra",
            userId: demoMitra.id,
            nama: demoMitra.namaPenanggungJawab,
            ts: now - 20_000,
          },
          {
            pihak: "pengrajin",
            userId: demoPengrajin.id,
            nama: demoPengrajin.namaPemilik,
            ts: now - 10_000,
          },
        ],
        kontrak: {
          nomor: "KONTRAK/DEMO/UPLOAD-RESI",
          dibuatAt: now - 20_000,
          finalAt: now - 10_000,
        },
        invoice: {
          nomor: "INVOICE/DEMO/UPLOAD-RESI",
          dibuatAt: now - 10_000,
          finalAt: now - 10_000,
        },
        createdAt: now - 20_000,
        updatedAt: now,
      });
    }
    if (
      !db.pesananProdukPengrajin.some(
        (order) => order.id === "demo-order-lacak-kiriman-v1",
      )
    ) {
      const ringkasan = hitungRingkasanPajakTransaksi({
        subtotal: 350_000,
        ongkir: 45_000,
        statusPkpPenjual: demoPengrajin.statusPkp ?? "non_pkp",
        objekPajak: "barang_non_mewah",
      });
      const receiptSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420"><rect width="100%" height="100%" fill="#fff8df"/><text x="50%" y="42%" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#0a603a">FOTO RESI DEMO</text><text x="50%" y="56%" text-anchor="middle" font-family="Arial" font-size="24" fill="#333">JNE-DEMO-2026-0001</text><text x="50%" y="68%" text-anchor="middle" font-family="Arial" font-size="18" fill="#a01f2f">BUKAN RESI ASLI</text></svg>`;
      db.pesananProdukPengrajin.push({
        id: "demo-order-lacak-kiriman-v1",
        nomor: "ORDER/DEMO/LACAK-KIRIMAN",
        mitraId: demoMitra.id,
        tujuanTransaksi: "dijual_kembali",
        pengrajinId: demoPengrajin.id,
        items: [item],
        alamatPengiriman: demoMitra.alamat,
        targetSelesai,
        catatan:
          "Skenario demo pembeli untuk melihat dan mengunduh bukti resi serta membuka live status.",
        subtotalProduk: 350_000,
        nilaiTotal: ringkasan.totalInvoice,
        pengiriman: {
          metode: "kurir_paket",
          ongkirTermasukHarga: false,
          penanggungOngkir: "pembeli",
          statusOngkir: "disepakati",
          biayaOngkir: 45_000,
          ekspedisi: "JNE",
          layanan: "REG",
          estimasiTiba: "2–3 hari",
          nomorResi: "JNE-DEMO-2026-0001",
          liveLocationUrl: "https://example.com/live-status/demo",
          buktiResi: {
            nama: "FOTO-RESI-DEMO.svg",
            type: "image/svg+xml",
            size: receiptSvg.length,
            dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(receiptSvg)}`,
            uploadedBy: demoPengrajin.id,
            uploadedAt: now - 3_600_000,
          },
        },
        pembayaran: {
          mekanisme: "setelah_barang_diterima",
          pembayaranLangsung: true,
          penampungDanaJakSanggar: false,
          disepakatiPembeliAt: now - 86_400_000,
          disepakatiPenjualAt: now - 86_390_000,
        },
        ringkasanPajak: ringkasan,
        rekeningTujuan: structuredClone(demoPengrajin.rekening),
        riwayatPembayaran: [],
        status: "dikirim",
        ttd: [
          {
            pihak: "mitra",
            userId: demoMitra.id,
            nama: demoMitra.namaPenanggungJawab,
            ts: now - 86_400_000,
          },
          {
            pihak: "pengrajin",
            userId: demoPengrajin.id,
            nama: demoPengrajin.namaPemilik,
            ts: now - 86_390_000,
          },
        ],
        kontrak: {
          nomor: "KONTRAK/DEMO/LACAK-KIRIMAN",
          dibuatAt: now - 86_400_000,
          finalAt: now - 86_390_000,
        },
        invoice: {
          nomor: "INVOICE/DEMO/LACAK-KIRIMAN",
          dibuatAt: now - 86_390_000,
          finalAt: now - 86_390_000,
        },
        bast: {
          nomor: "BAST/DEMO/LACAK-KIRIMAN",
          dibuatAt: now - 3_600_000,
        },
        createdAt: now - 86_400_000,
        updatedAt: now - 3_600_000,
      });
    }
  }
  db.appearance = migrateAppearance(db.appearance);
  return db;
}

// Normalisasi objek appearance (isi default untuk field yang belum ada).
// Dipakai saat migrasi localStorage lama DAN saat hidrasi dari server.
export function migrateAppearance(
  input: AppearanceSettings | undefined,
): AppearanceSettings {
  const ap: AppearanceSettings = input ?? {
    primaryHsl: "146 78% 34%",
    accentHsl: "10 100% 54%",
    dark: false,
    theme: "light",
  };
  ap.themePreset ||= ap.theme ?? "light";
  ap.language = normalizeLang(ap.language);
  ap.customTheme = {
    enabled: false,
    mode: "light",
    primaryHsl: "146 78% 34%",
    accentHsl: "10 100% 54%",
    bgOpacity: 0.22,
    ...(ap.customTheme ?? {}),
  };
  ap.studio = {
    fontScale: 1,
    sidebarImageOpacity: 0.18,
    loginHeroOverlayOpacity: 0.55,
    ...(ap.studio ?? {}),
  };
  const defBrand = {
    appName: "JAK SANGGAR NEXT",
    appTagline: "Kebudayaan akan bernyawa karena ketulusan",
    sidebarFooterLine1: "Kebudayaan akan bernyawa",
    sidebarFooterLine2: "karena ketulusan",
    iconKey: "Sparkles",
    loginEyebrow: "Konsorsium Sanggar Seni",
  };
  ap.brand = { ...defBrand, ...(ap.brand ?? {}) };
  const defBackdrop = {
    enabled: false,
    opacity: 0.18,
    blendMode: "soft-light" as const,
  };
  ap.backdrop = { ...defBackdrop, ...(ap.backdrop ?? {}) };
  const defKategoriColors = {
    "Pantun Betawi": "#e3b864",
    Peribahasa: "#d4a64e",
    "Palang Pintu": "#c2784a",
    "Sahibul Hikayat": "#b89460",
    "Cerita Rakyat": "#d6342a",
    "Salam Betawi": "#caa86a",
    Rancag: "#daa44e",
    Lenong: "#e0552f",
  };
  const defTradisi = {
    enabled: true,
    position: "br" as const,
    cooldownMs: 2200,
    autoHideMs: 4200,
    cardWidth: 280,
    showCloseButton: true,
    source: "default" as const,
    custom: [],
    kategoriColors: defKategoriColors,
  };
  const existingTradisi = ap.tradisi ?? ({} as any);
  ap.tradisi = {
    ...defTradisi,
    ...existingTradisi,
    custom: Array.isArray(existingTradisi.custom) ? existingTradisi.custom : [],
    kategoriColors: {
      ...defKategoriColors,
      ...(existingTradisi.kategoriColors ?? {}),
    },
  };
  // Tata Naskah Dinas — nilai baku mengikuti kaidah naskah dinas Pemprov DKI
  // Jakarta: Times New Roman 12 pt, kertas A4, margin atas/kiri 3 cm dan
  // kanan/bawah 2 cm. Kurator dapat mengubahnya lewat Konsol.
  const defTataNaskah = {
    pakaiStempel: false,
    stempelOpacity: 0.85,
    stempelLebarMm: 35,
    stempelPosisi: "kiri-ttd" as const,
    fontKeluarga: "Times New Roman",
    fontUkuranPt: 12,
    spasiBaris: 1.5,
    marginAtasMm: 30,
    marginKiriMm: 30,
    marginKananMm: 20,
    marginBawahMm: 20,
    garisKop: true,
  };
  const existingTataNaskah = ap.tataNaskah ?? ({} as any);
  ap.tataNaskah = {
    ...defTataNaskah,
    ...existingTataNaskah,
    barisKop: Array.isArray(existingTataNaskah.barisKop)
      ? existingTataNaskah.barisKop
      : undefined,
  };
  return ap;
}

let cache: DBShape | null = null;
let lastSerialized: string | null = null;
const sessionInfoBudayaTombstones = new Set<string>();

export function parseInfoBudayaTombstones(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "ids" in parsed
        ? (parsed as { ids?: unknown }).ids
        : [];
    if (!Array.isArray(values)) return new Set();
    return new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0 && value.length <= 191,
      ),
    );
  } catch {
    return new Set();
  }
}

function currentInfoBudayaTombstones(): Set<string> {
  if (typeof localStorage !== "undefined") {
    const stored = parseInfoBudayaTombstones(
      localStorage.getItem(INFO_BUDAYA_TOMBSTONES_KEY),
    );
    for (const id of stored) sessionInfoBudayaTombstones.add(id);
  }
  return sessionInfoBudayaTombstones;
}

function pruneTombstonedInfoBudaya(db: DBShape): boolean {
  const tombstones = currentInfoBudayaTombstones();
  if (tombstones.size === 0 || db.infoBudaya.length === 0) return false;
  const next = db.infoBudaya.filter((item) => !tombstones.has(item.id));
  if (next.length === db.infoBudaya.length) return false;
  db.infoBudaya = next;
  return true;
}

/**
 * Ingat tombstone Media Kreatif di key terpisah dari cache utama. Dengan begitu
 * tab lama yang masih memegang snapshot sebelum delete tetap akan menyaringnya
 * sebelum save, dan reload tidak bergantung pada urutan bootstrap berikutnya.
 */
export function rememberInfoBudayaTombstones(ids: Iterable<string>): void {
  let changed = false;
  currentInfoBudayaTombstones();
  for (const id of ids) {
    if (!id || id.length > 191 || sessionInfoBudayaTombstones.has(id)) continue;
    sessionInfoBudayaTombstones.add(id);
    changed = true;
  }
  if (changed && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        INFO_BUDAYA_TOMBSTONES_KEY,
        JSON.stringify({
          version: 1,
          ids: [...sessionInfoBudayaTombstones].sort(),
        }),
      );
    } catch {
      // Set in-memory tetap melindungi sesi ini; penghapusan pada cache utama
      // masih membebaskan ruang agar bootstrap berikutnya dapat mencoba lagi.
    }
  }
  if (cache && pruneTombstonedInfoBudaya(cache)) notify();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) {
      if (!event.newValue) {
        cache = null;
        lastSerialized = null;
        notify();
        return;
      }
      try {
        cache = migrate(JSON.parse(event.newValue) as DBShape);
        pruneTombstonedInfoBudaya(cache);
        lastSerialized = JSON.stringify(cache);
        notify();
      } catch {
        // Abaikan snapshot lintas-tab yang belum lengkap/rusak.
      }
      return;
    }
    if (event.key !== INFO_BUDAYA_TOMBSTONES_KEY) return;
    for (const id of parseInfoBudayaTombstones(event.newValue)) {
      sessionInfoBudayaTombstones.add(id);
    }
    if (cache && pruneTombstonedInfoBudaya(cache)) notify();
  });
}

export function load(): DBShape {
  if (cache) {
    pruneTombstonedInfoBudaya(cache);
    return cache;
  }
  if (typeof window === "undefined") {
    cache = seed();
    pruneTombstonedInfoBudaya(cache);
    return cache;
  }
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    cache = seed();
    pruneTombstonedInfoBudaya(cache);
    lastSerialized = JSON.stringify(cache);
    localStorage.setItem(KEY, lastSerialized);
    return cache;
  }
  try {
    cache = migrate(JSON.parse(raw) as DBShape);
    pruneTombstonedInfoBudaya(cache);
    lastSerialized = JSON.stringify(cache);
    if (lastSerialized !== raw) localStorage.setItem(KEY, lastSerialized);
    return cache;
  } catch {
    cache = seed();
    pruneTombstonedInfoBudaya(cache);
    lastSerialized = JSON.stringify(cache);
    localStorage.setItem(KEY, lastSerialized);
    return cache;
  }
}

const subs = new Set<() => void>();
export function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function notify() {
  subs.forEach((fn) => fn());
}

/**
 * Asal perubahan store. Penanda ini membuat proses hidrasi dari server tidak
 * kembali masuk ke antrean sinkronisasi sebagai perubahan baru.
 */
export type StoreWriteOrigin = "local" | "remote";

type StoreChangeListener = (before: DBShape, after: DBShape) => void;
let storeChangeListener: StoreChangeListener | null = null;

/**
 * Pasang satu pengamat perubahan tingkat-store. Dipakai sync controller agar
 * seluruh halaman yang masih memanggil `save()` ikut tersinkron tanpa perlu
 * ditulis ulang satu per satu.
 */
export function setStoreChangeListener(listener: StoreChangeListener | null) {
  storeChangeListener = listener;
}

export class StorageQuotaError extends Error {
  constructor(message = "Penyimpanan lokal penuh.") {
    super(message);
    this.name = "StorageQuotaError";
  }
}

export function save(
  updater: (db: DBShape) => void,
  options: { origin?: StoreWriteOrigin } = {},
) {
  // Event `storage` dikirim secara asinkron. Sebuah tab dapat menekan tombol
  // dan melakukan save sebelum event dari tab lain sempat memperbarui cache
  // in-memory-nya. Rebase dari snapshot localStorage terbaru mencegah save
  // tersebut menimpa perubahan transaksi dari tab lain (lost update).
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(KEY);
    if (stored && stored !== lastSerialized) {
      try {
        cache = migrate(JSON.parse(stored) as DBShape);
        pruneTombstonedInfoBudaya(cache);
        lastSerialized = JSON.stringify(cache);
        if (lastSerialized !== stored)
          localStorage.setItem(KEY, lastSerialized);
      } catch {
        // Snapshot rusak tidak boleh menggagalkan save terhadap cache valid.
      }
    }
  }
  const db = load();
  pruneTombstonedInfoBudaya(db);
  const before = lastSerialized ?? JSON.stringify(db);
  let beforeDb: DBShape | null = null;
  try {
    beforeDb = JSON.parse(before) as DBShape;
  } catch {
    /* handled below */
  }
  updater(db);
  pruneTombstonedInfoBudaya(db);
  const next = JSON.stringify(db);
  try {
    localStorage.setItem(KEY, next);
    lastSerialized = next;
  } catch (err: any) {
    // Roll back the in-memory mutation by re-parsing the previous snapshot
    try {
      const prev = JSON.parse(before) as DBShape;
      Object.assign(db, prev);
    } catch {
      /* keep mutated state if rollback fails */
    }
    if (
      err &&
      (err.name === "QuotaExceededError" ||
        /quota/i.test(String(err.message ?? "")))
    ) {
      throw new StorageQuotaError(
        "Penyimpanan lokal melebihi kapasitas. Kurangi ukuran logo / backdrop, atau hapus data yang tidak terpakai.",
      );
    }
    throw err;
  }
  cache = { ...db };
  notify();
  if (options.origin !== "remote" && beforeDb && storeChangeListener) {
    try {
      storeChangeListener(beforeDb, db);
    } catch (err) {
      // Sinkronisasi tidak boleh menghalangi penyimpanan lokal yang sudah
      // berhasil. Pengontrol sync menyimpan retry sendiri dan boleh gagal
      // sementara ketika jaringan tidak tersedia.
      console.warn("Pencatatan sinkronisasi gagal", err);
    }
  }
}

/** Hapus seluruh data lokal saat logout agar tidak tersisa di browser bersama. */
export function clearLocalDb() {
  localStorage.removeItem(KEY);
  cache = null;
  lastSerialized = null;
}

export function resetAll() {
  localStorage.removeItem(KEY);
  cache = null;
  load();
  notify();
}

/**
 * Ambil audit trail permanen untuk Admin/Kurator dan gabungkan ke tampilan
 * aktivitas lokal. Server tetap menjadi sumber kebenaran; daftar browser
 * hanya cache 500 entri terbaru agar localStorage tidak terus membesar.
 */
export async function hydrateActivityAudit(): Promise<void> {
  try {
    const response = await activityAuditApi.list({ limit: 500 });
    const validRoles = new Set<Role>([
      "kurator",
      "admin",
      "sanggar",
      "pelatih",
      "seniman",
      "juri",
      "sewa",
    ]);
    save(
      (d) => {
        const byId = new Map(d.activity.map((item) => [item.id, item]));
        for (const row of response.items) {
          const timestamp = Date.parse(row.createdAt);
          if (!row.id || !Number.isFinite(timestamp)) continue;
          const actor =
            d.users.find((user) => user.apiId === row.actorId) ??
            d.users.find(
              (user) =>
                !!row.actorUsername &&
                user.username.toLowerCase() === row.actorUsername.toLowerCase(),
            );
          const meta: Record<string, unknown> = { ...(row.meta ?? {}) };
          if (row.targetType) meta.targetType = row.targetType;
          if (row.targetId) meta.targetId = row.targetId;
          if (row.actorUsername) meta.actorUsername = row.actorUsername;
          byId.set(row.id, {
            id: row.id,
            actorId: actor?.id ?? row.actorId ?? "system",
            actorRole:
              row.actorRole && validRoles.has(row.actorRole as Role)
                ? (row.actorRole as Role)
                : "guest",
            action: row.action ?? "activity",
            meta: Object.keys(meta).length > 0 ? meta : undefined,
            ts: timestamp,
          });
        }
        d.activity = [...byId.values()]
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 500);
      },
      { origin: "remote" },
    );
  } catch {
    // API tidak tersedia atau peran tidak berhak: aktivitas lokal tetap ada.
  }
}

// ── Pengaturan global (singleton) yang dibacking server (tabel `settings`) ──
// Key DBShape yang dipindahkan ke database permanen. Server jadi sumber
// kebenaran: di-hidrasi ke store lokal saat load, dan ditulis-balik saat
// disimpan kurator. Komponen tetap membaca `db.<key>` secara sinkron seperti
// biasa (lewat useDb) sehingga migrasi ini transparan untuk halaman lain.
//
// PENTING: hanya cantumkan key yang SUDAH ditulis-balik (write-through) ke
// server di sini. Key yang masih disimpan lokal saja JANGAN dimasukkan — bila
// dihidrasi satu-arah (server → lokal) padahal penyimpanannya masih lokal,
// nilai lokal akan tertimpa data server yang basi saat reload.
// `appearance` sudah write-through: semua penulisannya lewat persistAppearance.
// `jamPembinaan` sudah write-through: satu-satunya penulisnya (KuratorWaktu)
// memakai persistSetting. `honorPerSesiDefault` tidak punya UI penulis sama
// sekali (hanya dibaca sebagai default), jadi aman dihidrasi; bila kelak ada
// UI pengaturannya, WAJIB lewat persistSetting.
export type SettingKey =
  | "kurasiMatrix"
  | "appearance"
  | "jamPembinaan"
  | "honorPerSesiDefault";

let settingsHydrated = false;
export function isSettingsHydrated() {
  return settingsHydrated;
}

// Ambil pengaturan global dari server lalu gabungkan ke store lokal. Hanya
// satu arah (server → lokal); tidak menulis balik ke server agar tidak
// memicu loop. Bila server tak tersedia, store lokal tetap dipakai.
export async function hydrateSettings(): Promise<void> {
  try {
    const list = await settingsApi.list();
    const map = new Map(list.map((s) => [s.key, s.value]));
    save((d) => {
      const matrix = map.get("kurasiMatrix");
      if (matrix != null) {
        d.kurasiMatrix = migrateMatrix(matrix as DBShape["kurasiMatrix"]);
      }
      const appearance = map.get("appearance");
      if (appearance != null && typeof appearance === "object") {
        // Overlay server di atas lokal supaya field default baru (yang belum
        // pernah tersimpan di server) tidak hilang. Server jadi sumber
        // kebenaran untuk semua field yang pernah disimpan kurator
        // (termasuk highContrast) — KECUALI preferensi pribadi per-perangkat
        // (tema & Kontras Tinggi) milik pengguna non-kurator, yang diterapkan
        // ulang di atas nilai server setelah overlay.
        const override = sessionCanWriteSettings()
          ? null
          : readAppearanceOverride();
        d.appearance = migrateAppearance({
          ...d.appearance,
          ...(appearance as Partial<AppearanceSettings>),
          ...(override ?? {}),
        });
      }
      const jam = map.get("jamPembinaan");
      if (jam != null && typeof jam === "object") {
        // Overlay di atas lokal supaya field default baru (yang belum pernah
        // tersimpan di server) tidak hilang.
        d.jamPembinaan = {
          ...d.jamPembinaan,
          ...(jam as Partial<DBShape["jamPembinaan"]>),
        };
      }
      const honor = map.get("honorPerSesiDefault");
      if (typeof honor === "number" && Number.isFinite(honor)) {
        d.honorPerSesiDefault = honor;
      }
    });
  } catch {
    // Server tidak tersedia (mis. offline / VPS mati) — pakai store lokal.
  } finally {
    settingsHydrated = true;
  }
}

// Simpan satu pengaturan global: tulis ke store lokal (agar UI langsung
// reaktif) lalu kirim ke server. Bila server menolak, kembalikan (rollback)
// nilai lokal ke kondisi sebelumnya lalu lempar error supaya pemanggil bisa
// menampilkan notifikasi gagal tanpa menyisakan data lokal yang seolah-olah
// tersimpan.
export async function persistSetting<K extends SettingKey>(
  key: K,
  value: DBShape[K],
): Promise<void> {
  const previous = load()[key];
  save((d) => {
    (d as Record<SettingKey, unknown>)[key] = value;
  });
  if (storeDemoMode) return;
  try {
    await settingsApi.put(key, value as unknown);
  } catch (err) {
    save((d) => {
      (d as Record<SettingKey, unknown>)[key] = previous;
    });
    throw err;
  }
}

// Kunci penyimpanan sesi & impersonation — sama dengan yang dipakai auth.tsx.
// Pada demo, SESSION_STORAGE_KEY berada di sessionStorage agar per-tab.
// (didefinisikan di sini agar store tidak perlu meng-import auth → hindari
// dependensi melingkar; auth.tsx meng-import konstanta ini).
export const SESSION_STORAGE_KEY = "jaksanggar_session_v1";
export const IMPERSONATION_STORAGE_KEY = "jaksanggar_impersonation_v1";

// Apakah sesi saat ini berhak menulis pengaturan global ke server?
// PUT /settings/:key hanya untuk kurator. Saat impersonation, cookie sesi
// server tetap milik kurator asli sehingga tetap boleh menulis.
function sessionCanWriteSettings(): boolean {
  try {
    const db = load();
    const sessionStore =
      storeDemoMode || import.meta.env?.VITE_DEMO_SESSION_PER_TAB === "true"
        ? sessionStorage
        : localStorage;
    const sid = sessionStore.getItem(SESSION_STORAGE_KEY);
    const current = sid ? db.users.find((u) => u.id === sid) : undefined;
    if (current?.role === "kurator") return true;
    const rawImp = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (rawImp) {
      const imp = JSON.parse(rawImp) as { originalUserId?: string };
      const original = imp?.originalUserId
        ? db.users.find((u) => u.id === imp.originalUserId)
        : undefined;
      if (original?.role === "kurator") return true;
    }
  } catch {
    // localStorage/JSON bermasalah — anggap tidak berhak.
  }
  return false;
}

// Tulis pengaturan tampilan (appearance): mutasi lokal dulu agar UI langsung
// reaktif (offline-first), lalu — HANYA bila sesi berhak (kurator) — kirim
// seluruh objek appearance ke server. Bila server menolak, rollback nilai
// lokal ke kondisi sebelumnya lalu lempar error supaya pemanggil bisa
// menampilkan notifikasi gagal.
// Mengembalikan { server: boolean }: true bila tersimpan permanen di DB,
// false bila hanya lokal (sesi non-kurator — server menolak PUT settings).
export async function persistAppearance(
  mutate: (ap: AppearanceSettings) => void,
): Promise<{ server: boolean }> {
  const previous = structuredClone(load().appearance);
  save((d) => {
    mutate(d.appearance);
  });
  if (storeDemoMode) return { server: false };
  if (!sessionCanWriteSettings()) {
    // Sesi non-kurator: simpan preferensi pribadi (tema & Kontras Tinggi)
    // ke overlay per-perangkat supaya tidak tertimpa hidrasi server saat
    // reload berikutnya. Hanya field yang benar-benar berubah yang direkam
    // — pengaturan global kurator tetap jadi default untuk field lain.
    recordAppearanceOverride(previous, load().appearance);
    return { server: false };
  }
  try {
    await settingsApi.put("appearance", load().appearance);
    return { server: true };
  } catch (err) {
    save((d) => {
      d.appearance = previous;
    });
    throw err;
  }
}

// ── Overlay preferensi tampilan pribadi (per-perangkat, non-kurator) ─────────
// Pengguna non-kurator boleh mengganti mode tema & Kontras Tinggi lewat tombol
// header AppShell, tetapi tidak berhak menulis settings global ke server.
// Tanpa overlay ini, pilihan mereka tertimpa nilai server saat hidrasi
// berikutnya. Overlay disimpan di key localStorage terpisah (bukan di db
// utama) sehingga selamat dari clearLocalDb() saat logout dan diterapkan
// SETELAH overlay server di hydrateSettings.
export const APPEARANCE_OVERRIDE_STORAGE_KEY =
  "jaksanggar_appearance_override_v1";

// Field appearance yang dianggap preferensi pribadi per-perangkat. Field lain
// (brand, studio, tradisi, dst.) tetap sepenuhnya milik pengaturan kurator.
const PERSONAL_APPEARANCE_KEYS = [
  "theme",
  "themePreset",
  "dark",
  "highContrast",
  "language",
] as const;
type PersonalAppearanceKey = (typeof PERSONAL_APPEARANCE_KEYS)[number];
type AppearanceOverride = Partial<
  Pick<AppearanceSettings, PersonalAppearanceKey>
>;

export function readAppearanceOverride(): AppearanceOverride | null {
  try {
    const raw = localStorage.getItem(APPEARANCE_OVERRIDE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== "object") return null;
    const out: Record<string, unknown> = {};
    for (const k of PERSONAL_APPEARANCE_KEYS) {
      if (k in parsed) out[k] = parsed[k];
    }
    return Object.keys(out).length > 0 ? (out as AppearanceOverride) : null;
  } catch {
    return null;
  }
}

function recordAppearanceOverride(
  before: AppearanceSettings,
  after: AppearanceSettings,
): void {
  try {
    const changed: Record<string, unknown> = {};
    for (const k of PERSONAL_APPEARANCE_KEYS) {
      if (before[k] !== after[k]) changed[k] = after[k];
    }
    if (Object.keys(changed).length === 0) return;
    const merged = { ...(readAppearanceOverride() ?? {}), ...changed };
    localStorage.setItem(
      APPEARANCE_OVERRIDE_STORAGE_KEY,
      JSON.stringify(merged),
    );
  } catch {
    // localStorage bermasalah — preferensi tetap berlaku untuk sesi ini saja.
  }
}

export function clearAppearanceOverride(): void {
  try {
    localStorage.removeItem(APPEARANCE_OVERRIDE_STORAGE_KEY);
  } catch {
    // abaikan
  }
}

// ── Profil Sanggar (di-backing tabel `users`, kolom `profile` JSON) ──────────
// Field SanggarUser yang dimigrasikan ke DB. saldo/editCount/editPeriodStart
// SENGAJA tidak termasuk (operasional/derivasi lokal; menyusul pada tahap
// migrasinya masing-masing).
const SANGGAR_PROFILE_KEYS = [
  "namaSanggar",
  "namaKetua",
  "nip",
  "legalitas",
  "namaBadanHukum",
  "jenisKesenian",
  "alamat",
  "wilayah",
  "lat",
  "lng",
  "rekening",
  "fotoProfileDataUrl",
  "fotoSampulDataUrl",
  "logoDataUrl",
  "kopSuratDataUrl",
  "stempelDataUrl",
  "fotoGaleri",
  "deskripsi",
  "tahunBerdiri",
  "website",
  "instagram",
  "npwp",
  "email",
  "noHp",
  "rekamJejak",
  "jenisPemilik",
  "bentukKedudukan",
] as const;

// Bangun objek `profile` untuk dikirim ke server dari user sanggar lokal.
export function sanggarServerProfile(sg: SanggarUser): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SANGGAR_PROFILE_KEYS) {
    const v = (sg as unknown as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Resolusi id server (apiId) sebuah akun lokal berdasarkan username-nya via
// GET /api/users (khusus kurator/admin). Hanya dicoba bila sesi server saat
// ini berhak (kurator asli — termasuk saat impersonation, karena cookie sesi
// server tetap milik kurator). Bila ketemu, apiId disimpan ke user lokal agar
// tidak perlu resolusi ulang. Mengembalikan undefined bila tidak berhak,
// offline, atau username tidak ada di server.
async function resolveApiIdByUsername(
  userId: string,
): Promise<string | undefined> {
  if (!sessionCanWriteSettings()) return undefined;
  const local = load().users.find((u) => u.id === userId);
  if (!local) return undefined;
  try {
    const list = await usersApi.list();
    const match = list.find(
      (a) => a.username.toLowerCase() === local.username.toLowerCase(),
    );
    if (!match) return undefined;
    save((d) => {
      const u = d.users.find((x) => x.id === userId);
      if (u) u.apiId = match.id;
    });
    return match.id;
  } catch {
    // Offline atau server menolak — biarkan pemanggil fallback lokal-saja.
    return undefined;
  }
}

// Tulis profil sanggar: lokal-dulu (UI langsung reaktif) lalu PATCH ke server.
// Bila server menolak, rollback snapshot lokal lalu lempar error supaya
// pemanggil bisa menampilkan notifikasi gagal. Akun tanpa apiId (belum
// sinkron/lokal-saja) hanya disimpan lokal.
// Mengembalikan { server: true } bila profil benar-benar tersimpan ke DB,
// atau { server: false } bila hanya tersimpan lokal (akun tanpa apiId, mis.
// sesi impersonation atas sanggar yang belum pernah login langsung). Pemanggil
// WAJIB membedakan keduanya agar tidak menampilkan sukses palsu.
export async function persistSanggarProfile(
  userId: string,
  apiId: string | undefined,
  patch: Partial<SanggarUser>,
): Promise<{ server: boolean }> {
  const before = load().users.find((u) => u.id === userId);
  const snapshot = before ? structuredClone(before) : undefined;
  save((d) => {
    const u = d.users.find((x) => x.id === userId) as SanggarUser | undefined;
    if (u) Object.assign(u, patch);
  });
  if (storeDemoMode) return { server: false };
  if (!apiId) {
    // Akun target belum punya apiId (mis. sanggar yang belum pernah login
    // langsung, dibuka via impersonation Kurator). Cookie sesi server tetap
    // milik kurator, jadi coba resolusi id server-nya lewat GET /api/users
    // (khusus kurator/admin) berdasarkan username, lalu simpan ke lokal
    // supaya panggilan berikutnya tidak perlu resolusi ulang.
    apiId = await resolveApiIdByUsername(userId);
    if (!apiId) return { server: false };
  }
  try {
    const u = load().users.find((x) => x.id === userId) as SanggarUser;
    await usersApi.update(apiId, { profile: sanggarServerProfile(u) });
    return { server: true };
  } catch (err) {
    if (snapshot) {
      save((d) => {
        const idx = d.users.findIndex((x) => x.id === userId);
        if (idx >= 0) d.users[idx] = snapshot;
      });
    }
    throw err;
  }
}

// ── Keanggotaan (pelatih/seniman; di-backing tabel `users` kolom `profile`) ──
// Field anggota yang dimigrasikan ke DB. `sanggarId` TIDAK dikirim mentah —
// di server disimpan sebagai `sanggarUsername` (username unik lintas store)
// karena id lokal berbeda per perangkat.
const MEMBER_PROFILE_KEYS = [
  "nama",
  "usia",
  "pendidikan",
  "profesi",
  "jenisKesenian",
  "status",
  "rekening",
  "honorPerSesi",
  "fotoProfileDataUrl",
  "fotoGaleri",
  "bio",
  "alamat",
  "wilayah",
  "jenisKelamin",
  "tanggalLahir",
  "npwp",
  "akomodasiPP",
  "biayaAkomodasi",
  "riwayatPendidikan",
  "portofolio",
  "rapor",
  "email",
  "noHp",
  "mutasiTujuanUsername",
  "mutasiDiajukanAt",
  "pemberhentianBuktiUrl",
  "pemberhentianBuktiNama",
  "pemberhentianAt",
] as const;

type MemberUser = PelatihUser | SenimanUser;

// Bangun objek `profile` server dari anggota lokal (+ sanggarUsername).
export function memberServerProfile(
  m: MemberUser,
  d: DBShape,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of MEMBER_PROFILE_KEYS) {
    const v = (m as unknown as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  const sanggar = m.sanggarId
    ? d.users.find((u) => u.id === m.sanggarId)
    : undefined;
  if (sanggar) out["sanggarUsername"] = sanggar.username;
  else if (m.sanggarServerId) out["sanggarId"] = m.sanggarServerId;
  return out;
}

// Terapkan data anggota dari server ke store lokal (overlay HANYA key yang
// ada di server — pola sama dengan hydrateSanggarProfile). Anggota yang belum
// ada di lokal dibuat baru. `sanggarUsername` dipetakan ke id sanggar lokal.
export function applyMemberFromServer(d: DBShape, api: ApiAuthUser): void {
  if (api.role !== "pelatih" && api.role !== "seniman") return;
  const profile = api.profile ?? {};
  const sanggarUsername = profile["sanggarUsername"];
  const localSanggar =
    typeof sanggarUsername === "string"
      ? d.users.find(
          (u) =>
            u.role === "sanggar" &&
            u.username.toLowerCase() === sanggarUsername.toLowerCase(),
        )
      : undefined;
  let local = d.users.find(
    (u) => u.username.toLowerCase() === api.username.toLowerCase(),
  ) as MemberUser | undefined;
  if (!local) {
    local = {
      id: `u_api_${api.id}`,
      apiId: api.id,
      username: api.username,
      password: API_PASSWORD_PLACEHOLDER,
      createdAt: Date.now(),
      role: api.role,
      nama: String(profile["nama"] ?? api.username),
      usia: 25,
      pendidikan: "-",
      jenisKesenian: "Tari",
      status: "aktif",
      rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
      ...(api.role === "pelatih" ? { honorPerSesi: 0 } : {}),
    } as unknown as MemberUser;
    d.users.push(local);
  }
  if (local.role !== "pelatih" && local.role !== "seniman") return;
  local.apiId = api.id;
  local.password = API_PASSWORD_PLACEHOLDER;
  // Sinkronkan promosi peran (mis. seniman → pelatih di perangkat lain).
  if (local.role !== api.role) {
    (local as unknown as Record<string, unknown>)["role"] = api.role;
    if (
      api.role === "pelatih" &&
      (local as unknown as Record<string, unknown>)["honorPerSesi"] ===
        undefined
    ) {
      (local as unknown as Record<string, unknown>)["honorPerSesi"] =
        d.honorPerSesiDefault;
    }
  }
  for (const k of MEMBER_PROFILE_KEYS) {
    if (profile[k] !== undefined) {
      (local as unknown as Record<string, unknown>)[k] = profile[k];
    }
  }
  if (typeof sanggarUsername === "string") {
    // Server punya penunjukan sanggar — petakan ke id lokal bila sanggarnya
    // dikenal di perangkat ini; bila tidak, kosongkan agar tidak salah tampil
    // di daftar sanggar lain.
    local.sanggarId = localSanggar?.id;
  }
}

// Hidrasi daftar anggota dari server (dipanggil saat sesi sanggar/kurator
// aktif). Satu arah server → lokal; kegagalan (offline) diabaikan.
export async function hydrateMembers(): Promise<void> {
  try {
    const list = await membersApi.list();
    save((d) => {
      for (const api of list) applyMemberFromServer(d, api);
    });
  } catch {
    // Offline / sesi tidak berhak — pakai data lokal.
  }
}

// Tulis perubahan keanggotaan: mutasi lokal dulu (UI reaktif), lalu PATCH
// /members/:apiId dengan role + profil penuh. Rollback bila server menolak.
// { server: false } bila anggota belum punya apiId (akun lokal-saja, mis.
// pendaftar lama sebelum migrasi) — pemanggil WAJIB menampilkan toast jujur.
export async function persistMember(
  localId: string,
  mutate: (u: MemberUser, d: DBShape) => void,
): Promise<{ server: boolean }> {
  const before = load().users.find((u) => u.id === localId);
  const snapshot = before ? structuredClone(before) : undefined;
  save((d) => {
    const u = d.users.find((x) => x.id === localId);
    if (u && (u.role === "pelatih" || u.role === "seniman")) {
      mutate(u as MemberUser, d);
    }
  });
  if (storeDemoMode) return { server: false };
  const db = load();
  const member = db.users.find((u) => u.id === localId) as
    | MemberUser
    | undefined;
  if (!member || !member.apiId) return { server: false };
  try {
    await membersApi.update(member.apiId, {
      role: member.role,
      profile: memberServerProfile(member, db),
    });
    return { server: true };
  } catch (err) {
    if (snapshot) {
      save((d) => {
        const idx = d.users.findIndex((x) => x.id === localId);
        if (idx >= 0) d.users[idx] = snapshot;
      });
    }
    throw err;
  }
}

// Buat akun anggota baru (Tambah Langsung oleh sanggar / registrasi mandiri).
// Server harus menerima akun lebih dulu. Store lokal hanya menerima salinan
// ter-sanitasi supaya password asli tidak pernah dipersist ke localStorage.
export async function createMemberAccount(
  newUser: MemberUser,
  password: string,
  opts: { register?: boolean } = {},
): Promise<{ server: boolean }> {
  if (storeDemoMode) {
    newUser.password = password;
    save((d) => {
      d.users.push(newUser);
    });
    return { server: false };
  }
  const db = load();
  const body = {
    username: newUser.username,
    password,
    role: newUser.role,
    profile: memberServerProfile(newUser, db),
  };
  const api = opts.register
    ? await authApi.register(body)
    : await membersApi.create(body);
  newUser.apiId = api.id;
  newUser.password = API_PASSWORD_PLACEHOLDER;
  save((d) => {
    d.users.push(newUser);
  });
  return { server: true };
}

// ── Arsip Dokumen Administrasi (di-backing tabel `dokumen_arsip`) ────────────
// Kunci kepemilikan di server = username sanggar (stabil lintas perangkat);
// di lokal entri memakai `sanggarId` (id lokal). Pola sama dengan modul lain:
// hidrasi satu-arah saat login + write-through dengan rollback.

// Terapkan satu entri arsip server ke store lokal. `sanggarUsername`
// dipetakan ke id sanggar lokal; bila sanggarnya tidak dikenal di perangkat
// ini, entri dilewati (tidak bisa ditampilkan tanpa pemilik lokal).
function applyDokumenArsipFromServer(d: DBShape, api: ApiDokumenArsip): void {
  const sanggar = d.users.find(
    (u) =>
      u.role === "sanggar" &&
      u.username.toLowerCase() === api.sanggarUsername.toLowerCase(),
  );
  if (!sanggar) return;
  const entry: DokumenArsip = {
    id: api.id,
    sanggarId: sanggar.id,
    templateId: api.templateId,
    judul: api.judul,
    bentukId: api.bentukId as DokumenArsip["bentukId"],
    nilai: { ...api.nilai },
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
  };
  const idx = d.dokumenArsip.findIndex((a) => a.id === api.id);
  if (idx >= 0) d.dokumenArsip[idx] = entry;
  else d.dokumenArsip.push(entry);
}

// Hidrasi arsip dokumen dari server (dipanggil saat sesi sanggar/kurator
// aktif). Server = sumber kebenaran untuk sanggar yang datanya ada di server:
// entri lokal milik sanggar tersebut yang TIDAK ada lagi di server dihapus
// (mis. dihapus dari perangkat lain). Entri sanggar lain / lokal-saja tetap.
export async function hydrateDokumenArsip(): Promise<void> {
  try {
    const list = await dokumenArsipApi.list();
    save((d) => {
      const serverIds = new Set(list.map((a) => a.id));
      const serverOwners = new Set(
        list.map((a) => a.sanggarUsername.toLowerCase()),
      );
      d.dokumenArsip = d.dokumenArsip.filter((a) => {
        if (serverIds.has(a.id)) return true;
        const owner = d.users.find((u) => u.id === a.sanggarId);
        // Buang hanya bila pemiliknya memang tersinkron di server (punya
        // apiId) — arsip lama murni lokal dipertahankan.
        return !(
          owner &&
          owner.apiId &&
          serverOwners.has(owner.username.toLowerCase())
        );
      });
      for (const api of list) applyDokumenArsipFromServer(d, api);
    });
  } catch {
    // Offline / sesi tidak berhak — pakai data lokal.
  }
}

// Tulis (buat/perbarui) satu entri arsip: mutasi lokal dulu (UI reaktif),
// lalu PUT ke server. Rollback bila server menolak (4xx). Bila offline atau
// sesi tidak berhak menulis untuk sanggar ini, entri tetap lokal dengan
// { server: false } — pemanggil WAJIB menampilkan toast jujur.
export async function persistDokumenArsip(
  entry: DokumenArsip,
): Promise<{ server: boolean }> {
  const prevIdx = load().dokumenArsip.findIndex((a) => a.id === entry.id);
  const prev =
    prevIdx >= 0 ? structuredClone(load().dokumenArsip[prevIdx]) : undefined;
  save((d) => {
    const idx = d.dokumenArsip.findIndex((a) => a.id === entry.id);
    if (idx >= 0) d.dokumenArsip[idx] = { ...entry };
    else d.dokumenArsip.push({ ...entry });
  });
  if (storeDemoMode) return { server: false };
  const db = load();
  const owner = db.users.find((u) => u.id === entry.sanggarId);
  if (!owner) return { server: false };
  try {
    await dokumenArsipApi.put(entry.id, {
      templateId: entry.templateId,
      judul: entry.judul,
      bentukId: entry.bentukId,
      nilai: entry.nilai,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      // Dihormati server hanya untuk sesi kurator (impersonation Login As);
      // sesi sanggar dipaksa memakai username-nya sendiri.
      sanggarUsername: owner.username,
    });
    return { server: true };
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      save((d) => {
        const idx = d.dokumenArsip.findIndex((a) => a.id === entry.id);
        if (idx >= 0) {
          if (prev) d.dokumenArsip[idx] = prev;
          else d.dokumenArsip.splice(idx, 1);
        }
      });
      throw err;
    }
    // Jaringan/server mati — simpan lokal saja (toast jujur oleh pemanggil).
    return { server: false };
  }
}

// Hapus satu entri arsip: lokal dulu, lalu DELETE di server. 404 dianggap
// sukses (sudah tidak ada). Rollback bila server menolak (4xx lain).
export async function deleteDokumenArsip(
  id: string,
): Promise<{ server: boolean }> {
  const prev = load().dokumenArsip.find((a) => a.id === id);
  const snapshot = prev ? structuredClone(prev) : undefined;
  save((d) => {
    d.dokumenArsip = d.dokumenArsip.filter((a) => a.id !== id);
  });
  if (storeDemoMode) return { server: false };
  try {
    await dokumenArsipApi.remove(id);
    return { server: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return { server: true };
      if (err.status >= 400 && err.status < 500) {
        if (snapshot) {
          save((d) => {
            d.dokumenArsip.push(snapshot);
          });
        }
        throw err;
      }
    }
    // Offline — terhapus lokal; server menyusul saat hidrasi berikutnya
    // TIDAK menghidupkan lagi? (entri server masih ada → akan muncul kembali;
    // toast jujur memberi tahu pengguna bahwa penghapusan belum tersinkron.)
    return { server: false };
  }
}

export function logActivity(
  actorId: string,
  actorRole: Role | "guest",
  action: string,
  meta?: Record<string, unknown>,
) {
  save((db) => {
    db.activity.unshift({
      id: uid(),
      actorId,
      actorRole,
      action,
      meta,
      ts: Date.now(),
    });
    if (db.activity.length > 500) db.activity.length = 500;
  });
}

export function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}
export function fmtDate(ts: number | string) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
export function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function recomputeSaldo(sanggarId: string): number {
  const db = load();
  const entries = db.kas
    .filter((k) => k.sanggarId === sanggarId)
    .sort((a, b) => a.tanggal - b.tanggal);
  let saldo = 0;
  for (const e of entries) saldo += e.debit - e.kredit;
  return saldo;
}

export function pushKas(
  sanggarId: string,
  keterangan: string,
  debit: number,
  kredit: number,
  refType: string,
  refId: string,
) {
  save((db) => {
    const last = db.kas
      .filter((k) => k.sanggarId === sanggarId)
      .reduce((s, k) => s + k.debit - k.kredit, 0);
    const saldo = last + debit - kredit;
    db.kas.push({
      id: uid(),
      sanggarId,
      tanggal: Date.now(),
      keterangan,
      debit,
      kredit,
      saldo,
      refType,
      refId,
    });
    const sg = db.users.find(
      (u) => u.id === sanggarId && u.role === "sanggar",
    ) as SanggarUser | undefined;
    if (sg) sg.saldo = saldo;
  });
}
