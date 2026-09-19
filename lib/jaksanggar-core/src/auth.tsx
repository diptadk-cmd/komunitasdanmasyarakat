import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  load,
  save,
  subscribe,
  logActivity,
  hydrateSettings,
  hydrateMembers,
  hydrateDokumenArsip,
  hydrateActivityAudit,
  applyMemberFromServer,
  clearLocalDb,
  API_PASSWORD_PLACEHOLDER,
  LOCAL_DEMO_USERNAMES,
  SESSION_STORAGE_KEY,
  IMPERSONATION_STORAGE_KEY,
  setStoreDemoMode,
} from "./store";
import type {
  AnyUser,
  MitraPengrajinUser,
  PengrajinUser,
  Role,
  SanggarUser,
} from "./types";
import {
  createImpersonationState,
  originalImpersonationRef,
  parseImpersonationState,
  resolveImpersonationUser,
  targetImpersonationRef,
  type StoredImpersonationState,
} from "./impersonation";
import {
  apiTabSessionEnabled,
  authApi,
  ApiError,
  type ApiAuthUser,
} from "./api";
import { hydrateKurasi } from "./kurasi-sync";
import { startDataSync, stopDataSync } from "./sync";

// Field profil sanggar yang dihidrasi dari server. Overlay HANYA key yang ada
// di server agar seed sparse tidak menimpa data lokal yang lebih lengkap;
// setelah user menyimpan (write-through penuh) server jadi sumber kebenaran.
const SANGGAR_HYDRATE_KEYS = [
  "namaSanggar",
  "namaKetua",
  "nip",
  "legalitas",
  "namaBadanHukum",
  "jenisKesenian",
  "alamat",
  "wilayah",
  "lat",
  "lng",
  "rekening",
  "fotoProfileDataUrl",
  "fotoSampulDataUrl",
  "logoDataUrl",
  "kopSuratDataUrl",
  "stempelDataUrl",
  "fotoGaleri",
  "deskripsi",
  "tahunBerdiri",
  "website",
  "instagram",
  "npwp",
  "statusPkp",
  "pemotongPajak",
  "email",
  "noHp",
  "rekamJejak",
  "jenisPemilik",
  "bentukKedudukan",
] as const;

const PENGRAJIN_HYDRATE_KEYS = [
  "namaUsaha",
  "namaPemilik",
  "bentukUsaha",
  "namaBadanUsaha",
  "jenisKerajinan",
  "produkUnggulan",
  "produk",
  "alamat",
  "wilayah",
  "lat",
  "lng",
  "deskripsi",
  "website",
  "instagram",
  "fotoProfileDataUrl",
  "logoDataUrl",
  "stempelDataUrl",
  "jabatanPenandatangan",
  "email",
  "noHp",
  "npwp",
  "statusPkp",
  "pemotongPajak",
  "nib",
  "rekening",
  "dokumen",
  "tokoDipublikasikan",
  "menerimaSewaJasa",
  "menerimaKerjasama",
] as const;

const MITRA_PENGRAJIN_HYDRATE_KEYS = [
  "namaUsaha",
  "namaPenanggungJawab",
  "bentukUsaha",
  "namaBadanUsaha",
  "alamat",
  "memilikiTokoOffline",
  "namaTokoOffline",
  "alamatTokoOffline",
  "wilayahTokoOffline",
  "latTokoOffline",
  "lngTokoOffline",
  "statusVerifikasiTokoOffline",
  "catatanVerifikasiTokoOffline",
  "diverifikasiTokoOfflineAt",
  "diverifikasiTokoOfflineOleh",
  "tanggalPermohonanMitra",
  "tanggalTerbitNib",
  "wilayah",
  "npwp",
  "statusPkp",
  "pemotongPajak",
  "nib",
  "rekening",
  "dokumen",
  "marketplace",
  "paketProduk",
  "deskripsi",
  "logoDataUrl",
  "stempelDataUrl",
  "jabatanPenandatangan",
  "email",
  "noHp",
] as const;

function hydrateSanggarProfile(
  localId: string,
  profile: Record<string, unknown>,
) {
  save((d) => {
    const u = d.users.find((x) => x.id === localId) as SanggarUser | undefined;
    if (!u) return;
    for (const k of SANGGAR_HYDRATE_KEYS) {
      if (profile[k] !== undefined)
        (u as unknown as Record<string, unknown>)[k] = profile[k];
    }
  });
}

