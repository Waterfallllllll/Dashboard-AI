import pino from "pino";
import type { Logger } from "pino";

export type { Logger };

export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: {
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        "res.headers['set-cookie']",
        "req.query.code",
        "req.query.state"
      ],
      censor: "[redacted]"
    }
  });
}

export function pathOnly(url: string | undefined): string {
  if (!url) {
    return "";
  }

  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
}
