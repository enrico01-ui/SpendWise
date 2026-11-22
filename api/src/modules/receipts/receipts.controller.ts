import type { RequestHandler } from "express";
import { getAuthUser } from "../../common/middleware/require-auth.js";
import {
  getValidatedParams,
  getValidatedQuery,
} from "../../common/middleware/validate.js";
import type {
  ListReceiptsQuery,
  ReceiptIdParams,
  ReceiptImageQuery,
} from "./receipts.schemas.js";
import * as receiptService from "./receipts.service.js";

export const uploadReceipt: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  if (!request.file)
    throw new Error("Upload middleware did not provide a file");
  const extension = request.file.buffer[0] === 0xff ? "jpg" : "png";
  response.status(202).json(
    await receiptService.uploadReceipt(user.id, {
      buffer: request.file.buffer,
      extension,
    }),
  );
};

export const listReceipts: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  const query = getValidatedQuery<ListReceiptsQuery>(response);
  response.json(await receiptService.listReceipts(user.id, query));
};

export const getReceipt: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  const params = getValidatedParams<ReceiptIdParams>(response);
  response.json(await receiptService.getReceipt(user.id, params.id));
};

export const getReceiptImage: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  const params = getValidatedParams<ReceiptIdParams>(response);
  const query = getValidatedQuery<ReceiptImageQuery>(response);
  const imagePath = await receiptService.getReceiptImage(
    user.id,
    params.id,
    query.processed ?? false,
  );
  response.sendFile(imagePath);
};

export const deleteReceipt: RequestHandler = async (request, response) => {
  const user = getAuthUser(request);
  const params = getValidatedParams<ReceiptIdParams>(response);
  await receiptService.deleteReceipt(user.id, params.id);
  response.status(204).end();
};
