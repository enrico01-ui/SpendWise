import csv
import difflib
import time
from pathlib import Path
from statistics import median
from typing import Callable, Mapping

import numpy as np

from app.images import decode_image
from app.pipeline import ExtractResult, run_pipeline


REQUIRED_COLUMNS = {
    "filename",
    "merchant",
    "date",
    "total",
    "split",
    "full_text",
}

Pipeline = Callable[
    [np.ndarray, str, Mapping[str, object]],
    ExtractResult,
]


def levenshtein_distance(reference: str, predicted: str) -> int:
    if len(reference) < len(predicted):
        reference, predicted = predicted, reference
    previous = list(range(len(predicted) + 1))
    for row_index, reference_char in enumerate(reference, start=1):
        current = [row_index]
        for column_index, predicted_char in enumerate(predicted, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[column_index] + 1,
                    previous[column_index - 1]
                    + (reference_char != predicted_char),
                )
            )
        previous = current
    return previous[-1]


def normalize_merchant(value: str) -> str:
    return " ".join(value.upper().split())


def read_ground_truth(path: Path, split: str) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None or not REQUIRED_COLUMNS.issubset(
            reader.fieldnames
        ):
            missing = sorted(REQUIRED_COLUMNS - set(reader.fieldnames or []))
            raise ValueError(
                f"{path} is missing required columns: {', '.join(missing)}"
            )
        rows = list(reader)

    invalid_splits = sorted(
        {
            row.get("split", "")
            for row in rows
            if row.get("split", "") not in {"dev", "test"}
        }
    )
    if invalid_splits:
        raise ValueError(
            f"{path} contains unsupported split values: "
            f"{', '.join(invalid_splits)}"
        )
    selected = [row for row in rows if row["split"] == split]
    if not selected:
        raise ValueError(f"No ground-truth rows found for split '{split}'")
    for row in selected:
        filename = row.get("filename", "")
        if (
            not filename
            or filename in {".", ".."}
            or Path(filename).name != filename
            or "/" in filename
            or "\\" in filename
        ):
            raise ValueError(f"Invalid receipt filename: {filename!r}")
        total = row.get("total", "").strip()
        if total:
            try:
                int(total)
            except ValueError as error:
                raise ValueError(
                    f"Invalid integer total for {filename}: {total!r}"
                ) from error
    return selected


def evaluate(
    ground_truth_path: Path,
    receipts_dir: Path,
    split: str,
    engine_name: str,
    preprocess_config: Mapping[str, object],
    merchant_threshold: float,
    pipeline: Pipeline | None = None,
) -> tuple[dict[str, object], list[dict[str, str]]]:
    rows = read_ground_truth(ground_truth_path, split)
    extract = pipeline or run_pipeline
    field_counts = {"merchant": 0, "date": 0, "total": 0}
    field_correct = {"merchant": 0, "date": 0, "total": 0}
    cer_errors = 0
    cer_reference_characters = 0
    cer_used = 0
    durations: list[float] = []
    failures = 0
    errors: list[dict[str, str]] = []

    for row in rows:
        filename = row["filename"]
        expected_merchant = row.get("merchant", "").strip()
        expected_date = row.get("date", "")
        expected_total = row.get("total", "")
        expected_text = row.get("full_text", "")
        started = time.perf_counter()
        try:
            image = decode_image((receipts_dir / filename).read_bytes())
            result = extract(image, engine_name, preprocess_config)
        except Exception as error:
            failures += 1
            predicted_merchant = None
            predicted_date = None
            predicted_total = None
            predicted_text = ""
            errors.append(
                {
                    "filename": filename,
                    "field": "failure",
                    "expected": "successful OCR",
                    "predicted": "",
                    "error": f"{type(error).__name__}: {error}",
                }
            )
        else:
            predicted_merchant = result.merchant
            predicted_date = result.date
            predicted_total = result.total
            predicted_text = result.raw_text
        durations.append(time.perf_counter() - started)

        predictions = {
            "merchant": predicted_merchant,
            "date": predicted_date,
            "total": predicted_total,
        }
        for field, expected in (
            ("merchant", expected_merchant),
            ("date", expected_date),
            ("total", expected_total),
        ):
            if not expected:
                continue
            field_counts[field] += 1
            predicted = predictions[field]
            if field == "merchant":
                correct = (
                    predicted is not None
                    and difflib.SequenceMatcher(
                        None,
                        normalize_merchant(expected),
                        normalize_merchant(str(predicted)),
                    ).ratio()
                    >= merchant_threshold
                )
            elif field == "total":
                correct = (
                    predicted is not None
                    and str(predicted) == str(int(expected))
                )
            else:
                correct = predicted is not None and predicted == expected

            if correct:
                field_correct[field] += 1
            else:
                errors.append(
                    {
                        "filename": filename,
                        "field": field,
                        "expected": expected,
                        "predicted": "" if predicted is None else str(predicted),
                        "error": "",
                    }
                )

        if expected_text:
            cer_used += 1
            cer_errors += levenshtein_distance(expected_text, predicted_text)
            cer_reference_characters += len(expected_text)
            if expected_text != predicted_text:
                errors.append(
                    {
                        "filename": filename,
                        "field": "full_text",
                        "expected": expected_text,
                        "predicted": predicted_text,
                        "error": "",
                    }
                )

    metrics: dict[str, object] = {
        f"{field}_accuracy": {
            "accuracy": (
                field_correct[field] / field_counts[field]
                if field_counts[field]
                else None
            ),
            "used": field_counts[field],
        }
        for field in ("total", "date", "merchant")
    }
    metrics["character_error_rate"] = {
        "rate": (
            cer_errors / cer_reference_characters
            if cer_reference_characters
            else None
        ),
        "used": cer_used,
        "reference_characters": cer_reference_characters,
    }
    metrics["median_seconds_per_receipt"] = median(durations)
    summary: dict[str, object] = {
        "engine": engine_name,
        "split": split,
        "receipts": len(rows),
        "failures": failures,
        "merchant_threshold": merchant_threshold,
        "metrics": metrics,
    }
    return summary, errors
