import { afterAll, beforeAll, expect, test } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "playwright";
import type {
  Engine_command,
  Engine_state,
  Engine_event,
} from "@city-of-vice/engine";
import { generated_adapter } from "../../vite.config.ts";
import { action_names, command_fields } from "../../src/ui/choices.ts";
import { card_name } from "../../src/ui/catalog.ts";

process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
  new URL("../../.cache/ms-playwright", import.meta.url),
);
const { chromium } = await import("playwright");
const key = "city-of-vice-modular-current-v1";
type Step = {
  command: Engine_command & { player_id: number };
  policy?: boolean;
  expected_changes?: Record<string, unknown>;
  expected_events?: Engine_event[];
  expected_rejection?: unknown;
};
type Fixture = { id: string; initial_state: Engine_state; steps: Step[] };
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const policy = read<{ cases: Fixture[]; numeric_cases: Fixture[] }>(
  "../policy/scenarios.json",
);
const economy = read<{ cases: Fixture[] }>("../economy/scenarios.json");
const effects = read<{ cases: Fixture[] }>("../effects/scenarios.json");
const fixtures = [
  ...policy.cases,
  ...policy.numeric_cases,
  ...economy.cases,
  ...effects.cases,
];
const fixture = (id: string) => {
  const result = fixtures.find((entry) => entry.id === id);
  if (!result) throw Error("Required literal missing: " + id);
  return result;
};
function after(state: Engine_state, step: Step): Engine_state {
  const result = structuredClone(state);
  if (!step.expected_rejection) {
    for (const [path, value] of Object.entries(step.expected_changes ?? {})) {
      const keys = path.split(".");
      let target = result as unknown as Record<string, unknown>;
      for (const part of keys.slice(0, -1))
        target = target[part] as Record<string, unknown>;
      target[keys.at(-1)!] = structuredClone(value);
    }
    result.history.push(...structuredClone(step.expected_events ?? []));
  }
  return result;
}
function boundary(entry: Fixture, index: number) {
  let state = structuredClone(entry.initial_state);
  for (const step of entry.steps.slice(0, index)) state = after(state, step);
  return state;
}
let browser: Browser, server: ViteDevServer, origin: string;
beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../..", import.meta.url)),
    publicDir: false,
    resolve: { alias: { "@city-of-vice/engine": generated_adapter } },
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  await server.listen();
  origin = new URL(server.resolvedUrls!.local[0]!).origin;
  try {
    browser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      ...(process.env.CITY_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CITY_CHROMIUM_EXECUTABLE }
        : {}),
    });
  } catch (error) {
    await server.close();
    throw error;
  }
});
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await server?.close();
  }
});
async function with_page(run: (page: Page) => Promise<void>) {
  let context: BrowserContext | undefined;
  const errors: string[] = [],
    external: string[] = [];
  try {
    context = await browser.newContext();
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin === origin)
        await route.continue();
      else {
        external.push(route.request().url());
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(4_000);
    page.on("pageerror", (error) => errors.push(error.message));
    expect((await page.goto(origin + "/tests/browser/ui.html"))?.status()).toBe(
      200,
    );
    await page
      .getByRole("heading", { name: "Main menu", exact: true })
      .waitFor();
    await run(page);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await context?.close();
  }
}
async function install(page: Page, state: Engine_state | string | null) {
  await page.evaluate(
    ({ key, value }) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      localStorage.setItem("city-of-vice-current-v6", "legacy sentinel");
      localStorage.setItem(
        "city-of-vice-achievements-v1",
        "achievement sentinel",
      );
      Object.assign(window.ui_test.faults, {
        acquire: false,
        read: false,
        write: false,
        command_decode: false,
        publication_after_command: false,
        award_acquire: false,
        award_read: false,
        award_write: false,
      });
      window.ui_test.reset();
    },
    {
      key,
      value:
        typeof state === "string" || state === null
          ? state
          : JSON.stringify(state),
    },
  );
  await page.getByRole("heading", { name: "Main menu", exact: true }).waitFor();
}
async function resume(page: Page, state: Engine_state) {
  await install(page, state);
  await page
    .getByRole("button", { name: "Resume saved game", exact: true })
    .click();
}
async function command(page: Page, value: Engine_command) {
  await page
    .getByRole("button", {
      name: `Choose action: ${action_names[value.command]}`,
      exact: true,
    })
    .click();
  const fields = command_fields(value);
  if (fields.length)
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(
      "action_choice_0",
    );
  for (const field of fields)
    await page
      .getByLabel(field.label, { exact: true })
      .selectOption({ label: field.text });
  await page
    .getByRole("button", { name: action_names[value.command], exact: true })
    .click();
}
const stored = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), key);
async function measured_command(page: Page) {
  return page.evaluate(() =>
    window.ui_test
      .forwarded()
      .filter((call) => call.operation === "perform_command")
      .map((call) => JSON.parse(call.args[1]!)),
  );
}

