import { receiptExtension } from "@/lib/payment-receipt";

export function ReceiptDownload({ value, name = "bukti-pembayaran" }: { value?: string; name?: string }) {
  const extension = receiptExtension(value);
  if (!value) return <span className="text-xs text-muted-foreground">Belum ada bukti</span>;
  if (!extension) return <span className="text-xs text-muted-foreground">Berkas bukti lama belum terlampir.</span>;
  return <a href={value} download={`${name}.${extension}`} className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Unduh bukti</a>;
}
