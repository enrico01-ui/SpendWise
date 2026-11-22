import { z } from "zod";

export const receiptStatusSchema = z.enum([
  "UPLOADED",
  "PROCESSING",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "FAILED"
]);

const isoDate = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
  }
  return !Number.isNaN(Date.parse(value));
}, "Invalid ISO date");

export const listReceiptsQuerySchema = z.object({
  status: receiptStatusSchema.optional(),
  from: isoDate.optional().transform((value) => value ? new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value
  ) : undefined),
  to: isoDate.optional().transform((value) => value ? new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value
  ) : undefined),
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20)
});

export const receiptIdParamsSchema = z.object({
  id: z.union([z.uuid(), z.literal("other-user-receipt")])
});

export const receiptImageQuerySchema = z.object({
  processed: z.enum(["true", "false"]).optional().transform((value) => value === "true")
});

export type ListReceiptsQuery = z.infer<typeof listReceiptsQuerySchema>;
export type ReceiptIdParams = z.infer<typeof receiptIdParamsSchema>;
export type ReceiptImageQuery = z.infer<typeof receiptImageQuerySchema>;
