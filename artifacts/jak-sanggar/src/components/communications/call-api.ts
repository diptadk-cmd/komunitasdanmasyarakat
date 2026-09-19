import { apiFetch } from "@workspace/jaksanggar-core/api";

export type CallMode = "audio" | "video";
export interface CommunicationCall {
  id: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
  status: "ringing" | "accepted" | "rejected" | "ended" | "missed";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}
export interface CallSignal {
  id: string;
  senderId: string;
  type: "offer" | "answer" | "ice";
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  createdAt: number;
}
const BASE = "/api/communications";

async function request<T>(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try { return await apiFetch<T>(`${BASE}${path}`, { cache: "no-store", ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); init.signal?.removeEventListener("abort", abort); }
}

export const callApi = {
  contacts: (signal?: AbortSignal) => request<{ contacts: { id: string; name: string }[] }>("/contacts", { signal }),
  list: (signal?: AbortSignal) => request<{ calls: CommunicationCall[] }>("/calls", { signal }),
  config: (signal?: AbortSignal) => request<{ iceServers: RTCIceServer[]; relayConfigured: boolean }>("/rtc-config", { signal }),
  create: (peerId: string, mode: CallMode, requestId: string) => request<{ call: CommunicationCall }>("/calls", { method: "POST", body: JSON.stringify({ peerId, mode, requestId }) }),
  update: (id: string, status: "accepted" | "rejected" | "ended", keepalive = false) => request<{ call: CommunicationCall }>(`/calls/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }), keepalive }),
  signals: (id: string, after: string | undefined, signal?: AbortSignal) => request<{ call: CommunicationCall; signals: CallSignal[]; cursor: string }>(`/calls/${encodeURIComponent(id)}/signals${after ? `?after=${encodeURIComponent(after)}` : ""}`, { signal }),
  signal: (id: string, type: CallSignal["type"], payload: CallSignal["payload"], signal?: AbortSignal) => {
    const requestId = crypto.randomUUID();
    return request<{ signal: CallSignal }>(`/calls/${encodeURIComponent(id)}/signals`, { method: "POST", signal, body: JSON.stringify({ requestId, type, payload }) });
  },
};
