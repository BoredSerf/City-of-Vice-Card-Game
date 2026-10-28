import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  player_observation,
  heuristic_proposal,
  perform_command,
  legal_commands,
  validate_state,
  create_session,
  type Engine_state,
  type Engine_command,
  type Command_result,
  type Player_observation,
  type Player_observation_result,
  type Heuristic_proposal_result,
  type Player_view,
} from "@city-of-vice/engine";

type Measurement = {
  observation: Player_observation;
  proposal: Heuristic_proposal_result;
};
type Trace = {
  id: string;
  initial_state_json: string;
  initial: Measurement[];
  steps: {
    before: Measurement[];
    command_json: string;
    result: Command_result;
    after: Measurement[];
  }[];
};
type Step = {
  command: Engine_command & { player_id: number };
  policy: boolean;
  expected_changes: Record<string, unknown>;
  expected_events: unknown[];
  expected_rejection?: { code: string; field: string };
  expected_views: Player_view[];
  expected_legal?: Engine_command[][];
};
type Fixture = {
  id: string;
  initial_state: Engine_state;
  initial_views: Player_view[];
  initial_legal?: Engine_command[][];
  steps: Step[];
};
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
// All IDs and native evidence are mandatory. Missing/empty/partial data fails.
const traces = read<Trace[]>("../../_build/default/test/policy_parity.json");
const fixture_document = read<{
  contract_sha256: string;
  cases: Fixture[];
  numeric_cases: Fixture[];
}>("../policy/scenarios.json");
const fixtures = {
  ...fixture_document,
  cases: [...fixture_document.cases, ...fixture_document.numeric_cases],
};
const clone = <T>(x: T): T => structuredClone(x);
const parse = <T>(x: string): T => {
  expect(typeof x).toBe("string");
  return JSON.parse(x) as T;
};
const result = (x: string) => parse<Command_result>(x);
const accepted = (x: string) => {
  const r = result(x);
  expect(r.status).toBe("accepted");
  if (r.status !== "accepted") throw Error(JSON.stringify(r));
  return r;
};
function observation(encoded: string, actor: number): Player_observation {
  const r = parse<Player_observation_result>(
    player_observation(encoded, JSON.stringify(actor)),
  );
  expect(Object.keys(r).sort()).toStrictEqual(["observation", "status"]);
  if (r.status !== "accepted") throw Error(JSON.stringify(r));
  return r.observation;
}
const propose = (o: Player_observation) =>
  parse<Heuristic_proposal_result>(heuristic_proposal(JSON.stringify(o)));
function rejected(
  encoded: string,
  command: unknown,
  code: string,
  field: string,
) {
  expect(
    result(perform_command(encoded, JSON.stringify(command))),
  ).toStrictEqual({
    status: "rejected",
    state_json: encoded,
    events: [],
    rejection: { code, field },
  });
}
function measure(
  encoded: string,
  expected: Measurement[],
  views: Player_view[],
) {
  for (const actor of [0, 1]) {
    const o = observation(encoded, actor);
    expect(o.view).toStrictEqual(views[actor]);
    expect(o).toStrictEqual(expected[actor]!.observation);
    const legal = parse<{ commands: Engine_command[] }>(
      legal_commands(encoded, JSON.stringify(actor)),
    ).commands;
    expect(o.legal_commands).toStrictEqual(legal);
    expect(propose(o)).toStrictEqual(expected[actor]!.proposal);
    expect(propose(o)).toStrictEqual(propose(o));
  }
}
function patch(state: object, path: string, value: unknown) {
  const keys = path.split(".");
  let target = state as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1))
    target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = clone(value);
}

