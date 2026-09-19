import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, syncRecordsTable, uploadsTable, usersTable } from "@workspace/db";
import { getObject } from "../lib/storage";
import {
  dedupeCreativeMediaItems,
  isPublishedCreativeMedia,
  normalizeCreativeMediaFields,
  publicMediaUploadId,
} from "../lib/creative-media";
import { publicSanggarFromAccount, publicSanggarDirectoryFromAccount } from "../lib/public-sanggar";

const router: IRouter = Router();

function referencesPublicMedia(value: unknown, id: string): boolean {
  if (typeof value !== "string") return false;
  try {
    return (
      new URL(value, "http://localhost").pathname === `/api/public/media/${id}`
    );
  } catch {
    return false;
  }
}

async function publishedInfoRows() {
  const rows = await db
    .select()
    .from(syncRecordsTable)
    .where(
      and(
        eq(syncRecordsTable.collection, "infoBudaya"),
        isNull(syncRecordsTable.deletedAt),
      ),
    );
  return rows.filter((row) => isPublishedCreativeMedia(row.data));
}

async function activePengrajinRows() {
  return db
    .select({ id: usersTable.id, profile: usersTable.profile })
    .from(usersTable)
    .where(
      and(eq(usersTable.role, "pengrajin"), ne(usersTable.status, "diblokir")),
    );
}

async function activeMitraPengrajinRows() {
  const rows = await db
    .select({ id: usersTable.id, profile: usersTable.profile })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "mitra_pengrajin"),
        ne(usersTable.status, "diblokir"),
      ),
    );
  return rows.filter(
    (row) =>
      (row.profile as Record<string, unknown>)[
        "statusVerifikasiTokoOffline"
      ] === "terverifikasi",
  );
}

function marketplaceMitraForPengrajin(
  pengrajinId: string,
  pengrajinProfile: Record<string, unknown>,
  mitraRows: Array<{ id: string; profile: Record<string, unknown> }>,
) {
  const namaUsaha = String(pengrajinProfile["namaUsaha"] ?? "")
    .trim()
    .toLowerCase();
  const productIds = new Set(
    publicProduk(pengrajinProfile).map((produk) => String(produk.id)),
  );
  const result: Array<Record<string, unknown>> = [];
  for (const row of mitraRows) {
    const profile = row.profile;
    const markets = Array.isArray(profile["marketplace"])
      ? profile["marketplace"].filter(
          (value): value is Record<string, unknown> =>
            !!value && typeof value === "object" && value["aktif"] !== false,
        )
      : [];
    const marketById = new Map(
      markets.map((market) => [String(market["id"] ?? ""), market]),
    );
    const packages = Array.isArray(profile["paketProduk"])
      ? profile["paketProduk"].filter(
          (value): value is Record<string, unknown> =>
            !!value &&
            typeof value === "object" &&
            value["aktif"] !== false &&
            Array.isArray(value["items"]),
        )
      : [];
    for (const bundle of packages) {
      const related = (bundle["items"] as unknown[]).some((value) => {
        if (!value || typeof value !== "object") return false;
        const item = value as Record<string, unknown>;
        return (
          item["pengrajinId"] === pengrajinId ||
          String(item["namaPengrajin"] ?? "")
            .trim()
            .toLowerCase() === namaUsaha ||
          productIds.has(String(item["produkId"] ?? ""))
        );
      });
      if (!related) continue;
      const marketplaceIds = Array.isArray(bundle["marketplaceIds"])
        ? bundle["marketplaceIds"].map(String)
        : [];
      for (const marketplaceId of marketplaceIds) {
        const market = marketById.get(marketplaceId);
        if (!market || typeof market["url"] !== "string") continue;
        result.push({
          mitraId: row.id,
          mitraNama: String(profile["namaUsaha"] ?? "Mitra"),
          paketId: String(bundle["id"] ?? ""),
          paketNama: String(bundle["nama"] ?? "Paket Produk"),
          marketplaceNama: String(market["nama"] ?? "Marketplace"),
          namaToko: String(market["namaToko"] ?? ""),
          url: market["url"],
        });
      }
    }
  }
  return result;
}

