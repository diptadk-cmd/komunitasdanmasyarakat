import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, CheckCheck, ChevronRight, Inbox, LoaderCircle, Mail, MessageCircle, PenLine, RefreshCw, Search, Send, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CallButtons, useCalls } from "@/components/communications/CallProvider";
import VoiceRecorder from "@/components/communications/VoiceRecorder";
import { MessageAudio } from "@/components/communications/MessageAudio";
import { announceCommunicationChange, communicationError, communicationRole, communicationsApi, mergeCommunicationMessages, type CommunicationContact, type CommunicationKind, type CommunicationMessage, type CommunicationThread } from "@/lib/communications";
import "./pesan.css";

type Folder = "inbox" | "sent" | "chat";
type Selection = { peerId: string; kind: CommunicationKind };
const dateText = (time: number) => new Date(time).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const timeText = (time: number) => new Date(time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const preview = (message: CommunicationMessage) => message.body || (message.attachment ? "Pesan suara" : "Pesan");

export default function Pesan() {
  const { user, demoMode } = useAuth();
  if (!user) return null;
  if (demoMode || !user.apiId) return <div className="communications-page" data-tradisi="silent"><h1>Pesan & percakapan</h1><div className="comm-state"><MessageCircle /><h2>Masuk dengan akun terdaftar</h2><p>Pesan, status daring, dan panggilan tersedia melalui akun yang terhubung ke server.</p></div></div>;
  return <PesanAccount key={user.apiId} expectedSelfId={user.apiId} />;
}

function ContactAvatar({ contact, showOnline = false }: { contact: CommunicationContact; showOnline?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const initials = contact.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <span className="comm-avatar" aria-hidden="true">
    {contact.avatarUrl && failed !== contact.avatarUrl ? <img src={contact.avatarUrl} alt="" onError={() => setFailed(contact.avatarUrl)} /> : initials || "?"}
    {showOnline && contact.online && <i className="comm-online-dot" />}
  </span>;
}

function Status({ contact, known }: { contact: CommunicationContact; known: boolean }) {
  if (!known) return <span className="comm-presence">Status belum tersedia</span>;
  return <span className={`comm-presence ${contact.online ? "is-online" : ""}`}>{contact.online ? "Sedang online" : contact.lastSeenAt ? `Terakhir aktif ${dateText(contact.lastSeenAt)}, ${timeText(contact.lastSeenAt)}` : "Sedang offline"}</span>;
}

function PesanAccount({ expectedSelfId }: { expectedSelfId: string }) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [contacts, setContacts] = useState<CommunicationContact[]>([]);
  const [presenceKnown, setPresenceKnown] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [mail, setMail] = useState<CommunicationMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const currentFolder = useRef(folder);
  const mailHistoryExpanded = useRef(false);
  currentFolder.current = folder;
  const contactMap = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const resolveContact = (id: string): CommunicationContact => contactMap.get(id) ?? { id, name: "Akun komunitas", role: "", online: false };
  const refresh = useCallback(() => { setRevision((value) => value + 1); announceCommunicationChange(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const loadContacts = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const response = await communicationsApi.contacts(controller.signal);
        if (controller.signal.aborted) return;
        if (response.selfId !== expectedSelfId) {
          setIdentityReady(false); setContacts([]); setPresenceKnown(false); setMail([]); setThreads([]); setSelection(null);
          setDirectoryError("Sesi pesan berbeda dari akun yang sedang dibuka. Masuk langsung dengan akun ini untuk membuka percakapan.");
          return;
        }
        setContacts(response.contacts); setIdentityReady(true); setPresenceKnown(true); setDirectoryError("");
      } catch (error) {
        if (!controller.signal.aborted) { setDirectoryError(communicationError(error)); setPresenceKnown(false); }
      } finally { running = false; }
    };
    void loadContacts();
    const timer = window.setInterval(loadContacts, 20_000);
    document.addEventListener("visibilitychange", loadContacts);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", loadContacts); };
  }, [expectedSelfId, revision]);

  useEffect(() => {
    if (!identityReady) { setLoading(false); return; }
    const controller = new AbortController();
    let running = false;
    setLoading(true); setListError("");
    const loadList = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        if (folder === "chat") {
          const response = await communicationsApi.threads("chat", controller.signal);
          if (!controller.signal.aborted) { setThreads(response.threads); setHasMore(false); }
        } else {
          const response = await communicationsApi.mail(folder, undefined, controller.signal);
          if (!controller.signal.aborted) {
            setMail((previous) => [...mergeCommunicationMessages(previous, response.messages)].reverse());
            if (!mailHistoryExpanded.current) setHasMore(response.hasMore);
          }
        }
        if (!controller.signal.aborted) setListError("");
      } catch (error) { if (!controller.signal.aborted) setListError(communicationError(error)); }
      finally { running = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void loadList();
    const timer = window.setInterval(loadList, 8_000);
    document.addEventListener("visibilitychange", loadList);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", loadList); };
  }, [folder, identityReady, revision]);

  const changeFolder = (next: Folder) => { if (next === folder) return; mailHistoryExpanded.current = false; setFolder(next); setSelection(null); setQuery(""); setMail([]); setThreads([]); setHasMore(false); };
  const openChat = (contact: CommunicationContact) => { setFolder("chat"); setSelection({ peerId: contact.id, kind: "chat" }); setContactsOpen(false); };
  const loadMore = async () => {
    if (folder === "chat" || !mail.length || loadingMore) return;
    setLoadingMore(true);
    const requestedFolder = folder;
    try {
      const response = await communicationsApi.mail(requestedFolder, Math.min(...mail.map((message) => message.createdAt)));
      if (currentFolder.current !== requestedFolder) return;
      mailHistoryExpanded.current = true;
      setMail((previous) => [...mergeCommunicationMessages(previous, response.messages)].reverse()); setHasMore(response.hasMore);
    } catch (error) { if (currentFolder.current === requestedFolder) setListError(communicationError(error)); }
    finally { setLoadingMore(false); }
  };
  const filteredMail = mail.filter((message) => {
    const name = resolveContact(folder === "sent" ? message.recipientId : message.senderId).name;
    return `${name} ${message.subject ?? ""} ${message.body}`.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID"));
  });
  const filteredThreads = threads.filter((thread) => `${thread.peer.name} ${preview(thread.lastMessage)}`.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")));
  const activeContact = selection ? resolveContact(selection.peerId) : null;
  const listEmpty = folder === "chat" ? filteredThreads.length === 0 : filteredMail.length === 0;

  return <div className="communications-page" data-tradisi="silent">
    <header className="comm-page-heading">
      <div><h1>Pesan & percakapan</h1><p>Satu ruang untuk terhubung dengan komunitas.</p></div>
      <button className="comm-primary-button" type="button" onClick={() => setComposeOpen(true)} disabled={!identityReady}><PenLine size={17} />Tulis pesan</button>
    </header>
    {directoryError && <div className="comm-error" role="alert">{directoryError}<button type="button" onClick={refresh}>Coba lagi</button></div>}
    <div className="comm-toolbar">
      <div className="comm-tabs" role="tablist" aria-label="Jenis komunikasi">
        {([{ id: "inbox", label: "Kotak masuk", Icon: Inbox }, { id: "sent", label: "Terkirim", Icon: Send }, { id: "chat", label: "Chat", Icon: MessageCircle }] as const).map(({ id, label, Icon }, index) => <button key={id} id={`comm-tab-${id}`} type="button" role="tab" tabIndex={folder === id ? 0 : -1} aria-selected={folder === id} aria-controls="comm-list-panel" onClick={() => changeFolder(id)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
          if (next < 0) return;
          event.preventDefault(); changeFolder((["inbox", "sent", "chat"] as const)[next]);
          (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
        }}><Icon size={17} /><span>{label}</span></button>)}
      </div>
      <button className="comm-contacts-button" type="button" disabled={!identityReady} onClick={() => setContactsOpen(true)}><Users size={17} /><span>Kontak</span><small>{presenceKnown ? `${contacts.filter((contact) => contact.online).length} online` : "—"}</small></button>
    </div>
    <div className={`comm-workspace ${selection ? "has-selection" : ""}`}>
      <aside className="comm-list-panel" id="comm-list-panel" role="tabpanel" aria-labelledby={`comm-tab-${folder}`}>
        <div className="comm-search"><Search size={17} aria-hidden="true" /><input aria-label="Cari pesan atau nama" placeholder="Cari pesan atau nama…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Hapus pencarian" onClick={() => setQuery("")}><X size={15} /></button>}</div>
        <div className="comm-list-meta"><span>{folder === "chat" ? "Percakapan Anda" : folder === "sent" ? "Pesan yang Anda kirim" : "Pesan untuk Anda"}</span><button type="button" onClick={refresh} aria-label="Muat ulang daftar pesan"><RefreshCw size={14} /></button></div>
        {listError && <p className="comm-inline-error" role="alert">{listError}</p>}
        <div className="comm-list-scroll" aria-busy={loading}>
          {loading && listEmpty ? <div className="comm-list-state"><LoaderCircle className="animate-spin" /><p>Memuat pesan…</p></div> : listEmpty ? <div className="comm-list-state"><Mail /><h3>{query ? "Pesan tidak ditemukan" : folder === "sent" ? "Belum ada pesan terkirim" : folder === "chat" ? "Mulai percakapan pertama" : "Kotak masuk masih kosong"}</h3><p>{query ? "Coba nama atau kata lain." : "Pilih kontak untuk menyapa dan berbagi informasi."}</p><button type="button" disabled={!identityReady} onClick={() => setContactsOpen(true)}>Lihat kontak <ChevronRight size={15} /></button></div> : folder === "chat" ? filteredThreads.map((thread) => {
            const peer = contactMap.get(thread.peer.id) ?? thread.peer;
            return <button type="button" key={thread.id} className={`comm-list-item ${selection?.peerId === peer.id ? "is-selected" : ""}`} onClick={() => setSelection({ peerId: peer.id, kind: "chat" })} aria-pressed={selection?.peerId === peer.id}>
              <ContactAvatar contact={peer} showOnline={presenceKnown} /><span className="comm-list-copy"><span className="comm-list-item-top"><strong>{peer.name}</strong><time dateTime={new Date(thread.lastMessage.createdAt).toISOString()}>{dateText(thread.lastMessage.createdAt)}</time></span><span className="comm-message-preview">{thread.lastMessage.senderId === expectedSelfId && "Anda: "}{preview(thread.lastMessage)}</span><span className="comm-list-bottom"><small>{communicationRole(peer.role)}</small>{thread.unread > 0 && <b aria-label={`${thread.unread} pesan belum dibaca`}>{thread.unread}</b>}</span></span>
            </button>;
          }) : filteredMail.map((message) => {
            const peer = resolveContact(folder === "sent" ? message.recipientId : message.senderId);
            return <button type="button" key={message.id} className={`comm-list-item ${selection?.peerId === peer.id ? "is-selected" : ""} ${folder === "inbox" && !message.readAt ? "is-unread" : ""}`} onClick={() => setSelection({ peerId: peer.id, kind: "mail" })} aria-pressed={selection?.peerId === peer.id}>
              <ContactAvatar contact={peer} /><span className="comm-list-copy"><span className="comm-list-item-top"><strong>{peer.name}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{dateText(message.createdAt)}</time></span><span className="comm-message-subject">{message.subject || "Tanpa subjek"}</span><span className="comm-message-preview">{preview(message)}</span>{folder === "inbox" && !message.readAt && <span className="comm-unread-label">Belum dibaca</span>}</span>
            </button>;
          })}
          {hasMore && folder !== "chat" && <button className="comm-load-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Memuat…" : "Pesan sebelumnya"}</button>}
        </div>
      </aside>
      <section className="comm-thread-panel" aria-label="Percakapan">
        {selection && activeContact ? <Conversation key={`${selection.kind}:${selection.peerId}`} selfId={expectedSelfId} peer={activeContact} kind={selection.kind} presenceKnown={presenceKnown} onBack={() => setSelection(null)} onChanged={refresh} /> : <div className="comm-welcome"><div className="comm-welcome-art"><MessageCircle size={46} /><span><Users size={23} /></span></div><h2>Percakapan baik dimulai<br />dengan sebuah sapaan.</h2><p>Kirim pesan, rekam pesan suara, atau hubungi anggota komunitas melalui panggilan suara dan video.</p><button className="comm-primary-button" type="button" onClick={() => setContactsOpen(true)} disabled={!identityReady}><Users size={17} />Temukan kontak</button><small>Pesan tersimpan di akun Anda.</small></div>}
      </section>
    </div>
    <ContactsDialog open={contactsOpen} onOpenChange={setContactsOpen} contacts={contacts} presenceKnown={presenceKnown} onChoose={openChat} />
    <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} contacts={contacts} onSent={(peerId) => { mailHistoryExpanded.current = false; setFolder("sent"); setMail([]); setSelection({ peerId, kind: "mail" }); refresh(); }} />
  </div>;
}

