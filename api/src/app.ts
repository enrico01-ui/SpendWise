import express, { type ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
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

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use(errorHandler);

