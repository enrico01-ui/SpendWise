import pino from "pino";
import { env } from "../config/env.js";

export type LogFields = Record<string, string | number | boolean>;

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "password",
      "*.password",
      "req.body.password",
      "refresh_token",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});
