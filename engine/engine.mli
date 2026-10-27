type transition = { state : State.t; events : Event.t list }

val create_session : seed:string -> (State.t, Command.rejection) result
val legal_commands : State.t -> player_id:int -> Command.t list

val perform_command :
  State.t ->
  player_id:int ->
  Command.t ->
  (transition, Command.rejection) result

(** Injection seam for the original S01 random-source fixture. Not a facade
    export. *)
module For_testing : sig
  val perform_command :
    draw_index:(bound:int -> Random_source.t -> int * Random_source.t) ->
    State.t ->
    player_id:int ->
    Command.t ->
    (transition, Command.rejection) result
end
