export interface CompressImageOptions {
  maxDimension: number;
  maxBytes: number;
  quality?: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar rusak atau tidak dapat dibaca."));
    };
    image.src = url;
  });
}

function dataUrlBytes(dataUrl: string): number {
  const encoded = dataUrl.split(",")[1] ?? "";
  return Math.ceil((encoded.length * 3) / 4);
}

/** Resize dan kompres gambar sebelum dimasukkan ke profil/localStorage/API JSON. */
export async function compressImage(file: File, options: CompressImageOptions): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Gunakan gambar JPG, PNG, WebP, atau AVIF.");
  }
  const image = await loadImage(file);
  const scale = Math.min(1, options.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Peramban tidak mendukung pemrosesan gambar.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = options.quality ?? 0.84;
  let result = canvas.toDataURL("image/jpeg", quality);
  while (dataUrlBytes(result) > options.maxBytes && quality > 0.42) {
    quality -= 0.08;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrlBytes(result) > options.maxBytes) {
    throw new Error(`Gambar tetap melebihi ${Math.round(options.maxBytes / 1024)} KB setelah dikompres.`);
  }
  return result;
}
