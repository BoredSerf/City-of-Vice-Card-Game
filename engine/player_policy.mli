val propose :
  Player_view.t ->
  legal_commands:Command.t list ->
  (Command.t option, Command.rejection) result
(** Pure, deterministic preference selection. Choices assist selection; callers
    must submit the proposal through current-state engine validation. *)
