import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { StockMovement } from "@/types";

export const adjustSchema = z.object({
  productId: z.string().min(1),
  physicalStock: z.number().int().min(0, "Stok fisik >= 0"),
  reason: z.enum(["Rusak", "Hilang", "Stock opname", "Salah input", "Lainnya"]),
  note: z.string().trim().max(200).default(""),
  userId: z.string().min(1),
  userName: z.string().min(1),
});

export type AdjustInput = z.infer<typeof adjustSchema>;

export async function adjustStock(input: AdjustInput) {
  const parsed = adjustSchema.parse(input);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "products", parsed.productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Produk tidak ditemukan.");
    const data = snap.data() as { stock: number; name: string };
    const before = data.stock;
    const diff = parsed.physicalStock - before;
    if (diff === 0) return;
    const now = Timestamp.now();
    tx.update(ref, { stock: parsed.physicalStock, updatedAt: serverTimestamp() });
    const movRef = doc(collection(db, "stock_movements"));
    tx.set(movRef, {
      productId: parsed.productId,
      productName: data.name,
      type: "adjustment",
      quantity: diff,
      stockBefore: before,
      stockAfter: parsed.physicalStock,
      referenceType: "adjustment",
      referenceId: "",
      note: parsed.note || parsed.reason,
      userId: parsed.userId,
      userName: parsed.userName,
      createdAt: now,
    });
  });
}

export async function listMovements(
  productId?: string,
  pageSize = 50,
): Promise<StockMovement[]> {
  const base = collection(db, "stock_movements");
  const q = productId
    ? query(
        base,
        where("productId", "==", productId),
        orderBy("createdAt", "desc"),
        limit(pageSize),
      )
    : query(base, orderBy("createdAt", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<StockMovement, "id">),
  }));
}
