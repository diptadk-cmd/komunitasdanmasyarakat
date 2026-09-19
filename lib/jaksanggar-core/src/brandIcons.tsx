import {
  Sparkles,
  Crown,
  Star,
  Sun,
  Moon,
  Flame,
  Award,
  Compass,
  Feather,
  Landmark,
  Theater,
  Gem,
  Music2,
  Palette,
  BookOpen,
  Drum,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type BrandIconProps = SVGProps<SVGSVGElement>;

function BrandIconFrame({ children, ...props }: BrandIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Community members gathered around a small Jakarta monument. */
export function KomunitasJak(props: BrandIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="m12 2.5 1.5 2.5L12 6.5 10.5 5 12 2.5Z" />
      <path d="M10 8h4m-3 0-.5 9h3L13 8" />
      <circle cx="5" cy="10.5" r="2" />
      <circle cx="19" cy="10.5" r="2" />
      <path d="M2 20v-3a3 3 0 0 1 3-3l3 4m14 2v-3a3 3 0 0 0-3-3l-3 4M5 20c4 2 10 2 14 0" />
    </BrandIconFrame>
  );
}

/** A simple Betawi ondel-ondel face and its decorative crown. */
export function OndelOndel(props: BrandIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="m6 7-2-4 5 2 3-3 3 3 5-2-2 4M7 8h10v6a5 5 0 0 1-10 0V8Z" />
      <path d="M9.5 11.5h.01m4.98 0h.01M10 15c1.3 1.3 2.7 1.3 4 0M4 22c1.5-2 4-3 8-3s6.5 1 8 3" />
    </BrandIconFrame>
  );
}

/** The growing triangular bamboo-shoot motif used in Betawi ornament. */
export function PucukRebung(props: BrandIconProps) {
  return (
    <BrandIconFrame {...props}>
      <path d="M3 21 12 3l9 18H3Z" />
      <path d="m7 17 5-5 5 5m-8 3 3-3 3 3M12 7v14" />
    </BrandIconFrame>
  );
}

export const BRAND_ICONS: Record<
  string,
  ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
> = {
  Sparkles,
  Crown,
  Star,
  Sun,
  Moon,
  Flame,
  Award,
  Compass,
  Feather,
  Landmark,
  Theater,
  Gem,
  Music2,
  Palette,
  BookOpen,
  Drum,
  KomunitasJak,
  OndelOndel,
  PucukRebung,
};

export const BRAND_ICON_KEYS: { key: string; label: string }[] = [
  { key: "Sparkles", label: "Kilau" },
  { key: "Crown", label: "Mahkota" },
  { key: "Star", label: "Bintang" },
  { key: "Sun", label: "Matahari" },
  { key: "Moon", label: "Bulan" },
  { key: "Flame", label: "Api" },
  { key: "Award", label: "Penghargaan" },
  { key: "Compass", label: "Kompas" },
  { key: "Feather", label: "Bulu Pena" },
  { key: "Landmark", label: "Tugu" },
  { key: "Theater", label: "Teater" },
  { key: "Gem", label: "Permata" },
  { key: "Music2", label: "Musik" },
  { key: "Palette", label: "Palet" },
  { key: "BookOpen", label: "Buku" },
  { key: "Drum", label: "Gendang" },
  { key: "KomunitasJak", label: "Komunitas Jakarta" },
  { key: "OndelOndel", label: "Ondel-ondel Betawi" },
  { key: "PucukRebung", label: "Pucuk rebung" },
];

export function getBrandIcon(key: string | undefined) {
  return BRAND_ICONS[key ?? "Sparkles"] ?? Sparkles;
}
