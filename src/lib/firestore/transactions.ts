import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type {
  CartItem,
  PaymentMethod,
  StockMovementType,
  Transaction,
} from "@/types";

export const cartItemSchema = z.object({
  type: z.enum(["product", "service"], { error: "Jenis item bermasalah. Hapus lalu tambah ulang ya." }),
  productId: z.string({ error: "Pilih produk dulu ya." }).optional(),
  serviceId: z.string({ error: "Pilih jasa dulu ya." }).optional(),
  name: z.string({ error: "Nama item belum diisi. Hapus lalu tambah ulang ya." }).min(1, "Nama item belum diisi. Hapus lalu tambah ulang ya."),
  price: z.number({ error: "Harga item bermasalah. Hapus lalu tambah ulang ya." }).min(0, "Harga item tidak boleh kurang dari 0 ya."),
  quantity: z.number({ error: "Jumlah item bermasalah. Hapus lalu tambah ulang ya." }).int("Jumlah harus bilangan bulat ya.").min(1, "Jumlah minimal 1. Tambah lagi ya."),
  subtotal: z.number({ error: "Subtotal bermasalah. Hapus lalu tambah ulang ya." }).min(0, "Subtotal tidak boleh kurang dari 0 ya."),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Keranjang masih kosong. Tambah produk atau jasa dulu ya."),
  paymentMethod: z.enum(["cash", "qris", "transfer", "debit", "other"], { error: "Metode bayar belum dipilih. Pilih dulu ya." }),
  payment: z.number({ error: "Nominal bayar belum diisi. Isi angkanya ya." }).min(0, "Nominal bayar tidak boleh kurang dari 0 ya."),
  cashierId: z.string({ error: "Sesi kasir bermasalah. Login ulang ya." }).min(1, "Sesi kasir bermasalah. Login ulang ya."),
  cashierName: z.string({ error: "Nama kasir belum kebaca. Login ulang ya." }).min(1, "Nama kasir belum kebaca. Login ulang ya."),
  customerName: z.string({ error: "Nama pelanggan bermasalah. Kosongkan saja ya." }).trim().max(100, "Nama pelanggan maksimal 100 huruf. Pendekkan ya.").optional().default(""),
  vehiclePlate: z.string({ error: "Nomor plat bermasalah. Kosongkan saja ya." }).trim().max(20, "Nomor plat maksimal 20 huruf. Pendekkan ya.").optional().default(""),
  vehicleType: z.string({ error: "Jenis kendaraan belum diisi. Contoh: Beat, Avanza ya." }).trim().min(1, "Jenis kendaraan belum diisi. Contoh: Beat, Avanza ya.").max(60, "Jenis kendaraan maksimal 60 huruf. Pendekkan ya."),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const updateTransactionSchema = checkoutSchema.pick({ items: true, paymentMethod: true, payment: true });
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

const NUMBER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomSuffix(length: number): string {
  let out = "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += NUMBER_ALPHABET[b % NUMBER_ALPHABET.length];
  return out;
}

function datePrefix(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function generateUniqueNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `TRX-${datePrefix(new Date())}-${randomSuffix(4)}`;
    const snap = await getDocs(
      query(
        collection(db, "transactions"),
        where("transactionNumber", "==", candidate),
        limit(1),
      ),
    );
    if (snap.empty) return candidate;
  }
  // Fallback: tambah 2 char bila 5x tabrakan (praktis mustahil).
  return `TRX-${datePrefix(new Date())}-${randomSuffix(6)}`;
}

export interface CheckoutResult {
  id: string;
  transactionNumber: string;
  total: number;
  change: number;
}

export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.parse(input);

  const subtotal = parsed.items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal; // V1: tanpa diskon (A2).
  const isCash = parsed.paymentMethod === "cash";
  if (isCash && parsed.payment < total)
    throw new Error(`Uang cash kurang. Total Rp${total.toLocaleString("id-ID")}, bayar Rp${parsed.payment.toLocaleString("id-ID")}. Tambah uangnya ya.`);
  if (!isCash && parsed.payment !== total)
    throw new Error(`Pembayaran non-tunai harus pas Rp${total.toLocaleString("id-ID")}. Sesuaikan nominalnya ya.`);
  const change = isCash ? parsed.payment - total : 0;

  const transactionNumber = await generateUniqueNumber();

  const txRef = doc(collection(db, "transactions"));

  await runTransaction(db, async (tx) => {
    // Baca SEMUA stok dulu (validasi harga+stok dari server),
    // tulis belakangan agar retry tidak menumpuk write.
    const productIds = [
      ...new Set(
        parsed.items
          .filter((i) => i.type === "product" && i.productId)
          .map((i) => i.productId as string),
      ),
    ];
    const productDocs = new Map<string, { price: number; stock: number; name: string }>();
    for (const pid of productIds) {
      const snap = await tx.get(doc(db, "products", pid));
      if (!snap.exists()) throw new Error("Produk tidak ketemu. Muat ulang, mungkin sudah dihapus ya.");
      const data = snap.data() as { sellingPrice: number; stock: number; name: string; isActive: boolean };
      if (!data.isActive) throw new Error(`Produk ${data.name} sedang nonaktif. Aktifkan di Data Produk ya.`);
      productDocs.set(pid, { price: data.sellingPrice, stock: data.stock, name: data.name });
    }

    // Validasi per-item: harga snapshot server + agregat qty per produk.
    const qtyByProduct = new Map<string, number>();
    const serverItems: CartItem[] = parsed.items.map((item) => {
      if (item.type === "service") {
        if (!item.serviceId) throw new Error("Ada jasa tidak valid. Hapus lalu tambah ulang jasanya ya.");
        return { ...item, subtotal: item.price * item.quantity };
      }
      const p = productDocs.get(item.productId as string);
      if (!p) throw new Error("Produk tidak ketemu. Muat ulang, mungkin sudah dihapus ya.");
      qtyByProduct.set(
        item.productId as string,
        (qtyByProduct.get(item.productId as string) ?? 0) + item.quantity,
      );
      return { ...item, price: p.price, subtotal: p.price * item.quantity };
    });

    const serverSubtotal = serverItems.reduce((s, i) => s + i.subtotal, 0);
    for (const [pid, qty] of qtyByProduct) {
      const p = productDocs.get(pid);
      if (!p) throw new Error("Produk tidak ketemu. Muat ulang, mungkin sudah dihapus ya.");
      if (p.stock < qty)
        throw new Error(
          `Stok ${p.name} tidak cukup. Sisa ${p.stock}, diminta ${qty}. Kurangi jumlahnya ya.`,
        );
    }

    const now = Timestamp.now();
    tx.set(txRef, {
      transactionNumber,
      transactionDate: now,
      cashierId: parsed.cashierId,
      cashierName: parsed.cashierName,
      customerName: parsed.customerName ?? "",
      vehiclePlate: parsed.vehiclePlate ?? "",
      vehicleType: parsed.vehicleType ?? "",
      items: serverItems,
      subtotal: serverSubtotal,
      total: serverSubtotal,
      payment: isCash ? parsed.payment : serverSubtotal,
      change: isCash ? parsed.payment - serverSubtotal : 0,
      paymentMethod: parsed.paymentMethod as PaymentMethod,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    for (const [pid, qty] of qtyByProduct) {
      const p = productDocs.get(pid);
      if (!p) continue;
      const before = p.stock;
      const after = before - qty;
      tx.update(doc(db, "products", pid), {
        stock: after,
        updatedAt: serverTimestamp(),
      });
      const movRef = doc(collection(db, "stock_movements"));
      tx.set(movRef, {
        productId: pid,
        productName: p.name,
        type: "out" as StockMovementType,
        quantity: -qty,
        stockBefore: before,
        stockAfter: after,
        referenceType: "sale",
        referenceId: transactionNumber,
        note: "",
        userId: parsed.cashierId,
        userName: parsed.cashierName,
        createdAt: now,
      });
    }
  });

  return { id: txRef.id, transactionNumber, total, change };
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const snap = await getDoc(doc(db, "transactions", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Transaction, "id">) };
}

export interface TransactionFilters {
  date?: string;
  number?: string;
  paymentMethod?: PaymentMethod | "";
  status?: "all" | "completed" | "deleted";
  pageSize?: number;
  cursor?: unknown;
}

export interface TransactionPage {
  rows: Transaction[];
  lastVisible: unknown | null;
}

// Riwayat default: hanya completed. Termasuk deleted hanya bila
// status=deleted/all — laporan masa lalu ikut berubah setelah cancel
// (risiko A7 yang sudah disetujui user: soft-delete + exclude default).
// Semua filter didorong ke server agar hemat read (1 nomor = 1 read,
// bukan 50 reads lalu filter di client).
export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const page = await listTransactionPage(filters);
  return page.rows;
}

export async function listTransactionPage(
  filters: TransactionFilters = {},
): Promise<TransactionPage> {
  const pageSize = filters.pageSize ?? 25;
  const trimmedNumber = filters.number?.trim();
  if (trimmedNumber) {
    const snap = await getDocs(
      query(
        collection(db, "transactions"),
        where("transactionNumber", "==", trimmedNumber),
        limit(1),
      ),
    );
    return {
      rows: snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Transaction, "id">),
      })),
      lastVisible: null,
    };
  }
  const clauses = [];
  if (filters.status && filters.status !== "all") {
    clauses.push(where("status", "==", filters.status));
  }
  if (filters.paymentMethod) {
    clauses.push(where("paymentMethod", "==", filters.paymentMethod));
  }
  if (filters.date) {
    const { start, end } = wibDayBounds(filters.date);
    clauses.push(
      where("transactionDate", ">=", Timestamp.fromDate(start)),
      where("transactionDate", "<", Timestamp.fromDate(end)),
    );
  }
  clauses.push(orderBy("transactionDate", "desc"));
  if (filters.cursor) clauses.push(startAfter(filters.cursor as never));
  clauses.push(limit(pageSize));
  const snap = await getDocs(
    query(collection(db, "transactions"), ...clauses),
  );
  const last = snap.docs[snap.docs.length - 1];
  return {
    rows: snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Transaction, "id">),
    })),
    lastVisible: last ?? null,
  };
}

