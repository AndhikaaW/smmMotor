import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { createService, type ServiceInput } from "@/lib/firestore/services";
import { friendlyError } from "@/lib/errors";
import type { ServiceItem } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (s: ServiceItem) => void;
}

export function QuickAddServiceDialog({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ServiceInput>({ name: "", price: 0, description: "" });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: ServiceInput) => createService(input),
    onSuccess: (created, input) => {
      onSaved({
        id: created.id,
        name: input.name.trim(),
        price: input.price,
        description: input.description ?? "",
        isActive: true,
      });
      setForm({ name: "", price: 0, description: "" });
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(friendlyError(err, "Gagal menyimpan jasa. Coba lagi ya."));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Jasa</DialogTitle>
          <DialogDescription>Tambah jasa baru dulu, lalu otomatis masuk keranjang.</DialogDescription>
        </DialogHeader>
        <form
          id="pos-quick-add-service"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="grid gap-4 pt-2"
        >
          <FormField label="Nama Jasa">
            <Input
              required
              placeholder="cth: Ganti oli"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Tarif (Rp)">
            <NumberInput value={form.price} onValueChange={(n) => setForm({ ...form, price: n })} />
          </FormField>
          <FormField label="Keterangan (opsional)">
            <Input
              placeholder="cth: termasuk oli"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>
        </form>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="submit" form="pos-quick-add-service" disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan..." : "Simpan & Masuk Keranjang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
