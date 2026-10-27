open City_engine
module Json = Yojson.Basic.Util

let member = Json.member
let text name value = Json.to_string (member name value)
let list name value = Json.to_list (member name value)
let check condition message = if not condition then failwith message

let ok = function
  | Ok value -> value
  | Error rejection ->
      failwith
        (Command.rejection_name rejection.Command.code ^ ":" ^ rejection.field)

let load () = Yojson.Basic.from_file "../tests/economy/scenarios.json"
let cases document = list "cases" document

let color value =
  match Cards.color_of_key (Json.to_string value) with
  | Some color -> color
  | None -> failwith "invalid fixture color"

let rec patch value path replacement =
  match (path, value) with
  | [], _ -> replacement
  | key :: rest, `Assoc fields ->
      check (List.mem_assoc key fields) ("unknown expected field: " ^ key);
      `Assoc
        (List.map
           (fun (name, value) ->
             (name, if name = key then patch value rest replacement else value))
           fields)
  | key :: rest, `List values ->
      let index = int_of_string key in
      check (index >= 0 && index < List.length values) "expected array index";
      `List
        (List.mapi
           (fun position value ->
             if position = index then patch value rest replacement else value)
           values)
  | _ -> failwith "expected patch traversed a scalar"

let expected_after before record =
  let expected =
    List.fold_left
      (fun value (path, replacement) ->
        patch value (String.split_on_char '.' path) replacement)
      before
      (Json.to_assoc (member "expected_changes" record))
  in
  let history = list "history" before @ list "expected_events" record in
  patch expected [ "history" ] (`List history)

let compare_json label actual expected =
  if not (Native_json.equal_json actual expected) then
    failwith
      (label ^ "\nexpected="
      ^ Yojson.Basic.to_string expected
      ^ "\nactual="
      ^ Yojson.Basic.to_string actual)

let state_value state = Native_json.to_json (State.to_value state)

let legal_value state actor =
  `List
    (List.map
       (fun command -> Native_json.to_json (Command.to_value command))
       (Engine.legal_commands state ~player_id:actor))

let check_state state =
  let before = Native_json.state_json state in
  let restored = ok (Native_json.decode_state before) in
  check (state = restored) "economy serialization roundtrip";
  let first, next =
    Random_source.choose ~bound:36 (State.snapshot state).random_source
  in
  let second, restored_next =
    Random_source.choose ~bound:36 (State.snapshot restored).random_source
  in
  check
    (first = second
    && Random_source.to_hex next = Random_source.to_hex restored_next)
    "economy RNG continuation";
  List.iter
    (fun actor ->
      let commands = Engine.legal_commands state ~player_id:actor in
      check
        (commands = Engine.legal_commands restored ~player_id:actor)
        "roundtrip legal domain";
      List.iter
        (fun command ->
          check
            (Result.is_ok
               (Engine.perform_command state ~player_id:actor command))
            "advertised economy command rejected";
          match command with
          | Command.Draw_card { payment; _ } ->
              let indexes =
                List.map
                  (fun color ->
                    let rec index count = function
                      | [] -> assert false
                      | head :: rest ->
                          if head = color then count else index (count + 1) rest
                    in
                    index 0 Resource_bank.colors)
                  payment
              in
              check
                (indexes = List.sort Int.compare indexes)
                "discovery payment is not canonical"
          | _ -> ())
        commands)
    [ 0; 1 ];
  check
    (Native_json.state_json state = before)
    "discovery/roundtrip changed source state/RNG"

let invoke case state command_value =
  match Command.of_value (Native_json.of_json command_value) with
  | Error rejection -> Error rejection
  | Ok (player_id, command) ->
      if text "random_source_kind" case = "constant" then
        Engine.For_testing.perform_command
          ~draw_index:(fun ~bound cursor -> (bound - 1, cursor))
          state ~player_id command
      else Engine.perform_command state ~player_id command

let legal_both_value state = `List (List.map (legal_value state) [ 0; 1 ])

let run_case ?(both_players = false) case =
  let ident = text "id" case in
  let initial_value = member "initial_state" case in
  let initial =
    match State.of_value (Native_json.of_json initial_value) with
    | Ok state -> state
    | Error rejection ->
        failwith
          (ident ^ " initial fixture: "
          ^ Command.rejection_name rejection.code
          ^ ":" ^ rejection.field)
  in
  let rec run index state expected records traces =
    match records with
    | [] -> List.rev traces
    | record :: rest ->
        check_state state;
        compare_json (ident ^ " before") (state_value state) expected;
        let before = Native_json.state_json state in
        let command_value = member "command" record in
        let result = invoke case state command_value in
        check
          (before = Native_json.state_json state)
          (ident ^ " command mutated its input");
        let next, expected, encoded =
          match (result, member "expected_rejection" record) with
          | Error rejection, (`Assoc _ as wanted) ->
              compare_json (ident ^ " rejection")
                (Native_json.to_json (Command.rejection_to_value rejection))
                wanted;
              ( state,
                expected,
                `Assoc
                  [
                    ("status", `String "rejected");
                    ("state_json", `String before);
                    ("events", `List []);
                    ("rejection", wanted);
                  ] )
          | Ok transition, `Null ->
              let expected = expected_after expected record in
              compare_json
                (ident ^ " step" ^ string_of_int index)
                (state_value transition.state)
                expected;
              compare_json (ident ^ " events")
                (`List
                   (List.map
                      (fun event -> Native_json.to_json (Event.to_value event))
                      transition.events))
                (member "expected_events" record);
              ( transition.state,
                expected,
                `Assoc
                  [
                    ("status", `String "accepted");
                    ( "state_json",
                      `String (Native_json.state_json transition.state) );
                    ("events", member "expected_events" record);
                  ] )
          | Error rejection, `Null ->
              failwith
                (ident ^ " unexpectedly rejected: "
                ^ Command.rejection_name rejection.code
                ^ ":" ^ rejection.field)
          | Ok _, _ -> failwith (ident ^ " unexpectedly accepted rejected input")
          | Error _, _ -> failwith (ident ^ " malformed rejection expectation")
        in
        check_state next;
        let actor =
          Option.value ~default:0 (State.snapshot next).active_player
        in
        let trace =
          `Assoc
            ([
               ("command_json", `String (Yojson.Basic.to_string command_value));
               ("result", encoded);
               ("legal_after", legal_value next actor);
             ]
            @
            if both_players then
              [ ("legal_after_by_player", legal_both_value next) ]
            else [])
        in
        run (index + 1) next expected rest (trace :: traces)
  in
  let steps = run 1 initial initial_value (list "steps" case) [] in
  `Assoc
    ([
       ("id", `String ident);
       ("initial_state_json", `String (Native_json.state_json initial));
       ( "initial_actor",
         `Int (Option.value ~default:0 (State.snapshot initial).active_player)
       );
       ( "initial_legal",
         legal_value initial
           (Option.value ~default:0 (State.snapshot initial).active_player) );
       ("steps", `List steps);
     ]
    @
    if both_players then
      [ ("initial_legal_by_player", legal_both_value initial) ]
    else [])

let metadata_test document =
  check
    (text "contract_sha256" document
    = "ba3427846ca231796f3cf04e56bfc88ab6e2978b0bb1bd859c37659bbfde3d09")
    "reviewed S04 contract identity";
  check
    (text "rules_version" document = State.rules_version)
    "economy expectation rules version";
  check
    (text "prototype_baseline" document
    = "4ccb19703d4af1a1c202d922b514a58a17d0e537")
    "economy expectation baseline";
  let originals =
    Json.to_list
      (Yojson.Basic.from_file "../tests/characterization/scenarios.json")
  in
  let ledger = list "source_ledger" document in
  check (List.length ledger = 43) "43 original S01 links required";
  let expected_ids =
    [
      "S01-INCOME-001";
      "S01-INCOME-002";
      "S01-INCOME-003";
      "S01-INCOME-004";
      "S01-TRIM-001";
      "S01-TRIM-002";
      "S01-PAY-001";
      "S01-PAY-002";
      "S01-PAY-003";
      "S01-PAY-004";
      "S01-CASH-001";
      "S01-CASH-002";
      "S01-CASH-003";
      "S01-CASH-004";
      "S01-CASH-005";
      "S01-REJECT-001";
      "S01-REJECT-002";
      "S01-REJECT-003";
      "S01-REJECT-004";
      "S01-DRAW-001";
      "S01-DRAW-002";
      "S01-DRAW-003";
      "S01-DRAW-004";
      "S01-DRAW-005";
      "S01-DRAW-006";
      "S01-DRAW-007";
      "S01-TRADE-001";
      "S01-TRADE-002";
      "S01-LEGIT-001";
      "S01-CREW-DOCKS-001";
      "S01-CREW-DOCKS-002";
      "S01-CREW-BURBS-001";
      "S01-CREW-BURBS-002";
      "S01-CREW-BURBS-003";
      "S01-CREW-BURBS-004";
      "S01-CREW-BURBS-005";
      "S01-CREW-NIGHT-001";
      "S01-CREW-MULTI-001";
      "S01-CREW-HILL-001";
      "S01-AI-DECIDE-001";
      "S01-AI-DECIDE-002";
      "S01-TURN-001";
      "S01-TURN-002";
    ]
  in
  check
    (List.sort String.compare (List.map (text "scenario_id") ledger)
    = List.sort String.compare expected_ids)
    "S04 source membership differs from contract";
  check
    (List.length
       (List.sort_uniq String.compare (List.map (text "scenario_id") ledger))
    = 43)
    "duplicate S01 ledger link";
  List.iter
    (fun entry ->
      let original =
        List.find
          (fun original -> text "id" original = text "scenario_id" entry)
          originals
      in
      compare_json "unchanged original source record"
        (member "source_record" entry)
        original;
      check
        (text "approval" original = "unapproved_candidate")
        "observation approval changed";
      check
        (List.mem
           (text "authority_class" entry)
           [ "source_comparison"; "provisional"; "approved_correction" ])
        "unknown authority class")
    ledger;
  let records = cases document @ list "payments" document in
  List.iter
    (fun ident ->
      check
        (List.exists (fun record -> text "contract_id" record = ident) records)
        ("missing contract fixture: " ^ ident))
    [
      "S04-PROV-DRAW-001";
      "S04-PROV-DOCKS-001";
      "S04-PROV-DOCKS-002";
      "S04-PROV-CASH-001";
      "S04-PROV-CASH-002";
      "S04-PROV-CASH-003";
      "S04-PROV-CASH-004";
      "S04-PROV-NEUTRAL-001";
      "S04-DERIVED-PAY-001";
      "S04-DERIVED-RESHUFFLE-001";
      "S04-DERIVED-GUARDS-001";
      "S04-DERIVED-TURN-001";
      "S04-DERIVED-CODEC-001";
    ];
  List.iter
    (fun case ->
      check (list "steps" case <> []) "empty economy case";
      check
        (Json.to_bool (member "facade" case)
        || text "random_source_kind" case = "constant")
        "facade exclusion lacks explicit legacy random stream";
      List.iter
        (fun reference ->
          let source =
            List.find
              (fun original ->
                text "id" original = text "scenario_id" reference)
              originals
          in
          List.iter
            (fun number ->
              let number = Json.to_int number in
              check
                (number >= 1 && number <= List.length (list "steps" source))
                "invalid source step link")
            (list "steps" reference))
        (list "source_refs" case))
    (cases document)

let payment_test document =
  List.iter
    (fun record ->
      let bank =
        Resource_bank.of_value (Native_json.of_json (member "bank" record))
      in
      let before = Resource_bank.to_value bank in
      let costs =
        List.map
          (fun value ->
            if value = `String "any" then Cards.Any else Fixed (color value))
          (list "cost" record)
      in
      let picks =
        match member "picks" record with
        | `Null -> None
        | value -> Some (List.map color (Json.to_list value))
      in
      let result = Payment.resolve bank costs ~picks in
      check (before = Resource_bank.to_value bank) "pure payment mutated bank";
      match (result, member "expected_colors" record) with
      | Ok resolved, `List expected ->
          check
            (resolved.colors = List.map color expected)
            (text "id" record ^ " resolved colors");
          compare_json "payment debit"
            (Native_json.to_json (Resource_bank.to_value resolved.debit))
            (member "expected_debit" record);
          compare_json "payment remaining"
            (Native_json.to_json (Resource_bank.to_value resolved.remaining))
            (member "expected_remaining" record)
      | Error rejection, `Null ->
          check
            (Command.rejection_name rejection.code = text "expected_code" record)
            "wrong pure payment failure"
      | _ -> failwith (text "id" record ^ " payment result mismatch"))
    (list "payments" document)
