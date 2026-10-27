type decision =
  | Docks_discard
  | Forced_cash
  | Resource_trim
  | Interception
  | Post_action_trim

type draw_source = Paid | Burbs
type win_reason = Elimination | Expansion

type destination =
  | To_discard
  | To_hand of { player_id : int; suspended : bool }
  | To_active of { player_id : int }

type affected = { card_id : int; destination : destination }

type t =
  | Game_started of { turn_number : int; active_player : int }
  | Opening_distributor_chosen of { player_id : int; card_id : int }
  | Initial_hand_dealt of { player_id : int; count : int }
  | Turn_changed of { from_player : int; to_player : int; turn_number : int }
  | Income_collected of { player_id : int; resources : Resource_bank.t }
  | Crew_resource_granted of { player_id : int; color : Cards.color }
  | Payment_made of { player_id : int; resources : Resource_bank.t }
  | Deck_reshuffled of { player_id : int; count : int }
  | Cards_drawn of {
      player_id : int;
      card_ids : int list;
      source : draw_source;
      price : int option;
    }
  | Card_discarded of { player_id : int; card_id : int }
  | Card_cashed of {
      player_id : int;
      card_id : int;
      color : Cards.color;
      mandatory : bool;
    }
  | Resource_trimmed of { player_id : int; color : Cards.color }
  | Resources_traded of {
      player_id : int;
      from_color : Cards.color;
      to_color : Cards.color;
      spent : int;
    }
  | Decision_required of { player_id : int; decision : decision }
  | Decision_resolved of { player_id : int; decision : decision }
  | Card_activated of { player_id : int; card_id : int }
  | Crew_completed of { player_id : int; crew : Cards.crew }
  | Crew_lost of { player_id : int; crew : Cards.crew }
  | Operator_result of {
      player_id : int;
      operator_id : int;
      target_ids : int list;
      affected : affected list;
    }
  | Operator_disposed of { player_id : int; operator_id : int }
  | Intercept_answered of { player_id : int; operator_id : int; accept : bool }
  | Operator_intercepted of {
      attacker_id : int;
      defender_id : int;
      operator_id : int;
    }
  | Distributors_traded of {
      player_id : int;
      own_card_id : int;
      rival_card_id : int;
    }
  | Game_finished of { winner : int; reason : win_reason }

val setup_events : int -> int -> t list
val decision_name : decision -> string
val decision_of_name : string -> decision
val win_reason_name : win_reason -> string
val win_reason_of_name : string -> win_reason
val valid : t -> bool
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> t
