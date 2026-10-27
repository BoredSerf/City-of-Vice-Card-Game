type resolved = {
  debit : Resource_bank.t;
  remaining : Resource_bank.t;
  colors : Cards.color list;
}

val resolve :
  Resource_bank.t ->
  Cards.cost list ->
  picks:Cards.color list option ->
  (resolved, Command.rejection) result
