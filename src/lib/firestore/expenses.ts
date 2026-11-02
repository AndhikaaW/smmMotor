import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { Expense, ExpenseCategory } from "@/types";

export const EXPENSE_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "salary", label: "Gaji Karyawan" },
  { value: "rent", label: "Sewa Tempat" },
  { value: "utilities", label: "Listrik & Air" },
  { value: "transport", label: "Transport & BBM" },
  { value: "supplies", label: "Peralatan & Perlengkapan" },
  { value: "maintenance", label: "Perawatan & Service" },
  { value: "other", label: "Lainnya" },
];

const CATEGORY_VALUES = EXPENSE_CATEGORY_OPTIONS.map((o) => o.value) as [
  ExpenseCategory,
  ...ExpenseCategory[],
];

export function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? "Lainnya";
}

export const expenseSchema = z.object({
  date: z
    .string({ error: "Tanggal pengeluaran belum diisi. Pilih dulu ya." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal pengeluaran belum valid. Pilih ulang ya."),
  category: z.enum(CATEGORY_VALUES, { error: "Kategori pengeluaran belum dipilih. Pilih dulu ya." }),
  description: z
    .string({ error: "Keterangan pengeluaran belum diisi. Isi dulu ya." })
    .trim()
    .min(2, "Keterangan minimal 2 huruf. Tambah lagi ya.")
    .max(200, "Keterangan maksimal 200 huruf. Pendekkan ya."),
  amount: z
    .number({ error: "Nominal pengeluaran belum diisi. Isi angkanya ya." })
    .int("Nominal harus bilangan bulat ya.")
    .min(1, "Nominal pengeluaran harus lebih dari 0 ya."),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

type ExpenseDoc = Omit<Expense, "id">;
type RawDoc = Partial<ExpenseDoc> & Record<string, unknown>;

function normalizeExpense(id: string, data: RawDoc): Expense {
  return {
    id,
    date: typeof data.date === "string" ? data.date : "",
    category: CATEGORY_VALUES.includes(data.category as ExpenseCategory)
      ? (data.category as ExpenseCategory)
      : "other",
    description: typeof data.description === "string" ? data.description : "",
    amount:
      typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : 0,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt: data.createdAt as Expense["createdAt"],
    updatedAt: data.updatedAt as Expense["updatedAt"],
  };
}

/** Pengeluaran pada rentang tanggal WIB inklusif (`YYYY-MM-DD`). */
export async function listExpenses(fromStr: string, toStr: string): Promise<Expense[]> {
  const out: Expense[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  for (let page = 0; page < 10; page++) {
    const snap: QuerySnapshot = await getDocs(
      query(
        collection(db, "expenses"),
        where("date", ">=", fromStr),
        where("date", "<=", toStr),
        orderBy("date", "desc"),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(500),
      ),
    );
    out.push(
      ...snap.docs.map((d) => normalizeExpense(d.id, d.data() as RawDoc)),
    );
    if (snap.docs.length < 500) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return out;
}

export async function createExpense(
  input: ExpenseInput,
  actor: { userId: string; userName: string },
): Promise<void> {
  const parsed = expenseSchema.parse(input);
  await addDoc(collection(db, "expenses"), {
    ...parsed,
    createdBy: actor.userName || actor.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const parsed = expenseSchema.parse(input);
  await updateDoc(doc(db, "expenses", id), {
    ...parsed,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}
