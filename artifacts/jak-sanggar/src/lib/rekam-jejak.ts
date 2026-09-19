import type { RekamJejak } from "./types";

// Pastikan struktur rekam jejak selalu lengkap (profil lama mungkin belum
// punya field ini). Dipisah dari komponen agar Fast Refresh Vite tetap bekerja
// (file komponen hanya boleh mengekspor komponen).
export function normalisasiRekamJejak(v?: RekamJejak): RekamJejak {
  return {
    karya: v?.karya ?? [],
    keterlibatan: v?.keterlibatan ?? [],
    juara: v?.juara ?? [],
    penghargaan: v?.penghargaan ?? [],
  };
}
