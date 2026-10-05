import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { useAuth } from "@/app/providers/AuthProvider";
import { getProductByBarcode, searchProductsByName } from "@/lib/firestore/products";
import { listServices, listMechanics } from "@/lib/firestore/services";
import { getGeneralSettings } from "@/lib/firestore/settings";
import { checkout } from "@/lib/firestore/transactions";
import type { CartItem, PaymentMethod, Product, ServiceItem } from "@/types";

interface SuccessInfo {
  transactionNumber: string;
  total: number;
  payment: number;
  change: number;
  paymentMethod: PaymentMethod;
  items: CartItem[];
  customerName: string;
  vehiclePlate: string;
  vehicleType: string;
  mechanicName: string;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  qris: "QRIS",
  transfer: "Transfer",
  debit: "Debit",
  other: "Lainnya",
};

export function PosPage() {
  const { appUser } = useAuth();
  const queryClient = useQueryClient();
  const servicesQuery = useQuery({ queryKey: ["services"], queryFn: listServices, staleTime: 10 * 60 * 1000 });
  const mechanicsQuery = useQuery({ queryKey: ["mechanics"], queryFn: listMechanics, staleTime: 10 * 60 * 1000 });
  const settingsQuery = useQuery({
    queryKey: ["settings", "general"],
    queryFn: getGeneralSettings,
    staleTime: 15 * 60 * 1000,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanReady] = useState(true);
  const [customerName] = useState("");
  const [vehiclePlate] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [mechanicId, setMechanicId] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paid, setPaid] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const productSearchQuery = useQuery({
    queryKey: ["products", "pos-search", search.trim()],
    queryFn: () => searchProductsByName(search.trim(), 24),
    staleTime: 60 * 1000,
  });
  const activeProducts = useMemo(
    () => (productSearchQuery.data?.rows ?? []).filter((p) => p.isActive),
    [productSearchQuery.data],
  );
  const activeServices = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.isActive),
    [servicesQuery.data],
  );
  const activeMechanics = useMemo(
    () => (mechanicsQuery.data ?? []).filter((m) => m.isActive),
    [mechanicsQuery.data],
  );
  const paymentMethods = settingsQuery.data?.paymentMethods ?? ["cash"];

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.subtotal, 0),
    [cart],
  );
  const changePreview = method === "cash" ? Math.max(0, paid - subtotal) : 0;

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Shortcut kasir: F2 fokus barcode, F4 bayar, F8 clear, ESC tutup modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0) setPayOpen(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        setCart([]);
      } else if (e.key === "Escape") {
        setPayOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length]);

  function addProduct(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.type === "product" && i.productId === p.id,
      );
      if (idx >= 0) {
        const next = [...prev];
        const cur = next[idx];
        const quantity = cur.quantity + 1;
        next[idx] = { ...cur, quantity, subtotal: cur.price * quantity };
        return next;
      }
      return [
        ...prev,
        {
          type: "product",
          productId: p.id,
          name: p.name,
          price: p.sellingPrice,
          quantity: 1,
          subtotal: p.sellingPrice,
        },
      ];
    });
  }

  function addService(s: ServiceItem) {
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.type === "service" && i.serviceId === s.id,
      );
      if (idx >= 0) {
        const next = [...prev];
        const cur = next[idx];
        const quantity = cur.quantity + 1;
        next[idx] = { ...cur, quantity, subtotal: cur.price * quantity };
        return next;
      }
      return [
        ...prev,
        {
          type: "service",
          serviceId: s.id,
          name: s.name,
          price: s.price,
          quantity: 1,
          subtotal: s.price,
        },
      ];
    });
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    setScanError(null);
    const found = await getProductByBarcode(code);
    if (!found || !found.isActive) {
      setScanError(`Barcode ${code} tidak ditemukan.`);
      setBarcode("");
      barcodeRef.current?.focus();
      return;
    }
    addProduct(found);
    setBarcode("");
    barcodeRef.current?.focus();
  }

  function setQty(index: number, quantity: number) {
    if (quantity < 1) {
      setCart((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setCart((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity, subtotal: item.price * quantity }
          : item,
      ),
    );
  }

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkout({
        items: cart,
        paymentMethod: method,
        payment: method === "cash" ? paid : subtotal,
        cashierId: appUser?.uid ?? "",
        cashierName: appUser?.name ?? "",
        customerName: "",
        vehiclePlate: "",
        vehicleType: vehicleType.trim(),
        mechanicId,
        mechanicName: activeMechanics.find((m) => m.id === mechanicId)?.name ?? "",
      }),
    onSuccess: (res) => {
      setSuccess({
        transactionNumber: res.transactionNumber,
        total: res.total,
        payment: method === "cash" ? paid : subtotal,
        change: res.change,
        paymentMethod: method,
        items: cart,
        customerName: customerName.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleType: vehicleType.trim(),
        mechanicName: activeMechanics.find((m) => m.id === mechanicId)?.name ?? "",
      });
      setCart([]);
      setPayOpen(false);
      setPaid(0);
      setCheckoutError(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      setCheckoutError(err instanceof Error ? err.message : "Transaksi gagal.");
    },
  });

  const searchedProducts = activeProducts;

  useEffect(() => {
    const size = settingsQuery.data?.paperSize ?? "80";
    document.body.classList.toggle("paper-58", size === "58");
    return () => document.body.classList.remove("paper-58");
  }, [settingsQuery.data?.paperSize]);

  function printReceipt() {
    window.print();
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-4xl text-success">✓</p>
        <h1 className="mt-2 text-xl font-bold">Transaksi Berhasil</h1>
        <p className="mt-1 font-mono text-sm">{success.transactionNumber}</p>
        {(success.customerName || success.vehiclePlate || success.vehicleType || success.mechanicName) && (
          <p className="mt-2 text-sm text-muted">
            {[success.customerName, success.vehiclePlate, success.vehicleType].filter(Boolean).join(" • ")}
            {success.mechanicName ? ` • Mekanik: ${success.mechanicName}` : ""}
          </p>
        )}
        <p className="mt-4 text-sm text-muted">Total</p>
        <p className="text-3xl font-bold">
          Rp{success.total.toLocaleString("id-ID")}
        </p>
        {success.paymentMethod === "cash" && (
          <p className="mt-1 text-sm text-muted">
            Bayar Rp{success.payment.toLocaleString("id-ID")} • Kembalian
            Rp{success.change.toLocaleString("id-ID")}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={printReceipt}>
            Cetak Struk
          </Button>
          <Button
            className="flex-1"
            autoFocus
            onClick={() => {
              setSuccess(null);
              barcodeRef.current?.focus();
            }}
          >
            Transaksi Baru
          </Button>
        </div>
        <div className="print-only mt-6 text-left text-xs">
          <p className="font-bold">
            {settingsQuery.data?.receiptHeader ?? "Sedyo Makmur Motor"}
          </p>
          <p>{settingsQuery.data?.address}</p>
          <p>{settingsQuery.data?.phone}</p>
          <p>--------------------------------</p>
          <p>{success.transactionNumber}</p>
          <p>
            {new Date().toLocaleString("id-ID")} • {appUser?.name}
          </p>
          {success.customerName && <p>Pelanggan: {success.customerName}</p>}
          {(success.vehiclePlate || success.vehicleType) && (
            <p>Kendaraan: {[success.vehiclePlate, success.vehicleType].filter(Boolean).join(" / ")}</p>
          )}
          {success.mechanicName && <p>Mekanik: {success.mechanicName}</p>}
          <p>--------------------------------</p>
          {success.items.map((i) => (
            <p key={`${i.type}-${i.productId ?? i.serviceId}`}>
              {i.name}
              <br />{i.quantity} x {i.price.toLocaleString("id-ID")}
              {" = "}
              {i.subtotal.toLocaleString("id-ID")}
            </p>
          ))}
          <p>--------------------------------</p>
          <p>TOTAL: Rp{success.total.toLocaleString("id-ID")}</p>
          <p>
            {success.paymentMethod.toUpperCase()}: Rp
            {success.payment.toLocaleString("id-ID")}
          </p>
          {success.paymentMethod === "cash" && (
            <p>KEMBALI: Rp{success.change.toLocaleString("id-ID")}</p>
          )}
          <p>--------------------------------</p>
          <p>{settingsQuery.data?.receiptFooter}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kasir</h1>
        <p className="font-mono text-sm text-muted">Kasir: {appUser?.name}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div>
          <form onSubmit={handleScan} className="mt-3">
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="🔎 Scan barcode atau cari produk..."
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm focus:outline-2 focus:outline-primary"
            />
          </form>
          <p className="mt-1 text-xs text-muted">
            Scanner siap {scanReady ? "●" : "○"} • F2 fokus • F4 bayar • F8
            clear
          </p>
          {scanError && <p className="mt-1 text-sm text-danger">{scanError}</p>}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk manual..."
            className="mt-3 h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {searchedProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="rounded-xl border border-border bg-surface p-3 text-left hover:border-primary"
              >
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-sm font-bold">
                  Rp{p.sellingPrice.toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-muted">Stok: {p.stock}</p>
              </button>
            ))}
          </div>

          {activeServices.length > 0 && (
            <>
              <h2 className="mt-6 font-bold">Jasa</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeServices.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addService(s)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
                  >
                    {s.name} • Rp{s.price.toLocaleString("id-ID")}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-4 xl:sticky xl:top-4">
          <h2 className="font-bold">Keranjang</h2>
          {cart.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Belum ada item. Scan barcode untuk mulai.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cart.map((item, idx) => (
                <li
                  key={`${item.type}-${item.productId ?? item.serviceId}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <button
                      type="button"
                      className="text-muted hover:text-danger"
                      title="Hapus"
                      onClick={() =>
                        setCart((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      🗑
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    Rp{item.price.toLocaleString("id-ID")}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 rounded-md border border-border"
                        onClick={() => setQty(idx, item.quantity - 1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          setQty(idx, Math.floor(Number(e.target.value) || 0))
                        }
                        className="h-8 w-14 rounded-md border border-border text-center text-sm"
                      />
                      <button
                        type="button"
                        className="h-8 w-8 rounded-md border border-border"
                        onClick={() => setQty(idx, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-bold">
                      Rp{item.subtotal.toLocaleString("id-ID")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>Rp{subtotal.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL</span>
              <span>Rp{subtotal.toLocaleString("id-ID")}</span>
            </div>
          </div>
          <Button
            className="mt-3 h-14 w-full text-base"
            disabled={cart.length === 0}
            onClick={() => {
              setMethod(paymentMethods[0] ?? "cash");
              setPaid(subtotal);
              setCheckoutError(null);
              setPayOpen(true);
            }}
          >
            BAYAR • Rp{subtotal.toLocaleString("id-ID")}
          </Button>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="mt-2 w-full text-center text-xs text-muted hover:text-text"
            >
              Clear cart (F8)
            </button>
          )}
        </aside>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Pembayaran</h2>
                <p className="mt-1 text-sm text-muted">Periksa pesanan sebelum menyelesaikan transaksi.</p>
              </div>
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                className="text-muted hover:text-text"
                aria-label="Tutup pembayaran"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
              <section className="min-w-0 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Daftar pesanan</h3>
                  <span className="text-xs text-muted">{cart.length} item</span>
                </div>
                <div className="mt-3 space-y-2">
                  {cart.map((item) => (
                    <div
                      key={`${item.type}-${item.productId ?? item.serviceId}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted">
                          {item.type === "product" ? "Barang" : "Jasa"} • {item.quantity} × Rp{item.price.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">Rp{item.subtotal.toLocaleString("id-ID")}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-sm text-muted">Total Pembayaran</p>
                <p className="text-3xl font-bold">Rp{subtotal.toLocaleString("id-ID")}</p>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Jenis kendaraan <span className="text-danger">*</span></span>
              <input
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder="Contoh: Honda Beat 2022"
                className="mt-1 h-11 w-full rounded-xl border border-border px-3 focus:outline-2 focus:outline-primary"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Mekanik <span className="font-normal text-muted">(opsional)</span></span>
              <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 focus:outline-2 focus:outline-primary">
                <option value="">Pilih mekanik (opsional)</option>
                {activeMechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <p className="mt-4 text-sm font-medium">Metode Pembayaran</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    if (m !== "cash") setPaid(subtotal);
                  }}
                  className={
                    method === m
                      ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium"
                      : "rounded-lg border border-border px-4 py-2 text-sm"
                  }
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              Jumlah Dibayar
              <NumberInput
                value={paid}
                onValueChange={setPaid}
                disabled={method !== "cash"}
                className="mt-1 h-12 text-lg disabled:bg-background"
              />
            </label>
            {method === "cash" ? (
              <p className="mt-2 text-sm">
                Kembalian{" "}
                <span className="font-bold">
                  Rp{changePreview.toLocaleString("id-ID")}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Non-cash wajib uang pas, tanpa kembalian.
              </p>
            )}
            {checkoutError && (
              <p className="mt-2 text-sm text-danger">{checkoutError}</p>
            )}
            <Button
              className="mt-4 w-full"
              disabled={checkoutMutation.isPending || !vehicleType.trim()}
              onClick={() => checkoutMutation.mutate()}
            >
              {checkoutMutation.isPending ? "Memproses..." : "PROSES TRANSAKSI"}
            </Button>
            {!vehicleType.trim() && (
              <p className="mt-2 text-center text-xs text-danger">Jenis kendaraan wajib diisi.</p>
            )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