test("S06 actual generated observations/proposals match literal choices, complete resulting states/facts and required native evidence", () => {
  expect(fixtures.contract_sha256).toBe(
    "b594ced35525ff9ae71113a8c410ea22aee470ec2857affa1dac2ce523fb910e",
  );
  expect(fixture_document.cases).toHaveLength(86);
  expect(fixture_document.numeric_cases).toHaveLength(7);
  expect(fixtures.cases).toHaveLength(93);
  expect(traces.map((t) => t.id)).toStrictEqual(
    fixtures.cases.map((t) => t.id),
  );
  const crews = new Set<string>(),
    decisions = new Set<string>();
  let chosen = 0;
  for (const [i, trace] of traces.entries()) {
    const fixture = fixtures.cases[i]!;
    expect(trace.steps).toHaveLength(fixture.steps.length);
    let encoded = accepted(
      validate_state(JSON.stringify(fixture.initial_state)),
    ).state_json;
    expect(JSON.parse(encoded)).toStrictEqual(fixture.initial_state);
    expect(encoded).toBe(trace.initial_state_json);
    measure(encoded, trace.initial, fixture.initial_views);
    if (fixture.initial_legal)
      expect(
        trace.initial.map((m) => m.observation.legal_commands),
      ).toStrictEqual(fixture.initial_legal);
    for (const [j, step] of trace.steps.entries()) {
      const literal = fixture.steps[j]!;
      const before = encoded;
      const old = [observation(before, 0), observation(before, 1)];
      const saved = clone(old);
      if (literal.policy) {
        chosen++;
        const actor = literal.command.player_id;
        const { player_id: _, ...command } = literal.command;
        expect(propose(old[actor]!)).toStrictEqual({
          status: "accepted",
          command,
        });
        expect(old[actor]!.legal_commands).toContainEqual(command);
      }
      const actual = result(perform_command(encoded, step.command_json));
      expect(actual).toStrictEqual(step.result);
      const wanted = clone(JSON.parse(before) as Engine_state);
      if (literal.expected_rejection) {
        expect(actual).toStrictEqual({
          status: "rejected",
          state_json: before,
          events: [],
          rejection: literal.expected_rejection,
        });
      } else {
        for (const [path, value] of Object.entries(literal.expected_changes))
          patch(wanted, path, value);
        wanted.history.push(
          ...(literal.expected_events as Engine_state["history"]),
        );
        expect(actual.status).toBe("accepted");
        if (actual.status !== "accepted") throw Error(JSON.stringify(actual));
        expect(actual.events).toStrictEqual(literal.expected_events);
        expect(JSON.parse(actual.state_json)).toStrictEqual(wanted);
        encoded = actual.state_json;
        for (const e of actual.events) {
          if (e.event === "crew_completed" || e.event === "crew_lost")
            crews.add(e.crew);
          if (e.event === "decision_resolved") decisions.add(e.decision);
        }
      }
      expect(old).toStrictEqual(saved);
      expect(observation(before, 0)).toStrictEqual(saved[0]);
      measure(encoded, step.after, literal.expected_views);
      if (literal.expected_legal)
        expect(
          step.after.map((m) => m.observation.legal_commands),
        ).toStrictEqual(literal.expected_legal);
    }
  }
  expect(chosen).toBeGreaterThan(60);
  expect([...decisions].sort()).toStrictEqual([
    "draw_discard",
    "intercept",
    "legit_cash",
    "post_action_trim",
    "trim",
  ]);
  expect(
    crews.has("The Docks") &&
      crews.has("Club Circuit") &&
      crews.has("Night Shift"),
  ).toBe(true);
});

