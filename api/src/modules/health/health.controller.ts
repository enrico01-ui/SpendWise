import type { RequestHandler } from "express";
import { prisma } from "../../database/prisma.js";

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json({ status: "ok" });
};

export const getReadiness: RequestHandler = async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ status: "ready" });
  } catch {
    response.status(503).json({
      requestId: response.locals.requestId,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database is unavailable",
        details: {},
      },
    });
  }
};
