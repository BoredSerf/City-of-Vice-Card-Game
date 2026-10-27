open City_engine

let rec of_json : Yojson.Basic.t -> Wire_value.t = function
  | `Null -> Null
  | `Bool value -> Bool value
  | `Int value -> Number (float_of_int value)
  | `Float value -> Number value
  | `String value -> String value
  | `List values -> Array (List.map of_json values)
  | `Assoc fields ->
      (* Match JSON.parse's last-value semantics before the shared decoder. *)
      Object
        (List.fold_right
           (fun (key, value) rest ->
             if List.mem_assoc key rest then rest
             else (key, of_json value) :: rest)
           fields [])

let rec to_json : Wire_value.t -> Yojson.Basic.t = function
  | Null -> `Null
  | Bool value -> `Bool value
  | Number value
    when Float.is_finite value
         && Float.floor value = value
         && value >= -2147483648. && value <= 2147483647. ->
      `Int (int_of_float value)
  | Number value -> `Float value
  | String value -> `String value
  | Array values -> `List (List.map to_json values)
  | Object fields ->
      `Assoc (List.map (fun (key, value) -> (key, to_json value)) fields)

let encode value = Yojson.Basic.to_string (to_json value)
let parse value = of_json (Yojson.Basic.from_string value)
let state_json state = encode (State.to_value state)

let decode_state value =
  try State.of_value (parse value)
  with Yojson.Json_error _ -> Error (Command.reject Malformed_state "json")

let rec normalize = function
  | `Assoc fields ->
      `Assoc
        (List.sort
           (fun (left, _) (right, _) -> String.compare left right)
           (List.map (fun (key, value) -> (key, normalize value)) fields))
  | `List values -> `List (List.map normalize values)
  | value -> value

let equal_json left right = normalize left = normalize right
let seeds = [ "00000001"; "12345678"; "7fffffff"; "80000000"; "ffffffff" ]
