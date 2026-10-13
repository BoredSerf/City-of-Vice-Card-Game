import { afterAll, beforeAll, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { createServer, preview } from "vite";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    ...(process.env.CITY_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CITY_CHROMIUM_EXECUTABLE }
      : {}),
  });
});

afterAll(async () => {
  await browser?.close();
});

// Catches a disconnected generated import, a missing application entry, and
// output that works in Vite development but not from the actual built assets.
test.each(["development", "built static"] as const)(
  "%s carries the OCaml probe through TypeScript into the DOM",
  async (mode) => {
    const server =
      mode === "development"
        ? await createServer({
            server: { host: "127.0.0.1", port: 4173, strictPort: true },
          })
        : await preview({
            preview: { host: "127.0.0.1", port: 4173, strictPort: true },
          });
    let context: BrowserContext | undefined;
    const page_errors: string[] = [];
    const external_requests: string[] = [];

    try {
      if ("listen" in server) await server.listen();
      context = await browser.newContext();
      await context.route("**/*", async (route) => {
        const url = route.request().url();
        if (new URL(url).origin === "http://127.0.0.1:4173") {
          await route.continue();
        } else {
          external_requests.push(url);
          await route.abort();
        }
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => page_errors.push(error.message));
      const response = await page.goto("http://127.0.0.1:4173/");
      expect(response?.status()).toBe(200);
      await page.getByRole("status").waitFor();
      await expect
        .poll(() => page.getByRole("status").textContent())
        .toBe("OCaml / S02");
      expect(page_errors).toEqual([]);
      expect(external_requests).toEqual([]);
    } finally {
      try {
        await context?.close();
      } finally {
        await server.close();
      }
    }
  },
);
