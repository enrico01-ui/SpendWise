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

## Architecture (api)

The Express API is organized by module under `api/src`:

```text
src/
  app.ts
  server.ts
  config/env.ts
  database/prisma.ts
  common/
  modules/
    auth/
    receipts/
    health/
```

- `app.ts` exports `createApp()` with no listener or import-time side effects.
- `server.ts` creates the app, listens, and performs graceful shutdown.
- `config/env.ts` is the only file that reads `process.env`; startup configuration is validated with Zod and exported as a typed readonly object.
- `database/prisma.ts` owns the Prisma client.
- Modules contain `<name>.routes.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.schemas.ts`, and module tests/constants where needed.

Architecture rules:

- Routes only wire paths, middleware chains, and controller methods.
- Controllers read already-validated input, call exactly one service method, and set status and body.
- Controllers contain no Prisma access, business logic, validation, or `try/catch`.
- Services hold business logic and Prisma access, throw `AppError` subclasses, never import Express types, and never receive `req` or `res`.
- All Zod schemas live in `<module>.schemas.ts`, export inferred DTO types, and perform normalization.
- Configuration is accessed only through `config/env.ts`.
- Errors are created through `AppError` subclasses and formatted only by the global handler.
- Express 5 forwards rejected promises, so do not add `asyncHandler`.
- Keep module files under approximately 150 lines and use strict TypeScript without `any`.

## Definition of done

- Tests are added for new behavior and updated tests pass.
- `npm run typecheck` passes.
- Lint passes.
- Architecture rules above are satisfied.
- [docs/SPEC.md](../docs/SPEC.md) is updated when an API or data contract changes.