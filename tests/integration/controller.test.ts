import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as real from "@city-of-vice/engine";
import type {
  Engine_command,
  Engine_state,
  Engine_event,
  Player_view,
  Rejection_code,
} from "@city-of-vice/engine";
import { create_controller } from "../../src/app/controller.ts";
import { current_save_key } from "../../src/app/persistence.ts";
import type { Engine_facade } from "../../src/engine/index.ts";

type Step = {
  command: Engine_command & { player_id: number };
  policy: boolean;
  expected_changes: Record<string, unknown>;
  expected_events: Engine_event[];
  expected_rejection?: { code: Rejection_code; field: string };
  expected_views: Player_view[];
};
type Fixture = {
  id: string;
  initial_state: Engine_state;
  initial_views: Player_view[];
  steps: Step[];
};
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const document = read<{ cases: Fixture[]; numeric_cases: Fixture[] }>(
  "../policy/scenarios.json",
);
const fixtures = [...document.cases, ...document.numeric_cases];
const fixture = (id: string) => {
  const found = fixtures.find((f) => f.id === id);
  if (!found) throw Error("missing literal " + id);
  return found;
};
const clone = <T>(value: T): T => structuredClone(value);
function patch(state: object, path: string, value: unknown) {
  const keys = path.split(".");
  let target = state as Record<string, unknown>;
  for (const key of keys.slice(0, -1))
    target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = clone(value);
}
function after(state: Engine_state, step: Step): Engine_state {
  const wanted = clone(state);
  if (!step.expected_rejection) {
    for (const [path, value] of Object.entries(step.expected_changes))
      patch(wanted, path, value);
    wanted.history.push(...clone(step.expected_events));
  }
  return wanted;
}
function store(raw: string | null = null) {
  const values = new Map<string, string>([
    ["city-of-vice-current-v6", "legacy sentinel"],
    ["city-of-vice-achievements-v1", "achievement sentinel"],
  ]);
  if (raw !== null) values.set(current_save_key, raw);
  const calls: { operation: string; key?: string; value?: string }[] = [];
  const faults = { acquire: false, read: false, write: false };
  const acquire = () => {
    calls.push({ operation: "acquire" });
    if (faults.acquire) throw Error("private acquisition error");
    return {
      getItem(key: string) {
        calls.push({ operation: "read", key });
        if (faults.read) throw Error("private read error");
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        calls.push({ operation: "write", key, value });
        if (faults.write) throw Error("private quota error");
        values.set(key, value);
      },
    };
  };
  return {
    values,
    calls,
    faults,
    acquire,
    raw: () => values.get(current_save_key) ?? null,
    writes: () => calls.filter((c) => c.operation === "write"),
  };
}
function instrument() {
  const calls: { operation: string; args: string[] }[] = [];
  const facade = Object.fromEntries(
    (Object.keys(real) as (keyof typeof real)[])
      .filter((key) => key !== "probe")
      .map((key) => [
        key,
        (...args: string[]) => {
          calls.push({ operation: key, args });
          return (real[key] as (...values: string[]) => string)(...args);
        },
      ]),
  ) as Engine_facade;
  return {
    facade,
    calls,
    count: (key: string) => calls.filter((c) => c.operation === key).length,
  };
}
function loaded(raw: string) {
  const storage = store(raw),
    spy = instrument();
  const controller = create_controller({
    storage: storage.acquire,
    facade: spy.facade,
  });
  expect(storage.calls).toEqual([]);
  expect(spy.calls).toEqual([]);
  expect(controller.resume().status).toBe("applied");
  expect(storage.writes()).toEqual([]);
  return { controller, storage, spy };
}
const start = { command: "start_game", opening_distributor: 0 } as const;

