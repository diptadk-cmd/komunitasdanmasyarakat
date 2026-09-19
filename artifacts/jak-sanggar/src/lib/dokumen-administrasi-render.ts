import type { RenderCtx, TemplateDokumen } from "./dokumen-admin";
import { jabatanPemilik, kopHtml, tanggalCetak } from "./dokumen";
import { kopSuratDkiHtml, ttdDkiHtml, type OpsiStempel } from "./dokumen-dki";
import { tempatTandaTanganDariProvinsi } from "./lokasi-dokumen";

/** Satukan sumber identitas penerbit, penandatangan, dan tanggal dokumen. */
export function rakitDokumenAdministrasi(
  template: TemplateDokumen,
  ctx: RenderCtx,
  opsi: { stempel?: OpsiStempel } = {},
): string {
  const penandatangan = template.ttdOverride?.(ctx);
  const olehInduk = template.id === "penetapan-unit";
  const tanggal =
    ctx.v.tanggalPenetapan?.trim() ||
    ctx.v.tanggalSurat?.trim() ||
    tanggalCetak();
  const kota = tempatTandaTanganDariProvinsi(
    olehInduk ? undefined : ctx.sg.wilayah?.provinsi,
    olehInduk ? ctx.v.alamatInduk : ctx.sg.alamat,
  );
  const kop = olehInduk
    ? kopSuratDkiHtml({
        nama: ctx.v.namaInduk?.trim() || "Organisasi Induk",
        alamat: ctx.v.alamatInduk?.trim(),
      })
    : kopHtml(ctx.sg);
  const ttd = ttdDkiHtml({
    kota,
    tanggal,
    jabatan: penandatangan?.jabatan || jabatanPemilik(ctx.sg),
    nama: penandatangan?.nama || ctx.sg.namaKetua,
    nip: penandatangan ? undefined : ctx.sg.nip,
    stempel: olehInduk ? undefined : opsi.stempel,
  });
  return kop + template.render(ctx) + ttd;
}
