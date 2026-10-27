type t =
  | Game_started of { turn_number : int; active_player : int }
  | Opening_distributor_chosen of { player_id : int; card_id : int }
  | Initial_hand_dealt of { player_id : int; count : int }

let setup_events first rival =
  [
    Game_started { turn_number = 1; active_player = 0 };
    Opening_distributor_chosen { player_id = 0; card_id = first };
    Opening_distributor_chosen { player_id = 1; card_id = rival };
    Initial_hand_dealt { player_id = 0; count = 3 };
    Initial_hand_dealt { player_id = 1; count = 3 };
  ]

let to_value event =
  let open Wire_value in
  match event with
  | Game_started { turn_number; active_player } ->
      Object
        [
          ("event", String "game_started");
          ("turn_number", int_value turn_number);
          ("active_player", int_value active_player);
        ]
  | Opening_distributor_chosen { player_id; card_id } ->
      Object
        [
          ("event", String "opening_distributor_chosen");
          ("player_id", int_value player_id);
          ("card_id", int_value card_id);
        ]
  | Initial_hand_dealt { player_id; count } ->
      Object
        [
          ("event", String "initial_hand_dealt");
          ("player_id", int_value player_id);
          ("count", int_value count);
        ]

let of_value value =
  let open Wire_value in
  let tag =
    match value with
    | Object fields -> string (field "event" fields)
    | _ -> raise (Decode_error "event")
  in
  match tag with
  | "game_started" ->
      let fields = fields [ "event"; "turn_number"; "active_player" ] value in
      Game_started
        {
          turn_number = int (field "turn_number" fields);
          active_player = int (field "active_player" fields);
        }
  | "opening_distributor_chosen" ->
      let fields = fields [ "event"; "player_id"; "card_id" ] value in
      Opening_distributor_chosen
        {
          player_id = int (field "player_id" fields);
          card_id = int (field "card_id" fields);
        }
  | "initial_hand_dealt" ->
      let fields = fields [ "event"; "player_id"; "count" ] value in
      Initial_hand_dealt
        {
          player_id = int (field "player_id" fields);
          count = int (field "count" fields);
        }
  | _ -> raise (Decode_error "event")
