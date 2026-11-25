# CORD data import

This folder contains local scripts for importing the CORD v2 evaluation subset.
These dependencies are not used by the API or OCR container.

## Windows PowerShell setup

From the repository root:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r scripts/data/requirements.txt
python -m pip install -r scripts/data/requirements-dev.txt
```

Run the importer:

```powershell
python scripts/data/import_cord.py --count 25 --dev 15 --test 10 --seed 42 --out data
```

`--dev` plus `--test` must equal `--count`. The first run downloads CORD into
`data/.hf-cache`; check the download size on a metered connection.

To create a second batch, use `--force-new-batch`. The importer excludes rows already
listed in `data/cord_provenance.csv` and continues Cord image numbering.

Always verify imported totals against the source receipt image. CORD attribution
must remain in `docs/DATASETS.md`.
