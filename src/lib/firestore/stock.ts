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
  productId: z.string({ error: "Pilih produk dulu ya." }).min(1, "Pilih produk dulu ya."),
  physicalStock: z.number({ error: "Stok fisik belum diisi. Isi angkanya ya." }).int("Stok fisik harus bilangan bulat ya.").min(0, "Stok fisik tidak boleh kurang dari 0 ya."),
  reason: z.enum(["Rusak", "Hilang", "Stock opname", "Salah input", "Lainnya"], { error: "Alasan belum dipilih. Pilih salah satu ya." }),
  note: z.string({ error: "Catatan bermasalah. Kosongkan saja ya." }).trim().max(200, "Catatan maksimal 200 huruf. Pendekkan ya.").default(""),
  userId: z.string({ error: "Sesi login bermasalah. Login ulang ya." }).min(1, "Sesi login bermasalah. Login ulang ya."),
  userName: z.string({ error: "Sesi login bermasalah. Login ulang ya." }).min(1, "Sesi login bermasalah. Login ulang ya."),
});

export type AdjustInput = z.infer<typeof adjustSchema>;

export async function adjustStock(input: AdjustInput) {
  const parsed = adjustSchema.parse(input);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "products", parsed.productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Produk tidak ketemu. Muat ulang, mungkin sudah dihapus ya.");
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
export const moveSchema = z.object({
  productId: z.string({ error: "Pilih produk dulu ya." }).min(1, "Pilih produk dulu ya."),
  direction: z.enum(["in", "out"], { error: "Arah stok bermasalah. Coba lagi ya." }),
  quantity: z.number({ error: "Jumlah belum diisi. Isi angkanya ya." }).int("Jumlah harus bilangan bulat ya.").min(1, "Jumlah minimal 1. Tambah lagi ya."),
  userId: z.string({ error: "Sesi login bermasalah. Login ulang ya." }).min(1, "Sesi login bermasalah. Login ulang ya."),
  userName: z.string({ error: "Sesi login bermasalah. Login ulang ya." }).min(1, "Sesi login bermasalah. Login ulang ya."),
});

export type MoveInput = z.infer<typeof moveSchema>;

export async function moveStock(input: MoveInput) {
  const parsed = moveSchema.parse(input);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "products", parsed.productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Produk tidak ketemu. Muat ulang, mungkin sudah dihapus ya.");
    const data = snap.data() as { stock: number; name: string };
    const after = data.stock + (parsed.direction === "in" ? parsed.quantity : -parsed.quantity);
    if (after < 0) throw new Error(`Stok ${data.name} tidak cukup. Sisa ${data.stock}, mau keluar ${parsed.quantity}. Kurangi jumlahnya ya.`);
    tx.update(ref, { stock: after, updatedAt: serverTimestamp() });
    tx.set(doc(collection(db, "stock_movements")), {
      productId: parsed.productId,
      productName: data.name,
      type: parsed.direction,
      quantity: parsed.direction === "in" ? parsed.quantity : -parsed.quantity,
      stockBefore: data.stock,
      stockAfter: after,
      referenceType: "manual",
      referenceId: "",
      note: "",
      userId: parsed.userId,
      userName: parsed.userName,
      createdAt: Timestamp.now(),
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
