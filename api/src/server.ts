import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./database/prisma.js";
import { logger } from "./common/logger.js";

const app = createApp();
const server = createServer(app);

server.listen(env.API_PORT, "0.0.0.0", () => {
  logger.info("API listening", { port: env.API_PORT });
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Shutdown started", { signal });
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Shutdown complete", { signal });
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

