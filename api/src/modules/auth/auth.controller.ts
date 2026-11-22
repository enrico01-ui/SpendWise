import type { RequestHandler } from "express";
import { getAuthUser } from "../../common/middleware/require-auth.js";
import { getValidatedBody } from "../../common/middleware/validate.js";
import type { LoginDto, RefreshDto, RegisterDto } from "./auth.schemas.js";
import * as authService from "./auth.service.js";

export const register: RequestHandler = async (_request, response) => {
  const dto = getValidatedBody<RegisterDto>(response);
  response.status(201).json(await authService.register(dto));
};

export const login: RequestHandler = async (_request, response) => {
  const dto = getValidatedBody<LoginDto>(response);
  response.json(await authService.login(dto));
};

export const refresh: RequestHandler = async (_request, response) => {
  const dto = getValidatedBody<RefreshDto>(response);
  response.json(await authService.refresh(dto));
};

export const getMe: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  response.json({ user: await authService.getUser(user.id) });
};
