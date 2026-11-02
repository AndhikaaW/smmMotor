import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Card } from "@/components/ui/card";
import { PageHeader, FormField, EmptyState } from "@/components/ui/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_CATEGORY_OPTIONS,
  createExpense,
  deleteExpense,
  expenseCategoryLabel,
  listExpenses,
  updateExpense,
  type ExpenseInput,
} from "@/lib/firestore/expenses";
import { wibDateStr } from "@/lib/firestore/transactions";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Expense } from "@/types";
import { friendlyError } from "@/lib/errors";

function monthRange(month: string): { from: string; to: string } {
  const safe = /^\d{4}-\d{2}$/.test(month) ? month : wibDateStr().slice(0, 7);
  const [y, m] = safe.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${safe}-01`, to: `${safe}-${pad(dim)}` };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function idr(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function ExpensesPage() {
  const { appUser } = useAuth();
  const queryClient = useQueryClient();
  const today = wibDateStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseInput>({
    date: today,
    category: "other",
    description: "",
    amount: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const range = useMemo(() => monthRange(month), [month]);
  const expensesQuery = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => listExpenses(range.from, range.to),
    enabled: month.length === 7,
    staleTime: 30 * 1000,
  });

  const rows = expensesQuery.data ?? [];
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const categoryTotals = new Map<string, number>();
  for (const e of rows) categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount);
  const bestCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCategory = bestCategory
    ? { label: expenseCategoryLabel(bestCategory[0]), amount: bestCategory[1] }
    : null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["expenses"] });
    void queryClient.invalidateQueries({ queryKey: ["report-day"] });
    void queryClient.invalidateQueries({ queryKey: ["report-month"] });
    void queryClient.invalidateQueries({ queryKey: ["report-range"] });
    void queryClient.invalidateQueries({ queryKey: ["report-trend"] });
  }

  function openCreate() {
    setEditingId(null);
    setError(null);
    setForm({ date: today, category: "other", description: "", amount: 0 });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setError(null);
    setForm({
      date: e.date,
      category: e.category,
      description: e.description,
      amount: e.amount,
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const actor = { userId: appUser?.uid ?? "", userName: appUser?.name ?? "" };
      if (editingId) await updateExpense(editingId, input);
      else await createExpense(input, actor);
    },
    onSuccess: () => {
      setOpen(false);
      setEditingId(null);
      setError(null);
      refresh();
    },
    onError: (err) => {
      setError(friendlyError(err, "Gagal menyimpan pengeluaran. Coba lagi ya."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteError(null);
      refresh();
    },
    onError: (err) => {
      setDeleteError(friendlyError(err, "Gagal menghapus pengeluaran. Coba lagi ya."));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengeluaran"
        description="Catat beban operasional (gaji, sewa, listrik, dll) agar laba bersih di laporan akurat."
        action={
          <Button onClick={openCreate}>
            <Plus />
            Tambah Pengeluaran
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
        />
        <span className="text-sm text-muted">
          {formatDate(range.from)} — {formatDate(range.to)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Total Pengeluaran</p>
          <p className="mt-1 text-xl font-bold text-danger">{idr(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Jumlah Catatan</p>
          <p className="mt-1 text-xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Kategori Terbesar</p>
          <p className="mt-1 text-xl font-bold">
            {topCategory ? `${topCategory.label} • ${idr(topCategory.amount)}` : "—"}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-5 py-3">Kategori</th>
                <th className="px-5 py-3">Keterangan</th>
                <th className="px-5 py-3 text-right">Nominal</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-background/60 transition-colors">
                  <td className="whitespace-nowrap px-5 py-3.5">{formatDate(e.date)}</td>
                  <td className="px-5 py-3.5">{expenseCategoryLabel(e.category)}</td>
                  <td className="max-w-xs truncate px-5 py-3.5 text-muted">{e.description || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono font-medium">
                    {idr(e.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(e)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(e);
                        }}
                        className="h-8 px-2 text-muted hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {expensesQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted" />
            <span className="ml-2 text-sm text-muted">Memuat...</span>
          </div>
        )}

        {expensesQuery.isError && (
          <p className="p-5 text-sm text-danger">
            {friendlyError(expensesQuery.error, "Gagal memuat pengeluaran. Cek koneksi lalu coba lagi ya.")}
          </p>
        )}

        {!expensesQuery.isLoading && !expensesQuery.isError && rows.length === 0 && (
          <EmptyState
            icon="🧾"
            title="Belum ada pengeluaran"
            description="Catat gaji, sewa, listrik, atau biaya operasional lain bulan ini agar laba bersih di laporan terhitung."
          />
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Perbarui data beban operasional."
                : "Catat beban operasional yang keluar pada tanggal tertentu."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="expense-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
            className="space-y-4 pt-2"
          >
            <FormField label="Tanggal">
              <Input
                type="date"
                required
                value={form.date}
                max={today}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </FormField>

            <FormField label="Kategori">
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm({ ...form, category: value as ExpenseInput["category"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Keterangan">
              <Input
                required
                placeholder="Contoh: gaji 2 karyawan, token listrik..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>

            <FormField label="Nominal (Rp)">
              <NumberInput
                value={form.amount}
                onValueChange={(n) => setForm({ ...form, amount: n })}
              />
            </FormField>
          </form>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
              Batal
            </Button>
            <Button type="submit" form="expense-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Pengeluaran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pengeluaran?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `${deleteTarget.description || expenseCategoryLabel(deleteTarget.category)} • ${idr(deleteTarget.amount)} akan dihapus permanen. Laba bersih bulan ini ikut berubah.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
