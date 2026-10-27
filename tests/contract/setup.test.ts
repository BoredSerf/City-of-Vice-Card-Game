import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  create_session,
  perform_command,
  legal_commands,
  validate_state,
  type Command_result,
  type Legal_commands_result,
  type Rejection_code,
  type Setup_command,
  type Setup_event,
  type Setup_state,
} from "@city-of-vice/engine";

interface Native_case {
  seed: string;
  opening_distributor: number;
  initial_state: Setup_state;
  state: Setup_state;
  events: Setup_event[];
}

function read_native_cases(path: URL): Native_case[] {
  return JSON.parse(readFileSync(path, "utf8")) as Native_case[];
}

// Produced by a native executable under dune runtest, before this suite in npm test.
// Missing native evidence is a real failure, never a skipped comparison.
const native_cases = read_native_cases(
  new URL("../../_build/default/test/setup_parity.json", import.meta.url),
);

function result(encoded: string): Command_result {
  expect(typeof encoded).toBe("string");
  return JSON.parse(encoded) as Command_result;
}

function accepted(
  encoded: string,
): Extract<Command_result, { status: "accepted" }> {
  const decoded = result(encoded);
  expect(decoded.status).toBe("accepted");
  if (decoded.status !== "accepted") throw new Error(decoded.rejection.code);
  expect(Object.keys(decoded).sort()).toStrictEqual([
    "events",
    "state_json",
    "status",
  ]);
  expect(typeof decoded.state_json).toBe("string");
  expect(Array.isArray(decoded.events)).toBe(true);
  return decoded;
}

function rejected(
  encoded: string,
  state_json: string | null,
  code: Rejection_code,
): void {
  expect(result(encoded)).toStrictEqual({
    status: "rejected",
    state_json,
    events: [],
    rejection: { code, field: expect.any(String) },
  });
}

function submit(
  state_json: string,
  opening_distributor: number,
  player_id = 0,
) {
  const command: Setup_command & { player_id: number } = {
    command: "start_game",
    opening_distributor,
    player_id,
  };
  return perform_command(state_json, JSON.stringify(command));
}

test("120 seeded openings match native state, events and 36-step RNG vectors", () => {
  expect(native_cases).toHaveLength(120);
  expect(new Set(native_cases.map((value) => value.seed)).size).toBe(5);
  for (const fixture of native_cases) {
    const initial = accepted(create_session(fixture.seed));
    expect(JSON.parse(initial.state_json)).toStrictEqual(fixture.initial_state);
    expect(initial.events).toStrictEqual([]);
    const first = accepted(
      submit(initial.state_json, fixture.opening_distributor),
    );
    const second = accepted(
      submit(initial.state_json, fixture.opening_distributor),
    );
    expect(first).toStrictEqual(second);
    const state = JSON.parse(first.state_json) as Setup_state;
    expect(state).toStrictEqual(fixture.state);
    expect(first.events).toStrictEqual(fixture.events);
    expect(state.random_source).toStrictEqual(fixture.state.random_source);
    expect(state.history).toStrictEqual(first.events);
    expect(state.phase).toBe("ready");
    const all_ids = [
      ...state.deck,
      ...state.discard,
      ...state.players.flatMap((player) => [
        ...player.hand,
        ...player.active_card_ids,
      ]),
    ];
    expect(all_ids.sort((left, right) => left - right)).toStrictEqual(
      Array.from({ length: 36 }, (_, id) => id),
    );
    expect(accepted(validate_state(first.state_json)).state_json).toBe(
      first.state_json,
    );
  }
});

test("legal discovery offers only executable setup commands", () => {
  const initial = accepted(create_session("00000001")).state_json;
  const available = JSON.parse(
    legal_commands(initial, "0"),
  ) as Legal_commands_result;
  expect(available.status).toBe("accepted");
  if (available.status !== "accepted") throw new Error("discovery failed");
  expect(available.commands).toStrictEqual(
    Array.from({ length: 24 }, (_, opening_distributor) => ({
      command: "start_game",
      opening_distributor,
    })),
  );
  expect(JSON.parse(legal_commands(initial, "1"))).toStrictEqual({
    status: "accepted",
    commands: [],
  });
  for (const command of available.commands) {
    const started = accepted(
      perform_command(initial, JSON.stringify({ ...command, player_id: 0 })),
    );
    for (const player of [0, 1]) {
      expect(
        JSON.parse(legal_commands(started.state_json, String(player))),
      ).toStrictEqual({
        status: "accepted",
        commands: player === 0 ? [{ command: "collect_income" }] : [],
      });
    }
  }
  rejected(legal_commands(initial, "1.5"), null, "invalid_actor");
  rejected(legal_commands(initial, "2"), null, "invalid_actor");
});

