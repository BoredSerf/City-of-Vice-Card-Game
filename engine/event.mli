type t =
  | Game_started of { turn_number : int; active_player : int }
  | Opening_distributor_chosen of { player_id : int; card_id : int }
  | Initial_hand_dealt of { player_id : int; count : int }

val setup_events : int -> int -> t list
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> t
