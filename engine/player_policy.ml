open Player_view

let card id = Option.get (Cards.find id)
let count predicate xs = List.length (List.filter predicate xs)

let operator id =
  match (card id).category with Cards.Operator _ -> true | _ -> false

let legit id = (card id).category = Cards.Legit
let distributor id = (card id).category = Cards.Distributor

let ranked score xs =
  List.stable_sort (fun a b -> Int.compare (score b) (score a)) xs

let discard_score id =
  match (card id).category with
  | Cards.Operator _ -> 20
  | Distributor -> 60
  | Legit -> 80

let propose (view : t) ~legal_commands =
  let offered command = List.find_opt (( = ) command) legal_commands in
  let required command =
    match command with
    | Some command -> Ok (Some command)
    | None -> Error (Command.reject Invalid_state "policy_legal_commands")
  in
  let own = List.nth view.players view.player_id in
  let other = List.nth view.players (1 - view.player_id) in
  match view.phase with
  | Awaiting_opening | Over -> Ok None
  | _
    when view.decision_owner <> None
         && view.decision_owner <> Some view.player_id ->
      Ok None
  | _ when view.decision_owner = Some view.player_id ->
      let command =
        match view.own_pending_decision with
        | Some (Draw_choice ids) ->
            List.find_map
              (fun card_id -> offered (Command.Discard_draw_choice { card_id }))
              (List.stable_sort
                 (fun a b -> Int.compare (discard_score a) (discard_score b))
                 ids)
        | Some (Cash_legit card_id) ->
            offered
              (Command.Cash_card { card_id; color = (card card_id).color })
        | Some (Trim_bank | Post_action_trim) ->
            let score c =
              (20 * Resource_bank.get own.resources c)
              - (7 * min 2 (count (fun id -> (card id).color = c) view.hand))
            in
            List.find_map
              (fun color -> offered (Command.Trim_resource { color }))
              (ranked score
                 (List.filter
                    (fun c -> Resource_bank.get own.resources c > 0)
                    Resource_bank.colors))
        | Some (Interception _) ->
            offered (Command.Respond_intercept { accept = true })
        | None -> None
      in
      required command
  | _ when view.active_player <> Some view.player_id -> Ok None
  | Ready -> required (offered Command.Collect_income)
  | Play ->
      let room =
        count distributor own.active_card_ids < view.distributor_capacity
      in
      let legits = count legit own.active_card_ids in
      let operators_active = count operator own.active_card_ids in
      let business_count =
        count (fun id -> not (operator id)) own.active_card_ids
      in
      let partners id =
        count
          (fun x -> distributor x && (card x).crew = (card id).crew)
          own.active_card_ids
      in
      let score id =
        match (card id).category with
        | Cards.Distributor ->
            60 + (25 * partners id) + if business_count = 11 then 200 else 0
        | Legit -> if room then 35 else 120
        | Operator _ -> 15
      in
      let possible id =
        match (card id).category with
        | Cards.Distributor -> room
        | Legit -> legits < 3
        | Operator _ -> operators_active < 2
      in
      let businesses =
        ranked score
          (List.filter (fun id -> (not (operator id)) && possible id) view.hand)
      in
      let activation id =
        match
          Payment.resolve own.resources (card id).activation_cost ~picks:None
        with
        | Error _ -> None
        | Ok paid ->
            let fixed_count =
              count
                (function Cards.Fixed _ -> true | Any -> false)
                (card id).activation_cost
            in
            let wildcard_payment =
              if legit id then
                Some (List.filteri (fun i _ -> i >= fixed_count) paid.colors)
              else None
            in
            offered (Command.Activate_card { card_id = id; wildcard_payment })
      in
      let target_score id =
        match (card id).crew with
        | Some c when Cards.complete_crew other.active_card_ids c -> 12
        | _ -> 5
      in
      let targets =
        ranked target_score (List.filter distributor other.active_card_ids)
      in
      let attack_cost op target =
        let cost = (card target).activation_cost in
        match (card op).category with
        | Cards.Operator Buy -> cost @ cost
        | _ -> cost
      in
      let attacks =
        List.concat_map
          (fun op ->
            List.filter_map
              (fun target ->
                if
                  (card op).category = Cards.Operator Buy
                  && (not room)
                  && List.length view.hand >= 7
                then None
                else Some (op, target, attack_cost op target))
              targets)
          (List.filter operator own.active_card_ids)
      in
      let attack (op, target, _) =
        match
          offered
            (Command.Use_operator { operator_id = op; target_ids = [ target ] })
        with
        | None -> None
        | Some primary -> (
            match
              List.find_map
                (fun second ->
                  if second = target then None
                  else
                    offered
                      (Command.Use_operator
                         { operator_id = op; target_ids = [ target; second ] }))
                targets
            with
            | Some combined -> Some combined
            | None -> Some primary)
      in
      let protect id =
        if legit id then legits < 3
        else if distributor id then
          count
            (fun x -> x <> id && (card x).crew = (card id).crew)
            (own.active_card_ids @ view.hand)
          >= 2
          || room
             && List.exists
                  (fun x -> distributor x && (card x).color = (card id).color)
                  own.active_card_ids
        else false
      in
      let funding costs keep =
        let threshold = match keep with None -> 45 | Some id -> score id in
        let donors =
          List.stable_sort
            (fun a b -> Int.compare (score a) (score b))
            (List.filter
               (fun id ->
                 Some id <> keep && (not (protect id)) && score id <= threshold)
               view.hand)
        in
        let fixed =
          List.fold_left
            (fun bank -> function
              | Cards.Fixed c -> Resource_bank.add bank c 1 | Any -> bank)
            Resource_bank.zero costs
        in
        let rec plan guard bank donors first =
          if guard = 20 then None
          else if Result.is_ok (Payment.resolve bank costs ~picks:None) then
            Option.bind first offered
          else
            let missing =
              List.find_opt
                (fun c -> Resource_bank.get bank c < Resource_bank.get fixed c)
                Resource_bank.colors
            in
            let from =
              Option.bind missing (fun to_color ->
                  List.find_opt
                    (fun _ -> true)
                    (ranked
                       (fun c ->
                         Resource_bank.get bank c - Resource_bank.get fixed c)
                       (List.filter
                          (fun c ->
                            c <> to_color
                            && Resource_bank.get bank c
                               - Resource_bank.get fixed c
                               >= view.trade_rate
                            && view.trade_rate > 0)
                          Resource_bank.colors)))
            in
            match (missing, from) with
            | Some to_color, Some from_color ->
                let step = Command.Trade_resources { from_color; to_color } in
                plan (guard + 1)
                  (Resource_bank.add
                     (Resource_bank.add bank from_color (-view.trade_rate))
                     to_color 1)
                  donors
                  (match first with None -> Some step | _ -> first)
            | _ -> (
                let donor =
                  List.find_opt
                    (fun id ->
                      match missing with
                      | None -> true
                      | Some c -> (card id).color = c || legit id)
                    donors
                in
                match donor with
                | None -> None
                | Some id when Resource_bank.total bank >= view.resource_limit
                  ->
                    ignore id;
                    None
                | Some id ->
                    let color = Option.value ~default:(card id).color missing in
                    let step = Command.Cash_card { card_id = id; color } in
                    plan (guard + 1)
                      (Resource_bank.add bank color 1)
                      (List.filter (( <> ) id) donors)
                      (match first with None -> Some step | _ -> first))
        in
        plan 0 own.resources donors None
      in
      let operators =
        List.filter (fun id -> operator id && possible id) view.hand
      in
      let arts () =
        List.find_map
          (fun rival_card_id ->
            if partners rival_card_id <> 2 then None
            else
              List.find_map
                (fun own_card_id ->
                  if
                    (not (distributor own_card_id)) || partners own_card_id <> 1
                  then None
                  else
                    offered
                      (Command.Trade_distributors { own_card_id; rival_card_id }))
                own.active_card_ids)
          targets
      in
      let draw () =
        if view.draw_price > 26 then None
        else
          match
            Payment.resolve own.resources
              (List.init view.draw_price (fun _ -> Cards.Any))
              ~picks:None
          with
          | Error _ -> None
          | Ok paid -> (
              let payment =
                List.concat_map
                  (fun c ->
                    List.init (Resource_bank.get paid.debit c) (fun _ -> c))
                  Resource_bank.colors
              in
              match
                offered (Command.Draw_card { payment; use_docks_bonus = true })
              with
              | Some command -> Some command
              | None ->
                  offered
                    (Command.Draw_card { payment; use_docks_bonus = false }))
      in
      let spare () =
        let spares =
          List.stable_sort
            (fun a b -> Int.compare (score a) (score b))
            (List.filter
               (fun id ->
                 if legit id then legits >= 3
                 else if operator id then
                   operators_active >= 2 || targets = []
                   || List.length operators > 1
                 else
                   (not room)
                   && List.length view.hand = 7
                   && (not (List.exists legit view.hand))
                   && not (protect id))
               view.hand)
        in
        let needed =
          max 0 (view.draw_price - Resource_bank.total own.resources)
        in
        if
          view.draw_pile_count + view.discard_count > 0
          && spares <> []
          && Resource_bank.total own.resources < view.resource_limit
          && view.draw_price <= 10
          && List.length spares >= needed
          && (needed > 0 || List.length view.hand = 7)
        then
          let card_id = List.hd spares in
          offered (Command.Cash_card { card_id; color = (card card_id).color })
        else None
      in
      let stages =
        [
          (fun () -> List.find_map activation businesses);
          (fun () -> List.find_map attack attacks);
          (fun () ->
            List.find_map
              (fun id -> funding (card id).activation_cost (Some id))
              businesses);
          (fun () -> List.find_map activation operators);
          (fun () ->
            List.find_map (fun (_, _, cost) -> funding cost None) attacks);
          (fun () ->
            List.find_map
              (fun id -> funding (card id).activation_cost (Some id))
              operators);
          arts;
          draw;
          spare;
          (fun () -> offered Command.End_turn);
        ]
      in
      required (List.find_map (fun stage -> stage ()) stages)
  | Draw_discard | Legit_cash | Trim | Intercept -> required None
