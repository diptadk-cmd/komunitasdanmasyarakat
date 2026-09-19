/** Shared wire contract. Times are epoch milliseconds; all IDs are server IDs. */
export type CommunicationKind = "chat" | "mail";
export interface CommunicationContact { id: string; name: string; role: string; avatarUrl?: string; online: boolean; lastSeenAt?: number }
export interface CommunicationAttachment { id: string; url: string; contentType: string; sizeBytes: number; durationMs?: number }
export interface CommunicationMessage { id: string; conversationId: string; senderId: string; recipientId: string; kind: CommunicationKind; body: string; subject?: string; attachment?: CommunicationAttachment; createdAt: number; readAt?: number }
export interface CommunicationThread { id: string; peer: CommunicationContact; kind: CommunicationKind; lastMessage: CommunicationMessage; unread: number }
export type CommunicationCallStatus = "ringing" | "accepted" | "rejected" | "ended" | "missed";
export interface CommunicationCall { id: string; callerId: string; calleeId: string; mode: "audio" | "video"; status: CommunicationCallStatus; createdAt: number; updatedAt: number; expiresAt: number }
export interface CommunicationSignal { id: string; senderId: string; type: "offer" | "answer" | "ice"; payload: Record<string, unknown>; createdAt: number }
export interface CommunicationIceServer { urls: string | string[]; username?: string; credential?: string }
/**
 * Base /api/communications; every endpoint requires the current API session.
 * GET contacts -> {contacts:Contact[], selfId, serverTime}
 * POST presence {} -> {online:true, expiresAt}
 * GET threads?kind=chat|mail -> {threads:Thread[]}
 * GET messages?peerId=&kind=&before=&limit= -> {messages:Message[],hasMore}
 *   Pair messages: chronological ascending, most recent page; before is exclusive.
 * GET mail?folder=inbox|sent&before=&limit= -> {messages:Message[],hasMore}
 *   Mail: newest first.
 * POST messages {requestId,peerId,kind,body,subject?,attachmentId?} -> {message}
 * POST read {peerId,kind,through} -> {ok:true}; through is last message timestamp.
 * POST attachments multipart {file,durationMs} -> {attachment}; audio <=8MiB/120s.
 * GET attachments/:id/raw -> private audio (sender or actual message recipient).
 * GET rtc-config -> {iceServers:IceServer[],relayConfigured:boolean}
 * POST calls {requestId,peerId,mode:audio|video} -> {call}
 * GET calls -> {calls:Call[]} (active calls only)
 * PATCH calls/:id {status:accepted|rejected|ended} -> {call}
 * POST calls/:id/signals {requestId,type:offer|answer|ice,payload} -> {signal}
 * GET calls/:id/signals?after= -> {signals:Signal[],cursor:string,call}
 * Signals contains only the other participant's events. Cursor is opaque.
 * Poll calls every 4s, signals every 1.5s while active; presence every 20s.
 * Errors: {error:string}; 400 invalid, 401 login, 403 denied, 404 absent,
 * 409 conflict, 413 too large, 415 unsupported audio, 429 throttled.
 */
