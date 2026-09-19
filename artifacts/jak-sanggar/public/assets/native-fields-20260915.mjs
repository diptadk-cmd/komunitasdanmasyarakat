// Labels and optional examples for the native document form. Choices never set a
// default or establish a legal rule; existing and custom values stay available.
import { fieldGuidance } from './native-field-guidance-20260920.mjs';
export const FIELD_GROUPS = [
  'Identitas sanggar',
  'Forum dan kegiatan',
  'Pengurus dan penanggung jawab',
  'Nomor dan periode dokumen',
  'Ketentuan dan keuangan',
  'Isian lainnya',
];

const definitions = new Map();
function add(group, entries) {
  for (const [key, label] of Object.entries(entries)) definitions.set(key, { label, group: FIELD_GROUPS[group] });
}

add(0, {
  NAM_SA2: 'Nama lengkap sanggar', NAM_SANGGAR: 'Nama lengkap sanggar', NAMA_SANGGAR: 'Nama lengkap sanggar',
  NAMA_KOP: 'Nama pada kop surat', NAM_SIN: 'Nama singkat sanggar',
  NAM_BA2: 'Nama badan penyelenggara tanpa bentuk badan', NAM_PE3: 'Nama lengkap badan penyelenggara',
  NAM_IN2: 'Nama lembaga induk', ALAMAT: 'Alamat sekretariat', ALA_LE2: 'Alamat kedudukan', ALA_LEN: 'Alamat lengkap',
  TELEPON: 'Telepon / WhatsApp sanggar', TEL_SAN: 'Telepon / WhatsApp sanggar', TEL: 'Telepon / WhatsApp',
  TEL_IND: 'Telepon / WhatsApp lembaga induk', EMAIL: 'Email sanggar', EMA_SAN: 'Email sanggar', EMA: 'Email', EMA_IND: 'Email lembaga induk',
  MED_SOS: 'Media sosial / situs web', BID_SEN: 'Bidang seni', TAR_MU2: 'Bidang seni', TAR_MUS: 'Bidang seni',
  KBL_DAN: 'KBLI / bidang kegiatan', WIL_KEG: 'Wilayah kegiatan', SEB_UNI: 'Kedudukan unit sanggar',
  NIB: 'Nomor Induk Berusaha (NIB)', NIB_IND: 'NIB lembaga induk', NPW: 'NPWP', NPWP: 'NPWP', NPW_IND: 'NPWP lembaga induk',
  TGL_BER: 'Tanggal mulai berdiri / berkegiatan', TAN_PEM: 'Tanggal pembentukan',
  IZI_SER: 'Perizinan khusus', NOM_KEB: 'Nomor kebijakan data / dokumentasi', DAT_PEM: 'Data pemilik manfaat',
  LOGO: 'Logo sanggar', LOG_FIN: 'Logo final', STE_FIN: 'Stempel final', NAM_LOG: 'Nama logo',
  BEN_LOG: 'Bentuk utama logo', MAK_LOG: 'Makna logo', KOD_WAR: 'Warna utama / kode warna',
  FON_LOG: 'Jenis huruf logo', MIN_LOG: 'Ukuran minimum logo', PRO_LOG: 'Perbandingan lebar dan tinggi logo',
  RUA_LOG: 'Ruang kosong di sekeliling logo', KET_LOG: 'Keterangan logo / identitas', UKU_STE: 'Ukuran dan bentuk stempel',
});

add(1, {
  JEN_PRO: 'Jenis proses / penetapan', TIN_POK: 'Tindakan pokok penetapan',
  HAR_FOR: 'Hari pelaksanaan forum', HAR: 'Hari pelaksanaan rapat', TGL_FOR: 'Tanggal forum administrasi', TAN_RAP: 'Tanggal rapat',
  TEM_FOR: 'Tempat pelaksanaan forum', TEMPAT: 'Tempat pelaksanaan', TEM: 'Tempat latihan / kegiatan', TEM_ATA: 'Tempat / media pelaksanaan',
  PUK_MUL: 'Pukul mulai forum', PUK_SEL: 'Pukul selesai forum', WAK_MUL: 'Waktu mulai', WAK_SEL: 'Waktu selesai',
  JUM_HAD: 'Jumlah peserta hadir', JUM_PES: 'Jumlah peserta', JUM_DAN: 'Jumlah dan jenis peserta / mitra',
  NAM_KEG: 'Nama kegiatan', KEGIATAN: 'Nama / uraian kegiatan', KEG: 'Nama latihan / kegiatan',
  PROGRAM: 'Nama program', PEL_PRO: 'Program utama sanggar', PERIODE: 'Periode program', TAN_PER: 'Tanggal / periode kegiatan',
  TGL_KEG: 'Tanggal kegiatan', TUJ: 'Tujuan kegiatan', HAS_OUT: 'Hasil / keluaran yang ditargetkan',
  KELUARAN: 'Keluaran kegiatan', RIN_PEL: 'Rincian pelaksanaan', PES_REA: 'Peserta yang terealisasi', HAS_REA: 'Hasil yang terealisasi',
  MIT: 'Nama mitra kegiatan', KEN: 'Kendala pelaksanaan', KENDALA: 'Kendala dan hambatan', TIN_LAN: 'Rencana tindak lanjut',
  LOK_TAU: 'Lokasi / tautan dokumentasi', TGL_PIL: 'Tanggal forum pengangkatan pengelola',
  TGL_RAP_: 'Tanggal rapat atribut', TGL_RA2: 'Tanggal rapat keuangan', TGL_RA3: 'Tanggal rapat pelatih',
  TGL_SER: 'Tanggal serah terima', TGL_LAP: 'Tanggal laporan', UND_KEP: 'Dasar penyelenggaraan rapat',
});

