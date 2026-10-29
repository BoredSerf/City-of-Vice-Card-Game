import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import * as real from "@city-of-vice/engine";
import type { Engine_event, Engine_state } from "@city-of-vice/engine";
import { create_controller } from "../../src/app/controller.ts";
import { current_save_key } from "../../src/app/persistence.ts";
import { project_visible_history } from "../../src/presentation/history.ts";
import {
  create_achievements,
  admit_achievements,
  apply_completion,
  achievement_key,
  achievement_definitions,
  type Achievement_record,
} from "../../src/app/achievements.ts";
import { portrait_geometry } from "../../src/ui/artwork.ts";
import { business_warning } from "../../src/presentation/warnings.ts";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const policy = read<{ cases: { id: string; initial_state: Engine_state }[] }>(
  "../policy/scenarios.json",
);
const literal = (id: string) => {
  const found = policy.cases.find((entry) => entry.id === id);
  if (!found) throw Error("Required literal missing: " + id);
  return structuredClone(found.initial_state);
};
function port(raw: string | null = null, key = achievement_key) {
  const values = new Map<string, string>([
    ["city-of-vice-current-v6", "legacy game"],
    ["city-of-vice-achievements-v1", "legacy awards"],
    ["sentinel", "keep"],
  ]);
  if (raw !== null) values.set(key, raw);
  const calls: string[] = [],
    keys: string[] = [],
    faults = { acquire: false, read: false, write: false };
  return {
    values,
    calls,
    keys,
    faults,
    acquire() {
      calls.push("acquire");
      if (faults.acquire) throw Error("private access error");
      return {
        getItem(key: string) {
          calls.push("read");
          keys.push(key);
          if (faults.read) throw Error("private read error");
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          calls.push("write");
          keys.push(key);
          if (faults.write) throw Error("private write error");
          values.set(key, value);
        },
      };
    },
  };
}
const empty = (): Achievement_record => ({
  schema_version: 1,
  earned_ids: [],
  win_streak: 0,
});

test("S10-E01 count warnings exclude operators, do not replay passive11, and permit leave/re-entry", () => {
  const ten = [0, 1, 2, 3, 4, 5, 6, 7, 24, 25],
    eleven = [...ten, 26],
    other = [9];
  expect(business_warning([ten, other], [[...ten, 30], other])).toBeNull();
  expect(business_warning([ten, other], [eleven, other])).toBe(
    "You are one business from victory",
  );
  expect(business_warning([other, ten], [other, eleven])).toBe(
    "The rival is one business from victory",
  );
  expect(business_warning([ten, eleven], [eleven, eleven])).toBe(
    "Both empires are one business from victory",
  );
  expect(business_warning([eleven, other], [eleven, other])).toBeNull();
  expect(business_warning([eleven, other], [ten, other])).toBeNull();
  expect(business_warning([ten, other], [eleven, other])).not.toBeNull();
});

test("S10-A01 seven original payload bytes/dimensions and all36 normalized mappings including Leonard override", () => {
  const manifest = read<{
    index_sha256: string;
    assets: {
      binding: string;
      sha256: string;
      decoded_bytes: number;
      width: number;
      height: number;
    }[];
    card_mapping: {
      card_id: number;
      binding: string;
      crop?: { x: number; y: number; width: number; height: number };
    }[];
  }>("../presentation/reference_assets.json");
  const index = readFileSync(new URL("../../index.html", import.meta.url));
  expect(createHash("sha256").update(index).digest("hex")).toBe(
    manifest.index_sha256,
  );
  const embedded = [
    ...index.toString().matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g),
  ];
  expect(embedded).toHaveLength(7);
  expect(manifest.assets).toHaveLength(7);
  for (const [i, asset] of manifest.assets.entries()) {
    const bytes = readFileSync(
      new URL(`../../src/ui/artwork/${asset.binding}.webp`, import.meta.url),
    );
    expect(bytes).toEqual(Buffer.from(embedded[i]![1]!, "base64"));
    expect(bytes.byteLength).toBe(asset.decoded_bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(bytes.toString("ascii", 8, 16)).toBe("WEBPVP8 ");
    expect([
      bytes.readUInt16LE(26) & 0x3fff,
      bytes.readUInt16LE(28) & 0x3fff,
    ]).toEqual([asset.width, asset.height]);
  }
  expect(manifest.card_mapping).toHaveLength(36);
  for (const mapping of manifest.card_mapping) {
    const actual = portrait_geometry(mapping.card_id);
    expect(actual.binding).toBe(mapping.binding);
    expect(actual.crop).toEqual(mapping.crop ?? null);
    if (mapping.card_id === 34)
      expect([actual.background_size, actual.background_position]).toEqual([
        "cover",
        "center",
      ]);
  }
});