function hydratePengrajinProfile(
  localId: string,
  profile: Record<string, unknown>,
) {
  save((d) => {
    const u = d.users.find((x) => x.id === localId) as
      | PengrajinUser
      | undefined;
    if (!u) return;
    for (const key of PENGRAJIN_HYDRATE_KEYS) {
      if (profile[key] !== undefined) {
        (u as unknown as Record<string, unknown>)[key] = profile[key];
      }
    }
  });
}

function hydrateMitraPengrajinProfile(
  localId: string,
  profile: Record<string, unknown>,
) {
  save((d) => {
    const u = d.users.find((x) => x.id === localId) as
      | MitraPengrajinUser
      | undefined;
    if (!u) return;
    for (const key of MITRA_PENGRAJIN_HYDRATE_KEYS) {
      if (profile[key] !== undefined) {
        (u as unknown as Record<string, unknown>)[key] = profile[key];
      }
    }
  });
}

function hydrateAccountModeration(localId: string, api: ApiAuthUser) {
  save((db) => {
    const user = db.users.find((item) => item.id === localId);
    if (!user) return;
    user.statusModerasiAkun =
      api.status === "diblokir"
        ? "diblokir"
        : api.profile["statusModerasiAkun"] === "diblokir"
          ? "diblokir"
          : "aktif";
    for (const key of [
      "kategoriBlokirAkun",
      "alasanBlokirAkun",
      "diblokirAt",
      "diblokirOleh",
    ] as const) {
      if (api.profile[key] !== undefined) {
        (user as unknown as Record<string, unknown>)[key] = api.profile[key];
      }
    }
  });
}

// Kunci localStorage didefinisikan di store.ts (dipakai juga oleh
// sessionCanWriteSettings) — alias lokal agar kode di bawah tetap ringkas.
const SESSION_KEY = SESSION_STORAGE_KEY;
const IMPERSONATION_KEY = IMPERSONATION_STORAGE_KEY;

/**
 * Sesi demo sengaja bersifat per-tab agar satu browser dapat dipakai untuk
 * menguji beberapa peran sekaligus. Data demo tetap berada di localStorage
 * dan dibagikan antartab; hanya identitas login yang dipisahkan.
 */
function readSessionId(perTab: boolean): string | null {
  return (perTab ? sessionStorage : localStorage).getItem(SESSION_KEY);
}

function writeSessionId(perTab: boolean, userId: string): void {
  (perTab ? sessionStorage : localStorage).setItem(SESSION_KEY, userId);
  if (perTab) localStorage.removeItem(SESSION_KEY);
}

function clearSessionId(perTab: boolean): void {
  (perTab ? sessionStorage : localStorage).removeItem(SESSION_KEY);
  if (perTab) localStorage.removeItem(SESSION_KEY);
}

/** Mode aplikasi yang memakai AuthProvider:
 *  - "utama": aplikasi Jak Sanggar (semua peran KECUALI kurator).
 *  - "konsol": Konsol Kurator di /konsol/ (HANYA kurator).
 *  Mode demo memakai penyimpanan browser lokal pada port demo tersendiri. */
export type AuthMode = "utama" | "konsol";

// Catatan: akun kurator yang mencoba login di aplikasi utama SENGAJA
// diperlakukan seperti kredensial salah (return null) tanpa menyebut
// Konsol Kurator — keberadaan konsol tidak dibocorkan dari halaman login
// publik. Sesi yang terlanjur dibuat server langsung dihapus (logout).

function readImpersonation(): StoredImpersonationState | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    return parseImpersonationState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeImpersonation(s: StoredImpersonationState | null) {
  if (s) localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(s));
  else localStorage.removeItem(IMPERSONATION_KEY);
}

