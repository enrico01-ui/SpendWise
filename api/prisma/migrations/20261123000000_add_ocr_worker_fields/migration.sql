ALTER TABLE "Receipt"
ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;

CREATE INDEX "Receipt_status_nextAttemptAt_idx"
ON "Receipt"("status", "nextAttemptAt");
