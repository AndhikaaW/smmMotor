import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { RECEIPT_LOGO_SRC, type ReceiptDataInput } from "@/lib/receipt";

function idr(n: number): string {
  return n.toLocaleString("id-ID");
}

/** Satu-satunya template struk HTML — dipakai Kasir + Riwayat.
 * Kepala atas TANPA kode transaksi (permintaan user).
 * Barcode bawah SATU label (displayValue JsBarcode); tanpa <p> manual. */
export function ReceiptPrint({ d }: { d: ReceiptDataInput }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!barcodeRef.current || !d.barcodeValue) return;
    try {
      JsBarcode(barcodeRef.current, d.barcodeValue, {
        format: "CODE128",
        displayValue: true,
        fontSize: 12,
        height: 56,
        margin: 0,
      });
    } catch {
      // biarkan angka polos bila value tak valid Code128
    }
  }, [d.barcodeValue]);

  return (
    <div className="receipt-print">
      <div className="receipt-top receipt-top-single">
        <span>Tanggal {d.dateStr}</span>
      </div>
      <div className="receipt-hr" />
      <div className="receipt-center">
        <img src={RECEIPT_LOGO_SRC} alt="SMM" className="receipt-logo" />
        <p className="receipt-store">{d.storeName}</p>
        {d.address && <p>{d.address}</p>}
        {d.email && <p>{d.email}</p>}
        {d.phone && <p>{d.phone}</p>}
      </div>
      <p className="receipt-cust">
        Pelanggan : {d.customerLine?.trim() ? d.customerLine.trim() : "-"}
      </p>
      <div className="receipt-hr-double" />
      <div className="receipt-items">
        {d.items.map((i, idx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={`${i.name}-${idx}`}
            className="receipt-item"
          >
            <p className="receipt-item-name">{i.name}</p>
            <p className="receipt-item-row">
              <span>
                {i.quantity} x {idr(i.price)}
              </span>
              <span>{idr(i.subtotal)}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="receipt-hr" />
      <div className="receipt-totals">
        <p className="receipt-total-line">
          <span>Total ({totalQty} Items) :</span>
          <span className="receipt-total-num">{idr(d.total)}</span>
        </p>
        <p>
          <span>Dibayar :</span>
          <span>{idr(d.payment)}</span>
        </p>
        <p>
          <span>Kembalian :</span>
          <span>{idr(d.change)}</span>
        </p>
      </div>
      <div className="receipt-barcode">
        <svg ref={barcodeRef} />
      </div>
      {d.footer && <p className="receipt-footer">{d.footer}</p>}
    </div>
  );
}