function Conversation({ selfId, peer, kind, presenceKnown, onBack, onChanged }: { selfId: string; peer: CommunicationContact; kind: CommunicationKind; presenceKnown: boolean; onBack: () => void; onChanged: () => void }) {
  const calls = useCalls();
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const historyExpanded = useRef(false);
  const readThrough = useRef(0);
  const request = useRef<{ payload: string; requestId: string } | undefined>(undefined);
  const voicePending = useRef(new Map<Blob, { attachmentId: string; requestId: string }>());
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    const controller = new AbortController(); let running = false;
    const fetchMessages = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const response = await communicationsApi.messages(peer.id, kind, undefined, controller.signal);
        if (!controller.signal.aborted) { setMessages((previous) => mergeCommunicationMessages(previous, response.messages)); if (!historyExpanded.current) setHasMore(response.hasMore); setError(""); }
      } catch (cause) { if (!controller.signal.aborted) setError(communicationError(cause)); }
      finally { running = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void fetchMessages();
    const timer = window.setInterval(fetchMessages, 4_000);
    document.addEventListener("visibilitychange", fetchMessages);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", fetchMessages); };
  }, [peer.id, kind, revision]);

  useEffect(() => {
    if (nearBottom.current) end.current?.scrollIntoView({ block: "nearest" });
    const latest = messages.filter((message) => message.senderId !== selfId).at(-1)?.createdAt ?? 0;
    if (latest > readThrough.current && document.visibilityState !== "hidden") {
      void communicationsApi.read(peer.id, kind, latest).then(() => {
        if (active.current) { readThrough.current = latest; onChanged(); }
      }).catch(() => undefined);
    }
  }, [messages, selfId, peer.id, kind, onChanged]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || sending) return;
    const body = draft.trim();
    const lastSubject = [...messages].reverse().find((message) => message.subject)?.subject;
    const subject = kind === "mail" ? (lastSubject?.startsWith("Re:") ? lastSubject : `Re: ${lastSubject || "Percakapan"}`).slice(0, 160) : undefined;
    const payload = JSON.stringify({ peerId: peer.id, kind, body, subject });
    if (request.current?.payload !== payload) request.current = { payload, requestId: crypto.randomUUID() };
    setSending(true); setError("");
    try {
      const response = await communicationsApi.send({ requestId: request.current.requestId, peerId: peer.id, kind, body, subject });
      if (!active.current) return;
      nearBottom.current = true; setMessages((previous) => mergeCommunicationMessages(previous, [response.message])); setDraft(""); request.current = undefined; onChanged();
    } catch (cause) { if (active.current) setError(communicationError(cause)); }
    finally { if (active.current) setSending(false); }
  };
  const sendVoice = async (blob: Blob, durationSeconds: number) => {
    let pending = voicePending.current.get(blob);
    if (!pending) {
      const result = await communicationsApi.uploadVoice(blob, durationSeconds);
      pending = { attachmentId: result.attachment.id, requestId: crypto.randomUUID() }; voicePending.current.set(blob, pending);
    }
    const response = await communicationsApi.send({ ...pending, peerId: peer.id, kind, body: "" });
    if (active.current) { nearBottom.current = true; setMessages((previous) => mergeCommunicationMessages(previous, [response.message])); voicePending.current.delete(blob); onChanged(); }
  };
  const earlier = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true); const previousHeight = scroll.current?.scrollHeight ?? 0;
    try {
      const response = await communicationsApi.messages(peer.id, kind, messages[0].createdAt);
      if (!active.current) return;
      historyExpanded.current = true;
      nearBottom.current = false; setMessages((previous) => mergeCommunicationMessages(previous, response.messages)); setHasMore(response.hasMore);
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop += scroll.current.scrollHeight - previousHeight; });
    } catch (cause) { if (active.current) setError(communicationError(cause)); }
    finally { if (active.current) setLoadingMore(false); }
  };

  return <>
    <header className="comm-thread-header"><button type="button" className="comm-thread-back" onClick={onBack} aria-label="Kembali ke daftar pesan"><ArrowLeft size={20} /></button><ContactAvatar contact={peer} showOnline={presenceKnown} /><div className="comm-thread-person"><h2>{peer.name}</h2><Status contact={peer} known={presenceKnown} /></div><CallButtons peerId={peer.id} peerName={peer.name} /></header>
    <div className="comm-message-scroll" ref={scroll} role="log" aria-label={`Percakapan dengan ${peer.name}`} aria-live="polite" aria-relevant="additions" onScroll={() => { const element = scroll.current; if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90; }}>
      {hasMore && <button className="comm-load-more" type="button" disabled={loadingMore} onClick={() => void earlier()}>{loadingMore ? "Memuat…" : "Muat pesan sebelumnya"}</button>}
      {loading ? <div className="comm-list-state"><LoaderCircle className="animate-spin" /><p>Memuat percakapan…</p></div> : !messages.length && <div className="comm-thread-empty"><MessageCircle size={27} /><p>Sapa {peer.name} untuk memulai percakapan.</p></div>}
      {messages.map((message, index) => {
        const mine = message.senderId === selfId;
        const day = dateText(message.createdAt);
        const newDay = index === 0 || dateText(messages[index - 1].createdAt) !== day;
        return <div key={message.id}>{newDay && <div className="comm-day-label"><span>{new Date(message.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>}<article className={`comm-message ${mine ? "is-mine" : ""}`} aria-label={`${mine ? "Anda" : peer.name}, ${timeText(message.createdAt)}`}><div className="comm-bubble">
          {message.subject && <h3>{message.subject}</h3>}{message.body && <p>{message.body}</p>}
          {message.attachment && <MessageAudio src={message.attachment.url} senderName={mine ? "Anda" : peer.name} />}
          <footer><time dateTime={new Date(message.createdAt).toISOString()}>{timeText(message.createdAt)}</time>{mine && <span title={message.readAt ? "Sudah dibaca" : "Terkirim"} aria-label={message.readAt ? "Sudah dibaca" : "Terkirim"}>{message.readAt ? <CheckCheck size={15} /> : <Check size={15} />}</span>}</footer>
        </div></article></div>;
      })}<div ref={end} />
    </div>
    {error && <div className="comm-error comm-thread-error" role="alert">{error}<button type="button" onClick={() => setRevision((value) => value + 1)}>Coba muat lagi</button></div>}
    <form className="comm-composer" onSubmit={(event) => void send(event)}>
      <label className="sr-only" htmlFor="comm-reply">{kind === "mail" ? "Tulis balasan" : "Tulis pesan"}</label>
      <textarea id="comm-reply" placeholder={kind === "mail" ? "Tulis balasan pesan…" : "Tulis pesan…"} value={draft} disabled={sending} maxLength={kind === "mail" ? 20000 : 4000} rows={2} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void send(); }} />
      <div className="comm-composer-actions"><VoiceRecorder key={`${kind}:${peer.id}`} onSend={sendVoice} disabled={sending || calls.active} /><span className="comm-keyboard-hint">Ctrl + Enter untuk mengirim</span><button className="comm-primary-button" type="submit" disabled={sending || !draft.trim()}>{sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}<span>{sending ? "Mengirim…" : "Kirim"}</span></button></div>
    </form>
  </>;
}

