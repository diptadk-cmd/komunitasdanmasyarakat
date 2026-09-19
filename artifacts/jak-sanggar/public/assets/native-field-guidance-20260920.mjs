// Instructions only. Examples and suggestions never become saved/default values.
// Brackets mark information the user must check against their own source.
const guides = new Map();
function add(keys, meaning, howToFill, example, sourceHint, suggestions) {
  for (const key of keys.split(' ')) {
    if (guides.has(key)) throw new Error(`Duplicate field guidance: ${key}`);
    guides.set(key, { meaning, howToFill, example, sourceHint, ...(suggestions ? { suggestions } : {}) });
  }
}
const records = 'Periksa dokumen sumber atau catatan organisasi yang dipakai untuk dokumen ini.';
const money = 'Cocokkan dengan buku kas, bukti pembayaran, dan periode laporan yang sama.';

add('NAM_SA2 NAM_SANGGAR NAMA_SANGGAR NAMA_KOP', 'Nama resmi sanggar yang dibaca penerima dokumen.', 'Salin ejaan lengkap dari profil sanggar. Untuk kop, periksa bahwa nama cocok dengan pemilik dokumen.', 'Sanggar [nama resmi]', 'Profil sanggar aktif dan dokumen pembentukan.');
add('NAM_SIN', 'Nama pendek yang biasa digunakan untuk menyebut sanggar.', 'Gunakan singkatan yang memang dipakai; nama lengkap tetap dicantumkan pada kolom terpisah.', '[singkatan sanggar]', 'Profil atau kesepakatan penamaan sanggar.');
add('NAM_BA2', 'Nama badan penyelenggara, tanpa mengulang bentuk badan yang sudah dicetak.', 'Periksa pratinjau: bila kata Yayasan, PT, CV, atau Firma sudah ada, tulis bagian namanya saja.', '[nama badan tanpa awalan bentuk badan]', 'Akta atau dokumen penyelenggara; jangan mengganti dengan nama unit sanggar.');
add('NAM_PE3', 'Nama lengkap pihak penyelenggara yang menjadi pihak dalam dokumen.', 'Salin nama beserta bentuk badannya. Cocokkan dengan identitas Pihak Pertama pada perjanjian.', '[bentuk badan] [nama resmi penyelenggara]', 'Dokumen identitas badan penyelenggara.');
add('NAM_IN2', 'Nama organisasi induk yang menaungi unit sanggar.', 'Tulis nama induk sesuai dokumennya, meskipun berbeda dari nama sanggar.', '[nama resmi organisasi induk]', 'Dokumen organisasi induk, bukan profil unit sanggar.');
add('ALAMAT ALA_LE2 ALA_LEN', 'Lokasi sekretariat atau kedudukan yang akan tercantum pada dokumen.', 'Tuliskan jalan, nomor bila ada, kelurahan, kecamatan, dan kota. Ikuti pihak yang disebut pada kalimat dokumen.', 'Jalan [nama], Kelurahan [nama], Kecamatan [nama], [kota]', 'Alamat pada profil atau dokumen kedudukan pihak terkait.');
add('TELEPON TEL_SAN TEL', 'Nomor telepon atau WhatsApp untuk menghubungi pihak dalam dokumen.', 'Salin nomor aktif lengkap, termasuk nol di awal atau kode negara. Pastikan nomor ini boleh dipakai sebagai kontak.', '08[lanjutan nomor] atau +62[lanjutan nomor]', 'Kontak resmi pada profil pihak yang disebut.');
add('TEL_IND', 'Nomor kontak resmi organisasi induk.', 'Gunakan nomor induk, bukan otomatis nomor pengelola unit sanggar.', '+62[nomor kontak organisasi induk]', 'Kontak organisasi induk yang sudah dikonfirmasi.');
add('EMAIL EMA_SAN EMA', 'Alamat email untuk menerima komunikasi dokumen.', 'Salin alamat lengkap dan periksa bagian sebelum serta sesudah tanda @.', '[nama akun]@[domain organisasi]', 'Email resmi pihak yang disebut pada dokumen.');
add('EMA_IND', 'Email resmi organisasi induk.', 'Salin email yang digunakan induk untuk komunikasi; email unit sanggar dapat berbeda.', '[akun induk]@[domain organisasi induk]', 'Kontak organisasi induk, bukan otomatis profil unit sanggar.');
add('MED_SOS', 'Akun media sosial atau situs yang mewakili sanggar.', 'Tuliskan nama layanan dan alamat akun atau tautan lengkap agar mudah ditemukan.', 'Instagram: @[akun sanggar]; situs: https://[domain sanggar]', 'Akun resmi yang dikelola sanggar.');
add('BID_SEN TAR_MU2 TAR_MUS', 'Cabang seni yang benar-benar dikelola sanggar.', 'Pilih satu atau beberapa bidang. Tambahkan istilah sendiri jika cabang seni belum tersedia.', 'Tari; musik tradisi', 'Profil dan kegiatan nyata sanggar.');
add('KBL_DAN', 'Kode KBLI atau uraian bidang kegiatan yang tercatat pada dokumen penyelenggara.', 'Jika kode tersedia, salin kode beserta uraiannya. Jangan menebak kode dari nama kegiatan.', '[kode dari dokumen] — [uraian kegiatan]', 'Dokumen perizinan atau profil usaha penyelenggara.');
add('WIL_KEG', 'Wilayah tempat sanggar melaksanakan kegiatannya.', 'Sebutkan wilayah yang benar-benar menjadi cakupan kegiatan, bukan alamat lengkap sekretariat.', 'Kelurahan [nama] dan wilayah [kota]', 'Rencana kerja serta riwayat kegiatan sanggar.');
add('SEB_UNI', 'Posisi unit sanggar di dalam organisasi induk.', 'Pilih sebutan yang tercantum pada keputusan pembentukan. Pilihan tidak mengubah kedudukan sanggar.', 'Unit kegiatan', 'Keputusan organisasi induk tentang pembentukan unit.');
add('NIB NIB_IND', 'Nomor Induk Berusaha milik pihak penyelenggara yang disebut pada kolom.', 'Salin NIB persis dari dokumen pihak tersebut, termasuk nol di awal. Nomor milik induk tidak boleh diganti dengan nomor unit.', '[NIB persis dari dokumen pemiliknya]', 'Dokumen NIB pihak terkait; khusus kolom induk gunakan dokumen organisasi induk.');
add('NPW NPWP NPW_IND', 'Nomor Pokok Wajib Pajak milik pihak yang disebut pada kolom.', 'Salin NPWP sesuai dokumen pemiliknya, termasuk nol dan tanda pemisah. Jangan menggantinya dengan NPWP orang atau organisasi lain.', '[NPWP persis dari dokumen pemiliknya]', 'Dokumen NPWP pihak terkait; khusus kolom induk gunakan dokumen organisasi induk.');
add('IZI_SER', 'Perizinan khusus yang benar-benar dimiliki dan terkait kegiatan.', 'Sebutkan jenis izin dan rujukan dokumennya bila tersedia. Jangan menulis bahwa izin sudah ada jika belum diperoleh.', '[jenis izin], nomor [nomor dokumen], tanggal [tanggal]', 'Berkas perizinan penyelenggara.');
add('DAT_PEM', 'Data pihak yang tercatat sebagai pemilik manfaat penyelenggara.', 'Salin data yang diminta pada dokumen sumber; konfirmasikan kepada penyelenggara jika belum tersedia.', '[nama sesuai catatan] — [keterangan yang diminta]', 'Catatan pemilik manfaat dari penyelenggara, bukan daftar anggota sanggar.');

