type CashEntry = { tanggal: number; debit: number; kredit: number };

/** Daily net cash flow in thousands of rupiah, retaining year and deficits. */
export function cashOverview(entries: readonly CashEntry[]) {
  const days = new Map<string, { tanggal: number; tgl: string; masuk: number; keluar: number }>();
  for (const entry of [...entries].sort((a, b) => a.tanggal - b.tanggal)) {
    const date = new Date(entry.tanggal);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const day = days.get(key) ?? {
      tanggal: entry.tanggal,
      tgl: date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      masuk: 0,
      keluar: 0,
    };
    day.masuk += entry.debit / 1000;
    day.keluar += entry.kredit / 1000;
    days.set(key, day);
  }
  let net = 0;
  return [...days.values()].map((day) => {
    net += day.masuk - day.keluar;
    return { ...day, bersih: net };
  });
}
