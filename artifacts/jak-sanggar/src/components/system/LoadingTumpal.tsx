import { TumpalSpinner } from "@/components/betawi/Ornaments";

export function LoadingTumpal({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="grid place-items-center gap-3 py-6 text-center">
      <TumpalSpinner size={42} />
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  );
}

export function LoadingOverlay({ show, label = "Memproses..." }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/55 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3">
        <TumpalSpinner size={56} />
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
    </div>
  );
}

export function InlineTumpalSpinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <TumpalSpinner size={size} className={className} />;
}