add('JEN_PRO', 'Proses yang sedang dicatat oleh paket dokumen ini.', 'Pilih sesuai kejadian: pembentukan baru, penetapan, atau penataan catatan sanggar yang sudah berjalan.', 'Penataan administrasi', 'Agenda dan hasil forum yang benar-benar dilakukan.', ['Pembentukan', 'Penetapan', 'Penataan administrasi', 'Pembentukan dan penetapan']);
add('TIN_POK', 'Kata tindakan utama dalam keputusan forum.', 'Sesuaikan dengan isi keputusan dan jenis proses. Menegaskan keberadaan dipakai hanya bila itulah keputusan forum.', 'Menetapkan', 'Rumusan keputusan forum.', ['Membentuk', 'Menetapkan', 'Menegaskan keberadaan']);
add('HAR HAR_FOR', 'Nama hari saat rapat atau forum berlangsung.', 'Cocokkan hari dengan tanggal pelaksanaan yang dicatat. Jangan memakai hari pengisian formulir jika berbeda.', '[hari sesuai tanggal forum]', 'Undangan, berita acara, atau catatan pelaksanaan.');
add('TEM TEM_FOR TEMPAT TEM_ATA', 'Lokasi atau media tempat pertemuan dan kegiatan berlangsung.', 'Sebutkan nama tempat serta lokasi singkat. Untuk pertemuan daring, sebutkan media dan keterangan yang diperlukan.', 'Aula [nama tempat], [kelurahan]; atau pertemuan daring melalui [media]', 'Undangan, jadwal, atau catatan pelaksanaan.');
add('PUK_MUL WAK_MUL', 'Jam kegiatan atau forum mulai berlangsung.', 'Gunakan waktu setempat dan tambahkan zona waktu bila perlu. Cocokkan dengan waktu selesai.', '[jam mulai] WIB', 'Jadwal atau catatan waktu pelaksanaan.');
add('PUK_SEL WAK_SEL', 'Jam kegiatan atau forum berakhir.', 'Gunakan waktu setempat. Jika selesai pada hari berikutnya, tulis keterangannya agar tidak tertukar.', '[jam selesai] WIB', 'Jadwal atau catatan waktu pelaksanaan.');
add('JUM_HAD', 'Jumlah orang yang benar-benar hadir pada forum.', 'Hitung peserta pada daftar hadir dan tulis angka saja; kata orang sudah dicetak.', '[jumlah orang pada daftar hadir]', 'Daftar hadir forum, bukan total anggota terdaftar.');
add('JUM_PES', 'Jumlah peserta kegiatan yang sedang dicatat.', 'Tulis angka saja. Pastikan apakah dokumen meminta rencana peserta atau peserta aktual.', '[jumlah peserta sesuai daftar]', 'Daftar peserta untuk kegiatan ini.');
add('JUM_DAN JEN_DAN JEN_DA2 PES_REA', 'Rincian jumlah dan kelompok peserta, anggota, pelatih, atau pekerja.', 'Sebutkan kelompok dan jumlahnya; untuk realisasi, hanya hitung yang benar-benar terlibat.', '[jumlah] peserta pemula; [jumlah] pelatih', 'Daftar anggota, daftar peserta, atau daftar hadir yang sesuai periode.');
add('NAM_KEG KEGIATAN KEG PROGRAM PEL_PRO', 'Nama kegiatan atau program yang menjadi pokok dokumen.', 'Gunakan nama yang mudah dikenali dan konsisten pada jadwal, perjanjian, serta laporan.', 'Latihan tari tradisi; lokakarya musik; pementasan seni', 'Program kerja atau jadwal kegiatan sanggar.', ['Latihan tari tradisi', 'Latihan musik tradisi', 'Lokakarya seni', 'Pementasan seni', 'Pameran karya', 'Pembinaan anggota']);
add('PERIODE TAN_PER', 'Rentang waktu program atau kegiatan, yang dapat mencakup lebih dari satu tanggal.', 'Tuliskan tanggal mulai–selesai atau bulan/periode yang benar. Nilai lama berbentuk teks tetap dapat dipakai.', '[tanggal mulai]–[tanggal selesai] atau [bulan dan tahun]', 'Jadwal kegiatan atau periode pelaporan.');
add('TUJ', 'Manfaat atau perubahan yang ingin dicapai melalui kegiatan.', 'Jelaskan siapa yang dibantu dan kemampuan atau hasil yang ingin ditingkatkan.', 'Meningkatkan kemampuan gerak dasar tari bagi peserta pemula.', 'Rencana kegiatan yang disepakati.');
add('HAS_OUT KELUARAN', 'Hasil nyata yang direncanakan atau harus diserahkan.', 'Sebutkan bentuk hasil dan jumlahnya jika sudah ditetapkan; bedakan dari manfaat umum kegiatan.', 'Koreografi, pementasan, dan laporan dokumentasi sesuai rencana.', 'Rencana kegiatan atau kesepakatan hasil pekerjaan.');
add('RIN_PEL', 'Urutan pekerjaan dan cara kegiatan dilaksanakan.', 'Uraikan tahap utama, pelaksana, serta jadwal yang relevan. Untuk laporan, catat yang benar-benar terlaksana.', 'Pendaftaran, latihan bersama, gladi bersih, lalu pementasan.', 'Jadwal dan catatan pelaksanaan.');
add('HAS_REA', 'Hasil yang benar-benar tercapai setelah kegiatan.', 'Bandingkan dengan target tanpa menambahkan hasil yang belum selesai.', '[jumlah aktual] latihan selesai dan [hasil yang telah diserahkan].', 'Laporan kegiatan dan bukti hasil pekerjaan.');
add('MIT LEM_MIT', 'Nama lembaga atau pihak mitra yang terlibat.', 'Salin nama mitra secara lengkap. Nama orang yang mewakili mitra diisi pada kolom wakil mitra.', '[nama resmi lembaga mitra]', 'Kesepakatan kerja sama atau identitas yang diberikan mitra.');
add('KEN KENDALA', 'Hambatan yang terjadi serta dampaknya pada kegiatan.', 'Catat kejadian sebenarnya. Bila tidak ada hambatan, tulis demikian hanya setelah memeriksa pelaksanaan.', 'Latihan luar ruang dipindahkan ke aula karena hujan.', 'Catatan evaluasi pelaksana.');
add('TIN_LAN', 'Langkah perbaikan atau pekerjaan lanjutan setelah evaluasi.', 'Sebutkan tindakan, penanggung jawab, dan target waktu yang disepakati.', '[penanggung jawab] melengkapi [kebutuhan] sebelum [tanggal].', 'Hasil evaluasi dan kesepakatan tindak lanjut.');
add('LOK_TAU', 'Tempat penyimpanan foto, video, atau bukti kegiatan.', 'Tulis nama folder atau tautan yang bisa diakses penerima yang berwenang; jangan sertakan kata sandi.', 'Folder [nama kegiatan] pada arsip sanggar; tautan [alamat berkas]', 'Arsip dokumentasi kegiatan.');

