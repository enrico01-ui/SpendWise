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
| 2026-11-28 | parser-total | none | tesseract | 9/30 (30.0%) | 0/15 (0.0%) | 0/13 (0.0%) | N/A | 1.936 | parse_total v3; CORD 2/15, struk sendiri 7/15; 13 CORD kosong belum diselidiki |
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

### 2026-11-28: parse_total

- Yang diubah: menulis parse_total. Baris yang memuat TOTAL atau kata BAYAR dijadikan kandidat, angka berbentuk uang paling kanan diambil, GRAND TOTAL diutamakan, dan baris SUBTOTAL, ITEM, QTY dilewati.
- Hipotesis: nominal total ada di baris yang memuat kata TOTAL, dan baris itu harus dibedakan dari subtotal dan jumlah barang.
- Perintah atau konfigurasi: pytest -k total; eval.ps1 -Label parser-total -Preset none -Split dev
- Hasil: kasus uji 14/19 lulus (versi 2) lalu 16/19 (versi 3). Evaluasi dev: total benar 0% ke <NN>%.
- Yang kuamati: (1) baris 'Total item: 15 Total Qty: 20' muncul setelah baris TOTAL sehingga angka 20 terambil (r012); (2) nominal ada di baris 'RP BAYAR' yang tidak memuat kata TOTAL, dan kata 'PRABAYAR' ikut cocok kalau BAYAR dicari sebagai potongan huruf (r009); (3) angka kecil seperti 2 diterima sebagai uang. Tiga kasus lain (r002, r006, r007) tidak bisa diperbaiki parser karena teks OCR tidak memuat nominalnya.
- Keputusan: versi 3 dipertahankan. r002, r006, r007 dipindah ke ocr/tests/fixtures/ocr_limited_cases.json dan dicoba lagi setelah preprocessing (F2.3).
- Commit: <hash dari git log --oneline -1>
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

### 2026-11-28: tukar split karena kasus uji memakai struk test

- Masalah: kasus uji parser dibuat dari r002, r004, r009, dan r011, yang saat itu ada di split test. Teks dan jawabannya sudah dipakai untuk menyusun aturan, jadi split test terkontaminasi.
- Tindakan: r002, r004, r009, r011 dipindah ke dev. Empat struk dev yang belum pernah kulihat teks OCR-nya dipilih acak dengan Get-Random dan dipindah ke test: <r... r... r... r...>.
- Split test struk sendiri sekarang: <daftar 10 struk>.
- Dampak: belum pernah ada hasil evaluasi test untuk struk sendiri, jadi tidak ada angka yang terkontaminasi. Run test 2026-11-25 hanya memuat baris CORD dan hasilnya kosong.
- Pelajaran: kasus uji dan aturan parser hanya dibuat dari struk dev. Ini perlu disebut di docs/EVALUATION.md.
