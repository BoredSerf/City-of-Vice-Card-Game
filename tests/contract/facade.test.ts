import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as facade from "@city-of-vice/engine";
import type {
  Command_result,
  Engine_command,
  Engine_event,
  Engine_state,
  Pending_decision,
  Policy_pending,
  Rejection_code,
} from "@city-of-vice/engine";

// Finite assertion inventories transcribed from the OCaml interfaces/codecs.
// These assert emitted values; they are not an application codec or rule oracle.
const command_keys = {
  start_game: ["command", "opening_distributor"],
  collect_income: ["command"],
  draw_card: ["command", "payment", "use_docks_bonus"],
  discard_draw_choice: ["command", "card_id"],
  cash_card: ["command", "card_id", "color"],
  trim_resource: ["command", "color"],
  trade_resources: ["command", "from_color", "to_color"],
  end_turn: ["command"],
  activate_card: ["command", "card_id", "wildcard_payment"],
  use_operator: ["command", "operator_id", "target_ids"],
  trade_distributors: ["command", "own_card_id", "rival_card_id"],
  respond_intercept: ["command", "accept"],
} satisfies Record<Engine_command["command"], string[]>;
const event_keys = {
  game_started: ["event", "turn_number", "active_player"],
  opening_distributor_chosen: ["event", "player_id", "card_id"],
  initial_hand_dealt: ["event", "player_id", "count"],
  turn_changed: ["event", "from_player", "to_player", "turn_number"],
  income_collected: ["event", "player_id", "resources"],
  payment_made: ["event", "player_id", "resources"],
  crew_resource_granted: ["event", "player_id", "crew", "color", "amount"],
  deck_reshuffled: ["event", "player_id", "count"],
  cards_drawn: ["event", "player_id", "card_ids", "source", "price"],
  card_discarded: ["event", "player_id", "card_id", "reason"],
  card_cashed: [
    "event",
    "player_id",
    "card_id",
    "color",
    "amount",
    "mandatory",
  ],
  resource_trimmed: ["event", "player_id", "color", "amount"],
  resources_traded: [
    "event",
    "player_id",
    "from_color",
    "to_color",
    "spent",
    "gained",
  ],
  decision_required: ["event", "player_id", "decision"],
  decision_resolved: ["event", "player_id", "decision"],
  card_activated: ["event", "player_id", "card_id"],
  crew_completed: ["event", "player_id", "crew"],
  crew_lost: ["event", "player_id", "crew"],
  operator_result: [
    "event",
    "player_id",
    "operator_id",
    "target_ids",
    "affected",
  ],
  operator_disposed: ["event", "player_id", "operator_id"],
  intercept_answered: ["event", "player_id", "operator_id", "accept"],
  operator_intercepted: ["event", "attacker_id", "defender_id", "operator_id"],
  distributors_traded: ["event", "player_id", "own_card_id", "rival_card_id"],
  game_finished: ["event", "winner", "reason"],
} satisfies Record<Engine_event["event"], string[]>;
const pending_keys = {
  draw_discard: ["decision", "player_id", "card_ids"],
  legit_cash: ["decision", "player_id", "drawn_card_id"],
  trim: ["decision", "player_id"],
  post_action_trim: ["decision", "player_id"],
  intercept: [
    "decision",
    "player_id",
    "attacker_id",
    "operator_id",
    "target_ids",
    "payment",
  ],
} satisfies Record<Pending_decision["decision"], string[]>;
const own_pending_keys = {
  draw_discard: ["decision", "card_ids"],
  legit_cash: ["decision", "drawn_card_id"],
  trim: ["decision"],
  post_action_trim: ["decision"],
  intercept: ["decision", "attacker_id", "operator_id", "target_ids"],
} satisfies Record<Policy_pending["decision"], string[]>;
const rejection_codes = {
  invalid_seed: true,
  invalid_actor: true,
  wrong_phase: true,
  invalid_opening: true,
  malformed_command: true,
  malformed_state: true,
  unsupported_version: true,
  invalid_state: true,
  invalid_card: true,
  invalid_choice: true,
  hand_full: true,
  resource_limit: true,
  insufficient_cards: true,
  invalid_payment: true,
  insufficient_resources: true,
  crew_unavailable: true,
  game_over: true,
  capacity_full: true,
  operator_limit: true,
} satisfies Record<Rejection_code, boolean>;
const colors = ["green", "blue", "black", "white", "yellow", "purple"];
const phases = [
  "awaiting_opening",
  "ready",
  "play",
  "draw_discard",
  "legit_cash",
  "trim",
  "intercept",
  "over",
];
const crews = [
  "The Docks",
  "Club Circuit",
  "Trailer Park",
  "The Burbs",
  "Pipeline",
  "Night Shift",
  "Arts District",
  "Hill Country",
];
const keys = (value: object, wanted: readonly string[]) =>
  expect(Object.keys(value).sort()).toStrictEqual([...wanted].sort());