const people = {
  KETUA: 'ketua atau kepala sanggar', WAK_KET: 'wakil ketua atau kepala', SEK: 'sekretaris sanggar', BEN: 'bendahara sanggar', PEMBINA: 'pembina atau penasihat',
  PIM_FOR: 'pimpinan forum', NAM_PIM: 'pimpinan rapat', NOTULIS: 'notulis forum', NAM_SEK: 'sekretaris atau notulis rapat',
  NAM_PEN: 'pihak berwenang yang menandatangani keputusan atau perjanjian', NAM_TTD_: 'penandatangan pada bagian tanda tangan', NAM_PI2: 'pimpinan atau pengurus badan penyelenggara',
  NAM_MIT: 'orang yang mewakili mitra', NAM_DAN: 'penanggung jawab keselamatan', PIC: 'penanggung jawab kegiatan', NAM: 'pelatih atau penanggung jawab pada baris kegiatan',
  PIH_LAM: 'pihak yang menyerahkan pengelolaan', PIH_BAR: 'pihak yang menerima pengelolaan', PEN_LAP: 'penyusun laporan', VER: 'pemeriksa laporan', NOTARIS: 'notaris yang tercantum pada akta',
};
for (const [key, role] of Object.entries(people)) {
  const forum = ['PIM_FOR', 'NAM_PIM', 'NOTULIS', 'NAM_SEK'].includes(key);
  add(key, `Nama lengkap ${role}.`, `Salin nama orang yang benar-benar menjalankan peran ini. ${forum ? 'Pimpinan atau pencatat forum belum tentu penandatangan keputusan.' : 'Jangan otomatis menyamakan dengan pimpinan forum atau pemilik akun.'}`, `[nama lengkap ${role}]`, key === 'NOTARIS' ? 'Akta yang digunakan sebagai rujukan.' : forum ? 'Daftar petugas dan berita acara forum.' : key === 'NAM_MIT' ? 'Identitas wakil mitra dan penugasannya.' : 'Daftar pengurus, penugasan, atau dokumen kewenangan untuk peran ini.');
}
add('ID_KETUA ID_WAKIL ID_SEK ID_BEN', 'Identitas orang yang namanya ada pada baris pengurus yang sama.', 'Salin jenis dan nomor identitas yang diminta template. Pertahankan nol di awal dan pastikan pemiliknya cocok.', '[jenis identitas] [nomor milik pengurus pada baris ini]', 'Data identitas pengurus terkait, bukan identitas pemilik akun secara otomatis.');
add('PIC_DAR', 'Orang dan nomor yang harus dihubungi saat terjadi insiden.', 'Tulis nama, peran, serta kontak aktif yang telah disetujui untuk kondisi darurat.', '[nama petugas], [peran], [nomor kontak aktif]', 'Daftar petugas keselamatan kegiatan.');
add('JAB_FOR', 'Peran yang dicantumkan di bawah tanda tangan forum.', 'Pilih peran sesuai petugas dan tata cara forum. Ketua Sidang dapat berbeda dari Ketua Sanggar.', 'Ketua Sidang', 'Penetapan petugas forum dan berita acaranya.', ['Ketua Sidang', 'Pimpinan Rapat', 'Ketua', 'Sekretaris', 'Notulis']);
add('JAB_PEN JAB_DIR JAB_IND JAB_MIT', 'Jabatan yang menjelaskan kapasitas pihak yang menandatangani atau memeriksa.', 'Cocokkan jabatan dengan nama orang dan pihak yang diwakilinya; jabatan mitra/induk tidak diambil dari pengurus sanggar.', '[jabatan sesuai penugasan]', 'Surat penugasan atau struktur pihak yang bersangkutan.');
add('ORG_PEN ORG_IND', 'Forum, pengurus, atau bagian organisasi yang berwenang menetapkan atau mengetahui keputusan.', 'Tulis nama organ sesuai dokumen dasar. Ini nama pihak kelembagaan, bukan otomatis nama orang.', 'Rapat Pengurus; Pengurus Yayasan; Direksi', 'Dokumen dasar dan keputusan organisasi yang bersangkutan.');

