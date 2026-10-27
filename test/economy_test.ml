open City_engine
module Json = Yojson.Basic.Util

let check = Economy_fixture.check
let member = Json.member
let ok = Economy_fixture.ok

let () =
  let document = Economy_fixture.load () in
  Economy_fixture.metadata_test document;
  Economy_fixture.payment_test document;
  List.iter
    (fun record -> ignore (Economy_fixture.run_case record))
    (Economy_fixture.cases document);
  List.iter
    (fun record ->
      let value = Native_json.of_json (member "state" record) in
      match State.of_value value with
      | Error rejection -> (
          check
            (Command.rejection_name rejection.code
            = Json.to_string (member "expected_code" record))
            "wrong invalid-snapshot code";
          match member "expected_field" record with
          | `String field ->
              check (rejection.field = field) "wrong invalid-snapshot field"
          | _ -> ())
      | Ok _ ->
          failwith
            (Json.to_string (member "id" record)
            ^ ": crafted invalid snapshot accepted"))
    (Json.to_list (member "invalid_states" document));
  List.iter
    (fun record ->
      ignore (ok (State.of_value (Native_json.of_json (member "state" record)))))
    (Json.to_list (member "valid_states" document));
  let overflow_case =
    List.find
      (fun record ->
        Json.to_string (member "id" record)
        = "S04-DERIVED-TURN-001/max-before-rng")
      (Economy_fixture.cases document)
  in
  let overflow_state =
    ok
      (State.of_value
         (Native_json.of_json (member "initial_state" overflow_case)))
  in
  let before_overflow = Native_json.state_json overflow_state in
  (match
     Engine.For_testing.perform_command
       ~draw_index:(fun ~bound:_ _ -> failwith "overflow reached RNG")
       overflow_state ~player_id:1 End_turn
   with
  | Error { code = Invalid_state; field = "turn_number" } -> ()
  | _ -> failwith "max-counter admission/rejection control");
  check
    (Native_json.state_json overflow_state = before_overflow)
    "overflow changed full state";
  let initial = ok (Engine.create_session ~seed:"00000001") in
  let ready =
    (ok
       (Engine.perform_command initial ~player_id:0
          (Start_game { opening_distributor = 0 })))
      .state
  in
  let before = State.to_value ready in
  let collected =
    ok (Engine.perform_command ready ~player_id:0 Collect_income)
  in
  let owner = List.hd (State.snapshot collected.state).players in
  check
    (owner.resources = { Resource_bank.zero with green = 1 })
    "actual setup→initial income";
  check
    (collected.events
    = [
        Event.Income_collected
          { player_id = 0; resources = { Resource_bank.zero with green = 1 } };
      ])
    "actual initial income facts";
  check (before = State.to_value ready) "initial income changed prior state";
  let handed =
    ok (Engine.perform_command collected.state ~player_id:0 End_turn)
  in
  check
    ((State.snapshot handed.state).turn_number = 1
    && (State.snapshot handed.state).active_player = Some 1)
    "first production handoff jumped round";
  let returned =
    ok (Engine.perform_command handed.state ~player_id:1 End_turn)
  in
  check
    ((State.snapshot returned.state).turn_number = 2
    && (State.snapshot returned.state).active_player = Some 0)
    "production round convention";
  let old_id =
    Economy_fixture.patch
      (Native_json.to_json (State.to_value ready))
      [ "rules_version" ] (`String "prototype_4ccb197_pd002")
  in
  check
    (match State.of_value (Native_json.of_json old_id) with
    | Error { code = Unsupported_version; _ } -> true
    | _ -> false)
    "old interim rules silently reinterpreted";
  check
    (Engine.legal_commands ready ~player_id:0 = [ Collect_income ])
    "initial Ready discovery";
  let forged = { (State.snapshot ready) with phase = Play } in
  check (Result.is_error (State.of_snapshot forged)) "phase flip skipped income";
  check
    (State.resource_limit
       { State.empty_player with active_card_ids = [ 15; 16; 17 ] }
     = 12
    && State.resource_limit
         { State.empty_player with active_card_ids = [ 15; 16 ] }
       = 10)
    "Night live cap";
  let payment_case =
    List.find
      (fun record ->
        Json.to_string (member "id" record)
        = "S04-DERIVED-GUARDS-001/payment-canonical")
      (Economy_fixture.cases document)
  in
  let payment_state =
    ok
      (State.of_value
         (Native_json.of_json (member "initial_state" payment_case)))
  in
  let choices =
    List.filter_map
      (function
        | Command.Draw_card { payment; use_docks_bonus = false } -> Some payment
        | _ -> None)
      (Engine.legal_commands payment_state ~player_id:0)
  in
  check
    (choices
    = [
        [ Cards.Green; Green ];
        [ Green; Blue ];
        [ Green; Black ];
        [ Blue; Black ];
      ])
    "canonical multiset completeness/order";
  let canonical =
    ok
      (Engine.perform_command payment_state ~player_id:0
         (Draw_card { payment = [ Green; Blue ]; use_docks_bonus = false }))
  in
  let permuted =
    ok
      (Engine.perform_command payment_state ~player_id:0
         (Draw_card { payment = [ Blue; Green ]; use_docks_bonus = false }))
  in
  check (canonical = permuted) "equivalent payment order changed state/events";
  Printf.printf
    "S04 metadata/payment/scenario/codec/discovery: %d cases passed\n%!"
    (List.length (Economy_fixture.cases document))
