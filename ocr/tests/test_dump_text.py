import argparse
import json
from pathlib import Path

import numpy as np
import pytest

from app.pipeline import ExtractResult
from eval import dump_text


@pytest.mark.parametrize(
    "filename",
    [
        "../r001.jpg",
        r"..\r001.jpg",
        "receipts/r001.jpg",
        r"receipts\r001.jpg",
    ],
)
def test_validate_filename_rejects_path_separators(filename: str) -> None:
    with pytest.raises(argparse.ArgumentTypeError, match="path separators"):
        dump_text.validate_filename(filename)


def test_dump_text_json_outputs_a_single_escaped_string(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "configs").mkdir()
    (tmp_path / "configs" / "none.json").write_text("{}", encoding="utf-8")
    receipts_dir = tmp_path / "data" / "receipts"
    receipts_dir.mkdir(parents=True)
    (receipts_dir / "r001.jpg").write_bytes(b"synthetic-image")
    raw_text = 'SHOP\nTOTAL "47.500"\\end'
    received: dict[str, object] = {}

    def fake_pipeline(
        image: np.ndarray,
        engine: str,
        preprocess_config: dict[str, object],
    ) -> ExtractResult:
        received["image"] = image
        received["engine"] = engine
        received["config"] = preprocess_config
        return ExtractResult(
            engine=engine,
            duration_ms=0,
            confidence=0.0,
            raw_text=raw_text,
        )

    monkeypatch.setattr(dump_text, "decode_image", lambda _contents: np.zeros((1, 1, 3)))
    monkeypatch.setattr(dump_text, "run_pipeline", fake_pipeline)

    assert dump_text.main(["r001.jpg", "--json"]) == 0

    assert received["engine"] == "tesseract"
    assert received["config"] == {}
    assert capsys.readouterr().out == json.dumps(raw_text, ensure_ascii=False) + "\n"