const dateSources = {
  TGL_BER: ['mulai berdiri atau berkegiatan', 'Catatan awal kegiatan atau dokumen pembentukan; tanggal ini dapat berbeda dari forum penataan administrasi.'],
  TAN_PEM: ['pembentukan organisasi', 'Dokumen pembentukan organisasi.'], TGL_FOR: ['forum administrasi', 'Berita acara forum administrasi.'],
  TAN_RAP: ['rapat', 'Undangan atau berita acara rapat.'], TGL_KEG: ['kegiatan', 'Jadwal atau catatan pelaksanaan kegiatan.'],
  TGL_PIL: ['forum pengangkatan pengelola', 'Berita acara pengangkatan pengelola.'], TGL_RAP_: ['rapat atribut', 'Berita acara rapat tentang logo, stempel, atau atribut.'],
  TGL_RA2: ['rapat keuangan', 'Berita acara rapat keuangan.'], TGL_RA3: ['rapat pelatih', 'Berita acara rapat penugasan pelatih.'],
  TGL_SER: ['serah terima', 'Berita acara serah terima.'], TGL_LAP: ['laporan', 'Tanggal laporan yang diperiksa atau ditandatangani.'],
  TGL_AKT: ['akta', 'Akta dengan nomor yang tercantum pada kolom nomor akta.'], TAN_SK: ['surat keputusan', 'Surat keputusan yang nomor lengkapnya sudah dicantumkan.'],
  TAN_SKT: ['surat keterangan atau pengesahan', 'Dokumen surat keterangan atau pengesahan terkait.'], TAN_SUR: ['surat', 'Surat yang sedang disusun atau dirujuk.'],
  TAN: ['penandatanganan', 'Tanggal yang benar-benar digunakan pada tanda tangan dokumen.'], TGL_KON: ['perjanjian', 'Perjanjian yang disepakati para pihak.'],
  TGL_SK_A: ['keputusan atribut', 'Keputusan tentang atribut.'], TGL_SK_K: ['keputusan keuangan', 'Keputusan tentang keuangan.'], TGL_SK_P: ['keputusan pelatih', 'Keputusan penugasan pelatih.'],
  TGL_SK2: ['keputusan pengelola', 'Keputusan pengangkatan pengelola.'], TGL_AWA_: ['mulai masa bakti', 'Keputusan pengangkatan; cocokkan dengan akhir masa bakti.'],
  TGL_AKH_: ['akhir masa bakti', 'Keputusan pengangkatan; cocokkan dengan awal masa bakti.'], TGL_MUL_: ['mulai penugasan', 'Surat penugasan yang berlaku.'],
  TGL_AK2: ['akhir penugasan', 'Surat penugasan yang berlaku.'], TGL_MUL: ['mulai perjanjian', 'Bagian jangka waktu pada perjanjian.'], TGL_SEL: ['akhir perjanjian', 'Bagian jangka waktu pada perjanjian.'],
};
for (const [key, [event, source]] of Object.entries(dateSources)) add(key, `Tanggal ${event}.`, 'Pilih tanggal sesuai sumber. Jika hanya ada catatan periode atau perkiraan, pertahankan teksnya dan konfirmasikan; jangan menggantinya dengan hari ini.', `[tanggal ${event} sesuai sumber]`, source);
add('KD', 'Kode singkat yang menjadi bagian nomor surat sanggar.', 'Ikuti kode pada register surat, termasuk huruf dan tanda pemisah yang digunakan.', '[kode resmi sanggar]', 'Register penomoran surat sanggar.');
add('NO_BA NO_KMM NO_ATR NO_KEU NO_PEL', 'Nomor urut untuk dokumen pada register surat.', 'Tulis nomor urut saja, termasuk nol di awal. Kode, bulan, dan tahun telah disediakan template; jangan mengulang seluruh nomor.', '[nomor urut dari register]', 'Register surat untuk jenis dokumen dan periode ini.');
add('NO_PEN NO_KON NO_SERAH NOM_DOK NOM_KEP NOM_SK NOM_SKT NOM_SUR NOM_DAN NO_AKTA NOM_KEB', 'Nomor lengkap dokumen yang diterbitkan atau menjadi rujukan.', 'Salin nomor dan tanda pemisah persis dari sumber. Untuk dokumen baru, gunakan nomor yang sudah dialokasikan pada register.', '[nomor lengkap sesuai dokumen atau register]', 'Dokumen rujukan atau register penomoran pihak penerbit.');
add('BLN BLN_ATR BLN_KEU BLN_PLT', 'Bulan yang menjadi bagian nomor dokumen.', 'Pilihan memakai angka Romawi. Sesuaikan dengan tanggal penerbitan dan format register; isian sendiri tetap tersedia.', '[bulan dokumen dalam format register]', 'Tanggal penerbitan dan register surat.');
add('THN THN_ATR THN_KEU THN_PLT TAH_PAK', 'Tahun yang dicantumkan pada dokumen atau paket.', 'Cocokkan dengan tanggal dan periode dokumen. Tahun saat ini hanya menjadi daftar pilihan, bukan otomatis tahun dokumen.', '[tahun dokumen]', 'Tanggal penerbitan atau periode paket yang disepakati.');
add('THN_AWA_ THN_AKH_', 'Tahun awal atau akhir masa bakti pengelola.', 'Ambil tahun dari tanggal mulai atau akhir masa bakti yang sudah ditetapkan, bukan dari tahun pengisian.', '[tahun pada keputusan masa bakti]', 'Keputusan pengangkatan pengelola.');
add('KOTA KOT', 'Kota yang dicantumkan pada bagian penetapan atau tanda tangan.', 'Gunakan lokasi yang sesuai penetapan atau penandatanganan, yang bisa berbeda dari alamat sekretariat.', '[kota penetapan atau penandatanganan]', 'Keterangan tempat pada dokumen atau pelaksanaan.');
add('DUR_BAK', 'Lama penugasan pengelola dalam satuan tahun.', 'Tulis angka saja karena kata tahun sudah tercetak. Cocokkan dengan tanggal mulai dan akhir masa bakti.', '[jumlah tahun yang disepakati]', 'Keputusan masa bakti pengelola.');
add('MAS_JAB MAS_KEW', 'Rentang waktu seseorang menjabat atau menggunakan kewenangan.', 'Tuliskan jumlah dan satuan waktu atau periode yang ditetapkan. Jabatan dan kewenangan dapat memiliki masa yang berbeda.', '[jumlah] tahun atau [tanggal awal]–[tanggal akhir]', 'Dokumen pengangkatan atau pemberian kewenangan.');

