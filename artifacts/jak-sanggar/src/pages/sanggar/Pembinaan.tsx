import React, { useEffect, useRef, useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { save, uid, fmtDateTime, logActivity } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SanggarUser, PelatihUser, SenimanUser } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Award, Camera, ScanLine } from "lucide-react";

export default function Pembinaan() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;

  const members = db.users.filter(u => (u.role === "seniman" || u.role === "pelatih") && (u as any).sanggarId === sg.id && (u as any).status === "aktif") as (PelatihUser | SenimanUser)[];
  const myReg = db.pendaftaranPembinaan.find(p => p.sanggarId === sg.id);
  const [delegasi, setDelegasi] = useState(members[0]?.id ?? "");
  const [setuju, setSetuju] = useState(false);
  const myCertificates = db.sertifikat.filter((item) => item.sanggarId === sg.id);

  const daftar = () => {
    if (!delegasi || !members.some((member) => member.id === delegasi)) {
      toast({ title: "Pilih delegasi aktif", variant: "destructive" });
      return;
    }
    if (!setuju) { toast({ title: "Anda harus menyetujui pernyataan hukum", variant: "destructive" }); return; }
    if (db.pendaftaranPembinaan.some((item) => item.sanggarId === sg.id)) {
      toast({ title: "Sanggar sudah terdaftar", variant: "destructive" });
      return;
    }
    save(d => {
      d.pendaftaranPembinaan.push({ id: uid(), sanggarId: sg.id, delegasiId: delegasi, setuju: true, barcode: `JS-${sg.id.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`, createdAt: Date.now() });
    });
    logActivity(sg.id, "sanggar", "register-pembinaan");
    toast({ title: "Pendaftaran pembinaan disimpan dan dijadwalkan untuk sinkronisasi" });
  };

  const delegasiUser = members.find(m => m.id === myReg?.delegasiId);
  const absen = db.absensiPembinaan.filter(a => a.pesertaId === myReg?.delegasiId);

  return (
    <div>
      <PageHeader title="Pembinaan Manajemen Sanggar" subtitle="Pendaftaran, kartu registrasi, absensi, dan sertifikasi profesi." />

      {!myReg ? (
        <Card className="p-6 max-w-2xl">
          <h3 className="font-serif text-xl">Registrasi Pembinaan</h3>
          <p className="text-sm text-muted-foreground mt-1">Tunjuk satu delegasi sanggar untuk mengikuti program pembinaan.</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5"><Label>Delegasi</Label>
              <Select value={delegasi} onValueChange={setDelegasi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.nama} — {m.role}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-3 text-sm border rounded-md p-3">
              <Checkbox checked={setuju} onCheckedChange={(c) => setSetuju(!!c)} />
              <span>Saya, atas nama Sanggar, menyetujui pernyataan hukum bahwa data yang diberikan benar dan bersedia mengikuti seluruh tahapan pembinaan sesuai ketentuan Pemerintah Provinsi DKI Jakarta.</span>
            </label>
            <Button onClick={daftar}>Daftarkan Sanggar</Button>
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 batik-pattern opacity-30" />
            <div className="relative">
              <div className="text-xs uppercase tracking-wider opacity-75">Kartu Registrasi Pembinaan</div>
              <div className="font-serif text-2xl mt-1">{sg.namaSanggar}</div>
              <div className="text-sm opacity-90 mt-0.5">Delegasi: {delegasiUser?.nama ?? "-"}</div>
              <div className="text-xs opacity-75 mt-0.5">{delegasiUser?.role} · {delegasiUser?.jenisKesenian}</div>
              <div className="mt-6 bg-white p-3 rounded-md inline-block">
                <Barcode value={myReg.barcode} />
                <div className="text-[10px] text-center text-foreground/80 mt-1 font-mono">{myReg.barcode}</div>
              </div>
              <div className="mt-4 text-xs opacity-80">Terdaftar: {fmtDateTime(myReg.createdAt)}</div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-serif text-lg flex items-center gap-2"><ScanLine className="h-5 w-5" /> Sistem Absensi</h3>
            <div className="text-xs text-muted-foreground mt-1">Jam atur Kurator — Pagi maks {db.jamPembinaan.pagiMax}, Siang {db.jamPembinaan.siangStart}-{db.jamPembinaan.siangEnd}, Pulang {db.jamPembinaan.pulangStart}-{db.jamPembinaan.pulangEnd}</div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["pagi", "siang", "pulang"] as const).map(slot => (
                <AbsensiDialog
                  key={slot}
                  slot={slot}
                  sanggarId={sg.id}
                  pesertaId={myReg.delegasiId}
                />
              ))}
            </div>
            <div className="mt-4 space-y-1 text-xs">
              {absen.length === 0 && <div className="text-muted-foreground">Belum ada absensi.</div>}
              {absen.map(a => (
                <div key={a.id} className="flex items-center justify-between border-b py-1.5">
                  <span><Badge variant="outline" className="mr-2">{a.slot}</Badge>{fmtDateTime(a.ts)}</span>
                  <Badge variant={a.validatedByAdminId ? "default" : "secondary"}>{a.validatedByAdminId ? "Tervalidasi" : "Menunggu"}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <h3 className="font-serif text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Sertifikasi Profesi</h3>
            <div className="text-sm text-muted-foreground mt-1">Sertifikat hanya dapat diterbitkan oleh Kurator setelah proses penilaian selesai.</div>
            <div className="mt-4 space-y-2">
              {myCertificates.length === 0 && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Belum ada sertifikat yang diterbitkan Kurator.</div>}
              {myCertificates.map((certificate) => (
                <div key={certificate.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{certificate.jenis}</div>
                    <div className="text-xs text-muted-foreground">{certificate.pemilikNama} · {fmtDateTime(certificate.issuedAt)}</div>
                  </div>
                  <Badge>Diterbitkan</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

type PembinaanSlot = "pagi" | "siang" | "pulang";

function minutesNow(): number {
  const current = new Date();
  return current.getHours() * 60 + current.getMinutes();
}

function parseMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function slotIsOpen(slot: PembinaanSlot, jam: ReturnType<typeof useDb>["jamPembinaan"]): boolean {
  const current = minutesNow();
  if (slot === "pagi") return current <= parseMinutes(jam.pagiMax);
  if (slot === "siang") return current >= parseMinutes(jam.siangStart) && current <= parseMinutes(jam.siangEnd);
  return current >= parseMinutes(jam.pulangStart) && current <= parseMinutes(jam.pulangEnd);
}

function AbsensiDialog({ slot, sanggarId, pesertaId }: { slot: PembinaanSlot; sanggarId: string; pesertaId: string }) {
  const db = useDb();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let stream: MediaStream | null = null;
    setShot(null);
    setPosition(null);
    setCameraReady(false);
    setError("");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
      .then(async (nextStream) => {
        if (!active) return nextStream.getTracks().forEach((track) => track.stop());
        stream = nextStream;
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          await videoRef.current.play();
          if (active) setCameraReady(true);
        }
      })
      .catch(() => setError("Kamera tidak dapat diakses. Periksa izin peramban."));
    navigator.geolocation?.getCurrentPosition(
      (current) => active && setPosition({ lat: current.coords.latitude, lng: current.coords.longitude, accuracy: current.coords.accuracy }),
      () => active && setError("Lokasi GPS tidak dapat dibaca. Periksa izin lokasi."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !position || !video.videoWidth || position.accuracy > 150) {
      toast({ title: position?.accuracy && position.accuracy > 150 ? "Akurasi GPS terlalu rendah" : "Kamera atau GPS belum siap", description: "Gunakan lokasi dengan akurasi maksimal 150 meter.", variant: "destructive" });
      return;
    }
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(0,0,0,.72)";
    context.fillRect(0, 410, 640, 70);
    context.fillStyle = "#fff";
    context.font = "14px monospace";
    context.fillText(new Date().toLocaleString("id-ID"), 12, 438);
    context.fillText(`GPS ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} (±${Math.round(position.accuracy)} m)`, 12, 462);
    setShot(canvas.toDataURL("image/jpeg", 0.68));
  };

  const submit = () => {
    if (!shot || !position) return;
    if (!slotIsOpen(slot, db.jamPembinaan)) {
      toast({ title: "Di luar jadwal absensi", description: "Gunakan slot sesuai jam yang ditetapkan Kurator.", variant: "destructive" });
      return;
    }
    const today = new Date().toDateString();
    if (db.absensiPembinaan.some((item) => item.pesertaId === pesertaId && item.slot === slot && new Date(item.ts).toDateString() === today)) {
      toast({ title: "Absensi slot ini sudah tercatat hari ini", variant: "destructive" });
      return;
    }
    save((data) => data.absensiPembinaan.push({ id: uid(), sanggarId, pesertaId, slot, ts: Date.now(), fotoDataUrl: shot, lat: position.lat, lng: position.lng, accuracy: position.accuracy }));
    logActivity(sanggarId, "sanggar", "absen-pembinaan", { pesertaId, slot, accuracy: position.accuracy });
    toast({ title: "Bukti foto dan GPS disimpan", description: "Absensi dijadwalkan untuk sinkronisasi dan menunggu validasi panitia." });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">{slot.toUpperCase()}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Absensi Pembinaan · {slot.toUpperCase()}</DialogTitle></DialogHeader>
        {!slotIsOpen(slot, db.jamPembinaan) && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Slot ini sedang di luar jam absensi.</div>}
        {!shot ? <div className="space-y-3">
          <video ref={videoRef} className="aspect-video w-full rounded-md bg-muted" />
          <div className="text-xs text-muted-foreground">{position ? `GPS ±${Math.round(position.accuracy)} m` : error || "Membaca kamera dan GPS..."}</div>
          <Button className="w-full gap-2" onClick={capture} disabled={!cameraReady || !position}><Camera className="h-4 w-4" />Ambil Foto GPS</Button>
        </div> : <div className="space-y-3"><img src={shot} alt="Bukti absensi pembinaan" className="w-full rounded-md" /><Button variant="outline" className="w-full" onClick={() => setShot(null)}>Ambil Ulang</Button></div>}
        <canvas ref={canvasRef} className="hidden" />
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={submit} disabled={!shot || !slotIsOpen(slot, db.jamPembinaan)}>Kirim Absensi</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Barcode({ value }: { value: string }) {
  // Pseudo barcode: deterministic stripe widths from char codes
  const bars: number[] = [];
  for (let i = 0; i < value.length; i++) bars.push(((value.charCodeAt(i) % 4) + 1));
  return (
    <svg width="220" height="50" viewBox="0 0 220 50" xmlns="http://www.w3.org/2000/svg">
      {bars.reduce<{ x: number; nodes: React.ReactNode[] }>((acc, w, i) => {
        const fill = i % 2 === 0 ? "#1a1a1a" : "#ffffff";
        const node = <rect key={i} x={acc.x} y="0" width={w * 2} height="50" fill={fill} />;
        return { x: acc.x + w * 2, nodes: [...acc.nodes, node] };
      }, { x: 0, nodes: [] }).nodes}
    </svg>
  );
}
