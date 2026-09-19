import { useDb } from "./auth";
import { DEFAULT_LANGUAGE, normalizeLang, type Language } from "./types";

type Dict = Record<string, string>;

export { DEFAULT_LANGUAGE, LANGUAGES, normalizeLang } from "./types";

// Source strings throughout the codebase are written in standard Indonesian,
// so the "jkt" pack is the identity pack and needs no entries.
const JKT: Dict = {};

// Logat nyablak & modern: ramah, sopan, blak-blakan. Kosakata khas:
// "Masuk Nyok" (login), "Cabut/Pamit" (logout), "Sedot" (download),
// "Jepret" (capture), "Catet" (save), "Sat-set" (cepet),
// "Markas Besar" (dashboard), "Lobby" (home/beranda),
// "Pasukan Kite" (members), "Singgasana" (admin panel).
const BTW: Dict = {
  // Navigasi inti
  "Beranda": "Lobby",
  "Pengaturan": "Atur-Atur",
  "Pengaturan Tampilan": "Atur Tampilan",
  "Tampilan": "Tampilan",
  "Profil Saya": "Profil Aye",
  "Keluar": "Pamit",
  "Notifikasi": "Kabar",

  // Aksi umum
  "Simpan": "Catet",
  "Simpan Semua": "Catet Semuanye",
  "Simpan Identitas": "Catet Identitas",
  "Simpan Backdrop": "Catet Backdrop",
  "Simpan Bahasa": "Catet Bahasa",
  "Simpan Tema Kustom": "Catet Tema Racikan",
  "Simpan Studio": "Catet Studio",
  "Batal": "Batalin",
  "Batalkan": "Batalin Aje",
  "Hapus": "Buang",
  "Hapus Logo": "Buang Logo",
  "Tambah": "Tambahin",
  "Reset": "Balikin",
  "Kembalikan Default": "Balikin ke Awal",
  "Kembalikan Bawaan": "Balikin ke Awal",
  "Pilih": "Pilih",
  "Unggah": "Sedot Masuk",

  // Tab Tampilan
  "Brand & Logo": "Brand & Logo",
  "Tema & Warna": "Tema & Warna",
  "Backdrop": "Backdrop",
  "Pop-up Tradisi": "Pop-up Tradisi",
  "Bahasa": "Bahasa",
  "Studio Lanjutan": "Studio Pro",
  "Mode Tampilan": "Mode Tampilan",
  "Aksen Warna": "Warna Aksen",
  "Tema Kustom Anda": "Tema Racikan Aye",

  // Pilihan bahasa
  "Pilih Bahasa Antarmuka": "Pilih Bahasa Tampilan",
  "Bahasa Betawi": "Bahasa Betawi",
  "Bahasa Jakarta": "Bahasa Jakarta",
  "Bahasa Inggris": "Bahasa Inggris",

  // Login
  "Selamat Datang Kembali": "Balik Lagi, Pasukan!",
  "Masuk Aman": "Masuk Nyok",
  "Masuk Akun": "Masuk Nyok",
  "Memverifikasi...": "Lagi diperiksa, sat-set...",
  "Username / Email": "Username / Email",
  "Password": "Sandi",
  "Lupa Password?": "Lupa Sandi?",
  "Daftar Akun": "Daftar Akun",
  "Akun Demo": "Akun Cobaan",
  "Gunakan kredensial yang terdaftar untuk melanjutkan.": "Pake username sama sandi yang udah kedaftar buat masuk, ye.",
  "Gagal masuk": "Belom Bisa Masuk",
  "Username atau password tidak cocok.": "Username sama sandinye kage cocok, coba lagi, Bang.",
  "Server tidak dapat dihubungi.": "Servernye lagi kage nyambung. Coba lagi bentar, ye.",
  "Sembunyikan password": "Sembunyiin sandi",
  "Tampilkan password": "Tampilin sandi",

  // Verifikasi kemanusiaan
  "Verifikasi Kemanusiaan": "Buktiin Elu Manusia",
  "Susun baris berikut menjadi pantun yang utuh.": "Susun barisnye jadi pantun yang bener, ye.",
  "Ketuk baris sesuai urutan yang benar.": "Pencet barisnye satu-satu sesuai urutannye.",
  "Verifikasi berhasil": "Sip, kebukti manusia!",
  "Urutan belum tepat. Coba lagi.": "Urutannye belom pas. Cobain lagi, Bang.",
  "Ganti soal": "Ganti Soalnye",
  "Ulangi": "Ulang Lagi",
  "Selesaikan verifikasi terlebih dahulu.": "Beresin dulu verifikasinye, ye.",
  "Terverifikasi": "Udah Kebukti",
  "Pilih cara verifikasi": "Pilih care verifikasinye",
  "Susun Pantun": "Susun Pantun",
  "Tebak-tebakan": "Tebak-tebakan",
  "Ketik jawaban di sini": "Ketik jawabannye di sini",
  "Periksa Jawaban": "Cek Jawaban",
  "Petunjuk": "Bocoran",
  "Jawaban belum tepat. Coba lagi.": "Jawabannye belom pas. Cobain lagi, Bang.",
  "Tahukah Anda?": "Tau kage?",

  // Roles
  "Kurator": "Kurator",
  "Admin": "Singgasana",
  "Sanggar": "Sanggar",
  "Pelatih": "Pelatih",
  "Seniman": "Seniman",
  "Juri": "Juri",

  // Toast & status
  "Edisi Premium": "Edisi Sultan",
  "Tagline Resmi": "Slogan Resmi",
  "Bahasa berhasil diganti": "Bahasanye dah keganti",
  "Tema kustom diterapkan": "Tema racikan dah dipake",
  "Tema diperbarui": "Tema dah diperbarui, sat-set",
  "Studio diperbarui": "Studio dah diperbarui, sat-set",
  "Studio dikembalikan ke bawaan": "Studio dah dibalikin ke awal",
  "Gambar siap. Tekan Simpan untuk menerapkan.": "Gambarnye dah siap. Tinggal pencet Catet, beres.",
  "Gagal memuat gambar": "Gambarnye kage kebuka",
  "Gagal menyimpan": "Belom kecatet",
  "Gagal menyimpan Kontras Tinggi ke server": "Kontras Tinggi belom kecatet di server",
  "Aktifkan Kontras Tinggi": "Nyalain Kontras Tinggi",
  "Nonaktifkan Kontras Tinggi": "Matiin Kontras Tinggi",
  "Kontras Tinggi: Aktif": "Kontras Tinggi: Nyala",
  "Kontras Tinggi: Nonaktif": "Kontras Tinggi: Mati",

  // Studio Pro
  "Tipografi": "Tipografi",
  "Pilih jenis huruf untuk judul dan teks isi, serta atur skala teks global.": "Pilih jenis huruf buat judul sama isi tulisan, terus atur ukurannye sekalian.",
  "Font Judul": "Font Judul",
  "Font Isi": "Font Isi",
  "Bawaan": "Asli",
  "Skala Teks": "Ukuran Tulisan",
  "Berlaku ke seluruh aplikasi.": "Berlaku ke semua tampilan, Pasukan.",
  "Permukaan & Sudut": "Permukaan & Sudut",
  "Atur warna halaman, kartu, garis batas, serta tingkat kelengkungan sudut.": "Atur warna halaman, kartu, garis, sama tingkat lengkungan sudutnye.",
  "Warna Halaman": "Warna Halaman",
  "Warna Teks": "Warna Tulisan",
  "Warna Kartu": "Warna Kartu",
  "Warna Garis": "Warna Garis",
  "Sudut": "Lengkungan",
  "Sidebar": "Sidebar",
  "Ganti warna, atau unggah gambar latar untuk sidebar navigasi.": "Tuker warna, atau sedot gambar latar buat sidebar navigasi.",
  "Warna Sidebar": "Warna Sidebar",
  "Warna Teks Sidebar": "Warna Tulisan Sidebar",
  "Gambar Latar Sidebar": "Gambar Latar Sidebar",
  "Opasitas Gambar": "Tebel-Tipisnye Gambar",
  "Halaman Masuk": "Halaman Masuk",
  "Ganti gambar dan warna lapisan panel kiri halaman masuk.": "Tuker gambar sama warna lapisan di panel kiri halaman masuk.",
  "Gambar Hero": "Gambar Utama",
  "Warna Lapisan": "Warna Lapisan",
  "Opasitas Lapisan": "Tebel-Tipisnye Lapisan",

  // PWA
  "Versi Android": "Versi Android",
  "Pasang Jak Sanggar di HP": "Pasang Jak Sanggar di HP",
  "Tap tombol di bawah, izinin pasang. App-nya bakal nongol di layar utama HP, bisa dibuka offline.":
    "Pencet tombolnye, izinin pasang. App-nye nongol di layar utama HP, bisa dibuka tanpa internet.",
  "Buka di Safari → tombol Bagikan → 'Tambahkan ke Layar Utama'.":
    "Buka di Safari → pencet tombol Bagikan → pilih 'Tambahkan ke Layar Utama'.",
  "Buka link ini di Chrome Android atau Safari iPhone biar bisa dipasang sebagai aplikasi.":
    "Buka link ini di Chrome Android atau Safari iPhone biar bisa dipasang sebagai aplikasi, Bang/Mpok.",
  "Pasang Sekarang": "Pasang Sat-Set",
  "Cara Pasang di iPhone": "Cara Pasang di iPhone",
  "Pasang Aplikasi": "Pasang Aplikasi",
  "(Pakai Chrome Android biar tombolnya aktif)": "(Pake Chrome Android biar tombolnye nyala)",
  "Aplikasi terpasang": "Aplikasi udah kepasang!",
  "Buka dari layar utama HP Abang/Mpok, sat-set!": "Buka dari layar utama HP Abang/Mpok, sat-set!",
  "Mantap!": "Mantap, Bang!",
  "Aplikasi lagi dipasang ke HP Abang/Mpok...": "Aplikasi lagi dipasang ke HP Abang/Mpok, sabar bentar...",
  "Belum bisa dipasang otomatis": "Belum bisa dipasang otomatis",
  "Buka di Chrome Android, terus tap menu titik tiga → 'Pasang aplikasi'.":
    "Buka di Chrome Android, terus pencet menu titik tiga → 'Pasang aplikasi'.",
  "Aplikasi sudah terpasang di perangkat ini": "Aplikasinye udah kepasang di perangkat ini",
  "Pasang di iPhone": "Pasang di iPhone",
  "Tiga langkah aja, Bang/Mpok": "Tiga langkah aje, Bang/Mpok",
  "Buka halaman ini di browser Safari (bukan Chrome).": "Buka halaman ini di browser Safari (bukan Chrome).",
  "Tap ikon": "Pencet ikon",
  "Bagikan di bawah layar.": "Bagikan di bawah layar.",
  "Tambahkan ke Layar Utama": "Tambahkan ke Layar Utama",
  "Tutup": "Tutup",
};

