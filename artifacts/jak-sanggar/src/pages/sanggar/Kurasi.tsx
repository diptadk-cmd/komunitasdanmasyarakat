import { useEffect, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, uid, fmtDateTime } from "@/lib/store";
import { persistKurasiSubmission } from "@/lib/kurasi-sync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type {
  SanggarUser,
  SenimanUser,
  KurasiDataDukung,
  KurasiPesertaSeni,
  KurasiSubmission,
} from "@/lib/types";
import {
  computeNA as computeNAHelper,
  predikatColor,
  predikatTingkat,
  predikatBands,
  manajemenIndikator,
  seniIndikator,
  pilarScoreOf,
  patokanNilaiPersyaratan,
  patokanNilaiVariabel,
  persyaratanBuktiDukungOf,
  createKurasiMatrixSnapshot,
} from "@/lib/kurasi";
import type { KurasiMatrix } from "@/lib/types";
import type { PredikatBand } from "@/lib/types";
import {
  Video,
  Award,
  Trophy,
  Paperclip,
  FileText,
  X,
  Download,
  RefreshCw,
  UserCheck,
  ImagePlus,
} from "lucide-react";
import { AnimatedCounter } from "@/components/system/AnimatedCounter";
import { PucukRebungDivider, BatikCorner } from "@/components/betawi/Ornaments";
import { openPrintWindow, safeHtml } from "@/lib/print";
import { uploadsApi } from "@/lib/api";

const MIN_PESERTA_KURASI = 5;
const MAX_PESERTA_KURASI = 8;

