type transition = { state : State.t; events : Event.t list }

let create_session ~seed =
  match Random_source.of_hex seed with
  | None -> Error (Command.reject Invalid_seed "seed")
  | Some random_source -> Ok (State.create random_source)

let player (snapshot : State.snapshot) player_id =
  List.nth snapshot.players player_id

let update_player (snapshot : State.snapshot) player_id transform =
  {
    snapshot with
    players =
      List.mapi
        (fun index value ->
          if index = player_id then transform value else value)
        snapshot.players;
  }

let failure code field = Some (Command.reject code field)

let ordinary_rejection state ~player_id command =
  let snapshot = State.snapshot state in
  match command with
  | Command.Start_game { opening_distributor } ->
      if player_id <> 0 then failure Invalid_actor "player_id"
      else if snapshot.phase <> State.Awaiting_opening then
        failure Wrong_phase "phase"
      else if not (Cards.is_distributor opening_distributor) then
        failure Invalid_opening "opening_distributor"
      else None
  | _ -> (
      if
        (player_id <> 0 && player_id <> 1)
        || snapshot.active_player <> Some player_id
      then failure Invalid_actor "player_id"
      else
        let phase_allowed =
          match command with
          | Collect_income -> snapshot.phase = Ready
          | Draw_card _ | Trade_resources _ | End_turn | Activate_card _
          | Use_operator _ | Trade_distributors _ ->
              snapshot.phase = Play
          | Discard_draw_choice _ -> snapshot.phase = Draw_discard
          | Cash_card _ -> snapshot.phase = Play || snapshot.phase = Legit_cash
          | Trim_resource _ -> snapshot.phase = Trim
          | Start_game _ -> false
          | Respond_intercept _ -> false
        in
        if not phase_allowed then failure Wrong_phase "phase"
        else
          let owner = player snapshot player_id in
          match command with
          | Draw_card { payment; use_docks_bonus } -> (
              if use_docks_bonus && not (State.has_crew owner Cards.Docks) then
                failure Crew_unavailable "use_docks_bonus"
              else if List.length owner.hand >= 7 then failure Hand_full "hand"
              else if
                List.length snapshot.deck + List.length snapshot.discard
                < if use_docks_bonus then 2 else 1
              then failure Insufficient_cards "deck"
              else if List.length payment <> owner.draw_price then
                failure Invalid_payment "payment"
              else
                match
                  Payment.resolve owner.resources
                    (List.map (fun color -> Cards.Fixed color) payment)
                    ~picks:None
                with
                | Ok _ -> None
                | Error rejection -> Some rejection)
          | Discard_draw_choice { card_id } -> (
              match snapshot.pending_decision with
              | Some (Pending_draw_discard { card_ids; _ })
                when List.mem card_id card_ids && List.mem card_id owner.hand ->
                  None
              | _ -> failure Invalid_choice "card_id")
          | Cash_card { card_id; color } ->
              if not (List.mem card_id owner.hand) then
                failure Invalid_card "card_id"
              else
                let card = Option.get (Cards.find card_id) in
                if snapshot.phase = Legit_cash && card.category <> Cards.Legit
                then failure Invalid_choice "card_id"
                else if card.category <> Cards.Legit && card.color <> color then
                  failure Invalid_choice "color"
                else if
                  snapshot.phase = Play
                  && Resource_bank.total owner.resources
                     >= State.resource_limit owner
                then failure Resource_limit "resources"
                else None
          | Trim_resource { color } ->
              if Resource_bank.get owner.resources color = 0 then
                failure Invalid_choice "color"
              else None
          | Trade_resources { from_color; to_color } ->
              if from_color = to_color then failure Invalid_choice "to_color"
              else if
                Resource_bank.get owner.resources from_color
                < State.trade_rate owner
              then failure Insufficient_resources "from_color"
              else None
          | End_turn when player_id = 1 && snapshot.turn_number = 2147483647 ->
              failure Invalid_state "turn_number"
          | Activate_card { card_id; wildcard_payment } -> (
              match Card_action.activate owner ~card_id ~wildcard_payment with
              | Ok _ -> None
              | Error rejection -> Some rejection)
          | Use_operator { operator_id; target_ids } -> (
              match
                Card_action.attack snapshot.players ~attacker_id:player_id
                  ~operator_id ~target_ids
              with
              | Ok _ -> None
              | Error rejection -> Some rejection)
          | Trade_distributors { own_card_id; rival_card_id } -> (
              match
                Card_action.trade snapshot.players ~player_id ~own_card_id
                  ~rival_card_id
              with
              | Ok _ -> None
              | Error rejection -> Some rejection)
          | Collect_income | End_turn -> None
          | Start_game _ | Respond_intercept _ -> assert false)

