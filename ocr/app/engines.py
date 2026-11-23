from dataclasses import dataclass
from typing import Protocol

import numpy as np
import pytesseract


@dataclass(frozen=True)
class OcrResult:
    raw_text: str
    confidence: float


class OcrEngine(Protocol):
    def extract(self, image: np.ndarray) -> OcrResult:
        ...


class TesseractEngine:
    def extract(self, image: np.ndarray) -> OcrResult:
        raw_text = pytesseract.image_to_string(
            image,
            lang="ind+eng",
            config="--psm 6",
        ).strip()
        data = pytesseract.image_to_data(
            image,
            lang="ind+eng",
            config="--psm 6",
            output_type=pytesseract.Output.DICT,
        )
        confidences = [
            float(value)
            for value in data["conf"]
            if float(value) >= 0
        ]
        confidence = (
            sum(confidences) / len(confidences) / 100
            if confidences
            else 0.0
        )
        return OcrResult(raw_text=raw_text, confidence=confidence)


_ENGINES: dict[str, OcrEngine] = {
    "tesseract": TesseractEngine(),
}


def get_engine(name: str) -> OcrEngine:
    if name not in _ENGINES:
        raise KeyError(name)
    return _ENGINES[name]


def available_engines() -> list[str]:
    return sorted(_ENGINES)
