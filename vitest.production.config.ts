import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@city-of-vice/engine": fileURLToPath(
        new URL("./.cache/facade-production/adapter.mjs", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/contract/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false,
    allowOnly: false,
    testTimeout: 10_000,
  },
});