const mandateSources = ['Keputusan rapat', 'Surat keputusan', 'Surat kuasa', 'Surat penugasan'];
add('DAS_MAN', 'Dokumen atau keputusan yang memberi pengelola izin menjalankan tugas tertentu, misalnya mengurus kegiatan, keuangan, pelatih, atau atribut.', 'Sebutkan jenis rujukan yang benar-benar ada, pihak pemberi mandat, serta nomor/tanggal bila tersedia. Pilihan adalah awal kalimat; lengkapi dan periksa cakupan tugasnya. Jika belum ada, konfirmasikan kepada pemberi mandat.', 'Keputusan rapat [nama penyelenggara] tanggal [tanggal] tentang pemberian mandat [tugas sesuai dokumen] kepada [pengelola].', 'Periksa naskah keputusan rapat, surat keputusan, surat kuasa, atau surat penugasan dari pemberi mandat. Jenis dokumen saja belum membuktikan mandat.', mandateSources);
add('DAS_KEW DAS_FOR', 'Rujukan yang menjelaskan mengapa pihak atau forum dapat mengambil keputusan ini.', 'Cantumkan nama dokumen, bagian/pasal jika ada, dan keputusan pemberi kewenangan yang terkait. Periksa bahwa tugas pada dokumen ini memang termasuk cakupannya.', '[nama dokumen dasar], bagian/pasal [rujukan], dan keputusan [pihak] tanggal [tanggal].', 'Dokumen dasar organisasi dan keputusan pihak yang memberi kewenangan; konfirmasikan rujukan yang belum jelas.', ['Dokumen dasar organisasi', 'Keputusan rapat', 'Surat keputusan', 'Surat penugasan']);
add('DAS_SER', 'Rujukan yang menjadi alasan dilakukan serah terima pengelolaan.', 'Sebutkan keputusan atau penugasan yang mengatur penggantian/pengalihan pengelola, berikut nomor dan tanggal jika tersedia.', 'Keputusan [pihak] nomor [nomor] tanggal [tanggal] tentang pergantian pengelola.', 'Keputusan pergantian atau surat perintah serah terima yang benar-benar tersedia.', ['Keputusan pergantian pengelola', 'Surat perintah serah terima', 'Keputusan rapat']);
add('KUASA KUA_MIT', 'Rujukan yang memberi wakil suatu pihak wewenang menandatangani perjanjian.', 'Salin rujukan milik pihak yang diwakili. Dasar Pihak Pertama dan wakil mitra dapat berbeda; jangan saling menyalin tanpa pemeriksaan.', 'Surat kuasa [pemberi kuasa] nomor [nomor] tanggal [tanggal] untuk [ruang lingkup].', 'Dokumen kewenangan masing-masing pihak; minta konfirmasi kepada pihak yang diwakili.', ['Surat kuasa', 'Surat penugasan', 'Keputusan pengurus', 'Dokumen dasar organisasi']);
add('PAS_AD PAS_AD2 PAS_AKT', 'Bagian dokumen dasar atau akta yang mengatur kewenangan terkait.', 'Salin nomor pasal/bagian beserta uraian singkat dari dokumen yang dimiliki. Jangan membuat nomor pasal bila tidak tercantum.', '[nama dokumen], Pasal [nomor pada sumber] tentang [pokok kewenangan].', 'Anggaran dasar, dokumen dasar, atau akta yang sesuai dengan nama kolom.');
add('MANDAT BAT_KUA', 'Tugas yang boleh dijalankan pengelola beserta batas persetujuannya.', 'Jelaskan kegiatan yang diizinkan dan keputusan yang masih memerlukan persetujuan pemberi mandat. Jangan menambahkan hak atau nominal yang belum disepakati.', 'Mengatur jadwal latihan dan administrasi rutin; [keputusan tertentu] memerlukan persetujuan [pihak].', 'Keputusan atau surat pemberian mandat dan batas kewenangannya.', ['Pengelolaan jadwal latihan', 'Administrasi kegiatan', 'Pengelolaan atribut', 'Koordinasi pelatih', 'Pelaporan kepada penyelenggara']);
add('UND_KEP', 'Rujukan atau alasan resmi diadakannya rapat ini.', 'Sebutkan undangan, keputusan, atau agenda yang benar-benar menjadi dasar rapat. Lengkapi nomor dan tanggal bila ada.', 'Undangan [penerbit] nomor [nomor] tanggal [tanggal] dengan agenda [agenda rapat].', 'Undangan rapat atau keputusan penyelenggara.', ['Undangan rapat', 'Keputusan rapat sebelumnya', 'Agenda kerja organisasi', 'Surat penugasan']);
add('RUA_LIN', 'Jenis kegiatan yang termasuk dalam pengelolaan sanggar.', 'Pilih kegiatan yang benar-benar dijalankan dan sesuai lingkup penyelenggara. Tambahkan uraian bila istilah umum belum cukup.', 'Pelatihan tari, penciptaan karya, pementasan, dan dokumentasi.', 'Program kerja dan keputusan pembentukan sanggar.', ['Pelatihan seni', 'Penciptaan karya', 'Produksi dan pementasan', 'Dokumentasi kegiatan', 'Pembinaan anggota']);
add('AKH_TUG', 'Keadaan yang menyebabkan penugasan selesai atau dihentikan.', 'Tuliskan kondisi yang telah disepakati, siapa yang memutuskan, dan cara penyelesaiannya. Jangan menganggap penugasan berakhir otomatis tanpa rujukan.', 'Masa tugas selesai sesuai [dokumen]; perubahan penugasan melalui keputusan [pihak].', 'Surat penugasan atau keputusan yang mengatur berakhirnya tugas.');
add('ATU_BAT', 'Kesepakatan jika kegiatan dibatalkan atau jadwalnya berubah.', 'Jelaskan cara pemberitahuan, pihak yang menyetujui, dan penyelesaian biaya berdasarkan kesepakatan yang ada.', 'Perubahan jadwal disepakati tertulis oleh [para pihak]; biaya yang sudah terjadi diperiksa bersama.', 'Bagian pembatalan pada kesepakatan para pihak.');
add('FOR_SEN', 'Tempat atau cara penyelesaian perselisihan setelah musyawarah belum berhasil.', 'Gunakan forum yang telah disepakati para pihak dan periksa rujukannya. Jangan memilih hanya karena tersedia dalam contoh.', '[forum penyelesaian yang disepakati para pihak]', 'Naskah kesepakatan para pihak.');
add('HAK_KAR', 'Kesepakatan tentang pemakaian karya dan izin merekam atau memublikasikannya.', 'Sebutkan pemilik/pemberi izin, penggunaan yang dibolehkan, serta batasnya sesuai kesepakatan. Jangan menyimpulkan izin dari kepemilikan berkas.', 'Izin [pemilik karya] untuk [penggunaan] pada [kegiatan], sesuai [dokumen izin].', 'Persetujuan pemilik karya atau perjanjian hak penggunaan.');
add('TUG_SAT TUG_DUA', 'Pekerjaan yang menjadi tanggung jawab pihak yang disebut dalam perjanjian.', 'Cocokkan dengan identitas Pihak Pertama atau Pihak Kedua. Sebutkan tugas, hasil, dan batas pekerjaan yang disepakati.', 'Menyediakan tempat dan perlengkapan; atau menyusun materi dan memimpin latihan.', 'Kesepakatan pembagian pekerjaan antara para pihak.');
const quorumActions = { KUO_MAY: 'kehadiran musyawarah', KUO_DUA_: 'perubahan anggaran dasar atau rumah tangga', KUO_SAT_: 'dukungan pengajuan musyawarah luar biasa', KUO_TIG_: 'perubahan status atau penggabungan' };
for (const [key, action] of Object.entries(quorumActions)) add(key, `Jumlah atau bagian anggota yang diperlukan untuk ${action}.`, `Periksa ketentuan khusus ${action}. Pilihan hanya contoh; tidak ada nilai yang ditetapkan otomatis.`, '[bagian atau jumlah sesuai ketentuan organisasi]', `Dokumen dasar atau keputusan organisasi yang mengatur ${action}.`);
const deadlines = { HARI_7: 'penyampaian undangan sebelum forum', HARI_14: 'tindak lanjut permintaan forum', BAT_LAP: 'penyampaian laporan kegiatan', BAT_KAH: 'pemberitahuan keadaan kahar', BAT_PER: 'kesempatan memperbaiki pelanggaran perjanjian', BAT_SEN: 'musyawarah penyelesaian perselisihan' };
for (const [key, action] of Object.entries(deadlines)) add(key, `Batas waktu untuk ${action}.`, 'Tulis jumlah dan satuan waktu yang disepakati, serta peristiwa awal penghitungannya bila perlu. Bedakan hari kalender dan hari kerja.', '[jumlah] hari kerja sejak [peristiwa awal]', `Ketentuan organisasi atau perjanjian tentang ${action}.`);
add('HAR_LPJ_ HAR_SER', 'Batas jumlah hari untuk pertanggungjawaban uang muka atau serah terima.', 'Tulis angka saja karena kata hari sudah dicetak; periksa kapan hitungan dimulai.', '[jumlah hari yang ditetapkan]', 'Keputusan keuangan atau ketentuan serah terima yang disepakati.');
add('BAT_TEG BAT_TUN', 'Lama tunggakan sebelum pemberitahuan atau penangguhan hak sesuai kolom.', 'Gunakan jumlah dan satuan yang ditetapkan. Batas pemberitahuan dapat berbeda dari batas penangguhan.', '[jumlah] bulan', 'Ketentuan iuran/tunggakan organisasi.');
add('MAS_ARS', 'Lama dokumen keuangan disimpan sebelum tindak lanjut pengarsipan.', 'Tuliskan jumlah dan satuan waktu dari kebijakan arsip yang dipakai. Pilihan tidak menetapkan masa simpan organisasi.', '[jumlah] tahun sesuai kebijakan arsip', 'Kebijakan penyimpanan arsip organisasi.');

