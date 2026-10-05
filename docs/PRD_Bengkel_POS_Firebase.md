# PRD --- Sistem Kasir & Inventory Bengkel

**Nama proyek:** Bengkel POS / Workshop Cashier\
**Dokumen:** Product Requirements Document (PRD)\
**Versi:** 1.0\
**Tanggal:** 2026-10-05\
**Status:** Planning / Ready for AI Agent Implementation

------------------------------------------------------------------------

## 1. Ringkasan Produk

Aplikasi ini adalah sistem kasir dan pengelolaan stok untuk bengkel
motor.

Fokus utama versi pertama:

-   Transaksi penjualan/kasir
-   Scan barcode produk menggunakan barcode scanner USB
-   Pengelolaan produk dan stok
-   Pengelolaan jasa servis
-   Pengelolaan mekanik
-   Riwayat transaksi
-   Laporan harian
-   Laporan bulanan
-   Login dan role pengguna
-   Cetak struk
-   Dashboard sederhana

Aplikasi dirancang untuk digunakan terutama pada **PC Windows di kasir
bengkel**, dengan opsi aplikasi mobile Flutter untuk owner/monitoring.

### Prinsip arsitektur

-   Tidak menggunakan VPS pada versi awal.
-   Tidak menggunakan Laravel.
-   Tidak menggunakan backend server custom.
-   Tidak menggunakan Firebase Storage karena versi awal tidak
    membutuhkan gambar.
-   Cloud Functions **tidak digunakan pada versi awal**, kecuali
    benar-benar dibutuhkan di kemudian hari.
-   Firebase Firestore menjadi database utama.
-   Firebase Authentication digunakan untuk login.
-   Security Rules Firestore digunakan untuk pembatasan akses.
-   Transaksi stok yang membutuhkan konsistensi menggunakan Firestore
    Transaction/Batch Write.
-   Client tidak boleh bebas mengubah field sensitif tanpa
    validasi/security rule.

------------------------------------------------------------------------

# 2. Target Platform

## 2.1 Web / PC Kasir

Platform utama:

-   Windows PC
-   Chrome / Edge
-   React + TypeScript + Vite

Alasan:

-   Cocok untuk aplikasi POS desktop.
-   Barcode scanner USB umumnya bekerja seperti keyboard.
-   Mudah menggunakan keyboard shortcut.
-   Cocok untuk tabel produk/transaksi.
-   Mudah deployment.
-   Tidak membutuhkan instalasi aplikasi khusus jika menggunakan web.

## 2.2 Mobile

Opsional pada fase awal, tetapi arsitektur harus memungkinkan:

-   Flutter
-   Android
-   Digunakan owner/admin untuk melihat dashboard, stok, dan laporan.

------------------------------------------------------------------------

# 3. Technology Stack

## Web POS

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   shadcn/ui
-   TanStack Query
-   React Hook Form
-   Zod
-   Firebase SDK

## Mobile

-   Flutter
-   Dart
-   Firebase SDK
-   State management bebas, rekomendasi Riverpod atau GetX sesuai
    preferensi project

## Backend / Cloud

-   Firebase Authentication
-   Cloud Firestore
-   Firestore Security Rules

### Tidak digunakan pada V1

-   Firebase Cloud Functions
-   Firebase Storage
-   VPS
-   Laravel
-   PostgreSQL
-   Node.js custom backend

------------------------------------------------------------------------

# 4. Tujuan Bisnis

Sistem harus membantu bengkel:

1.  Mempercepat proses transaksi.
2.  Mengurangi kesalahan pencatatan stok.
3.  Mempermudah pencarian produk melalui barcode.
4.  Mengetahui stok produk secara real-time.
5.  Melihat riwayat transaksi.
6.  Mengetahui omzet harian dan bulanan.
7.  Mengetahui produk yang paling sering terjual.
8.  Mengetahui produk yang stoknya menipis.
9.  Mengurangi pencatatan manual menggunakan buku/Excel.
10. Menyediakan histori perubahan stok.

------------------------------------------------------------------------

# 5. Scope V1

## Included