export async function deleteTransaction(
  id: string,
  actor: { userId: string; userName: string },
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "transactions", id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Transaksi tidak ketemu. Mungkin sudah dihapus ya.");
    const data = snap.data() as Omit<Transaction, "id">;
    if (data.status !== "completed")
      throw new Error("Transaksi ini sudah dihapus. Muat ulang ya.");

    const qtyByProduct = new Map<string, number>();
    for (const item of data.items) {
      if (item.type === "product" && item.productId) {
        qtyByProduct.set(
          item.productId,
          (qtyByProduct.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }

    const productSnapshots = new Map<
      string,
      { ref: typeof ref; qty: number; name: string; stock: number }
    >();
    for (const [pid, qty] of qtyByProduct) {
      const productRef = doc(db, "products", pid);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) continue;
      const product = productSnap.data() as { stock: number; name: string };
      productSnapshots.set(pid, {
        ref: productRef,
        qty,
        name: product.name,
        stock: product.stock,
      });
    }

    const now = Timestamp.now();
    tx.update(ref, {
      status: "deleted",
      deletedAt: now,
      deletedBy: actor.userName,
      updatedAt: now,
    });

    for (const product of productSnapshots.values()) {
      const stockAfter = product.stock + product.qty;
      tx.update(product.ref, {
        stock: stockAfter,
        updatedAt: serverTimestamp(),
      });
      const movementRef = doc(collection(db, "stock_movements"));
      tx.set(movementRef, {
        productId: product.ref.id,
        productName: product.name,
        type: "return" as StockMovementType,
        quantity: product.qty,
        stockBefore: product.stock,
        stockAfter,
        referenceType: "transaction_delete",
        referenceId: data.transactionNumber,
        note: "",
        userId: actor.userId,
        userName: actor.userName,
        createdAt: now,
      });
    }
  });
}
export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
  actor: { userId: string; userName: string },
): Promise<void> {
  const parsed = updateTransactionSchema.parse(input);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "transactions", id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Transaksi tidak ketemu. Muat ulang ya.");
    const data = snap.data() as Omit<Transaction, "id">;
    if (data.status !== "completed")
      throw new Error("Transaksi yang sudah dihapus tidak bisa diedit ya.");
    const oldQty = new Map<string, number>();
    for (const item of data.items) {
      if (item.type === "product" && item.productId)
        oldQty.set(item.productId, (oldQty.get(item.productId) ?? 0) + item.quantity);
    }
    const newQty = new Map<string, number>();
    for (const item of parsed.items) {
      if (item.type === "product" && item.productId)
        newQty.set(item.productId, (newQty.get(item.productId) ?? 0) + item.quantity);
    }
    const allIds = [...new Set([...oldQty.keys(), ...newQty.keys()])];
    const products = new Map<string, { price: number; stock: number; name: string; isActive: boolean }>();
    for (const pid of allIds) {
      const pSnap = await tx.get(doc(db, "products", pid));
      if (!pSnap.exists()) {
        if ((newQty.get(pid) ?? 0) > (oldQty.get(pid) ?? 0))
          throw new Error("Ada produk yang sudah dihapus dari master. Kurangi/hapus itemnya ya.");
        continue;
      }
      const p = pSnap.data() as { sellingPrice: number; stock: number; name: string; isActive: boolean };
      products.set(pid, { price: p.sellingPrice, stock: p.stock, name: p.name, isActive: p.isActive });
    }
    const serverItems: CartItem[] = parsed.items.map((item) => {
      if (item.type === "service") {
        if (!item.serviceId) throw new Error("Ada jasa tidak valid. Hapus lalu tambah ulang jasanya ya.");
        return { ...item, subtotal: item.price * item.quantity };
      }
      const p = products.get(item.productId as string);
      if (!p) {
        const old = data.items.find((o) => o.type === "product" && o.productId === item.productId);
        const price = old?.price ?? item.price;
        return { ...item, price, subtotal: price * item.quantity };
      }
      const diff = (newQty.get(item.productId as string) ?? 0) - (oldQty.get(item.productId as string) ?? 0);
      if (diff > 0 && !p.isActive) throw new Error(`Produk ${p.name} sedang nonaktif. Kembalikan jumlahnya ya.`);
      return { ...item, price: p.price, subtotal: p.price * item.quantity };
    });
    const serverTotal = serverItems.reduce((s, i) => s + i.subtotal, 0);
    const isCash = parsed.paymentMethod === "cash";
    if (isCash && parsed.payment < serverTotal)
      throw new Error(`Uang cash kurang. Total Rp${serverTotal.toLocaleString("id-ID")}, bayar Rp${parsed.payment.toLocaleString("id-ID")}. Tambah uangnya ya.`);
    if (!isCash && parsed.payment !== serverTotal)
      throw new Error(`Pembayaran non-tunai harus pas Rp${serverTotal.toLocaleString("id-ID")}. Sesuaikan nominalnya ya.`);
    for (const pid of allIds) {
      const diff = (newQty.get(pid) ?? 0) - (oldQty.get(pid) ?? 0);
      if (diff <= 0) continue;
      const p = products.get(pid);
      if (!p) continue;
      if (p.stock < diff)
        throw new Error(`Stok ${p.name} tidak cukup. Sisa ${p.stock}, butuh tambah ${diff}. Kurangi jumlahnya ya.`);
    }
    const now = Timestamp.now();
    tx.update(ref, {
      items: serverItems,
      subtotal: serverTotal,
      total: serverTotal,
      payment: isCash ? parsed.payment : serverTotal,
      change: isCash ? parsed.payment - serverTotal : 0,
      paymentMethod: parsed.paymentMethod as PaymentMethod,
      updatedAt: now,
    });
    for (const pid of allIds) {
      const diff = (newQty.get(pid) ?? 0) - (oldQty.get(pid) ?? 0);
      if (diff === 0) continue;
      const p = products.get(pid);
      if (!p) continue;
      const before = p.stock;
      const after = before - diff;
      tx.update(doc(db, "products", pid), { stock: after, updatedAt: serverTimestamp() });
      const movRef = doc(collection(db, "stock_movements"));
      tx.set(movRef, {
        productId: pid,
        productName: p.name,
        type: diff > 0 ? ("out" as StockMovementType) : ("return" as StockMovementType),
        quantity: -diff,
        stockBefore: before,
        stockAfter: after,
        referenceType: "transaction_edit",
        referenceId: data.transactionNumber,
        note: "",
        userId: actor.userId,
        userName: actor.userName,
        createdAt: now,
      });
    }
  });
}


