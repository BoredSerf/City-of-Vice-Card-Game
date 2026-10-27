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
    rules_version: "prototype_4ccb197_pd002";
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
    | "invalid_state";

  export interface Rejected {
    status: "rejected";
    state_json: string | null;
    events: [];
    rejection: { code: Rejection_code; field: string };
  }

  /** Parsed JSON returned by session creation, command submission or validation. */
  export type Command_result =
    | { status: "accepted"; state_json: string; events: Setup_event[] }
    | Rejected;

  export type Legal_commands_result =
    { status: "accepted"; commands: Setup_command[] } | Rejected;

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
