const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const TYPES = new Map([
  ["image/png", "png"], ["image/jpeg", "jpg"],
  ["image/webp", "webp"], ["application/pdf", "pdf"],
]);
export const MAX_PAYMENT_AMOUNT = Number.MAX_SAFE_INTEGER;

export function paymentAmount(value: string | number): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Nominal harus berupa rupiah bulat, lebih dari nol, dan tidak melebihi batas angka aman.");
  return amount;
}

export function paymentTotal(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += paymentAmount(amount);
    if (!Number.isSafeInteger(total)) throw new Error("Total nominal melebihi batas angka aman.");
  }
  return total;
}

function imageStructure(bytes: Uint8Array, type: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/png") {
    let offset = 8, imageData = false;
    if (bytes.length < 45 || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return false;
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width * height > 40_000_000) return false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset), end = offset + length + 12;
      if (end > bytes.length) return false;
      const chunk = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (chunk === "IDAT") imageData = true;
      if (chunk === "IEND") return length === 0 && imageData && end === bytes.length;
      offset = end;
    }
    return false;
  }
  if (type === "image/jpeg") return bytes.length > 4 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  return bytes.length >= 20 && view.getUint32(4, true) + 8 === bytes.length;
}

async function verifyBrowserImage(dataUrl: string) {
  // Native browser decoding detects damaged compressed data as well as headers.
  // Node unit tests check container structure and use genuine image fixtures.
  if (typeof Image === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    const failed = () => reject(new Error("Gambar bukti tidak dapat dibuka. Pilih gambar yang utuh."));
    image.onerror = failed;
    image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth * image.naturalHeight <= 40_000_000 ? resolve() : failed();
    image.src = dataUrl;
  });
}

export function receiptExtension(value?: string): string | null {
  if (!value || value.length > MAX_RECEIPT_BYTES * 1.4 + 100) return null;
  const match = /^data:(image\/png|image\/jpeg|image\/webp|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return match && match[2].length % 4 === 0 ? TYPES.get(match[1]) ?? null : null;
}

/** Keep the receipt bytes, rather than a filename that cannot be downloaded. */
export async function readPaymentReceipt(file: File): Promise<string> {
  if (!TYPES.has(file.type)) throw new Error("Gunakan bukti JPG, PNG, WebP, atau PDF.");
  if (!file.size || file.size > MAX_RECEIPT_BYTES) throw new Error("Ukuran bukti harus lebih dari 0 dan maksimal 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.subarray(start, end));
  const valid = file.type === "image/png" ? starts(137, 80, 78, 71, 13, 10, 26, 10)
    : file.type === "image/jpeg" ? starts(255, 216, 255)
    : file.type === "image/webp" ? text(0, 4) === "RIFF" && text(8, 12) === "WEBP"
    : text(0, 5) === "%PDF-" && text(Math.max(0, bytes.length - 1024), bytes.length).includes("%%EOF");
  if (!valid) throw new Error("Isi berkas tidak sesuai format bukti. Pilih berkas yang dapat dibuka.");
  if (file.type === "application/pdf") {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const document = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
      if (!document.getPageCount()) throw new Error("PDF tanpa halaman");
    } catch { throw new Error("PDF bukti tidak dapat dibuka atau terkunci. Pilih PDF yang utuh tanpa kata sandi."); }
  } else if (!imageStructure(bytes, file.type)) throw new Error("Gambar bukti tidak utuh atau resolusinya terlalu besar.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const dataUrl = `data:${file.type};base64,${btoa(binary)}`;
  if (file.type.startsWith("image/")) await verifyBrowserImage(dataUrl);
  return dataUrl;
}

export function validateDistributionRows(rows: readonly {id: string; nominal: string}[], memberIds: readonly string[]) {
  if (!rows.length) throw new Error("Tambahkan penerima honor terlebih dahulu.");
  const seen = new Set<string>();
  const recipients = rows.map(row => {
    const nominal = paymentAmount(row.nominal);
    if (!memberIds.includes(row.id)) throw new Error("Pilih anggota aktif sebagai penerima.");
    if (seen.has(row.id)) throw new Error("Setiap penerima hanya boleh dicantumkan sekali.");
    seen.add(row.id);
    return {id: row.id, nominal};
  });
  paymentTotal(recipients.map(row => row.nominal));
  return recipients;
}
