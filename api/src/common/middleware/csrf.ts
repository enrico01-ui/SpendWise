import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export const requireCsrfHeader: RequestHandler = (request, _response, next) => {
  if (request.header("X-Requested-With") !== "fetch") {
    next(new AppError(403, "CSRF_HEADER_REQUIRED", "Missing CSRF header"));
    return;
  }
  const origin = request.header("origin");
  if (origin && origin !== env.APP_ORIGIN) {
    next(new AppError(403, "ORIGIN_REJECTED", "Origin is not allowed"));
    return;
  }
  next();
};
