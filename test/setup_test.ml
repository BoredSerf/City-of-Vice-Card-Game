open City_engine
module Json = Yojson.Basic.Util

let check condition message = if not condition then failwith message

let ok = function
  | Ok value -> value
  | Error rejection ->
      failwith
        (Command.rejection_name rejection.Command.code ^ ":" ^ rejection.field)

let read_fixture name =
  Yojson.Basic.from_file ("../tests/characterization/" ^ name)

let member = Json.member
let seed value = ok (Engine.create_session ~seed:value)

let start state opening_distributor =
  Engine.perform_command state ~player_id:0 (Start_game { opening_distributor })

let json_int value = `Int value
let json_ids ids = `List (List.map json_int ids)

let before_after state action =
  let before = Native_json.state_json state in
  let result = action () in
  check
    (before = Native_json.state_json state)
    "rejected command mutated serialized input/RNG";
  result

let rejected expected state action =
  match before_after state action with
  | Error rejection ->
      check (rejection.Command.code = expected) "wrong rejection code"
  | Ok _ -> failwith "expected typed rejection"

let catalog_projection (card : Cards.t) =
  let category =
    match card.category with
    | Distributor -> "illegal"
    | Legit -> "legit"
    | Operator _ -> "operator"
  in
  let cost =
    List.map (function
      | Cards.Fixed color -> `String (Cards.color_name color)
      | Any -> `String "Any")
  in
  let fields =
    [
      ("id", `Int card.id);
      ("name", `String card.name);
      ("color", `String (Cards.color_name card.color));
      ("business", `String card.business);
      ("type", `String category);
      ( "crew",
        `String
          (match card.crew with
          | None -> "Independent"
          | Some crew -> Cards.crew_name crew) );
      ("activation_cost", `List (cost card.activation_cost));
      ("flavor", `String card.flavor);
    ]
  in
  `Assoc
    (match card.category with
    | Operator ability ->
        fields
        @ [
            ("ability", `String (Cards.ability_name ability));
            ("ability_cost", `List (cost card.ability_cost));
          ]
    | _ -> fields)

let catalog_test () =
  let expected = read_fixture "cards.json" in
  let actual = `List (List.map catalog_projection Cards.all) in
  check (Native_json.equal_json actual expected) "card inventory field mismatch";
  check
    (List.map (fun (card : Cards.t) -> card.id) Cards.all = List.init 36 Fun.id)
    "catalog physical IDs";
  check (Cards.opening_ids = List.init 24 Fun.id) "24 opening distributors";
  List.iter
    (fun crew ->
      check
        (List.length
           (List.filter
              (fun (card : Cards.t) -> card.crew = Some crew)
              Cards.all)
        = 3)
        "crew membership")
    [
      Cards.Docks;
      Club_circuit;
      Trailer_park;
      Burbs;
      Pipeline;
      Night_shift;
      Arts_district;
      Hill_country;
    ];
  check
    (Cards.find (-1) = None && Cards.find 36 = None)
    "checked catalog lookup";
  (* Assertion sensitivity: changing one expected name is observably unequal. *)
  let changed =
    match expected with
    | `List (`Assoc first :: rest) ->
        `List
          (`Assoc (("name", `String "wrong") :: List.remove_assoc "name" first)
          :: rest)
    | _ -> failwith "inventory fixture shape"
  in
  check
    (not (Native_json.equal_json actual changed))
    "inventory negative control"

let legacy_projection state =
  let snapshot = State.snapshot state in
  let bank (resources : State.resources) =
    `Assoc
      [
        ("Green", json_int resources.green);
        ("Blue", json_int resources.blue);
        ("Black", json_int resources.black);
        ("White", json_int resources.white);
        ("Yellow", json_int resources.yellow);
        ("Purple", json_int resources.purple);
      ]
  in
  let player (player : State.player) =
    `Assoc
      [
        ("res", bank player.resources);
        ("active", json_ids player.active_card_ids);
        ("hand", json_ids player.hand);
        ("drawPrice", json_int player.draw_price);
        ("suspended", json_ids player.suspended_card_ids);
      ]
  in
  let logs =
    List.filter_map
      (function
        | Event.Opening_distributor_chosen { player_id; card_id } ->
            let card = Option.get (Cards.find card_id) in
            let message =
              (if player_id = 0 then "You choose " else "Rival chooses ")
              ^ card.name
              ^
              if player_id = 0 then " as your opening business."
              else " as its opening business."
            in
            Some
              (`Assoc
                 [
                   ("turn", `Int 1);
                   ("side", `Int player_id);
                   ("msg", `String message);
                 ])
        | _ -> None)
      snapshot.history
  in
  `Assoc
    [
      ("version", `Int 7);
      ("turn", `Int snapshot.turn_number);
      ("current", `Int (Option.get snapshot.active_player));
      ("phase", `String "ready");
      ("winner", `Null);
      ("players", `List (List.map player snapshot.players));
      ("deck", json_ids snapshot.deck);
      ("discard", json_ids snapshot.discard);
      ("logs", `List (List.rev logs));
    ]

let find_scenario id scenarios =
  List.find (fun value -> Json.to_string (member "id" value) = id) scenarios

let characterization_test () =
  let scenarios = Json.to_list (read_fixture "scenarios.json") in
  let scenario = find_scenario "S01-SETUP-001" scenarios in
  check (member "initial_state" scenario = `Null) "expected factory fixture";
  let random = member "random_source" scenario in
  check
    (member "kind" random = `String "constant")
    "expected constant RNG fixture";
  let random_value = Json.to_float (member "value" random) in
  let step = List.hd (Json.to_list (member "steps" scenario)) in
  check
    (member "command" step = `String "start_game"
    && member "expected_result" step = `String "state_created")
    "setup fixture command";
  let opening_distributor =
    Json.to_int (List.hd (Json.to_list (member "args" step)))
  in
  let state = seed "00000001" in
  let source_before = Native_json.state_json state in
  let transition =
    ok
      (Engine.For_testing.perform_command
         ~draw_index:(fun ~bound source ->
           ( int_of_float (Float.floor (random_value *. float_of_int bound)),
             Random_source.next source ))
         state ~player_id:0
         (Start_game { opening_distributor }))
  in
  check
    (Native_json.state_json state = source_before)
    "successful command mutated prior state";
  let expected = member "state" (member "expected" step) in
  let actual = legacy_projection transition.state in
  check
    (Native_json.equal_json actual expected)
    "S01-SETUP-001 exact state/log projection";
  check
    (transition.events = Event.setup_events 0 22)
    "S01-SETUP-001 typed events/order";
  let changed =
    match expected with
    | `Assoc fields ->
        `Assoc (("deck", `List []) :: List.remove_assoc "deck" fields)
    | _ -> failwith "fixture state"
  in
  check
    (not (Native_json.equal_json actual changed))
    "setup expected-deck negative control";
  let parity = read_fixture "public_command_parity.json" in
  check
    (member "human_decision_record" parity
    = `String "docs/decisions/PD-002-public-command-boundary.md#approved-rule")
    "golden decision identity";
  let golden =
    find_scenario "S01-SETUP-002"
      (Json.to_list (member "golden_scenarios" parity))
  in
  let source_scenario = find_scenario "S01-SETUP-002" scenarios in
  check
    (member "initial_state" source_scenario = `Null)
    "golden initial session mapping";
  let reference = member "initial_state_ref" golden in
  check
    (member "scenario_id" reference = `String "S01-SETUP-002"
    && member "after_step" reference = `Int 0
    && member "changes" reference = `Assoc [])
    "golden setup reference";
  List.iter
    (fun step ->
      check
        (member "command" step = `String "start_game")
        "golden setup command";
      let expected = member "expected" step in
      check
        (member "result" expected = `String "typed_rejection"
        && member "serialized_state" expected = `String "unchanged")
        "golden setup expectation";
      let opening = Json.to_int (List.hd (Json.to_list (member "args" step))) in
      rejected Invalid_opening state (fun () -> start state opening))
    (Json.to_list (member "steps" golden))

let random_test () =
  List.iter
    (fun value -> check (Random_source.of_hex value = None) "bad seed accepted")
    [ ""; "0"; "00000000"; "ABCDEFGH"; "fffffffff"; "0000000g" ];
  let initial = Option.get (Random_source.of_hex "00000001") in
  let final =
    List.fold_left
      (fun state expected ->
        let next = Random_source.next state in
        check
          (Random_source.to_hex next = expected)
          "xorshift32_v1 literal vector";
        next)
      initial
      [ "00042021"; "04080601"; "9dcca8c5"; "1255994f"; "8ef917d1" ]
  in
  check
    (Random_source.to_hex initial = "00000001"
    && Random_source.to_hex final = "8ef917d1")
    "RNG mutated input";
  List.iter
    (fun seed_value ->
      let source = Option.get (Random_source.of_hex seed_value) in
      List.iter
        (fun bound ->
          let choice, next = Random_source.choose ~bound source in
          check
            (choice >= 0 && choice < bound
            && Random_source.to_hex next
               = Random_source.to_hex (Random_source.next source))
            "bounded RNG choice")
        (List.init 36 (fun index -> index + 1)))
    Native_json.seeds

let sweep_test () =
  List.iter
    (fun seed_value ->
      let initial = seed seed_value in
      let initial_bytes = Native_json.state_json initial in
      let commands = Engine.legal_commands initial ~player_id:0 in
      check (List.length commands = 24) "legal opening command count";
      check
        (Engine.legal_commands initial ~player_id:1 = []
        && Engine.legal_commands initial ~player_id:(-1) = [])
        "wrong-player legal choices";
      List.iter
        (fun command ->
          let first =
            ok (Engine.perform_command initial ~player_id:0 command)
          in
          let second =
            ok (Engine.perform_command initial ~player_id:0 command)
          in
          check
            (Native_json.state_json first.state
             = Native_json.state_json second.state
            && first.events = second.events)
            "same seed/command differs";
          check
            (ok (State.of_value (State.to_value first.state)) = first.state)
            "setup invariant audit";
          check
            (Engine.legal_commands first.state ~player_id:0 = []
            && Engine.legal_commands first.state ~player_id:1 = [])
            "unimplemented commands advertised";
          check
            (ok (Native_json.decode_state (Native_json.state_json first.state))
            = first.state)
            "native JSON roundtrip";
          let cursor = (State.snapshot first.state).random_source in
          let expected_cursor =
            List.fold_left
              (fun source _ -> Random_source.next source)
              (State.snapshot initial).random_source (List.init 36 Fun.id)
          in
          check
            (Random_source.to_hex cursor = Random_source.to_hex expected_cursor)
            "setup RNG consumption order/count";
          let choice, next = Random_source.choose ~bound:28 cursor in
          let restored =
            ok (Native_json.decode_state (Native_json.state_json first.state))
          in
          let restored_choice, restored_next =
            Random_source.choose ~bound:28
              (State.snapshot restored).random_source
          in
          check
            (choice = restored_choice
            && Random_source.to_hex next = Random_source.to_hex restored_next)
            "RNG continuation lost on roundtrip";
          rejected Wrong_phase first.state (fun () ->
              Engine.perform_command first.state ~player_id:0 command);
          check
            (initial_bytes = Native_json.state_json initial)
            "seed sweep mutated original")
        commands)
    Native_json.seeds;
  let initial = seed "00000001" in
  List.iter
    (fun id -> rejected Invalid_opening initial (fun () -> start initial id))
    [ -1; 24; 29; 30; 35; 36; 2147483647 ];
  List.iter
    (fun player_id ->
      rejected Invalid_actor initial (fun () ->
          Engine.perform_command initial ~player_id
            (Start_game { opening_distributor = 0 })))
    [ -1; 1; 2 ];
  check
    (match Engine.create_session ~seed:"00000000" with
    | Error { code = Invalid_seed; _ } -> true
    | _ -> false)
    "typed invalid seed"

let replace name value = function
  | Wire_value.Object fields ->
      Wire_value.Object
        (List.map
           (fun (key, old) -> (key, if key = name then value else old))
           fields)
  | _ -> failwith "test expected object"

let change_player transform value =
  match value with
  | Wire_value.Object fields -> (
      match List.assoc "players" fields with
      | Array (first :: rest) ->
          replace "players" (Array (transform first :: rest)) value
      | _ -> failwith "test players")
  | _ -> failwith "test state"

let validation_test () =
  let initial = seed "12345678" in
  let ready = (ok (start initial 0)).state in
  List.iter
    (fun state ->
      check
        (ok (Native_json.decode_state (Native_json.state_json state)) = state)
        "state roundtrip")
    [ initial; ready ];
  let encoded = Native_json.state_json ready in
  let duplicate_name =
    "{\"schema_version\":2," ^ String.sub encoded 1 (String.length encoded - 1)
  in
  check
    (ok (Native_json.decode_state duplicate_name) = ready)
    "native JSON syntax must match JSON.parse last-value semantics";
  let value = State.to_value ready in
  let open Wire_value in
  let malformed =
    [
      replace "schema_version" (int_value 2) value;
      replace "rules_version" (String "unknown") value;
      replace "phase" (String "play") value;
      replace "turn_number" (int_value 2) value;
      replace "turn_number" (Number 1.5) value;
      replace "active_player" (int_value 1) value;
      replace "players" (Array []) value;
      replace "deck" (Array []) value;
      replace "deck"
        (Array (int_value 0 :: List.map int_value (State.snapshot ready).deck))
        value;
      replace "discard" (Array [ int_value 99 ]) value;
      replace "history" (Array []) value;
      replace "winner" (int_value 0) value;
      replace "pending_decision" (Object []) value;
      replace "random_source"
        (Object [ ("algorithm", String "other"); ("cursor", String "12345678") ])
        value;
      replace "random_source"
        (Object
           [
             ("algorithm", String Random_source.algorithm);
             ("cursor", String "00000000");
           ])
        value;
      change_player (replace "draw_price" (int_value 0)) value;
      change_player (replace "suspended_card_ids" (Array [ int_value 0 ])) value;
      change_player
        (fun player ->
          match player with
          | Object fields ->
              replace "resources"
                (replace "green" (int_value (-1))
                   (List.assoc "resources" fields))
                player
          | _ -> assert false)
        value;
      change_player
        (fun player ->
          match player with
          | Object fields ->
              replace "resources"
                (replace "green" (Number 0.5) (List.assoc "resources" fields))
                player
          | _ -> assert false)
        value;
      replace "turn_number" (Number infinity) value;
      replace "turn_number" (Number 2147483648.) value;
      (match value with
      | Object fields -> Object (("phase", String "ready") :: fields)
      | _ -> assert false);
      (match value with
      | Object fields -> Object (("extra", Null) :: fields)
      | _ -> assert false);
    ]
  in
  List.iteri
    (fun index value ->
      check
        (Result.is_error (State.of_value value))
        ("invalid snapshot accepted: " ^ string_of_int index))
    malformed;
  List.iter
    (fun input ->
      check
        (Result.is_error (Native_json.decode_state input))
        "malformed JSON accepted")
    [ "{"; "null"; "[]"; "{}"; "true" ];
  List.iter
    (fun command ->
      check
        (Result.is_error (Command.of_value command))
        "malformed command accepted")
    [
      Null;
      Object [];
      Object
        [
          ("command", String "end_turn");
          ("player_id", int_value 0);
          ("opening_distributor", int_value 0);
        ];
      Object
        [
          ("command", String "start_game");
          ("player_id", Number 0.5);
          ("opening_distributor", int_value 0);
        ];
    ]

let () =
  List.iter
    (fun (name, run) ->
      try
        run ();
        Printf.printf "S03 %s: passed\n%!" name
      with exn ->
        Printf.eprintf "S03 %s: %s\n%!" name (Printexc.to_string exn);
        exit 1)
    [
      ("catalog", catalog_test);
      ("S01-SETUP-001 / approved S01-SETUP-002", characterization_test);
      ("random vectors", random_test);
      ("120 seeded openings / rejections", sweep_test);
      ("snapshot/command validation", validation_test);
    ]
