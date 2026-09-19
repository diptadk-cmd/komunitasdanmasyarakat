import { useState } from "react";
import {
  Check,
  GraduationCap,
  Lightbulb,
  ListOrdered,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { PANTUN_PPKD, SOAL_PPKD, type SoalPpkd } from "@/lib/ppkd-konten";

type Mode = "pantun" | "kuis";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Tile = { line: string; answerIndex: number };

function buildTiles(lines: readonly string[]): Tile[] {
  const tiles = lines.map((line, answerIndex) => ({ line, answerIndex }));
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  // A pre-solved shuffle would let the user pass without reading anything.
  return tiles.every((t, i) => t.answerIndex === i) ? buildTiles(lines) : tiles;
}

export function HumanCheck({
  onVerifiedChange,
}: {
  onVerifiedChange: (verified: boolean) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode | null>(null);
  const [solved, setSolved] = useState(false);
  const [lesson, setLesson] = useState("");

  const succeed = (explanation: string) => {
    setSolved(true);
    setLesson(explanation);
    onVerifiedChange(true);
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    setSolved(false);
    setLesson("");
    onVerifiedChange(false);
  };

  return (
    <div
      className={`rounded-xl border p-2.5 transition-colors ${
        solved
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-muted/30"
      }`}
      data-testid="human-check"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck
          className={`h-4 w-4 shrink-0 ${solved ? "text-emerald-600" : "text-accent"}`}
        />
        <div className="text-sm font-semibold">{t("Verifikasi")}</div>
      </div>

      {!solved && (
        <div className="mt-1 text-[10px] leading-[1.35] text-muted-foreground">
          <p>
            {t(
              "Untuk membuktikan bahwa Anda manusia, jawab pertanyaan berikut:",
            )}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">
            {t("Apakah saudara manusia?")}
          </p>
          <p>{t("Untuk membuktikannya, pilih salah satu:")}</p>
        </div>
      )}

      <div
        className="mt-2 grid grid-cols-2 gap-2"
        role="group"
        aria-label={t("Pilih cara verifikasi")}
      >
        {[
          {
            id: "pantun" as const,
            label: t("Susun Pantun"),
            Icon: ListOrdered,
          },
          {
            id: "kuis" as const,
            label: t("Tebak-tebakan"),
            Icon: GraduationCap,
          },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => chooseMode(id)}
            aria-pressed={mode === id}
            data-testid={`human-check-mode-${id}`}
            className={`flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all ${
              mode === id
                ? "border-[#d8a52a] bg-[#fff7e4] text-[#153227]"
                : "border-[#07552f] bg-[#07552f] text-white hover:bg-[#09683c]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === "pantun" && !solved && (
        <SusunPantun key="pantun" onSolved={succeed} />
      )}
      {mode === "kuis" && !solved && (
        <TebakTebakan key="kuis" onSolved={succeed} />
      )}

      {solved && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> {t("Terverifikasi")}
          </div>
          {lesson && (
            <div className="mt-2 rounded-lg border border-border/70 bg-background/60 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                {t("Tahukah Anda?")}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {lesson}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SusunPantun({ onSolved }: { onSolved: (lesson: string) => void }) {
  const t = useT();
  const [entry, setEntry] = useState(() => pick(PANTUN_PPKD));
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(entry.lines));
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);

  const newRound = () => {
    const next = pick(PANTUN_PPKD);
    setEntry(next);
    setTiles(buildTiles(next.lines));
    setPicked([]);
    setWrong(false);
  };

  const choose = (tileIndex: number) => {
    if (picked.includes(tileIndex)) return;
    const next = [...picked, tileIndex];
    if (next.length !== tiles.length) {
      setPicked(next);
      setWrong(false);
      return;
    }
    if (
      next.every((tileIdx, position) => tiles[tileIdx].answerIndex === position)
    ) {
      onSolved(entry.teaches);
    } else {
      setPicked([]);
      setWrong(true);
    }
  };

  return (
    <>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {t("Ketuk baris sesuai urutan yang benar.")}
        </p>
        <div className="flex shrink-0 gap-1">
          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPicked((p) => p.slice(0, -1));
                setWrong(false);
              }}
              aria-label={t("Ulangi")}
              title={t("Ulangi")}
              className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={newRound}
            aria-label={t("Ganti soal")}
            title={t("Ganti soal")}
            className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {tiles.map((tile, tileIdx) => {
          const position = picked.indexOf(tileIdx);
          const chosen = position >= 0;
          return (
            <button
              key={tile.line}
              type="button"
              onClick={() => choose(tileIdx)}
              disabled={chosen}
              data-testid={`pantun-line-${tileIdx}`}
              className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] leading-snug transition-all ${
                chosen
                  ? "border-accent/50 bg-accent/10 text-muted-foreground"
                  : "border-border bg-background hover:border-accent/60 hover:-translate-y-px"
              }`}
            >
              <span
                className={`shrink-0 h-5 w-5 grid place-items-center rounded-full text-[10px] font-semibold tabular-nums ${
                  chosen
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {chosen ? position + 1 : ""}
              </span>
              <span>{tile.line}</span>
            </button>
          );
        })}
      </div>

      {wrong && (
        <p
          className="mt-2.5 text-[11px] font-medium text-destructive"
          role="alert"
        >
          {t("Urutan belum tepat. Coba lagi.")}
        </p>
      )}
    </>
  );
}

function TebakTebakan({ onSolved }: { onSolved: (lesson: string) => void }) {
  const t = useT();
  const [soal, setSoal] = useState<SoalPpkd>(() => pick(SOAL_PPKD));
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const newRound = () => {
    setSoal(pick(SOAL_PPKD));
    setValue("");
    setWrong(false);
    setShowHint(false);
  };

  // The parent <form> owns submit, so this must stay a click handler, not a nested form.
  const check = () => {
    const guess = normalizeAnswer(value);
    if (!guess) return;
    if (soal.acceptedAnswers.some((a) => normalizeAnswer(a) === guess))
      onSolved(soal.explanation);
    else {
      setWrong(true);
      setShowHint(true);
    }
  };

  return (
    <>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-[13px] leading-snug font-medium">{soal.question}</p>
        <button
          type="button"
          onClick={newRound}
          aria-label={t("Ganti soal")}
          title={t("Ganti soal")}
          className="h-7 w-7 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              check();
            }
          }}
          placeholder={t("Ketik jawaban di sini")}
          aria-label={soal.question}
          data-testid="input-kuis-jawaban"
          className="h-9 text-[13px]"
        />
        <button
          type="button"
          onClick={check}
          disabled={!value.trim()}
          data-testid="button-kuis-periksa"
          className="shrink-0 rounded-md bg-accent px-3 text-[12px] font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("Periksa Jawaban")}
        </button>
      </div>

      {wrong && (
        <p
          className="mt-2 text-[11px] font-medium text-destructive"
          role="alert"
        >
          {t("Jawaban belum tepat. Coba lagi.")}
        </p>
      )}
      {showHint && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span>
            <span className="font-semibold">{t("Petunjuk")}:</span> {soal.hint}
          </span>
        </p>
      )}
    </>
  );
}
