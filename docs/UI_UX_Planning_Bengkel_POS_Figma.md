# UI/UX Planning --- SMM Motor POS

**Project:** Sistem Kasir & Inventory Bengkel\
**Design target:** Figma → React Web POS + Flutter Mobile\
**Version:** 1.0\
**Status:** Design Planning / Ready for Figma

------------------------------------------------------------------------

# 1. Design Direction

## Visual Concept

> **Modern Workshop POS --- Clean, Professional, Fast**

Karakter visual:

-   Modern
-   Professional
-   Clean
-   Compact
-   High readability
-   Desktop-first
-   Data-oriented
-   Fast interaction
-   Tidak terlalu banyak animasi
-   Cocok digunakan kasir selama berjam-jam

Aplikasi bukan dashboard corporate yang kaku dan bukan pula aplikasi
marketplace yang terlalu ramai.

## Visual Recommendation

Gunakan:

-   Light mode sebagai default
-   Dark sidebar
-   Orange/amber sebagai accent
-   White surface
-   Soft gray background
-   Subtle border
-   Moderate border radius

Konsep:

``` text
Dark Sidebar
      +
White Content
      +
Orange Accent
      +
Neutral Gray
```

------------------------------------------------------------------------

# 2. Target Device

## Desktop --- Primary

Main Figma frame:

``` text
1440 × 900
```

Additional testing:

``` text
1366 × 768
1280 × 720
```

Alasan:

PC kasir belum tentu menggunakan monitor besar. Layout harus tetap
nyaman pada resolusi 1280×720.

## Mobile --- Secondary

Mobile digunakan untuk owner/admin monitoring.

Target:

-   Android
-   Flutter

Jangan memaksakan layout desktop menjadi mobile responsive 1:1. Mobile
memiliki information architecture yang lebih sederhana.

------------------------------------------------------------------------

# 3. Global Layout

Desktop:

``` text
┌───────────────┬───────────────────────────────────────────┐
│               │ Header                                    │
│               ├───────────────────────────────────────────┤
│   SIDEBAR     │                                           │
│   240px       │              MAIN CONTENT                 │
│               │                                           │
│               │                                           │
└───────────────┴───────────────────────────────────────────┘
```

Recommended dimensions:

``` text
Sidebar       240px
Header         64px
Content pad    24px
```

Gunakan max-width content jika diperlukan, tetapi halaman POS harus
memanfaatkan ruang horizontal semaksimal mungkin.

------------------------------------------------------------------------

# 4. Sidebar

## Header

``` text
🏍️
Sri Rejeki Motor
POS
```

## Navigation

### Overview

``` text
Dashboard
Kasir
```

### Management

``` text
Produk
Stok
Jasa
Mekanik
```

### Transaction

``` text
Riwayat Transaksi
```

### Report

``` text
Laporan
```

### System

``` text
Pengguna
Pengaturan
```

## User Section

Bottom sidebar:

``` text
┌────────────────────────┐
│ 👤 Andhika             │
│    Administrator       │
│                    ⋮   │
└────────────────────────┘
```

Menu user:

``` text
Profile
Logout
```

------------------------------------------------------------------------

# 5. Header

Header minimal:

``` text
Page Title / Breadcrumb

                              🔔
                         User Avatar ▾
```

Jangan memenuhi header dengan terlalu banyak informasi.

Untuk halaman POS, header dapat dibuat lebih khusus agar area kasir
lebih luas.

------------------------------------------------------------------------

# 6. Dashboard

## Header

``` text
Dashboard

Selamat datang kembali, Andhika.

[ Hari ini ▾ ]
```

## KPI Cards

Empat kartu utama:

``` text
┌────────────────┐ ┌────────────────┐
│ Omzet Hari Ini │ │ Transaksi      │
│                │ │                │
│ Rp 3.250.000   │ │ 42             │
│ ↑ 12.5%        │ │ ↑ 8 transaksi  │
└────────────────┘ └────────────────┘

┌────────────────┐ ┌────────────────┐
│ Produk Terjual │ │ Stok Menipis   │
│                │ │                │
│ 126            │ │ 8 produk       │
│                │ │ Lihat Produk → │
└────────────────┘ └────────────────┘
```

