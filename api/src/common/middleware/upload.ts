import multer from "multer";
import type { RequestHandler } from "express";
import { UnsupportedMediaTypeError } from "../errors/app-error.js";
import { MAX_UPLOAD_BYTES } from "../../modules/receipts/receipts.constants.js";

const inspectImage = (buffer: Buffer): "jpg" | "png" | null => {
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  if (jpeg) return "jpg";
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== "image/jpeg" && file.mimetype !== "image/png") {
      callback(
        new UnsupportedMediaTypeError(
          "Only JPG and PNG files are supported",
          "UNSUPPORTED_FILE_TYPE",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

export const uploadReceiptFile = upload.single("file");

export const validateReceiptMagicBytes: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!request.file) {
    next(
      new UnsupportedMediaTypeError(
        "A receipt image file is required",
        "FILE_REQUIRED",
      ),
    );
    return;
  }
  if (!inspectImage(request.file.buffer)) {
    next(
      new UnsupportedMediaTypeError(
        "File content is not a valid JPG or PNG",
        "UNSUPPORTED_FILE_TYPE",
      ),
    );
    return;
  }
  next();
};