add(2, {
  KETUA: 'Nama ketua / kepala sanggar', WAK_KET: 'Nama wakil ketua / kepala', SEK: 'Nama sekretaris', BEN: 'Nama bendahara',
  PEMBINA: 'Nama pembina / penasihat kegiatan', ID_KETUA: 'Identitas ketua / kepala', ID_WAKIL: 'Identitas wakil ketua / kepala',
  ID_SEK: 'Identitas sekretaris', ID_BEN: 'Identitas bendahara', PIM_FOR: 'Nama pimpinan forum', NOTULIS: 'Nama notulis forum',
  NAM_PIM: 'Nama pimpinan rapat', NAM_SEK: 'Nama sekretaris / notulis rapat', NAM_TTD_: 'Nama penandatangan',
  JAB_FOR: 'Jabatan penandatangan forum', JAB_PEN: 'Jabatan pihak berwenang', ORG_PEN: 'Organ yang menetapkan keputusan',
  ORG_IND: 'Organ / pihak berwenang dari lembaga induk', NAM_PEN: 'Nama pihak berwenang / penandatangan',
  NAM_PI2: 'Nama pimpinan / pengurus badan', JAB_DIR: 'Jabatan pemeriksa', JAB_IND: 'Jabatan pemeriksa lembaga induk',
  NAM_MIT: 'Nama wakil mitra', JAB_MIT: 'Jabatan wakil mitra', LEM_MIT: 'Nama lembaga mitra',
  NAM_DAN: 'Nama penanggung jawab keselamatan', PIC: 'Nama penanggung jawab kegiatan', PIC_DAR: 'Penanggung jawab dan kontak darurat',
  NAM: 'Nama pelatih / penanggung jawab', PIH_LAM: 'Pihak yang menyerahkan pengelolaan', PIH_BAR: 'Pihak yang menerima pengelolaan',
  PEN_LAP: 'Nama penyusun laporan', VER: 'Nama pemeriksa laporan', NOTARIS: 'Nama notaris',
  JEN_DAN: 'Jenis dan jumlah peserta / anggota', JEN_DA2: 'Jenis dan jumlah pelatih / pekerja',
});

add(3, {
  KD: 'Kode singkat sanggar', NO_BA: 'Nomor urut berita acara', NO_KMM: 'Nomor urut keputusan forum',
  NO_ATR: 'Nomor urut keputusan atribut', NO_KEU: 'Nomor urut keputusan keuangan', NO_PEL: 'Nomor urut keputusan pelatih',
  NO_PEN: 'Nomor lengkap keputusan pengelola', NO_KON: 'Nomor perjanjian', NO_SERAH: 'Nomor berita acara serah terima',
  NOM_DOK: 'Nomor kontrak / surat perintah kerja', NOM_KEP: 'Nomor keputusan pembentukan', NOM_SK: 'Nomor surat keputusan',
  NOM_SKT: 'Nomor surat keterangan / pengesahan', NOM_SUR: 'Nomor surat', NOM_DAN: 'Nomor pengesahan / pendaftaran',
  NO_AKTA: 'Nomor akta', TGL_AKT: 'Tanggal akta', TAN_SK: 'Tanggal surat keputusan', TAN_SKT: 'Tanggal surat keterangan / pengesahan',
  TAN_SUR: 'Tanggal surat', TAN: 'Tanggal penandatanganan', TGL_KON: 'Tanggal perjanjian',
  BLN: 'Bulan pada nomor dokumen', BLN_ATR: 'Bulan pada nomor keputusan atribut', BLN_KEU: 'Bulan pada nomor keputusan keuangan',
  BLN_PLT: 'Bulan pada nomor keputusan pelatih', THN: 'Tahun dokumen', THN_ATR: 'Tahun keputusan atribut',
  THN_KEU: 'Tahun keputusan keuangan', THN_PLT: 'Tahun keputusan pelatih', TAH_PAK: 'Tahun paket dokumen',
  THN_AWA_: 'Tahun awal masa bakti', THN_AKH_: 'Tahun akhir masa bakti',
  TGL_SK_A: 'Tanggal keputusan atribut', TGL_SK_K: 'Tanggal keputusan keuangan', TGL_SK_P: 'Tanggal keputusan pelatih',
  TGL_SK2: 'Tanggal keputusan pengelola', TGL_AWA_: 'Tanggal mulai masa bakti', TGL_AKH_: 'Tanggal selesai masa bakti',
  TGL_MUL_: 'Tanggal mulai penugasan', TGL_AK2: 'Tanggal berakhir penugasan', TGL_MUL: 'Tanggal mulai perjanjian',
  TGL_SEL: 'Tanggal berakhir perjanjian', DUR_BAK: 'Lama masa bakti (tahun)', MAS_JAB: 'Masa jabatan', MAS_KEW: 'Masa kewenangan',
  KOTA: 'Kota penetapan dokumen', KOT: 'Kota penandatanganan',
});

