import { Router } from "express";
import { requireAuth } from "../../common/middleware/require-auth.js";
import { validate } from "../../common/middleware/validate.js";
import {
  loginRegisterRateLimit,
  refreshRateLimit,
} from "../../common/middleware/rate-limit.js";
import { login, getMe, refresh, register } from "./auth.controller.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  loginRegisterRateLimit,
  validate({ body: registerSchema }),
  register,
);
authRouter.post(
  "/login",
  loginRegisterRateLimit,
  validate({ body: loginSchema }),
  login,
);
authRouter.post(
  "/refresh",
  refreshRateLimit,
  validate({ body: refreshSchema }),
  refresh,
);
authRouter.get("/me", requireAuth, getMe);