// ---- Batas hari WIB (UTC+7, tanpa DST). Semua filter laporan pakai ini,
// bukan UTC / jam browser, agar transaksi malam tetap masuk tanggal WIB.
const WIB_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tanggal WIB `YYYY-MM-DD` dari sebuah instant. */
export function wibDateStr(now: Date = new Date()): string {
  return new Date(now.getTime() + WIB_MS).toISOString().slice(0, 10);
}

export function wibDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Tanggal tidak valid. Pilih ulang tanggalnya ya.");
  const startMs = Date.UTC(y, m - 1, d) - WIB_MS;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

function wibMonthBounds(year: number, month: number): { start: Date; end: Date } {
  if (!year || !month || month < 1 || month > 12)
    throw new Error("Bulan tidak valid. Pilih ulang bulannya ya.");
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - WIB_MS),
    end: new Date(Date.UTC(year, month, 1) - WIB_MS),
  };
}

export interface DaySummary {
  revenue: number;
  count: number;
  discount: number;
  productQty: number;
  serviceQty: number;
  productRevenue: number;
  serviceRevenue: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  topServices: { name: string; qty: number; revenue: number }[];
  productRows: { name: string; qty: number; revenue: number }[];
  serviceRows: { name: string; qty: number; revenue: number }[];
}

