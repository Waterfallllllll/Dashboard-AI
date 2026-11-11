import type { RequestSession } from "./auth.types.js";

declare global {
  // Express дополняет Request через namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      session?: RequestSession;
    }
  }
}

export {};
