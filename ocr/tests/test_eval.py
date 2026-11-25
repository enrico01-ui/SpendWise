import csv
import json
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.engines import OcrResult
from eval.core import evaluate, levenshtein_distance
from eval.run import parse_args, write_reports


class FakeEngine:
    def extract(self, image: np.ndarray) -> OcrResult:
        marker = int(image[0, 0, 0])
        if marker == 10:
            return OcrResult(
                raw_text="ABC",
                confidence=1.0,
                merchant=" shop  one ",
                date="2026-01-02",
                total=100,
            )
        if marker == 20:
            return OcrResult(
                raw_text="ABX",
                confidence=1.0,
                merchant="OTHER",
                date="2026-01-03",
                total=99,
            )
        if marker == 30:
            return OcrResult(raw_text="", confidence=0.0)
        raise RuntimeError("fake OCR failure")


def write_receipt(path: Path, marker: int) -> None:
    image = np.full((8, 8, 3), marker, dtype=np.uint8)
    encoded_ok, encoded = cv2.imencode(".png", image)
    assert encoded_ok
    path.write_bytes(encoded.tobytes())


def write_ground_truth(path: Path) -> None:
    rows = [
        {
            "filename": "right.png",
            "merchant": "SHOP ONE",
            "date": "2026-01-02",
            "total": "100",
            "split": "dev",
            "full_text": "ABC",
        },
        {
            "filename": "wrong.png",
            "merchant": "ABC MART",
            "date": "2026-01-02",
            "total": "100",
            "split": "dev",
            "full_text": "ABC",
        },
        {
            "filename": "empty.png",
            "merchant": "",
            "date": "",
            "total": "",
            "split": "dev",
            "full_text": "",
        },
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def test_evaluate_calculates_metrics_and_skips_empty_labels(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import engines

    receipts_dir = tmp_path / "receipts"
    receipts_dir.mkdir()
    write_receipt(receipts_dir / "right.png", 10)
    write_receipt(receipts_dir / "wrong.png", 20)
    write_receipt(receipts_dir / "empty.png", 30)
    ground_truth = tmp_path / "ground_truth.csv"
    write_ground_truth(ground_truth)
    monkeypatch.setitem(engines._ENGINES, "tesseract", FakeEngine())

    summary, errors = evaluate(
        ground_truth,
        receipts_dir,
        "dev",
        "tesseract",
        {},
        0.8,
    )

    metrics = summary["metrics"]
    assert metrics["merchant_accuracy"] == {"accuracy": 0.5, "used": 2}
    assert metrics["date_accuracy"] == {"accuracy": 0.5, "used": 2}
    assert metrics["total_accuracy"] == {"accuracy": 0.5, "used": 2}
    assert metrics["character_error_rate"] == {
        "rate": 1 / 6,
        "used": 2,
        "reference_characters": 6,
    }
    assert metrics["median_seconds_per_receipt"] >= 0
    assert summary["failures"] == 0
    assert {error["field"] for error in errors} == {
        "merchant",
        "date",
        "total",
        "full_text",
    }


def test_evaluate_counts_pipeline_failures(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import engines

    receipts_dir = tmp_path / "receipts"
    receipts_dir.mkdir()
    write_receipt(receipts_dir / "right.png", 99)
    ground_truth = tmp_path / "ground_truth.csv"
    with ground_truth.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=("filename", "merchant", "date", "total", "split", "full_text"),
        )
        writer.writeheader()
        writer.writerow(
            {
                "filename": "right.png",
                "merchant": "SHOP",
                "date": "",
                "total": "",
                "split": "dev",
                "full_text": "",
            }
        )
    monkeypatch.setitem(engines._ENGINES, "tesseract", FakeEngine())

    summary, errors = evaluate(
        ground_truth,
        receipts_dir,
        "dev",
        "tesseract",
        {},
        0.8,
    )

    assert summary["failures"] == 1
    assert errors[0]["field"] == "failure"
    assert errors[1]["field"] == "merchant"


@pytest.mark.parametrize(
    ("reference", "predicted", "distance"),
    [
        ("", "", 0),
        ("", "abc", 3),
        ("abc", "", 3),
        ("kitten", "sitting", 3),
        ("receipt", "receipt", 0),
    ],
)
def test_levenshtein_edge_cases(
    reference: str,
    predicted: str,
    distance: int,
) -> None:
    assert levenshtein_distance(reference, predicted) == distance


def test_test_split_requires_explicit_confirmation() -> None:
    arguments = [
        "--engine",
        "tesseract",
        "--preprocess",
        "configs/none.json",
        "--split",
        "test",
        "--label",
        "baseline",
    ]

    with pytest.raises(SystemExit):
        parse_args(arguments)
    assert parse_args(arguments + ["--confirm-test"]).confirm_test is True


def test_reports_write_markdown_json_and_errors_csv(tmp_path: Path) -> None:
    summary = {
        "engine": "tesseract",
        "split": "dev",
        "receipts": 1,
        "failures": 0,
        "merchant_threshold": 0.8,
        "metrics": {
            "total_accuracy": {"accuracy": 1.0, "used": 1},
            "date_accuracy": {"accuracy": None, "used": 0},
            "merchant_accuracy": {"accuracy": 1.0, "used": 1},
            "character_error_rate": {
                "rate": 0.0,
                "used": 1,
                "reference_characters": 3,
            },
            "median_seconds_per_receipt": 0.1,
        },
    }
    markdown_path, json_path, errors_path, markdown = write_reports(
        summary,
        [],
        "baseline",
        tmp_path,
        datetime(2026, 11, 26, 1, 2, 3),
    )

    assert markdown_path.name == "20261126-010203-baseline.md"
    assert "| Date exact-match accuracy | N/A | 0 |" in markdown
    assert "| Total exact-match accuracy | 100.0% | 1 |" in markdown
    assert json.loads(json_path.read_text(encoding="utf-8")) == summary
    assert errors_path.read_text(encoding="utf-8").splitlines()[0] == (
        "filename,field,expected,predicted,error"
    )
