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
  | Interception -> "intercept"
  | Post_action_trim -> "post_action_trim"

let decision_of_name = function
  | "draw_discard" -> Docks_discard
  | "legit_cash" -> Forced_cash
  | "trim" -> Resource_trim
  | "intercept" -> Interception
  | "post_action_trim" -> Post_action_trim
  | _ -> raise (Wire_value.Decode_error "decision")

let win_reason_name = function
  | Elimination -> "elimination"
  | Expansion -> "expansion"

let win_reason_of_name = function
  | "elimination" -> Elimination
  | "expansion" -> Expansion
  | _ -> raise (Wire_value.Decode_error "win_reason")

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
  | Card_activated { player_id; card_id } -> player player_id && card card_id
  | Crew_completed { player_id; _ } | Crew_lost { player_id; _ } ->
      player player_id
  | Operator_result { player_id; operator_id; target_ids; affected } ->
      player player_id
      && (match Cards.find operator_id with
        | Some { category = Operator _; _ } -> true
        | _ -> false)
      && target_ids <> []
      && List.length target_ids <= 2
      && List.length (List.sort_uniq Int.compare target_ids)
         = List.length target_ids
      && List.for_all Cards.is_distributor target_ids
      && affected <> []
      && List.length affected <= 6
      && List.length
           (List.sort_uniq Int.compare
              (List.map (fun entry -> entry.card_id) affected))
         = List.length affected
      && List.for_all
           (fun entry ->
             Cards.is_distributor entry.card_id
             &&
             match entry.destination with
             | To_discard -> true
             | To_active { player_id } | To_hand { player_id; _ } ->
                 player player_id)
           affected
  | Operator_disposed { player_id; operator_id }
  | Intercept_answered { player_id; operator_id; _ } -> (
      player player_id
      &&
      match Cards.find operator_id with
      | Some { category = Operator _; _ } -> true
      | _ -> false)
  | Operator_intercepted { attacker_id; defender_id; operator_id } -> (
      player attacker_id
      && defender_id = 1 - attacker_id
      &&
      match Cards.find operator_id with
      | Some { category = Operator _; _ } -> true
      | _ -> false)
  | Distributors_traded { player_id; own_card_id; rival_card_id } ->
      player player_id
      && own_card_id <> rival_card_id
      && Cards.is_distributor own_card_id
      && Cards.is_distributor rival_card_id
  | Game_finished { winner; _ } -> player winner

