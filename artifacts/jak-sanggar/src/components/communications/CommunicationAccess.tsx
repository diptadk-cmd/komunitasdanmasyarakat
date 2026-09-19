import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { communicationsApi } from "@/lib/communications";

export function CommunicationAccess() {
  const { user, demoMode } = useAuth();
  return <CommunicationAccessForAccount key={user?.apiId ?? user?.id ?? "none"} enabled={Boolean(user?.apiId) && !demoMode} />;
}

function CommunicationAccessForAccount({ enabled }: { enabled: boolean }) {
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const [chat, mail] = await Promise.all([communicationsApi.threads("chat", controller.signal), communicationsApi.threads("mail", controller.signal)]);
        if (!controller.signal.aborted) setUnread([...chat.threads, ...mail.threads].reduce((total, thread) => total + thread.unread, 0));
      } catch {
        if (!controller.signal.aborted) setUnread(null);
      } finally { running = false; }
      if (!controller.signal.aborted) void communicationsApi.presence().catch(() => undefined);
    };
    void refresh();
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener("communications:changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("communications:changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled]);
  const label = unread ? `Pesan, ${unread} belum dibaca` : "Buka pesan dan percakapan";
  return (
    <Link data-tradisi="silent" href="/pesan" aria-label={label} title={label} data-testid="communication-access" className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      {unread !== null && unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#125a49] px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
