from typing import Literal

from pydantic import BaseModel, Field


class OcrField(BaseModel):
    value: str | int | None = None
    confidence: float | None = None


class OcrItem(BaseModel):
    name: str
    qty: float
    lineTotal: int
    confidence: float


class OcrFields(BaseModel):
    merchant: OcrField
    date: OcrField
    total: OcrField
    items: list[OcrItem] = Field(default_factory=list)


class OcrExtractResponse(BaseModel):
    engine: str
    durationMs: int
    confidence: float
    rawText: str
    fields: OcrFields
    warnings: list[str] = Field(default_factory=list)


class PHashResponse(BaseModel):
    phash: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    engines: list[str]
