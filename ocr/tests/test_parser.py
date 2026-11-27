import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from app.engines import OcrResult
from app.parser import (
    ParsedFields,
    ParsedItem,
    parse_date,
    parse_items,
    parse_merchant,
    parse_receipt,
    parse_total,
)
from app.parser.text import normalize_idr, normalize_text, split_lines
from app.pipeline import run_pipeline


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "parser_cases.json"
PARSER_CASES: list[dict[str, Any]] = json.loads(
    FIXTURE_PATH.read_text(encoding="utf-8")
)
PARSER_FUNCTIONS = {
    "merchant": parse_merchant,
    "date": parse_date,
    "total": parse_total,
    "items": parse_items,
}
PARSER_PARAMETERS = [
    (case, field)
    for case in PARSER_CASES
    for field in ("merchant", "date", "total", "items")
    if field in case["expected"]
]


@pytest.mark.parametrize(
    ("case", "field"),
    PARSER_PARAMETERS,
    ids=[f"{case['name']}-{field}" for case, field in PARSER_PARAMETERS],
)
def test_parser_fixtures(case: dict[str, Any], field: str) -> None:
    parsed = parse_receipt(case["raw_text"])
    actual = getattr(parsed, field)
    expected = case["expected"][field]
    if field == "items":
        actual = [
            {
                "name": item.name,
                "qty": item.qty,
                "line_total": item.line_total,
            }
            for item in actual
        ]
    if actual != expected:
        parser_function = PARSER_FUNCTIONS[field]
        if parser_function.__doc__ and "TODO:" in parser_function.__doc__:
            pytest.xfail("not implemented yet")
        pytest.fail(
            f"{case['name']} {field}: expected {expected!r}, got {actual!r}"
        )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (" Rp 4O.5O0 \x00", "Rp 40.500"),
        ("MODEL 1O\nITEM l1", "MODEL 10 ITEM 11"),
        ("O l", "O l"),
        ("A\tB\r\nC", "A B C"),
        ("\x00\x01", ""),
    ],
)
def test_normalize_text(raw: str, expected: str) -> None:
    assert normalize_text(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("47.500", 47500),
        ("47,500", 47500),
        ("Rp 47.500,00", 47500),
        ("IDR 1,250,000", 1250000),
        ("47500.00", 47500),
        ("RP 4O.5O0", 40500),
    ],
)
def test_normalize_idr(raw: str, expected: int) -> None:
    assert normalize_idr(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["", "Rp", "47,50", "47.500,25", "12,34,567"],
)
def test_normalize_idr_rejects_invalid_amounts(raw: str) -> None:
    with pytest.raises(ValueError, match="Invalid IDR amount"):
        normalize_idr(raw)


def test_split_lines_preserves_receipt_rows_and_skips_blanks() -> None:
    assert split_lines("  INDOMARET \r\n\r\nRp 4O.5O0\t\n") == [
        "INDOMARET",
        "Rp 40.500",
    ]


def test_pipeline_uses_parser_fields_and_zero_confidences(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeEngine:
        def extract(self, _image: Any) -> OcrResult:
            return OcrResult(
                raw_text="raw receipt",
                confidence=0.8,
                merchant="ENGINE VALUE",
            )

    parsed = ParsedFields(
        merchant="PARSED MERCHANT",
        date="2026-11-08",
        total=47500,
        items=[ParsedItem(name="WATER", qty=1, line_total=47500)],
    )
    monkeypatch.setattr("app.pipeline.get_engine", lambda _name: FakeEngine())
    monkeypatch.setattr("app.pipeline.parse_receipt", lambda _text: parsed)

    result = run_pipeline(np.zeros((1, 1, 3)), "tesseract", {})

    assert result.merchant == "PARSED MERCHANT"
    assert result.date == "2026-11-08"
    assert result.total == 47500
    assert result.items == parsed.items
    assert result.merchant_confidence == 0.0
    assert result.date_confidence == 0.0
    assert result.total_confidence == 0.0