let to_value event =
  let open Wire_value in
  let i = int_value in
  let c color = String (Cards.color_key color) in
  let affected_value entry =
    let destination =
      match entry.destination with
      | To_discard -> Object [ ("zone", String "discard") ]
      | To_active { player_id } ->
          Object [ ("zone", String "active"); ("player_id", i player_id) ]
      | To_hand { player_id; suspended } ->
          Object
            [
              ("zone", String "hand");
              ("player_id", i player_id);
              ("suspended", Bool suspended);
            ]
    in
    Object [ ("card_id", i entry.card_id); ("destination", destination) ]
  in
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
    | Card_activated { player_id; card_id } ->
        ( "card_activated",
          [ ("player_id", i player_id); ("card_id", i card_id) ] )
    | Crew_completed { player_id; crew } ->
        ( "crew_completed",
          [
            ("player_id", i player_id); ("crew", String (Cards.crew_name crew));
          ] )
    | Crew_lost { player_id; crew } ->
        ( "crew_lost",
          [
            ("player_id", i player_id); ("crew", String (Cards.crew_name crew));
          ] )
    | Operator_result { player_id; operator_id; target_ids; affected } ->
        ( "operator_result",
          [
            ("player_id", i player_id);
            ("operator_id", i operator_id);
            ("target_ids", Array (List.map i target_ids));
            ("affected", Array (List.map affected_value affected));
          ] )
    | Operator_disposed { player_id; operator_id } ->
        ( "operator_disposed",
          [ ("player_id", i player_id); ("operator_id", i operator_id) ] )
    | Intercept_answered { player_id; operator_id; accept } ->
        ( "intercept_answered",
          [
            ("player_id", i player_id);
            ("operator_id", i operator_id);
            ("accept", Bool accept);
          ] )
    | Operator_intercepted { attacker_id; defender_id; operator_id } ->
        ( "operator_intercepted",
          [
            ("attacker_id", i attacker_id);
            ("defender_id", i defender_id);
            ("operator_id", i operator_id);
          ] )
    | Distributors_traded { player_id; own_card_id; rival_card_id } ->
        ( "distributors_traded",
          [
            ("player_id", i player_id);
            ("own_card_id", i own_card_id);
            ("rival_card_id", i rival_card_id);
          ] )
    | Game_finished { winner; reason } ->
        ( "game_finished",
          [ ("winner", i winner); ("reason", String (win_reason_name reason)) ]
        )
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
    | "card_activated" -> [ "player_id"; "card_id" ]
    | "crew_completed" | "crew_lost" -> [ "player_id"; "crew" ]
    | "operator_result" ->
        [ "player_id"; "operator_id"; "target_ids"; "affected" ]
    | "operator_disposed" -> [ "player_id"; "operator_id" ]
    | "intercept_answered" -> [ "player_id"; "operator_id"; "accept" ]
    | "operator_intercepted" -> [ "attacker_id"; "defender_id"; "operator_id" ]
    | "distributors_traded" -> [ "player_id"; "own_card_id"; "rival_card_id" ]
    | "game_finished" -> [ "winner"; "reason" ]
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
  let boolean value =
    match value with Bool value -> value | _ -> raise (Decode_error "boolean")
  in
  let crew () =
    match Cards.crew_of_name (text "crew") with
    | Some crew -> crew
    | None -> raise (Decode_error "crew")
  in
  let affected value =
    let f = Wire_value.fields [ "card_id"; "destination" ] value in
    let value = field "destination" f in
    let tag =
      match value with
      | Object f -> string (field "zone" f)
      | _ -> raise (Decode_error "destination")
    in
    let names =
      match tag with
      | "discard" -> [ "zone" ]
      | "active" -> [ "zone"; "player_id" ]
      | "hand" -> [ "zone"; "player_id"; "suspended" ]
      | _ -> raise (Decode_error "destination")
    in
    let d = Wire_value.fields names value in
    let destination =
      match tag with
      | "discard" -> To_discard
      | "active" -> To_active { player_id = int (field "player_id" d) }
      | _ ->
          To_hand
            {
              player_id = int (field "player_id" d);
              suspended = boolean (field "suspended" d);
            }
    in
    { card_id = int (field "card_id" f); destination }
  in
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
    | "card_activated" ->
        Card_activated { player_id = actor (); card_id = number "card_id" }
    | "crew_completed" ->
        Crew_completed { player_id = actor (); crew = crew () }
    | "crew_lost" -> Crew_lost { player_id = actor (); crew = crew () }
    | "operator_result" ->
        Operator_result
          {
            player_id = actor ();
            operator_id = number "operator_id";
            target_ids = List.map int (array (get "target_ids"));
            affected = List.map affected (array (get "affected"));
          }
    | "operator_disposed" ->
        Operator_disposed
          { player_id = actor (); operator_id = number "operator_id" }
    | "intercept_answered" ->
        Intercept_answered
          {
            player_id = actor ();
            operator_id = number "operator_id";
            accept = boolean (get "accept");
          }
    | "operator_intercepted" ->
        Operator_intercepted
          {
            attacker_id = number "attacker_id";
            defender_id = number "defender_id";
            operator_id = number "operator_id";
          }
    | "distributors_traded" ->
        Distributors_traded
          {
            player_id = actor ();
            own_card_id = number "own_card_id";
            rival_card_id = number "rival_card_id";
          }
    | "game_finished" ->
        Game_finished
          {
            winner = number "winner";
            reason = win_reason_of_name (text "reason");
          }
    | _ -> assert false
  in
  if valid event then event else raise (Decode_error "event_fields")