## Sales Chart

``` text
┌───────────────────────────────────────┐
│ Ringkasan Penjualan                   │
│                                       │
│ Rp                                     │
│ │              ╭──╮                   │
│ │        ╭─────╯  ╰──╮                │
│ │   ╭────╯            ╰──             │
│ └────────────────────────────         │
│   Sen  Sel  Rab  Kam  Jum  Sab        │
│                                       │
│ [7 Hari] [30 Hari] [Bulan]            │
└───────────────────────────────────────┘
```

## Best Selling Products

``` text
┌──────────────────────────┐
│ Produk Terlaris          │
├──────────────────────────┤
│ 01 Oli Federal      42   │
│ 02 Kampas Rem       31   │
│ 03 Busi              27  │
│ 04 ...                  │
└──────────────────────────┘
```

## Low Stock

``` text
┌──────────────────────────────────────────────┐
│ ⚠ Stok Menipis                     Lihat Semua│
├──────────────────────────────────────────────┤
│ Produk             Stock       Minimum       │
│ Oli Federal          2             5         │
│ Kampas Rem           1             3         │
│ Busi NGK             0             5         │
└──────────────────────────────────────────────┘
```

Status:

``` text
Stock > minimum  → Normal
Stock <= minimum → Warning
Stock = 0        → Critical
```

------------------------------------------------------------------------

# 7. ⭐ POS / KASIR

POS adalah halaman paling penting dalam aplikasi.

Prioritas UX:

1.  Cepat
2.  Sedikit klik
3.  Keyboard-friendly
4.  Barcode-first
5.  Cart selalu terlihat
6.  Total pembayaran mudah ditemukan
7.  Error mudah dipahami

## Main Layout

``` text
┌─────────────────────────────────────────────────────────────┐
│ Kasir                                    TRX-20261005-001   │
├───────────────────────────────────┬─────────────────────────┤
│                                   │ Keranjang               │
│ 🔍 Scan barcode / cari produk     │                         │
│                                   │ ─────────────────────── │
├───────────────────────────────────┤                         │
│                                   │ Oli Federal             │
│ Produk                            │ 2 × Rp50.000            │
│                                   │ Rp100.000               │
│ ┌────────┐ ┌────────┐ ┌────────┐ │                         │
│ │ Oli    │ │ Busi   │ │ Kampas │ │ Kampas Rem              │
│ │50.000  │ │25.000  │ │75.000  │ │ 1 × Rp75.000            │
│ └────────┘ └────────┘ └────────┘ │ Rp75.000                │
│                                   │                         │
│ ┌────────┐ ┌────────┐ ┌────────┐ │                         │
│ │ ...    │ │ ...    │ │ ...    │ │                         │
│                                   ├─────────────────────────┤
│                                   │ Subtotal   Rp175.000    │
│                                   │ Diskon       Rp10.000    │
│                                   │ ─────────────────────── │
│                                   │ TOTAL      Rp165.000    │
│                                   │                         │
│                                   │ [     BAYAR     ]       │
└───────────────────────────────────┴─────────────────────────┘
```

## Barcode Input

``` text
┌────────────────────────────────────────────┐
│ 🔎  Scan barcode atau cari produk...       │
└────────────────────────────────────────────┘

          Scanner siap ●
```

Barcode scanner USB diasumsikan bertindak sebagai keyboard.

Flow:

``` text
Scan
 ↓
Cari product
 ↓
Produk ditemukan
 ↓
Tambah cart
 ↓
Scanner siap scan berikutnya
```

Jangan membuka modal untuk setiap scan.

Jika barcode tidak ditemukan:

``` text
Barcode 899123456789 tidak ditemukan.
```

## Keyboard Shortcut

Recommended:

``` text
F2  → Fokus barcode
F4  → Pembayaran
ESC → Tutup modal
F8  → Clear cart
```

Shortcut harus diuji agar tidak konflik dengan browser.

------------------------------------------------------------------------

# 8. Product Card

Karena versi awal tidak membutuhkan gambar produk, jangan memaksakan
image card.

