import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().optional(),
    API_PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    UPLOAD_DIR: z.string().min(1).default("uploads"),
    WORKER_ENABLED: z.coerce.boolean().default(false),
    WORKER_POLL_MS: z.coerce.number().int().positive().default(2000),
    WORKER_RECOVERY_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 1000),
    WORKER_STUCK_AFTER_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5 * 60 * 1000),
    WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
    WORKER_RETRY_BASE_MS: z.coerce.number().int().positive().default(5000),
    WORKER_RETRY_FACTOR: z.coerce.number().positive().default(4),
    OCR_URL: z.string().url().default("http://ocr:8000"),
    OCR_DEFAULT_ENGINE: z.string().min(1).default("tesseract"),
    CORS_ORIGINS: z.string().default(""),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    AUTH_LOGIN_REGISTER_LIMIT: z.coerce.number().int().positive().default(10),
    AUTH_REFRESH_LIMIT: z.coerce.number().int().positive().default(10),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV !== "test" &&
      (value.JWT_SECRET === undefined || value.JWT_SECRET.length < 32)
    ) {
      context.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message:
          "JWT_SECRET must be at least 32 characters outside NODE_ENV=test",
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = z.flattenError(result.error);
  process.stderr.write("Invalid environment configuration:\n");
  process.stderr.write(JSON.stringify(details.fieldErrors) + "\n");
  process.exit(1);
}

export const env = Object.freeze({
  ...result.data,
  JWT_SECRET: result.data.JWT_SECRET,
});