test("S08-C01 lazy namespace, empty-vs-null, raw admission, cancellation and protected sentinels", () => {
  const storage = store();
  const controller = create_controller({ storage: storage.acquire });
  expect(controller.snapshot().human).toBeNull();
  expect(storage.calls).toEqual([]);
  expect(controller.cancel().trusted_events).toEqual([]);
  expect(controller.new_game("00000001").status).toBe("cancelled");
  expect(storage.calls).toEqual([]);
  expect(controller.inspect_save().snapshot.save.slot).toEqual({
    admission: "empty",
  });
  storage.values.set(current_save_key, "");
  expect(controller.inspect_save().rejection).toEqual({
    code: "malformed_state",
    field: "json",
  });
  expect(controller.resume().status).toBe("rejected");
  expect(controller.snapshot().human).toBeNull();
  expect(controller.new_game("00000001", "empty_only").status).toBe(
    "replacement_required",
  );
  expect(controller.cancel().trusted_events).toEqual([]);
  expect(storage.raw()).toBe("");
  expect(controller.new_game("00000001", "replace").snapshot.save.saved).toBe(
    true,
  );
  expect(JSON.parse(storage.raw()!).phase).toBe("awaiting_opening");
  expect(storage.values.get("city-of-vice-current-v6")).toBe("legacy sentinel");
  expect(storage.values.get("city-of-vice-achievements-v1")).toBe(
    "achievement sentinel",
  );
  expect(new Set(storage.calls.filter((c) => c.key).map((c) => c.key))).toEqual(
    new Set([current_save_key]),
  );
});

test("S08-C02 actual literal human/rival shared traces, finite fresh policy, actor injection, current rejection and detached events", () => {
  for (const id of [
    "S01-AI-FUND-001",
    "S01-AI-FUND-001/mirror",
    "S01-AI-FUND-003",
    "S01-AI-STOP-001",
  ]) {
    const literal = fixture(id),
      { controller, storage, spy } = loaded(
        JSON.stringify(literal.initial_state),
      );
    let state = clone(literal.initial_state);
    for (const step of literal.steps) {
      const before = spy.count("perform_command"),
        policies = spy.count("heuristic_proposal"),
        writes = storage.writes().length;
      const { player_id, ...command } = step.command;
      const update =
        player_id === 0
          ? controller.submit_human({
              ...command,
              player_id: 1,
            } as unknown as Engine_command)
          : controller.step_rival();
      expect(update.status, id).toBe(
        step.expected_rejection ? "rejected" : "applied",
      );
      expect(spy.count("perform_command")).toBe(before + 1);
      expect(spy.count("heuristic_proposal")).toBe(
        policies + (player_id === 1 ? 1 : 0),
      );
      expect(
        JSON.parse(
          spy.calls.filter((c) => c.operation === "perform_command").at(-1)!
            .args[1]!,
        ),
      ).toEqual(step.command);
      expect(update.trusted_events).toEqual(step.expected_events);
      state = after(state, step);
      expect(JSON.parse(storage.raw()!)).toEqual(state);
      expect(update.snapshot.human?.view).toEqual(step.expected_views[0]);
      expect(storage.writes()).toHaveLength(
        writes + (step.expected_rejection ? 0 : 1),
      );
      if (player_id === 1) {
        const input = JSON.parse(
          spy.calls.filter((c) => c.operation === "heuristic_proposal").at(-1)!
            .args[0]!,
        );
        expect(Object.keys(input).sort()).toEqual(["legal_commands", "view"]);
        expect(input.view.player_id).toBe(1);
        expect(Object.keys(input.view).sort()).toEqual(
          Object.keys(literal.initial_views[1]!).sort(),
        );
      }
      update.trusted_events.length = 0;
      update.snapshot.human!.view.hand.push(999);
      update.snapshot.human!.view.players[0]!.resources.blue = 999;
      update.snapshot.save.saved = false;
      expect(controller.snapshot().human?.view).toEqual(step.expected_views[0]);
      expect(controller.snapshot().save.saved).toBe(true);
      expect(JSON.parse(storage.raw()!)).toEqual(state);
    }
  }
  const f = fixture("S01-AI-FUND-001/mirror");
  const { controller, storage, spy } = loaded(JSON.stringify(f.initial_state));
  const cash = { command: "cash_card", card_id: 31, color: "blue" } as const;
  const wrong = controller.submit_human({
    command: "activate_card",
    card_id: 4,
    wildcard_payment: null,
  });
  expect(wrong.rejection).toEqual({
    code: "insufficient_resources",
    field: "payment",
  });
  controller.submit_human({ command: "cash_card", card_id: 4, color: "blue" });
  expect(controller.submit_human(cash).status).toBe("applied"); // Old-origin but still legal now.
  const bytes = storage.raw(),
    writes = storage.writes().length;
  expect(controller.submit_human(cash).rejection).toEqual({
    code: "invalid_card",
    field: "card_id",
  });
  expect(storage.raw()).toBe(bytes);
  expect(storage.writes()).toHaveLength(writes);
  expect(
    spy.calls.filter((c) => c.operation === "perform_command").at(-1)!.args[0],
  ).toBe(bytes);
  const other = loaded(
    JSON.stringify(fixture("S01-AI-FUND-001").initial_state),
  );
  expect(other.controller.submit_human(cash).rejection).toEqual({
    code: "invalid_actor",
    field: "player_id",
  });
  const funded = loaded(JSON.stringify(f.initial_state));
  funded.controller.submit_human(cash);
  funded.controller.submit_human({
    command: "draw_card",
    payment: ["blue"],
    use_docks_bonus: false,
  });
  expect(
    funded.controller.submit_human({
      command: "activate_card",
      card_id: 4,
      wildcard_payment: null,
    }).rejection,
  ).toEqual({ code: "insufficient_resources", field: "payment" });
});