Gunakan icon kategori / initial.

``` text
┌──────────────────┐
│       🛢️         │
│                  │
│ Oli Federal      │
│ Rp50.000         │
│ Stock: 12        │
└──────────────────┘
```

Card harus compact agar banyak produk dapat terlihat sekaligus.

------------------------------------------------------------------------

# 9. Cart Item

``` text
┌─────────────────────────────────────┐
│ Oli Federal                     🗑  │
│ Rp50.000                            │
│                                     │
│ [ − ]  2  [ + ]        Rp100.000   │
└─────────────────────────────────────┘
```

Quantity harus dapat diubah dengan:

-   Plus
-   Minus
-   Keyboard jika memungkinkan
-   Direct input jika diperlukan

------------------------------------------------------------------------

# 10. Payment Modal

``` text
┌────────────────────────────────────────┐
│ Pembayaran                       ×     │
├────────────────────────────────────────┤
│                                        │
│ Total Pembayaran                       │
│                                        │
│ Rp 165.000                             │
│                                        │
│ Metode Pembayaran                      │
│                                        │
│ [ Cash ] [ QRIS ] [ Transfer ] [ Debit]│
│                                        │
│ Jumlah Dibayar                         │
│ ┌────────────────────────────────────┐ │
│ │ Rp 200.000                         │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Kembalian                              │
│ Rp 35.000                              │
│                                        │
│ [       PROSES TRANSAKSI       ]       │
└────────────────────────────────────────┘
```

Total harus menjadi visual paling dominan.

------------------------------------------------------------------------

# 11. Transaction Success

``` text
┌────────────────────────────────┐
│          ✓                     │
│   Transaksi Berhasil           │
│                                │
│   TRX-20261005-0001            │
│                                │
│   Total                        │
│   Rp165.000                    │
│                                │
│ [ Cetak Struk ]                │
│ [ Transaksi Baru ]             │
└────────────────────────────────┘
```

Default focus:

``` text
Transaksi Baru
```

Agar kasir dapat langsung melanjutkan transaksi.

------------------------------------------------------------------------

# 12. Product Management

## Header

``` text
Produk

Kelola produk dan harga sparepart

[ Import ] [ + Tambah Produk ]
```

## Toolbar

``` text
🔍 Cari produk...

[Kategori ▾] [Status ▾] [Sort ▾]
```

## Product Table

``` text
┌────────────────────────────────────────────────────────────┐
│ Barcode       Produk       Kategori   Harga    Stock       │
├────────────────────────────────────────────────────────────┤
│ 899123...     Oli Federal  Oli        50.000   12         │
│ 899456...     Busi NGK     Busi       25.000   4 ⚠        │
│ 899789...     Kampas Rem  Sparepart  75.000   0 🔴        │
└────────────────────────────────────────────────────────────┘
```

Action menu:

``` text
Detail
Edit
Atur Stok
Nonaktifkan
```

------------------------------------------------------------------------

# 13. Add Product

Gunakan drawer atau modal lebar.

``` text
Tambah Produk

Nama Produk *
[________________________]

Barcode *
[________________________] [Scan]

Kategori *
[ Pilih kategori ▾ ]

Harga Beli
[ Rp ______________ ]

Harga Jual *
[ Rp ______________ ]

Stock Awal
[ ______ ]

Minimum Stock
[ ______ ]

Satuan
[ pcs ▾ ]

[ Batal ] [ Simpan Produk ]
```

------------------------------------------------------------------------

# 14. Product Detail

``` text
Produk / Oli Federal

[ Edit ]

Barcode
899123456789

Kategori
Oli

Harga Beli
Rp40.000

Harga Jual
Rp50.000

Stock
12 pcs

Minimum
5 pcs
```

## Stock History

``` text
Riwayat Stok

Tanggal       Aktivitas       Qty       Stock
05/10         Penjualan       -2        12
04/10         Stock In        +10       14
03/10         Adjustment      -1        4
```

------------------------------------------------------------------------

# 15. Stock Management

Stock harus memiliki halaman tersendiri.

Header:

``` text
Stok

Pantau dan kelola persediaan

[ + Stock In ] [ Stock Adjustment ]
```

