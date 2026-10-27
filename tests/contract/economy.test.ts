import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  create_session,
  perform_command,
  legal_commands,
  validate_state,
  type Command_result,
  type Engine_command,
  type Engine_state,
  type Rejection_code,
  type Legal_commands_result,
} from "@city-of-vice/engine";

interface Trace {
  id: string;
  initial_state_json: string;
  initial_actor: number;
  initial_legal: Engine_command[];
  steps: {
    command_json: string;
    result: Command_result;
    legal_after: Engine_command[];
  }[];
}
interface Fixture_document {
  contract_sha256: string;
  cases: { id: string; facade: boolean }[];
  invalid_states: {
    id: string;
    state: Engine_state;
    expected_code: Rejection_code;
  }[];
  valid_states: { id: string; state: Engine_state }[];
}
const read_json = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
// Actual native execution is mandatory evidence, generated before contracts by dune runtest.
const traces = read_json<Trace[]>(
  "../../_build/default/test/economy_parity.json",
);
const fixtures = read_json<Fixture_document>("../economy/scenarios.json");
const parse = (encoded: string): Command_result => {
  expect(typeof encoded).toBe("string");
  return JSON.parse(encoded) as Command_result;
};
function accepted(
  encoded: string,
): Extract<Command_result, { status: "accepted" }> {
  const result = parse(encoded);
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error(result.rejection.code);
  expect(typeof result.state_json).toBe("string");
  return result;
}
function rejected(
  encoded: string,
  original: string,
  code: Rejection_code,
): void {
  expect(parse(encoded)).toStrictEqual({
    status: "rejected",
    state_json: original,
    events: [],
    rejection: { code, field: expect.any(String) },
  });
}
const legal = (state_json: string, actor: number): Engine_command[] => {
  const result = JSON.parse(
    legal_commands(state_json, JSON.stringify(actor)),
  ) as Legal_commands_result;
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error(result.rejection.code);
  return result.commands;
};

test("all seeded S04 literal cases match actual native results and legal domains", () => {
  expect(fixtures.contract_sha256).toBe(
    "ba3427846ca231796f3cf04e56bfc88ab6e2978b0bb1bd859c37659bbfde3d09",
  );
  expect(traces.map((trace) => trace.id)).toStrictEqual(
    fixtures.cases.filter((record) => record.facade).map((record) => record.id),
  );
  const commands = new Set<string>();
  const events = new Set<string>();
  const phases = new Set<string>();
  const rejections = new Set<string>();
  for (const trace of traces) {
    let state_json = trace.initial_state_json;
    expect(
      JSON.parse(accepted(validate_state(state_json)).state_json),
      trace.id,
    ).toStrictEqual(JSON.parse(state_json));
    expect(legal(state_json, trace.initial_actor), trace.id).toStrictEqual(
      trace.initial_legal,
    );
    for (const step of trace.steps) {
      const before = state_json;
      const result = parse(perform_command(state_json, step.command_json));
      expect(result, trace.id).toStrictEqual(step.result);
      if (result.status === "accepted") {
        commands.add(
          (JSON.parse(step.command_json) as { command: string }).command,
        );
        result.events.forEach((event) => events.add(event.event));
        state_json = result.state_json;
        expect(accepted(validate_state(state_json)).state_json, trace.id).toBe(
          state_json,
        );
      } else {
        rejections.add(result.rejection.code);
        expect(result.state_json).toBe(before);
        const padded = "\n" + before + "\n";
        expect(parse(perform_command(padded, step.command_json))).toStrictEqual(
          { ...result, state_json: padded },
        );
      }
      const state = JSON.parse(state_json) as Engine_state;
      phases.add(state.phase);
      expect(legal(state_json, state.active_player!), trace.id).toStrictEqual(
        step.legal_after,
      );
      expect(
        legal(state_json, 1 - state.active_player!),
        trace.id,
      ).toStrictEqual([]);
    }
  }
  expect([...commands].sort()).toStrictEqual(
    [
      "cash_card",
      "collect_income",
      "discard_draw_choice",
      "draw_card",
      "end_turn",
      "trade_resources",
      "trim_resource",
    ].sort(),
  );
  for (const tag of [
    "turn_changed",
    "income_collected",
    "crew_resource_granted",
    "payment_made",
    "deck_reshuffled",
    "cards_drawn",
    "card_discarded",
    "card_cashed",
    "resource_trimmed",
    "resources_traded",
    "decision_required",
    "decision_resolved",
  ])
    expect(events.has(tag), tag).toBe(true);
  for (const phase of ["play", "draw_discard", "legit_cash", "trim"])
    expect(phases.has(phase), phase).toBe(true);
  for (const code of [
    "invalid_actor",
    "wrong_phase",
    "invalid_card",
    "invalid_choice",
    "hand_full",
    "resource_limit",
    "insufficient_cards",
    "invalid_payment",
    "insufficient_resources",
    "crew_unavailable",
    "invalid_state",
    "malformed_command",
  ])
    expect(rejections.has(code), code).toBe(true);
});

