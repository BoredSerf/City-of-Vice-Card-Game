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

let reject code field = { code; field }

let rejection_name = function
  | Invalid_seed -> "invalid_seed"
  | Invalid_actor -> "invalid_actor"
  | Wrong_phase -> "wrong_phase"
  | Invalid_opening -> "invalid_opening"
  | Malformed_command -> "malformed_command"
  | Malformed_state -> "malformed_state"
  | Unsupported_version -> "unsupported_version"
  | Invalid_state -> "invalid_state"
  | Invalid_card -> "invalid_card"
  | Invalid_choice -> "invalid_choice"
  | Hand_full -> "hand_full"
  | Resource_limit -> "resource_limit"
  | Insufficient_cards -> "insufficient_cards"
  | Invalid_payment -> "invalid_payment"
  | Insufficient_resources -> "insufficient_resources"
  | Crew_unavailable -> "crew_unavailable"

let rejection_to_value rejection =
  Wire_value.Object
    [
      ("code", String (rejection_name rejection.code));
      ("field", String rejection.field);
    ]

let to_value command =
  let open Wire_value in
  let color value = String (Cards.color_key value) in
  let tag, fields =
    match command with
    | Start_game { opening_distributor } ->
        ( "start_game",
          [ ("opening_distributor", int_value opening_distributor) ] )
    | Collect_income -> ("collect_income", [])
    | Draw_card { payment; use_docks_bonus } ->
        ( "draw_card",
          [
            ("payment", Array (List.map color payment));
            ("use_docks_bonus", Bool use_docks_bonus);
          ] )
    | Discard_draw_choice { card_id } ->
        ("discard_draw_choice", [ ("card_id", int_value card_id) ])
    | Cash_card { card_id; color = choice } ->
        ( "cash_card",
          [ ("card_id", int_value card_id); ("color", color choice) ] )
    | Trim_resource { color = choice } ->
        ("trim_resource", [ ("color", color choice) ])
    | Trade_resources { from_color; to_color } ->
        ( "trade_resources",
          [ ("from_color", color from_color); ("to_color", color to_color) ] )
    | End_turn -> ("end_turn", [])
  in
  Object (("command", String tag) :: fields)

let of_value value =
  let open Wire_value in
  try
    let tag =
      match value with
      | Object fields -> string (field "command" fields)
      | _ -> raise (Decode_error "object_fields")
    in
    let names =
      match tag with
      | "start_game" -> [ "opening_distributor" ]
      | "collect_income" | "end_turn" -> []
      | "draw_card" -> [ "payment"; "use_docks_bonus" ]
      | "discard_draw_choice" -> [ "card_id" ]
      | "cash_card" -> [ "card_id"; "color" ]
      | "trim_resource" -> [ "color" ]
      | "trade_resources" -> [ "from_color"; "to_color" ]
      | _ -> raise (Decode_error "command")
    in
    let fields = fields ("player_id" :: "command" :: names) value in
    let color name value =
      match
        Cards.color_of_key
          (try string value with Decode_error _ -> raise (Decode_error name))
      with
      | Some value -> value
      | None -> raise (Decode_error name)
    in
    let choice name = color name (field name fields) in
    let card_id () = int (field "card_id" fields) in
    let command =
      match tag with
      | "start_game" ->
          Start_game
            { opening_distributor = int (field "opening_distributor" fields) }
      | "collect_income" -> Collect_income
      | "end_turn" -> End_turn
      | "draw_card" ->
          let payment =
            try List.map (color "payment") (array (field "payment" fields))
            with Decode_error _ -> raise (Decode_error "payment")
          in
          let use_docks_bonus =
            match field "use_docks_bonus" fields with
            | Bool value -> value
            | _ -> raise (Decode_error "use_docks_bonus")
          in
          Draw_card { payment; use_docks_bonus }
      | "discard_draw_choice" -> Discard_draw_choice { card_id = card_id () }
      | "cash_card" ->
          Cash_card { card_id = card_id (); color = choice "color" }
      | "trim_resource" -> Trim_resource { color = choice "color" }
      | "trade_resources" ->
          Trade_resources
            { from_color = choice "from_color"; to_color = choice "to_color" }
      | _ -> assert false
    in
    Ok (int (field "player_id" fields), command)
  with Decode_error field -> Error (reject Malformed_command field)