test("S01-SETUP-002 approved correction and rejection matrix preserve bytes/RNG", () => {
  const parity = JSON.parse(
    readFileSync(
      new URL(
        "../characterization/public_command_parity.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    golden_scenarios: {
      id: string;
      steps: {
        command: string;
        args: number[];
        expected: { result: string; serialized_state: string };
      }[];
    }[];
  };
  const golden = parity.golden_scenarios.find(
    (scenario) => scenario.id === "S01-SETUP-002",
  );
  expect(golden).toBeDefined();
  // Noncanonical whitespace is preserved byte-for-byte by all rejected commands.
  const initial = "\n" + accepted(create_session("ffffffff")).state_json + "\n";
  for (const step of golden!.steps) {
    expect(step.command).toBe("start_game");
    expect(step.expected).toStrictEqual({
      result: "typed_rejection",
      serialized_state: "unchanged",
    });
    rejected(submit(initial, step.args[0]!), initial, "invalid_opening");
  }
  for (const opening of [-1, 24, 29, 30, 35, 36, 2147483647]) {
    rejected(submit(initial, opening), initial, "invalid_opening");
  }
  for (const player of [-1, 1, 2]) {
    rejected(submit(initial, 0, player), initial, "invalid_actor");
  }
  const started = accepted(submit(initial, 0)).state_json;
  rejected(submit(started, 0), started, "wrong_phase");
  for (const command of [
    "{",
    "null",
    "[]",
    "{}",
    '{"command":"end_turn","player_id":0,"opening_distributor":0}',
    '{"command":"start_game","player_id":0.5,"opening_distributor":0}',
    '{"command":"start_game","player_id":0,"opening_distributor":0.5}',
    '{"command":"start_game","player_id":0,"opening_distributor":0,"extra":true}',
  ]) {
    rejected(perform_command(initial, command), initial, "malformed_command");
  }
  rejected(
    perform_command(initial, 0 as unknown as string),
    initial,
    "malformed_command",
  );
  expect(accepted(submit(initial, 0)).state_json).toBe(started);
});

test("malformed, unsupported and impossible snapshots fail typed validation", () => {
  const original = accepted(create_session("12345678")).state_json;
  const started = accepted(submit(original, 0)).state_json;
  const state = JSON.parse(started) as Setup_state;
  const duplicate_name = '{"schema_version":999,' + started.slice(1);
  expect(accepted(validate_state(duplicate_name)).state_json).toBe(started);
  for (const malformed of ["{", "null", "[]", "{}", "true"]) {
    rejected(validate_state(malformed), malformed, "malformed_state");
    rejected(submit(malformed, 0), malformed, "malformed_state");
  }
  for (const invalid of [
    { ...state, schema_version: state.schema_version + 1 },
    { ...state, rules_version: "unknown" },
    { ...state, random_source: { algorithm: "other", cursor: "12345678" } },
  ]) {
    const encoded = JSON.stringify(invalid);
    rejected(validate_state(encoded), encoded, "unsupported_version");
  }
  for (const invalid of [
    { ...state, deck: [] },
    { ...state, phase: "play" },
    { ...state, deck: [0, ...state.deck] },
    { ...state, active_player: 1 },
    { ...state, history: [] },
    { ...state, turn_number: 2 },
    { ...state, players: [] },
    { ...state, discard: [99] },
    { ...state, phase: "over" },
    {
      ...state,
      players: state.players.map((player) => ({
        ...player,
        resources: { ...player.resources, green: -1 },
      })),
    },
  ]) {
    const encoded = JSON.stringify(invalid);
    rejected(validate_state(encoded), encoded, "invalid_state");
  }
  for (const invalid of [
    { ...state, winner: 0 },
    { ...state, pending_decision: {} },
    { ...state, turn_number: 0.5 },
    { ...state, turn_number: 2147483648 },
    {
      ...state,
      random_source: { algorithm: "xorshift32_v1", cursor: "00000000" },
    },
    { ...state, extra: true },
  ]) {
    const encoded = JSON.stringify(invalid);
    rejected(validate_state(encoded), encoded, "malformed_state");
  }
  for (const invalid_seed of ["", "0", "00000000", "FFFFFFFF", "0000000g"]) {
    rejected(create_session(invalid_seed), null, "invalid_seed");
  }
  rejected(create_session(1 as unknown as string), null, "invalid_seed");
  rejected(validate_state({} as unknown as string), null, "malformed_state");
  expect(accepted(validate_state(started)).state_json).toBe(started);
});

test("missing native parity evidence fails rather than skipping", () => {
  expect(() =>
    read_native_cases(new URL("missing-native-fixture.json", import.meta.url)),
  ).toThrow();
});
