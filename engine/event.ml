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

let setup_events first rival =
  [
    Game_started { turn_number = 1; active_player = 0 };
    Opening_distributor_chosen { player_id = 0; card_id = first };
    Opening_distributor_chosen { player_id = 1; card_id = rival };
    Initial_hand_dealt { player_id = 0; count = 3 };
    Initial_hand_dealt { player_id = 1; count = 3 };
  ]

let decision_name = function
  | Docks_discard -> "draw_discard"
  | Forced_cash -> "legit_cash"
  | Resource_trim -> "trim"

let decision_of_name = function
  | "draw_discard" -> Docks_discard
  | "legit_cash" -> Forced_cash
  | "trim" -> Resource_trim
  | _ -> raise (Wire_value.Decode_error "decision")

let valid event =
  let player value = value = 0 || value = 1 in
  let card value = Option.is_some (Cards.find value) in
  match event with
  | Game_started { turn_number; active_player } ->
      turn_number = 1 && active_player = 0
  | Opening_distributor_chosen { player_id; card_id } ->
      player player_id && Cards.is_distributor card_id
  | Initial_hand_dealt { player_id; count } -> player player_id && count = 3
  | Turn_changed { from_player; to_player; turn_number } ->
      player from_player
      && to_player = 1 - from_player
      && turn_number >= 1 && turn_number <= 2147483647
  | Income_collected { player_id; resources } ->
      player player_id && Resource_bank.valid ~max_total:12 resources
  | Payment_made { player_id; resources } ->
      player player_id
      && Resource_bank.valid ~max_total:12 resources
      && Resource_bank.total resources > 0
  | Crew_resource_granted { player_id; _ } | Resource_trimmed { player_id; _ }
    ->
      player player_id
  | Deck_reshuffled { player_id; count } ->
      player player_id && count >= 1 && count <= 36
  | Cards_drawn { player_id; card_ids; source; price } -> (
      player player_id && List.for_all card card_ids
      && List.length (List.sort_uniq Int.compare card_ids)
         = List.length card_ids
      &&
      match (source, price) with
      | Paid, Some price ->
          price >= 1 && price <= 12
          && (List.length card_ids = 1 || List.length card_ids = 2)
      | Burbs, None -> List.length card_ids = 1
      | _ -> false)
  | Card_discarded { player_id; card_id } -> player player_id && card card_id
  | Card_cashed { player_id; card_id; mandatory; _ } ->
      player player_id && card card_id
      && ((not mandatory)
         || (Option.get (Cards.find card_id)).category = Cards.Legit)
  | Resources_traded { player_id; from_color; to_color; spent } ->
      player player_id && from_color <> to_color && (spent = 2 || spent = 4)
  | Decision_required { player_id; _ } | Decision_resolved { player_id; _ } ->
      player player_id

let to_value event =
  let open Wire_value in
  let i = int_value in
  let c color = String (Cards.color_key color) in
  let tag, fields =
    match event with
    | Game_started { turn_number; active_player } ->
        ( "game_started",
          [ ("turn_number", i turn_number); ("active_player", i active_player) ]
        )
    | Opening_distributor_chosen { player_id; card_id } ->
        ( "opening_distributor_chosen",
          [ ("player_id", i player_id); ("card_id", i card_id) ] )
    | Initial_hand_dealt { player_id; count } ->
        ( "initial_hand_dealt",
          [ ("player_id", i player_id); ("count", i count) ] )
    | Turn_changed { from_player; to_player; turn_number } ->
        ( "turn_changed",
          [
            ("from_player", i from_player);
            ("to_player", i to_player);
            ("turn_number", i turn_number);
          ] )
    | Income_collected { player_id; resources } ->
        ( "income_collected",
          [
            ("player_id", i player_id);
            ("resources", Resource_bank.to_value resources);
          ] )
    | Crew_resource_granted { player_id; color } ->
        ( "crew_resource_granted",
          [
            ("player_id", i player_id);
            ("crew", String "Night Shift");
            ("color", c color);
            ("amount", i 1);
          ] )
    | Payment_made { player_id; resources } ->
        ( "payment_made",
          [
            ("player_id", i player_id);
            ("resources", Resource_bank.to_value resources);
          ] )
    | Deck_reshuffled { player_id; count } ->
        ("deck_reshuffled", [ ("player_id", i player_id); ("count", i count) ])
    | Cards_drawn { player_id; card_ids; source; price } ->
        ( "cards_drawn",
          [
            ("player_id", i player_id);
            ("card_ids", Array (List.map i card_ids));
            ( "source",
              String (match source with Paid -> "paid" | Burbs -> "burbs") );
            ("price", match price with None -> Null | Some price -> i price);
          ] )
    | Card_discarded { player_id; card_id } ->
        ( "card_discarded",
          [
            ("player_id", i player_id);
            ("card_id", i card_id);
            ("reason", String "docks");
          ] )
    | Card_cashed { player_id; card_id; color; mandatory } ->
        ( "card_cashed",
          [
            ("player_id", i player_id);
            ("card_id", i card_id);
            ("color", c color);
            ("amount", i 1);
            ("mandatory", Bool mandatory);
          ] )
    | Resource_trimmed { player_id; color } ->
        ( "resource_trimmed",
          [ ("player_id", i player_id); ("color", c color); ("amount", i 1) ] )
    | Resources_traded { player_id; from_color; to_color; spent } ->
        ( "resources_traded",
          [
            ("player_id", i player_id);
            ("from_color", c from_color);
            ("to_color", c to_color);
            ("spent", i spent);
            ("gained", i 1);
          ] )
    | Decision_required { player_id; decision } ->
        ( "decision_required",
          [
            ("player_id", i player_id);
            ("decision", String (decision_name decision));
          ] )
    | Decision_resolved { player_id; decision } ->
        ( "decision_resolved",
          [
            ("player_id", i player_id);
            ("decision", String (decision_name decision));
          ] )
  in
  Object (("event", String tag) :: fields)

