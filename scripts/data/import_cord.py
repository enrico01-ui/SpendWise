from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence


GROUND_TRUTH_HEADER = ["filename", "merchant", "date", "total", "split", "full_text"]
PROVENANCE_HEADER = ["filename", "cord_split", "cord_index", "raw_total_string"]
CORD_DATASET = "naver-clova-ix/cord-v2"


@dataclass(frozen=True)
class CordCandidate:
    cord_split: str
    cord_index: int
    row: Mapping[str, object]
    raw_total: str
    total: int | None
    is_decimal_check: bool


def extract_total(gt_parse: object) -> int | None:
    """Extract a plain Indonesian integer-rupiah amount from CORD gt_parse."""
    if gt_parse is None:
        return None
    if isinstance(gt_parse, str):
        if not gt_parse.strip():
            return None
        try:
            parsed = json.loads(gt_parse)
        except json.JSONDecodeError:
            return None
        gt_parse = parsed
    if not isinstance(gt_parse, Mapping):
        return None

    total = gt_parse.get("total")
    if not isinstance(total, Mapping):
        return None
    value = total.get("total_price")
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None
    text = re.sub(r"(?i)^(\s*)(rp|idr)\s*", "", text, count=1)
    text = text.replace("\u00a0", "").replace(" ", "")
    if not text or not re.fullmatch(r"[0-9][0-9.,]*", text):
        return None

    if "." in text and "," in text:
        if re.search(r"[.,]\d{1,2}$", text):
            return None
        digits = re.sub(r"[.,]", "", text)
        if not digits.isdigit():
            return None
        return int(digits)

    separator = "." if "." in text else "," if "," in text else None
    if separator is not None:
        parts = text.split(separator)
        if len(parts) == 1:
            return None
        if all(len(part) in (1, 2) for part in parts[1:]):
            return None
        if len(parts[-1]) in (1, 2) and len(parts) == 2:
            return None
        if parts[0] and all(part.isdigit() and len(part) == 3 for part in parts[1:]):
            digits = "".join(parts)
            return int(digits)
        return None

    if text.isdigit():
        return int(text)
    return None


def is_decimal_amount(raw: str) -> bool:
    text = raw.strip()
    text = re.sub(r"(?i)^(\s*)(rp|idr)\s*", "", text, count=1)
    text = text.replace("\u00a0", "").replace(" ", "")
    if not text or not re.search(r"\d", text):
        return False
    if "." not in text and "," not in text:
        return False
    return bool(re.search(r"[.,]\d{1,2}$", text))


def raw_total_from_row(row: Mapping[str, object]) -> str:
    ground_truth = row.get("ground_truth")
    if isinstance(ground_truth, str):
        try:
            ground_truth = json.loads(ground_truth)
        except json.JSONDecodeError:
            return ""
    if not isinstance(ground_truth, Mapping):
        return ""
    gt_parse = ground_truth.get("gt_parse")
    if isinstance(gt_parse, str):
        try:
            gt_parse = json.loads(gt_parse)
        except json.JSONDecodeError:
            return ""
    if not isinstance(gt_parse, Mapping):
        return ""
    total = gt_parse.get("total")
    if not isinstance(total, Mapping):
        return ""
    value = total.get("total_price")
    return value if isinstance(value, str) else ""


def get_gt_parse(row: Mapping[str, object]) -> object:
    ground_truth = row.get("ground_truth")
    if isinstance(ground_truth, str):
        try:
            ground_truth = json.loads(ground_truth)
        except json.JSONDecodeError:
            return None
    if not isinstance(ground_truth, Mapping):
        return None
    return ground_truth.get("gt_parse")


