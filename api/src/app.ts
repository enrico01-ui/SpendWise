import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import { AppError } from "./lib/errors.js";
import { authRouter } from "./routes/auth.routes.js";
import { receiptRouter } from "./routes/receipt.routes.js";

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details }
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({
        error: { code: "FILE_TOO_LARGE", message: "File exceeds the 10 MB limit", details: {} }
      });
      return;
    }
    response.status(400).json({
      error: { code: "INVALID_UPLOAD", message: error.message, details: {} }
    });
    return;
  }
  const message = error instanceof Error ? error.message : "Internal server error";

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
      details: {}
    }
  });
};

export const app = express();

app.use(express.json());

app.use(["/auth", "/api/v1/auth"], authRouter);
app.use(["/receipts", "/api/v1/receipts"], receiptRouter);

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use(errorHandler);

