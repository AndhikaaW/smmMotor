import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { revenueTrendMonthly, summarizeDay, summarizeMonth } from "@/lib/firestore/transactions";
import type { DaySummary } from "@/lib/firestore/transactions";
import { PageHeader } from "@/components/ui/shared";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentDonutCard, RevenueBarCard, TopListBarCard } from "@/components/charts/ReportCharts";

function SummaryView({ summary, loading }: { summary: DaySummary | undefined; loading: boolean }) {
  const statCards = [
    { label: "Omzet", value: summary ? `Rp${summary.revenue.toLocaleString("id-ID")}` : "…" },
    { label: "Transaksi", value: summary ? String(summary.count) : "…" },
    { label: "Produk Terjual", value: summary ? String(summary.productQty) : "…" },
    { label: "Jasa Terjual", value: summary ? String(summary.serviceQty) : "…" },
  ];
  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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

      <div className="mt-4">
        <PaymentDonutCard byPayment={summary?.byPayment} loading={loading} />
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const dayQuery = useQuery({
    queryKey: ["report-day", date],
    queryFn: () => summarizeDay(new Date(`${date}T00:00:00`)),
    enabled: tab === "daily",
  });
  const monthQuery = useQuery({
    queryKey: ["report-month", month],
    queryFn: () => {
      const [y, m] = month.split("-").map(Number);
      return summarizeMonth(y, m);
    },
    enabled: tab === "monthly",
  });
  const [trendYear, trendMonth] = month.split("-").map(Number);
  const trendQuery = useQuery({
    queryKey: ["report-trend", month],
    queryFn: () => revenueTrendMonthly(trendYear, trendMonth),
    enabled: tab === "monthly",
    staleTime: 5 * 60 * 1000,
  });

  const loading = tab === "daily" ? dayQuery.isLoading : monthQuery.isLoading;
  const summary = tab === "daily" ? dayQuery.data : monthQuery.data;

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={tab === "daily" ? "Ringkasan penjualan harian." : "Ringkasan penjualan bulanan + tren harian."}
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("daily")}
          className={
            tab === "daily"
              ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium"
              : "rounded-lg border border-border bg-surface px-4 py-2 text-sm"
          }
        >
          Harian
        </button>
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={
            tab === "monthly"
              ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium"
              : "rounded-lg border border-border bg-surface px-4 py-2 text-sm"
          }
        >
          Bulanan
        </button>
        {tab === "daily" ? (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 h-10 rounded-lg border border-border bg-surface px-2 text-sm"
          />
        ) : (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ml-2 h-10 rounded-lg border border-border bg-surface px-2 text-sm"
          />
        )}
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Menghitung...</p>
      ) : (tab === "daily" ? dayQuery.isError : monthQuery.isError) ? (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Gagal memuat laporan: {(tab === "daily" ? dayQuery.error : monthQuery.error) instanceof Error
            ? (tab === "daily" ? dayQuery.error : monthQuery.error)?.message
            : "Cek koneksi dan Firestore Rules."}
        </p>
      ) : summary ? (
        <>
          {tab === "monthly" && (
            <div className="mt-4">
              <RevenueBarCard
                title={`Tren Harian — ${month}`}
                description="Omzet per tanggal dalam bulan berjalan."
                data={trendQuery.data}
                loading={trendQuery.isLoading}
              />
            </div>
          )}
          <SummaryView summary={summary} loading={loading} />
        </>
      ) : null}
    </div>
  );
}