export function emptySummary(): DaySummary {
  return {
    revenue: 0,
    count: 0,
    discount: 0,
    productQty: 0,
    serviceQty: 0,
    productRevenue: 0,
    serviceRevenue: 0,
    topProducts: [],
    topServices: [],
    productRows: [],
    serviceRows: [],
  };
}

function aggregateDocs(
  docs: { data: () => unknown }[],
): DaySummary {
  const summary = emptySummary();
  const productAgg = new Map<string, { qty: number; revenue: number }>();
  const serviceAgg = new Map<string, { qty: number; revenue: number }>();
  for (const d of docs) {
    const t = d.data() as Omit<Transaction, "id">;
    if (t.status !== "completed") continue;
    summary.revenue += t.total;
    summary.count += 1;
    for (const item of t.items) {
      if (item.type === "product") {
        summary.productQty += item.quantity;
        summary.productRevenue += item.subtotal;
        const cur = productAgg.get(item.name) ?? { qty: 0, revenue: 0 };
        cur.qty += item.quantity;
        cur.revenue += item.subtotal;
        productAgg.set(item.name, cur);
      } else {
        summary.serviceQty += item.quantity;
        summary.serviceRevenue += item.subtotal;
        const cur = serviceAgg.get(item.name) ?? { qty: 0, revenue: 0 };
        cur.qty += item.quantity;
        cur.revenue += item.subtotal;
        serviceAgg.set(item.name, cur);
      }
    }
  }
  const byQty = <T extends { qty: number }>(a: T, b: T) => b.qty - a.qty;
  summary.productRows = [...productAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort(byQty);
  summary.serviceRows = [...serviceAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort(byQty);
  summary.topProducts = summary.productRows.slice(0, 5);
  summary.topServices = summary.serviceRows.slice(0, 5);
  return summary;
}
/** Semua dokumen completed dalam [start, end) — paginasi agar rentang panjang tak kepotong limit. */
async function fetchRangeDocs(start: Date, end: Date) {
  const docs: { data: () => unknown }[] = [];
  let cursor: unknown = undefined;
  for (let page = 0; page < 20; page++) {
    const snap = await getDocs(
      query(
        collection(db, "transactions"),
        where("transactionDate", ">=", Timestamp.fromDate(start)),
        where("transactionDate", "<", Timestamp.fromDate(end)),
        orderBy("transactionDate", "asc"),
        ...(cursor ? [startAfter(cursor as never)] : []),
        limit(500),
      ),
    );
    docs.push(...snap.docs);
    if (snap.docs.length < 500) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return docs;
}

function wibKeyOf(t: Omit<Transaction, "id">): string | null {
  if (t.status !== "completed") return null;
  const raw: unknown = t.transactionDate;
  let instant: Date | null = null;
  if (raw instanceof Timestamp) instant = raw.toDate();
  else if (raw instanceof Date) instant = raw;
  else if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) instant = d;
  } else if (raw !== null && typeof raw === "object" && "toDate" in raw) {
    const toDate: unknown = raw.toDate;
    if (typeof toDate === "function") {
      const d = (toDate as () => Date).call(raw);
      if (d instanceof Date && !Number.isNaN(d.getTime())) instant = d;
    }
  }
  if (!instant) return null;
  return new Date(instant.getTime() + WIB_MS).toISOString().slice(0, 10);
}

function dayKeysBetween(fromStr: string, toStr: string): string[] {
  if (toStr < fromStr) throw new Error("Rentang tanggal terbalik. Tukar tanggal mulai & selesainya ya.");
  const keys: string[] = [];
  let cur = fromStr;
  for (let i = 0; i < 62; i++) {
    keys.push(cur);
    if (cur === toStr) return keys;
    const [cy, cm, cd] = cur.split("-").map(Number);
    cur = new Date(Date.UTC(cy, cm - 1, cd) + DAY_MS).toISOString().slice(0, 10);
  }
  throw new Error("Rentang maksimal 62 hari. Persempit tanggalnya ya.");
}

export async function summarizeDay(date: Date): Promise<DaySummary> {
  const key = new Date(date.getTime() + WIB_MS).toISOString().slice(0, 10);
  const { start, end } = wibDayBounds(key);
  return aggregateDocs(await fetchRangeDocs(start, end));
}

export async function summarizeMonth(
  year: number,
  month: number,
): Promise<DaySummary> {
  const { start, end } = wibMonthBounds(year, month);
  return aggregateDocs(await fetchRangeDocs(start, end));
}

export interface RangeSummary extends DaySummary {
  from: string;
  to: string;
  trend: TrendPoint[];
}

/** Ringkasan rentang WIB inklusif + tren harian per tanggal WIB. Maks 62 hari. */
export async function summarizeRange(fromStr: string, toStr: string): Promise<RangeSummary> {
  const keys = dayKeysBetween(fromStr, toStr);
  const { start } = wibDayBounds(fromStr);
  const { end } = wibDayBounds(toStr);
  const docs = await fetchRangeDocs(start, end);
  const summary = aggregateDocs(docs);
  const buckets = new Map<string, { label: string; revenue: number; count: number }>(
    keys.map((k) => {
      const [ky, km, kd] = k.split("-").map(Number);
      const label = new Date(Date.UTC(ky, km - 1, kd, 12)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      return [k, { label, revenue: 0, count: 0 }] as [string, { label: string; revenue: number; count: number }];
    }),
  );
  for (const d of docs) {
    const key = wibKeyOf(d.data() as Omit<Transaction, "id">);
    const b = key ? buckets.get(key) : undefined;
    if (!b) continue;
    const t = d.data() as Omit<Transaction, "id">;
    b.revenue += t.total;
    b.count += 1;
  }
  return { ...summary, from: fromStr, to: toStr, trend: [...buckets.values()] };
}

export interface TrendPoint {
  label: string;
  revenue: number;
  count: number;
}

export async function revenueTrendDaily(days = 14): Promise<TrendPoint[]> {
  const toStr = wibDateStr();
  const [ty, tm, td] = toStr.split("-").map(Number);
  const fromStr = new Date(Date.UTC(ty, tm - 1, td) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  const { trend } = await summarizeRange(fromStr, toStr);
  return trend;
}

export async function revenueTrendMonthly(
  year: number,
  month: number,
): Promise<TrendPoint[]> {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromStr = `${year}-${pad(month)}-01`;
  const { trend } = await summarizeRange(fromStr, `${year}-${pad(month)}-${pad(dim)}`);
  return trend.map((t, i) => ({ ...t, label: String(i + 1) }));
}
