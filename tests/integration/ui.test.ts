import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  player_observation,
  type Engine_command,
  type Engine_event,
  type Engine_state,
  type Player_observation_result,
} from "@city-of-vice/engine";
import {
  command_fields,
  matching_commands,
  next_choices,
  action_names,
} from "../../src/ui/choices.ts";
import { visible_facts, outcome_text } from "../../src/ui/narration.ts";
import { card_description } from "../../src/ui/catalog.ts";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
test("S09-U01 complete offered alternatives retain named payments, modes, colors, ordered targets and pairs", () => {
  const offered: Engine_command[] = [
    { command: "start_game", opening_distributor: 0 },
    { command: "collect_income" },
    { command: "end_turn" },
    { command: "activate_card", card_id: 24, wildcard_payment: ["blue"] },
    { command: "activate_card", card_id: 24, wildcard_payment: ["purple"] },
    { command: "activate_card", card_id: 8, wildcard_payment: null },
    { command: "cash_card", card_id: 25, color: "green" },
    { command: "cash_card", card_id: 25, color: "blue" },
    {
      command: "draw_card",
      payment: ["blue", "green"],
      use_docks_bonus: false,
    },
    { command: "draw_card", payment: ["green", "blue"], use_docks_bonus: true },
    { command: "discard_draw_choice", card_id: 31 },
    { command: "trim_resource", color: "purple" },
    { command: "trade_resources", from_color: "blue", to_color: "green" },
    { command: "use_operator", operator_id: 34, target_ids: [6, 9] },
    { command: "use_operator", operator_id: 34, target_ids: [9, 6] },
    { command: "use_operator", operator_id: 34, target_ids: [6] },
    { command: "trade_distributors", own_card_id: 0, rival_card_id: 3 },
    { command: "respond_intercept", accept: true },
    { command: "respond_intercept", accept: false },
  ];
  expect(new Set(offered.map((command) => command.command)).size).toBe(12);
  expect(
    next_choices(offered, "activate_card", ["24"]).map((field) => field.text),
  ).toEqual(["Blue", "Purple"]);
  expect(
    next_choices(offered, "draw_card", []).map((field) => field.text),
  ).toEqual(["Ordinary draw", "Docks bonus draw"]);
  expect(command_fields(offered[8]!)).toEqual([
    { label: "Draw mode", value: "false", text: "Ordinary draw" },
    { label: "Draw payment", value: "blue/green", text: "Blue + Green" },
  ]);
  expect(
    next_choices(offered, "use_operator", ["34", "6"]).map(
      (field) => field.text,
    ),
  ).toEqual(["Nero Lombardy", "No second target"]);
  expect(
    next_choices(offered, "use_operator", ["34", "9"]).map(
      (field) => field.text,
    ),
  ).toEqual(["Velvet Zizek"]);
  expect(
    next_choices(offered, "respond_intercept", []).map((field) => field.text),
  ).toEqual(["Accept", "Decline"]);
  expect(matching_commands(offered, "use_operator", ["34", "6", "9"])).toEqual([
    offered[13],
  ]);
  expect(card_description(8)).toBe(
    "Clover Gaines · Front Porch · Green · Distributor · Trailer Park. Printed activation cost: Green.",
  );
  expect(card_description(30)).toContain("Operator");
  expect(card_description(30)).not.toContain("free");
});

