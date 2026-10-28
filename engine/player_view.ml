type phase =
  | Awaiting_opening
  | Ready
  | Play
  | Draw_discard
  | Legit_cash
  | Trim
  | Intercept
  | Over

type win_reason = Elimination | Expansion

type public_player = {
  player_id : int;
  resources : Resource_bank.t;
  active_card_ids : int list;
  hand_count : int;
}

type pending =
  | Draw_choice of int list
  | Cash_legit of int
  | Trim_bank
  | Post_action_trim
  | Interception of {
      attacker_id : int;
      operator_id : int;
      target_ids : int list;
    }

type t = {
  player_id : int;
  phase : phase;
  turn_number : int;
  active_player : int option;
  decision_owner : int option;
  winner : int option;
  win_reason : win_reason option;
  players : public_player list;
  hand : int list;
  suspended_card_ids : int list;
  draw_price : int;
  traded_distributors : bool;
  resource_limit : int;
  trade_rate : int;
  distributor_capacity : int;
  draw_pile_count : int;
  discard_count : int;
  own_pending_decision : pending option;
}

type observation = { view : t; legal_commands : Command.t list }

let observe state ~player_id =
  if player_id <> 0 && player_id <> 1 then
    Error (Command.reject Invalid_actor "player_id")
  else
    let s = State.snapshot state in
    let own = List.nth s.players player_id in
    let decision_owner, pending =
      match s.pending_decision with
      | None -> (None, None)
      | Some (State.Pending_draw_discard { player_id; card_ids }) ->
          (Some player_id, Some (Draw_choice card_ids))
      | Some (Pending_legit_cash { player_id; drawn_card_id }) ->
          (Some player_id, Some (Cash_legit drawn_card_id))
      | Some (Pending_trim { player_id }) -> (Some player_id, Some Trim_bank)
      | Some (Pending_post_action_trim { player_id }) ->
          (Some player_id, Some Post_action_trim)
      | Some
          (Pending_intercept
             { player_id; attacker_id; operator_id; target_ids; _ }) ->
          ( Some player_id,
            Some (Interception { attacker_id; operator_id; target_ids }) )
    in
    let phase =
      match s.phase with
      | State.Awaiting_opening -> Awaiting_opening
      | Ready -> Ready
      | Play -> Play
      | Draw_discard -> Draw_discard
      | Legit_cash -> Legit_cash
      | Trim -> Trim
      | Intercept -> Intercept
      | Over -> Over
    in
    let winner, win_reason =
      match s.outcome with
      | None -> (None, None)
      | Some o ->
          ( Some o.winner,
            Some
              (match o.reason with
              | Event.Elimination -> Elimination
              | Expansion -> Expansion) )
    in
    Ok
      {
        view =
          {
            player_id;
            phase;
            turn_number = s.turn_number;
            active_player = s.active_player;
            decision_owner;
            winner;
            win_reason;
            players =
              List.mapi
                (fun player_id (p : Player_state.t) ->
                  {
                    player_id;
                    resources = p.resources;
                    active_card_ids = p.active_card_ids;
                    hand_count = List.length p.hand;
                  })
                s.players;
            hand = own.hand;
            suspended_card_ids = own.suspended_card_ids;
            draw_price = own.draw_price;
            traded_distributors = own.traded_distributors;
            resource_limit = Player_state.resource_limit own;
            trade_rate = Player_state.trade_rate own;
            distributor_capacity = Player_state.capacity own;
            draw_pile_count = List.length s.deck;
            discard_count = List.length s.discard;
            own_pending_decision =
              (if decision_owner = Some player_id then pending else None);
          };
        legal_commands = Engine.legal_commands state ~player_id;
      }

let phase_name = function
  | Awaiting_opening -> "awaiting_opening"
  | Ready -> "ready"
  | Play -> "play"
  | Draw_discard -> "draw_discard"
  | Legit_cash -> "legit_cash"
  | Trim -> "trim"
  | Intercept -> "intercept"
  | Over -> "over"

let observation_to_value observation =
  let open Wire_value in
  let ints xs = Array (List.map int_value xs) in
  let optional f = function None -> Null | Some x -> f x in
  let v = observation.view in
  let pending = function
    | Draw_choice card_ids ->
        Object
          [ ("decision", String "draw_discard"); ("card_ids", ints card_ids) ]
    | Cash_legit id ->
        Object
          [ ("decision", String "legit_cash"); ("drawn_card_id", int_value id) ]
    | Trim_bank -> Object [ ("decision", String "trim") ]
    | Post_action_trim -> Object [ ("decision", String "post_action_trim") ]
    | Interception { attacker_id; operator_id; target_ids } ->
        Object
          [
            ("decision", String "intercept");
            ("attacker_id", int_value attacker_id);
            ("operator_id", int_value operator_id);
            ("target_ids", ints target_ids);
          ]
  in
  Object
    [
      ( "view",
        Object
          [
            ("player_id", int_value v.player_id);
            ("phase", String (phase_name v.phase));
            ("turn_number", int_value v.turn_number);
            ("active_player", optional int_value v.active_player);
            ("decision_owner", optional int_value v.decision_owner);
            ("winner", optional int_value v.winner);
            ( "win_reason",
              optional
                (fun x ->
                  String
                    (match x with
                    | Elimination -> "elimination"
                    | Expansion -> "expansion"))
                v.win_reason );
            ( "players",
              Array
                (List.map
                   (fun (p : public_player) ->
                     Object
                       [
                         ("player_id", int_value p.player_id);
                         ("resources", Resource_bank.to_value p.resources);
                         ("active_card_ids", ints p.active_card_ids);
                         ("hand_count", int_value p.hand_count);
                       ])
                   v.players) );
            ("hand", ints v.hand);
            ("suspended_card_ids", ints v.suspended_card_ids);
            ("draw_price", int_value v.draw_price);
            ("traded_distributors", Bool v.traded_distributors);
            ("resource_limit", int_value v.resource_limit);
            ("trade_rate", int_value v.trade_rate);
            ("distributor_capacity", int_value v.distributor_capacity);
            ("draw_pile_count", int_value v.draw_pile_count);
            ("discard_count", int_value v.discard_count);
            ("own_pending_decision", optional pending v.own_pending_decision);
          ] );
      ( "legal_commands",
        Array (List.map Command.to_value observation.legal_commands) );
    ]

