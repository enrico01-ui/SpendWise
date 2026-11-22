import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./common/logger.js";
import { requestId } from "./common/middleware/request-id.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { notFound } from "./common/middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { receiptRouter } from "./modules/receipts/receipts.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";

export const createApp = () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (_request, response) => ({
        requestId: response.locals.requestId,
      }),
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");

  app.use((request, response, next) => {
    const origin = request.header("origin");
    if (origin && !allowedOrigins.includes(origin)) {
      response.status(403).json({
        requestId: response.locals.requestId,
        error: {
          code: "CORS_REJECTED",
          message: "Origin is not allowed",
          details: {},
        },
      });
      return;
    }
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use("/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/receipts", receiptRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};