const integer_list = (value: number[]) => {
  expect(Array.isArray(value)).toBe(true);
  for (const n of value) expect(Number.isInteger(n)).toBe(true);
};
const bank = (value: Record<string, number>) => {
  keys(value, colors);
  for (const n of Object.values(value)) expect(Number.isInteger(n)).toBe(true);
};
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const decode = <T>(encoded: string): T => {
  expect(typeof encoded).toBe("string");
  return JSON.parse(encoded) as T;
};
const accepted = (encoded: string) => {
  const r = decode<Command_result>(encoded);
  expect(r.status).toBe("accepted");
  if (r.status !== "accepted") throw Error(JSON.stringify(r));
  return r;
};
const full_error = (state_json: unknown, code: string, field: string) => ({
  status: "rejected",
  state_json,
  events: [],
  rejection: { code, field },
});
const minimal_error = (code: string, field: string) => ({
  status: "rejected",
  rejection: { code, field },
});
// Deliberate untyped JavaScript calls test the public string-argument boundary.
const call = (fn: unknown, ...args: unknown[]): unknown =>
  decode((fn as (...args: unknown[]) => string)(...args));

test("S07 exposes exactly seven ordinary string operations on the selected actual target", () => {
  const arities = {
    probe: 1,
    create_session: 1,
    perform_command: 2,
    legal_commands: 2,
    validate_state: 1,
    player_observation: 2,
    heuristic_proposal: 1,
  };
  keys(facade, Object.keys(arities));
  for (const [name, arity] of Object.entries(arities)) {
    const fn = facade[name as keyof typeof arities];
    expect(typeof fn).toBe("function");
    expect(fn.length).toBe(arity);
  }
  expect(facade.probe("S07")).toBe("OCaml / S07");
  const session = accepted(facade.create_session("00000001"));
  expect(
    typeof facade.perform_command(
      session.state_json,
      JSON.stringify({
        player_id: 0,
        command: "start_game",
        opening_distributor: 0,
      }),
    ),
  ).toBe("string");
  expect(typeof facade.legal_commands(session.state_json, "0")).toBe("string");
  expect(typeof facade.validate_state(session.state_json)).toBe("string");
  const projected = decode<{ observation: unknown }>(
    facade.player_observation(session.state_json, "0"),
  );
  expect(
    typeof facade.heuristic_proposal(JSON.stringify(projected.observation)),
  ).toBe("string");
});

