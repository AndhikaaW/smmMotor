import { Button } from "@/components/ui/button";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import type { ReceiptDataInput } from "@/lib/receipt";

/** Preview sebelum cetak Bluetooth: atas = hasil kertas (yang dikirim ke printer:
 * logo raster + perintah center/bold/underline/barcode). Bawah = teks fallback
 * untuk Salin/Unduh/RawBT, bukan yang dicetak tombol Bluetooth. */
export function BluetoothPreviewDialog({
  open,
  title,
  data,
  text,
  printing,
  printMsg,
  compatible,
  onCompatibleChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  data: ReceiptDataInput | null;
  text: string;
  printing: boolean;
  printMsg: string | null;
  compatible: boolean;
  onCompatibleChange: (v: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text"
            aria-label="Tutup preview"
          >
            ×
          </button>
        </div>
        {data && (
          <div className="receipt-preview-paper mt-4">
            <ReceiptPrint d={data} />
          </div>
        )}
        <pre className="receipt-preview-text mt-3">{text}</pre>
        {printMsg && <p className="mt-2 text-xs text-muted">{printMsg}</p>}
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={compatible}
            onChange={(e) => onCompatibleChange(e.target.checked)}
            className="mt-0.5"
          />
          <span>Mode kompatibel (kertas keluar tapi kosong / printer lama: teks polos tanpa logo & barcode grafis).</span>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Koreksi Dulu
          </Button>
          <Button disabled={printing || !text} onClick={onConfirm}>
            {printing ? "Mengirim..." : "Cetak Sekarang"}
          </Button>
        </div>
      </div>
    </div>
  );
}
