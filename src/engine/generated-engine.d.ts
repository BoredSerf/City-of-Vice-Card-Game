/** Maintained JSON facade. OCaml interfaces own the authoritative domain types. */
declare module "@city-of-vice/engine" {
  export function probe(label: string): string;

  export type Setup_command = {
    command: "start_game";
    opening_distributor: number;
  };

  export type Setup_event =
    | { event: "game_started"; turn_number: number; active_player: number }
    | {
        event: "opening_distributor_chosen";
        player_id: number;
        card_id: number;
      }
    | { event: "initial_hand_dealt"; player_id: number; count: number };

  export type Resource_color =
    "green" | "blue" | "black" | "white" | "yellow" | "purple";
  export type Economy_command =
    | { command: "collect_income" }
    | {
        command: "draw_card";
        payment: Resource_color[];
        use_docks_bonus: boolean;
      }
    | { command: "discard_draw_choice"; card_id: number }
    | { command: "cash_card"; card_id: number; color: Resource_color }
    | { command: "trim_resource"; color: Resource_color }
    | {
        command: "trade_resources";
        from_color: Resource_color;
        to_color: Resource_color;
      }
    | { command: "end_turn" };
  export type Engine_command = Setup_command | Economy_command;
  export type Decision_kind = "draw_discard" | "legit_cash" | "trim";
  export type Pending_decision =
    | { decision: "draw_discard"; player_id: number; card_ids: number[] }
    | { decision: "legit_cash"; player_id: number; drawn_card_id: number }
    | { decision: "trim"; player_id: number };
  export type Engine_event =
    | Setup_event
    | {
        event: "turn_changed";
        from_player: number;
        to_player: number;
        turn_number: number;
      }
    | {
        event: "income_collected" | "payment_made";
        player_id: number;
        resources: Setup_player["resources"];
      }
    | {
        event: "crew_resource_granted";
        player_id: number;
        crew: "Night Shift";
        color: Resource_color;
        amount: 1;
      }
    | { event: "deck_reshuffled"; player_id: number; count: number }
    | {
        event: "cards_drawn";
        player_id: number;
        card_ids: number[];
        source: "paid" | "burbs";
        price: number | null;
      }
    | {
        event: "card_discarded";
        player_id: number;
        card_id: number;
        reason: "docks";
      }
    | {
        event: "card_cashed";
        player_id: number;
        card_id: number;
        color: Resource_color;
        amount: 1;
        mandatory: boolean;
      }
    | {
        event: "resource_trimmed";
        player_id: number;
        color: Resource_color;
        amount: 1;
      }
    | {
        event: "resources_traded";
        player_id: number;
        from_color: Resource_color;
        to_color: Resource_color;
        spent: number;
        gained: 1;
      }
    | {
        event: "decision_required" | "decision_resolved";
        player_id: number;
        decision: Decision_kind;
      };

  export interface Setup_player {
    resources: {
      green: number;
      blue: number;
      black: number;
      white: number;
      yellow: number;
      purple: number;
    };
    hand: number[];
    active_card_ids: number[];
    suspended_card_ids: number[];
    draw_price: number;
  }

  /** Trusted full snapshot; this is not a redacted player-policy view. */
  export interface Setup_state {
    schema_version: 1;
    rules_version: "prototype_4ccb197_pd002_s04_working";
    phase: "awaiting_opening" | "ready";
    turn_number: number;
    active_player: number | null;
    deck: number[];
    discard: number[];
    players: Setup_player[];
    random_source: { algorithm: "xorshift32_v1"; cursor: string };
    history: Setup_event[];
    winner: null;
    win_reason: null;
    pending_decision: null;
  }

  export type Rejection_code =
    | "invalid_seed"
    | "invalid_actor"
    | "wrong_phase"
    | "invalid_opening"
    | "malformed_command"
    | "malformed_state"
    | "unsupported_version"
    | "invalid_state"
    | "invalid_card"
    | "invalid_choice"
    | "hand_full"
    | "resource_limit"
    | "insufficient_cards"
    | "invalid_payment"
    | "insufficient_resources"
    | "crew_unavailable";

  export type Engine_state = Omit<
    Setup_state,
    "phase" | "pending_decision" | "history"
  > & {
    phase:
      Setup_state["phase"] | "play" | "draw_discard" | "legit_cash" | "trim";
    pending_decision: Pending_decision | null;
    history: Engine_event[];
  };

  export interface Rejected {
    status: "rejected";
    state_json: string | null;
    events: [];
    rejection: { code: Rejection_code; field: string };
  }

  /** Parsed JSON returned by session creation, command submission or validation. */
  export type Command_result =
    | { status: "accepted"; state_json: string; events: Engine_event[] }
    | Rejected;

  export type Legal_commands_result =
    { status: "accepted"; commands: Engine_command[] } | Rejected;

  /** Seed/cursor: exactly eight lowercase hex digits, excluding all-zero. */
  export function create_session(seed: string): string;
  /** Command JSON adds player_id to Setup_command. Rejection preserves input bytes. */
  export function perform_command(
    state_json: string,
    command_json: string,
  ): string;
  /** player_json is the serialized player ID (0 or 1). */
  export function legal_commands(
    state_json: string,
    player_json: string,
  ): string;
  /** Validates this slice's modular snapshot only; no storage or legacy migration. */
  export function validate_state(state_json: string): string;
}
