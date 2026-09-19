import type { Role } from "./types";

export interface Notice {
  id: string;
  title: string;
  detail: string;
  href?: string;
  important?: boolean;
}

export function buildNotices(role: Role, user: any, db: any): Notice[] {
  const rows: Notice[] = [];
  if (role === "sanggar") {
    const pendingMember = db.users.filter((item: any) => (item.role === "seniman" || item.role === "pelatih") && item.sanggarId === user.id && item.status === "pending").length;
    const pendingIuran = db.iuran.filter((item: any) => item.sanggarId === user.id && item.status === "pending" && item.buktiDataUrl).length;
    const pendingHonor = db.pengajuanHonor.filter((item: any) => item.sanggarId === user.id && item.status === "pending").length;
    const incomingRental = db.pemesananSewa.filter((item: any) => item.sanggarId === user.id && item.status === "menunggu_sanggar").length;
    if (pendingMember) rows.push({ id: "member", title: `${pendingMember} permohonan anggota`, detail: "Periksa data calon anggota dan tentukan status keanggotaannya.", href: "/sanggar/keanggotaan", important: true });
    if (pendingIuran + pendingHonor) rows.push({ id: "finance", title: `${pendingIuran + pendingHonor} validasi keuangan`, detail: "Bukti iuran atau pengajuan honor menunggu verifikasi.", href: "/sanggar/buku-kas", important: true });
    if (incomingRental) rows.push({ id: "rental", title: `${incomingRental} pesanan jasa baru`, detail: "Pesanan menunggu persetujuan sanggar.", href: "/sanggar/permintaan-sewa" });
    const activeBanner = db.banners.find((item: any) => item.active);
    if (activeBanner) rows.push({ id: "banner", title: "Pengumuman aktif", detail: activeBanner.teks });
  } else if (role === "pelatih") {
    const honor = db.pengajuanHonor.filter((item: any) => item.pelatihId === user.id && item.status === "pending").length;
    const jobs = db.pemesananSewa.filter((item: any) => item.sdmUserId === user.id && item.status === "menunggu_sdm").length;
    if (jobs) rows.push({ id: "job", title: `${jobs} penugasan baru`, detail: "Konfirmasi kesiapan Anda untuk pekerjaan jasa.", href: "/pelatih/penugasan-sewa", important: true });
    if (honor) rows.push({ id: "honor", title: `${honor} pengajuan honor diproses`, detail: "Pengajuan masih menunggu persetujuan sanggar.", href: "/pelatih/honor" });
  } else if (role === "seniman") {
    const bills = db.iuran.filter((item: any) => item.senimanId === user.id && item.status !== "lunas").length;
    const jobs = db.pemesananSewa.filter((item: any) => item.sdmUserId === user.id && item.status === "menunggu_sdm").length;
    if (jobs) rows.push({ id: "job", title: `${jobs} penugasan baru`, detail: "Konfirmasi penugasan dari sanggar.", href: "/seniman/penugasan-sewa", important: true });
    if (bills) rows.push({ id: "bill", title: `${bills} tagihan belum lunas`, detail: "Periksa tagihan dan unggah bukti pembayaran.", href: "/seniman/tagihan" });
  } else if (role === "juri") {
    const assignedIds = db.penugasanJuri.filter((item: any) => item.juriId === user.id).map((item: any) => item.sanggarId);
    const unfinished = db.kurasiSubmissions.filter((item: any) => assignedIds.includes(item.sanggarId) && !item.finalized?.[user.id]).length;
    if (unfinished) rows.push({ id: "score", title: `${unfinished} penilaian belum final`, detail: "Selesaikan skor dan finalisasi penilaian.", href: "/juri", important: true });
  } else if (role === "sewa") {
    const orders = db.pemesananSewa.filter((item: any) => item.sewaId === user.id && ["menunggu_ttd", "menunggu_bayar"].includes(item.status));
    orders.slice(0, 4).forEach((item: any) => rows.push({ id: item.id, title: item.status === "menunggu_bayar" ? "Pembayaran diperlukan" : "Tanda tangan kontrak", detail: `${item.nomor} · ${item.judul}`, href: `/konsumen/pesanan/${encodeURIComponent(item.id)}`, important: true }));
  } else if (role === "pengrajin") {
    const orders = db.pesananProdukPengrajin.filter(
      (item: any) =>
        item.pengrajinId === user.id &&
        ["menunggu_ongkir", "diajukan", "menunggu_ttd", "menunggu_verifikasi_bayar"].includes(item.status),
    );
    orders.slice(0, 6).forEach((item: any) => rows.push({
      id: `kriya-${item.id}`,
      title:
        item.status === "menunggu_ongkir"
          ? "Ongkir perlu dihitung"
          : item.status === "diajukan"
            ? "Pesanan produk baru"
            : item.status === "menunggu_verifikasi_bayar"
              ? "Verifikasi pembayaran"
              : "Tanda tangan kontrak",
      detail: `${item.nomor} · ${item.items.map((product: any) => product.nama).join(", ")}`,
      href: "/pengrajin/pesanan-produk",
      important: true,
    }));
  } else if (role === "mitra_pengrajin") {
    const orders = db.pesananProdukPengrajin.filter(
      (item: any) =>
        item.mitraId === user.id &&
        ["menunggu_persetujuan_ongkir", "dikirim"].includes(item.status),
    );
    orders.slice(0, 6).forEach((item: any) => rows.push({
      id: `kriya-${item.id}`,
      title:
        item.status === "menunggu_persetujuan_ongkir"
          ? "Ongkir menunggu persetujuan"
          : "Barang sedang dikirim",
      detail: `${item.nomor} · ${item.items.map((product: any) => product.nama).join(", ")}`,
      href: "/mitra/pesanan",
      important: true,
    }));
  } else if (role === "admin") {
    const activeBanner = db.banners.filter((item: any) => item.active).length;
    if (!activeBanner) rows.push({ id: "banner", title: "Tidak ada banner aktif", detail: "Publikasikan pengumuman penting untuk seluruh pengguna.", href: "/admin/banner" });
  }
  return rows;
}
