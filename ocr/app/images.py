import cv2
import numpy as np
from fastapi import HTTPException


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
