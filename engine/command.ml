type t = Start_game of { opening_distributor : int }

type rejection_code =
  | Invalid_seed
  | Invalid_actor
  | Wrong_phase
  | Invalid_opening
  | Malformed_command
  | Malformed_state
  | Unsupported_version
  | Invalid_state

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

let rejection_to_value rejection =
  Wire_value.Object
    [
      ("code", String (rejection_name rejection.code));
      ("field", String rejection.field);
    ]

let to_value (Start_game { opening_distributor }) =
  Wire_value.Object
    [
      ("command", String "start_game");
      ("opening_distributor", Wire_value.int_value opening_distributor);
    ]

let of_value value =
  let open Wire_value in
  try
    let fields =
      fields [ "player_id"; "command"; "opening_distributor" ] value
    in
    if string (field "command" fields) <> "start_game" then
      Error (reject Malformed_command "command")
    else
      Ok
        ( int (field "player_id" fields),
          Start_game
            { opening_distributor = int (field "opening_distributor" fields) }
        )
  with Decode_error field -> Error (reject Malformed_command field)
