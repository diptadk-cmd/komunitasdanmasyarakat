import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { uid, fmtRp } from "@/lib/store";
import { upsertSarpras, deleteSarpras, fileToDataUrl, SATUAN_LABEL } from "@/lib/kerjasama";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Sarpras, JenisTempat, SanggarUser, SatuanHarga, AkomodasiMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";

const JENIS_LABEL: Record<JenisTempat, string> = { tempat_latihan: "Tempat Latihan", aula: "Aula", studio: "Studio" };

function SarprasForm({ sg, item, onClose }: { sg: SanggarUser; item?: Sarpras; onClose: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Sarpras>(item ?? {
    id: uid(), sanggarId: sg.id, namaTempat: "", jenisTempat: "tempat_latihan",
    kapasitas: 20, fasilitas: "", alamat: sg.alamat,
    hargaSewa: 0, satuanHarga: "per_jam", statusPublish: true, createdAt: Date.now(),
    akomodasiPP: "termasuk", biayaAkomodasi: 0,
  });
  return (
    <div className="space-y-3">
      <div><Label>Nama Tempat</Label><Input value={f.namaTempat} onChange={e => setF({ ...f, namaTempat: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Jenis Tempat</Label>
          <Select value={f.jenisTempat} onValueChange={v => setF({ ...f, jenisTempat: v as JenisTempat })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tempat_latihan">Tempat Latihan</SelectItem>
              <SelectItem value="aula">Aula</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Kapasitas (orang)</Label><Input type="number" min={1} value={f.kapasitas} onChange={e => setF({ ...f, kapasitas: Number(e.target.value) })} /></div>
      </div>
      <div><Label>Fasilitas</Label><Textarea rows={2} value={f.fasilitas} onChange={e => setF({ ...f, fasilitas: e.target.value })} placeholder="AC, sound, cermin, ..." /></div>
      <div><Label>Alamat</Label><Textarea rows={2} value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Harga Sewa</Label><Input type="number" min={0} value={f.hargaSewa} onChange={e => setF({ ...f, hargaSewa: Number(e.target.value) })} /></div>
        <div>
          <Label>Satuan</Label>
          <Select value={f.satuanHarga} onValueChange={v => setF({ ...f, satuanHarga: v as SatuanHarga })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="per_jam">Per Jam</SelectItem>
              <SelectItem value="per_hari">Per Hari</SelectItem>
              <SelectItem value="per_event">Per Event</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Akomodasi PP (default)</Label>
          <Select value={f.akomodasiPP ?? "termasuk"} onValueChange={v => setF({ ...f, akomodasiPP: v as AkomodasiMode })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="termasuk">Termasuk akomodasi PP</SelectItem>
              <SelectItem value="diluar">Di luar akomodasi PP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Biaya Akomodasi (Rp)</Label>
          <Input type="number" min={0} value={f.biayaAkomodasi ?? 0}
            disabled={(f.akomodasiPP ?? "termasuk") === "termasuk"}
            onChange={e => setF({ ...f, biayaAkomodasi: Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">Tempat fisik biasanya tidak butuh akomodasi PP. Setel jika sanggar perlu mengantar/mengelola alat di lokasi acara.</p>
      <div>
        <Label>Foto (opsional)</Label>
        <Input type="file" accept="image/*" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          const url = await fileToDataUrl(file); setF({ ...f, fotoDataUrl: url });
        }} />
        {f.fotoDataUrl && <img src={f.fotoDataUrl} alt="" className="mt-2 h-24 rounded border object-cover" />}
      </div>
      <div className="flex items-center gap-2"><Switch checked={f.statusPublish} onCheckedChange={v => setF({ ...f, statusPublish: v })} /><Label>Tampilkan di Katalog Kerjasama</Label></div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Batal</Button>
        <Button onClick={() => {
          if (!f.namaTempat.trim()) { toast({ title: "Nama tempat wajib diisi", variant: "destructive" }); return; }
          const r = upsertSarpras(f, { id: sg.id, role: "sanggar" });
          if (!r.ok) { toast({ title: "Gagal", description: r.reason, variant: "destructive" }); return; }
          toast({ title: "Sarana tersimpan" }); onClose();
        }}>Simpan</Button>
      </DialogFooter>
    </div>
  );
}

export default function SarprasPage() {
  const { user } = useAuth();
  const db = useDb();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Sarpras | undefined>();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const list = db.sarpras.filter(s => s.sanggarId === sg.id);

  return (
    <div>
      <PageHeader title="Sarana & Prasarana" subtitle="Kelola tempat latihan/aula/studio. Sarana terpublikasi otomatis muncul di Katalog Kerjasama."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEdit(undefined); }}>
            <DialogTrigger asChild><Button onClick={() => setEdit(undefined)}><Plus className="h-4 w-4 mr-1" />Tambah Sarana</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{edit ? "Ubah Sarana" : "Tambah Sarana"}</DialogTitle></DialogHeader>
              <SarprasForm sg={sg} item={edit} onClose={() => { setOpen(false); setEdit(undefined); }} />
            </DialogContent>
          </Dialog>
        } />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tempat</TableHead><TableHead>Jenis</TableHead><TableHead>Kapasitas</TableHead>
            <TableHead>Harga</TableHead><TableHead>Publish</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada sarana.</TableCell></TableRow>}
            {list.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{s.namaTempat}</TableCell>
                <TableCell><Badge variant="secondary">{JENIS_LABEL[s.jenisTempat]}</Badge></TableCell>
                <TableCell>{s.kapasitas} org</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{fmtRp(s.hargaSewa)} <span className="text-muted-foreground">{SATUAN_LABEL[s.satuanHarga]}</span></TableCell>
                <TableCell>{s.statusPublish ? <Badge>Publik</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEdit(s); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Hapus "${s.namaTempat}"?`)) { const r = deleteSarpras(s.id, { id: sg.id, role: "sanggar" }); toast({ title: r.ok ? "Sarana dihapus" : "Gagal", description: r.reason, variant: r.ok ? undefined : "destructive" }); } }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