let of_value value =
  let open Wire_value in
  let tag =
    match value with
    | Object fields -> string (field "event" fields)
    | _ -> raise (Decode_error "event")
  in
  let names =
    match tag with
    | "game_started" -> [ "turn_number"; "active_player" ]
    | "opening_distributor_chosen" -> [ "player_id"; "card_id" ]
    | "initial_hand_dealt" | "deck_reshuffled" -> [ "player_id"; "count" ]
    | "turn_changed" -> [ "from_player"; "to_player"; "turn_number" ]
    | "income_collected" | "payment_made" -> [ "player_id"; "resources" ]
    | "crew_resource_granted" -> [ "player_id"; "crew"; "color"; "amount" ]
    | "cards_drawn" -> [ "player_id"; "card_ids"; "source"; "price" ]
    | "card_discarded" -> [ "player_id"; "card_id"; "reason" ]
    | "card_cashed" ->
        [ "player_id"; "card_id"; "color"; "amount"; "mandatory" ]
    | "resource_trimmed" -> [ "player_id"; "color"; "amount" ]
    | "resources_traded" ->
        [ "player_id"; "from_color"; "to_color"; "spent"; "gained" ]
    | "decision_required" | "decision_resolved" -> [ "player_id"; "decision" ]
    | _ -> raise (Decode_error "event")
  in
  let fields = fields ("event" :: names) value in
  let get name = field name fields in
  let number name = int (get name) in
  let text name = string (get name) in
  let color name =
    match Cards.color_of_key (text name) with
    | Some color -> color
    | None -> raise (Decode_error name)
  in
  let constant name expected =
    if get name <> expected then raise (Decode_error name)
  in
  let actor () = number "player_id" in
  let event =
    match tag with
    | "game_started" ->
        Game_started
          {
            turn_number = number "turn_number";
            active_player = number "active_player";
          }
    | "opening_distributor_chosen" ->
        Opening_distributor_chosen
          { player_id = actor (); card_id = number "card_id" }
    | "initial_hand_dealt" ->
        Initial_hand_dealt { player_id = actor (); count = number "count" }
    | "turn_changed" ->
        Turn_changed
          {
            from_player = number "from_player";
            to_player = number "to_player";
            turn_number = number "turn_number";
          }
    | "income_collected" ->
        Income_collected
          {
            player_id = actor ();
            resources = Resource_bank.of_value (get "resources");
          }
    | "payment_made" ->
        Payment_made
          {
            player_id = actor ();
            resources = Resource_bank.of_value (get "resources");
          }
    | "crew_resource_granted" ->
        constant "crew" (String "Night Shift");
        constant "amount" (int_value 1);
        Crew_resource_granted { player_id = actor (); color = color "color" }
    | "deck_reshuffled" ->
        Deck_reshuffled { player_id = actor (); count = number "count" }
    | "cards_drawn" ->
        Cards_drawn
          {
            player_id = actor ();
            card_ids = List.map int (array (get "card_ids"));
            source =
              (match text "source" with
              | "paid" -> Paid
              | "burbs" -> Burbs
              | _ -> raise (Decode_error "source"));
            price =
              (match get "price" with
              | Null -> None
              | value -> Some (int value));
          }
    | "card_discarded" ->
        constant "reason" (String "docks");
        Card_discarded { player_id = actor (); card_id = number "card_id" }
    | "card_cashed" ->
        constant "amount" (int_value 1);
        Card_cashed
          {
            player_id = actor ();
            card_id = number "card_id";
            color = color "color";
            mandatory =
              (match get "mandatory" with
              | Bool value -> value
              | _ -> raise (Decode_error "mandatory"));
          }
    | "resource_trimmed" ->
        constant "amount" (int_value 1);
        Resource_trimmed { player_id = actor (); color = color "color" }
    | "resources_traded" ->
        constant "gained" (int_value 1);
        Resources_traded
          {
            player_id = actor ();
            from_color = color "from_color";
            to_color = color "to_color";
            spent = number "spent";
          }
    | "decision_required" ->
        Decision_required
          {
            player_id = actor ();
            decision = decision_of_name (text "decision");
          }
    | "decision_resolved" ->
        Decision_resolved
          {
            player_id = actor ();
            decision = decision_of_name (text "decision");
          }
    | _ -> assert false
  in
  if valid event then event else raise (Decode_error "event_fields")