## KPI

``` text
Total Produk
156

Stock Menipis
12

Stock Habis
4

Total Item
1.284
```

## Inventory Table

Fokus pada:

-   Product
-   Current stock
-   Minimum stock
-   Status
-   Last movement
-   Action

------------------------------------------------------------------------

# 16. Stock Adjustment

``` text
Penyesuaian Stok

Produk
[ Oli Federal ▾ ]

Stock Sistem
12

Stock Fisik
10

Selisih
-2

Alasan
[ Stock Opname ▾ ]

Catatan
[________________________]

[ Batal ] [ Simpan Adjustment ]
```

Wajib meminta alasan.

------------------------------------------------------------------------

# 17. Services

``` text
Jasa

[ + Tambah Jasa ]

Nama Jasa              Harga       Status
Ganti Oli              15.000      Aktif
Service Rem            30.000      Aktif
Tune Up                 75.000      Aktif
```

Form:

``` text
Nama Jasa *
Harga *
Deskripsi
Status
```

Jasa tidak mengurangi stock produk.

------------------------------------------------------------------------

# 18. Mechanics

``` text
Mekanik

[ + Tambah Mekanik ]

┌──────────────────────────────────────┐
│ 👤 Lukman                 ● Aktif   │
│                                      │
│ Total servis bulan ini: 34          │
└──────────────────────────────────────┘
```

Versi awal tidak perlu statistik mekanik kompleks.

------------------------------------------------------------------------

# 19. Transaction History

Header:

``` text
Riwayat Transaksi

Semua transaksi bengkel

[🔍 Cari nomor transaksi ]

[Tanggal ▾]
[Kasir ▾]
[Metode ▾]
[Status ▾]
```

Table:

``` text
┌────────────────────────────────────────────────────────────┐
│ No Transaksi   Tanggal       Kasir    Total       Status   │
├────────────────────────────────────────────────────────────┤
│ TRX-0001       05 Oct 10:20  Andhika  165.000     Selesai  │
│ TRX-0002       05 Oct 10:42  Budi     220.000     Selesai  │
│ TRX-0003       05 Oct 11:05  Andhika  75.000      Batal    │
└────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 20. Transaction Detail

``` text
Transaction Detail

TRX-20261005-0001
05 Oktober 2026, 10:20
Kasir: Andhika
Status: Selesai
```

Items:

``` text
Produk              Qty       Harga       Total
Oli Federal          2        50.000      100.000
Kampas Rem           1        75.000       75.000
Ganti Oli            1        15.000       15.000
```

Summary:

``` text
Subtotal       Rp190.000
Diskon          Rp25.000
────────────────────────
Total          Rp165.000

Bayar          Rp200.000
Kembali         Rp35.000
```

Actions:

``` text
[ Cetak ]
[ Batalkan Transaksi ]
```

Confirmation dialog untuk cancel:

``` text
Batalkan transaksi?

Transaksi TRX-20261005-001
senilai Rp165.000 akan dibatalkan.

Stok produk akan dikembalikan.

[ Jangan Batalkan ] [ Ya, Batalkan ]
```

------------------------------------------------------------------------

# 21. Reports

Gunakan satu halaman laporan dengan tab.

``` text
Laporan

[ Overview ] [ Penjualan ] [ Produk ] [ Stok ]
```

## Overview

``` text
Laporan Penjualan

[ 05 Oktober 2026 ▾ ]
```

KPI:

``` text
Omzet
Rp3.250.000

Transaksi
42

Produk Terjual
126

Estimasi Margin
Rp850.000
```

Chart:

``` text
Omzet Harian
```

Payment breakdown:

``` text
Cash       Rp1.200.000
QRIS       Rp1.450.000
Transfer     Rp600.000
```

## Product Report

``` text
Ranking   Produk           Qty       Revenue

01        Oli Federal      42        2.100.000
02        Kampas Rem       31        1.550.000
03        Busi NGK         27          675.000
```

## Stock Report

``` text
Produk             Stock    Minimum
Oli Federal          2         5
Kampas Rem           1         3
Busi                 0         5
```

------------------------------------------------------------------------

# 22. Users

Owner view:

``` text
Pengguna

