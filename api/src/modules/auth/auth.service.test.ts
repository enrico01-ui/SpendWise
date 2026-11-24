import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const bcrypt = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
  hashSync: vi.fn(() => "$2b$12$dummy"),
}));

vi.mock("../../database/prisma.js", () => ({ prisma }));
vi.mock("bcrypt", () => ({ default: bcrypt }));

import {
  cleanupExpiredOrRevokedRefreshTokens,
  login,
  refresh,
} from "./auth.service.js";

describe("auth service security behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compares a password for an existing user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "USER",
      passwordHash: "real-hash",
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      login({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(bcrypt.compare).toHaveBeenCalledWith("wrong-password", "real-hash");
  });

  it("compares a password against a dummy hash when the email is missing", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      login({
        email: "missing@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(bcrypt.compare).toHaveBeenCalledWith(
      "wrong-password",
      "$2b$12$dummy",
    );
  });

  it("allows exactly one concurrent refresh for a token", async () => {
    let active = true;
    const tokenRecord = {
      id: "token-1",
      userId: "user-1",
      tokenHash: "hashed",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    };
    const user = {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "USER",
    };

    prisma.$transaction.mockImplementation(
      (operation: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          refreshToken: {
            findUnique: vi.fn().mockResolvedValue(tokenRecord),
            updateMany: vi.fn().mockImplementation(() => {
              if (active) {
                active = false;
                return Promise.resolve({ count: 1 });
              }
              return Promise.resolve({ count: 0 });
            }),
            create: vi.fn().mockResolvedValue({}),
          },
          user: {
            findUnique: vi.fn().mockResolvedValue(user),
          },
        };
        return operation(tx);
      },
    );

    const results = await Promise.allSettled([
      refresh("token-a"),
      refresh("token-a"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("deletes refresh tokens expired or revoked more than 30 days ago", async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
    const now = new Date("2026-11-22T00:00:00.000Z");

    const deleted = await cleanupExpiredOrRevokedRefreshTokens(now);

    expect(deleted).toBe(3);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lte: new Date("2026-10-23T00:00:00.000Z") } },
          {
            revokedAt: { not: null, lte: new Date("2026-10-23T00:00:00.000Z") },
          },
        ],
      },
    });
  });
});
