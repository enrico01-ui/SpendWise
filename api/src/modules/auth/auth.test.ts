import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../common/errors/app-error.js";

const auth = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  verifyAccessToken: vi.fn(),
  getUser: vi.fn()
}));

vi.mock("./auth.service.js", () => auth);

import { createApp } from "../../app.js";

const app = createApp();

describe("authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers an account and returns tokens", async () => {
    auth.register.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", name: "User", role: "USER" },
      accessToken: "access",
      refreshToken: "refresh"
    });

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "user@example.com", password: "password123", name: "User" });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBe("access");
  });

  it("returns 409 for a duplicate email", async () => {
    auth.register.mockRejectedValue(
      new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists")
    );

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "user@example.com", password: "password123", name: "User" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("returns 401 for a wrong password", async () => {
    auth.login.mockRejectedValue(new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password"));

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "user@example.com", password: "wrongpass" });

    expect(response.status).toBe(401);
  });

  it("returns a rotated refresh token", async () => {
    auth.refresh.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", name: "User", role: "USER" },
      accessToken: "access-2",
      refreshToken: "refresh-2"
    });

    const response = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "refresh-1" });

    expect(response.status).toBe(200);
    expect(response.body.refreshToken).toBe("refresh-2");
  });

  it("returns 401 when a revoked refresh token is reused", async () => {
    auth.refresh.mockRejectedValue(
      new AppError(401, "REFRESH_TOKEN_REUSE", "Refresh token reuse detected")
    );

    const response = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "revoked" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("REFRESH_TOKEN_REUSE");
  });

  it("rejects an expired access token and allows /auth/me with a valid token", async () => {
    auth.verifyAccessToken.mockImplementation(() => {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token");
    });

    const expiredResponse = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer expired");
    expect(expiredResponse.status).toBe(401);

    auth.verifyAccessToken.mockReturnValue({ id: "user-1", role: "USER" });
    auth.getUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "USER"
    });

    const validResponse = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer valid");
    expect(validResponse.status).toBe(200);

    const missingResponse = await request(app).get("/api/v1/auth/me");
    expect(missingResponse.status).toBe(401);
  });

  it("returns a generic 500 for unexpected errors", async () => {
    auth.login.mockRejectedValue(new Error("database password"));

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "user@example.com", password: "password123" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(response.body.error.message).toBe("Internal server error");
    expect(response.body.error).not.toHaveProperty("stack");
  });
});
