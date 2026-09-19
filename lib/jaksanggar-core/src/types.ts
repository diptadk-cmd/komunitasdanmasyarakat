export type Role =
  | "kurator"
  | "admin"
  | "sanggar"
  | "pelatih"
  | "seniman"
  | "juri"
  | "pengrajin"
  | "mitra_pengrajin"
  | "sewa";

export type JenisKesenian =
  | "Tari"
  | "Musik"
  | "Teater"
  | "Rupa"
  | "Sastra"
  | "Silat";
export type Bank = "BCA" | "Mandiri" | "DKI" | "BRI" | "BNI" | "BSI" | "CIMB";
export type StatusAktaNotaris =
  | "Berakta Notaris"
  | "Tidak Berakta Notaris";

export type Legalitas =
  | "Yayasan"
  | "Perkumpulan / Perserikatan"
  | "Koperasi"
  | "PT"
  | "PT Perorangan"
  | "CV"
  | "Firma (FA)"
  | "Persekutuan Perdata"
  | "Perum"
  | "Perumda"
  | "Badan Layanan Umum (BLU)"
  | "Bentuk Usaha Tetap (BUT)"
  | "BUMDes / BUMDes Bersama"
  | "Badan Hukum Lainnya"
  | "Sanggar / Padepokan / Kelompok Seni"
  | "Komunitas"
  | "Paguyuban"
  | "Kelompok / Perkumpulan Informal"
  | "Organisasi Kemasyarakatan Tidak Berbadan Hukum"
  | "Kelompok Usaha Bersama (KUBE)"
  | "Organisasi Lain Tanpa Akta Notaris"
  // Nilai lama dipertahankan agar profil yang sudah tersimpan tetap kompatibel.
  | "Non-Badan Hukum";

export interface Rekening {
  bank: Bank;
  nomor: string;
  atasNama: string;
}

export interface BaseUser {
  id: string;
  role: Role;
  username: string;
  password: string;
  email?: string;
  noHp?: string;
  createdAt: number;
  /** ID user di server (tabel `users`). Dipakai untuk panggilan self-API
   *  seperti PATCH profil. Diisi saat sesi dicocokkan dengan API; akun
   *  lokal-saja (mis. "sewa") tidak punya nilai ini. */
  apiId?: string;
  statusModerasiAkun?: "aktif" | "diblokir";
  kategoriBlokirAkun?:
    | "pengaduan"
    | "mencurigakan"
    | "manipulasi_data"
    | "penipuan_kriminalitas";
  alasanBlokirAkun?: string;
  diblokirAt?: number;
  diblokirOleh?: string;
}

export interface KuratorUser extends BaseUser {
  role: "kurator";
}

export interface AdminPermissions {
  kelolaBerita: boolean;
  kelolaBanner: boolean;
  kelolaSlider: boolean;
  kelolaJamPembinaan: boolean;
  kelolaInfoBudaya: boolean;
}
export interface AdminUser extends BaseUser {
  role: "admin";
  nama: string;
  permissions: AdminPermissions;
}

export interface FotoGaleriItem {
  id: string;
  dataUrl: string;
  caption?: string;
  createdAt: number;
}

export interface AlamatTerstruktur {
  provinsi?: string;
  provinsiId?: string;
  kota?: string;
  kotaId?: string;
  kecamatan?: string;
  kecamatanId?: string;
  kelurahan?: string;
  kelurahanId?: string;
  kodePos?: string;
}

// Satu entri rekam jejak (karya / keterlibatan / juara / penghargaan lain).
export interface RekamJejakItem {
  id: string;
  tahun?: string;
  nama: string;
  keterangan?: string;
}

// Rekam jejak sanggar — bagian dari profil (ikut write-through ke server).
export interface RekamJejak {
  karya: RekamJejakItem[];
  keterlibatan: RekamJejakItem[];
  juara: RekamJejakItem[];
  penghargaan: RekamJejakItem[];
}

export type JenjangPendidikanAnggota =
  | "SD"
  | "SMP"
  | "SMA/Setara"
  | "D3"
  | "D4/S1"
  | "S2"
  | "S3";

/** Riwayat pendidikan formal Seniman/Pelatih. Nomor ijazah tetap privat. */
export interface RiwayatPendidikanAnggota {
  id: string;
  jenjang: JenjangPendidikanAnggota;
  namaInstitusi: string;
  nomorIjazah: string;
  tahunLulus: string;
}

/** Portofolio profesional yang dapat dilengkapi sendiri dan oleh Sanggar. */
export interface PortofolioAnggota {
  karya: RekamJejakItem[];
  prestasi: RekamJejakItem[];
  sertifikasi: RekamJejakItem[];
  piagam: RekamJejakItem[];
  penghargaan: RekamJejakItem[];
}

export type PredikatRaporAnggota =
  | "Sangat Baik"
  | "Baik"
  | "Cukup"
  | "Perlu Pembinaan";

/** Rapor pembinaan yang diterbitkan Sanggar kepada Seniman/Pelatih aktif. */
export interface RaporAnggota {
  id: string;
  sanggarId: string;
  sanggarNama: string;
  periode: string;
  judul: string;
  nilaiDisiplin: number;
  nilaiTeknik: number;
  nilaiKreativitas: number;
  nilaiKerjaSama: number;
  nilaiRataRata: number;
  predikat: PredikatRaporAnggota;
  catatan?: string;
  issuedAt: number;
}

// Jenis pemilik profil sanggar — menentukan pemakaian kop surat pada dokumen
// cetak (kop hanya untuk "organisasi") dan jabatan pada blok tanda tangan.
// Dipilih manual oleh sanggar, BUKAN diturunkan dari peran akun atau Legalitas.
export type JenisPemilik = "organisasi" | "perorangan";

// Bentuk & kedudukan sanggar — dipakai Tools Dokumen Administrasi untuk
// menyesuaikan isi/dasar hukum dokumen. Dipilih manual oleh sanggar
// (default diturunkan dari Legalitas bila belum pernah dipilih).
export type BentukKedudukanId =
  | "mandiri-non-bh" // Sanggar mandiri, non badan hukum
  | "unit-non-bh" // Unit di bawah organisasi non badan hukum
  | "mandiri-bh" // Sanggar mandiri berbadan hukum (yayasan/perkumpulan)
  | "mandiri-bu" // Sanggar mandiri berbadan usaha (PT/CV)
  | "unit-bh" // Unit di bawah organisasi berbadan hukum
  | "unit-bu"; // Unit di bawah organisasi berbadan usaha

