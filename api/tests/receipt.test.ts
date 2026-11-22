import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/errors.js";

const auth = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  getUser: vi.fn()
}));

const receipts = vi.hoisted(() => ({
  uploadReceipt: vi.fn(),
  listReceipts: vi.fn(),
  getReceipt: vi.fn(),
  getReceiptImage: vi.fn(),
  deleteReceipt: vi.fn()
}));

vi.mock("../src/services/auth.service.js", () => auth);
vi.mock("../src/services/receipt.service.js", () => receipts);

import { app } from "../src/app.js";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("receipt routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.verifyAccessToken.mockReturnValue({ id: "user-1", role: "USER" });
  });

  it("uploads a valid JPEG and returns 202", async () => {
    receipts.uploadReceipt.mockResolvedValue({ id: "receipt-1", status: "UPLOADED" });

    const response = await request(app)
      .post("/api/v1/receipts")
      .set("Authorization", "Bearer valid")
      .attach("file", jpeg, { filename: "receipt.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: "receipt-1", status: "UPLOADED" });
  });

  it("rejects a wrong MIME type", async () => {
    const response = await request(app)
      .post("/receipts")
      .set("Authorization", "Bearer valid")
      .attach("file", Buffer.from("not an image"), {
        filename: "receipt.txt",
        contentType: "text/plain"
      });

    expect(response.status).toBe(415);
  });

  it("rejects text renamed to .jpg", async () => {
    const response = await request(app)
      .post("/receipts")
      .set("Authorization", "Bearer valid")
      .attach("file", Buffer.from("plain text"), {
        filename: "receipt.jpg",
        contentType: "image/jpeg"
      });

    expect(response.status).toBe(415);
  });

  it("rejects files larger than 10 MB", async () => {
    const response = await request(app)
      .post("/receipts")
      .set("Authorization", "Bearer valid")
      .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: "large.png",
        contentType: "image/png"
      });

    expect(response.status).toBe(413);
  });

  it("lists receipts with filters and pagination", async () => {
    receipts.listReceipts.mockResolvedValue({
      items: [{ id: "receipt-1" }],
      page: 2,
      pageSize: 10,
      total: 11
    });

    const response = await request(app)
      .get("/receipts")
      .query({
        status: "NEEDS_REVIEW",
        from: "2026-01-01",
        to: "2026-01-31",
        categoryId: 3,
        q: "Market",
        page: 2,
        pageSize: 10
      })
      .set("Authorization", "Bearer valid");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{ id: "receipt-1" }],
      page: 2,
      pageSize: 10,
      total: 11
    });
    expect(receipts.listReceipts).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        status: "NEEDS_REVIEW",
        categoryId: 3,
        q: "Market",
        page: 2,
        pageSize: 10
      })
    );
  });

  it("returns 404 for another user's receipt", async () => {
    receipts.getReceipt.mockRejectedValue(
      new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found")
    );

    const response = await request(app)
      .get("/receipts/other-user-receipt")
      .set("Authorization", "Bearer valid");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("RECEIPT_NOT_FOUND");
  });

  it("accepts valid PNG magic bytes", async () => {
    receipts.uploadReceipt.mockResolvedValue({ id: "receipt-png", status: "UPLOADED" });
    const response = await request(app)
      .post("/receipts")
      .set("Authorization", "Bearer valid")
      .attach("file", png, { filename: "receipt.png", contentType: "image/png" });
    expect(response.status).toBe(202);
  });
});
