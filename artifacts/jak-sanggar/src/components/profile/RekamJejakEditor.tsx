import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Palette, Users, Trophy, Award } from "lucide-react";
import type { RekamJejak, RekamJejakItem } from "@/lib/types";
import { normalisasiRekamJejak } from "@/lib/rekam-jejak";
import { uid } from "@/lib/store";
import type { ReactNode } from "react";

const KATEGORI: {
  key: keyof RekamJejak;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    key: "karya",
    label: "Karya",
    hint: "Karya tari, musik, teater, atau ciptaan lain yang pernah dihasilkan.",
    icon: <Palette className="h-4 w-4" />,
  },
  {
    key: "keterlibatan",
    label: "Keterlibatan",
    hint: "Keikutsertaan dalam acara, festival, misi budaya, atau kolaborasi.",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "juara",
    label: "Juara",
    hint: "Prestasi lomba atau kompetisi beserta peringkatnya.",
    icon: <Trophy className="h-4 w-4" />,
  },
  {
    key: "penghargaan",
    label: "Penghargaan Lain",
    hint: "Apresiasi, piagam, atau pengakuan lain di luar kejuaraan.",
    icon: <Award className="h-4 w-4" />,
  },
];

export function RekamJejakEditor({
  value,
  onChange,
  editable,
}: {
  value?: RekamJejak;
  onChange: (v: RekamJejak) => void;
  editable: boolean;
}) {
  const rj = normalisasiRekamJejak(value);

  const setItems = (key: keyof RekamJejak, items: RekamJejakItem[]) =>
    onChange({ ...rj, [key]: items });

  return (
    <div className="space-y-6">
      {KATEGORI.map(({ key, label, hint, icon }) => {
        const items = rj[key];
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-primary">{icon}</span>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
            </div>
            {editable && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}

            {items.length === 0 && !editable && (
              <div className="text-sm text-muted-foreground">Belum ada data.</div>
            )}

            {editable ? (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={it.id} className="flex flex-col sm:flex-row gap-2">
                    <Input
                      className="sm:w-24"
                      placeholder="Tahun"
                      value={it.tahun ?? ""}
                      onChange={e => {
                        const next = [...items];
                        next[i] = { ...it, tahun: e.target.value.replace(/\D/g, "").slice(0, 4) };
                        setItems(key, next);
                      }}
                      data-testid={`input-rj-${key}-tahun-${i}`}
                    />
                    <Input
                      className="flex-1"
                      placeholder={key === "juara" ? "Nama lomba & peringkat (mis. Juara 1 FLS2N DKI)" : `Nama ${label.toLowerCase()}`}
                      value={it.nama}
                      onChange={e => {
                        const next = [...items];
                        next[i] = { ...it, nama: e.target.value };
                        setItems(key, next);
                      }}
                      data-testid={`input-rj-${key}-nama-${i}`}
                    />
                    <Input
                      className="flex-1"
                      placeholder="Keterangan (opsional)"
                      value={it.keterangan ?? ""}
                      onChange={e => {
                        const next = [...items];
                        next[i] = { ...it, keterangan: e.target.value };
                        setItems(key, next);
                      }}
                      data-testid={`input-rj-${key}-keterangan-${i}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      onClick={() => setItems(key, items.filter(x => x.id !== it.id))}
                      aria-label={`Hapus entri ${label}`}
                      data-testid={`button-rj-${key}-hapus-${i}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItems(key, [...items, { id: uid(), nama: "" }])}
                  data-testid={`button-rj-${key}-tambah`}
                >
                  <Plus className="h-4 w-4 mr-1" /> Tambah {label}
                </Button>
              </div>
            ) : (
              items.length > 0 && (
                <ul className="space-y-1.5">
                  {items.map(it => (
                    <li key={it.id} className="flex items-start gap-2 text-sm">
                      {it.tahun && <Badge variant="secondary" className="shrink-0 tabular-nums">{it.tahun}</Badge>}
                      <span>
                        <span className="font-medium">{it.nama}</span>
                        {it.keterangan && <span className="text-muted-foreground"> — {it.keterangan}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
