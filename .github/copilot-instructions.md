# SpendWise – Copilot instructions

## Project
SpendWise turns receipt photos into validated, categorized expense data.
Flow: upload -> Express saves image + Receipt(UPLOADED) -> worker calls FastAPI OCR
-> parse + validate + duplicate check -> NEEDS_REVIEW -> user corrects -> CONFIRMED -> analytics.
The source of truth for schema and endpoints is docs/SPEC.md. Follow it exactly.
If something is missing or conflicts, ask instead of inventing.

## Stack
- web/: React + TypeScript + Vite, Tailwind, ShadCN, Recharts, TanStack Query
- api/: Node.js + Express + TypeScript, Prisma, PostgreSQL, JWT (access + refresh)
- ocr/: Python 3.11, FastAPI, OpenCV, Tesseract (pytesseract), PaddleOCR
- Docker Compose runs web, api, ocr, db

## Conventions
- TypeScript strict, no `any`. Validate every request body with Zod.
- Error format: {"error":{"code","message","details"}}
- Money is integer rupiah. Dates are ISO strings in the API.
- Thin controllers, logic in services/, one file per route group.
- Python: type hints, pydantic models, each preprocessing step is a pure function
  that can be toggled through a config object.
- Tests: Vitest + Supertest (api), pytest (ocr). Every new endpoint or rule ships with tests.
- Small changes only. Do not refactor unrelated code.

## Rules
- Never hardcode secrets. Read from env and update .env.example.
- Never commit receipt images. Datasets live in data/ (gitignored).
- Do NOT change OCR preprocessing, parsing heuristics, validation rules, or duplicate
  thresholds unless the task explicitly says so. The developer writes these on purpose.
- When unsure, list your assumptions before coding.