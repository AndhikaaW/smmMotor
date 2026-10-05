import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/providers/AuthProvider";
import { listProducts } from "@/lib/firestore/products";
import { adjustStock } from "@/lib/firestore/stock";
import { listMovements } from "@/lib/firestore/stock";

const REASONS = ["Rusak", "Hilang", "Stock opname", "Salah input", "Lainnya"] as const;

export function StockPage() {
  const { appUser } = useAuth();
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const movementsQuery = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => listMovements(undefined, 50),
  });

  const [productId, setProductId] = useState("");
  const [physical, setPhysical] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Stock opname");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const selected = products.find((p) => p.id === productId);
  const physicalNumber = Math.floor(Number(physical));
  const diff = selected ? physicalNumber - selected.stock : 0;

  const lowStock = useMemo(
    () => products.filter((p) => p.isActive && p.stock <= p.minimumStock),
    [products],
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
  }

  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustStock({
        productId,
        physicalStock: physicalNumber,
        reason,
        note,
        userId: appUser?.uid ?? "",
        userName: appUser?.name ?? "",
      }),
    onSuccess: () => {
      setMessage(
        `Stok ${selected?.name} disesuaikan: ${selected?.stock} → ${physicalNumber}.`,
      );
      setError(null);
      setProductId("");
      setPhysical("");
      setNote("");
      refresh();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Gagal.");
      setMessage(null);
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Stok</h1>
      <p className="mt-1 text-sm text-muted">
        Penyesuaian tercatat sebagai movement. Tidak ada edit stok diam-diam.
      </p>

      {lowStock.length > 0 && (
        <section className="mt-4 rounded-xl border border-warning/40 bg-surface p-4">
          <h2 className="font-bold">Stok menipis ({lowStock.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className={p.stock === 0 ? "font-bold text-danger" : "text-warning"}>
                  {p.stock} / min {p.minimumStock}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="h-fit rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Penyesuaian stok</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!productId) {
                setError("Pilih produk.");
                return;
              }
              if (!Number.isInteger(physicalNumber) || physicalNumber < 0) {
                setError("Stok fisik harus bilangan >= 0.");
                return;
              }
              adjustMutation.mutate();
            }}
            className="mt-3 space-y-3 text-sm"
          >
            <label className="block">
              Produk
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3"
              >
                <option value="">— Pilih —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (stok {p.stock})
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <p className="text-muted">
                Stok sistem: <span className="font-bold text-text">{selected.stock}</span>
              </p>
            )}
            <label className="block">
              Stok fisik (hasil hitung)
              <input
                type="number"
                min={0}
                step={1}
                value={physical}
                onChange={(e) => setPhysical(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border px-3"
              />
            </label>
            {selected && physical !== "" && Number.isInteger(physicalNumber) && (
              <p className={diff === 0 ? "text-muted" : "font-medium"}>
                Selisih: {diff > 0 ? `+${diff}` : diff} → stok jadi {physicalNumber}
              </p>
            )}
            <label className="block">
              Alasan
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Catatan (opsional)
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="cth: hasil opname 5 Okt"
                className="mt-1 h-10 w-full rounded-lg border border-border px-3"
              />
            </label>
            {error && <p className="text-danger">{error}</p>}
            {message && <p className="text-success">{message}</p>}
            <Button disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? "Menyimpan..." : "Simpan penyesuaian"}
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Riwayat pergerakan</h2>
          {movementsQuery.isLoading ? (
            <p className="mt-2 text-sm text-muted">Memuat...</p>
          ) : (movementsQuery.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada pergerakan.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {movementsQuery.data?.map((m) => (
                <li key={m.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{m.productName}</span>
                    <span
                      className={
                        m.quantity < 0
                          ? "font-bold text-danger"
                          : "font-bold text-success"
                      }
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {m.type} • {m.stockBefore} → {m.stockAfter} •{" "}
                    {m.referenceType}
                    {m.referenceId ? ` ${m.referenceId}` : ""} • {m.userName}
                    {m.note ? ` • ${m.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