// Arsip dokumen administrasi yang pernah dicetak lewat Tools Dokumen
// Administrasi. Menyimpan isian form agar dokumen bisa dibuka kembali
// (prefill) dan dicetak ulang tanpa mengetik dari nol. Lokal-dulu;
// sinkron ke server menyusul bersama tahap migrasi modulnya.
export interface DokumenArsip {
  id: string;
  sanggarId: string;
  templateId: string;
  judul: string;
  bentukId: BentukKedudukanId;
  nilai: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface SanggarUser extends BaseUser {
  role: "sanggar";
  namaSanggar: string;
  namaKetua: string;
  nip?: string; // NIP ketua/pemilik (opsional, untuk pejabat/ASN)
  jenisPemilik?: JenisPemilik;
  bentukKedudukan?: BentukKedudukanId;
  statusAktaNotaris?: StatusAktaNotaris;
  legalitas: Legalitas;
  namaBadanHukum?: string;
  jenisKesenian: JenisKesenian[];
  alamat: string;
  wilayah?: AlamatTerstruktur;
  lat?: number;
  lng?: number;
  rekening: Rekening;
  saldo: number;
  editCount: number;
  editPeriodStart: number;
  fotoProfileDataUrl?: string;
  /** Foto sampul beranda; string kosong berarti sengaja memakai ilustrasi. */
  fotoSampulDataUrl?: string;
  /** Identitas visual milik sanggar untuk kontrak/BAST, bukan logo Jak Sanggar. */
  logoDataUrl?: string;
  /** Kop surat utuh milik sanggar untuk dokumen resmi. */
  kopSuratDataUrl?: string;
  stempelDataUrl?: string;
  fotoGaleri?: FotoGaleriItem[];
  deskripsi?: string;
  tahunBerdiri?: number;
  website?: string;
  instagram?: string;
  npwp?: string;
  rekamJejak?: RekamJejak;
}

// Apakah harga dasar item katalog sudah termasuk akomodasi pulang-pergi
// (transport ke lokasi acara) atau belum. Default: "diluar".
export type AkomodasiMode = "termasuk" | "diluar";

export interface PelatihUser extends BaseUser {
  role: "pelatih";
  nama: string;
  usia: number;
  pendidikan: string;
  jenisKesenian: JenisKesenian;
  sanggarId?: string;
  /** ID record Sanggar di server saat afiliasi dipilih dari daftar publik. */
  sanggarServerId?: string;
  status: "pending" | "aktif" | "ditolak" | "keluar";
  rekening: Rekening;
  honorPerSesi: number;
  fotoProfileDataUrl?: string;
  fotoGaleri?: FotoGaleriItem[];
  bio?: string;
  alamat?: string;
  wilayah?: AlamatTerstruktur;
  npwp?: string;
  // Default akomodasi pulang-pergi yang berlaku saat sanggar memublikasikan
  // pelatih ini ke katalog sewa. Penyewa boleh override saat memesan.
  akomodasiPP?: AkomodasiMode;
  biayaAkomodasi?: number;
  /** Pelatih boleh menawarkan kelas privat tanpa perantara Sanggar. */
  menerimaKelasPrivat?: boolean;
  namaLayananPrivat?: string;
  hargaKelasPrivat?: number;
  riwayatPendidikan?: RiwayatPendidikanAnggota[];
  portofolio?: PortofolioAnggota;
  rapor?: RaporAnggota[];
}

export interface SenimanUser extends BaseUser {
  role: "seniman";
  nama: string;
  usia: number;
  pendidikan: string;
  profesi?: string;
  jenisKesenian: JenisKesenian;
  sanggarId?: string;
  /** ID record Sanggar di server saat afiliasi dipilih dari daftar publik. */
  sanggarServerId?: string;
  status: "pending" | "aktif" | "ditolak" | "keluar";
  rekening: Rekening;
  fotoProfileDataUrl?: string;
  fotoGaleri?: FotoGaleriItem[];
  bio?: string;
  alamat?: string;
  wilayah?: AlamatTerstruktur;
  jenisKelamin?: "Laki-laki" | "Perempuan";
  tanggalLahir?: string;
  npwp?: string;
  akomodasiPP?: AkomodasiMode;
  biayaAkomodasi?: number;
  riwayatPendidikan?: RiwayatPendidikanAnggota[];
  portofolio?: PortofolioAnggota;
  rapor?: RaporAnggota[];
}

export interface JuriUser extends BaseUser {
  role: "juri";
  nama: string;
  keahlian: string;
  rekening?: Rekening;
  fotoProfileDataUrl?: string;
  fotoGaleri?: FotoGaleriItem[];
  bio?: string;
  pendidikan?: string;
  pengalaman?: string;
  alamat?: string;
  npwp?: string;
}

export type JenisKerajinan =
  | "Batik Betawi"
  | "Ondel-ondel"
  | "Miniatur"
  | "Aksesori"
  | "Kuliner Tradisional"
  | "Alat Musik"
  | "Kerajinan Lainnya";

export type BentukUsahaPengrajin =
  | Legalitas
  | "Perorangan"
  // Nilai lama dipertahankan agar profil yang sudah tersimpan tetap kompatibel.
  | "Badan Hukum"
  | "Non Badan Hukum";

export type JenisDokumenPengrajin =
  | "NPWP"
  | "NIB"
  | "Surat Domisili 5 Tahun RT/RW"
  | "Surat Domisili Kelurahan JAKEVO/PTSP"
  | "Bukti Rekening"
  | "Akta / Legalitas"
  | "Dokumen Lainnya";

/** Dokumen verifikasi privat. URL ini tidak pernah dikirim oleh API publik. */
export interface DokumenPengrajin {
  id: string;
  jenis: JenisDokumenPengrajin;
  nama: string;
  url?: string;
  dataUrl?: string;
  contentType: string;
  size: number;
  uploadedAt: number;
}

export type SatuanProdukKerajinan = "buah" | "set" | "paket" | "hari" | "acara";

/** Produk/layanan buatan pengrajin yang dapat dipublikasikan per kanal. */
export interface ProdukKerajinan {
  id: string;
  nama: string;
  kategori: JenisKerajinan;
  deskripsi: string;
  harga: number;
  satuan: SatuanProdukKerajinan;
  stok?: number;
  fotoUrl?: string;
  fotoDataUrl?: string;
  /** Hanya produk yang dikonfirmasi sebagai khas Jakarta boleh ditayangkan. */
  khasJakarta?: boolean;
  statusPublish: boolean;
  tersediaSewaJasa: boolean;
  terbukaKerjasama: boolean;
  /** Jika aktif, ongkir pada cakupan yang dijelaskan sudah menjadi beban penjual. */
  ongkirTermasukHarga?: boolean;
  cakupanOngkir?: string;
  batasOngkir?: number;
  createdAt: number;
}

export type StatusPkpUsaha = "pkp" | "non_pkp";

/** Profil usaha kerajinan yang ditampilkan pada peta publik Jakarta. */
export interface PengrajinUser extends BaseUser {
  role: "pengrajin";
  namaUsaha: string;
  namaPemilik: string;
  statusAktaNotaris?: StatusAktaNotaris;
  bentukUsaha: BentukUsahaPengrajin;
  namaBadanUsaha?: string;
  jenisKerajinan: JenisKerajinan;
  produkUnggulan: string;
  produk: ProdukKerajinan[];
  alamat: string;
  wilayah: AlamatTerstruktur;
  lat: number;
  lng: number;
  npwp: string;
  statusPkp?: StatusPkpUsaha;
  pemotongPajak?: boolean;
  nib: string;
  rekening: Rekening;
  dokumen: DokumenPengrajin[];
  tokoDipublikasikan: boolean;
  menerimaSewaJasa: boolean;
  menerimaKerjasama: boolean;
  deskripsi?: string;
  website?: string;
  instagram?: string;
  fotoProfileDataUrl?: string;
  /** Identitas visual milik pengrajin untuk kontrak/BAST. */
  logoDataUrl?: string;
  stempelDataUrl?: string;
  jabatanPenandatangan?: string;
}

export interface MarketplaceMitra {
  id: string;
  nama: string;
  namaToko: string;
  url: string;
  aktif: boolean;
}

export type StatusVerifikasiTokoOffline =
  | "belum_lengkap"
  | "menunggu_verifikasi"
  | "terverifikasi"
  | "ditolak";

export interface ItemPaketProdukMitra {
  pengrajinId: string;
  produkId: string;
  namaPengrajin: string;
  namaProduk: string;
  jumlah: number;
  hargaDasar: number;
  satuan: SatuanProdukKerajinan;
}

/** Paket gabungan dari produk beberapa Pengrajin yang dijual oleh Mitra. */
export interface PaketProdukMitra {
  id: string;
  nama: string;
  deskripsi: string;
  items: ItemPaketProdukMitra[];
  hargaJual: number;
  marketplaceIds: string[];
  aktif: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Akun Mitra lintas penyedia: Pengrajin, Sanggar, Seniman, dan Pelatih. */
export interface MitraPengrajinUser extends BaseUser {
  role: "mitra_pengrajin";
  namaUsaha: string;
  namaPenanggungJawab: string;
  statusAktaNotaris?: StatusAktaNotaris;
  bentukUsaha: BentukUsahaPengrajin;
  namaBadanUsaha?: string;
  alamat: string;
  /** Syarat Mitra baru; opsional hanya untuk kompatibilitas data lama. */
  memilikiTokoOffline?: boolean;
  namaTokoOffline?: string;
  alamatTokoOffline?: string;
  wilayahTokoOffline?: AlamatTerstruktur;
  latTokoOffline?: number;
  lngTokoOffline?: number;
  statusVerifikasiTokoOffline?: StatusVerifikasiTokoOffline;
  catatanVerifikasiTokoOffline?: string;
  diverifikasiTokoOfflineAt?: number;
  diverifikasiTokoOfflineOleh?: string;
  /** Tanggal dicatat otomatis saat akun Mitra diajukan (YYYY-MM-DD). */
  tanggalPermohonanMitra?: string;
  /** Tanggal terbit NIB (YYYY-MM-DD), maksimal enam bulan sebelum pengajuan. */
  tanggalTerbitNib?: string;
  wilayah?: AlamatTerstruktur;
  npwp: string;
  statusPkp?: StatusPkpUsaha;
  pemotongPajak?: boolean;
  nib: string;
  rekening: Rekening;
  dokumen: DokumenPengrajin[];
  marketplace: MarketplaceMitra[];
  paketProduk: PaketProdukMitra[];
  deskripsi?: string;
  logoDataUrl?: string;
  stempelDataUrl?: string;
  jabatanPenandatangan?: string;
}

// Akun Konsumen (umum / organisasi / instansi) untuk penggunaan akhir dan
// bukan penjualan kembali. Nilai role lama dipertahankan agar data kompatibel.
export type JenisInstansiSewa = "Pusat" | "Daerah" | "SKPD" | "UKPD";

export interface SewaUser extends BaseUser {
  role: "sewa";
  nama: string; // nama konsumen / institusi
  alamat?: string;
  wilayah?: AlamatTerstruktur;
  jenisInstansi?: JenisInstansiSewa;
  fotoProfileDataUrl?: string;
}

export type AnyUser =
  | KuratorUser
  | AdminUser
  | SanggarUser
  | PelatihUser
  | SenimanUser
  | JuriUser
  | PengrajinUser
  | MitraPengrajinUser
  | SewaUser;

export type NewsKategori = "Berita" | "Pengumuman" | "Agenda";

export interface News {
  id: string;
  judul: string;
  isi: string;
  imageUrl?: string;
  kategori?: NewsKategori;
  createdAt: number;
  authorId: string;
}

export type InfoBudayaKategori =
  | "Tari"
  | "Musik"
  | "Teater"
  | "Kuliner"
  | "Pakaian"
  | "Upacara"
  | "Sejarah"
  | "Bahasa"
  | "Permainan";

export type InfoBudayaMediaKind =
  | "youtube"
  | "spotify"
  | "soundcloud"
  | "audio"
  | "video"
  | "image"
  | "link";

export interface InfoBudaya {
  id: string;
  judul: string;
  ringkasan: string;
  isi: string;
  /** URL media yang ditampilkan langsung (YouTube, audio, video, Spotify, atau SoundCloud). */
  mediaUrl?: string;
  /** MIME type unggahan; diperlukan karena URL penyimpanan tidak memakai ekstensi berkas. */
  mediaContentType?: string;
  /** Jenis media hasil deteksi upload/server; fallback untuk URL tanpa ekstensi. */
  mediaKind?: InfoBudayaMediaKind;
  imageUrl?: string;
  imageDataUrl?: string;
  kategori: InfoBudayaKategori;
  sumber?: string;
  /** Alur publikasi karya sanggar. Data lama tanpa status mengikuti nilai `active`. */
  publicationStatus?: "draft" | "pending" | "published" | "rejected";
  /** Catatan singkat moderator saat karya perlu diperbaiki. */
  reviewNote?: string;
  active: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
  authorId: string;
}

export interface Banner {
  id: string;
  teks: string;
  start: number;
  end: number;
  active: boolean;
}

export interface SliderImage {
  id: string;
  imageUrl: string;
  caption: string;
}

export interface Latihan {
  id: string;
  sanggarId: string;
  tanggal: string; // YYYY-MM-DD
  jam: string; // HH:mm
  tempat: string;
  kurikulum: string;
  ciriAdat: string;
  pelatihId?: string;
  editedAt?: number;
  laporan?: {
    fotoDataUrl: string;
    timestamp: number;
    lat: number;
    lng: number;
    accuracy?: number;
  };
}

export interface AbsensiPelatih {
  id: string;
  latihanId: string;
  pelatihId: string;
  hadirAt: number;
}

/** Kehadiran anggota (seniman/pelatih) pada sesi latihan sanggar. */
export interface AbsensiLatihan {
  id: string;
  latihanId: string;
  sanggarId: string;
  userId: string;
  role: "seniman" | "pelatih";
  hadirAt: number;
  metode?: "manual" | "gps";
  lat?: number;
  lng?: number;
  catatan?: string;
}

export interface Iuran {
  id: string;
  sanggarId: string;
  senimanId: string;
  judul: string;
  nominal: number;
  buktiDataUrl?: string;
  status: "pending" | "lunas" | "ditolak";
  createdAt: number;
  validatedAt?: number;
}

export interface PengajuanHonor {
  id: string;
  sanggarId: string;
  pelatihId: string;
  jumlahSesi: number;
  honorPerSesi: number;
  total: number;
  status: "pending" | "disetujui" | "ditolak";
  buktiTransferDataUrl?: string;
  createdAt: number;
  paidAt?: number;
}

export interface DistribusiHonor {
  id: string;
  sanggarId: string;
  penerimaId: string;
  penerimaRole: "pelatih" | "seniman";
  judulJob: string;
  nominal: number;
  buktiTransferDataUrl?: string;
  konfirmasi: boolean;
  createdAt: number;
}

export interface TransaksiManual {
  id: string;
  sanggarId: string;
  jenis: "pemasukan" | "pengeluaran";
  tanggal: string;
  kategori: string;
  nominal: number;
  sumberAtauTujuan: string;
  keterangan: string;
  buktiDataUrl?: string;
  createdAt: number;
}

export interface KasEntry {
  id: string;
  sanggarId: string;
  tanggal: number;
  keterangan: string;
  debit: number;
  kredit: number;
  saldo: number;
  refType: string;
  refId: string;
}

export type IndikatorTipe = "manajemen" | "seni";
export interface KurasiPersyaratanBuktiDukung {
  id: string;
  nama: string;
  /** Patokan khusus untuk bukti ini; bila kosong memakai fallback matriks lama. */
  patokanNilai?: PatokanNilaiKurasi[];
}
export interface Variabel {
  id: string;
  nama: string;
  /** Bobot internal dalam pilar; seluruh variabel pada satu pilar berjumlah 100%. */
  bobot: number;
  /** Persentase yang tertulis pada dokumen sumber sebelum normalisasi internal. */
  bobotSumber?: number;
  /** Daftar persyaratan bukti yang dapat dikelola Kurator. */
  persyaratanBuktiDukung?: KurasiPersyaratanBuktiDukung[];
  /** Patokan untuk variabel yang tidak memiliki persyaratan bukti. */
  patokanNilai?: PatokanNilaiKurasi[];
  /** Format lama satu teks; tetap dibaca dan dimigrasikan. */
  persyaratanDataDukung?: string;
  halamanSumber?: number;
  contoh?: KurasiDataDukung;
}
export interface Pilar {
  id: string;
  nama: string;
  /** Persentase yang tertulis pada dokumen sumber sebelum normalisasi internal. */
  bobotSumber?: number;
  bobot: number;
  variabel: Variabel[];
}
export interface Indikator {
  id: string;
  nama: string;
  bobot: number;
  tipe: IndikatorTipe;
  versi?: string;
  sumber?: string;
  catatanBobot?: string;
  pilar: Pilar[];
}

/** Satu band predikat (hasil akhir) yang dapat diatur Kurator: nama + ambang bawah (bobot). */
export interface PredikatBand {
  id: string;
  nama: string;
  min: number; // ambang bawah Nilai Akhir (0..100) — band tertinggi yang min-nya <= NA dipilih
  warna: string; // CSS color (mis. hsl(...))
  tingkat: string; // keterangan tingkat (mis. "Tingkat Provinsi")
}

/** Pilihan nilai Juri dan persentase bobot yang diberikan oleh pilihan itu. */
export interface PatokanNilaiKurasi {
  id: string;
  nilai: number;
  nama: string;
  persentaseBobot: number;
}

export interface KurasiMatrix {
  indikator: Indikator[];
  predikat?: PredikatBand[];
  patokanNilai?: PatokanNilaiKurasi[];
  updatedAt: number;
}

export interface PenugasanJuri {
  id: string;
  /** ID record server MariaDB (jika sudah tersinkron). */
  apiId?: string;
  juriId: string;
  sanggarId: string;
  periode: string;
  createdAt: number;
}

export interface KurasiDataDukung {
  name: string;
  /** URL unggahan privat. `dataUrl` hanya untuk data lama/contoh bawaan. */
  url?: string;
  dataUrl?: string;
  size: number;
}

export interface KurasiPesertaSeni {
  /** Username dipakai sebagai kunci stabil lintas perangkat. */
  userId: string;
  username?: string;
  nama: string;
  jenisKesenian: string;
  /** NIK 16 digit untuk mencegah satu orang didisposisikan lebih dari sekali. */
  nik?: string;
  ktpUrl?: string;
  selfieUrl?: string;
  disposisiAt?: number;
  disposisiOleh?: string;
  /** Format lama; tetap dibaca selama proses migrasi. */
  ktpDataUrl?: string;
  selfieDataUrl?: string;
}

export interface KurasiSubmission {
  id: string;
  /** ID record server MariaDB (jika sudah tersinkron). */
  apiId?: string;
  sanggarId: string;
  tahap1: Record<string, string>;
  tahap1Files?: Record<string, KurasiDataDukung[]>; // variabelId -> berkas data dukung
  tahap2VideoName?: string;
  tahap2VideoUrl?: string;
  /** Seniman terdaftar yang ditugaskan pada tahap Seni Pertunjukan. */
  pesertaSeni?: KurasiPesertaSeni[];
  /** Pernyataan resmi Sanggar bahwa peserta bukan joki/titipan. */
  deklarasiAntiJokiAt?: number;
  deklarasiAntiJokiOleh?: string;
  /** Salinan matriks saat pengajuan pertama kali dikirim; perubahan baru tidak mengubah penilaian berjalan. */
  matrixSnapshot?: KurasiMatrix;
  /** username juri -> variabelId -> persentase bobot yang diperoleh (0..100). */
  scores: Record<string, Record<string, number>>;
  /** username juri -> variabelId -> persyaratanId -> persentase bobot. */
  requirementScores?: Record<string, Record<string, Record<string, number>>>;
  finalized: Record<string, number>; // username juri -> timestamp
  createdAt: number;
}

export interface Sertifikat {
  id: string;
  pemilikId: string;
  pemilikNama: string;
  jenis: string; // "Sertifikasi Profesi: ..." or "Kurasi"
  predikat?: string;
  nilai?: number;
  issuedAt: number;
  sanggarId?: string;
  kategori?: "sertifikat" | "penghargaan";
  nomor?: string;
  keterangan?: string;
  penerbitId?: string;
  penerbitNama?: string;
  penerbitRole?: "sanggar" | "kurator";
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorRole: Role | "guest";
  action: string;
  meta?: Record<string, unknown>;
  ts: number;
}

export interface JamPembinaan {
  pagiMax: string; // "08:00"
  siangStart: string;
  siangEnd: string;
  pulangStart: string;
  pulangEnd: string;
}

export interface AbsensiPembinaan {
  id: string;
  sanggarId: string;
  pesertaId: string;
  slot: "pagi" | "siang" | "pulang";
  ts: number;
  fotoDataUrl: string;
  lat: number;
  lng: number;
  accuracy: number;
  validatedByAdminId?: string;
}

export interface PendaftaranPembinaan {
  id: string;
  sanggarId: string;
  delegasiId: string;
  setuju: boolean;
  barcode: string;
  createdAt: number;
}

// ===================== KERJASAMA SANGGAR =====================

export type SatuanHarga = "per_jam" | "per_hari" | "per_event";
export type AsetKategori = "alat_musik" | "kostum";
export type KondisiAset = "baik" | "perlu_perbaikan";

export interface Aset {
  id: string;
  sanggarId: string;
  kategori: AsetKategori;
  nama: string;
  jenis: string;
  jumlahTotal: number;
  jumlahTersedia: number;
  kondisi: KondisiAset;
  fotoDataUrl?: string;
  hargaSewa: number;
  satuanHarga: SatuanHarga;
  statusPublish: boolean;
  createdAt: number;
  akomodasiPP?: AkomodasiMode;
  biayaAkomodasi?: number;
}

export type JenisTempat = "tempat_latihan" | "aula" | "studio";

export interface Sarpras {
  id: string;
  sanggarId: string;
  namaTempat: string;
  jenisTempat: JenisTempat;
  kapasitas: number;
  fasilitas: string;
  alamat: string;
  fotoDataUrl?: string;
  hargaSewa: number;
  satuanHarga: SatuanHarga;
  statusPublish: boolean;
  createdAt: number;
  akomodasiPP?: AkomodasiMode;
  biayaAkomodasi?: number;
}

export type KerjasamaKategori =
  | "sdm"
  | "alat_musik"
  | "kostum"
  | "tempat_latihan";
export type KerjasamaStatus =
  | "menunggu"
  | "diterima"
  | "ditolak"
  | "negosiasi"
  | "berjalan"
  | "selesai"
  | "batal";
export type KerjasamaSumber =
  | "sdm-pelatih"
  | "sdm-seniman"
  | "sdm-juri"
  | "aset"
  | "sarpras";

export interface Kerjasama {
  id: string;
  nomor: string;
  sumberType: KerjasamaSumber;
  sumberId: string;
  sanggarPenyediaId: string;
  sanggarPeminjamId: string;
  kategori: KerjasamaKategori;
  judul: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi: string;
  jumlah: number;
  satuanHarga: SatuanHarga;
  deskripsi: string;
  hargaAwal: number;
  nilaiTotal: number;
  status: KerjasamaStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  kerjasamaId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  message: string;
  ts: number;
}

export type NegosiasiStatus = "diajukan" | "diterima" | "ditolak";

export interface Negosiasi {
  id: string;
  kerjasamaId: string;
  pengirimSanggarId: string;
  pengirimUserId: string;
  hargaTawar: number;
  catatan: string;
  status: NegosiasiStatus;
  createdAt: number;
}

export type InvoiceStatus = "terhutang" | "lunas";

export interface Invoice {
  id: string;
  kerjasamaId: string;
  nomor: string;
  total: number;
  status: InvoiceStatus;
  batasPembayaran: number;
  createdAt: number;
}

export type PaymentStatus = "menunggu" | "disetujui" | "ditolak";

export interface Payment {
  id: string;
  invoiceId: string;
  nominal: number;
  tanggalBayar: number;
  buktiDataUrl?: string;
  status: PaymentStatus;
  catatanVerifikator?: string;
  createdAt: number;
}

export interface Contract {
  id: string;
  kerjasamaId: string;
  nomor: string;
  createdAt: number;
}

export type BastStatus = "draft" | "final";

export interface Bast {
  id: string;
  kerjasamaId: string;
  nomor: string;
  status: BastStatus;
  createdAt: number;
  finalAt?: number;
}

export interface Rating {
  id: string;
  kerjasamaId: string;
  dariSanggarId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  ulasan: string;
  createdAt: number;
}

// ===================== PEMESANAN SEWA JASA =====================
//
// Alur pemesanan oleh akun Konsumen atau Mitra terhadap katalog Sanggar.
// Berbeda dengan Kerjasama (antar sanggar): di sini peminjam adalah
// pemesan adalah Konsumen/Mitra, penyedia adalah SanggarUser, dan untuk
// kategori SDM ada pihak ke-3 yaitu seniman/pelatih yang ditugaskan.
//
// Status flow:
//   menunggu_sanggar  -> sanggar menerima/menolak / menugaskan SDM
//   menunggu_sdm      -> seniman/pelatih harus konfirmasi (hanya SDM)
//   menunggu_ttd      -> menunggu semua pihak klik "Setuju" di kontrak
//   kontrak_aktif     -> semua tanda tangan lengkap; sanggar menerbitkan
//                        invoice
//   menunggu_bayar    -> invoice terbit, penyewa upload bukti bayar
//   lunas             -> bayar diverifikasi, menunggu pelaksanaan/penyerahan
//   sedang_disewa     -> objek sewa sudah diserahkan/dapat digunakan
//   menunggu_konfirmasi_pengembalian
//                     -> penyewa menyatakan objek dikembalikan/pemakaian selesai
//   dikembalikan      -> penyedia menerima pengembalian dan memeriksa kondisi
//   selesai           -> BAST final, kerjasama tuntas
//   ditolak / batal   -> alur dihentikan
export type PemesananSewaStatus =
  | "menunggu_sanggar"
  | "menunggu_sdm"
  | "menunggu_ttd"
  | "kontrak_aktif"
  | "menunggu_bayar"
  | "lunas"
  | "sedang_disewa"
  | "menunggu_konfirmasi_pengembalian"
  | "dikembalikan"
  | "selesai"
  | "ditolak"
  | "batal";

export interface PenyerahanObjekSewa {
  diserahkanAt: number;
  diserahkanOlehId: string;
  catatan: string;
  buktiDataUrl?: string;
}

export type KondisiPengembalianSewa = "baik" | "rusak_ringan" | "rusak_berat";

export interface PengembalianObjekSewa {
  status: "diajukan" | "diterima" | "perlu_tindak_lanjut";
  diajukanAt: number;
  diajukanOlehId: string;
  catatanPenyewa: string;
  buktiDataUrl?: string;
  diperiksaAt?: number;
  diperiksaOlehId?: string;
  kondisi?: KondisiPengembalianSewa;
  catatanPenyedia?: string;
}

export type PihakSewa = "sewa" | "sanggar" | "sdm";

export interface TandaTanganSewa {
  pihak: PihakSewa;
  // user id yang menandatangani (sewaId / sanggarId / pelatihId|senimanId)
  userId: string;
  nama: string;
  ts: number;
}

export interface PemesananSewa {
  id: string;
  nomor: string; // NOMOR pesanan, mis. SEWA/2026/0001
  // Sumber katalog yang dipesan
  katalogItemId: string; // id KatalogItem (mis. "sdm-seniman-..." / "aset-..." / "sarpras-...")
  sumberType: KerjasamaSumber; // sdm-pelatih | sdm-seniman | aset | sarpras
  sumberId: string; // id sumber (pelatih/seniman/aset/sarpras)
  // Pihak terlibat
  sewaId: string; // id pemesan; nama lama dipertahankan untuk kompatibilitas
  pemesanRole?: "sewa" | "mitra_pengrajin";
  tujuanTransaksi?: "penggunaan_sendiri" | "dijual_kembali";
  sanggarId: string; // SanggarUser.id (penyedia)
  penyediaRole?: "sanggar" | "pelatih";
  sdmUserId?: string; // pelatih/seniman id (untuk SDM); diisi sanggar saat assign
  // Detail pemesanan
  judul: string; // judul item katalog (snapshot)
  kategori: KerjasamaKategori;
  tanggalMulai: string; // YYYY-MM-DD
  tanggalSelesai: string; // YYYY-MM-DD
  lokasi: string; // alamat acara
  jumlah: number;
  satuanHarga: SatuanHarga;
  catatan: string;
  // Harga
  hargaDasar: number; // harga dari katalog (snapshot)
  akomodasiPP: AkomodasiMode; // pilihan final dari penyewa
  biayaAkomodasi: number; // tambahan biaya akomodasi (Rp)
  nilaiTotal: number; // (hargaDasar * jumlah) + (akomodasiPP=="termasuk" ? 0 : biayaAkomodasi)
  // Lifecycle
  status: PemesananSewaStatus;
  alasanTolak?: string; // alasan kalau ditolak/batal
  ttd: TandaTanganSewa[]; // daftar tanda tangan
  invoiceId?: string; // refer ke Invoice
  bastId?: string; // refer ke Bast
  penyerahanSewa?: PenyerahanObjekSewa;
  pengembalianSewa?: PengembalianObjekSewa;
  createdAt: number;
  updatedAt: number;
}

// ===================== PEMESANAN PRODUK PENGRAJIN =====================

export type KerjasamaMitraPengrajinStatus =
  | "diajukan"
  | "disetujui"
  | "ditolak"
  | "jadwal_diajukan"
  | "jadwal_disepakati"
  | "peninjauan_selesai"
  | "bersepakat"
  | "pembelian_dibuat";

export type MetodePeninjauanMitra = "langsung" | "rapat_daring";

export interface MediaKerjasamaMitraPengrajin {
  id: string;
  jenis: "foto" | "video";
  judul: string;
  url: string;
}

export interface JadwalPeninjauanMitraPengrajin {
  metode: MetodePeninjauanMitra;
  tanggalWaktu: string;
  tempat?: string;
  tautanRapat?: string;
  catatan?: string;
  diajukanAt: number;
  disepakatiPengrajinAt?: number;
  disepakatiMitraAt?: number;
}

/** Pengajuan kerja sama dari Pengrajin kepada Mitra sebelum pembelian barang. */
export interface KerjasamaMitraPengrajin {
  id: string;
  nomor: string;
  pengrajinId: string;
  mitraId: string;
  judul: string;
  pesan: string;
  produkIds: string[];
  media: MediaKerjasamaMitraPengrajin[];
  status: KerjasamaMitraPengrajinStatus;
  alasanTolak?: string;
  jadwal?: JadwalPeninjauanMitraPengrajin;
  catatanPeninjauan?: string;
  pesananId?: string;
  createdAt: number;
  updatedAt: number;
}

export type PesananProdukStatus =
  | "menunggu_ongkir"
  | "menunggu_persetujuan_ongkir"
  | "diajukan"
  | "menunggu_ttd"
  | "menunggu_bayar"
  | "menunggu_verifikasi_bayar"
  | "kontrak_aktif"
  | "diproses"
  | "dikirim"
  | "selesai"
  | "ditolak"
  | "batal";

export interface ItemPesananProduk {
  produkId: string;
  nama: string;
  jumlah: number;
  harga: number;
  satuan: SatuanProdukKerajinan;
}

export interface TandaTanganPesananProduk {
  pihak: "mitra" | "pengrajin";
  userId: string;
  nama: string;
  ts: number;
}

export interface DokumenPesananProduk {
  nomor: string;
  dibuatAt: number;
  finalAt?: number;
  catatan?: string;
}

export type MetodePengirimanProduk =
  | "instant"
  | "same_day"
  | "kurir_paket"
  | "kurir_toko";

export type MekanismePembayaranProduk =
  | "lunas"
  | "dp"
  | "setelah_barang_diterima"
  | "cod";

export interface DokumenUnggahanTransaksi {
  nama: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  uploadedBy: string;
  uploadedAt: number;
}

export interface PengirimanPesananProduk {
  metode: MetodePengirimanProduk;
  ongkirTermasukHarga: boolean;
  penanggungOngkir: "pembeli" | "penjual";
  statusOngkir: "termasuk_harga" | "menunggu_penjual" | "disepakati";
  biayaOngkir: number;
  cakupanOngkir?: string;
  batasOngkir?: number;
  ekspedisi?: string;
  layanan?: string;
  estimasiTiba?: string;
  nomorResi?: string;
  buktiResi?: DokumenUnggahanTransaksi;
  liveLocationUrl?: string;
  namaKurir?: string;
  noHpKurir?: string;
}

export interface KesepakatanPembayaranProduk {
  mekanisme: MekanismePembayaranProduk;
  dpPersen?: number;
  dpNominal?: number;
  jatuhTempoHari?: number;
  pembayaranLangsung: true;
  penampungDanaJakSanggar: false;
  disepakatiPembeliAt: number;
  disepakatiPenjualAt?: number;
}

export interface RingkasanPajakTransaksi {
  versiAturan: string;
  statusPkpPenjual: StatusPkpUsaha;
  objekPajak: "barang_non_mewah" | "barang_mewah" | "jasa" | "tidak_dikenai";
  subtotal: number;
  ongkir: number;
  nilaiSebelumPajak: number;
  tarifPpn: number;
  faktorDpp: number;
  dppPpn: number;
  ppn: number;
  jenisPemotonganPph?: "pph23_jasa" | "pph23_sewa" | "lainnya";
  tarifPph?: number;
  pphDipotong: number;
  totalInvoice: number;
  dibayarLangsungKePenjual: number;
  pajakOlehMasingMasingPihak: true;
}

export interface PembayaranLangsungPesananProduk {
  id: string;
  tahap: "dp" | "pelunasan" | "lunas" | "setelah_terima" | "cod";
  nominal: number;
  bukti?: DokumenUnggahanTransaksi;
  diajukanAt: number;
  diverifikasiAt?: number;
  diverifikasiOleh?: string;
}

/** Pesanan internal Mitra kepada satu Pengrajin. Penjualan publik tetap dilakukan
 * di marketplace eksternal milik Mitra; koleksi ini menyimpan pengadaan barang,
 * kontrak kedua nama usaha, dan BAST. */
export interface PesananProdukPengrajin {
  id: string;
  nomor: string;
  mitraId: string;
  tujuanTransaksi?: "dijual_kembali";
  pengrajinId: string;
  paketId?: string;
  kerjasamaId?: string;
  items: ItemPesananProduk[];
  alamatPengiriman: string;
  targetSelesai: string;
  catatan: string;
  subtotalProduk?: number;
  nilaiTotal: number;
  pengiriman?: PengirimanPesananProduk;
  pembayaran?: KesepakatanPembayaranProduk;
  ringkasanPajak?: RingkasanPajakTransaksi;
  rekeningTujuan?: Rekening;
  riwayatPembayaran?: PembayaranLangsungPesananProduk[];
  fakturPajak?: DokumenUnggahanTransaksi;
  buktiPotongPph?: DokumenUnggahanTransaksi;
  status: PesananProdukStatus;
  alasanTolak?: string;
  ttd: TandaTanganPesananProduk[];
  kontrak?: DokumenPesananProduk;
  invoice?: DokumenPesananProduk;
  kwitansi?: DokumenPesananProduk;
  bast?: DokumenPesananProduk;
  pembayaranAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type ThemeMode = "light" | "dark" | "luxury";

export type TradisiKategori =
  | "Pantun Betawi"
  | "Peribahasa"
  | "Palang Pintu"
  | "Sahibul Hikayat"
  | "Cerita Rakyat"
  | "Salam Betawi"
  | "Rancag"
  | "Lenong";

export interface TradisiItem {
  id: string;
  kategori: TradisiKategori;
  judul: string;
  isi: string;
  sumber?: string;
}

export type TradisiPosition = "br" | "bl" | "tr" | "tl";

export interface TradisiSettings {
  enabled: boolean;
  position: TradisiPosition;
  cooldownMs: number;
  autoHideMs: number;
  cardWidth: number;
  showCloseButton: boolean;
  source: "default" | "custom" | "merge";
  custom: TradisiItem[];
  kategoriColors?: Partial<Record<TradisiKategori, string>>;
}

export interface BrandSettings {
  appName: string;
  appTagline: string;
  sidebarFooterLine1: string;
  sidebarFooterLine2: string;
  iconKey: string;
  logoDataUrl?: string;
  loginEyebrow?: string;
}

export interface LayoutBackdropSettings {
  enabled: boolean;
  imageDataUrl?: string;
  opacity: number;
  blendMode: "normal" | "overlay" | "multiply" | "screen" | "soft-light";
}

export type Language = "btw" | "jkt" | "en";

export const DEFAULT_LANGUAGE: Language = "btw";
export const LANGUAGES: readonly Language[] = ["btw", "jkt", "en"];

/** Coerces any stored/legacy value into a supported language. Pre-3.1 data used "id". */
export function normalizeLang(value: unknown): Language {
  if (value === "btw" || value === "jkt" || value === "en") return value;
  if (value === "id") return "jkt";
  return DEFAULT_LANGUAGE;
}

export interface CustomThemeSettings {
  enabled: boolean;
  mode: ThemeMode;
  primaryHsl: string;
  accentHsl: string;
  bgImageDataUrl?: string;
  bgOpacity?: number;
  previousBaseline?: {
    theme: ThemeMode;
    themePreset: string;
    primaryHsl: string;
    accentHsl: string;
    dark: boolean;
  };
}

export interface StudioSettings {
  fontSerif?: string;
  fontSans?: string;
  fontScale?: number;
  borderRadius?: number;
  foregroundHsl?: string;
  backgroundHsl?: string;
  cardHsl?: string;
  borderHsl?: string;
  sidebarHsl?: string;
  sidebarFgHsl?: string;
  sidebarImageDataUrl?: string;
  sidebarImageOpacity?: number;
  loginHeroImageDataUrl?: string;
  loginHeroOverlayHsl?: string;
  loginHeroOverlayOpacity?: number;
}

/**
 * Pengaturan Tata Naskah Dinas — diatur kurator, dipakai seluruh dokumen
 * cetak sanggar. Mengacu pada kaidah Tata Naskah Dinas Pemerintah Provinsi
 * DKI Jakarta (huruf Times New Roman, kertas A4, margin dan penomoran baku).
 *
 * Alur data: kurator menyimpan lewat persistAppearance() → PUT /api/settings
 * → aplikasi sanggar membacanya kembali lewat hydrateSettings().
 *
 * Seluruh field opsional agar kompatibel dengan data lama; nilai default
 * diisi oleh migrateAppearance().
 */
export interface TataNaskahSettings {
  /** Kop surat siap pakai (gambar utuh). Bila diisi, dipakai menggantikan kop teks. */
  kopDataUrl?: string;
  /** Logo lembaga pada sisi kiri kop surat. */
  logoDataUrl?: string;
  /** Stempel/cap dinas yang ditempel pada blok tanda tangan. */
  stempelDataUrl?: string;