let command_rejection state ~player_id command =
  let snapshot = State.snapshot state in
  if player_id <> 0 && player_id <> 1 then failure Invalid_actor "player_id"
  else if snapshot.phase = State.Over then failure Game_over "phase"
  else
    match (command, snapshot.pending_decision) with
    | Command.Respond_intercept _, _ -> (
        if snapshot.phase <> Intercept then failure Wrong_phase "phase"
        else
          match snapshot.pending_decision with
          | Some (Pending_intercept { player_id = owner; _ })
            when owner = player_id ->
              None
          | _ -> failure Invalid_actor "player_id")
    | ( Trim_resource { color },
        Some (Pending_post_action_trim { player_id = owner }) ) ->
        if owner <> player_id then failure Invalid_actor "player_id"
        else if
          Resource_bank.get (player snapshot player_id).resources color = 0
        then failure Invalid_choice "color"
        else None
    | _ -> ordinary_rejection state ~player_id command

let conclude snapshot events =
  match
    State.of_snapshot
      { snapshot with history = snapshot.State.history @ events }
  with
  | Ok state -> Ok { state; events }
  | Error rejection -> Error rejection

let crew_changes (before : State.snapshot) (after : State.snapshot) =
  List.concat_map
    (fun player_id ->
      List.filter_map
        (fun crew ->
          let was = State.has_crew (player before player_id) crew in
          let now = State.has_crew (player after player_id) crew in
          if was = now then None
          else if now then Some (Event.Crew_completed { player_id; crew })
          else Some (Event.Crew_lost { player_id; crew }))
        Cards.crews)
    [ 0; 1 ]

let finish_action before (snapshot : State.snapshot) events =
  let events = events @ crew_changes before snapshot in
  match State.board_outcome snapshot.players with
  | Some (Some outcome) ->
      conclude
        {
          snapshot with
          phase = Over;
          outcome = Some outcome;
          pending_decision = None;
        }
        (events
        @ [
            Event.Game_finished
              { winner = outcome.winner; reason = outcome.reason };
          ])
  | Some None -> (
      match
        List.find_opt
          (fun who ->
            let owner = player snapshot who in
            Resource_bank.total owner.resources > State.resource_limit owner)
          [ 0; 1 ]
      with
      | None ->
          conclude
            { snapshot with phase = Play; pending_decision = None }
            events
      | Some player_id ->
          conclude
            {
              snapshot with
              phase = Trim;
              pending_decision = Some (Pending_post_action_trim { player_id });
            }
            (events
            @ [
                Event.Decision_required
                  { player_id; decision = Post_action_trim };
              ]))
  | None -> Error (Command.reject Invalid_state "outcome")

let execute_attack (before : State.snapshot) ~player_id ~operator_id ~target_ids
    (attack : Card_action.attack) prefix =
  let snapshot =
    {
      before with
      phase = Play;
      pending_decision = None;
      players = attack.players;
      discard = before.discard @ attack.discarded @ [ operator_id ];
    }
  in
  let snapshot =
    update_player snapshot player_id (fun owner ->
        {
          owner with
          resources = attack.paid.remaining;
          active_card_ids =
            List.filter (( <> ) operator_id) owner.active_card_ids;
        })
  in
  finish_action before snapshot
    (prefix
    @ [
        Event.Payment_made { player_id; resources = attack.paid.debit };
        Operator_result
          { player_id; operator_id; target_ids; affected = attack.affected };
        Operator_disposed { player_id; operator_id };
      ])

let continue (snapshot : State.snapshot) ~player_id ~drawn_card_id =
  let owner = player snapshot player_id in
  let phase, pending_decision, decision =
    if State.possessed_legits owner > 3 then
      let drawn_card_id = Option.get drawn_card_id in
      ( State.Legit_cash,
        Some (State.Pending_legit_cash { player_id; drawn_card_id }),
        Some Event.Forced_cash )
    else if Resource_bank.total owner.resources > State.resource_limit owner
    then (Trim, Some (Pending_trim { player_id }), Some Resource_trim)
    else (Play, None, None)
  in
  ( { snapshot with phase; pending_decision },
    match decision with
    | None -> []
    | Some decision -> [ Event.Decision_required { player_id; decision } ] )

