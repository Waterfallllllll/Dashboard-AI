import { readFileSync } from "node:fs";
import path, { resolve } from "node:path";

import type { NextConfig } from "next";

import { internalApiOrigin } from "./src/lib/api/internal-api-origin";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()"
  }
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains"
  });
}

const webPushEnv = webPushPublicEnv();

const nextConfig: NextConfig = {
  output: "standalone",
  ...(webPushEnv ? { env: webPushEnv } : {}),
  experimental: {
    // Turbopack 16.4 восстанавливает версию HMR из файлового кэша .next/dev.
    // Первая подписка тогда отвечает restart, сервер шлёт «HMR hash mismatch»,
    // и открытая вкладка перезагружает документ без остановки.
    turbopackFileSystemCacheForDev: false
  },
  async rewrites() {
    const origin = internalApiOrigin(readInternalApiUrl());

    return [
      {
        source: "/api/v1/:path*",
        destination: `${origin}/api/v1/:path*`
      }
    ];
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@dashboard/contracts"],
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'"
          }
        ]
      },
      {
        source: "/push-contract.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }]
      }
    ];
  }
};

export default nextConfig;

function readInternalApiUrl(): string | undefined {
  const configured = process.env.INTERNAL_API_URL?.trim();

  if (configured) {
    return configured;
  }

  return readRootEnv("INTERNAL_API_URL");
}

function webPushPublicEnv(): { NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: string } | undefined {
  const configured =
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ||
    readRootEnv("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY");

  if (!configured) {
    return undefined;
  }

  return { NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: configured };
}

function readRootEnv(name: string): string | undefined {
  try {
    const source = readFileSync(resolve(import.meta.dirname, "../../.env"), "utf8");
    return source.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}
