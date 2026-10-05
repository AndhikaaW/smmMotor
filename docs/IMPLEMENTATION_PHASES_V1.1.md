# Implementation Phases V1.1 — Bengkel POS

Acuan: `PRD_Bengkel_POS_Firebase.md` + `AMENDEMEN_V1.1.md` (mengikat bila konflik) + `UI_UX_Planning_Bengkel_POS_Figma.md` (visual).
Aturan tetap PRD §39: TS strict, service layer `src/lib/firestore/`, tanpa Functions/Storage/backend custom, build hijau tiap akhir fase.

## Phase -1 — Firebase Setup (manual, dipandu via chat)

- [ ] Project Firebase dibuat (region asia-southeast2, Production mode)
- [ ] Auth provider Email/Password aktif
- [ ] Web app terdaftar, config → `.env`
- [ ] Bootstrap superadmin pertama via Console (Auth user + doc `users/{uid}`)
- [ ] Rules sementara locked (tolak semua) hingga Phase 1 menulis Rules final

Keluar: `.env` terisi, login bootstrap bisa dipakai. Detail di chat, bukan di sini.

## Phase 0 — Project Setup

- [ ] Vite + React + TS strict + Tailwind + shadcn/ui + TanStack Query + RHF + Zod + Firebase SDK
- [ ] `.env` + `.env.example` (hanya `VITE_FIREBASE_*`, tanpa secret)
- [ ] Struktur folder PRD §40 + service layer §41
- [ ] Router + base layout (sidebar 240px + header 64px) + Auth provider + protected route
- [ ] Firestore offline persistence diaktifkan (target online, persistence sebagai buffer)

Keluar: `npm run build` hijau, halaman login stub tampil dalam layout.

## Phase 1 — Auth & Users (P0)

- [ ] Login email/password + persistence + logout
- [ ] Guard route per role (`superadmin | admin`); user `isActive=false` ditolak saat login
- [ ] Lupa password: 1 kolom identifier (username/email/phone) → resolve email → `sendPasswordResetEmail`
- [ ] Kelola user (superadmin): list + tambah (secondary FirebaseApp agar sesi tak logout) + nonaktif (`isActive=false`, tanpa hapus) + reset role
- [ ] Uniqueness `username/email/phone` dicek app-level (limitasi V1, tanpa Functions)
- [ ] `firestore.rules` final: users hanya superadmin untuk tulis; blokir `role/isActive` diubah selain superadmin
- [ ] Seed doc `settings/general` default

Keluar: 2 role jalan end-to-end (login, guard, kelola user), Rules ter-deploy.

## Phase 2 — Master Data (P0: produk; P1: jasa/mekanik/settings)

- [ ] Kategori: CRUD + soft-deactivate (`isActive=false`)
- [ ] Produk: CRUD + `barcode` unik (app-level), `purchasePrice/sellingPrice/stock >= 0`, stok awal saat create, nonaktif bukan hapus
- [ ] Jasa: CRUD (`name, price, description, isActive`); mekanik: CRUD (`name, isActive`)
- [ ] Settings (superadmin): form `settings/general` sesuai A7; payment modal & struk baca dari sini
- [ ] Rules: produk/jasa/mekanik — read: auth aktif; write: admin+superadmin; `purchasePrice` tak terlihat/diubah? — V1: sembunyikan field dari UI non-superadmin (Rules field-level per-role tidak granular tanpa Claims, jadi proteksi = UI + larangan; dicatat sebagai limitasi)
- [ ] Index awal: `products: barcode (==) `, `users: username/email/phone (==)`

Keluar: kasir bisa baca produk aktif; admin bisa kelola semua master.

## Phase 3 — POS (P0, jantung)

- [ ] Layar POS: barcode/search bar + grid produk + cart selalu terlihat + total dominan
- [ ] Barcode USB (mode keyboard): scan → `getByBarcode` → tambah cart tanpa modal; error "Barcode X tidak ditemukan"; auto-focus + F2 fokus / F4 bayar / ESC tutup / F8 clear
- [ ] Cart: tambah produk + jasa (2 baris manual), qty +/-/input langsung, hapus baris; `total = subtotal` (tanpa diskon)
- [ ] Payment modal: metode dari `settings.paymentMethods`; cash boleh `>= total` (kembalian), non-cash wajib pas (`== total`, `change=0`)
- [ ] Simpan: `transactionNumber` acak A10 + collision-check → Firestore Transaction atomik (buat transaksi + kurangi `products.stock` + tulis `stock_movements`); validasi stok & harga snapshot dari server (jangan percaya total client)
- [ ] Success screen (fokus default "Transaksi Baru") + cetak struk browser 58/80mm dari `settings`
- [ ] Index: `transactions: transactionNumber (==)` untuk collision-check

Keluar: skenario uji PRD §38 lolos: normal, multi-item, stok-kurang-ditolak, harga-lama-tak-berubah.

## Phase 4 — History (P0)

- [ ] List transaksi (default sembunyikan `status=deleted`) + pagination 50 + filter tanggal/nomor/kasir/metode/status
- [ ] Detail: semua item snapshot + info bayar + kasir
- [ ] Hapus (superadmin saja): popup konfirmasi → soft-delete + kembalikan stok + movement `type=return`
- [ ] Rules: create: auth aktif; update/delete: superadmin saja; kasir read sesuai izin
- [ ] Index: `transactions: status + transactionDate (desc)`, `+ cashierId + transactionDate`, `+ paymentMethod + transactionDate` (buat sesuai query nyata)

Keluar: riwayat + hapus-aman teruji (stok kembali, laporan mengecualikan deleted).

## Phase 5 — Reports (P0 daily/monthly; P1 sisanya)

- [ ] Daily: filter tanggal → transaksi, omzet, item terjual, produk vs jasa, payment breakdown, terlaris
- [ ] Monthly: filter bulan/tahun → agregat + grafik omzet/hari + ranking produk (qty + revenue)
- [ ] Estimasi margin kotor `(sellingPrice - purchasePrice) * qty`, label "Estimasi Margin Kotor" (bukan laba bersih)
- [ ] Semua query date-range + limit; tanpa full-collection scan

Keluar: angka daily × monthly konsisten untuk hari yang sama.

## Phase 6 — Dashboard (P1)

- [ ] KPI: omzet hari ini, transaksi hari ini, produk terjual, stok menipis, jasa terjual + greeting + filter hari
- [ ] Grafik 7 hari + produk terlaris + tabel stok menipis (`stock <= minimum` warning, `== 0` critical)
- [ ] Query terfilter tanggal; ringkas bila data besar (strategi summary doc = fase berikutnya, bukan V1)

Keluar: dashboard terbuka < 2 dtk pada data uji 1.000 transaksi.

## Phase 7 — Hardening (wajib sebelum produksi)

- [ ] Rules audit + uji izin per-role (matriks A6)
- [ ] Uji konkurensi 2 kasir: stok tak negatif, salah satu transaksi ditolak/retry
- [ ] Uji barcode fisik + print 58/80mm + error handling PRD §34
- [ ] Typecheck + lint + build bersih; hapus scaffold/throwaway

## Urutan eksekusi

`-1 → 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7`. Satu fase tuntas (build hijau + acceptance) sebelum lanjut.