-   Authentication
-   Dashboard
-   Product management
-   Category management
-   Barcode
-   Stock management
-   Stock movement
-   Service management
-   Mechanic management
-   Cashier/POS
-   Transaction history
-   Transaction detail
-   Daily report
-   Monthly report
-   Basic user roles
-   Receipt printing
-   Search/filter/sort
-   Basic settings

## Out of Scope V1

Jangan implementasikan kecuali diminta secara eksplisit:

-   Akuntansi lengkap
-   Laporan neraca
-   Laporan laba rugi akuntansi formal
-   Hutang/piutang kompleks
-   Purchase Order kompleks
-   Multi-cabang
-   Marketplace
-   Payment gateway
-   Customer mobile app kompleks
-   Loyalty program
-   WhatsApp automation
-   Cloud Functions
-   Firebase Storage
-   OCR
-   AI recommendation
-   Integrasi Cartrack
-   Integrasi perangkat kendaraan
-   Payroll mekanik kompleks

------------------------------------------------------------------------

# 6. User Roles

## Owner

Hak akses:

-   Dashboard
-   Transaksi
-   Produk
-   Stok
-   Jasa
-   Mekanik
-   Riwayat transaksi
-   Laporan
-   User management
-   Settings

## Admin

Hak akses:

-   Dashboard
-   Transaksi
-   Produk
-   Stok
-   Jasa
-   Mekanik
-   Riwayat transaksi
-   Laporan

Tidak boleh mengelola owner.

## Kasir

Hak akses:

-   Dashboard terbatas
-   Kasir
-   Scan barcode
-   Lihat produk
-   Riwayat transaksi sesuai izin
-   Cetak struk

Tidak boleh:

-   Mengubah harga beli
-   Mengubah stok secara manual
-   Menghapus transaksi
-   Mengelola user

## Gudang (opsional)

Hak akses:

-   Produk
-   Stok
-   Stock adjustment
-   Stock opname sederhana
-   Stock movement

Tidak boleh:

-   Mengakses data pembayaran secara penuh
-   Menghapus transaksi

------------------------------------------------------------------------

# 7. Modul Aplikasi

## 7.1 Authentication

Fitur:

-   Login email/password
-   Logout
-   Session persistence
-   Role-based access
-   Forgot password jika diperlukan

User document minimal:

``` text
users/{uid}
```

Field:

``` text
uid
name
email
role
isActive
createdAt
updatedAt
```

Role:

``` text
owner
admin
cashier
warehouse
```

------------------------------------------------------------------------

# 8. Dashboard

Dashboard PC menampilkan:

### KPI

-   Omzet hari ini
-   Jumlah transaksi hari ini
-   Produk terjual hari ini
-   Produk stok menipis
-   Jumlah jasa terjual

### Informasi tambahan

-   Transaksi terbaru
-   Produk terlaris
-   Produk stok menipis
-   Ringkasan omzet 7 hari
-   Ringkasan omzet bulan berjalan

Dashboard tidak boleh melakukan query seluruh collection jika tidak
diperlukan.

Gunakan query terfilter berdasarkan tanggal dan field yang relevan.

------------------------------------------------------------------------

# 9. Product Management

Collection:

``` text
products
```

Struktur:

``` text
products/{productId}
```

Field:

``` text
barcode: string
name: string
categoryId: string
categoryName: string
purchasePrice: number
sellingPrice: number
stock: number
minimumStock: number
unit: string
isActive: boolean
createdAt: timestamp
updatedAt: timestamp
```

## Aturan

-   Barcode harus unik.
-   Harga harus \>= 0.
-   Stock tidak boleh negatif.
-   Product yang pernah digunakan dalam transaksi jangan langsung
    dihapus permanen.
-   Gunakan `isActive = false` untuk menonaktifkan produk.
-   Nama produk wajib diisi.
-   Harga jual wajib diisi.
-   Stock awal dapat diatur saat membuat produk.

------------------------------------------------------------------------

# 10. Category Management

Collection:

``` text
categories
```

Field:

``` text
name
isActive
createdAt
updatedAt
```

Contoh:

``` text
Sparepart
Oli
Ban
Aki
Busi
Accesories
Lainnya
```

------------------------------------------------------------------------

# 11. Barcode

Barcode scanner USB diasumsikan bekerja seperti keyboard.

Flow:

