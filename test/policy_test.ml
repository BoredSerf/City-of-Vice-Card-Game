open City_engine
open Policy_fixture

let error code field = function
  | Error r ->
      check
        (r = Command.reject code field)
        ("wrong error " ^ Command.rejection_name r.code ^ ":" ^ r.field)
  | Ok _ -> failwith "expected rejection"

let codec state =
  let o = observe state 1 in
  let v = Player_view.observation_to_value o in
  error Invalid_actor "player_id" (Player_view.observe state ~player_id:2);
  let malformed v =
    error Malformed_command "policy_observation"
      (Player_view.observation_of_value v)
  in
  malformed Wire_value.Null;
  (match v with
  | Wire_value.Object f -> (
      malformed (Object (("view", Wire_value.Null) :: f));
      malformed (Object (("extra", Wire_value.Null) :: f));
      malformed (Object (List.remove_assoc "view" f));
      match List.assoc "view" f with
      | Object vf ->
          malformed
            (Object
               [
                 ("view", Object (("player_id", Wire_value.int_value 1) :: vf));
                 ("legal_commands", Array []);
               ]);
          malformed
            (Object
               [
                 ( "view",
                   Object
                     (("hand", Array [ Wire_value.int_value 36 ])
                     :: List.remove_assoc "hand" vf) );
                 ("legal_commands", Array []);
               ]);
          error Invalid_actor "player_id"
            (Player_view.observation_of_value
               (Object
                  [
                    ( "view",
                      Object
                        (("player_id", Wire_value.int_value 2)
                        :: List.remove_assoc "player_id" vf) );
                    ("legal_commands", Array []);
                  ]));
          malformed
            (Object
               [
                 ("view", Object vf);
                 ( "legal_commands",
                   Array
                     [
                       Object
                         [
                           ("command", String "end_turn");
                           ("command", String "end_turn");
                         ];
                     ] );
               ])
      | _ -> assert false)
  | _ -> assert false);
  error Invalid_state "policy_legal_commands"
    (Player_policy.propose o.view ~legal_commands:[])

