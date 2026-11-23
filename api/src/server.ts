import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./database/prisma.js";
import { logger } from "./common/logger.js";
import { cleanupExpiredOrRevokedRefreshTokens } from "./modules/auth/auth.service.js";
import { OcrWorker } from "./modules/ocr-worker/ocr-worker.js";

const app = createApp();
const server = createServer(app);
const worker = env.WORKER_ENABLED ? new OcrWorker() : undefined;

if (worker) {
  worker.start().catch((error: unknown) => {
    logger.error({ err: error }, "OCR worker startup failed");
  });
}

server.listen(env.API_PORT, "0.0.0.0", () => {
  logger.info({ port: env.API_PORT }, "API listening");
});

const cleanupInterval = setInterval(
  () => {
    cleanupExpiredOrRevokedRefreshTokens().catch((error: unknown) => {
      logger.error({ err: error }, "Refresh token cleanup failed");
    });
  },
  24 * 60 * 60 * 1000,
);
cleanupInterval.unref();

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(cleanupInterval);
  worker?.stop();
  logger.info({ signal }, "Shutdown started");
  server.close(() => {
    prisma.$disconnect().then(
      () => {
        logger.info({ signal }, "Shutdown complete");
      },
      (error: unknown) => {
        logger.error({ err: error }, "Prisma disconnect failed");
      },
    );
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