interface AuthCtx {
  user: AnyUser | null;
  ready: boolean;
  /** true bila aplikasi memakai data demo lokal tanpa write ke server. */
  demoMode: boolean;
  /** ID asli kurator saat sedang impersonate; null kalau tidak impersonate. */
  impersonatedFromId: string | null;
  login: (username: string, password: string) => Promise<AnyUser | null>;
  logout: () => Promise<void>;
  setSession: (u: AnyUser) => void;
  /** Switch UI to act as another user. Original kurator id disimpan agar bisa kembali. */
  impersonate: (targetUserId: string) => Promise<boolean>;
  /** Kembali ke akun kurator semula. */
  stopImpersonation: () => Promise<boolean>;
  refresh: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

// Cocokkan user yang dikembalikan API ke entry user di local store.
// PENTING: id user di localStorage TIDAK diubah supaya seluruh foreign-key
// di store (latihan, iuran, kas, kurasi, pengajuan honor, distribusi, dll)
// tetap utuh. Sesi otentikasi sepenuhnya server-side (cookie HttpOnly),
// jadi `api.id` hanya dipakai server. Local id tetap jadi kunci UI.
// Bila user belum ada di local store (mis. dibuat via API), buat entry
// minimal — Tahap 2+ akan menangani semua modul dari server.
function reconcileLocalUser(api: ApiAuthUser): AnyUser {
  const db = load();
  const byUsername = db.users.find(
    (u) => u.username.toLowerCase() === api.username.toLowerCase(),
  );
  if (byUsername) {
    // Simpan id server dan singkirkan password asli dari cache browser.
    if (
      byUsername.apiId !== api.id ||
      (!LOCAL_DEMO_USERNAMES.has(byUsername.username.toLowerCase()) &&
        byUsername.password !== API_PASSWORD_PLACEHOLDER)
    ) {
      save((d) => {
        const u = d.users.find((x) => x.id === byUsername.id);
        if (u) {
          u.apiId = api.id;
          if (!LOCAL_DEMO_USERNAMES.has(u.username.toLowerCase())) {
            u.password = API_PASSWORD_PLACEHOLDER;
          }
        }
      });
    }
    // Hidrasi profil sanggar dari server (sumber kebenaran setelah migrasi).
    if (byUsername.role === "sanggar" && api.profile) {
      hydrateSanggarProfile(byUsername.id, api.profile);
    }
    if (byUsername.role === "pengrajin" && api.profile) {
      hydratePengrajinProfile(byUsername.id, api.profile);
    }
    if (byUsername.role === "mitra_pengrajin" && api.profile) {
      hydrateMitraPengrajinProfile(byUsername.id, api.profile);
    }
    hydrateAccountModeration(byUsername.id, api);
    // Hidrasi data keanggotaan bila yang login adalah anggota (pelatih/
    // seniman) — overlay field yang ada di server + pemetaan sanggarUsername.
    if (byUsername.role === "pelatih" || byUsername.role === "seniman") {
      save((d) => applyMemberFromServer(d, api));
    }
    // Sanggar (dan kurator di konsol) menarik daftar anggotanya dari server
    // supaya keanggotaan tersedia lintas perangkat. Fire-and-forget.
    if (byUsername.role === "sanggar" || byUsername.role === "kurator") {
      void hydrateMembers();
      // Arsip Dokumen Administrasi ikut ditarik dari server supaya tersedia
      // lintas perangkat (kurator perlu saat impersonation Login As).
      void hydrateDokumenArsip();
    }
    return load().users.find((u) => u.id === byUsername.id) ?? byUsername;
  }
  // Buat entry minimal sesuai role. Pakai id baru lokal supaya tidak bentrok
  // dengan id lama; relasi store akan menyusul saat user mengisi modul-modul
  // yang relevan.
  // Anggota (pelatih/seniman) dibuat lewat applyMemberFromServer supaya
  // seluruh field keanggotaan server (status, sanggarUsername, dll) terbawa.
  if (api.role === "pelatih" || api.role === "seniman") {
    save((d) => applyMemberFromServer(d, api));
    const created = load().users.find(
      (u) => u.username.toLowerCase() === api.username.toLowerCase(),
    );
    if (created) return created;
  }
  const profile = api.profile ?? {};
  const localId = `u_api_${api.id}`;
  const base = {
    id: localId,
    apiId: api.id,
    username: api.username,
    password: API_PASSWORD_PLACEHOLDER,
    createdAt: Date.now(),
    statusModerasiAkun:
      api.status === "diblokir" ? ("diblokir" as const) : ("aktif" as const),
    kategoriBlokirAkun: profile["kategoriBlokirAkun"],
    alasanBlokirAkun: profile["alasanBlokirAkun"],
    diblokirAt: profile["diblokirAt"],
    diblokirOleh: profile["diblokirOleh"],
  };
  let nu: AnyUser;
  switch (api.role as Role) {
    case "kurator":
      nu = { ...base, role: "kurator" } as AnyUser;
      break;
    case "admin":
      nu = {
        ...base,
        role: "admin",
        nama: String(profile["nama"] ?? api.username),
        permissions: {
          kelolaBerita: true,
          kelolaBanner: true,
          kelolaSlider: true,
          kelolaJamPembinaan: false,
          kelolaInfoBudaya: true,
        },
      } as AnyUser;
      break;
    case "juri":
      nu = {
        ...base,
        role: "juri",
        nama: String(profile["nama"] ?? api.username),
        keahlian: String(profile["keahlian"] ?? "Umum"),
      } as AnyUser;
      break;
    case "sanggar": {
      const sg = {
        ...base,
        role: "sanggar",
        namaSanggar: String(profile["namaSanggar"] ?? api.username),
        namaKetua: String(profile["namaKetua"] ?? "-"),
        legalitas: "Non-Badan Hukum",
        jenisKesenian: ["Tari"],
        alamat: String(profile["alamat"] ?? "-"),
        rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
        saldo: 0,
        editCount: 0,
        editPeriodStart: Date.now(),
      } as Record<string, unknown>;
      // Overlay key profil server yang tersedia agar simpan pertama tidak
      // menimpa data server dengan placeholder default.
      for (const k of SANGGAR_HYDRATE_KEYS) {
        if (profile[k] !== undefined) sg[k] = profile[k];
      }
      nu = sg as unknown as AnyUser;
      break;
    }
    case "pelatih":
      nu = {
        ...base,
        role: "pelatih",
        nama: String(profile["nama"] ?? api.username),
        usia: 30,
        pendidikan: "-",
        jenisKesenian: "Tari",
        status: "aktif",
        rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
        honorPerSesi: 0,
      } as AnyUser;
      break;
    case "seniman":
      nu = {
        ...base,
        role: "seniman",
        nama: String(profile["nama"] ?? api.username),
        usia: 25,
        pendidikan: "-",
        jenisKesenian: "Tari",
        status: "aktif",
        rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
      } as AnyUser;
      break;
    case "sewa":
      nu = {
        ...base,
        role: "sewa",
        nama: String(profile["nama"] ?? api.username),
        alamat:
          typeof profile["alamat"] === "string"
            ? (profile["alamat"] as string)
            : undefined,
      } as AnyUser;
      break;
    case "pengrajin":
      nu = {
        ...base,
        role: "pengrajin",
        namaUsaha: String(profile["namaUsaha"] ?? api.username),
        namaPemilik: String(profile["namaPemilik"] ?? "-"),
        jenisKerajinan: String(
          profile["jenisKerajinan"] ?? "Kerajinan Lainnya",
        ),
        produkUnggulan: String(profile["produkUnggulan"] ?? "-"),
        alamat: String(profile["alamat"] ?? "-"),
        wilayah:
          profile["wilayah"] && typeof profile["wilayah"] === "object"
            ? profile["wilayah"]
            : {},
        lat: Number(profile["lat"] ?? 0),
        lng: Number(profile["lng"] ?? 0),
        ...profile,
      } as AnyUser;
      break;
    case "mitra_pengrajin":
      nu = {
        ...base,
        role: "mitra_pengrajin",
        namaUsaha: String(profile["namaUsaha"] ?? api.username),
        namaPenanggungJawab: String(profile["namaPenanggungJawab"] ?? "-"),
        bentukUsaha: profile["bentukUsaha"] ?? "Perorangan",
        namaBadanUsaha: profile["namaBadanUsaha"],
        alamat: String(profile["alamat"] ?? "-"),
        memilikiTokoOffline: profile["memilikiTokoOffline"] !== false,
        namaTokoOffline: String(
          profile["namaTokoOffline"] ?? profile["namaUsaha"] ?? api.username,
        ),
        alamatTokoOffline: String(
          profile["alamatTokoOffline"] ?? profile["alamat"] ?? "-",
        ),
        wilayah: profile["wilayah"],
        npwp: String(profile["npwp"] ?? ""),
        nib: String(profile["nib"] ?? ""),
        rekening: profile["rekening"] ?? {
          bank: "BCA",
          nomor: "",
          atasNama: "-",
        },
        dokumen: profile["dokumen"] ?? [],
        marketplace: profile["marketplace"] ?? [],
        paketProduk: profile["paketProduk"] ?? [],
        jabatanPenandatangan: String(
          profile["jabatanPenandatangan"] ?? "Penanggung Jawab",
        ),
        ...profile,
      } as AnyUser;
      break;
    default:
      nu = { ...base, role: "kurator" } as AnyUser;
  }
  save((d) => {
    d.users.push(nu);
  });
  // Sanggar/kurator baru di perangkat ini: tarik daftar anggota dari server.
  if (api.role === "sanggar" || api.role === "kurator") {
    void hydrateMembers();
    void hydrateDokumenArsip();
  }
  return nu;
}

/**
 * Setelah sesi server terbentuk, tarik seluruh koleksi yang masih memakai
 * penyimpanan lokal lalu cari lagi user aktif. Pencarian ulang penting karena
 * bootstrap lintas perangkat dapat membawa id lokal dari perangkat lain.
 */
async function hydrateSyncedData(
  api: ApiAuthUser,
  fallback: AnyUser,
): Promise<AnyUser> {
  await startDataSync(api);
  if (api.role === "sanggar" || api.role === "kurator" || api.role === "juri") {
    void hydrateKurasi();
  }
  return (
    load().users.find((user) => user.apiId === api.id) ??
    load().users.find(
      (user) => user.username.toLowerCase() === api.username.toLowerCase(),
    ) ??
    fallback
  );
}

export function AuthProvider({
  children,
  mode = "utama",
  demoMode = false,
}: {
  children: ReactNode;
  mode?: AuthMode;
  demoMode?: boolean;
}) {
  const sessionPerTab = demoMode || apiTabSessionEnabled();
  const [user, setUser] = useState<AnyUser | null>(null);
  const [ready, setReady] = useState(false);
  const [impersonatedFromId, setImpersonatedFromId] = useState<string | null>(
    () => readImpersonation()?.originalUserId ?? null,
  );
  // Versi state auth — dinaikkan setiap kali login/logout terjadi supaya
  // hidrasi awal yang lambat tidak menimpa state baru.
  const stateVersionRef = useRef(0);
  // Id user aktif di TAB INI. Efek subscribe memakai ref ini (bukan
  // SESSION_KEY) supaya konsol dan app utama — yang berbagi SESSION_KEY —
  // tidak saling membalik user saat impersonation aktif.
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  useEffect(() => {
    setStoreDemoMode(demoMode);
  }, [demoMode]);

  // Hidrasi awal: cek sesi server. Jika impersonation aktif & user asli adalah
  // kurator, restore user impersonasi setelah cocokkan kurator dari API.
  useEffect(() => {
    let cancelled = false;
    const initialVersion = stateVersionRef.current;
    (async () => {
      if (demoMode) {
        const sid = readSessionId(true);
        const local = sid
          ? (load().users.find((candidate) => candidate.id === sid) ?? null)
          : null;
        const roleAllowed =
          local &&
          ((mode === "konsol" && local.role === "kurator") ||
            (mode === "utama" && local.role !== "kurator"));
        if (roleAllowed) {
          setUser(local);
        } else {
          clearSessionId(true);
          writeImpersonation(null);
          setImpersonatedFromId(null);
          setUser(null);
        }
        setReady(true);
        return;
      }
      try {
        const me = await authApi.me();
        if (cancelled || stateVersionRef.current !== initialVersion) return;
        let local = reconcileLocalUser(me);
        // Konsol hanya untuk kurator, sedangkan aplikasi utama tidak merender
        // kurator. Hindari bootstrap yang tidak akan dipakai di tab ini.
        if (
          (mode === "konsol" && local.role === "kurator") ||
          (mode === "utama" && local.role !== "kurator")
        ) {
          local = await hydrateSyncedData(me, local);
          if (cancelled || stateVersionRef.current !== initialVersion) return;
        }
        const imp = readImpersonation();

        if (mode === "konsol") {
          // Konsol khusus kurator; sesi peran lain diabaikan TANPA logout
          // (cookie mungkin sedang dipakai app utama di tab lain).
          if (local.role !== "kurator") {
            setUser(null);
            return;
          }
          const currentUsers = load().users;
          const impOriginal = imp
            ? resolveImpersonationUser(
                currentUsers,
                originalImpersonationRef(imp),
              )
            : undefined;
          if (imp && impOriginal?.id === local.id) {
            const target = resolveImpersonationUser(
              currentUsers,
              targetImpersonationRef(imp),
            );
            if (target) {
              // Sedang impersonate di app utama: konsol tetap tampil sebagai
              // kurator + indikator. SESSION_KEY dibiarkan menunjuk target
              // (dipakai app utama dan sessionCanWriteSettings).
              setImpersonatedFromId(local.id);
              setUser(local);
              return;
            }
            writeImpersonation(null);
            setImpersonatedFromId(null);
          } else if (imp) {
            // Impersonation milik user lain — bersihkan.
            writeImpersonation(null);
            setImpersonatedFromId(null);
          }
          writeSessionId(sessionPerTab, local.id);
          setUser(local);
          return;
        }

        // mode "utama"
        const currentUsers = load().users;
        const impOriginal = imp
          ? resolveImpersonationUser(
              currentUsers,
              originalImpersonationRef(imp),
            )
          : undefined;
        if (local.role !== "kurator" && me.impersonatedFrom) {
          const serverOriginal = resolveImpersonationUser(currentUsers, {
            localId: me.impersonatedFrom.id,
            apiId: me.impersonatedFrom.id,
            username: me.impersonatedFrom.username,
          });
          const originalIdentity = serverOriginal ?? {
            id: me.impersonatedFrom.id,
            apiId: me.impersonatedFrom.id,
            username: me.impersonatedFrom.username,
          };
          writeImpersonation(createImpersonationState(originalIdentity, local));
          writeSessionId(sessionPerTab, local.id);
          setUser(local);
          setImpersonatedFromId(originalIdentity.id);
          return;
        }
        if (imp && impOriginal?.id === local.id && local.role === "kurator") {
          const target = resolveImpersonationUser(
            currentUsers,
            targetImpersonationRef(imp),
          );
          if (target) {
            writeSessionId(sessionPerTab, target.id);
            setUser(target);
            setImpersonatedFromId(local.id);
            return;
          }
          // Target hilang — bersihkan impersonation.
          writeImpersonation(null);
          setImpersonatedFromId(null);
        }
        if (local.role === "kurator") {
          // Kurator tidak lagi punya UI di app utama (pindah ke Konsol).
          // Cookie sesi TIDAK dihapus — dipakai Konsol Kurator.
          setUser(null);
          return;
        }
        writeSessionId(sessionPerTab, local.id);
        setUser(local);
        if (imp && impOriginal?.id !== local.id) {
          // Impersonation ditinggalkan oleh user lain — bersihkan.
          writeImpersonation(null);
          setImpersonatedFromId(null);
        }
      } catch (err) {
        if (cancelled || stateVersionRef.current !== initialVersion) return;
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.warn("auth.me gagal", err);
        }
        if (mode === "konsol") {
          // Jangan sentuh SESSION_KEY/impersonation milik app utama
          // (mis. sesi lokal akun "sewa").
          setUser(null);
          return;
        }
        // Port non-demo hanya menerima sesi server. Sesi lokal lama dari saat
        // demo masih memakai port ini harus dibersihkan agar mode tidak campur.
        clearSessionId(sessionPerTab);
        writeImpersonation(null);
        setImpersonatedFromId(null);
        setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode, mode, sessionPerTab]);

  // Hidrasi pengaturan global (kurasiMatrix/appearance/dll) dari server saat
  // aplikasi dimuat, terlepas dari status login (branding/tema dibutuhkan di
  // halaman login). Server jadi sumber kebenaran; bila offline pakai lokal.
  useEffect(() => {
    if (!demoMode) void hydrateSettings();
  }, [demoMode]);

  // Admin/Kurator selalu melihat audit trail permanen dari server, termasuk
  // aksi yang terjadi di perangkat lain. Refresh ringan saat fokus dan tiap
  // 30 detik menjaga halaman aktivitas tetap mutakhir.
  useEffect(() => {
    if (demoMode) return;
    if (!user || (user.role !== "admin" && user.role !== "kurator")) return;
    const refresh = () => void hydrateActivityAudit();
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [demoMode, user?.id, user?.role]);

  // Sinkronkan user ketika store berubah (mis. profil di-update).
  // Berbasis userIdRef (bukan SESSION_KEY) — SESSION_KEY dibagi dua app dan
  // saat impersonation menunjuk target, sehingga membacanya di sini bisa
  // membalik user tab ini ke user lain.
  useEffect(() => {
    const unsub = subscribe(() => {
      const id = userIdRef.current;
      if (!id) return; // anon tetap anon; login/logout mengatur state eksplisit
      const fresh = load().users.find((u) => u.id === id) ?? null;
      setUser(fresh);
    });
    return () => {
      unsub();
    };
  }, []);

  const login = async (username: string, password: string) => {
    const uname = username.trim();
    // Login lokal hanya dipakai akun demo yang dikenal melalui launcher demo.
    const finishLocalLogin = (found: AnyUser | undefined): AnyUser | null => {
      if (!found) return null;
      if (found.statusModerasiAkun === "diblokir") {
        throw new Error(
          "Akun diblokir oleh Kurator. Hubungi pengelola Jak Sanggar untuk pemeriksaan lebih lanjut.",
        );
      }
      stateVersionRef.current += 1;
      writeImpersonation(null);
      setImpersonatedFromId(null);
      userIdRef.current = found.id;
      writeSessionId(sessionPerTab, found.id);
      setUser(found);
      setReady(true);
      logActivity(found.id, found.role, "login", { mode: "offline-local" });
      return found;
    };

    // Mode demo lokal harus diaktifkan eksplisit dan tetap dibatasi ke
    // localhost agar kredensial contoh tidak menjadi bypass pada deployment.
    const tryLocalDemoLogin = (): AnyUser | null => {
      const localHost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");
      if (!demoMode || !localHost) return null;
      const found = load().users.find(
        (u) =>
          LOCAL_DEMO_USERNAMES.has(u.username.toLowerCase()) &&
          ((mode === "konsol" && u.role === "kurator") ||
            (mode === "utama" && u.role !== "kurator")) &&
          u.username.toLowerCase() === uname.toLowerCase() &&
          (u as { password?: string }).password === password,
      );
      return finishLocalLogin(found);
    };

    if (demoMode) return tryLocalDemoLogin();

    if (mode === "konsol") {
      // Konsol: hanya kurator; tanpa fallback akun "sewa" lokal.
      // expectedRole membuat server MENOLAK sebelum membuat sesi, sehingga
      // cookie sesi lama pengguna (mis. sanggar di aplikasi utama) tidak
      // ikut terganti/ter-logout saat salah masuk lewat konsol.
      const api = await authApi.login(uname, password, "kurator");
      if (api.role !== "kurator") {
        // Pertahanan lapis dua (server lama tanpa expectedRole): jangan
        // tinggalkan cookie sesi hidup untuk peran yang ditolak.
        try {
          await authApi.logout();
        } catch {
          /* abaikan */
        }
        throw new Error(
          "Konsol ini khusus Kurator. Silakan masuk lewat aplikasi utama.",
        );
      }
      stateVersionRef.current += 1;
      writeImpersonation(null);
      setImpersonatedFromId(null);
      const local = await hydrateSyncedData(api, reconcileLocalUser(api));
      userIdRef.current = local.id;
      writeSessionId(sessionPerTab, local.id);
      setUser(local);
      setReady(true);
      logActivity(local.id, local.role, "login");
      return local;
    }

    try {
      const api = await authApi.login(uname, password);
      if (api.role === "kurator") {
        // Kurator tidak dikenal di aplikasi utama: berlaku persis seperti
        // "akun tidak terdaftar" tanpa menyebut Konsol Kurator. Sesi yang
        // baru dibuat server dihapus agar tidak ada cookie kurator tersisa.
        try {
          await authApi.logout();
        } catch {
          /* abaikan */
        }
        return null;
      }
      stateVersionRef.current += 1;
      writeImpersonation(null);
      setImpersonatedFromId(null);
      const local = await hydrateSyncedData(api, reconcileLocalUser(api));
      userIdRef.current = local.id;
      writeSessionId(sessionPerTab, local.id);
      setUser(local);
      setReady(true);
      logActivity(local.id, local.role, "login");
      return local;
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 400)
      ) {
        return null;
      }
      throw err;
    }
  };

  const logout = async () => {
    if (user) logActivity(user.id, user.role, "logout");
    // Antrean sinkronisasi disimpan per aktor. Jangan membuang perubahan
    // offline atau log logout; antrean akan dilanjutkan saat akun yang sama
    // masuk kembali.
    stopDataSync();
    if (!demoMode) {
      try {
        await authApi.logout();
      } catch {
        /* abaikan */
      }
    }
    stateVersionRef.current += 1;
    userIdRef.current = null;
    clearSessionId(sessionPerTab);
    writeImpersonation(null);
    setImpersonatedFromId(null);
    setUser(null);
    // Mode utama menghapus cache sensitif saat logout. Demo lokal hanya berisi
    // data contoh dan sengaja dipertahankan agar alur lintas akun (Sanggar →
    // Pelatih/Seniman/Pengrajin) dapat diuji tanpa kehilangan transaksi.
    if (!demoMode && !sessionPerTab) clearLocalDb();
  };

  const setSession = (u: AnyUser) => {
    userIdRef.current = u.id;
    writeSessionId(sessionPerTab, u.id);
    setUser(u);
    if (!demoMode && u.apiId) {
      void startDataSync({ id: u.apiId, username: u.username, role: u.role });
    }
  };

  const impersonate = async (targetUserId: string): Promise<boolean> => {
    // Hanya kurator (atau yang sedang impersonate dari kurator) yang boleh.
    const originalId = impersonatedFromId ?? user?.id ?? null;
    if (!originalId) return false;
    const db = load();
    const original = db.users.find((u) => u.id === originalId);
    if (!original || original.role !== "kurator") return false;
    if (targetUserId === originalId) {
      // Diminta "impersonate diri sendiri" — sama seperti stop.
      return stopImpersonation();
    }
    const target = db.users.find((u) => u.id === targetUserId);
    if (!target) return false;
    if (target.role === "kurator") return false;
    if (!demoMode) {
      if (!target.apiId) return false;
      try {
        await authApi.impersonate(target.apiId);
      } catch (error) {
        console.warn("Login As server gagal", error);
        return false;
      }
    }
    writeImpersonation(createImpersonationState(original, target));
    userIdRef.current = target.id;
    writeSessionId(sessionPerTab, target.id);
    setImpersonatedFromId(originalId);
    // Di konsol, user tab ini tetap kurator (indikator ditampilkan);
    // pemanggil mengarahkan window.location ke app utama sebagai target.
    if (mode === "utama") setUser(target);
    logActivity(originalId, "kurator", "impersonate-start", {
      targetId: targetUserId,
      targetRole: target.role,
    });
    return true;
  };

  const stopImpersonation = async (): Promise<boolean> => {
    if (!impersonatedFromId) return false;
    const db = load();
    const imp = readImpersonation();
    let original = imp
      ? resolveImpersonationUser(db.users, originalImpersonationRef(imp))
      : db.users.find((u) => u.id === impersonatedFromId);
    if (!demoMode) {
      try {
        original = reconcileLocalUser(await authApi.stopImpersonation());
      } catch (error) {
        console.warn("Pemulihan sesi Kurator gagal", error);
        return false;
      }
    }
    if (!original) {
      writeImpersonation(null);
      setImpersonatedFromId(null);
      return false;
    }
    logActivity(original.id, "kurator", "impersonate-stop", {
      fromUserId: user?.id ?? null,
    });
    writeImpersonation(null);
    userIdRef.current = original.id;
    writeSessionId(sessionPerTab, original.id);
    setImpersonatedFromId(null);
    setUser(original);
    return true;
  };

  const refresh = () => {
    // Prioritaskan user tab ini; fallback SESSION_KEY dengan guard mode agar
    // konsol tidak menampilkan non-kurator dan app utama tidak menampilkan
    // kurator (kecuali sedang impersonate).
    const id = userIdRef.current ?? readSessionId(sessionPerTab);
    const fresh = id ? (load().users.find((u) => u.id === id) ?? null) : null;
    if (fresh && mode === "konsol" && fresh.role !== "kurator") return;
    if (
      fresh &&
      mode === "utama" &&
      fresh.role === "kurator" &&
      !readImpersonation()
    ) {
      setUser(null);
      return;
    }
    setUser(fresh);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        ready,
        demoMode,
        impersonatedFromId,
        login,
        logout,
        setSession,
        impersonate,
        stopImpersonation,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}

export function useDb() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
  return load();
}

export { save, logActivity };