function ContactsDialog({ open, onOpenChange, contacts, presenceKnown, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; contacts: CommunicationContact[]; presenceKnown: boolean; onChoose: (contact: CommunicationContact) => void }) {
  const [query, setQuery] = useState("");
  const filtered = contacts.filter((contact) => `${contact.name} ${communicationRole(contact.role)}`.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID"))).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "id-ID"));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent data-tradisi="silent" className="comm-dialog"><DialogHeader><DialogTitle>Kontak komunitas</DialogTitle><DialogDescription>Pilih akun untuk memulai percakapan.</DialogDescription></DialogHeader><div className="comm-search"><Search size={17} /><input placeholder="Cari nama atau peran…" aria-label="Cari kontak komunitas" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="comm-contact-list">{filtered.map((contact) => <button type="button" key={contact.id} onClick={() => onChoose(contact)}><ContactAvatar contact={contact} showOnline={presenceKnown} /><span><strong>{contact.name}</strong><small>{communicationRole(contact.role)}</small><Status contact={contact} known={presenceKnown} /></span><ChevronRight size={17} /></button>)}{!filtered.length && <p className="comm-list-state">Kontak tidak ditemukan.</p>}</div></DialogContent></Dialog>;
}

function ComposeDialog({ open, onOpenChange, contacts, onSent }: { open: boolean; onOpenChange: (value: boolean) => void; contacts: CommunicationContact[]; onSent: (peerId: string) => void }) {
  const [peerId, setPeerId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ payload: string; requestId: string } | undefined>(undefined);
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!peerId || !body.trim() || sending) return;
    const payload = JSON.stringify({ peerId, subject: subject.trim(), body: body.trim() });
    if (request.current?.payload !== payload) request.current = { payload, requestId: crypto.randomUUID() };
    setSending(true); setError("");
    try {
      await communicationsApi.send({ peerId, kind: "mail", subject: subject.trim(), body: body.trim(), requestId: request.current.requestId });
      onSent(peerId); onOpenChange(false); setPeerId(""); setSubject(""); setBody(""); request.current = undefined;
    } catch (cause) { setError(communicationError(cause)); }
    finally { setSending(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !sending && onOpenChange(value)}><DialogContent data-tradisi="silent" className="comm-dialog comm-compose-dialog" onEscapeKeyDown={(event) => sending && event.preventDefault()} onPointerDownOutside={(event) => sending && event.preventDefault()}><DialogHeader><DialogTitle>Tulis pesan baru</DialogTitle><DialogDescription>Sampaikan informasi kepada akun komunitas yang Anda pilih.</DialogDescription></DialogHeader><form onSubmit={(event) => void send(event)}><label htmlFor="comm-recipient">Kepada</label><select id="comm-recipient" required value={peerId} onChange={(event) => setPeerId(event.target.value)} disabled={sending}><option value="">Pilih penerima</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} — {communicationRole(contact.role)}</option>)}</select><label htmlFor="comm-subject">Subjek</label><input id="comm-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} placeholder="Contoh: Undangan latihan bersama" disabled={sending} /><label htmlFor="comm-body">Pesan</label><textarea id="comm-body" required value={body} onChange={(event) => setBody(event.target.value)} maxLength={20000} rows={7} placeholder="Tulis pesan Anda…" disabled={sending} />{error && <p className="comm-inline-error" role="alert">{error}</p>}<footer><Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>Batal</Button><button className="comm-primary-button" type="submit" disabled={sending || !peerId || !body.trim()}>{sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}{sending ? "Mengirim…" : "Kirim pesan"}</button></footer></form></DialogContent></Dialog>;
}
