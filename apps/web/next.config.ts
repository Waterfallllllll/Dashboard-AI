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

const nextConfig: NextConfig = {
  output: "standalone",
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

  try {
    const source = readFileSync(resolve(import.meta.dirname, "../../.env"), "utf8");
    return source.match(/^INTERNAL_API_URL=(.*)$/m)?.[1];
  } catch {
    return undefined;
  }
}
