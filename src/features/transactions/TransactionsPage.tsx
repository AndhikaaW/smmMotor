import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  deleteTransaction,
  listTransactionPage,
} from "@/lib/firestore/transactions";
import { barcodeValueOf, buildReceiptText, downloadTextFile, formatReceiptDate, printTextViaBluetooth, shortNumberOf, type ReceiptDataInput } from "@/lib/receipt";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import { getGeneralSettings } from "@/lib/firestore/settings";
import type { PaymentMethod, Transaction } from "@/types";
import { friendlyError } from "@/lib/errors";

const METHODS = ["", "cash", "qris", "transfer", "debit", "other"] as const;
const STATUSES = ["completed", "all", "deleted"] as const;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
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
  const settingsQuery = useQuery({ queryKey: ["settings", "general"], queryFn: getGeneralSettings, staleTime: 15 * 60 * 1000 });

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
      await printTextViaBluetooth(selectedReceiptText(t));
      setPrintMsg("Terkirim ke printer Bluetooth.");
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
        date: applied.useDate ? new Date(`${applied.date}T00:00:00`) : undefined,
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
                onClick={() => setSelected(null)}
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

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print Ulang
              </Button>
              <Button variant="secondary" disabled={printing} onClick={() => void bluetoothReprint(selected)}>
                {printing ? "Mengirim..." : "Bluetooth"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(selectedReceiptText(selected)).then(
                    () => setPrintMsg("Struk disalin — tempel ke RawBT."),
                    () => setPrintMsg("Gagal menyalin. Pakai Unduh .txt."),
                  );
                }}
              >
                Salin Teks
              </Button>
              <Button variant="secondary" onClick={() => downloadTextFile(`${selected.transactionNumber}.txt`, selectedReceiptText(selected))}>
                Unduh .txt
              </Button>
              {canDelete && selected.status === "completed" && !confirmDelete && (
                <Button variant="destructive" className="col-span-2" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                  Hapus Transaksi
                </Button>
              )}
            </div>
            {printMsg && <p className="mt-2 text-xs text-muted">{printMsg}</p>}
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
