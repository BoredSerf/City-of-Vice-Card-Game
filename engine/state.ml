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

type t = snapshot

let schema_version = 1
let rules_version = "prototype_4ccb197_pd002"

let zero_resources =
  { green = 0; blue = 0; black = 0; white = 0; yellow = 0; purple = 0 }

let empty_player =
  {
    resources = zero_resources;
    hand = [];
    active_card_ids = [];
    suspended_card_ids = [];
    draw_price = 1;
  }

let all_ids = List.map (fun (card : Cards.t) -> card.id) Cards.all
let snapshot state = state

let of_snapshot state =
  let invalid field = Error (Command.reject Invalid_state field) in
  if
    state.schema_version <> schema_version
    || state.rules_version <> rules_version
  then Error (Command.reject Unsupported_version "version")
  else
    let locations =
      state.deck @ state.discard
      @ List.concat_map
          (fun player -> player.hand @ player.active_card_ids)
          state.players
    in
    if List.sort Int.compare locations <> all_ids then invalid "card_locations"
    else
      match state.players with
      | [ first; rival ] -> (
          let initial_player player =
            player.resources = zero_resources
            && player.draw_price = 1
            && player.suspended_card_ids = []
          in
          if not (List.for_all initial_player state.players) then
            invalid "player_setup"
          else if state.discard <> [] then invalid "discard"
          else
            match state.phase with
            | Awaiting_opening ->
                if
                  state.turn_number = 0 && state.active_player = None
                  && state.deck = all_ids
                  && state.players = [ empty_player; empty_player ]
                  && state.history = []
                then Ok state
                else invalid "awaiting_opening"
            | Ready -> (
                match (first.active_card_ids, rival.active_card_ids) with
                | [ first_id ], [ rival_id ] -> (
                    match (Cards.find first_id, Cards.find rival_id) with
                    | Some first_card, Some rival_card
                      when first_card.category = Cards.Distributor
                           && rival_card.category = Cards.Distributor
                           && first_card.crew <> rival_card.crew
                           && first_card.color <> rival_card.color ->
                        if
                          state.turn_number = 1
                          && state.active_player = Some 0
                          && List.length first.hand = 3
                          && List.length rival.hand = 3
                          && List.length state.deck = 28
                          && state.history
                             = Event.setup_events first_id rival_id
                        then Ok state
                        else invalid "ready"
                    | _ -> invalid "opening_distributors")
                | _ -> invalid "opening_distributors"))
      | _ -> invalid "players"

let create random_source =
  {
    schema_version;
    rules_version;
    phase = Awaiting_opening;
    turn_number = 0;
    active_player = None;
    deck = all_ids;
    discard = [];
    players = [ empty_player; empty_player ];
    random_source;
    history = [];
  }

let resources_to_value resources =
  let open Wire_value in
  Object
    [
      ("green", int_value resources.green);
      ("blue", int_value resources.blue);
      ("black", int_value resources.black);
      ("white", int_value resources.white);
      ("yellow", int_value resources.yellow);
      ("purple", int_value resources.purple);
    ]

let ids_to_value ids = Wire_value.Array (List.map Wire_value.int_value ids)

let player_to_value player =
  Wire_value.Object
    [
      ("resources", resources_to_value player.resources);
      ("hand", ids_to_value player.hand);
      ("active_card_ids", ids_to_value player.active_card_ids);
      ("suspended_card_ids", ids_to_value player.suspended_card_ids);
      ("draw_price", Wire_value.int_value player.draw_price);
    ]

let to_value state =
  let open Wire_value in
  Object
    [
      ("schema_version", int_value state.schema_version);
      ("rules_version", String state.rules_version);
      ( "phase",
        String
          (match state.phase with
          | Awaiting_opening -> "awaiting_opening"
          | Ready -> "ready") );
      ("turn_number", int_value state.turn_number);
      ( "active_player",
        match state.active_player with None -> Null | Some id -> int_value id );
      ("deck", ids_to_value state.deck);
      ("discard", ids_to_value state.discard);
      ("players", Array (List.map player_to_value state.players));
      ( "random_source",
        Object
          [
            ("algorithm", String Random_source.algorithm);
            ("cursor", String (Random_source.to_hex state.random_source));
          ] );
      ("history", Array (List.map Event.to_value state.history));
      ("winner", Null);
      ("win_reason", Null);
      ("pending_decision", Null);
    ]

let resources_of_value value =
  let open Wire_value in
  let fields =
    fields [ "green"; "blue"; "black"; "white"; "yellow"; "purple" ] value
  in
  {
    green = int (field "green" fields);
    blue = int (field "blue" fields);
    black = int (field "black" fields);
    white = int (field "white" fields);
    yellow = int (field "yellow" fields);
    purple = int (field "purple" fields);
  }

let ids_of_value value = List.map Wire_value.int (Wire_value.array value)

let player_of_value value =
  let open Wire_value in
  let fields =
    fields
      [
        "resources";
        "hand";
        "active_card_ids";
        "suspended_card_ids";
        "draw_price";
      ]
      value
  in
  {
    resources = resources_of_value (field "resources" fields);
    hand = ids_of_value (field "hand" fields);
    active_card_ids = ids_of_value (field "active_card_ids" fields);
    suspended_card_ids = ids_of_value (field "suspended_card_ids" fields);
    draw_price = int (field "draw_price" fields);
  }

let of_value value =
  let open Wire_value in
  try
    let fields =
      fields
        [
          "schema_version";
          "rules_version";
          "phase";
          "turn_number";
          "active_player";
          "deck";
          "discard";
          "players";
          "random_source";
          "history";
          "winner";
          "win_reason";
          "pending_decision";
        ]
        value
    in
    let received_schema = int (field "schema_version" fields) in
    let received_rules = string (field "rules_version" fields) in
    if received_schema <> schema_version || received_rules <> rules_version then
      Error (Command.reject Unsupported_version "version")
    else
      let phase =
        match string (field "phase" fields) with
        | "awaiting_opening" -> Awaiting_opening
        | "ready" -> Ready
        | _ -> raise (Decode_error "phase")
      in
      let random_fields =
        Wire_value.fields [ "algorithm"; "cursor" ]
          (field "random_source" fields)
      in
      if string (field "algorithm" random_fields) <> Random_source.algorithm
      then Error (Command.reject Unsupported_version "random_source.algorithm")
      else
        let random_source =
          match
            Random_source.of_hex (string (field "cursor" random_fields))
          with
          | Some state -> state
          | None -> raise (Decode_error "random_source.cursor")
        in
        List.iter
          (fun name -> null (field name fields))
          [ "winner"; "win_reason"; "pending_decision" ];
        of_snapshot
          {
            schema_version = received_schema;
            rules_version = received_rules;
            phase;
            turn_number = int (field "turn_number" fields);
            active_player =
              (match field "active_player" fields with
              | Null -> None
              | value -> Some (int value));
            deck = ids_of_value (field "deck" fields);
            discard = ids_of_value (field "discard" fields);
            players = List.map player_of_value (array (field "players" fields));
            random_source;
            history = List.map Event.of_value (array (field "history" fields));
          }
  with Decode_error field -> Error (Command.reject Malformed_state field)
