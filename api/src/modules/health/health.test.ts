import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  $queryRaw: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("../../database/prisma.js", () => ({ prisma: database }));

import { createApp } from "../../app.js";

type ErrorBody = {
  error: {
    code: string;
  };
};

type UnknownRouteBody = {
  requestId: string;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
};

describe("GET /health", () => {
  it("returns a healthy response", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.text) as unknown).toEqual({ status: "ok" });
  });

  it("returns the standard error for unknown routes", async () => {
    const response = await request(createApp()).get("/unknown");

    expect(response.status).toBe(404);
    const body = JSON.parse(response.text) as unknown as UnknownRouteBody;
    expect(typeof body.requestId).toBe("string");
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Route not found");
  });

  it("reports readiness 503 when the database is unreachable", async () => {
    database.$queryRaw.mockRejectedValue(new Error("database unavailable"));

    const response = await request(createApp()).get("/health/ready");

    expect(response.status).toBe(503);
    expect((JSON.parse(response.text) as unknown as ErrorBody).error.code).toBe(
      "SERVICE_UNAVAILABLE",
    );
  });

  it("rejects a disallowed CORS origin", async () => {
    const response = await request(createApp())
      .get("/health")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(403);
    expect((JSON.parse(response.text) as unknown as ErrorBody).error.code).toBe(
      "CORS_REJECTED",
    );
  });
});
