import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { listProducts } from "@/lib/firestore/products";
import { listTransactions, summarizeDay } from "@/lib/firestore/transactions";

export function DashboardPage() {
  const { appUser } = useAuth();
  const today = new Date();
  const dayQuery = useQuery({
    queryKey: ["dashboard-today", today.toDateString()],
    queryFn: () => summarizeDay(new Date()),
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });
  const recentQuery = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => listTransactions({ status: "completed", pageSize: 5 }),
  });

  const summary = dayQuery.data;
  const lowStock = (productsQuery.data ?? []).filter(
    (p) => p.isActive && p.stock <= p.minimumStock,
  );

  const cards = [
    {
      label: "Omzet Hari Ini",
      value: summary ? `Rp${summary.revenue.toLocaleString("id-ID")}` : "…",
    },
    {
      label: "Transaksi",
      value: summary ? String(summary.count) : "…",
    },
    {
      label: "Produk Terjual",
      value: summary ? String(summary.productQty) : "…",
    },
    {
      label: "Stok Menipis",
      value: productsQuery.data ? String(lowStock.length) : "…",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Selamat datang kembali, {appUser?.name ?? "…"}.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs font-medium text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Transaksi terbaru</h2>
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
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Produk terlaris hari ini</h2>
          {!summary || summary.topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada penjualan.</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm">
              {summary.topProducts.map((p, i) => (
                <li key={p.name} className="flex justify-between">
                  <span>
                    {String(i + 1).padStart(2, "0")} {p.name}
                  </span>
                  <span className="font-medium">{p.qty} pcs</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
