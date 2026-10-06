import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  revenueTrendMonthly,
  summarizeDay,
  summarizeMonth,
  summarizeRange,
  wibDateStr,
  type DaySummary,
  type TrendPoint,
} from "@/lib/firestore/transactions";
import { PageHeader } from "@/components/ui/shared";
import { Card, CardContent } from "@/components/ui/card";
import { RevenueBarCard, TopListBarCard } from "@/components/charts/ReportCharts";
import { friendlyError } from "@/lib/errors";

type Tab = "daily" | "monthly" | "range";

function idr(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function SummaryView({
  summary,
  loading,
  trend,
  trendTitle,
  trendDescription,
}: {
  summary: DaySummary | undefined;
  loading: boolean;
  trend?: TrendPoint[];
  trendTitle?: string;
  trendDescription?: string;
}) {
  const [tableQ, setTableQ] = useState("");
  const q = tableQ.trim().toLowerCase();
  const productRows = useMemo(() => {
    const rows = summary?.productRows ?? [];
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [summary, q]);
  const serviceRows = useMemo(() => {
    const rows = summary?.serviceRows ?? [];
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [summary, q]);
  const avg = summary && summary.count > 0 ? Math.round(summary.revenue / summary.count) : 0;
  const statCards = [
    { label: "Omzet", value: summary ? idr(summary.revenue) : "…" },
    { label: "Transaksi", value: summary ? String(summary.count) : "…" },
    { label: "Rata-rata / struk", value: summary ? idr(avg) : "…" },
    {
      label: "Barang",
      value: summary ? `${summary.productQty} pcs • ${idr(summary.productRevenue)}` : "…",
    },
    {
      label: "Jasa",
      value: summary ? `${summary.serviceQty}x • ${idr(summary.serviceRevenue)}` : "…",
    },
  ];
  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {trend && trendTitle ? (
        <div className="mt-4">
          <RevenueBarCard
            title={trendTitle}
            description={trendDescription ?? "Omzet per tanggal (WIB)."}
            data={trend}
            loading={loading}
          />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopListBarCard
          title="Produk Terlaris"
          description="5 produk dengan qty tertinggi."
          items={summary?.topProducts ?? []}
          valueLabel="pcs"
        />
        <TopListBarCard
          title="Jasa Terlaris"
          description="5 jasa dengan qty tertinggi."
          items={summary?.topServices ?? []}
          valueLabel="x"
        />
      </div>

      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Rincian Barang & Jasa</h2>
              <p className="text-xs text-muted">
                Semua nama barang & jasa dalam periode — terurut qty terbesar.
              </p>
            </div>
            <input
              value={tableQ}
              onChange={(e) => setTableQ(e.target.value)}
              placeholder="Cari nama barang / jasa..."
              className="h-10 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">
                Barang {productRows.length > 0 ? `(${productRows.length})` : ""}
              </h3>
              {productRows.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Belum ada barang terjual.</p>
              ) : (
                <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background text-xs text-muted">
                      <tr>
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((r) => (
                        <tr key={`p-${r.name}`} className="border-t border-border">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                          <td className="px-3 py-2 text-right font-mono">{idr(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                Jasa {serviceRows.length > 0 ? `(${serviceRows.length})` : ""}
              </h3>
              {serviceRows.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Belum ada jasa terjual.</p>
              ) : (
                <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background text-xs text-muted">
                      <tr>
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceRows.map((r) => (
                        <tr key={`s-${r.name}`} className="border-t border-border">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                          <td className="px-3 py-2 text-right font-mono">{idr(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const todayWib = useMemo(() => wibDateStr(), []);
  const weekAgoWib = useMemo(() => {
    const t = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    return wibDateStr(t);
  }, []);
  const [tab, setTab] = useState<Tab>("daily");
  const [date, setDate] = useState(todayWib);
  const [month, setMonth] = useState(todayWib.slice(0, 7));
  const [from, setFrom] = useState(weekAgoWib);
  const [to, setTo] = useState(todayWib);

  const dayQuery = useQuery({
    queryKey: ["report-day", date],
    queryFn: () => summarizeDay(new Date(`${date}T12:00:00+07:00`)),
    enabled: tab === "daily" && date.length === 10,
  });
  const monthQuery = useQuery({
    queryKey: ["report-month", month],
    queryFn: () => {
      const [y, m] = month.split("-").map(Number);
      return summarizeMonth(y, m);
    },
    enabled: tab === "monthly" && month.length === 7,
  });
  const rangeValid = from.length === 10 && to.length === 10 && from <= to;
  const rangeQuery = useQuery({
    queryKey: ["report-range", from, to],
    queryFn: () => summarizeRange(from, to),
    enabled: tab === "range" && rangeValid,
  });
  const [trendYear, trendMonth] = month.split("-").map(Number);
  const trendQuery = useQuery({
    queryKey: ["report-trend", month],
    queryFn: () => revenueTrendMonthly(trendYear, trendMonth),
    enabled: tab === "monthly",
    staleTime: 5 * 60 * 1000,
  });

  const loading =
    tab === "daily" ? dayQuery.isLoading : tab === "monthly" ? monthQuery.isLoading : rangeQuery.isLoading;
  const isError =
    tab === "daily" ? dayQuery.isError : tab === "monthly" ? monthQuery.isError : rangeQuery.isError;
  const error =
    tab === "daily" ? dayQuery.error : tab === "monthly" ? monthQuery.error : rangeQuery.error;
  const summary =
    tab === "daily" ? dayQuery.data : tab === "monthly" ? monthQuery.data : rangeQuery.data;

  const tabs: { id: Tab; label: string }[] = [
    { id: "daily", label: "Harian" },
    { id: "monthly", label: "Bulanan" },
    { id: "range", label: "Rentang" },
  ];

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={
          tab === "daily"
            ? "Ringkasan penjualan harian (WIB)."
            : tab === "monthly"
              ? "Ringkasan penjualan bulanan + tren harian (WIB)."
              : "Ringkasan rentang tanggal + tren harian (WIB, maks 62 hari)."
        }
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium"
                : "rounded-lg border border-border bg-surface px-4 py-2 text-sm"
            }
          >
            {t.label}
          </button>
        ))}
        {tab === "daily" ? (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 h-10 rounded-lg border border-border bg-surface px-2 text-sm"
          />
        ) : tab === "monthly" ? (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ml-2 h-10 rounded-lg border border-border bg-surface px-2 text-sm"
          />
        ) : (
          <span className="ml-2 flex items-center gap-2 text-sm">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
            />
            <span className="text-muted">s/d</span>
            <input
              type="date"
              value={to}
              min={from}
              max={todayWib}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
            />
          </span>
        )}
      </div>
      {tab === "range" && !rangeValid ? (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Rentang tanggal terbalik. Tukar tanggal mulai & selesainya ya.
        </p>
      ) : loading ? (
        <p className="mt-4 text-sm text-muted">Menghitung...</p>
      ) : isError ? (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {friendlyError(error, "Gagal memuat laporan. Cek koneksi lalu muat ulang ya.")}
        </p>
      ) : summary ? (
        <>
          {tab === "monthly" && (
            <SummaryView
              summary={summary}
              loading={loading}
              trend={trendQuery.data}
              trendTitle={`Tren Harian — ${month} (WIB)`}
              trendDescription="Omzet per tanggal dalam bulan berjalan."
            />
          )}
          {tab === "range" && rangeQuery.data ? (
            <SummaryView
              summary={summary}
              loading={loading}
              trend={rangeQuery.data.trend}
              trendTitle={`Tren ${rangeQuery.data.from} s/d ${rangeQuery.data.to} (WIB)`}
              trendDescription="Omzet per tanggal dalam rentang."
            />
          ) : null}
          {tab === "daily" && <SummaryView summary={summary} loading={loading} />}
        </>
      ) : null}
    </div>
  );
}