add(4, {
  KUO_MAY: 'Kuorum kehadiran musyawarah', KUO_DUA_: 'Kuorum perubahan anggaran dasar / rumah tangga',
  KUO_SAT_: 'Jumlah dukungan pengajuan musyawarah luar biasa', KUO_TIG_: 'Kuorum perubahan status / penggabungan',
  HARI_7: 'Tenggat penyampaian undangan', HARI_14: 'Tenggat tindak lanjut permintaan forum',
  HAR_LPJ_: 'Batas pertanggungjawaban uang muka (hari)', HAR_SER: 'Batas serah terima (hari)',
  BAT_LAP: 'Tenggat laporan kegiatan', BAT_TEG: 'Lama tunggakan sebelum pemberitahuan', BAT_TUN: 'Lama tunggakan sebelum penangguhan hak',
  MAS_ARS: 'Masa penyimpanan dokumen keuangan', BAT_BEL: 'Batas pengeluaran yang memerlukan persetujuan (rupiah)',
  BAT_GAN: 'Batas pengeluaran dengan persetujuan ganda (rupiah)', BAT_KUA: 'Batas kewenangan / mandat operasional',
  DAS_FOR: 'Dasar kewenangan forum', DAS_KEW: 'Dasar kewenangan', DAS_MAN: 'Dasar pemberian mandat', DAS_SER: 'Dasar serah terima',
  KUASA: 'Dasar kewenangan pihak pertama', KUA_MIT: 'Dasar kewenangan wakil mitra', MANDAT: 'Ruang lingkup mandat pengelola',
  PAS_AD: 'Dasar kewenangan dalam anggaran dasar', PAS_AD2: 'Dasar kewenangan dalam dokumen dasar', PAS_AKT: 'Dasar kewenangan dalam akta',
  RUA_LIN: 'Ruang lingkup kegiatan sanggar', AKH_TUG: 'Kondisi berakhirnya penugasan', ATU_BAT: 'Ketentuan pembatalan / penjadwalan ulang',
  BAT_KAH: 'Tenggat pemberitahuan keadaan kahar', BAT_PER: 'Tenggat perbaikan pelanggaran perjanjian',
  BAT_SEN: 'Jangka waktu musyawarah perselisihan', FOR_SEN: 'Forum penyelesaian perselisihan',
  HAK_KAR: 'Kesepakatan hak karya / izin rekaman', TUG_SAT: 'Lingkup tugas pihak pertama', TUG_DUA: 'Lingkup tugas pihak kedua',
  IUR_BLN: 'Iuran / biaya bulanan', IUR_THN: 'Iuran / biaya tahunan', U_DAFTAR: 'Biaya pendaftaran',
  TER_BLN: 'Terbilang iuran bulanan', TER_THN: 'Terbilang iuran tahunan', TER_DAF: 'Terbilang biaya pendaftaran',
  BAN: 'Nama bank', NOM_REK: 'Nomor rekening', NAM_REK: 'Nama pemilik rekening', REKENING: 'Rincian rekening pembayaran', REK_RES: 'Rekening penerimaan',
  NIL: 'Nilai transaksi (rupiah)', NIL_KON: 'Nilai perjanjian', TAH_BAY: 'Tahap / jadwal pembayaran', SYA_TAG: 'Persyaratan penagihan', PAJAK: 'Pihak penanggung pajak',
  ANG_MAS: 'Anggaran penerimaan', ANG_KEL: 'Anggaran pengeluaran', ANG_SISA: 'Anggaran sisa / defisit',
  REA_MAS: 'Realisasi penerimaan', REA_KEL: 'Realisasi pengeluaran', REA_SIS: 'Realisasi sisa / defisit',
  SEL_MAS: 'Selisih penerimaan', SEL_KEL: 'Selisih pengeluaran', SEL_SISA: 'Selisih sisa / defisit', PEN_SEL: 'Penjelasan selisih keuangan',
  SAL_AWA: 'Saldo awal', SAL_AKH: 'Saldo akhir', SAL_BAN: 'Saldo bank', SAL_KAS: 'Saldo kas',
  PIUTANG: 'Jumlah piutang', UTANG: 'Jumlah utang', DAN_TER: 'Dana terikat',
  B_KAS: 'Alokasi anggaran kas sanggar', B_SOSIAL: 'Alokasi dana cadangan / sosial', B_KREASI: 'Alokasi anggaran tim kreatif',
  B_PROD: 'Alokasi anggaran tim produksi / teknis', B_TAMPIL: 'Alokasi anggaran pelaku / penampil', B_UNIT: 'Alokasi anggaran kelompok / unit / peserta',
  P_KAS: 'Bagian hasil bersih untuk kas sanggar', P_SOSIAL: 'Bagian hasil bersih untuk dana sosial', P_KREASI: 'Bagian hasil bersih untuk tim kreatif',
  P_PROD: 'Bagian hasil bersih untuk tim produksi', P_TAMPIL: 'Bagian hasil bersih untuk penampil', P_UNIT: 'Bagian hasil bersih untuk kelompok / unit',
});

add(5, {
  SAL_SER: 'Rincian kas / rekening yang diserahkan', BUK_KAS: 'Bukti serah terima kas / rekening',
  DAF_BAR: 'Daftar barang dan kondisinya', BUK_ASE: 'Bukti / daftar inventaris aset',
  KON_AKT: 'Daftar kontrak aktif dan kewajiban', REG_KON: 'Bukti / register kontrak',
  DAF_ARS: 'Daftar arsip dan data peserta', BER_ARS: 'Bukti / berkas serah terima arsip',
  DAF_AKU: 'Daftar akun dan akses', BUK_ALI_: 'Bukti pengalihan akses', CAT_SER: 'Kekurangan dan tenggat penyelesaian serah terima',
});

// Shortened O_* identifiers refer to the parent organisation, never the sanggar.
const parentAliases = {
  O_ALAMAT: 'ALAMAT', O_BAT_BE: 'BAT_BEL', O_BAT_GA: 'BAT_GAN', O_BAT_LA: 'BAT_LAP', O_BAT_TE: 'BAT_TEG', O_BAT_TU: 'BAT_TUN',
  O_BLN: 'BLN', O_DUR_BA: 'DUR_BAK', O_HARI_1: 'HARI_14', O_HARI_7: 'HARI_7', O_HAR_FO: 'HAR_FOR',
  O_HAR_LP: 'HAR_LPJ_', O_HAR_SE: 'HAR_SER', O_IUR_BL: 'IUR_BLN', O_IUR_TH: 'IUR_THN', O_JEN_PR: 'JEN_PRO',
  O_JUM_HA: 'JUM_HAD', O_KD: 'KD', O_KOTA: 'KOTA', O_KUO_DU: 'KUO_DUA_', O_KUO_MA: 'KUO_MAY',
  O_KUO_SA: 'KUO_SAT_', O_KUO_TI: 'KUO_TIG_', O_LOGO: 'LOGO', O_MAS_AR: 'MAS_ARS', O_NOTULI: 'NOTULIS',
  O_NO_BA: 'NO_BA', O_PIM_FO: 'PIM_FOR', O_PUK_MU: 'PUK_MUL', O_PUK_SE: 'PUK_SEL',
  O_P_KAS: 'P_KAS', O_P_KREA: 'P_KREASI', O_P_PROD: 'P_PROD', O_P_SOSI: 'P_SOSIAL', O_P_TAMP: 'P_TAMPIL', O_P_UNIT: 'P_UNIT',
  O_TEM_FO: 'TEM_FOR', O_TER_BL: 'TER_BLN', O_TER_DA: 'TER_DAF', O_TER_TH: 'TER_THN',
  O_TGL_BE: 'TGL_BER', O_TGL_FO: 'TGL_FOR', O_THN: 'THN', O_TIN_PO: 'TIN_POK', O_U_DAFT: 'U_DAFTAR',
};

