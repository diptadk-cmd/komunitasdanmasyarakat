import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePlus, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uid } from "@/lib/store";
import type { FotoGaleriItem } from "@/lib/types";
import { compressImage } from "@/lib/image";

const MAX_KB = 350;
const MAX_ITEMS = 8;

export function GaleriUploader({
  items,
  onChange,
  editable,
}: {
  items: FotoGaleriItem[];
  onChange: (next: FotoGaleriItem[]) => void;
  editable: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [view, setView] = useState<FotoGaleriItem | null>(null);

  const handle = async (files: FileList) => {
    if (items.length + files.length > MAX_ITEMS) {
      toast({ title: `Maksimum ${MAX_ITEMS} foto`, variant: "destructive" });
      return;
    }
    const next = [...items];
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await compressImage(file, { maxDimension: 1_440, maxBytes: MAX_KB * 1024 });
        next.push({ id: uid(), dataUrl, createdAt: Date.now() });
      } catch (error) {
        toast({ title: `${file.name} tidak dapat diproses`, description: error instanceof Error ? error.message : "Coba gambar lain.", variant: "destructive" });
      }
    }
    onChange(next);
  };

  const updateCaption = (id: string, caption: string) => {
    onChange(items.map(it => it.id === id ? { ...it, caption } : it));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-medium">Galeri Foto</div>
          <div className="text-xs text-muted-foreground">{items.length}/{MAX_ITEMS} foto · otomatis dikompres hingga {MAX_KB} KB per foto</div>
        </div>
        {editable && (
          <>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={e => e.target.files && void handle(e.target.files)} />
            <Button type="button" variant="outline" className="gap-2" onClick={() => inputRef.current?.click()} disabled={items.length >= MAX_ITEMS}>
              <ImagePlus className="h-4 w-4" />Tambah Foto
            </Button>
          </>
        )}
      </div>
      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">Belum ada foto di galeri.</Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(it => (
            <Card key={it.id} className="overflow-hidden group">
              <div className="aspect-square bg-muted relative cursor-pointer" onClick={() => setView(it)}>
                <img src={it.dataUrl} alt={it.caption ?? "Foto galeri"} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="h-6 w-6 text-white" />
                </div>
              </div>
              {editable ? (
                <div className="p-2 space-y-1.5">
                  <Input
                    value={it.caption ?? ""}
                    onChange={e => updateCaption(it.id, e.target.value)}
                    placeholder="Caption (opsional)"
                    className="h-8 text-xs"
                  />
                  <Button type="button" variant="ghost" size="sm" className="w-full h-7 gap-1 text-destructive" onClick={() => onChange(items.filter(x => x.id !== it.id))}>
                    <Trash2 className="h-3 w-3" />Hapus
                  </Button>
                </div>
              ) : it.caption ? (
                <div className="p-2 text-xs text-muted-foreground line-clamp-2">{it.caption}</div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!view} onOpenChange={o => !o && setView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{view?.caption ?? "Foto Galeri"}</DialogTitle></DialogHeader>
          {view && <img src={view.dataUrl} alt={view.caption ?? "Foto"} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