``` text
Scanner
    ↓
Barcode input
    ↓
React POS
    ↓
Cari products.barcode
    ↓
Produk ditemukan
    ↓
Tambah ke cart
```

Jika barcode tidak ditemukan:

``` text
Tampilkan:
"Produk dengan barcode tersebut tidak ditemukan."
```

Opsional:

-   Bunyi sukses
-   Bunyi error
-   Auto focus barcode field
-   Enter otomatis
-   Scan berikutnya tanpa klik mouse

Keyboard shortcut yang disarankan:

``` text
F2  → Fokus barcode
F4  → Pembayaran
ESC → Tutup modal
F8  → Clear cart
```

Shortcut harus dapat dikonfigurasi jika terjadi konflik dengan browser.

------------------------------------------------------------------------

# 12. Service / Jasa

Collection:

``` text
services
```

Field:

``` text
name: string
price: number
description: string
isActive: boolean
createdAt: timestamp
updatedAt: timestamp
```

Contoh:

``` text
Ganti Oli
Service Rem
Tune Up
Ganti Kampas Rem
Service CVT
Service Kelistrikan
```

Jasa tidak mengurangi stock produk.

------------------------------------------------------------------------

# 13. Mechanic

Collection:

``` text
mechanics
```

Field:

``` text
name: string
isActive: boolean
createdAt: timestamp
updatedAt: timestamp
```

Mekanik dapat dipilih saat transaksi servis jika diperlukan.

------------------------------------------------------------------------

# 14. Cashier / POS

## Layout

Desktop POS:

``` text
┌─────────────────────────────────────────────┐
│ Barcode / Search                            │
├────────────────────────┬────────────────────┤
│ Product List            │ Cart               │
│                         │                    │
│ Kampas                  │ Kampas x 1         │
│ Oli                     │ Oli x 2             │
│ Busi                    │                    │
│                         │                    │
├────────────────────────┴────────────────────┤
│ Subtotal                                    │
│ Discount                                    │
│ TOTAL                                       │
│                                             │
│ [Bayar]                                     │
└─────────────────────────────────────────────┘
```

## Cart Item

``` text
type
productId/serviceId
name
price
quantity
subtotal
```

`type`:

``` text
product
service
```

## Transaksi

Field minimal:

``` text
transactionNumber
transactionDate
cashierId
cashierName
items
subtotal
discount
total
payment
change
paymentMethod
status
createdAt
updatedAt
```

Payment method:

``` text
cash
transfer
qris
debit
other
```

Untuk V1 payment method cukup sebagai pencatatan, tanpa integrasi
payment gateway.

------------------------------------------------------------------------

# 15. Transaction Number

Gunakan nomor transaksi yang mudah dibaca manusia.

Contoh:

``` text
TRX-20261005-0001
TRX-20261005-0002
TRX-20261005-0003
```

ID dokumen Firestore boleh tetap menggunakan auto-ID.

Jangan menggunakan transaction number sebagai satu-satunya primary
document ID jika concurrency belum ditangani dengan baik.

------------------------------------------------------------------------

# 16. Stock Management

Stok harus memiliki dua konsep:

1.  Current stock
2.  Stock movement history

## Current stock

Disimpan di:

``` text
products.stock
```

## Stock movement

Collection:

``` text
stock_movements
```

Field:

``` text
productId
productName
type
quantity
stockBefore
stockAfter
referenceType
referenceId
note
userId
userName
createdAt
```

Type:

``` text
in
out
adjustment
return
```

Reference type:

``` text
purchase
sale
service
adjustment
manual
```

Contoh:

``` text
product: Oli Federal
type: out
quantity: 2
stockBefore: 20
stockAfter: 18
referenceType: sale
referenceId: TRX-20261005-0001
```

------------------------------------------------------------------------

# 17. Stock Adjustment

User dengan permission tertentu dapat melakukan:

``` text
Stock sekarang: 10
Stock fisik: 8
Adjustment: -2
```

Sistem harus membuat:

``` text
products.stock = 8
```

dan:

``` text
stock_movements
type = adjustment
quantity = -2
```

Wajib meminta alasan:

``` text
Rusak
Hilang
Stock opname
Salah input
Lainnya
```

------------------------------------------------------------------------