let draw_cards ~draw_index (snapshot : State.snapshot) ~player_id count =
  let rec draw snapshot count ids events =
    if count = 0 then (snapshot, List.rev ids, events)
    else
      let snapshot, events =
        if snapshot.State.deck <> [] then (snapshot, events)
        else
          let deck, random_source =
            Setup.shuffle ~draw_index ~random_source:snapshot.random_source
              snapshot.discard
          in
          ( { snapshot with deck; discard = []; random_source },
            events
            @ [ Event.Deck_reshuffled { player_id; count = List.length deck } ]
          )
      in
      match List.rev snapshot.deck with
      | id :: rest ->
          draw
            { snapshot with deck = List.rev rest }
            (count - 1) (id :: ids) events
      | [] -> invalid_arg "draw_cards requires preflight"
  in
  draw snapshot count [] []

let income ~draw_index (snapshot : State.snapshot) ~player_id =
  let owner = player snapshot player_id in
  let base =
    List.fold_left
      (fun bank id ->
        match Cards.find id with
        | Some { category = Distributor; color; _ } ->
            Resource_bank.add bank color 1
        | _ -> bank)
      Resource_bank.zero owner.active_card_ids
  in
  let resources =
    List.fold_left
      (fun bank color ->
        Resource_bank.add bank color (Resource_bank.get base color))
      owner.resources Resource_bank.colors
  in
  let snapshot =
    update_player snapshot player_id (fun owner ->
        { owner with resources; draw_price = 1; traded_distributors = false })
  in
  let events = [ Event.Income_collected { player_id; resources = base } ] in
  let snapshot, events =
    if not (State.has_crew owner Cards.Night_shift) then (snapshot, events)
    else
      let resources = (player snapshot player_id).resources in
      let color =
        List.fold_left
          (fun best color ->
            if
              Resource_bank.get resources color
              < Resource_bank.get resources best
            then color
            else best)
          Cards.Green Resource_bank.colors
      in
      ( update_player snapshot player_id (fun owner ->
            { owner with resources = Resource_bank.add owner.resources color 1 }),
        events @ [ Event.Crew_resource_granted { player_id; color } ] )
  in
  let snapshot, events, drawn_card_id =
    if
      State.has_crew owner Cards.Burbs
      && List.length owner.hand < 7
      && snapshot.deck @ snapshot.discard <> []
    then
      let snapshot, ids, shuffle_events =
        draw_cards ~draw_index snapshot ~player_id 1
      in
      let snapshot =
        update_player snapshot player_id (fun owner ->
            { owner with hand = owner.hand @ ids })
      in
      ( snapshot,
        events @ shuffle_events
        @ [
            Event.Cards_drawn
              { player_id; card_ids = ids; source = Burbs; price = None };
          ],
        Some (List.hd ids) )
    else (snapshot, events, None)
  in
  let snapshot, decisions = continue snapshot ~player_id ~drawn_card_id in
  (snapshot, events @ decisions)

