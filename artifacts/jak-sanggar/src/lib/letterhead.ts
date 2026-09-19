export type LetterheadLayout = "classic" | "modern";
export interface LetterheadDraft {
  name: string;
  identity: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  layout: LetterheadLayout;
  logo: string;
}
export const LETTERHEAD_WIDTH = 1800;
export const LETTERHEAD_MAX_HEIGHT = 338;
const LIMITS = { name: 120, identity: 140, address: 260, phone: 60, email: 120, website: 140 };
const LABELS = { name: "Nama organisasi", identity: "Identitas tambahan", address: "Alamat", phone: "Telepon", email: "Email", website: "Situs web" };
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export function validLogoHeader(bytes: Uint8Array, type: string): boolean {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/webp") return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
  if (type === "image/avif") return text(4, 8) === "ftyp" && /avif|avis/.test(text(8, 32));
  return false;
}

export function localLogo(value: unknown): string {
  return typeof value === "string" && value.length <= 1_400_000 && /^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
}

export function validateLetterhead(draft: LetterheadDraft): void {
  if (!draft.name.trim()) throw new Error("Isi nama organisasi terlebih dahulu.");
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (draft[key].length > LIMITS[key]) throw new Error(`${LABELS[key]} maksimal ${LIMITS[key]} karakter.`);
  }
  if (!["classic", "modern"].includes(draft.layout)) throw new Error("Pilih tata letak kop surat.");
  if (draft.logo && !localLogo(draft.logo)) throw new Error("Logo belum valid. Unggah PNG, JPG, WebP, atau AVIF dari perangkat.");
}

/** Wrap by measured glyph width; a long URL/word is split, never clipped. */
export function wrapLetterheadText(text: string, width: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.trim().split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (measure(line + character) > width && line) { lines.push(line); line = ""; }
        if (measure(character) > width) throw new Error("Teks tidak muat pada kop surat.");
        line += character;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export interface LetterheadText { text: string; x: number; y: number; size: number; bold: boolean; align: "left" | "center"; width: number }
export interface LetterheadPlan { width: number; height: number; texts: LetterheadText[]; logoBox?: { x: number; y: number; size: number }; ruleY: number; color: string }
export function planLetterhead(draft: LetterheadDraft, measure: (text: string, size: number, bold: boolean) => number): LetterheadPlan {
  validateLetterhead(draft);
  const left = draft.logo ? 286 : 54, right = 54, available = LETTERHEAD_WIDTH - left - right;
  const align = draft.layout === "classic" ? "center" : "left";
  const x = align === "center" ? left + available / 2 : left;
  let y = 28;
  const texts: LetterheadText[] = [];
  const add = (text: string, size: number, bold = false) => {
    const lines = wrapLetterheadText(text, available, value => measure(value, size, bold));
    for (const line of lines) {
      texts.push({ text: line, x, y, size, bold, align, width: measure(line, size, bold) });
      y += Math.ceil(size * 1.22);
    }
    if (lines.length) y += 7;
  };
  add(draft.name.trim(), 52, true);
  if (draft.identity.trim()) add(draft.identity, 31);
  if (draft.address.trim()) add(draft.address, 29);
  const contact = [draft.phone.trim(), draft.email.trim(), draft.website.trim()].filter(Boolean).join("  |  ");
  if (contact) add(contact, 28);
  const ruleY = Math.max(y + 7, draft.logo ? 251 : 145);
  const height = ruleY + 22;
  if (height > LETTERHEAD_MAX_HEIGHT) throw new Error("Teks terlalu panjang untuk kop surat. Ringkas nama, identitas, alamat, atau kontak agar tetap terbaca.");
  return { width: LETTERHEAD_WIDTH, height, texts, ...(draft.logo ? { logoBox: { x: 54, y: 28, size: 210 } } : {}), ruleY, color: draft.layout === "modern" ? "#147D73" : "#123047" };
}

export function fitLogo(width: number, height: number, box: { x: number; y: number; size: number }) {
  if (width <= 0 || height <= 0 || width * height > 40_000_000) throw new Error("Resolusi logo tidak valid atau melebihi 40 megapiksel.");
  const scale = Math.min(box.size / width, box.size / height);
  return { x: box.x + (box.size - width * scale) / 2, y: box.y + (box.size - height * scale) / 2, width: width * scale, height: height * scale };
}

async function decodeLogo(url: string): Promise<HTMLImageElement> {
  // Callers accept only a validated local data URL, never a remote address.
  if (!localLogo(url)) throw new Error("Logo belum valid. Pilih berkas gambar dari perangkat.");
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Logo tidak dapat dibaca. Coba berkas PNG atau JPG lain."));
    image.src = url;
  });
}

