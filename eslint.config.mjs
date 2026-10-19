import { defineConfig, globalIgnores } from "eslint/config";
import baseConfig from "@dashboard/config/eslint/base";
import nextConfig from "@dashboard/config/eslint/next";
import nodeConfig from "@dashboard/config/eslint/node";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "**/next-env.d.ts",
    "playwright-report/**",
    "test-results/**"
  ]),
  ...baseConfig,
  ...nextConfig,
  ...nodeConfig
]);
