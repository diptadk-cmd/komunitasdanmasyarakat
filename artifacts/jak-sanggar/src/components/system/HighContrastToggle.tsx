import { useEffect } from "react";
import { Contrast } from "lucide-react";
import { useDb } from "@/lib/auth";
import { persistAppearance } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export function HighContrastToggle({ className = "" }: { className?: string }) {
  const db = useDb();
  const { toast } = useToast();
  const t = useT();
  const highContrast = !!db.appearance.highContrast;

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  const toggle = () => {
    persistAppearance(ap => { ap.highContrast = !ap.highContrast; }).catch(() => {
      toast({ title: t("Gagal menyimpan Kontras Tinggi ke server"), variant: "destructive" });
    });
  };

  return (
    <button
      type="button"
      data-tradisi="silent"
      data-testid="button-high-contrast-toggle"
      onClick={toggle}
      aria-pressed={highContrast}
      aria-label={t(highContrast ? "Nonaktifkan Kontras Tinggi" : "Aktifkan Kontras Tinggi")}
      title={t(highContrast ? "Kontras Tinggi: Aktif" : "Kontras Tinggi: Nonaktif")}
      className={`h-9 w-9 grid place-items-center rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${highContrast ? "text-accent" : "text-foreground/70 hover:text-foreground"} ${className}`}
    >
      <Contrast className="h-4 w-4" />
    </button>
  );
}
