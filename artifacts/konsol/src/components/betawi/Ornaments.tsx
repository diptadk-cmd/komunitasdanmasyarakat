import { useMemo } from "react";
import tumpalImg from "@/assets/brand/ornament-tumpal.png";
import pucukRebungImg from "@/assets/brand/ornament-pucuk-rebung.png";
import ondelOndelImg from "@/assets/brand/ornament-ondel-ondel.png";
import batikCornerImg from "@/assets/brand/ornament-batik-corner.png";

export function TumpalSpinner({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`tumpal-spinner inline-block ${className}`} style={{ width: size, height: size }}>
      <img
        src={tumpalImg}
        alt=""
        aria-hidden
        draggable={false}
        width={size}
        height={size}
        className="object-contain select-none"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export function PucukRebungDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`} aria-hidden>
      <img src={pucukRebungImg} alt="" draggable={false} className="h-6 w-auto max-w-full select-none" />
    </div>
  );
}

export function OndelOndelSilhouette({ className = "", color }: { className?: string; color?: string }) {
  void color;
  return (
    <img src={ondelOndelImg} alt="" aria-hidden draggable={false} className={`object-contain select-none ${className}`} />
  );
}

interface DustOptions { count?: number; className?: string }
export function GoldDustField({ count = 26, className = "" }: DustOptions) {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = 1 + Math.random() * 3.2;
      return {
        id: i,
        left: Math.random() * 100,
        size,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 10,
        opacity: 0.3 + Math.random() * 0.6,
      };
    });
  }, [count]);
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {particles.map(p => (
        <span
          key={p.id}
          className="gold-dust-particle absolute"
          style={{
            left: `${p.left}%`,
            bottom: `-10px`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

export function BatikCorner({ className = "" }: { className?: string }) {
  return (
    <img src={batikCornerImg} alt="" aria-hidden draggable={false} className={`object-contain select-none ${className}`} />
  );
}