test("S09-B02 meaningful controls submit literal complete values for every human command, mandatory form and ordered alternative", async () =>
  with_page(async (page) => {
    const chosen = new Map<string, { entry: Fixture; index: number }>();
    for (const entry of fixtures)
      for (const [index, step] of entry.steps.entries()) {
        if (step.expected_rejection || step.command.player_id !== 0) continue;
        const state = boundary(entry, index),
          kind = state.pending_decision?.decision;
        if (!chosen.has(step.command.command))
          chosen.set(step.command.command, { entry, index });
        if (kind && !chosen.has("pending:" + kind))
          chosen.set("pending:" + kind, { entry, index });
        if (
          step.command.command === "activate_card" &&
          step.command.wildcard_payment !== null
        )
          chosen.set("wildcard", { entry, index });
        if (
          step.command.command === "draw_card" &&
          step.command.use_docks_bonus
        )
          chosen.set("docks mode", { entry, index });
        if (
          step.command.command === "use_operator" &&
          step.command.target_ids.length === 2
        ) {
          if (entry.id.includes("/6-9"))
            chosen.set("ordered6-9", { entry, index });
          if (entry.id.includes("/9-6"))
            chosen.set("ordered9-6", { entry, index });
        }
        if (
          step.command.command === "respond_intercept" &&
          !step.command.accept
        )
          chosen.set("decline", { entry, index });
        if (kind === "draw_discard" && state.players[0]!.hand.length === 8)
          chosen.set("hand8", { entry, index });
      }
    // Opening and initial income are also exercised through both normal entries in B01.
    expect(
      [
        ...new Set(
          [...chosen.values()].map(
            ({ entry, index }) => entry.steps[index]!.command.command,
          ),
        ),
      ].sort(),
    ).toEqual(
      Object.keys(action_names)
        .filter((name) => name !== "start_game")
        .sort(),
    );
    for (const expected of [
      "pending:draw_discard",
      "pending:legit_cash",
      "pending:trim",
      "pending:intercept",
      "pending:post_action_trim",
      "wildcard",
      "docks mode",
      "ordered6-9",
      "ordered9-6",
      "decline",
      "hand8",
    ])
      expect(chosen.has(expected), expected).toBe(true);
    for (const [label, { entry, index }] of chosen) {
      const state = boundary(entry, index),
        step = entry.steps[index]!;
      await resume(page, state);
      if (state.pending_decision?.player_id === 0) {
        expect(await page.locator("#screen_heading").textContent()).toContain(
          "Required choice",
        );
        expect(await page.evaluate(() => document.activeElement?.id)).toBe(
          "screen_heading",
        );
      }
      const before = await page.evaluate(() => window.ui_test.stats());
      const { player_id: _, ...offered } = step.command;
      await command(page, offered);
      expect(await measured_command(page), label + ":" + entry.id).toEqual([
        step.command,
      ]);
      expect(JSON.parse((await stored(page))!), label + ":" + entry.id).toEqual(
        after(state, step),
      );
      expect(
        (await page.evaluate(() => window.ui_test.stats())).storage.filter(
          (call) => call === "write",
        ),
      ).toHaveLength(
        before.storage.filter((call) => call === "write").length + 1,
      );
    }
  }));

