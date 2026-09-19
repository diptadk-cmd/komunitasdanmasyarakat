import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/image";

const MAX_PROFILE_KB = 300;

type PreviewAppearance = "circle" | "square" | "wide";

export function ProfilePhotoUploader({
  value,
  onChange,
  fallbackText,
  appearance = "circle",
  uploadLabel = "Unggah Foto",
  imageLabel = "Foto",
  maxDimension = 768,
  maxBytes = MAX_PROFILE_KB * 1024,
  editable = true,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  fallbackText?: string;
  appearance?: PreviewAppearance;
  uploadLabel?: string;
  imageLabel?: string;
  maxDimension?: number;
  maxBytes?: number;
  editable?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handle = async (file: File) => {
    try {
      onChange(await compressImage(file, { maxDimension, maxBytes }));
    } catch (error) {
      toast({ title: imageLabel + " tidak dapat diproses", description: error instanceof Error ? error.message : "Coba gambar lain.", variant: "destructive" });
    }
  };

  const initial = (fallbackText ?? "?").trim().slice(0, 2).toUpperCase();
  const previewClass =
    appearance === "wide"
      ? "h-28 w-full max-w-xl rounded-md"
      : appearance === "square"
        ? "h-28 w-28 rounded-md"
        : "h-28 w-28 rounded-full";
  const imageClass =
    appearance === "wide"
      ? "h-full w-full object-contain bg-white p-1"
      : "h-full w-full object-cover";

  return (
    <div className={appearance === "wide" ? "space-y-3" : "flex items-center gap-5"}>
      <div className="relative">
        <div className={previewClass + " bg-muted overflow-hidden border-2 border-primary/30 grid place-items-center"}>
          {value ? (
            <img src={value} alt={imageLabel} className={imageClass} />
          ) : (
            <div className="font-serif text-3xl text-muted-foreground flex items-center gap-1">
              {initial || <UserIcon className="h-10 w-10" />}
            </div>
          )}
        </div>
      </div>
      {editable && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handle(file);
            }}
          />
          <Button type="button" variant="outline" className="gap-2" onClick={() => inputRef.current?.click()}>
            <Camera className="h-4 w-4" />{uploadLabel}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => onChange(undefined)}>
              <Trash2 className="h-3.5 w-3.5" />Hapus
            </Button>
          )}
          <div className="text-[11px] text-muted-foreground">JPG/PNG/WebP/AVIF, otomatis dikompres hingga {Math.round(maxBytes / 1024)} KB.</div>
        </div>
      )}
    </div>
  );
}
