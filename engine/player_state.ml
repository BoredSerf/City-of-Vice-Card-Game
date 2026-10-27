type t = {
  resources : Resource_bank.t;
  hand : int list;
  active_card_ids : int list;
  suspended_card_ids : int list;
  draw_price : int;
  traded_distributors : bool;
}

let empty =
  {
    resources = Resource_bank.zero;
    hand = [];
    active_card_ids = [];
    suspended_card_ids = [];
    draw_price = 1;
    traded_distributors = false;
  }

let count predicate ids =
  List.fold_left
    (fun total id ->
      match Cards.find id with
      | Some card when predicate card.Cards.category -> total + 1
      | _ -> total)
    0 ids

let distributors player = count (( = ) Cards.Distributor) player.active_card_ids
let legits player = count (( = ) Cards.Legit) player.active_card_ids

let operators player =
  count
    (function Cards.Operator _ -> true | _ -> false)
    player.active_card_ids

let businesses player = distributors player + legits player

let possessed_legits player =
  count (( = ) Cards.Legit) (player.hand @ player.active_card_ids)

let capacity player = 3 * (legits player + 1)
let has_crew player crew = Cards.complete_crew player.active_card_ids crew
let resource_limit player = if has_crew player Cards.Night_shift then 12 else 10
let trade_rate player = if has_crew player Cards.Hill_country then 2 else 4
