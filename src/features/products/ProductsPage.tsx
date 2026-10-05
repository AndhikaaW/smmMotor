import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, PackageX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { CategoriesSection } from "@/features/products/CategoriesSection";
import { listActiveCategories } from "@/lib/firestore/categories";
import {
  createProduct,
  listProducts,
  setProductActive,
  updateProduct,
  type ProductInput,
} from "@/lib/firestore/products";
import type { Product } from "@/types";

function emptyForm(categories: { id: string; name: string }[]): ProductInput {
  return {
    barcode: "",
    name: "",
    categoryId: categories[0]?.id ?? "",
    categoryName: categories[0]?.name ?? "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    minimumStock: 0,
    unit: "pcs",
  };
}

const numberOr = (value: string, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const categoriesQuery = useQuery({
    queryKey: ["categories-active"],
    queryFn: listActiveCategories,
  });
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductInput>(emptyForm([]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const saveMutation = useMutation({
    mutationFn: (input: ProductInput) =>
      editingId ? updateProduct(editingId, input) : createProduct(input),
    onSuccess: () => {
      setOpen(false);
      setEditingId(null);
      setFormError(null);
      refresh();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan.");
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = productsQuery.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q),
    );
  }, [productsQuery.data, search]);

  function openCreate() {
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm(categories));
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setFormError(null);
    setForm({
      barcode: p.barcode,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      minimumStock: p.minimumStock,
      unit: p.unit,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produk"
        description="Kelola produk dan harga sparepart."
        action={
          <Button onClick={openCreate}>
            <Plus />
            Tambah Produk
          </Button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama / barcode..."
          className="max-w-sm"
        />
        {productsQuery.isRefetching && (
          <RefreshCw className="h-4 w-4 animate-spin text-muted" />
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Produk</th>
                <th className="px-5 py-3">Barcode</th>
                <th className="px-5 py-3">Harga Jual</th>
                <th className="px-5 py-3">Stok</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.categoryName}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">
                    {p.barcode || "—"}
                  </td>
                  <td className="px-5 py-3.5 font-medium">
                    Rp{p.sellingPrice.toLocaleString("id-ID")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.stock}</span>
                      <span className="text-xs text-muted">{p.unit}</span>
                      {p.stock <= p.minimumStock && (
                        <Badge variant={p.stock === 0 ? "danger" : "warning"}>
                          {p.stock === 0 ? "Habis" : "Menipis"}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={p.isActive ? "success" : "secondary"}>
                      {p.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(p)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProductActive(p.id, !p.isActive).then(refresh)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        <PackageX className="h-3.5 w-3.5" />
                        {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {productsQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted" />
            <span className="ml-2 text-sm text-muted">Memuat...</span>
          </div>
        )}

        {!productsQuery.isLoading && filtered.length === 0 && (
          <EmptyState
            icon="📦"
            title="Belum ada produk"
            description="Tambahkan produk pertama untuk mulai mengelola inventory bengkel."
          />
        )}
      </Card>

      {/* Categories */}
      <CategoriesSection />

      {/* Dialog Create/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Perbarui informasi produk. Ubah stok via menu Stok."
                : "Isi detail produk yang ingin ditambahkan."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="product-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
            className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2"
          >
            <FormField label="Barcode">
              <Input
                placeholder="Scan atau ketik barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </FormField>

            <FormField label="Nama Produk">
              <Input
                placeholder="Nama produk"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            <FormField label="Kategori" className="sm:col-span-2">
              <Select
                value={form.categoryId}
                onValueChange={(val) => {
                  const cat = categories.find((c) => c.id === val);
                  setForm({ ...form, categoryId: val, categoryName: cat?.name ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Harga Beli (Rp)">
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: numberOr(e.target.value, 0) })
                }
              />
            </FormField>

            <FormField label="Harga Jual (Rp)">
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: numberOr(e.target.value, 0) })
                }
              />
            </FormField>

            <FormField
              label="Stok Awal"
              error={editingId ? "Ubah stok via menu Stok" : undefined}
            >
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.stock}
                disabled={editingId !== null}
                onChange={(e) =>
                  setForm({ ...form, stock: Math.floor(numberOr(e.target.value, 0)) })
                }
              />
            </FormField>

            <FormField label="Stok Minimum">
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.minimumStock}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minimumStock: Math.floor(numberOr(e.target.value, 0)),
                  })
                }
              />
            </FormField>

            <FormField label="Satuan">
              <Input
                placeholder="pcs, liter, set..."
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </FormField>
          </form>

          {formError && (
            <p className="mt-1 text-sm text-danger">{formError}</p>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={saveMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="product-form"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
