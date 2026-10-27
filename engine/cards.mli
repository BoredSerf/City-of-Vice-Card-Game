type color = Green | Blue | Black | White | Yellow | Purple

type crew =
  | Docks
  | Club_circuit
  | Trailer_park
  | Burbs
  | Pipeline
  | Night_shift
  | Arts_district
  | Hill_country

type ability = Kill | Coerce | Buy
type category = Distributor | Legit | Operator of ability
type cost = Fixed of color | Any

type t = {
  id : int;
  name : string;
  business : string;
  color : color;
  category : category;
  crew : crew option;
  activation_cost : cost list;
  ability_cost : cost list;
  flavor : string;
}

val all : t list
val find : int -> t option
val opening_ids : int list
val is_distributor : int -> bool
val color_name : color -> string
val color_key : color -> string
val crew_name : crew -> string
val ability_name : ability -> string
