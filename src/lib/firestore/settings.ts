import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { GeneralSettings } from "@/types";

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2, "Nama bengkel wajib diisi"),
  address: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  receiptHeader: z.string().trim().default(""),
  receiptFooter: z.string().trim().default(""),
  paperSize: z.enum(["58", "80"]),
  paymentMethods: z
    .array(z.enum(["cash", "qris", "transfer", "debit", "other"]))
    .min(1, "Minimal 1 metode aktif"),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export async function getGeneralSettings(): Promise<GeneralSettings | null> {
  const snap = await getDoc(doc(db, "settings", "general"));
  if (!snap.exists()) return null;
  return snap.data() as GeneralSettings;
}

export async function saveGeneralSettings(input: SettingsInput, updatedBy: string) {
  const parsed = settingsSchema.parse(input);
  await setDoc(
    doc(db, "settings", "general"),
    { ...parsed, updatedAt: new Date(), updatedBy },
    { merge: true },
  );
}

export async function touchSettings(updatedBy: string) {
  await updateDoc(doc(db, "settings", "general"), {
    updatedAt: new Date(),
    updatedBy,
  });
}
