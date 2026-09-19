import type { SanggarUser } from "./types";

type CoverProfile = Pick<SanggarUser, "fotoSampulDataUrl" | "fotoGaleri" | "fotoProfileDataUrl">;

export interface SanggarCoverCandidate {
  src: string;
  kind: "photo" | "illustration";
}

/** An empty saved cover is intentional: do not restore a legacy gallery photo. */
export function sanggarCoverCandidates(profile: CoverProfile, fallbackSrc: string): SanggarCoverCandidate[] {
  const photos = profile.fotoSampulDataUrl === undefined
    ? [...(profile.fotoGaleri ?? []).map((item) => item.dataUrl), profile.fotoProfileDataUrl]
    : [profile.fotoSampulDataUrl];
  const seen = new Set<string>();
  const candidates: SanggarCoverCandidate[] = [];
  for (const value of photos) {
    const src = typeof value === "string" ? value.trim() : "";
    if (src && !seen.has(src)) {
      seen.add(src);
      candidates.push({ src, kind: "photo" });
    }
  }
  if (fallbackSrc.trim() && !seen.has(fallbackSrc)) {
    candidates.push({ src: fallbackSrc, kind: "illustration" });
  }
  return candidates;
}

export function selectSanggarCover(
  candidates: readonly SanggarCoverCandidate[],
  failedSources: ReadonlySet<string> = new Set(),
): SanggarCoverCandidate | undefined {
  return candidates.find((candidate) => !failedSources.has(candidate.src));
}
