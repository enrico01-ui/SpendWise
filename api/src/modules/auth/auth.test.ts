import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../common/errors/app-error.js";

const auth = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  revokeRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("./auth.service.js", () => auth);

import { createApp } from "../../app.js";

const app = createApp();

type ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

type AccessTokenBody = {
  accessToken: string;
};

describe("authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers an account and sets an HttpOnly refresh cookie", async () => {
    auth.register.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        role: "USER",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });

    const response = await request(app).post("/api/v1/auth/register").send({
      email: "user@example.com",
      password: "password123",
      name: "User",
    });

    expect(response.status).toBe(201);
    expect((response.body as unknown as AccessTokenBody).accessToken).toBe(
      "access",
    );
    expect(response.body).not.toHaveProperty("refreshToken");
    const cookie = response.headers["set-cookie"][0];
    expect(cookie).toContain("refresh_token=refresh");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/v1/auth");
    expect(cookie).toContain("Max-Age=604800");
  });

  it("returns 409 for a duplicate email", async () => {
    auth.register.mockRejectedValue(
      new AppError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists",
      ),
    );

    const response = await request(app).post("/api/v1/auth/register").send({
      email: "user@example.com",
      password: "password123",
      name: "User",
    });

    expect(response.status).toBe(409);
    expect((response.body as unknown as ErrorBody).error.code).toBe(
      "EMAIL_ALREADY_EXISTS",
    );
  });

  it("returns 401 for a wrong password", async () => {
    auth.login.mockRejectedValue(
      new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password"),
    );

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "user@example.com", password: "wrongpass" });

    expect(response.status).toBe(401);
  });

  it("rotates the refresh cookie and does not return refreshToken", async () => {
    auth.login.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        role: "USER",
      },
      accessToken: "access",
      refreshToken: "refresh-1",
    });
    auth.refresh.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        role: "USER",
      },
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });

    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .set("X-Requested-With", "fetch")
      .send({ email: "user@example.com", password: "password123" });

    const response = await agent
      .post("/api/v1/auth/refresh")
      .set("X-Requested-With", "fetch");

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("refreshToken");
    expect(response.headers["set-cookie"][0]).toContain("refresh_token=refresh-2");
    expect(auth.refresh).toHaveBeenCalled();
  });

  it("returns 401 without a refresh cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Requested-With", "fetch");
    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"][0]).toContain("Max-Age=0");
  });

  it("returns 401 when a revoked refresh token is reused", async () => {
    auth.refresh.mockRejectedValue(
      new AppError(401, "REFRESH_TOKEN_REUSE", "Refresh token reuse detected"),
    );

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Requested-With", "fetch")
      .set("Cookie", "refresh_token=revoked");

    expect(response.status).toBe(401);
    expect((response.body as unknown as ErrorBody).error.code).toBe(
      "REFRESH_TOKEN_REUSE",
    );
    expect(response.headers["set-cookie"][0]).toContain("Max-Age=0");
  });

  it("logs out, revokes the cookie token, and clears the cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("X-Requested-With", "fetch")
      .set("Cookie", "refresh_token=refresh");
    expect(response.status).toBe(204);
    expect(auth.revokeRefreshToken).toHaveBeenCalledWith("refresh");
    expect(response.headers["set-cookie"][0]).toContain("Max-Age=0");
  });

  it("rejects refresh and logout without the CSRF header", async () => {
    const refreshResponse = await request(app).post("/api/v1/auth/refresh");
    expect(refreshResponse.status).toBe(403);
    const logoutResponse = await request(app).post("/api/v1/auth/logout");
    expect(logoutResponse.status).toBe(403);
  });

  it("rejects refresh and logout from a wrong Origin", async () => {
    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Requested-With", "fetch")
      .set("Origin", "https://evil.example");
    expect(refreshResponse.status).toBe(403);
  });

  it("rejects an expired access token and allows /auth/me with a valid token", async () => {
    auth.verifyAccessToken.mockImplementation(() => {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Invalid or expired access token",
      );
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
      role: "USER",
    });

    const validResponse = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer valid");
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
    const body = response.body as unknown as ErrorBody;
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).toBe("Internal server error");
    expect(body.error).not.toHaveProperty("stack");
  });

  it("rate limits repeated login and register requests", async () => {
    auth.login.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        role: "USER",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });

    let response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "user@example.com", password: "password123" });
    for (let index = 0; index < 12; index++) {
      response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "user@example.com", password: "password123" });
    }

    expect(response.status).toBe(429);
    expect((response.body as unknown as ErrorBody).error.code).toBe(
      "AUTH_RATE_LIMITED",
    );
  });
});
