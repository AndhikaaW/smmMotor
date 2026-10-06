// ponytail: teks 32 kolom ASCII; upgrade path: esc-pos-encoder + codepage IBM437 bila butuh logo/QR/cutter model-spesifik.
export interface ReceiptItemInput {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ReceiptDataInput {
  header: string;
  address?: string;
  phone?: string;
  transactionNumber: string;
  dateStr: string;
  cashierName: string;
  customerName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  mechanicName?: string;
  items: ReceiptItemInput[];
  total: number;
  payment: number;
  change: number;
  paymentMethod: string;
  footer?: string;
}

const SEP = "--------------------------------";

export function buildReceiptText(d: ReceiptDataInput): string {
  const lines: string[] = [
    d.header,
    ...(d.address ? [d.address] : []),
    ...(d.phone ? [d.phone] : []),
    SEP,
    d.transactionNumber,
    `${d.dateStr} • ${d.cashierName}`,
  ];
  if (d.customerName) lines.push(`Pelanggan: ${d.customerName}`);
  if (d.vehiclePlate || d.vehicleType)
    lines.push(`Kendaraan: ${[d.vehiclePlate, d.vehicleType].filter(Boolean).join(" / ")}`);
  if (d.mechanicName) lines.push(`Mekanik: ${d.mechanicName}`);
  lines.push(SEP);
  for (const i of d.items) lines.push(`${i.name}\n${i.quantity} x ${i.price.toLocaleString("id-ID")} = ${i.subtotal.toLocaleString("id-ID")}`);
  lines.push(SEP, `TOTAL: Rp${d.total.toLocaleString("id-ID")}`, `${d.paymentMethod.toUpperCase()}: Rp${d.payment.toLocaleString("id-ID")}`);
  if (d.paymentMethod === "cash") lines.push(`KEMBALI: Rp${d.change.toLocaleString("id-ID")}`);
  lines.push(SEP);
  if (d.footer) lines.push(d.footer);
  // ASCII-kan agar aman di firmware thermal murah (Rp, •, — rawan jadi '?').
  const raw = lines.join("\n").replace(/[•]/g, "-");
  return [...raw].map((c) => (c === "\n" || (c >= " " && c <= "~") ? c : "?")).join("");
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
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
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
  if (!nav.bluetooth) throw new Error("Browser tak dukung Web Bluetooth. Pakai Chrome Android + HTTPS, atau Salin/Unduh via RawBT.");
  const data = receiptTextToEscPos(text);
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [0xff00, 0xffe0, 0x18f0, "0000ff00-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb"],
  });
  const server = (await device.gatt?.connect()) as unknown as {
    getPrimaryServices: () => Promise<
      { getCharacteristics: () => Promise<{ writeValue?: (v: BufferSource) => Promise<void>; writeValueWithoutResponse?: (v: BufferSource) => Promise<void>; properties?: { write?: boolean; writeWithoutResponse?: boolean } }[]> }[]
    >;
  };
  if (!server) throw new Error("Gagal konek GATT.");
  for (const svc of await server.getPrimaryServices()) {
    for (const ch of await svc.getCharacteristics()) {
      const canWrite = ch.properties?.write || ch.properties?.writeWithoutResponse || ch.writeValue || ch.writeValueWithoutResponse;
      if (!canWrite) continue;
      const MTU = 20;
      for (let i = 0; i < data.length; i += MTU) {
        const buf: BufferSource = data.slice(i, i + MTU) as unknown as BufferSource;
        if (ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(buf);
        else await ch.writeValue?.(buf);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return;
    }
  }
  throw new Error("Tak ada characteristic writable. Printer mungkin SPP classic — pakai Salin/Unduh via RawBT.");
}
