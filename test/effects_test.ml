open City_engine
module Json = Yojson.Basic.Util

let check = Economy_fixture.check
let ok = Economy_fixture.ok
let member = Json.member

(* Independent finite syntax domains; no legality predicate is copied here.
   Accepted automatic/canonical payment aliases compare completed public results. *)
let payment_candidates resources price =
  let rec enumerate colors count =
    match colors with
    | [] -> if count = 0 then [ [] ] else []
    | color :: rest ->
        List.concat_map
          (fun n ->
            List.map
              (fun tail -> List.init n (fun _ -> color) @ tail)
              (enumerate rest (count - n)))
          (List.init (min count (Resource_bank.get resources color) + 1) Fun.id)
  in
  if price > Resource_bank.total resources then []
  else enumerate Resource_bank.colors price

let candidates (snapshot : State.snapshot) who =
  let owner = List.nth snapshot.players who in
  let ids = List.init 36 Fun.id in
  let distributors = List.init 24 Fun.id in
  let activations =
    List.concat_map
      (fun card_id ->
        List.map
          (fun wildcard_payment ->
            Command.Activate_card { card_id; wildcard_payment })
          (None :: Some []
          :: List.map (fun color -> Some [ color ]) Resource_bank.colors))
      ids
  in
  let targets =
    List.map (fun id -> [ id ]) ids
    @ List.concat_map
        (fun first -> List.map (fun second -> [ first; second ]) distributors)
        distributors
  in
  let operators =
    List.concat_map
      (fun operator_id ->
        List.map
          (fun target_ids -> Command.Use_operator { operator_id; target_ids })
          targets)
      [ 30; 31; 32; 33; 34; 35 ]
  in
  let swaps =
    List.concat_map
      (fun own_card_id ->
        List.map
          (fun rival_card_id ->
            Command.Trade_distributors { own_card_id; rival_card_id })
          distributors)
      distributors
  in
  let cash =
    List.concat_map
      (fun card_id ->
        List.map
          (fun color -> Command.Cash_card { card_id; color })
          Resource_bank.colors)
      ids
  in
  let draws =
    List.concat_map
      (fun payment ->
        List.map
          (fun use_docks_bonus ->
            Command.Draw_card { payment; use_docks_bonus })
          [ false; true ])
      (payment_candidates owner.resources owner.draw_price)
  in
  let trades =
    List.concat_map
      (fun from_color ->
        List.map
          (fun to_color -> Command.Trade_resources { from_color; to_color })
          Resource_bank.colors)
      Resource_bank.colors
  in
  activations @ operators @ swaps @ cash @ draws @ trades
  @ List.map (fun card_id -> Command.Discard_draw_choice { card_id }) ids
  @ List.map (fun color -> Command.Trim_resource { color }) Resource_bank.colors
  @ [
      Collect_income;
      End_turn;
      Respond_intercept { accept = true };
      Respond_intercept { accept = false };
    ]

let completeness state =
  let before = Native_json.state_json state in
  List.iter
    (fun player_id ->
      let advertised = Engine.legal_commands state ~player_id in
      let results =
        List.map
          (fun command -> ok (Engine.perform_command state ~player_id command))
          advertised
      in
      List.iter
        (fun command ->
          match Engine.perform_command state ~player_id command with
          | Error _ -> ()
          | Ok actual ->
              check (List.mem actual results)
                ("accepted S05 semantic action absent from discovery: "
                ^ Yojson.Basic.to_string
                    (Native_json.to_json (Command.to_value command))))
        (candidates (State.snapshot state) player_id))
    [ 0; 1 ];
  check
    (before = Native_json.state_json state)
    "candidate/discovery enumeration mutated original state"

let () =
  let document = Effects_fixture.load () in
  Effects_fixture.metadata_test document;
  let traces =
    List.map Effects_fixture.run_case (Effects_fixture.cases document)
  in
  List.iter
    (fun record ->
      let before = member "state" record in
      match State.of_value (Native_json.of_json before) with
      | Error rejection ->
          check
            (Command.rejection_name rejection.code
            = Json.to_string (member "expected_code" record))
            (Json.to_string (member "id" record) ^ ": wrong invalid code");
          check
            (rejection.field = Json.to_string (member "expected_field" record))
            (Json.to_string (member "id" record)
            ^ ": wrong invalid field: " ^ rejection.field)
      | Ok _ ->
          failwith
            (Json.to_string (member "id" record)
            ^ ": invalid S05 snapshot admitted"))
    (Json.to_list (member "invalid_states" document));
  let seen = Hashtbl.create 256 in
  let inspect encoded =
    if not (Hashtbl.mem seen encoded) then (
      Hashtbl.add seen encoded ();
      completeness (ok (Native_json.decode_state encoded)))
  in
  List.iter
    (fun trace ->
      inspect (Json.to_string (member "initial_state_json" trace));
      List.iter
        (fun record ->
          let result = member "result" record in
          if Json.to_string (member "status" result) = "accepted" then
            inspect (Json.to_string (member "state_json" result)))
        (Json.to_list (member "steps" trace)))
    traces;
  let initial = ok (Engine.create_session ~seed:"00000001") in
  let ready =
    (ok
       (Engine.perform_command initial ~player_id:0
          (Start_game { opening_distributor = 0 })))
      .state
  in
  let card_id = List.hd (List.hd (State.snapshot ready).players).hand in
  (match
     Engine.perform_command ready ~player_id:0
       (Activate_card { card_id; wildcard_payment = None })
   with
  | Error { code = Wrong_phase; field = "phase" } -> ()
  | _ -> failwith "real initial Ready activation guard");
  List.iter
    (fun state ->
      let encoded = Native_json.state_json state in
      check
        (ok (Native_json.decode_state encoded) = state)
        "S05 actual setup codec")
    [ initial; ready ];
  Printf.printf
    "S05 literal effects/codec/discovery: %d cases; %d independently \
     enumerated states passed\n\
     %!"
    (List.length traces) (Hashtbl.length seen)
