CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "ReceiptStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "imageHash" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'UPLOADED',
    "merchantName" TEXT,
    "purchaseDate" DATE,
    "totalAmount" INTEGER,
    "categoryId" INTEGER,
    "ocrConfidence" DOUBLE PRECISION,
    "rawText" TEXT,
    "duplicateOfId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "lineTotal" INTEGER NOT NULL,
    "categoryId" INTEGER,
    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OcrRun" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "preprocessConfig" JSONB NOT NULL,
    "rawText" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OcrRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroundTruth" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "items" JSONB,
    "split" TEXT NOT NULL,
    CONSTRAINT "GroundTruth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "ocrValue" TEXT,
    "correctedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "limitAmount" INTEGER NOT NULL,
    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE INDEX "Receipt_userId_purchaseDate_idx" ON "Receipt"("userId", "purchaseDate" DESC);
CREATE INDEX "Receipt_userId_status_idx" ON "Receipt"("userId", "status");
CREATE INDEX "Receipt_imageHash_idx" ON "Receipt"("imageHash");
CREATE INDEX "Receipt_merchantName_trgm_idx" ON "Receipt" USING GIN ("merchantName" gin_trgm_ops);
CREATE INDEX "ReceiptItem_receiptId_idx" ON "ReceiptItem"("receiptId");
CREATE INDEX "OcrRun_receiptId_idx" ON "OcrRun"("receiptId");
CREATE UNIQUE INDEX "GroundTruth_receiptId_key" ON "GroundTruth"("receiptId");
CREATE INDEX "Correction_receiptId_idx" ON "Correction"("receiptId");
CREATE UNIQUE INDEX "Budget_userId_categoryId_month_key" ON "Budget"("userId", "categoryId", "month");

ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OcrRun" ADD CONSTRAINT "OcrRun_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroundTruth" ADD CONSTRAINT "GroundTruth_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