test("S08-C03 literal reconstruction covers eight phases/five pending kinds, both owners, transient limits and no replay", () => {
  expect(fixtures).toHaveLength(93);
  const phases = new Set<string>(),
    decisions = new Set<string>(),
    owners = new Set<number>(),
    terminal = new Set<string>();
  let observed = 0,
    inactive_rival = 0,
    human_wait = 0,
    hand8 = 0,
    cash26 = 0;
  for (const literal of fixtures) {
    let state = clone(literal.initial_state),
      views = literal.initial_views;
    for (let boundary = 0; boundary <= literal.steps.length; boundary++) {
      phases.add(state.phase);
      if (state.pending_decision) {
        decisions.add(state.pending_decision.decision);
        owners.add(state.pending_decision.player_id);
      }
      if (state.win_reason) terminal.add(state.win_reason);
      if (state.players.some((p) => p.hand.length === 8)) hand8++;
      if (
        state.players.some(
          (p) => Object.values(p.resources).reduce((a, b) => a + b, 0) === 26,
        )
      )
        cash26++;
      // Noncanonical whitespace stays byte-for-byte stored while canonical state is admitted privately.
      const raw = "\n" + JSON.stringify(state) + "\n",
        storage = store(raw),
        spy = instrument();
      const controller = create_controller({
        storage: storage.acquire,
        facade: spy.facade,
      });
      const inspected = controller.inspect_save();
      expect(inspected.snapshot.human).toBeNull();
      expect(inspected.snapshot.save.slot).toEqual({
        admission: "valid",
        resumable: state.phase !== "over",
      });
      const resumed = controller.resume();
      expect(resumed.status, literal.id + "/" + boundary).toBe("applied");
      expect(resumed.snapshot.human?.view).toEqual(views[0]);
      expect(resumed.trusted_events).toEqual([]);
      expect(storage.raw()).toBe(raw);
      expect(storage.writes()).toHaveLength(0);
      expect(spy.count("perform_command")).toBe(0);
      expect(spy.count("heuristic_proposal")).toBe(0);
      expect(spy.count("create_session")).toBe(0);
      const ordinary = JSON.stringify(resumed.snapshot);
      for (const private_key of [
        "state_json",
        "random_source",
        '"history"',
        '"deck"',
        '"recovery"',
      ])
        expect(ordinary).not.toContain(private_key);
      const step = literal.steps[boundary];
      if (step) {
        if (step.command.player_id === 0) {
          if (
            state.pending_decision?.player_id === 0 &&
            state.active_player === 1
          ) {
            const wait = controller.step_rival();
            expect(wait.status).toBe("idle");
            expect(wait.trusted_events).toEqual([]);
            expect(spy.count("perform_command")).toBe(0);
            human_wait++;
          }
          const { player_id: _, ...command } = step.command;
          const actual = controller.submit_human(command);
          expect(actual.status, literal.id).toBe(
            step.expected_rejection ? "rejected" : "applied",
          );
          expect(actual.trusted_events, literal.id).toEqual(
            step.expected_events ?? [],
          );
          if (!step.expected_rejection)
            expect(JSON.parse(storage.raw()!)).toEqual(after(state, step));
        } else if (step.policy) {
          const actual = controller.step_rival();
          expect(actual.status, literal.id).toBe(
            step.expected_rejection ? "rejected" : "applied",
          );
          expect(actual.trusted_events, literal.id).toEqual(
            step.expected_events ?? [],
          );
          if (!step.expected_rejection)
            expect(JSON.parse(storage.raw()!)).toEqual(after(state, step));
          expect(spy.count("heuristic_proposal")).toBe(1);
          expect(spy.count("perform_command")).toBe(1);
          if (
            state.pending_decision?.player_id === 1 &&
            state.active_player === 0
          )
            inactive_rival++;
        }
        state = after(state, step);
        views = step.expected_views;
      } else if (
        state.phase === "over" ||
        state.phase === "awaiting_opening" ||
        (state.active_player === 0 &&
          state.pending_decision?.player_id !== 1) ||
        state.pending_decision?.player_id === 0
      ) {
        expect(
          controller.step_rival().status,
          literal.id + "/" + boundary,
        ).toBe("idle");
        expect(spy.count("perform_command")).toBe(0);
        expect(storage.raw()).toBe(raw);
      }
      observed++;
    }
  }
  expect([...phases].sort()).toEqual([
    "awaiting_opening",
    "draw_discard",
    "intercept",
    "legit_cash",
    "over",
    "play",
    "ready",
    "trim",
  ]);
  expect([...decisions].sort()).toEqual([
    "draw_discard",
    "intercept",
    "legit_cash",
    "post_action_trim",
    "trim",
  ]);
  expect([...owners].sort()).toEqual([0, 1]);
  expect([...terminal].sort()).toEqual(["elimination", "expansion"]);
  expect(inactive_rival).toBeGreaterThan(0);
  expect(human_wait).toBeGreaterThan(0);
  expect(hand8).toBeGreaterThan(0);
  expect(cash26).toBeGreaterThan(0);
  expect(observed).toBeGreaterThan(200);
});