# 18. Transaction + Stock Consistency

Ini bagian paling penting.

Saat transaksi selesai:

``` text
1. Validasi semua produk
2. Validasi stock mencukupi
3. Buat transaction
4. Kurangi stock setiap product
5. Buat stock movement
```

Gunakan Firestore Transaction atau mekanisme atomic/batch yang sesuai.

Jangan melakukan:

``` text
update transaction
await
update stock
await
update movement
```

secara terpisah tanpa strategi consistency.

Tujuannya mencegah:

``` text
Transaksi berhasil
tetapi stok gagal berkurang
```

atau:

``` text
Stok berkurang
tetapi transaksi gagal tersimpan
```

------------------------------------------------------------------------

# 19. Cancel / Void Transaction

V1 boleh memiliki pembatalan transaksi dengan permission owner/admin.

Saat transaksi dibatalkan:

``` text
Transaction status:
completed → cancelled
```

Stock produk harus dikembalikan.

Contoh:

``` text
Sebelum:
stock = 8

Transaksi menjual:
2

Stock:
6

Transaksi dibatalkan:

Stock:
8
```

Buat stock movement:

``` text
type = return
referenceType = transaction_cancel
```

Jangan menghapus transaksi secara permanen.

------------------------------------------------------------------------

# 20. Transaction History

Halaman:

``` text
Riwayat Transaksi
```

Filter:

-   Tanggal
-   Nomor transaksi
-   Kasir
-   Payment method
-   Status

Kolom:

``` text
No Transaksi
Tanggal
Kasir
Item
Subtotal
Discount
Total
Pembayaran
Status
Action
```

Detail transaksi menampilkan semua item.

------------------------------------------------------------------------

# 21. Daily Report

Filter:

``` text
Tanggal
```

Output:

``` text
Total transaksi
Total omzet
Total discount
Total item terjual
Total jasa
Total produk
```

Payment breakdown:

``` text
Cash
Transfer
QRIS
Debit
Other
```

Tambahan:

``` text
Produk terlaris
Jasa terlaris
```

------------------------------------------------------------------------

# 22. Monthly Report

Filter:

``` text
Bulan
Tahun
```

Output:

``` text
Total transaksi
Total omzet
Total discount
Total produk terjual
Total jasa
```

Grafik:

``` text
Omzet per hari
Jumlah transaksi per hari
```

Produk terlaris:

``` text
Product
Quantity sold
Revenue
```

------------------------------------------------------------------------

# 23. Profit / Margin

V1 dapat menyediakan laporan margin sederhana jika purchasePrice
tersedia.

Formula:

``` text
grossProfit =
(sellingPrice - purchasePrice) * quantity
```

Namun:

-   Jangan menyebutnya laba bersih.
-   Belum memperhitungkan listrik, gaji, sewa, operasional, dll.
-   Label UI harus menggunakan istilah seperti `Estimasi Margin Kotor`.

------------------------------------------------------------------------

# 24. Receipt / Print

Target:

-   Thermal printer 58mm
-   Thermal printer 80mm
-   Browser print untuk V1

Struk minimal:

``` text
SRI REJEKI MOTOR
Alamat / kontak

TRX-20261005-0001
05/10/2026 10:20

Oli Federal      2 x 50.000
Kampas Rem       1 x 75.000
Ganti Oli        1 x 15.000

-------------------------
TOTAL              190.000
BAYAR              200.000
KEMBALI             10.000

Kasir: Andhika

Terima kasih
```

Silent printing / local print service bukan requirement V1.

------------------------------------------------------------------------

# 25. Firestore Collections

Struktur V1:

``` text
users
categories
products
services
mechanics
transactions
stock_movements
settings
```

Opsional:

``` text
customers
vehicles
```

Jika bengkel ingin menyimpan identitas pelanggan/kendaraan sejak awal,
tambahkan kedua collection tersebut. Jika tidak, jangan dipaksakan pada
V1.

------------------------------------------------------------------------

# 26. Recommended Firestore Structure

``` text
users/{uid}

categories/{categoryId}

products/{productId}

services/{serviceId}

mechanics/{mechanicId}

transactions/{transactionId}

stock_movements/{movementId}

settings/{settingId}
```

