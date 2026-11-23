import os
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.engines import available_engines, get_engine
from app.models import (
    HealthResponse,
    OcrExtractResponse,
    OcrField,
    OcrFields,
    PHashResponse,
)

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


def decode_image(contents: bytes) -> np.ndarray:
    image = cv2.imdecode(
        np.frombuffer(contents, dtype=np.uint8),
        cv2.IMREAD_UNCHANGED,
    )
    if image is None:
        raise HTTPException(status_code=422, detail="Invalid image")
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return image


@app.post("/ocr/extract", response_model=OcrExtractResponse)
async def extract(
    image: UploadFile = File(...),
    engine: str = Form(...),
    preprocess: str = Form(...),
) -> OcrExtractResponse:
    del preprocess
    if engine not in available_engines():
        raise HTTPException(
            status_code=422,
            detail=f"Unknown OCR engine: {engine}",
        )

    contents = await image.read()
    decoded = decode_image(contents)
    start = time.perf_counter()
    result = get_engine(engine).extract(decoded)
    duration_ms = int((time.perf_counter() - start) * 1000)

    return OcrExtractResponse(
        engine=engine,
        durationMs=duration_ms,
        confidence=result.confidence,
        rawText=result.raw_text,
        fields=OcrFields(
            merchant=OcrField(value=None, confidence=None),
            date=OcrField(value=None, confidence=None),
            total=OcrField(value=None, confidence=None),
            items=[],
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

