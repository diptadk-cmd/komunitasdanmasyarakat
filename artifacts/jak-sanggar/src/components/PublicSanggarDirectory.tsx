import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, MapPin, RefreshCw, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DirectorySanggar {
  id: string;
  namaSanggar: string;
  jenisKesenian: string[];
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  logoDataUrl?: string;
  fotoProfileDataUrl?: string;
}

const PAGE_SIZE = 20;
const normalize = (value: string) => value.trim().toLocaleLowerCase("id");
const locationLabel = (item: DirectorySanggar) =>
  [...new Set([item.kelurahan, item.kecamatan, item.kota, item.provinsi].filter(Boolean))].join(", ");

function SanggarLogo({ item }: { item: DirectorySanggar }) {
  const [failed, setFailed] = useState(false);
  const src = item.logoDataUrl || item.fotoProfileDataUrl;
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-[#125a49]">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <Building2 className="h-7 w-7" aria-hidden="true" />
      )}
    </div>
  );
}

export function PublicSanggarDirectory({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [rows, setRows] = useState<DirectorySanggar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    setError("");
    setRows([]);
    setPage(1);
    apiFetch<DirectorySanggar[]>("/api/public/sanggar-directory", { cache: "no-store", signal: controller.signal })
      .then(data => {
        if (!Array.isArray(data)) throw new Error("Invalid directory response");
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError("Daftar sanggar belum dapat dimuat. Periksa koneksi Anda lalu coba lagi.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, attempt]);

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return rows.filter(item => {
      const text = normalize([item.namaSanggar, locationLabel(item), ...item.jenisKesenian].join(" "));
      return terms.every(term => text.includes(term));
    });
  }, [rows, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [query, currentPage]);

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) setQuery(""); onOpenChange(value); }}>
      <DialogContent className="flex max-h-[88dvh] w-[calc(100%-24px)] max-w-3xl flex-col rounded-2xl border-slate-200 bg-white p-5 text-slate-900 sm:p-6" data-tradisi="silent" onCloseAutoFocus={event => { event.preventDefault(); document.getElementById("open-sanggar-directory")?.focus(); }}>
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle className="font-sans text-xl font-bold text-[#123d31]">Direktori Sanggar</DialogTitle>
          <DialogDescription className="mt-1 text-slate-600">
            Temukan sanggar yang sudah terdaftar di JakSanggar.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-5 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            aria-label="Cari nama sanggar, kesenian, atau wilayah"
            placeholder="Cari nama sanggar, kesenian, atau wilayah..."
            value={query}
            onChange={event => { setQuery(event.target.value); setPage(1); }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm outline-none focus:border-[#125a49] focus:ring-2 focus:ring-[#125a49]/20"
          />
          {query && <button type="button" aria-label="Hapus pencarian" onClick={() => { setQuery(""); setPage(1); }} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 py-3 text-xs text-slate-600">
          <p role="status" aria-live="polite">
            {loading ? "Memuat daftar sanggar..." : error ? "Daftar belum tersedia" : query.trim() ? filtered.length + " dari " + rows.length + " sanggar" : rows.length + " sanggar terdaftar"}
          </p>
          <button type="button" disabled={loading} onClick={() => setAttempt(value => value + 1)} className="inline-flex min-h-8 items-center gap-1.5 rounded px-2 font-semibold text-[#125a49] hover:bg-slate-100 disabled:opacity-50" aria-label="Muat ulang direktori sanggar">
            <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "motion-safe:animate-spin" : "")} /> Muat ulang
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {error ? (
            <div role="alert" className="rounded-xl border border-slate-200 p-6 text-center text-sm">
              <p className="text-slate-600">{error}</p>
              <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 rounded-lg bg-[#125a49] px-4 py-2 font-semibold text-white">Coba lagi</button>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Sedang mengambil data sanggar...</div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-slate-200 p-8 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-[#125a49]" aria-hidden="true" />
              <h3 className="font-sans text-base font-semibold">{rows.length ? "Sanggar tidak ditemukan" : "Belum ada sanggar terdaftar"}</h3>
              <p className="mt-2 text-sm text-slate-600">{rows.length ? "Coba nama, jenis kesenian, atau wilayah lain." : "Sanggar yang mendaftar akan tampil di sini."}</p>
            </div>
          ) : (
            <ul aria-label="Daftar sanggar terdaftar" className="grid gap-3 sm:grid-cols-2">
              {visible.map(item => (
                <li key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <SanggarLogo item={item} />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-sans text-sm font-bold leading-5 text-[#123d31]">{item.namaSanggar}</h3>
                    <p className="mt-2 flex items-start gap-1 text-xs leading-5 text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{locationLabel(item) || "Wilayah belum dilengkapi"}</span></p>
                    {item.jenisKesenian.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{item.jenisKesenian.map((art, index) => <span key={art + index} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-[#125a49]">{art}</span>)}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && !error && pageCount > 1 && (
          <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Sebelumnya</button>
            <span>Halaman {currentPage} dari {pageCount}</span>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 disabled:opacity-40">Berikutnya<ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
