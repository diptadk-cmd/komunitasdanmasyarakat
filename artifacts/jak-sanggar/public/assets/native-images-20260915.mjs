export const IMAGE_SLOTS = [
  { id: 'logo', key: '__image_logo', profileKey: 'logoDataUrl', label: 'Logo sanggar', help: 'Unggah gambar logo sanggar, misalnya lambang lingkaran dengan siluet penari. Gambar mengisi ruang logo pada template; bila tidak ada ruang logo atau kop surat, logo ditempatkan di awal dokumen.' },
  { id: 'stamp', key: '__image_stamp', profileKey: 'stempelDataUrl', label: 'Stempel sanggar', help: 'Unggah gambar stempel sanggar. PNG dengan latar transparan memberi hasil paling rapi. Gambar mengisi ruang stempel atau ditempatkan di area penandatangan dokumen. Periksa pratinjau untuk memastikan penempatannya sesuai.' },
  { id: 'letterhead', key: '__image_letterhead', profileKey: 'kopSuratDataUrl', label: 'Kop surat', help: 'Unggah gambar mendatar yang berisi identitas bagian atas surat, misalnya logo, nama sanggar, alamat, dan kontak. Unggah bagian kop saja, bukan foto satu halaman penuh. Kop tampil di awal dokumen.' },
];
export const imageKindForField = key => ({ LOGO: 'logo', LOG_FIN: 'logo', STE_FIN: 'stamp' })[key];
export const isImageValue = value => typeof value === 'string' && value.length <= 1400000 && /^data:image\/(?:png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(value);

// All candidates are explicitly owned by the active sanggar. Generic photos and
// parent organisation images must never become a sanggar's logo or stamp.
export function imageAutofill(profile = {}, saved = {}, saveKey = '', related = []) {
  const images = {}, sources = {};
  if (!profile?.id || (profile.role && profile.role !== 'sanggar')) return { images, sources };
  const prefix = profile.id + ':';
  const selected = saveKey.startsWith(prefix) ? saved?.[saveKey] || {} : {};
  for (const slot of IMAGE_SLOTS) {
    if (Object.hasOwn(selected, slot.key) && (selected[slot.key] === '' || isImageValue(selected[slot.key]))) {
      images[slot.id] = selected[slot.key]; sources[slot.id] = 'Formulir tersimpan'; continue;
    }
    if (isImageValue(profile[slot.profileKey])) { images[slot.id] = profile[slot.profileKey]; sources[slot.id] = 'Pendaftaran / profil'; continue; }
    const candidates = new Set();
    for (const [key, record] of Object.entries(saved || {})) {
      if (!key.startsWith(prefix) || key === saveKey || !record) continue;
      const value = record[slot.key] || record[slot.profileKey];
      if (isImageValue(value)) candidates.add(value);
    }
    for (const source of related || []) if (source?.sanggarId === profile.id) {
      const value = source.values?.[slot.key] || source.values?.[slot.profileKey];
      if (isImageValue(value)) candidates.add(value);
    }
    if (candidates.size === 1) { images[slot.id] = [...candidates][0]; sources[slot.id] = 'Formulir lain'; }
  }
  return { images, sources };
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar tidak dapat dibaca. Gunakan PNG, JPG, WebP, atau AVIF yang valid.'));
    image.src = url;
  });
}
async function toPng(url, kind) {
  const image = await loadImage(url);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Resolusi gambar terlalu besar. Gunakan gambar di bawah 40 megapiksel.');
  let scale = Math.min(1, (kind === 'letterhead' ? 1800 : 1000) / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  for (let attempt = 0; attempt < 5; attempt++) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Peramban belum mendukung pemrosesan gambar.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = canvas.toDataURL('image/png');
    if (output.length <= 550000) return output;
    scale *= 0.72;
  }
  throw new Error('Gambar masih terlalu besar. Coba gambar logo, stempel, atau kop yang lebih sederhana.');
}
export async function readImageFile(file, kind) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Pilih berkas PNG, JPG, WebP, atau AVIF.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Ukuran unggahan maksimal 8 MB.');
  const url = URL.createObjectURL(file);
  try { return await toPng(url, kind); } finally { URL.revokeObjectURL(url); }
}
export async function renderImages(images) {
  const output = {};
  for (const slot of IMAGE_SLOTS) if (isImageValue(images[slot.id])) output[slot.id] = await toPng(images[slot.id], slot.id);
  return output;
}
