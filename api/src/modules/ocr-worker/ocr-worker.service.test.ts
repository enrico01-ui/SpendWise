import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OcrClient, OcrExtractResult } from "./ocr-client.js";
import { OcrWorkerService } from "./ocr-worker.service.js";

type ReceiptState = {
  id: string;
  imagePath: string;
  processingAttempts: number;
  status: "UPLOADED" | "PROCESSING" | "NEEDS_REVIEW" | "FAILED";
  nextAttemptAt: Date | null;
  lastError: string | null;
  merchantName: string | null;
  purchaseDate: Date | null;
  totalAmount: number | null;
  rawText: string | null;
  ocrConfidence: number | null;
  imageHash: string | null;
  updatedAt: Date;
};

const result: OcrExtractResult = {
  engine: "tesseract",
  durationMs: 12,
  confidence: 0.8,
  rawText: "SHOP\nTOTAL 100",
  fields: {
    merchant: { value: "SHOP", confidence: 0.9 },
    date: { value: "2026-11-23", confidence: 0.9 },
    total: { value: 100, confidence: 0.8 },
    items: [{ name: "ITEM", qty: 1, lineTotal: 100, confidence: 0.8 }],
  },
  warnings: [],
};

class FakeDatabase {
  public receipt: ReceiptState = {
    id: "receipt-1",
    imagePath: "uploads/user-1/receipt-1.png",
    processingAttempts: 0,
    status: "UPLOADED",
    nextAttemptAt: null,
    lastError: null,
    merchantName: null,
    purchaseDate: null,
    totalAmount: null,
    rawText: null,
    ocrConfidence: null,
    imageHash: null,
    updatedAt: new Date(),
  };
  public ocrRuns: unknown[] = [];
  public items: unknown[] = [];
  private claimed = false;

  public readonly $queryRaw = <T>(query: unknown): Promise<T> => {
    void query;
    if (this.claimed || this.receipt.status !== "UPLOADED") {
      return Promise.resolve([] as T);
    }
    if (
      this.receipt.nextAttemptAt &&
      this.receipt.nextAttemptAt.getTime() > Date.now()
    ) {
      return Promise.resolve([] as T);
    }
    this.claimed = true;
    this.receipt.status = "PROCESSING";
    return Promise.resolve([
      {
        id: this.receipt.id,
        imagePath: this.receipt.imagePath,
        processingAttempts: this.receipt.processingAttempts,
      },
    ] as T);
  };

  public readonly $transaction = async <T>(
    callback: (database: FakeDatabase) => Promise<T>,
  ): Promise<T> => {
    const transactionDatabase = Object.assign(
      Object.create(this) as FakeDatabase,
      { receipt: this.receiptUpdate },
    );
    return callback(transactionDatabase);
  };

  public readonly ocrRun = {
    create: (args: { data: unknown }): Promise<void> => {
      this.ocrRuns.push(args.data);
      return Promise.resolve();
    },
  };

  public readonly receiptItem = {
    deleteMany: (): Promise<void> => {
      this.items = [];
      return Promise.resolve();
    },
    createMany: (args: { data: unknown[] }): Promise<void> => {
      this.items = args.data;
      return Promise.resolve();
    },
  };

  public readonly updateReceipt = (data: Partial<ReceiptState>): Promise<void> => {
    this.receipt = { ...this.receipt, ...data, updatedAt: new Date() };
    if (this.receipt.status !== "PROCESSING") this.claimed = false;
    return Promise.resolve();
  };

  public readonly receiptUpdate = {
    update: (args: { data: Partial<ReceiptState> }) =>
      this.updateReceipt(args.data),
    updateMany: (args: {
      where: { status: ReceiptState["status"]; updatedAt: { lt: Date } };
      data: Partial<ReceiptState>;
    }): Promise<{ count: number }> => {
      if (
        this.receipt.status !== args.where.status ||
        this.receipt.updatedAt >= args.where.updatedAt.lt
      ) {
        return Promise.resolve({ count: 0 });
      }
      return this.updateReceipt(args.data).then(() => ({ count: 1 }));
    },
  };

  public get database(): PrismaClient {
    return {
      $queryRaw: this.$queryRaw,
      $transaction: this.$transaction,
      receipt: this.receiptUpdate,
      ocrRun: this.ocrRun,
      receiptItem: this.receiptItem,
    } as unknown as PrismaClient;
  }
}

const fakeClient = (extract = vi.fn(() => Promise.resolve(result))): OcrClient => ({
  extract,
  phash: vi.fn(() => Promise.resolve("0123456789abcdef")),
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OcrWorkerService", () => {
  it("persists OCR output and advances a receipt to NEEDS_REVIEW", async () => {
    const database = new FakeDatabase();
    const service = new OcrWorkerService(database.database, fakeClient());

    expect(await service.processNext()).toBe(true);
    expect(database.receipt.status).toBe("NEEDS_REVIEW");
    expect(database.receipt.merchantName).toBe("SHOP");
    expect(database.ocrRuns).toHaveLength(1);
    expect(database.items).toHaveLength(1);
  });

  it("retries with 5s, 20s, 80s backoff and then fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T00:00:00.000Z"));
    const database = new FakeDatabase();
    const service = new OcrWorkerService(
      database.database,
      {
        extract: vi.fn(() => {
          throw new Error("OCR unavailable");
        }),
        phash: vi.fn(() => Promise.resolve("hash")),
      },
      { engine: "tesseract", maxAttempts: 3, retryBaseMs: 5000, retryFactor: 4 },
    );

    await service.processNext();
    expect(database.receipt.nextAttemptAt?.getTime()).toBe(
      Date.now() + 5000,
    );
    vi.setSystemTime(database.receipt.nextAttemptAt!);
    await service.processNext();
    expect(database.receipt.nextAttemptAt?.getTime()).toBe(
      Date.now() + 20000,
    );
    vi.setSystemTime(database.receipt.nextAttemptAt!);
    await service.processNext();

    expect(database.receipt.status).toBe("FAILED");
    expect(database.receipt.processingAttempts).toBe(3);
    expect(database.receipt.lastError).toBe("OCR unavailable");
  });

  it("allows concurrent workers to claim only one receipt", async () => {
    const database = new FakeDatabase();
    const extract = vi.fn(() => Promise.resolve(result));
    const first = new OcrWorkerService(database.database, fakeClient(extract));
    const second = new OcrWorkerService(database.database, fakeClient(extract));

    const claimed = await Promise.all([first.processNext(), second.processNext()]);

    expect(claimed.filter(Boolean)).toHaveLength(1);
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("returns stale PROCESSING receipts to UPLOADED", async () => {
    const database = new FakeDatabase();
    database.receipt.status = "PROCESSING";
    database.receipt.updatedAt = new Date(Date.now() - 301_000);
    const service = new OcrWorkerService(database.database, fakeClient());

    expect(await service.recoverStuckReceipts(300_000)).toBe(1);
    expect(database.receipt.status).toBe("UPLOADED");
    expect(database.receipt.nextAttemptAt).toBeNull();
  });
});
