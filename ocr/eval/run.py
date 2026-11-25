import argparse
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Sequence

from app.engines import available_engines
from eval.core import evaluate


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate OCR against labels")
    parser.add_argument("--engine", required=True, choices=available_engines())
    parser.add_argument("--preprocess", required=True, type=Path)
    parser.add_argument("--split", required=True, choices=("dev", "test"))
    parser.add_argument("--label", required=True)
    parser.add_argument("--merchant-threshold", type=float, default=0.8)
    parser.add_argument("--confirm-test", action="store_true")
    args = parser.parse_args(argv)
    if args.split == "test" and not args.confirm_test:
        parser.error("--split test requires --confirm-test")
    if not 0 <= args.merchant_threshold <= 1:
        parser.error("--merchant-threshold must be between 0 and 1")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", args.label) or args.label in {
        ".",
        "..",
    }:
        parser.error("--label may contain only letters, numbers, '.', '_' and '-'")
    return args


def render_markdown(summary: dict[str, object], label: str) -> str:
    metrics = summary["metrics"]
    assert isinstance(metrics, dict)
    rows: list[tuple[str, str, str]] = []
    for name, title in (
        ("total_accuracy", "Total exact-match accuracy"),
        ("date_accuracy", "Date exact-match accuracy"),
        ("merchant_accuracy", "Merchant accuracy"),
    ):
        metric = metrics[name]
        assert isinstance(metric, dict)
        rate = metric["accuracy"]
        value = "N/A" if rate is None else f"{rate:.1%}"
        rows.append((title, value, str(metric["used"])))

    cer = metrics["character_error_rate"]
    assert isinstance(cer, dict)
    cer_rate = cer["rate"]
    rows.append(
        (
            "Character error rate",
            "N/A" if cer_rate is None else f"{cer_rate:.1%}",
            str(cer["used"]),
        )
    )
    rows.extend(
        [
            (
                "Median seconds per receipt",
                f"{metrics['median_seconds_per_receipt']:.3f}",
                str(summary["receipts"]),
            ),
            ("Failures", str(summary["failures"]), str(summary["receipts"])),
        ]
    )
    table = [
        f"# OCR evaluation: {label}",
        "",
        f"- Engine: `{summary['engine']}`",
        f"- Split: `{summary['split']}`",
        f"- Receipts: {summary['receipts']}",
        f"- Merchant similarity threshold: {summary['merchant_threshold']}",
        "",
        "| Metric | Result | Rows used |",
        "| --- | ---: | ---: |",
    ]
    table.extend(f"| {name} | {value} | {used} |" for name, value, used in rows)
    return "\n".join(table) + "\n"


def write_reports(
    summary: dict[str, object],
    errors: list[dict[str, str]],
    label: str,
    output_dir: Path,
    timestamp: datetime | None = None,
) -> tuple[Path, Path, Path, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    date_stamp = (timestamp or datetime.now()).strftime("%Y%m%d-%H%M%S")
    stem = f"{date_stamp}-{label}"
    markdown_path = output_dir / f"{stem}.md"
    json_path = output_dir / f"{stem}.json"
    errors_path = output_dir / f"{stem}-errors.csv"
    markdown = render_markdown(summary, label)

    markdown_path.write_text(markdown, encoding="utf-8")
    json_path.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    with errors_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=("filename", "field", "expected", "predicted", "error"),
        )
        writer.writeheader()
        writer.writerows(errors)
    return markdown_path, json_path, errors_path, markdown


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        preprocess_config = json.loads(args.preprocess.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Unable to read preprocessing config: {error}") from error
    if not isinstance(preprocess_config, dict):
        raise SystemExit("Preprocessing config must contain a JSON object")

    try:
        summary, errors = evaluate(
            ground_truth_path=Path("data/ground_truth.csv"),
            receipts_dir=Path("data/receipts"),
            split=args.split,
            engine_name=args.engine,
            preprocess_config=preprocess_config,
            merchant_threshold=args.merchant_threshold,
        )
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
    summary["label"] = args.label
    summary["preprocess"] = str(args.preprocess)
    _, _, _, markdown = write_reports(
        summary,
        errors,
        args.label,
        Path("eval-results"),
    )
    print(markdown, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
