import time
from dataclasses import dataclass, field
from typing import Mapping

import numpy as np

from app.engines import get_engine
from app.parser import ParsedItem, parse_receipt


@dataclass(frozen=True)
class ExtractResult:
    engine: str
    duration_ms: int
    confidence: float
    raw_text: str
    merchant: str | None = None
    date: str | None = None
    total: int | None = None
    items: list[ParsedItem] = field(default_factory=list)
    merchant_confidence: float = 0.0
    date_confidence: float = 0.0
    total_confidence: float = 0.0


def run_pipeline(
    image: np.ndarray,
    engine_name: str,
    preprocess_config: Mapping[str, object],
) -> ExtractResult:
    # Preserve the endpoint's current no-op preprocessing behavior.
    del preprocess_config
    start = time.perf_counter()
    result = get_engine(engine_name).extract(image)
    duration_ms = int((time.perf_counter() - start) * 1000)
    fields = parse_receipt(result.raw_text)
    return ExtractResult(
        engine=engine_name,
        duration_ms=duration_ms,
        confidence=result.confidence,
        raw_text=result.raw_text,
        merchant=fields.merchant,
        date=fields.date,
        total=fields.total,
        items=fields.items,
        merchant_confidence=0.0,
        date_confidence=0.0,
        total_confidence=0.0,
    )
