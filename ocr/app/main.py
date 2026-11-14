import os

from fastapi import FastAPI

app = FastAPI(title="SpendWise OCR")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("OCR_PORT", "8000")))

