import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { Category } from "@/types";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(
    query(collection(db, "categories"), orderBy("name")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, "id">) }));
}

export async function listActiveCategories(): Promise<Category[]> {
  const all = await listCategories();
  return all.filter((c) => c.isActive);
}

export async function createCategory(input: CategoryInput) {
  const parsed = categorySchema.parse(input);
  const dup = await getDocs(
    query(collection(db, "categories"), where("name", "==", parsed.name), limit(1)),
  );
  if (!dup.empty) throw new Error("Kategori sudah ada.");
  await addDoc(collection(db, "categories"), {
    name: parsed.name,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function renameCategory(id: string, name: string) {
  const parsed = categorySchema.parse({ name });
  await updateDoc(doc(db, "categories", id), {
    name: parsed.name,
    updatedAt: serverTimestamp(),
  });
}

export async function setCategoryActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, "categories", id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}
