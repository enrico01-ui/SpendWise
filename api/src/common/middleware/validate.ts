import type { RequestHandler } from "express";
import type { Response } from "express";
import type { ZodType } from "zod";

type ValidationSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (request, response, next) => {
    const parsed: { body?: unknown; query?: unknown; params?: unknown } = {};

    if (schemas.body) parsed.body = schemas.body.parse(request.body);
    if (schemas.query) parsed.query = schemas.query.parse(request.query);
    if (schemas.params) parsed.params = schemas.params.parse(request.params);

    response.locals.validated = parsed;
    next();
  };

export const getValidatedBody = <T>(response: Response): T =>
  response.locals.validated.body as T;

export const getValidatedQuery = <T>(response: Response): T =>
  response.locals.validated.query as T;

export const getValidatedParams = <T>(response: Response): T =>
  response.locals.validated.params as T;
