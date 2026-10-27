type phase =
  | Awaiting_opening
  | Ready
  | Play
  | Draw_discard
  | Legit_cash
  | Trim

type resources = Resource_bank.t = {
  green : int;
  blue : int;
  black : int;
  white : int;
  yellow : int;
  purple : int;
}

type player = {
  resources : resources;
  hand : int list;
  active_card_ids : int list;
  suspended_card_ids : int list;
  draw_price : int;
}

type pending_decision =
  | Pending_draw_discard of { player_id : int; card_ids : int list }
  | Pending_legit_cash of { player_id : int; drawn_card_id : int }
  | Pending_trim of { player_id : int }

type snapshot = {
  schema_version : int;
  rules_version : string;
  phase : phase;
  turn_number : int;
  active_player : int option;
  deck : int list;
  discard : int list;
  players : player list;
  random_source : Random_source.t;
  history : Event.t list;
  pending_decision : pending_decision option;
}

type t = snapshot

let schema_version = 1
let rules_version = "prototype_4ccb197_pd002_s04_working"
let zero_resources = Resource_bank.zero

let empty_player =
  {
    resources = zero_resources;
    hand = [];
    active_card_ids = [];
    suspended_card_ids = [];
    draw_price = 1;
  }

let all_ids = List.map (fun (card : Cards.t) -> card.id) Cards.all
let snapshot state = state
let has_crew player crew = Cards.complete_crew player.active_card_ids crew
let resource_limit player = if has_crew player Cards.Night_shift then 12 else 10
let trade_rate player = if has_crew player Cards.Hill_country then 2 else 4

let count predicate ids =
  List.fold_left
    (fun total id ->
      match Cards.find id with
      | Some card when predicate card.Cards.category -> total + 1
      | _ -> total)
    0 ids

let legit_count ids = count (( = ) Cards.Legit) ids
let possessed_legits player = legit_count (player.hand @ player.active_card_ids)

let pending_kind = function
  | Pending_draw_discard _ -> Event.Docks_discard
  | Pending_legit_cash _ -> Forced_cash
  | Pending_trim _ -> Resource_trim

let pending_owner = function
  | Pending_draw_discard { player_id; _ }
  | Pending_legit_cash { player_id; _ }
  | Pending_trim { player_id } ->
      player_id

type context = {
  actor : int;
  round : int;
  anchored : bool;
  collected : bool;
  decision : Event.decision option;
  choice_made : bool;
  last_draw : (int list * Event.draw_source) option;
}

let history_context history =
  let rec split count taken remaining =
    if count = 0 then Some (List.rev taken, remaining)
    else
      match remaining with
      | [] -> None
      | item :: rest -> split (count - 1) (item :: taken) rest
  in
  let prefix = split 5 [] history in
  match prefix with
  | Some
      ( ([
           Event.Game_started _;
           Opening_distributor_chosen { player_id = 0; card_id = first };
           Opening_distributor_chosen { player_id = 1; card_id = rival };
           Initial_hand_dealt _;
           Initial_hand_dealt _;
         ] as prefix),
        rest )
    when prefix = Event.setup_events first rival
         && Cards.is_distributor first && Cards.is_distributor rival
         && (Option.get (Cards.find first)).crew
            <> (Option.get (Cards.find rival)).crew
         && (Option.get (Cards.find first)).color
            <> (Option.get (Cards.find rival)).color ->
      let rec advance context = function
        | [] -> Some context
        | event :: rest -> (
            let next =
              match event with
              | Event.Turn_changed { from_player; to_player; turn_number }
                when context.decision = None
                     && to_player = 1 - from_player
                     && ((not context.anchored)
                        || context.collected
                           && from_player = context.actor
                           && turn_number
                              = context.round + if from_player = 1 then 1 else 0
                        ) ->
                  Some
                    {
                      actor = to_player;
                      round = turn_number;
                      anchored = true;
                      collected = false;
                      decision = None;
                      choice_made = false;
                      last_draw = None;
                    }
              | Income_collected { player_id; _ }
                when player_id = context.actor && (not context.collected)
                     && context.decision = None ->
                  Some { context with collected = true }
              | Decision_required { player_id; decision }
                when player_id = context.actor && context.collected
                     && context.decision = None
                     && (decision <> Event.Docks_discard
                        ||
                        match context.last_draw with
                        | Some ([ _; _ ], Paid) -> true
                        | _ -> false) ->
                  Some
                    {
                      context with
                      decision = Some decision;
                      choice_made = false;
                    }
              | Decision_resolved { player_id; decision }
                when player_id = context.actor
                     && context.decision = Some decision
                     && context.choice_made ->
                  Some { context with decision = None; choice_made = false }
              | Cards_drawn { player_id; card_ids; source; _ }
                when player_id = context.actor && context.collected
                     && context.decision = None ->
                  Some { context with last_draw = Some (card_ids, source) }
              | Card_discarded { player_id; _ }
                when player_id = context.actor
                     && context.decision = Some Docks_discard
                     && not context.choice_made ->
                  Some { context with choice_made = true }
              | Card_cashed { player_id; mandatory = true; _ }
                when player_id = context.actor
                     && context.decision = Some Forced_cash
                     && not context.choice_made ->
                  Some { context with choice_made = true }
              | Resource_trimmed { player_id; _ }
                when player_id = context.actor
                     && context.decision = Some Resource_trim ->
                  Some { context with choice_made = true }
              | Crew_resource_granted { player_id; _ }
              | Payment_made { player_id; _ }
              | Deck_reshuffled { player_id; _ }
              | Card_cashed { player_id; mandatory = false; _ }
              | Resources_traded { player_id; _ }
                when player_id = context.actor && context.collected
                     && context.decision = None ->
                  Some context
              | _ -> None
            in
            match next with
            | None -> None
            | Some context -> advance context rest)
      in
      advance
        {
          actor = 0;
          round = 1;
          anchored = false;
          collected = false;
          decision = None;
          choice_made = false;
          last_draw = None;
        }
        rest
  | _ -> None