test("S09-U02 every actual offered value remains reachable at all literal phase/owner boundaries", () => {
  type Step = {
    expected_changes: Record<string, unknown>;
    expected_events: Engine_event[];
    expected_rejection?: unknown;
  };
  const fixture = read<{
    cases: { initial_state: Engine_state; steps: Step[] }[];
    numeric_cases: { initial_state: Engine_state; steps: Step[] }[];
  }>("../policy/scenarios.json");
  const families = new Set<string>(),
    phases = new Set<string>(),
    owners = new Set<number>(),
    pending = new Set<string>();
  let alternatives = 0;
  for (const entry of [...fixture.cases, ...fixture.numeric_cases]) {
    const state = structuredClone(entry.initial_state);
    for (let index = 0; index <= entry.steps.length; index++) {
      const measured = JSON.parse(
        player_observation(JSON.stringify(state), "0"),
      ) as Player_observation_result;
      if (measured.status !== "accepted")
        throw Error("Required fixture observation unavailable");
      const offered = measured.observation.legal_commands,
        before = structuredClone(offered);
      phases.add(state.phase);
      if (state.pending_decision) {
        pending.add(state.pending_decision.decision);
        owners.add(state.pending_decision.player_id);
      }
      for (const command of offered) {
        families.add(command.command);
        expect(action_names[command.command]).toBeTruthy();
        const fields = command_fields(command),
          prefix: string[] = [];
        for (const field of fields) {
          expect(next_choices(offered, command.command, prefix)).toContainEqual(
            field,
          );
          prefix.push(field.value);
        }
        expect(matching_commands(offered, command.command, prefix)).toContain(
          command,
        );
        expect(
          new Set(
            matching_commands(offered, command.command, prefix).map((value) =>
              JSON.stringify(value),
            ),
          ).size,
        ).toBe(1);
        alternatives++;
      }
      expect(offered).toEqual(before);
      const step = entry.steps[index];
      if (step && !step.expected_rejection) {
        for (const [path, value] of Object.entries(step.expected_changes)) {
          const keys = path.split(".");
          let target = state as unknown as Record<string, unknown>;
          for (const key of keys.slice(0, -1))
            target = target[key] as Record<string, unknown>;
          target[keys.at(-1)!] = structuredClone(value);
        }
        state.history.push(...structuredClone(step.expected_events));
      }
    }
  }
  expect([...families].sort()).toEqual(Object.keys(action_names).sort());
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
  expect([...pending].sort()).toEqual([
    "draw_discard",
    "intercept",
    "legit_cash",
    "post_action_trim",
    "trim",
  ]);
  expect([...owners].sort()).toEqual([0, 1]);
  expect(alternatives).toBeGreaterThan(0);
});

