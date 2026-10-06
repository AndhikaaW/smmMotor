// Template struk SMM — disamakan contoh thermal (58mm & 80mm identik).
// Kertas hanya beda lebar via body.paper-58 di index.css.
// Logo hanya tampil di print HTML (<img smm.png>); teks/BT tanpa logo.
// ponytail: teks ASCII 32 kolom; upgrade path: esc-pos-encoder + raster logo bila printer BLE dikunci.
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

/** "06-10-2026, 23:07" — disamakan contoh struk. */
export function formatReceiptDate(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const SEP_SINGLE = "--------------------------------";
const SEP_DOUBLE = "================================";

function idr(n: number): string {
  return n.toLocaleString("id-ID");
}

export function buildReceiptText(d: ReceiptDataInput): string {
  const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);
  const lines: string[] = [
    `Tanggal ${d.dateStr}  # ${d.shortNumber}`,
    SEP_SINGLE,
    d.storeName,
    ...(d.address ? [d.address] : []),
    ...(d.email ? [d.email] : []),
    ...(d.phone ? [d.phone] : []),
    `Pelanggan : ${d.customerLine?.trim() ? d.customerLine.trim() : "-"}`,
    SEP_DOUBLE,
  ];
  for (const i of d.items) {
    lines.push(i.name, `${i.quantity} x ${idr(i.price)}  ${idr(i.subtotal)}`);
  }
  lines.push(
    SEP_SINGLE,
    `Total (${totalQty} Items) : ${idr(d.total)}`,
    `Dibayar : ${idr(d.payment)}`,
    `Kembalian : ${idr(d.change)}`,
    "Hormat kami",
    `*${d.barcodeValue}*`,
  );
  if (d.footer) lines.push(d.footer);
  const raw = lines.join("\n").replace(/[•]/g, "-");
  return [...raw]
    .map((c) => (c === "\n" || (c >= " " && c <= "~") ? c : "?"))
    .join("");
}

export function receiptTextToEscPos(text: string): Uint8Array {
  const body = new TextEncoder().encode(text + "\n\n\n");
  const out = new Uint8Array(2 + body.length + 7);
  out[0] = 0x1b;
  out[1] = 0x40; // INIT
  out.set(body, 2);
  // feed 3 baris + GS V 0 (cut) — abaikan bila printer tak support, tetap aman.
  out.set([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00], 2 + body.length);
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

// Web Bluetooth = BLE GATT saja (Chrome Android, HTTPS, via gesture).
// Printer BT classic SPP (mayoritas Xprinter/RPP murah) TIDAK terdeteksi —
// ponytail: fallback-nya tombol Salin/Unduh -> cetak via RawBT hingga model BLE dikunci.
export async function printTextViaBluetooth(text: string): Promise<void> {
  const nav = navigator as unknown as {
    bluetooth?: {
      requestDevice: (opts: Record<string, unknown>) => Promise<{
        gatt?: { connect: () => Promise<unknown> };
      }>;
    };
  };
  if (!nav.bluetooth)
    throw new Error(
      "HP / browser ini tidak bisa cetak bluetooth langsung. Salin struknya lalu cetak via RawBT ya.",
    );
  const data = receiptTextToEscPos(text);
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      0xff00, 0xffe0, 0x18f0,
      "0000ff00-0000-1000-8000-00805f9b34fb",
      "0000ffe0-0000-1000-8000-00805f9b34fb",
    ],
  });
  const server = (await device.gatt?.connect()) as unknown as {
    getPrimaryServices: () => Promise<
      {
        getCharacteristics: () => Promise<
          {
            writeValue?: (v: BufferSource) => Promise<void>;
            writeValueWithoutResponse?: (v: BufferSource) => Promise<void>;
            properties?: {
              write?: boolean;
              writeWithoutResponse?: boolean;
            };
          }[]
        >;
      }[]
    >;
  };
  if (!server)
    throw new Error(
      "Gagal tersambung ke printer. Dekatkan printer lalu coba lagi, atau cetak via RawBT ya.",
    );
  for (const svc of await server.getPrimaryServices()) {
    for (const ch of await svc.getCharacteristics()) {
      const canWrite =
        ch.properties?.write ||
        ch.properties?.writeWithoutResponse ||
        ch.writeValue ||
        ch.writeValueWithoutResponse;
      if (!canWrite) continue;
      const MTU = 20;
      for (let i = 0; i < data.length; i += MTU) {
        const buf: BufferSource = data.slice(
          i,
          i + MTU,
        ) as unknown as BufferSource;
        if (ch.writeValueWithoutResponse)
          await ch.writeValueWithoutResponse(buf);
        else await ch.writeValue?.(buf);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return;
    }
  }
  throw new Error(
    "Printer ini tidak cocok cetak langsung (biasanya tipe lama). Salin struknya lalu cetak via RawBT ya.",
  );
}
