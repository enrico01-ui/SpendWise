export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = "Bad request",
    code = "BAD_REQUEST",
    details: Record<string, unknown> = {},
  ) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = "Authentication is required",
    code = "UNAUTHORIZED",
    details: Record<string, unknown> = {},
  ) {
    super(401, code, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = "Not found",
    code = "NOT_FOUND",
    details: Record<string, unknown> = {},
  ) {
    super(404, code, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Conflict",
    code = "CONFLICT",
    details: Record<string, unknown> = {},
  ) {
    super(409, code, message, details);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(
    message = "Unsupported media type",
    code = "UNSUPPORTED_MEDIA_TYPE",
    details: Record<string, unknown> = {},
  ) {
    super(415, code, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(
    message = "Payload too large",
    code = "PAYLOAD_TOO_LARGE",
    details: Record<string, unknown> = {},
  ) {
    super(413, code, message, details);
  }
}
