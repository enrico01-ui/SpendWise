# SpendWise: Roadmap, Skema Database, dan Endpoint

Nov 14, 2026 · @Grim

## Ringkasan dan arsitektur

SpendWise mengubah foto struk menjadi data pengeluaran yang sudah divalidasi, bebas duplikat, dan terkategori, lalu menampilkannya sebagai analitik. Targetnya 5 minggu dengan ±10-15 jam per minggu, dan minggu ke-6 sebagai cadangan. Pembeda project ini bukan OCR-nya, tapi angka akurasi OCR yang kamu ukur sendiri dan tulis di README.

Alurnya: unggah foto, Express menyimpan gambar dan membuat baris struk berstatus `UPLOADED`, worker memanggil service OCR (FastAPI), hasilnya divalidasi dan dicek duplikat, lalu struk menunggu review user (`NEEDS_REVIEW`) sebelum dikonfirmasi (`CONFIRMED`) dan masuk ke analitik.

| Komponen | Pilihan | Alasan |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite, Tailwind + ShadCN, Recharts | Sudah kamu kuasai; Recharts cukup untuk dashboard |
| API utama | Express + TypeScript, Prisma, JWT | Auth, CRUD, dan logika bisnis tetap di stack yang kamu paham |
| Service OCR | FastAPI (Python), OpenCV, Tesseract, PaddleOCR | Ekosistem OCR dan image processing terbaik ada di Python; dipisah supaya engine mudah diganti |
| Database | PostgreSQL + ekstensi `pg_trgm` | Fuzzy match merchant langsung di SQL |
| Antrean | Kolom `status` + worker polling | Tanpa Redis; cukup untuk skala project ini |
| Penyimpanan gambar | Docker volume lokal | S3 tidak diperlukan untuk portofolio |
| Infra | Docker Compose | Satu perintah menjalankan semua service |

&#91;embedded content: arsitektur · 5 komponen\]

Express hanya berbicara ke service OCR lewat HTTP internal, jadi engine OCR bisa diganti tanpa menyentuh API utama.

## Roadmap 5 minggu

Setiap minggu berakhir dengan satu milestone yang bisa didemokan. Kalau satu minggu meleset, potong fitur dari daftar di bagian Risiko, bukan evaluasinya.

&#91;embedded content: roadmap · 5 minggu, 5 milestone\]

M2 menghasilkan angka baseline yang menjadi dasar semua perbandingan berikutnya, dan M5 menutup dengan README serta demo.

**Minggu 1: fondasi dan OCR baseline**

- Docker Compose (web, api, ocr, db), skema Prisma awal, auth JWT
- Upload struk, simpan gambar, status `UPLOADED`
- FastAPI + Tesseract mengembalikan teks mentah
- Kumpulkan 30 foto struk yang bervariasi (terang, gelap, miring, kusut) dan mulai isi file ground truth
- **M1:** foto diunggah dan teks mentah tampil di UI

**Minggu 2: preprocessing dan parsing**

- OpenCV: grayscale, denoise, adaptive threshold, deskew, perspective crop
- Parser untuk merchant, tanggal, total, dan item (regex + heuristik baris), mulai dari 3 jenis merchant paling umum
- Eval script v0: akurasi per field pada 30 struk, sebelum vs sesudah preprocessing
- **M2:** ada angka baseline dan angka perbaikan dari preprocessing

**Minggu 3: validasi, review UI, duplikat**

- Aturan validasi (jumlah item cocok dengan total, tanggal masuk akal, nominal positif)
- Layar review: gambar di kiri, field yang bisa diedit di kanan, field berkeyakinan rendah disorot
- Deteksi duplikat dua tahap: perceptual hash gambar, lalu fuzzy match merchant + tanggal + nominal
- **M3:** struk yang salah bisa dikoreksi dan duplikat ditandai

**Minggu 4: kategori, analitik, engine kedua**

