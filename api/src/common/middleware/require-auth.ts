import type { RequestHandler } from "express";
import { verifyAccessToken } from "../../modules/auth/auth.service.js";
import { UnauthorizedError } from "../errors/app-error.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const header = request.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    next(new UnauthorizedError("Authentication is required"));
    return;
  }

  try {
    request.user = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch (error) {
    next(error);
  }
};

export const getAuthUser = (request: Parameters<RequestHandler>[0]) => {
  if (!request.user) {
    throw new UnauthorizedError();
  }
  return request.user;
};
