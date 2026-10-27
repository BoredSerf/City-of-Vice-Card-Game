type decision = Docks_discard | Forced_cash | Resource_trim
type draw_source = Paid | Burbs

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

val setup_events : int -> int -> t list
val decision_name : decision -> string
val decision_of_name : string -> decision
val valid : t -> bool
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> t
