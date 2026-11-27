import argparse
import json
import re
import sys
from pathlib import Path
from typing import Sequence

from app.engines import available_engines
from app.images import decode_image
from app.pipeline import run_pipeline


def validate_filename(filename: str) -> str:
    if (
        not filename
        or filename in {".", ".."}
        or "/" in filename
        or "\\" in filename
    ):
        raise argparse.ArgumentTypeError(
            "filename must be a single name without path separators"
        )
    return filename


def validate_preset(preset: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", preset) or preset in {".", ".."}:
        raise argparse.ArgumentTypeError(
            "preset may contain only letters, numbers, '.', '_' and '-'"
        )
    return preset


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Print raw OCR text for a receipt")
    parser.add_argument("filename", type=validate_filename)
    parser.add_argument("--preset", type=validate_preset, default="none")
    parser.add_argument(
        "--engine",
        choices=available_engines(),
        default="tesseract",
    )
    parser.add_argument("--json", action="store_true")
    return parser.parse_args(argv)


def load_preprocess_config(preset: str) -> dict[str, object]:
    path = Path("configs") / f"{preset}.json"
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Unable to read preprocessing config: {error}") from error
    if not isinstance(config, dict):
        raise SystemExit("Preprocessing config must contain a JSON object")
    return config


def extract_raw_text(filename: str, preset: str, engine: str) -> str:
    preprocess_config = load_preprocess_config(preset)
    image_path = Path("data") / "receipts" / validate_filename(filename)
    image = decode_image(image_path.read_bytes())
    return run_pipeline(image, engine, preprocess_config).raw_text


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    raw_text = extract_raw_text(args.filename, args.preset, args.engine)
    if args.json:
        print(json.dumps(raw_text, ensure_ascii=False))
    else:
        sys.stdout.write(raw_text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
