import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { GoldDustField, BatikCorner } from "@/components/betawi/Ornaments";

export function PremiumHero({
  eyebrow,
  title,
  subtitle,
  right,
  icon,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card
      className="relative overflow-hidden border-2 border-[hsl(38_55%_50%/0.35)] mb-6"
      style={{
        background: "linear-gradient(135deg, hsl(150 58% 12%) 0%, hsl(150 60% 9%) 50%, hsl(18 60% 20%) 100%)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: "linear-gradient(90deg, transparent, hsl(42 80% 60%), transparent)" }}
      />
      <BatikCorner className="absolute -right-8 -top-8 w-48 h-48 opacity-[0.08] pointer-events-none" />
      <GoldDustField count={20} />
      <div className="relative p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="text-[hsl(45_85%_92%)] min-w-0">
          {eyebrow && (
            <div className="flex items-center gap-2">
              {icon && (
                <div className="h-7 w-7 rounded-md grid place-items-center btn-gold">
                  <div className="text-[hsl(150_55%_12%)]">{icon}</div>
                </div>
              )}
              <span className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: "hsl(42 70% 70%)" }}>
                {eyebrow}
              </span>
            </div>
          )}
          <h2
            className="font-serif text-3xl md:text-4xl font-semibold mt-2 leading-tight"
            style={{
              background: "linear-gradient(135deg, hsl(45 90% 88%), hsl(42 75% 60%) 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm mt-2 max-w-xl" style={{ color: "hsl(45 70% 88%)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="relative shrink-0">{right}</div>}
      </div>
    </Card>
  );
}
