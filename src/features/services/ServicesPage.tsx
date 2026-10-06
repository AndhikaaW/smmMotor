import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
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
  createService,
  listServices,
  setServiceActive,
  updateService,
  type ServiceInput,
} from "@/lib/firestore/services";
import type { ServiceItem as Service } from "@/types";
import { friendlyError } from "@/lib/errors";

const EMPTY: ServiceInput = { name: "", price: 0, description: "" };

export function ServicesPage() {
  const queryClient = useQueryClient();
  const servicesQuery = useQuery({ queryKey: ["services"], queryFn: listServices });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["services"] });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: ServiceInput) => {
      if (editingId) await updateService(editingId, input);
      else await createService(input);
    },
    onSuccess: () => {
      setOpen(false);
      setEditingId(null);
      setError(null);
      refresh();
    },
    onError: (err) => {
      setError(friendlyError(err, "Gagal menyimpan jasa. Coba lagi ya."));
    },
  });

  function openCreate() {
    setEditingId(null);
    setError(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setError(null);
    setForm({ name: s.name, price: s.price, description: s.description ?? "" });
    setOpen(true);
  }

  const services = servicesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jasa"
        description="Kelola daftar jasa dan tarif bengkel."
        action={
          <Button onClick={openCreate}>
            <Plus />
            Tambah Jasa
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Nama Jasa</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3">Tarif</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-background/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{s.name}</td>
                  <td className="px-5 py-3.5 text-muted text-xs max-w-xs truncate">
                    {s.description || "—"}
                  </td>
                  <td className="px-5 py-3.5 font-medium">
                    Rp{s.price.toLocaleString("id-ID")}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={s.isActive ? "success" : "secondary"}>
                      {s.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setServiceActive(s.id, !s.isActive).then(refresh)}
                        className="h-8 px-2 text-muted hover:text-text"
                      >
                        {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {servicesQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted" />
            <span className="ml-2 text-sm text-muted">Memuat...</span>
          </div>
        )}

        {!servicesQuery.isLoading && services.length === 0 && (
          <EmptyState
            icon="🔧"
            title="Belum ada jasa"
            description="Tambahkan jasa pertama untuk mulai menerima order servis."
          />
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Jasa" : "Tambah Jasa Baru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui informasi jasa bengkel." : "Isi detail jasa yang ingin ditambahkan."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="service-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
            className="space-y-4 pt-2"
          >
            <FormField label="Nama Jasa">
              <Input
                required
                placeholder="Ganti oli, tune-up, dll."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            <FormField label="Tarif (Rp)">
              <NumberInput
                value={form.price}
                onValueChange={(n) => setForm({ ...form, price: n })}
              />
            </FormField>

            <FormField label="Deskripsi (opsional)">
              <textarea
                rows={3}
                placeholder="Keterangan tambahan..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 resize-none"
              />
            </FormField>
          </form>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
              Batal
            </Button>
            <Button type="submit" form="service-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Jasa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
