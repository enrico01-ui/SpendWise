import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "../../config/env.js";

const tooManyRequests =
  (code: string): RequestHandler =>
  (_request, response) => {
    response.status(429).json({
      requestId: response.locals.requestId,
      error: {
        code,
        message: "Too many requests",
        details: {},
      },
    });
  };

// In-memory state is process-local. Multiple instances require a shared store such as Redis.
export const loginRegisterRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_REGISTER_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: tooManyRequests("AUTH_RATE_LIMITED"),
});

export const refreshRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_REFRESH_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: tooManyRequests("REFRESH_RATE_LIMITED"),
});
