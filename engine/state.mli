type phase =
  | Awaiting_opening
  | Ready
  | Play
  | Draw_discard
  | Legit_cash
  | Trim

type resources = Resource_bank.t = {
  green : int;
  blue : int;
  black : int;
  white : int;
  yellow : int;
  purple : int;
}

type player = {
  resources : resources;
  hand : int list;
  active_card_ids : int list;
  suspended_card_ids : int list;
  draw_price : int;
}

type pending_decision =
  | Pending_draw_discard of { player_id : int; card_ids : int list }
  | Pending_legit_cash of { player_id : int; drawn_card_id : int }
  | Pending_trim of { player_id : int }

type snapshot = {
  schema_version : int;
  rules_version : string;
  phase : phase;
  turn_number : int;
  active_player : int option;
  deck : int list;
  discard : int list;
  players : player list;
  random_source : Random_source.t;
  history : Event.t list;
  pending_decision : pending_decision option;
}

type t

val schema_version : int
val rules_version : string
val zero_resources : resources
val empty_player : player
val has_crew : player -> Cards.crew -> bool
val resource_limit : player -> int
val trade_rate : player -> int
val possessed_legits : player -> int
val create : Random_source.t -> t
val snapshot : t -> snapshot
val of_snapshot : snapshot -> (t, Command.rejection) result
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> (t, Command.rejection) result
