type t = {
  resources : Resource_bank.t;
  hand : int list;
  active_card_ids : int list;
  suspended_card_ids : int list;
  draw_price : int;
  traded_distributors : bool;
}

val empty : t
val distributors : t -> int
val legits : t -> int
val operators : t -> int
val businesses : t -> int
val possessed_legits : t -> int
val capacity : t -> int
val has_crew : t -> Cards.crew -> bool
val resource_limit : t -> int
val trade_rate : t -> int
