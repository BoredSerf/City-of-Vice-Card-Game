import { afterAll, beforeAll, expect, test } from "vitest";
import type { Browser, BrowserContext, Page } from "playwright";
import { createServer, preview } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { Engine_state } from "@city-of-vice/engine";

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
const key = "city-of-vice-modular-current-v1";
const policy = JSON.parse(
  readFileSync(new URL("../policy/scenarios.json", import.meta.url), "utf8"),
) as { cases: { id: string; initial_state: Engine_state }[] };
const effects = JSON.parse(
  readFileSync(new URL("../effects/scenarios.json", import.meta.url), "utf8"),
) as { cases: { id: string; initial_state: Engine_state }[] };
const rich = JSON.parse(
  readFileSync(
    new URL("../presentation/rich_cases.json", import.meta.url),
    "utf8",
  ),
) as { cases: { id: string; initial_state: Engine_state }[] };
const awards_key = "city-of-vice-modular-achievements-v1";
async function screenshot(page: Page, name: string, mode: string) {
  await page.locator(".hero_image").evaluateAll(async (nodes) => {
    await Promise.all(nodes.map((node) => (node as HTMLImageElement).decode()));
  });
  if (process.env.CITY_UI_EVIDENCE_DIR)
    await page.screenshot({
      path: `${process.env.CITY_UI_EVIDENCE_DIR}/s10-modular-${name}-${mode.replaceAll(" ", "-")}.png`,
      fullPage: true,
      animations: "disabled",
    });
}