def flatten_dataset(dataset: object) -> list[tuple[str, int, Mapping[str, object]]]:
    rows: list[tuple[str, int, Mapping[str, object]]] = []
    if isinstance(dataset, Mapping):
        split_items = dataset.items()
    else:
        split_items = getattr(dataset, "items", lambda: [])()
    for split_name, split in split_items:
        for index, row in enumerate(split):
            if isinstance(row, Mapping):
                rows.append((str(split_name), index, row))
    rows.sort(key=lambda item: (item[0], item[1]))
    return rows


def build_candidates(
    rows: Iterable[tuple[str, int, Mapping[str, object]]],
    excluded: set[tuple[str, int]] | None = None,
) -> tuple[list[CordCandidate], int]:
    excluded = excluded or set()
    candidates: list[CordCandidate] = []
    skipped_missing = 0
    for split_name, index, row in rows:
        if (split_name, index) in excluded:
            continue
        raw = raw_total_from_row(row)
        gt_parse = get_gt_parse(row)
        total = extract_total(gt_parse)
        if not raw.strip():
            skipped_missing += 1
            continue
        if total is None and not is_decimal_amount(raw):
            skipped_missing += 1
            continue
        candidates.append(
            CordCandidate(
                cord_split=split_name,
                cord_index=index,
                row=row,
                raw_total=raw,
                total=total,
                is_decimal_check=total is None and is_decimal_amount(raw),
            )
        )
    return candidates, skipped_missing


def select_deterministic(
    candidates: Sequence[CordCandidate],
    count: int,
    seed: int,
) -> list[CordCandidate]:
    selected = list(candidates)
    random.Random(seed).shuffle(selected)
    return selected[:count]


def assign_splits(selected: Sequence[CordCandidate], dev_count: int) -> list[tuple[CordCandidate, str]]:
    return [
        (candidate, "dev" if position < dev_count else "test")
        for position, candidate in enumerate(selected)
    ]