- Kategori berbasis aturan, lalu TF-IDF + Logistic Regression, bandingkan akurasinya
- Dashboard: total per bulan, per kategori, merchant teratas, tren
- Tambahkan PaddleOCR dan bandingkan dengan Tesseract
- **M4:** dashboard berjalan dengan data struk asli

**Minggu 5: evaluasi, test, dokumentasi**

- Tabel evaluasi final pada 50 struk, plus analisis 3-5 jenis kegagalan terbanyak
- Test untuk parser, validasi, duplikat, dan alur upload sampai konfirmasi
- README dengan arsitektur, keputusan dan trade-off, angka evaluasi, demo GIF; deploy
- **M5:** repo siap dilampirkan saat melamar

Minggu 6 hanya dipakai untuk menutup utang dari minggu sebelumnya.

## Skema database

Sembilan tabel, dengan tiga yang jarang ada di project serupa: `ocr_runs` (menyimpan hasil tiap percobaan engine dan konfigurasi preprocessing), `ground_truth` (jawaban benar untuk evaluasi), dan `corrections` (apa yang diubah user, berguna untuk analisis kegagalan). Nominal disimpan sebagai integer rupiah supaya tidak ada masalah pembulatan float.

```prisma
enum Role { USER ADMIN }
enum ReceiptStatus { UPLOADED PROCESSING NEEDS_REVIEW CONFIRMED FAILED }

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String
  name         String
  role         Role       @default(USER)
  createdAt    DateTime   @default(now())
  receipts     Receipt[]
  categories   Category[]
  budgets      Budget[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Category {
  id       Int           @id @default(autoincrement())
  userId   String?       // null = kategori bawaan
  name     String
  keywords String[]
  user     User?         @relation(fields: [userId], references: [id])
  receipts Receipt[]
  items    ReceiptItem[]
  budgets  Budget[]
  @@unique([userId, name])
}

model Receipt {
  id            String        @id @default(uuid())
  userId        String
  imagePath     String
  imageHash     String?       // perceptual hash, hex; dihitung worker setelah upload
  status        ReceiptStatus @default(UPLOADED)
  merchantName  String?
  purchaseDate  DateTime?     @db.Date
  totalAmount   Int?          // rupiah
  categoryId    Int?
  ocrConfidence Float?
  rawText       String?
  duplicateOfId String?
  confirmedAt   DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  user          User          @relation(fields: [userId], references: [id])
  category      Category?     @relation(fields: [categoryId], references: [id])
  duplicateOf   Receipt?      @relation("Duplicate", fields: [duplicateOfId], references: [id])
  duplicates    Receipt[]     @relation("Duplicate")
  items         ReceiptItem[]
  ocrRuns       OcrRun[]
  corrections   Correction[]
  groundTruth   GroundTruth?
  @@index([userId, purchaseDate(sort: Desc)])
  @@index([userId, status])
  @@index([imageHash])
}

model ReceiptItem {
  id         String   @id @default(uuid())
  receiptId  String
  name       String
  qty        Float    @default(1)
  unitPrice  Int?
  lineTotal  Int
  categoryId Int?
  receipt    Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  category   Category? @relation(fields: [categoryId], references: [id])
  @@index([receiptId])
}

model OcrRun {
  id               String   @id @default(uuid())
  receiptId        String
  engine           String   // tesseract | paddleocr
  preprocessConfig Json
  rawText          String
  fields           Json     // merchant, date, total, items + confidence per field
  durationMs       Int
  createdAt        DateTime @default(now())
  receipt          Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  @@index([receiptId])
}

model GroundTruth {
  id           String   @id @default(uuid())
  receiptId    String   @unique
  merchantName String
  purchaseDate DateTime @db.Date
  totalAmount  Int
  items        Json?
  split        String   // dev | test
  receipt      Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
}

model Correction {
  id             String   @id @default(uuid())
  receiptId      String
  field          String
  ocrValue       String?
  correctedValue String
  createdAt      DateTime @default(now())
  receipt        Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  @@index([receiptId])
}

model Budget {
  id          String   @id @default(uuid())
  userId      String
  categoryId  Int
  month       DateTime @db.Date  // hari pertama bulan
  limitAmount Int
  user        User     @relation(fields: [userId], references: [id])
  category    Category @relation(fields: [categoryId], references: [id])
  @@unique([userId, categoryId, month])
}
```

