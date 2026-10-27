type t = {
  green : int;
  blue : int;
  black : int;
  white : int;
  yellow : int;
  purple : int;
}

val zero : t
val colors : Cards.color list
val get : t -> Cards.color -> int
val set : t -> Cards.color -> int -> t
val add : t -> Cards.color -> int -> t
val total : t -> int
val valid : max_total:int -> t -> bool
val to_value : t -> Wire_value.t
val of_value : Wire_value.t -> t
