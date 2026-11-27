"""Receipt field parsing scaffold and result types."""

from dataclasses import dataclass, field

from app.parser.text import normalize_idr, normalize_text, split_lines


@dataclass(frozen=True)
class ParsedItem:
    name: str
    qty: float
    line_total: int


@dataclass(frozen=True)
class ParsedFields:
    merchant: str | None = None
    date: str | None = None
    total: int | None = None
    items: list[ParsedItem] = field(default_factory=list)


def parse_merchant(raw_text: str) -> str | None:
    """TODO: Extract the top merchant as uppercase, excluding branch and address.

    Follow the SPEC merchant field; return None if the merchant is unreadable.
    """
    del raw_text
    return None


def parse_date(raw_text: str) -> str | None:
    """TODO: Extract the transaction date as YYYY-MM-DD, reading dates day-first.

    Prefer the transaction date over print time; interpret two-digit years as
    20xx, as required by the labeling convention and SPEC purchase-date field.
    """
    del raw_text
    return None


def parse_total(raw_text: str) -> int | None:
    """TODO: Extract the final amount payable as integer rupiah.

    Use the printed final payable total, never a TUNAI, CASH, KEMBALI, or CHANGE
    line. Follow the SPEC total field; return None when no total is readable.
    """
    del raw_text
    return None


def parse_items(raw_text: str) -> list[ParsedItem]:
    """TODO: Extract purchased item rows with name, quantity, and line total.

    Follow the SPEC items shape; do not treat TUNAI, CASH, KEMBALI, or CHANGE
    payment lines as purchased items. Return an empty list when none are found.
    """
    del raw_text
    return []


def parse_receipt(raw_text: str) -> ParsedFields:
    """Parse receipt text into the merchant, date, total, and item fields."""
    return ParsedFields(
        merchant=parse_merchant(raw_text),
        date=parse_date(raw_text),
        total=parse_total(raw_text),
        items=parse_items(raw_text),
    )


__all__ = [
    "ParsedFields",
    "ParsedItem",
    "normalize_idr",
    "normalize_text",
    "parse_date",
    "parse_items",
    "parse_merchant",
    "parse_receipt",
    "parse_total",
    "split_lines",
]