let observation_of_value value =
  let open Wire_value in
  let malformed () =
    Error (Command.reject Malformed_command "policy_observation")
  in
  try
    let natural v =
      let n = int v in
      if n < 0 then raise (Decode_error "count") else n
    in
    let actor v =
      let n = int v in
      if n <> 0 && n <> 1 then raise (Decode_error "actor") else n
    in
    let card v =
      let n = int v in
      if Cards.find n = None then raise (Decode_error "card") else n
    in
    let ids v = List.map card (array v) in
    let optional f = function Null -> None | v -> Some (f v) in
    let bool = function Bool b -> b | _ -> raise (Decode_error "bool") in
    let outer = fields [ "view"; "legal_commands" ] value in
    let f =
      fields
        [
          "player_id";
          "phase";
          "turn_number";
          "active_player";
          "decision_owner";
          "winner";
          "win_reason";
          "players";
          "hand";
          "suspended_card_ids";
          "draw_price";
          "traded_distributors";
          "resource_limit";
          "trade_rate";
          "distributor_capacity";
          "draw_pile_count";
          "discard_count";
          "own_pending_decision";
        ]
        (field "view" outer)
    in
    let player_id = int (field "player_id" f) in
    if player_id <> 0 && player_id <> 1 then
      Error (Command.reject Invalid_actor "player_id")
    else
      let pending value =
        let kind =
          match value with
          | Object f -> string (field "decision" f)
          | _ -> raise (Decode_error "pending")
        in
        match kind with
        | "draw_discard" ->
            let f = fields [ "decision"; "card_ids" ] value in
            Draw_choice (ids (field "card_ids" f))
        | "legit_cash" ->
            let f = fields [ "decision"; "drawn_card_id" ] value in
            Cash_legit (card (field "drawn_card_id" f))
        | "trim" ->
            ignore (fields [ "decision" ] value);
            Trim_bank
        | "post_action_trim" ->
            ignore (fields [ "decision" ] value);
            Post_action_trim
        | "intercept" ->
            let f =
              fields
                [ "decision"; "attacker_id"; "operator_id"; "target_ids" ]
                value
            in
            Interception
              {
                attacker_id = actor (field "attacker_id" f);
                operator_id = card (field "operator_id" f);
                target_ids = ids (field "target_ids" f);
              }
        | _ -> raise (Decode_error "decision")
      in
      let players =
        List.map
          (fun value ->
            let f =
              fields
                [ "player_id"; "resources"; "active_card_ids"; "hand_count" ]
                value
            in
            let resources = Resource_bank.of_value (field "resources" f) in
            if
              List.exists
                (fun c -> Resource_bank.get resources c < 0)
                Resource_bank.colors
            then raise (Decode_error "resources");
            {
              player_id = actor (field "player_id" f);
              resources;
              active_card_ids = ids (field "active_card_ids" f);
              hand_count = natural (field "hand_count" f);
            })
          (array (field "players" f))
      in
      if List.map (fun (p : public_player) -> p.player_id) players <> [ 0; 1 ]
      then raise (Decode_error "players");
      let phase =
        match string (field "phase" f) with
        | "awaiting_opening" -> Awaiting_opening
        | "ready" -> Ready
        | "play" -> Play
        | "draw_discard" -> Draw_discard
        | "legit_cash" -> Legit_cash
        | "trim" -> Trim
        | "intercept" -> Intercept
        | "over" -> Over
        | _ -> raise (Decode_error "phase")
      in
      let win_reason =
        optional
          (fun v ->
            match string v with
            | "elimination" -> Elimination
            | "expansion" -> Expansion
            | _ -> raise (Decode_error "reason"))
          (field "win_reason" f)
      in
      let view =
        {
          player_id;
          phase;
          players;
          win_reason;
          turn_number = natural (field "turn_number" f);
          active_player = optional actor (field "active_player" f);
          decision_owner = optional actor (field "decision_owner" f);
          winner = optional actor (field "winner" f);
          hand = ids (field "hand" f);
          suspended_card_ids = ids (field "suspended_card_ids" f);
          draw_price = natural (field "draw_price" f);
          traded_distributors = bool (field "traded_distributors" f);
          resource_limit = natural (field "resource_limit" f);
          trade_rate = natural (field "trade_rate" f);
          distributor_capacity = natural (field "distributor_capacity" f);
          draw_pile_count = natural (field "draw_pile_count" f);
          discard_count = natural (field "discard_count" f);
          own_pending_decision =
            optional pending (field "own_pending_decision" f);
        }
      in
      let commands =
        List.map
          (fun value ->
            match value with
            | Object f -> (
                match
                  Command.of_value
                    (Object (("player_id", int_value player_id) :: f))
                with
                | Ok (_, c) -> c
                | Error _ -> raise (Decode_error "command"))
            | _ -> raise (Decode_error "command"))
          (array (field "legal_commands" outer))
      in
      Ok { view; legal_commands = commands }
  with Decode_error _ -> malformed ()
