import type { FirebaseApp } from "firebase/app";
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { z } from "zod";
import { auth, db, firebaseApp } from "@/lib/firebase/client";
import type { AppUser, UserRole } from "@/types";

export const userFormSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .regex(/^[a-zA-Z0-9._-]+$/, "Hanya huruf, angka, titik, _ dan -"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  phone: z.string().trim().min(9, "No HP tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  role: z.enum(["superadmin", "admin"]),
});

export type UserFormInput = z.infer<typeof userFormSchema>;

async function ensureUnique(
  field: "username" | "email" | "phone",
  value: string,
  exceptUid?: string,
) {
  const snap = await getDocs(
    query(collection(db, "users"), where(field, "==", value), limit(2)),
  );
  if (snap.docs.some((d) => d.id !== exceptUid))
    throw new Error(`${field} sudah dipakai.`);
}

export async function createManagedUser(input: UserFormInput) {
  const parsed = userFormSchema.parse(input);
  if (!parsed.password) throw new Error("Password wajib untuk user baru.");

  await ensureUnique("username", parsed.username);
  await ensureUnique("email", parsed.email);
  await ensureUnique("phone", parsed.phone);

  // Secondary app: createUser tanpa melogout sesi superadmin yang sedang jalan.
  const tempApp = initializeApp(firebaseApp.options, `managed-${Date.now()}`);
  try {
    const tempAuth = getAuth(tempApp);
    const cred = await createUserWithEmailAndPassword(
      tempAuth,
      parsed.email,
      parsed.password,
    );
    const now = Timestamp.now();
    const appUser: AppUser & { createdAt: Timestamp; updatedAt: Timestamp } = {
      uid: cred.user.uid,
      name: parsed.name,
      username: parsed.username,
      email: parsed.email,
      phone: parsed.phone,
      role: parsed.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const batch = writeBatch(db);
    batch.set(doc(db, "users", cred.user.uid), appUser);
    batch.set(doc(db, "user_lookup", `u_${parsed.username}`), {
      email: parsed.email,
    });
    batch.set(doc(db, "user_lookup", `p_${parsed.phone}`), {
      email: parsed.email,
    });
    await batch.commit();
    return cred.user.uid;
  } finally {
    await closeTempApp(tempApp);
  }
}

async function closeTempApp(tempApp: FirebaseApp) {
  try {
    await getAuth(tempApp).signOut();
  } finally {
    await deleteApp(tempApp);
  }
}

export async function setUserActive(uid: string, isActive: boolean) {
  await updateDoc(doc(db, "users", uid), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function setUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(db, "users", uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}

export { auth };