[ + Tambah Pengguna ]

Nama        Email              Role       Status
Andhika     ...                Owner      Aktif
Budi        ...                Kasir      Aktif
Dimas       ...                Gudang     Aktif
```

Role badge harus mudah dibedakan.

------------------------------------------------------------------------

# 23. Settings

Gunakan tab:

``` text
Umum
Toko
Struk
Pembayaran
```

## Toko

``` text
Nama Bengkel
Alamat
Nomor Telepon
```

## Struk

``` text
Header
Footer
Ukuran kertas
```

## Pembayaran

``` text
Cash
QRIS
Transfer
Debit
```

Jangan membuat halaman settings terlalu kompleks pada V1.

------------------------------------------------------------------------

# 24. Design System

Figma pages:

``` text
00 — Cover
01 — Design Principles
02 — Foundations
03 — Colors
04 — Typography
05 — Icons
06 — Components
07 — Patterns
08 — Desktop Pages
09 — Mobile Pages
10 — Prototype
```

------------------------------------------------------------------------

# 25. Color Tokens

Recommended starting palette:

``` text
Background     #F8FAFC
Surface        #FFFFFF
Text           #111827
Muted          #64748B
Border         #E2E8F0
Primary        #F59E0B
Success        #22C55E
Warning        #F59E0B
Danger         #EF4444
Sidebar        #111827
```

Orange/amber hanya sebagai accent, jangan memenuhi seluruh UI.

------------------------------------------------------------------------

# 26. Typography

Recommended:

> Inter

Hierarchy:

``` text
Display       32px
Heading 1     24px
Heading 2     20px
Heading 3     18px
Body          14px
Small         12px
```

POS total:

``` text
28–32px
Font weight: 700
```

------------------------------------------------------------------------

# 27. Spacing

Gunakan spacing scale konsisten:

``` text
4px
8px
12px
16px
20px
24px
32px
40px
48px
```

Jangan membuat spacing random.

------------------------------------------------------------------------

# 28. Border Radius

Recommended:

``` text
Card       12px
Input       8px
Button      8px
Modal      16px
Badge      999px
```

Hindari rounded berlebihan.

------------------------------------------------------------------------

# 29. Buttons

## Primary

``` text
[ + Tambah Produk ]
```

## Secondary

``` text
[ Export ]
```

## Destructive

``` text
[ Batalkan Transaksi ]
```

## Ghost

``` text
[ Batal ]
```

## POS Primary

Button pembayaran harus paling dominan:

``` text
┌──────────────────────────┐
│       BAYAR              │
│      Rp165.000           │
└──────────────────────────┘
```

------------------------------------------------------------------------

# 30. Tables

Table adalah komponen utama aplikasi.

Recommended:

``` text
Row height: 52–56px
Header: 12px / 600
Body: 13–14px
```

Action menggunakan:

``` text
⋮
```

Hover row menggunakan subtle background.

------------------------------------------------------------------------

# 31. Badges

Status:

``` text
● Aktif
● Nonaktif
● Selesai
● Dibatalkan
● Stok Menipis
● Habis
```

Gunakan badge dengan warna soft, bukan warna solid yang terlalu kuat.

------------------------------------------------------------------------

# 32. Empty State

Jangan hanya:

``` text
No data
```

Gunakan:

``` text
           📦

       Belum ada produk

Tambahkan produk pertama untuk mulai
mengelola inventory bengkel.

       [+ Tambah Produk]
```

------------------------------------------------------------------------

# 33. Loading State

Gunakan skeleton untuk loading tabel/card.

Hindari spinner besar di tengah halaman untuk setiap request kecil.

------------------------------------------------------------------------

# 34. Confirmation Dialog

Action yang memengaruhi data harus memiliki confirmation.

Contoh:

``` text
Hapus / nonaktifkan produk?

Produk tidak akan muncul pada kasir
setelah dinonaktifkan.