test("S06 twin worlds hide deck order/cursor and opponent composition for both identities and every boundary", () => {
  let checked = 0;
  const check = (encoded: string) => {
    const s = JSON.parse(encoded) as Engine_state;
    const twin = clone(s);
    // Awaiting-opening admission requires the canonical complete deck order.
    if (s.phase !== "awaiting_opening") twin.deck.reverse();
    twin.random_source.cursor = "12345678";
    const other = accepted(validate_state(JSON.stringify(twin))).state_json;
    for (const a of [0, 1]) {
      const left = observation(encoded, a),
        right = observation(other, a);
      expect(left).toStrictEqual(right);
      expect(propose(left)).toStrictEqual(propose(right));
      expect(player_observation(encoded, "2")).toBe(
        player_observation(other, "2"),
      );
      checked++;
    }
    if (s.deck.length > 1)
      expect({
        ...observation(encoded, 0),
        leak: s.deck,
        cursor: s.random_source.cursor,
      }).not.toStrictEqual({
        ...observation(other, 0),
        leak: twin.deck,
        cursor: twin.random_source.cursor,
      });
  };
  for (const trace of traces) {
    check(trace.initial_state_json);
    for (const step of trace.steps)
      if (step.result.status === "accepted") check(step.result.state_json);
  }
  expect(checked).toBeGreaterThan(300);
  const base = clone(
    fixtures.cases.find((c) => c.id === "S01-AI-FUND-001")!.initial_state,
  );
  for (const actor of [0, 1])
    for (const hand of [[30], [5, 6, 7, 8, 9, 30, 32]]) {
      let s = clone(base);
      if (actor === 0) {
        s.players.reverse();
        s.active_player = 0;
        s.history = clone(
          fixtures.cases.find(
            (c) =>
              c.id === "S06-REUSE/S01-AI-DECIDE-002/explicit-resolver/mirror",
          )!.initial_state.history,
        ).filter(
          (e) => e.event !== "cards_drawn" && e.event !== "decision_required",
        );
      }
      s.players[1 - actor]!.hand = hand;
      s.deck = s.deck.filter((i) => !hand.includes(i));
      const a = accepted(validate_state(JSON.stringify(s))).state_json;
      const swap = clone(s);
      swap.players[1 - actor]!.hand = hand.map((i) => (i === 30 ? 25 : i));
      swap.deck = swap.deck.map((i) => (i === 25 ? 30 : i));
      const b = accepted(validate_state(JSON.stringify(swap))).state_json;
      expect(observation(a, actor)).toStrictEqual(observation(b, actor));
      expect(propose(observation(a, actor))).toStrictEqual(
        propose(observation(b, actor)),
      );
    }
  for (const fixture of fixtures.cases.filter((c) =>
    c.id.startsWith("S06-REUSE/S01-AI-DECIDE-"),
  )) {
    const s = clone(fixture.initial_state),
      owner = s.active_player!;
    const old = s.pending_decision?.decision === "legit_cash" ? 27 : 31;
    const replacement = old === 27 ? 28 : 30;
    const swap = clone(s),
      change = (i: number) => (i === old ? replacement : i);
    swap.players[owner]!.hand = swap.players[owner]!.hand.map(change);
    swap.deck = swap.deck.map((i) => (i === replacement ? old : i));
    if (swap.pending_decision?.decision === "legit_cash")
      swap.pending_decision.drawn_card_id = replacement;
    if (swap.pending_decision?.decision === "draw_discard")
      swap.pending_decision.card_ids =
        swap.pending_decision.card_ids.map(change);
    for (const event of swap.history)
      if (event.event === "cards_drawn" && event.player_id === owner)
        event.card_ids = event.card_ids.map(change);
    const a = accepted(validate_state(JSON.stringify(s))).state_json,
      b = accepted(validate_state(JSON.stringify(swap))).state_json;
    expect(observation(a, 1 - owner)).toStrictEqual(observation(b, 1 - owner));
    expect(propose(observation(a, 1 - owner))).toStrictEqual({
      status: "accepted",
      command: null,
    });
  }
  const drawing = fixtures.cases.find(
    (c) => c.id === "S01-AI-DRAW-001",
  )!.initial_state;
  const reversed = clone(drawing);
  reversed.deck.reverse();
  const left = JSON.stringify(drawing),
    right = JSON.stringify(reversed);
  const decision = propose(observation(left, 1));
  expect(decision).toStrictEqual(propose(observation(right, 1)));
  if (decision.status !== "accepted" || decision.command === null)
    throw Error("draw proposal missing");
  const cmd = JSON.stringify({ player_id: 1, ...decision.command });
  const a = accepted(perform_command(left, cmd)).state_json,
    b = accepted(perform_command(right, cmd)).state_json;
  expect(observation(a, 1).view.hand).toStrictEqual([31]);
  expect(observation(b, 1).view.hand).toStrictEqual([1]);
  expect(observation(a, 0)).toStrictEqual(observation(b, 0));
});