test("S09-B03 inactive owners, one-step scheduling, human interruptions, acknowledgement and cancelled epochs", async () =>
  with_page(async (page) => {
    const pending_cases = new Map<string, { entry: Fixture; index: number }>();
    for (const entry of [...policy.cases, ...policy.numeric_cases])
      for (const [index, step] of entry.steps.entries()) {
        const state = boundary(entry, index);
        if (
          state.pending_decision?.player_id === 1 &&
          step.policy &&
          step.command.player_id === 1 &&
          !step.expected_rejection &&
          !pending_cases.has(state.pending_decision.decision)
        )
          pending_cases.set(state.pending_decision.decision, { entry, index });
      }
    expect([...pending_cases.keys()].sort()).toEqual([
      "draw_discard",
      "intercept",
      "legit_cash",
      "post_action_trim",
      "trim",
    ]);
    for (const { entry, index } of pending_cases.values()) {
      const state = boundary(entry, index);
      await resume(page, state);
      expect(await page.evaluate(() => window.ui_test.queued())).toBe(1);
      await page.evaluate(() => window.ui_test.flush());
      expect(await measured_command(page)).toEqual([
        entry.steps[index]!.command,
      ]);
      expect(JSON.parse((await stored(page))!)).toEqual(
        after(state, entry.steps[index]!),
      );
      expect(
        (await page.evaluate(() => window.ui_test.stats())).engine.filter(
          (call) => call === "heuristic_proposal",
        ),
      ).toHaveLength(1);
    }
    const pipe = fixture("S06-REUSE/S05-PROV-PIPELINE-001/0-accept");
    const state = boundary(pipe, 2);
    await resume(page, state);
    expect(state.active_player).toBe(0);
    expect(state.pending_decision?.player_id).toBe(1);
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(1);
    await page.evaluate(() => window.ui_test.flush());
    expect(await measured_command(page)).toEqual([pipe.steps[2]!.command]);
    expect(JSON.parse((await stored(page))!)).toEqual(
      after(state, pipe.steps[2]!),
    );
    const stats = await page.evaluate(() => window.ui_test.stats());
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    expect(await page.evaluate(() => window.ui_test.stats())).toEqual(stats);
    expect(
      await page.getByRole("button", { name: "Continue", exact: true }).count(),
    ).toBe(0);

    const human = fixture("S06-REUSE/S05-PROV-PIPELINE-001/1-accept");
    const interrupted = boundary(human, 2);
    await resume(page, interrupted);
    expect(interrupted.active_player).toBe(1);
    expect(interrupted.pending_decision?.player_id).toBe(0);
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
    const bytes = await stored(page);
    await page.keyboard.press("Escape");
    expect(await stored(page)).toBe(bytes);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue current game", exact: true })
      .click();
    expect(await stored(page)).toBe(bytes);
    await command(page, { command: "respond_intercept", accept: true });
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(1);
    expect(
      await page.getByRole("button", { name: "Continue", exact: true }).count(),
    ).toBe(0);

    for (const id of [
      "S06-REUSE/S05-PROV-NIGHT-001",
      "S06-REUSE/S05-PROV-NIGHT-001/mirrored",
    ]) {
      const entry = fixture(id),
        before = boundary(entry, 3);
      await resume(page, before);
      if (before.pending_decision?.player_id === 1) {
        expect(await page.evaluate(() => window.ui_test.queued())).toBe(1);
        await page.evaluate(() => window.ui_test.flush());
        expect(await measured_command(page)).toEqual([entry.steps[3]!.command]);
      } else {
        expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
        const { player_id: _, ...value } = entry.steps[3]!.command;
        await command(page, value);
      }
      expect(JSON.parse((await stored(page))!)).toEqual(
        after(before, entry.steps[3]!),
      );
    }

    await resume(page, fixture("S01-AI-FUND-001").initial_state);
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(1);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    const cancelled = await page.evaluate(() => window.ui_test.stats());
    await page.evaluate(() => window.ui_test.flush(true)); // Even a delivered cancelled callback must observe its invalidated epoch.
    expect(await page.evaluate(() => window.ui_test.stats())).toEqual(
      cancelled,
    );
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page
      .getByRole("button", { name: "Replace saved game", exact: true })
      .click();
    const changed = await stored(page);
    await page.evaluate(() => window.ui_test.flush(true));
    expect(await stored(page)).toBe(changed);
    expect(JSON.parse(changed!).phase).toBe("awaiting_opening");
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
    await resume(page, fixture("S01-AI-FUND-001").initial_state);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Resume saved game", exact: true })
      .click();
    const before_old = await page.evaluate(() => window.ui_test.stats());
    await page.evaluate(() => window.ui_test.flush(true));
    expect(await page.evaluate(() => window.ui_test.stats())).toEqual(
      before_old,
    );
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(1);
    await page.evaluate(() => window.ui_test.flush());
    expect(await measured_command(page)).toEqual([
      fixture("S01-AI-FUND-001").steps[0]!.command,
    ]);
  }));

