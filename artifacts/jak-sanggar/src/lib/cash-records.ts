import type { ActivityLog, DistribusiHonor, Iuran, KasEntry, PengajuanHonor, TransaksiManual } from "./types";
import { paymentAmount, paymentTotal, receiptExtension, validateDistributionRows } from "./payment-receipt.ts";

interface CashUser { id: string; role: string; saldo?: number; sanggarId?: string; status?: string }
export interface CashState {
  users: CashUser[]; kas: KasEntry[]; transaksi: TransaksiManual[]; distribusi: DistribusiHonor[];
  pengajuanHonor: PengajuanHonor[]; iuran: Iuran[]; activity: ActivityLog[];
}
type IdFactory = () => string;

/** Calendar date for the form, independent of the browser's system timezone. */
export function jakartaInputDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Plan/validate everything before mutating the save() draft. One save persists
 * the record, receipt, ledger and account balance or rolls all of them back. */
function ledgerPlan(db: CashState, sanggarId: string, debit: number, kredit: number, keterangan: string, refType: string, refId: string, id: string, now: number) {
  const owner = db.users.find(user => user.id === sanggarId && user.role === "sanggar");
  if (!owner) throw new Error("Akun sanggar tidak ditemukan.");
  if (debit) paymentAmount(debit);
  if (kredit) paymentAmount(kredit);
  let saldo = 0;
  for (const entry of db.kas.filter(entry => entry.sanggarId === sanggarId)) {
    if (!Number.isFinite(entry.debit) || !Number.isFinite(entry.kredit)) throw new Error("Buku kas memiliki nominal yang tidak valid.");
    saldo += entry.debit - entry.kredit;
    if (!Number.isSafeInteger(saldo)) throw new Error("Saldo buku kas melebihi batas angka aman.");
  }
  saldo += debit - kredit;
  if (!Number.isSafeInteger(saldo)) throw new Error("Saldo baru melebihi batas angka aman.");
  return { owner, entry: { id, sanggarId, tanggal: now, keterangan, debit, kredit, saldo, refType, refId } satisfies KasEntry };
}
function applyLedger(db: CashState, planned: ReturnType<typeof ledgerPlan>) {
  db.kas.push(planned.entry); planned.owner.saldo = planned.entry.saldo;
}
function requireReceipt(value: string) {
  if (!receiptExtension(value)) throw new Error("Lampirkan bukti pembayaran yang valid.");
}

export function recordManualCash(db: CashState, record: TransaksiManual, ids: IdFactory) {
  paymentAmount(record.nominal);
  if (!record.tanggal || !record.sumberAtauTujuan.trim()) throw new Error("Lengkapi tanggal dan sumber atau tujuan dana.");
  if (record.buktiDataUrl) requireReceipt(record.buktiDataUrl);
  if (db.transaksi.some(item => item.id === record.id)) throw new Error("Transaksi ini sudah tercatat.");
  const incoming = record.jenis === "pemasukan";
  const planned = ledgerPlan(db, record.sanggarId, incoming ? record.nominal : 0, incoming ? 0 : record.nominal, `${incoming ? "Pemasukan" : "Pengeluaran"}: ${record.kategori}${record.keterangan ? " — " + record.keterangan : ""}`, "manual", record.id, ids(), record.createdAt);
  const activity: ActivityLog = { id: ids(), actorId: record.sanggarId, actorRole: "sanggar", action: `manual-${record.jenis}`, ts: record.createdAt };
  db.transaksi.push(record); applyLedger(db, planned); db.activity.push(activity);
}

export function recordDistributionCash(db: CashState, input: { sanggarId: string; title: string; rows: readonly { id: string; nominal: string }[]; receipt: string; now: number }, ids: IdFactory) {
  if (!input.title.trim()) throw new Error("Isi judul pementasan.");
  requireReceipt(input.receipt);
  // Recheck membership against the latest save() snapshot after file reading.
  const members = db.users.filter(user => ["pelatih", "seniman"].includes(user.role) && user.sanggarId === input.sanggarId && user.status === "aktif");
  const recipients = validateDistributionRows(input.rows, members.map(member => member.id));
  const records: DistribusiHonor[] = recipients.map(row => ({ id: ids(), sanggarId: input.sanggarId, penerimaId: row.id, penerimaRole: members.find(member => member.id === row.id)!.role as "pelatih" | "seniman", judulJob: input.title.trim(), nominal: row.nominal, buktiTransferDataUrl: input.receipt, konfirmasi: false, createdAt: input.now }));
  const planned = ledgerPlan(db, input.sanggarId, 0, paymentTotal(recipients.map(row => row.nominal)), `Bagi Hasil: ${input.title.trim()}`, "distribusi", records[0].id, ids(), input.now);
  db.distribusi.push(...records); applyLedger(db, planned);
}

export function payHonorCash(db: CashState, sanggarId: string, honorId: string, receipt: string, ids: IdFactory, now = Date.now()) {
  requireReceipt(receipt);
  const honor = db.pengajuanHonor.find(item => item.id === honorId && item.sanggarId === sanggarId);
  if (!honor || honor.status !== "pending") throw new Error("Pengajuan honor ini sudah diproses atau tidak tersedia.");
  paymentAmount(honor.total);
  const planned = ledgerPlan(db, sanggarId, 0, honor.total, "Honor Pelatih", "honor", honorId, ids(), now);
  honor.status = "disetujui"; honor.paidAt = now; honor.buktiTransferDataUrl = receipt;
  applyLedger(db, planned);
}

export function validateIuranCash(db: CashState, sanggarId: string, iuranId: string, approved: boolean, ids: IdFactory, now = Date.now()) {
  const iuran = db.iuran.find(item => item.id === iuranId && item.sanggarId === sanggarId);
  if (!iuran || iuran.status !== "pending") throw new Error("Iuran ini sudah diproses atau tidak tersedia.");
  if (approved) { requireReceipt(iuran.buktiDataUrl ?? ""); paymentAmount(iuran.nominal); }
  const planned = approved ? ledgerPlan(db, sanggarId, iuran.nominal, 0, `Iuran: ${iuran.judul}`, "iuran", iuranId, ids(), now) : null;
  iuran.status = approved ? "lunas" : "ditolak"; iuran.validatedAt = now;
  if (planned) applyLedger(db, planned);
}
