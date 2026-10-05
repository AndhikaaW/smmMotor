import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { Timestamp, doc, getDoc } from "firebase/firestore";
import { z } from "zod";
import { auth, db } from "@/lib/firebase/client";

export const identifierSchema = z.string().trim().min(3, "Minimal 3 karakter");

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const lookupDocSchema = z.object({ email: z.string().email() });

async function lookupEmail(key: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "user_lookup", key));
  if (!snap.exists()) return null;
  const parsed = lookupDocSchema.safeParse(snap.data());
  return parsed.success ? parsed.data.email : null;
}

async function resolveEmail(identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (id.includes("@")) return id.toLowerCase();
  // Firebase Auth hanya kenal email; username/phone di-resolve via
  // koleksi publik user_lookup (hanya berisi email, tanpa data lain).
  // List ditolak Rules sehingga tidak bisa di-enumerasi massal.
  return (
    (await lookupEmail(`u_${id}`)) ?? (await lookupEmail(`p_${id}`))
  );
}

export async function signInWithIdentifier(input: LoginInput) {
  const parsed = loginSchema.parse(input);
  const email = await resolveEmail(parsed.identifier);
  if (!email) throw new Error("Akun tidak ditemukan.");
  const cred = await signInWithEmailAndPassword(auth, email, parsed.password);
  return cred.user;
}

export async function sendResetForIdentifier(identifier: string) {
  const id = identifierSchema.parse(identifier);
  const email = await resolveEmail(id);
  if (!email) throw new Error("Akun tidak ditemukan.");
  await sendPasswordResetEmail(auth, email);
}

export function signOutUser() {
  return signOut(auth);
}

export function serverTimestampNow() {
  return Timestamp.now();
}
