type phase = Awaiting_opening | Ready

type resources = {
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
}

type t

val schema_version : int
val rules_version : string
val zero_resources : resources
val empty_player : player
val create : Random_source.t -> t
val snapshot : t -> snapshot
val of_snapshot : snapshot -> (t, Command.rejection) result
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> (t, Command.rejection) result
