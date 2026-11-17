import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/require-auth.js";
import * as authService from "../services/auth.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(100)
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const parseBody = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid request body", result.error.flatten());
  }
  return result.data;
};

export const authRouter = Router();

authRouter.post("/register", async (request, response) => {
  const body = parseBody(registerSchema, request.body);
  response.status(201).json(await authService.register(body.email.toLowerCase(), body.password, body.name));
});

authRouter.post("/login", async (request, response) => {
  const body = parseBody(loginSchema, request.body);
  response.json(await authService.login(body.email.toLowerCase(), body.password));
});

authRouter.post("/refresh", async (request, response) => {
  const body = parseBody(refreshSchema, request.body);
  response.json(await authService.refresh(body.refreshToken));
});

authRouter.get("/me", requireAuth, async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  response.json({ user: await authService.getUser(request.user.id) });
});
