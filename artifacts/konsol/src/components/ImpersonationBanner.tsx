import { ExternalLink, LogOut, UserCog } from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { IMPERSONATION_STORAGE_KEY } from "@/lib/store";
import { mainAppUrl } from "@/lib/app-links";

/** Indikator impersonation versi Konsol Kurator.
 *  Di konsol, user tab ini tetap kurator; sesi "Login As" berjalan di app
 *  utama. Banner memberi tahu siapa yang sedang di-impersonate dan
 *  menyediakan tombol buka app utama atau akhiri sesi tersebut. */
export function ImpersonationBanner() {
  const { user, impersonatedFromId, stopImpersonation } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!impersonatedFromId || !user || user.role !== "kurator") return null;
  const raw = (() => {
    try {
      return JSON.parse(localStorage.getItem(IMPERSONATION_STORAGE_KEY) ?? "null") as
        | { impersonatedUserId?: string }
        | null;
    } catch {
      return null;
    }
  })();
  const target = raw?.impersonatedUserId
    ? db.users.find((u) => u.id === raw.impersonatedUserId)
    : undefined;
  if (!target) return null;
  const displayName =
    (target as { namaSanggar?: string; nama?: string }).namaSanggar ??
    (target as { nama?: string }).nama ??
    target.username;
  const handleStop = async () => {
    if (await stopImpersonation()) {
      toast({
        title: "Sesi Login As diakhiri",
        description: `Sesi sebagai ${displayName} (${target.role}) dihentikan.`,
      });
    }
  };
  return (
    <div
      className="sticky top-0 z-40 w-full"
      style={{
        background:
          "linear-gradient(90deg, hsl(42 80% 60%) 0%, hsl(38 65% 42%) 100%)",
        boxShadow: "0 2px 12px hsl(42 75% 50% / 0.4)",
      }}
      data-testid="impersonation-banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 text-xs sm:text-sm font-medium"
          style={{ color: "hsl(150 45% 10%)" }}
        >
          <UserCog className="h-4 w-4 flex-none" />
          <span>
            Mode <strong>Login As</strong> aktif di aplikasi utama sebagai{" "}
            <strong>{displayName}</strong>{" "}
            <span className="opacity-75">[{target.role}]</span>.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={mainAppUrl(`/${target.role}`)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.02]"
            style={{
              background: "hsl(150 45% 18%)",
              color: "hsl(42 80% 70%)",
            }}
            data-testid="link-open-impersonation"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Buka Aplikasi Utama
          </a>
          <button
            type="button"
            onClick={handleStop}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.02]"
            style={{
              background: "hsl(150 45% 10%)",
              color: "hsl(42 80% 70%)",
            }}
            data-testid="button-stop-impersonation"
          >
            <LogOut className="h-3.5 w-3.5" />
            Akhiri Login As
          </button>
        </div>
      </div>
    </div>
  );
}