test("S08-C04 actual malformed/impossible/version/legacy admission never adopts, repairs or overwrites", () => {
  const invalid = read<{
    invalid_states: {
      id: string;
      state: Engine_state;
      expected_code: Rejection_code;
      expected_field: string;
    }[];
  }>("../effects/scenarios.json").invalid_states;
  expect(invalid.length).toBeGreaterThan(20);
  const base = fixture("S01-AI-FUND-001").initial_state;
  const cases = invalid.map((x) => ({
    raw: JSON.stringify(x.state),
    code: x.expected_code,
    field: x.expected_field,
  }));
  for (const [key, value, code, field] of [
    ["schema_version", 999, "unsupported_version", "version"],
    ["rules_version", "other", "unsupported_version", "version"],
    [
      "random_source.algorithm",
      "other",
      "unsupported_version",
      "random_source.algorithm",
    ],
  ] as const) {
    const state = clone(base);
    patch(state, key, value);
    cases.push({ raw: JSON.stringify(state), code, field });
  }
  cases.push({ raw: "{", code: "malformed_state", field: "json" });
  // Original SAVE001–004 stay historical; these modular-key rejection expectations are separately provisional68.
  const legacy = read<{ id: string; saved_payload?: unknown }[]>(
    "../characterization/scenarios.json",
  ).filter((record) => /^S01-SAVE-00[1-4]$/.test(record.id));
  expect(legacy.map((record) => record.id)).toEqual([
    "S01-SAVE-001",
    "S01-SAVE-002",
    "S01-SAVE-003",
    "S01-SAVE-004",
  ]);
  for (const record of legacy)
    cases.push({
      raw: JSON.stringify(record.saved_payload),
      code: "malformed_state",
      field: "object_fields",
    });
  for (const raw of ["null", "{}"])
    cases.push({ raw, code: "malformed_state", field: "object_fields" });
  for (const item of cases) {
    const { controller, storage } = loaded(JSON.stringify(base));
    const before = controller.snapshot().human;
    storage.values.set(current_save_key, item.raw);
    expect(controller.inspect_save().rejection, item.raw).toEqual({
      code: item.code,
      field: item.field,
    });
    expect(controller.resume().status).toBe("rejected");
    expect(controller.snapshot().human).toEqual(before);
    expect(controller.new_game("00000001", "empty_only").status).toBe(
      "replacement_required",
    );
    expect(controller.cancel().trusted_events).toEqual([]);
    expect(storage.raw()).toBe(item.raw);
    expect(storage.writes()).toHaveLength(0);
  }
});

