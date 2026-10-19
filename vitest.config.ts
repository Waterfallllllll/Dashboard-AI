import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage"
    },
    passWithNoTests: true,
    projects: [
      {
        root: "apps/web",
        test: {
          name: "web",
          environment: "jsdom"
        }
      },
      {
        root: "apps/api",
        test: {
          name: "api",
          environment: "node"
        }
      },
      {
        root: "packages/contracts",
        test: {
          name: "contracts",
          environment: "node"
        }
      }
    ]
  }
});
