import { createHash } from "node:crypto";

import webpush from "web-push";

export type PushSendResult = "sent" | "gone" | "transient" | "permanent";

export type PushTransport = {
  send(input: {
    readonly endpoint: string;
    readonly p256dh: string;
    readonly auth: string;
    readonly payload: string;
    readonly topic: string;
  }): Promise<PushSendResult>;
};

export type WebPushCredentials = {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
};

export function createWebPushTransport(credentials: WebPushCredentials | null): PushTransport {
  return {
    async send(input) {
      if (!credentials || !isPublicPushEndpoint(input.endpoint)) {
        return isPublicPushEndpoint(input.endpoint) ? "permanent" : "gone";
      }

      try {
        await webpush.sendNotification(
          { endpoint: input.endpoint, keys: { p256dh: input.p256dh, auth: input.auth } },
          input.payload,
          {
            TTL: 60,
            topic: input.topic,
            timeout: 5000,
            vapidDetails: credentials
          }
        );
        return "sent";
      } catch (error) {
        const status = statusOf(error);

        if (status === 404 || status === 410) {
          return "gone";
        }

        if (status === 429 || (status !== null && status >= 500) || status === null) {
          return "transient";
        }

        return "permanent";
      }
    }
  };
}

export function pushTopic(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey).digest("base64url").slice(0, 32);
}

export function isPublicPushEndpoint(endpoint: string): boolean {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    url.hash === "" &&
    !isBlockedHost(url.hostname)
  );
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1"
  ) {
    return true;
  }

  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);

  if (!match) {
    return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    first >= 224 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function statusOf(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    return typeof error.statusCode === "number" ? error.statusCode : null;
  }

  return null;
}
