type t =
  | Null
  | Bool of bool
  | Number of float
  | String of string
  | Array of t list
  | Object of (string * t) list

exception Decode_error of string

let fields expected = function
  | Object fields
    when List.sort String.compare (List.map fst fields)
         = List.sort String.compare expected ->
      fields
  | _ -> raise (Decode_error "object_fields")

let field name fields =
  match List.assoc_opt name fields with
  | Some value -> value
  | None -> raise (Decode_error name)

let string = function
  | String value -> value
  | _ -> raise (Decode_error "string")

let int = function
  | Number value
    when Float.is_finite value
         && Float.floor value = value
         && value >= -2147483648. && value <= 2147483647. ->
      int_of_float value
  | _ -> raise (Decode_error "integer")

let array = function
  | Array values -> values
  | _ -> raise (Decode_error "array")

let null = function Null -> () | _ -> raise (Decode_error "null")
let int_value value = Number (float_of_int value)
