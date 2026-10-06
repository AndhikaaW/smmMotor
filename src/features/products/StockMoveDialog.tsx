import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { moveStock } from "@/lib/firestore/stock";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Product } from "@/types";
import { friendlyError } from "@/lib/errors";

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

// ponytail: tanpa alasan/catatan; upgrade path: tambah reason bila audit butuh.
export function StockMoveDialog({ product, onClose, onSaved }: Props) {
  const { appUser } = useAuth();
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      moveStock({
        productId: product?.id ?? "",
        direction,
        quantity: Math.floor(qty || 0),
        userId: appUser?.uid ?? "",
        userName: appUser?.name ?? "",
      }),
    onSuccess: () => {
      setError(null);
      setQty(1);
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(friendlyError(err, "Gagal mengubah stok. Coba lagi ya."));
    },
  });

  const after = (product?.stock ?? 0) + (direction === "in" ? Math.floor(qty || 0) : -Math.floor(qty || 0));

  return (
    <Dialog open={product !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>
            Stok sekarang: <span className="font-bold">{product?.stock}</span> {product?.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["in", "out"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={
                direction === d
                  ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium"
                  : "rounded-lg border border-border px-4 py-2 text-sm"
              }
            >
              {d === "in" ? "+ Tambah" : "− Kurang"}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm">
          <span className="font-medium">Jumlah</span>
          <NumberInput value={qty} onValueChange={setQty} className="mt-1 h-12 text-lg" />
        </label>
        <p className="mt-2 text-sm text-muted">
          Stok {product?.stock} → <span className="font-bold text-text">{after}</span>
        </p>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button
            disabled={mutation.isPending || !product || Math.floor(qty || 0) < 1}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
