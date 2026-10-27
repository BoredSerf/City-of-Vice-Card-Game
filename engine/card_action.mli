type attack = {
  paid : Payment.resolved;
  players : Player_state.t list;
  discarded : int list;
  affected : Event.affected list;
}

val activate :
  Player_state.t ->
  card_id:int ->
  wildcard_payment:Cards.color list option ->
  (Payment.resolved, Command.rejection) result

val attack :
  Player_state.t list ->
  attacker_id:int ->
  operator_id:int ->
  target_ids:int list ->
  (attack, Command.rejection) result

val interception_payment :
  Player_state.t list ->
  defender_id:int ->
  operator_id:int ->
  Payment.resolved option

val trade :
  Player_state.t list ->
  player_id:int ->
  own_card_id:int ->
  rival_card_id:int ->
  (Payment.resolved, Command.rejection) result
