# Catatan eksperimen SpendWise

Ini catatan kerjaku selama Sprint 2 sampai 5. Isinya jadi bahan untuk analisis kegagalan di `docs/EVALUATION.md` dan bagian 'Decisions and trade-offs' serta 'What failed or changed' di README. Tulis saat kejadiannya, jangan menunggu akhir, karena detailnya cepat terlupa.

## Cara memakai

- Satu entri per eksperimen, dengan angka sebelum dan sesudah.
- Jangan menghapus entri yang gagal. Eksperimen yang gagal sering jadi bahan terbaik untuk README.
- Kalau mengubah label di `data/ground_truth.csv`, catat di sini beserta alasannya.
- Jangan membuka atau mencatat hasil split `test` sebelum evaluasi final (F5.3).

## Ringkasan hasil evaluasi (split dev)

Tambah satu baris setiap menjalankan evaluasi.

| Tanggal | Label | Preset | Engine | Total benar | Tanggal benar | Merchant benar | CER | Detik per struk | Catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| 2026-11-27 | baseline-no-parser | none | tesseract | 0/30 (0.0%) | 0/15 (0.0%) | 0/14 (0.0%) | N/A | 2.421 | 30 struk, 0 failures; CER tidak tersedia karena 0 baris memiliki full_text |
| | | | | | | | | | |

## Templat entri

Salin blok ini untuk setiap eksperimen baru.

```text
### YYYY-MM-DD: judul singkat

- Yang diubah:
- Hipotesis (kenapa kukira ini membantu):
- Perintah atau konfigurasi:
- Hasil (sebelum ke sesudah):
- Yang kuamati (gambar, errors.csv):
- Keputusan (dipertahankan, dibuang, atau dicoba lagi dengan ...):
- Commit:
```

## Contoh entri (hanya ilustrasi, angkanya bukan hasil nyata)

```text
### 2026-12-01: adaptive threshold

- Yang diubah: mengaktifkan langkah adaptive_threshold dengan blockSize 31 dan C 10
- Hipotesis: bayangan di sudut foto membuat teks hilang, threshold adaptif akan menahannya
- Perintah atau konfigurasi: preset p6-threshold, split dev
- Hasil: total benar NN% ke NN%, tanggal benar NN% ke NN%
- Yang kuamati: struk yang berbayangan membaik, tapi struk thermal pudar justru kehilangan angka
- Keputusan: C diturunkan dan dicoba lagi; hasilnya dicatat di entri berikutnya
- Commit: abc1234
```

## Kegagalan berulang

Isi saat kamu menemukan pola di `errors.csv`. Tiga sampai lima penyebab terbanyak akan jadi bagian 'Error analysis' di `docs/EVALUATION.md`.

| Penyebab | Contoh struk | Seberapa sering | Yang sudah dicoba | Hasilnya |
| --- | --- | --- | --- | --- |
| Kertas thermal pudar | | | | |
| Lipatan atau kerutan | | | | |
| Bayangan | | | | |
| Pantulan cahaya | | | | |
| Font sangat kecil | | | | |
| Foto miring | | | | |
| TUNAI atau KEMBALI tertukar dengan total | | | | |

## Cek konsistensi label

- Tanggal relabel 5 struk acak:
- Jumlah jawaban yang berbeda dari label pertama:
- Aturan di `docs/LABELING.md` yang diperjelas karena itu:

## Pertanyaan terbuka

- (tulis hal yang belum kamu pahami atau ingin diuji nanti)

## Bahan untuk README

Isi sambil jalan, lalu rapikan menjadi tulisanmu sendiri di akhir.

- Satu hal yang tidak berjalan seperti rencana, dan apa yang kuubah:
- Keputusan penting dan alasannya (pilihan, alternatif, alasan, biayanya):
- Temuan yang mengejutkan:
- Langkah yang malah memperburuk hasil, dan dugaan penyebabnya:

## Log pelabelan

### 2026-11-26: label 25 struk sendiri

- Yang diubah: menambah `r001`–`r025` ke `data/ground_truth.csv`. Split struk sendiri 15 dev dan 10 test, jadi gabungan dengan CORD tepat 30 dev dan 20 test.
- Split `test` struk sendiri: `r002`, `r004`, `r009`, `r011`, `r013`, `r015`, `r017`, `r019`, `r021`, `r023`. Dipilih sebelum ada hasil OCR apa pun untuk struk sendiri, supaya `test` berisi campuran struk kusut, miring, bayangan, dan satu minimarket. Dua struk Mie Gacoan (`r006`, `r008`) sengaja sama-sama di `dev`.
- Label dibuat dari bacaan foto oleh Claude, bukan dari keluaran OCR, tapi **belum kuverifikasi ke kertas atau foto asli**. Verifikasi dulu sebelum menjalankan eval.
- Keputusan pelabelan baru ditulis di `docs/LABELING.md`.
- `full_text` belum diisi untuk struk mana pun. Perlu sekitar 10 struk, ditranskripsi dari kertas.
- Run `eval-results/20261125-181033-baseline` memakai split `test` (baris CORD saja, 10 struk) dengan hasil total 0% karena parser belum ada. Dicatat supaya jujur di README, dan `test` sebaiknya tidak dijalankan lagi sampai evaluasi final.
- Yang perlu dicek ulang: jumlah item `r019` (aku hitung 108.800, total tercetak 108.500), tanggal `r011` (`6/4/23`, dibaca 6 April 2023), `r024` (merchant sengaja kosong karena logo memuat beberapa merek), dan `r017` (dilabeli `RAMEN1`, tapi header menulis `RAMEN1 OP SEMARANG`, jadi kemiripan merchant bisa di bawah ambang 0,8).
