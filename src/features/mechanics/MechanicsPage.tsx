import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, RefreshCw } from "lucide-react";
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
  createMechanic,
  listMechanics,
  renameMechanic,
  setMechanicActive,
} from "@/lib/firestore/services";
import type { Mechanic } from "@/types";

export function MechanicsPage() {
  const queryClient = useQueryClient();
  const mechanicsQuery = useQuery({ queryKey: ["mechanics"], queryFn: listMechanics });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["mechanics"] });
  }

  const saveMutation = useMutation({
    mutationFn: (n: string) =>
      editingId ? renameMechanic(editingId, n) : createMechanic({ name: n }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setEditingId(null);
      setError(null);
      refresh();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Gagal.");
    },
  });

  function openCreate() {
    setEditingId(null);
    setError(null);
    setName("");
    setOpen(true);
  }

  function openEdit(m: Mechanic) {
    setEditingId(m.id);
    setError(null);
    setName(m.name);
    setOpen(true);
  }

  const mechanics = mechanicsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mekanik"
        description="Kelola daftar mekanik bengkel."
        action={
          <Button onClick={openCreate}>
            <Plus />
            Tambah Mekanik
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Nama Mekanik</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mechanics.map((m) => (
                <tr key={m.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{m.name}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={m.isActive ? "success" : "secondary"}>
                      {m.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(m)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMechanicActive(m.id, !m.isActive).then(refresh)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        {m.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mechanicsQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted" />
            <span className="ml-2 text-sm text-muted">Memuat...</span>
          </div>
        )}

        {!mechanicsQuery.isLoading && mechanics.length === 0 && (
          <EmptyState
            icon="👨‍🔧"
            title="Belum ada mekanik"
            description="Tambahkan mekanik pertama untuk mulai mencatat pengerjaan."
          />
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ubah Nama Mekanik" : "Tambah Mekanik Baru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui nama mekanik." : "Masukkan nama mekanik baru."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="mechanic-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(name);
            }}
            className="pt-2"
          >
            <FormField label="Nama Mekanik">
              <Input
                required
                placeholder="Nama lengkap"
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
            <Button type="submit" form="mechanic-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
