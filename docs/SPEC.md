# SpendWise Specification

## Architecture

SpendWise turns receipt photos into validated, categorized expense data.

Flow:

1. Upload a receipt image.
2. Express saves the image and creates a `Receipt` with status `UPLOADED`.
3. A worker calls the internal FastAPI OCR service.
4. Express validates the OCR result and checks for duplicates.
5. A receipt enters `NEEDS_REVIEW` for user correction.
6. The user confirms the receipt as `CONFIRMED`.
7. Confirmed receipts are available to analytics.

Services communicate as follows:

- React and Express use the public `/api/v1` HTTP contract.
- Browser requests use same-origin proxies: Vite proxies `/api` in development and the web container proxies API traffic in Docker. CORS is disabled.
- Express is the only public application API and manages authentication, receipts, categories, analytics, budgets, and exports.
- Express calls FastAPI only over the internal Docker network.
- PostgreSQL is the persistent database.
- Receipt images are stored in a Docker volume.
- An upload is acknowledged immediately and processed asynchronously through receipt status polling.

## Architecture (api)

The Express API uses a module-based layout under `api/src`:

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

- `app.ts` exports `createApp()` and has no listen call or import-time side effects.
- `server.ts` creates the app, listens on the configured port, and shuts down gracefully.
- `config/env.ts` is the only file that reads `process.env`. It validates startup configuration with Zod and exports a typed readonly environment object.
- `database/prisma.ts` owns the Prisma client.
- `common/` contains shared errors, middleware, logging, and Express types.
- Each module owns its routes, controller, service, schemas, tests, and constants.

Rules:

- Routes only wire paths, middleware, and controller methods.
- Controllers read already-validated input, call exactly one service method, and set status and body.
- Controllers contain no Prisma calls, business logic, validation, or `try/catch`.
- Services hold business logic and Prisma access. They never import Express types or receive `req` or `res`; they receive plain values such as `userId` and DTOs.
- Zod schemas live in `<module>.schemas.ts`. Schemas infer and export DTO types. Normalization belongs in schemas, not routes or controllers.
- Configuration is read only through `config/env.ts`.
- Application errors use `AppError` subclasses and a global error handler.
- Express 5 forwards rejected promises, so routes and controllers must not use `asyncHandler`.

## Tech stack

| Component | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind, ShadCN, Recharts, TanStack Query |
| Public API | Node.js, Express, TypeScript, Prisma |
| Database | PostgreSQL |
| Authentication | JWT access and refresh tokens, bcrypt |
| OCR service | Python 3.11, FastAPI, OpenCV, Tesseract, PaddleOCR |
| Infrastructure | Docker Compose |
| HTTP security | Helmet, same-origin proxy design, CSRF header and origin checks, express-rate-limit |
| Logging | Pino and pino-http |
| API tests | Vitest and Supertest |
| OCR tests | pytest |

Money is stored and returned as integer rupiah. API dates use ISO strings.

## Database schema

The Prisma schema is the source of truth. It currently defines nine models:

- `User`
- `RefreshToken`
- `Category`
- `Receipt`
- `ReceiptItem`
- `OcrRun`
- `GroundTruth`
- `Correction`
- `Budget`

