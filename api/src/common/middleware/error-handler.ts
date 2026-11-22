import { z } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { logger } from "../logger.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  void next;
  const requestId = response.locals.requestId;

  if (error instanceof AppError) {
    response.status(error.status).json({
      requestId,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }
  if (error instanceof z.ZodError) {
    response.status(400).json({
      requestId,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: z.flattenError(error),
      },
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({
        requestId,
        error: {
          code: "FILE_TOO_LARGE",
          message: "File exceeds the 10 MB limit",
          details: {},
        },
      });
      return;
    }
    response.status(400).json({
      requestId,
      error: { code: "INVALID_UPLOAD", message: error.message, details: {} },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response.status(409).json({
        requestId,
        error: { code: "CONFLICT", message: "Resource conflict", details: {} },
      });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({
        requestId,
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          details: {},
        },
      });
      return;
    }
  }

  logger.error({ err: error, requestId }, "Unhandled request error");
  response.status(500).json({
    requestId,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      details: {},
    },
  });
};
