import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Role, User } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { ConflictError, UnauthorizedError } from "../../common/errors/app-error.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  BCRYPT_COST,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_TOKEN_BYTES
} from "./auth.constants.js";
import type { LoginDto, RegisterDto, RefreshDto } from "./auth.schemas.js";

type PublicUser = Pick<User, "id" | "email" | "name" | "role">;

const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const toPublicUser = (user: PublicUser): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role
});

export const signAccessToken = (user: PublicUser): string => {
  if (!env.JWT_SECRET) throw new UnauthorizedError("JWT_SECRET is not configured", "CONFIGURATION_ERROR");
  return jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });
};

const issueTokens = async (user: PublicUser) => {
  const accessToken = signAccessToken(user);
  const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    }
  });
  return { accessToken, refreshToken };
};

export const register = async (dto: RegisterDto) => {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new ConflictError("An account with this email already exists", "EMAIL_ALREADY_EXISTS");
  }
  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
  const user = await prisma.user.create({ data: { email: dto.email, passwordHash, name: dto.name } });
  return { user: toPublicUser(user), ...(await issueTokens(user)) };
};

export const login = async (dto: LoginDto) => {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
  }
  return { user: toPublicUser(user), ...(await issueTokens(user)) };
};

export const refresh = async (dto: RefreshDto) => {
  const tokenHash = hashRefreshToken(dto.refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) throw new UnauthorizedError("Invalid refresh token", "INVALID_REFRESH_TOKEN");
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    throw new UnauthorizedError("Refresh token reuse detected", "REFRESH_TOKEN_REUSE");
  }
  if (stored.expiresAt <= new Date()) {
    throw new UnauthorizedError("Refresh token has expired", "EXPIRED_REFRESH_TOKEN");
  }
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new UnauthorizedError("Invalid refresh token", "INVALID_REFRESH_TOKEN");

  const tokens = await prisma.$transaction(async (transaction) => {
    await transaction.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const nextRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    await transaction.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
      }
    });
    return { accessToken: signAccessToken(user), refreshToken: nextRefreshToken };
  });
  return { user: toPublicUser(user), ...tokens };
};

export const verifyAccessToken = (token: string): { id: string; role: Role } => {
  try {
    if (!env.JWT_SECRET) throw new Error("Missing secret");
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload !== "object" || payload === null ||
        typeof payload.id !== "string" ||
        (payload.role !== "USER" && payload.role !== "ADMIN")) {
      throw new Error("Invalid token payload");
    }
    return { id: payload.id, role: payload.role };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
};

export const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new UnauthorizedError("User no longer exists");
  return toPublicUser(user);
};