[ Batal ] [ Nonaktifkan ]
```

Untuk cancel transaction, jelaskan dampaknya terhadap stock.

------------------------------------------------------------------------

# 35. Mobile Flutter

Mobile tidak perlu meniru desktop.

Fokus:

``` text
Dashboard
Transaksi
Stok
Produk
Laporan
```

Contoh:

``` text
┌──────────────────────┐
│ Sri Rejeki Motor     │
│ Selamat datang       │
├──────────────────────┤
│ Omzet Hari Ini       │
│ Rp3.250.000          │
├──────────────────────┤
│ Transaksi             │
│ 42                   │
├──────────────────────┤
│ Stok Menipis          │
│ 8 Produk             │
├──────────────────────┤
│ Transaksi Terbaru     │
│                      │
└──────────────────────┘

   🏠     📦     🧾     ⋯
```

Mobile lebih fokus pada monitoring owner daripada operasional kasir.

------------------------------------------------------------------------

# 36. Figma Component Checklist

Buat komponen berikut sebelum membuat semua halaman:

## Basic

-   [ ] Button
-   [ ] Input
-   [ ] Select
-   [ ] Date Picker
-   [ ] Search Input
-   [ ] Badge
-   [ ] Avatar
-   [ ] Dropdown
-   [ ] Tooltip

## Layout

-   [ ] Sidebar
-   [ ] Header
-   [ ] Card
-   [ ] Stat Card
-   [ ] Modal
-   [ ] Drawer
-   [ ] Tabs

## Feedback

-   [ ] Toast
-   [ ] Alert
-   [ ] Confirmation Dialog
-   [ ] Skeleton
-   [ ] Empty State
-   [ ] Error State

## Data

-   [ ] Table
-   [ ] Pagination
-   [ ] Filter Bar
-   [ ] Sort Control

## POS

-   [ ] Barcode Input
-   [ ] Product Card
-   [ ] Cart Item
-   [ ] Cart Summary
-   [ ] Payment Modal
-   [ ] Transaction Success
-   [ ] Receipt Preview

------------------------------------------------------------------------

# 37. Prototype Flow

## Flow 1 --- Kasir

``` text
Dashboard
 ↓
Kasir
 ↓
Scan Barcode
 ↓
Product masuk Cart
 ↓
Tambah item
 ↓
Bayar
 ↓
Payment Modal
 ↓
Success
 ↓
Print
 ↓
New Transaction
```

## Flow 2 --- Product

``` text
Produk
 ↓
Tambah Produk
 ↓
Input
 ↓
Simpan
 ↓
Product Detail
```

## Flow 3 --- Stock

``` text
Stok
 ↓
Adjustment
 ↓
Pilih Produk
 ↓
Input Stock Fisik
 ↓
Reason
 ↓
Confirm
 ↓
Success
```

## Flow 4 --- Transaction

``` text
Riwayat
 ↓
Filter
 ↓
Transaction Detail
 ↓
Print / Cancel
```

------------------------------------------------------------------------

# 38. Figma File Structure

``` text
📁 SRI REJEKI MOTOR POS

├── 00 Cover
│
├── 01 Design Principles
│
├── 02 Foundations
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Radius
│   └── Shadows
│
├── 03 Icons
│
├── 04 Components
│   ├── Buttons
│   ├── Inputs
│   ├── Tables
│   ├── Cards
│   ├── Modal
│   ├── Toast
│   └── POS Components
│
├── 05 Desktop
│   ├── Login
│   ├── Dashboard
│   ├── POS
│   ├── Products
│   ├── Product Detail
│   ├── Stock
│   ├── Services
│   ├── Mechanics
│   ├── Transactions
│   ├── Transaction Detail
│   ├── Reports
│   ├── Users
│   └── Settings
│
├── 06 Mobile
│   ├── Login
│   ├── Dashboard
│   ├── Products
│   ├── Stock
│   ├── Transactions
│   └── Reports
│
└── 07 Prototype
    ├── Cashier Flow
    ├── Product Flow
    ├── Stock Flow
    └── Transaction Flow
```

------------------------------------------------------------------------

# 39. Recommended Figma Design Order

Jangan langsung mendesain Dashboard.

Urutan:

``` text
01. Design System
        ↓
02. Login
        ↓