The following schema must match `api/prisma/schema.prisma` exactly:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum ReceiptStatus {
  UPLOADED
  PROCESSING
  NEEDS_REVIEW
  CONFIRMED
  FAILED
}

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String
  name         String
  role         Role       @default(USER)
  createdAt    DateTime   @default(now())
  receipts     Receipt[]
  categories   Category[]
  budgets      Budget[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Category {
  id       Int           @id @default(autoincrement())
  userId   String?
  name     String
  keywords String[]
  user     User?         @relation(fields: [userId], references: [id])
  receipts Receipt[]
  items    ReceiptItem[]
  budgets  Budget[]
  @@unique([userId, name])
}

model Receipt {
  id            String        @id @default(uuid())
  userId        String
  imagePath     String
  imageHash     String?
  status        ReceiptStatus @default(UPLOADED)
  processingAttempts Int       @default(0)
  nextAttemptAt DateTime?
  lastError     String?
  merchantName  String?
  purchaseDate  DateTime?     @db.Date
  totalAmount   Int?
  categoryId    Int?
  ocrConfidence Float?
  rawText       String?
  duplicateOfId String?
  confirmedAt   DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  user          User          @relation(fields: [userId], references: [id])
  category      Category?     @relation(fields: [categoryId], references: [id])
  duplicateOf   Receipt?      @relation("Duplicate", fields: [duplicateOfId], references: [id])
  duplicates    Receipt[]     @relation("Duplicate")
  items         ReceiptItem[]
  ocrRuns       OcrRun[]
  corrections   Correction[]
  groundTruth   GroundTruth?
  @@index([userId, purchaseDate(sort: Desc)])
  @@index([userId, status])
  @@index([imageHash])
}

model ReceiptItem {
  id         String    @id @default(uuid())
  receiptId  String
  name       String
  qty        Float     @default(1)
  unitPrice  Int?
  lineTotal  Int
  categoryId Int?
  receipt    Receipt   @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  category   Category? @relation(fields: [categoryId], references: [id])
  @@index([receiptId])
}

model OcrRun {
  id               String   @id @default(uuid())
  receiptId        String
  engine           String
  preprocessConfig Json
  rawText          String
  fields           Json
  durationMs       Int
  createdAt        DateTime @default(now())
  receipt          Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  @@index([receiptId])
}

model GroundTruth {
  id           String   @id @default(uuid())
  receiptId    String   @unique
  merchantName String
  purchaseDate DateTime @db.Date
  totalAmount  Int
  items        Json?
  split        String
  receipt      Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
}

model Correction {
  id             String   @id @default(uuid())
  receiptId      String
  field          String
  ocrValue       String?
  correctedValue String
  createdAt      DateTime @default(now())
  receipt        Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  @@index([receiptId])
}

model Budget {
  id          String   @id @default(uuid())
  userId      String
  categoryId  Int
  month       DateTime @db.Date
  limitAmount Int
  user        User     @relation(fields: [userId], references: [id])
  category    Category @relation(fields: [categoryId], references: [id])
  @@unique([userId, categoryId, month])
}
```

The `GroundTruth` model is retained in the schema. It is removed in the evaluation harness feature, meaning it is not used by or exposed through HTTP evaluation endpoints.

PostgreSQL additionally requires:

- The `pg_trgm` extension.
- A GIN trigram index on `Receipt.merchantName` for fuzzy matching.
- No unique constraint for visually or textually similar receipts.

Duplicates are indicated through `duplicateOfId`; two valid purchases on the same day remain separate receipts.

## Express API

Express routes use the `/api/v1` prefix. `/health` is a root-level health endpoint. Routes listed below are relative to `/api/v1` unless otherwise noted.

| Method | Path | Function | Success response |
| --- | --- | --- | --- |
| POST | `/auth/register` | Register an account | `201` |
| POST | `/auth/login` | Log in and return tokens | `200` |
| POST | `/auth/refresh` | Rotate a refresh token | `200` |
| GET | `/auth/me` | Get the authenticated profile | `200` |
| POST | `/receipts` | Upload a JPG or PNG, maximum 10 MB | `202 {id,status}` |
| GET | `/receipts` | List receipts with filters and pagination | `200` |
| GET | `/receipts/:id` | Get receipt fields, items, warnings, and duplicate information | `200` |
| GET | `/receipts/:id/image` | Get the original image; `?processed=true` gets the processed image | `200` |
| PATCH | `/receipts/:id` | Correct receipt fields and record corrections | `200` |
| PUT | `/receipts/:id/items` | Replace the full item list | `200` |
| POST | `/receipts/:id/confirm` | Confirm a receipt if validation passes | `200` |
| POST | `/receipts/:id/reprocess` | Re-run OCR with an engine or preprocessing options | `202` |
| POST | `/receipts/:id/resolve-duplicate` | Apply `{action:"keep"\|"discard"}` | `200` |
| DELETE | `/receipts/:id` | Delete a receipt and its image files | `204` |
| GET | `/categories` | List default and user categories | `200` |
| POST | `/categories` | Create a category with keywords | `201` |
| PATCH | `/categories/:id` | Update category name or keywords | `200` |
| DELETE | `/categories/:id` | Delete a user category | `204` |
| GET | `/analytics/summary` | Return totals and monthly averages | `200` |
| GET | `/analytics/by-category` | Return spending per category for a date range | `200` |
| GET | `/analytics/trend` | Return a weekly or monthly time series | `200` |
| GET | `/analytics/top-merchants` | Return merchants with the highest spending | `200` |
| GET | `/budgets` | Return budgets and realized spending for a month | `200` |
| PUT | `/budgets` | Set a category budget | `200` |
| GET | `/export/receipts.csv` | Export confirmed receipts | `200` |
| GET | `/health` | Health check | `200 {status:"ok"}` |
| GET | `/health/ready` | Database readiness check | `200 {status:"ready"}` or `503` |

Auth request bodies:

- Register: `{"email","password","name"}`
- Login: `{"email","password"}`
- Refresh: no request body

Register and login set `refresh_token` as an HttpOnly, SameSite=Strict cookie and return:

```json
{"user":{},"accessToken":"..."}
```

The refresh cookie is scoped to `Path=/api/v1/auth` and has a Max-Age equal to the refresh-token TTL. It is Secure in production or when `COOKIE_SECURE=true`. Refresh reads only the cookie, rotates it, and returns the same access-token/user JSON shape. Logout is `POST /api/v1/auth/logout`, is idempotent, revokes the cookie token, and clears the cookie.

Refresh and logout require `X-Requested-With: fetch`. If `Origin` is present, it must equal `APP_ORIGIN`.

- Access tokens are JWTs valid for 15 minutes.
- Refresh tokens are random 256-bit values stored only as SHA-256 hashes.
- Refresh tokens are valid for 7 days and rotate on every refresh.
- Reusing a revoked refresh token revokes every refresh token belonging to that user.
- Protected endpoints require `Authorization: Bearer <accessToken>`.
- `GET /auth/me` returns `{"user":{}}`.

Error format:

```json
{
  "requestId": "uuid",
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe public message",
    "details": {}
  }
}
```

The global error handler is the only place that formats errors. It handles `AppError`, Zod validation, Multer upload errors, and Prisma known errors. Unexpected errors produce a generic 500 response and are logged with the request ID.

HTTP hardening:

- Helmet sets security headers and Express disables the `x-powered-by` header.
- JSON request bodies are limited to 100 KB.
- CORS is intentionally disabled. The browser reaches Express through the Vite development proxy or the web-container proxy, keeping the browser and API on one origin.
- Login and registration share a bucket limited to 10 requests per 15 minutes per IP by default. Refresh has a separate bucket with the same default window.
- Limits and the window are configurable through `AUTH_LOGIN_REGISTER_LIMIT`, `AUTH_REFRESH_LIMIT`, and `AUTH_RATE_LIMIT_WINDOW_MS`.
- Auth endpoints return HTTP 429 in the standard error format when limited.
- The default rate-limit store is in-memory and process-local. A shared store is required when multiple API instances run.
- Pino logs HTTP requests and application errors. Authorization and password fields are redacted, and request logs include the request ID.
- `LOG_LEVEL` controls Pino logging.

## FastAPI internal API

FastAPI is reachable only through the internal Docker network and is called by Express.

| Method | Path | Function |
| --- | --- | --- |
| POST | `/ocr/extract` | Extract raw text and fields from an image |
| POST | `/ocr/preprocess` | Debug endpoint for a preprocessed image |
| POST | `/image/phash` | Calculate a perceptual image hash |
| POST | `/category/predict` | Predict a category and score for item text |
| GET | `/health` | Return service health and loaded engines |

The `/ocr/extract` response contract is:

```json
{
  "engine": "tesseract",
  "durationMs": 1840,
  "rawText": "INDOMARET\n...",
  "fields": {
    "merchant": {"value": "INDOMARET", "confidence": 0.93},
    "date": {"value": "2026-11-08", "confidence": 0.88},
    "total": {"value": 47500, "confidence": 0.71},
    "items": [
      {"name": "AQUA 600ML", "qty": 2, "lineTotal": 7000, "confidence": 0.80}
    ]
  },
  "warnings": ["total_not_equal_item_sum"]
}
```

## Validation rules

An extracted receipt produces warnings and may enter `NEEDS_REVIEW`:

| Rule | Failure behavior |
| --- | --- |
| Item `lineTotal` values sum to `totalAmount`, with a small rounding tolerance | Add a warning and require review |
| Purchase date is not in the future and is not more than two years old | Add a warning and require review |
| Total is greater than zero and within the configured reasonable upper bound | Add a warning and require review |
| Merchant name is not empty | Add a warning |
| Field confidence is below the configured threshold | Highlight the field for review |

The duplicate check compares a perceptual image hash and a combination of merchant similarity, purchase date, and total. Similar receipts are marked, not blocked.

## OCR pipeline

The API worker polls uploaded receipts when `WORKER_ENABLED=true`. It claims one
eligible receipt at a time with a PostgreSQL `FOR UPDATE SKIP LOCKED` statement,
marks it `PROCESSING`, calls the internal OCR service, stores the `OcrRun`,
updates the receipt and items, and then marks it `NEEDS_REVIEW`.

The worker retries failures up to three attempts with configurable exponential
backoff. The default delays are 5 seconds, 20 seconds, and 80 seconds; after
the third failure the receipt is `FAILED`. At startup and every minute, receipts
stuck in `PROCESSING` for more than five minutes are returned to `UPLOADED`.

Worker settings are `WORKER_POLL_MS`, `OCR_URL`, `OCR_DEFAULT_ENGINE`,
`WORKER_MAX_ATTEMPTS`, `WORKER_RETRY_BASE_MS`, `WORKER_RETRY_FACTOR`,
`WORKER_RECOVERY_INTERVAL_MS`, and `WORKER_STUCK_AFTER_MS`.

The OCR service itself supports preprocessing and the Tesseract/PaddleOCR engine
interface. The worker currently sends an empty preprocessing configuration.
8. Parse merchant, purchase date, total, and item rows.
9. Validate fields and calculate warnings.
10. Check duplicate hashes and fuzzy merchant matches.
11. Apply rule-based categorization, with a classification model as a later comparison.

Each preprocessing step can be disabled independently. OCR engines and preprocessing options remain an explicit configuration contract.

Evaluation uses a CLI, not HTTP endpoints. The test data must be split into 30 development receipts and 20 test receipts. The test split is used once for final evaluation.

The evaluation CLI reports:

- Exact accuracy for total, date, and merchant.
- Character error rate on repeated raw-text samples.
- Median processing time.
- Percentage of receipts requiring review.
- Duplicate precision and recall.
- Category accuracy and macro-F1 when the classification model is implemented.