export async function readLetterheadLogo(file: File): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) throw new Error("Gunakan logo PNG, JPG, WebP, atau AVIF.");
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error("Berkas logo harus berisi gambar dan maksimal 8 MB.");
  if (!validLogoHeader(new Uint8Array(await file.slice(0, 32).arrayBuffer()), file.type)) throw new Error("Isi berkas tidak sesuai format gambar. Pilih berkas PNG, JPG, WebP, atau AVIF yang valid.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Berkas logo gagal dibaca."));
    reader.readAsDataURL(file);
  });
  // Uploaded originals may exceed the saved-image cap; decode them locally,
  // then normalise to a bounded PNG. No URL supplied by text input is loaded.
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const loaded = new Image();
    loaded.onload = () => resolve(loaded);
    loaded.onerror = () => reject(new Error("Isi berkas bukan gambar yang dapat dibaca."));
    loaded.src = dataUrl;
  });
  fitLogo(image.naturalWidth, image.naturalHeight, { x: 0, y: 0, size: 400 });
  const scale = Math.min(1, 400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Peramban belum mendukung pembuatan gambar.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const output = canvas.toDataURL("image/png");
  if (!localLogo(output)) throw new Error("Logo terlalu besar setelah diproses. Pilih logo yang lebih sederhana.");
  return output;
}

export interface LetterheadResult { dataUrl: string; width: number; height: number }
export async function renderLetterhead(draft: LetterheadDraft): Promise<LetterheadResult> {
  validateLetterhead(draft);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Peramban belum mendukung pembuatan kop surat.");
  const plan = planLetterhead(draft, (text, size, bold) => {
    context.font = `${bold ? "700" : "400"} ${size}px Arial, sans-serif`;
    return context.measureText(text).width;
  });
  const logo = draft.logo ? await decodeLogo(draft.logo) : null;
  canvas.width = plan.width; canvas.height = plan.height;
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  if (logo && plan.logoBox) {
    const box = fitLogo(logo.naturalWidth, logo.naturalHeight, plan.logoBox);
    context.drawImage(logo, box.x, box.y, box.width, box.height);
  }
  context.textBaseline = "top";
  for (const text of plan.texts) {
    context.font = `${text.bold ? "700" : "400"} ${text.size}px Arial, sans-serif`;
    context.fillStyle = text.bold ? "#123047" : "#334D5C";
    context.textAlign = text.align;
    context.fillText(text.text, text.x, text.y);
  }
  context.fillStyle = plan.color;
  context.fillRect(54, plan.ruleY, plan.width - 108, draft.layout === "classic" ? 5 : 7);
  if (draft.layout === "classic") context.fillRect(54, plan.ruleY + 9, plan.width - 108, 2);
  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > 550_000) throw new Error("Kop surat terlalu besar. Gunakan logo yang lebih sederhana atau ringkas teks.");
  return { dataUrl, width: plan.width, height: plan.height };
}

/** A4 stationery, with the same 160 mm × <=30 mm box as the native renderer. */
export async function letterheadPdf(result: LetterheadResult): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = 160, height = width * result.height / result.width;
  pdf.addImage(result.dataUrl, "PNG", 25, 15, width, height);
  pdf.setProperties({ title: "Kop surat" });
  return pdf.output("blob");
}
