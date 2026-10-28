import { afterAll, beforeAll, expect, test } from "vitest";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import type { Browser, BrowserContext } from "playwright";
import { generated_adapter } from "../../vite.config.ts";
import { current_save_key } from "../../src/app/persistence.ts";
import type {
  Engine_state,
  Engine_event,
  Player_view,
} from "@city-of-vice/engine";

process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
  new URL("../../.cache/ms-playwright", import.meta.url),
);
const { chromium } = await import("playwright");
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

test("S08-B01 actual localStorage, page reload, fresh controller, no replay and literal rival continuation; rejected replacement and sentinels", async () => {
  const cases = JSON.parse(
    readFileSync(new URL("../policy/scenarios.json", import.meta.url), "utf8"),
  ) as {
    cases: {
      id: string;
      initial_state: Engine_state;
      initial_views: Player_view[];
      steps: {
        expected_events: Engine_event[];
        expected_views: Player_view[];
      }[];
    }[];
  };
  const literal = cases.cases.find((c) => c.id === "S01-AI-FUND-001")!;
  expect(literal.steps).toHaveLength(2);
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../..", import.meta.url)),
    publicDir: false,
    resolve: { alias: { "@city-of-vice/engine": generated_adapter } },
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  let context: BrowserContext | undefined;
  const page_errors: string[] = [],
    external_requests: string[] = [];
  try {
    await server.listen();
    const origin = new URL(server.resolvedUrls!.local[0]!).origin;
    context = await browser.newContext();
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (new URL(url).origin === origin) await route.continue();
      else {
        external_requests.push(url);
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => page_errors.push(error.message));
    const response = await page.goto(origin + "/tests/browser/controller.html");
    expect(response?.status()).toBe(200);
    await page
      .getByRole("status")
      .filter({ hasText: "Controller ready" })
      .waitFor();
    await page.evaluate(
      ({ key, state }) => {
        localStorage.setItem(key, state);
        localStorage.setItem("city-of-vice-current-v6", "legacy sentinel");
        localStorage.setItem(
          "city-of-vice-achievements-v1",
          "achievement sentinel",
        );
      },
      { key: current_save_key, state: JSON.stringify(literal.initial_state) },
    );
    const resumed = await page.evaluate(() => window.controller_test.resume());
    expect(resumed.trusted_events).toEqual([]);
    expect(resumed.snapshot.human?.view).toEqual(literal.initial_views[0]);
    const first = await page.evaluate(() =>
      window.controller_test.step_rival(),
    );
    expect(first.trusted_events).toEqual(literal.steps[0]!.expected_events);
    expect(first.snapshot.human?.view).toEqual(
      literal.steps[0]!.expected_views[0],
    );
    const saved = await page.evaluate(
      (key) => localStorage.getItem(key),
      current_save_key,
    );
    expect(JSON.parse(saved!).players[1].resources.blue).toBe(1);
    await page.reload();
    await page
      .getByRole("status")
      .filter({ hasText: "Controller ready" })
      .waitFor();
    expect(
      await page.evaluate(() => window.controller_test.snapshot().human),
    ).toBeNull();
    const fresh = await page.evaluate(() => window.controller_test.resume());
    expect(fresh.trusted_events).toEqual([]);
    expect(fresh.snapshot.human).toEqual(first.snapshot.human);
    expect(fresh.snapshot.save.saved).toBe(true);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), current_save_key),
    ).toBe(saved);
    const second = await page.evaluate(() =>
      window.controller_test.step_rival(),
    );
    expect(second.trusted_events).toEqual(literal.steps[1]!.expected_events);
    expect(second.snapshot.human?.view).toEqual(
      literal.steps[1]!.expected_views[0],
    );
    const rejected = "\n{not a modular save}\n";
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: current_save_key,
      value: rejected,
    });
    await page.reload();
    await page
      .getByRole("status")
      .filter({ hasText: "Controller ready" })
      .waitFor();
    const inspected = await page.evaluate(() =>
      window.controller_test.inspect_save(),
    );
    expect(inspected.snapshot.human).toBeNull();
    expect(inspected.rejection).toEqual({
      code: "malformed_state",
      field: "json",
    });
    expect(
      (await page.evaluate(() => window.controller_test.resume())).status,
    ).toBe("rejected");
    expect(
      (await page.evaluate(() => window.controller_test.cancel())).status,
    ).toBe("cancelled");
    expect(
      (
        await page.evaluate(() =>
          window.controller_test.new_game("00000001", "empty_only"),
        )
      ).status,
    ).toBe("replacement_required");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), current_save_key),
    ).toBe(rejected);
    await page.reload();
    await page
      .getByRole("status")
      .filter({ hasText: "Controller ready" })
      .waitFor();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), current_save_key),
    ).toBe(rejected);
    const replaced = await page.evaluate(() =>
      window.controller_test.new_game("00000001", "replace"),
    );
    expect(replaced.status).toBe("applied");
    expect(replaced.snapshot.save.saved).toBe(true);
    expect(
      JSON.parse(
        (await page.evaluate(
          (key) => localStorage.getItem(key),
          current_save_key,
        ))!,
      ).phase,
    ).toBe("awaiting_opening");
    expect(
      await page.evaluate(() => [
        localStorage.getItem("city-of-vice-current-v6"),
        localStorage.getItem("city-of-vice-achievements-v1"),
      ]),
    ).toEqual(["legacy sentinel", "achievement sentinel"]);
    expect(page_errors).toEqual([]);
    expect(external_requests).toEqual([]);
  } finally {
    try {
      await context?.close();
    } finally {
      await server.close();
    }
  }
});