let of_snapshot state =
  let invalid field = Error (Command.reject Invalid_state field) in
  if
    state.schema_version <> schema_version
    || state.rules_version <> rules_version
  then Error (Command.reject Unsupported_version "version")
  else if state.turn_number < 0 || state.turn_number > 2147483647 then
    invalid "turn_number"
  else
    let locations =
      state.deck @ state.discard
      @ List.concat_map
          (fun player -> player.hand @ player.active_card_ids)
          state.players
    in
    if List.sort Int.compare locations <> all_ids then invalid "card_locations"
    else if not (List.for_all Event.valid state.history) then invalid "history"
    else
      match state.players with
      | [ first; rival ] -> (
          let pending_for index = state.active_player = Some index in
          let player_valid index player =
            let active_legits = legit_count player.active_card_ids in
            let distributors =
              count (( = ) Cards.Distributor) player.active_card_ids
            in
            let operators =
              count
                (function Cards.Operator _ -> true | _ -> false)
                player.active_card_ids
            in
            let active = pending_for index in
            let hand_limit =
              if active && state.phase = Draw_discard then 8 else 7
            in
            let legit_limit =
              if active && state.phase = Draw_discard then 5
              else if active && state.phase = Legit_cash then 4
              else 3
            in
            (* The compulsory cash adds the 26th possible unit; before it, at most25. *)
            let max_bank =
              if active && state.phase = Legit_cash then 25
              else if active && state.phase = Trim then 26
              else resource_limit player
            in
            Resource_bank.valid ~max_total:max_bank player.resources
            && player.draw_price >= 1 && player.draw_price <= 13
            && List.length player.hand <= hand_limit
            && possessed_legits player <= legit_limit
            && active_legits <= 3
            && distributors <= 3 * (active_legits + 1)
            && operators <= 2
            && List.sort_uniq Int.compare player.suspended_card_ids
               = List.sort Int.compare player.suspended_card_ids
            && List.for_all
                 (fun id -> List.mem id player.hand && Cards.is_distributor id)
                 player.suspended_card_ids
          in
          if not (player_valid 0 first && player_valid 1 rival) then
            invalid "players"
          else
            match state.phase with
            | Awaiting_opening ->
                if
                  state.turn_number = 0 && state.active_player = None
                  && state.deck = all_ids && state.discard = []
                  && state.players = [ empty_player; empty_player ]
                  && state.history = []
                  && state.pending_decision = None
                then Ok state
                else invalid "awaiting_opening"
            | Ready -> (
                match (first.active_card_ids, rival.active_card_ids) with
                | [ first_id ], [ rival_id ] -> (
                    match (Cards.find first_id, Cards.find rival_id) with
                    | Some first_card, Some rival_card
                      when first_card.category = Cards.Distributor
                           && rival_card.category = Cards.Distributor
                           && first_card.crew <> rival_card.crew
                           && first_card.color <> rival_card.color ->
                        if
                          state.turn_number = 1
                          && state.active_player = Some 0
                          && state.discard = []
                          && state.pending_decision = None
                          && List.length first.hand = 3
                          && List.length rival.hand = 3
                          && List.length state.deck = 28
                          && List.for_all
                               (fun player ->
                                 player.resources = zero_resources
                                 && player.draw_price = 1
                                 && player.suspended_card_ids = [])
                               state.players
                          && state.history
                             = Event.setup_events first_id rival_id
                        then Ok state
                        else invalid "ready"
                    | _ -> invalid "opening_distributors")
                | _ -> invalid "opening_distributors")
            | Play | Draw_discard | Legit_cash | Trim -> (
                match (state.active_player, history_context state.history) with
                | Some actor, Some context
                  when (actor = 0 || actor = 1)
                       && state.turn_number >= 1 && context.actor = actor
                       && context.round = state.turn_number
                       && context.collected
                       && context.decision
                          = Option.map pending_kind state.pending_decision
                       &&
                       match state.pending_decision with
                       | None -> true
                       | Some pending -> pending_owner pending = actor ->
                    let player = List.nth state.players actor in
                    let valid =
                      match (state.phase, state.pending_decision) with
                      | Play, None -> true
                      | ( Draw_discard,
                          Some
                            (Pending_draw_discard
                               { player_id; card_ids = [ first_id; second_id ] })
                        ) ->
                          let before_draw =
                            {
                              player with
                              hand =
                                List.filter
                                  (fun id -> id <> first_id && id <> second_id)
                                  player.hand;
                            }
                          in
                          player_id = actor && first_id <> second_id
                          && List.mem first_id player.hand
                          && List.mem second_id player.hand
                          && List.length before_draw.hand < 7
                          && possessed_legits before_draw <= 3
                          && context.last_draw
                             = Some ([ first_id; second_id ], Event.Paid)
                          && not context.choice_made
                      | ( Legit_cash,
                          Some (Pending_legit_cash { player_id; drawn_card_id })
                        ) ->
                          player_id = actor
                          && List.mem drawn_card_id player.hand
                          && (Option.get (Cards.find drawn_card_id)).category
                             = Cards.Legit
                          && possessed_legits player = 4
                          && (match context.last_draw with
                            | Some (ids, _) -> List.mem drawn_card_id ids
                            | None -> false)
                          && not context.choice_made
                      | Trim, Some (Pending_trim { player_id }) ->
                          player_id = actor
                          && Resource_bank.total player.resources
                             > resource_limit player
                          && possessed_legits player <= 3
                      | _ -> false
                    in
                    if valid then Ok state else invalid "pending_decision"
                | _ -> invalid "turn_protocol"))
      | _ -> invalid "players"

