import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

describe("GET /health", () => {
  it("returns a healthy response", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns the standard error for unknown routes", async () => {
    const response = await request(createApp()).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      requestId: expect.any(String),
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        details: {}
      }
    });
  });
});