test("S06 actual parsed observations detach every nested object and preserve prior observations across submission", () => {
  const encoded = traces[0]!.initial_state_json;
  const original = observation(encoded, 1),
    other = observation(encoded, 1),
    saved = clone(other);
  original.view.hand.reverse();
  original.view.players[0]!.active_card_ids.push(35);
  original.view.players[1]!.resources.blue = 123;
  original.legal_commands.length = 0;
  expect(other).toStrictEqual(saved);
  expect(observation(encoded, 1)).toStrictEqual(saved);
  const p = propose(other);
  if (p.status !== "accepted" || p.command === null)
    throw Error("required proposal");
  accepted(
    perform_command(encoded, JSON.stringify({ player_id: 1, ...p.command })),
  );
  expect(other).toStrictEqual(saved);
  expect(observation(encoded, 1)).toStrictEqual(saved);
});

test("S06 new codecs reject strictly and minimally; native structural duplicate control is distinct from raw JSON normalization", () => {
  const encoded = traces[0]!.initial_state_json;
  const o = observation(encoded, 1);
  const malformed = {
    status: "rejected",
    rejection: { code: "malformed_command", field: "policy_observation" },
  };
  for (const input of [
    null,
    true,
    2,
    [],
    {},
    { ...o, extra: 0 },
    { legal_commands: [] },
    { ...o, legal_commands: [{ command: "wat" }] },
    { ...o, view: { ...o.view, phase: "wat" } },
    { ...o, view: { ...o.view, hand: [36] } },
    { ...o, view: { ...o.view, draw_pile_count: -1 } },
    { ...o, view: { ...o.view, players: [...o.view.players].reverse() } },
    {
      ...o,
      view: {
        ...o.view,
        players: o.view.players.map((p) => ({
          ...p,
          resources: { ...p.resources, green: -1 },
        })),
      },
    },
    {
      ...o,
      view: {
        ...o.view,
        own_pending_decision: {
          decision: "intercept",
          attacker_id: 0,
          operator_id: 30,
          target_ids: [0],
          payment: {},
        },
      },
    },
    {
      ...o,
      legal_commands: [{ command: "cash_card", card_id: 31, color: "unknown" }],
    },
    { ...o, legal_commands: [{ command: "end_turn", player_id: 1 }] },
  ])
    expect(parse(heuristic_proposal(JSON.stringify(input)))).toStrictEqual(
      malformed,
    );
  for (const raw of ["{", ""])
    expect(parse(heuristic_proposal(raw))).toStrictEqual(malformed);
  expect(parse(heuristic_proposal(null as unknown as string))).toStrictEqual(
    malformed,
  );
  expect(
    parse(
      heuristic_proposal(
        JSON.stringify({ ...o, view: { ...o.view, player_id: 2 } }),
      ),
    ),
  ).toStrictEqual({
    status: "rejected",
    rejection: { code: "invalid_actor", field: "player_id" },
  });
  for (const actor of ["2", "null", "{}", "bad"])
    expect(parse(player_observation(encoded, actor))).toStrictEqual({
      status: "rejected",
      rejection: { code: "invalid_actor", field: "player_id" },
    });
  expect(parse(player_observation("{", "1"))).toStrictEqual({
    status: "rejected",
    rejection: { code: "malformed_state", field: "json" },
  });
  expect(
    parse(player_observation(null as unknown as string, "1")),
  ).toStrictEqual({
    status: "rejected",
    rejection: { code: "malformed_state", field: "json" },
  });
  const raw = JSON.stringify(o).replace(
    '"player_id":1',
    '"player_id":99,"player_id":1',
  );
  expect(heuristic_proposal(raw)).toBe(heuristic_proposal(JSON.stringify(o)));
  const nested = JSON.stringify(o).replace(
    '"card_id":31',
    '"card_id":35,"card_id":31',
  );
  expect(heuristic_proposal(nested)).toBe(
    heuristic_proposal(JSON.stringify(o)),
  );
  expect(
    parse(
      heuristic_proposal(
        JSON.stringify(o).replace(
          '"player_id":1',
          '"player_id":1,"player_id":"bad"',
        ),
      ),
    ),
  ).toStrictEqual(malformed);
  const forged = {
    ...o,
    legal_commands: [
      { command: "cash_card", card_id: 35, color: "black" },
      { command: "end_turn" },
    ],
  };
  // A normalized syntactically valid proposal never becomes execution authority.
  const normalized = JSON.stringify({
    player_id: 1,
    command: "cash_card",
    card_id: 35,
    color: "black",
  });
  const duplicate = normalized.replace(
    '"card_id":35',
    '"card_id":31,"card_id":35',
  );
  expect(perform_command(encoded, duplicate)).toBe(
    perform_command(encoded, normalized),
  );
  rejected(encoded, JSON.parse(normalized), "invalid_card", "card_id");
  expect(
    parse<Heuristic_proposal_result>(
      heuristic_proposal(JSON.stringify(forged)),
    ),
  ).toStrictEqual({ status: "accepted", command: { command: "end_turn" } });
});