let create random_source =
  {
    schema_version;
    rules_version;
    phase = Awaiting_opening;
    turn_number = 0;
    active_player = None;
    deck = all_ids;
    discard = [];
    players = [ empty_player; empty_player ];
    random_source;
    history = [];
    pending_decision = None;
  }

let phase_name = function
  | Awaiting_opening -> "awaiting_opening"
  | Ready -> "ready"
  | Play -> "play"
  | Draw_discard -> "draw_discard"
  | Legit_cash -> "legit_cash"
  | Trim -> "trim"

let ids_to_value ids = Wire_value.Array (List.map Wire_value.int_value ids)

let player_to_value player =
  Wire_value.Object
    [
      ("resources", Resource_bank.to_value player.resources);
      ("hand", ids_to_value player.hand);
      ("active_card_ids", ids_to_value player.active_card_ids);
      ("suspended_card_ids", ids_to_value player.suspended_card_ids);
      ("draw_price", Wire_value.int_value player.draw_price);
    ]

let pending_to_value = function
  | None -> Wire_value.Null
  | Some decision ->
      let tag, fields =
        match decision with
        | Pending_draw_discard { player_id; card_ids } ->
            ( "draw_discard",
              [
                ("player_id", Wire_value.int_value player_id);
                ("card_ids", ids_to_value card_ids);
              ] )
        | Pending_legit_cash { player_id; drawn_card_id } ->
            ( "legit_cash",
              [
                ("player_id", Wire_value.int_value player_id);
                ("drawn_card_id", Wire_value.int_value drawn_card_id);
              ] )
        | Pending_trim { player_id } ->
            ("trim", [ ("player_id", Wire_value.int_value player_id) ])
      in
      Wire_value.Object (("decision", String tag) :: fields)