test("S09-U03 all24 actor/field event mappings, actual destinations and hidden rival draw masking have literal visible expectations", () => {
  const bank = { green: 2, blue: 0, black: 0, white: 0, yellow: 0, purple: 0 };
  const cases: [Engine_event, string[]][] = [
    [
      { event: "game_started", turn_number: 1, active_player: 0 },
      ["Game started · turn 1, You are active."],
    ],
    [
      { event: "opening_distributor_chosen", player_id: 0, card_id: 0 },
      ["You opened with Ishmael Kelp."],
    ],
    [
      { event: "initial_hand_dealt", player_id: 1, count: 3 },
      ["Rival received 3 initial cards."],
    ],
    [
      { event: "turn_changed", from_player: 0, to_player: 1, turn_number: 2 },
      ["Turn 2: You handed over to Rival."],
    ],
    [
      { event: "income_collected", player_id: 0, resources: bank },
      ["You collected 2 Green."],
    ],
    [
      { event: "payment_made", player_id: 1, resources: bank },
      ["Rival paid 2 Green."],
    ],
    [
      {
        event: "crew_resource_granted",
        player_id: 0,
        crew: "Night Shift",
        color: "purple",
        amount: 1,
      },
      ["You gained 1 Purple from Night Shift."],
    ],
    [
      { event: "resource_trimmed", player_id: 1, color: "blue", amount: 1 },
      ["Rival trimmed 1 Blue."],
    ],
    [
      {
        event: "resources_traded",
        player_id: 0,
        from_color: "green",
        to_color: "blue",
        spent: 2,
        gained: 1,
      },
      ["You traded 2 Green for 1 Blue."],
    ],
    [
      { event: "deck_reshuffled", player_id: 1, count: 4 },
      ["Rival reshuffled 4 cards."],
    ],
    [
      {
        event: "cards_drawn",
        player_id: 0,
        card_ids: [0, 31],
        source: "paid",
        price: 2,
      },
      ["You drew Ishmael Kelp, Ellis Voss (2 cards; paid; price 2)."],
    ],
    [
      {
        event: "cards_drawn",
        player_id: 1,
        card_ids: [0, 31],
        source: "paid",
        price: 2,
      },
      ["Rival drew 2 cards (paid; price 2)."],
    ],
    [
      { event: "card_discarded", player_id: 1, card_id: 31, reason: "docks" },
      ["Rival discarded Ellis Voss for docks."],
    ],
    [
      {
        event: "card_cashed",
        player_id: 1,
        card_id: 25,
        color: "blue",
        amount: 1,
        mandatory: true,
      },
      ["Rival cashed Auto Shop for 1 Blue (required choice)."],
    ],
    [
      { event: "card_activated", player_id: 0, card_id: 8 },
      ["You activated Clover Gaines."],
    ],
    [
      { event: "crew_completed", player_id: 0, crew: "Trailer Park" },
      ["You completed Trailer Park."],
    ],
    [
      { event: "crew_lost", player_id: 1, crew: "Night Shift" },
      ["Rival lost Night Shift."],
    ],
    [
      { event: "decision_required", player_id: 1, decision: "intercept" },
      ["Rival must answer the Pipeline offer."],
    ],
    [
      { event: "decision_resolved", player_id: 0, decision: "trim" },
      ["You completed the choice: trim resources."],
    ],
    [
      {
        event: "operator_result",
        player_id: 1,
        operator_id: 30,
        target_ids: [0],
        affected: [{ card_id: 0, destination: { zone: "discard" } }],
      },
      [
        "Rival used Wade Haskett on Ishmael Kelp.",
        "Ishmael Kelp went to discard.",
      ],
    ],
    [
      { event: "operator_disposed", player_id: 1, operator_id: 30 },
      ["Rival disposed of Wade Haskett."],
    ],
    [
      {
        event: "intercept_answered",
        player_id: 0,
        operator_id: 30,
        accept: false,
      },
      ["You declined the Pipeline offer for Wade Haskett."],
    ],
    [
      {
        event: "operator_intercepted",
        attacker_id: 0,
        defender_id: 1,
        operator_id: 30,
      },
      ["Rival intercepted your Wade Haskett."],
    ],
    [
      {
        event: "distributors_traded",
        player_id: 0,
        own_card_id: 0,
        rival_card_id: 3,
      },
      ["You traded Ishmael Kelp for Fizzy Sparks."],
    ],
    [
      { event: "game_finished", winner: 0, reason: "expansion" },
      ["Victory · You won by twelve businesses."],
    ],
  ];
  expect(new Set(cases.map(([event]) => event.event)).size).toBe(24);
  for (const [event, facts] of cases)
    expect(visible_facts(event)).toEqual(facts);
  for (const [destination, expected] of [
    [{ zone: "active", player_id: 0 }, "Ishmael Kelp became active for You."],
    [
      { zone: "hand", player_id: 1, suspended: true },
      "Ishmael Kelp went to the rival's hand (suspended).",
    ],
    [
      { zone: "hand", player_id: 0, suspended: false },
      "Ishmael Kelp went to your hand.",
    ],
  ] as const)
    expect(
      visible_facts({
        event: "operator_result",
        player_id: 1,
        operator_id: 30,
        target_ids: [0],
        affected: [{ card_id: 0, destination }],
      })[1],
    ).toBe(expected);
  expect(
    visible_facts({
      event: "cards_drawn",
      player_id: 1,
      card_ids: [35, 34],
      source: "paid",
      price: 2,
    }),
  ).toEqual(
    visible_facts({
      event: "cards_drawn",
      player_id: 1,
      card_ids: [0, 31],
      source: "paid",
      price: 2,
    }),
  );
  expect(outcome_text(1, "elimination")).toBe(
    "Defeat · Rival won by elimination.",
  );
  expect(() =>
    visible_facts({
      event: "unknown",
      private_secret: "do not render",
    } as unknown as Engine_event),
  ).toThrow("Unknown integration event");
});