test("S09-B04 admitted hidden draw twins produce identical complete DOM, attributes, announcements and recap without private IDs", async () =>
  with_page(async (page) => {
    const original = fixture("S01-AI-DRAW-001").initial_state,
      twin = structuredClone(original);
    twin.deck.reverse();
    twin.random_source.cursor = "12345678";
    const measurements: { html: string; live: string | null; ids: number[] }[] =
      [];
    for (const state of [original, twin]) {
      await resume(page, state);
      await page.evaluate(() => window.ui_test.flush());
      const draw = await page.evaluate(() => {
        const call = window.ui_test
          .forwarded()
          .find((entry) => entry.operation === "perform_command")!;
        const result = JSON.parse(call.output) as { events: Engine_event[] };
        const event = result.events.find(
          (item) => item.event === "cards_drawn",
        );
        if (!event || event.event !== "cards_drawn")
          throw Error("Required actual draw fact missing");
        return event.card_ids;
      });
      measurements.push({
        html: await page.locator("#game").evaluate((node) => node.outerHTML),
        live: await page.getByRole("status").textContent(),
        ids: draw,
      });
      expect(
        await page
          .getByRole("region", { name: "Rival actions", exact: true })
          .textContent(),
      ).toContain("Rival drew 1 card (paid; price 1).");
    }
    expect(measurements[0]!.ids).not.toEqual(measurements[1]!.ids);
    expect(measurements[0]!.html).toBe(measurements[1]!.html);
    expect(measurements[0]!.live).toBe(measurements[1]!.live);
  }));