for (let n = 1; n <= 8; n++) {
  const two = String(n).padStart(2, '0');
  add(2, { [`NAM${two}`]: `Nama peserta ${n}`, [`JAB${two}`]: `Jabatan / peran peserta ${n}`, [`NIK_I${two}`]: `NIK / identitas peserta ${n}`, [`KON${two}`]: `Kontak peserta ${n}` });
  add(2, { [`KET_${n}`]: `Keterangan pengurus ${n}` });
  if (n <= 4) add(2, { [`KOORD_${n}`]: `Nama koordinator ${n}`, [`ID_K${n}`]: `Identitas koordinator ${n}` });
  if (n <= 3) {
    add(2, { [`PEL_${n}`]: `Nama pelatih ${n}`, [`ST_${n}`]: `Status penugasan pelatih ${n}`, [`BIDANG_${n}`]: `Bidang pengelolaan ${n}` });
    add(1, { [`MATERI_${n}`]: `Materi pelatihan ${n}`, [`WAKTU_${n}`]: `Jadwal pelatih ${n}` });
  }
}

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const options = values => values.map(value => ({ value: String(value), label: String(value) }));
const roles = ['Ketua', 'Kepala Sanggar', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator', 'Pelatih', 'Pembina', 'Penasihat', 'Anggota', 'Direktur', 'Ketua Pengurus', 'Sekutu Pengurus'];
const cities = ['Jakarta Pusat', 'Jakarta Utara', 'Jakarta Barat', 'Jakarta Selatan', 'Jakarta Timur', 'Kepulauan Seribu', 'Bogor', 'Depok', 'Tangerang', 'Tangerang Selatan', 'Bekasi'];
const arts = ['Tari', 'Musik', 'Teater', 'Sastra', 'Rupa', 'Silat', 'Seni kriya', 'Seni pertunjukan', 'Seni tradisi', 'Lenong', 'Gambang kromong', 'Multidisiplin'];
const dayCounts = ['1', '3', '7', '14', '30'];
const dayDurations = ['3 hari', '7 hari', '14 hari', '30 hari', '7 hari kerja', '14 hari kerja'];
const monthDurations = ['1 bulan', '2 bulan', '3 bulan', '6 bulan', '12 bulan'];
const yearDurations = ['1 tahun', '2 tahun', '3 tahun', '4 tahun', '5 tahun', '10 tahun'];
const textAreas = new Set(('ALAMAT ALA_LE2 ALA_LEN DAT_PEM MED_SOS MAK_LOG KET_LOG RUA_LOG RIN_PEL TUJ HAS_OUT HAS_REA KELUARAN KEN KENDALA TIN_LAN LOK_TAU JUM_DAN JEN_DAN JEN_DA2 PIC_DAR UND_KEP RUA_LIN AKH_TUG ATU_BAT BAT_KUA DAS_FOR DAS_KEW DAS_MAN DAS_SER KUASA KUA_MIT MANDAT PAS_AD PAS_AD2 PAS_AKT HAK_KAR TUG_SAT TUG_DUA SYA_TAG TAH_BAY PEN_SEL SAL_SER BUK_KAS DAF_BAR BUK_ASE KON_AKT REG_KON DAF_ARS BER_ARS DAF_AKU BUK_ALI_ CAT_SER REKENING REK_RES').split(' '));
const helpByKey = {
  NAM_SA2: 'Nama resmi sanggar sesuai formulir pendaftaran. Huruf pada judul dokumen dibuat kapital saat dokumen dihasilkan; ejaan nama pada isi tetap dipertahankan.',
  NAM_BA2: 'Isi nama badan saja jika bentuk badan, seperti Yayasan, PT, CV, atau Firma, sudah tertulis pada template. Periksa kalimat pada pratinjau.',
  NAM_PE3: 'Isi nama lengkap penyelenggara, termasuk bentuk badannya, sesuai dokumen sumber.',
  NAM_IN2: 'Isi nama lembaga induk yang menaungi unit sanggar sesuai dokumen sumber. Nama ini dapat berbeda dari nama sanggar.',
  NAMA_KOP: 'Nama yang akan ditampilkan pada kop surat. Ikuti penulisan nama resmi pada identitas sanggar.',
  TGL_BER: 'Tanggal sanggar benar-benar mulai berdiri atau berkegiatan. Gunakan catatan yang tersedia; tanggal forum administrasi bisa berbeda.',
  TGL_FOR: 'Tanggal pelaksanaan forum administrasi yang tercantum dalam berita acara. Samakan dengan tanggal pada dokumen forum terkait.',
  JEN_PRO: 'Pilih proses yang benar-benar dilakukan atau tulis sendiri. Pilihan hanya contoh; tidak mengubah status sanggar secara otomatis.',
  DUR_BAK: 'Isi jumlah tahun sesuai masa bakti yang disepakati. Cocokkan dengan tanggal mulai dan berakhirnya masa bakti; satuan tahun sudah ada pada template.',
  JUM_HAD: 'Isi jumlah peserta yang benar-benar hadir, tanpa kata orang. Cocokkan dengan daftar hadir.',
  JUM_PES: 'Isi jumlah peserta, tanpa kata orang, berdasarkan daftar peserta kegiatan.',
  KD: 'Kode singkat yang dipakai dalam nomor surat sanggar. Pertahankan kode yang digunakan pada register penomoran.',
  NOM_REK: 'Isi nomor rekening persis seperti catatan bank, termasuk angka nol di awal. Nama bank dan pemilik rekening diisi pada kolom masing-masing.',
  NOM_SK: 'Salin nomor surat keputusan lengkap dari dokumen sumber.',
  NOM_SKT: 'Salin nomor surat keterangan atau pengesahan lengkap dari dokumen sumber.',
  HARI_7: 'Tenggat undangan sebelum pelaksanaan forum. Tuliskan jumlah dan satuan, misalnya 7 hari. Gunakan ketentuan yang telah ditetapkan.',
  HARI_14: 'Tenggat untuk menindaklanjuti permintaan forum. Tuliskan jumlah dan satuan sesuai ketentuan yang disepakati.',
  HAR_LPJ_: 'Jumlah hari untuk pertanggungjawaban uang muka. Isi angka saja; kata hari sudah tersedia pada template.',
  HAR_SER: 'Jumlah hari untuk menyelesaikan serah terima. Isi angka saja; kata hari sudah tersedia pada template.',
  MAS_ARS: 'Masa penyimpanan arsip keuangan yang berlaku pada organisasi. Pilihan hanya contoh; sesuaikan dengan ketentuan organisasi dan kewajibannya.',
  BUK_ALI_: 'Catat bukti pemindahan atau pengaturan akses. Jangan menuliskan kata sandi, PIN, atau kode masuk akun dalam dokumen.',
  DAF_AKU: 'Daftar nama akun, layanan, dan pihak yang menerima akses. Gunakan proses pengalihan akses layanan tersebut; jangan isi kata sandi atau kode masuk.',
  LOGO: 'Unggah gambar pada bagian Logo, stempel, dan kop surat. Gambar yang sudah tersimpan dapat terisi otomatis dan dimasukkan ke Word/PDF. Keterangan opsional, misalnya “Logo lingkaran hijau dengan gambar penari dan tulisan Sanggar Melati”.',
  LOG_FIN: 'Gunakan tombol unggah atau ganti logo untuk memilih desain yang sudah disetujui. Keterangan opsional, misalnya “Logo versi 2, disetujui pada rapat 15 September 2026”. Gambar logo terhubung ke ruang desain final pada dokumen.',
  STE_FIN: 'Gunakan tombol unggah atau ganti stempel untuk memilih desain yang sudah disetujui. Keterangan opsional, misalnya “Stempel bulat Sanggar Melati, diameter 4 cm, tinta biru”. Gambar terhubung ke ruang stempel pada dokumen.',
  NAM_LOG: 'Nama atau sebutan untuk lambang sanggar. Contoh: “Lambang Melati Menari”. Nama logo boleh berbeda dari nama sanggar.',
  BEN_LOG: 'Jelaskan bentuk dasar dan unsur gambar logo. Contoh: “Lingkaran dengan siluet penari di tengah”, “Perisai berisi bunga melati”, atau “Tulisan nama sanggar dengan ornamen khas Betawi”. Pilih uraian yang sesuai logo sebenarnya.',
  MAK_LOG: 'Jelaskan arti setiap unsur logo. Contoh: “Lingkaran melambangkan kebersamaan; penari melambangkan seni tari; warna hijau melambangkan pertumbuhan.” Makna ditentukan oleh sanggar, bukan arti warna yang wajib diikuti.',
  KOD_WAR: 'Sebutkan warna dan, bila tersedia, kode warnanya supaya hasil cetak konsisten. Contoh: “Hijau #17675B dan putih #FFFFFF”. Ikuti warna pada desain yang disetujui.',
  FON_LOG: 'Nama jenis huruf pada logo atau tulisan pendampingnya. Contoh: “Arial Bold untuk nama sanggar, Arial Regular untuk keterangan”. Jika tulisan digambar khusus, tulis “Huruf gambar khusus”.',
  MIN_LOG: 'Ukuran terkecil saat logo dipakai agar tulisan dan gambar tetap terbaca. Contoh: “Lebar minimal 2 cm pada cetakan dan 120 piksel pada layar”. Sesuaikan setelah memeriksa keterbacaan logo.',
  PRO_LOG: 'Perbandingan lebar terhadap tinggi logo. Contoh: “1:1” untuk logo persegi atau bulat, dan “2:1” untuk logo dengan lebar dua kali tingginya. Pertahankan perbandingan ini saat memperbesar atau memperkecil gambar.',
  RUA_LOG: 'Jarak bebas antara tepi logo dan tulisan atau gambar lain. Contoh: “Minimal 5 mm di semua sisi” atau “Minimal setengah tinggi huruf pada logo”. Ruang ini menjaga logo tetap jelas.',
  KET_LOG: 'Aturan atau keterangan tambahan pemakaian identitas. Contoh: “Gunakan logo berwarna pada latar putih; jangan memiringkan atau menarik gambar hingga berubah proporsi”.',
  UKU_STE: 'Sebutkan bentuk dan ukuran stempel beserta satuannya. Contoh: “Bulat, diameter 4 cm”, “Oval, lebar 5 cm dan tinggi 3 cm”, atau “Persegi panjang 5 × 2 cm”. Sesuaikan dengan desain stempel yang dipakai.',
  TUJ: 'Perubahan atau manfaat yang ingin dicapai lewat kegiatan. Contoh: “Meningkatkan kemampuan tari dasar bagi 20 peserta pemula melalui delapan pertemuan”.',
  HAS_OUT: 'Hasil nyata yang ditargetkan sebelum kegiatan dilaksanakan. Contoh: “Satu pertunjukan tari berdurasi 15 menit dan satu video dokumentasi”.',
  KELUARAN: 'Hasil nyata yang harus diserahkan atau dihasilkan. Contoh: “Satu koreografi baru, satu pementasan, dan laporan kegiatan”.',
  HAS_REA: 'Hasil yang benar-benar tercapai setelah kegiatan. Contoh: “Delapan latihan terlaksana dan satu pertunjukan ditampilkan oleh 18 peserta”. Bandingkan dengan target kegiatan.',
  RIN_PEL: 'Uraikan tahapan kegiatan beserta pelaksanaannya. Contoh: “Pendaftaran peserta, delapan latihan bersama koreografer, gladi bersih, lalu pertunjukan pada 30 September 2026”.',
  KEN: 'Hambatan yang benar-benar terjadi dan dampaknya. Contoh: “Hujan menunda latihan luar ruang sehingga satu pertemuan dipindahkan ke aula”.',
  KENDALA: 'Hambatan yang benar-benar terjadi dan dampaknya. Contoh: “Dua kostum belum tersedia sehingga gladi bersih memakai kostum latihan”.',
  TIN_LAN: 'Langkah setelah evaluasi, penanggung jawab, dan tenggatnya. Contoh: “Koordinator perlengkapan melengkapi dua kostum sebelum 25 September 2026”.',
  RUA_LIN: 'Jenis pekerjaan atau kegiatan yang termasuk dalam pengelolaan sanggar. Contoh: “Pelatihan tari, penciptaan koreografi, pementasan, dan dokumentasi kegiatan”.',
  TUG_SAT: 'Pekerjaan yang menjadi tanggung jawab Pihak Pertama pada perjanjian ini. Contoh: “Menyediakan tempat latihan, jadwal, dan perlengkapan”. Sesuaikan dengan pihak yang tercantum.',
  TUG_DUA: 'Pekerjaan yang menjadi tanggung jawab Pihak Kedua pada perjanjian ini. Contoh: “Menyusun koreografi, memimpin enam latihan, dan mendampingi pementasan”. Sesuaikan dengan kesepakatan para pihak.',
  IUR_BLN: 'Jumlah iuran atau biaya untuk satu bulan dan dasar pengenaannya. Contoh: “Rp50.000 per peserta per bulan”. Gunakan jumlah yang telah disepakati.',
  IUR_THN: 'Jumlah iuran atau biaya untuk satu tahun dan dasar pengenaannya. Contoh: “Rp300.000 per anggota per tahun”. Jelaskan apakah terpisah dari iuran bulanan.',
  U_DAFTAR: 'Biaya satu kali ketika peserta mendaftar. Contoh: “Rp100.000 per peserta, dibayar sekali saat pendaftaran”, atau “Rp0 / gratis” jika memang tidak dikenakan biaya.',
  BAT_BEL: 'Batas nominal pengeluaran yang memerlukan persetujuan sesuai ketentuan sanggar. Contoh: “Rp500.000 per transaksi”. Gunakan batas yang benar-benar disepakati.',
  BAT_GAN: 'Batas nominal yang memerlukan persetujuan dua pihak berwenang. Contoh: “Rp2.000.000 per transaksi, disetujui ketua dan bendahara”. Sesuaikan dengan ketentuan sanggar.',
  NIL: 'Nilai uang untuk transaksi yang dicatat. Contoh: “Rp750.000 untuk pembayaran sewa tempat latihan”. Cocokkan dengan bukti pembayaran.',
  NIL_KON: 'Nilai keseluruhan pekerjaan dalam perjanjian. Contoh: “Rp5.000.000 untuk penyusunan koreografi dan enam kali latihan”. Jelaskan komponen yang termasuk sesuai kesepakatan.',
  TAH_BAY: 'Waktu, syarat, dan besaran setiap tahap pembayaran. Contoh: “30% saat perjanjian ditandatangani, 40% setelah gladi bersih, 30% setelah pekerjaan diterima”. Contoh tersebut berjumlah 100% dari nilai perjanjian; sesuaikan dengan kesepakatan.',
  SYA_TAG: 'Dokumen atau bukti yang perlu dilengkapi sebelum pembayaran. Contoh: “Tagihan, daftar pekerjaan selesai, dan berita acara penerimaan”.',
  ANG_MAS: 'Total penerimaan yang direncanakan sebelum kegiatan. Contoh: “Rp10.000.000 dari tiket dan dukungan mitra”. Gunakan dasar perencanaan yang dapat dijelaskan.',
  ANG_KEL: 'Total biaya yang direncanakan untuk kegiatan. Contoh: “Rp6.000.000 untuk tempat, perlengkapan, transportasi, dan kebutuhan produksi”.',
  ANG_SISA: 'Selisih rencana penerimaan dikurangi rencana pengeluaran. Contoh: Rp10.000.000 − Rp6.000.000 = Rp4.000.000. Jika pengeluaran lebih besar, tuliskan sebagai defisit.',
  REA_MAS: 'Total uang yang benar-benar diterima dari kegiatan. Contoh: “Rp9.000.000”, sesuai catatan tiket, transfer, dan penerimaan lainnya.',
  REA_KEL: 'Total biaya yang benar-benar dikeluarkan. Contoh: “Rp5.500.000”, sesuai kuitansi, tagihan, dan bukti pembayaran.',
  REA_SIS: 'Realisasi penerimaan dikurangi realisasi pengeluaran. Contoh: Rp9.000.000 − Rp5.500.000 = Rp3.500.000. Catat kewajiban yang masih harus dibayar sebelum menetapkan hasil yang dibagikan.',
  PEN_SEL: 'Penyebab perbedaan antara anggaran dan realisasi. Contoh: “Penerimaan tiket kurang Rp1.000.000 dari rencana karena jumlah penonton lebih sedikit”.',
  DAF_BAR: 'Daftar barang yang diserahkan, jumlah, dan kondisinya. Contoh: “10 kostum tari kondisi baik; 1 pengeras suara perlu perbaikan kabel”.',
  KON_AKT: 'Perjanjian yang masih berjalan dan kewajiban yang belum selesai. Contoh: “Sewa studio sampai Desember 2026; pembayaran bulan Oktober belum dilunasi”.',
  CAT_SER: 'Kekurangan saat serah terima, pihak yang melengkapi, dan batas waktunya. Contoh: “Dua kostum dilengkapi oleh pengelola lama paling lambat 30 September 2026”.',
};

const allocationRecipients = {
  KAS: ['kas sanggar untuk kebutuhan bersama', '15%', 'Rp150.000'],
  SOSIAL: ['dana cadangan / sosial sesuai tujuan yang disepakati', '5%', 'Rp50.000'],
  KREASI: ['tim kreatif, misalnya koreografer, sutradara, penulis, komposer, atau penata artistik', '20%', 'Rp200.000'],
  PROD: ['tim produksi dan teknis, misalnya penata suara, penata cahaya, kru panggung, atau dokumentasi', '15%', 'Rp150.000'],
  TAMPIL: ['pelaku / penampil, misalnya penari, pemusik, aktor, atau penyanyi', '35%', 'Rp350.000'],
  UNIT: ['kelompok, unit, atau anggota yang berkontribusi sesuai daftar penerima', '10%', 'Rp100.000'],
};
const identityChoices = {
  BEN_LOG: ['Lingkaran dengan siluet penari di tengah', 'Perisai dengan ornamen khas Betawi', 'Bunga dengan nama sanggar', 'Tulisan nama sanggar dengan ornamen', 'Gabungan alat musik dan gerak tari'],
  MAK_LOG: ['Lingkaran melambangkan kebersamaan', 'Penari melambangkan seni tari dan kreativitas', 'Alat musik melambangkan harmoni', 'Bunga melambangkan keindahan dan pertumbuhan', 'Ornamen Betawi melambangkan akar budaya', 'Warna hijau melambangkan pertumbuhan', 'Warna emas melambangkan semangat berkarya'],
  KOD_WAR: ['Hijau #17675B dan putih #FFFFFF', 'Biru #173247 dan putih #FFFFFF', 'Merah #B3261E dan putih #FFFFFF', 'Hitam #000000 dan emas #D4AF37'],
  FON_LOG: ['Arial Bold', 'Times New Roman Bold', 'Georgia Bold', 'Huruf gambar khusus'],
  MIN_LOG: ['Lebar minimal 2 cm pada cetakan dan 120 piksel pada layar', 'Lebar minimal 3 cm pada cetakan dan 180 piksel pada layar', 'Lebar minimal 4 cm pada cetakan dan 240 piksel pada layar'],
  PRO_LOG: ['1:1 (lebar sama dengan tinggi)', '2:1 (lebar dua kali tinggi)', '3:2 (lebar tiga bagian, tinggi dua bagian)'],
  RUA_LOG: ['Minimal 5 mm di semua sisi', 'Minimal 10 mm di semua sisi', 'Minimal setengah tinggi huruf pada logo'],
  UKU_STE: ['Bulat, diameter 4 cm', 'Oval, lebar 5 cm dan tinggi 3 cm', 'Persegi panjang, lebar 5 cm dan tinggi 2 cm'],
  KET_LOG: ['Gunakan logo berwarna pada latar putih', 'Jangan mengubah perbandingan lebar dan tinggi', 'Jangan memiringkan atau mencerminkan logo', 'Gunakan versi satu warna bila cetakan tidak berwarna'],
};
for (const [suffix, [recipient, percent, amount]] of Object.entries(allocationRecipients)) {
  const composition = 'Contoh pembagian lengkap: penampil 35%, tim kreatif 20%, produksi 15%, kelompok/unit 10%, kas 15%, dan dana sosial 5% = 100%.';
  const shared = `Bagian ini untuk ${recipient}.`;
  const collective = ['KREASI', 'PROD', 'TAMPIL', 'UNIT'].includes(suffix)
    ? ' Nilai tersebut adalah bagian seluruh kelompok penerima, bukan untuk setiap orang. Pembagian antarorang mengikuti kontribusi dan kesepakatan.' : '';
  helpByKey['P_' + suffix] = `${shared}\n\nIsi beserta tanda %, misalnya “${percent}”. Dasar 100% adalah seluruh Hasil Bersih yang disetujui untuk dibagikan setelah biaya dan kewajiban kegiatan dikurangkan. Jika Hasil Bersih Rp1.000.000, bagian ${percent} = ${amount}.${collective}\n\n${composition} Total seluruh bagian harus 100%. Ini contoh hitung, bukan pembagian wajib; sesuaikan dengan keputusan sanggar.`;
  helpByKey['B_' + suffix] = `${shared}\n\nIsi alokasi dari total anggaran yang disetujui untuk enam pos penerima ini. Boleh berupa nominal atau persentase, sesuai cara penganggaran yang dipakai. Contoh: “${percent}”; jika total anggaran keenam pos Rp1.000.000, nilainya ${amount}.${collective}\n\nJika memakai persentase, total enam pos harus 100%. ${composition} Gunakan satu dasar perhitungan yang sama. Contoh ini bukan pembagian wajib dan bukan otomatis persentase Hasil Bersih.`;
}

function keyOf(field) { return String(typeof field === 'string' ? field : field?.key || ''); }
function fallbackLabel(field, key) {
  if (/^JUDUL(?:_|$)/.test(key)) return key === 'JUDUL' ? 'Judul dokumen' : `Judul ${key.slice(6).toLowerCase().replace(/_+/g, ' ')}`;
  const context = typeof field === 'object' ? String(field?.context || '') : '';
  const before = context.split('{{')[0].replace(/^[\s\d.:;)−-]+/, '').trim();
  if (before.length >= 3 && before.length <= 70 && !/[;{}]/.test(before)) return before.charAt(0).toUpperCase() + before.slice(1);
  return key ? `Isian ${key.toLowerCase().replace(/_+/g, ' ').trim()}` : 'Isian tambahan';
}

