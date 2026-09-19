export interface DeskripsiObjekSewa {
  kategori: string;
  sumberType: string;
}

/** SDM adalah jasa. Alat, kostum, dan tempat tetap aktif sampai dikembalikan. */
export function memerlukanPengembalianSewa(
  pesanan: DeskripsiObjekSewa,
): boolean {
  return (
    pesanan.sumberType === "aset" ||
    pesanan.sumberType === "sarpras" ||
    pesanan.kategori === "alat_musik" ||
    pesanan.kategori === "kostum" ||
    pesanan.kategori === "tempat_latihan"
  );
}

export function stokSetelahPengembalian(input: {
  tersedia: number;
  total: number;
  jumlahDikembalikan: number;
  kondisi: "baik" | "rusak_ringan" | "rusak_berat";
}): number {
  if (input.kondisi !== "baik") return input.tersedia;
  return Math.min(input.total, input.tersedia + input.jumlahDikembalikan);
}
