import { expect, test } from "vitest";
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
  new URL("../../.cache/ms-playwright", import.meta.url),
);
const { chromium } = await import("playwright");
const hash = (input: string) =>
  createHash("sha256").update(input).digest("hex");
const source = readFileSync(
  new URL("../../index.html", import.meta.url),
  "utf8",
);
const source_hash =
  "f01755c9c82c3f871fafc7f8b5b1b078ad05ddb6421a15425a0e824ebc6fac15";
type Legacy = {
  winner: number | null;
  players: unknown[];
  [key: string]: unknown;
};
const cases = JSON.parse(
  readFileSync(
    new URL("../characterization/scenarios.json", import.meta.url),
    "utf8",
  ),
) as {
  id: string;
  initial_state: Legacy;
  steps: { expected: { changes: Record<string, unknown> } }[];
}[];
const initialization = "loadAchievements();loadSaved();render();";
function terminal(id: string, mirrored: boolean): Legacy {
  const entry = cases.find((entry) => entry.id === id)!;
  if (!entry) throw Error("Required independent legacy literal missing");
  const state = structuredClone(entry.initial_state);
  for (const [path, value] of Object.entries(
    entry.steps[0]!.expected.changes,
  )) {
    const keys = path.split(".");
    let target = state as Record<string, unknown>;
    for (const key of keys.slice(0, -1))
      target = target[key] as Record<string, unknown>;
    target[keys.at(-1)!] = structuredClone(value);
  }
  if (mirrored) {
    state.players.reverse();
    state.winner = 1;
    state.current = 1;
  }
  return state;
}

test("S10-R01 source-bound reference renderer compares ordinary menu/rules/opening/gallery/Leonard and disclosed fixture-initialized four outcomes", async () => {
  expect(hash(source)).toBe(source_hash);
  expect(source.split(initialization)).toHaveLength(2);
  const receipts: unknown[] = [];
  const pages = new Map<string, string>([["/reference.html", source]]);
  for (const [id, name, mirrored] of [
    ["S01-WIN-001", "expansion-win", false],
    ["S01-WIN-001", "expansion-defeat", true],
    ["S01-WIN-002", "elimination-win", false],
    ["S01-WIN-002", "elimination-defeat", true],
  ] as const) {
    const state = terminal(id, mirrored),
      fixture = JSON.stringify(state),
      replacement = `loadAchievements();state=${fixture};screen='outcome';render();`,
      patched = source.replace(initialization, replacement);
    expect(patched.replace(replacement, initialization)).toBe(source);
    pages.set(`/reference-${name}.html`, patched);
    receipts.push({
      name,
      source_hash,
      fixture_source: "tests/characterization/scenarios.json",
      id,
      mirrored,
      fixture_sha256: hash(fixture),
      initialization_original: initialization,
      initialization_replacement_sha256: hash(replacement),
      patched_sha256: hash(patched),
      renderer_and_rules: "unchanged; initialization only",
      viewport: { width: 1280, height: 900 },
    });
  }
  const server = await createServer({
    configFile: false,
    publicDir: false,
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    plugins: [
      {
        name: "reference_initialization_only",
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const page = pages.get(request.url ?? "");
            if (!page) return next();
            response.setHeader("Content-Type", "text/html");
            response.end(page);
          });
        },
      },
    ],
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await server.listen();
    const origin = new URL(server.resolvedUrls!.local[0]!).origin;
    console.info(
      JSON.stringify({
        browser_server: "S10-reference",
        stage: "listening",
        origin,
        node_pid: process.pid,
        cwd: process.cwd(),
      }),
    );
    browser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      ...(process.env.CITY_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CITY_CHROMIUM_EXECUTABLE }
        : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    try {
      const errors: string[] = [],
        external: string[] = [];
      await context.route("**/*", async (route) => {
        if (new URL(route.request().url()).origin === origin)
          await route.continue();
        else {
          external.push(route.request().url());
          await route.abort();
        }
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      const shot = async (name: string) => {
        if (process.env.CITY_UI_EVIDENCE_DIR)
          await page.screenshot({
            path: `${process.env.CITY_UI_EVIDENCE_DIR}/s10-reference-${name}.png`,
            fullPage: true,
          });
      };
      await page.goto(origin + "/reference.html");
      await page
        .locator(".v-lobby-art")
        .evaluate((node) => (node as HTMLImageElement).decode());
      await shot("menu");
      await page.getByRole("button", { name: "Rules", exact: true }).click();
      await shot("rules");
      await page
        .getByRole("button", { name: "Main menu", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "New game", exact: true }).click();
      expect(await page.locator(".v-opening-choice").count()).toBe(24);
      await shot("opening");
      await page
        .getByRole("button", { name: "Start with Ishmael Kelp", exact: true })
        .click();
      await page.locator("#v-catalog summary").click();
      for (let n = 1; n <= 3; n++) {
        expect(await page.locator(".v-catalog-card").count()).toBe(12);
        await shot(`gallery-${n}`);
        if (process.env.CITY_UI_EVIDENCE_DIR)
          await page.locator("#v-catalog").screenshot({
            path: `${process.env.CITY_UI_EVIDENCE_DIR}/s10-reference-crops-${n}.png`,
          });
        if (n < 3) await page.locator("#v-next-page").click();
      }
      await page.locator('.v-catalog-card[data-id="34"]').click();
      await shot("leonard");
      for (const name of [
        "expansion-win",
        "expansion-defeat",
        "elimination-win",
        "elimination-defeat",
      ]) {
        await page.goto(origin + `/reference-${name}.html`);
        await page
          .locator(".v-lobby-art")
          .evaluate((node) => (node as HTMLImageElement).decode());
        await shot(name);
      }
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
      if (process.env.CITY_UI_EVIDENCE_DIR)
        writeFileSync(
          `${process.env.CITY_UI_EVIDENCE_DIR}/s10-reference-receipts.json`,
          JSON.stringify(
            {
              source_sha256: source_hash,
              reference: "4ccb19703d4af1a1c202d922b514a58a17d0e537",
              ordinary: [
                "menu",
                "rules",
                "opening",
                "gallery-1",
                "gallery-2",
                "gallery-3",
                "leonard",
              ],
              instrumented: receipts,
            },
            null,
            2,
          ) + "\n",
        );
    } finally {
      await context.close();
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
      console.info(
        JSON.stringify({
          browser_server: "S10-reference",
          stage: "closed",
          node_pid: process.pid,
        }),
      );
    }
  }
});