  /** Tampilkan stempel pada dokumen cetak. */
  pakaiStempel?: boolean;
  /** Opasitas stempel 0–1 agar tanda tangan di bawahnya tetap terbaca. */
  stempelOpacity?: number;
  /** Lebar stempel dalam milimeter. */
  stempelLebarMm?: number;
  /** Posisi stempel relatif terhadap blok tanda tangan. */
  stempelPosisi?: "kiri-ttd" | "tengah-ttd" | "kanan-ttd";

  /** Nama huruf dokumen (baku: Times New Roman). */
  fontKeluarga?: string;
  /** Ukuran huruf isi dalam pt (baku: 12). */
  fontUkuranPt?: number;
  /** Jarak baris (baku: 1.5). */
  spasiBaris?: number;

  /** Margin halaman dalam milimeter (baku DKI: atas 30, kiri 30, kanan 20, bawah 20). */
  marginAtasMm?: number;
  marginKiriMm?: number;
  marginKananMm?: number;
  marginBawahMm?: number;

  /** Nama instansi/lembaga pada baris pertama kop. */
  namaInstansi?: string;
  /** Baris keterangan tambahan pada kop (alamat, telepon, laman). */
  barisKop?: string[];
  /** Tampilkan garis pembatas di bawah kop. */
  garisKop?: boolean;

