import express from "express";
import { requestId } from "./common/middleware/request-id.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { notFound } from "./common/middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { receiptRouter } from "./modules/receipts/receipts.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";

export const createApp = () => {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/receipts", receiptRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