export default function KurasiPage() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const submission = db.kurasiSubmissions.find((s) => s.sanggarId === sg.id);
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
  const [tahap1, setTahap1] = useState<Record<string, string>>(
    submission?.tahap1 ?? {},
  );
  const [tahap1Files, setTahap1Files] = useState<
    Record<string, KurasiDataDukung[]>
  >(submission?.tahap1Files ?? {});
  const [video, setVideo] = useState<File | null>(null);
  const [pesertaSeni, setPesertaSeni] = useState<KurasiPesertaSeni[]>(
    submission?.pesertaSeni ?? [],
  );
  const [deklarasiAntiJoki, setDeklarasiAntiJoki] = useState(
    Boolean(submission?.deklarasiAntiJokiAt),
  );
  const submissionStateKey = JSON.stringify([
    submission?.apiId ?? submission?.id ?? "",
    submission?.tahap1 ?? {},
    submission?.tahap1Files ?? {},
    submission?.pesertaSeni ?? [],
    submission?.deklarasiAntiJokiAt ?? 0,
  ]);
  useEffect(() => {
    setTahap1(submission?.tahap1 ?? {});
    setTahap1Files(submission?.tahap1Files ?? {});
    setPesertaSeni(submission?.pesertaSeni ?? []);
    setDeklarasiAntiJoki(Boolean(submission?.deklarasiAntiJokiAt));
    // Terapkan hasil hidrasi server tanpa mereset isian lokal pada render biasa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionStateKey]);
  const [uploading, setUploading] = useState(false);
  const senimanAktif = db.users.filter(
    (u) =>
      u.role === "seniman" &&
      (u as SenimanUser).sanggarId === sg.id &&
      (u as SenimanUser).status === "aktif",
  ) as SenimanUser[];

  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
  const addFiles = async (vid: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    let running = Object.values(tahap1Files)
      .flat()
      .reduce((a, f) => a + f.size, 0);
    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (
        !(file.type.startsWith("image/") || file.type === "application/pdf")
      ) {
        toast({
          title: "Format berkas tidak didukung",
          description: file.name,
          variant: "destructive",
        });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast({
          title: "Berkas terlalu besar",
          description: `${file.name} melebihi 2 MB dan tidak diunggah.`,
          variant: "destructive",
        });
        return;
      }
      if (running + file.size > MAX_TOTAL_BYTES) {
        toast({
          title: "Kuota berkas penuh",
          description: `Total data dukung dibatasi ${fmtBytes(MAX_TOTAL_BYTES)}. ${file.name} tidak diunggah.`,
          variant: "destructive",
        });
        return;
      }
      running += file.size;
      accepted.push(file);
    });
    if (accepted.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        accepted.map(async (file) => ({
          file,
          result: await uploadsApi.create(file),
        })),
      );
      setTahap1Files((prev) => ({
        ...prev,
        [vid]: [
          ...(prev[vid] ?? []),
          ...uploaded.map(({ file, result }) => ({
            name: file.name,
            url: result.url,
            size: file.size,
          })),
        ],
      }));
    } catch (error) {
      toast({
        title: "Berkas gagal diunggah",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  const removeFile = (vid: string, idx: number) => {
    setTahap1Files((prev) => ({
      ...prev,
      [vid]: (prev[vid] ?? []).filter((_, i) => i !== idx),
    }));
  };
  const replaceFile = async (
    vid: string,
    idx: number,
    files: FileList | null,
  ) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (file.size > MAX_FILE_BYTES) {
      toast({
        title: "Berkas terlalu besar",
        description: `${file.name} melebihi 2 MB dan tidak diunggah.`,
        variant: "destructive",
      });
      return;
    }
    const existing = tahap1Files[vid]?.[idx]?.size ?? 0;
    const total = Object.values(tahap1Files)
      .flat()
      .reduce((a, f) => a + f.size, 0);
    if (total - existing + file.size > MAX_TOTAL_BYTES) {
      toast({
        title: "Kuota berkas penuh",
        description: `Total data dukung dibatasi ${fmtBytes(MAX_TOTAL_BYTES)}. ${file.name} tidak diunggah.`,
        variant: "destructive",
      });
      return;
    }
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
      toast({ title: "Format berkas tidak didukung", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadsApi.create(file);
      setTahap1Files((prev) => ({
        ...prev,
        [vid]: (prev[vid] ?? []).map((item, i) =>
          i === idx
            ? { name: file.name, url: uploaded.url, size: file.size }
            : item,
        ),
      }));
    } catch (error) {
      toast({
        title: "Berkas gagal diganti",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const togglePeserta = (seniman: SenimanUser) => {
    const matches = (item: KurasiPesertaSeni) =>
      item.userId === seniman.id ||
      item.userId === seniman.username ||
      item.username === seniman.username;
    if (pesertaSeni.some(matches)) {
      setPesertaSeni((current) => current.filter((item) => !matches(item)));
      return;
    }
    if (pesertaSeni.length >= MAX_PESERTA_KURASI) {
      toast({
        title: `Maksimal ${MAX_PESERTA_KURASI} peserta`,
        description:
          "Batalkan salah satu disposisi sebelum memilih peserta lain.",
        variant: "destructive",
      });
      return;
    }
    const dipakaiSanggarLain = db.kurasiSubmissions.some(
      (item) =>
        item.sanggarId !== sg.id &&
        item.pesertaSeni?.some(
          (peserta) =>
            peserta.userId === seniman.id ||
            peserta.userId === seniman.username ||
            peserta.username === seniman.username,
        ),
    );
    if (dipakaiSanggarLain) {
      toast({
        title: "Peserta sudah didisposisikan Sanggar lain",
        description:
          "Hubungi Kurator untuk pemeriksaan keanggotaan dan anti-joki.",
        variant: "destructive",
      });
      return;
    }
    setPesertaSeni((current) => [
      ...current,
      {
        userId: seniman.username,
        username: seniman.username,
        nama: seniman.nama,
        jenisKesenian: seniman.jenisKesenian,
        disposisiAt: Date.now(),
        disposisiOleh: sg.username,
      },
    ]);
  };

  const updateNikPeserta = (userId: string, value: string) => {
    const nik = value.replace(/\D/g, "").slice(0, 16);
    setPesertaSeni((current) =>
      current.map((item) => (item.userId === userId ? { ...item, nik } : item)),
    );
  };

  const uploadIdentitas = async (
    userId: string,
    field: "ktpUrl" | "selfieUrl",
    file?: File,
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_000_000) {
      toast({
        title: "Foto tidak valid",
        description: "Gunakan gambar JPG/PNG maksimal 1 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadsApi.create(file);
      setPesertaSeni((current) =>
        current.map((item) =>
          item.userId === userId ? { ...item, [field]: uploaded.url } : item,
        ),
      );
    } catch (error) {
      toast({
        title: "Identitas gagal diunggah",
        description: error instanceof Error ? error.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const selectVideo = async (file?: File) => {
    if (!file) return setVideo(null);
    if (!file.type.startsWith("video/") || file.size > 60 * 1024 * 1024) {
      toast({
        title: "Video tidak valid",
        description: "Gunakan video MP4/WebM/MOV maksimal 60 MB.",
        variant: "destructive",
      });
      return;
    }
    try {
      const metadata = await readVideoMetadata(file);
      if (metadata.duration > 300)
        throw new Error("Durasi video maksimal 5 menit.");
      if (Math.abs(metadata.ratio - 16 / 9) > 0.15)
        throw new Error("Rasio video harus mendekati 16:9.");
      setVideo(file);
    } catch (error) {
      setVideo(null);
      toast({
        title: "Video tidak memenuhi ketentuan",
        description:
          error instanceof Error ? error.message : "Berkas tidak dapat dibaca.",
        variant: "destructive",
      });
    }
  };

  const submitTahap = async () => {
    const requiredVariables =
      manajemen?.pilar.flatMap((pilar) => pilar.variabel) ?? [];
    if (requiredVariables.some((variable) => !tahap1[variable.id]?.trim())) {
      toast({
        title: "Uraian Tahap 1 belum lengkap",
        description: "Lengkapi seluruh variabel administrasi.",
        variant: "destructive",
      });
      return;
    }
    if (
      seni &&
      (pesertaSeni.length < MIN_PESERTA_KURASI ||
        pesertaSeni.length > MAX_PESERTA_KURASI)
    ) {
      toast({
        title: `Jumlah peserta harus ${MIN_PESERTA_KURASI}–${MAX_PESERTA_KURASI} seniman`,
        variant: "destructive",
      });
      return;
    }
    if (pesertaSeni.some((item) => !/^\d{16}$/.test(item.nik ?? ""))) {
      toast({
        title: "NIK peserta belum valid",
        description: "Setiap peserta wajib memiliki NIK tepat 16 digit.",
        variant: "destructive",
      });
      return;
    }
    const participantKeys = new Set(
      pesertaSeni.map((item) =>
        (item.username || item.userId).trim().toLowerCase(),
      ),
    );
    const participantNiks = new Set(pesertaSeni.map((item) => item.nik));
    if (
      participantKeys.size !== pesertaSeni.length ||
      participantNiks.size !== pesertaSeni.length
    ) {
      toast({
        title: "Peserta ganda terdeteksi",
        description: "Akun dan NIK setiap peserta harus berbeda.",
        variant: "destructive",
      });
      return;
    }
    if (
      pesertaSeni.some(
        (item) =>
          !(item.ktpUrl || item.ktpDataUrl) ||
          !(item.selfieUrl || item.selfieDataUrl),
      )
    ) {
      toast({
        title: "Identitas peserta belum lengkap",
        description:
          "Setiap seniman wajib melampirkan foto KTP dan selfie sambil memegang KTP.",
        variant: "destructive",
      });
      return;
    }
    if (!deklarasiAntiJoki) {
      toast({
        title: "Pernyataan anti-joki belum disetujui",
        description:
          "Penanggung jawab Sanggar wajib menyetujui deklarasi peserta.",
        variant: "destructive",
      });
      return;
    }
    let saved: KurasiSubmission | undefined;
    let localWasMutated = false;
    const previousLocal = submission ? structuredClone(submission) : undefined;
    setUploading(true);
    try {
      const uploadedVideo = video ? await uploadsApi.create(video) : null;
      const videoUrl = uploadedVideo?.url ?? submission?.tahap2VideoUrl;
      const videoName = video?.name ?? submission?.tahap2VideoName;
      if (!videoUrl || !videoName)
        throw new Error("Video unggulan wajib diunggah.");
      save((d) => {
        let current = d.kurasiSubmissions.find(
          (item) => item.sanggarId === sg.id,
        );
        if (!current) {
          current = {
            id: uid(),
            sanggarId: sg.id,
            tahap1: {},
            matrixSnapshot: createKurasiMatrixSnapshot(d.kurasiMatrix),
            scores: {},
            finalized: {},
            createdAt: Date.now(),
          };
          d.kurasiSubmissions.push(current);
        }
        const sudahDinilai =
          Object.keys(current.finalized).length > 0 ||
          Object.values(current.scores).some(
            (nilaiJuri) => Object.keys(nilaiJuri).length > 0,
          );
        if (!sudahDinilai) {
          current.matrixSnapshot = createKurasiMatrixSnapshot(d.kurasiMatrix);
        } else {
          current.matrixSnapshot ??= createKurasiMatrixSnapshot(d.kurasiMatrix);
        }
        current.tahap1 = tahap1;
        current.tahap1Files = tahap1Files;
        current.pesertaSeni = pesertaSeni;
        current.deklarasiAntiJokiAt = current.deklarasiAntiJokiAt ?? Date.now();
        current.deklarasiAntiJokiOleh = sg.username;
        current.tahap2VideoName = videoName;
        current.tahap2VideoUrl = videoUrl;
        saved = { ...current };
        localWasMutated = true;
      });
      if (saved) await persistKurasiSubmission(saved, sg.username);
      toast({
        title: "Berkas kurasi tersimpan",
        description:
          "Data sudah disinkronkan ke server untuk Kurator dan Juri.",
      });
    } catch (error) {
      if (localWasMutated) {
        save((d) => {
          const index = d.kurasiSubmissions.findIndex(
            (item) => item.sanggarId === sg.id,
          );
          if (previousLocal && index >= 0)
            d.kurasiSubmissions[index] = previousLocal;
          else if (!previousLocal)
            d.kurasiSubmissions = d.kurasiSubmissions.filter(
              (item) => item.sanggarId !== sg.id,
            );
        });
      }
      toast({
        title: "Berkas kurasi belum terkirim",
        description:
          error instanceof Error
            ? error.message
            : "Sinkronisasi server gagal. Coba lagi saat koneksi pulih.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const assignments = db.penugasanJuri.filter(
    (item) => item.sanggarId === sg.id,
  );
  const assignedJury = assignments
    .map((item) => db.users.find((candidate) => candidate.id === item.juriId))
    .filter(Boolean);
  const allAssignedFinal =
    assignedJury.length > 0 &&
    assignedJury.every((jury) =>
      Boolean(submission?.finalized[jury!.username]),
    );
  const finalScores = Object.fromEntries(
    assignedJury
      .filter((jury) => submission?.finalized[jury!.username])
      .map((jury) => [
        jury!.username,
        submission?.scores[jury!.username] ?? {},
      ]),
  );
  const na =
    submission && allAssignedFinal
      ? computeNAHelper(matrix, finalScores)
      : null;
  const bands = predikatBands(matrix);
  const rincianPilar = submission && na ? pilarRows(matrix, finalScores) : [];

  const manajemen = manajemenIndikator(matrix);
  const seni = seniIndikator(matrix);

  return (
    <div>
      <PageHeader
        title="Kurasi Sanggar"
        subtitle={`3 tahap penilaian: ${manajemen?.nama ?? "Administrasi"} (${manajemen?.bobot ?? 30}%), ${seni?.nama ?? "Tampilan"} (${seni?.bobot ?? 70}%), dan Live.`}
      />

      {na && (
        <Card
          className="p-0 mb-6 overflow-hidden text-amber-50 relative"
          style={{
            background:
              "linear-gradient(135deg, hsl(150 60% 11%) 0%, hsl(149 52% 18%) 55%, hsl(18 62% 28%) 100%)",
            borderColor: "hsl(42 60% 50% / 0.35)",
            boxShadow:
              "0 20px 50px -10px hsl(150 50% 8% / 0.4), 0 0 0 1px hsl(16 85% 52% / 0.22)",
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><g fill='none' stroke='%23d4a64e' stroke-width='0.7'><path d='M20 80 L35 50 L50 80 Z'/><path d='M50 80 L65 50 L80 80 Z'/></g></svg>\")",
              backgroundSize: "140px 140px",
            }}
          />
          <BatikCorner className="absolute right-2 top-2 w-24 h-24 opacity-25" />

          <div className="relative p-6 sm:p-8 grid sm:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="flex items-center gap-2 text-amber-200/90 text-[11px] font-medium uppercase tracking-[0.24em] mb-2">
                <Trophy className="h-3.5 w-3.5" /> Nilai Akhir Kurasi
              </div>
              <div
                className="font-serif text-6xl sm:text-7xl gold-glow leading-none"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(42 90% 80%) 0%, hsl(42 65% 55%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                <AnimatedCounter
                  value={na.na}
                  decimals={2}
                  format={(n) => n.toFixed(2)}
                  duration={1500}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-amber-100/70 text-sm">Predikat:</span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase"
                  style={{
                    background: `${predikatColor(na.predikat, bands)}28`,
                    border: `1px solid ${predikatColor(na.predikat, bands)}80`,
                    color: predikatColor(na.predikat, bands),
                  }}
                >
                  {na.predikat}
                </span>
              </div>
              <div className="mt-4 max-w-sm">
                <PucukRebungDivider className="opacity-50" />
              </div>
            </div>
            <div>
              <Button
                className="btn-gold border-0 gap-2 h-11 px-5"
                onClick={() => printSertifikat(sg, na.na, na.predikat, bands)}
              >
                <Award className="h-4 w-4" />
                Preview Sertifikat
              </Button>
            </div>
          </div>

          {rincianPilar.length > 0 && (
            <div className="relative px-6 sm:px-8 pb-6 sm:pb-8">
              <div className="text-amber-200/90 text-[11px] font-medium uppercase tracking-[0.24em] mb-3">
                Rincian Skor per Pilar
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {rincianPilar.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: "hsl(150 45% 8% / 0.45)",
                      border: "1px solid hsl(42 60% 50% / 0.28)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-amber-100/80 truncate">
                          {r.indikatorNama} ({r.indikatorBobot}%)
                        </div>
                        <div className="text-sm font-semibold text-amber-50 truncate">
                          {r.pilarNama}{" "}
                          <span className="text-[11px] font-medium text-amber-100/80">
                            · Pilar {r.pilarBobot}%
                          </span>
                        </div>
                      </div>
                      <div
                        className="font-serif text-2xl leading-none flex-none"
                        style={{
                          background:
                            "linear-gradient(180deg, hsl(42 90% 80%) 0%, hsl(42 65% 55%) 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {r.skor.toFixed(1)}
                      </div>
                    </div>
                    <div
                      className="mt-2 h-1.5 rounded-full overflow-hidden"
                      style={{ background: "hsl(150 40% 20% / 0.7)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, r.skor))}%`,
                          background:
                            "linear-gradient(90deg, hsl(42 65% 55%), hsl(42 90% 70%))",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] font-medium text-amber-100/80">
                Skor per Pilar adalah rata-rata penilaian seluruh Juri (skala
                0–100).
              </div>
            </div>
          )}
        </Card>
      )}

      <Tabs defaultValue="t1">
        <TabsList>
          <TabsTrigger value="t1">
            Tahap 1 — {manajemen?.nama ?? "Administrasi"} (
            {manajemen?.bobot ?? 30}%)
          </TabsTrigger>
          <TabsTrigger value="t2">
            Tahap 2 — {seni?.nama ?? "Tampilan"} ({seni?.bobot ?? 70}%)
          </TabsTrigger>
          <TabsTrigger value="t3">Tahap 3 — Live</TabsTrigger>
        </TabsList>

        <TabsContent value="t1">
          <Card className="p-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              Isi data dukung manajemen sesuai indikator yang ditetapkan
              Kurator.
            </p>
            {manajemen?.sumber && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">
                    Sumber indikator:
                  </span>{" "}
                  {manajemen.sumber}
                </div>
                {manajemen.catatanBobot && (
                  <div className="mt-1">{manajemen.catatanBobot}</div>
                )}
              </div>
            )}
            {manajemen?.pilar.map((p) => (
              <div key={p.id} className="space-y-4">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {p.nama}{" "}
                  <Badge variant="secondary" className="text-[10px]">
                    Pilar {p.bobotSumber ?? p.bobot}%
                  </Badge>
                </div>
                {p.variabel.map((v) => {
                  const nomorButir =
                    manajemen.pilar
                      .flatMap((item) => item.variabel)
                      .findIndex((item) => item.id === v.id) + 1;
                  return (
                    <div
                      key={v.id}
                      className="space-y-2 ml-1 rounded-lg border border-border/60 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Label className="leading-relaxed">
                          <span className="mr-2 text-muted-foreground">
                            {nomorButir}.
                          </span>
                          {v.nama}
                        </Label>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
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
                      {persyaratanBuktiDukungOf(v).length > 0 ? (
                        <div className="space-y-2 rounded-md bg-muted/55 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          <div className="font-semibold text-foreground">
                            Persyaratan data dukung:
                          </div>
                          {persyaratanBuktiDukungOf(v).map(
                            (persyaratan, index) => (
                              <div
                                key={persyaratan.id}
                                className="rounded-md border bg-background/80 p-2.5"
                              >
                                <div className="font-medium text-foreground">
                                  {index + 1}. {persyaratan.nama}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {[
                                    ...patokanNilaiPersyaratan(
                                      persyaratan,
                                      v,
                                      matrix,
                                    ),
                                  ]
                                    .sort((a, b) => a.nilai - b.nilai)
                                    .map((item) => (
                                      <Badge
                                        key={item.id}
                                        variant="outline"
                                        className="text-[10px]"
                                      >
                                        {item.nilai} — {item.nama} (
                                        {item.persentaseBobot}%)
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                            ),
                          )}
                          {persyaratanBuktiDukungOf(v).length > 1 && (
                            <div>
                              Nilai variabel dihitung dari rata-rata seluruh
                              bukti dukung di atas.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/55 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          <div className="font-semibold text-foreground">
                            Patokan nilai variabel:
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[...patokanNilaiVariabel(v, matrix)]
                              .sort((a, b) => a.nilai - b.nilai)
                              .map((item) => (
                                <Badge
                                  key={item.id}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {item.nilai} — {item.nama} (
                                  {item.persentaseBobot}%)
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                      <Textarea
                        rows={3}
                        value={tahap1[v.id] ?? ""}
                        onChange={(e) =>
                          setTahap1({ ...tahap1, [v.id]: e.target.value })
                        }
                        placeholder="Jelaskan kelengkapan, nomor/tanggal dokumen, atau keterangan data dukung..."
                      />
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            id={`file-${v.id}`}
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              addFiles(v.id, e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                              document.getElementById(`file-${v.id}`)?.click()
                            }
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Lampirkan Berkas
                          </Button>
                          {v.contoh && (
                            <Button
                              asChild
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                            >
                              <a
                                href={v.contoh.dataUrl}
                                download={v.contoh.name}
                                title={v.contoh.name}
                              >
                                <Download className="h-3.5 w-3.5" />
                                Unduh Contoh
                              </a>
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Gambar / PDF, maks 2 MB per berkas.
                          </span>
                        </div>
                        {(tahap1Files[v.id] ?? []).length > 0 && (
                          <ul className="space-y-1.5">
                            {(tahap1Files[v.id] ?? []).map((f, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
                              >
                                <FileText className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                                <a
                                  href={f.url ?? f.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={f.name}
                                  className="truncate font-medium text-primary hover:underline"
                                  title={f.name}
                                >
                                  {f.name}
                                </a>
                                <span className="flex-none text-muted-foreground">
                                  {fmtBytes(f.size)}
                                </span>
                                <input
                                  id={`replace-${v.id}-${i}`}
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    replaceFile(v.id, i, e.target.files);
                                    e.target.value = "";
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    document
                                      .getElementById(`replace-${v.id}-${i}`)
                                      ?.click()
                                  }
                                  className="ml-auto flex-none rounded p-0.5 text-muted-foreground hover:text-primary"
                                  aria-label="Ganti berkas"
                                  title="Ganti berkas"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeFile(v.id, i)}
                                  className="flex-none rounded p-0.5 text-muted-foreground hover:text-destructive"
                                  aria-label="Hapus berkas"
                                  title="Hapus berkas"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="t2">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Unggah video unggulan (maks 5 menit) berisi 5–8 peserta inti yang
              wajib memperkenalkan diri.
            </p>
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
              {/* Video preview big with gold border */}
              <div
                className="aspect-video rounded-2xl overflow-hidden grid place-items-center relative"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(150 50% 11%), hsl(149 47% 17%))",
                  border: "1px solid hsl(42 60% 50% / 0.4)",
                  boxShadow:
                    "0 0 0 1px hsl(16 80% 52% / 0.15) inset, 0 20px 40px -10px hsl(150 50% 8% / 0.4)",
                }}
              >
                <div className="text-center text-amber-100/85">
                  {submission?.tahap2VideoUrl && !video ? (
                    <video
                      controls
                      preload="metadata"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={submission.tahap2VideoUrl}
                    >
                      Peramban tidak mendukung pemutar video.
                    </video>
                  ) : (
                    <>
                      <Video className="h-14 w-14 mx-auto mb-3 opacity-70" />
                      <div className="text-sm">
                        {video?.name ??
                          submission?.tahap2VideoName ??
                          "Belum ada video unggulan"}
                      </div>
                    </>
                  )}
                  <div className="text-[11px] font-medium mt-1 text-amber-100/85">
                    Rasio 16:9 · maks 5 menit
                  </div>
                </div>
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(42 75% 55%), transparent)",
                  }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(42 75% 55%), transparent)",
                  }}
                />
              </div>
              <div className="space-y-3">
                <Label>Video Unggulan</Label>
                <Input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => void selectVideo(e.target.files?.[0])}
                />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Pastikan setiap peserta memperkenalkan diri (nama, peran,
                  jenis kesenian) di awal video. Video akan ditinjau oleh Juri
                  dan menjadi dasar penilaian Tahap 2.
                </div>
              </div>
            </div>

            <div className="mt-7 border-t pt-6">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="h-5 w-5 text-accent" />
                <h3 className="font-serif text-lg">Disposisi Peserta Kurasi</h3>
                <Badge variant="outline" className="ml-auto">
                  {pesertaSeni.length}/{MAX_PESERTA_KURASI}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Disposisikan 5–8 seniman aktif milik Sanggar yang akan tampil.
                Setiap orang hanya boleh mewakili satu Sanggar dan wajib
                melampirkan NIK, foto KTP, serta selfie sambil memegang KTP.
              </p>
              {senimanAktif.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Belum ada seniman aktif terdaftar pada sanggar ini.
                  Tambahkan/aktifkan anggota terlebih dahulu.
                </div>
              ) : (
                <div className="space-y-3">
                  {senimanAktif.map((seniman) => {
                    const peserta = pesertaSeni.find(
                      (item) =>
                        item.userId === seniman.id ||
                        item.userId === seniman.username ||
                        item.username === seniman.username,
                    );
                    return (
                      <div
                        key={seniman.id}
                        className={`rounded-xl border p-4 ${peserta ? "border-accent/50 bg-accent/5" : "border-border"}`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!peserta}
                            onChange={() => togglePeserta(seniman)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="font-medium">{seniman.nama}</div>
                            <div className="text-xs text-muted-foreground">
                              {seniman.jenisKesenian} ·{" "}
                              {seniman.noHp ?? "No. HP belum diisi"}
                            </div>
                          </div>
                          <Badge
                            variant={peserta ? "default" : "outline"}
                            className="ml-auto"
                          >
                            {peserta ? "Didisposisikan" : "Disposisikan"}
                          </Badge>
                        </label>
                        {peserta && (
                          <div className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2">
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label htmlFor={`identity-${seniman.id}-nik`}>
                                NIK Peserta (16 digit)
                              </Label>
                              <Input
                                id={`identity-${seniman.id}-nik`}
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={16}
                                value={peserta.nik ?? ""}
                                onChange={(event) =>
                                  updateNikPeserta(
                                    peserta.userId,
                                    event.target.value,
                                  )
                                }
                                placeholder="317xxxxxxxxxxxxx"
                              />
                            </div>
                            <IdentityUpload
                              inputId={`identity-${seniman.id}-ktp`}
                              label="Foto KTP"
                              done={!!(peserta.ktpUrl || peserta.ktpDataUrl)}
                              onChange={(file) =>
                                void uploadIdentitas(
                                  peserta.userId,
                                  "ktpUrl",
                                  file,
                                )
                              }
                            />
                            <IdentityUpload
                              inputId={`identity-${seniman.id}-selfie`}
                              label="Selfie Memegang KTP"
                              hint="Wajah dan KTP asli harus terlihat jelas dalam satu foto."
                              done={
                                !!(peserta.selfieUrl || peserta.selfieDataUrl)
                              }
                              onChange={(file) =>
                                void uploadIdentitas(
                                  peserta.userId,
                                  "selfieUrl",
                                  file,
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <input
                  type="checkbox"
                  checked={deklarasiAntiJoki}
                  onChange={(event) =>
                    setDeklarasiAntiJoki(event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <strong>Pernyataan anti-joki.</strong> Saya menyatakan seluruh
                  peserta adalah Seniman aktif Sanggar ini, hadir sendiri dalam
                  video dan kurasi, bukan joki atau titipan, serta tidak
                  didisposisikan oleh Sanggar lain. Data ini dapat diaudit oleh
                  Kurator.
                </span>
              </label>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="t3">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Tampil langsung di hadapan Juri yang ditugaskan. Skor Juri
              otomatis terhitung di sistem ini.
            </p>
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">
                Status Penilaian Juri
              </h4>
              <div className="space-y-1.5">
                {assignments.map((pj) => {
                  const j = db.users.find((u) => u.id === pj.juriId);
                  const key = j?.username ?? pj.juriId;
                  const score = submission?.scores[key];
                  const final = submission?.finalized[key];
                  return (
                    <div
                      key={pj.id}
                      className="flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm"
                    >
                      <div>
                        {(j as any)?.nama ?? "-"}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({pj.periode})
                        </span>
                      </div>
                      <Badge
                        variant={
                          final ? "default" : score ? "secondary" : "outline"
                        }
                      >
                        {final
                          ? `Final • ${fmtDateTime(final)}`
                          : score
                            ? "Draft"
                            : "Belum Menilai"}
                      </Badge>
                    </div>
                  );
                })}
                {assignments.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    Belum ada penugasan juri.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2">
        <Button
          onClick={() => void submitTahap()}
          disabled={uploading}
          className="btn-gold border-0"
        >
          {uploading ? "Mengunggah..." : "Kirim Berkas Kurasi"}
        </Button>
      </div>
    </div>
  );
}

interface PilarRow {
  indikatorNama: string;
  indikatorBobot: number;
  pilarNama: string;
  pilarBobot: number;
  skor: number;
}

/** Rata-rata skor per Pilar (0..100) di seluruh juri yang sudah menilai. */
function pilarRows(
  matrix: KurasiMatrix,
  scoresPerJuri: Record<string, Record<string, number>>,
): PilarRow[] {
  const juriIds = Object.keys(scoresPerJuri);
  if (juriIds.length === 0) return [];
  return matrix.indikator.flatMap((ind) =>
    ind.pilar.map((p) => ({
      indikatorNama: ind.nama,
      indikatorBobot: ind.bobot,
      pilarNama: p.nama,
      pilarBobot: p.bobot,
      skor:
        juriIds.reduce(
          (s, jid) => s + pilarScoreOf(p, scoresPerJuri[jid] ?? {}),
          0,
        ) / juriIds.length,
    })),
  );
}

function IdentityUpload({
  inputId,
  label,
  done,
  hint,
  onChange,
}: {
  inputId: string;
  label: string;
  done: boolean;
  hint?: string;
  onChange: (file?: File) => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={done ? "default" : "outline"}>
          {done ? "Terlampir" : "Wajib"}
        </Badge>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(event) => {
          onChange(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {done ? "Ganti Foto" : "Unggah Foto"}
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {hint ?? "JPG/PNG, maksimal 1 MB."}
      </p>
    </div>
  );
}

function readVideoMetadata(
  file: File,
): Promise<{ duration: number; ratio: number }> {
  return new Promise((resolve, reject) => {
    const element = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const result = {
        duration: element.duration,
        ratio: element.videoWidth / Math.max(1, element.videoHeight),
      };
      cleanup();
      Number.isFinite(result.duration)
        ? resolve(result)
        : reject(new Error("Metadata video tidak dapat dibaca."));
    };
    element.onerror = () => {
      cleanup();
      reject(new Error("Berkas video rusak atau formatnya tidak didukung."));
    };
    element.src = url;
  });
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printSertifikat(
  sg: SanggarUser,
  na: number,
  predikat: string,
  bands: PredikatBand[],
) {
  const body = safeHtml`<div style="border:14px double #d4a64e;margin:24px;padding:60px;text-align:center;background:linear-gradient(135deg,#04200f,#0a3a1d 50%,#5c1f0c);min-height:80vh;color:#fef3d4">
      <div style="font-size:14px;letter-spacing:6px;color:#d4a64e">SERTIFIKAT KURASI SANGGAR</div>
      <h1 style="font-size:36px;margin:16px 0;color:#fef3d4">${sg.namaSanggar}</h1>
      <div style="margin-top:24px;color:#fef3d4cc">Telah lulus Kurasi Sanggar Jak Sanggar dengan</div>
      <div style="font-size:64px;margin:12px 0;color:#d4a64e;text-shadow:0 0 20px #d4a64e88"><b>${na.toFixed(2)}</b></div>
      <div style="font-size:24px;letter-spacing:4px;color:#fef3d4">PREDIKAT: <b style="color:#d4a64e">${predikat}</b></div>
      <div style="margin-top:8px;font-size:13px;color:#fef3d4cc">${predikatTingkat(predikat, bands)}</div>
      <div style="margin-top:48px;font-size:12px;color:#fef3d488">Diterbitkan otomatis oleh Sistem Jak Sanggar · ${new Date().toLocaleDateString("id-ID")}</div>
    </div>`;
  openPrintWindow({
    title: "Sertifikat Kurasi",
    bodyHtml: body,
    bodyStyle:
      "font-family:Georgia,serif;padding:0;margin:0;background:#04200f",
  });
}
