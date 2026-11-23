import cv2
import numpy as np
import pytesseract
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def png_bytes(image: np.ndarray) -> bytes:
    success, encoded = cv2.imencode(".png", image)
    assert success
    return encoded.tobytes()


def test_health_lists_available_engines() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "engines": ["tesseract"]}


def test_extract_recognizes_synthetic_text_when_tesseract_is_available() -> None:
    try:
        pytesseract.get_tesseract_version()
    except (pytesseract.TesseractNotFoundError, RuntimeError):
        return

    image = np.full((160, 640, 3), 255, dtype=np.uint8)
    cv2.putText(
        image,
        "SPENDWISE",
        (55, 100),
        cv2.FONT_HERSHEY_SIMPLEX,
        2.0,
        (0, 0, 0),
        3,
        cv2.LINE_AA,
    )

    response = client.post(
        "/ocr/extract",
        data={"engine": "tesseract", "preprocess": "{}"},
        files={"image": ("receipt.png", png_bytes(image), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert "SPENDWISE" in body["rawText"].upper()
    assert body["engine"] == "tesseract"
    assert isinstance(body["durationMs"], int)
    assert 0 <= body["confidence"] <= 1
    assert body["fields"]["merchant"]["value"] is None
    assert body["fields"]["date"]["value"] is None
    assert body["fields"]["total"]["value"] is None
    assert body["fields"]["items"] == []
    assert body["warnings"] == []


def test_unknown_engine_returns_standard_422_error() -> None:
    image = np.full((100, 100, 3), 255, dtype=np.uint8)

    response = client.post(
        "/ocr/extract",
        data={"engine": "unknown", "preprocess": "{}"},
        files={"image": ("image.png", png_bytes(image), "image/png")},
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert set(error) == {"code", "message", "details"}
    assert error["code"] == "VALIDATION_ERROR"


def test_phash_is_stable_and_blur_has_small_hamming_distance() -> None:
    image = np.full((128, 128, 3), 255, dtype=np.uint8)
    cv2.circle(image, (64, 64), 32, (20, 20, 20), -1)
    cv2.putText(
        image,
        "TEST",
        (38, 72),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    def phash(source: np.ndarray) -> str:
        response = client.post(
            "/image/phash",
            files={"image": ("image.png", png_bytes(source), "image/png")},
        )
        assert response.status_code == 200
        return response.json()["phash"]

    original = phash(image)
    identical = phash(image)
    blurred = phash(cv2.GaussianBlur(image, (5, 5), 1.0))

    assert original == identical
    assert len(original) == 16
    distance = (int(original, 16) ^ int(blurred, 16)).bit_count()
    assert distance < 10
