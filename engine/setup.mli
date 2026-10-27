type 'random opening = {
  deck : int list;
  first_hand : int list;
  rival_hand : int list;
  rival_distributor : int;
  random_source : 'random;
}

val shuffle :
  draw_index:(bound:int -> 'random -> int * 'random) ->
  random_source:'random ->
  int list ->
  int list * 'random

val deal :
  draw_index:(bound:int -> 'random -> int * 'random) ->
  random_source:'random ->
  opening_distributor:int ->
  'random opening
(** Internal pure setup seam. The public facade never accepts an arbitrary
    source. *)