test("S10-H01 current adopted canonical history is detached/contextual and read performs zero facade/policy/storage calls", () => {
  const state = literal("S01-AI-FUND-001"),
    storage = port("\n" + JSON.stringify(state) + "\n", current_save_key),
    calls: string[] = [];
  const controller = create_controller({
    storage: storage.acquire,
    facade: {
      ...real,
      player_observation(state, actor) {
        calls.push("observe");
        return real.player_observation(state, actor);
      },
      perform_command(state, command) {
        calls.push("perform");
        return real.perform_command(state, command);
      },
      heuristic_proposal(observation) {
        calls.push("policy");
        return real.heuristic_proposal(observation);
      },
      validate_state(state) {
        calls.push("validate");
        return real.validate_state(state);
      },
    },
  });
  expect(controller.read_visible_history()).toEqual({
    status: "no_game",
    entries: [],
  });
  controller.resume();
  const before = [calls.slice(), storage.calls.slice()];
  const expected = [
    {
      turn_number: 1,
      actor: 0,
      text: "Game started · turn 1, You are active.",
    },
    { turn_number: 1, actor: 0, text: "You opened with Ishmael Kelp." },
    { turn_number: 1, actor: 1, text: "Rival opened with Fizzy Sparks." },
    { turn_number: 1, actor: 0, text: "You received 3 initial cards." },
    { turn_number: 1, actor: 1, text: "Rival received 3 initial cards." },
    { turn_number: 1, actor: 0, text: "You collected no resources." },
    { turn_number: 1, actor: 1, text: "Turn 1: You handed over to Rival." },
    { turn_number: 1, actor: 1, text: "Rival collected no resources." },
  ];
  const first = controller.read_visible_history();
  expect(first).toEqual({ status: "available", entries: expected });
  expect([calls, storage.calls]).toEqual(before);
  if (first.status !== "available") throw Error("Required history unavailable");
  first.entries[0]!.text = "changed";
  first.entries[0]!.turn_number = 999;
  expect(controller.read_visible_history()).toEqual({
    status: "available",
    entries: expected,
  });
  controller.step_rival();
  const after = [calls.slice(), storage.calls.slice()];
  expect(controller.read_visible_history().entries.at(-1)).toEqual({
    turn_number: 1,
    actor: 1,
    text: "Rival cashed Ellis Voss for 1 Blue.",
  });
  expect([calls, storage.calls]).toEqual(after);
  expect(calls.filter((call) => call === "perform")).toHaveLength(1);
});

test("S10-H02 bounded chronology/context/privacy/unknown refusal uses the same24-tag mapper", () => {
  const prefix: Engine_event[] = [
    {
      event: "cards_drawn",
      player_id: 1,
      card_ids: [31],
      source: "paid",
      price: 1,
    },
    { event: "game_started", turn_number: 7, active_player: 0 },
    {
      event: "operator_intercepted",
      attacker_id: 0,
      defender_id: 1,
      operator_id: 30,
    },
    { event: "turn_changed", from_player: 0, to_player: 1, turn_number: 8 },
    { event: "game_finished", winner: 1, reason: "elimination" },
  ];
  const entries = project_visible_history(prefix);
  expect(entries.map((entry) => [entry.turn_number, entry.actor])).toEqual([
    [null, 1],
    [7, 0],
    [7, 1],
    [8, 1],
    [8, 1],
  ]);
  expect(entries[0]!.text).toBe("Rival drew 1 card (paid; price 1).");
  expect(JSON.stringify(entries)).not.toContain("Ellis");
  const many = project_visible_history([
    { event: "game_started", turn_number: 7, active_player: 0 },
    ...Array.from({ length: 35 }, (_, i): Engine_event => ({
      event: "card_cashed",
      player_id: i % 2,
      card_id: 31,
      color: "blue",
      amount: 1,
      mandatory: false,
    })),
  ]);
  expect(many).toHaveLength(30);
  expect(many[0]!.actor).toBe(1);
  expect(many.at(-1)!.actor).toBe(0);
  expect(many.every((entry) => entry.turn_number === 7)).toBe(true);
  expect(() =>
    project_visible_history([
      {
        event: "private_unknown",
        raw: "must not escape",
      } as unknown as Engine_event,
    ]),
  ).toThrow();
  expect(() =>
    project_visible_history([
      { event: "game_started", turn_number: -1, active_player: 0 },
    ]),
  ).toThrow();
});

