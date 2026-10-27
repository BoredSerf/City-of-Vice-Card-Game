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

val reject : rejection_code -> string -> rejection
val rejection_name : rejection_code -> string
val rejection_to_value : rejection -> Wire_value.t
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> (int * t, rejection) result