const EN: Dict = {
  // Core navigation
  "Beranda": "Home",
  "Pengaturan": "Settings",
  "Pengaturan Tampilan": "Appearance Settings",
  "Tampilan": "Appearance",
  "Profil Saya": "My Profile",
  "Keluar": "Sign Out",
  "Notifikasi": "Notifications",

  // Common actions
  "Simpan": "Save",
  "Simpan Semua": "Save All",
  "Simpan Identitas": "Save Identity",
  "Simpan Backdrop": "Save Backdrop",
  "Simpan Bahasa": "Save Language",
  "Simpan Tema Kustom": "Save Custom Theme",
  "Simpan Studio": "Save Studio",
  "Batal": "Cancel",
  "Batalkan": "Cancel",
  "Hapus": "Delete",
  "Hapus Logo": "Remove Logo",
  "Tambah": "Add",
  "Reset": "Reset",
  "Kembalikan Default": "Restore Defaults",
  "Kembalikan Bawaan": "Restore Defaults",
  "Pilih": "Select",
  "Unggah": "Upload",

  // Appearance tabs
  "Brand & Logo": "Brand & Logo",
  "Tema & Warna": "Theme & Colors",
  "Backdrop": "Backdrop",
  "Pop-up Tradisi": "Culture Pop-up",
  "Bahasa": "Language",
  "Studio Lanjutan": "Advanced Studio",
  "Mode Tampilan": "Display Mode",
  "Aksen Warna": "Accent Color",
  "Tema Kustom Anda": "Your Custom Theme",

  // Language picker
  "Pilih Bahasa Antarmuka": "Choose Interface Language",
  "Bahasa Betawi": "Betawi",
  "Bahasa Jakarta": "Jakarta",
  "Bahasa Inggris": "English",

  // Login
  "Selamat Datang Kembali": "Welcome Back",
  "Masuk Aman": "Secure Sign In",
  "Masuk Akun": "Sign In",
  "Memverifikasi...": "Verifying...",
  "Username / Email": "Username / Email",
  "Password": "Password",
  "Lupa Password?": "Forgot password?",
  "Daftar Akun": "Create Account",
  "Akun Demo": "Demo Account",
  "Gunakan kredensial yang terdaftar untuk melanjutkan.": "Use your registered credentials to continue.",
  "Gagal masuk": "Sign-in failed",
  "Username atau password tidak cocok.": "Username or password does not match.",
  "Server tidak dapat dihubungi.": "The server could not be reached.",
  "Sembunyikan password": "Hide password",
  "Tampilkan password": "Show password",

  // Human verification
  "Verifikasi Kemanusiaan": "Human Verification",
  "Susun baris berikut menjadi pantun yang utuh.": "Arrange the lines below into a complete verse.",
  "Ketuk baris sesuai urutan yang benar.": "Tap the lines in the correct order.",
  "Verifikasi berhasil": "Verification successful",
  "Urutan belum tepat. Coba lagi.": "That order is not right. Try again.",
  "Ganti soal": "New challenge",
  "Ulangi": "Reset",
  "Selesaikan verifikasi terlebih dahulu.": "Please complete the verification first.",
  "Terverifikasi": "Verified",
  "Pilih cara verifikasi": "Choose a verification method",
  "Susun Pantun": "Arrange a Verse",
  "Tebak-tebakan": "Quick Quiz",
  "Ketik jawaban di sini": "Type your answer here",
  "Periksa Jawaban": "Check Answer",
  "Petunjuk": "Hint",
  "Jawaban belum tepat. Coba lagi.": "Not quite. Try again.",
  "Tahukah Anda?": "Did you know?",

  // Roles
  "Kurator": "Curator",
  "Admin": "Admin",
  "Sanggar": "Studio",
  "Pelatih": "Instructor",
  "Seniman": "Artist",
  "Juri": "Judge",

  // Toasts & status
  "Edisi Premium": "Premium Edition",
  "Tagline Resmi": "Official Tagline",
  "Bahasa berhasil diganti": "Language updated",
  "Tema kustom diterapkan": "Custom theme applied",
  "Tema diperbarui": "Theme updated",
  "Studio diperbarui": "Studio updated",
  "Studio dikembalikan ke bawaan": "Studio restored to defaults",
  "Gambar siap. Tekan Simpan untuk menerapkan.": "Image ready. Press Save to apply.",
  "Gagal memuat gambar": "Failed to load image",
  "Gagal menyimpan": "Failed to save",
  "Gagal menyimpan Kontras Tinggi ke server": "Failed to save High Contrast to the server",
  "Aktifkan Kontras Tinggi": "Enable High Contrast",
  "Nonaktifkan Kontras Tinggi": "Disable High Contrast",
  "Kontras Tinggi: Aktif": "High Contrast: On",
  "Kontras Tinggi: Nonaktif": "High Contrast: Off",

  // Advanced studio
  "Tipografi": "Typography",
  "Pilih jenis huruf untuk judul dan teks isi, serta atur skala teks global.": "Choose fonts for headings and body text, and set the global text scale.",
  "Font Judul": "Heading Font",
  "Font Isi": "Body Font",
  "Bawaan": "Default",
  "Skala Teks": "Text Scale",
  "Berlaku ke seluruh aplikasi.": "Applies across the entire app.",
  "Permukaan & Sudut": "Surfaces & Corners",
  "Atur warna halaman, kartu, garis batas, serta tingkat kelengkungan sudut.": "Set page, card, and border colors, plus the corner radius.",
  "Warna Halaman": "Page Color",
  "Warna Teks": "Text Color",
  "Warna Kartu": "Card Color",
  "Warna Garis": "Border Color",
  "Sudut": "Corner Radius",
  "Sidebar": "Sidebar",
  "Ganti warna, atau unggah gambar latar untuk sidebar navigasi.": "Change the color, or upload a background image for the navigation sidebar.",
  "Warna Sidebar": "Sidebar Color",
  "Warna Teks Sidebar": "Sidebar Text Color",
  "Gambar Latar Sidebar": "Sidebar Background Image",
  "Opasitas Gambar": "Image Opacity",
  "Halaman Masuk": "Sign-in Page",
  "Ganti gambar dan warna lapisan panel kiri halaman masuk.": "Change the image and overlay color of the sign-in page's left panel.",
  "Gambar Hero": "Hero Image",
  "Warna Lapisan": "Overlay Color",
  "Opasitas Lapisan": "Overlay Opacity",

  // PWA
  "Versi Android": "Android Version",
  "Pasang Jak Sanggar di HP": "Install Jak Sanggar on your phone",
  "Tap tombol di bawah, izinin pasang. App-nya bakal nongol di layar utama HP, bisa dibuka offline.":
    "Tap the button below and allow the install. The app will appear on your home screen and works offline.",
  "Buka di Safari → tombol Bagikan → 'Tambahkan ke Layar Utama'.":
    "Open in Safari → Share button → 'Add to Home Screen'.",
  "Buka link ini di Chrome Android atau Safari iPhone biar bisa dipasang sebagai aplikasi.":
    "Open this link in Chrome on Android or Safari on iPhone to install it as an app.",
  "Pasang Sekarang": "Install Now",
  "Cara Pasang di iPhone": "How to Install on iPhone",
  "Pasang Aplikasi": "Install App",
  "(Pakai Chrome Android biar tombolnya aktif)": "(Use Chrome on Android to enable this button)",
  "Aplikasi terpasang": "App installed",
  "Buka dari layar utama HP Abang/Mpok, sat-set!": "Open it from your home screen.",
  "Mantap!": "Great!",
  "Aplikasi lagi dipasang ke HP Abang/Mpok...": "Installing the app on your device...",
  "Belum bisa dipasang otomatis": "Automatic install unavailable",
  "Buka di Chrome Android, terus tap menu titik tiga → 'Pasang aplikasi'.":
    "Open in Chrome on Android, then tap the three-dot menu → 'Install app'.",
  "Aplikasi sudah terpasang di perangkat ini": "The app is already installed on this device",
  "Pasang di iPhone": "Install on iPhone",
  "Tiga langkah aja, Bang/Mpok": "Just three steps",
  "Buka halaman ini di browser Safari (bukan Chrome).": "Open this page in Safari (not Chrome).",
  "Tap ikon": "Tap the",
  "Bagikan di bawah layar.": "Share icon at the bottom of the screen.",
  "Tambahkan ke Layar Utama": "Add to Home Screen",
  "Tutup": "Close",
};

const PACKS: Record<Language, Dict> = { btw: BTW, jkt: JKT, en: EN };

export function tFor(lang: Language, key: string): string {
  return PACKS[lang][key] ?? key;
}

export function useT() {
  const db = useDb();
  const lang = normalizeLang(db.appearance.language);
  return (key: string) => tFor(lang, key);
}

export function currentLang(): Language {
  // Read once from DOM dataset cache to avoid hook calls in non-component code
  if (typeof document !== "undefined") return normalizeLang(document.documentElement.dataset.lang);
  return DEFAULT_LANGUAGE;
}
