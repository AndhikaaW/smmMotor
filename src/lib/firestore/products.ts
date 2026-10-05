import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { Product } from "@/types";

export const productSchema = z.object({
  barcode: z.string().trim().min(1, "Barcode wajib diisi"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  categoryName: z.string().trim().min(1),
  purchasePrice: z.number().min(0, "Harga beli >= 0"),
  sellingPrice: z.number().min(0, "Harga jual >= 0"),
  stock: z.number().int().min(0, "Stok >= 0"),
  minimumStock: z.number().int().min(0, "Stok minimum >= 0"),
  unit: z.string().trim().min(1, "Satuan wajib diisi"),
});

export type ProductInput = z.infer<typeof productSchema>;

type ProductDoc = Omit<Product, "id">;
export async function listProducts(): Promise<Product[]> {
  const snap = await getDocs(
    query(collection(db, "products"), orderBy("name"), limit(200)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }));
}

export async function countLowStock(sampleSize = 200): Promise<number> {
  const snap = await getDocs(
    query(collection(db, "products"), orderBy("name"), limit(sampleSize)),
  );
  let count = 0;
  for (const d of snap.docs) {
    const p = d.data() as ProductDoc;
    if (p.isActive && p.stock <= p.minimumStock) count += 1;
  }
  return count;
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const snap = await getDocs(
    query(collection(db, "products"), where("barcode", "==", barcode.trim()), limit(1)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as ProductDoc) };
}

export interface ProductPage {
  rows: Product[];
  lastVisible: unknown | null;
}

export async function searchProductsByName(
  keyword: string,
  pageSize = 20,
  cursor?: unknown,
): Promise<ProductPage> {
  const q = keyword.trim();
  const end = q + String.fromCharCode(0xf8ff);
  const clauses = [
    orderBy("name"),
    ...(cursor ? [startAfter(cursor as never)] : []),
    limit(pageSize),
  ];
  const snap = q
    ? await getDocs(
        query(
          collection(db, "products"),
          where("name", ">=", q),
          where("name", "<", end),
          ...clauses,
        ),
      )
    : await getDocs(query(collection(db, "products"), ...clauses));
  const last = snap.docs[snap.docs.length - 1];
  return {
    rows: snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })),
    lastVisible: last ?? null,
  };
}

export async function createProduct(input: ProductInput) {
  const parsed = productSchema.parse(input);
  // Anti-race: klaim barcode_keys/{barcode} atomik dalam transaction.
  await runTransaction(db, async (tx) => {
    const keyRef = doc(db, "barcode_keys", parsed.barcode);
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists()) throw new Error("Barcode sudah dipakai produk lain.");
    const prodRef = doc(collection(db, "products"));
    tx.set(prodRef, {
      ...parsed,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(keyRef, { productId: prodRef.id, createdAt: serverTimestamp() });
  });
}

export async function updateProduct(id: string, input: ProductInput) {
  const parsed = productSchema.parse(input);
  const current = await getDocs(
    query(collection(db, "products"), where("barcode", "==", parsed.barcode), limit(1)),
  );
  if (current.docs.some((d) => d.id !== id))
    throw new Error("Barcode sudah dipakai produk lain.");
  await runTransaction(db, async (tx) => {
    const prodSnap = await tx.get(doc(db, "products", id));
    if (!prodSnap.exists()) throw new Error("Produk tidak ditemukan.");
    const oldBarcode = (prodSnap.data() as { barcode: string }).barcode;
    if (oldBarcode !== parsed.barcode) {
      const keyRef = doc(db, "barcode_keys", parsed.barcode);
      const keySnap = await tx.get(keyRef);
      if (keySnap.exists())
        throw new Error("Barcode sudah dipakai produk lain.");
      tx.set(keyRef, { productId: id, createdAt: serverTimestamp() });
    }
    tx.update(doc(db, "products", id), {
      ...parsed,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setProductActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, "products", id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}
