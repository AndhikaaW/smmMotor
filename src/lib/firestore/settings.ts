import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/client";
import type { GeneralSettings } from "@/types";

export const settingsSchema = z.object({
  storeName: z.string({ error: "Nama bengkel belum diisi. Isi dulu ya." }).trim().min(2, "Nama bengkel minimal 2 huruf. Tambah lagi ya."),
  address: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  email: z.string().trim().default(""),
  receiptHeader: z.string().trim().default(""),
  receiptFooter: z.string().trim().default(""),
  paperSize: z.enum(["58", "80"], { error: "Ukuran kertas belum dipilih. Pilih 58 atau 80 ya." }),
  paymentMethods: z
    .array(z.enum(["cash", "qris", "transfer", "debit", "other"], { error: "Metode bayar tidak dikenal. Pilih yang tersedia ya." }))
    .min(1, "Minimal 1 metode bayar aktif. Contoh: Cash ya."),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
// Legacy doc belum punya email → normalisasi di boundary agar typed aman.
const generalSettingsDocSchema = settingsSchema.extend({
  storeName: z.string().catch(""),
  paymentMethods: z.array(z.enum(["cash", "qris", "transfer", "debit", "other"])).catch(["cash" as const]),
});

export async function getGeneralSettings(): Promise<GeneralSettings | null> {
  const snap = await getDoc(doc(db, "settings", "general"));
  if (!snap.exists()) return null;
  return generalSettingsDocSchema.parse(snap.data());
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
