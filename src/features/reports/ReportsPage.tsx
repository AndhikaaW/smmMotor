import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { summarizeDay, summarizeMonth } from "@/lib/firestore/transactions";
import type { DaySummary } from "@/lib/firestore/transactions";

function SummaryView({ summary }: { summary: DaySummary }) {
  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Omzet</p>
          <p className="mt-1 text-xl font-bold">
            Rp{summary.revenue.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Transaksi</p>
          <p className="mt-1 text-xl font-bold">{summary.count}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Produk Terjual</p>
          <p className="mt-1 text-xl font-bold">{summary.productQty}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Jasa Terjual</p>
          <p className="mt-1 text-xl font-bold">{summary.serviceQty}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Pembayaran</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(
              Object.entries(summary.byPayment) as [string, number][]
            ).map(([m, v]) => (
              <li key={m} className="flex justify-between">
                <span className="text-muted">{m}</span>
                <span className="font-medium">
                  Rp{v.toLocaleString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Produk Terlaris</h2>
          {summary.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">—</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm">
              {summary.topProducts.map((p, i) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span>
                    {String(i + 1).padStart(2, "0")} {p.name}
                  </span>
                  <span className="font-medium">
                    {p.qty} • Rp{p.revenue.toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Jasa Terlaris</h2>
          {summary.topServices.length === 0 ? (
            <p className="mt-2 text-sm text-muted">—</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm">
              {summary.topServices.map((s, i) => (
                <li key={s.name} className="flex justify-between gap-2">
                  <span>
                    {String(i + 1).padStart(2, "0")} {s.name}
                  </span>
                  <span className="font-medium">
                    {s.qty} • Rp{s.revenue.toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
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

  const loading = tab === "daily" ? dayQuery.isLoading : monthQuery.isLoading;
  const summary =
    tab === "daily" ? dayQuery.data : monthQuery.data;

  return (
    <div>
      <h1 className="text-2xl font-bold">Laporan</h1>
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
        <SummaryView summary={summary} />
      ) : null}
    </div>
  );
}
