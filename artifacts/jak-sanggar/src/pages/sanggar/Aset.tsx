import { useState } from "react";
import { useAuth, useDb } from "@/lib/auth";
import { uid } from "@/lib/store";
import { upsertAset, deleteAset, fileToDataUrl, SATUAN_LABEL } from "@/lib/kerjasama";
import { fmtRp } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Aset, AsetKategori, KondisiAset, SanggarUser, SatuanHarga, AkomodasiMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Music2, Shirt } from "lucide-react";

const KATEGORI_LABEL: Record<AsetKategori, string> = { alat_musik: "Alat Musik", kostum: "Kostum" };

function AsetForm({ sg, item, onClose }: { sg: SanggarUser; item?: Aset; onClose: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Aset>(item ?? {
    id: uid(), sanggarId: sg.id, kategori: "alat_musik", nama: "", jenis: "",
    jumlahTotal: 1, jumlahTersedia: 1, kondisi: "baik", hargaSewa: 0,
    satuanHarga: "per_event", statusPublish: true, createdAt: Date.now(),
    akomodasiPP: "diluar", biayaAkomodasi: 0,
  });
  const isKostum = f.kategori === "kostum";
  return (
    <div className="space-y-3">
      <div className={isKostum ? "" : "grid grid-cols-2 gap-3"}>
        <div>
          <Label>Kategori</Label>
          <Select value={f.kategori} onValueChange={v => setF({ ...f, kategori: v as AsetKategori })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alat_musik">Alat Musik</SelectItem>
              <SelectItem value="kostum">Kostum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isKostum && (
          <div>
            <Label>Kondisi</Label>
            <Select value={f.kondisi} onValueChange={v => setF({ ...f, kondisi: v as KondisiAset })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baik">Baik</SelectItem>
                <SelectItem value="perlu_perbaikan">Perlu Perbaikan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div><Label>Nama</Label><Input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} /></div>
      <div>
        <Label>{isKostum ? "Deskripsi Kostum" : "Jenis / Deskripsi singkat"}</Label>
        <Textarea
          rows={isKostum ? 4 : 2}
          value={f.jenis}
          onChange={e => setF({ ...f, jenis: e.target.value })}
          placeholder={isKostum ? "Tulis bebas: jenis kostum, ukuran, warna, kelengkapan, catatan…" : undefined}
        />
      </div>
      {!isKostum && (
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Jumlah Total</Label><Input type="number" min={1} value={f.jumlahTotal} onChange={e => setF({ ...f, jumlahTotal: Number(e.target.value), jumlahTersedia: Math.min(f.jumlahTersedia, Number(e.target.value)) })} /></div>
          <div><Label>Jumlah Tersedia</Label><Input type="number" min={0} max={f.jumlahTotal} value={f.jumlahTersedia} onChange={e => setF({ ...f, jumlahTersedia: Number(e.target.value) })} /></div>
        </div>
      )}
      {!isKostum && (
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
      )}
      {!isKostum && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Akomodasi PP (default)</Label>
              <Select value={f.akomodasiPP ?? "diluar"} onValueChange={v => setF({ ...f, akomodasiPP: v as AkomodasiMode })}>
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
                disabled={(f.akomodasiPP ?? "diluar") === "termasuk"}
                onChange={e => setF({ ...f, biayaAkomodasi: Number(e.target.value) })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Bila "Termasuk", harga sewa sudah mencakup akomodasi PP. Bila "Di luar", penyewa membayar tambahan biaya akomodasi.</p>
        </>
      )}
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
          if (!f.nama.trim()) { toast({ title: "Nama wajib diisi", variant: "destructive" }); return; }
          const r = upsertAset(f, { id: sg.id, role: "sanggar" });
          if (!r.ok) { toast({ title: "Gagal", description: r.reason, variant: "destructive" }); return; }
          toast({ title: "Aset disimpan" }); onClose();
        }}>Simpan</Button>
      </DialogFooter>
    </div>
  );
}

export default function AsetPage() {
  const { user } = useAuth();
  const db = useDb();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Aset | undefined>();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const list = db.aset.filter(a => a.sanggarId === sg.id);
  const alat = list.filter(a => a.kategori === "alat_musik");
  const kostum = list.filter(a => a.kategori === "kostum");

  const renderTable = (items: Aset[]) => (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Nama</TableHead><TableHead>Jenis</TableHead><TableHead>Tersedia</TableHead>
          <TableHead>Kondisi</TableHead><TableHead>Harga</TableHead><TableHead>Publish</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada aset.</TableCell></TableRow>}
          {items.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-medium flex items-center gap-2">
                {a.kategori === "alat_musik" ? <Music2 className="h-4 w-4 text-muted-foreground" /> : <Shirt className="h-4 w-4 text-muted-foreground" />}
                {a.nama}
              </TableCell>
              <TableCell className="text-sm">{a.jenis}</TableCell>
              <TableCell>{a.jumlahTersedia}/{a.jumlahTotal}</TableCell>
              <TableCell><Badge variant={a.kondisi === "baik" ? "secondary" : "destructive"}>{a.kondisi === "baik" ? "Baik" : "Perlu Perbaikan"}</Badge></TableCell>
              <TableCell className="text-sm whitespace-nowrap">{fmtRp(a.hargaSewa)} <span className="text-muted-foreground">{SATUAN_LABEL[a.satuanHarga]}</span></TableCell>
              <TableCell>{a.statusPublish ? <Badge>Publik</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => { setEdit(a); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Hapus aset "${a.nama}"?`)) { const r = deleteAset(a.id, { id: sg.id, role: "sanggar" }); toast({ title: r.ok ? "Aset dihapus" : "Gagal", description: r.reason, variant: r.ok ? undefined : "destructive" }); } }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Aset Sanggar" subtitle="Kelola alat musik & kostum sanggar. Aset terpublikasi otomatis muncul di Katalog Kerjasama."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEdit(undefined); }}>
            <DialogTrigger asChild><Button onClick={() => setEdit(undefined)}><Plus className="h-4 w-4 mr-1" />Tambah Aset</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{edit ? "Ubah Aset" : "Tambah Aset"}</DialogTitle></DialogHeader>
              <AsetForm sg={sg} item={edit} onClose={() => { setOpen(false); setEdit(undefined); }} />
            </DialogContent>
          </Dialog>
        } />
      <Tabs defaultValue="alat">
        <TabsList>
          <TabsTrigger value="alat">Alat Musik ({alat.length})</TabsTrigger>
          <TabsTrigger value="kostum">Kostum ({kostum.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="alat">{renderTable(alat)}</TabsContent>
        <TabsContent value="kostum">{renderTable(kostum)}</TabsContent>
      </Tabs>
    </div>
  );
}
