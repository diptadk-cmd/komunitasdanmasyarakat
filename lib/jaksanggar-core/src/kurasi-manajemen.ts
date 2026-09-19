import type { Indikator, Variabel } from "./types";

export const VERSI_INDIKATOR_MANAJEMEN_SANGGAR =
  "indikator-manajemen-sanggar-2026-07-26-v2";

export const SUMBER_INDIKATOR_MANAJEMEN_SANGGAR =
  "BA Manajemen Pembinaan Sanggar n Kurasi Disbud 202_260726_070216(2).pdf";

export const CATATAN_BOBOT_MANAJEMEN_SANGGAR =
  "Bobot yang ditampilkan mengikuti dokumen sumber. Patokan penilaian ditetapkan dan dapat diubah oleh Kurator.";

type VariabelSumber = Pick<
  Variabel,
  "id" | "nama" | "persyaratanDataDukung" | "bobotSumber" | "halamanSumber"
>;

export function normalisasiBobotVariabel<T extends { bobotSumber?: number }>(
  items: T[],
): Array<T & { bobot: number }> {
  if (items.length === 0) return [];
  const bobotSumber = items.map((item) => {
    const value = item.bobotSumber ?? 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const total = bobotSumber.reduce((sum, value) => sum + value, 0);
  let terpakai = 0;
  return items.map((item, index) => {
    const bobot =
      index === items.length - 1
        ? 100 - terpakai
        : total > 0
          ? Number(((bobotSumber[index] / total) * 100).toFixed(6))
          : Number((100 / items.length).toFixed(6));
    terpakai += bobot;
    return { ...item, bobot };
  });
}

export function createDefaultManajemenIndikator(): Indikator {
  return {
    id: "indikator-manajemen-sanggar",
    nama: "Manajemen Sanggar",
    bobot: 30,
    tipe: "manajemen",
    versi: VERSI_INDIKATOR_MANAJEMEN_SANGGAR,
    sumber: SUMBER_INDIKATOR_MANAJEMEN_SANGGAR,
    catatanBobot: CATATAN_BOBOT_MANAJEMEN_SANGGAR,
    pilar: [
      {
        id: "manajemen-pilar-1",
        nama: "Pilar I - Tata Kelola dan Legalitas Kelembagaan",
        bobot: 30,
        variabel: normalisasiBobotVariabel<VariabelSumber>([
          {
            id: "manajemen-p1-01",
            nama: "Legalitas Dasar Lembaga",
            persyaratanDataDukung:
              "Akta pendirian dari notaris atau dokumen pendirian sejenis yang sesuai dengan bentuk lembaga.",
            bobotSumber: 1,
            halamanSumber: 3,
          },
          {
            id: "manajemen-p1-02",
            nama: "Legalitas Dasar Lembaga",
            persyaratanDataDukung:
              "SK pengesahan badan hukum atau bukti pencatatan resmi melalui AHU/ Surat Keterangan Terdaftar (SKT) Kesatuan Bangsa dan Politik Provinsi DKI Jakarta",
            bobotSumber: 4,
            halamanSumber: 3,
          },
          {
            id: "manajemen-p1-03",
            nama: "Legalitas Dasar Lembaga",
            persyaratanDataDukung:
              "Surat Keterangan Terdaftar sebagai Lembaga Kebudayaan pada Dinas Kebudayaan Provinsi DKI Jakarta",
            bobotSumber: 5,
            halamanSumber: 3,
          },
          {
            id: "manajemen-p1-04",
            nama: "Legalitas Dasar Lembaga",
            persyaratanDataDukung: "Nomor Pokok Wajib Pajak an Sanggar",
            bobotSumber: 4,
            halamanSumber: 3,
          },
          {
            id: "manajemen-p1-05",
            nama: "Tata Aturan & Struktur Organisasi",
            persyaratanDataDukung:
              "Anggaran Dasar dan Anggaran Rumah Tangga yang memuat Visi dan Misi Pemajuan Kebudayaan Provinsi DKI Jakarta, struktur organisasi, rincian tugas, dan mekanisme kerja, Pengelolaan Keuangan biaya iuran sanggar, Honor Pelatih, Presentase Pembagian Hasil Pementasan.",
            bobotSumber: 5,
            halamanSumber: 3,
          },
          {
            id: "manajemen-p1-06",
            nama: "Tata Aturan & Struktur Organisasi",
            persyaratanDataDukung:
              "Dokumen pembentukan Sanggar sebagai Unit Kerja/cabang Lembaga yang menguraikan fungsi dan tata hubungan kelembagaan.",
            bobotSumber: 2,
            halamanSumber: 3,
          },
          {
            id: "manajemen-p1-07",
            nama: "Tata Aturan & Struktur Organisasi",
            persyaratanDataDukung:
              "SK pengurus atau surat penetapan personel pengelola sanggar.",
            bobotSumber: 2,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p1-08",
            nama: "Identitas & Domisili Operasional",
            persyaratanDataDukung:
              "Surat keterangan domisili sanggar dan Nomor Induk Berusaha.",
            bobotSumber: 2,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p1-09",
            nama: "Identitas & Domisili Operasional",
            persyaratanDataDukung:
              "Dokumentasi Lokasi Sanggar dan Sekertariat (bila ada) yang memuat Papan Nama sanggar.",
            bobotSumber: 2,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p1-10",
            nama: "Profil, Portofolio & Rekam Jejak",
            persyaratanDataDukung:
              "Buku profil lembaga (mencakup sejarah singkat, fokus kegiatan, dan capaian/prestasi utama).",
            bobotSumber: 1,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p1-11",
            nama: "Profil, Portofolio & Rekam Jejak",
            persyaratanDataDukung:
              "Portofolio karya atau daftar prestasi dengan bukti dokumentasi foto atau sertifikat/piagam/surat keterangan lain yang wajar dalam 3 tahun terakhir.",
            bobotSumber: 1,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p1-12",
            nama: "Profil, Portofolio & Rekam Jejak",
            persyaratanDataDukung:
              "partisipasi dalam festival, pameran, kompetisi, atau perhelatan seni lainnya dengan Bukti Foto/dokumen yang dapat dipertanggungjawaban.",
            bobotSumber: 1,
            halamanSumber: 4,
          },
        ]),
      },
      {
        id: "manajemen-pilar-2",
        nama: "Pilar II - Manajemen Program dan Kurikulum Pembelajaran",
        bobot: 25,
        variabel: normalisasiBobotVariabel<VariabelSumber>([
          {
            id: "manajemen-p2-01",
            nama: "Perencanaan & Pelaksanaan Program",
            persyaratanDataDukung:
              "Dokumen Rencana Kerja Tahunan (RKT) dan Rencana Strategis Jangka Menengah serta.",
            bobotSumber: 1,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p2-02",
            nama: "Perencanaan & Pelaksanaan Program",
            persyaratanDataDukung:
              "Laporan pelaksanaan kegiatan atau Laporan Pertanggungjawaban (LPJ) program yang telah berjalan",
            bobotSumber: 1,
            halamanSumber: 4,
          },
          {
            id: "manajemen-p2-03",
            nama: "Perencanaan & Pelaksanaan Program",
            persyaratanDataDukung:
              "Bukti Pembagian/pembayaran Presentase Hasil Pementasan.",
            bobotSumber: 2,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p2-04",
            nama: "Jadwal Latihan & Kegiatan Rutin",
            persyaratanDataDukung:
              "Dokumen jadwal latihan rutin yang disusun secara periodik (mingguan/bulanan).",
            bobotSumber: 5,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p2-05",
            nama: "Jadwal Latihan & Kegiatan Rutin",
            persyaratanDataDukung:
              "Rekapitulasi daftar hadir atau presensi seniman peserta didik dan Bukti Pembayaran Iuran Seniman Peserta Didik.",
            bobotSumber: 3,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p2-06",
            nama: "Kurikulum & Silabus Pelatihan",
            persyaratanDataDukung:
              "Dokumen kurikulum, silabus, atau modul pelatihan seni yang disusun secara sistematis dan terstruktur.",
            bobotSumber: 5,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p2-07",
            nama: "Kurikulum & Silabus Pelatihan",
            persyaratanDataDukung:
              "Ketersediaan bahan ajar, diktat materi tertulis, atau panduan praktik seni.",
            bobotSumber: 2,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p2-08",
            nama: "Evaluasi & Uji Kompetensi Peserta",
            persyaratanDataDukung:
              "Dokumen mekanisme, rubrik, atau instrumen evaluasi untuk mengukur kemajuan belajar peserta didik.",
            bobotSumber: 2,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p2-09",
            nama: "Evaluasi & Uji Kompetensi Peserta",
            persyaratanDataDukung:
              "Salinan sertifikat, piagam penghargaan, atau tanda lulus yang diterbitkan secara resmi oleh sanggar.",
            bobotSumber: 4,
            halamanSumber: 5,
          },
        ]),
      },
      {
        id: "manajemen-pilar-3",
        nama: "Pilar III - Manajemen Sumber Daya Manusia dan Fasilitas",
        bobot: 25,
        variabel: normalisasiBobotVariabel<VariabelSumber>([
          {
            id: "manajemen-p3-01",
            nama: "Kompetensi & Kualifikasi Pelatih",
            persyaratanDataDukung:
              "Profil dan sertifikat uji kompetensi milik pelatih/instruktur.",
            bobotSumber: 5,
            halamanSumber: 5,
          },
          {
            id: "manajemen-p3-02",
            nama: "Kompetensi & Kualifikasi Pelatih",
            persyaratanDataDukung:
              "Surat penugasan resmi, SK pengangkatan, atau kontrak perjanjian kerja kerja sama dengan pelatih dan Bukti Pembayaran Honor Pelatih/instruktur.",
            bobotSumber: 10,
            halamanSumber: 6,
          },
          {
            id: "manajemen-p3-03",
            nama: "Pengelolaan Anggota & Peserta Didik",
            persyaratanDataDukung:
              "Regenerasi Peserta Didik dan daftar induk keanggotaan atau database Seniman peserta didik yang senantiasa diperbarui secara berkala.",
            bobotSumber: 5,
            halamanSumber: 6,
          },
          {
            id: "manajemen-p3-04",
            nama: "Fasilitas Latihan & Inventarisasi",
            persyaratanDataDukung:
              "Dokumen bukti kepemilikan, hak pakai, atau sewa atas ruang latihan yang memadai.",
            bobotSumber: 3,
            halamanSumber: 6,
          },
          {
            id: "manajemen-p3-05",
            nama: "Fasilitas Latihan & Inventarisasi",
            persyaratanDataDukung:
              "Buku inventaris atau daftar pencatatan aset (alat musik, kostum, properti, dan perlengkapan seni lainnya).",
            bobotSumber: 2,
            halamanSumber: 6,
          },
        ]),
      },
      {
        id: "manajemen-pilar-4",
        nama: "Pilar IV - Dampak Sosial, Inklusi, dan Keberlanjutan Lingkungan",
        bobot: 20,
        variabel: normalisasiBobotVariabel<VariabelSumber>([
          {
            id: "manajemen-p4-01",
            nama: "Kontribusi Sosial & Kemitraan",
            persyaratanDataDukung:
              "Laporan pengabdian masyarakat, dokumentasi pelibatan warga lokal, kemitraan komunitas, serta bukti testimoni manfaat operasional sanggar.",
            bobotSumber: 6,
            halamanSumber: 6,
          },
          {
            id: "manajemen-p4-02",
            nama: "Inklusivitas & Akses Partisipasi",
            persyaratanDataDukung:
              "Kebijakan internal atau praktik nyata yang membuka ruang partisipasi bagi kelompok rentan miskin/penyandang disabilitas yang bebas dari diskriminasi.",
            bobotSumber: 5,
            halamanSumber: 6,
          },
          {
            id: "manajemen-p4-03",
            nama: "Etika & Perlindungan Hak Cipta",
            persyaratanDataDukung:
              "Dokumen kode etik/pedoman perilaku sanggar, surat pernyataan izin penggunaan karya pihak lain, atau kepemilikan sertifikat HAKI.",
            bobotSumber: 5,
            halamanSumber: 6,
          },
          {
            id: "manajemen-p4-04",
            nama: "Keberlanjutan Lingkungan Hidup",
            persyaratanDataDukung:
              "Kebijakan pengelolaan tata limbah pementasan, pemanfaatan material ramah lingkungan, serta praktik efisiensi sumber daya (listrik/air) dalam berkegiatan.",
            bobotSumber: 4,
            halamanSumber: 7,
          },
        ]),
      },
    ],
  };
}

export function perluPembaruanIndikatorManajemen(
  indikator: Indikator,
): boolean {
  if (indikator.versi === VERSI_INDIKATOR_MANAJEMEN_SANGGAR) return false;
  if (
    indikator.id === "indikator-manajemen-sanggar" &&
    indikator.tipe === "manajemen" &&
    indikator.versi === "indikator-manajemen-sanggar-2026-07-26"
  ) {
    return true;
  }
  const namaVariabel = indikator.pilar.flatMap((pilar) =>
    pilar.variabel.map((variabel) => variabel.nama),
  );
  const namaBawaanLama = [
    "Legalitas & Struktur Organisasi",
    "Sistem Administrasi",
    "Keuangan & Pelaporan",
    "Sumber Daya & Sarana",
    "Kurikulum & Metode",
    "Capaian Peserta Didik",
  ];
  return (
    indikator.tipe === "manajemen" &&
    indikator.nama === "Manajemen Sanggar" &&
    namaVariabel.length === namaBawaanLama.length &&
    namaBawaanLama.every((nama) => namaVariabel.includes(nama))
  );
}
