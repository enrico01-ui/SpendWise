import csv
import json
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import import_cord


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("45.000", 45000),
        ("45,000", 45000),
        ("Rp 45.000", 45000),
        ("1.346.000", 1346000),
        ("1,346,000", 1346000),
        ("45000", 45000),
        ("0", 0),
        ("", None),
        (None, None),
        ("45.50", None),
    ],
)
def test_extract_total_formats(value, expected):
    gt_parse = None if value is None else {"total": {"total_price": value}}
    assert import_cord.extract_total(gt_parse) == expected


def test_extract_total_missing_keys_and_json_string():
    assert import_cord.extract_total({}) is None
    assert import_cord.extract_total({"total": {}}) is None
    assert import_cord.extract_total(json.dumps({"total": {"total_price": "Rp 45.000"}})) == 45000
    assert import_cord.extract_total("not-json") is None


def make_candidate(split: str, index: int, raw: str = "45.000") -> import_cord.CordCandidate:
    row = {
        "image": Image.new("RGB", (2, 2), "white"),
        "ground_truth": json.dumps({"gt_parse": {"total": {"total_price": raw}}}),
    }
    total = import_cord.extract_total({"total": {"total_price": raw}})
    return import_cord.CordCandidate(
        cord_split=split,
        cord_index=index,
        row=row,
        raw_total=raw,
        total=total,
        is_decimal_check=import_cord.is_decimal_amount(raw),
    )


def test_deterministic_selection_and_split_counts():
    candidates = [make_candidate("train", index) for index in range(30)]
    first = import_cord.select_deterministic(candidates, 12, 42)
    second = import_cord.select_deterministic(candidates, 12, 42)
    assert [(item.cord_split, item.cord_index) for item in first] == [
        (item.cord_split, item.cord_index) for item in second
    ]
    assignments = import_cord.assign_splits(first, 7)
    assert sum(split == "dev" for _, split in assignments) == 7
    assert sum(split == "test" for _, split in assignments) == 5


def test_append_existing_csv_preserves_rows(tmp_path: Path):
    ground_truth = tmp_path / "ground_truth.csv"
    ground_truth.write_text(
        "filename,merchant,date,total,split,full_text\n"
        "r001.jpg,INDOMARET,2026-11-08,47500,dev,\n",
        encoding="utf-8",
    )

    import_cord.atomic_append_csv(
        ground_truth,
        import_cord.GROUND_TRUTH_HEADER,
        [["cord_0001.png", "", "", "45000", "test", ""]],
    )

    with ground_truth.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["filename"] == "r001.jpg"
    assert rows[0]["merchant"] == "INDOMARET"
    assert rows[1]["filename"] == "cord_0001.png"


def test_refuses_second_run_without_force(tmp_path: Path, monkeypatch):
    provenance = tmp_path / "cord_provenance.csv"
    import_cord.atomic_append_csv(
        provenance,
        import_cord.PROVENANCE_HEADER,
        [["cord_0001.png", "train", 1, "45.000"]],
    )

    def unexpected_load(_cache):
        raise AssertionError("dataset should not load after refusal")

    monkeypatch.setattr(import_cord, "load_dataset", unexpected_load)
    status = import_cord.main([
        "--count", "1",
        "--dev", "1",
        "--test", "0",
        "--out", str(tmp_path),
    ])
    assert status == 2
    assert len(import_cord.read_existing_csv(provenance)) == 1


def test_force_new_batch_excludes_existing_rows(tmp_path: Path):
    provenance = tmp_path / "cord_provenance.csv"
    import_cord.atomic_append_csv(
        provenance,
        import_cord.PROVENANCE_HEADER,
        [["cord_0001.png", "train", 0, "45.000"]],
    )
    excluded = {
        (row["cord_split"], int(row["cord_index"]))
        for row in import_cord.read_existing_csv(provenance)
    }
    rows = [
        ("train", 0, {"ground_truth": json.dumps({"gt_parse": {"total": {"total_price": "45.000"}}})}),
        ("train", 1, {"ground_truth": json.dumps({"gt_parse": {"total": {"total_price": "50.000"}}})}),
    ]
    candidates, _ = import_cord.build_candidates(rows, excluded)
    assert [(item.cord_split, item.cord_index) for item in candidates] == [("train", 1)]


def test_atomic_write_uses_replace(tmp_path: Path, monkeypatch):
    path = tmp_path / "ground_truth.csv"
    replace_calls = []
    original_replace = Path.replace

    def tracked_replace(source: Path, target: Path):
        replace_calls.append((source, target))
        assert source.exists()
        assert source.parent == target.parent
        return original_replace(source, target)

    monkeypatch.setattr(Path, "replace", tracked_replace)
    import_cord.atomic_append_csv(
        path,
        import_cord.GROUND_TRUTH_HEADER,
        [["cord_0001.png", "", "", "45000", "dev", ""]],
    )
    assert len(replace_calls) == 1
    assert replace_calls[0][1] == path


def test_dev_and_test_must_equal_count():
    with pytest.raises(SystemExit):
        import_cord.parse_args([
            "--count", "5",
            "--dev", "2",
            "--test", "2",
        ])