Transaction item disimpan sebagai array di dalam transaction jika jumlah
item per transaksi masih wajar.

Contoh:

``` json
{
  "transactionNumber": "TRX-20261005-0001",
  "transactionDate": "Timestamp",
  "cashierId": "uid123",
  "cashierName": "Kasir",
  "items": [
    {
      "type": "product",
      "productId": "product123",
      "name": "Oli Federal",
      "price": 50000,
      "quantity": 2,
      "subtotal": 100000
    },
    {
      "type": "service",
      "serviceId": "service123",
      "name": "Ganti Oli",
      "price": 15000,
      "quantity": 1,
      "subtotal": 15000
    }
  ],
  "subtotal": 115000,
  "discount": 0,
  "total": 115000,
  "payment": 120000,
  "change": 5000,
  "paymentMethod": "cash",
  "status": "completed"
}
```

------------------------------------------------------------------------

# 27. Data Snapshot pada Transaction

Saat transaksi dibuat, simpan snapshot:

``` text
productId
name
price
quantity
subtotal
```

Jangan hanya menyimpan `productId`.

Alasan:

Jika harga produk berubah bulan depan, transaksi lama harus tetap
menampilkan harga saat transaksi terjadi.

Contoh:

``` text
Harga sekarang: 60.000

Harga transaksi 01/10:
50.000
```

Riwayat tetap harus menampilkan:

``` text
50.000
```

------------------------------------------------------------------------

# 28. Security Rules

Security Rules wajib dibuat sebelum production.

Prinsip:

## Public

Tidak ada collection bisnis yang boleh public.

## Authenticated

Semua data bisnis hanya bisa diakses user authenticated.

## Owner/Admin

Boleh:

-   CRUD product
-   CRUD service
-   CRUD mechanic
-   Stock adjustment
-   View reports
-   View transactions

## Cashier

Boleh:

-   Read products
-   Read services
-   Create transaction
-   Read transaksi sesuai permission
-   Tidak boleh mengubah stock langsung
-   Tidak boleh mengubah purchasePrice
-   Tidak boleh menghapus transaction

## Warehouse

Boleh:

-   Read/write inventory sesuai izin
-   Stock adjustment

------------------------------------------------------------------------

# 29. Tidak Menggunakan Cloud Functions pada V1

Jangan menambahkan Cloud Functions hanya karena tersedia.

Semua kebutuhan V1 diusahakan dilakukan dengan:

-   Firestore SDK
-   Firestore Transaction
-   Batch Write
-   Security Rules
-   Client-side calculation untuk UI

Cloud Functions baru dipertimbangkan jika ada:

-   automation server-side
-   scheduled jobs
-   external API/webhook
-   notification server-side
-   logic yang memang tidak aman dilakukan client

------------------------------------------------------------------------

# 30. Offline Consideration

Aplikasi POS idealnya tidak langsung bergantung penuh pada internet.

V1 dapat memanfaatkan Firestore offline persistence jika sesuai dengan
target browser/platform.

Namun:

-   Jangan mengklaim POS fully offline sebelum diuji.
-   Transaksi offline + concurrent stock update harus diuji secara
    khusus.
-   Jika requirement berubah menjadi "kasir wajib tetap berjalan
    walaupun internet mati", arsitektur local-first dengan SQLite/local
    database perlu dipertimbangkan.

Untuk V1 awal, target utama adalah online-connected POS.

------------------------------------------------------------------------

# 31. Performance

Jangan membaca seluruh collection setiap membuka halaman.

Hindari:

``` text
get all transactions
get all products
```

Gunakan:

-   pagination
-   limit
-   where
-   orderBy
-   date range
-   search strategy yang sesuai

Contoh:

``` text
transactions
where transactionDate >= start
where transactionDate < end
orderBy transactionDate desc
limit 50
```

Untuk laporan besar, jangan melakukan perhitungan berat dengan membaca
ribuan dokumen setiap kali dashboard dibuka.

Jika data sudah besar, tambahkan aggregation/summary strategy pada fase
berikutnya.

------------------------------------------------------------------------

# 32. Index

AI agent wajib membuat index Firestore sesuai query aktual.

Jangan membuat index secara acak.

Index dibuat setelah query kebutuhan halaman ditentukan.

