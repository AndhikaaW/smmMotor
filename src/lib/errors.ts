// Pesan error ramah orang awam (Bahasa Indonesia).
// Semua halaman CRUD wajib pakai friendlyError() agar pesan teknis
// Firebase/Zod tidak bocor ke kasir.
//
// ponytail: mapping manual per-code; upgrade path: i18n dictionary bila butuh EN.
import { ZodError } from "zod";

type MaybeCoded = { code?: unknown; message?: unknown };

function codeOf(err: unknown): string {
  const c = (err as MaybeCoded)?.code;
  return typeof c === "string" ? c : "";
}

function msgOf(err: unknown): string {
  const m = (err as MaybeCoded)?.message;
  return typeof m === "string" ? m : "";
}

/** Ubah error apa pun jadi kalimat awam. fallback = pesan konteks per halaman. */
export function friendlyError(err: unknown, fallback: string): string {
  // 1. Validasi form (zod): ambil pesan pertama yang sudah Bahasa Indonesia.
  if (err instanceof ZodError) {
    const first = err.issues[0]?.message;
    if (first) return technicalToLayman(first, fallback);
    return fallback;
  }

  const code = codeOf(err);
  const raw = msgOf(err);

  // 2. Kode error Firebase Auth.
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Username / email / password salah. Coba lagi ya.";
    case "auth/invalid-email":
      return "Alamat email-nya tidak valid. Periksa ketikannya ya.";
    case "auth/email-already-in-use":
      return "Email ini sudah dipakai akun lain. Pakai email lain ya.";
    case "auth/weak-password":
      return "Password terlalu lemah. Minimal 6 karakter ya.";
    case "auth/too-many-requests":
      return "Terlalu sering mencoba. Tunggu sebentar lalu coba lagi ya.";
    case "auth/network-request-failed":
      return "Internet bermasalah. Cek koneksi lalu coba lagi ya.";
    case "auth/requires-recent-login":
      return "Sesi sudah lama. Silakan login ulang ya.";
    // 3. Kode error Firestore.
    case "permission-denied":
      return "Tidak punya izin untuk aksi ini. Hubungi superadmin ya.";
    case "unauthenticated":
      return "Sesi habis. Silakan login ulang ya.";
    case "unavailable":
    case "deadline-exceeded":
      return "Server sibuk atau koneksi lambat. Coba lagi sebentar ya.";
    case "not-found":
      return "Datanya tidak ditemukan. Mungkin sudah dihapus ya.";
    case "already-exists":
    case "aborted":
      return "Datanya bentrok / sudah ada. Muat ulang lalu coba lagi ya.";
    case "invalid-argument":
      return fallback;
    case "":
      break;
    default:
      break;
  }

  // 4. Pesan teknis berbahasa Inggris yang lolos tanpa kode.
  if (raw) return technicalToLayman(raw, fallback);
  return fallback;
}

/** Terjemahkan sisa pesan teknis Inggris -> kalimat awam. */
function technicalToLayman(raw: string, fallback: string): string {
  const t = raw.toLowerCase();
  if (t.includes("missing or insufficient permissions") || t.includes("permission-denied") || t.includes("permission denied"))
    return "Tidak punya izin untuk aksi ini. Hubungi superadmin ya.";
  if (t.includes("network") || t.includes("failed to fetch") || t.includes("load failed") || t.includes("unavailable"))
    return "Internet bermasalah. Cek koneksi lalu coba lagi ya.";
  if (t.includes("no document to update") || t.includes("not-found") || t.includes("no such document"))
    return "Datanya tidak ditemukan. Mungkin sudah dihapus ya.";
  if (t.includes("already exists") || t.includes("document already exists"))
    return "Datanya sudah ada. Pakai nama / kode lain ya.";
  if (t.includes("invalid login") || t.includes("invalid-credential") || t.includes("wrong password"))
    return "Username / email / password salah. Coba lagi ya.";
  // Pesan custom kita sudah Bahasa Indonesia -> teruskan apa adanya.
  if (/[a-z]/.test(raw) && /[A-Z]/.test(raw) && !/[à-ÿ]/.test(raw) && /^[A-Za-z0-9 _.,:()/-]+$/.test(raw) && t.includes("error")) return fallback;
  return raw || fallback;
}