test("S08-C05 candidate ordering and three intentions preserve live progress and bytes", () => {
  const old = JSON.stringify(fixture("S01-AI-FUND-001").initial_state);
  for (const intent of ["empty_only", "replace", "memory_only"] as const) {
    const { controller, storage } = loaded(old),
      before = controller.snapshot();
    expect(controller.new_game("bad", intent).rejection).toEqual({
      code: "invalid_seed",
      field: "seed",
    });
    expect(controller.snapshot()).toEqual(before);
    expect(storage.raw()).toBe(old);
    expect(storage.writes()).toHaveLength(0);
  }
  const { controller, storage } = loaded(old),
    before = controller.snapshot().human;
  expect(controller.new_game("00000001", "empty_only").status).toBe(
    "replacement_required",
  );
  expect(controller.snapshot().human).toEqual(before);
  expect(
    controller.new_game("00000001", "memory_only").snapshot.save
      .write_authority,
  ).toBe("protected");
  expect(controller.submit_human(start).status).toBe("applied");
  expect(storage.raw()).toBe(old);
  expect(controller.retry_save().status).toBe("replacement_required");
  expect(controller.retry_save("replace").status).toBe("saved");
  expect(JSON.parse(storage.raw()!).phase).toBe("ready");
  for (const stage of ["acquire", "read"] as const) {
    const s = store(),
      c = create_controller({ storage: s.acquire });
    s.faults[stage] = true;
    expect(c.new_game("00000001", "empty_only").status).toBe("unavailable");
    expect(c.snapshot().human).toBeNull();
    expect(s.writes()).toHaveLength(0);
    expect(c.new_game("00000001", "memory_only").status).toBe("applied");
    expect(s.writes()).toHaveLength(0);
  }
});

test("S08-C06 failed protected replacement consumes intent; commands and plain retry cannot overwrite", () => {
  for (const initial of [
    "rejected bytes",
    JSON.stringify(fixture("S01-AI-FUND-001").initial_state),
  ]) {
    const storage = store(initial),
      spy = instrument(),
      controller = create_controller({
        storage: storage.acquire,
        facade: spy.facade,
      });
    storage.faults.write = true;
    const replaced = controller.new_game("00000001", "replace");
    expect(replaced.status).toBe("applied");
    expect(replaced.snapshot.save).toMatchObject({
      saved: false,
      write_authority: "protected",
      failure: "write",
    });
    expect(storage.writes()).toHaveLength(1);
    expect(storage.raw()).toBe(initial);
    storage.faults.write = false;
    const reads = storage.calls.filter((c) => c.operation === "read").length;
    expect(controller.submit_human(start).status).toBe("applied");
    expect(storage.writes()).toHaveLength(1);
    expect(storage.raw()).toBe(initial);
    expect(storage.calls.filter((c) => c.operation === "read")).toHaveLength(
      reads,
    );
    expect(controller.retry_save().status).toBe("replacement_required");
    expect(storage.writes()).toHaveLength(1);
    const effects = spy.count("perform_command");
    expect(controller.retry_save("replace").status).toBe("saved");
    expect(storage.writes()).toHaveLength(2);
    expect(spy.count("perform_command")).toBe(effects);
    expect(controller.retry_save().trusted_events).toEqual([]);
  }
});

