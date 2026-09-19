import { useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, MapPin } from "lucide-react";
import { useAuth, useDb } from "@/lib/auth";
import { save, uid } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { PelatihUser, SenimanUser } from "@/lib/types";

/**
 * Halaman bersama untuk Seniman dan Pelatih.
 * Kehadiran disimpan lokal terlebih dahulu lalu dikirim ke API/MariaDB.
 */
export default function AbsensiLatihan() {
  const { user } = useAuth();
  const db = useDb();
  const { toast } = useToast();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (!user || (user.role !== "seniman" && user.role !== "pelatih")) return null;
  const anggota = user as SenimanUser | PelatihUser;
  const jadwal = db.latihan
    .filter((item) => item.sanggarId === anggota.sanggarId)
    .sort((a, b) => `${b.tanggal} ${b.jam}`.localeCompare(`${a.tanggal} ${a.jam}`));
  const localAttendance = db.absensiLatihan.filter((item) => item.userId === anggota.id);
  const attendedIds = useMemo(
    () => new Set(localAttendance.map((item) => item.latihanId)),
    [localAttendance],
  );

  const markAttendance = async (latihanId: string) => {
    if (attendedIds.has(latihanId) || submittingId || !anggota.sanggarId) return;
    setSubmittingId(latihanId);

    let lat: number | undefined;
    let lng: number | undefined;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000,
            maximumAge: 60_000,
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch {
        // GPS opsional: pengguna tetap dapat mengisi absen manual.
      }
    }

    const hadirAt = Date.now();
    const metode = lat != null && lng != null ? "gps" as const : "manual" as const;
    save((draft) => {
      draft.absensiLatihan.push({
        id: uid(),
        latihanId,
        sanggarId: anggota.sanggarId!,
        userId: anggota.id,
        role: anggota.role,
        hadirAt,
        metode,
        lat,
        lng,
      });
      draft.activity.push({
        id: uid(),
        ts: hadirAt,
        actorId: anggota.id,
        actorRole: anggota.role,
        action: "absen-latihan",
        meta: { latihanId, metode },
      });
    });

    try {
      const response = await fetch("/api/absensi-latihan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latihanId,
          sanggarId: anggota.sanggarId,
          metode,
          lat,
          lng,
        }),
      });
      if (response.status === 409) {
        toast({ title: "Kehadiran sudah tercatat di server" });
      } else if (!response.ok) {
        throw new Error("Gagal menyimpan absensi ke server");
      } else {
        toast({
          title: "Kehadiran tercatat",
          description: "Absensi berhasil disinkronkan ke database.",
        });
      }
    } catch {
      toast({
        title: "Kehadiran tersimpan di perangkat",
        description: "Server belum dapat dihubungi. Data tetap ada di perangkat ini.",
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Absen Latihan"
        subtitle={`Tandai kehadiran sebagai ${anggota.role === "pelatih" ? "pelatih" : "seniman"}. GPS bersifat opsional.`}
      />
      <Card className="mb-5 p-4 bg-primary text-primary-foreground">
        <div className="flex items-start gap-3">
          <CalendarCheck className="h-5 w-5 mt-0.5" />
          <div>
            <div className="font-medium">Kehadiran Anda</div>
            <div className="text-sm opacity-85">
              {localAttendance.length} sesi telah ditandai hadir pada perangkat ini.
            </div>
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Tempat</TableHead>
              <TableHead>Materi</TableHead>
              <TableHead className="text-right">Kehadiran</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jadwal.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Belum ada jadwal latihan dari sanggar Anda.
                </TableCell>
              </TableRow>
            )}
            {jadwal.map((item) => {
              const hadir = attendedIds.has(item.id);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.tanggal}</TableCell>
                  <TableCell>{item.jam}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <MapPin className="h-3.5 w-3.5" />{item.tempat}
                    </span>
                  </TableCell>
                  <TableCell>{item.kurikulum}</TableCell>
                  <TableCell className="text-right">
                    {hadir ? (
                      <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Hadir</Badge>
                    ) : (
                      <Button size="sm" onClick={() => markAttendance(item.id)} disabled={submittingId === item.id}>
                        {submittingId === item.id ? "Mencatat…" : "Absen"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
