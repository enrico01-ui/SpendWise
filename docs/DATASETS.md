# Datasets

## CORD

- **Title:** CORD: A Consolidated Receipt Dataset for Post-OCR Parsing
- **Authors:** Seunghyun Park, Seungju Shin, Jeongyeon Lee, Sungrae Lee, Kijung Surh, Hyungyu Seo, Sangha Lee
- **Venue:** NeurIPS 2019 Document Intelligence Workshop
- **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Source:** [naver-clova-ix/cord-v2 on Hugging Face](https://huggingface.co/datasets/naver-clova-ix/cord-v2)

A deterministic subset was selected with `scripts/data/import_cord.py` and is used
for evaluation only. Imported totals must be verified against the source receipt
images before use. CORD labels do not provide reliable merchant, purchase-date,
or full-text transcription fields for this project's labeling schema.

## My own receipts

25 receipt photos, `r001.jpg` to `r025.jpg`, all printed Indonesian receipts in rupiah:
22 restaurants, cafes, and food outlets, one bakery (`r018`), and two Indomaret
receipts (`r009`, a PLN prepaid electricity token, and `r010`). The photos vary in
lighting, angle, creases, shadows, hands covering part of the paper, and POS layout.
Dates range from 2017 to 2026.

**Source:** TODO. State here how these photos were obtained (taken by me, or collected
from elsewhere) and, for any collected from elsewhere, where from and under what terms.

**Anonymization.** The uncovered originals are kept outside the repository. The copies in
`data/receipts/` have black boxes drawn over personal data:

| File | Covered |
| --- | --- |
| `r001`, `r002`, `r006`, `r007`, `r008`, `r014`, `r020`, `r021`, `r023`, `r024` | Customer name |
| `r004` | Customer name and the bill number line |
| `r005` | Customer name, phone number, and reference code |
| `r008` | Also the face of a child in the background |
| `r009` | ID card, meter number, customer ID, customer name, prepaid electricity token, and coupon code |
| `r011` | A payment card held in the photo |

Staff names, store addresses, and store phone numbers were left as printed. The other
receipts had nothing to cover.

**Replaced files.** The first `r009` (a receipt in Indian rupees) and the first `r010`
(a handwritten note) were replaced by the two Indomaret receipts, because the first two
do not fit the receipt types in scope.

Labels are in `data/ground_truth.csv` and follow `docs/LABELING.md`.
