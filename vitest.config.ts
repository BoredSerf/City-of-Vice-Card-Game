import { defineConfig } from "vitest/config";
import { generated_adapter } from "./vite.config.ts";

export default defineConfig({
  resolve: {
    alias: { "@city-of-vice/engine": generated_adapter },
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
