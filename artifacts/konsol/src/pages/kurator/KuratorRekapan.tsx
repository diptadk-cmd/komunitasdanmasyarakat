import { useMemo, useState } from "react";
import { Download, ReceiptText, Search } from "lucide-react";
import {
  buildRekapan,
  ringkasanRekapan,
  type RekapanEntry,
} from "@workspace/jaksanggar-core/rekapan";
import { useAuth, useDb } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const tanggal = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const csvCell = (value: string | number) => {
  let safe = String(value);
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
};

function unduhCsv(rows: RekapanEntry[]) {
  const data = rows.map((row) =>
    [
      new Date(row.tanggal).toISOString(),
      row.jenis,
      row.judul,
      row.keterangan,
      row.status,
      row.nominal ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  const header = [
    "Tanggal",
    "Jenis",
    "Judul",
    "Keterangan",
    "Status",
    "Nominal",
  ]
    .map(csvCell)
    .join(",");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", [header, ...data].join("\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `rekapan-jak-sanggar-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function KuratorRekapan() {
  const { user } = useAuth();
  const db = useDb();
  const [query, setQuery] = useState("");
  const [jenis, setJenis] = useState("semua");
  const rows = useMemo(() => (user ? buildRekapan(db, user) : []), [db, user]);
  const ringkasan = useMemo(() => ringkasanRekapan(rows), [rows]);
  const jenisTersedia = useMemo(
    () => [...new Set(rows.map((row) => row.jenis))].sort(),
    [rows],
  );
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("id-ID");
    return rows.filter(
      (row) =>
        (jenis === "semua" || row.jenis === jenis) &&
        (!keyword ||
          [row.jenis, row.judul, row.keterangan, row.status]
            .join(" ")
            .toLocaleLowerCase("id-ID")
            .includes(keyword)),
    );
  }, [jenis, query, rows]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekapan Transaksi & Pencatatan"
        subtitle="Seluruh transaksi dan catatan lintas akun dalam satu tampilan pengawasan."
        back={false}
        actions={
          <Button
            variant="outline"
            onClick={() => unduhCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Unduh CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Catatan", ringkasan.totalCatatan.toLocaleString("id-ID")],
          [
            "Transaksi Bernominal",
            ringkasan.totalTransaksi.toLocaleString("id-ID"),
          ],
          ["Pencatatan", ringkasan.totalPencatatan.toLocaleString("id-ID")],
          ["Akumulasi Nominal", rupiah.format(ringkasan.akumulasiNominal)],
        ].map(([title, value]) => (
          <Card key={title}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Cari rekapan</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari transaksi atau catatan…"
                className="pl-9"
              />
            </label>
            <select
              aria-label="Filter jenis catatan"
              value={jenis}
              onChange={(event) => setJenis(event.target.value)}
              className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="semua">Semua jenis</option>
              {jenisTersedia.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
              <ReceiptText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="font-medium">Belum ada catatan yang cocok</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Rincian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {tanggal.format(row.tanggal)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.jenis}</Badge>
                    </TableCell>
                    <TableCell className="min-w-72">
                      <p className="font-medium">{row.judul}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.keterangan}
                      </p>
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {row.nominal === undefined
                        ? "—"
                        : rupiah.format(row.nominal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
