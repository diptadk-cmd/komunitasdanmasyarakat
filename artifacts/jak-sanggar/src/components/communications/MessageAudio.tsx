import { useEffect, useState } from "react";
import { apiTabSessionEnabled, TAB_SESSION_TOKEN_KEY } from "@workspace/jaksanggar-core/api";

/** Native media requests use cookies; per-tab QA sessions need an authenticated blob. */
export function MessageAudio({ src, senderName }: { src: string; senderName: string }) {
  const perTab = apiTabSessionEnabled();
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setError(false);
    if (!perTab) return;
    const controller = new AbortController(); let created = "";
    setObjectUrl("");
    void (async () => {
      const target = new URL(src, window.location.origin);
      if (target.origin !== window.location.origin || !target.pathname.startsWith("/api/communications/attachments/")) throw new Error("Sumber audio tidak valid");
      const token = sessionStorage.getItem(TAB_SESSION_TOKEN_KEY);
      const headers = new Headers();
      if (token) headers.set("authorization", `Bearer ${token}`);
      const response = await fetch(target.href, { credentials: "omit", headers, signal: controller.signal });
      if (!response.ok) throw new Error("Audio belum dapat dimuat");
      const blob = await response.blob();
      if (!controller.signal.aborted) { created = URL.createObjectURL(blob); setObjectUrl(created); }
    })().catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (created) URL.revokeObjectURL(created); };
  }, [src, perTab, retry]);
  if (error) return <div className="comm-audio-error" role="status">Audio belum dapat diputar. <button type="button" onClick={() => setRetry((value) => value + 1)}>Coba lagi</button></div>;
  if (perTab && !objectUrl) return <span className="comm-audio-loading">Memuat pesan suara…</span>;
  return <audio key={`${src}:${retry}`} controls preload="none" src={perTab ? objectUrl : src} aria-label={`Pesan suara dari ${senderName}`} onError={() => setError(true)} />;
}