let perform_with_random ~draw_index state ~player_id command =
  match command_rejection state ~player_id command with
  | Some rejection -> Error rejection
  | None -> (
      let snapshot = State.snapshot state in
      match command with
      | Command.Start_game { opening_distributor } ->
          let opening =
            Setup.deal ~draw_index ~random_source:snapshot.random_source
              ~opening_distributor
          in
          let events =
            Event.setup_events opening_distributor opening.rival_distributor
          in
          let first =
            {
              State.empty_player with
              hand = opening.first_hand;
              active_card_ids = [ opening_distributor ];
            }
          in
          let rival =
            {
              State.empty_player with
              hand = opening.rival_hand;
              active_card_ids = [ opening.rival_distributor ];
            }
          in
          conclude
            {
              snapshot with
              phase = Ready;
              turn_number = 1;
              active_player = Some 0;
              deck = opening.deck;
              players = [ first; rival ];
              random_source = opening.random_source;
            }
            events
      | Collect_income ->
          let snapshot, events = income ~draw_index snapshot ~player_id in
          conclude snapshot events
      | Draw_card { payment; use_docks_bonus } ->
          let owner = player snapshot player_id in
          let paid =
            match
              Payment.resolve owner.resources
                (List.map (fun color -> Cards.Fixed color) payment)
                ~picks:None
            with
            | Ok paid -> paid
            | Error _ -> assert false
          in
          let snapshot =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  resources = paid.remaining;
                  draw_price = owner.draw_price + 1;
                })
          in
          let snapshot, ids, shuffle_events =
            draw_cards ~draw_index snapshot ~player_id
              (if use_docks_bonus then 2 else 1)
          in
          let snapshot =
            update_player snapshot player_id (fun owner ->
                { owner with hand = owner.hand @ ids })
          in
          let events =
            Event.Payment_made { player_id; resources = paid.debit }
            :: shuffle_events
            @ [
                Event.Cards_drawn
                  {
                    player_id;
                    card_ids = ids;
                    source = Paid;
                    price = Some owner.draw_price;
                  };
              ]
          in
          if use_docks_bonus then
            conclude
              {
                snapshot with
                phase = Draw_discard;
                pending_decision =
                  Some (Pending_draw_discard { player_id; card_ids = ids });
              }
              (events
              @ [
                  Event.Decision_required
                    { player_id; decision = Docks_discard };
                ])
          else
            let snapshot, decisions =
              continue snapshot ~player_id ~drawn_card_id:(Some (List.hd ids))
            in
            conclude snapshot (events @ decisions)
      | Discard_draw_choice { card_id } ->
          let card_ids =
            match snapshot.pending_decision with
            | Some (Pending_draw_discard { card_ids; _ }) -> card_ids
            | _ -> assert false
          in
          let retained = List.find (( <> ) card_id) card_ids in
          let snapshot =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  hand = List.filter (( <> ) card_id) owner.hand;
                  suspended_card_ids =
                    List.filter (( <> ) card_id) owner.suspended_card_ids;
                })
          in
          let snapshot, decisions =
            continue
              {
                snapshot with
                discard = snapshot.discard @ [ card_id ];
                pending_decision = None;
              }
              ~player_id ~drawn_card_id:(Some retained)
          in
          conclude snapshot
            ([
               Event.Card_discarded { player_id; card_id };
               Decision_resolved { player_id; decision = Docks_discard };
             ]
            @ decisions)
      | Cash_card { card_id; color } ->
          let mandatory = snapshot.phase = Legit_cash in
          let snapshot =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  hand = List.filter (( <> ) card_id) owner.hand;
                  suspended_card_ids =
                    List.filter (( <> ) card_id) owner.suspended_card_ids;
                  resources = Resource_bank.add owner.resources color 1;
                })
          in
          let snapshot =
            {
              snapshot with
              discard = snapshot.discard @ [ card_id ];
              pending_decision = None;
            }
          in
          let events =
            [ Event.Card_cashed { player_id; card_id; color; mandatory } ]
          in
          if mandatory then
            let snapshot, decisions =
              continue snapshot ~player_id ~drawn_card_id:None
            in
            conclude snapshot
              (events
              @ [
                  Event.Decision_resolved { player_id; decision = Forced_cash };
                ]
              @ decisions)
          else conclude snapshot events
      | Trim_resource { color } ->
          let decision =
            match snapshot.pending_decision with
            | Some (Pending_post_action_trim _) -> Event.Post_action_trim
            | _ -> Resource_trim
          in
          let snapshot =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  resources = Resource_bank.add owner.resources color (-1);
                })
          in
          let owner = player snapshot player_id in
          let events = [ Event.Resource_trimmed { player_id; color } ] in
          if Resource_bank.total owner.resources > State.resource_limit owner
          then conclude snapshot events
          else
            conclude
              { snapshot with phase = Play; pending_decision = None }
              (events @ [ Event.Decision_resolved { player_id; decision } ])
      | Trade_resources { from_color; to_color } ->
          let rate = State.trade_rate (player snapshot player_id) in
          let snapshot =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  resources =
                    Resource_bank.add
                      (Resource_bank.add owner.resources from_color (-rate))
                      to_color 1;
                })
          in
          conclude snapshot
            [
              Event.Resources_traded
                { player_id; from_color; to_color; spent = rate };
            ]
      | Activate_card { card_id; wildcard_payment } ->
          let paid =
            Result.get_ok
              (Card_action.activate
                 (player snapshot player_id)
                 ~card_id ~wildcard_payment)
          in
          let changed =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  resources = paid.remaining;
                  hand = List.filter (( <> ) card_id) owner.hand;
                  suspended_card_ids =
                    List.filter (( <> ) card_id) owner.suspended_card_ids;
                  active_card_ids = owner.active_card_ids @ [ card_id ];
                })
          in
          finish_action snapshot changed
            [
              Event.Payment_made { player_id; resources = paid.debit };
              Card_activated { player_id; card_id };
            ]
      | Use_operator { operator_id; target_ids } -> (
          let attack =
            Result.get_ok
              (Card_action.attack snapshot.players ~attacker_id:player_id
                 ~operator_id ~target_ids)
          in
          let defender_id = 1 - player_id in
          match
            Card_action.interception_payment snapshot.players ~defender_id
              ~operator_id
          with
          | None ->
              execute_attack snapshot ~player_id ~operator_id ~target_ids attack
                []
          | Some _ ->
              conclude
                {
                  snapshot with
                  phase = Intercept;
                  pending_decision =
                    Some
                      (Pending_intercept
                         {
                           player_id = defender_id;
                           attacker_id = player_id;
                           operator_id;
                           target_ids;
                           payment = attack.paid.debit;
                         });
                }
                [
                  Event.Decision_required
                    { player_id = defender_id; decision = Interception };
                ])
      | Respond_intercept { accept } -> (
          match snapshot.pending_decision with
          | Some (Pending_intercept { attacker_id; operator_id; target_ids; _ })
            ->
              let answer =
                Event.Intercept_answered { player_id; operator_id; accept }
              in
              let resolved =
                Event.Decision_resolved { player_id; decision = Interception }
              in
              if accept then
                let paid =
                  Option.get
                    (Card_action.interception_payment snapshot.players
                       ~defender_id:player_id ~operator_id)
                in
                let changed =
                  update_player snapshot attacker_id (fun owner ->
                      {
                        owner with
                        active_card_ids =
                          List.filter (( <> ) operator_id) owner.active_card_ids;
                      })
                in
                let changed =
                  update_player changed player_id (fun owner ->
                      {
                        owner with
                        resources = paid.remaining;
                        active_card_ids =
                          owner.active_card_ids @ [ operator_id ];
                      })
                in
                conclude
                  { changed with phase = Play; pending_decision = None }
                  [
                    answer;
                    Payment_made { player_id; resources = paid.debit };
                    Operator_intercepted
                      { attacker_id; defender_id = player_id; operator_id };
                    resolved;
                  ]
              else
                let attack =
                  Result.get_ok
                    (Card_action.attack snapshot.players ~attacker_id
                       ~operator_id ~target_ids)
                in
                execute_attack snapshot ~player_id:attacker_id ~operator_id
                  ~target_ids attack [ answer; resolved ]
          | _ -> assert false)
      | Trade_distributors { own_card_id; rival_card_id } ->
          let paid =
            Result.get_ok
              (Card_action.trade snapshot.players ~player_id ~own_card_id
                 ~rival_card_id)
          in
          let changed =
            update_player snapshot player_id (fun owner ->
                {
                  owner with
                  resources = paid.remaining;
                  active_card_ids =
                    List.map
                      (fun id -> if id = own_card_id then rival_card_id else id)
                      owner.active_card_ids;
                  traded_distributors = true;
                })
          in
          let changed =
            update_player changed (1 - player_id) (fun owner ->
                {
                  owner with
                  active_card_ids =
                    List.map
                      (fun id -> if id = rival_card_id then own_card_id else id)
                      owner.active_card_ids;
                })
          in
          finish_action snapshot changed
            [
              Event.Payment_made { player_id; resources = paid.debit };
              Distributors_traded { player_id; own_card_id; rival_card_id };
            ]
      | End_turn ->
          let to_player = 1 - player_id in
          let turn_number =
            snapshot.turn_number + if player_id = 1 then 1 else 0
          in
          let snapshot =
            { snapshot with turn_number; active_player = Some to_player }
          in
          let snapshot, events =
            income ~draw_index snapshot ~player_id:to_player
          in
          conclude snapshot
            (Event.Turn_changed
               { from_player = player_id; to_player; turn_number }
            :: events))

