import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlamatWilayah,
  DKI_PROVINCE_ID,
  DKI_PROVINCE_NAME,
  INDONESIA_PROVINCES,
  Wilayah,
  fetchDistricts,
  fetchProvinces,
  fetchRegencies,
  fetchVillages,
} from "@/lib/regions";
import {
  OFFICIAL_DKI_DISTRICTS,
  OFFICIAL_DKI_REGENCIES,
  OFFICIAL_DKI_VILLAGES,
} from "@/lib/dki-regions";
import { Loader2 } from "lucide-react";

// Data DKI yang tervalidasi disimpan terpisah agar hierarki kota, kecamatan,
// dan kelurahan menggunakan pasangan kode yang konsisten.
// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGI: LOCAL-FIRST
// 1. Tampilkan data lokal SEGERA (tanpa loading)
// 2. Coba fetch dari API di background
// 3. Jika API berhasil & data lebih lengkap → update state
// 4. Jika API gagal → data lokal tetap dipakai, tidak ada error
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  mode: "all-id" | "dki-only";
  value: AlamatWilayah;
  onChange: (next: AlamatWilayah) => void;
  required?: boolean;
  pendingWilayah?: AlamatWilayah;
  onPendingWilayahConsumed?: () => void;
}

export function RegionSelector({
  mode,
  value,
  onChange,
  required,
  pendingWilayah,
  onPendingWilayahConsumed,
}: Props) {
  const [provinces, setProvinces] = useState<Wilayah[]>([]);
  const [regencies, setRegencies] = useState<Wilayah[]>([]);
  const [districts, setDistricts] = useState<Wilayah[]>([]);
  const [villages, setVillages] = useState<Wilayah[]>([]);
  const [loading, setLoading] = useState({
    reg: false,
    dis: false,
    vil: false,
  });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const pendingRef = useRef(pendingWilayah);
  pendingRef.current = pendingWilayah;

  const onPendingConsumedRef = useRef(onPendingWilayahConsumed);
  onPendingConsumedRef.current = onPendingWilayahConsumed;

  // ── 1) PROVINSI ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "dki-only") {
      // Langsung set DKI tanpa fetch
      setProvinces([{ id: DKI_PROVINCE_ID, name: DKI_PROVINCE_NAME }]);
      if (valueRef.current.provinsiId !== DKI_PROVINCE_ID) {
        onChangeRef.current({
          provinsi: DKI_PROVINCE_NAME,
          provinsiId: DKI_PROVINCE_ID,
          kota: undefined,
          kotaId: undefined,
          kecamatan: undefined,
          kecamatanId: undefined,
          kelurahan: undefined,
          kelurahanId: undefined,
        });
      }
      return;
    }
    // Mode all-id: pakai daftar bawaan dulu (instan & tahan offline), lalu
    // perbarui dari API di latar. fetchProvinces sudah mengembalikan daftar
    // bawaan bila API gagal, jadi dropdown tidak pernah kosong.
    setProvinces(INDONESIA_PROVINCES);
    const ctrl = new AbortController();
    fetchProvinces(ctrl.signal)
      .then((rows) => {
        if (rows.length > 0) setProvinces(rows);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [mode]);

  // ── 2) KOTA / KABUPATEN ─────────────────────────────────────────────────
  useEffect(() => {
    const provId = value.provinsiId;
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    if (!provId) return;

    // LOCAL-FIRST: untuk DKI, langsung pakai data lokal
    if (provId === DKI_PROVINCE_ID) {
      setRegencies(OFFICIAL_DKI_REGENCIES);
      // Dataset DKI dipakai konsisten sebagai satu hierarki. Mencampurnya
      // dengan id dari sumber lain setelah pilihan otomatis selesai dapat
      // mengubah label kota yang sudah benar menjadi wilayah lain.
      return;
    }

    // Non-DKI: fetch dari API
    setLoading((s) => ({ ...s, reg: true }));
    const ctrl = new AbortController();
    fetchRegencies(provId, ctrl.signal)
      .then(setRegencies)
      .catch(() => {})
      .finally(() => setLoading((s) => ({ ...s, reg: false })));
    return () => ctrl.abort();
  }, [value.provinsiId]);

  // ── 3) KECAMATAN ────────────────────────────────────────────────────────
  useEffect(() => {
    const regId = value.kotaId;
    setDistricts([]);
    setVillages([]);
    if (!regId) return;

    // LOCAL-FIRST: cek data lokal dulu
    const local = OFFICIAL_DKI_DISTRICTS[regId];
    if (local) {
      setDistricts(local);
      return;
    }

    // Non-DKI: fetch dari API
    setLoading((s) => ({ ...s, dis: true }));
    const ctrl = new AbortController();
    fetchDistricts(regId, ctrl.signal)
      .then(setDistricts)
      .catch(() => {})
      .finally(() => setLoading((s) => ({ ...s, dis: false })));
    return () => ctrl.abort();
  }, [value.kotaId]);

  // ── 4) KELURAHAN ────────────────────────────────────────────────────────
  useEffect(() => {
    const disId = value.kecamatanId;
    setVillages([]);
    if (!disId) return;

    // LOCAL-FIRST: cek data lokal dulu
    const local = OFFICIAL_DKI_VILLAGES[disId];
    if (local) {
      setVillages(local);
      return;
    }

    // Non-DKI: fetch dari API
    setLoading((s) => ({ ...s, vil: true }));
    const ctrl = new AbortController();
    fetchVillages(disId, ctrl.signal)
      .then(setVillages)
      .catch(() => {})
      .finally(() => setLoading((s) => ({ ...s, vil: false })));
    return () => ctrl.abort();
  }, [value.kecamatanId]);

  // ── 5) AUTO-FILL DARI SHARE LOCATION ─────────────────────────────────────
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    // Kode pos tidak bergantung pencocokan nama wilayah — terapkan lebih dulu
    // lalu return agar pencocokan wilayah berjalan di render berikutnya (hindari balapan state).
    if (pending.kodePos && pending.kodePos !== value.kodePos) {
      onChange({ ...value, kodePos: pending.kodePos });
      return;
    }
    const pickMatch = (
      list: Wilayah[],
      ...candidates: Array<string | undefined>
    ) => {
      const norm = (s: string) =>
        s
          .replace(/^(KOTA ADMINISTRASI|KABUPATEN|KOTA|KAB\.?)\s+/i, "")
          .replace(/^(KECAMATAN|KEC\.?)\s+/i, "")
          .replace(/^(KELURAHAN|DESA|KEL\.?)\s+/i, "")
          .replace(/[^A-Z0-9]+/gi, " ")
          .toUpperCase()
          .trim();

      for (const candidate of candidates) {
        if (!candidate) continue;
        const n = norm(candidate);
        if (!n) continue;
        const found = list.find((item) => {
          const itemName = norm(item.name);
          return itemName === n || itemName.includes(n) || n.includes(itemName);
        });
        if (found) return found;
      }
      return undefined;
    };

    // Mode seluruh Indonesia harus memilih provinsi terlebih dahulu. Daftar
    // kota baru dapat dimuat setelah provinsi memiliki id, jadi tahap ini tidak
    // boleh menunggu regencies (itu akan membuat deadlock).
    if (mode === "all-id" && pending.provinsi && provinces.length > 0) {
      const matchedProvinsi = pickMatch(provinces, pending.provinsi);
      if (matchedProvinsi && matchedProvinsi.id !== value.provinsiId) {
        onChange({
          ...value,
          provinsi: matchedProvinsi.name,
          provinsiId: matchedProvinsi.id,
          kota: undefined,
          kotaId: undefined,
          kecamatan: undefined,
          kecamatanId: undefined,
          kelurahan: undefined,
          kelurahanId: undefined,
        });
        return;
      }
    }

    // Pencocokan berikutnya berjalan bertahap (kota → kecamatan → kelurahan).
    // Setiap id yang terisi memicu pemuatan daftar tingkat di bawahnya.
    if (regencies.length === 0) return;

    const matchedKota = pickMatch(regencies, pending.kota);
    const matchedKecamatan = pickMatch(districts, pending.kecamatan);
    const matchedKelurahan = pickMatch(villages, pending.kelurahan);

    if (mode === "dki-only" && matchedKota && matchedKota.id !== value.kotaId) {
      onChange({
        ...value,
        provinsi: DKI_PROVINCE_NAME,
        provinsiId: DKI_PROVINCE_ID,
        kota: matchedKota.name,
        kotaId: matchedKota.id,
        kecamatan: undefined,
        kecamatanId: undefined,
        kelurahan: undefined,
        kelurahanId: undefined,
      });
      return;
    }

    if (
      mode === "dki-only" &&
      matchedKota &&
      matchedKota.id === value.kotaId &&
      matchedKecamatan &&
      matchedKecamatan.id !== value.kecamatanId
    ) {
      onChange({
        ...value,
        kecamatan: matchedKecamatan.name,
        kecamatanId: matchedKecamatan.id,
        kelurahan: undefined,
        kelurahanId: undefined,
      });
      return;
    }

    if (
      mode === "dki-only" &&
      matchedKota &&
      matchedKecamatan &&
      matchedKelurahan &&
      matchedKelurahan.id !== value.kelurahanId
    ) {
      onChange({
        ...value,
        kelurahan: matchedKelurahan.name,
        kelurahanId: matchedKelurahan.id,
      });
      onPendingConsumedRef.current?.();
      return;
    }

    if (mode === "all-id") {
      const next: AlamatWilayah = { ...value };
      let changed = false;

      if (matchedKota && matchedKota.id !== next.kotaId) {
        next.kota = matchedKota.name;
        next.kotaId = matchedKota.id;
        next.kecamatan = undefined;
        next.kecamatanId = undefined;
        next.kelurahan = undefined;
        next.kelurahanId = undefined;
        changed = true;
      }

      if (matchedKecamatan && matchedKecamatan.id !== next.kecamatanId) {
        next.kecamatan = matchedKecamatan.name;
        next.kecamatanId = matchedKecamatan.id;
        next.kelurahan = undefined;
        next.kelurahanId = undefined;
        changed = true;
      }

      if (matchedKelurahan && matchedKelurahan.id !== next.kelurahanId) {
        next.kelurahan = matchedKelurahan.name;
        next.kelurahanId = matchedKelurahan.id;
        changed = true;
      }

      if (changed) {
        onChange(next);
        if (next.kotaId && next.kecamatanId && next.kelurahanId) {
          onPendingConsumedRef.current?.();
        }
      }
    }
  }, [
    mode,
    pendingWilayah,
    provinces,
    regencies,
    districts,
    villages,
    value,
    onChange,
  ]);

  const isProvinceLocked = mode === "dki-only";
  const star = required ? <span className="text-destructive">*</span> : null;

  return (
    <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
      {/* Provinsi */}
      <div className="space-y-1.5">
        <Label>Provinsi {star}</Label>
        <Select
          value={value.provinsiId ?? ""}
          disabled={isProvinceLocked}
          onValueChange={(id) => {
            const p = provinces.find((x) => x.id === id);
            // Abaikan nilai kosong/tak dikenal. Radix Select punya <select>
            // tersembunyi yang dapat memicu onValueChange("") saat value
            // berubah lebih dulu daripada daftar opsi — tanpa guard ini,
            // provinsi ter-reset dan seluruh wilayah ikut kosong (loop).
            if (!p) return;
            onChange({
              provinsi: p.name,
              provinsiId: p.id,
              kota: undefined,
              kotaId: undefined,
              kecamatan: undefined,
              kecamatanId: undefined,
              kelurahan: undefined,
              kelurahanId: undefined,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih provinsi" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isProvinceLocked && (
          <p className="text-[11px] text-muted-foreground">
            Otomatis terkunci untuk wilayah DKI Jakarta.
          </p>
        )}
      </div>

      {/* Kota / Kabupaten */}
      <div className="space-y-1.5">
        <Label>Kota / Kabupaten {star}</Label>
        <Select
          value={value.kotaId ?? ""}
          disabled={!value.provinsiId || loading.reg}
          onValueChange={(id) => {
            const r = regencies.find((x) => x.id === id);
            if (!r) return;
            onChange({
              ...value,
              kota: r.name,
              kotaId: r.id,
              kecamatan: undefined,
              kecamatanId: undefined,
              kelurahan: undefined,
              kelurahanId: undefined,
            });
          }}
        >
          <SelectTrigger>
            {loading.reg ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…
              </span>
            ) : (
              <SelectValue placeholder="Pilih kota/kabupaten" />
            )}
          </SelectTrigger>
          <SelectContent>
            {regencies.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kecamatan */}
      <div className="space-y-1.5">
        <Label>Kecamatan {star}</Label>
        <Select
          value={value.kecamatanId ?? ""}
          disabled={!value.kotaId || loading.dis}
          onValueChange={(id) => {
            const d = districts.find((x) => x.id === id);
            if (!d) return;
            onChange({
              ...value,
              kecamatan: d.name,
              kecamatanId: d.id,
              kelurahan: undefined,
              kelurahanId: undefined,
            });
          }}
        >
          <SelectTrigger>
            {loading.dis ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…
              </span>
            ) : (
              <SelectValue placeholder="Pilih kecamatan" />
            )}
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kelurahan / Desa */}
      <div className="space-y-1.5">
        <Label>Kelurahan / Desa {star}</Label>
        <Select
          value={value.kelurahanId ?? ""}
          disabled={!value.kecamatanId || loading.vil}
          onValueChange={(id) => {
            const v = villages.find((x) => x.id === id);
            if (!v) return;
            onChange({
              ...value,
              kelurahan: v.name,
              kelurahanId: v.id,
            });
          }}
        >
          <SelectTrigger>
            {loading.vil ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…
              </span>
            ) : (
              <SelectValue placeholder="Pilih kelurahan/desa" />
            )}
          </SelectTrigger>
          <SelectContent>
            {villages.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kode Pos */}
      <div className="space-y-1.5">
        <Label>Kode Pos</Label>
        <Input
          inputMode="numeric"
          maxLength={5}
          placeholder="mis. 10110"
          value={value.kodePos ?? ""}
          onChange={(e) => {
            const kodePos = e.target.value.replace(/\D/g, "").slice(0, 5);
            onChange({ ...value, kodePos: kodePos || undefined });
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Otomatis terisi dari GPS bila tersedia; dapat diubah manual.
        </p>
      </div>
    </div>
  );
}
