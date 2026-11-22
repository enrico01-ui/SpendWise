import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().optional(),
  API_PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  UPLOAD_DIR: z.string().min(1).default("uploads")
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "test" &&
      (value.JWT_SECRET === undefined || value.JWT_SECRET.length < 32)) {
    context.addIssue({
      code: "custom",
      path: ["JWT_SECRET"],
      message: "JWT_SECRET must be at least 32 characters outside NODE_ENV=test"
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
  JWT_SECRET: result.data.JWT_SECRET
});