add('IUR_BLN IUR_THN U_DAFTAR', 'Biaya yang dikenakan untuk periode atau pendaftaran pada kolom ini.', 'Tuliskan nominal uang saja agar terbilang dapat dihitung otomatis. Periksa dasar pengenaan dan periode pada kalimat dokumen; jangan mengulangnya dalam kolom nominal. Nilai nol hanya dipakai jika memang gratis.', 'Rp[jumlah yang disepakati]', 'Keputusan biaya/iuran, bukan tarif contoh aplikasi.');
add('TER_BLN TER_THN TER_DAF', 'Nominal biaya terkait yang ditulis dengan kata-kata.', 'Ubah angka pada kolom biaya yang sama menjadi terbilang dan periksa kecocokannya. Jangan menyalin terbilang dari biaya lain.', '[nominal terkait dalam kata-kata] rupiah', 'Kolom iuran bulanan, tahunan, atau pendaftaran yang bersesuaian.');
add('BAT_BEL BAT_GAN', 'Batas pengeluaran yang memerlukan persetujuan biasa atau persetujuan dua pihak.', 'Tulis nominal dan satuan per transaksi sesuai keputusan. Sebutkan pemberi persetujuan bila dibutuhkan.', 'Rp[batas yang ditetapkan] per transaksi, disetujui [pihak]', 'Keputusan kewenangan pengeluaran sanggar.');
add('BAN', 'Nama bank tempat rekening pembayaran terdaftar.', 'Gunakan nama bank sesuai rekening yang dicantumkan, bukan nama pemilik rekening.', '[nama bank]', 'Buku rekening atau rincian rekening yang dikonfirmasi pemiliknya.');
add('NOM_REK', 'Nomor rekening tujuan atau penerimaan pembayaran.', 'Salin persis, termasuk nol di awal. Periksa bersama nama bank dan pemilik rekening sebelum memakai dokumen.', '[nomor rekening sesuai catatan bank]', 'Rincian rekening dari pemilik yang berwenang.');
add('NAM_REK', 'Nama pemilik rekening sebagaimana tercatat pada bank.', 'Salin ejaan nama dari rekening; jangan otomatis memakai nama sanggar atau penandatangan jika berbeda.', '[nama pemilik sesuai rekening]', 'Buku rekening atau konfirmasi pemilik rekening.');
add('REKENING REK_RES', 'Rincian rekening yang disepakati untuk pembayaran atau penerimaan.', 'Cantumkan bank, nomor rekening, serta nama pemilik. Cocokkan ketiganya dari satu sumber yang sama.', '[bank] / [nomor rekening] / [nama pemilik]', 'Rincian rekening yang disetujui pemilik dan para pihak.');
add('NIL', 'Nominal transaksi yang sedang dicatat.', 'Salin jumlah dari bukti transaksi. Jika awalan Rp sudah terlihat pada pratinjau, tulis angka nominal saja.', '[nominal pada bukti transaksi]', money);
add('NIL_KON', 'Total nilai pekerjaan yang disepakati dalam perjanjian.', 'Tuliskan nominal dan jelaskan cakupannya bila diperlukan. Jangan menghitung dari tarif perkiraan.', 'Rp[nilai kesepakatan] untuk [lingkup pekerjaan]', 'Naskah atau rincian biaya yang disepakati para pihak.');
add('TAH_BAY', 'Waktu, syarat, dan jumlah setiap tahap pembayaran.', 'Salin kesepakatan tiap tahap. Pastikan total tahap sama dengan nilai yang harus dibayar.', '[tahap] sebesar [nominal/porsi] setelah [syarat terpenuhi]', 'Jadwal pembayaran yang disepakati para pihak.');
add('SYA_TAG', 'Bukti atau dokumen yang dibutuhkan untuk mengajukan pembayaran.', 'Cantumkan hanya persyaratan yang telah disepakati dan dapat diperiksa.', 'Tagihan, bukti pekerjaan selesai, dan berita acara penerimaan.', 'Ketentuan pembayaran pada perjanjian.');
add('PAJAK', 'Pihak yang menanggung komponen pajak menurut kesepakatan transaksi.', 'Salin kesepakatan para pihak dan konfirmasikan jika belum jelas. Kolom ini tidak menentukan jenis atau tarif pajak.', '[pihak penanggung] sesuai [rujukan kesepakatan]', 'Rincian kesepakatan pembayaran dan konfirmasi pengelola keuangan.');
const amounts = {
  ANG_MAS: ['penerimaan yang direncanakan', 'Jumlahkan sumber penerimaan pada anggaran kegiatan.'],
  ANG_KEL: ['pengeluaran yang direncanakan', 'Jumlahkan pos biaya pada anggaran kegiatan.'],
  ANG_SISA: ['sisa atau defisit anggaran', 'Kurangi rencana penerimaan dengan rencana pengeluaran; tandai defisit jika hasilnya negatif.'],
  REA_MAS: ['uang yang benar-benar diterima', 'Jumlahkan penerimaan aktual yang didukung bukti, bukan nilai rencana.'],
  REA_KEL: ['uang yang benar-benar dikeluarkan', 'Jumlahkan pengeluaran aktual yang didukung bukti, bukan nilai rencana.'],
  REA_SIS: ['sisa atau defisit realisasi', 'Kurangi penerimaan aktual dengan pengeluaran aktual pada periode yang sama.'],
  SEL_MAS: ['selisih penerimaan realisasi dan anggaran', 'Bandingkan realisasi dengan anggaran penerimaan; tulis apakah lebih atau kurang dan gunakan arah hitung yang konsisten.'],
  SEL_KEL: ['selisih pengeluaran realisasi dan anggaran', 'Bandingkan realisasi dengan anggaran biaya; tulis apakah lebih atau kurang dan gunakan arah hitung yang konsisten.'],
  SEL_SISA: ['selisih sisa realisasi dan sisa anggaran', 'Bandingkan sisa realisasi dengan sisa rencana pada periode yang sama.'],
  SAL_AWA: ['saldo sebelum periode laporan dimulai', 'Ambil saldo penutupan periode sebelumnya yang telah diperiksa.'],
  SAL_AKH: ['saldo setelah penerimaan dan pengeluaran periode ini', 'Hitung saldo awal ditambah penerimaan, dikurangi pengeluaran. Cocokkan dengan rincian bank dan kas.'],
  SAL_BAN: ['bagian saldo akhir yang berada di rekening bank', 'Cocokkan saldo bank dengan mutasi atau catatan bank pada akhir periode.'],
  SAL_KAS: ['bagian saldo akhir berupa uang kas', 'Gunakan catatan kas yang telah dicocokkan dengan uang kas aktual pada akhir periode.'],
  PIUTANG: ['tagihan yang masih harus diterima', 'Jumlahkan kewajiban pihak lain yang belum dibayar; jangan menghitungnya sebagai uang yang sudah diterima.'],
  UTANG: ['kewajiban yang masih harus dibayar', 'Jumlahkan tagihan yang belum dilunasi; bedakan dari biaya yang sudah dibayar.'],
  DAN_TER: ['dana yang penggunaannya dibatasi untuk tujuan tertentu', 'Catat jumlah dan tujuan pembatasannya sesuai pemberi dana atau keputusan yang berlaku.'],
};
for (const [key, [meaning, instruction]] of Object.entries(amounts)) add(key, `Jumlah ${meaning}.`, `${instruction} Gunakan angka dari catatan; nol berarti memang tidak ada, bukan belum diketahui.`, `Rp[jumlah ${meaning}]`, money);
add('PEN_SEL', 'Alasan perbedaan antara anggaran dan realisasi.', 'Jelaskan pos yang berubah, penyebab, serta bukti pendukungnya. Gunakan angka yang sama dengan tabel laporan.', '[pos] lebih/kurang [selisih] karena [penyebab yang tercatat].', 'Perbandingan anggaran dan buku kas beserta bukti transaksi.');
const recipients = { KAS: 'kas sanggar', SOSIAL: 'dana cadangan/sosial', KREASI: 'tim kreatif', PROD: 'tim produksi/teknis', TAMPIL: 'pelaku/penampil', UNIT: 'kelompok/unit/anggota' };
for (const [suffix, recipient] of Object.entries(recipients)) {
  add(`P_${suffix}`, `Bagian hasil bersih untuk ${recipient}.`, 'Tuliskan porsi yang disepakati beserta tanda %. Gunakan hasil bersih yang telah diperiksa sebagai dasar yang sama untuk semua penerima. Porsi kelompok adalah total kelompok, bukan per orang.', '[persentase yang disepakati]%', 'Keputusan pembagian hasil bersih dan daftar penerima.');
  add(`B_${suffix}`, `Alokasi anggaran bagi ${recipient}.`, 'Gunakan nominal atau porsi dari anggaran yang disepakati, dengan dasar perhitungan yang sama untuk semua pos. Bedakan alokasi anggaran dari pembagian hasil bersih.', 'Rp[alokasi yang disepakati] atau [porsi anggaran]%', 'Anggaran yang disetujui dan rincian kelompok penerima.');
}