03. Main Layout + Sidebar
        ↓
04. ⭐ POS / Kasir
        ↓
05. Product
        ↓
06. Stock
        ↓
07. Transaction History
        ↓
08. Reports
        ↓
09. Dashboard
        ↓
10. Settings & User
        ↓
11. Mobile
```

Alasan utama:

**POS adalah jantung aplikasi.**

Jika POS sudah benar secara UX, halaman lain dapat mengikuti design
language yang sama.

------------------------------------------------------------------------

# 40. UX Principles untuk POS

## 1. Minimum Click

Kasir tidak boleh melakukan terlalu banyak klik untuk transaksi
sederhana.

Target:

``` text
Scan → Scan → Scan → Bayar → Selesai
```

## 2. Keyboard Friendly

Semua aktivitas utama harus bisa dilakukan dengan keyboard.

## 3. Barcode First

Barcode scanner menjadi metode input utama.

## 4. Always Visible Total

Total transaksi harus selalu terlihat.

## 5. Clear Feedback

Setiap action penting harus memberikan feedback.

## 6. Prevent Mistakes

Kesalahan yang berdampak pada stok/pembayaran harus memiliki
confirmation atau validation.

## 7. Fast Recovery

Jika transaksi gagal, kasir harus tahu apakah data sudah tersimpan atau
belum.

------------------------------------------------------------------------

# 41. Accessibility & Usability

Perhatikan:

-   Kontras teks
-   Ukuran klik minimal ±40px
-   Jangan hanya menggunakan warna untuk menunjukkan status
-   Focus state harus terlihat
-   Error harus memiliki pesan teks
-   Form label harus jelas
-   Keyboard navigation harus memungkinkan
-   Angka uang harus mudah dibaca

------------------------------------------------------------------------

# 42. Responsive Strategy

Desktop:

``` text
>= 1280px
```

Sidebar full.

Tablet/smaller desktop:

``` text
1024–1279px
```

Sidebar dapat collapse menjadi icon sidebar.

Mobile:

``` text
< 768px
```

Gunakan Flutter Mobile sebagai aplikasi utama, bukan memaksakan React
POS menjadi mobile.

------------------------------------------------------------------------

# 43. Figma Naming Convention

Gunakan naming yang konsisten.

Contoh:

``` text
Button/Primary
Button/Secondary
Button/Danger

Input/Default
Input/Focus
Input/Error
Input/Disabled

Badge/Success
Badge/Warning
Badge/Danger

Table/Product
Table/Transaction

Modal/Payment
Modal/Confirmation

Card/Stat
Card/Product
Card/Transaction
```

Untuk variants:

``` text
Button
├── Type
│   ├── Primary
│   ├── Secondary
│   ├── Danger
│   └── Ghost
│
├── Size
│   ├── Small
│   ├── Medium
│   └── Large
│
└── State
    ├── Default
    ├── Hover
    ├── Disabled
    └── Loading
```

------------------------------------------------------------------------

# 44. Figma Variables

Gunakan variables untuk:

## Color

``` text
color/background
color/surface
color/text
color/text-muted
color/border
color/primary
color/success
color/warning
color/danger
```

## Spacing

``` text
spacing/1 = 4
spacing/2 = 8
spacing/3 = 12
spacing/4 = 16
spacing/5 = 20
spacing/6 = 24
spacing/8 = 32
spacing/10 = 40
spacing/12 = 48
```

## Radius

``` text
radius/sm = 8
radius/md = 12
radius/lg = 16
radius/full = 999
```

Ini akan memudahkan implementasi React menggunakan design token yang
sama.

------------------------------------------------------------------------

# 45. Developer Handoff

Setelah desain selesai, setiap halaman harus memiliki:

-   Desktop frame
-   Responsive behavior
-   Component states
-   Hover state
-   Focus state
-   Disabled state
-   Loading state
-   Empty state
-   Error state
-   Success state
-   Modal/drawer interaction
-   Prototype interaction

Jangan hanya menyerahkan screenshot halaman.

------------------------------------------------------------------------

# 46. Figma → React Rule

Saat implementasi:

> **Figma adalah visual source of truth.**

> **PRD adalah functional source of truth.**

Jika Figma dan PRD berbeda:

1.  Identifikasi konflik.
2.  Jangan membuat asumsi yang mengubah business logic.
3.  Jika konflik memengaruhi database/transaction flow, tanyakan
    terlebih dahulu.
4.  Jika hanya perbedaan visual minor, gunakan desain terbaru yang telah
    disetujui.

AI Agent tidak boleh:

-   Mengubah layout secara sepihak.
-   Mengganti terminology.
-   Menambah fitur yang tidak ada di PRD.
-   Menghapus flow penting.
-   Mengubah business logic demi kemudahan UI.

------------------------------------------------------------------------

# 47. Final Design Goal

Target akhir desain:

``` text
FAST
+
CLEAN
+
PROFESSIONAL
+
EASY TO OPERATE
+
DATA-ORIENTED
+
BARCODE-FIRST
```

Aplikasi harus terasa seperti:

> **software kasir profesional untuk bengkel, bukan template dashboard
> admin.**

Prioritas UX:

``` text
Kasir
  ↓