test("S06 one proposal, missing mandatory/stop choices, opening/waiting/terminal modes and current validation", () => {
  const state = traces[0]!.initial_state_json,
    o = observation(state, 1),
    captured = propose(o);
  if (captured.status !== "accepted" || captured.command === null)
    throw Error("cash proposal missing");
  const cmd = { player_id: 1, ...captured.command };
  const after = accepted(
    perform_command(state, JSON.stringify(cmd)),
  ).state_json;
  rejected("\n" + after + "\n", cmd, "invalid_card", "card_id");
  const still = accepted(
    perform_command(
      state,
      JSON.stringify({
        player_id: 1,
        command: "cash_card",
        card_id: 4,
        color: "blue",
      }),
    ),
  ).state_json;
  expect(accepted(perform_command(still, JSON.stringify(cmd)))).toStrictEqual(
    accepted(
      perform_command(
        still,
        JSON.stringify({
          player_id: 1,
          command: "cash_card",
          card_id: 31,
          color: "blue",
        }),
      ),
    ),
  );
  const spent = accepted(
    perform_command(
      after,
      JSON.stringify({
        player_id: 1,
        command: "draw_card",
        payment: ["blue"],
        use_docks_bonus: false,
      }),
    ),
  ).state_json;
  rejected(
    spent,
    {
      player_id: 1,
      command: "activate_card",
      card_id: 4,
      wildcard_payment: null,
    },
    "insufficient_resources",
    "payment",
  );
  for (const [command, field] of [
    [{ player_id: 1, command: "unknown" }, "command"],
    [{ player_id: 1, command: "cash_card" }, "object_fields"],
    [
      { player_id: 1, command: "cash_card", card_id: 31, color: "invalid" },
      "color",
    ],
    [
      {
        player_id: 1,
        command: "draw_card",
        payment: true,
        use_docks_bonus: false,
      },
      "payment",
    ],
  ] as const)
    rejected(state, command, "malformed_command", field);
  for (const trace of traces)
    for (const step of trace.steps) {
      const command = JSON.parse(step.command_json) as Engine_command & {
        player_id: number;
      };
      if (
        step.result.status === "accepted" &&
        ["discard_draw_choice", "respond_intercept"].includes(command.command)
      )
        rejected(step.result.state_json, command, "wrong_phase", "phase");
      if (
        step.result.status === "accepted" &&
        command.command === "cash_card" &&
        step.before[command.player_id]!.observation.view.phase === "legit_cash"
      )
        rejected(
          step.result.state_json,
          command,
          step.after[command.player_id]!.observation.view.phase === "trim"
            ? "wrong_phase"
            : "invalid_card",
          step.after[command.player_id]!.observation.view.phase === "trim"
            ? "phase"
            : "card_id",
        );
    }
  rejected(state, { ...cmd, player_id: 0 }, "invalid_actor", "player_id");
  const fail = {
    status: "rejected",
    rejection: { code: "invalid_state", field: "policy_legal_commands" },
  };
  expect(propose({ ...o, legal_commands: [] })).toStrictEqual(fail);
  let mandatory = 0,
    terminal = 0;
  for (const trace of traces)
    for (const measurements of [
      trace.initial,
      ...trace.steps.map((s) => s.after),
    ])
      for (const m of measurements) {
        const v = m.observation.view;
        if (v.decision_owner === v.player_id) {
          expect(
            propose({ ...m.observation, legal_commands: [] }),
          ).toStrictEqual(fail);
          mandatory++;
        } else if (
          v.phase === "over" ||
          v.active_player !== v.player_id ||
          v.decision_owner !== null
        ) {
          expect(m.proposal).toStrictEqual({
            status: "accepted",
            command: null,
          });
          if (v.phase === "over") terminal++;
        }
      }
  expect(mandatory).toBeGreaterThan(20);
  // Real setup awaits a human opening choice; policy does not select it.
  const opening = accepted(create_session("00000001")).state_json;
  expect(propose(observation(opening, 0))).toStrictEqual({
    status: "accepted",
    command: null,
  });
  expect(propose(observation(opening, 1))).toStrictEqual({
    status: "accepted",
    command: null,
  });
  expect(terminal).toBeGreaterThan(0);
});

