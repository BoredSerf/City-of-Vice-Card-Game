type t

val algorithm : string
val of_hex : string -> t option
val to_hex : t -> string
val next : t -> t
val choose : bound:int -> t -> int * t