  /** Catatan kaki dokumen (opsional). */
  catatanKaki?: string;
}

/**
 * Draf template dokumen yang disunting kurator dari kanvas bergaya Word.
 * HTML tetap menyimpan tabel sumber, sedangkan layout hanya berisi
 * pengaturan tampilan halaman agar tidak mengubah naskah asli secara kasar.
 */
export interface DokumenTemplateOverride {
  html: string;
  updatedAt: number;
  layout?: {
    fontFamily?: string;
    fontSizePt?: number;
    lineHeight?: number;
    pageWidthMm?: number;
    pageHeightMm?: number;
    orientation?: "portrait" | "landscape";
    marginTopMm?: number;
    marginRightMm?: number;
    marginBottomMm?: number;
    marginLeftMm?: number;
  };
}

export interface AppearanceSettings {
  primaryHsl: string;
  accentHsl: string;
  dark: boolean;
  theme?: ThemeMode;
  themePreset?: string;
  highContrast?: boolean;
  language?: Language;
  brand?: BrandSettings;
  backdrop?: LayoutBackdropSettings;
  tradisi?: TradisiSettings;
  customTheme?: CustomThemeSettings;
  studio?: StudioSettings;
  /** Pengaturan Tata Naskah Dinas untuk dokumen cetak. */
  tataNaskah?: TataNaskahSettings;
  /** Override template per dokumen yang dibuat dan disimpan oleh kurator. */
  dokumenTemplates?: Record<string, DokumenTemplateOverride>;
}