/** Metadata only: selecting a field never selects an option or replaces a value. */
export function fieldMeta(field) {
  const originalKey = keyOf(field), key = parentAliases[originalKey] || originalKey;
  const found = definitions.get(key);
  let label = found?.label || fallbackLabel(field, key);
  if (parentAliases[originalKey]) label = `${label.replace(/sanggar/gi, 'organisasi induk')} — organisasi induk`.replace(/organisasi induk — organisasi induk$/, 'organisasi induk');
  let type = textAreas.has(key) || /^(MATERI_|WAKTU_|KET_)/.test(key) ? 'textarea' : 'text';
  let choices;
  if (/^(TGL_|TAN_(?:PEM|RAP|SK|SKT|SUR)$)/.test(key) || key === 'TAN') type = 'date';
  if (/^(PUK_|WAK_(?:MUL|SEL)$)/.test(key)) type = 'time';
  if (/^(EMAIL|EMA|EMA_SAN|EMA_IND)$/.test(key)) type = 'email';
  if (/^(TELEPON|TEL|TEL_SAN|TEL_IND|KON\d\d)$/.test(key)) type = 'tel';
  if (['JUM_HAD', 'JUM_PES'].includes(key)) type = 'number';
  if (identityChoices[key]) choices = options(identityChoices[key]);
  else if (/^BLN(?:_|$)/.test(key)) choices = romanMonths.map((value, index) => ({ value, label: `${months[index]} (${value})` }));
  else if (/^THN(?:_|$)/.test(key) || key === 'TAH_PAK') {
    const year = new Date().getFullYear();
    choices = options(Array.from({ length: 16 }, (_, index) => year - 5 + index));
  } else if (['HAR_FOR', 'HAR'].includes(key)) choices = options(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
  else if (key === 'JEN_PRO') choices = options(['Pembentukan', 'Penetapan', 'Penataan administrasi', 'Pembentukan dan penetapan']);
  else if (key === 'TIN_POK') choices = options(['Membentuk', 'Menetapkan', 'Menegaskan keberadaan']);
  else if (['KOTA', 'KOT'].includes(key)) choices = options(cities);
  else if (key === 'JAB_FOR') choices = options(['Ketua Sidang', ...roles]);
  else if (/^JAB(?:_|\d)/.test(key)) choices = options(roles);
  else if (['ORG_PEN', 'ORG_IND'].includes(key)) choices = options(['Musyawarah Anggota', 'Rapat Pengurus', 'Pengurus Yayasan', 'Pengurus Perkumpulan', 'Pengurus Koperasi', 'Direksi Perseroan', 'Sekutu Pengurus']);
  else if (['BID_SEN', 'TAR_MU2', 'TAR_MUS'].includes(key)) choices = options(arts);
  else if (/^BIDANG_/.test(key)) choices = options(['Latihan dan pembinaan', 'Produksi dan pementasan', 'Humas dan kerja sama', 'Perlengkapan dan aset', 'Administrasi', 'Keuangan', 'Dokumentasi']);
  else if (/^ST_\d$/.test(key)) choices = options(['Tetap', 'Tidak tetap', 'Tamu', 'Relawan', 'Berdasarkan perjanjian']);
  else if (key === 'DUR_BAK') choices = options(['1', '2', '3', '4', '5']);
  else if (['MAS_JAB', 'MAS_KEW', 'MAS_ARS'].includes(key)) choices = options(yearDurations);
  else if (['HAR_LPJ_', 'HAR_SER'].includes(key)) choices = options(dayCounts);
  else if (['HARI_7', 'HARI_14', 'BAT_LAP', 'BAT_KAH', 'BAT_PER', 'BAT_SEN'].includes(key)) choices = options(dayDurations);
  else if (['BAT_TEG', 'BAT_TUN'].includes(key)) choices = options(monthDurations);
  else if (/^KUO_/.test(key)) choices = options(['1/3 (sepertiga)', '1/2 (setengah)', 'lebih dari 1/2 (setengah)', '2/3 (dua pertiga)', '3/4 (tiga perempat)', 'seluruh']);
  else if (key === 'SEB_UNI') choices = options(['Unit kegiatan', 'Unit pelaksana', 'Unit usaha', 'Program kegiatan']);
  if (choices) type = 'select';
  const multiple = ['BID_SEN', 'TAR_MU2', 'TAR_MUS', 'MAK_LOG', 'KET_LOG'].includes(key) || /^BIDANG_/.test(key);

  const { guidance, suggestions } = fieldGuidance(key, { label, parent: Boolean(parentAliases[originalKey]), legacyHelp: helpByKey[key] });
  let help = `${guidance.meaning}\n\nCara mengisi: ${guidance.howToFill}\n\nContoh penulisan: ${guidance.example}\n\nAmbil dari: ${guidance.sourceHint}`;
  if (choices && !/pilih|pilihan/i.test(help)) help += ' Pilihan hanya contoh; isian sendiri tetap dapat digunakan.';
  if (multiple) help += ' Boleh memilih lebih dari satu. Tambahkan pilihan lain pada kotak isian sendiri.';
  if (parentAliases[originalKey]) help += ' Kolom ini khusus organisasi induk, bukan identitas unit sanggar.';

  // Shared names occur in body text and signatures as well as headings. Preserve
  // their spelling; the document renderer handles uppercase heading positions.
  const uppercase = /^JUDUL(?:_|$)/.test(key) || (typeof field === 'object' && field?.isHeading === true);
  if (uppercase) help += ' Judul otomatis diubah menjadi HURUF KAPITAL.';
  return { label, group: found?.group || FIELD_GROUPS[5], type, ...(choices ? { options: choices } : {}), multiple, help, guidance, ...(suggestions ? { suggestions } : {}), uppercase };
}

export function normalizeFieldValue(field, value) {
  const text = value == null ? '' : String(value);
  return fieldMeta(field).uppercase ? text.toLocaleUpperCase('id-ID') : text;
}

function validParts(year, month, day) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Unknown dates deliberately return an empty input, never a guessed timestamp. */
export function toDateInput(value) {
  const text = String(value ?? '').trim();
  let year, month, day;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) [, year, month, day] = match.map(Number);
  else {
    match = /^(\d{1,2})[\s./-]+([A-Za-z]+)[\s./-]+(\d{4})$/.exec(text);
    if (match) {
      day = Number(match[1]); year = Number(match[3]);
      const name = match[2].toLowerCase();
      const index = months.findIndex(item => item.toLowerCase() === name || item.slice(0, 3).toLowerCase() === name);
      month = index + 1;
    } else {
      // Numeric legacy dates follow the Indonesian day/month/year convention.
      match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
      if (!match) return '';
      [, day, month, year] = match.map(Number);
    }
  }
  if (!validParts(year, month, day)) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Keep non-ISO legacy text unchanged so a date widget cannot erase old values. */
export function fromDateInput(value) {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || toDateInput(text) !== text) return text;
  const [year, month, day] = text.split('-').map(Number);
  return `${day} ${months[month - 1]} ${String(year).padStart(4, '0')}`;
}