Kecepatan transaksi
  ↓
Akurasi stok
  ↓
Riwayat
  ↓
Laporan
  ↓
Dashboard
```

------------------------------------------------------------------------

# 48. Final Figma Checklist

## Foundations

-   [ ] Color tokens
-   [ ] Typography
-   [ ] Spacing
-   [ ] Radius
-   [ ] Shadow
-   [ ] Icon system

## Components

-   [ ] Buttons
-   [ ] Inputs
-   [ ] Select
-   [ ] Tables
-   [ ] Modal
-   [ ] Drawer
-   [ ] Toast
-   [ ] Badge
-   [ ] Pagination
-   [ ] Empty state
-   [ ] Skeleton

## Desktop

-   [ ] Login
-   [ ] Dashboard
-   [ ] POS
-   [ ] Payment
-   [ ] Transaction success
-   [ ] Products
-   [ ] Product detail
-   [ ] Stock
-   [ ] Stock adjustment
-   [ ] Services
-   [ ] Mechanics
-   [ ] Transaction history
-   [ ] Transaction detail
-   [ ] Reports
-   [ ] Users
-   [ ] Settings

## Mobile

-   [ ] Login
-   [ ] Dashboard
-   [ ] Products
-   [ ] Stock
-   [ ] Transactions
-   [ ] Reports

## Prototype

-   [ ] Cashier flow
-   [ ] Product flow
-   [ ] Stock flow
-   [ ] Transaction flow

------------------------------------------------------------------------

# 49. Definition of Design Done

Design dianggap siap masuk development apabila:

-   [ ] Semua halaman utama sudah dibuat.
-   [ ] Design System sudah dibuat.
-   [ ] Figma variables sudah tersedia.
-   [ ] Components menggunakan variants.
-   [ ] POS flow sudah clickable.
-   [ ] Payment flow sudah clickable.
-   [ ] Stock adjustment flow sudah clickable.
-   [ ] Transaction cancellation flow sudah clickable.
-   [ ] Empty state tersedia.
-   [ ] Loading state tersedia.
-   [ ] Error state tersedia.
-   [ ] Success state tersedia.
-   [ ] Desktop 1440×900 sudah selesai.
-   [ ] Layout sudah diuji pada 1366×768.
-   [ ] Mobile flow sudah selesai.
-   [ ] Developer handoff siap.
-   [ ] Tidak ada halaman penting yang hanya berupa static screenshot.

------------------------------------------------------------------------

# 50. Design Source of Truth

Gunakan tiga sumber sebagai dasar development:

``` text
PRD
 │
 ├── Functional requirements
 └── Business rules

Figma
 │
 ├── Visual design
 ├── Layout
 ├── Components
 └── Interaction

Firebase Schema
 │
 ├── Data structure
 └── Permission
```

Ketiganya harus konsisten sebelum production development dimulai.

## Prinsip akhir

> **Design for the cashier first.**

> **Make common actions fast.**

> **Make mistakes difficult.**

> **Make data easy to understand.**

> **Keep the interface simple even when the system underneath is
> complex.**
