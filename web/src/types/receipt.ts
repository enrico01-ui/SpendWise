export type ReceiptStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "CONFIRMED"
  | "FAILED";

export type Receipt = {
  id: string;
  status: ReceiptStatus;
  merchantName?: string | null;
  purchaseDate?: string | null;
  totalAmount?: number | null;
  rawText?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ReceiptItem[];
  [key: string]: unknown;
};

export type ReceiptItem = {
  id: string;
  name: string;
  qty: number;
  lineTotal: number;
};