test("S10-H03 memory-only/protected failure/inspection/different adoption/publication fault preserve historical lineage", () => {
  const original = literal("S01-AI-FUND-001"),
    storage = port(JSON.stringify(original), current_save_key),
    controller = create_controller({ storage: storage.acquire });
  controller.resume();
  const old = controller.read_visible_history();
  storage.values.set(current_save_key, "rejected bytes");
  controller.inspect_save();
  expect(controller.read_visible_history()).toEqual(old);
  controller.new_game("00000001", "memory_only");
  expect(controller.read_visible_history()).toEqual({
    status: "available",
    entries: [],
  });
  controller.submit_human({ command: "start_game", opening_distributor: 0 });
  expect(controller.read_visible_history().entries).toHaveLength(5);
  expect(storage.values.get(current_save_key)).toBe("rejected bytes");
  storage.faults.write = true;
  controller.new_game("00000001", "replace");
  controller.submit_human({ command: "start_game", opening_distributor: 1 });
  expect(
    controller
      .read_visible_history()
      .entries.some((entry) => entry.text === "You opened with Slick Panzer."),
  ).toBe(true);
  expect(storage.values.get(current_save_key)).toBe("rejected bytes");
  storage.faults.write = false;
  storage.values.set(current_save_key, JSON.stringify(original));
  controller.resume();
  expect(controller.read_visible_history()).toEqual(old);
  let fail = false;
  const damaged = create_controller({
    storage: storage.acquire,
    facade: {
      ...real,
      perform_command(state, command) {
        const result = real.perform_command(state, command);
        fail = true;
        return result;
      },
      player_observation(state, actor) {
        const result = real.player_observation(state, actor);
        if (fail && actor === "0")
          throw Error("publication measurement failure");
        return result;
      },
    },
  });
  damaged.resume();
  const result = damaged.step_rival();
  expect(result.status).toBe("applied");
  expect(result.snapshot.integration_fault).toBe(true);
  expect(damaged.read_visible_history().entries.at(-1)!.text).toBe(
    "Rival cashed Ellis Voss for 1 Blue.",
  );
});

test("S10-J01 independent16 reference predicates, operator exclusion, loss reset and exact record admission", () => {
  const crews = [
    ["The Docks", [0, 1, 2]],
    ["Club Circuit", [3, 4, 5]],
    ["Trailer Park", [6, 7, 8]],
    ["The Burbs", [9, 10, 11]],
    ["Pipeline", [12, 13, 14]],
    ["Night Shift", [15, 16, 17]],
    ["Arts District", [18, 19, 20]],
    ["Hill Country", [21, 22, 23]],
  ] as const;
  const colors = [
    ["Green", [0, 8, 19, 23, 24]],
    ["Blue", [4, 13, 16, 22, 25]],
    ["Black", [1, 7, 9, 12, 26]],
    ["White", [2, 5, 11, 20, 27]],
    ["Yellow", [3, 14, 17, 21, 28]],
    ["Purple", [6, 10, 15, 18, 29]],
  ] as const;
  expect(achievement_definitions).toHaveLength(16);
  expect(
    apply_completion(empty(), {
      winner: 0,
      reason: "elimination",
      human_active_ids: [],
    }).earned_ids,
  ).toEqual(["brutal"]);
  expect(
    apply_completion(
      { ...empty(), win_streak: 9 },
      { winner: 0, reason: "expansion", human_active_ids: [] },
    ).earned_ids,
  ).toEqual(["streak-10"]);
  for (const [crew, ids] of crews)
    expect(
      apply_completion(empty(), {
        winner: 0,
        reason: "expansion",
        human_active_ids: [...ids],
      }).earned_ids,
    ).toEqual(["crew-" + crew]);
  for (const [color, ids] of colors) {
    expect(
      apply_completion(empty(), {
        winner: 0,
        reason: "expansion",
        human_active_ids: [...ids],
      }).earned_ids,
    ).toEqual(["monopoly-" + color]);
    expect(
      apply_completion(empty(), {
        winner: 0,
        reason: "expansion",
        human_active_ids: [...ids.slice(0, -1), 30, 31, 32, 33, 34, 35],
      }).earned_ids,
    ).not.toContain("monopoly-" + color);
  }
  expect(
    apply_completion(
      { schema_version: 1, earned_ids: ["brutal"], win_streak: 9 },
      {
        winner: 1,
        reason: "elimination",
        human_active_ids: Array.from({ length: 36 }, (_, id) => id),
      },
    ),
  ).toEqual({ schema_version: 1, earned_ids: ["brutal"], win_streak: 0 });
  expect(admit_achievements(null)).toEqual(empty());
  expect(admit_achievements("\n" + JSON.stringify(empty()) + "\n")).toEqual(
    empty(),
  );
  for (const input of [
    "",
    "{",
    "null",
    "{}",
    JSON.stringify({ ...empty(), schema_version: 2 }),
    JSON.stringify({ ...empty(), extra: true }),
    JSON.stringify({ ...empty(), earned_ids: ["brutal", "brutal"] }),
    JSON.stringify({ ...empty(), earned_ids: ["unknown"] }),
    JSON.stringify({ ...empty(), win_streak: -1 }),
    JSON.stringify({ ...empty(), win_streak: 1.5 }),
    JSON.stringify({ ...empty(), win_streak: Number.MAX_SAFE_INTEGER + 1 }),
  ])
    expect(() => admit_achievements(input)).toThrow();
});

