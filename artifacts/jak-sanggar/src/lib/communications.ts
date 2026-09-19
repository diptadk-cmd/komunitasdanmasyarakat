import { apiFetch } from "@workspace/jaksanggar-core/api";

export type CommunicationKind = "chat" | "mail";
export interface CommunicationContact {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  online: boolean;
  lastSeenAt?: number;
}
export interface CommunicationAttachment {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  durationMs?: number;
}
export interface CommunicationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  kind: CommunicationKind;
  body: string;
  subject?: string;
  attachment?: CommunicationAttachment;
  createdAt: number;
  readAt?: number;
}
export interface CommunicationThread {
  id: string;
  peer: CommunicationContact;
  kind: CommunicationKind;
  lastMessage: CommunicationMessage;
  unread: number;
}
export interface MessagePage {
  messages: CommunicationMessage[];
  hasMore: boolean;
}

const base = "/api/communications";
const request = <T>(path: string, init: RequestInit = {}) => apiFetch<T>(`${base}${path}`, { cache: "no-store", ...init });
const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
function arrayResult<T extends object>(value: T, key: keyof T): T {
  if (!value || !Array.isArray(value[key])) throw new Error("Layanan pesan belum tersedia. Coba muat ulang beberapa saat lagi.");
  return value;
}

export const communicationsApi = {
  contacts: async (signal?: AbortSignal) => arrayResult(await request<{ contacts: CommunicationContact[]; selfId: string; serverTime: number }>("/contacts", { signal }), "contacts"),
  presence: () => post<{ online: true; expiresAt: number }>("/presence", {}),
  threads: async (kind: CommunicationKind, signal?: AbortSignal) => arrayResult(await request<{ threads: CommunicationThread[] }>(`/threads?kind=${kind}`, { signal }), "threads"),
  messages: async (peerId: string, kind: CommunicationKind, before?: number, signal?: AbortSignal) => {
    const query = new URLSearchParams({ peerId, kind, limit: "50" });
    if (before !== undefined) query.set("before", String(before));
    return arrayResult(await request<MessagePage>(`/messages?${query}`, { signal }), "messages");
  },
  mail: async (folder: "inbox" | "sent", before?: number, signal?: AbortSignal) => {
    const query = new URLSearchParams({ folder, limit: "50" });
    if (before !== undefined) query.set("before", String(before));
    return arrayResult(await request<MessagePage>(`/mail?${query}`, { signal }), "messages");
  },
  send: (body: { requestId: string; peerId: string; kind: CommunicationKind; body: string; subject?: string; attachmentId?: string }) => post<{ message: CommunicationMessage }>("/messages", body),
  read: (peerId: string, kind: CommunicationKind, through: number) => post<{ ok: true }>("/read", { peerId, kind, through }),
  uploadVoice: async (blob: Blob, durationSeconds: number) => {
    const form = new FormData();
    const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    form.append("file", blob, `pesan-suara.${extension}`);
    form.append("durationMs", String(Math.round(durationSeconds * 1000)));
    return request<{ attachment: CommunicationAttachment }>("/attachments", { method: "POST", body: form });
  },
};

export function communicationError(error: unknown): string {
  return error instanceof Error ? error.message : "Pesan belum dapat dimuat. Periksa koneksi Anda.";
}

export const communicationRole = (role: string) => ({
  sanggar: "Sanggar", seniman: "Seniman", pelatih: "Pelatih", juri: "Juri", admin: "Admin", kurator: "Kurator", pengrajin: "Pengrajin", mitra_pengrajin: "Mitra", sewa: "Konsumen",
}[role] ?? role);

export function announceCommunicationChange() {
  window.dispatchEvent(new Event("communications:changed"));
}

/** Merge by server ID so polling and pagination never duplicate bubbles. */
export function mergeCommunicationMessages(current: CommunicationMessage[], incoming: CommunicationMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
