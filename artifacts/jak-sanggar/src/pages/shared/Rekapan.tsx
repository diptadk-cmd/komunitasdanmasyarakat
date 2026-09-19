import { useMemo, useState } from "react";
import {
  Download,
  FileClock,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import {
  buildRekapan,
  ringkasanRekapan,
  type RekapanEntry,
} from "@workspace/jaksanggar-core/rekapan";
import { useAuth, useDb } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const header = [
    "Tanggal",
    "Jenis",
    "Judul",
    "Keterangan",
    "Status",
    "Nominal",
  ];
  const lines = rows.map((row) =>
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
  const blob = new Blob(
    ["\uFEFF", [header.map(csvCell).join(","), ...lines].join("\n")],
    {
      type: "text/csv;charset=utf-8",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rekapan-jak-sanggar-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Rekapan() {
  const { user } = useAuth();
  const db = useDb();
  const [query, setQuery] = useState("");
  const [jenis, setJenis] = useState("semua");

  const rows = useMemo(() => (user ? buildRekapan(db, user) : []), [db, user]);
  const jenisTersedia = useMemo(
    () => [...new Set(rows.map((row) => row.jenis))].sort(),
    [rows],
  );
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("id-ID");
    return rows.filter((row) => {
      if (jenis !== "semua" && row.jenis !== jenis) return false;
      if (!keyword) return true;
      return [row.jenis, row.judul, row.keterangan, row.status]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [jenis, query, rows]);
  const ringkasan = useMemo(() => ringkasanRekapan(rows), [rows]);

  if (!user) return null;

  const cards = [
    {
      title: "Total Catatan",
      value: ringkasan.totalCatatan.toLocaleString("id-ID"),
      icon: FileClock,
    },
    {
      title: "Transaksi Bernominal",
      value: ringkasan.totalTransaksi.toLocaleString("id-ID"),
      icon: ReceiptText,
    },
    {
      title: "Pencatatan",
      value: ringkasan.totalPencatatan.toLocaleString("id-ID"),
      icon: WalletCards,
    },
    {
      title: "Akumulasi Nominal",
      value: rupiah.format(ringkasan.akumulasiNominal),
      icon: WalletCards,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekapan Transaksi & Pencatatan"
        subtitle={
          user.role === "kurator"
            ? "Seluruh catatan lintas akun dalam satu tampilan."
            : "Seluruh transaksi dan catatan yang berkaitan dengan akun Anda."
        }
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
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              {title === "Akumulasi Nominal" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Akumulasi, bukan saldo berjalan
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Riwayat Lengkap</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Menampilkan {filtered.length.toLocaleString("id-ID")} dari{" "}
              {rows.length.toLocaleString("id-ID")} catatan.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <label className="relative min-w-64">
              <span className="sr-only">Cari rekapan</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari transaksi atau catatan…"
                className="pl-9"
              />
            </label>
            <label>
              <span className="sr-only">Filter jenis catatan</span>
              <select
                value={jenis}
                onChange={(event) => setJenis(event.target.value)}
                className="h-9 w-full min-w-48 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="semua">Semua jenis</option>
                {jenisTersedia.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
              <ReceiptText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="font-medium">Belum ada catatan yang cocok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Transaksi dan aktivitas baru akan muncul otomatis di sini.
              </p>
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
