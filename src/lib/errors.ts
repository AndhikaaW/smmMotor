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

function nameOf(err: unknown): string {
  const n = (err as { name?: unknown })?.name;
  return typeof n === "string" ? n : "";
}

/** Varian cetak: JANGAN pernah mapping ke "Internet bermasalah".
 * Batal pilih -> pesan batal, GATT/BLE gagal -> pesan classic-vs-BLE,
 * selain itu teruskan raw/fallback apa adanya. */
function technicalToLaymanPrinter(raw: string, fallback: string): string {
  const t = raw.toLowerCase();
  if (
    t.includes("no device") ||
    t.includes("no device selected") ||
    t.includes("aborted") ||
    t.includes("cancelled") ||
    t.includes("canceled") ||
    t.includes("user cancell") ||
    (t.includes("cancel") && t.includes("device")) ||
    t.includes("notfound") ||
    (t.includes("not found") && t.includes("device"))
  )
    return "Pemilihan printer dibatalkan. Klik lagi lalu pilih printernya ya.";
  // Web Bluetooth laptop = BLE GATT saja. Printer struk murah (RPP02/EPPOS/
  // Xprinter) = Bluetooth classic SPP -> connect/GATT pasti gagal dengan
  // pesan "GATT Server is disconnected / cannot retrieve services".
  // Bukan salah internet / kode: keterbatasan platform. Arahkan ke jalur benar.
  if (
    t.includes("gatt") ||
    t.includes("retrieve services") ||
    t.includes("re)connect") ||
    t.includes("device.gatt") ||
    t.includes("networkerror") ||
    t.includes("connection rejected") ||
    t.includes("not supported") ||
    (t.includes("disconnected") && t.includes("service"))
  )
    return "Printer ini Bluetooth classic (RPP02/EPPOS), tidak bisa cetak langsung dari browser laptop (laptop hanya BLE). Pakai Cetak USB kabel / Cetak Struk driver Windows, atau cetak dari HP via RawBT ya.";
  return raw || fallback;
}

/** Ubah error apa pun jadi kalimat awam. fallback = pesan konteks per halaman. */
export function friendlyError(err: unknown, fallback: string): string {
  // 1. Validasi form (zod): ambil pesan pertama yang sudah Bahasa Indonesia.
  if (err instanceof ZodError) {
    const first = err.issues[0]?.message;
    if (first) return technicalToLayman(first, fallback);
    return fallback;
  }

  // 1b. Konteks cetak (fallback menyebut printer/cetak/USB/Bluetooth/serial):
  // JANGAN pernah dipetakan ke "Internet bermasalah". Kemarin Access denied
  // + GATT NetworkError ketelan mapping network. Batal pilih -> pesan batal,
  // selain itu -> pesan custom / fallback printer.
  if (/cetak|printer|usb|bluetooth|gatt|rpp02|xprinter|serial|classic/i.test(fallback)) {
    const raw = msgOf(err);
    const name = nameOf(err);
    const t = `${name} ${raw}`.toLowerCase();
    if (
      name === "AbortError" ||
      t.includes("no device selected") ||
      t.includes("no device") ||
      t.includes("user cancell") ||
      (t.includes("cancel") && t.includes("device"))
    )
      return "Pemilihan printer dibatalkan. Klik lagi lalu pilih printernya ya.";
    if (raw) return technicalToLaymanPrinter(raw, fallback);
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
  // Batal pilih device (USB/Bluetooth picker di-cancel): jangan lempar fallback teknis.
  if (t.includes("no device") || t.includes("no device selected") || t.includes("aborted") || t.includes("cancelled") || t.includes("canceled") || t.includes("user cancelled") || t.includes("user canceled") || t.includes("notfound") || (t.includes("not found") && t.includes("device")))
    return "Pemilihan printer dibatalkan. Klik lagi lalu pilih printernya ya.";
  // Pesan printer/USB/Bluetooth kita sudah Bahasa Indonesia -> teruskan apa adanya.
  // WAJIB setelah cek cancel & sebelum cek "network/unavailable": pesan USB
  // "Driver unavailable" kemarin ketelan jadi "Internet bermasalah".
  if (
    t.includes("usb") ||
    t.includes("bluetooth") ||
    t.includes("printer") ||
    t.includes("access denied") ||
    t.includes("securityerror") ||
    t.includes("notallowederror") ||
    t.includes("claim") ||
    t.includes("endpoint") ||
    t.includes("rpp02") ||
    t.includes("xprinter")
  )
    return raw || fallback;
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