let to_value state =
  let open Wire_value in
  Object
    [
      ("schema_version", int_value state.schema_version);
      ("rules_version", String state.rules_version);
      ("phase", String (phase_name state.phase));
      ("turn_number", int_value state.turn_number);
      ( "active_player",
        match state.active_player with None -> Null | Some id -> int_value id );
      ("deck", ids_to_value state.deck);
      ("discard", ids_to_value state.discard);
      ("players", Array (List.map player_to_value state.players));
      ( "random_source",
        Object
          [
            ("algorithm", String Random_source.algorithm);
            ("cursor", String (Random_source.to_hex state.random_source));
          ] );
      ("history", Array (List.map Event.to_value state.history));
      ("winner", Null);
      ("win_reason", Null);
      ("pending_decision", pending_to_value state.pending_decision);
    ]

let ids_of_value value = List.map Wire_value.int (Wire_value.array value)

let player_of_value value =
  let open Wire_value in
  let fields =
    fields
      [
        "resources";
        "hand";
        "active_card_ids";
        "suspended_card_ids";
        "draw_price";
      ]
      value
  in
  {
    resources = Resource_bank.of_value (field "resources" fields);
    hand = ids_of_value (field "hand" fields);
    active_card_ids = ids_of_value (field "active_card_ids" fields);
    suspended_card_ids = ids_of_value (field "suspended_card_ids" fields);
    draw_price = int (field "draw_price" fields);
  }

let pending_of_value = function
  | Wire_value.Null -> None
  | value ->
      let open Wire_value in
      let tag =
        match value with
        | Object fields -> string (field "decision" fields)
        | _ -> raise (Decode_error "pending_decision")
      in
      let names =
        match tag with
        | "draw_discard" -> [ "card_ids" ]
        | "legit_cash" -> [ "drawn_card_id" ]
        | "trim" -> []
        | _ -> raise (Decode_error "decision")
      in
      let fields = fields ("decision" :: "player_id" :: names) value in
      let player_id = int (field "player_id" fields) in
      Some
        (match tag with
        | "draw_discard" ->
            Pending_draw_discard
              { player_id; card_ids = ids_of_value (field "card_ids" fields) }
        | "legit_cash" ->
            Pending_legit_cash
              { player_id; drawn_card_id = int (field "drawn_card_id" fields) }
        | _ -> Pending_trim { player_id })

let of_value value =
  let open Wire_value in
  try
    let fields =
      fields
        [
          "schema_version";
          "rules_version";
          "phase";
          "turn_number";
          "active_player";
          "deck";
          "discard";
          "players";
          "random_source";
          "history";
          "winner";
          "win_reason";
          "pending_decision";
        ]
        value
    in
    let received_schema = int (field "schema_version" fields) in
    let received_rules = string (field "rules_version" fields) in
    if received_schema <> schema_version || received_rules <> rules_version then
      Error (Command.reject Unsupported_version "version")
    else
      let phase =
        match string (field "phase" fields) with
        | "awaiting_opening" -> Awaiting_opening
        | "ready" -> Ready
        | "play" -> Play
        | "draw_discard" -> Draw_discard
        | "legit_cash" -> Legit_cash
        | "trim" -> Trim
        | _ -> raise (Decode_error "phase")
      in
      let random_fields =
        Wire_value.fields [ "algorithm"; "cursor" ]
          (field "random_source" fields)
      in
      if string (field "algorithm" random_fields) <> Random_source.algorithm
      then Error (Command.reject Unsupported_version "random_source.algorithm")
      else
        let random_source =
          match
            Random_source.of_hex (string (field "cursor" random_fields))
          with
          | Some state -> state
          | None -> raise (Decode_error "random_source.cursor")
        in
        List.iter
          (fun name -> null (field name fields))
          [ "winner"; "win_reason" ];
        of_snapshot
          {
            schema_version = received_schema;
            rules_version = received_rules;
            phase;
            turn_number = int (field "turn_number" fields);
            active_player =
              (match field "active_player" fields with
              | Null -> None
              | value -> Some (int value));
            deck = ids_of_value (field "deck" fields);
            discard = ids_of_value (field "discard" fields);
            players = List.map player_of_value (array (field "players" fields));
            random_source;
            history = List.map Event.of_value (array (field "history" fields));
            pending_decision =
              pending_of_value (field "pending_decision" fields);
          }
  with Decode_error field -> Error (Command.reject Malformed_state field)
