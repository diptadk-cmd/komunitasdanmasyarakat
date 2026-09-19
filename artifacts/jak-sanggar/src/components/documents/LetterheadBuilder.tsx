import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileImage, FileText, ImagePlus } from "lucide-react";
import { localLogo, readLetterheadLogo, renderLetterhead, letterheadPdf, type LetterheadDraft, type LetterheadResult } from "@/lib/letterhead";
import "./letterhead-builder.css";

interface Profile { namaSanggar?: string; namaBadanHukum?: string; alamat?: string; noHp?: string; email?: string; website?: string; logoDataUrl?: string }
export interface LetterheadBuilderProps {
  open: boolean;
  profile?: Profile | null;
  initialLogo?: string;
  onApply: (dataUrl: string) => void;
  onClose: () => void;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function LetterheadBuilder({ open, profile, initialLogo, onApply, onClose }: LetterheadBuilderProps) {
  const profileLogo = localLogo(initialLogo ?? profile?.logoDataUrl);
  const [draft, setDraft] = useState<LetterheadDraft>(() => ({
    name: profile?.namaSanggar ?? "", identity: profile?.namaBadanHukum ?? "", address: profile?.alamat ?? "",
    phone: profile?.noHp ?? "", email: profile?.email ?? "", website: profile?.website ?? "", layout: "classic", logo: profileLogo,
  }));
  const [preview, setPreview] = useState<(LetterheadResult & { key: string }) | null>(null);
  const [renderError, setRenderError] = useState("");
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"" | "logo" | "png" | "pdf">("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const draftKey = JSON.stringify(draft);
  const ready = preview?.key === draftKey && !renderError && !busy;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRenderError("");
    const timer = setTimeout(() => {
      renderLetterhead(draft).then(result => {
        if (!cancelled) setPreview({ ...result, key: draftKey });
      }).catch(error => {
        if (!cancelled) { setPreview(null); setRenderError(error instanceof Error ? error.message : "Kop surat belum dapat dibuat."); }
      });
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft, draftKey, open]);

  function update(key: keyof LetterheadDraft, value: string) {
    setDraft(previous => ({ ...previous, [key]: value })); setActionError(""); setStatus("");
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy("logo"); setActionError(""); setStatus("");
    try {
      const logo = await readLetterheadLogo(file);
      if (mounted.current) update("logo", logo);
    } catch (error) { if (mounted.current) setActionError(error instanceof Error ? error.message : "Logo belum berhasil diunggah."); }
    finally { if (mounted.current) setBusy(""); }
  }
  async function download(format: "png" | "pdf") {
    if (!ready || !preview) return;
    setBusy(format); setActionError(""); setStatus("");
    try {
      const filename = `Kop surat - ${draft.name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 90)}`;
      const blob = format === "pdf" ? await letterheadPdf(preview) : new Blob([Uint8Array.from(atob(preview.dataUrl.split(",")[1]), character => character.charCodeAt(0))], { type: "image/png" });
      downloadBlob(blob, `${filename}.${format}`);
      setStatus(format === "pdf" ? "PDF A4 dengan kop surat berhasil diunduh." : "Gambar kop surat berhasil diunduh.");
    } catch (error) { setActionError(error instanceof Error ? error.message : "Unduhan belum berhasil. Coba kembali."); }
    finally { setBusy(""); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="letterhead-dialog" onCloseAutoFocus={event => {
      event.preventDefault(); document.getElementById("nf-letterhead-builder-open")?.focus();
    }}>
      <DialogHeader className="letterhead-header">
        <DialogTitle>Buat kop surat</DialogTitle>
        <DialogDescription>Susun identitas sanggar. Kop dapat diunduh atau dipakai pada dokumen yang sedang dibuka.</DialogDescription>
      </DialogHeader>
      <div className="letterhead-scroll">
        <div className="letterhead-layout">
          <div className="letterhead-form">
            <fieldset disabled={!!busy}>
              <legend>Identitas organisasi</legend>
              <div className="letterhead-control"><Label htmlFor="lh-name">Nama organisasi <span aria-hidden="true">*</span></Label><Input id="lh-name" value={draft.name} onChange={event => update("name", event.target.value)} maxLength={120} required aria-invalid={!draft.name.trim()} placeholder="Contoh: Sanggar Melati Betawi" /></div>
              <div className="letterhead-control"><Label htmlFor="lh-identity">Identitas tambahan (opsional)</Label><Input id="lh-identity" value={draft.identity} onChange={event => update("identity", event.target.value)} maxLength={140} placeholder="Badan penyelenggara atau bidang kesenian" /></div>
              <div className="letterhead-control"><Label htmlFor="lh-address">Alamat (opsional)</Label><Textarea id="lh-address" rows={2} value={draft.address} onChange={event => update("address", event.target.value)} maxLength={260} /></div>
            </fieldset>
            <fieldset disabled={!!busy}>
              <legend>Kontak (opsional)</legend>
              <div className="letterhead-control"><Label htmlFor="lh-phone">Telepon / WhatsApp</Label><Input id="lh-phone" type="tel" value={draft.phone} onChange={event => update("phone", event.target.value)} maxLength={60} /></div>
              <div className="letterhead-control"><Label htmlFor="lh-email">Email</Label><Input id="lh-email" type="email" value={draft.email} onChange={event => update("email", event.target.value)} maxLength={120} /></div>
              <div className="letterhead-control"><Label htmlFor="lh-website">Situs web</Label><Input id="lh-website" value={draft.website} onChange={event => update("website", event.target.value)} maxLength={140} placeholder="Contoh: sanggar.id" /></div>
            </fieldset>
            <fieldset disabled={!!busy}>
              <legend>Logo dan tata letak</legend>
              <div className="letterhead-logo-row">
                {draft.logo ? <img src={draft.logo} alt="Logo untuk kop surat" /> : <span className="letterhead-no-logo"><ImagePlus aria-hidden="true" />Tanpa logo</span>}
                <div><input ref={inputRef} id="lh-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" tabIndex={-1} aria-label="Berkas logo kop surat" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={!!busy}>{busy === "logo" ? "Memproses logo…" : draft.logo ? "Ganti logo" : "Unggah logo"}</Button>
                  {draft.logo && <Button type="button" variant="ghost" size="sm" onClick={() => update("logo", "")} disabled={!!busy}>Lepas logo</Button>}
                  {profileLogo && draft.logo !== profileLogo && <Button type="button" variant="ghost" size="sm" onClick={() => update("logo", profileLogo)} disabled={!!busy}>Gunakan logo tersimpan</Button>}
                  <p>PNG, JPG, WebP, atau AVIF. Maksimal 8 MB.</p>
                </div>
              </div>
              <div className="letterhead-options" role="radiogroup" aria-label="Tata letak kop surat">
                <label><input type="radio" name="lh-layout" value="classic" checked={draft.layout === "classic"} onChange={() => update("layout", "classic")} /><span><strong>Klasik</strong><small>Teks di tengah, garis ganda</small></span></label>
                <label><input type="radio" name="lh-layout" value="modern" checked={draft.layout === "modern"} onChange={() => update("layout", "modern")} /><span><strong>Modern</strong><small>Teks rata kiri, aksen hijau</small></span></label>
              </div>
            </fieldset>
          </div>
          <section className="letterhead-preview" aria-label="Pratinjau kop surat">
            <h3>Pratinjau langsung</h3>
            <p>Nama dan kontak akan dicetak persis sesuai isian.</p>
            <div className="letterhead-paper" aria-busy={!ready && !renderError && !busy}>
              {preview?.key === draftKey ? <img src={preview.dataUrl} alt={`Pratinjau kop surat ${draft.name}`} /> : <p role="status">{renderError ? "Perbaiki isian untuk menampilkan kop surat." : "Menyiapkan pratinjau…"}</p>}
              <div className="letterhead-paper-lines" aria-hidden="true"><i /><i /><i /></div>
            </div>
            <p className="letterhead-caption">PNG berisi bagian kop saja. PDF berupa satu lembar A4 dengan kop di bagian atas.</p>
            {(renderError || actionError) && <p className="letterhead-error" role="alert">{actionError || renderError}</p>}
            {status && <p className="letterhead-success" role="status">{status}</p>}
          </section>
        </div>
      </div>
      <footer className="letterhead-footer">
        <p>Setelah dipakai, klik <strong>Simpan isian</strong> di Tools Dokumen untuk menyimpannya.</p>
        <div>
          <Button type="button" variant="outline" disabled={!ready} onClick={() => void download("png")}><FileImage className="h-4 w-4" aria-hidden="true" />{busy === "png" ? "Mengunduh…" : "Unduh PNG"}</Button>
          <Button type="button" variant="outline" disabled={!ready} onClick={() => void download("pdf")}><FileText className="h-4 w-4" aria-hidden="true" />{busy === "pdf" ? "Membuat PDF…" : "Unduh PDF kop"}</Button>
          <Button type="button" disabled={!ready} onClick={() => { if (ready && preview) onApply(preview.dataUrl); }}><Download className="h-4 w-4" aria-hidden="true" />Gunakan kop ini</Button>
        </div>
      </footer>
    </DialogContent>
  </Dialog>;
}
