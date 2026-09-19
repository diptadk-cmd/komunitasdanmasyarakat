import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Bank, Rekening } from "@/lib/types";

const BANKS: Bank[] = ["BCA", "Mandiri", "DKI", "BRI", "BNI", "BSI", "CIMB"];

export function RekeningEditor({
  value,
  onChange,
  editable,
}: {
  value: Rekening;
  onChange: (next: Rekening) => void;
  editable: boolean;
}) {
  if (!editable) {
    return (
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Bank" v={value.bank} />
        <Field label="No. Rekening" v={value.nomor || "-"} mono />
        <Field label="Atas Nama" v={value.atasNama || "-"} />
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bank</Label>
        <Select value={value.bank} onValueChange={(v) => onChange({ ...value, bank: v as Bank })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">No. Rekening</Label>
        <Input value={value.nomor} inputMode="numeric" onChange={e => onChange({ ...value, nomor: e.target.value.replace(/\D/g, "") })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Atas Nama</Label>
        <Input value={value.atasNama} onChange={e => onChange({ ...value, atasNama: e.target.value })} />
      </div>
    </div>
  );
}

function Field({ label, v, mono }: { label: string; v: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{v}</div>
    </div>
  );
}
