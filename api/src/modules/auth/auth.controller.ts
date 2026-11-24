import type { RequestHandler, Response } from "express";
import { env } from "../../config/env.js";
import { parseCookies } from "../../common/utils/cookies.js";
import { getAuthUser } from "../../common/middleware/require-auth.js";
import { getValidatedBody } from "../../common/middleware/validate.js";
import { UnauthorizedError } from "../../common/errors/app-error.js";
import { REFRESH_TOKEN_TTL_MS } from "./auth.constants.js";
import type { LoginDto, RegisterDto } from "./auth.schemas.js";
import * as authService from "./auth.service.js";

const cookieAttributes = (maxAge?: number): string => {
  const parts = [
    "refresh_token=",
    "HttpOnly",
    "SameSite=Strict",
    `Path=/api/v1/auth`,
  ];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  if (env.COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
};

const setRefreshCookie = (response: Response, token: string) => {
  response.setHeader(
    "Set-Cookie",
    `refresh_token=${encodeURIComponent(token)}; ${cookieAttributes(REFRESH_TOKEN_TTL_MS)}`,
  );
};

const clearRefreshCookie = (response: Response) => {
  response.setHeader(
    "Set-Cookie",
    `refresh_token=; ${cookieAttributes()}; Max-Age=0`,
  );
};

export const register: RequestHandler = async (_request, response) => {
  const dto = getValidatedBody<RegisterDto>(response);
  const result = await authService.register(dto);
  setRefreshCookie(response, result.refreshToken);
  response.status(201).json({ user: result.user, accessToken: result.accessToken });
};

export const login: RequestHandler = async (_request, response) => {
  const dto = getValidatedBody<LoginDto>(response);
  const result = await authService.login(dto);
  setRefreshCookie(response, result.refreshToken);
  response.json({ user: result.user, accessToken: result.accessToken });
};

export const refresh: RequestHandler = async (_request, response) => {
  const cookies = parseCookies(_request.header("cookie"));
  const refreshToken = cookies.refresh_token;
  if (!refreshToken) {
    clearRefreshCookie(response);
    throw new UnauthorizedError(
      "Refresh token cookie is missing",
      "REFRESH_TOKEN_MISSING",
    );
  }
  const result = await authService.refresh(refreshToken);
  setRefreshCookie(response, result.refreshToken);
  response.json({ user: result.user, accessToken: result.accessToken });
};

export const getMe: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  response.json({ user: await authService.getUser(user.id) });
};

export const logout: RequestHandler = async (request, response) => {
  const cookies = parseCookies(request.header("cookie"));
  const refreshToken = cookies.refresh_token;
  if (refreshToken) await authService.revokeRefreshToken(refreshToken);
  clearRefreshCookie(response);
  response.status(204).end();
};