def atomic_append_csv(path: Path, header: Sequence[str], rows: Sequence[Sequence[object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_bytes() if path.exists() else b""
    with tempfile.NamedTemporaryFile(
        mode="wb",
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
        delete=False,
    ) as temporary:
        temporary.write(existing)
        if existing and not existing.endswith(b"\n"):
            temporary.write(b"\n")
        import io

        text = io.StringIO()
        writer = csv.writer(text, lineterminator="\n")
        if not existing:
            writer.writerow(header)
        writer.writerows(rows)
        temporary.write(text.getvalue().encode("utf-8"))
        temp_path = Path(temporary.name)
    temp_path.replace(path)


def read_existing_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def existing_cord_counts(path: Path) -> Counter[str]:
    rows = read_existing_csv(path)
    counts: Counter[str] = Counter()
    for row in rows:
        split_name = row.get("cord_split", "")
        counts[split_name] += 1
    return counts


def next_image_number(receipts_dir: Path, ground_truth_path: Path, provenance_path: Path) -> int:
    numbers = [
        int(match.group(1))
        for path in receipts_dir.glob("cord_*.png")
        if (match := re.fullmatch(r"cord_(\d+)\.png", path.name))
    ]
    if provenance_path.exists():
        for row in read_existing_csv(provenance_path):
            filename = row.get("filename", "")
            if match := re.fullmatch(r"cord_(\d+)\.png", filename):
                numbers.append(int(match.group(1)))
    if ground_truth_path.exists():
        for row in read_existing_csv(ground_truth_path):
            filename = row.get("filename", "")
            if match := re.fullmatch(r"cord_(\d+)\.png", filename):
                numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def load_dataset(cache_dir: Path):
    print(f"Downloading CORD dataset into {cache_dir}")
    print("Warning: the download size should be checked on a metered connection.")
    try:
        from datasets import load_dataset
    except ImportError as error:
        raise RuntimeError(
            "Missing data-script dependency 'datasets'. Install scripts/data/requirements.txt."
        ) from error
    return load_dataset(CORD_DATASET, cache_dir=str(cache_dir))


def write_selected_images(
    selected: Sequence[CordCandidate],
    receipts_dir: Path,
    start_number: int,
) -> list[tuple[CordCandidate, str]]:
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError(
            "Missing data-script dependency 'Pillow'. Install scripts/data/requirements.txt."
        ) from error

    receipts_dir.mkdir(parents=True, exist_ok=True)
    written: list[tuple[CordCandidate, str]] = []
    for offset, candidate in enumerate(selected):
        filename = f"cord_{start_number + offset:04d}.png"
        path = receipts_dir / filename
        if path.exists():
            raise FileExistsError(f"Refusing to overwrite existing file: {path}")
        image = candidate.row.get("image")
        if not isinstance(image, Image.Image):
            raise TypeError(f"CORD image is not a PIL image for {candidate.cord_split}[{candidate.cord_index}]")
        image.save(path, format="PNG")
        written.append((candidate, filename))
    return written


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a deterministic CORD subset")
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--dev", type=int, required=True)
    parser.add_argument("--test", type=int, required=True)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=Path("data"))
    parser.add_argument("--force-new-batch", action="store_true")
    args = parser.parse_args(argv)
    if args.count < 0 or args.dev < 0 or args.test < 0:
        parser.error("--count, --dev, and --test must be non-negative")
    if args.dev + args.test != args.count:
        parser.error("--dev plus --test must equal --count")
    return args


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    provenance_path = args.out / "cord_provenance.csv"
    ground_truth_path = args.out / "ground_truth.csv"
    receipts_dir = args.out / "receipts"

    existing = read_existing_csv(provenance_path)
    if existing and not args.force_new_batch:
        counts = existing_cord_counts(provenance_path)
        print(
            f"Refusing to run: {provenance_path} already contains {len(existing)} row(s). "
            f"Existing split counts: {dict(sorted(counts.items()))}"
        )
        print("Pass --force-new-batch to add another batch.")
        return 2

    excluded: set[tuple[str, int]] = set()
    if args.force_new_batch:
        for row in existing:
            split_name = row.get("cord_split")
            index_text = row.get("cord_index")
            if split_name and index_text:
                excluded.add((split_name, int(index_text)))

    dataset = load_dataset(args.out / ".hf-cache")
    rows = flatten_dataset(dataset)
    candidates, skipped_missing = build_candidates(rows, excluded)
    selected = select_deterministic(candidates, args.count, args.seed)
    if len(selected) < args.count:
        print(
            f"Only {len(selected)} usable receipt(s) are available; "
            f"{args.count} were requested."
        )
        return 3

    start_number = next_image_number(receipts_dir, ground_truth_path, provenance_path)
    written = write_selected_images(selected, receipts_dir, start_number)

    ground_rows: list[list[object]] = []
    provenance_rows: list[list[object]] = []
    assignments = assign_splits(selected, args.dev)
    for (candidate, split_name), (_, filename) in zip(assignments, written):
        ground_rows.append([
            filename,
            "",
            "",
            candidate.total if candidate.total is not None else "",
            split_name,
            "",
        ])
        provenance_rows.append([
            filename,
            candidate.cord_split,
            candidate.cord_index,
            candidate.raw_total,
        ])

    atomic_append_csv(ground_truth_path, GROUND_TRUTH_HEADER, ground_rows)
    atomic_append_csv(provenance_path, PROVENANCE_HEADER, provenance_rows)

    split_counts = Counter(
        "dev" if position < args.dev else "test"
        for position in range(len(written))
    )
    manual_checks = sum(candidate.is_decimal_check for candidate, _ in written)
    print(f"Selected per split: dev={split_counts['dev']}, test={split_counts['test']}")
    print(f"Receipts skipped for a missing total: {skipped_missing}")
    print(f"Rows that need a manual check: {manual_checks}")
    print(f"Paths written: {receipts_dir}, {ground_truth_path}, {provenance_path}")
    print("Reminder: keep the CORD attribution in docs/DATASETS.md.")
    print("Reminder: verify CORD totals against the source image before using labels.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
