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
  barcode: z.string({ error: "Barcode belum diisi. Scan atau tekan Auto ya." }).trim().min(1, "Barcode belum diisi. Scan atau tekan Auto ya."),
  name: z.string({ error: "Nama produk belum diisi. Isi dulu ya." }).trim().min(2, "Nama produk minimal 2 huruf. Tambah lagi ya."),
  categoryId: z.string({ error: "Kategori belum dipilih. Pilih dulu ya." }).min(1, "Kategori belum dipilih. Pilih dulu ya."),
  categoryName: z.string({ error: "Nama kategori belum kebaca. Pilih ulang kategorinya ya." }).trim().min(1, "Nama kategori belum kebaca. Pilih ulang kategorinya ya."),
  purchasePrice: z.number({ error: "Harga beli belum diisi. Isi angkanya ya." }).min(0, "Harga beli tidak boleh kurang dari 0 ya."),
  sellingPrice: z.number({ error: "Harga jual belum diisi. Isi angkanya ya." }).min(0, "Harga jual tidak boleh kurang dari 0 ya."),
  stock: z.number({ error: "Stok belum diisi. Isi angkanya ya." }).int("Stok harus bilangan bulat ya.").min(0, "Stok tidak boleh kurang dari 0 ya."),
  minimumStock: z.number({ error: "Stok minimum belum diisi. Isi angkanya ya." }).int("Stok minimum harus bilangan bulat ya.").min(0, "Stok minimum tidak boleh kurang dari 0 ya."),
  unit: z.string({ error: "Satuan belum diisi. Contoh: pcs, botol ya." }).trim().min(1, "Satuan belum diisi. Contoh: pcs, botol ya."),
});

export type ProductInput = z.infer<typeof productSchema>;

type ProductDoc = Omit<Product, "id">;
type RawDoc = Partial<ProductDoc> & Record<string, unknown>;

// ponytail: normalisasi sekali di reader; legacy doc tanpa field tetap kebuka & kesimpan.
function normalizeProduct(id: string, data: RawDoc): Product {
  return {
    id,
    barcode: typeof data.barcode === "string" ? data.barcode : "",
    name: typeof data.name === "string" ? data.name : "",
    categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
    categoryName: typeof data.categoryName === "string" ? data.categoryName : "",
    purchasePrice: typeof data.purchasePrice === "number" && Number.isFinite(data.purchasePrice) ? data.purchasePrice : 0,
    sellingPrice: typeof data.sellingPrice === "number" && Number.isFinite(data.sellingPrice) ? data.sellingPrice : 0,
    stock: typeof data.stock === "number" && Number.isFinite(data.stock) ? Math.floor(data.stock) : 0,
    minimumStock: typeof data.minimumStock === "number" && Number.isFinite(data.minimumStock) ? Math.floor(data.minimumStock) : 0,
    unit: typeof data.unit === "string" && data.unit ? data.unit : "pcs",
    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
  };
}
export async function listProducts(): Promise<Product[]> {
  const snap = await getDocs(
    query(collection(db, "products"), orderBy("name"), limit(200)),
  );
  return snap.docs.map((d) => normalizeProduct(d.id, d.data() as RawDoc));
}

export async function countLowStock(sampleSize = 200): Promise<number> {
  const snap = await getDocs(
    query(collection(db, "products"), orderBy("name"), limit(sampleSize)),
  );
  let count = 0;
  for (const d of snap.docs) {
    const p = normalizeProduct(d.id, d.data() as RawDoc);
    if (p.isActive && p.stock <= p.minimumStock) count += 1;
  }
  return count;
}

/** Daftar produk stok <= minimum — untuk card Stok Menipis di dashboard. */
export async function listLowStock(sampleSize = 200): Promise<Product[]> {
  const snap = await getDocs(
    query(collection(db, "products"), orderBy("name"), limit(sampleSize)),
  );
  return snap.docs
    .map((d) => normalizeProduct(d.id, d.data() as RawDoc))
    .filter((p) => p.isActive && p.stock <= p.minimumStock);
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const snap = await getDocs(
    query(collection(db, "products"), where("barcode", "==", barcode.trim()), limit(1)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return normalizeProduct(d.id, d.data() as RawDoc);
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
    rows: snap.docs.map((d) => normalizeProduct(d.id, d.data() as RawDoc)),
    lastVisible: last ?? null,
  };
}

export async function createProduct(input: ProductInput) {
  const parsed = productSchema.parse(input);
  // Anti-race: klaim barcode_keys/{barcode} atomik dalam transaction.
  await runTransaction(db, async (tx) => {
    const keyRef = doc(db, "barcode_keys", parsed.barcode);
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists()) throw new Error(`Barcode ${parsed.barcode} sudah dipakai produk lain. Tekan Auto atau scan ulang ya.`);
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

export function generateAutoBarcode(prefix = "NPLU-"): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[b % 36])
    .join("");
  return `${prefix}${t}${r}`;
}

// ponytail: cek app-level + klaim atomik di createProduct; full counter bila tabrakan sering.
export async function generateUniqueBarcode(tries = 5): Promise<string> {
  let code = generateAutoBarcode();
  for (let i = 0; i < tries; i++) {
    const exists = await getProductByBarcode(code);
    if (!exists) return code;
    code = generateAutoBarcode();
  }
  return code;
}

export async function updateProduct(id: string, input: ProductInput) {
  const parsed = productSchema.parse(input);
  const current = await getDocs(
    query(collection(db, "products"), where("barcode", "==", parsed.barcode), limit(1)),
  );
  if (current.docs.some((d) => d.id !== id))
    throw new Error(`Barcode ${parsed.barcode} sudah dipakai produk lain. Tekan Auto atau scan ulang ya.`);
  await runTransaction(db, async (tx) => {
    const prodSnap = await tx.get(doc(db, "products", id));
    if (!prodSnap.exists()) throw new Error("Produk tidak ketemu. Muat ulang, mungkin sudah dihapus ya.");
    const oldBarcode = (prodSnap.data() as { barcode: string }).barcode;
    if (oldBarcode !== parsed.barcode) {
      const keyRef = doc(db, "barcode_keys", parsed.barcode);
      const keySnap = await tx.get(keyRef);
      if (keySnap.exists())
        throw new Error(`Barcode ${parsed.barcode} sudah dipakai produk lain. Tekan Auto atau scan ulang ya.`);
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
