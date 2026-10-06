import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/app/providers/AuthProvider";
import { getProductByBarcode, searchProductsByName, updateProduct } from "@/lib/firestore/products";
import { QuickAddDialog } from "@/features/pos/QuickAddDialog";
import { QuickAddServiceDialog } from "@/features/pos/QuickAddServiceDialog";
import { listServices, updateService } from "@/lib/firestore/services";
import { getGeneralSettings } from "@/lib/firestore/settings";
import { checkout } from "@/lib/firestore/transactions";
import { barcodeValueOf, buildReceiptText, downloadTextFile, formatReceiptDate, printTextViaBluetooth, shortNumberOf, type ReceiptDataInput } from "@/lib/receipt";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import { BluetoothPreviewDialog } from "@/components/BluetoothPreviewDialog";
import { loadHeldCarts, MAX_HELD, newHeldId, saveHeldCarts, type HeldCart } from "@/lib/posHeld";
import type { CartItem, PaymentMethod, Product, ServiceItem } from "@/types";
import { friendlyError } from "@/lib/errors";

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
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paid, setPaid] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldCart[]>(() => loadHeldCarts());
  const [activeHeldId, setActiveHeldId] = useState<string | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldMsg, setHeldMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [btPreview, setBtPreview] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [priceEdit, setPriceEdit] = useState<{ kind: "product" | "service"; id: string; name: string; price: number } | null>(null);
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

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
  const q = search.trim().toLowerCase();
  const filteredServices = q
    ? activeServices.filter((s) => s.name.toLowerCase().includes(q))
    : activeServices;
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
    if (!found) {
      setUnknownBarcode(code);
      setScanError(null);
      setBarcode("");
      return;
    }
    if (!found.isActive) {
      setScanError(`Produk ${found.name} sedang nonaktif. Aktifkan dulu di halaman Produk ya.`);
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
  function persistHeld(next: HeldCart[]) {
    setHeld(next);
    saveHeldCarts(next);
  }

  function holdActiveCart() {
    if (cart.length === 0) {
      setHeldMsg("Keranjang kosong — belum ada yang disimpan.");
      return;
    }
    if (!activeHeldId && held.length >= MAX_HELD) {
      setHeldMsg(`Keranjang tertahan penuh (maks ${MAX_HELD}). Selesaikan / hapus salah satu dulu.`);
      return;
    }
    const id = activeHeldId ?? newHeldId();
    const entry: HeldCart = {
      id,
      createdAt: held.find((h) => h.id === id)?.createdAt ?? Date.now(),
      vehicleType: vehicleType.trim(),
      method,
      items: cart,
    };
    const exists = held.some((h) => h.id === id);
    persistHeld(exists ? held.map((h) => (h.id === id ? entry : h)) : [...held, entry]);
    setCart([]);
    setVehicleType("");
    setPaid(0);
    setPayOpen(false);
    setActiveHeldId(null);
    setCheckoutError(null);
    setHeldMsg("Disimpan. Lanjutkan kapan saja dari ikon antrean di samping kolom scan.");
    barcodeRef.current?.focus();
  }

  function resumeHeld(id: string) {
    const target = held.find((h) => h.id === id);
    if (!target || id === activeHeldId) return;
    let next = held;
    if (cart.length > 0 && next.length < MAX_HELD && !activeHeldId) {
      next = [...next, { id: newHeldId(), createdAt: Date.now(), vehicleType: vehicleType.trim(), method, items: cart }];
    }
    if (cart.length > 0 && activeHeldId) {
      next = next.map((h) => (h.id === activeHeldId ? { ...h, items: cart, vehicleType: vehicleType.trim(), method } : h));
    }
    persistHeld(next);
    setCart(target.items);
    setVehicleType(target.vehicleType);
    setMethod(target.method);
    setPaid(target.items.reduce((s, i) => s + i.subtotal, 0));
    setActiveHeldId(target.id);
    setCheckoutError(null);
    setHeldMsg(`Melanjutkan keranjang (${target.items.length} item). Tambah lagi / PROSES bila sudah pas.`);
    barcodeRef.current?.focus();
  }

  function deleteHeld(id: string) {
    persistHeld(held.filter((h) => h.id !== id));
    if (activeHeldId === id) setActiveHeldId(null);
    setHeldMsg("Keranjang tertahan dihapus.");
  }

  function openPriceEditProduct(p: Product) {
    setPriceProduct(p);
    setPriceEdit({ kind: "product", id: p.id, name: p.name, price: p.sellingPrice });
    setPriceError(null);
  }

  function openPriceEditService(s: ServiceItem) {
    setPriceProduct(null);
    setPriceEdit({ kind: "service", id: s.id, name: s.name, price: s.price });
    setPriceError(null);
  }

  const priceMutation = useMutation({
    mutationFn: async (next: { kind: "product" | "service"; id: string; price: number }) => {
      if (next.price < 0) throw new Error("Harga tidak boleh kurang dari 0 ya.");
      const rounded = Math.floor(next.price);
      if (next.kind === "product") {
        if (!priceProduct) throw new Error("Data produk tidak ketemu. Tutup lalu buka lagi ya.");
        await updateProduct(next.id, {
          barcode: priceProduct.barcode,
          name: priceProduct.name,
          categoryId: priceProduct.categoryId,
          categoryName: priceProduct.categoryName,
          purchasePrice: priceProduct.purchasePrice,
          sellingPrice: rounded,
          stock: priceProduct.stock,
          minimumStock: priceProduct.minimumStock,
          unit: priceProduct.unit,
        });
        return rounded;
      }
      const s = (servicesQuery.data ?? []).find((x) => x.id === next.id);
      if (!s) throw new Error("Data jasa tidak ketemu. Tutup lalu buka lagi ya.");
      await updateService(next.id, { name: s.name, price: rounded, description: s.description ?? "" });
      return rounded;
    },
    onSuccess: (rounded) => {
      if (!priceEdit) return;
      // Harga di keranjang ikut terkoreksi bila itemnya sudah masuk.
      setCart((prev) =>
        prev.map((item) => {
          if (priceEdit.kind === "product" && item.type === "product" && item.productId === priceEdit.id)
            return { ...item, price: rounded, subtotal: rounded * item.quantity };
          if (priceEdit.kind === "service" && item.type === "service" && item.serviceId === priceEdit.id)
            return { ...item, price: rounded, subtotal: rounded * item.quantity };
          return item;
        }),
      );
      setPriceEdit(null);
      setPriceProduct(null);
      setPriceError(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      void queryClient.invalidateQueries({ queryKey: ["products", "pos-search"] });
    },
    onError: (err) => {
      setPriceError(friendlyError(err, "Gagal menyimpan harga. Coba lagi ya."));
    },
  });


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
      });
      setCart([]);
      if (activeHeldId) {
        const doneId = activeHeldId;
        setHeld((prev) => {
          const next = prev.filter((h) => h.id !== doneId);
          saveHeldCarts(next);
          return next;
        });
        setActiveHeldId(null);
        setHeldMsg("Transaksi dari keranjang tersimpan ke database. Stok berkurang.");
      }
      setPayOpen(false);
      setPaid(0);
      setCheckoutError(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      setCheckoutError(friendlyError(err, "Transaksi gagal. Cek lagi keranjang & pembayaran ya."));
    },
  });

  const searchedProducts = activeProducts;

  useEffect(() => {
    const size = settingsQuery.data?.paperSize ?? "80";
    document.body.classList.toggle("paper-58", size === "58");
    return () => document.body.classList.remove("paper-58");
  }, [settingsQuery.data?.paperSize]);

  function receiptData(): ReceiptDataInput | null {
    if (!success) return null;
    return {
      storeName: settingsQuery.data?.receiptHeader ?? settingsQuery.data?.storeName ?? "sedyo makmur motor",
      address: settingsQuery.data?.address || undefined,
      email: settingsQuery.data?.email || undefined,
      phone: settingsQuery.data?.phone || undefined,
      dateStr: formatReceiptDate(new Date()),
      shortNumber: shortNumberOf(success.transactionNumber),
      barcodeValue: barcodeValueOf(success.transactionNumber),
      // Keputusan user: baris Pelanggan diisi dari input jenis kendaraan.
      customerLine: success.vehicleType,
      items: success.items,
      total: success.total,
      payment: success.payment,
      change: success.change,
      footer: settingsQuery.data?.receiptFooter || undefined,
    };
  }

  function receiptText() {
    const d = receiptData();
    if (!d) return "";
    return buildReceiptText(d);
  }

  function printReceipt() {
    window.print();
  }

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText());
      setPrintMsg("Struk disalin — tempel ke RawBT / aplikasi printer.");
    } catch {
      setPrintMsg("Gagal menyalin. Pakai Unduh .txt.");
    }
  }

  async function bluetoothReceipt() {
    const d = receiptData();
    if (!d) {
      setPrintMsg("Data struk belum siap. Coba lagi ya.");
      return;
    }
    setPrinting(true);
    setPrintMsg(null);
    try {
      await printTextViaBluetooth(d);
      setPrintMsg("Terkirim ke printer Bluetooth.");
    } catch (err) {
      setPrintMsg(friendlyError(err, "Gagal cetak via Bluetooth. Pakai tombol Salin lalu cetak dari RawBT ya."));
    } finally {
      setPrinting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-4xl text-success">✓</p>
        <h1 className="mt-2 text-xl font-bold">Transaksi Berhasil</h1>
        <p className="mt-1 font-mono text-sm">{success.transactionNumber}</p>
        {(success.customerName || success.vehiclePlate || success.vehicleType) && (
          <p className="mt-2 text-sm text-muted">
            {[success.customerName, success.vehiclePlate, success.vehicleType].filter(Boolean).join(" • ")}
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
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={printReceipt}>
            Cetak Struk
          </Button>
          <Button variant="secondary" disabled={printing} onClick={() => { setPrintMsg(null); setBtPreview(true); }}>
            {printing ? "Mengirim..." : "Bluetooth"}
          </Button>
          <Button variant="secondary" onClick={() => void copyReceipt()}>
            Salin Teks
          </Button>
          <Button variant="secondary" onClick={() => downloadTextFile(`${success.transactionNumber}.txt`, receiptText())}>
            Unduh .txt
          </Button>
          <Button
            className="col-span-2"
            autoFocus
            onClick={() => {
              setSuccess(null);
              barcodeRef.current?.focus();
            }}
          >
            Transaksi Baru
          </Button>
        </div>
        {printMsg && <p className="mt-2 text-xs text-muted">{printMsg}</p>}
        <BluetoothPreviewDialog
          open={btPreview}
          title="Preview Struk Bluetooth"
          data={receiptData()}
          text={receiptText()}
          printing={printing}
          printMsg={printMsg}
          onClose={() => setBtPreview(false)}
          onConfirm={() => void bluetoothReceipt()}
        />
        <div className="print-only mt-6">
          {receiptData() && <ReceiptPrint d={receiptData()!} />}
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
          <div className="mt-3 flex items-stretch gap-2">
            <form onSubmit={handleScan} className="min-w-0 flex-1">
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="🔎 Scan barcode atau cari produk..."
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm focus:outline-2 focus:outline-primary"
              />
            </form>
            <button
              type="button"
              title={held.length > 0 ? `Antrean (${held.length}) — klik untuk lihat` : "Antrean — kosong"}
              onClick={() => setHeldOpen(true)}
              className="relative h-12 w-12 shrink-0 rounded-xl border border-border bg-surface text-muted transition-colors hover:border-primary hover:text-text"
            >
              <ClipboardList className="mx-auto h-5 w-5" />
              {held.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-gray-900">
                  {held.length}
                </span>
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Scanner siap {scanReady ? "●" : "○"} • F2 fokus • F4 bayar • F8
            clear
          </p>
          {scanError && <p className="mt-1 text-sm text-danger">{scanError}</p>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk / jasa..."
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setManualOpen(true)}>
                + Tambah Produk
              </Button>
              <Button variant="secondary" onClick={() => setServiceOpen(true)}>
                + Tambah Jasa
              </Button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {searchedProducts.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => addProduct(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") addProduct(p);
                }}
                className="cursor-pointer rounded-xl border border-border bg-surface p-3 text-left hover:border-primary"
              >
                <p className="truncate text-sm font-medium">{p.name} - Rp{p.sellingPrice.toLocaleString("id-ID")}</p>
                <p className="mt-0.5 flex items-center justify-between text-xs text-muted">
                  <span>Stok: {p.stock}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPriceEditProduct(p);
                    }}
                    className="hover:text-text hover:underline"
                    title="Edit harga"
                  >
                    ✏️
                  </button>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h2 className="font-bold">Jasa</h2>
          </div>
          {filteredServices.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Jasa tidak ketemu. Klik + Tambah Jasa ya.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {filteredServices.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => addService(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") addService(s);
                  }}
                  className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
                >
                  {s.name} • Rp{s.price.toLocaleString("id-ID")}{" "}
                  <button
                    type="button"
                    title="Edit harga jasa"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPriceEditService(s);
                    }}
                    className="ml-1 text-muted hover:text-text"
                  >
                    ✏️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-4 xl:sticky xl:top-4">
          <h2 className="font-bold">Keranjang</h2>
          {cart.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Belum ada item. Scan barcode untuk mulai.
            </p>
          ) : (
            <ul className="mt-3 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
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
              setMethod((prev) => (paymentMethods.includes(prev) ? prev : (paymentMethods[0] ?? "cash")));
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

      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Keranjang Tertahan ({held.length}/{MAX_HELD})</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted">Tersimpan lokal — belum ke database, stok belum berkurang. Klik Lanjut untuk edit / proses.</p>
          {heldMsg && <p className="mt-1 text-xs text-success">{heldMsg}</p>}
          {held.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Belum ada keranjang tertahan.</p>
          ) : (
            <ul className="mt-3 grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {held.map((h) => {
                const total = h.items.reduce((s, i) => s + i.subtotal, 0);
                const active = h.id === activeHeldId;
                return (
                  <li key={h.id} className={`rounded-lg border p-3 text-sm ${active ? "border-primary" : "border-border"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{h.items.length} item • Rp{total.toLocaleString("id-ID")}</p>
                      <span className="text-xs text-muted">{new Date(h.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{h.vehicleType || "Kendaraan belum diisi"} • {METHOD_LABEL[h.method]}</p>
                    <p className="mt-1 truncate text-xs text-muted">{h.items.slice(0, 3).map((i) => i.name).join(", ")}{h.items.length > 3 ? "…" : ""}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="flex-1" disabled={active} onClick={() => { resumeHeld(h.id); setHeldOpen(false); }}>
                        {active ? "Aktif" : "Lanjut"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => deleteHeld(h.id)}>
                        Hapus
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

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
            <Button
              variant="secondary"
              className="mt-2 w-full"
              disabled={checkoutMutation.isPending || cart.length === 0}
              onClick={holdActiveCart}
            >
              SIMPAN KE KERANJANG
            </Button>
            <p className="mt-2 text-center text-xs text-muted">
              Disimpan lokal (belum ke database & stok belum berkurang).
            </p>
            {!vehicleType.trim() && (
              <p className="mt-1 text-center text-xs text-danger">Jenis kendaraan wajib diisi untuk proses — simpan keranjang boleh tanpa itu.</p>
            )}
              </section>
            </div>
          </div>
        </div>
      )}
      <QuickAddDialog
        barcode={unknownBarcode}
        onClose={() => {
          setUnknownBarcode(null);
          barcodeRef.current?.focus();
        }}
        onSaved={(p) => {
          addProduct(p);
          setBarcode("");
          barcodeRef.current?.focus();
          void queryClient.invalidateQueries({ queryKey: ["products"] });
          void queryClient.invalidateQueries({ queryKey: ["products", "pos-search"] });
        }}
      />
      <QuickAddDialog
        barcode={manualOpen ? "" : null}
        manual
        onClose={() => setManualOpen(false)}
        onSaved={(p) => {
          addProduct(p);
          setManualOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["products"] });
          void queryClient.invalidateQueries({ queryKey: ["products", "pos-search"] });
        }}
      />
      <QuickAddServiceDialog
        open={serviceOpen}
        onClose={() => setServiceOpen(false)}
        onSaved={(s) => {
          addService(s);
          setServiceOpen(false);
          // Auto-fetch: daftar jasa langsung segar, card baru bisa diklik tanpa refresh.
          void queryClient.invalidateQueries({ queryKey: ["services"] });
        }}
      />
      <Dialog open={priceEdit !== null} onOpenChange={(v) => !v && setPriceEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit harga — {priceEdit?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted">
            Koreksi harga master di sini. Harga di keranjang ikut terkoreksi, dan struk memakai harga baru. Perubahan tersimpan permanen.
          </p>
          <label className="mt-2 block text-sm">
            Harga baru (Rp)
            <NumberInput
              value={priceEdit?.price ?? 0}
              onValueChange={(n) => setPriceEdit((prev) => (prev ? { ...prev, price: n } : prev))}
              className="mt-1 h-12 text-lg"
            />
          </label>
          {priceError && <p className="mt-1 text-sm text-danger">{priceError}</p>}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPriceEdit(null)} disabled={priceMutation.isPending}>
              Batal
            </Button>
            <Button
              disabled={priceMutation.isPending || !priceEdit}
              onClick={() => priceEdit && priceMutation.mutate({ kind: priceEdit.kind, id: priceEdit.id, price: priceEdit.price })}
            >
              {priceMutation.isPending ? "Menyimpan..." : "Simpan Harga"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
