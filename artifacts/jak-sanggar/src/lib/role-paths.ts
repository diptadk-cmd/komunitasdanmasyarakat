import type { Role } from "@/lib/types";

/** Jalur publik baru; nilai Role lama dipertahankan untuk kompatibilitas data. */
export function roleHomePath(role: Role | string): string {
  if (role === "mitra_pengrajin") return "/mitra";
  if (role === "sewa") return "/konsumen";
  if (role === "kurator") return "/";
  return `/${role}`;
}

export function layananBasePath(role: Role | string): string {
  return role === "mitra_pengrajin" ? "/mitra/layanan" : "/konsumen";
}

export function pemesanLabel(role: Role | string): "Mitra" | "Konsumen" {
  return role === "mitra_pengrajin" ? "Mitra" : "Konsumen";
}
