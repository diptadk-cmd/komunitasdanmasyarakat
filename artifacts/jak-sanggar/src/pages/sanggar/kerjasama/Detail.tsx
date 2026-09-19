import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth, useDb } from "@/lib/auth";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/store";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  SATUAN_LABEL,
  updateKerjasamaStatus,
  sendChat,
  sendNegosiasi,
  applyNegosiasi,
  issueInvoice,
  recordPayment,
  verifyPayment,
  ensureContract,
  ensureBastDraft,
  finalizeBast,
  submitRating,
  fileToDataUrl,
  findUserById,
  MAX_BUKTI_PEMBAYARAN_BYTES,
} from "@/lib/kerjasama";
import { downloadDokumenKerjasamaSanggar } from "@/lib/dokumen-perdagangan";
import { load as loadDb } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { SanggarUser, AnyUser, Kerjasama } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Check,
  X,
  FileText,
  Receipt,
  ScrollText,
  FileCheck2,
  Star,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  ArrowRight,
  Upload,
} from "lucide-react";

function getDisplay(u: AnyUser | undefined): string {
  if (!u) return "—";
  if ("namaSanggar" in u) return u.namaSanggar;
  if ("nama" in u) return (u as any).nama;
  return u.username;
}

export default function KerjasamaDetail() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const k = db.kerjasama.find((x) => x.id === params.id);
  if (!k)
    return (
      <div className="p-6">
        <PageHeader
          title="Tidak ditemukan"
          backTo="/sanggar/kerjasama/permintaan"
        />
        <p>Transaksi kerjasama tidak ditemukan.</p>
      </div>
    );

  const isPenyedia = k.sanggarPenyediaId === sg.id;
  const isPeminjam = k.sanggarPeminjamId === sg.id;
  if (!isPenyedia && !isPeminjam)
    return (
      <div className="p-6">
        <PageHeader
          title="Akses ditolak"
          backTo="/sanggar/kerjasama/permintaan"
        />
        <p>Kerjasama ini bukan milik sanggar Anda.</p>
      </div>
    );
  const lawan = db.users.find(
    (u) => u.id === (isPenyedia ? k.sanggarPeminjamId : k.sanggarPenyediaId),
  ) as SanggarUser | undefined;
  const sumberUser = k.sumberType.startsWith("sdm-")
    ? findUserById(k.sumberId)
    : undefined;
  const dealReached = ["diterima", "berjalan", "selesai"].includes(k.status);
  const actor = { id: sg.id, role: "sanggar" as const };

  const messages = db.chatMessages
    .filter((m) => m.kerjasamaId === k.id)
    .sort((a, b) => a.ts - b.ts);
  const negos = db.negosiasi
    .filter((n) => n.kerjasamaId === k.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const invoice = db.invoices.find((i) => i.kerjasamaId === k.id);
  const pays = invoice
    ? db.payments
        .filter((p) => p.invoiceId === invoice.id)
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];
  const contract = db.contracts.find((c) => c.kerjasamaId === k.id);
  const bast = db.bast.find((b) => b.kerjasamaId === k.id);
  const rating = db.ratings.find(
    (r) => r.kerjasamaId === k.id && r.dariSanggarId === sg.id,
  );

  return (
    <div>
      <PageHeader
        title={`Kerjasama ${k.nomor}`}
        subtitle={k.judul}
        backTo="/sanggar/kerjasama/permintaan"
        actions={
          <span
            className={`text-xs px-3 py-1 rounded border ${STATUS_COLOR[k.status]}`}
          >
            {STATUS_LABEL[k.status]}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-serif text-lg">{k.judul}</div>
            <Badge variant="outline" className="text-xs">
              {k.kategori.replace("_", " ")}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Periode</div>
              {fmtDate(k.tanggalMulai)} – {fmtDate(k.tanggalSelesai)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Jumlah</div>
              {k.jumlah}{" "}
              <span className="text-xs text-muted-foreground">
                {SATUAN_LABEL[k.satuanHarga]}
              </span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Lokasi Kegiatan
              </div>
              {k.lokasi || "—"}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nilai Total</div>
              <span className="font-semibold">{fmtRp(k.nilaiTotal)}</span>
            </div>
          </div>
          {k.deskripsi && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <div className="text-[11px] uppercase mb-1">
                Deskripsi Kebutuhan
              </div>
              {k.deskripsi}
            </div>
          )}
        </Card>
        <Card className="p-4 space-y-3 text-sm">
          <div className="text-xs text-muted-foreground uppercase">
            Mitra Kerjasama
          </div>
          <div>
            <div className="font-medium">{lawan?.namaSanggar ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {isPenyedia ? "Peminjam" : "Penyedia"}
            </div>
          </div>
          {sumberUser && (
            <div className="border-t pt-2 text-xs">
              <div className="text-[11px] uppercase text-muted-foreground mb-1">
                SDM Terkait
              </div>
              <div className="font-medium">{getDisplay(sumberUser)}</div>
              <div className="text-muted-foreground">
                {(sumberUser as any).keahlian ||
                  (sumberUser as any).jenisKesenian}
              </div>
            </div>
          )}
          {dealReached ? (
            <div className="border-t pt-2 text-xs space-y-1">
              <div className="text-[11px] uppercase text-muted-foreground mb-1">
                Kontak (terbuka setelah deal)
              </div>
              {lawan?.noHp && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lawan.noHp}
                </div>
              )}
              {lawan?.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {lawan.email}
                </div>
              )}
              {lawan?.alamat && (
                <div className="text-muted-foreground">{lawan.alamat}</div>
              )}
            </div>
          ) : (
            <div className="border-t pt-2 text-xs text-muted-foreground italic">
              Kontak pribadi terbuka setelah kerjasama disepakati.
            </div>
          )}
        </Card>
      </div>

      <ActionBar
        k={k}
        sg={sg}
        isPenyedia={isPenyedia}
        isPeminjam={isPeminjam}
        actor={actor}
      />

      <Tabs defaultValue="chat" className="mt-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="chat">Chat ({messages.length})</TabsTrigger>
          <TabsTrigger value="nego">Negosiasi ({negos.length})</TabsTrigger>
          <TabsTrigger value="bayar">Invoice & Bayar</TabsTrigger>
          <TabsTrigger value="dokumen">Kontrak & BAST</TabsTrigger>
          <TabsTrigger value="rating">Rating</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ChatPanel kerjasamaId={k.id} sg={sg} messages={messages} />
        </TabsContent>

        <TabsContent value="nego">
          <NegoPanel
            k={k}
            sg={sg}
            negos={negos}
            isPenyedia={isPenyedia}
            actor={actor}
          />
        </TabsContent>

        <TabsContent value="bayar">
          <BayarPanel
            k={k}
            sg={sg}
            invoice={invoice}
            pays={pays}
            isPenyedia={isPenyedia}
            isPeminjam={isPeminjam}
            actor={actor}
          />
        </TabsContent>

        <TabsContent value="dokumen">
          <DokumenPanel
            k={k}
            sg={sg}
            lawan={lawan}
            contract={contract}
            bast={bast}
            invoice={invoice}
            actor={actor}
          />
        </TabsContent>

        <TabsContent value="rating">
          <RatingPanel k={k} sg={sg} rating={rating} actor={actor} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionBar({
  k,
  isPenyedia,
  isPeminjam,
  actor,
}: {
  k: Kerjasama;
  sg: SanggarUser;
  isPenyedia: boolean;
  isPeminjam: boolean;
  actor: any;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  if (k.status === "menunggu" && isPenyedia) {
    return (
      <Card className="p-3 flex flex-wrap items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        <span className="text-sm">Permintaan menunggu tanggapan Anda.</span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const r = updateKerjasamaStatus(k.id, "ditolak", actor);
              toast({
                title: r.ok ? "Permintaan ditolak" : "Gagal",
                description: r.reason,
                variant: r.ok ? undefined : "destructive",
              });
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Tolak
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const r = updateKerjasamaStatus(k.id, "diterima", actor);
              toast({
                title: r.ok ? "Permintaan diterima" : "Gagal",
                description: r.reason,
                variant: r.ok ? undefined : "destructive",
              });
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Terima
          </Button>
        </div>
      </Card>
    );
  }
  if (k.status === "menunggu" && isPeminjam) {
    return (
      <Card className="p-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        <span className="text-sm">
          Permintaan terkirim, menunggu konfirmasi penyedia.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            const r = updateKerjasamaStatus(k.id, "batal", actor);
            toast({
              title: r.ok ? "Permintaan dibatalkan dan dihapus" : "Gagal",
              description: r.reason,
              variant: r.ok ? undefined : "destructive",
            });
            if (r.ok) navigate("/sanggar/kerjasama/permintaan");
          }}
        >
          Batalkan
        </Button>
      </Card>
    );
  }
  if (k.status === "diterima") {
    return (
      <Card className="p-3 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        <span className="text-sm">
          Kerjasama disepakati. Lanjutkan ke{" "}
          <span className="font-semibold">Invoice & Bayar</span> untuk
          menerbitkan invoice.
        </span>
      </Card>
    );
  }
  return null;
}