test("controlled history/bank/terminal admission uses the same strict codec", () => {
  for (const record of fixtures.invalid_states) {
    const encoded = "\n" + JSON.stringify(record.state) + "\n";
    rejected(validate_state(encoded), encoded, record.expected_code);
    rejected(
      perform_command(
        encoded,
        JSON.stringify({
          command: "end_turn",
          player_id: record.state.active_player,
        }),
      ),
      encoded,
      record.expected_code,
    );
  }
  for (const record of fixtures.valid_states) {
    expect(
      JSON.parse(
        accepted(validate_state(JSON.stringify(record.state))).state_json,
      ),
      record.id,
    ).toStrictEqual(record.state);
  }
  const overflow = traces.find(
    (record) => record.id === "S04-DERIVED-TURN-001/max-before-rng",
  )!;
  expect(accepted(validate_state(overflow.initial_state_json)).status).toBe(
    "accepted",
  );
  const before = "\n" + overflow.initial_state_json + "\n";
  expect(
    parse(
      perform_command(
        before,
        JSON.stringify({ command: "end_turn", player_id: 1 }),
      ),
    ),
  ).toStrictEqual({
    status: "rejected",
    state_json: before,
    events: [],
    rejection: { code: "invalid_state", field: "turn_number" },
  });
});

test("pending phase/owner/provenance and bounds cannot be forged", () => {
  const pending_states = new Map<string, Engine_state>();
  for (const trace of traces) {
    for (const step of trace.steps) {
      if (step.result.status === "accepted") {
        const state = JSON.parse(step.result.state_json) as Engine_state;
        if (state.pending_decision) pending_states.set(state.phase, state);
      }
    }
  }
  expect(pending_states.size).toBe(3);
  for (const state of pending_states.values()) {
    const owner = state.active_player!;
    const wrong_owner = structuredClone(state);
    wrong_owner.pending_decision!.player_id = 1 - owner;
    const wrong_phase = { ...state, phase: "play" };
    for (const invalid of [wrong_owner, wrong_phase]) {
      const encoded = JSON.stringify(invalid);
      rejected(validate_state(encoded), encoded, "invalid_state");
    }
    const invalid = structuredClone(state);
    const pending = invalid.pending_decision!;
    if (pending.decision === "draw_discard") {
      pending.card_ids = [pending.card_ids[0]!, pending.card_ids[0]!];
    } else if (pending.decision === "legit_cash") {
      pending.drawn_card_id = -1;
    } else {
      invalid.players[owner]!.resources = {
        green: 0,
        blue: 0,
        black: 0,
        white: 0,
        yellow: 0,
        purple: 0,
      };
    }
    const encoded = JSON.stringify(invalid);
    rejected(validate_state(encoded), encoded, "invalid_state");
  }
});