test("S09-B05 rejected save/confirmation/memory-only/consumed replacement/owned failure/recovery preserve bytes and live progress", async () =>
  with_page(async (page) => {
    const bad = "\n{rejected save}\n";
    await install(page, bad);
    expect(
      await page
        .getByRole("button", { name: "Resume saved game", exact: true })
        .count(),
    ).toBe(0);
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await stored(page)).toBe(bad);
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page
      .getByRole("button", { name: "Play only in memory", exact: true })
      .click();
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("unsaved");
    await command(page, { command: "start_game", opening_distributor: 0 });
    expect(await stored(page)).toBe(bad);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page
      .getByRole("heading", { name: "Leave unsaved progress?", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue current game", exact: true })
      .click();
    expect(
      await page
        .getByRole("button", { name: "Collect income", exact: true })
        .count(),
    ).toBe(1);
    expect(await stored(page)).toBe(bad);
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await page.evaluate(() => {
      window.ui_test.faults.write = true;
    });
    await page
      .getByRole("button", { name: "Replace saved game", exact: true })
      .click();
    expect(await stored(page)).toBe(bad);
    const writes = (
      await page.evaluate(() => window.ui_test.stats())
    ).storage.filter((call) => call === "write").length;
    await page.evaluate(() => {
      window.ui_test.faults.write = false;
    });
    await command(page, { command: "collect_income" });
    expect(
      (await page.evaluate(() => window.ui_test.stats())).storage.filter(
        (call) => call === "write",
      ),
    ).toHaveLength(writes);
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    expect(await stored(page)).toBe(bad);
    await page
      .getByRole("button", { name: "Replace saved game", exact: true })
      .click();
    expect(JSON.parse((await stored(page))!).phase).toBe("play");

    const saved = fixture("S01-AI-FUND-001/mirror").initial_state;
    await resume(page, saved);
    await page.evaluate(() => {
      window.ui_test.faults.write = true;
    });
    await command(page, { command: "cash_card", card_id: 31, color: "blue" });
    expect(JSON.parse((await stored(page))!)).toEqual(saved);
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("Storage write failed");
    await page.evaluate(() => {
      window.ui_test.faults.write = false;
    });
    const commands = (await measured_command(page)).length;
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    expect((await measured_command(page)).length).toBe(commands);
    expect(JSON.parse((await stored(page))!).discard).toContain(31);
    await page.evaluate(() => {
      window.ui_test.faults.read = true;
    });
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("could not be read");
    await page.evaluate(() => {
      window.ui_test.faults.read = false;
    });
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("Current progress is saved");
    expect(
      await page.evaluate(() => [
        localStorage.getItem("city-of-vice-current-v6"),
        localStorage.getItem("city-of-vice-achievements-v1"),
      ]),
    ).toEqual(["legacy sentinel", "achievement sentinel"]);
  }));

test("S09-B06 pre-adoption and applied-publication faults stop scheduling without rollback, command replay or duplicate facts", async () =>
  with_page(async (page) => {
    const entry = fixture("S01-AI-FUND-001/mirror"),
      initial = entry.initial_state;
    await resume(page, initial);
    await page.evaluate(() => {
      window.ui_test.faults.command_decode = true;
    });
    await command(page, { command: "cash_card", card_id: 31, color: "blue" });
    expect(JSON.parse((await stored(page))!)).toEqual(initial);
    expect(await measured_command(page)).toHaveLength(1);
    expect(await page.getByRole("status").textContent()).toContain(
      "display unavailable",
    );
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
    await resume(page, initial);
    await page.evaluate(() => {
      window.ui_test.faults.publication_after_command = true;
    });
    await command(page, { command: "cash_card", card_id: 31, color: "blue" });
    expect(JSON.parse((await stored(page))!)).toEqual(
      after(initial, entry.steps[0]!),
    );
    expect(await measured_command(page)).toHaveLength(1);
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
    expect(
      await page
        .getByRole("region", { name: "Recent game history", exact: true })
        .getByRole("listitem")
        .allTextContents(),
    ).toContain("Turn 1 · You cashed Ellis Voss for 1 Blue.");
    const restored = await page
      .getByRole("region", { name: "Recent game history", exact: true })
      .getByRole("listitem")
      .allTextContents();
    expect(restored).toHaveLength(initial.history.length + 2);
    expect(
      restored.filter((fact) => fact.includes("You cashed Ellis Voss")),
    ).toHaveLength(1);
    const before = await page.evaluate(() => window.ui_test.stats());
    await page.evaluate(() => window.ui_test.flush(true));
    expect(await page.evaluate(() => window.ui_test.stats())).toEqual(before);
    await resume(page, fixture("S01-AI-FUND-001").initial_state);
    await page.evaluate(() => {
      window.ui_test.faults.command_decode = true;
      window.ui_test.flush();
    });
    expect(await measured_command(page)).toHaveLength(1);
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
    const stopped = await page.evaluate(() => window.ui_test.stats());
    await page.evaluate(() => window.ui_test.flush());
    expect(await page.evaluate(() => window.ui_test.stats())).toEqual(stopped);
  }));

test("S09-B07 retained old DOM choices use current validation, rejection refreshes controls and unavailable ordinary actions cannot submit", async () =>
  with_page(async (page) => {
    await resume(page, fixture("S01-AI-FUND-001/mirror").initial_state);
    expect(
      await page
        .getByRole("button", { name: "Collect income", exact: true })
        .count(),
    ).toBe(0);
    await page
      .getByRole("button", { name: "Choose action: Cash card", exact: true })
      .click();
    await page
      .getByLabel("Card to cash", { exact: true })
      .selectOption({ label: "Ellis Voss" });
    await page
      .getByLabel("Resource to gain", { exact: true })
      .selectOption({ label: "Blue" });
    const old_button = await page
      .getByRole("button", { name: "Cash card", exact: true })
      .elementHandle();
    if (!old_button) throw Error("Required native confirmation missing");
    try {
      await command(page, { command: "cash_card", card_id: 4, color: "blue" });
      await old_button.evaluate((node) => (node as HTMLElement).click()); // Still-legal old candidate must reach current engine validation.
      expect(
        (await measured_command(page)).map((value) => value.card_id),
      ).toEqual([4, 31]);
      const bytes = await stored(page),
        writes = (
          await page.evaluate(() => window.ui_test.stats())
        ).storage.filter((call) => call === "write").length;
      await old_button.evaluate((node) => (node as HTMLElement).click());
      expect(await stored(page)).toBe(bytes);
      expect(
        (await page.evaluate(() => window.ui_test.stats())).storage.filter(
          (call) => call === "write",
        ),
      ).toHaveLength(writes);
      expect(await page.getByRole("status").textContent()).toContain(
        "Action rejected: invalid card",
      );
      expect(
        await page
          .getByRole("button", { name: "Choose action: End turn", exact: true })
          .count(),
      ).toBe(1);
    } finally {
      await old_button.dispose();
    }
  }));

test("S09-B08 acquisition failure is not absence; terminal eligibility and unsaved resume cancellation preserve current game", async () =>
  with_page(async (page) => {
    await install(page, null);
    await page.evaluate(() => {
      window.ui_test.faults.acquire = true;
      window.ui_test.reset();
    });
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("not known to be empty");
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page
      .getByRole("button", { name: "Play only in memory", exact: true })
      .click();
    expect(await stored(page)).toBeNull();
    expect(await page.evaluate(() => window.ui_test.queued())).toBe(0);
    const old = fixture("S01-AI-FUND-001/mirror").initial_state;
    await install(page, old);
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page
      .getByRole("button", { name: "Play only in memory", exact: true })
      .click();
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Resume saved game", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Leave unsaved progress?", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue current game", exact: true })
      .click();
    expect(
      await page.getByLabel("Opening distributor", { exact: true }).count(),
    ).toBe(1);
    expect(JSON.parse((await stored(page))!)).toEqual(old);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Resume saved game", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Resume saved game instead", exact: true })
      .click();
    expect(
      await page
        .getByRole("region", { name: "Recent game history", exact: true })
        .getByRole("listitem")
        .allTextContents(),
    ).toHaveLength(old.history.length + 1);
    const win = fixture("S06-REUSE/S01-WIN-001"),
      terminal = after(win.initial_state, win.steps[0]!);
    await install(page, terminal);
    expect(
      await page
        .getByRole("button", { name: "Resume saved game", exact: true })
        .count(),
    ).toBe(0);
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("saved game is completed");
    const elimination = fixture("S06-REUSE/S01-WIN-002");
    await resume(page, elimination.initial_state);
    const { player_id: _, ...finish } = elimination.steps[0]!.command;
    await command(page, finish);
    await page
      .getByRole("heading", {
        name: "Victory · You won by elimination.",
        exact: true,
      })
      .waitFor();
    expect(JSON.parse((await stored(page))!)).toEqual(
      after(elimination.initial_state, elimination.steps[0]!),
    );
  }));