test("S08-C10 raw owned baseline recovery, memory lineage reset, no-game finite operations and nested trusted detachment", () => {
  const initial =
    "\n" +
    JSON.stringify(fixture("S01-AI-FUND-001/mirror").initial_state, null, 2) +
    "\n";
  const { controller, storage, spy } = loaded(initial);
  storage.faults.read = true;
  controller.inspect_save();
  storage.faults.read = false;
  const applied = controller.submit_human({
    command: "cash_card",
    card_id: 31,
    color: "blue",
  });
  expect(storage.raw()).toBe(initial);
  expect(applied.snapshot.save.write_authority).toBe("suspended");
  expect(controller.inspect_save().snapshot.save.write_authority).toBe("owned");
  expect(storage.writes()).toHaveLength(0);
  expect(controller.snapshot().save.saved).toBe(false);
  expect(controller.retry_save().status).toBe("saved");
  expect(spy.count("perform_command")).toBe(1);
  const paid = controller.submit_human({
    command: "activate_card",
    card_id: 4,
    wildcard_payment: null,
  });
  const preserved = storage.raw(),
    observation = controller.snapshot().human;
  const payment = paid.trusted_events.find(
    (event) => event.event === "payment_made",
  );
  if (!payment || payment.event !== "payment_made")
    throw Error("literal payment event absent");
  payment.resources.blue = 999;
  expect(storage.raw()).toBe(preserved);
  expect(controller.snapshot().human).toEqual(observation);
  controller.new_game("00000001", "memory_only");
  expect(controller.inspect_save().snapshot.save.write_authority).toBe(
    "protected",
  );
  expect(controller.retry_save().status).toBe("replacement_required");
  expect(controller.resume().snapshot.save.saved).toBe(true); // Explicit adoption of that valid slot is allowed.
  const empty_store = store(),
    no_game_spy = instrument(),
    no_game = create_controller({
      storage: empty_store.acquire,
      facade: no_game_spy.facade,
    });
  for (const result of [
    no_game.step_rival(),
    no_game.retry_save(),
    no_game.submit_human(start),
  ]) {
    expect(result.status).toBe("no_game");
    expect(result.trusted_events).toEqual([]);
  }
  expect(empty_store.calls).toEqual([]);
  expect(no_game_spy.calls).toEqual([]);
});

test("S08-C07 ordinary owned failures keep authority; autosave/retry save current progress without replay", () => {
  const storage = store(),
    spy = instrument(),
    controller = create_controller({
      storage: storage.acquire,
      facade: spy.facade,
    });
  storage.faults.write = true;
  expect(
    controller.new_game("00000001", "empty_only").snapshot.save,
  ).toMatchObject({ saved: false, write_authority: "owned", failure: "write" });
  expect(controller.submit_human(start).snapshot.save.saved).toBe(false);
  expect(spy.count("perform_command")).toBe(1);
  storage.faults.write = false;
  const income = controller.submit_human({ command: "collect_income" });
  expect(income.status).toBe("applied");
  expect(income.snapshot.save.saved).toBe(true);
  expect(spy.count("perform_command")).toBe(2);
  storage.faults.write = true;
  const baseline = storage.raw();
  expect(controller.retry_save().snapshot.save).toMatchObject({
    saved: false,
    write_authority: "owned",
    failure: "write",
  });
  expect(storage.raw()).toBe(baseline);
  storage.faults.write = false;
  expect(controller.retry_save().status).toBe("saved");
  expect(spy.count("perform_command")).toBe(2);
  expect(controller.retry_save().trusted_events).toEqual([]);
});