add('SAL_SER', 'Rincian kas dan rekening yang diserahterimakan.', 'Sebutkan kas/rekening, saldo pada waktu pemeriksaan, serta pihak yang menyerahkan dan menerima sesuai berita acara.', 'Kas: Rp[saldo]; [bank/rekening]: Rp[saldo] pada [tanggal pemeriksaan]', 'Hasil pemeriksaan kas dan rekening saat serah terima.');
add('DAF_BAR', 'Barang yang diserahkan beserta jumlah dan kondisinya.', 'Catat tiap jenis barang, jumlah, kondisi, dan kode inventaris jika ada.', '[jumlah] kostum [kondisi]; [alat] kode [inventaris], [kondisi]', 'Daftar inventaris dan pemeriksaan fisik bersama.');
add('KON_AKT', 'Kontrak yang masih berjalan dan kewajiban yang belum selesai.', 'Sebutkan kontrak, pihak terkait, masa berlaku, dan kewajiban tersisa berdasarkan catatan.', '[nama kontrak], berlaku sampai [tanggal], kewajiban tersisa [uraian]', 'Kontrak aktif dan catatan pemenuhan kewajibannya.');
add('DAF_ARS', 'Arsip dan data yang diserahkan kepada pengelola berikutnya.', 'Tuliskan jenis berkas, periode, jumlah atau lokasi simpan, serta batas akses yang perlu dijaga.', 'Daftar anggota periode [periode], tersimpan di [lokasi arsip]', 'Daftar arsip organisasi; serahkan melalui pihak yang berwenang.');
add('DAF_AKU', 'Daftar akun layanan dan pihak yang menerima pengelolaannya.', 'Tuliskan nama layanan, nama akun, dan penerima akses. Jangan menuliskan kata sandi, PIN, atau kode masuk.', '[layanan] — [nama akun] — pengelola baru [nama]', 'Daftar akun resmi dan proses pengalihan akses layanan.');
add('BUK_KAS BUK_ASE REG_KON BER_ARS', 'Bukti pendukung untuk barang, kas, kontrak, atau arsip pada baris yang sama.', 'Sebutkan nama bukti, nomor/lokasi berkas, dan tanggal pemeriksaan jika ada. Pastikan bukti cocok dengan rincian yang diserahkan.', '[nama lampiran atau bukti] — [nomor/lokasi berkas]', 'Bukti serah terima dan lampiran yang benar-benar tersedia.');
add('BUK_ALI_', 'Bukti bahwa akses akun sudah dialihkan kepada pihak penerima.', 'Catat konfirmasi perubahan pengelola atau bukti proses layanan. Jangan mencantumkan kata sandi, PIN, atau kode masuk.', 'Konfirmasi perubahan pengelola akun [layanan] pada [tanggal]', 'Konfirmasi layanan atau berita acara pengalihan akses.');
add('CAT_SER', 'Kekurangan serah terima yang masih harus diselesaikan.', 'Sebutkan barang/berkas yang kurang, penanggung jawab, dan tenggat yang disepakati.', '[kekurangan] dilengkapi oleh [pihak] paling lambat [tanggal].', 'Hasil pemeriksaan bersama saat serah terima.');

const visual = {
  LOGO: ['Gambar identitas sanggar yang akan ditempelkan pada dokumen.', 'Logo [uraian singkat desain yang digunakan]'],
  LOG_FIN: ['Versi logo yang telah disetujui untuk dipakai.', 'Logo versi [nama/versi yang disetujui]'],
  STE_FIN: ['Desain stempel yang telah disetujui untuk dipakai.', 'Stempel [bentuk] milik [organisasi]'],
  NAM_LOG: ['Nama atau sebutan untuk lambang sanggar.', 'Lambang [sebutan logo]'],
  BEN_LOG: ['Bentuk dasar dan unsur gambar yang terlihat pada logo.', 'Lingkaran dengan siluet penari di tengah.'],
  MAK_LOG: ['Arti unsur dan warna menurut penjelasan pemilik logo.', 'Lingkaran melambangkan kebersamaan.'],
  KOD_WAR: ['Warna dan kode warna untuk menjaga konsistensi desain.', '[nama warna] #[kode warna pada desain]'],
  FON_LOG: ['Jenis huruf pada logo atau tulisan pendampingnya.', 'Arial Bold; atau huruf gambar khusus.'],
  MIN_LOG: ['Ukuran terkecil logo yang masih dapat dibaca dengan jelas.', 'Lebar minimal [ukuran hasil pemeriksaan] cm pada cetakan.'],
  PRO_LOG: ['Perbandingan lebar terhadap tinggi logo.', '[lebar]:[tinggi] sesuai desain asli'],
  RUA_LOG: ['Jarak kosong yang menjaga logo terpisah dari unsur lain.', 'Jarak bebas [ukuran] di seluruh sisi logo.'],
  KET_LOG: ['Petunjuk tambahan agar penggunaan logo tetap konsisten.', 'Gunakan pada latar putih dan pertahankan perbandingan gambar.'],
  UKU_STE: ['Bentuk dan ukuran stempel yang dipakai.', '[bentuk], lebar [ukuran] cm dan tinggi [ukuran] cm'],
};
for (const [key, [meaning, example]] of Object.entries(visual)) add(key, meaning, ['LOGO', 'LOG_FIN', 'STE_FIN'].includes(key) ? 'Gunakan bagian Logo, stempel, dan kop surat untuk mengunggah gambar. Kolom teks hanya menjelaskan gambar; tidak menggantikan unggahan.' : 'Cocokkan uraian dengan desain yang benar-benar digunakan dan telah diperiksa pemiliknya.', example, 'Berkas desain dan keputusan penggunaan identitas sanggar.');

