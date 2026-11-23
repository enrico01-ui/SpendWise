import { Prisma, PrismaClient, type ReceiptStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import type { OcrClient, OcrExtractResult } from "./ocr-client.js";

type ClaimedReceipt = {
  id: string;
  imagePath: string;
  processingAttempts: number;
};

type ReceiptFields = OcrExtractResult["fields"];

const claimQuery = Prisma.sql`
  WITH candidate AS (
    SELECT "id"
    FROM "Receipt"
    WHERE "status" = 'UPLOADED'
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
    ORDER BY "createdAt"
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE "Receipt" AS receipt
  SET "status" = 'PROCESSING', "updatedAt" = NOW()
  FROM candidate
  WHERE receipt."id" = candidate."id"
  RETURNING receipt."id", receipt."imagePath", receipt."processingAttempts"
`;

const asDate = (value: string | number | null): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const fieldValue = (
  field: ReceiptFields["merchant"],
): string | number | null => field.value;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class OcrWorkerService {
  public constructor(
    private readonly database: PrismaClient = prisma,
    private readonly client: OcrClient,
    private readonly options = {
      engine: env.OCR_DEFAULT_ENGINE,
      maxAttempts: env.WORKER_MAX_ATTEMPTS,
      retryBaseMs: env.WORKER_RETRY_BASE_MS,
      retryFactor: env.WORKER_RETRY_FACTOR,
    },
  ) {}

  public async claimNextReceipt(): Promise<ClaimedReceipt | null> {
    const receipts = await this.database.$queryRaw<ClaimedReceipt[]>(claimQuery);
    return receipts[0] ?? null;
  }

  public async processNext(): Promise<boolean> {
    const receipt = await this.claimNextReceipt();
    if (!receipt) return false;

    try {
      await this.processReceipt(receipt);
    } catch (error: unknown) {
      await this.recordFailure(receipt, error);
    }
    return true;
  }

  public async recoverStuckReceipts(
    olderThanMs = env.WORKER_STUCK_AFTER_MS,
  ): Promise<number> {
    const result = await this.database.receipt.updateMany({
      where: {
        status: "PROCESSING",
        updatedAt: { lt: new Date(Date.now() - olderThanMs) },
      },
      data: {
        status: "UPLOADED",
        nextAttemptAt: null,
      },
    });
    return result.count;
  }

  private async processReceipt(receipt: ClaimedReceipt): Promise<void> {
    const [extracted, imageHash] = await Promise.all([
      this.client.extract(receipt.imagePath, this.options.engine),
      this.client.phash(receipt.imagePath),
    ]);
    const fields = extracted.fields;
    const updateData: Prisma.ReceiptUpdateInput = {
      status: "NEEDS_REVIEW",
      rawText: extracted.rawText,
      ocrConfidence: extracted.confidence,
      imageHash,
      lastError: null,
      nextAttemptAt: null,
    };

    const merchant = fieldValue(fields.merchant);
    if (typeof merchant === "string" && merchant.length > 0) {
      updateData.merchantName = merchant;
    }
    const purchaseDate = asDate(fieldValue(fields.date));
    if (purchaseDate) updateData.purchaseDate = purchaseDate;
    const total = fieldValue(fields.total);
    if (typeof total === "number" && Number.isInteger(total)) {
      updateData.totalAmount = total;
    }

    await this.database.$transaction(async (transaction) => {
      await transaction.ocrRun.create({
        data: {
          receiptId: receipt.id,
          engine: extracted.engine,
          preprocessConfig: {},
          rawText: extracted.rawText,
          fields,
          durationMs: extracted.durationMs,
        },
      });
      await transaction.receiptItem.deleteMany({
        where: { receiptId: receipt.id },
      });
      if (fields.items.length > 0) {
        await transaction.receiptItem.createMany({
          data: fields.items.map((item) => ({
            receiptId: receipt.id,
            name: item.name,
            qty: item.qty,
            lineTotal: item.lineTotal,
          })),
        });
      }
      await transaction.receipt.update({
        where: { id: receipt.id },
        data: updateData,
      });
    });
  }

  private async recordFailure(
    receipt: ClaimedReceipt,
    error: unknown,
  ): Promise<void> {
    const attempts = receipt.processingAttempts + 1;
    const failed = attempts >= this.options.maxAttempts;
    const nextAttemptAt = failed
      ? null
      : new Date(
          Date.now() +
            this.options.retryBaseMs *
              this.options.retryFactor ** (attempts - 1),
        );
    const status: ReceiptStatus = failed ? "FAILED" : "UPLOADED";

    await this.database.receipt.update({
      where: { id: receipt.id },
      data: {
        processingAttempts: attempts,
        lastError: errorMessage(error),
        nextAttemptAt,
        status,
      },
    });
  }
}