test("S10-J02 isolated achievement write failure retains pending record and retries without recount/key damage", () => {
  const raw =
      "\n" +
      JSON.stringify({
        schema_version: 1,
        earned_ids: ["brutal"],
        win_streak: 9,
      }) +
      "\n",
    storage = port(raw),
    awards = create_achievements(storage.acquire);
  expect(storage.calls).toEqual([]);
  awards.inspect();
  expect(storage.calls.filter((call) => call === "write")).toHaveLength(0);
  storage.faults.write = true;
  const changed = awards.record_completion({
    winner: 0,
    reason: "expansion",
    human_active_ids: [0, 1, 2],
  });
  expect(changed.record).toEqual({
    schema_version: 1,
    earned_ids: ["brutal", "streak-10", "crew-The Docks"],
    win_streak: 10,
  });
  expect(changed.saved).toBe(false);
  expect(changed.failure).toBe("write");
  expect(storage.values.get(achievement_key)).toBe(raw);
  changed.record!.earned_ids.length = 0;
  expect(awards.snapshot().record!.earned_ids).toHaveLength(3);
  storage.faults.write = false;
  const retry = awards.retry();
  expect(retry.saved).toBe(true);
  expect(retry.record!.win_streak).toBe(10);
  const calls = storage.calls.slice();
  awards.retry();
  expect(storage.calls).toEqual(calls);
  expect(new Set(storage.keys)).toEqual(new Set([achievement_key]));
  expect(storage.values.get("city-of-vice-current-v6")).toBe("legacy game");
  expect(storage.values.get("city-of-vice-achievements-v1")).toBe(
    "legacy awards",
  );
  expect(storage.values.get("sentinel")).toBe("keep");
});

test("S10-J03 unknown/known baseline, changed/invalid/null recovery, capability failure and overflow stay honest", () => {
  for (const stage of ["acquire", "read"] as const) {
    const storage = port(JSON.stringify({ ...empty(), win_streak: 9 })),
      awards = create_achievements(storage.acquire);
    storage.faults[stage] = true;
    awards.record_completion({
      winner: 0,
      reason: "expansion",
      human_active_ids: [],
    });
    expect(awards.snapshot().record).toBeNull();
    const before = storage.calls.slice();
    storage.faults[stage] = false;
    awards.record_completion({
      winner: 1,
      reason: "elimination",
      human_active_ids: [],
    });
    expect(storage.calls).toEqual(before);
    const recovered = awards.retry();
    expect(recovered.saved).toBe(true);
    expect(recovered.record).toEqual({
      schema_version: 1,
      earned_ids: ["streak-10"],
      win_streak: 0,
    });
  }
  const storage = port("invalid bytes"),
    awards = create_achievements(storage.acquire);
  awards.inspect();
  awards.record_completion({
    winner: 0,
    reason: "expansion",
    human_active_ids: [0, 1, 2],
  });
  expect(awards.retry().failure).toBe("invalid");
  expect(storage.values.get(achievement_key)).toBe("invalid bytes");
  storage.values.set(achievement_key, JSON.stringify(empty()));
  expect(awards.retry().failure).toBe("changed");
  expect(storage.calls.filter((call) => call === "write")).toHaveLength(0);
  storage.values.delete(achievement_key);
  expect(awards.retry().record).toEqual({
    schema_version: 1,
    earned_ids: ["crew-The Docks"],
    win_streak: 1,
  });
  const baseline = storage.values.get(achievement_key)!;
  storage.faults.acquire = true;
  awards.record_completion({
    winner: 0,
    reason: "expansion",
    human_active_ids: [],
  });
  expect(awards.snapshot().failure).toBe("acquire");
  storage.faults.acquire = false;
  storage.values.set(
    achievement_key,
    JSON.stringify({ ...empty(), earned_ids: ["brutal"] }),
  );
  expect(awards.retry().failure).toBe("changed");
  storage.values.set(achievement_key, baseline);
  expect(awards.retry().record!.win_streak).toBe(2);
  const overflow_store = port(
      JSON.stringify({ ...empty(), win_streak: Number.MAX_SAFE_INTEGER }),
    ),
    overflow = create_achievements(overflow_store.acquire);
  overflow.inspect();
  expect(
    overflow.record_completion({
      winner: 0,
      reason: "expansion",
      human_active_ids: [],
    }).failure,
  ).toBe("overflow");
  expect(overflow_store.calls.filter((call) => call === "write")).toHaveLength(
    0,
  );
  expect(overflow.snapshot().record!.win_streak).toBe(Number.MAX_SAFE_INTEGER);
});