for (let n = 1; n <= 8; n++) {
  const two = String(n).padStart(2, '0');
  const row = `peserta ${n}`;
  add(`NAM${two}`, `Nama lengkap ${row} pada daftar hadir.`, 'Gunakan satu orang untuk setiap baris. Kontak, jabatan, dan identitas pada nomor baris yang sama harus milik orang ini.', `[nama lengkap ${row}]`, 'Daftar peserta dan kehadiran forum.');
  add(`JAB${two}`, `Jabatan atau peran ${row}.`, 'Cocokkan peran dengan orang pada kolom nama di baris yang sama; jangan menyalin jabatan orang lain.', `[peran ${row}]`, 'Daftar peserta atau konfirmasi peserta.');
  add(`NIK_I${two}`, `NIK atau identitas ${row}.`, 'Salin identitas orang pada baris ini hanya jika diminta template. Pertahankan nol di awal.', `[identitas milik ${row}]`, 'Identitas peserta pada nomor baris yang sama.');
  add(`KON${two}`, `Nomor kontak ${row}.`, 'Gunakan nomor orang pada baris yang sama yang telah disetujui untuk dicantumkan.', `[nomor kontak ${row}]`, 'Kontak yang dikonfirmasi peserta tersebut.');
  add(`KET_${n}`, `Keterangan tambahan pengurus pada baris ${n}.`, 'Tambahkan catatan yang relevan dengan orang atau jabatan pada baris ini. Tidak perlu mengulang seluruh identitas.', `[ruang tugas atau catatan pengurus baris ${n}]`, 'Susunan pengurus dan catatan penugasannya.');
  if (n <= 4) {
    add(`KOORD_${n}`, `Nama koordinator pada posisi ${n}.`, 'Cocokkan orang dengan bidang dan identitas pada baris koordinator yang sama.', `[nama koordinator ${n}]`, 'Susunan pengelola atau surat penugasan.');
    add(`ID_K${n}`, `Identitas koordinator ${n}.`, 'Salin identitas milik koordinator pada baris yang sama; pertahankan nol di awal.', `[identitas koordinator ${n}]`, 'Data koordinator terkait, bukan identitas ketua secara otomatis.');
  }
  if (n <= 3) {
    add(`PEL_${n}`, `Nama pelatih pada baris ${n}.`, 'Satu baris mewakili satu pelatih. Materi, jadwal, dan status bernomor sama harus sesuai pelatih ini.', `[nama pelatih ${n}]`, 'Daftar pelatih dan penugasannya.');
    add(`ST_${n}`, `Status penugasan pelatih ${n}.`, 'Pilih status yang tercantum pada penugasan atau kesepakatan. Pilihan tidak mengubah hubungan kerja secara otomatis.', '[status sesuai penugasan]', 'Surat penugasan atau perjanjian pelatih pada baris yang sama.');
    add(`MATERI_${n}`, `Materi yang diajarkan pelatih ${n}.`, 'Sebutkan topik dan tingkat peserta. Cocokkan dengan pelatih dan jadwal bernomor sama.', 'Gerak dasar tari dan latihan irama untuk peserta pemula.', `Rencana pengajaran pelatih ${n}.`);
    add(`WAKTU_${n}`, `Jadwal mengajar pelatih ${n}.`, 'Tuliskan hari/tanggal, jam, dan periode jika berulang. Jangan mengambil jadwal pelatih pada baris lain.', '[hari], [jam mulai]–[jam selesai] WIB, periode [periode]', `Jadwal yang disepakati dengan pelatih ${n}.`);
    add(`BIDANG_${n}`, `Bidang pengelolaan pada posisi ${n}.`, 'Pilih bidang yang memang ditugaskan untuk posisi ini; beberapa bidang boleh digabung bila sesuai keputusan.', 'Latihan dan pembinaan; dokumentasi', 'Pembagian tugas pengelola.');
  }
}

/** Canonical key coverage is explicit so additions to the catalog can be tested. */
export function hasFieldGuidance(key) { return guides.has(key); }

export function fieldGuidance(key, { label, parent = false, legacyHelp } = {}) {
  const raw = guides.get(key) || {
    meaning: `${label || 'Kolom tambahan'} melengkapi informasi pada kalimat dokumen.`,
    howToFill: 'Baca kalimat sebelum dan sesudah kolom pada pratinjau. Salin informasi yang diminta dari sumber terkait, atau konfirmasikan kepada penyusun dokumen.',
    example: '[informasi yang diminta pada kalimat dokumen]', sourceHint: records,
  };
  const guidance = { meaning: raw.meaning, howToFill: raw.howToFill, example: raw.example, sourceHint: raw.sourceHint };
  // Preserve the detailed design and allocation explanations already reviewed.
  if (legacyHelp && (/^[PB]_(?:KAS|SOSIAL|KREASI|PROD|TAMPIL|UNIT)$/.test(key) || Object.hasOwn(visual, key))) guidance.howToFill = legacyHelp;
  if (parent) {
    for (const name of Object.keys(guidance)) guidance[name] = guidance[name].replace(/\bsanggar\b/gi, 'organisasi induk');
    guidance.sourceHint = `Kolom ini khusus organisasi induk, bukan identitas unit sanggar. ${guidance.sourceHint}`;
    if (key === 'LOGO') {
      guidance.meaning = 'Uraian logo organisasi induk yang menaungi sanggar.';
      guidance.howToFill = 'Tuliskan uraian logo induk sesuai sumber. Kolom ini berupa teks; belum tersedia unggahan gambar terpisah untuk logo induk. Unggahan logo sanggar tidak mengisi gambar pada kolom ini.';
      guidance.example = 'Logo [nama organisasi induk] berupa [uraian bentuk dan tulisan].';
      guidance.sourceHint = 'Kolom ini khusus organisasi induk, bukan identitas unit sanggar. Periksa desain logo resmi organisasi induk.';
    }
  }
  return { guidance, ...(raw.suggestions ? { suggestions: [...raw.suggestions] } : {}) };
}
