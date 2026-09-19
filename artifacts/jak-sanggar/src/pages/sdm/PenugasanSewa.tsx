// =============================================================
// Halaman SENIMAN/PELATIH untuk inbox penugasan dari pesanan sewa.
//   - PenugasanSewaInbox : daftar penugasan
//   - PenugasanSewaDetail: detail + tombol Terima/Tolak penugasan
//                           dan Setuju kontrak.
// =============================================================
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp } from "@/lib/store";
import { SATUAN_LABEL } from "@/lib/kerjasama";
import {
  STATUS_PEMESANAN_LABEL, STATUS_PEMESANAN_COLOR, AKOMODASI_LABEL,
  listPemesananForActor, konfirmasiSdm, tandaTangan, namaPihak,
  pihakWajib,
} from "@/lib/sewa-flow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, FileSignature, CheckCircle2, XCircle, Inbox,
  Calendar as CalendarIcon, Receipt, FileText,
} from "lucide-react";
import type { PihakSewa } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function PenugasanSewaInbox() {
  const { user } = useAuth();
  const db = useDb();
  if (!user || (user.role !== "pelatih" && user.role !== "seniman")) return null;
  const list = useMemo(
    () => listPemesananForActor({ id: user.id, role: user.role })
      .sort((a, b) => b.createdAt - a.createdAt),
    [db.pemesananSewa, user.id, user.role],
  );

  const baseHref = `/${user.role}`;

  return (
    <div>
      <PageHeader
        title="Penugasan Sewa"
        subtitle="Pesanan sewa yang ditugaskan kepada Anda. Konfirmasi penugasan, lalu setujui kontrak."
      />
      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Belum ada penugasan sewa untuk Anda.
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map(p => (
            <Link key={p.id} href={`${baseHref}/penugasan-sewa/${p.id}`}>
              <Card className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-all" data-testid={`row-penugasan-${p.id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium leading-tight">{p.judul}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.nomor} · Sanggar: {namaPihak(p, "sanggar")} · Penyewa: {namaPihak(p, "sewa")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> {p.tanggalMulai} → {p.tanggalSelesai}
                      <MapPin className="h-3 w-3 ml-2" /> {p.lokasi}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={STATUS_PEMESANAN_COLOR[p.status]}>{STATUS_PEMESANAN_LABEL[p.status]}</Badge>
                    <div className="text-sm font-semibold text-primary mt-1">{fmtRp(p.nilaiTotal)}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PenugasanSewaDetail() {
  const { user } = useAuth();
  const db = useDb();
  const [, params] = useRoute(`/${user?.role}/penugasan-sewa/:id`);
  const { toast } = useToast();
  const [showTolak, setShowTolak] = useState(false);
  const [alasan, setAlasan] = useState("");
  if (!user || (user.role !== "pelatih" && user.role !== "seniman")) return null;
  const id = params?.id ?? "";
  const p = db.pemesananSewa.find(x => x.id === id);
  const baseHref = `/${user.role}`;
  if (!p) {
    return (
      <div>
        <PageHeader title="Pesanan tidak ditemukan" backTo={`${baseHref}/penugasan-sewa`} />
        <Card className="p-8 text-center text-muted-foreground">Pesanan tidak ditemukan.</Card>
      </div>
    );
  }
  if (p.sdmUserId !== user.id) {
    return (
      <div>
        <PageHeader title="Akses ditolak" backTo={`${baseHref}/penugasan-sewa`} />
        <Card className="p-8 text-center text-muted-foreground">Penugasan ini bukan untuk Anda.</Card>
      </div>
    );
  }
  const wajib = pihakWajib(p);
  const inv = p.invoiceId ? db.invoices.find(i => i.id === p.invoiceId) : undefined;
  const contract = db.contracts.find(c => c.kerjasamaId === p.id);
  const bast = p.bastId ? db.bast.find(b => b.id === p.bastId) : undefined;
  const myTtd = p.ttd.find(t => t.pihak === "sdm");

  function doKonfirm(terima: boolean) {
    if (!terima && !alasan.trim()) { toast({ title: "Isi alasan", variant: "destructive" }); return; }
    const r = konfirmasiSdm(p!.id, terima, terima ? undefined : alasan, { id: user!.id, role: user!.role });
    if (!r.ok) { toast({ title: "Gagal", description: r.reason, variant: "destructive" }); return; }
    toast({ title: terima ? "Penugasan diterima" : "Penugasan ditolak" });
    setShowTolak(false);
  }
  function doSign() {
    const r = tandaTangan({ id: p!.id, actor: { id: user!.id, role: user!.role } });
    if (!r.ok) { toast({ title: "Gagal tanda tangan", description: r.reason, variant: "destructive" }); return; }
    toast({ title: "Tanda tangan tersimpan", description: r.semuaTtd ? "Semua pihak sudah setuju — kontrak aktif." : "Menunggu pihak lain." });
  }

  return (
    <div>
      <PageHeader
        title={`Pesanan ${p.nomor}`}
        subtitle={p.judul}
        backTo={`${baseHref}/penugasan-sewa`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="outline" className={STATUS_PEMESANAN_COLOR[p.status]} data-testid="badge-status">{STATUS_PEMESANAN_LABEL[p.status]}</Badge>
              <div className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleString("id-ID")}</div>
            </div>
            {p.alasanTolak && (
              <div className="rounded bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 text-xs p-2 border border-rose-200">
                Alasan: {p.alasanTolak}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm pt-2 border-t mt-2">
              <div>
                <div className="text-xs text-muted-foreground">Tanggal</div>
                <div className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {p.tanggalMulai} → {p.tanggalSelesai}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lokasi</div>
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.lokasi}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Jumlah</div>
                <div>{p.jumlah} {SATUAN_LABEL[p.satuanHarga]}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Akomodasi PP</div>
                <div>{AKOMODASI_LABEL[p.akomodasiPP]}{p.akomodasiPP === "diluar" && ` — ${fmtRp(p.biayaAkomodasi)}`}</div>
              </div>
              {p.catatan && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Catatan dari Penyewa</div>
                  <div className="whitespace-pre-wrap">{p.catatan}</div>
                </div>
              )}
            </div>
            <div className="rounded bg-muted/40 p-3 mt-2 flex items-center justify-between">
              <div className="text-sm">
                <div>{fmtRp(p.hargaDasar)} × {p.jumlah}{p.akomodasiPP === "diluar" && p.biayaAkomodasi > 0 && ` + ${fmtRp(p.biayaAkomodasi)}`}</div>
              </div>
              <div className="text-xl font-semibold text-primary">{fmtRp(p.nilaiTotal)}</div>
            </div>
          </Card>

          {p.status !== "menunggu_sanggar" && p.status !== "menunggu_sdm" && (
            <Card className="p-4">
              <div className="font-medium flex items-center gap-2 mb-2">
                <FileSignature className="h-4 w-4" /> Kontrak Para Pihak
                {contract && <Badge variant="outline" className="font-mono text-[10px]">{contract.nomor}</Badge>}
              </div>
              <div className="space-y-2">
                {wajib.map(pihak => {
                  const ttd = p.ttd.find(t => t.pihak === pihak);
                  const labelMap: Record<PihakSewa, string> = { sewa: "Penyewa", sanggar: "Sanggar Penyedia", sdm: "Seniman / Pelatih" };
                  return (
                    <div key={pihak} className="flex items-center justify-between rounded border p-2.5">
                      <div>
                        <div className="text-xs text-muted-foreground">{labelMap[pihak]}</div>
                        <div className="text-sm font-medium">{namaPihak(p, pihak)}</div>
                        {ttd && <div className="text-[10px] text-muted-foreground">TTD: {new Date(ttd.ts).toLocaleString("id-ID")}</div>}
                      </div>
                      <div>
                        {ttd ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Sudah Setuju
                          </Badge>
                        ) : pihak === "sdm" && p.status === "menunggu_ttd" ? (
                          <Button size="sm" onClick={doSign} data-testid="button-setuju-sdm">Setuju</Button>
                        ) : (
                          <Badge variant="secondary">Menunggu</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {inv && (
            <Card className="p-4">
              <div className="font-medium flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4" /> Invoice {inv.nomor}
              </div>
              <div className="text-sm">Total {fmtRp(inv.total)} · Status <Badge variant={inv.status === "lunas" ? "default" : "secondary"}>{inv.status}</Badge></div>
            </Card>
          )}

          {bast && (
            <Card className="p-4">
              <div className="font-medium flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" /> BAST {bast.nomor}
              </div>
              <Badge variant={bast.status === "final" ? "default" : "secondary"}>{bast.status}</Badge>
            </Card>
          )}
        </div>

        <div>
          <Card className="p-4 space-y-2">
            <div className="font-medium text-sm">Aksi</div>
            {p.status === "menunggu_sdm" && (
              <>
                <Button onClick={() => doKonfirm(true)} className="w-full gap-2" data-testid="button-terima-tugas">
                  <CheckCircle2 className="h-4 w-4" /> Terima Penugasan
                </Button>
                {!showTolak ? (
                  <Button variant="outline" className="w-full gap-2" onClick={() => setShowTolak(true)} data-testid="button-toggle-tolak-tugas">
                    <XCircle className="h-4 w-4" /> Tolak Penugasan
                  </Button>
                ) : (
                  <div className="border rounded p-2 space-y-2">
                    <Label className="text-xs">Alasan Penolakan</Label>
                    <Textarea rows={2} value={alasan} onChange={e => setAlasan(e.target.value)} data-testid="input-alasan-tolak-sdm" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => doKonfirm(false)} data-testid="button-tolak-tugas-confirm">Tolak</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowTolak(false)}>Batal</Button>
                    </div>
                  </div>
                )}
              </>
            )}
            {p.status === "menunggu_ttd" && !myTtd && (
              <Button onClick={doSign} className="w-full" data-testid="button-setuju-sdm-sidebar">Setuju Kontrak</Button>
            )}
            {p.status === "menunggu_ttd" && myTtd && (
              <div className="text-xs text-muted-foreground">Anda sudah menandatangani. Menunggu pihak lain.</div>
            )}
            {["kontrak_aktif", "menunggu_bayar", "lunas"].includes(p.status) && (
              <div className="text-xs text-muted-foreground">Pembayaran & BAST ditangani oleh sanggar penyedia.</div>
            )}
            {["selesai", "ditolak", "batal"].includes(p.status) && (
              <div className="text-xs text-muted-foreground">Pesanan sudah final.</div>
            )}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Status terakhir diperbarui {new Date(p.updatedAt).toLocaleString("id-ID")}.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
