type t =
  | Null
  | Bool of bool
  | Number of float
  | String of string
  | Array of t list
  | Object of (string * t) list

exception Decode_error of string

val fields : string list -> t -> (string * t) list
val field : string -> (string * t) list -> t
val string : t -> string
val int : t -> int
val array : t -> t list
val null : t -> unit
val int_value : int -> t