test("S07 all declared emitted tags have intentional keys, primitive payloads and variant witnesses", () => {
  const seen = {
    commands: new Set<string>(),
    events: new Set<string>(),
    rejections: new Set<string>(),
    pending: new Set<string>(),
    own_pending: new Set<string>(),
    phases: new Set<string>(),
    destinations: new Set<string>(),
    colors: new Set<string>(),
    crews: new Set<string>(),
    reasons: new Set<string>(),
    sources: new Set<string>(),
    proposals: new Set<string>(),
  };
  function command(c: Engine_command) {
    keys(c, command_keys[c.command]);
    seen.commands.add(c.command);
    if ("payment" in c) {
      expect(Array.isArray(c.payment)).toBe(true);
      c.payment.forEach((color) => {
        expect(colors).toContain(color);
        seen.colors.add(color);
      });
      expect(typeof c.use_docks_bonus).toBe("boolean");
    }
    if ("wildcard_payment" in c) {
      expect(
        c.wildcard_payment === null || Array.isArray(c.wildcard_payment),
      ).toBe(true);
      c.wildcard_payment?.forEach((color) => expect(colors).toContain(color));
    }
    if ("target_ids" in c) integer_list(c.target_ids);
    if ("accept" in c) expect(typeof c.accept).toBe("boolean");
    for (const [key, value] of Object.entries(c))
      if (key.endsWith("_id") || key === "opening_distributor")
        expect(Number.isInteger(value)).toBe(true);
    for (const key of ["color", "from_color", "to_color"] as const)
      if (key in c) {
        const color = (c as unknown as Record<string, string>)[key];
        expect(colors).toContain(color);
        seen.colors.add(color!);
      }
  }
  function event(e: Engine_event) {
    keys(e, event_keys[e.event]);
    seen.events.add(e.event);
    for (const [key, value] of Object.entries(e))
      if (
        key.endsWith("_id") ||
        [
          "amount",
          "count",
          "turn_number",
          "from_player",
          "to_player",
          "spent",
          "gained",
          "winner",
          "active_player",
        ].includes(key)
      )
        expect(Number.isInteger(value)).toBe(true);
    if ("resources" in e) bank(e.resources);
    if ("crew" in e) {
      expect(crews).toContain(e.crew);
      seen.crews.add(e.crew);
    }
    if ("color" in e) {
      expect(colors).toContain(e.color);
      seen.colors.add(e.color);
    }
    if ("card_ids" in e) integer_list(e.card_ids);
    if ("decision" in e)
      expect(Object.keys(pending_keys)).toContain(e.decision);
    if ("amount" in e) expect(e.amount).toBe(1);
    if ("gained" in e) expect(e.gained).toBe(1);
    if ("mandatory" in e) expect(typeof e.mandatory).toBe("boolean");
    if ("accept" in e) expect(typeof e.accept).toBe("boolean");
    if (e.event === "card_discarded") expect(e.reason).toBe("docks");
    if (e.event === "crew_resource_granted") expect(e.crew).toBe("Night Shift");
    if (e.event === "cards_drawn") {
      expect(["paid", "burbs"]).toContain(e.source);
      seen.sources.add(e.source);
      expect(e.price === null || Number.isInteger(e.price)).toBe(true);
    }
    if (e.event === "game_finished") {
      expect(["elimination", "expansion"]).toContain(e.reason);
      seen.reasons.add(e.reason);
    }
    if (e.event === "operator_result") {
      integer_list(e.target_ids);
      expect(Array.isArray(e.affected)).toBe(true);
      for (const affected of e.affected) {
        keys(affected, ["card_id", "destination"]);
        expect(Number.isInteger(affected.card_id)).toBe(true);
        const d = affected.destination;
        seen.destinations.add(d.zone);
        keys(
          d,
          d.zone === "discard"
            ? ["zone"]
            : d.zone === "hand"
              ? ["zone", "player_id", "suspended"]
              : ["zone", "player_id"],
        );
        if (d.zone === "hand") expect(typeof d.suspended).toBe("boolean");
      }
    }
  }
  function rejected(r: { rejection: { code: Rejection_code; field: string } }) {
    keys(r.rejection, ["code", "field"]);
    expect(Object.keys(rejection_codes)).toContain(r.rejection.code);
    expect(typeof r.rejection.field).toBe("string");
    seen.rejections.add(r.rejection.code);
  }
  function result(encoded: string) {
    const r = decode<Command_result>(encoded);
    if (r.status === "rejected") {
      keys(r, ["status", "state_json", "events", "rejection"]);
      expect(r.events).toStrictEqual([]);
      rejected(r);
    } else {
      keys(r, ["status", "state_json", "events"]);
      expect(typeof r.state_json).toBe("string");
      expect(Array.isArray(r.events)).toBe(true);
      r.events.forEach(event);
    }
    return r;
  }
  const inspected = new Set<string>();
  function state(encoded: string) {
    if (inspected.has(encoded)) return;
    inspected.add(encoded);
    const s = decode<Engine_state>(encoded);
    keys(s, [
      "schema_version",
      "rules_version",
      "phase",
      "turn_number",
      "active_player",
      "deck",
      "discard",
      "players",
      "random_source",
      "history",
      "winner",
      "win_reason",
      "pending_decision",
    ]);
    expect(s.schema_version).toBe(2);
    expect(s.rules_version).toBe("prototype_4ccb197_pd002_s05_working");
    expect(phases).toContain(s.phase);
    seen.phases.add(s.phase);
    expect(Number.isInteger(s.turn_number)).toBe(true);
    expect([null, 0, 1]).toContain(s.active_player);
    expect([null, 0, 1]).toContain(s.winner);
    expect([null, "elimination", "expansion"]).toContain(s.win_reason);
    integer_list(s.deck);
    integer_list(s.discard);
    expect(s.players).toHaveLength(2);
    keys(s.random_source, ["algorithm", "cursor"]);
    expect(s.random_source.algorithm).toBe("xorshift32_v1");
    expect(s.random_source.cursor).toMatch(/^[0-9a-f]{8}$/);
    for (const p of s.players) {
      keys(p, [
        "resources",
        "hand",
        "active_card_ids",
        "suspended_card_ids",
        "draw_price",
        "traded_distributors",
      ]);
      bank(p.resources);
      integer_list(p.hand);
      integer_list(p.active_card_ids);
      integer_list(p.suspended_card_ids);
      expect(Number.isInteger(p.draw_price)).toBe(true);
      expect(typeof p.traded_distributors).toBe("boolean");
    }
    s.history.forEach(event);
    const pending = s.pending_decision;
    if (pending) {
      keys(pending, pending_keys[pending.decision]);
      seen.pending.add(pending.decision);
      expect([0, 1]).toContain(pending.player_id);
      if (pending.decision === "intercept") {
        bank(pending.payment);
        integer_list(pending.target_ids);
      }
    }
    for (const actor of [0, 1]) {
      const legal = decode<{ status: string; commands: Engine_command[] }>(
        facade.legal_commands(encoded, String(actor)),
      );
      keys(legal, ["status", "commands"]);
      expect(legal.status).toBe("accepted");
      expect(Array.isArray(legal.commands)).toBe(true);
      legal.commands.forEach(command);
      const projection = decode<{
        status: string;
        observation: {
          view: import("@city-of-vice/engine").Player_view;
          legal_commands: Engine_command[];
        };
      }>(facade.player_observation(encoded, String(actor)));
      keys(projection, ["status", "observation"]);
      keys(projection.observation, ["view", "legal_commands"]);
      expect(projection.status).toBe("accepted");
      const v = projection.observation.view;
      keys(v, [
        "player_id",
        "phase",
        "turn_number",
        "active_player",
        "decision_owner",
        "winner",
        "win_reason",
        "players",
        "hand",
        "suspended_card_ids",
        "draw_price",
        "traded_distributors",
        "resource_limit",
        "trade_rate",
        "distributor_capacity",
        "draw_pile_count",
        "discard_count",
        "own_pending_decision",
      ]);
      expect(v.player_id).toBe(actor);
      expect(v.players.map((p) => p.player_id)).toStrictEqual([0, 1]);
      for (const p of v.players) {
        keys(p, ["player_id", "resources", "active_card_ids", "hand_count"]);
        bank(p.resources);
        integer_list(p.active_card_ids);
        expect(Number.isInteger(p.hand_count)).toBe(true);
      }
      integer_list(v.hand);
      integer_list(v.suspended_card_ids);
      expect(projection.observation.legal_commands).toStrictEqual(
        legal.commands,
      );
      if (v.own_pending_decision) {
        const p = v.own_pending_decision;
        keys(p, own_pending_keys[p.decision]);
        seen.own_pending.add(p.decision);
        expect(v.decision_owner).toBe(actor);
      }
      const proposed = decode<
        import("@city-of-vice/engine").Heuristic_proposal_result
      >(facade.heuristic_proposal(JSON.stringify(projection.observation)));
      if (proposed.status === "rejected") {
        keys(proposed, ["status", "rejection"]);
        rejected(proposed);
      } else {
        keys(proposed, ["status", "command"]);
        if (proposed.command === null) seen.proposals.add("null");
        else {
          seen.proposals.add("command");
          command(proposed.command);
          expect(legal.commands).toContainEqual(proposed.command);
        }
      }
    }
  }
  const initial = result(facade.create_session("00000001"));
  if (initial.status !== "accepted") throw Error("initial session");
  state(initial.state_json);
  const opened = result(
    facade.perform_command(
      initial.state_json,
      JSON.stringify({
        player_id: 0,
        command: "start_game",
        opening_distributor: 0,
      }),
    ),
  );
  if (opened.status !== "accepted") throw Error("opening");
  state(opened.state_json);
  interface Case {
    initial_state: Engine_state;
    facade?: boolean;
    steps: { command: unknown }[];
  }
  for (const path of [
    "../economy/scenarios.json",
    "../effects/scenarios.json",
    "../policy/scenarios.json",
  ]) {
    const d = read<{
      cases: Case[];
      numeric_cases?: Case[];
      invalid_states?: { state: Engine_state }[];
    }>(path);
    for (const c of [...d.cases, ...(d.numeric_cases ?? [])].filter(
      (c) => c.facade !== false,
    )) {
      let encoded = accepted(
        facade.validate_state(JSON.stringify(c.initial_state)),
      ).state_json;
      state(encoded);
      for (const step of c.steps) {
        const r = result(
          facade.perform_command(encoded, JSON.stringify(step.command)),
        );
        if (r.status === "accepted") {
          encoded = r.state_json;
          state(encoded);
        }
      }
    }
    for (const invalid of d.invalid_states ?? [])
      result(facade.validate_state(JSON.stringify(invalid.state)));
  }
  result(facade.create_session("00000000"));
  result(facade.validate_state("{"));
  result(
    facade.validate_state(
      JSON.stringify({ ...JSON.parse(opened.state_json), schema_version: 99 }),
    ),
  );
  result(
    facade.perform_command(
      initial.state_json,
      JSON.stringify({
        player_id: 0,
        command: "start_game",
        opening_distributor: 24,
      }),
    ),
  );
  for (const [name, expected] of Object.entries({
    commands: Object.keys(command_keys),
    events: Object.keys(event_keys),
    rejections: Object.keys(rejection_codes),
    pending: Object.keys(pending_keys),
    own_pending: Object.keys(own_pending_keys),
    phases,
    destinations: ["discard", "hand", "active"],
    colors,
    crews,
    reasons: ["elimination", "expansion"],
    sources: ["paid", "burbs"],
    proposals: ["null", "command"],
  }))
    expect([...seen[name as keyof typeof seen]].sort(), name).toStrictEqual(
      [...expected].sort(),
    );
});

