import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { FormField } from "@/components/ui/shared";
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
import { listActiveCategories } from "@/lib/firestore/categories";
import { createProduct, generateUniqueBarcode, getProductByBarcode, type ProductInput } from "@/lib/firestore/products";
import type { Product } from "@/types";

interface Props {
  barcode: string | null;
  manual?: boolean;
  onClose: () => void;
  onSaved: (p: Product) => void;
}

export function QuickAddDialog({ barcode, manual, onClose, onSaved }: Props) {
  const categoriesQuery = useQuery({ queryKey: ["categories-active"], queryFn: listActiveCategories });
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const [form, setForm] = useState<ProductInput>({
    barcode: "",
    name: "",
    categoryId: "",
    categoryName: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 1,
    minimumStock: 0,
    unit: "pcs",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (barcode !== null && !manual) {
      setForm({
        barcode,
        name: "",
        categoryId: "",
        categoryName: "",
        purchasePrice: 0,
        sellingPrice: 0,
        stock: 1,
        minimumStock: 0,
        unit: "pcs",
      });
      setError(null);
    } else if (barcode !== null && manual) {
      setForm({
        barcode: "",
        name: "",
        categoryId: "",
        categoryName: "",
        purchasePrice: 0,
        sellingPrice: 0,
        stock: 1,
        minimumStock: 0,
        unit: "pcs",
      });
      setError(null);
      void generateUniqueBarcode().then((code) =>
        setForm((f) => (f.barcode ? f : { ...f, barcode: code })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode, manual]);

  const mutation = useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: async (_, input) => {
      const p = await getProductByBarcode(input.barcode);
      if (p) onSaved(p);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    },
  });

  return (
    <Dialog open={barcode !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{manual ? "Tambah Produk Manual" : `Barcode ${barcode} belum terdaftar`}</DialogTitle>
          <DialogDescription>Tambah produk baru dulu, lalu otomatis masuk keranjang.</DialogDescription>
        </DialogHeader>
        <form
          id="pos-quick-add"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2"
        >
          <FormField label="Barcode">
            <div className="flex gap-2">
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              {manual && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void generateUniqueBarcode().then((code) => setForm((f) => ({ ...f, barcode: code })))}
                  title="Generate barcode otomatis"
                >
                  Auto
                </Button>
              )}
            </div>
          </FormField>
          <FormField label="Nama Produk">
            <Input placeholder="Nama produk" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
            <NumberInput value={form.purchasePrice} onValueChange={(n) => setForm({ ...form, purchasePrice: n })} />
          </FormField>
          <FormField label="Harga Jual (Rp)">
            <NumberInput value={form.sellingPrice} onValueChange={(n) => setForm({ ...form, sellingPrice: n })} />
          </FormField>
          <FormField label="Stok Awal">
            <NumberInput value={form.stock} onValueChange={(n) => setForm({ ...form, stock: n })} />
          </FormField>
          <FormField label="Stok Minimum">
            <NumberInput value={form.minimumStock} onValueChange={(n) => setForm({ ...form, minimumStock: n })} />
          </FormField>
          <FormField label="Satuan">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </FormField>
        </form>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="submit" form="pos-quick-add" disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan..." : "Simpan & Masuk Keranjang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
