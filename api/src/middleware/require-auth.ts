import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../services/auth.service.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const header = request.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication is required"));
    return;
  }

  try {
    request.user = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch (error) {
    next(error);
  }
};
