import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { listLowStock } from "@/lib/firestore/products";
import {
  listTransactions,
  revenueTrendDaily,
  summarizeDay,
} from "@/lib/firestore/transactions";
import { PageHeader } from "@/components/ui/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueBarCard, TopListBarCard } from "@/components/charts/ReportCharts";

export function DashboardPage() {
  const { appUser } = useAuth();
  const today = new Date();
  const dayQuery = useQuery({
    queryKey: ["dashboard-today", today.toDateString()],
    queryFn: () => summarizeDay(new Date()),
    staleTime: 60 * 1000,
  });
  const trendQuery = useQuery({
    queryKey: ["dashboard-trend-14d", today.toDateString()],
    queryFn: () => revenueTrendDaily(14),
    staleTime: 5 * 60 * 1000,
  });
  const lowStockQuery = useQuery({
    queryKey: ["products", "low-stock"],
    queryFn: () => listLowStock(50),
    staleTime: 5 * 60 * 1000,
  });
  const recentQuery = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => listTransactions({ status: "completed", pageSize: 5 }),
    staleTime: 60 * 1000,
  });

  const summary = dayQuery.data;

  const cards = [
    {
      label: "Omzet Hari Ini",
      value: summary ? `Rp${summary.revenue.toLocaleString("id-ID")}` : "…",
      icon: TrendingUp,
    },
    {
      label: "Transaksi",
      value: summary ? String(summary.count) : "…",
      icon: ShoppingCart,
    },
    {
      label: "Produk Terjual",
      value: summary ? String(summary.productQty) : "…",
      icon: Package,
    },
    {
      label: "Stok Menipis",
      value: lowStockQuery.data != null ? String(lowStockQuery.data.length) : "…",
      icon: AlertTriangle,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Selamat datang kembali, ${appUser?.name ?? "…"}.`}
      />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <card.icon className="h-5 w-5 text-primary" />
              </span>
              <span>
                <p className="text-xs font-medium text-muted">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueBarCard
            title="Omzet 14 Hari Terakhir"
            description="Total pendapatan per hari, termasuk hari tanpa transaksi."
            data={trendQuery.data}
            loading={trendQuery.isLoading}
          />
        </div>
        <LowStockCard
          items={lowStockQuery.data}
          loading={lowStockQuery.isLoading}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopListBarCard
          title="Produk Terlaris Hari Ini"
          description="5 produk dengan qty tertinggi."
          items={summary?.topProducts ?? []}
          valueLabel="pcs"
        />
        <Card className="p-6">
          <h2 className="font-semibold">Transaksi terbaru</h2>
          <p className="text-sm text-muted">5 transaksi completed terakhir.</p>
          {recentQuery.isLoading ? (
            <p className="mt-2 text-sm text-muted">Memuat...</p>
          ) : (recentQuery.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada transaksi.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {recentQuery.data?.map((t) => (
                <li key={t.id} className="flex justify-between py-2">
                  <span className="font-mono text-xs">{t.transactionNumber}</span>
                  <span className="font-medium">
                    Rp{t.total.toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function LowStockCard({
  items,
  loading,
}: {
  items: { id: string; name: string; stock: number; minimumStock: number }[] | undefined;
  loading: boolean;
}) {
  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => a.stock - b.stock).slice(0, 8),
    [items],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stok Menipis</CardTitle>
        <CardDescription>Stok {"<="} minimum — klik untuk restok.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted">Memuat...</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted">Semua stok aman.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {sorted.map((p) => (
              <li key={p.id} className="py-2">
                <Link to="/stock" className="flex items-center justify-between gap-2 hover:underline">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 font-mono text-xs text-danger">
                    {p.stock} / min {p.minimumStock}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(items?.length ?? 0) > 8 && (
          <Link to="/stock" className="mt-2 inline-block text-xs text-muted hover:underline">
            Lihat semua {(items?.length ?? 0)} produk →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
