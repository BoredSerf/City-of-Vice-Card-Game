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
  type Legal_commands_result,
  type Rejection_code,
} from "@city-of-vice/engine";

interface Trace {
  id: string;
  initial_state_json: string;
  initial_legal_by_player: Engine_command[][];
  steps: {
    command_json: string;
    result: Command_result;
    legal_after_by_player: Engine_command[][];
  }[];
}
interface Fixture_document {
  contract_sha256: string;
  cases: { id: string }[];
  invalid_states: {
    id: string;
    state: Engine_state;
    expected_code: Rejection_code;
    expected_field: string;
  }[];
}
const read_json = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
// Required native evidence: a missing file fails the suite rather than skipping.
const traces = read_json<Trace[]>(
  "../../_build/default/test/effects_parity.json",
);
const fixtures = read_json<Fixture_document>("../effects/scenarios.json");
const parse = (encoded: string): Command_result => {
  expect(typeof encoded).toBe("string");
  return JSON.parse(encoded) as Command_result;
};
const accepted = (
  encoded: string,
): Extract<Command_result, { status: "accepted" }> => {
  const result = parse(encoded);
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted")
    throw new Error(JSON.stringify(result.rejection));
  return result;
};
function rejected(
  encoded: string,
  original: string,
  code: Rejection_code,
  field: string | ReturnType<typeof expect.any> = expect.any(String),
): void {
  expect(parse(encoded)).toStrictEqual({
    status: "rejected",
    state_json: original,
    events: [],
    rejection: { code, field },
  });
}
const legal = (encoded: string, actor: number): Engine_command[] => {
  const result = JSON.parse(
    legal_commands(encoded, JSON.stringify(actor)),
  ) as Legal_commands_result;
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error(result.rejection.code);
  return result.commands;
};
const new_commands = new Set([
  "activate_card",
  "use_operator",
  "trade_distributors",
  "respond_intercept",
]);

function check_both(
  encoded: string,
  expected: Engine_command[][],
  label: string,
): void {
  expect(expected, label).toHaveLength(2);
  const before = JSON.parse(encoded) as Engine_state;
  expect(accepted(validate_state(encoded)).state_json, label).toBe(encoded);
  for (const actor of [0, 1]) {
    const commands = legal(encoded, actor);
    expect(commands, label).toStrictEqual(expected[actor]);
    for (const command of commands) {
      const next = accepted(
        perform_command(
          encoded,
          JSON.stringify({ ...command, player_id: actor }),
        ),
      );
      expect(accepted(validate_state(next.state_json)).state_json, label).toBe(
        next.state_json,
      );
      if (new_commands.has(command.command))
        expect(
          (JSON.parse(next.state_json) as Engine_state).random_source,
          label,
        ).toStrictEqual(before.random_source);
    }
  }
}

test("S05 literal effects, both actors and every advertised continuation match actual native output", () => {
  expect(fixtures.contract_sha256).toBe(
    "cc71b5a8769320e40952c58876ab04c0d8a17310b8c8c646df0946e9276b7876",
  );
  expect(traces.map((x) => x.id)).toStrictEqual(
    fixtures.cases.map((x) => x.id),
  );
  const inspected = new Set<string>();
  const events = new Set<string>();
  const commands = new Set<string>();
  const phases = new Set<string>();
  const inspect = (
    encoded: string,
    choices: Engine_command[][],
    label: string,
  ) => {
    if (!inspected.has(encoded)) {
      inspected.add(encoded);
      check_both(encoded, choices, label);
    }
  };
  for (const trace of traces) {
    let encoded = trace.initial_state_json;
    inspect(encoded, trace.initial_legal_by_player, trace.id);
    for (const step of trace.steps) {
      const original = encoded;
      const command = JSON.parse(step.command_json) as Engine_command & {
        player_id: number;
      };
      const result = parse(perform_command(encoded, step.command_json));
      expect(result, trace.id).toStrictEqual(step.result);
      if (result.status === "accepted") {
        commands.add(command.command);
        result.events.forEach((event) => events.add(event.event));
        encoded = result.state_json;
        if (new_commands.has(command.command))
          expect(
            (JSON.parse(encoded) as Engine_state).random_source,
            trace.id,
          ).toStrictEqual((JSON.parse(original) as Engine_state).random_source);
      } else {
        expect(result.state_json, trace.id).toBe(original);
        const padded = "\n" + original + "\n";
        expect(
          parse(perform_command(padded, step.command_json)),
          trace.id,
        ).toStrictEqual({ ...result, state_json: padded });
      }
      phases.add((JSON.parse(encoded) as Engine_state).phase);
      inspect(encoded, step.legal_after_by_player, trace.id);
    }
  }
  for (const tag of new_commands) expect(commands.has(tag), tag).toBe(true);
  for (const tag of [
    "card_activated",
    "crew_completed",
    "crew_lost",
    "operator_result",
    "operator_disposed",
    "intercept_answered",
    "operator_intercepted",
    "distributors_traded",
    "game_finished",
  ])
    expect(events.has(tag), tag).toBe(true);
  for (const phase of ["intercept", "trim", "over"])
    expect(phases.has(phase), phase).toBe(true);
});