Dua hal yang tidak bisa ditulis di Prisma dan perlu migrasi SQL manual:

- `CREATE EXTENSION pg_trgm;` lalu indeks GIN trigram pada `merchantName` untuk fuzzy match duplikat
- Duplikat sengaja **tidak** diblokir dengan constraint unik. Struk yang mirip hanya ditandai lewat `duplicateOfId`, karena dua pembelian kopi yang sama di hari yang sama itu sah, dan user yang memutuskan lewat review.

## Daftar endpoint

Dua service: **Express** (publik, prefix `/api/v1`, semua selain auth memakai JWT) dan **FastAPI** (internal, hanya bisa diakses dari jaringan Docker oleh Express). Format error seragam: `{"error":{"code":"...","message":"...","details":{}}}`.

### Express API

| Method | Path | Fungsi | Respons |
| --- | --- | --- | --- |
| POST | `/auth/register` | Daftar akun | 201 |
| POST | `/auth/login` | Login, kembalikan access + refresh token | 200 |
| POST | `/auth/refresh` | Tukar refresh token | 200 |
| GET | `/auth/me` | Profil user saat ini | 200 |
| POST | `/receipts` | Unggah foto (multipart, maks 10 MB, jpg/png saja); buat struk `UPLOADED` | 202 `{id, status}` |
| GET | `/receipts` | Daftar struk; filter `status`, `from`, `to`, `categoryId`, `q`, paginasi | 200 |
| GET | `/receipts/:id` | Detail: field, item, peringatan validasi, info duplikat | 200 |
| GET | `/receipts/:id/image` | Gambar asli (`?processed=true` untuk hasil preprocessing) | 200 |
| PATCH | `/receipts/:id` | Koreksi field; perubahan dicatat ke `corrections` | 200 |
| PUT | `/receipts/:id/items` | Ganti seluruh daftar item | 200 |
| POST | `/receipts/:id/confirm` | Konfirmasi; ditolak jika validasi gagal | 200 |
| POST | `/receipts/:id/reprocess` | Ulangi OCR dengan `engine` atau opsi preprocessing lain | 202 |
| POST | `/receipts/:id/resolve-duplicate` | Body `{action: "keep" \| "discard"}` | 200 |
| DELETE | `/receipts/:id` | Hapus struk beserta gambarnya | 204 |
| GET | `/categories` | Kategori bawaan + milik user | 200 |
| POST | `/categories` | Buat kategori dengan `keywords` | 201 |
| PATCH | `/categories/:id` | Ubah nama atau kata kunci | 200 |
| DELETE | `/categories/:id` | Hapus kategori milik user | 204 |
| GET | `/analytics/summary` | Total, jumlah struk, rata-rata per bulan (`?month=`) | 200 |
| GET | `/analytics/by-category` | Pengeluaran per kategori (`from`, `to`) | 200 |
| GET | `/analytics/trend` | Deret waktu (`granularity=week\|month`) | 200 |
| GET | `/analytics/top-merchants` | Merchant dengan pengeluaran terbesar | 200 |
| GET | `/budgets` | Anggaran bulan tertentu beserta realisasi | 200 |
| PUT | `/budgets` | Atur anggaran per kategori | 200 |
| GET | `/export/receipts.csv` | Ekspor struk terkonfirmasi | 200 |

Endpoint auth menerima dan mengembalikan JSON. Register memakai body
`{ "email", "password", "name" }`, login memakai `{ "email", "password" }`,
dan refresh memakai `{ "refreshToken" }`. Register mengembalikan HTTP 201;
login dan refresh mengembalikan HTTP 200 dengan `{ "user", "accessToken",
"refreshToken" }`. Access token adalah JWT yang berlaku 15 menit. Refresh
token adalah nilai acak 256-bit yang hanya disimpan sebagai SHA-256 hash,
berlaku 7 hari, dan dirotasi pada setiap refresh. Pemakaian ulang refresh
token yang sudah dicabut mencabut semua refresh token milik user tersebut.
`GET /auth/me` memerlukan header `Authorization: Bearer <accessToken>` dan
mengembalikan `{ "user" }`.

