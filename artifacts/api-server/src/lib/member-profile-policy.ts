type Account = {
  id: string;
  role: string;
  username: string;
  profile: Record<string, unknown>;
};

const MANAGED_MEMBER_FIELDS = new Set([
  "id",
  "apiId",
  "username",
  "role",
  "password",
  "passwordHash",
  "createdAt",
  "status",
  "sanggarUsername",
  "sanggarId",
  "sanggarServerId",
  "honorPerSesi",
  "rapor",
  "mutasiTujuanUsername",
  "mutasiDiajukanAt",
  "pemberhentianBuktiUrl",
  "pemberhentianBuktiNama",
  "pemberhentianAt",
  "statusModerasiAkun",
  "kategoriBlokirAkun",
  "alasanBlokirAkun",
  "diblokirAt",
  "diblokirOleh",
]);

/** /members tetap membatasi pengelolaan ke pemilik Sanggar/Kurator. */
export function memberProfileEditAccess(
  actor: Account,
  member: Account,
  requestedProfile: Record<string, unknown>,
): "manager" | "self" | null {
  if (actor.role === "kurator") return "manager";
  const affiliation = member.profile.sanggarUsername;
  if (
    actor.role === "sanggar" &&
    (affiliation === actor.username ||
      ((!affiliation || typeof affiliation !== "string") &&
        requestedProfile.sanggarUsername === actor.username))
  )
    return "manager";
  return actor.id === member.id ? "self" : null;
}

/** Full snapshot profil biasa boleh disimpan, tetapi field pengelola diabaikan. */
export function selfMemberProfilePatch(
  role: string,
  profile: Record<string, unknown>,
) {
  if (role !== "pelatih" && role !== "seniman") return { ...profile };
  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => !MANAGED_MEMBER_FIELDS.has(key)),
  );
}

/** Pendaftaran tidak boleh menanam tarif/status/rapor yang belum disahkan. */
export function publicMemberProfile(
  role: "pelatih" | "seniman",
  profile: Record<string, unknown>,
) {
  return {
    ...selfMemberProfilePatch(role, profile),
    ...(typeof profile.sanggarUsername === "string"
      ? { sanggarUsername: profile.sanggarUsername }
      : {}),
    status: "pending",
    ...(role === "pelatih" ? { honorPerSesi: 0 } : {}),
  };
}
