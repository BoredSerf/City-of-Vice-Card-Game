type phase =
  | Awaiting_opening
  | Ready
  | Play
  | Draw_discard
  | Legit_cash
  | Trim
  | Intercept
  | Over

type win_reason = Elimination | Expansion

type public_player = {
  player_id : int;
  resources : Resource_bank.t;
  active_card_ids : int list;
  hand_count : int;
}

type pending =
  | Draw_choice of int list
  | Cash_legit of int
  | Trim_bank
  | Post_action_trim
  | Interception of {
      attacker_id : int;
      operator_id : int;
      target_ids : int list;
    }

type t = {
  player_id : int;
  phase : phase;
  turn_number : int;
  active_player : int option;
  decision_owner : int option;
  winner : int option;
  win_reason : win_reason option;
  players : public_player list;
  hand : int list;
  suspended_card_ids : int list;
  draw_price : int;
  traded_distributors : bool;
  resource_limit : int;
  trade_rate : int;
  distributor_capacity : int;
  draw_pile_count : int;
  discard_count : int;
  own_pending_decision : pending option;
}

type observation = { view : t; legal_commands : Command.t list }

val validate : t -> (unit, Command.rejection) result

val observe :
  State.t -> player_id:int -> (observation, Command.rejection) result

val observation_to_value : observation -> Wire_value.t

val observation_of_value :
  Wire_value.t -> (observation, Command.rejection) result
