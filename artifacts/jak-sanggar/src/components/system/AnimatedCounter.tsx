import { useEffect, useRef, useState, type CSSProperties } from "react";

export function AnimatedCounter({
  value,
  duration = 1100,
  format,
  className,
  style,
  decimals = 0,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  style?: CSSProperties;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const animate = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(decimals > 0 ? Number(current.toFixed(decimals)) : Math.round(current));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, decimals]);

  const fmt = format ?? ((n: number) =>
    decimals > 0
      ? n.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toLocaleString("id-ID")
  );

  return <span className={className} style={style}>{fmt(display)}</span>;
}