function publicProduk(profile: Record<string, unknown>) {
  if (!Array.isArray(profile["produk"])) return [];
  return profile["produk"]
    .filter(
      (value): value is Record<string, unknown> =>
        !!value &&
        typeof value === "object" &&
        value["khasJakarta"] === true &&
        value["statusPublish"] === true &&
        typeof value["id"] === "string" &&
        typeof value["nama"] === "string",
    )
    .map((value) => ({
      id: value["id"],
      nama: value["nama"],
      kategori:
        typeof value["kategori"] === "string"
          ? value["kategori"]
          : "Kerajinan Lainnya",
      deskripsi:
        typeof value["deskripsi"] === "string" ? value["deskripsi"] : "",
      harga:
        typeof value["harga"] === "number" && Number.isFinite(value["harga"])
          ? value["harga"]
          : 0,
      satuan: typeof value["satuan"] === "string" ? value["satuan"] : "buah",
      stok:
        typeof value["stok"] === "number" && Number.isFinite(value["stok"])
          ? value["stok"]
          : undefined,
      fotoUrl:
        typeof value["fotoUrl"] === "string" ? value["fotoUrl"] : undefined,
      fotoDataUrl:
        typeof value["fotoDataUrl"] === "string"
          ? value["fotoDataUrl"]
          : undefined,
      khasJakarta: true,
      tersediaSewaJasa: value["tersediaSewaJasa"] === true,
      terbukaKerjasama: value["terbukaKerjasama"] === true,
      ongkirTermasukHarga: value["ongkirTermasukHarga"] === true,
      cakupanOngkir:
        typeof value["cakupanOngkir"] === "string"
          ? value["cakupanOngkir"]
          : undefined,
      batasOngkir:
        typeof value["batasOngkir"] === "number"
          ? value["batasOngkir"]
          : undefined,
    }));
}

router.get("/public/info-budaya", async (_req: Request, res: Response) => {
  const rows = await publishedInfoRows();
  const baseItems: Array<Record<string, unknown>> = rows.map((row) => ({
    ...row.data,
    id: row.recordId,
  }));
  const uploadIds = [
    ...new Set(
      baseItems
        .map((item) => publicMediaUploadId(item["mediaUrl"]))
        .filter((id): id is string => id !== null),
    ),
  ];
  const uploads =
    uploadIds.length > 0
      ? await db
          .select({
            id: uploadsTable.id,
            contentType: uploadsTable.contentType,
          })
          .from(uploadsTable)
          .where(inArray(uploadsTable.id, uploadIds))
      : [];
  const uploadById = new Map(uploads.map((upload) => [upload.id, upload]));
  const normalized = baseItems.map((item) => {
    const uploadId = publicMediaUploadId(item["mediaUrl"]);
    return normalizeCreativeMediaFields(
      item,
      uploadId ? uploadById.get(uploadId) : undefined,
    );
  });
  // Tidak ada limit/slice: semua karya unik dikembalikan. Dedupe ini hanya
  // membersihkan seed legacy ber-ID acak yang terlanjur tersimpan di server.
  const items = dedupeCreativeMediaItems(normalized);
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60",
  );
  res.json(items);
});

