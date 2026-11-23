import { env } from "../../config/env.js";
import { logger } from "../../common/logger.js";
import { HttpOcrClient } from "./ocr-client.js";
import { OcrWorkerService } from "./ocr-worker.service.js";

export class OcrWorker {
  private pollTimer: NodeJS.Timeout | undefined;
  private recoveryTimer: NodeJS.Timeout | undefined;
  private polling = false;

  public constructor(
    private readonly service = new OcrWorkerService(undefined, new HttpOcrClient()),
    private readonly pollMs = env.WORKER_POLL_MS,
    private readonly recoveryIntervalMs = env.WORKER_RECOVERY_INTERVAL_MS,
  ) {}

  public async start(): Promise<void> {
    await this.service.recoverStuckReceipts();
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollMs);
    this.recoveryTimer = setInterval(() => {
      void this.recover();
    }, this.recoveryIntervalMs);
    this.pollTimer.unref();
    this.recoveryTimer.unref();
    void this.poll();
  }

  public stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.pollTimer = undefined;
    this.recoveryTimer = undefined;
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.service.processNext();
    } catch (error: unknown) {
      logger.error({ err: error }, "OCR worker poll failed");
    } finally {
      this.polling = false;
    }
  }

  private async recover(): Promise<void> {
    try {
      await this.service.recoverStuckReceipts();
    } catch (error: unknown) {
      logger.error({ err: error }, "OCR worker recovery failed");
    }
  }
}