let equivalence state actor =
  let s = State.snapshot state in
  let twin =
    ok
      (State.of_snapshot
         {
           s with
           deck = List.rev s.deck;
           random_source = Option.get (Random_source.of_hex "12345678");
         })
  in
  let left = observe state actor and right = observe twin actor in
  check
    (left = right && proposal left = proposal right)
    "hidden deck/cursor changed view, legal choices or proposal";
  (* The measurement must detect an intentional fixture-only leak. *)
  let leaked x =
    `Assoc
      [
        ("safe", value (observe x actor));
        ("leak", `List (List.map (fun n -> `Int n) (State.snapshot x).deck));
      ]
  in
  if List.length s.deck > 1 then
    check
      (leaked state <> leaked twin)
      "privacy comparator missed deliberate leak"

let hidden_composition state actor =
  let s = State.snapshot state in
  let other = 1 - actor in
  let player = List.nth s.players other in
  let players =
    List.mapi
      (fun i p -> if i = other then { p with State.hand = [ 30 ] } else p)
      s.players
  in
  let a =
    ok
      (State.of_snapshot
         { s with players; deck = List.filter (( <> ) 30) s.deck })
  in
  let snap = State.snapshot a in
  let players =
    List.mapi
      (fun i p -> if i = other then { p with State.hand = [ 25 ] } else p)
      snap.players
  in
  let b =
    ok
      (State.of_snapshot
         { snap with players; deck = 30 :: List.filter (( <> ) 25) snap.deck })
  in
  ignore player;
  check
    (observe a actor = observe b actor)
    "opponent operator/legit composition escaped";
  check
    (proposal (observe a actor) = proposal (observe b actor))
    "hidden composition changed proposal"

let foreign_pending state owner =
  let s = State.snapshot state in
  let old_id, new_id =
    match s.pending_decision with
    | Some (State.Pending_legit_cash { drawn_card_id; _ }) -> (drawn_card_id, 28)
    | Some (Pending_draw_discard _) -> (31, 30)
    | _ -> failwith "required private pending fixture"
  in
  let replace id = if id = old_id then new_id else id in
  let pending_decision =
    match s.pending_decision with
    | Some (State.Pending_legit_cash p) ->
        Some (State.Pending_legit_cash { p with drawn_card_id = new_id })
    | Some (Pending_draw_discard p) ->
        Some
          (Pending_draw_discard
             { p with card_ids = List.map replace p.card_ids })
    | _ -> assert false
  in
  let players =
    List.mapi
      (fun i (p : State.player) ->
        if i = owner then { p with State.hand = List.map replace p.hand } else p)
      s.players
  in
  let history =
    List.map
      (function
        | Event.Cards_drawn p when p.player_id = owner ->
            Event.Cards_drawn { p with card_ids = List.map replace p.card_ids }
        | e -> e)
      s.history
  in
  let twin =
    ok
      (State.of_snapshot
         {
           s with
           players;
           pending_decision;
           history;
           deck = List.map (fun id -> if id = new_id then old_id else id) s.deck;
         })
  in
  check
    (observe state (1 - owner) = observe twin (1 - owner))
    "foreign private pending identity escaped";
  check
    (proposal (observe state (1 - owner)) = proposal (observe twin (1 - owner)))
    "foreign pending changed waiting result"

let current_validation state actor =
  let captured =
    Option.get
      (ok
         (Player_policy.propose (observe state actor).view
            ~legal_commands:(observe state actor).legal_commands))
  in
  let actual = ok (Engine.perform_command state ~player_id:actor captured) in
  let before = Native_json.state_json actual.state in
  error Invalid_card "card_id"
    (Engine.perform_command actual.state ~player_id:actor captured);
  check
    (before = Native_json.state_json actual.state)
    "old illegal command mutated state";
  let other =
    ok
      (Engine.perform_command state ~player_id:actor
         (Command.Cash_card { card_id = 4; color = Cards.Blue }))
  in
  let human =
    ok (Engine.perform_command other.state ~player_id:actor captured)
  in
  let old = ok (Engine.perform_command other.state ~player_id:actor captured) in
  check (human = old)
    "still-legal old proposal differs from current human command";
  let activation =
    Command.Activate_card { card_id = 4; wildcard_payment = None }
  in
  check
    (List.mem activation (observe actual.state actor).legal_commands)
    "activation prerequisite";
  let spent =
    ok
      (Engine.perform_command actual.state ~player_id:actor
         (Command.Draw_card
            { payment = [ Cards.Blue ]; use_docks_bonus = false }))
  in
  let before = Native_json.state_json spent.state in
  error Insufficient_resources "payment"
    (Engine.perform_command spent.state ~player_id:actor activation);
  check
    (before = Native_json.state_json spent.state)
    "now-insufficient payment mutated state";
  let open Wire_value in
  List.iter
    (fun (value, field) ->
      error Malformed_command field (Command.of_value value))
    [
      ( Object [ ("player_id", int_value actor); ("command", String "unknown") ],
        "command" );
      ( Object
          [ ("player_id", int_value actor); ("command", String "cash_card") ],
        "object_fields" );
      ( Object
          [
            ("player_id", int_value actor);
            ("command", String "cash_card");
            ("card_id", int_value 31);
            ("color", String "invalid");
          ],
        "color" );
      ( Object
          [
            ("player_id", int_value actor);
            ("command", String "draw_card");
            ("payment", Bool true);
            ("use_docks_bonus", Bool false);
          ],
        "payment" );
    ]

let () =
  let document = load () in
  metadata document;
  List.iter (fun c -> ignore (run_case c)) (cases document);
  let fund =
    decode
      (member "initial_state"
         (List.find (fun c -> text "id" c = "S01-AI-FUND-001") (cases document)))
  in
  codec fund;
  current_validation fund 1;
  hidden_composition fund 1;
  let mirrored =
    decode
      (member "initial_state"
         (List.find
            (fun c -> text "id" c = "S01-AI-FUND-001/mirror")
            (cases document)))
  in
  hidden_composition mirrored 0;
  current_validation mirrored 0;
  List.iter
    (fun c ->
      if String.starts_with ~prefix:"S06-REUSE/S01-AI-DECIDE-" (text "id" c)
      then
        let state = decode (member "initial_state" c) in
        foreign_pending state (Option.get (State.snapshot state).active_player))
    (cases document);
  let draw =
    decode
      (member "initial_state"
         (List.find (fun c -> text "id" c = "S01-AI-DRAW-001") (cases document)))
  in
  let s = State.snapshot draw in
  let twin = ok (State.of_snapshot { s with deck = List.rev s.deck }) in
  let command =
    Command.Draw_card { payment = [ Cards.Green ]; use_docks_bonus = false }
  in
  check (observe draw 1 = observe twin 1) "pre-draw worlds differ";
  let a = ok (Engine.perform_command draw ~player_id:1 command)
  and b = ok (Engine.perform_command twin ~player_id:1 command) in
  check
    ((observe a.state 1).view.hand = [ 31 ]
    && (observe b.state 1).view.hand = [ 1 ])
    "controlled actual owner draw reveal";
  check
    (observe a.state 0 = observe b.state 0)
    "opponent-facing post-draw identity escaped";
  (* Every literal boundary covers both IDs, ordinary/mandatory/defender and terminal modes. *)
  let boundaries = ref 0 in
  List.iter
    (fun c ->
      let rec inspect state steps =
        incr boundaries;
        List.iter (equivalence state) [ 0; 1 ];
        List.iter
          (fun actor ->
            let o = observe state actor in
            if o.view.decision_owner = Some actor then
              error Invalid_state "policy_legal_commands"
                (Player_policy.propose o.view ~legal_commands:[])
            else if
              o.view.phase = Player_view.Over
              || o.view.active_player <> Some actor
            then
              check
                (ok
                   (Player_policy.propose o.view
                      ~legal_commands:o.legal_commands)
                = None)
                "waiting actor proposed action")
          [ 0; 1 ];
        match steps with
        | [] -> ()
        | s :: rest ->
            let a, cmd =
              ok (Command.of_value (Native_json.of_json (member "command" s)))
            in
            let next =
              match Engine.perform_command state ~player_id:a cmd with
              | Ok t -> t.state
              | Error _ -> state
            in
            inspect next rest
      in
      inspect (decode (member "initial_state" c)) (list "steps" c))
    (cases document);
  Printf.printf
    "S06 literal policy/codec/privacy/current-validation: %d cases, %d \
     boundaries, both actors\n"
    (List.length (cases document))
    !boundaries