### Endpoint evaluasi (role ADMIN)

| Method | Path | Fungsi |
| --- | --- | --- |
| PUT | `/receipts/:id/ground-truth` | Simpan jawaban benar dan split `dev` atau `test` |
| POST | `/eval/run` | Jalankan evaluasi untuk satu konfigurasi `{engine, preprocess}` |
| GET | `/eval/report` | Metrik per konfigurasi, siap disalin ke README |

### FastAPI OCR service (internal)

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/ocr/extract` | Gambar + `engine` + `preprocess` menghasilkan teks mentah, field, dan confidence |
| POST | `/ocr/preprocess` | Mode debug: kembalikan gambar hasil preprocessing |
| POST | `/image/phash` | Hitung perceptual hash gambar |
| POST | `/category/predict` | Teks item menghasilkan kategori + skor (minggu 4) |
| GET | `/health` | Cek hidup, termasuk engine mana yang termuat |

Bentuk respons `/ocr/extract`, supaya Express dan parser punya kontrak yang jelas:

```json
{
  "engine": "tesseract",
  "durationMs": 1840,
  "rawText": "INDOMARET\n...",
  "fields": {
    "merchant": { "value": "INDOMARET", "confidence": 0.93 },
    "date": { "value": "2026-11-08", "confidence": 0.88 },
    "total": { "value": 47500, "confidence": 0.71 },
    "items": [
      { "name": "AQUA 600ML", "qty": 2, "lineTotal": 7000, "confidence": 0.80 }
    ]
  },
  "warnings": ["total_not_equal_item_sum"]
}
```

## Pipeline OCR dan evaluasi

Bagian ini yang membedakan SpendWise dari demo OCR biasa: setiap keputusan teknis dibuktikan dengan angka dari dataset berlabel.

### Pipeline per struk

1. **Preprocessing (OpenCV):** resize ke lebar tetap, grayscale, denoise, deteksi tepi kertas untuk perspective crop, deskew, lalu adaptive threshold. Tiap langkah bisa dimatikan lewat konfigurasi supaya efeknya terukur terpisah.
2. **OCR:** Tesseract (bahasa `ind+eng`, mode halaman tunggal) dan PaddleOCR, keduanya lewat antarmuka yang sama.
3. **Parsing:** merchant dari beberapa baris teratas, tanggal dengan beberapa pola format, total dari baris berkata kunci (TOTAL, JUMLAH, GRAND TOTAL), item dari baris berpola nama + qty + harga.
4. **Validasi:** aturan di tabel bawah. Hasilnya `warnings` yang menentukan apakah struk masuk `NEEDS_REVIEW`.
5. **Duplikat:** hash gambar mirip (jarak Hamming kecil) atau kombinasi merchant mirip + tanggal sama + nominal sama.
6. **Kategori:** aturan kata kunci dulu, lalu model klasifikasi sebagai pembanding.

| Aturan validasi | Tindakan jika gagal |
| --- | --- |
| Total sama dengan jumlah `lineTotal` item (toleransi pembulatan kecil) | Peringatan, wajib review |
| Tanggal bukan di masa depan dan tidak lebih dari 2 tahun lalu | Peringatan, wajib review |
| Total lebih dari 0 dan masuk akal (batas atas bisa diatur) | Peringatan, wajib review |
| Merchant tidak kosong | Peringatan |
| Confidence field di bawah ambang | Field disorot di layar review |

### Dataset dan metrik

- **Dataset:** 50 struk nyata dengan kondisi bervariasi. 30 untuk `dev` (boleh dipakai menyetel parser) dan 20 untuk `test` (hanya dipakai sekali di akhir). Tanpa pemisahan ini angka akhir terlalu optimis.
- **Akurasi per field:** total (cocok persis), tanggal (cocok persis), merchant (kemiripan teks di atas ambang, misalnya 0,8).
- **Character error rate** pada teks mentah untuk 10 struk yang kamu ketik ulang penuh.
- **Waktu per struk** (median) dan **persentase struk yang masuk `NEEDS_REVIEW`**.
- **Duplikat:** buat 10 pasang duplikat (foto ulang, crop berbeda, screenshot) dan 10 pasang bukan duplikat, lalu hitung precision dan recall.
- **Kategori:** label sekitar 150 transaksi; bandingkan akurasi dan macro-F1 aturan kata kunci dengan TF-IDF + Logistic Regression.

Tabel yang diisi dari `eval/report` dan ditaruh di README (kolom angka diisi setelah eval script jalan):

| Konfigurasi | Total benar | Tanggal benar | Merchant benar | Waktu per struk |
| --- | --- | --- | --- | --- |
| Tesseract, tanpa preprocessing |  |  |  |  |
| Tesseract + preprocessing |  |  |  |  |
| PaddleOCR + preprocessing |  |  |  |  |
| Engine terbaik + validasi dan koreksi user |  |  |  |  |

Tambahkan satu bagian **analisis kegagalan** di README: kelompokkan 3-5 penyebab salah baca terbanyak (struk thermal pudar, lipatan, bayangan, font kecil) beserta contoh gambarnya dan apa yang kamu coba untuk memperbaikinya.

## Risiko dan pemotongan scope

Risiko terbesarnya bukan teknis, tapi waktu yang terbagi dengan TA. Karena itu urutan pemotongan sudah ditentukan dari awal: evaluasi dan layar review tidak boleh dipotong, fitur lain boleh.

| Risiko | Penanganan |
| --- | --- |
| Struk thermal pudar atau kusut membuat OCR buruk | Preprocessing + layar review; laporkan angka apa adanya dan jadikan bahan analisis kegagalan, jangan kejar 100% |
| Format struk terlalu beragam untuk parser | Mulai dari 3 jenis merchant paling umum (minimarket, restoran, SPBU), baru digeneralisasi di akhir |
| PaddleOCR berat dipasang di Docker | Jalankan di image terpisah; fallback ke Tesseract jika gagal |
| OCR lambat membuat upload terasa macet | Respons 202 langsung, proses di worker, UI polling status |
| Foto struk memuat data pribadi (nama, nomor kartu, nomor HP) | Dataset masuk `.gitignore`; di repo publik hanya sampel anonim atau sintetis |
| Waktu mepet | Potong dengan urutan di bawah |

Urutan pemotongan bila waktu mepet, dari yang dipotong pertama:

1. Ekspor CSV
2. Anggaran per kategori
3. Klasifikasi kategori berbasis model (cukup aturan kata kunci)
4. PaddleOCR (cukup Tesseract, tapi bandingkan dua konfigurasi preprocessing)

Yang tidak dipotong: preprocessing, validasi, layar review, deteksi duplikat dasar, dan tabel evaluasi.

## Checklist selesai

Project dianggap selesai bila semua ini terpenuhi.

- [ ] `docker compose up` menjalankan semua service dari repo bersih
- [ ] 50 struk berlabel dan eval script yang bisa dijalankan ulang dengan satu perintah
- [ ] Tabel evaluasi di README dengan perbandingan sebelum dan sesudah preprocessing
- [ ] Layar review dan deteksi duplikat bisa didemokan dari awal sampai akhir
- [ ] Dashboard analitik menampilkan data struk asli
- [ ] Test untuk parser, validasi, dan duplikat
- [ ] README memuat arsitektur, keputusan dan trade-off, analisis kegagalan, dan satu hal yang gagal atau kamu ubah di tengah jalan
- [ ] Demo GIF atau video 60-90 detik
- [ ] Tidak ada foto struk pribadi yang ter-commit
