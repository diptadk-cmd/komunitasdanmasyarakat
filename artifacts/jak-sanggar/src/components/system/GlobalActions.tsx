import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/lib/types";
import { buildNotices } from "@/lib/global-notices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCircle2, ChevronRight, Command, Search, Sparkles } from "lucide-react";

export interface GlobalNavItem {
  label: string;
  href: string;
  icon: ReactNode;
  children?: GlobalNavItem[];
}



export function GlobalActions({
  nav,
  role,
  user,
  db,
  navigate,
  translate,
}: {
  nav: GlobalNavItem[];
  role: Role;
  user: any;
  db: any;
  navigate: (href: string) => void;
  translate: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const commands = useMemo(() => {
    const rows: { label: string; href: string; icon: ReactNode; group: string }[] = [];
    nav.forEach((item) => {
      rows.push({ label: item.label, href: item.href, icon: item.icon, group: "Menu Utama" });
      item.children?.forEach((child) => rows.push({ label: child.label, href: child.href, icon: child.icon, group: item.label }));
    });
    return rows;
  }, [nav]);

  const filtered = commands.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(query.toLowerCase()));
  const notices = buildNotices(role, user, db);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    navigate(href);
  };

  return (
    <>
      <button
        type="button"
        data-tradisi="silent"
        onClick={() => setOpen(true)}
        className="hidden 2xl:flex h-9 min-w-[190px] items-center gap-2 rounded-md border border-border/70 bg-muted/35 px-3 text-xs text-muted-foreground transition-colors hover:border-accent/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={translate("Cari menu dan perintah")}
        data-testid="button-global-command"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Cari menu...</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
      </button>

      <button
        type="button"
        data-tradisi="silent"
        onClick={() => setOpen(true)}
        className="2xl:hidden h-9 w-9 grid place-items-center rounded-md hover:bg-muted transition-colors text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={translate("Cari menu dan perintah")}
        title="Cari menu (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-tradisi="silent"
            className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-muted transition-colors text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label={translate("Notifikasi")}
            title={translate("Notifikasi")}
          >
            <Bell className="h-4 w-4" />
            {notices.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{Math.min(notices.length, 9)}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div><div className="font-medium">Pusat Notifikasi</div><div className="text-xs text-muted-foreground">Tindakan yang memerlukan perhatian</div></div>
            <Badge variant={notices.length ? "secondary" : "outline"}>{notices.length}</Badge>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {notices.length === 0 ? (
              <div className="grid place-items-center px-6 py-10 text-center"><CheckCircle2 className="h-9 w-9 text-emerald-500" /><div className="mt-3 text-sm font-medium">Semua terkendali</div><p className="mt-1 text-xs text-muted-foreground">Belum ada tindakan mendesak.</p></div>
            ) : notices.map((notice) => (
              <button
                key={notice.id}
                type="button"
                disabled={!notice.href}
                onClick={() => notice.href && navigate(notice.href)}
                className="group w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/70 disabled:cursor-default"
              >
                <div className="flex gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notice.important ? "bg-destructive" : "bg-amber-500"}`} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium">{notice.title}</div><div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{notice.detail}</div></div>
                  {notice.href && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                </div>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-3 text-xs font-medium text-accent-foreground hover:bg-muted/50"><Sparkles className="h-3.5 w-3.5" />Buka pencarian perintah</button>
        </PopoverContent>
      </Popover>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2"><Command className="h-4 w-4 text-accent" />Pencarian & Perintah Cepat</DialogTitle>
            <DialogDescription>Buka modul tanpa menelusuri menu satu per satu.</DialogDescription>
          </DialogHeader>
          <div className="border-b border-border p-3"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ketik nama menu, contoh: dokumen, kas, kurasi..." /></div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">Tidak ada menu yang cocok.</div>
            ) : filtered.map((item) => (
              <button key={`${item.group}-${item.href}`} type="button" onClick={() => go(item.href)} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground group-hover:border-accent/40 group-hover:text-accent">{item.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted-foreground">{item.group}</span></span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground"><span>Enter untuk membuka menu</span><span>Esc untuk menutup</span></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