Contoh kombinasi potensial:

``` text
transactions:
status + transactionDate
cashierId + transactionDate
paymentMethod + transactionDate
```

Sesuaikan dengan query nyata dan index yang diminta Firestore.

------------------------------------------------------------------------

# 33. UI/UX

Tema:

-   Profesional
-   Modern
-   Cepat
-   Fokus desktop
-   Tidak terlalu banyak animasi
-   Cocok untuk penggunaan kasir berjam-jam

Prioritas:

1.  Kecepatan transaksi
2.  Readability
3.  Keyboard usability
4.  Barcode scanning
5.  Minimal klik
6.  Feedback jelas
7.  Error handling jelas

Warna status:

``` text
Success → transaksi berhasil
Warning → stok menipis
Danger → stok habis / error
Info → informasi
```

Jangan menggunakan warna berlebihan.

------------------------------------------------------------------------

# 34. Error Handling

Contoh error:

### Barcode tidak ditemukan

``` text
Barcode 899123456789 tidak ditemukan.
```

### Stok tidak cukup

``` text
Stok Oli Federal hanya tersisa 1.
Jumlah yang diminta: 3.
```

### Transaksi gagal

``` text
Transaksi gagal disimpan.
Data belum diubah.
Silakan coba lagi.
```

### Internet bermasalah

``` text
Koneksi ke server bermasalah.
Transaksi belum dikonfirmasi.
Jangan melakukan pembayaran ulang sebelum status diperiksa.
```

------------------------------------------------------------------------

# 35. Auditability

Walaupun belum membuat modul audit log penuh, minimal transaksi dan
stock movement harus menyimpan:

``` text
userId
userName
createdAt
```

Untuk stock adjustment wajib menyimpan:

``` text
note/reason
```

Tujuannya agar perubahan stok dapat ditelusuri.

------------------------------------------------------------------------

# 36. Acceptance Criteria Utama

## Product

-   [ ] Bisa membuat produk
-   [ ] Bisa edit produk
-   [ ] Bisa menonaktifkan produk
-   [ ] Barcode unik
-   [ ] Harga tersimpan sebagai number
-   [ ] Stock tersimpan sebagai number

## Barcode

-   [ ] Scanner USB dapat memasukkan barcode
-   [ ] Produk otomatis ditemukan
-   [ ] Produk otomatis masuk cart
-   [ ] Barcode tidak dikenal menghasilkan error yang jelas

## POS

-   [ ] Bisa menambahkan product
-   [ ] Bisa menambahkan service
-   [ ] Bisa mengubah quantity
-   [ ] Bisa menghapus item
-   [ ] Bisa memberikan discount
-   [ ] Bisa memilih payment method
-   [ ] Bisa menghitung total
-   [ ] Bisa menghitung kembalian
-   [ ] Bisa menyimpan transaksi
-   [ ] Bisa mencetak struk

## Stock

-   [ ] Stock berkurang ketika transaksi berhasil
-   [ ] Stock tidak berkurang jika transaksi gagal
-   [ ] Stock tidak boleh negatif
-   [ ] Stock movement tercatat
-   [ ] Stock adjustment tercatat
-   [ ] Pembatalan transaksi mengembalikan stock

## History

-   [ ] Riwayat transaksi dapat dilihat
-   [ ] Filter tanggal
-   [ ] Detail transaksi
-   [ ] Status transaksi
-   [ ] Data transaksi lama tidak berubah ketika harga produk berubah

## Reports

-   [ ] Daily report
-   [ ] Monthly report
-   [ ] Total transaction
-   [ ] Total revenue
-   [ ] Payment breakdown
-   [ ] Top products
-   [ ] Top services
-   [ ] Estimasi gross margin jika purchasePrice tersedia

------------------------------------------------------------------------

# 37. Development Phases

## Phase 0 --- Project Setup

-   [ ] Setup repository
-   [ ] Setup React + TypeScript + Vite
-   [ ] Setup Tailwind
-   [ ] Setup shadcn/ui
-   [ ] Setup Firebase
-   [ ] Setup environment variables
-   [ ] Setup Firebase Auth
-   [ ] Setup Firestore
-   [ ] Setup routing
-   [ ] Setup base layout

