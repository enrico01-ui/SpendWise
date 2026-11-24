import { Router } from "express";
import { requireAuth } from "../../common/middleware/require-auth.js";
import { validate } from "../../common/middleware/validate.js";
import { requireCsrfHeader } from "../../common/middleware/csrf.js";
import {
  loginRegisterRateLimit,
  refreshRateLimit,
} from "../../common/middleware/rate-limit.js";
import { login, getMe, logout, refresh, register } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";

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
  requireCsrfHeader,
  refresh,
);
authRouter.post("/logout", requireCsrfHeader, logout);
authRouter.get("/me", requireAuth, getMe);
