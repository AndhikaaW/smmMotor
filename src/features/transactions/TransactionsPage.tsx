import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bluetooth, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  deleteTransaction,
  getTransaction,
  listTransactionPage,
  updateTransaction,
  wibDateStr,
} from "@/lib/firestore/transactions";
import { searchProductsByName } from "@/lib/firestore/products";
import { listServices } from "@/lib/firestore/services";
import { barcodeValueOf, buildReceiptText, formatReceiptDate, printTextViaBluetooth, shortNumberOf, type ReceiptDataInput } from "@/lib/receipt";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import { BluetoothPreviewDialog } from "@/components/BluetoothPreviewDialog";
import { getGeneralSettings } from "@/lib/firestore/settings";
import type { CartItem, PaymentMethod, Transaction } from "@/types";
import { friendlyError } from "@/lib/errors";

const METHODS = ["", "cash", "qris", "transfer", "debit", "other"] as const;
const STATUSES = ["completed", "all", "deleted"] as const;

function fmtDate(d: Date) {
  return wibDateStr(d);
}

export function TransactionsPage() {
  const { appUser } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();
  const [date, setDate] = useState(fmtDate(today));
  const [useDate, setUseDate] = useState(true);
  const [number, setNumber] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("completed");
  const [applied, setApplied] = useState({
    date: fmtDate(today),
    useDate: true,
    number: "",
    method: "" as (typeof METHODS)[number],
    status: "completed" as (typeof STATUSES)[number],
  });
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [btPreview, setBtPreview] = useState(false);
  const [btCompatible, setBtCompatible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<CartItem[]>([]);
  const [editMethod, setEditMethod] = useState<PaymentMethod>("cash");
  const [editPayment, setEditPayment] = useState(0);
  const [editError, setEditError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const settingsQuery = useQuery({ queryKey: ["settings", "general"], queryFn: getGeneralSettings, staleTime: 15 * 60 * 1000 });
  const servicesQuery = useQuery({ queryKey: ["services"], queryFn: listServices, staleTime: 10 * 60 * 1000, enabled: editing });
  const productSearchQuery = useQuery({
    queryKey: ["products", "trx-edit-search", productSearch.trim()],
    queryFn: () => searchProductsByName(productSearch.trim() || "a", 10),
    staleTime: 60 * 1000,
    enabled: editing,
  });

  function selectedReceiptData(t: Transaction): ReceiptDataInput {
    return {
      storeName: settingsQuery.data?.receiptHeader ?? settingsQuery.data?.storeName ?? "sedyo makmur motor",
      address: settingsQuery.data?.address || undefined,
      email: settingsQuery.data?.email || undefined,
      phone: settingsQuery.data?.phone || undefined,
      dateStr: formatReceiptDate(t.transactionDate.toDate()),
      shortNumber: shortNumberOf(t.transactionNumber),
      barcodeValue: barcodeValueOf(t.transactionNumber),
      customerLine: t.vehicleType || t.customerName,
      items: t.items,
      total: t.total,
      payment: t.payment,
      change: t.change,
      footer: settingsQuery.data?.receiptFooter || undefined,
    };
  }

  function selectedReceiptText(t: Transaction): string {
    return buildReceiptText(selectedReceiptData(t));
  }

  async function bluetoothReprint(t: Transaction) {
    setPrinting(true);
    setPrintMsg(null);
    try {
      const r = await printTextViaBluetooth(selectedReceiptData(t), { compatible: btCompatible });
      setPrintMsg(`Terkirim ${r.bytes} byte ke ${r.deviceName}. Kertas tidak keluar? Aktifkan Mode kompatibel lalu cetak ulang, atau Salin ke RawBT ya.`);
    } catch (err) {
      setPrintMsg(friendlyError(err, "Gagal cetak via Bluetooth. Pakai tombol Salin lalu cetak dari RawBT ya."));
    } finally {
      setPrinting(false);
    }
  }

  const listQuery = useInfiniteQuery({
    queryKey: ["transactions", applied],
    queryFn: ({ pageParam }) =>
      listTransactionPage({
        date: applied.useDate ? applied.date : undefined,
        number: applied.number || undefined,
        paymentMethod: (applied.method || undefined) as PaymentMethod | undefined,
        status: applied.status,
        pageSize: 25,
        cursor: pageParam,
      }),
    initialPageParam: null as unknown | null,
    getNextPageParam: (lastPage) => lastPage.lastVisible,
    staleTime: 30 * 1000,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
  }

  const canDelete = appUser?.role === "superadmin" || appUser?.role === "admin";

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      deleteTransaction(id, {
        userId: appUser?.uid ?? "",
        userName: appUser?.name ?? "",
      }),
    onSuccess: () => {
      setConfirmDelete(false);
      setSelected(null);
      setDeleteError(null);
      refresh();
    },
    onError: (err) => {
      setDeleteError(friendlyError(err, "Gagal menghapus transaksi. Coba lagi ya."));
    },
  });
  const canEdit = (appUser?.role === "superadmin" || appUser?.role === "admin") && selected?.status === "completed";
  const editTotal = editItems.reduce((s, i) => s + i.subtotal, 0);
  const editMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Transaksi belum dipilih.");
      const isCash = editMethod === "cash";
      return updateTransaction(
        selected.id,
        { items: editItems, paymentMethod: editMethod, payment: isCash ? editPayment : editTotal },
        { userId: appUser?.uid ?? "", userName: appUser?.name ?? "" },
      );
    },
    onSuccess: async () => {
      if (!selected) return;
      setEditError(null);
      const fresh = await getTransaction(selected.id);
      if (fresh) setSelected(fresh);
      setEditing(false);
      refresh();
    },
    onError: (err) => {
      setEditError(friendlyError(err, "Gagal menyimpan edit. Cek stok lalu coba lagi ya."));
    },
  });
  function openEdit(t: Transaction) {
    setEditItems(t.items.map((i) => ({ ...i })));
    setEditMethod(t.paymentMethod);
    setEditPayment(t.payment);
    setEditError(null);
    setProductSearch("");
    setServiceSearch("");
    setConfirmDelete(false);
    setEditing(true);
  }
  function setEditQty(index: number, qty: number) {
    if (qty < 1) {
      setEditItems((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setEditItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty, subtotal: item.price * qty } : item)));
  }

  const rows = (listQuery.data?.pages ?? []).flatMap((p) => p.rows);

  return (
    <div>
      <h1 className="text-2xl font-bold">Riwayat Transaksi</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ date, useDate, number, method, status });
        }}
        className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3 text-sm"
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useDate}
            onChange={(e) => setUseDate(e.target.checked)}
          />
          <input
            type="date"
            value={date}
            disabled={!useDate}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-border px-2 disabled:opacity-50"
          />
        </label>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Nomor transaksi"
          className="h-10 w-48 rounded-lg border border-border px-3 font-mono"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="h-10 rounded-lg border border-border bg-surface px-2"
        >
          <option value="">Semua bayar</option>
          {METHODS.filter(Boolean).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 rounded-lg border border-border bg-surface px-2"
        >
          <option value="completed">Completed</option>
          <option value="all">Semua</option>
          <option value="deleted">Deleted</option>
        </select>
        <Button type="submit">Filter</Button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <td className="p-3">No Transaksi</td>
              <td className="p-3">Jenis Kendaraan</td>
              <td className="p-3">Kasir</td>
              <td className="p-3 text-right">Item</td>
              <td className="p-3 text-right">Total</td>
              <td className="p-3">Bayar</td>
              <td className="p-3">Status</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                onClick={() => {
                  setSelected(t);
                  setConfirmDelete(false);
                  setDeleteError(null);
                  setEditing(false);
                  setEditError(null);
                }}
              >
                <td className="p-3 font-mono text-xs">{t.transactionNumber}</td>
                <td className="p-3 font-medium">{t.vehicleType || "-"}</td>
                <td className="p-3">{t.cashierName}</td>
                <td className="p-3 text-right">
                  {t.items.reduce((s, i) => s + i.quantity, 0)}
                </td>
                <td className="p-3 text-right font-bold">
                  Rp{t.total.toLocaleString("id-ID")}
                </td>
                <td className="p-3">{t.paymentMethod}</td>
                <td className="p-3">
                  <span
                    className={
                      t.status === "completed"
                        ? "text-xs text-success"
                        : "text-xs text-danger"
                    }
                  >
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {listQuery.isError && (
          <p className="p-4 text-sm text-danger">
            {friendlyError(listQuery.error, "Gagal memuat riwayat. Cek koneksi lalu muat ulang ya.")}
          </p>
        )}
        {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
          <p className="p-4 text-sm text-muted">Tidak ada transaksi.</p>
        )}
      </div>
      {listQuery.hasNextPage && (
        <div className="mt-3 text-center">
          <Button
            variant="secondary"
            disabled={listQuery.isFetchingNextPage}
            onClick={() => void listQuery.fetchNextPage()}
          >
            {listQuery.isFetchingNextPage ? "Memuat..." : "Muat 25 lagi"}
          </Button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-mono font-bold">{selected.transactionNumber}</h2>
              <button
                type="button"
                onClick={() => { setSelected(null); setEditing(false); setConfirmDelete(false); }}
                className="rounded-md p-1 text-muted hover:bg-background hover:text-text"
                aria-label="Tutup detail transaksi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Kasir {selected.cashierName} • {selected.paymentMethod} • {selected.status}
            </p>
            {(selected.customerName || selected.vehiclePlate || selected.vehicleType) && (
              <p className="mt-1 text-sm">
                {[selected.customerName, selected.vehiclePlate, selected.vehicleType].filter(Boolean).join(" • ")}
              </p>
            )}
            <table className="mt-4 w-full text-sm">
              <tbody>
                {selected.items.map((i) => (
                  <tr
                    key={`${i.type}-${i.productId ?? i.serviceId}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2">
                      {i.name}
                      <span className="block text-xs text-muted">
                        {i.quantity} × Rp{i.price.toLocaleString("id-ID")}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">
                      Rp{i.subtotal.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>Rp{selected.subtotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>Rp{selected.total.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Bayar</span>
                <span>Rp{selected.payment.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Kembali</span>
                <span>Rp{selected.change.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {!editing ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {canEdit && (
                <Button variant="secondary" onClick={() => openEdit(selected)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}
              <Button variant="secondary" disabled={printing} onClick={() => { setPrintMsg(null); setBtPreview(true); }}>
                <Bluetooth className="h-4 w-4" />
                {printing ? "Mengirim..." : "Print Bluetooth"}
              </Button>
              {canDelete && selected.status === "completed" && !confirmDelete && (
                <Button variant="destructive" className="col-span-2" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                  Hapus Transaksi
                </Button>
              )}
            </div>
            ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-border p-3 text-sm">
              <p className="font-bold">Edit item — tambah kurangi stok otomatis</p>
              {editItems.map((i, idx) => (
                <div key={`${i.type}-${i.productId ?? i.serviceId}-${idx}`} className="flex items-center gap-2 border-b border-border pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-xs text-muted">Rp{i.price.toLocaleString("id-ID")} • Rp{i.subtotal.toLocaleString("id-ID")}</p>
                  </div>
                  <button type="button" aria-label="Kurangi" className="rounded-md border border-border p-1" onClick={() => setEditQty(idx, i.quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center font-bold">{i.quantity}</span>
                  <button type="button" aria-label="Tambah" className="rounded-md border border-border p-1" onClick={() => setEditQty(idx, i.quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk..."
                  className="h-9 rounded-lg border border-border bg-surface px-2"
                />
                <input
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Cari jasa..."
                  className="h-9 rounded-lg border border-border bg-surface px-2"
                />
              </div>
              {(productSearchQuery.data?.rows ?? []).filter((p) => p.isActive && !editItems.some((i) => i.type === "product" && i.productId === p.id)).slice(0, 4).map((p) => (
                <button key={p.id} type="button" className="mr-2 rounded-lg border border-border px-2 py-1 text-xs hover:border-primary" onClick={() => setEditItems((prev) => [...prev, { type: "product", productId: p.id, name: p.name, price: p.sellingPrice, quantity: 1, subtotal: p.sellingPrice }])}>
                  + {p.name} • Stok {p.stock}
                </button>
              ))}
              <div>
                {(servicesQuery.data ?? []).filter((s) => s.isActive && s.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()) && !editItems.some((i) => i.type === "service" && i.serviceId === s.id)).slice(0, 4).map((s) => (
                  <button key={s.id} type="button" className="mr-2 rounded-lg border border-border px-2 py-1 text-xs hover:border-primary" onClick={() => setEditItems((prev) => [...prev, { type: "service", serviceId: s.id, name: s.name, price: s.price, quantity: 1, subtotal: s.price }])}>
                    + {s.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select value={editMethod} onChange={(e) => setEditMethod(e.target.value as PaymentMethod)} className="h-9 rounded-lg border border-border bg-surface px-2">
                  <option value="cash">cash</option>
                  <option value="qris">qris</option>
                  <option value="transfer">transfer</option>
                  <option value="debit">debit</option>
                  <option value="other">other</option>
                </select>
                {editMethod === "cash" && (
                  <NumberInput value={editPayment} onValueChange={setEditPayment} className="h-9" aria-label="Nominal bayar" />
                )}
                <span className="ml-auto font-bold">Rp{editTotal.toLocaleString("id-ID")}</span>
              </div>
              {editError && <p className="text-danger">{editError}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Batal</Button>
                <Button className="flex-1" disabled={editMutation.isPending || editItems.length === 0} onClick={() => editMutation.mutate()}>
                  {editMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
            )}
            {printMsg && <p className="mt-2 text-xs text-muted">{printMsg}</p>}
            {selected && (
              <BluetoothPreviewDialog
                open={btPreview}
                title="Preview Struk Bluetooth"
                data={selectedReceiptData(selected)}
                text={selectedReceiptText(selected)}
                printing={printing}
                printMsg={printMsg}
                compatible={btCompatible}
                onCompatibleChange={setBtCompatible}
                onClose={() => setBtPreview(false)}
                onConfirm={() => void bluetoothReprint(selected)}
              />
            )}
            {confirmDelete && (
              <div className="mt-4 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">
                <p className="font-bold">Hapus transaksi?</p>
                <p className="mt-1 text-muted">
                  Transaksi {selected.transactionNumber} akan dihapus dari riwayat aktif. Stok produk akan dikembalikan.
                </p>
                {deleteError && <p className="mt-1 text-danger">{deleteError}</p>}
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                    Jangan Hapus
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selected.id)}
                  >
                    {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
                  </Button>
                </div>
              </div>
            )}
        <div className="print-only">
          <ReceiptPrint d={selectedReceiptData(selected)} />
        </div>
          </div>
        </div>
      )}
    </div>
  );
}
