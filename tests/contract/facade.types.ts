// Compile-only consumer examples. This function is never called by tests/product.
// tsc rejects every marked misuse; an accidentally broadened declaration makes
// the expected-error annotation itself fail. OCaml validates external JSON at runtime.
import * as facade from "@city-of-vice/engine";
import type {
  Engine_command,
  Engine_event,
  Engine_state,
  Setup_state,
  Pending_decision,
  Player_view,
  Policy_pending,
  Command_result,
  Legal_commands_result,
  Player_observation_result,
  Heuristic_proposal_result,
  Policy_rejected,
  Rejected,
} from "@city-of-vice/engine";

export function typed_consumer_examples(): void {
  const bank = { green: 0, blue: 0, black: 0, white: 0, yellow: 0, purple: 0 };
  const commands: Engine_command[] = [
    { command: "start_game", opening_distributor: 0 },
    { command: "collect_income" },
    { command: "draw_card", payment: ["green", "blue"], use_docks_bonus: true },
    { command: "discard_draw_choice", card_id: 31 },
    { command: "cash_card", card_id: 27, color: "white" },
    { command: "trim_resource", color: "green" },
    { command: "trade_resources", from_color: "green", to_color: "blue" },
    { command: "end_turn" },
    { command: "activate_card", card_id: 24, wildcard_payment: ["blue"] },
    { command: "activate_card", card_id: 4, wildcard_payment: null },
    { command: "use_operator", operator_id: 30, target_ids: [0, 6] },
    { command: "trade_distributors", own_card_id: 6, rival_card_id: 2 },
    { command: "respond_intercept", accept: true },
  ];
  const events: Engine_event[] = [
    { event: "game_started", turn_number: 1, active_player: 0 },
    { event: "opening_distributor_chosen", player_id: 0, card_id: 0 },
    { event: "initial_hand_dealt", player_id: 0, count: 3 },
    { event: "turn_changed", from_player: 0, to_player: 1, turn_number: 1 },
    { event: "income_collected", player_id: 0, resources: bank },
    { event: "payment_made", player_id: 0, resources: bank },
    {
      event: "crew_resource_granted",
      player_id: 0,
      crew: "Night Shift",
      color: "green",
      amount: 1,
    },
    { event: "deck_reshuffled", player_id: 0, count: 3 },
    {
      event: "cards_drawn",
      player_id: 0,
      card_ids: [31],
      source: "paid",
      price: 1,
    },
    {
      event: "cards_drawn",
      player_id: 1,
      card_ids: [27],
      source: "burbs",
      price: null,
    },
    { event: "card_discarded", player_id: 0, card_id: 31, reason: "docks" },
    {
      event: "card_cashed",
      player_id: 0,
      card_id: 27,
      color: "white",
      amount: 1,
      mandatory: true,
    },
    { event: "resource_trimmed", player_id: 0, color: "green", amount: 1 },
    {
      event: "resources_traded",
      player_id: 0,
      from_color: "green",
      to_color: "blue",
      spent: 4,
      gained: 1,
    },
    { event: "decision_required", player_id: 0, decision: "draw_discard" },
    { event: "decision_resolved", player_id: 0, decision: "post_action_trim" },
    { event: "card_activated", player_id: 0, card_id: 4 },
    { event: "crew_completed", player_id: 0, crew: "The Docks" },
    { event: "crew_lost", player_id: 1, crew: "Trailer Park" },
    {
      event: "operator_result",
      player_id: 0,
      operator_id: 30,
      target_ids: [0, 6],
      affected: [
        { card_id: 0, destination: { zone: "discard" } },
        {
          card_id: 6,
          destination: { zone: "hand", player_id: 1, suspended: false },
        },
        { card_id: 9, destination: { zone: "active", player_id: 0 } },
      ],
    },
    { event: "operator_disposed", player_id: 0, operator_id: 30 },
    {
      event: "intercept_answered",
      player_id: 1,
      operator_id: 30,
      accept: true,
    },
    {
      event: "operator_intercepted",
      attacker_id: 0,
      defender_id: 1,
      operator_id: 30,
    },
    {
      event: "distributors_traded",
      player_id: 0,
      own_card_id: 6,
      rival_card_id: 2,
    },
    { event: "game_finished", winner: 0, reason: "elimination" },
  ];
  const pending: Pending_decision[] = [
    { decision: "draw_discard", player_id: 0, card_ids: [31, 25] },
    { decision: "legit_cash", player_id: 0, drawn_card_id: 27 },
    { decision: "trim", player_id: 0 },
    { decision: "post_action_trim", player_id: 1 },
    {
      decision: "intercept",
      player_id: 1,
      attacker_id: 0,
      operator_id: 30,
      target_ids: [12],
      payment: bank,
    },
  ];
  const private_pending: Policy_pending[] = [
    { decision: "draw_discard", card_ids: [31, 25] },
    { decision: "legit_cash", drawn_card_id: 27 },
    { decision: "trim" },
    { decision: "post_action_trim" },
    {
      decision: "intercept",
      attacker_id: 0,
      operator_id: 30,
      target_ids: [12],
    },
  ];
  const setup: Setup_state = {
    schema_version: 2,
    rules_version: "prototype_4ccb197_pd002_s05_working",
    phase: "ready",
    turn_number: 1,
    active_player: 0,
    deck: [],
    discard: [],
    players: [
      {
        resources: bank,
        hand: [],
        active_card_ids: [0],
        suspended_card_ids: [],
        draw_price: 1,
        traded_distributors: false,
      },
    ],
    random_source: { algorithm: "xorshift32_v1", cursor: "00000001" },
    history: [],
    winner: null,
    win_reason: null,
    pending_decision: null,
  };
  const state: Engine_state = {
    ...setup,
    phase: "intercept",
    pending_decision: pending[4]!,
    history: events,
  };
  const view: Player_view = {
    player_id: 0,
    phase: "play",
    turn_number: 1,
    active_player: 0,
    decision_owner: null,
    winner: null,
    win_reason: null,
    players: [
      { player_id: 0, resources: bank, active_card_ids: [0], hand_count: 0 },
      { player_id: 1, resources: bank, active_card_ids: [3], hand_count: 0 },
    ],
    hand: [],
    suspended_card_ids: [],
    draw_price: 1,
    traded_distributors: false,
    resource_limit: 10,
    trade_rate: 4,
    distributor_capacity: 3,
    draw_pile_count: 32,
    discard_count: 0,
    own_pending_decision: private_pending[0]!,
  };
  const full: Rejected = {
    status: "rejected",
    state_json: " original bytes ",
    events: [],
    rejection: { code: "invalid_actor", field: "player_id" },
  };
  const minimal: Policy_rejected = {
    status: "rejected",
    rejection: { code: "malformed_command", field: "policy_observation" },
  };
  const results: Command_result[] = [
    { status: "accepted", state_json: JSON.stringify(state), events },
    full,
  ];
  const legal: Legal_commands_result = { status: "accepted", commands };
  const observed: Player_observation_result = {
    status: "accepted",
    observation: { view, legal_commands: commands },
  };
  const proposed: Heuristic_proposal_result = {
    status: "accepted",
    command: null,
  };
  const proposed_command: Heuristic_proposal_result = {
    status: "accepted",
    command: commands[0]!,
  };
  const strings: string[] = [
    facade.probe("typed"),
    facade.create_session("00000001"),
    facade.perform_command(
      JSON.stringify(state),
      JSON.stringify({ ...commands[0], player_id: 0 }),
    ),
    facade.legal_commands(JSON.stringify(state), "0"),
    facade.validate_state(JSON.stringify(state)),
    facade.player_observation(JSON.stringify(state), "0"),
    facade.heuristic_proposal(
      JSON.stringify({ view, legal_commands: commands }),
    ),
  ];
  void [results, legal, observed, proposed, proposed_command, minimal, strings];

  // @ts-expect-error probe accepts primitive strings
  facade.probe(1);
  // @ts-expect-error seed is a string
  facade.create_session(1);
  // @ts-expect-error submission has two ordinary string arguments
  facade.perform_command("{}");
  // @ts-expect-error player is JSON text
  facade.legal_commands("{}", 0);
  // @ts-expect-error full snapshots must cross as JSON strings
  facade.validate_state(state);
  // @ts-expect-error observation actor slot is JSON text
  facade.player_observation("{}", 1);
  // @ts-expect-error proposal input is serialized redacted data
  facade.heuristic_proposal({ view, legal_commands: commands });
  // @ts-expect-error activation requires explicit nullable wildcard field
  const missing: Engine_command = { command: "activate_card", card_id: 4 };
  // @ts-expect-error invalid resource enum
  const color: Engine_command = { command: "trim_resource", color: "any" };
  const targets: Engine_command = {
    command: "use_operator",
    operator_id: 30,
    // @ts-expect-error operator targets are an ordered array
    target_ids: 0,
  };
  const destination: Engine_event = {
    event: "operator_result",
    player_id: 0,
    operator_id: 30,
    target_ids: [6],
    // @ts-expect-error event payload requires Boolean suspension
    affected: [{ card_id: 6, destination: { zone: "hand", player_id: 1 } }],
  };
  const amount: Engine_event = {
    event: "resource_trimmed",
    player_id: 0,
    color: "green",
    // @ts-expect-error fixed event amount is one
    amount: 2,
  };
  // @ts-expect-error full interception needs reserved payment
  const missing_payment: Pending_decision = {
    decision: "intercept",
    player_id: 1,
    attacker_id: 0,
    operator_id: 30,
    target_ids: [12],
  };
  // @ts-expect-error private pending forms omit the owner
  const owner: Policy_pending = { decision: "trim", player_id: 0 };
  const hidden: Player_view["players"][number] = {
    player_id: 1,
    resources: bank,
    active_card_ids: [3],
    hand_count: 1,
    // @ts-expect-error redacted public players do not expose a hand
    hand: [35],
  };
  // @ts-expect-error schema version is fixed
  const version: Engine_state = { ...state, schema_version: 3 };
  // @ts-expect-error setup states have no Play phase
  const phase: Setup_state = { ...setup, phase: "play" };
  // @ts-expect-error a full rejection requires byte/null state and empty events
  const missing_state: Rejected = {
    status: "rejected",
    rejection: { code: "invalid_actor", field: "player_id" },
  };
  const echo: Policy_rejected = {
    status: "rejected",
    // @ts-expect-error minimal policy errors do not echo full state
    state_json: "secret",
    rejection: { code: "invalid_actor", field: "player_id" },
  };
  const code: Policy_rejected = {
    status: "rejected",
    // @ts-expect-error unknown error code
    rejection: { code: "game_finished", field: "phase" },
  };
  void [
    missing,
    color,
    targets,
    destination,
    amount,
    missing_payment,
    owner,
    hidden,
    version,
    phase,
    missing_state,
    echo,
    code,
  ];
}
