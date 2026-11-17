import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Role, User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PublicUser = Pick<User, "id" | "email" | "name" | "role">;

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, "CONFIGURATION_ERROR", "JWT_SECRET is not configured");
  }
  return secret;
};

const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const toPublicUser = (user: PublicUser): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role
});

const issueTokens = async (user: PublicUser) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, getSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });
  const refreshToken = randomBytes(32).toString("hex");

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    }
  });

  return { accessToken, refreshToken };
};

export const register = async (email: string, password: string, name: string) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name }
  });
  return { user: toPublicUser(user), ...(await issueTokens(user)) };
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return { user: toPublicUser(user), ...(await issueTokens(user)) };
};

export const refresh = async (token: string) => {
  const tokenHash = hashRefreshToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    throw new AppError(401, "REFRESH_TOKEN_REUSE", "Refresh token reuse detected");
  }
  if (stored.expiresAt <= new Date()) {
    throw new AppError(401, "EXPIRED_REFRESH_TOKEN", "Refresh token has expired");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }

  const tokens = await prisma.$transaction(async (transaction) => {
    await transaction.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });
    const nextRefreshToken = randomBytes(32).toString("hex");
    await transaction.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
      }
    });
    return {
      accessToken: jwt.sign({ id: user.id, role: user.role }, getSecret(), {
        expiresIn: ACCESS_TOKEN_TTL_SECONDS
      }),
      refreshToken: nextRefreshToken
    };
  });

  return { user: toPublicUser(user), ...tokens };
};

export const verifyAccessToken = (token: string): { id: string; role: Role } => {
  try {
    const payload = jwt.verify(token, getSecret());
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.id !== "string" ||
      (payload.role !== "USER" && payload.role !== "ADMIN")
    ) {
      throw new Error("Invalid token payload");
    }
    return { id: payload.id, role: payload.role };
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token");
  }
};

export const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User no longer exists");
  }
  return toPublicUser(user);
};