test("issue76 rejects illegal pre-draw possession and preserves both boundary continuations", () => {
  const invalid = fixtures.invalid_states.filter((record) =>
    record.id.startsWith("S04-V-001/"),
  );
  expect(invalid).toHaveLength(3);
  for (const record of invalid) {
    const encoded = "\n" + JSON.stringify(record.state) + "\n";
    rejected(validate_state(encoded), encoded, "invalid_state");
    expect(JSON.parse(legal_commands(encoded, "0"))).toStrictEqual({
      status: "rejected",
      state_json: null,
      events: [],
      rejection: { code: "invalid_state", field: expect.any(String) },
    });
    const pending = record.state.pending_decision;
    if (pending?.decision !== "draw_discard")
      throw new Error("Docks admission fixture missing two new IDs");
    for (const card_id of pending.card_ids)
      rejected(
        perform_command(
          encoded,
          JSON.stringify({
            command: "discard_draw_choice",
            player_id: 0,
            card_id,
          }),
        ),
        encoded,
        "invalid_state",
      );
  }
  const boundaries = traces.filter((trace) =>
    trace.id.startsWith("S04-V-001/"),
  );
  expect(boundaries).toHaveLength(4);
  for (const trace of boundaries) {
    let encoded = trace.initial_state_json;
    expect(accepted(validate_state(encoded)).status, trace.id).toBe("accepted");
    expect(legal(encoded, 0), trace.id).toHaveLength(2);
    for (const step of trace.steps) {
      for (const command of legal(encoded, 0)) {
        const next = accepted(
          perform_command(
            encoded,
            JSON.stringify({ ...command, player_id: 0 }),
          ),
        );
        expect(accepted(validate_state(next.state_json)).status, trace.id).toBe(
          "accepted",
        );
      }
      const result = accepted(perform_command(encoded, step.command_json));
      expect(result, trace.id).toStrictEqual(step.result);
      encoded = result.state_json;
    }
    expect((JSON.parse(encoded) as Engine_state).phase, trace.id).toBe("play");
  }
});

test("actual setup, first income and two relative handoffs preserve the protocol", () => {
  const session = accepted(create_session("00000001"));
  const ready = accepted(
    perform_command(
      session.state_json,
      JSON.stringify({
        command: "start_game",
        player_id: 0,
        opening_distributor: 0,
      }),
    ),
  );
  expect(legal(ready.state_json, 0)).toStrictEqual([
    { command: "collect_income" },
  ]);
  const forged = { ...JSON.parse(ready.state_json), phase: "play" };
  rejected(
    validate_state(JSON.stringify(forged)),
    JSON.stringify(forged),
    "invalid_state",
  );
  const collected = accepted(
    perform_command(
      ready.state_json,
      JSON.stringify({ command: "collect_income", player_id: 0 }),
    ),
  );
  const first = JSON.parse(collected.state_json) as Engine_state;
  expect(first.players[0]!.resources).toStrictEqual({
    green: 1,
    blue: 0,
    black: 0,
    white: 0,
    yellow: 0,
    purple: 0,
  });
  const handed = accepted(
    perform_command(
      collected.state_json,
      JSON.stringify({ command: "end_turn", player_id: 0 }),
    ),
  );
  const second = JSON.parse(handed.state_json) as Engine_state;
  expect([second.turn_number, second.active_player]).toStrictEqual([1, 1]);
  expect(
    Object.values(second.players[1]!.resources).reduce(
      (sum, value) => sum + value,
      0,
    ),
  ).toBe(1);
  rejected(
    perform_command(
      handed.state_json,
      JSON.stringify({ command: "collect_income", player_id: 1 }),
    ),
    handed.state_json,
    "wrong_phase",
  );
  const returned = accepted(
    perform_command(
      handed.state_json,
      JSON.stringify({ command: "end_turn", player_id: 1 }),
    ),
  );
  const third = JSON.parse(returned.state_json) as Engine_state;
  expect([
    third.turn_number,
    third.active_player,
    third.players[0]!.resources.green,
  ]).toStrictEqual([2, 0, 2]);
  const old = { ...third, rules_version: "prototype_4ccb197_pd002" };
  rejected(
    validate_state(JSON.stringify(old)),
    JSON.stringify(old),
    "unsupported_version",
  );
});

test("S04 rejects malformed external shapes and excluded wire families", () => {
  const state = traces[0]!.initial_state_json;
  for (const command of [
    { command: "collect_income", player_id: 0, extra: true },
    {
      command: "draw_card",
      player_id: 0,
      payment: "green",
      use_docks_bonus: false,
    },
    { command: "draw_card", player_id: 0, payment: [], use_docks_bonus: 1 },
    { command: "cash_card", player_id: 0, card_id: 0.5, color: "green" },
    { command: "trim_resource", player_id: 0, color: false },
    {
      command: "trade_resources",
      player_id: 0,
      from_color: "any",
      to_color: "green",
    },
    ...[
      "pay",
      "discard_card",
      "choose_crew_bonus",
      "cash_pending_legit",
      "set_turn",
    ].map((command) => ({ command, player_id: 0 })),
  ])
    rejected(
      perform_command(state, JSON.stringify(command)),
      state,
      "malformed_command",
    );
});
