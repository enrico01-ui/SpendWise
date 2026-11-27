# Labeling guide

These are the rules used to create `data/ground_truth.csv`, so that every receipt is labeled the same way. Anyone who labels more receipts later should follow this file, and every change to a rule should be written down here.

## Dataset

- Own receipts: files `r001.jpg`, `r002.jpg`, ... in `data/receipts/`. How they were collected and anonymized is described in `docs/DATASETS.md`.
- CORD subset: files `cord_0001.png`, `cord_0002.png`, ... imported with `scripts/data/import_cord.py` (CC BY 4.0, see `docs/DATASETS.md`).
- Split: 30 receipts in `dev` (used to tune the parser and preprocessing) and 20 in `test` (used once, at the end). The split was assigned **before any OCR result was seen** and is never changed afterwards.

## Columns of `data/ground_truth.csv`

| Column | Meaning | Format | Example |
| --- | --- | --- | --- |
| `filename` | Exact file name in `data/receipts/` | text | `r001.jpg` |
| `merchant` | Store name as printed at the top of the receipt, without branch name or address | UPPERCASE text | `INDOMARET` |
| `date` | Purchase date printed on the receipt | `YYYY-MM-DD` | `2026-11-08` |
| `total` | Final amount to pay | integer rupiah, no dots or commas | `47500` |
| `split` | Which set the receipt belongs to | `dev` or `test` | `dev` |
| `full_text` | Complete transcription of the receipt, only for about 10 receipts (used for character error rate) | text, one line per printed line | |

An empty `merchant`, `date` or `total` means that row is skipped for that metric only. Never guess a value: leave the cell empty instead.

## Decisions for ambiguous cases

These are the defaults. Change a row if you decide otherwise, and keep the table up to date.

| Situation | Decision |
| --- | --- |
| Date written day-first, for example `08/11/26` | Day first (8 November). Two-digit years are read as 20xx. |
| Several dates on the receipt (print time and transaction time) | Use the transaction date. |
| Two totals (for example before and after a discount) | Use the amount actually paid, the final amount payable. |
| Tax or service charge printed separately | `total` includes them if the printed final total includes them. |
| Rounding line (`PEMBULATAN`) | Use the final rounded amount payable. |
| `TUNAI`, `CASH`, `KEMBALI`, `CHANGE` lines | Never use these as `total`. |
| Merchant name unreadable or covered | Leave `merchant` empty. |
| Total not visible (torn or cut off) | Leave `total` empty, or exclude the receipt. |
| Foreign currency | Exclude the receipt. |
| Merchant name spelling | Write it as printed, in uppercase. If the receipt prints several spellings, use the one at the very top. |
| Header shows only a branch name (for example Indomaret prints `PLUS PAMEKASAN/009` and shows the brand only in the logo or footer) | Use the brand name (`INDOMARET`). |
| Brand name followed by an outlet or location (`LOAF BUN CITRA GARDEN 2`, `RAMEN1 OP SEMARANG`) | Keep only the brand (`LOAF BUN`, `RAMEN1`). A descriptor that is part of the brand name stays (`BREE COFFEE AND KITCHEN`, `KAKKOII JAPANESE BBQ & SHABU-SHABU`). |
| Logo shows several brands and none is clearly the merchant (`r024`) | Leave `merchant` empty. |
| Unpaid or pre-settlement bill (`UNPAID`, `NOT PAID`, `BELUM TERBAYAR`, `Tagihan Sementara`, `PreSettlement Bill`) | Keep the receipt. `total` is the printed final amount payable. These are `r004`, `r007`, `r012`, `r015`, `r016`. |
| Date with day and month both 12 or below (`6/4/23`, `09-07-2026`) | Day first, as in the first row. `r011` is read as 6 April 2023 and `r002` as 9 July 2026. |
| Prices with `IDR` prefix, `Rp` prefix, or `.` and `,` thousands separators | Strip them. `total` is a plain integer. |
| Receipt with several sections (the PLN token receipt `r009` has a bank slip above the Indomaret receipt) | Use the total of the retail receipt (`TOTAL`), not `RP BAYAR` or `Tunai`. |
| Printed total differs from the sum of its parts by a rounding amount (`r005`, `r014`, `r017`) | Use the printed final total, as in the rounding row. |
| Customer names, signatures, ID cards, meter and token numbers covered with a black box | The covered field is ignored. Never label a covered value. |

## Process

1. Label from the receipt itself (the photo or the paper), **never from the OCR output**, so that OCR mistakes do not leak into the answers.
2. Label one batch at a time and take a second look at about 10% of it.
3. After a day, relabel 5 random receipts without looking at the first answers. Count the disagreements and write the number in `docs/NOTES.md`. Many disagreements mean a rule above is unclear.
4. Do not change a label after seeing evaluation results, unless it is a clear mistake. Write every such change in `docs/NOTES.md` with the reason.
5. Never change `split` after seeing OCR results.

## Privacy

- Cover names, card numbers, phone numbers and member numbers on a receipt before photographing it.
- `data/` is gitignored. Check with `git status` that no image or CSV from `data/` is staged.
- Do not send real receipt photos to external services.

## Checklist before running the evaluation

- [ ] Every row has a `filename` that exists in `data/receipts/`
- [ ] `total` has no dots, commas or `Rp`
- [ ] `date` is `YYYY-MM-DD` on every row that has one
- [ ] The `dev` and `test` counts are 30 and 20 (or the numbers you decided and wrote here)
- [ ] `dev` and `test` both contain a mix of merchants and photo conditions
- [ ] About 10 rows have `full_text`
- [ ] The relabel check from step 3 is done
