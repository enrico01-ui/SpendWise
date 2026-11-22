import { Router } from "express";
import { requireAuth } from "../../common/middleware/require-auth.js";
import {
  uploadReceiptFile,
  validateReceiptMagicBytes,
} from "../../common/middleware/upload.js";
import { validate } from "../../common/middleware/validate.js";
import {
  deleteReceipt,
  getReceipt,
  getReceiptImage,
  listReceipts,
  uploadReceipt,
} from "./receipts.controller.js";
import {
  listReceiptsQuerySchema,
  receiptIdParamsSchema,
  receiptImageQuerySchema,
} from "./receipts.schemas.js";

export const receiptRouter = Router();

receiptRouter.use(requireAuth);
receiptRouter.post(
  "/",
  uploadReceiptFile,
  validateReceiptMagicBytes,
  uploadReceipt,
);
receiptRouter.get(
  "/",
  validate({ query: listReceiptsQuerySchema }),
  listReceipts,
);
receiptRouter.get(
  "/:id",
  validate({ params: receiptIdParamsSchema }),
  getReceipt,
);
receiptRouter.get(
  "/:id/image",
  validate({ params: receiptIdParamsSchema, query: receiptImageQuerySchema }),
  getReceiptImage,
);
receiptRouter.delete(
  "/:id",
  validate({ params: receiptIdParamsSchema }),
  deleteReceipt,
);
