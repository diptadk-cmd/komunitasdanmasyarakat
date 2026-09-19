import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, ExternalLink, LocateFixed } from "lucide-react";
import type { AlamatWilayah } from "@/lib/regions";
import {
  normalizeAlamatFromReverse,
  normalizeWilayahFromReverse,
} from "@/lib/reverse-geocode";

export { normalizeWilayahFromReverse };

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function hasKoordinat(lat?: number, lng?: number): lat is number {
  return typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
}

export function ShareLocation({
  lat,
  lng,
  onChange,
  onAddressResolved,
  mode,
}: {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
  onAddressResolved?: (w: AlamatWilayah, alamatDetail?: string) => void;
  mode?: "gps" | "address";
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const ada = hasKoordinat(lat, lng);

  const resolveAddress = async (latitude: number, longitude: number) => {
    if (!onAddressResolved) return false;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=id&addressdetails=1&zoom=18&layer=address`;
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });
      if (!res.ok) return false;
      const json = (await res.json()) as unknown;
      const hasil = normalizeAlamatFromReverse(json);
      const { wilayah } = hasil;
      if (
        wilayah.provinsi ||
        wilayah.kota ||
        wilayah.kecamatan ||
        wilayah.kelurahan ||
        wilayah.kodePos ||
        hasil.alamatDetail
      ) {
        onAddressResolved(wilayah, hasil.alamatDetail);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const share = async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast({ title: "Lokasi tidak didukung", description: "Peramban ini tidak mendukung berbagi lokasi.", variant: "destructive" });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        onChange(latitude, longitude);
        const alamatTerisi = await resolveAddress(latitude, longitude);
        setLoading(false);
        toast(
          alamatTerisi
            ? {
                title: "Lokasi dan alamat berhasil diisi",
                description:
                  "Nama jalan, wilayah, dan kode pos yang ditemukan telah dimasukkan otomatis.",
              }
            : {
                title: "Koordinat lokasi tersimpan",
                description:
                  "Alamat otomatis tidak ditemukan. Periksa dan lengkapi alamat secara manual.",
              },
        );
      },
      (err) => {
        setLoading(false);
        toast({
          title: "Gagal mengambil lokasi",
          description:
            err.code === err.PERMISSION_DENIED
              ? "Izin lokasi ditolak. Aktifkan izin lokasi di peramban lalu coba lagi."
              : "Tidak dapat mengambil lokasi saat ini. Pastikan GPS aktif lalu coba lagi.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={share} disabled={loading}>
          <LocateFixed className="h-4 w-4" />
          {loading
            ? mode === "address"
              ? "Mencari alamat…"
              : "Mengambil lokasi…"
            : mode === "address"
              ? "Gunakan Lokasi Terkini"
              : ada
                ? "Perbarui Lokasi (GPS)"
                : "Bagikan Lokasi (GPS)"}
        </Button>
        {ada && (
          <a
            href={mapsUrl(lat, lng as number)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Lihat di Google Maps
          </a>
        )}
      </div>
      {ada && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Koordinat: {lat.toFixed(5)}, {(lng as number).toFixed(5)}
        </div>
      )}
    </div>
  );
}
