import { useEffect, useState, useMemo } from "react";
import { Link, useRoute } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { load, save, uid, fmtDateTime } from "@/lib/store";
import { juriScoringAccessError } from "@/lib/kurasi-access";
import { persistKurasiScore } from "@/lib/kurasi-sync";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardWelcome, DashboardMetrics } from "@/components/layout/RoleWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/system/AnimatedCounter";
import { LoadingOverlay } from "@/components/system/LoadingTumpal";
import { GoldDustField } from "@/components/betawi/Ornaments";
import type {
  JuriUser,
  PatokanNilaiKurasi,
  SanggarUser,
  Variabel,
} from "@/lib/types";
import {
  naFromScores,
  predikatOf,
  predikatColor,
  predikatBands,
  variabelOf,
  indikatorKontribusi,
  manajemenIndikator,
  nilaiVariabelDariPersyaratan,
  patokanNilaiPersyaratan,
  patokanNilaiVariabel,
  persyaratanBuktiDukungOf,
  createKurasiMatrixSnapshot,
} from "@/lib/kurasi";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Lock,
  FileVideo,
  ClipboardList,
  ChevronRight,
  Save,
  FileText,
} from "lucide-react";

const nilaiSama = (a: number, b: number) => Math.abs(a - b) < 0.000001;