// ============= CHAT =============
function ChatPanel({
  kerjasamaId,
  sg,
  messages,
}: {
  kerjasamaId: string;
  sg: SanggarUser;
  messages: any[];
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  return (
    <Card className="p-4">
      <div className="border rounded h-72 overflow-y-auto p-3 space-y-2 bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Belum ada pesan. Mulai diskusi dengan mitra Anda.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === sg.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-background border"}`}
              >
                {!mine && (
                  <div className="text-[11px] font-semibold opacity-85 mb-0.5">
                    {m.senderName}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {m.message}
                </div>
                <div
                  className={`text-[11px] mt-1 ${mine ? "font-medium opacity-90" : "text-muted-foreground"}`}
                >
                  {fmtDateTime(m.ts)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          placeholder="Tulis pesan..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              const r = sendChat({
                kerjasamaId,
                senderId: sg.id,
                senderName: sg.namaSanggar,
                senderRole: "sanggar",
                message: text.trim(),
                actor: { id: sg.id, role: "sanggar" },
              });
              if (r.ok) setText("");
              else
                toast({
                  title: "Gagal",
                  description: r.reason,
                  variant: "destructive",
                });
            }
          }}
        />
        <Button
          onClick={() => {
            if (text.trim()) {
              const r = sendChat({
                kerjasamaId,
                senderId: sg.id,
                senderName: sg.namaSanggar,
                senderRole: "sanggar",
                message: text.trim(),
                actor: { id: sg.id, role: "sanggar" },
              });
              if (r.ok) setText("");
              else
                toast({
                  title: "Gagal",
                  description: r.reason,
                  variant: "destructive",
                });
            }
          }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

// ============= NEGOSIASI =============
function NegoPanel({
  k,
  sg,
  negos,
  actor,
}: {
  k: Kerjasama;
  sg: SanggarUser;
  negos: any[];
  isPenyedia: boolean;
  actor: any;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [harga, setHarga] = useState(k.hargaAwal);
  const [catatan, setCatatan] = useState("");
  const allowSubmit = ["menunggu", "negosiasi"].includes(k.status);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">
            Harga awal:{" "}
            <span className="font-medium">{fmtRp(k.hargaAwal)}</span>{" "}
            {SATUAN_LABEL[k.satuanHarga]}
          </div>
          <div className="text-sm">
            Nilai disepakati:{" "}
            <span className="font-semibold">{fmtRp(k.nilaiTotal)}</span>
          </div>
        </div>
        {allowSubmit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Ajukan Tawaran
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajukan Harga Negosiasi</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>
                    Harga Tawar (per {k.satuanHarga.replace("per_", "")})
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={harga}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setHarga(Number.isFinite(next) ? Math.max(1, next) : 1);
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Nilai total final:{" "}
                  <span className="font-medium">
                    {fmtRp(harga * Math.max(1, k.jumlah))}
                  </span>
                </div>
                <div>
                  <Label>Catatan</Label>
                  <Textarea
                    rows={2}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => {
                    const r = sendNegosiasi({
                      kerjasamaId: k.id,
                      pengirimSanggarId: sg.id,
                      pengirimUserId: sg.id,
                      hargaTawar: harga,
                      catatan,
                      actor,
                    });
                    toast({
                      title: r.ok ? "Tawaran terkirim" : "Gagal",
                      description: r.reason,
                      variant: r.ok ? undefined : "destructive",
                    });
                    if (r.ok) setOpen(false);
                  }}
                >
                  Kirim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Separator />
      <div className="space-y-2">
        {negos.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Belum ada tawaran.
          </div>
        )}
        {negos.map((n: any) => {
          const fromMe = n.pengirimSanggarId === sg.id;
          const canApply = !fromMe && n.status === "diajukan" && allowSubmit;
          return (
            <div key={n.id} className="border rounded p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDateTime(n.createdAt)} ·{" "}
                    {fromMe ? "dari Anda" : "dari mitra"}
                  </div>
                  <div className="font-semibold mt-1">
                    {fmtRp(n.hargaTawar)}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      {SATUAN_LABEL[k.satuanHarga]}
                    </span>
                  </div>
                  {n.catatan && <div className="text-xs mt-1">{n.catatan}</div>}
                </div>
                <Badge
                  variant={
                    n.status === "diterima"
                      ? "default"
                      : n.status === "ditolak"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {n.status}
                </Badge>
              </div>
              {canApply && (
                <div className="flex gap-2 mt-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = applyNegosiasi(n.id, false, actor);
                      toast({
                        title: r.ok ? "Tawaran ditolak" : "Gagal",
                        description: r.reason,
                        variant: r.ok ? undefined : "destructive",
                      });
                    }}
                  >
                    Tolak
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const r = applyNegosiasi(n.id, true, actor);
                      toast({
                        title: r.ok
                          ? "Tawaran diterima — kerjasama disepakati"
                          : "Gagal",
                        description: r.reason,
                        variant: r.ok ? undefined : "destructive",
                      });
                    }}
                  >
                    Terima
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============= BAYAR =============
function BayarPanel({
  k,
  sg,
  invoice,
  pays,
  isPenyedia,
  isPeminjam,
  actor,
}: {
  k: Kerjasama;
  sg: SanggarUser;
  invoice: any;
  pays: any[];
  isPenyedia: boolean;
  isPeminjam: boolean;
  actor: any;
}) {
  const { toast } = useToast();
  const [days, setDays] = useState(7);
  const [bayar, setBayar] = useState({
    nominal: invoice?.total ?? k.nilaiTotal,
    tanggal: new Date().toISOString().slice(0, 10),
    bukti: undefined as string | undefined,
  });
  const [verOpen, setVerOpen] = useState<string | null>(null);
  const [verCatatan, setVerCatatan] = useState("");

  if (!["diterima", "berjalan", "selesai"].includes(k.status)) {
    return (
      <Card className="p-6 text-sm text-center text-muted-foreground">
        Invoice baru bisa diterbitkan setelah kerjasama disepakati.
      </Card>
    );
  }

  const downloadInvoice = () => {
    if (!invoice) return;
    const penyedia = findUserById(k.sanggarPenyediaId) as
      | SanggarUser
      | undefined;
    const pembeli = findUserById(k.sanggarPeminjamId) as
      | SanggarUser
      | undefined;
    if (!penyedia || !pembeli) {
      toast({
        title: "Profil para Sanggar belum lengkap.",
        variant: "destructive",
      });
      return;
    }
    const db = loadDb();
    const kontrak = db.contracts.find((item) => item.kerjasamaId === k.id);
    const bast = db.bast.find((item) => item.kerjasamaId === k.id);
    const ownerPwd = loadDb().exportPassword || "kurator123";
    downloadDokumenKerjasamaSanggar(
      "invoice",
      invoice.nomor,
      k,
      penyedia,
      pembeli,
      invoice.status,
      ownerPwd,
      { invoice, pembayaran: pays, kontrakNomor: kontrak?.nomor, bast },
    );
  };

  const downloadKwitansi = () => {
    if (!invoice || invoice.status !== "lunas") return;
    const penyedia = findUserById(k.sanggarPenyediaId) as
      | SanggarUser
      | undefined;
    const pembeli = findUserById(k.sanggarPeminjamId) as
      | SanggarUser
      | undefined;
    if (!penyedia || !pembeli) {
      toast({
        title: "Profil para Sanggar belum lengkap.",
        variant: "destructive",
      });
      return;
    }
    const db = loadDb();
    const kontrak = db.contracts.find((item) => item.kerjasamaId === k.id);
    const bast = db.bast.find((item) => item.kerjasamaId === k.id);
    const suffix = invoice.nomor.replace(/^INV(?:OICE)?[\/-]?/i, "");
    downloadDokumenKerjasamaSanggar(
      "kwitansi",
      `KWITANSI/${suffix}`,
      k,
      penyedia,
      pembeli,
      "lunas",
      loadDb().exportPassword || "kurator123",
      { invoice, pembayaran: pays, kontrakNomor: kontrak?.nomor, bast },
    );
  };

  return (
    <Card className="p-4 space-y-3">
      {!invoice && isPenyedia && (
        <div className="border rounded p-3 bg-muted/30 space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Terbitkan Invoice
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Jatuh Tempo (hari)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                className="w-32"
                value={days}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setDays(
                    Number.isFinite(next)
                      ? Math.min(365, Math.max(1, Math.trunc(next)))
                      : 1,
                  );
                }}
              />
            </div>
            <div className="text-sm">
              Nilai:{" "}
              <span className="font-semibold">{fmtRp(k.nilaiTotal)}</span>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const r = issueInvoice(k.id, days, actor);
                toast({
                  title: r.ok ? "Invoice diterbitkan" : "Gagal",
                  description: r.reason,
                  variant: r.ok ? undefined : "destructive",
                });
              }}
            >
              <Receipt className="h-4 w-4 mr-1" />
              Terbitkan
            </Button>
          </div>
        </div>
      )}
      {!invoice && isPeminjam && (
        <div className="text-sm text-muted-foreground">
          Menunggu penyedia menerbitkan invoice.
        </div>
      )}

      {invoice && (
        <>
          <div className="border rounded p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Invoice</div>
                <div className="font-mono text-sm">{invoice.nomor}</div>
                <div className="text-sm">
                  Total:{" "}
                  <span className="font-semibold">{fmtRp(invoice.total)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Jatuh tempo: {fmtDate(invoice.batasPembayaran)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded border font-semibold ${invoice.status === "lunas" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-rose-100 text-rose-800 border-rose-300"}`}
                >
                  {invoice.status.toUpperCase()}
                </span>
                <Button size="sm" variant="outline" onClick={downloadInvoice}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Preview Invoice
                </Button>
                {invoice.status === "lunas" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadKwitansi}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1" />
                    Preview Kwitansi
                  </Button>
                )}
              </div>
            </div>
          </div>

          {isPeminjam && invoice.status === "terhutang" && (
            <div className="border rounded p-3 bg-muted/30 space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Unggah Bukti Pembayaran
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nominal</Label>
                  <Input
                    type="number"
                    min={1}
                    value={bayar.nominal}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setBayar({
                        ...bayar,
                        nominal: Number.isFinite(next) ? Math.max(1, next) : 1,
                      });
                    }}
                  />
                </div>
                <div>
                  <Label>Tanggal Bayar</Label>
                  <Input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={bayar.tanggal}
                    onChange={(e) =>
                      setBayar({ ...bayar, tanggal: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Bukti Transfer (gambar)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!/^image\/(png|jpeg|webp)$/i.test(f.type)) {
                      toast({
                        title: "Format tidak didukung",
                        description: "Gunakan gambar JPG, PNG, atau WebP.",
                        variant: "destructive",
                      });
                      e.target.value = "";
                      return;
                    }
                    if (f.size > MAX_BUKTI_PEMBAYARAN_BYTES) {
                      toast({
                        title: "Ukuran terlalu besar",
                        description: "Bukti pembayaran maksimal 2 MB.",
                        variant: "destructive",
                      });
                      e.target.value = "";
                      return;
                    }
                    const url = await fileToDataUrl(f);
                    setBayar({ ...bayar, bukti: url });
                  }}
                />
                {bayar.bukti && (
                  <img
                    src={bayar.bukti}
                    alt=""
                    className="mt-2 h-24 rounded border object-cover"
                  />
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!bayar.bukti) {
                      toast({
                        title: "Bukti pembayaran wajib diunggah",
                        variant: "destructive",
                      });
                      return;
                    }
                    const r = recordPayment({
                      invoiceId: invoice.id,
                      nominal: bayar.nominal,
                      tanggalBayar: new Date(bayar.tanggal).getTime(),
                      buktiDataUrl: bayar.bukti,
                      actor,
                    });
                    toast({
                      title: r.ok
                        ? "Pembayaran terkirim, menunggu verifikasi"
                        : "Gagal",
                      description: r.reason,
                      variant: r.ok ? undefined : "destructive",
                    });
                    if (r.ok) setBayar({ ...bayar, bukti: undefined });
                  }}
                >
                  Kirim Bukti
                </Button>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">
              Riwayat Pembayaran
            </div>
            {pays.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Belum ada pembayaran.
              </div>
            )}
            <div className="space-y-2">
              {pays.map((p: any) => (
                <div key={p.id} className="border rounded p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{fmtRp(p.nominal)}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(p.tanggalBayar)} · diunggah{" "}
                        {fmtDateTime(p.createdAt)}
                      </div>
                      {p.catatanVerifikator && (
                        <div className="text-xs mt-1">
                          Catatan: {p.catatanVerifikator}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={
                        p.status === "disetujui"
                          ? "default"
                          : p.status === "ditolak"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {p.status}
                    </Badge>
                  </div>
                  {p.buktiDataUrl && (
                    <img
                      src={p.buktiDataUrl}
                      alt="bukti"
                      className="mt-2 h-24 rounded border object-cover"
                    />
                  )}
                  {isPenyedia && p.status === "menunggu" && (
                    <div className="flex gap-2 mt-2 justify-end">
                      <Dialog
                        open={verOpen === p.id}
                        onOpenChange={(v) => setVerOpen(v ? p.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            Tolak
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Tolak Pembayaran</DialogTitle>
                          </DialogHeader>
                          <Textarea
                            value={verCatatan}
                            onChange={(e) => setVerCatatan(e.target.value)}
                            placeholder="Alasan penolakan..."
                          />
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setVerOpen(null)}
                            >
                              Batal
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                const r = verifyPayment(
                                  p.id,
                                  false,
                                  verCatatan,
                                  actor,
                                );
                                setVerOpen(null);
                                setVerCatatan("");
                                toast({
                                  title: r.ok ? "Pembayaran ditolak" : "Gagal",
                                  description: r.reason,
                                  variant: r.ok ? undefined : "destructive",
                                });
                              }}
                            >
                              Tolak
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="sm"
                        onClick={() => {
                          const r = verifyPayment(p.id, true, undefined, actor);
                          toast({
                            title: r.ok
                              ? "Pembayaran diverifikasi — invoice LUNAS"
                              : "Gagal",
                            description: r.reason,
                            variant: r.ok ? undefined : "destructive",
                          });
                        }}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Setujui
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ============= DOKUMEN =============
function DokumenPanel({
  k,
  sg,
  contract,
  bast,
  invoice,
  actor,
}: {
  k: Kerjasama;
  sg: SanggarUser;
  lawan: any;
  contract: any;
  bast: any;
  invoice: any;
  actor: any;
}) {
  const { toast } = useToast();
  const isLunas = invoice?.status === "lunas";
  const c = contract;
  const b = bast;
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  const canFinalize = isLunas && k.tanggalSelesai <= today;

  const ownerPwd = () => loadDb().exportPassword || "kurator123";
  const penyediaUser = findUserById(k.sanggarPenyediaId) as
    | SanggarUser
    | undefined;
  const peminjamUser = findUserById(k.sanggarPeminjamId) as
    | SanggarUser
    | undefined;

  const downloadKontrak = () => {
    const cur = c ?? ensureContract(k.id, actor);
    if (!cur) {
      toast({
        title: "Tidak berwenang membuat kontrak.",
        variant: "destructive",
      });
      return;
    }
    if (!penyediaUser || !peminjamUser) {
      toast({
        title: "Profil para pihak belum lengkap.",
        variant: "destructive",
      });
      return;
    }
    downloadDokumenKerjasamaSanggar(
      "kontrak",
      cur.nomor,
      k,
      penyediaUser,
      peminjamUser,
      isLunas ? "Lunas" : "Terhutang",
      ownerPwd(),
      {
        invoice,
        pembayaran: invoice
          ? loadDb().payments.filter((item) => item.invoiceId === invoice.id)
          : [],
        kontrakNomor: cur.nomor,
        bast: loadDb().bast.find((item) => item.kerjasamaId === k.id),
      },
    );
  };
  const downloadBast = () => {
    const cur = b ?? ensureBastDraft(k.id, actor);
    if (!cur) {
      toast({ title: "Tidak berwenang membuat BAST.", variant: "destructive" });
      return;
    }
    if (!penyediaUser || !peminjamUser) {
      toast({
        title: "Profil para pihak belum lengkap.",
        variant: "destructive",
      });
      return;
    }
    downloadDokumenKerjasamaSanggar(
      "bast",
      cur.nomor,
      k,
      penyediaUser,
      peminjamUser,
      cur.status,
      ownerPwd(),
      {
        invoice,
        pembayaran: invoice
          ? loadDb().payments.filter((item) => item.invoiceId === invoice.id)
          : [],
        kontrakNomor: c?.nomor,
        bast: cur,
      },
    );
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="border rounded p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <ScrollText className="h-3.5 w-3.5" />
              Kontrak
            </div>
            <div className="font-mono text-sm mt-1">
              {c?.nomor ?? "(belum dibuat)"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Dapat dipratinjau sejak kerjasama disepakati. Label status
              pembayaran ikut tercetak.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadKontrak}
            disabled={!["diterima", "berjalan", "selesai"].includes(k.status)}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Preview Kontrak
          </Button>
        </div>
      </div>

      <div className="border rounded p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <FileCheck2 className="h-3.5 w-3.5" />
              Berita Acara Serah Terima
            </div>
            <div className="font-mono text-sm mt-1">
              {b?.nomor ?? "(belum dibuat)"}
            </div>
            <div className="text-xs mt-1">
              Status:{" "}
              <Badge variant={b?.status === "final" ? "default" : "secondary"}>
                {(b?.status ?? "draft").toUpperCase()}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              BAST hanya bisa difinalisasi setelah kegiatan selesai dan invoice{" "}
              <span className="font-semibold">LUNAS</span>.
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Button
              size="sm"
              variant="outline"
              onClick={downloadBast}
              disabled={!["diterima", "berjalan", "selesai"].includes(k.status)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Preview BAST
            </Button>
            {b?.status !== "final" && (
              <Button
                size="sm"
                disabled={!canFinalize}
                onClick={() => {
                  const r = finalizeBast(k.id, actor);
                  if (!r.ok) {
                    toast({
                      title: "Tidak bisa finalisasi",
                      description: r.reason,
                      variant: "destructive",
                    });
                    return;
                  }
                  toast({ title: "BAST difinalisasi — kerjasama selesai" });
                }}
              >
                <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                Finalisasi
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============= RATING =============
function RatingPanel({
  k,
  sg,
  rating,
  actor,
}: {
  k: Kerjasama;
  sg: SanggarUser;
  rating: any;
  actor: any;
}) {
  const { toast } = useToast();
  const [val, setVal] = useState<number>(rating?.rating ?? 5);
  const [ulasan, setUlasan] = useState<string>(rating?.ulasan ?? "");
  if (k.status !== "selesai") {
    return (
      <Card className="p-6 text-sm text-center text-muted-foreground">
        Rating tersedia setelah kerjasama selesai (BAST final).
      </Card>
    );
  }
  return (
    <Card className="p-4 space-y-3">
      <div>
        <Label>Rating</Label>
        <div className="flex gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setVal(n)}
              disabled={!!rating}
            >
              <Star
                className={`h-7 w-7 ${n <= val ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Ulasan</Label>
        <Textarea
          rows={3}
          value={ulasan}
          onChange={(e) => setUlasan(e.target.value)}
          disabled={!!rating}
        />
      </div>
      {!rating ? (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              const r = submitRating({
                kerjasamaId: k.id,
                dariSanggarId: sg.id,
                rating: val as any,
                ulasan,
                actor,
              });
              toast({
                title: r.ok ? "Rating tersimpan" : "Gagal",
                description: r.reason,
                variant: r.ok ? undefined : "destructive",
              });
            }}
          >
            Kirim Rating
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Rating sudah dikirim pada {fmtDateTime(rating.createdAt)}.
        </div>
      )}
    </Card>
  );
}