test("S10-E02 actual operator destinations, current-only results and reduced motion keep mandatory choices reachable; OK is UI-only", async () =>
  with_page(async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const selected = [
      ["S06-REUSE/S01-WIN-002", 0],
      ["S06-REUSE/S05-PROV-FIXER-001/6-9", 0],
      ["S06-REUSE/S05-PROV-FIXER-001/9-6", 0],
      ["S06-REUSE/S05-PROV-PIPELINE-001/0-accept", 2],
      ["S06-REUSE/S05-PROV-PIPELINE-001/1-accept", 2],
      ["S06-REUSE/S05-PROV-PIPELINE-001/1-decline", 2],
      ["S06-REUSE/S05-PROV-NIGHT-001", 0],
      ["S06-REUSE/S05-PROV-NIGHT-001/mirrored", 0],
      ["S01-RUFFIAN-001", 0],
    ].map(([id, index]) => ({
      entry: fixture(String(id)),
      index: Number(index),
    }));
    const destinations = new Set<string>();
    for (const { entry, index } of selected) {
      const state = boundary(entry, index),
        step = entry.steps[index]!;
      await resume(page, state);
      if (step.command.player_id === 1)
        await page.evaluate(() => window.ui_test.flush());
      else {
        const { player_id: _, ...value } = step.command;
        await command(page, value);
      }
      expect(JSON.parse((await stored(page))!)).toEqual(after(state, step));
      const result = page.getByRole("region", {
        name: "Completed results",
        exact: true,
      });
      await result.waitFor();
      expect(
        await result.evaluate((node) => getComputedStyle(node).animationName),
      ).toBe("none");
      for (const event of step.expected_events ?? [])
        if (event.event === "operator_result")
          for (const affected of event.affected) {
            const destination = affected.destination;
            const stamp =
              destination.zone === "discard"
                ? "DISCARDED"
                : destination.zone === "active"
                  ? "ACTIVE"
                  : destination.suspended
                    ? "SUSPENDED HAND"
                    : "RETURNED TO HAND";
            destinations.add(stamp);
            expect(await result.textContent()).toContain(
              `${card_name(affected.card_id)} · ${stamp}`,
            );
          }
      const bytes = await stored(page),
        stats = await page.evaluate(() => window.ui_test.stats());
      await result.getByRole("button", { name: "OK", exact: true }).click();
      expect(await stored(page)).toBe(bytes);
      expect(await page.evaluate(() => window.ui_test.stats())).toEqual(stats);
      await page.getByRole("button", { name: "Rules", exact: true }).click();
      expect(await page.evaluate(() => window.ui_test.stats())).toEqual(stats);
      if (JSON.parse(bytes!).pending_decision?.player_id === 0)
        expect(
          await page
            .getByRole("region", { name: "Available actions", exact: true })
            .getByRole("button")
            .count(),
        ).toBeGreaterThan(0);
    }
    expect([...destinations].sort()).toEqual([
      "ACTIVE",
      "DISCARDED",
      "RETURNED TO HAND",
      "SUSPENDED HAND",
    ]);
  }));

