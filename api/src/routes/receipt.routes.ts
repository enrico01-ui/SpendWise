import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/require-auth.js";
import * as receiptService from "../services/receipt.service.js";

const receiptStatusSchema = z.enum([
  "UPLOADED",
  "PROCESSING",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "FAILED"
]);

const dateSchema = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
  }
  return !Number.isNaN(Date.parse(value));
}, "Invalid ISO date");

const listQuerySchema = z.object({
  status: receiptStatusSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20)
});

const parseQuery = (query: unknown) => {
  const result = listQuerySchema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid query parameters", result.error.flatten());
  }
  return result.data;
};

const parseDate = (value: string | undefined, endOfDay = false): Date | undefined => {
  if (!value) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  }
  return new Date(value);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== "image/jpeg" && file.mimetype !== "image/png") {
      callback(new AppError(415, "UNSUPPORTED_FILE_TYPE", "Only JPG and PNG files are supported"));
      return;
    }
    callback(null, true);
  }
});

const inspectImage = (buffer: Buffer): "jpg" | "png" | null => {
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  if (jpeg) {
    return "jpg";
  }
  const png =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  return png ? "png" : null;
};

export const receiptRouter = Router();

receiptRouter.use(requireAuth);

receiptRouter.post("/", upload.single("file"), async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  if (!request.file) {
    throw new AppError(400, "FILE_REQUIRED", "A receipt image file is required");
  }

  const extension = inspectImage(request.file.buffer);
  if (!extension) {
    throw new AppError(415, "UNSUPPORTED_FILE_TYPE", "File content is not a valid JPG or PNG");
  }

  const result = await receiptService.uploadReceipt(request.user.id, {
    buffer: request.file.buffer,
    extension
  });
  response.status(202).json(result);
});

receiptRouter.get("/", async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  const query = parseQuery(request.query);
  response.json(
    await receiptService.listReceipts(request.user.id, {
      status: query.status,
      from: parseDate(query.from),
      to: parseDate(query.to, true),
      categoryId: query.categoryId,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize
    })
  );
});

receiptRouter.get("/:id", async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  if (typeof request.params.id !== "string") {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
  }
  response.json(await receiptService.getReceipt(request.user.id, request.params.id));
});

const sendReceiptImage: RequestHandler = async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  if (typeof request.params.id !== "string") {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
  }
  const processed = request.query.processed === "true";
  const imagePath = await receiptService.getReceiptImage(
    request.user.id,
    request.params.id,
    processed
  );
  response.sendFile(imagePath);
};

receiptRouter.get("/:id/image", sendReceiptImage);

receiptRouter.delete("/:id", async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  }
  if (typeof request.params.id !== "string") {
    throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
  }
  await receiptService.deleteReceipt(request.user.id, request.params.id);
  response.status(204).end();
});