## Phase 1 --- Authentication & User

-   [ ] Login
-   [ ] Logout
-   [ ] User profile
-   [ ] Role
-   [ ] Protected route
-   [ ] Security Rules

## Phase 2 --- Master Data

-   [ ] Category
-   [ ] Product
-   [ ] Service
-   [ ] Mechanic
-   [ ] Product barcode
-   [ ] Product stock

## Phase 3 --- POS

-   [ ] Product search
-   [ ] Barcode scan
-   [ ] Cart
-   [ ] Quantity
-   [ ] Discount
-   [ ] Payment
-   [ ] Change
-   [ ] Save transaction
-   [ ] Stock update
-   [ ] Stock movement
-   [ ] Receipt

## Phase 4 --- History

-   [ ] Transaction list
-   [ ] Filter
-   [ ] Detail
-   [ ] Cancel transaction
-   [ ] Restore stock

## Phase 5 --- Reports

-   [ ] Daily report
-   [ ] Monthly report
-   [ ] Payment breakdown
-   [ ] Top products
-   [ ] Top services
-   [ ] Gross margin

## Phase 6 --- Dashboard

-   [ ] KPI cards
-   [ ] Revenue chart
-   [ ] Recent transactions
-   [ ] Low stock
-   [ ] Top products

## Phase 7 --- Hardening

-   [ ] Security Rules
-   [ ] Permission test
-   [ ] Transaction consistency test
-   [ ] Concurrent transaction test
-   [ ] Barcode test
-   [ ] Print test
-   [ ] Error handling
-   [ ] Performance optimization

------------------------------------------------------------------------

# 38. Testing Scenarios

AI agent wajib menguji minimal:

## Normal transaction

``` text
Stock = 10
Buy = 2
Expected stock = 8
```

## Multiple products

``` text
Product A x 2
Product B x 3
Service C x 1
```

Semua harus masuk dalam satu transaction.

## Insufficient stock

``` text
Stock = 1
Buy = 2
Expected:
transaction rejected
stock remains 1
```

## Cancel

``` text
Stock = 10
Sell 2
Stock = 8
Cancel
Stock = 10
```

## Price change

``` text
Transaction A price = 50.000
Product price changed to 60.000
Transaction A must remain 50.000
```

## Concurrent transaction

Simulasikan dua kasir menjual produk yang sama secara bersamaan.

Expected:

``` text
stock tidak boleh menjadi negatif
```

## Failed transaction

Jika penyimpanan transaction gagal:

``` text
stock tidak boleh terpotong sebagian
```

------------------------------------------------------------------------

# 39. Coding Rules untuk AI Agent

AI Agent wajib:

1.  Jangan membuat fitur di luar scope tanpa instruksi.
2.  Jangan menambahkan Cloud Functions pada V1.
3.  Jangan menambahkan Firebase Storage pada V1.
4.  Jangan menggunakan Base64 untuk gambar.
5.  Jangan membuat backend custom.
6.  Gunakan TypeScript strict.
7.  Gunakan reusable components.
8.  Hindari duplikasi logic.
9.  Jangan hardcode Firebase credentials.
10. Gunakan environment variables.
11. Jangan menyimpan API secret di frontend.
12. Gunakan Firestore Security Rules.
13. Jangan menghapus transaction secara permanen.
14. Gunakan status untuk transaction lifecycle.
15. Jangan mengubah historical transaction ketika master product
    berubah.
16. Gunakan number untuk harga dan quantity, bukan string.
17. Gunakan Firestore Timestamp untuk tanggal.
18. Semua operasi stok harus dapat dilacak melalui stock_movements.
19. Jangan mempercayai total yang dikirim client tanpa validasi.
20. Setelah setiap fitur selesai, jalankan lint/build/test yang relevan.

------------------------------------------------------------------------

# 40. Struktur Folder React yang Direkomendasikan

``` text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── common/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── categories/
│   ├── services/
│   ├── mechanics/
│   ├── pos/
│   ├── transactions/
│   ├── inventory/
│   ├── reports/
│   └── users/
│
├── lib/
│   ├── firebase/
│   ├── firestore/
│   ├── utils/
│   └── validations/
│
├── hooks/
├── types/
├── constants/
└── main.tsx
```