test("S10-J04 real current win setter failure retries without replay; missing final view waits for same game and new adoption discards held context", async () =>
  with_page(async (page) => {
    const entry = fixture("S06-REUSE/S01-WIN-002"),
      { player_id: _, ...finish } = entry.steps[0]!.command,
      award_key = "city-of-vice-modular-achievements-v1";
    await resume(page, entry.initial_state);
    await page.evaluate(() => {
      window.ui_test.faults.award_write = true;
    });
    await command(page, finish);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), award_key),
    ).toBeNull();
    const bytes = await stored(page);
    await page
      .getByRole("button", { name: "Achievements", exact: true })
      .click();
    expect(
      await page
        .getByRole("region", { name: "Achievements", exact: true })
        .textContent(),
    ).toContain("pending");
    await page.evaluate(() => {
      window.ui_test.faults.award_write = false;
    });
    const stats = await page.evaluate(() => window.ui_test.stats());
    await page
      .getByRole("button", { name: "Retry achievements", exact: true })
      .click();
    const recovered = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      award_key,
    );
    expect(recovered).toEqual({
      schema_version: 1,
      earned_ids: ["brutal"],
      win_streak: 1,
    });
    expect(await stored(page)).toBe(bytes);
    expect((await page.evaluate(() => window.ui_test.stats())).engine).toEqual(
      stats.engine,
    );
    expect((await page.evaluate(() => window.ui_test.stats())).storage).toEqual(
      stats.storage,
    );
    await page
      .getByRole("button", { name: "Close information", exact: true })
      .click();
    const result = page.getByRole("region", {
      name: "Completed results",
      exact: true,
    });
    await result.getByRole("button", { name: "OK", exact: true }).click();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        award_key,
      ),
    ).toEqual(recovered);

    await resume(page, entry.initial_state);
    await page.evaluate(() => {
      window.ui_test.faults.publication_after_command = true;
    });
    await command(page, finish);
    expect(await measured_command(page)).toHaveLength(1);
    expect(
      await page
        .getByRole("heading", {
          name: "Victory · You won by elimination.",
          exact: true,
        })
        .count(),
    ).toBe(1);
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        award_key,
      ),
    ).toEqual(recovered);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page.evaluate(() => {
      window.ui_test.restore_publication();
    });
    // Clearing the test publication fault requires a fresh same-controller snapshot, never re-adoption/replay.
    await page
      .getByRole("button", { name: "Continue current game", exact: true })
      .click();
    expect(await measured_command(page)).toHaveLength(1);
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        award_key,
      ),
    ).toEqual({ schema_version: 1, earned_ids: ["brutal"], win_streak: 2 });
    await resume(page, entry.initial_state);
    await page.evaluate(() => {
      window.ui_test.faults.publication_after_command = true;
    });
    await command(page, finish);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await page.evaluate(() => window.ui_test.restore_publication());
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await page
      .getByRole("button", { name: "Play only in memory", exact: true })
      .click();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        award_key,
      ),
    ).toEqual({ schema_version: 1, earned_ids: ["brutal"], win_streak: 2 });
    await page
      .getByRole("button", { name: "Achievements", exact: true })
      .click();
    expect(
      await page
        .getByRole("region", { name: "Achievements", exact: true })
        .textContent(),
    ).not.toContain("awaits a matching");
  }));

