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
  type: z.enum(["product", "service"]),
  productId: z.string().optional(),
  serviceId: z.string().optional(),
  name: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  subtotal: z.number().min(0),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Keranjang kosong."),
  paymentMethod: z.enum(["cash", "qris", "transfer", "debit", "other"]),
  payment: z.number().min(0),
  cashierId: z.string().min(1),
  cashierName: z.string().min(1),
  customerName: z.string().trim().max(100).optional().default(""),
  vehiclePlate: z.string().trim().max(20).optional().default(""),
  vehicleType: z.string().trim().min(1, "Jenis kendaraan wajib diisi.").max(60),
  mechanicId: z.string().trim().max(100).optional().default(""),
  mechanicName: z.string().trim().max(100).optional().default(""),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

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
    throw new Error("Uang cash kurang dari total.");
  if (!isCash && parsed.payment !== total)
    throw new Error("Non-cash wajib uang pas.");
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
      if (!snap.exists()) throw new Error("Produk tidak ditemukan.");
      const data = snap.data() as { sellingPrice: number; stock: number; name: string; isActive: boolean };
      if (!data.isActive) throw new Error(`Produk ${data.name} nonaktif.`);
      productDocs.set(pid, { price: data.sellingPrice, stock: data.stock, name: data.name });
    }

    // Validasi per-item: harga snapshot server + agregat qty per produk.
    const qtyByProduct = new Map<string, number>();
    const serverItems: CartItem[] = parsed.items.map((item) => {
      if (item.type === "service") {
        if (!item.serviceId) throw new Error("Item jasa tidak valid.");
        return { ...item, subtotal: item.price * item.quantity };
      }
      const p = productDocs.get(item.productId as string);
      if (!p) throw new Error("Produk tidak ditemukan.");
      qtyByProduct.set(
        item.productId as string,
        (qtyByProduct.get(item.productId as string) ?? 0) + item.quantity,
      );
      return { ...item, price: p.price, subtotal: p.price * item.quantity };
    });

    const serverSubtotal = serverItems.reduce((s, i) => s + i.subtotal, 0);
    for (const [pid, qty] of qtyByProduct) {
      const p = productDocs.get(pid);
      if (!p) throw new Error("Produk tidak ditemukan.");
      if (p.stock < qty)
        throw new Error(
          `Stok ${p.name} hanya tersisa ${p.stock}. Diminta: ${qty}.`,
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
      mechanicId: parsed.mechanicId ?? "",
      mechanicName: parsed.mechanicName ?? "",
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
  date?: Date;
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
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
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
    if (!snap.exists()) throw new Error("Transaksi tidak ditemukan.");
    const data = snap.data() as Omit<Transaction, "id">;
    if (data.status !== "completed")
      throw new Error("Hanya transaksi completed yang bisa dihapus.");

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

export interface DaySummary {
  revenue: number;
  count: number;
  discount: number;
  productQty: number;
  serviceQty: number;
  productRevenue: number;
  byPayment: Record<PaymentMethod, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  topServices: { name: string; qty: number; revenue: number }[];
}

const EMPTY_PAYMENT: Record<PaymentMethod, number> = {
  cash: 0,
  qris: 0,
  transfer: 0,
  debit: 0,
  other: 0,
};

export function emptySummary(): DaySummary {
  return {
    revenue: 0,
    count: 0,
    discount: 0,
    productQty: 0,
    serviceQty: 0,
    productRevenue: 0,
    byPayment: { ...EMPTY_PAYMENT },
    topProducts: [],
    topServices: [],
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
    summary.byPayment[t.paymentMethod] += t.total;
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
        const cur = serviceAgg.get(item.name) ?? { qty: 0, revenue: 0 };
        cur.qty += item.quantity;
        cur.revenue += item.subtotal;
        serviceAgg.set(item.name, cur);
      }
    }
  }
  summary.topProducts = [...productAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  summary.topServices = [...serviceAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  return summary;
}

export async function summarizeDay(date: Date): Promise<DaySummary> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const snap = await getDocs(
    query(
      collection(db, "transactions"),
      where("transactionDate", ">=", Timestamp.fromDate(start)),
      where("transactionDate", "<", Timestamp.fromDate(end)),
      orderBy("transactionDate", "desc"),
      limit(500),
    ),
  );
  return aggregateDocs(snap.docs);
}

export async function summarizeMonth(
  year: number,
  month: number,
): Promise<DaySummary> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const snap = await getDocs(
    query(
      collection(db, "transactions"),
      where("transactionDate", ">=", Timestamp.fromDate(start)),
      where("transactionDate", "<", Timestamp.fromDate(end)),
      orderBy("transactionDate", "desc"),
      limit(1000),
    ),
  );
  return aggregateDocs(snap.docs);
}

export interface TrendPoint {
  label: string;
  revenue: number;
  count: number;
}

export async function revenueTrendDaily(days = 14): Promise<TrendPoint[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const snap = await getDocs(
    query(
      collection(db, "transactions"),
      where("transactionDate", ">=", Timestamp.fromDate(start)),
      orderBy("transactionDate", "asc"),
      limit(1000),
    ),
  );
  const buckets = new Map<string, TrendPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      revenue: 0,
      count: 0,
    });
  }
  for (const d of snap.docs) {
    const t = d.data() as Omit<Transaction, "id">;
    if (t.status !== "completed") continue;
    const ts = (t.transactionDate as unknown as { toDate?: () => Date })?.toDate?.();
    const date = ts ?? new Date(t.transactionDate as unknown as string);
    const key = date.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.revenue += t.total;
    b.count += 1;
  }
  return [...buckets.values()];
}

export async function revenueTrendMonthly(
  year: number,
  month: number,
): Promise<TrendPoint[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const snap = await getDocs(
    query(
      collection(db, "transactions"),
      where("transactionDate", ">=", Timestamp.fromDate(start)),
      where("transactionDate", "<", Timestamp.fromDate(end)),
      orderBy("transactionDate", "asc"),
      limit(1000),
    ),
  );
  const dim = new Date(year, month, 0).getDate();
  const buckets: TrendPoint[] = Array.from({ length: dim }, (_, i) => ({
    label: String(i + 1),
    revenue: 0,
    count: 0,
  }));
  for (const d of snap.docs) {
    const t = d.data() as Omit<Transaction, "id">;
    if (t.status !== "completed") continue;
    const ts = (t.transactionDate as unknown as { toDate?: () => Date })?.toDate?.();
    const date = ts ?? new Date(t.transactionDate as unknown as string);
    const idx = date.getDate() - 1;
    const b = buckets[idx];
    if (!b) continue;
    b.revenue += t.total;
    b.count += 1;
  }
  return buckets;
}
