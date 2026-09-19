export const MAX_VOICE_SECONDS = 120;
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function mediaErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Izin mikrofon atau kamera ditolak. Izinkan akses melalui pengaturan situs di browser, lalu coba lagi.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Mikrofon atau kamera tidak ditemukan. Sambungkan perangkat yang diperlukan, lalu coba lagi.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Mikrofon atau kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.";
  if (name === "AbortError") return "Permintaan terhenti. Silakan coba lagi.";
  return error instanceof Error ? error.message : "Media tidak dapat diproses. Silakan coba lagi.";
}

export function assertMediaSupport(recording = false) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofon dan kamera memerlukan HTTPS atau localhost serta browser yang mendukung akses media.");
  if (recording && typeof MediaRecorder === "undefined") throw new Error("Browser ini belum mendukung rekaman suara. Gunakan Chrome, Edge, Firefox, atau Safari terbaru.");
  if (!recording && typeof RTCPeerConnection === "undefined") throw new Error("Browser ini belum mendukung panggilan. Gunakan browser terbaru.");
}

export function voiceMimeType() {
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
}

export function mediaTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
