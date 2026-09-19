export const ACCOUNT_ROLES = [
  "kurator",
  "admin",
  "sanggar",
  "pelatih",
  "seniman",
  "juri",
  "pengrajin",
  "mitra_pengrajin",
  "sewa",
] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

const VALID_ACCOUNT_ROLES = new Set<string>(ACCOUNT_ROLES);
const LEGACY_ROLE_ALIASES: Record<string, AccountRole> = {
  // Profil legacy ini berisi nama, title Penilai Kurasi, dan keahlian yang
  // sesuai dengan model akun Juri di aplikasi.
  kurator_manajemen: "juri",
};

export function normalizeLegacyAccountRole(role: unknown): AccountRole | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase();
  if (VALID_ACCOUNT_ROLES.has(normalized)) return normalized as AccountRole;
  return LEGACY_ROLE_ALIASES[normalized] ?? null;
}