test("S05 semantic snapshot failures include all six preserved invalid originals", () => {
  const source_fields = new Map([
    ["S01-CAPACITY-001", "distributor_capacity"],
    ["S01-CAPACITY-002", "distributor_capacity"],
    ["S01-OPERATOR-LIMIT-001", "operator_limit"],
    ["S01-LIMIT-004", "legit_possession"],
    ["S01-REJECT-003", "outcome"],
    ["S01-REJECT-001", "ready"],
  ]);
  for (const [id, field] of source_fields) {
    const record = fixtures.invalid_states.find((x) => x.id === id)!;
    expect(record.expected_code, id).toBe("invalid_state");
    expect(record.expected_field, id).toBe(field);
    expect(record.state.schema_version, id).toBe(2);
    expect(record.state.rules_version, id).toBe(
      "prototype_4ccb197_pd002_s05_working",
    );
  }
  for (const record of fixtures.invalid_states) {
    const encoded = "\n" + JSON.stringify(record.state) + "\n";
    rejected(
      validate_state(encoded),
      encoded,
      record.expected_code,
      record.expected_field,
    );
    rejected(
      perform_command(
        encoded,
        JSON.stringify({
          player_id: record.state.active_player,
          command: "activate_card",
          card_id: 1,
          wildcard_payment: null,
        }),
      ),
      encoded,
      record.expected_code,
      record.expected_field,
    );
    expect(JSON.parse(legal_commands(encoded, "0")), record.id).toStrictEqual({
      status: "rejected",
      state_json: null,
      events: [],
      rejection: { code: record.expected_code, field: record.expected_field },
    });
  }
});

test("valid final outcomes reject all twelve command families without changing bytes or facts", () => {
  const terminals = new Set<string>();
  for (const trace of traces)
    for (const step of trace.steps)
      if (
        step.result.status === "accepted" &&
        (JSON.parse(step.result.state_json) as Engine_state).phase === "over"
      )
        terminals.add(step.result.state_json);
  const commands: Engine_command[] = [
    { command: "start_game", opening_distributor: 0 },
    { command: "collect_income" },
    { command: "draw_card", payment: [], use_docks_bonus: false },
    { command: "discard_draw_choice", card_id: 0 },
    { command: "cash_card", card_id: 0, color: "green" },
    { command: "trim_resource", color: "green" },
    { command: "trade_resources", from_color: "green", to_color: "blue" },
    { command: "end_turn" },
    { command: "activate_card", card_id: 0, wildcard_payment: null },
    { command: "use_operator", operator_id: 30, target_ids: [0] },
    { command: "trade_distributors", own_card_id: 0, rival_card_id: 1 },
    { command: "respond_intercept", accept: true },
  ];
  const outcomes = new Set<string>();
  for (const terminal of terminals) {
    const state = JSON.parse(terminal) as Engine_state;
    outcomes.add(state.winner + ":" + state.win_reason);
    const encoded = "\n" + terminal + "\n";
    for (const player_id of [0, 1]) {
      expect(legal(terminal, player_id)).toStrictEqual([]);
      for (const command of commands)
        rejected(
          perform_command(encoded, JSON.stringify({ ...command, player_id })),
          encoded,
          "game_over",
          "phase",
        );
    }
    rejected(
      perform_command(
        encoded,
        JSON.stringify({ command: "end_turn", player_id: 2 }),
      ),
      encoded,
      "invalid_actor",
      "player_id",
    );
  }
  expect([...outcomes].sort()).toStrictEqual([
    "0:elimination",
    "0:expansion",
    "1:elimination",
    "1:expansion",
  ]);
});

test("S05 keeps actual initial Ready strict and rejects old layouts and malformed new commands", () => {
  const session = accepted(create_session("00000001"));
  const ready = accepted(
    perform_command(
      session.state_json,
      JSON.stringify({
        player_id: 0,
        command: "start_game",
        opening_distributor: 0,
      }),
    ),
  );
  const state = JSON.parse(ready.state_json) as Engine_state;
  expect(state.players.map((x) => x.traded_distributors)).toStrictEqual([
    false,
    false,
  ]);
  rejected(
    perform_command(
      ready.state_json,
      JSON.stringify({
        player_id: 0,
        command: "activate_card",
        card_id: state.players[0]!.hand[0],
        wildcard_payment: null,
      }),
    ),
    ready.state_json,
    "wrong_phase",
    "phase",
  );
  for (const rules of [
    "prototype_4ccb197_pd002",
    "prototype_4ccb197_pd002_s04_working",
  ]) {
    const encoded = JSON.stringify({
      ...state,
      schema_version: 1,
      rules_version: rules,
    });
    rejected(
      validate_state(encoded),
      encoded,
      "unsupported_version",
      "version",
    );
  }
  const play = traces.find(
    (x) => x.id === "S01-ACTIVATE-001",
  )!.initial_state_json;
  for (const command of [
    { command: "activate_card", player_id: 0, card_id: 1 },
    {
      command: "activate_card",
      player_id: 0,
      card_id: 1,
      wildcard_payment: "blue",
    },
    {
      command: "activate_card",
      player_id: 0,
      card_id: 1,
      wildcard_payment: ["any"],
    },
    {
      command: "activate_card",
      player_id: 0,
      card_id: 1.5,
      wildcard_payment: null,
    },
    { command: "use_operator", player_id: 0, operator_id: 30, target_ids: 6 },
    {
      command: "use_operator",
      player_id: 0,
      operator_id: 30,
      target_ids: [6],
      wildcard_payment: null,
    },
    {
      command: "trade_distributors",
      player_id: 0,
      own_card_id: 0,
      rival_card_id: false,
    },
    { command: "respond_intercept", player_id: 1, accept: "yes" },
    { command: "respond_intercept", player_id: 1, accept: true, extra: true },
    ...["repair", "check_win", "pay", "cancel_attack"].map((command) => ({
      command,
      player_id: 0,
    })),
  ])
    rejected(
      perform_command(play, JSON.stringify(command)),
      play,
      "malformed_command",
    );
});