test("S10-E03 actual entering11 warnings for either/both players are nonblocking and OK never writes", async () =>
  with_page(async (page) => {
    const warnings = read<{
      cases: (Fixture & {
        steps: {
          command: Step["command"];
          expected_business_counts: number[];
        }[];
      })[];
    }>("../presentation/rich_cases.json").cases.filter((entry) =>
      entry.id.startsWith("S10-WARNING-"),
    );
    expect(warnings.map((entry) => entry.id)).toEqual([
      "S10-WARNING-0-single",
      "S10-WARNING-1-single",
      "S10-WARNING-0-both",
      "S10-WARNING-1-both",
    ]);
    for (const entry of warnings) {
      await resume(page, entry.initial_state);
      expect(
        await page
          .getByRole("region", { name: "Business warning", exact: true })
          .count(),
      ).toBe(0);
      const actor = entry.steps[0]!.command.player_id;
      if (actor === 1) await page.evaluate(() => window.ui_test.flush());
      else
        await command(page, {
          command: "activate_card",
          card_id: 8,
          wildcard_payment: null,
        });
      expect(await measured_command(page)).toEqual([entry.steps[0]!.command]);
      const state = JSON.parse((await stored(page))!) as Engine_state;
      expect(
        state.players.map((player) => player.active_card_ids.length),
      ).toEqual(entry.steps[0]!.expected_business_counts);
      expect(state.phase).toBe("play");
      expect(state.winner).toBeNull();
      const panel = page.getByRole("region", {
        name: "Business warning",
        exact: true,
      });
      expect(await panel.textContent()).toContain(
        entry.id.endsWith("both")
          ? "Both empires"
          : actor === 0
            ? "You are"
            : "The rival is",
      );
      const stats = await page.evaluate(() => window.ui_test.stats()),
        bytes = await stored(page);
      await panel.getByRole("button", { name: "OK", exact: true }).click();
      expect(await page.evaluate(() => window.ui_test.stats())).toEqual(stats);
      expect(await stored(page)).toBe(bytes);
    }
  }));

test("S10-J05 unsaved current finish remains eligible; explicit passive terminal admission/history/render never reawards", async () =>
  with_page(async (page) => {
    const entry = fixture("S06-REUSE/S01-WIN-002"),
      { player_id: _, ...finish } = entry.steps[0]!.command,
      award_key = "city-of-vice-modular-achievements-v1";
    await resume(page, entry.initial_state);
    await page.evaluate(() => {
      window.ui_test.faults.write = true;
    });
    await command(page, finish);
    expect(JSON.parse((await stored(page))!)).toEqual(entry.initial_state);
    expect(
      await page
        .getByRole("region", { name: "Save status", exact: true })
        .textContent(),
    ).toContain("unsaved");
    const award = await page.evaluate(
      (key) => localStorage.getItem(key),
      award_key,
    );
    expect(JSON.parse(award!)).toEqual({
      schema_version: 1,
      earned_ids: ["brutal"],
      win_streak: 1,
    });
    await install(page, after(entry.initial_state, entry.steps[0]!));
    await page.evaluate(() => window.ui_test.reset(true));
    const stats = await page.evaluate(() => window.ui_test.stats());
    await page
      .getByRole("button", { name: "View current result", exact: true })
      .click();
    expect(
      await page
        .getByRole("heading", {
          name: "Victory · You won by elimination.",
          exact: true,
        })
        .count(),
    ).toBe(1);
    expect(
      await page
        .getByRole("region", { name: "Recent game history", exact: true })
        .textContent(),
    ).toContain("Victory · You won by elimination.");
    expect(await page.locator(".current_effect,.current_outcome").count()).toBe(
      0,
    );
    expect(
      await page
        .getByRole("region", { name: "Completed results", exact: true })
        .count(),
    ).toBe(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), award_key),
    ).toBe(award);
    const after_read = await page.evaluate(() => window.ui_test.stats());
    expect(after_read.storage).toEqual(stats.storage);
    expect(after_read.awards).toEqual(stats.awards);
    expect(
      after_read.engine.filter(
        (call) => call === "perform_command" || call === "heuristic_proposal",
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Rules", exact: true }).click();
    await page
      .getByRole("button", { name: "Close information", exact: true })
      .click();
    expect(await page.evaluate(() => window.ui_test.stats())).toEqual(
      after_read,
    );
  }));