test("S08-C08 acquisition/read suspend writes; recovery requires null or exact admitted owned baseline", () => {
  const initial = JSON.stringify(
    fixture("S01-AI-FUND-001/mirror").initial_state,
  );
  const different = JSON.stringify(fixture("S01-AI-FUND-001").initial_state);
  for (const stage of ["acquire", "read"] as const)
    for (const recovery of [
      "same",
      "null",
      "different",
      "rejected",
      "unreadable",
    ] as const) {
      const { controller, storage, spy } = loaded(initial);
      storage.faults[stage] = true;
      expect(controller.inspect_save().snapshot.save).toMatchObject({
        saved: false,
        write_authority: "suspended",
        failure: stage,
        slot: { admission: "unreadable" },
      });
      const command = controller.submit_human({
        command: "cash_card",
        card_id: 31,
        color: "blue",
      });
      expect(command.status).toBe("applied");
      expect(command.snapshot.save.saved).toBe(false);
      expect(storage.writes()).toHaveLength(0);
      storage.faults[stage] = recovery === "unreadable";
      if (recovery === "null") storage.values.delete(current_save_key);
      if (recovery === "different")
        storage.values.set(current_save_key, different);
      if (recovery === "rejected")
        storage.values.set(current_save_key, "broken");
      const before = spy.count("perform_command"),
        result = controller.retry_save();
      expect(result.status).toBe(
        recovery === "same" || recovery === "null"
          ? "saved"
          : recovery === "unreadable"
            ? "unavailable"
            : "replacement_required",
      );
      expect(result.trusted_events).toEqual([]);
      expect(spy.count("perform_command")).toBe(before);
      expect(storage.writes()).toHaveLength(
        recovery === "same" || recovery === "null" ? 1 : 0,
      );
      if (recovery === "different") expect(storage.raw()).toBe(different);
      if (recovery === "rejected") expect(storage.raw()).toBe("broken");
    }
  // Observed change without an exception suspends ordinary autosaves too.
  const { controller, storage } = loaded(initial);
  storage.values.set(current_save_key, different);
  expect(controller.inspect_save().snapshot.save.write_authority).toBe(
    "protected",
  );
  controller.submit_human({ command: "cash_card", card_id: 31, color: "blue" });
  expect(storage.raw()).toBe(different);
  expect(storage.writes()).toHaveLength(0);
  // Getter failure during an ordinary save suspends even its previously owned slot.
  const owned = loaded(initial);
  owned.storage.faults.acquire = true;
  expect(
    owned.controller.submit_human({
      command: "cash_card",
      card_id: 31,
      color: "blue",
    }).snapshot.save,
  ).toMatchObject({
    write_authority: "suspended",
    saved: false,
    failure: "acquire",
  });
  owned.storage.faults.acquire = false;
  expect(owned.controller.retry_save().status).toBe("saved");
});

test("S08-C09 pre-adoption decode fault preserves state; late publication fault retains accepted command/save", () => {
  const initial = JSON.stringify(
      fixture("S01-AI-FUND-001/mirror").initial_state,
    ),
    storage = store(initial),
    spy = instrument();
  let fail_command = false,
    fail_observation = false;
  // Fault injection may fail measurement after forwarding; it never fabricates a successful result.
  const facade = {
    ...spy.facade,
    perform_command(state: string, command: string) {
      const output = spy.facade.perform_command(state, command);
      return fail_command ? "{" : output;
    },
    player_observation(state: string, actor: string) {
      const output = spy.facade.player_observation(state, actor);
      if (fail_observation) throw Error("publication fault");
      return output;
    },
  };
  const controller = create_controller({ storage: storage.acquire, facade });
  controller.resume();
  const old = controller.snapshot().human;
  fail_command = true;
  expect(
    controller.submit_human({
      command: "cash_card",
      card_id: 31,
      color: "blue",
    }).status,
  ).toBe("integration_fault");
  expect(storage.raw()).toBe(initial);
  expect(controller.snapshot().human).toEqual(old);
  expect(storage.writes()).toHaveLength(0);
  fail_command = false;
  fail_observation = true;
  const actual = controller.submit_human({
    command: "cash_card",
    card_id: 31,
    color: "blue",
  });
  expect(actual.status).toBe("applied");
  expect(actual.snapshot.integration_fault).toBe(true);
  expect(actual.snapshot.save.saved).toBe(true);
  expect(actual.trusted_events).toEqual(
    fixture("S01-AI-FUND-001/mirror").steps[0]!.expected_events,
  );
  expect(storage.writes()).toHaveLength(1);
  expect(spy.count("perform_command")).toBe(2);
  fail_observation = false;
  expect(controller.snapshot().human?.view).toEqual(
    fixture("S01-AI-FUND-001/mirror").steps[0]!.expected_views[0],
  );
});
