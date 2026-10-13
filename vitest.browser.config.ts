import { defineConfig } from "vitest/config";

// The Node runner controls a real Playwright browser against the actual app
// entries. It does not replace the page DOM with jsdom or a component harness.
export default defineConfig({
  test: {
    include: ["tests/browser/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false,
    allowOnly: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