Feature-based architecture lebih diutamakan daripada folder berdasarkan
jenis file semata.

------------------------------------------------------------------------

# 41. Suggested Firestore Service Layer

Jangan memanggil Firestore secara acak dari setiap component.

Gunakan service/repository layer:

``` text
src/lib/firestore/
├── products.ts
├── transactions.ts
├── stock.ts
├── services.ts
├── mechanics.ts
└── users.ts
```

Contoh konsep:

``` text
productService.getByBarcode()
productService.create()
productService.update()
productService.deactivate()

transactionService.create()
transactionService.getById()
transactionService.cancel()

stockService.adjust()
stockService.getMovements()
```

Business logic transaksi harus berada pada layer yang terkontrol, bukan
tersebar di banyak component.

------------------------------------------------------------------------

# 42. Environment

Jangan commit secret ke Git.

Gunakan:

``` text
.env
.env.example
```

Firebase web configuration dapat berada di environment frontend sesuai
pola Firebase Web SDK, tetapi jangan pernah memasukkan private
service-account credential ke aplikasi React.

------------------------------------------------------------------------

# 43. Definition of Done

Sebuah fitur dianggap selesai jika:

-   UI selesai
-   Loading state tersedia
-   Empty state tersedia
-   Error state tersedia
-   Validation tersedia
-   Firebase integration selesai
-   Security Rules sudah dipertimbangkan
-   Permission sudah diuji
-   Data type konsisten
-   Tidak ada TypeScript error
-   Tidak ada lint error
-   Build berhasil
-   Flow utama berhasil diuji

------------------------------------------------------------------------

# 44. Prioritas MVP

Jika waktu terbatas, prioritaskan:

### P0 --- Wajib

1.  Login
2.  Product
3.  Barcode
4.  Stock
5.  POS
6.  Transaction
7.  Stock movement
8.  Transaction history
9.  Daily report
10. Monthly report

### P1 --- Penting

11. Service
12. Mechanic
13. Receipt printing
14. User roles
15. Dashboard
16. Cancel transaction
17. Stock adjustment

### P2 --- Nanti

18. Customer
19. Vehicle
20. Advanced analytics
21. Mobile owner
22. Notifications
23. Scheduled reports

------------------------------------------------------------------------

# 45. Final Architecture Decision

Untuk V1 gunakan:

``` text
React + TypeScript + Vite
        │
        ▼
Firebase Web SDK
        │
        ├── Firebase Authentication
        │
        └── Cloud Firestore
                 │
                 ├── users
                 ├── categories
                 ├── products
                 ├── services
                 ├── mechanics
                 ├── transactions
                 ├── stock_movements
                 └── settings
```

Mobile:

``` text
Flutter
   │
   ▼
Firebase SDK
   │
   ▼
Firestore
```

Tidak menggunakan:

``` text
Laravel
PostgreSQL
VPS
Cloud Functions
Firebase Storage
Base64 image storage
Custom backend
```

pada V1.

------------------------------------------------------------------------

# 46. Instruksi Awal untuk AI Agent

Gunakan PRD ini sebagai source of truth.

Sebelum coding:

1.  Baca seluruh PRD.
2.  Jangan langsung membuat seluruh fitur sekaligus.
3.  Analisis struktur project terlebih dahulu.
4.  Buat implementation plan berdasarkan Phase 0 → Phase 7.
5.  Mulai dari Phase 0.
6.  Setelah setiap phase selesai, pastikan build tetap berhasil.
7.  Jangan mengubah arsitektur tanpa alasan teknis yang jelas.
8.  Jika menemukan requirement yang ambigu, berhenti dan tanyakan
    sebelum membuat asumsi yang memengaruhi database atau business
    logic.
9.  Prioritaskan data consistency, security, dan maintainability.
10. Jangan menambahkan dependency besar jika kebutuhan dapat
    diselesaikan dengan dependency yang sudah ada.

## Prinsip utama

> **Sederhana tetapi rapi.**

Aplikasi tidak perlu dibuat enterprise-level pada V1. Fokus pada kasir
yang cepat, stok yang akurat, transaksi yang dapat dilacak, laporan yang
benar, dan struktur database yang masih dapat dikembangkan di masa
depan.
