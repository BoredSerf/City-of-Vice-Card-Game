type attack = {
  paid : Payment.resolved;
  players : Player_state.t list;
  discarded : int list;
  affected : Event.affected list;
}

let player (players : Player_state.t list) who = List.nth players who

let update (players : Player_state.t list) who transform =
  List.mapi
    (fun index value -> if index = who then transform value else value)
    players

let card id = Option.get (Cards.find id)
let fail code field = Error (Command.reject code field)

let activate owner ~card_id ~wildcard_payment =
  if not (List.mem card_id owner.Player_state.hand) then
    fail Invalid_card "card_id"
  else
    let selected = card card_id in
    if
      selected.category = Cards.Distributor
      && Player_state.distributors owner >= Player_state.capacity owner
    then fail Capacity_full "distributor_capacity"
    else if
      (match selected.category with Cards.Operator _ -> true | _ -> false)
      && Player_state.operators owner >= 2
    then fail Operator_limit "operator_limit"
    else
      Payment.resolve owner.resources selected.activation_cost
        ~picks:wildcard_payment

let attack players ~attacker_id ~operator_id ~target_ids =
  let owner = player players attacker_id in
  let defender_id = 1 - attacker_id in
  let defender = player players defender_id in
  match Cards.find operator_id with
  | Some { category = Cards.Operator ability; _ }
    when List.mem operator_id owner.active_card_ids -> (
      if
        target_ids = []
        || List.length target_ids > 2
        || List.length (List.sort_uniq Int.compare target_ids)
           <> List.length target_ids
        || not
             (List.for_all
                (fun id ->
                  Cards.is_distributor id
                  && List.mem id defender.active_card_ids)
                target_ids)
      then fail Invalid_choice "target_ids"
      else if
        List.length target_ids = 2
        && not (Player_state.has_crew owner Cards.Club_circuit)
      then fail Crew_unavailable "target_ids"
      else if
        ability = Cards.Coerce
        && List.length target_ids = 2
        && (card (List.hd target_ids)).crew
           = (card (List.nth target_ids 1)).crew
      then fail Invalid_choice "target_ids"
      else
        let costs =
          List.concat_map
            (fun id ->
              let cost = (card id).activation_cost in
              if ability = Cards.Buy then cost @ cost else cost)
            target_ids
        in
        match Payment.resolve owner.resources costs ~picks:None with
        | Error rejection -> Error rejection
        | Ok paid ->
            let protected = Player_state.has_crew defender Cards.Trailer_park in
            let rec apply players discarded affected = function
              | [] -> Ok { paid; players; discarded; affected }
              | target :: rest ->
                  let current = player players defender_id in
                  let group =
                    if ability = Cards.Coerce then
                      target
                      :: List.filter
                           (fun id ->
                             id <> target && Cards.is_distributor id
                             && (card id).crew = (card target).crew)
                           current.active_card_ids
                    else [ target ]
                  in
                  let players =
                    update players defender_id (fun p ->
                        {
                          p with
                          active_card_ids =
                            List.filter
                              (fun id -> not (List.mem id group))
                              p.active_card_ids;
                        })
                  in
                  let rec place players discarded affected = function
                    | [] -> apply players discarded affected rest
                    | id :: ids ->
                        let buyer = player players attacker_id in
                        let defender = player players defender_id in
                        let returned = ability = Cards.Coerce || protected in
                        if returned && List.length defender.hand < 7 then
                          let players =
                            update players defender_id (fun p ->
                                { p with hand = p.hand @ [ id ] })
                          in
                          place players discarded
                            (affected
                            @ [
                                {
                                  Event.card_id = id;
                                  destination =
                                    To_hand
                                      {
                                        player_id = defender_id;
                                        suspended = false;
                                      };
                                };
                              ])
                            ids
                        else if returned || ability = Cards.Kill then
                          place players (discarded @ [ id ])
                            (affected
                            @ [
                                { Event.card_id = id; destination = To_discard };
                              ])
                            ids
                        else if
                          Player_state.distributors buyer
                          < Player_state.capacity buyer
                        then
                          let players =
                            update players attacker_id (fun p ->
                                {
                                  p with
                                  active_card_ids = p.active_card_ids @ [ id ];
                                })
                          in
                          place players discarded
                            (affected
                            @ [
                                {
                                  Event.card_id = id;
                                  destination =
                                    To_active { player_id = attacker_id };
                                };
                              ])
                            ids
                        else if List.length buyer.hand < 7 then
                          let players =
                            update players attacker_id (fun p ->
                                {
                                  p with
                                  hand = p.hand @ [ id ];
                                  suspended_card_ids =
                                    p.suspended_card_ids @ [ id ];
                                })
                          in
                          place players discarded
                            (affected
                            @ [
                                {
                                  Event.card_id = id;
                                  destination =
                                    To_hand
                                      {
                                        player_id = attacker_id;
                                        suspended = true;
                                      };
                                };
                              ])
                            ids
                        else fail Hand_full "hand"
                  in
                  place players discarded affected group
            in
            apply players [] [] target_ids)
  | _ -> fail Invalid_card "operator_id"

let interception_payment players ~defender_id ~operator_id =
  let defender = player players defender_id in
  if
    Player_state.has_crew defender Cards.Pipeline
    && Player_state.operators defender < 2
  then
    Result.to_option
      (Payment.resolve defender.resources (card operator_id).activation_cost
         ~picks:None)
  else None

let trade players ~player_id ~own_card_id ~rival_card_id =
  let owner = player players player_id in
  let rival = player players (1 - player_id) in
  if owner.traded_distributors then fail Invalid_choice "traded_distributors"
  else if not (Player_state.has_crew owner Cards.Arts_district) then
    fail Crew_unavailable "crew"
  else if
    not
      (Cards.is_distributor own_card_id
      && List.mem own_card_id owner.active_card_ids)
  then fail Invalid_choice "own_card_id"
  else if
    not
      (Cards.is_distributor rival_card_id
      && List.mem rival_card_id rival.active_card_ids)
  then fail Invalid_choice "rival_card_id"
  else
    Payment.resolve owner.resources
      ((card own_card_id).activation_cost @ (card rival_card_id).activation_cost)
      ~picks:None