test("S06-V001 numeric envelope rejects before arithmetic and preserves State-produced transient edges", () => {
  const numeric = read<{
    contract_sha256: string;
    base_observation: Player_observation;
    negative_cases: {
      id: string;
      patches: Record<string, unknown>;
      expected_rejection: { code: string; field: string };
    }[];
    accepted_observations: {
      id: string;
      observation: Player_observation;
      expected_command: Engine_command | null;
    }[];
  }>("../policy/numeric.json");
  expect(numeric.contract_sha256).toBe(fixtures.contract_sha256);
  expect(numeric.negative_cases).toHaveLength(69);
  const canonical = traces[0]!.initial_state_json;
  const original = observation(canonical, 1);
  for (const record of numeric.negative_cases) {
    const input = clone(numeric.base_observation);
    for (const [path, value] of Object.entries(record.patches))
      patch(input, path, value);
    const before = JSON.stringify(input);
    expect(parse(heuristic_proposal(before)), record.id).toStrictEqual({
      status: "rejected",
      rejection: record.expected_rejection,
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(observation(canonical, 1)).toStrictEqual(original);
  }
  expect(numeric.accepted_observations).toHaveLength(7);
  for (const record of numeric.accepted_observations) {
    expect(propose(record.observation), record.id).toStrictEqual({
      status: "accepted",
      command: record.expected_command,
    });
  }
  const minimal = {
    status: "rejected",
    rejection: { code: "malformed_command", field: "policy_observation" },
  };
  const base = JSON.stringify(numeric.base_observation);
  // JSON normalization precedes the guard on both public banks.
  expect(
    parse(
      heuristic_proposal(
        base.replace('"green":0', '"green":0,"green":2147483647'),
      ),
    ),
  ).toStrictEqual(minimal);
  expect(
    heuristic_proposal(
      base.replace('"green":0', '"green":2147483647,"green":0'),
    ),
  ).toBe(heuristic_proposal(base));
  const views = traces
    .flatMap((t) => [...t.initial, ...t.steps.flatMap((s) => s.after)])
    .map((m) => m.observation.view);
  const total = (v: Player_view) =>
    Object.values(v.players[v.player_id]!.resources).reduce((a, b) => a + b, 0);
  for (const amount of [25, 26])
    expect(views.some((v) => total(v) === amount)).toBe(true);
  expect(
    views.some((v) => v.hand.length === 8 && v.phase === "draw_discard"),
  ).toBe(true);
  expect(
    views.some(
      (v) => v.draw_pile_count === 36 && v.phase === "awaiting_opening",
    ),
  ).toBe(true);
  expect(
    views.some(
      (v) =>
        v.phase === "over" &&
        v.players.some(
          (p) => Object.values(p.resources).reduce((a, b) => a + b, 0) === 12,
        ),
    ),
  ).toBe(true);
  expect(
    views.some(
      (v) =>
        v.own_pending_decision?.decision === "post_action_trim" &&
        total(v) === 12,
    ),
  ).toBe(true);
  for (const price of [1, 13])
    expect(views.some((v) => v.draw_price === price)).toBe(true);
  for (const rate of [2, 4])
    expect(views.some((v) => v.trade_rate === rate)).toBe(true);
  for (const capacity of [3, 6, 9, 12])
    expect(views.some((v) => v.distributor_capacity === capacity)).toBe(true);
  expect(views.some((v) => v.turn_number === 2147483647)).toBe(true);
  // Literal admitted arithmetic maxima: no int32 coercion can change these.
  expect(20 * 26).toBe(520);
  expect(60 + 25 * 36 + 200).toBe(1160);
  expect(13 - 0).toBe(13);
});