function PatokanScorePicker({
  ariaLabel,
  disabled,
  options,
  selected,
  testIdPrefix,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  options: PatokanNilaiKurasi[];
  selected?: number;
  testIdPrefix: string;
  onChange: (value: number) => void;
}) {
  const sorted = [...options].sort((a, b) => a.nilai - b.nilai);
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {sorted.map((pilihan) => {
        const aktif =
          selected !== undefined &&
          nilaiSama(pilihan.persentaseBobot, selected);
        return (
          <button
            key={pilihan.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            disabled={disabled}
            onClick={() => onChange(pilihan.persentaseBobot)}
            className={`rounded-lg border px-2 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-70 ${
              aktif
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
            }`}
            data-testid={`${testIdPrefix}-${pilihan.nilai}`}
          >
            <span className="block text-lg font-bold tabular-nums">
              {pilihan.nilai}
            </span>
            <span className="block text-xs font-semibold">{pilihan.nama}</span>
            <span
              className={`mt-0.5 block text-[10px] ${
                aktif ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}
            >
              {pilihan.persentaseBobot}% bobot
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function JuriHome() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || user.role !== "juri") return null;
  const j = user as JuriUser;
  const tugas = db.penugasanJuri.filter((p) => p.juriId === j.id);
  const completed = tugas.filter(t => db.kurasiSubmissions.find(s => s.sanggarId === t.sanggarId)?.finalized[j.username]).length;

  return (
    <div className="role-workspace" data-testid="juri-home">
      <DashboardWelcome
        role="Ruang juri"
        title="Tugas Penilaian"
        description={`${j.nama}. Keahlian: ${j.keahlian}.`}
        primary={{ href: "/juri/profil", label: "Profil dan keahlian" }}
      />
      <DashboardMetrics label="Ringkasan penilaian" items={[
        { label: "Sanggar ditugaskan", value: tugas.length },
        { label: "Belum final", value: tugas.length - completed, attention: tugas.length > completed },
        { label: "Penilaian terkunci", value: completed },
      ]} />
      <section aria-label="Daftar penugasan" className="rw-assignment-grid">
        {tugas.length === 0 && (
          <div className="rw-panel"><div className="rw-empty"><ClipboardList aria-hidden="true" /><h2>Belum ada penugasan</h2><p className="rw-note">Penugasan sanggar akan muncul di sini setelah diberikan kurator. Profil dan keahlian Anda tetap dapat diperbarui.</p></div></div>
        )}
        {tugas.map((t) => {
          const sg = db.users.find((u) => u.id === t.sanggarId) as
            | SanggarUser
            | undefined;
          const sub = db.kurasiSubmissions.find(
            (s) => s.sanggarId === t.sanggarId,
          );
          const final = sub?.finalized[j.username];
          return (
            <Link
              key={t.id}
              className="rw-assignment"
              href={`/juri/${t.sanggarId}`}
            >
              <div className="rw-assignment-copy">
                <span>Periode {t.periode}</span>
                <h2>{sg?.namaSanggar || "Sanggar ditugaskan"}</h2>
                <p>{sg?.jenisKesenian.join(", ")}</p>
              </div>
                {final ? (
                  <Badge variant="default" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Terkunci
                  </Badge>
                ) : (
                  <Badge variant="gold">Belum final</Badge>
                )}
              <ChevronRight aria-hidden="true" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export function JuriScoring() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [match, params] = useRoute("/juri/:sanggarId");
  const [busy, setBusy] = useState<null | "draft" | "final">(null);
  if (!match || !user || user.role !== "juri") return null;
  const sanggarId = params.sanggarId;
  const j = user as JuriUser;
  const sg = db.users.find((u) => u.id === sanggarId) as
    | SanggarUser
    | undefined;
  const submission = db.kurasiSubmissions.find(
    (s) => s.sanggarId === sanggarId,
  );
  const submissionSudahDinilai = Boolean(
    submission &&
    (Object.keys(submission.finalized).length > 0 ||
      Object.values(submission.scores).some(
        (nilaiJuri) => Object.keys(nilaiJuri).length > 0,
      )),
  );
  const matrix =
    submissionSudahDinilai && submission?.matrixSnapshot
      ? submission.matrixSnapshot
      : db.kurasiMatrix;
  const final = submission?.finalized[j.username];
  const [scores, setScores] = useState<Record<string, number>>(
    submission?.scores[j.username] ?? {},
  );
  const [requirementScores, setRequirementScores] = useState<
    Record<string, Record<string, number>>
  >(submission?.requirementScores?.[j.username] ?? {});
  const submissionStateKey = JSON.stringify([
    submission?.apiId ?? submission?.id ?? "",
    submission?.scores[j.username] ?? {},
    submission?.requirementScores?.[j.username] ?? {},
    final ?? null,
  ]);
  useEffect(() => {
    setScores(submission?.scores[j.username] ?? {});
    setRequirementScores(submission?.requirementScores?.[j.username] ?? {});
    // Kunci serial memastikan hasil hidrasi server diterapkan satu kali tanpa
    // menghapus pilihan lokal selama pengguna masih mengisi formulir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionStateKey]);

  const requirementScoresSiapSimpan = useMemo(() => {
    const hasil: Record<string, Record<string, number>> = {};
    matrix.indikator.forEach((indikator) =>
      variabelOf(indikator).forEach((variabel) => {
        const persyaratan = persyaratanBuktiDukungOf(variabel);
        if (persyaratan.length === 0) return;
        const nilaiVariabel: Record<string, number> = {};
        persyaratan.forEach((item) => {
          const nilai = requirementScores[variabel.id]?.[item.id];
          if (
            Number.isFinite(nilai) &&
            patokanNilaiPersyaratan(item, variabel, matrix).some((patokan) =>
              nilaiSama(patokan.persentaseBobot, nilai),
            )
          ) {
            nilaiVariabel[item.id] = nilai;
          }
        });
        if (Object.keys(nilaiVariabel).length > 0) {
          hasil[variabel.id] = nilaiVariabel;
        }
      }),
    );
    return hasil;
  }, [matrix, requirementScores]);

  const scoresSiapSimpan = useMemo(() => {
    const hasil: Record<string, number> = {};
    matrix.indikator.forEach((indikator) =>
      variabelOf(indikator).forEach((variabel) => {
        const persyaratan = persyaratanBuktiDukungOf(variabel);
        if (persyaratan.length > 0) {
          const rincian = requirementScoresSiapSimpan[variabel.id];
          if (rincian && Object.keys(rincian).length > 0) {
            hasil[variabel.id] = nilaiVariabelDariPersyaratan(
              variabel,
              rincian,
            );
          } else if (Number.isFinite(scores[variabel.id])) {
            // Nilai agregat lama tetap dapat dibaca. Untuk finalisasi baru,
            // setiap bukti tetap wajib dinilai satu per satu.
            hasil[variabel.id] = scores[variabel.id];
          }
          return;
        }
        const nilai = scores[variabel.id];
        if (
          Number.isFinite(nilai) &&
          patokanNilaiVariabel(variabel, matrix).some((patokan) =>
            nilaiSama(patokan.persentaseBobot, nilai),
          )
        ) {
          hasil[variabel.id] = nilai;
        }
      }),
    );
    return hasil;
  }, [matrix, requirementScoresSiapSimpan, scores]);

  const setNilaiPersyaratan = (
    variabel: Variabel,
    persyaratanId: string,
    nilai: number,
  ) =>
    setRequirementScores((current) => ({
      ...current,
      [variabel.id]: {
        ...(current[variabel.id] ?? {}),
        [persyaratanId]: nilai,
      },
    }));

  const naLive = useMemo(
    () => naFromScores(matrix, scoresSiapSimpan),
    [scoresSiapSimpan, matrix],
  );

  const bands = useMemo(() => predikatBands(matrix), [matrix]);
  const predikat = predikatOf(naLive, bands);
  const predikatWarna = predikatColor(predikat, bands);

  const filledCount = useMemo(() => {
    let n = 0;
    matrix.indikator.forEach((ind) =>
      variabelOf(ind).forEach((v) => {
        const persyaratan = persyaratanBuktiDukungOf(v);
        if (persyaratan.length > 0) {
          const rincian = requirementScoresSiapSimpan[v.id] ?? {};
          const legacyFinal =
            Boolean(final) &&
            Object.keys(rincian).length === 0 &&
            Number.isFinite(scores[v.id]);
          n += legacyFinal
            ? persyaratan.length
            : persyaratan.filter((item) => rincian[item.id] !== undefined)
                .length;
          return;
        }
        if (scoresSiapSimpan[v.id] !== undefined) n++;
      }),
    );
    return n;
  }, [final, matrix, requirementScoresSiapSimpan, scores, scoresSiapSimpan]);
  const totalTargets = useMemo(
    () =>
      matrix.indikator.reduce(
        (totalIndikator, indikator) =>
          totalIndikator +
          variabelOf(indikator).reduce((totalVariabel, variabel) => {
            const jumlahPersyaratan = persyaratanBuktiDukungOf(variabel).length;
            return totalVariabel + Math.max(1, jumlahPersyaratan);
          }, 0),
        0,
      ),
    [matrix],
  );
  const progress =
    totalTargets === 0 ? 0 : Math.round((filledCount / totalTargets) * 100);

  const accessError = juriScoringAccessError(db, j.id, sanggarId);
  if (accessError) return <div><PageHeader title="Penilaian Sanggar" backTo="/juri" /><Card className="p-6">{accessError}</Card></div>;

  const persistDraft = () => {
    save((d) => {
      const s = d.kurasiSubmissions.find((x) => x.sanggarId === sanggarId);
      if (s) {
        const sudahDinilai =
          Object.keys(s.finalized).length > 0 ||
          Object.values(s.scores).some(
            (nilaiJuri) => Object.keys(nilaiJuri).length > 0,
          );
        if (!sudahDinilai)
          s.matrixSnapshot = createKurasiMatrixSnapshot(matrix);
        else s.matrixSnapshot ??= createKurasiMatrixSnapshot(matrix);
        s.scores[j.username] = scoresSiapSimpan;
        s.requirementScores ??= {};
        s.requirementScores[j.username] = requirementScoresSiapSimpan;
      }
    });
  };

  const saveDraft = async () => {
    setBusy("draft");
    try {
      if (!sg) throw new Error("Sanggar tidak ditemukan");
      const error = juriScoringAccessError(load(), j.id, sanggarId, true);
      if (error) throw new Error(error);
      await persistKurasiScore(
        sg.username,
        scoresSiapSimpan,
        false,
        requirementScoresSiapSimpan,
      );
      persistDraft();
      toast({ title: "Skor draft tersimpan dan tersinkron" });
    } catch {
      toast({
        title: "Gagal menyimpan draft",
        description:
          "Pastikan Sanggar sudah mengirim berkas dan Anda ditugaskan oleh Kurator.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const submitFinal = async () => {
    if (filledCount !== totalTargets || totalTargets === 0) {
      toast({
        title: "Penilaian belum lengkap",
        description: `Lengkapi seluruh ${totalTargets} patokan bukti dukung sebelum mengunci nilai.`,
        variant: "destructive",
      });
      return;
    }
    setBusy("final");
    try {
      if (!sg) throw new Error("Sanggar tidak ditemukan");
      const error = juriScoringAccessError(load(), j.id, sanggarId, true);
      if (error) throw new Error(error);
      await persistKurasiScore(
        sg.username,
        scoresSiapSimpan,
        true,
        requirementScoresSiapSimpan,
      );
      save((d) => {
        const s = d.kurasiSubmissions.find((x) => x.sanggarId === sanggarId);
        if (s) {
          s.matrixSnapshot ??= createKurasiMatrixSnapshot(matrix);
          s.scores[j.username] = scoresSiapSimpan;
          s.requirementScores ??= {};
          s.requirementScores[j.username] = requirementScoresSiapSimpan;
          s.finalized[j.username] = Date.now();
        }
      });
      toast({ title: "Nilai akhir disubmit dan terkunci di server" });
    } catch {
      toast({
        title: "Gagal mengunci nilai",
        description:
          "Pastikan Sanggar sudah mengirim berkas dan Anda ditugaskan oleh Kurator.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Penilaian: ${sg?.namaSanggar ?? "-"}`}
        subtitle="Tahap 1 & 2 read-only · Tahap 3 memilih patokan nilai Kurator."
        backTo="/juri"
      />

      <LoadingOverlay
        show={busy !== null}
        label={
          busy === "final" ? "Mengunci nilai akhir..." : "Menyimpan draft..."
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <h3 className="font-serif text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-accent-foreground" />
              Tahap 1 — Berkas Administrasi{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Read-only)
              </span>
            </h3>
            <div className="mt-4 space-y-4">
              {manajemenIndikator(matrix)?.sumber && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">
                      Sumber indikator:
                    </span>{" "}
                    {manajemenIndikator(matrix)?.sumber}
                  </div>
                  {manajemenIndikator(matrix)?.catatanBobot && (
                    <div className="mt-1">
                      {manajemenIndikator(matrix)?.catatanBobot}
                    </div>
                  )}
                </div>
              )}
              {manajemenIndikator(matrix)?.pilar.map((p) => (
                <div key={p.id}>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    {p.nama}{" "}
                    <span className="opacity-60">
                      · bobot {p.bobotSumber ?? p.bobot}%
                    </span>
                  </div>
                  <div className="space-y-3">
                    {p.variabel.map((v) => (
                      <div
                        key={v.id}
                        className="border rounded-md p-3 bg-muted/30"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="text-sm font-medium">{v.nama}</div>
                          <Badge variant="outline" className="text-[10px]">
                            Bobot{" "}
                            {v.bobotSumber ??
                              Number(
                                (
                                  (v.bobot * (p.bobotSumber ?? p.bobot)) /
                                  100
                                ).toFixed(2),
                              )}
                            %
                          </Badge>
                        </div>
                        {persyaratanBuktiDukungOf(v).length > 0 && (
                          <div className="mt-2 rounded bg-background/70 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                            <div className="font-semibold text-foreground">
                              Persyaratan:
                            </div>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              {persyaratanBuktiDukungOf(v).map(
                                (persyaratan) => (
                                  <li key={persyaratan.id}>
                                    {persyaratan.nama}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {submission?.tahap1[v.id] || "(belum diisi)"}
                        </div>
                        {(submission?.tahap1Files?.[v.id] ?? []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(submission?.tahap1Files?.[v.id] ?? []).map(
                              (file, index) => (
                                <a
                                  key={`${file.name}-${index}`}
                                  href={file.url ?? file.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium text-primary hover:underline"
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{file.name}</span>
                                </a>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg flex items-center gap-2">
              <FileVideo className="h-5 w-5 text-accent-foreground" />
              Tahap 2 — Video Unggulan
            </h3>
            <div className="mt-3 aspect-video bg-muted rounded-md grid place-items-center text-sm text-muted-foreground border border-border/60 overflow-hidden">
              {submission?.tahap2VideoUrl ? (
                <video
                  controls
                  preload="metadata"
                  className="h-full w-full bg-black object-contain"
                  src={submission.tahap2VideoUrl}
                />
              ) : submission?.tahap2VideoName ? (
                `Video lama belum memiliki berkas: ${submission.tahap2VideoName}`
              ) : (
                "Belum ada video diunggah"
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-serif text-lg">
                Tahap 3 — Form Penilaian (Patokan Kurator)
              </h3>
              <Badge variant="outline" className="gap-1.5">
                <span className="font-mono">
                  {filledCount}/{totalTargets}
                </span>
                <span className="text-muted-foreground">
                  target bukti terisi
                </span>
              </Badge>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(90deg, hsl(38 60% 42%), hsl(42 80% 60%))",
                }}
              />
            </div>

            <div className="mt-5 space-y-6">
              {matrix.indikator.map((ind) => (
                <div
                  key={ind.id}
                  className="rounded-xl border border-border/70 p-4 bg-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{ind.nama}</div>
                    <Badge variant="gold">Bobot {ind.bobot}%</Badge>
                  </div>
                  <div className="mt-4 space-y-5">
                    {ind.pilar.map((pilar) => (
                      <div
                        key={pilar.id}
                        className="rounded-lg border border-border/50 p-3 bg-muted/20"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="text-sm font-medium">
                            {pilar.nama}
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            Pilar {pilar.bobotSumber ?? pilar.bobot}%
                          </Badge>
                        </div>
                        <div className="space-y-5">
                          {pilar.variabel.map((v) => {
                            const persyaratan = persyaratanBuktiDukungOf(v);
                            const rincian =
                              requirementScoresSiapSimpan[v.id] ?? {};
                            const nilaiAgregat = scoresSiapSimpan[v.id];
                            const legacyFinal =
                              Boolean(final) &&
                              persyaratan.length > 0 &&
                              Object.keys(rincian).length === 0 &&
                              Number.isFinite(scores[v.id]);
                            return (
                              <div key={v.id} className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm flex-1 min-w-0">
                                    <div className="font-medium">{v.nama}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Bobot{" "}
                                      {v.bobotSumber ??
                                        Number(
                                          (
                                            (v.bobot *
                                              (pilar.bobotSumber ??
                                                pilar.bobot)) /
                                            100
                                          ).toFixed(2),
                                        )}
                                      %
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                      Nilai variabel
                                    </div>
                                    <div className="font-mono text-lg font-semibold tabular-nums">
                                      {nilaiAgregat === undefined
                                        ? "—"
                                        : `${nilaiAgregat.toFixed(2)}%`}
                                    </div>
                                  </div>
                                </div>

                                {legacyFinal ? (
                                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                                    Nilai final lama: {scores[v.id]}%. Rincian
                                    per bukti belum tersedia karena nilai dibuat
                                    sebelum sistem patokan per bukti diterapkan.
                                  </div>
                                ) : persyaratan.length > 0 ? (
                                  <div className="space-y-3">
                                    {persyaratan.map((item, index) => {
                                      const nilai = rincian[item.id];
                                      return (
                                        <div
                                          key={item.id}
                                          className="space-y-2 rounded-lg border bg-background p-3"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Bukti dukung {index + 1}
                                              </div>
                                              <div className="mt-0.5 text-sm">
                                                {item.nama}
                                              </div>
                                            </div>
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 font-mono text-[10px]"
                                            >
                                              {nilai === undefined
                                                ? "Belum dinilai"
                                                : `${nilai}%`}
                                            </Badge>
                                          </div>
                                          <PatokanScorePicker
                                            ariaLabel={`Nilai bukti ${item.nama}`}
                                            disabled={Boolean(final)}
                                            options={patokanNilaiPersyaratan(
                                              item,
                                              v,
                                              matrix,
                                            )}
                                            selected={nilai}
                                            testIdPrefix={`nilai-${v.id}-${item.id}`}
                                            onChange={(value) =>
                                              setNilaiPersyaratan(
                                                v,
                                                item.id,
                                                value,
                                              )
                                            }
                                          />
                                        </div>
                                      );
                                    })}
                                    <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                                      Nilai variabel adalah rata-rata seluruh{" "}
                                      {persyaratan.length} bukti dukung. Bukti
                                      yang belum dinilai dihitung 0 pada draft.
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2 rounded-lg border bg-background p-3">
                                    <div className="text-xs font-semibold text-muted-foreground">
                                      Patokan nilai variabel
                                    </div>
                                    <PatokanScorePicker
                                      ariaLabel={`Nilai ${v.nama}`}
                                      disabled={Boolean(final)}
                                      options={patokanNilaiVariabel(v, matrix)}
                                      selected={scoresSiapSimpan[v.id]}
                                      testIdPrefix={`nilai-${v.id}`}
                                      onChange={(value) =>
                                        setScores((current) => ({
                                          ...current,
                                          [v.id]: value,
                                        }))
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card
          className="relative overflow-hidden h-fit lg:sticky lg:top-6 border-2 border-[hsl(38_60%_38%/0.4)]"
          style={{
            background:
              "linear-gradient(135deg, hsl(150 52% 13%) 0%, hsl(149 52% 10%) 50%, hsl(18 55% 16%) 100%)",
          }}
        >
          <GoldDustField count={14} />
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(42 75% 55%), transparent)",
            }}
          />
          <div className="relative p-6 text-[hsl(45_85%_92%)]">
            <div
              className="text-[11px] font-medium uppercase tracking-[0.22em]"
              style={{ color: "hsl(42 70% 70%)" }}
            >
              Nilai Akhir · Live
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <AnimatedCounter
                value={naLive}
                decimals={2}
                duration={420}
                className="font-serif text-6xl font-semibold tabular-nums"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(45 90% 78%), hsl(42 75% 55%))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 0 24px hsl(42 80% 55% / 0.4)",
                }}
              />
              <span className="text-sm opacity-70">/ 100</span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm opacity-80">Predikat</span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold tracking-wider"
                style={{
                  background: `${predikatWarna}25`,
                  color: predikatWarna,
                  border: `1px solid ${predikatWarna}55`,
                  transition: "all 0.4s",
                }}
              >
                {predikat}
              </span>
            </div>

            <div className="mt-4 h-2 rounded-full overflow-hidden bg-white/10">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, naLive)}%`,
                  background:
                    "linear-gradient(90deg, hsl(38 60% 42%), hsl(42 85% 65%))",
                  boxShadow: "0 0 12px hsl(42 80% 55% / 0.6)",
                }}
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {matrix.indikator.map((ind) => {
                const contrib = indikatorKontribusi(ind, scoresSiapSimpan);
                return (
                  <div
                    key={ind.id}
                    className="rounded-lg p-2 bg-white/5 border border-white/10"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wider opacity-80 truncate">
                      {ind.nama}
                    </div>
                    <div
                      className="font-mono font-semibold tabular-nums text-sm"
                      style={{ color: "hsl(42 80% 70%)" }}
                    >
                      {contrib.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>

            {final ? (
              <div className="mt-6 p-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Final · {fmtDateTime(final)}
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={saveDraft}
                  disabled={busy !== null}
                >
                  <Save className="h-4 w-4" />
                  Simpan Draft
                </Button>
                <Button
                  variant="gold"
                  className="w-full gap-2"
                  onClick={submitFinal}
                  disabled={busy !== null}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Nilai Akhir
                </Button>
                <p className="text-[11px] text-[hsl(45_70%_82%)]/85">
                  Setelah disubmit, nilai bersifat final dan terkunci dari sisi
                  Juri.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
