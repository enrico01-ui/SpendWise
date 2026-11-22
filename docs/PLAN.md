# SpendWise Plan

## Roadmap 5 minggu

Setiap minggu berakhir dengan satu milestone yang bisa didemokan. Kalau satu minggu meleset, potong fitur dari daftar di bagian Risiko, bukan evaluasinya.

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
- [ ] Test untuk parser, validasi, duplikat, dan alur upload sampai konfirmasi
- [ ] README memuat arsitektur, keputusan dan trade-off, analisis kegagalan, dan satu hal yang gagal atau kamu ubah di tengah jalan
- [ ] Demo GIF atau video 60-90 detik
- [ ] Tidak ada foto struk pribadi yang ter-commit
