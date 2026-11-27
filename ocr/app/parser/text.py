"""Text cleanup helpers for OCR receipt parsing."""

import re
import unicodedata


_NUMERIC_TOKEN = re.compile(
    r"(?<!\w)(?=[0-9Ool.,]*\d)[0-9Ool]+(?:[.,][0-9Ool]+)*(?!\w)"
)
_CURRENCY_PREFIX = re.compile(r"^(?:rp\.?|idr)\s*", re.IGNORECASE)


def normalize_text(value: str) -> str:
    """Remove controls, normalize whitespace, and repair OCR digits in numbers."""
    cleaned = "".join(
        " " if char.isspace() else char
        for char in value
        if unicodedata.category(char) != "Cc" or char.isspace()
    )
    collapsed = re.sub(r"\s+", " ", cleaned).strip()

    def repair_numeric_token(match: re.Match[str]) -> str:
        return match.group().translate(
            str.maketrans({"O": "0", "o": "0", "l": "1"})
        )

    return _NUMERIC_TOKEN.sub(repair_numeric_token, collapsed)


def normalize_idr(value: str) -> int:
    """Normalize an IDR amount with dot/comma grouping and zero decimals."""
    normalized = normalize_text(value)
    amount = _CURRENCY_PREFIX.sub("", normalized).replace(" ", "")
    if not re.fullmatch(r"\d+(?:[.,]\d+)*", amount):
        raise ValueError(f"Invalid IDR amount: {value!r}")

    separators = [index for index, char in enumerate(amount) if char in ".,"]
    integer_amount = amount
    if separators:
        decimal_index = separators[-1]
        decimal_digits = amount[decimal_index + 1 :]
        if len(decimal_digits) == 2 and decimal_digits == "00":
            integer_amount = amount[:decimal_index]

    groups = re.split(r"[.,]", integer_amount)
    if len(groups) > 1 and (
        not 1 <= len(groups[0]) <= 3
        or any(len(group) != 3 for group in groups[1:])
    ):
        raise ValueError(f"Invalid IDR amount: {value!r}")
    return int("".join(groups))


def split_lines(raw_text: str) -> list[str]:
    """Return non-empty receipt lines with per-line whitespace normalized."""
    return [
        normalized
        for line in raw_text.splitlines()
        if (normalized := normalize_text(line))
    ]


__all__ = ["normalize_idr", "normalize_text", "split_lines"]
