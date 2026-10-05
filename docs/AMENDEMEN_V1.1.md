# Amendemen V1.1 — Bengkel POS

**Tanggal:** 2026-10-05 | **Status:** Mengikat, menggantikan bagian PRD V1.0 yang bertentangan.
**Sumber:** 10 keputusan user pasca-review PRD + UI/UX planning.

---

## A1. Nomor transaksi — opsi B (random, tanpa counter)

Format: `TRX-YYYYMMDD-XXXX`, `XXXX` = 4 char acak `[A-Z0-9]` tanpa `0/O/1/I` (hindari salah baca).
Contoh: `TRX-20261005-K7P2`.

- Doc ID Firestore tetap auto-ID, bukan nomor transaksi.
- Collision check: query `where transactionNumber == X`, regenerate bila ada (probabilitas tabrakan ~1/1M, 1x cek cukup).
- Alasan: tanpa Cloud Functions, counter per-hari via doc rentan contention saat 2 kasir checkout bersamaan.

Menggantikan PRD §15 (sekuensial `0001, 0002...`).

## A2. Diskon — DIHAPUS total dari V1

Tidak ada diskon nominal/persen, tidak di level item maupun transaksi. `total = subtotal` selalu.

Dampak (ralat PRD):
- §14 Cart/Transaksi: field `discount` dihapus dari skema.
- §21/22 Report: metrik `total discount` dihapus.
- §36 Acceptance POS: poin diskon dihapus.
- UI: baris Diskon di cart summary + payment modal dihapus.

## A3. Pembayaran — kembalian hanya cash

- `cash`: `payment >= total`, `change = payment - total`.
- `qris | transfer | debit | other`: `payment` WAJIB `== total`, `change = 0`. Tolak (validasi client + Rules) bila kurang atau lebih.
- Tetap pencatatan saja, tanpa payment gateway (sesuai PRD).

## A4. Jasa + produk — input 2 baris manual

Tidak ada konsep paket/bundling di V1. Contoh "Ganti Oli + Oli Federal" = 1 baris `service` + 1 baris `product`. Skema item tidak berubah.

## A5. Customer & kendaraan — TIDAK ADA di V1

Collections final V1 (8): `users, categories, products, services, mechanics, transactions, stock_movements, settings`.
`customers` dan `vehicles` dihapus dari opsi (§25 PRD). Skema transaksi tanpa field customer.

## A6. Role — hanya 2: `superadmin` + `admin`

| Kemampuan | admin | superadmin |
|---|---|---|
| Dashboard, POS, produk, stok, jasa, mekanik | ✅ | ✅ |
| Lihat riwayat + laporan | ✅ | ✅ |
| Stock adjustment/opname | ✅ | ✅ |
| Hapus transaksi | ❌ | ✅ |
| Kelola user | ❌ | ✅ |
| Kelola settings | ❌ | ✅ |

- Role `owner/cashier/warehouse` dihapus (ralat PRD §6, §28).
- Pembuatan akun: oleh superadmin via aplikasi memakai secondary FirebaseApp (agar sesi superadmin tidak logout), atau manual via Firebase Console untuk bootstrap.
- Bootstrap: user superadmin PERTAMA dibuat manual via Console (Auth + doc `users/{uid}`), karena Rules melarang write `users` kecuali superadmin.
- Login + lupa password (V1): SATU kolom bebas — ketik username / email / no HP → resolve ke email via query `users` (`username== OR email== OR phone==`) → `signInWithEmailAndPassword` / `sendPasswordResetEmail`. Reset link tetap via email (keterbatasan Firebase Auth tanpa backend). Placeholder: "Username / Email / No HP".
- Skema `users/{uid}`: `uid, name, username (unik), email (unik), phone (unik), role, isActive, createdAt, updatedAt`.

## A7. Settings — satu doc dinamis

`settings/general`: `storeName, address, phone, receiptHeader, receiptFooter, paperSize ('58'|'80'), paymentMethods (array aktif dari cash/qris/transfer/debit/other), updatedAt, updatedBy`.
Editable oleh superadmin. Semua tampilan (struk, payment modal) baca dari sini — tidak ada nilai toko yang di-hardcode.

## A8. Tanpa void/cancel — hapus transaksi SOFT-delete + konfirmasi

Keputusan user: hapus transaksi riwayat dengan popup konfirmasi. Penetapan aman:

- Hapus = **soft-delete**: `status: 'deleted'` + `deletedAt, deletedBy`. Dokumen TIDAK dihapus permanen.
- Stok produk di item transaksi **dikembalikan otomatis** + movement `type=return, referenceType=transaction_delete`.
- Hanya superadmin. Transaksi `status=deleted` tersembunyi dari riwayat default & dikecualikan dari semua agregat laporan.
- ⚠️ RISIKO: riwayat terhapus tetap memengaruhi akurasi laporan periode lalu (omzet berubah). Alternatif bila nanti keberatan: arsip read-only tanpa kembalikan stok. Ralat PRD §19 (void) + aturan "jangan hapus permanen" (§39) tetap dipatuhi via soft-delete.

## A9. Eksekusi — dokumen fase dulu, implementasi bertahap

Lihat `IMPLEMENTATION_PHASES_V1.1.md`. Prioritas P0 (wajib hidup dulu): Auth → Produk/Barcode/Stok → POS → History → Report. Dashboard cantik belakangan.

## A10. Firebase — setup manual dipandu, lalu Phase 0

Panduan di chat. Setelah config `.env` terisi → mulai Phase 0.

---

## Skema transaksi V1.1 (menggantikan contoh PRD §26)

```json
{
  "transactionNumber": "TRX-20261005-K7P2",
  "transactionDate": "Timestamp",
  "cashierId": "uid123",
  "cashierName": "Budi",
  "items": [
    {"type": "product", "productId": "p1", "name": "Oli Federal",
     "price": 50000, "quantity": 2, "subtotal": 100000},
    {"type": "service", "serviceId": "s1", "name": "Ganti Oli",
     "price": 15000, "quantity": 1, "subtotal": 15000}
  ],
  "subtotal": 115000,
  "total": 115000,
  "payment": 120000,
  "change": 5000,
  "paymentMethod": "cash",
  "status": "completed"
}
```

`status`: `completed | deleted`. Tanpa `discount`.
