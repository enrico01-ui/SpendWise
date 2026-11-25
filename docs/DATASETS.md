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

Describe here how personal or store receipts were collected and anonymized, including
whether names, card numbers, phone numbers, and member numbers were covered or removed.
