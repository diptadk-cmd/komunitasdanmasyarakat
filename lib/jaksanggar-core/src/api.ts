import type { KurasiMatrix } from "./types";

// Tipis: helper fetch yang otomatis sertakan cookie sesi & error handling.
// Akan dipakai modul lain di Tahap 2+ saat dipindahkan dari localStorage ke API.

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const TAB_SESSION_TOKEN_KEY = "jaksanggar_api_tab_session_v1";

export function apiTabSessionEnabled(): boolean {
  // Akses harus langsung melalui `import.meta.env` agar Vite menyuntikkan
  // nilai env ke modul workspace ini. Menyimpan `import.meta` ke alias membuat
  // flag selalu undefined di browser dan seluruh tab kembali memakai cookie
  // sesi yang sama.
  return import.meta.env?.VITE_DEMO_SESSION_PER_TAB === "true";
}

function readTabSessionToken(): string | null {
  if (!apiTabSessionEnabled() || typeof sessionStorage === "undefined") {
    return null;
  }
  return sessionStorage.getItem(TAB_SESSION_TOKEN_KEY);
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !headers.has("content-type") &&
    typeof init.body === "string"
  ) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  const tabSessionToken = readTabSessionToken();
  if (tabSessionToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${tabSessionToken}`);
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: apiTabSessionEnabled() ? "omit" : "include",
  });
  const ct = res.headers.get("content-type") ?? "";
  let payload: unknown = null;
  if (res.status !== 204 && res.status !== 205) {
    if (ct.includes("application/json")) {
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
    } else {
      try {
        payload = await res.text();
      } catch {
        payload = null;
      }
    }
  }
  if (!res.ok) {
    const msg =
      payload &&
      typeof payload === "object" &&
      "error" in (payload as Record<string, unknown>)
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, payload, msg);
  }
  return payload as T;
}

export interface ApiAuthUser {
  id: string;
  username: string;
  role:
    | "kurator"
    | "admin"
    | "juri"
    | "sanggar"
    | "pelatih"
    | "seniman"
    | "pengrajin"
    | "mitra_pengrajin"
    | "sewa";
  status: string;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  impersonatedFrom?: {
    id: string;
    username: string;
    role: "kurator";
  };
}

export const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

export interface PasswordResetRequestAccepted {
  requestId: string;
  /** Hanya hadir pada development bila flag server eksplisit diaktifkan. */
  devOtp?: string;
}

export const passwordResetApi = {
  request: (email: string) =>
    apiFetch<PasswordResetRequestAccepted>("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verify: (requestId: string, otp: string) =>
    apiFetch<{ resetToken: string }>("/api/auth/password-reset/verify", {
      method: "POST",
      body: JSON.stringify({ requestId, otp }),
    }),
  confirm: (requestId: string, resetToken: string, newPassword: string) =>
    apiFetch<null>("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ requestId, resetToken, newPassword }),
    }),
};

export const authApi = {
  login: (
    username: string,
    password: string,
    expectedRole?: ApiAuthUser["role"],
  ) => {
    const tabSession = apiTabSessionEnabled();
    return apiFetch<ApiAuthUser & { sessionToken?: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(
          expectedRole
            ? { username, password, expectedRole, tabSession }
            : { username, password, tabSession },
        ),
      },
    ).then((result) => {
      if (tabSession && result.sessionToken) {
        sessionStorage.setItem(TAB_SESSION_TOKEN_KEY, result.sessionToken);
      }
      const { sessionToken: _sessionToken, ...user } = result;
      return user as ApiAuthUser;
    });
  },
  // Calon pelatih/seniman menunggu persetujuan Sanggar dan tidak auto-login.
  // Peran publik lain yang tidak memakai alur keanggotaan tetap auto-login.
  register: (body: {
    username: string;
    password: string;
    role:
      | "pelatih"
      | "seniman"
      | "sanggar"
      | "juri"
      | "pengrajin"
      | "mitra_pengrajin"
      | "sewa";
    profile?: Record<string, unknown>;
  }) =>
    apiFetch<ApiAuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: async () => {
    try {
      return await apiFetch<null>("/api/auth/logout", { method: "POST" });
    } finally {
      if (apiTabSessionEnabled() && typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(TAB_SESSION_TOKEN_KEY);
      }
    }
  },
  impersonate: (targetUserId: string) =>
    apiFetch<ApiAuthUser>("/api/auth/impersonate", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    }),
  stopImpersonation: () =>
    apiFetch<ApiAuthUser>("/api/auth/impersonate/stop", {
      method: "POST",
    }),
  me: () => apiFetch<ApiAuthUser>("/api/auth/me"),
};

export interface ApiUploadResult {
  id: string;
  url: string;
  publicUrl: string;
  contentType: string;
  mediaKind: "audio" | "video" | "image" | "document" | "other";
  sizeBytes: number;
  originalName?: string | null;
  createdAt: string;
}

export const uploadsApi = {
  create: (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return apiFetch<ApiUploadResult>("/api/uploads", {
      method: "POST",
      body,
    });
  },
};

export interface ApiActivityAuditItem {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorUsername: string | null;
  action: string | null;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityAuditQuery {
  limit?: number;
  action?: string;
  actorId?: string;
  targetType?: string;
  before?: string;
}

export const activityAuditApi = {
  list: (query: ActivityAuditQuery = {}) => {
    const params = new URLSearchParams();
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.action) params.set("action", query.action);
    if (query.actorId) params.set("actorId", query.actorId);
    if (query.targetType) params.set("targetType", query.targetType);
    if (query.before) params.set("before", query.before);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return apiFetch<{
      items: ApiActivityAuditItem[];
      nextCursor?: string;
    }>(`/api/activity-audit${suffix}`);
  },
};

export const publicContentApi = {
  infoBudaya: () =>
    apiFetch<Array<Record<string, unknown>>>("/api/public/info-budaya"),
  news: () => apiFetch<Array<Record<string, unknown>>>("/api/public/news"),
  sanggars: () =>
    apiFetch<Array<Record<string, unknown>>>("/api/public/sanggars", {
      cache: "no-store",
    }),
  pengrajin: () =>
    apiFetch<Array<Record<string, unknown>>>("/api/public/pengrajin"),
  mitraPengrajin: () =>
    apiFetch<Array<Record<string, unknown>>>("/api/public/mitra-pengrajin"),
};

export interface CreateApiUserBody {
  username: string;
  password: string;
  role: ApiAuthUser["role"];
  status?: string;
  profile?: Record<string, unknown>;
}

export interface UpdateApiUserBody {
  password?: string;
  status?: string;
  profile?: Record<string, unknown>;
}

export interface ApiSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export const settingsApi = {
  list: () => apiFetch<ApiSetting[]>("/api/settings"),
  put: (key: string, value: unknown) =>
    apiFetch<ApiSetting>(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};

// Keanggotaan (pelatih/seniman). Sanggar mengelola anggotanya sendiri;
// kurator/admin melihat semua. Lihat routes/members.ts di api-server.
export const membersApi = {
  list: () => apiFetch<ApiAuthUser[]>("/api/members"),
  create: (body: {
    username: string;
    password: string;
    role: "pelatih" | "seniman";
    profile?: Record<string, unknown>;
  }) =>
    apiFetch<ApiAuthUser>("/api/members", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: { role?: "pelatih" | "seniman"; profile?: Record<string, unknown> },
  ) =>
    apiFetch<ApiAuthUser>(`/api/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// Arsip Dokumen Administrasi (per-sanggar; kunci pemilik = username sanggar).
// Lihat routes/dokumen-arsip.ts di api-server.
export interface ApiDokumenArsip {
  id: string;
  sanggarUsername: string;
  templateId: string;
  judul: string;
  bentukId: string;
  nilai: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export type ApiDokumenArsipInput = Omit<
  ApiDokumenArsip,
  "id" | "sanggarUsername"
> & {
  sanggarUsername?: string;
};

export const dokumenArsipApi = {
  list: () => apiFetch<ApiDokumenArsip[]>("/api/dokumen-arsip"),
  put: (id: string, body: ApiDokumenArsipInput) =>
    apiFetch<ApiDokumenArsip>(`/api/dokumen-arsip/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<null>(`/api/dokumen-arsip/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export interface ApiKurasiSubmission {
  id: string;
  sanggarUsername: string;
  tahap1: Record<string, string>;
  tahap1Files?: Record<string, unknown[]>;
  tahap2VideoName?: string;
  tahap2VideoUrl?: string;
  pesertaSeni?: unknown[];
  deklarasiAntiJoki?: boolean;
  deklarasiAntiJokiAt?: number;
  deklarasiAntiJokiOleh?: string;
  matrixSnapshot?: KurasiMatrix;
  scores: Record<string, Record<string, number>>;
  requirementScores?: Record<string, Record<string, Record<string, number>>>;
  finalized: Record<string, number>;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiKurasiAssignment {
  id: string;
  juriUsername: string;
  sanggarUsername: string;
  periode: string;
  createdAt: string;
}

export const kurasiApi = {
  listSubmissions: () =>
    apiFetch<ApiKurasiSubmission[]>("/api/kurasi/submissions"),
  putSubmission: (
    body: Omit<
      ApiKurasiSubmission,
      | "id"
      | "sanggarUsername"
      | "createdAt"
      | "updatedAt"
      | "matrixSnapshot"
      | "scores"
      | "requirementScores"
      | "finalized"
      | "deklarasiAntiJokiAt"
      | "deklarasiAntiJokiOleh"
    >,
  ) =>
    apiFetch<ApiKurasiSubmission>("/api/kurasi/submission", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  listAssignments: () =>
    apiFetch<ApiKurasiAssignment[]>("/api/kurasi/assignments"),
  createAssignment: (body: {
    juriUsername: string;
    sanggarUsername: string;
    periode: string;
  }) =>
    apiFetch<ApiKurasiAssignment>("/api/kurasi/assignments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  saveScores: (body: {
    sanggarUsername: string;
    scores: Record<string, number>;
    requirementScores?: Record<string, Record<string, number>>;
    finalize: boolean;
  }) =>
    apiFetch<ApiKurasiSubmission>("/api/kurasi/submission/scores", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const usersApi = {
  // Direktori akun berubah dari perangkat lain dan tidak boleh memakai
  // snapshot HTTP lama milik sesi Kurator sebelumnya.
  list: () =>
    apiFetch<ApiAuthUser[]>("/api/users", {
      cache: "no-store",
    }),
  create: (body: CreateApiUserBody) =>
    apiFetch<ApiAuthUser>("/api/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateApiUserBody) =>
    apiFetch<ApiAuthUser>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<null>(`/api/users/${id}`, { method: "DELETE" }),
};

/** Identitas publik minimum yang dibutuhkan untuk meresolusi relasi sinkron. */
export interface ApiSyncIdentity {
  id: string;
  username: string;
  role: ApiAuthUser["role"];
  status: string;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ApiSyncCollection =
  | "news"
  | "banners"
  | "slider"
  | "latihan"
  | "iuran"
  | "pengajuanHonor"
  | "distribusi"
  | "transaksi"
  | "kas"
  | "sertifikat"
  | "activity"
  | "absensiPembinaan"
  | "pendaftaranPembinaan"
  | "absensiLatihan"
  | "aset"
  | "sarpras"
  | "kerjasama"
  | "chatMessages"
  | "negosiasi"
  | "invoices"
  | "payments"
  | "contracts"
  | "bast"
  | "ratings"
  | "pemesananSewa"
  | "kerjasamaMitraPengrajin"
  | "pesananProdukPengrajin"
  | "infoBudaya"
  | "paketIsian";

export interface ApiSyncRecord {
  collection: ApiSyncCollection;
  id: string;
  data: Record<string, unknown>;
  revision: number;
  deletedAt?: string | null;
}

export interface ApiSyncMutation {
  mutationId: string;
  collection: ApiSyncCollection;
  id: string;
  op: "upsert" | "delete";
  baseRevision?: number;
  data?: Record<string, unknown>;
}

export interface ApiSyncMutationResult {
  mutationId: string;
  status: "applied" | "conflict" | "rejected";
  record?: ApiSyncRecord;
  error?: string;
}

export interface ApiSyncBootstrap {
  /** True bila `identities` adalah direktori pengguna server yang lengkap. */
  directoryComplete?: boolean;
  identities: ApiSyncIdentity[];
  records: ApiSyncRecord[];
}

export const syncApi = {
  // Bootstrap adalah snapshot otoritatif. Paksa browser melewati cache agar
  // penambahan field/profil dan akun baru langsung menggantikan seed lokal.
  bootstrap: () =>
    apiFetch<ApiSyncBootstrap>("/api/sync/bootstrap", {
      cache: "no-store",
    }),
  mutate: (mutations: ApiSyncMutation[]) =>
    apiFetch<{ results: ApiSyncMutationResult[] }>("/api/sync/mutations", {
      method: "POST",
      body: JSON.stringify({ mutations }),
    }),
};
