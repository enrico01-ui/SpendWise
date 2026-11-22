declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: "USER" | "ADMIN";
      };
    }

    interface Locals {
      validated: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      requestId: string;
    }
  }
}

export {};
