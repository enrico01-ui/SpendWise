import { randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReceiptStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { NotFoundError } from "../../common/errors/app-error.js";
import type { ListReceiptsQuery } from "./receipts.schemas.js";

export type UploadedImage = { buffer: Buffer; extension: "jpg" | "png" };

const uploadsRoot = (): string => path.resolve(process.cwd(), env.UPLOAD_DIR);
const resolveReceiptFile = (imagePath: string): string =>
  path.resolve(process.cwd(), imagePath);

export const uploadReceipt = async (
  userId: string,
  image: UploadedImage,
): Promise<{ id: string; status: ReceiptStatus }> => {
  const id = randomUUID();
  const directory = path.join(uploadsRoot(), userId);
  await mkdir(directory, { recursive: true });
  const imagePath = path.join(directory, `${id}.${image.extension}`);
  await writeFile(imagePath, image.buffer);
  try {
    const receipt = await prisma.receipt.create({
      data: {
        id,
        userId,
        imagePath: path
          .relative(process.cwd(), imagePath)
          .replaceAll("\\", "/"),
        status: "UPLOADED",
      },
    });
    return { id: receipt.id, status: receipt.status };
  } catch (error) {
    await unlink(imagePath).catch(() => undefined);
    throw error;
  }
};

export const listReceipts = async (
  userId: string,
  filters: ListReceiptsQuery,
) => {
  const where = {
    userId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId !== undefined
      ? { categoryId: filters.categoryId }
      : {}),
    ...(filters.q
      ? { merchantName: { contains: filters.q, mode: "insensitive" as const } }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.receipt.count({ where }),
  ]);
  return { items, page: filters.page, pageSize: filters.pageSize, total };
};

export const getReceipt = async (userId: string, id: string) => {
  const receipt = await prisma.receipt.findFirst({
    where: { id, userId },
    include: { items: true, duplicateOf: true, corrections: true },
  });
  if (!receipt)
    throw new NotFoundError("Receipt not found", "RECEIPT_NOT_FOUND");
  return receipt;
};

export const getReceiptImage = async (
  userId: string,
  id: string,
  processed: boolean,
): Promise<string> => {
  const receipt = await prisma.receipt.findFirst({ where: { id, userId } });
  if (!receipt)
    throw new NotFoundError("Receipt not found", "RECEIPT_NOT_FOUND");
  const originalPath = resolveReceiptFile(receipt.imagePath);
  const imagePath = processed
    ? path.join(
        path.dirname(originalPath),
        `${path.basename(originalPath, path.extname(originalPath))}.processed.png`,
      )
    : originalPath;
  try {
    await stat(imagePath);
  } catch {
    throw new NotFoundError(
      "Receipt image not found",
      "RECEIPT_IMAGE_NOT_FOUND",
    );
  }
  return imagePath;
};

export const deleteReceipt = async (
  userId: string,
  id: string,
): Promise<void> => {
  const receipt = await prisma.receipt.findFirst({ where: { id, userId } });
  if (!receipt)
    throw new NotFoundError("Receipt not found", "RECEIPT_NOT_FOUND");
  await prisma.receipt.delete({ where: { id } });
  const originalPath = resolveReceiptFile(receipt.imagePath);
  const processedPath = path.join(
    path.dirname(originalPath),
    `${path.basename(originalPath, path.extname(originalPath))}.processed.png`,
  );
  await Promise.all(
    [originalPath, processedPath].map((filePath) =>
      unlink(filePath).catch(() => undefined),
    ),
  );
};
