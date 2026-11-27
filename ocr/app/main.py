import json
import os

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.engines import available_engines
from app.images import decode_image
from app.models import (
    HealthResponse,
    OcrExtractResponse,
    OcrField,
    OcrFields,
    PHashResponse,
)
from app.pipeline import run_pipeline

app = FastAPI(title="SpendWise OCR")


@app.exception_handler(HTTPException)
async def http_exception_handler(
    _request: Request,
    exc: HTTPException,
) -> JSONResponse:
    code = "VALIDATION_ERROR" if exc.status_code == 422 else "HTTP_ERROR"
    details = exc.detail if isinstance(exc.detail, dict) else None
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            }
        },
    )


@app.post("/ocr/extract", response_model=OcrExtractResponse)
async def extract(
    image: UploadFile = File(...),
    engine: str = Form(...),
    preprocess: str = Form(...),
) -> OcrExtractResponse:
    if engine not in available_engines():
        raise HTTPException(
            status_code=422,
            detail=f"Unknown OCR engine: {engine}",
        )

    try:
        preprocess_config = json.loads(preprocess)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=422,
            detail="Preprocessing configuration must be valid JSON",
        ) from error
    if not isinstance(preprocess_config, dict):
        raise HTTPException(
            status_code=422,
            detail="Preprocessing configuration must be a JSON object",
        )

    contents = await image.read()
    decoded = decode_image(contents)
    result = run_pipeline(decoded, engine, preprocess_config)

    return OcrExtractResponse(
        engine=result.engine,
        durationMs=result.duration_ms,
        confidence=result.confidence,
        rawText=result.raw_text,
        fields=OcrFields(
            merchant=OcrField(
                value=result.merchant,
                confidence=result.merchant_confidence,
            ),
            date=OcrField(value=result.date, confidence=result.date_confidence),
            total=OcrField(
                value=result.total,
                confidence=result.total_confidence,
            ),
            items=[
                {
                    "name": item.name,
                    "qty": item.qty,
                    "lineTotal": item.line_total,
                    "confidence": 0.0,
                }
                for item in result.items
            ],
        ),
        warnings=[],
    )


@app.post("/image/phash", response_model=PHashResponse)
async def perceptual_hash(image: UploadFile = File(...)) -> PHashResponse:
    decoded = decode_image(await image.read())
    gray = cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    dct = cv2.dct(resized.astype(np.float32))
    low_frequency = dct[:8, :8]
    bits = low_frequency.flatten()
    median = float(np.median(bits))
    hash_value = sum(
        1 << index
        for index, value in enumerate(bits)
        if value > median
    )
    return PHashResponse(phash=f"{hash_value:016x}")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", engines=available_engines())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("OCR_PORT", "8000")))

