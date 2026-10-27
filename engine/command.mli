type t =
  | Start_game of { opening_distributor : int }
  | Collect_income
  | Draw_card of { payment : Cards.color list; use_docks_bonus : bool }
  | Discard_draw_choice of { card_id : int }
  | Cash_card of { card_id : int; color : Cards.color }
  | Trim_resource of { color : Cards.color }
  | Trade_resources of { from_color : Cards.color; to_color : Cards.color }
  | End_turn

type rejection_code =
  | Invalid_seed
  | Invalid_actor
  | Wrong_phase
  | Invalid_opening
  | Malformed_command
  | Malformed_state
  | Unsupported_version
  | Invalid_state
  | Invalid_card
  | Invalid_choice
  | Hand_full
  | Resource_limit
  | Insufficient_cards
  | Invalid_payment
  | Insufficient_resources
  | Crew_unavailable

type rejection = { code : rejection_code; field : string }

val reject : rejection_code -> string -> rejection
val rejection_name : rejection_code -> string
val rejection_to_value : rejection -> Wire_value.t
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> (int * t, rejection) result