router.get("/public/news", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(syncRecordsTable)
    .where(
      and(
        eq(syncRecordsTable.collection, "news"),
        isNull(syncRecordsTable.deletedAt),
      ),
    );
  const sorted = rows
    .map<Record<string, unknown>>((row) => ({
      ...row.data,
      id: row.recordId,
    }))
    .filter(
      (item) =>
        typeof item["judul"] === "string" && typeof item["isi"] === "string",
    )
    .sort((a, b) => Number(b["createdAt"] ?? 0) - Number(a["createdAt"] ?? 0));
  const unique = new Map<string, Record<string, unknown>>();
  for (const item of sorted) {
    const key = `${String(item["judul"]).trim().toLowerCase()}|${String(
      item["isi"],
    )
      .trim()
      .toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  const items = [...unique.values()];
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60",
  );
  res.json(items);
});

router.get("/public/sanggar-directory", async (_req: Request, res: Response) => {
  const rows = await db.select({
    id: usersTable.id,
    role: usersTable.role,
    status: usersTable.status,
    profile: usersTable.profile,
  }).from(usersTable).where(
    and(eq(usersTable.role, "sanggar"), ne(usersTable.status, "diblokir")),
  );
  const items = rows.map(publicSanggarDirectoryFromAccount)
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.namaSanggar.localeCompare(b.namaSanggar, "id") || a.id.localeCompare(b.id));
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.json(items);
});

router.get("/public/sanggars", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: usersTable.id,
      profile: usersTable.profile,
    })
    .from(usersTable)
    .where(
      and(eq(usersTable.role, "sanggar"), ne(usersTable.status, "diblokir")),
    );

  const items = rows
    .map((row) =>
      publicSanggarFromAccount({
        id: row.id,
        profile: row.profile as Record<string, unknown>,
      }),
    )
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.namaSanggar.localeCompare(b.namaSanggar, "id"));

  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.json(items);
});

router.get("/public/pengrajin", async (_req: Request, res: Response) => {
  const [rows, mitraRowsRaw] = await Promise.all([
    activePengrajinRows(),
    activeMitraPengrajinRows(),
  ]);
  const mitraRows = mitraRowsRaw.map((row) => ({
    id: row.id,
    profile: row.profile as Record<string, unknown>,
  }));

  const items = rows
    .map((row) => {
      const profile = row.profile as Record<string, unknown>;
      if (profile["tokoDipublikasikan"] === false) return null;
      const lat =
        typeof profile["lat"] === "number" && Number.isFinite(profile["lat"])
          ? profile["lat"]
          : undefined;
      const lng =
        typeof profile["lng"] === "number" && Number.isFinite(profile["lng"])
          ? profile["lng"]
          : undefined;
      return {
        id: row.id,
        namaUsaha:
          typeof profile["namaUsaha"] === "string"
            ? profile["namaUsaha"]
            : "Pengrajin Jakarta",
        namaPemilik:
          typeof profile["namaPemilik"] === "string"
            ? profile["namaPemilik"]
            : "",
        bentukUsaha:
          typeof profile["bentukUsaha"] === "string"
            ? profile["bentukUsaha"]
            : "Perorangan",
        namaBadanUsaha:
          typeof profile["namaBadanUsaha"] === "string"
            ? profile["namaBadanUsaha"]
            : undefined,
        jenisKerajinan:
          typeof profile["jenisKerajinan"] === "string"
            ? profile["jenisKerajinan"]
            : "Kerajinan Lainnya",
        produkUnggulan:
          typeof profile["produkUnggulan"] === "string"
            ? profile["produkUnggulan"]
            : "",
        alamat: typeof profile["alamat"] === "string" ? profile["alamat"] : "",
        lat,
        lng,
        deskripsi:
          typeof profile["deskripsi"] === "string"
            ? profile["deskripsi"]
            : undefined,
        website:
          typeof profile["website"] === "string"
            ? profile["website"]
            : undefined,
        instagram:
          typeof profile["instagram"] === "string"
            ? profile["instagram"]
            : undefined,
        statusPkp: profile["statusPkp"] === "pkp" ? "pkp" : "non_pkp",
        email:
          typeof profile["email"] === "string" ? profile["email"] : undefined,
        noHp: typeof profile["noHp"] === "string" ? profile["noHp"] : undefined,
        fotoProfileDataUrl:
          typeof profile["fotoProfileDataUrl"] === "string"
            ? profile["fotoProfileDataUrl"]
            : undefined,
        logoDataUrl:
          typeof profile["logoDataUrl"] === "string"
            ? profile["logoDataUrl"]
            : undefined,
        menerimaSewaJasa: profile["menerimaSewaJasa"] === true,
        menerimaKerjasama: profile["menerimaKerjasama"] === true,
        produk: publicProduk(profile),
        marketplaceMitra: marketplaceMitraForPengrajin(
          row.id,
          profile,
          mitraRows,
        ),
      };
    })
    // Peta hanya memublikasikan entri yang punya koordinat valid di area
    // Indonesia. Alamat tetap tersimpan pada profil, tetapi tidak ditebak.
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null &&
        item.lat !== undefined &&
        item.lng !== undefined &&
        item.lat >= -11 &&
        item.lat <= 6 &&
        item.lng >= 95 &&
        item.lng <= 141,
    )
    .sort((a, b) => a.namaUsaha.localeCompare(b.namaUsaha, "id"));

  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60",
  );
  res.json(items);
});

router.get("/public/mitra-pengrajin", async (_req: Request, res: Response) => {
  const rows = await activeMitraPengrajinRows();
  const items = rows
    .map((row) => {
      const profile = row.profile as Record<string, unknown>;
      return {
        id: row.id,
        namaUsaha: String(profile["namaUsaha"] ?? "Mitra"),
        namaPenanggungJawab: String(profile["namaPenanggungJawab"] ?? "-"),
        bentukUsaha: String(profile["bentukUsaha"] ?? "Perorangan"),
        namaBadanUsaha:
          typeof profile["namaBadanUsaha"] === "string"
            ? profile["namaBadanUsaha"]
            : undefined,
        alamat: String(profile["alamat"] ?? "-"),
        memilikiTokoOffline: profile["memilikiTokoOffline"] === true,
        namaTokoOffline: String(profile["namaTokoOffline"] ?? ""),
        alamatTokoOffline: String(profile["alamatTokoOffline"] ?? ""),
        latTokoOffline:
          typeof profile["latTokoOffline"] === "number" &&
          Number.isFinite(profile["latTokoOffline"])
            ? profile["latTokoOffline"]
            : undefined,
        lngTokoOffline:
          typeof profile["lngTokoOffline"] === "number" &&
          Number.isFinite(profile["lngTokoOffline"])
            ? profile["lngTokoOffline"]
            : undefined,
        statusVerifikasiTokoOffline: "terverifikasi" as const,
        statusPkp: profile["statusPkp"] === "pkp" ? "pkp" : "non_pkp",
        pemotongPajak: profile["pemotongPajak"] === true,
        fotoProfileDataUrl:
          typeof profile["fotoProfileDataUrl"] === "string"
            ? profile["fotoProfileDataUrl"]
            : undefined,
        logoDataUrl:
          typeof profile["logoDataUrl"] === "string"
            ? profile["logoDataUrl"]
            : undefined,
        deskripsi:
          typeof profile["deskripsi"] === "string"
            ? profile["deskripsi"]
            : undefined,
        marketplace: Array.isArray(profile["marketplace"])
          ? profile["marketplace"]
          : [],
      };
    })
    .filter(
      (item) =>
        item.memilikiTokoOffline &&
        item.latTokoOffline !== undefined &&
        item.lngTokoOffline !== undefined &&
        item.latTokoOffline >= -6.5 &&
        item.latTokoOffline <= -5.3 &&
        item.lngTokoOffline >= 106.5 &&
        item.lngTokoOffline <= 107.2,
    )
    .sort((a, b) => a.namaUsaha.localeCompare(b.namaUsaha, "id"));
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60",
  );
  res.json(items);
});

router.get("/public/media/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"] ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: "Id media tidak valid" });
    return;
  }

  const [publications, pengrajinRows] = await Promise.all([
    publishedInfoRows(),
    activePengrajinRows(),
  ]);
  const referencedByCreativeMedia = publications.some((row) =>
    referencesPublicMedia(row.data["mediaUrl"], id),
  );
  const referencedByPengrajin = pengrajinRows.some((row) => {
    const profile = row.profile as Record<string, unknown>;
    if (profile["tokoDipublikasikan"] === false) return false;
    return publicProduk(profile).some((produk) =>
      referencesPublicMedia(produk.fotoUrl, id),
    );
  });
  if (!referencedByCreativeMedia && !referencedByPengrajin) {
    res.status(404).json({ error: "Media belum dipublikasikan" });
    return;
  }

  const uploads = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, id))
    .limit(1);
  const upload = uploads[0];
  // Private conversation audio can never be made public through a generic
  // media reference, including one authored by an administrator.
  if (!upload || upload.storageKey.startsWith("communication-")) {
    res.status(404).json({ error: "Media tidak ditemukan" });
    return;
  }
  const object = await getObject(upload.storageKey);
  if (!object) {
    res.status(404).json({ error: "Berkas media tidak ditemukan" });
    return;
  }

  const contentType = upload.contentType || object.contentType;
  const range = req.headers.range;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const requestedEnd = match?.[2] ? Number(match[2]) : object.sizeBytes - 1;
    const end = Math.min(requestedEnd, object.sizeBytes - 1);
    if (!match || !Number.isInteger(start) || start < 0 || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${object.sizeBytes}`);
      res.end();
      return;
    }
    const body = object.body.subarray(start, end + 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${object.sizeBytes}`);
    res.setHeader("Content-Length", String(body.length));
    res.end(body);
    return;
  }

  res.setHeader("Content-Length", String(object.sizeBytes));
  res.end(object.body);
});

export default router;
