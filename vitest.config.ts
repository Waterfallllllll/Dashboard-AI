import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.join(workspaceRoot, "apps/web/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": webSrc
    }
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage"
    },
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["apps/web/src/**/*.unit.test.ts"]
        }
      },
      {
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["./apps/web/src/test/setup.ts"],
          include: ["apps/web/src/**/*.component.test.tsx"]
        }
      },
      {
        test: {
          name: "integration",
          environment: "jsdom",
          setupFiles: ["./apps/web/src/test/setup.ts"],
          include: ["apps/web/src/**/*.integration.test.tsx"]
        }
      },
      {
        test: {
          name: "api",
          environment: "node",
          include: ["apps/api/src/**/*.unit.test.ts", "apps/api/src/**/*.integration.test.ts"]
        }
      },
      {
        test: {
          name: "contracts",
          environment: "node",
          include: ["packages/contracts/src/**/*.unit.test.ts"]
        }
      }
    ]
  }
});
