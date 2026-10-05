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
import type { Mechanic, ServiceItem } from "@/types";

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  price: z.number().min(0, "Harga >= 0"),
  description: z.string().trim().default(""),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export const mechanicSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
});

export type MechanicInput = z.infer<typeof mechanicSchema>;

export async function listServices(): Promise<ServiceItem[]> {
  const snap = await getDocs(
    query(collection(db, "services"), orderBy("name")),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ServiceItem, "id">),
  }));
}

export async function createService(input: ServiceInput) {
  const parsed = serviceSchema.parse(input);
  await addDoc(collection(db, "services"), {
    ...parsed,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

export async function listMechanics(): Promise<Mechanic[]> {
  const snap = await getDocs(
    query(collection(db, "mechanics"), orderBy("name")),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Mechanic, "id">),
  }));
}

export async function createMechanic(input: MechanicInput) {
  const parsed = mechanicSchema.parse(input);
  await addDoc(collection(db, "mechanics"), {
    name: parsed.name,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function renameMechanic(id: string, name: string) {
  const parsed = mechanicSchema.parse({ name });
  await updateDoc(doc(db, "mechanics", id), {
    name: parsed.name,
    updatedAt: serverTimestamp(),
  });
}

export async function setMechanicActive(id: string, isActive: boolean) {
  await updateDoc(doc(db, "mechanics", id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}