async function preload(page: Page, state: Engine_state) {
  await page.evaluate(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    { key, state },
  );
  await page.reload();
  await page.getByRole("heading", { name: "Main menu", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Resume saved game", exact: true })
    .click();
}
// Replaces the S02 probe assertion with actual engine→controller→normal product DOM.
test.each(["development", "built static"] as const)(
  "S09-B01 %s normal entry plays a turn, acknowledges once, reloads/resumes and executes actual human/rival finishing transitions",
  async (mode) => {
    const server =
      mode === "development"
        ? await createServer({
            server: { host: "127.0.0.1", port: 0, strictPort: true },
          })
        : await preview({
            preview: { host: "127.0.0.1", port: 0, strictPort: true },
          });
    let context: BrowserContext | undefined;
    const page_errors: string[] = [],
      external_requests: string[] = [],
      asset_responses: string[] = [];
    try {
      if ("listen" in server) await server.listen();
      const origin = new URL(server.resolvedUrls!.local[0]!).origin;
      context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.route("**/*", async (route) => {
        const url = route.request().url();
        if (new URL(url).origin === origin) await route.continue();
        else {
          external_requests.push(url);
          await route.abort();
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5_000);
      page.on("pageerror", (error) => page_errors.push(error.message));
      page.on("response", (response) => {
        const name = new URL(response.url()).pathname.split("/").at(-1)!;
        if (name.endsWith(".webp") && response.status() === 200)
          asset_responses.push(name);
      });
      expect((await page.goto(origin))?.status()).toBe(200);
      await page
        .getByRole("heading", { name: "Main menu", exact: true })
        .waitFor();
      expect(
        await page
          .locator(".hero_menu")
          .evaluate((node) =>
            (node as HTMLImageElement)
              .decode()
              .then(() => [
                (node as HTMLImageElement).naturalWidth,
                (node as HTMLImageElement).naturalHeight,
              ]),
          ),
      ).toEqual([959, 540]);
      await screenshot(page, "menu", mode);
      await page.getByRole("button", { name: "Rules", exact: true }).click();
      expect(
        await page
          .getByRole("region", { name: "Crew bonuses", exact: true })
          .getByRole("heading", { level: 4 })
          .count(),
      ).toBe(8);
      expect(
        await page
          .getByRole("region", { name: "Rules", exact: true })
          .getByRole("heading", { level: 3 })
          .count(),
      ).toBe(9);
      await screenshot(page, "rules", mode);
      await page
        .getByRole("button", { name: "Card gallery", exact: true })
        .click();
      const gallery_names: string[] = [];
      for (let n = 1; n <= 3; n++) {
        const gallery = page.getByRole("region", {
          name: "Card gallery",
          exact: true,
        });
        expect(
          await gallery.getByRole("button", { name: /^Inspect / }).count(),
        ).toBe(12);
        gallery_names.push(
          ...(await gallery
            .getByRole("button", { name: /^Inspect / })
            .allTextContents()),
        );
        await gallery.locator(".portrait").evaluateAll(async (nodes) => {
          await Promise.all(
            nodes.map(async (node) => {
              const image = new Image();
              image.src = getComputedStyle(node).backgroundImage.slice(5, -2);
              await image.decode();
            }),
          );
        });
        await screenshot(page, `gallery-${n}`, mode);
        if (process.env.CITY_UI_EVIDENCE_DIR)
          await gallery.screenshot({
            path: `${process.env.CITY_UI_EVIDENCE_DIR}/s10-modular-crops-${n}-${mode.replaceAll(" ", "-")}.png`,
          });
        if (n < 3)
          await page
            .getByRole("button", { name: "Next 12", exact: true })
            .click();
      }
      expect(new Set(gallery_names).size).toBe(36);
      await page
        .getByRole("button", { name: "Inspect Leonard Huff", exact: true })
        .click();
      expect(
        await page
          .getByRole("region", { name: "Card inspection", exact: true })
          .textContent(),
      ).toContain("Location not shown");
      expect(
        await page
          .locator(".inspection_art .portrait")
          .evaluate((node) => getComputedStyle(node).backgroundSize),
      ).toBe("cover");
      await screenshot(page, "leonard", mode);
      await page
        .getByRole("button", { name: "Close information", exact: true })
        .click();
      await page.getByRole("button", { name: "New game", exact: true }).focus();
      await page.keyboard.press("Enter");
      expect(
        await page
          .getByRole("region", { name: "Opening distributors", exact: true })
          .getByRole("button", { name: /^Start with / })
          .count(),
      ).toBe(24);
      await screenshot(page, "opening", mode);
      await page
        .getByLabel("Opening distributor", { exact: true })
        .selectOption({ index: 1 });
      await page
        .getByRole("button", {
          name: "Choose opening distributor",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Collect income", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Choose action: Cash card", exact: true })
        .click();
      await page
        .getByLabel("Card to cash", { exact: true })
        .selectOption({ index: 1 });
      await page
        .getByLabel("Resource to gain", { exact: true })
        .selectOption({ index: 1 });
      await page
        .getByRole("button", { name: "Cash card", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Choose action: End turn", exact: true })
        .click();
      await page.getByRole("button", { name: "End turn", exact: true }).click();
      await page
        .getByRole("region", { name: "Rival actions", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Continue", exact: true })
        .waitFor({ timeout: 20_000 });
      const before_ack = await page.evaluate(
        (key) => localStorage.getItem(key),
        key,
      );
      const log = await page
        .getByRole("region", { name: "Recent game history", exact: true })
        .getByRole("listitem")
        .allTextContents();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        before_ack,
      );
      expect(
        await page
          .getByRole("region", {
            name: "Recent game history",
            exact: true,
          })
          .getByRole("listitem")
          .allTextContents(),
      ).toEqual(log);
      const complete = JSON.parse(before_ack!) as Engine_state;
      expect(complete.active_player).toBe(0);
      expect(complete.phase).toBe("play");
      const ids = [
        ...complete.deck,
        ...complete.discard,
        ...complete.players.flatMap((p) => [...p.hand, ...p.active_card_ids]),
      ];
      expect(ids.sort((a, b) => a - b)).toEqual(
        Array.from({ length: 36 }, (_, id) => id),
      );
      await page.reload();
      await page
        .getByRole("heading", { name: "Main menu", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Resume saved game", exact: true })
        .click();
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        before_ack,
      );
      expect(
        await page
          .getByRole("region", {
            name: "Recent game history",
            exact: true,
          })
          .getByRole("listitem")
          .allTextContents(),
      ).toEqual(["Game resumed.", ...log]);
      expect(
        await page.locator(".current_effect,.current_outcome").count(),
      ).toBe(0);
      expect(
        await page
          .getByRole("region", { name: "Rival actions", exact: true })
          .count(),
      ).toBe(0);
      expect(await page.getByRole("status").textContent()).toBe(
        "Game resumed. No prior actions replayed.",
      );
      expect(
        await page.evaluate((key) => localStorage.getItem(key), awards_key),
      ).toBeNull();

      const human = policy.cases.find(
        (entry) => entry.id === "S06-REUSE/S01-WIN-001",
      );
      const rival = effects.cases.find(
        (entry) => entry.id === "S01-WIN-001/mirrored",
      );
      if (!human || !rival)
        throw Error("Required independent finishing literals are missing");
      await page.evaluate(
        (key) =>
          localStorage.setItem(
            key,
            JSON.stringify({
              schema_version: 1,
              earned_ids: [],
              win_streak: 9,
            }),
          ),
        awards_key,
      );
      await preload(page, human.initial_state);
      await page
        .getByRole("button", {
          name: "Choose action: Activate card",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Card to activate", { exact: true })
        .selectOption({ label: "Clover Gaines" });
      await page
        .getByLabel("Wildcard payment", { exact: true })
        .selectOption({ label: "Printed cost · no wildcard" });
      await page
        .getByRole("button", { name: "Activate card", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "Victory · You won by twelve businesses.",
          exact: true,
        })
        .waitFor();
      const won = (await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        key,
      )) as Engine_state;
      expect([won.phase, won.winner, won.win_reason]).toEqual([
        "over",
        0,
        "expansion",
      ]);
      expect(won.history.at(-1)).toEqual({
        event: "game_finished",
        winner: 0,
        reason: "expansion",
      });
      expect(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!),
          awards_key,
        ),
      ).toEqual({
        schema_version: 1,
        earned_ids: [
          "streak-10",
          "crew-The Docks",
          "crew-Club Circuit",
          "crew-Trailer Park",
        ],
        win_streak: 10,
      });
      await screenshot(page, "expansion-win", mode);
      await page
        .getByRole("button", { name: "Achievements", exact: true })
        .click();
      expect(await page.locator(".award").count()).toBe(16);
      expect(
        await page
          .getByRole("region", { name: "Achievements", exact: true })
          .textContent(),
      ).toContain("10 / 10");
      await screenshot(page, "achievements", mode);
      if (process.env.CITY_UI_EVIDENCE_DIR)
        await page.screenshot({
          path: `${process.env.CITY_UI_EVIDENCE_DIR}/s09-victory-${mode.replaceAll(" ", "-")}.png`,
          fullPage: true,
        });
      await preload(page, rival.initial_state);
      await page
        .getByRole("heading", {
          name: "Defeat · Rival won by twelve businesses.",
          exact: true,
        })
        .waitFor();
      const lost = (await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        key,
      )) as Engine_state;
      expect([lost.phase, lost.winner, lost.win_reason]).toEqual([
        "over",
        1,
        "expansion",
      ]);
      expect(lost.history.slice(-3)).toEqual([
        { event: "card_activated", player_id: 1, card_id: 8 },
        { event: "crew_completed", player_id: 1, crew: "Trailer Park" },
        { event: "game_finished", winner: 1, reason: "expansion" },
      ]);
      expect(
        (
          await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!),
            awards_key,
          )
        ).win_streak,
      ).toBe(0);
      await screenshot(page, "expansion-defeat", mode);
      expect(
        await page
          .getByRole("region", { name: "Rival actions", exact: true })
          .textContent(),
      ).toContain("Rival activated Clover Gaines.");
      const terminal_bytes = await page.evaluate(
        (key) => localStorage.getItem(key),
        key,
      );
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        terminal_bytes,
      );
      const human_elimination = policy.cases.find(
          (entry) => entry.id === "S06-REUSE/S01-WIN-002",
        )!,
        rival_elimination = rich.cases.find(
          (entry) => entry.id === "S10-MIRROR-WIN002",
        )!;
      await preload(page, human_elimination.initial_state);
      await page
        .getByRole("button", {
          name: "Choose action: Use operator",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Operator", { exact: true })
        .selectOption({ label: "Wade Haskett" });
      await page
        .getByLabel("First target", { exact: true })
        .selectOption({ label: "Velvet Zizek" });
      await page
        .getByLabel("Second target", { exact: true })
        .selectOption({ label: "No second target" });
      await page
        .getByRole("button", { name: "Use operator", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "Victory · You won by elimination.",
          exact: true,
        })
        .waitFor();
      expect(
        (
          await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!),
            awards_key,
          )
        ).earned_ids,
      ).toContain("brutal");
      await screenshot(page, "elimination-win", mode);
      await preload(page, rival_elimination.initial_state);
      await page
        .getByRole("heading", {
          name: "Defeat · Rival won by elimination.",
          exact: true,
        })
        .waitFor();
      const eliminated = (await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        key,
      )) as Engine_state;
      expect([
        eliminated.phase,
        eliminated.winner,
        eliminated.win_reason,
        eliminated.discard,
        eliminated.players.map((player) => player.active_card_ids),
      ]).toEqual(["over", 1, "elimination", [6, 30], [[24], [0]]]);
      expect(eliminated.history.at(-1)).toEqual({
        event: "game_finished",
        winner: 1,
        reason: "elimination",
      });
      await screenshot(page, "elimination-defeat", mode);
      for (const binding of [
        "vice-art-0",
        "vice-art-1",
        "vice-art-2",
        "vice-leon",
        "menu",
        "win",
        "lose",
      ])
        expect(
          asset_responses.some(
            (name) =>
              name === binding + ".webp" || name.startsWith(binding + "-"),
          ),
          binding,
        ).toBe(true);
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
