import type { RequestHandler } from "express";

export const notFound: RequestHandler = (request, response) => {
  response.status(404).json({
    requestId: response.locals.requestId,
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      details: {}
    }
  });
};