let perform_command = perform_with_random ~draw_index:Random_source.choose

let payments resources count =
  let rec enumerate colors remaining count =
    if count = 0 then [ [] ]
    else
      match colors with
      | [] -> []
      | color :: rest ->
          let with_color =
            if Resource_bank.get remaining color = 0 then []
            else
              List.map
                (fun payment -> color :: payment)
                (enumerate colors
                   (Resource_bank.add remaining color (-1))
                   (count - 1))
          in
          with_color @ enumerate rest remaining count
  in
  if count > Resource_bank.total resources then []
  else enumerate Resource_bank.colors resources count

let legal_commands state ~player_id =
  let snapshot = State.snapshot state in
  let candidates =
    match snapshot.phase with
    | State.Awaiting_opening ->
        List.map
          (fun opening_distributor ->
            Command.Start_game { opening_distributor })
          Cards.opening_ids
    | Over -> []
    | Intercept ->
        [
          Command.Respond_intercept { accept = true };
          Respond_intercept { accept = false };
        ]
    | Trim
      when match snapshot.pending_decision with
           | Some (Pending_post_action_trim _) -> true
           | _ -> false ->
        List.map
          (fun color -> Command.Trim_resource { color })
          Resource_bank.colors
    | _
      when snapshot.active_player <> Some player_id
           || (player_id <> 0 && player_id <> 1) ->
        []
    | Ready -> [ Command.Collect_income ]
    | Draw_discard -> (
        match snapshot.pending_decision with
        | Some (Pending_draw_discard { card_ids; _ }) ->
            List.map
              (fun card_id -> Command.Discard_draw_choice { card_id })
              card_ids
        | _ -> [])
    | Legit_cash ->
        List.concat_map
          (fun card_id ->
            List.map
              (fun color -> Command.Cash_card { card_id; color })
              Resource_bank.colors)
          (player snapshot player_id).hand
    | Trim ->
        List.map
          (fun color -> Command.Trim_resource { color })
          Resource_bank.colors
    | Play ->
        let owner = player snapshot player_id in
        let choices = payments owner.resources owner.draw_price in
        let draws =
          List.concat_map
            (fun use_docks_bonus ->
              List.map
                (fun payment -> Command.Draw_card { payment; use_docks_bonus })
                choices)
            [ false; true ]
        in
        let cash =
          List.concat_map
            (fun card_id ->
              let card = Option.get (Cards.find card_id) in
              let colors =
                if card.category = Cards.Legit then Resource_bank.colors
                else [ card.color ]
              in
              List.map
                (fun color -> Command.Cash_card { card_id; color })
                colors)
            owner.hand
        in
        let trades =
          List.concat_map
            (fun from_color ->
              List.map
                (fun to_color ->
                  Command.Trade_resources { from_color; to_color })
                Resource_bank.colors)
            Resource_bank.colors
        in
        let activations =
          List.concat_map
            (fun card_id ->
              let card = Option.get (Cards.find card_id) in
              let choices =
                if card.category = Cards.Legit then
                  List.map (fun color -> Some [ color ]) Resource_bank.colors
                else [ None ]
              in
              List.map
                (fun wildcard_payment ->
                  Command.Activate_card { card_id; wildcard_payment })
                choices)
            owner.hand
        in
        let targets =
          List.filter Cards.is_distributor
            (player snapshot (1 - player_id)).active_card_ids
        in
        let target_lists =
          List.map (fun id -> [ id ]) targets
          @ List.concat_map
              (fun first ->
                List.filter_map
                  (fun second ->
                    if first = second then None else Some [ first; second ])
                  targets)
              targets
        in
        let operators =
          List.concat_map
            (fun operator_id ->
              match (Option.get (Cards.find operator_id)).category with
              | Cards.Operator _ ->
                  List.map
                    (fun target_ids ->
                      Command.Use_operator { operator_id; target_ids })
                    target_lists
              | _ -> [])
            owner.active_card_ids
        in
        let swaps =
          List.concat_map
            (fun own_card_id ->
              List.map
                (fun rival_card_id ->
                  Command.Trade_distributors { own_card_id; rival_card_id })
                targets)
            (List.filter Cards.is_distributor owner.active_card_ids)
        in
        draws @ cash @ trades @ activations @ operators @ swaps
        @ [ Command.End_turn ]
  in
  List.filter
    (fun command -> command_rejection state ~player_id command = None)
    candidates

module For_testing = struct
  let perform_command = perform_with_random
end
