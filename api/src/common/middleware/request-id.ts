import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestId: RequestHandler = (request, response, next) => {
  const incoming = request.header("x-request-id");
  const id = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  response.locals.requestId = id;
  response.setHeader("x-request-id", id);
  next();
};
