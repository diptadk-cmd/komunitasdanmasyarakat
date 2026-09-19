import { useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/image";
import { persistSanggarProfile } from "@/lib/store";
import type { SanggarUser } from "@/lib/types";
import { sanggarCoverCandidates, selectSanggarCover, type SanggarCoverCandidate } from "@/lib/sanggar-cover";

export interface SanggarCoverProps {
  sanggar: SanggarUser;
  fallbackSrc: string;
}

/** A keyed editor prevents drafts and broken-image state crossing sanggar accounts. */
export function SanggarCover(props: SanggarCoverProps) {
  return <SanggarCoverEditor key={props.sanggar.id} {...props} />;
}

function CoverVisual({ candidates, name, preview = false }: {
  candidates: SanggarCoverCandidate[];
  name: string;
  preview?: boolean;
}) {
  const [failures, setFailures] = useState<{ candidates: SanggarCoverCandidate[]; sources: Set<string> }>({ candidates, sources: new Set() });
  const failedSources = failures.candidates === candidates ? failures.sources : new Set<string>();
  const selected = selectSanggarCover(candidates, failedSources);
  const illustration = !selected || selected.kind === "illustration";
  return <>
    {selected ? (
      <img
        key={selected.src}
        src={selected.src}
        alt={illustration ? "Ilustrasi kegiatan seni dan budaya sanggar" : `Foto sanggar ${name}`}
        className={preview ? "h-full w-full object-cover" : "sanggar-cover__image"}
        onError={() => setFailures((previous) => ({ candidates, sources: new Set([...(previous.candidates === candidates ? previous.sources : []), selected.src]) }))}
      />
    ) : (
      <div className={preview ? "grid h-full w-full place-items-center bg-amber-50 text-emerald-800" : "sanggar-cover__image grid place-items-center bg-amber-50 text-emerald-800"} role="img" aria-label="Ilustrasi sanggar">
        <Palette className="h-16 w-16" aria-hidden="true" />
      </div>
    )}
    {illustration && <span className={preview ? "absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs text-emerald-900" : "sanggar-cover__badge"}>Ilustrasi sanggar</span>}
  </>;
}

function SanggarCoverEditor({ sanggar, fallbackSrc }: SanggarCoverProps) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | undefined>();
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = saving || processing;
  const candidates = useMemo(() => sanggarCoverCandidates(sanggar, fallbackSrc), [sanggar.fotoSampulDataUrl, sanggar.fotoGaleri, sanggar.fotoProfileDataUrl, fallbackSrc]);
  const previewCandidates = useMemo(() => sanggarCoverCandidates({ ...sanggar, fotoSampulDataUrl: draft }, fallbackSrc), [draft, sanggar.fotoGaleri, sanggar.fotoProfileDataUrl, fallbackSrc]);
  const hasPhoto = candidates.some((candidate) => candidate.kind === "photo");
  const changed = draft !== sanggar.fotoSampulDataUrl;

  const changeOpen = (next: boolean) => {
    if (busy) return;
    if (next) setDraft(sanggar.fotoSampulDataUrl);
    setOpen(next);
  };

  const choosePhoto = async (file: File) => {
    setProcessing(true);
    try {
      setDraft(await compressImage(file, { maxDimension: 1600, maxBytes: 450 * 1024 }));
    } catch (error) {
      toast({ title: "Foto tidak dapat diproses", description: error instanceof Error ? error.message : "Coba gambar lain.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const saveCover = async () => {
    if (!changed || busy || draft === undefined) return;
    setSaving(true);
    try {
      const result = await persistSanggarProfile(sanggar.id, sanggar.apiId, { fotoSampulDataUrl: draft });
      setOpen(false);
      toast(result.server
        ? { title: draft ? "Foto sampul tersimpan" : "Ilustrasi digunakan sebagai sampul" }
        : { title: "Tersimpan sementara (lokal)", description: "Belum tersinkron ke server. Masuk langsung sebagai sanggar ini agar sampul tersimpan permanen." });
    } catch (error) {
      toast({ title: "Gagal menyimpan sampul", description: error instanceof Error ? error.message : "Perubahan belum tersimpan. Coba lagi saat koneksi pulih.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sanggar-cover" aria-label="Sampul sanggar">
      <CoverVisual candidates={candidates} name={sanggar.namaSanggar} />
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <button type="button" className="sanggar-cover__action"><Camera className="h-4 w-4" aria-hidden="true" />{hasPhoto ? "Kelola foto" : "Unggah foto sanggar"}</button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl" onEscapeKeyDown={(event) => busy && event.preventDefault()} onPointerDownOutside={(event) => busy && event.preventDefault()}>
          <DialogHeader className="pr-5">
            <DialogTitle>Foto sampul sanggar</DialogTitle>
            <DialogDescription>Unggah foto kegiatan atau sanggar Anda untuk sampul beranda. Ilustrasi ditampilkan selama belum ada foto. Foto profil dan galeri tetap tersimpan.</DialogDescription>
          </DialogHeader>
          <div className="relative my-5 aspect-[16/10] overflow-hidden rounded-xl border bg-muted" aria-busy={processing}>
            <CoverVisual candidates={previewCandidates} name={sanggar.namaSanggar} preview />
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Pilih foto sampul sanggar" className="sr-only" disabled={busy} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void choosePhoto(file);
          }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()} className="gap-2">
              {processing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              {processing ? "Memproses foto…" : "Pilih foto"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy || draft === ""} onClick={() => setDraft("")} className="gap-2"><Palette className="h-4 w-4" aria-hidden="true" />Gunakan ilustrasi</Button>
          </div>
          <p className="mb-5 mt-2 text-xs leading-relaxed text-muted-foreground">JPG, PNG, WebP, atau AVIF. Foto mendatar paling sesuai; gambar otomatis diperkecil hingga 450 KB.</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Batal</Button>
            <Button type="button" disabled={busy || !changed || draft === undefined} onClick={() => void saveCover()} className="gap-2">{saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{saving ? "Menyimpan…" : "Simpan sampul"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
