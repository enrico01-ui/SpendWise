import express, { type ErrorRequestHandler } from "express";
import { AppError } from "./lib/errors.js";
import { authRouter } from "./routes/auth.routes.js";

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details }
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

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use(errorHandler);