test("S07 each of the nine JSON-operation input slots has exact typed failure envelopes", () => {
  const state = accepted(facade.create_session("00000001")).state_json;
  const invalid_values: unknown[] = [
    undefined,
    null,
    true,
    1,
    [],
    {},
    new String("{}"),
  ];
  for (const seed of [
    ...invalid_values,
    "",
    "0",
    "00000000",
    "FFFFFFFF",
    "0000000g",
  ])
    expect(call(facade.create_session, seed)).toStrictEqual(
      full_error(null, "invalid_seed", "seed"),
    );
  const impossible = read<{
    invalid_states: {
      state: Engine_state;
      expected_code: string;
      expected_field: string;
    }[];
  }>("../effects/scenarios.json").invalid_states.find(
    (c) => c.expected_field === "distributor_capacity",
  )!;
  const s = JSON.parse(state) as Engine_state;
  const bad_states: { input: unknown; code: string; field: string }[] = [
    ...invalid_values.map((input) => ({
      input,
      code: "malformed_state",
      field: "json",
    })),
    { input: "{", code: "malformed_state", field: "json" },
    ...["null", "[]", "{}", "true"].map((input) => ({
      input,
      code: "malformed_state",
      field: "object_fields",
    })),
    {
      input: JSON.stringify({ ...s, extra: true }),
      code: "malformed_state",
      field: "object_fields",
    },
    {
      input: JSON.stringify({ ...s, schema_version: 99 }),
      code: "unsupported_version",
      field: "version",
    },
    {
      input: JSON.stringify({
        ...s,
        random_source: { algorithm: "other", cursor: "00000001" },
      }),
      code: "unsupported_version",
      field: "random_source.algorithm",
    },
    {
      input: JSON.stringify({
        ...s,
        random_source: { algorithm: "xorshift32_v1", cursor: "00000000" },
      }),
      code: "malformed_state",
      field: "random_source.cursor",
    },
    {
      input: JSON.stringify(impossible.state),
      code: impossible.expected_code,
      field: impossible.expected_field,
    },
  ];
  for (const { input, code, field } of bad_states) {
    const encoded = typeof input === "string" ? "\n" + input + "\n" : input;
    const unchanged = typeof encoded === "string" ? encoded : null;
    expect(call(facade.validate_state, encoded)).toStrictEqual(
      full_error(unchanged, code, field),
    );
    expect(
      call(
        facade.perform_command,
        encoded,
        JSON.stringify({ player_id: 0, command: "end_turn" }),
      ),
    ).toStrictEqual(full_error(unchanged, code, field));
    expect(call(facade.legal_commands, encoded, "0")).toStrictEqual(
      full_error(null, code, field),
    );
    expect(call(facade.player_observation, encoded, "0")).toStrictEqual(
      minimal_error(code, field),
    );
  }
  for (const player of [
    ...invalid_values,
    "{",
    "null",
    "[]",
    "{}",
    "1.5",
    "2",
    "-1",
    '"0"',
  ]) {
    expect(call(facade.legal_commands, state, player)).toStrictEqual(
      full_error(null, "invalid_actor", "player_id"),
    );
    expect(call(facade.player_observation, state, player)).toStrictEqual(
      minimal_error("invalid_actor", "player_id"),
    );
  }
  const play = read<{ cases: { id: string; initial_state: Engine_state }[] }>(
    "../policy/scenarios.json",
  ).cases.find((c) => c.id === "S01-AI-FUND-001")!.initial_state;
  const padded = "\n" + JSON.stringify(play) + "\n";
  for (const input of [...invalid_values, "{"])
    expect(call(facade.perform_command, padded, input)).toStrictEqual(
      full_error(padded, "malformed_command", "json"),
    );
  const malformed_commands: [unknown, string][] = [
    ...[null, [], true].map(
      (value) => [value, "object_fields"] as [unknown, string],
    ),
    [{}, "command"],
    [{ player_id: 1, command: "unknown" }, "command"],
    [{ player_id: 1, command: "cash_card" }, "object_fields"],
    [{ player_id: 1, command: "end_turn", extra: true }, "object_fields"],
    [
      { player_id: 1, command: "cash_card", card_id: 31.5, color: "blue" },
      "integer",
    ],
    [
      { player_id: 1, command: "cash_card", card_id: 31, color: "any" },
      "color",
    ],
    [
      {
        player_id: 1,
        command: "draw_card",
        payment: ["any"],
        use_docks_bonus: false,
      },
      "payment",
    ],
    [
      { player_id: 1, command: "use_operator", operator_id: 30, target_ids: 0 },
      "array",
    ],
  ];
  for (const [input, field] of malformed_commands)
    expect(
      call(facade.perform_command, padded, JSON.stringify(input)),
    ).toStrictEqual(full_error(padded, "malformed_command", field));
  expect(
    call(
      facade.perform_command,
      padded,
      JSON.stringify({ player_id: 2, command: "end_turn" }),
    ),
  ).toStrictEqual(full_error(padded, "invalid_actor", "player_id"));
  expect(
    call(
      facade.perform_command,
      padded,
      JSON.stringify({
        player_id: 1,
        command: "cash_card",
        card_id: 35,
        color: "white",
      }),
    ),
  ).toStrictEqual(full_error(padded, "invalid_card", "card_id"));
  for (const input of [...invalid_values, "{", "null", "[]", "{}"])
    expect(call(facade.heuristic_proposal, input)).toStrictEqual(
      minimal_error("malformed_command", "policy_observation"),
    );
  expect(accepted(facade.validate_state(padded)).state_json).toBe(
    accepted(facade.validate_state(JSON.stringify(play))).state_json,
  );
});
