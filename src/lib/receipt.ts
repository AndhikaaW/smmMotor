// Template struk SMM — print ulang (HTML/ReceiptPrint) & Bluetooth (ESC/POS) satu sumber.
// Urutan: Tanggal (tanpa kode) > garis > logo + toko CENTER > Pelanggan > garis tebal >
//   item (nama bold, qty kiri + subtotal kanan) > garis > Total/Dibayar/Kembalian >
//   Hormat kami (kanan, underline) > barcode grafis + 1 baris kode > footer > jeda bawah > potong.
// Jeda bawah sedikit: 2 feed + cut (dulu 3 feed = blank panjang seperti foto user).
// Center BT: teks TRIM + perintah ALIGN_C printer (tanpa spasi pad dobel yang
// bikin header miring kanan).
// Teks polos (buildReceiptText) hanya untuk Salin/Unduh/RawBT + preview bawah.
// ponytail: upgrade path: esc-pos-encoder bila printer BLE dikunci.
export interface ReceiptItemInput {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ReceiptDataInput {
  storeName: string;
  address?: string;
  email?: string;
  phone?: string;
  dateStr: string;
  shortNumber: string;
  barcodeValue: string;
  customerLine?: string;
  items: ReceiptItemInput[];
  total: number;
  payment: number;
  change: number;
  footer?: string;
}

export const RECEIPT_LOGO_SRC = `${import.meta.env.BASE_URL}smm.png`;

/** "TRX-20261007-HXRB" -> "HXRB"; "TRX-20261007-123" -> "123". */
export function shortNumberOf(transactionNumber: string): string {
  const t = transactionNumber.trim();
  if (!t) return "";
  const parts = t.split("-").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : t;
}

/** Nilai barcode Code128: alfanumerik saja agar bisa di-scan balik. */
export function barcodeValueOf(transactionNumber: string): string {
  const v = transactionNumber.replace(/[^A-Za-z0-9]/g, "");
  return v || transactionNumber;
}

/** "06-10-2026, 23:07" — disamakan struk print ulang yang sudah benar. */
export function formatReceiptDate(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const SEP_SINGLE = "--------------------------------";
const SEP_DOUBLE = "================================";
const COLS = 32;

function idr(n: number): string {
  return n.toLocaleString("id-ID");
}

/** Sanitasi ke ASCII printable agar printer thermal tak cetak karakter aneh. */
function ascii(s: string): string {
  return [...s.replace(/[•]/g, "-")]
    .map((c) => (c === "\n" || (c >= " " && c <= "~") ? c : "?"))
    .join("");
}

function wrapWords(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out: string[] = [];
  let cur = "";
  for (let w of words) {
    while (w.length > width) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      out.push(w.slice(0, width));
      w = w.slice(width);
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function centered(text: string): string[] {
  return wrapWords(text.trim(), COLS).map(
    (l) => " ".repeat(Math.max(0, Math.floor((COLS - l.length) / 2))) + l,
  );
}

/** Satu baris kiri-kanan 32 kolom; bila tak muat, kanan turun rata kanan. */
function leftRight(left: string, right: string): string[] {
  const l = left.trim();
  const r = right.trim();
  if (!l) return [r.padStart(COLS).slice(-COLS)];
  if (!r) return wrapWords(l, COLS);
  if (l.length + 1 + r.length <= COLS) {
    return [`${l}${" ".repeat(COLS - l.length - r.length)}${r}`];
  }
  return [...wrapWords(l, COLS), r.padStart(COLS).slice(-COLS)];
}

/** Baris-baris teks 32 kolom — cermin urutan ReceiptPrint (HTML).
 * Kepala atas TANPA kode transaksi (sesuai permintaan user). */
function receiptLines(d: ReceiptDataInput): string[] {
  const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);
  const customer = d.customerLine?.trim() ? d.customerLine.trim() : "-";
  const lines: string[] = [
    `Tanggal ${d.dateStr}`,
    SEP_SINGLE,
    ...centered(d.storeName),
    ...(d.address ? centered(d.address) : []),
    ...(d.email ? centered(d.email) : []),
    ...(d.phone ? centered(d.phone) : []),
    ...wrapWords(`Pelanggan : ${customer}`, COLS),
    SEP_DOUBLE,
  ];
  for (const i of d.items) {
    lines.push(...wrapWords(i.name, COLS));
    lines.push(...leftRight(`${i.quantity} x ${idr(i.price)}`, idr(i.subtotal)));
  }
  lines.push(
    SEP_SINGLE,
    ...leftRight(`Total (${totalQty} Items) :`, idr(d.total)),
    ...leftRight("Dibayar :", idr(d.payment)),
    ...leftRight("Kembalian :", idr(d.change)),
    "Hormat kami".padStart(COLS),
    ...centered(`*${d.barcodeValue}*`),
  );
  if (d.footer) lines.push(...wrapWords(d.footer, COLS));
  return lines;
}

/** Teks polos: fallback Salin/Unduh/RawBT + isi preview bawah dialog. */
export function buildReceiptText(d: ReceiptDataInput): string {
  return ascii(receiptLines(d).join("\n"));
}

function enc(s: string): number[] {
  return [...new TextEncoder().encode(ascii(s))];
}

/** Logo smm.png -> raster 1-bit ESC/POS (GS v 0), center. Gagal => null (lanjut teks saja). */
export async function loadLogoRaster(maxWidth = 176): Promise<Uint8Array | null> {
  try {
    const img = new Image();
    img.src = RECEIPT_LOGO_SRC;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo"));
      setTimeout(() => reject(new Error("logo")), 4000);
    });
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const w = Math.max(8, Math.floor(img.naturalWidth * scale));
    const h = Math.max(8, Math.floor(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const bytesPerRow = Math.ceil(w / 8);
    const raster = new Uint8Array(bytesPerRow * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
        if (lum < 128) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    const head = [
      0x1b, 0x61, 0x01, 0x1d, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff,
    ];
    const tail = [0x0a, 0x1b, 0x61, 0x00];
    const out = new Uint8Array(head.length + raster.length + tail.length);
    out.set(head, 0);
    out.set(raster, head.length);
    out.set(tail, head.length + raster.length);
    return out;
  } catch {
    return null;
  }
}

/**
 * Bytes ESC/POS yang meniru ReceiptPrint: logo raster + center/bold/underline
 * + barcode printer. Isi & urutan sama dengan preview atas.
 */
export function buildReceiptEscPos(d: ReceiptDataInput, logo?: Uint8Array | null): Uint8Array {
  const ALIGN_L = [0x1b, 0x61, 0x00];
  const ALIGN_C = [0x1b, 0x61, 0x01];
  const ALIGN_R = [0x1b, 0x61, 0x02];
  const B_ON = [0x1b, 0x45, 0x01];
  const B_OFF = [0x1b, 0x45, 0x00];
  const U_ON = [0x1b, 0x2d, 0x01];
  const U_OFF = [0x1b, 0x2d, 0x00];
  const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);
  const customer = d.customerLine?.trim() ? d.customerLine.trim() : "-";

  const out: number[] = [];
  const push = (...b: number[]) => {
    out.push(...b);
  };
  const textLine = (s: string) => {
    push(...enc(s), 0x0a);
  };

  push(0x1b, 0x40); // INIT
  if (logo?.length) push(...logo);

  // Kepala atas: Tanggal saja (kode transaksi tidak ikut — permintaan user).
  push(...ALIGN_L);
  for (const l of wrapWords(`Tanggal ${d.dateStr}`, COLS)) textLine(l);
  textLine(SEP_SINGLE);

  // Toko: nama bold center, alamat/kontak center — seperti preview atas.
  // TRIM tanpa spasi pad: perintah ALIGN_C printer yang memposisikan tengah.
  // (Spasi pad + ALIGN_C dobel = teks miring kanan seperti screenshot user.)
  push(...ALIGN_C, ...B_ON);
  for (const l of wrapWords(d.storeName.trim(), COLS)) textLine(l.trim());
  push(...B_OFF);
  if (d.address) for (const l of wrapWords(d.address, COLS)) textLine(l.trim());
  if (d.email) for (const l of wrapWords(d.email, COLS)) textLine(l.trim());
  if (d.phone) for (const l of wrapWords(d.phone, COLS)) textLine(l.trim());

  // Meta + item.
  push(...ALIGN_L);
  for (const l of wrapWords(`Pelanggan : ${customer}`, COLS)) textLine(l);
  textLine(SEP_DOUBLE);
  for (const i of d.items) {
    push(...B_ON);
    for (const l of wrapWords(i.name, COLS)) textLine(l);
    push(...B_OFF);
    for (const l of leftRight(`${i.quantity} x ${idr(i.price)}`, idr(i.subtotal))) textLine(l);
  }
  textLine(SEP_SINGLE);

  // Total bold, bayar/kembalian biasa.
  push(...B_ON);
  for (const l of leftRight(`Total (${totalQty} Items) :`, idr(d.total))) textLine(l);
  push(...B_OFF);
  for (const l of leftRight("Dibayar :", idr(d.payment))) textLine(l);
  for (const l of leftRight("Kembalian :", idr(d.change))) textLine(l);

  // Hormat kami: kanan + underline seperti preview atas.
  // Dulu textLine("") kosong — teksnya hilang di kertas.
  push(...ALIGN_R, ...U_ON);
  textLine("Hormat kami");
  push(...U_OFF);

  // Barcode Code128: SATU label saja (HRI di bawah grafis, via GS H 2).
  // Mode normal andalkan HRI printer; mode kompatibel (teks polos) bawa *BV*
  // sebagai fallback bila firmware clone mengabaikan perintah GS k.
  push(...ALIGN_C);
  push(0x1d, 0x68, 0x50, 0x1d, 0x77, 0x02, 0x1d, 0x48, 0x02);
  const bv = ascii(d.barcodeValue.trim() || "-");
  if (bv && bv !== "-") {
    const bd = [...new TextEncoder().encode(bv)];
    if (bd.length >= 2 && bd.length <= 30) push(0x1d, 0x6b, 0x49, bd.length, ...bd, 0x0a);
  }

  // Footer rata kiri seperti ReceiptPrint.
  push(...ALIGN_L);
  if (d.footer) for (const l of wrapWords(d.footer, COLS)) textLine(l);

  // Jeda bawah sedikit: 2 feed + cut.
  push(0x0a, 0x0a, 0x1d, 0x56, 0x00);
  return new Uint8Array(out);
}
/** Kompat: teks polos -> bytes minimal (tanpa logo/format). Dipakai bila data tak ada. */
export function receiptTextToEscPos(text: string, logoRaster?: Uint8Array): Uint8Array {
  const head = [0x1b, 0x40, 0x1b, 0x61, 0x00];
  const body = new TextEncoder().encode(`${ascii(text)}\n`);
  const tail = [0x0a, 0x0a, 0x1d, 0x56, 0x00]; // jeda bawah sedikit: 2 feed + cut
  const logo = logoRaster ?? new Uint8Array(0);
  const out = new Uint8Array(head.length + logo.length + body.length + tail.length);
  out.set(head, 0);
  out.set(logo, head.length);
  out.set(body, head.length + logo.length);
  out.set(tail, head.length + logo.length + body.length);
  return out;
}

export function downloadTextFile(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export interface BluetoothPrintResult {
  deviceName: string;
  bytes: number;
  serviceUuid: string;
  charUuid: string;
}

interface BleChar {
  uuid?: string;
  properties?: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue?: (v: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (v: BufferSource) => Promise<void>;
}

interface BleService {
  uuid?: string;
  getCharacteristics: () => Promise<BleChar[]>;
}

interface BleServer {
  getPrimaryServices: () => Promise<BleService[]>;
  disconnect?: () => void;
}

interface BleDevice {
  name?: string;
  gatt?: { connect: () => Promise<BleServer>; disconnect?: () => void; connected?: boolean };
}

/** Skor characteristic: RX printer umum (FFE1/FF02/FFE9/...) menang, bukan battery/info. */
function scorePrinterChar(svcUuid: string, charUuid: string): number {
  const s = `${svcUuid} ${charUuid}`.toLowerCase();
  let score = 0;
  if (/ffe1|ff02|ffe9|2af1|e7810a71|49535343/.test(s)) score += 10;
  if (/ffe0|ff00|ffe5|18f0/.test(s)) score += 2;
  if (/battery|2a19|2a00|2a01|1800|1801|180a/.test(s)) score -= 10;
  return score;
}

async function sendBytesToPrinter(data: Uint8Array): Promise<BluetoothPrintResult> {
  const nav = navigator as unknown as {
    bluetooth?: { requestDevice: (opts: Record<string, unknown>) => Promise<BleDevice> };
  };
  if (!nav.bluetooth)
    throw new Error(
      "HP / browser ini tidak bisa cetak bluetooth langsung. Salin struknya lalu cetak via RawBT ya.",
    );
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      0xff00, 0xffe0, 0xffe5, 0x18f0,
      "0000ff00-0000-1000-8000-00805f9b34fb",
      "0000ffe0-0000-1000-8000-00805f9b34fb",
      "0000ffe5-0000-1000-8000-00805f9b34fb",
    ],
  });
  const server = await device.gatt?.connect();
  if (!server)
    throw new Error(
      "Gagal tersambung ke printer. Dekatkan printer lalu coba lagi, atau cetak via RawBT ya.",
    );
  try {
    // Kumpulkan SEMUA characteristic writable dulu, lalu pilih skor tertinggi.
    // Dulu: first-match -> sering nyasar ke battery/device-info (write OK, kertas diam).
    const candidates: { svcUuid: string; ch: BleChar; score: number; noResp: boolean }[] = [];
    for (const svc of await server.getPrimaryServices()) {
      const svcUuid = svc.uuid ?? "?";
      for (const ch of await svc.getCharacteristics()) {
        const noResp = !!ch.properties?.writeWithoutResponse || !!ch.writeValueWithoutResponse;
        const withResp = !!ch.properties?.write || !!ch.writeValue;
        if (!noResp && !withResp) continue;
        candidates.push({
          svcUuid,
          ch,
          score: scorePrinterChar(svcUuid, ch.uuid ?? "") + (noResp ? 1 : 0),
          noResp,
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best)
      throw new Error(
        "Printer ini tidak cocok cetak langsung (biasanya tipe lama). Salin struknya lalu cetak via RawBT ya.",
      );
    // writeWithoutResponse: chunk 20 + jeda (buffer BLE kecil); write: chunk 512.
    const MTU = best.noResp ? 20 : 512;
    for (let i = 0; i < data.length; i += MTU) {
      const buf = data.slice(i, i + MTU) as unknown as BufferSource;
      if (best.noResp && best.ch.writeValueWithoutResponse)
        await best.ch.writeValueWithoutResponse(buf);
      else await best.ch.writeValue?.(buf);
      await new Promise<void>((resolve) => setTimeout(resolve, best.noResp ? 20 : 10));
    }
    return {
      deviceName: device.name ?? "printer",
      bytes: data.length,
      serviceUuid: best.svcUuid,
      charUuid: best.ch.uuid ?? "?",
    };
  } finally {
    try {
      server.disconnect?.();
    } catch {
      // abaikan: putus agar print berikutnya tidak nyangkut
    }
  }
}

// Web Bluetooth = BLE GATT saja (Chrome Android, HTTPS, via gesture).
// Printer BT classic SPP (mayoritas Xprinter/RPP murah) TIDAK terdeteksi —
// ponytail: fallback-nya tombol Salin/Unduh -> cetak via RawBT hingga model BLE dikunci.
/**
 * Cetak Bluetoothivisual = preview atas: logo + center/bold + barcode printer.
 * compatible=true: teks polos tanpa logo/barcode grafis — untuk firmware clone
 * yang stall pada GS v 0 / GS k (kertas diam walau GATT write sukses).
 */
export async function printTextViaBluetooth(
  d: ReceiptDataInput,
  opts?: { compatible?: boolean },
): Promise<BluetoothPrintResult> {
  if (opts?.compatible) return sendBytesToPrinter(receiptTextToEscPos(buildReceiptText(d)));
  const logo = await loadLogoRaster();
  return sendBytesToPrinter(buildReceiptEscPos(d, logo));
}
