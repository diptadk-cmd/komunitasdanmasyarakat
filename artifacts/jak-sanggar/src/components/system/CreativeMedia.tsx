import {
  ExternalLink,
  Image as ImageIcon,
  Music2,
  PlayCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InfoBudaya, InfoBudayaMediaKind } from "@/lib/types";

type MediaKind = InfoBudayaMediaKind;

export type MediaPlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "blocked"
  | "ended"
  | "error";

function parseUrl(value?: string) {
  if (!value) return null;
  try {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost";
    const url = new URL(value.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function safeMediaValue(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^data:(?:audio|video|image)\//i.test(trimmed)) return trimmed;
  return parseUrl(trimmed)?.toString();
}

function youtubeVideoId(value?: string) {
  const url = parseUrl(value);
  if (!url) return null;

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  let id = "";
  if (host === "youtu.be")
    id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  ) {
    if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
    else
      id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? "";
  }
  return /^[\w-]{6,}$/.test(id) ? id : null;
}

function youtubeEmbedUrl(
  value?: string,
  {
    autoplay = false,
    muted = true,
  }: { autoplay?: boolean; muted?: boolean } = {},
) {
  const videoId = youtubeVideoId(value);
  if (!videoId) return null;
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    playsinline: "1",
    rel: "0",
    mute: muted ? "1" : "0",
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function spotifyEmbedUrl(value?: string) {
  const url = parseUrl(value);
  if (!url || url.hostname.replace(/^www\./, "") !== "open.spotify.com")
    return null;
  const match = url.pathname.match(
    /^\/(track|episode|album|playlist|show)\/([^/?]+)/,
  );
  return match
    ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`
    : null;
}

function soundCloudEmbedUrl(value?: string, autoplay = false) {
  const url = parseUrl(value);
  const host = url?.hostname.toLowerCase();
  if (
    !url ||
    !host ||
    (host !== "soundcloud.com" && !host.endsWith(".soundcloud.com"))
  )
    return null;
  const params = new URLSearchParams({
    url: url.toString(),
    auto_play: autoplay ? "true" : "false",
    hide_related: "true",
    show_comments: "false",
    show_reposts: "false",
    visual: "true",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

function extension(value?: string) {
  if (!value) return "";
  if (value.startsWith("data:audio/")) return "audio";
  if (value.startsWith("data:video/")) return "video";
  if (value.startsWith("data:image/")) return "image";
  const url = parseUrl(value);
  return url?.pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function creativeMediaKind(item: InfoBudaya): MediaKind {
  const value = safeMediaValue(item.mediaUrl);
  if (youtubeVideoId(value)) return "youtube";
  if (spotifyEmbedUrl(value)) return "spotify";
  if (soundCloudEmbedUrl(value)) return "soundcloud";

  const contentType = item.mediaContentType?.toLowerCase();
  if (contentType?.startsWith("audio/")) return "audio";
  if (contentType?.startsWith("video/")) return "video";
  if (contentType?.startsWith("image/")) return "image";

  if (item.mediaKind) return item.mediaKind;

  const ext = extension(value);
  if (["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "audio"].includes(ext))
    return "audio";
  if (["mp4", "webm", "ogv", "mov", "m4v", "video"].includes(ext))
    return "video";
  if (
    ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg", "image"].includes(ext)
  )
    return "image";
  if (value) return "link";
  return "image";
}

interface Props {
  item: InfoBudaya;
  autoplay?: boolean;
  muted?: boolean;
  onEnded?: () => void;
  onPlaybackStateChange?: (state: MediaPlaybackState) => void;
  className?: string;
}

export function CreativeMediaPlayer({
  item,
  autoplay = false,
  muted = autoplay,
  onEnded,
  onPlaybackStateChange,
  className = "",
}: Props) {
  const value = safeMediaValue(item.mediaUrl);
  const poster = item.imageDataUrl || item.imageUrl;
  const kind = creativeMediaKind(item);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [playbackState, setPlaybackState] =
    useState<MediaPlaybackState>("idle");
  const [failed, setFailed] = useState(false);

  const reportState = useCallback(
    (state: MediaPlaybackState) => {
      setPlaybackState(state);
      onPlaybackStateChange?.(state);
    },
    [onPlaybackStateChange],
  );

  useEffect(() => {
    setFailed(false);
    if (!value || kind === "image") {
      reportState("idle");
      return;
    }
    if (kind === "link") {
      reportState("ready");
      return;
    }
    reportState("loading");
  }, [kind, reportState, value]);

  useEffect(() => {
    if ((kind !== "audio" && kind !== "video") || !value) return;
    const media = mediaRef.current;
    if (!media) return;
    media.muted = muted;

    if (!autoplay) {
      media.pause();
      reportState("paused");
      return;
    }

    const attempt = media.play();
    if (!attempt) return;
    void attempt
      .then(() => reportState("playing"))
      .catch((error: unknown) => {
        const name =
          typeof error === "object" && error && "name" in error
            ? String(error.name)
            : "";
        if (name === "AbortError") return;
        reportState(name === "NotAllowedError" ? "blocked" : "error");
      });
  }, [autoplay, kind, muted, reportState, value]);

  const failMedia = () => {
    setFailed(true);
    reportState("error");
  };

  const retryPlayback = async () => {
    const media = mediaRef.current;
    if (!media) return;
    try {
      await media.play();
      reportState("playing");
    } catch {
      reportState("blocked");
    }
  };

  if (failed) {
    return (
      <div
        role="alert"
        className={`grid h-full min-h-48 w-full place-items-center bg-[#082c1d] px-5 text-center text-white ${className}`}
      >
        <div>
          <PlayCircle className="mx-auto h-8 w-8 text-amber-200" />
          <p className="mt-2 text-sm font-semibold">Media gagal dimuat</p>
          <p className="mt-1 text-xs text-white/70">
            Periksa berkas atau tautan media yang dipublikasikan.
          </p>
        </div>
      </div>
    );
  }

  if (kind === "youtube" && value) {
    return (
      <iframe
        src={youtubeEmbedUrl(value, { autoplay, muted }) ?? undefined}
        title={`YouTube ${item.judul}`}
        className={`h-full min-h-48 w-full border-0 bg-black ${className}`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="eager"
        onLoad={() => reportState(autoplay ? "playing" : "ready")}
        onError={failMedia}
      />
    );
  }

  if (kind === "spotify") {
    return (
      <iframe
        src={spotifyEmbedUrl(value) ?? undefined}
        title={`Spotify ${item.judul}`}
        className={`h-full min-h-40 w-full border-0 ${className}`}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="eager"
        onLoad={() => reportState("ready")}
        onError={failMedia}
      />
    );
  }

  if (kind === "soundcloud") {
    return (
      <iframe
        src={soundCloudEmbedUrl(value, autoplay) ?? undefined}
        title={`SoundCloud ${item.judul}`}
        className={`h-full min-h-40 w-full border-0 ${className}`}
        allow="autoplay"
        loading="eager"
        onLoad={() => reportState("ready")}
        onError={failMedia}
      />
    );
  }

  if (kind === "audio" && value) {
    return (
      <div
        className={`relative flex h-full min-h-48 w-full items-end overflow-hidden bg-[#082c1d] ${className}`}
        style={
          poster
            ? {
                backgroundImage: `url(${poster})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#041b12]/95 via-[#073522]/75 to-[#073522]/30" />
        <div className="relative w-full p-5 text-white">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
              <Music2 className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                Audio budaya
              </div>
              <div className="mt-0.5 font-semibold">{item.judul}</div>
            </div>
          </div>
          <audio
            ref={(element) => {
              mediaRef.current = element;
            }}
            key={value}
            src={value}
            controls
            autoPlay={autoplay}
            muted={muted}
            onCanPlay={() => {
              if (!autoplay) reportState("ready");
            }}
            onPlay={() => reportState("playing")}
            onPause={(event) => {
              if (!event.currentTarget.ended) reportState("paused");
            }}
            onWaiting={() => reportState("loading")}
            onEnded={() => {
              reportState("ended");
              onEnded?.();
            }}
            onError={failMedia}
            preload="metadata"
            className="h-11 w-full"
          />
          {playbackState === "blocked" && (
            <button
              type="button"
              onClick={() => void retryPlayback()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Klik untuk memutar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (kind === "video" && value) {
    return (
      <div className={`relative h-full w-full bg-black ${className}`}>
        <video
          ref={(element) => {
            mediaRef.current = element;
          }}
          key={value}
          src={value}
          poster={poster}
          controls
          autoPlay={autoplay}
          muted={muted}
          onCanPlay={() => {
            if (!autoplay) reportState("ready");
          }}
          onPlay={() => reportState("playing")}
          onPause={(event) => {
            if (!event.currentTarget.ended) reportState("paused");
          }}
          onWaiting={() => reportState("loading")}
          onEnded={() => {
            reportState("ended");
            onEnded?.();
          }}
          onError={failMedia}
          playsInline
          preload="metadata"
          className="h-full w-full bg-black object-contain"
        />
        {playbackState === "blocked" && (
          <button
            type="button"
            onClick={() => void retryPlayback()}
            className="absolute inset-0 m-auto grid h-16 w-32 place-items-center rounded-xl border border-white/30 bg-black/65 px-3 text-xs font-semibold text-white backdrop-blur-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle className="h-4 w-4" /> Putar media
            </span>
          </button>
        )}
      </div>
    );
  }

  if (kind === "link" && value) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer noopener"
        className={`group relative grid h-full min-h-48 w-full place-items-center overflow-hidden bg-[#082c1d] text-white ${className}`}
        style={
          poster
            ? {
                backgroundImage: `url(${poster})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-[#041b12]/70 transition group-hover:bg-[#041b12]/60" />
        <span className="relative inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
          <ExternalLink className="h-4 w-4" /> Buka media
        </span>
      </a>
    );
  }

  if (poster || value) {
    return (
      <div
        className={`relative h-full w-full overflow-hidden bg-gradient-to-br from-[#0a442c] to-[#6d2b20] ${className}`}
      >
        <div className="absolute inset-0 grid place-items-center px-5 text-center text-amber-50">
          <div>
            <ImageIcon className="mx-auto h-8 w-8 opacity-80" />
            <p className="mt-2 text-sm font-medium">{item.judul}</p>
          </div>
        </div>
        <img
          src={value || poster}
          alt={item.judul}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            reportState("error");
          }}
          className="relative h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`grid h-full min-h-48 w-full place-items-center bg-gradient-to-br from-[#0a442c] to-[#6d2b20] text-amber-50 ${className}`}
    >
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10">
          {item.kategori === "Musik" ? (
            <Music2 className="h-7 w-7" />
          ) : item.kategori === "Tari" || item.kategori === "Teater" ? (
            <PlayCircle className="h-7 w-7" />
          ) : (
            <ImageIcon className="h-7 w-7" />
          )}
        </span>
        <p className="mt-3 text-sm font-medium">Media belum ditambahkan</p>
      </div>
    </div>
  );
}
