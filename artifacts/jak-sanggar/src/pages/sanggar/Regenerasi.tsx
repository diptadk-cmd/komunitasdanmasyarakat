import { useAuth, useDb } from "@/lib/auth";
import { fmtDateTime } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileDown, ShieldCheck } from "lucide-react";
import type { SanggarUser } from "@/lib/types";
import { downloadLockedPdf } from "@/lib/pdf";
import { dokumenSanggarPdf } from "@/lib/dokumen";

export default function Regenerasi() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  if (!user || user.role !== "sanggar") return null;
  const sg = user as SanggarUser;
  const events = db.activity.filter(a => a.actorId === sg.id || (a.meta && db.users.some(u => u.id === (a.meta as any).id && (u as any).sanggarId === sg.id)))
    .filter(a => ["approve-member", "promote-pelatih", "dismiss-member", "create-member-direct"].includes(a.action))
    .slice(0, 50);

  const exportPdf = () => {
    try {
      const safeName = sg.namaSanggar.replace(/[^a-zA-Z0-9-_ ]+/g, "").trim() || "sanggar";
      downloadLockedPdf({
        filename: `arsip-regenerasi-${safeName}.pdf`,
        title: `Arsip Regenerasi — ${sg.namaSanggar}`,
        subtitle: `Riwayat mutasi SDM · dibuat ${fmtDateTime(Date.now())}`,
        ownerPassword: db.exportPassword,
        sections: events.length === 0
          ? [{ heading: "Tidak ada riwayat", body: "Belum ada catatan mutasi/keluar masuk SDM yang tercatat." }]
          : undefined,
        table: events.length === 0 ? undefined : {
          head: ["Waktu", "Aksi", "Detail"],
          rows: events.map(e => [
            fmtDateTime(e.ts),
            e.action,
            JSON.stringify(e.meta || {}),
          ]),
        },
        ...dokumenSanggarPdf(sg),
      });
      toast({
        title: "Pratinjau PDF dibuka",
        description: "Periksa dokumen lalu gunakan tombol Download PDF.",
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal membuat PDF", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="Regenerasi (Arsip)"
        subtitle="Riwayat mutasi/keluar masuk SDM Sanggar."
        actions={
          <Button variant="outline" className="gap-2" onClick={exportPdf}>
            <FileDown className="h-4 w-4" />Preview PDF
          </Button>
        }
      />
      <div className="mb-4 flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground/80">
        <ShieldCheck className="h-3.5 w-3.5 text-accent-foreground mt-0.5 shrink-0" />
        <div>
          File PDF ditampilkan dahulu dalam pratinjau dan dapat dibuka tanpa password. Untuk
          mengedit isinya (mengubah/menambah/menghapus konten) diperlukan
          password yang dikelola Kurator pada Pengaturan &gt; Password Edit PDF.
        </div>
      </div>
      <Card className="p-6">
        <ol className="relative border-l border-border ml-2 space-y-4">
          {events.length === 0 && <div className="text-sm text-muted-foreground">Belum ada riwayat.</div>}
          {events.map(e => (
            <li key={e.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
              <div className="text-xs text-muted-foreground">{fmtDateTime(e.ts)}</div>
              <div className="text-sm flex items-center gap-2 mt-0.5"><Badge variant="outline" className="text-[10px]">{e.action}</Badge><span className="text-muted-foreground">{JSON.stringify(e.meta || {})}</span></div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
