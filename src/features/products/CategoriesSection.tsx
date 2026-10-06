import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, EmptyState } from "@/components/ui/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createCategory,
  listCategories,
  renameCategory,
  setCategoryActive,
} from "@/lib/firestore/categories";
import type { Category } from "@/types";
import { friendlyError } from "@/lib/errors";

export function CategoriesSection() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories-active"] });
  }

  const saveMutation = useMutation({
    mutationFn: (n: string) =>
      editingId ? renameCategory(editingId, n) : createCategory({ name: n }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setEditingId(null);
      setError(null);
      refresh();
    },
    onError: (err) => {
      setError(friendlyError(err, "Gagal menyimpan kategori. Coba lagi ya."));
    },
  });

  function openCreate() {
    setEditingId(null);
    setError(null);
    setName("");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditingId(c.id);
    setError(null);
    setName(c.name);
    setOpen(true);
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Kategori Produk</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus />
            Tambah Kategori
          </Button>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-y border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5">Nama Kategori</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3">
                    <Badge variant={c.isActive ? "success" : "secondary"}>
                      {c.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(c)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Ubah
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCategoryActive(c.id, !c.isActive).then(refresh)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        {c.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {categoriesQuery.isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-4 w-4 animate-spin text-muted" />
            <span className="ml-2 text-sm text-muted">Memuat...</span>
          </div>
        )}

        {!categoriesQuery.isLoading && categories.length === 0 && (
          <EmptyState
            icon="🗂️"
            title="Belum ada kategori"
            description="Tambahkan kategori untuk mengelompokkan produk."
          />
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ubah Nama Kategori" : "Tambah Kategori Baru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui nama kategori." : "Masukkan nama kategori baru."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="category-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(name);
            }}
            className="pt-2"
          >
            <FormField label="Nama Kategori">
              <Input
                required
                placeholder="Oli, Filter, Ban, dll."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </FormField>
          </form>

          {error && <p className="mt-1 text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
              Batal
            </Button>
            <Button type="submit" form="category-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
