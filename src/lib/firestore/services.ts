import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { ServiceItem } from "@/types";

export const serviceSchema = z.object({
  name: z.string({ error: "Nama jasa belum diisi. Minimal 2 huruf ya." }).trim().min(2, "Nama jasa minimal 2 huruf. Tambah lagi ya."),
  price: z.number({ error: "Harga jasa belum diisi. Isi angkanya ya." }).min(0, "Harga jasa tidak boleh kurang dari 0 ya."),
  description: z.string({ error: "Keterangan jasa bermasalah. Kosongkan saja ya." }).trim().default(""),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export async function listServices(): Promise<ServiceItem[]> {
  const snap = await getDocs(
    query(collection(db, "services"), orderBy("name")),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ServiceItem, "id">),
  }));
}

export async function createService(input: ServiceInput): Promise<{ id: string }> {
  const parsed = serviceSchema.parse(input);
  const ref = await addDoc(collection(db, "services"), {
    ...parsed,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateService(id: string, input: ServiceInput) {
  const parsed = serviceSchema.parse(input);
  await updateDoc(doc(db, "services", id), {
    ...parsed,
    updatedAt: serverTimestamp(),
  });
}

export async function setServiceActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, "services", id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

