open City_engine
module Json = Yojson.Basic.Util

let check = Economy_fixture.check
let ok = Economy_fixture.ok
let member = Json.member
let list = Economy_fixture.list
let text = Economy_fixture.text
let compare = Economy_fixture.compare_json
let load () = Yojson.Basic.from_file "../tests/policy/scenarios.json"
let cases = Economy_fixture.cases
let state_value = Economy_fixture.state_value
let command_value c = Native_json.to_json (Command.to_value c)
let decode v = ok (State.of_value (Native_json.of_json v))
let observe s a = ok (Player_view.observe s ~player_id:a)
let value o = Native_json.to_json (Player_view.observation_to_value o)

let proposal o =
  match
    Player_policy.propose o.Player_view.view ~legal_commands:o.legal_commands
  with
  | Ok c ->
      `Assoc
        [
          ("status", `String "accepted");
          ("command", match c with None -> `Null | Some c -> command_value c);
        ]
  | Error r ->
      `Assoc
        [
          ("status", `String "rejected");
          ("rejection", Native_json.to_json (Command.rejection_to_value r));
        ]

let measurements state =
  let before = Native_json.state_json state in
  let result =
    List.map
      (fun a ->
        let o = observe state a in
        check
          (o.legal_commands = Engine.legal_commands state ~player_id:a)
          "complete ordered legal list";
        check
          (ok
             (Player_view.observation_of_value
                (Player_view.observation_to_value o))
          = o)
          "view codec roundtrip";
        let p = proposal o in
        check (proposal o = p && proposal o = p) "policy reproducibility";
        `Assoc [ ("observation", value o); ("proposal", p) ])
      [ 0; 1 ]
  in
  check
    (before = Native_json.state_json state)
    "observation/proposal mutated state, RNG or history";
  `List result

let compare_views label state expected =
  let measurements = measurements state in
  List.iter2
    (fun measurement expected ->
      compare label (member "view" (member "observation" measurement)) expected)
    (Json.to_list measurements)
    (Json.to_list expected);
  measurements

let metadata document =
  check
    (text "contract_sha256" document
    = "6e148a864daf90ee0c4c19451f59e5e4054cb1a9a18877ed8a1b81f9b9f08f15")
    "S06 contract identity";
  let originals =
    Json.to_list
      (Yojson.Basic.from_file "../tests/characterization/scenarios.json")
  in
  let ledger = list "source_ledger" document in
  check
    (List.length ledger = 13)
    "all nine AI and four supporting records required";
  List.iter
    (fun entry ->
      compare "original observation preserved"
        (member "source_record" entry)
        (List.find (fun s -> text "id" s = text "scenario_id" entry) originals))
    ledger;
  let records = cases document in
  check (List.length records = 86) "complete nonempty S06 fixture inventory";
  check
    (List.length (List.sort_uniq String.compare (List.map (text "id") records))
    = List.length records)
    "duplicate policy case";
  List.iter (fun c -> check (list "steps" c <> []) "empty policy steps") records

let run_case record =
  let id = text "id" record in
  let initial =
    try decode (member "initial_state" record)
    with Failure message -> failwith (id ^ " initial: " ^ message)
  in
  let initial_measurements =
    compare_views
      (id ^ " literal initial view")
      initial
      (member "initial_views" record)
  in
  (match member "initial_legal" record with
  | `Null -> ()
  | expected ->
      compare
        (id ^ " literal full legal lists")
        (Economy_fixture.legal_both_value initial)
        expected);
  let rec run state expected steps traces =
    match steps with
    | [] -> List.rev traces
    | step :: rest ->
        let before = Native_json.state_json state in
        let before_measurements = measurements state in
        let actor, command =
          ok (Command.of_value (Native_json.of_json (member "command" step)))
        in
        if Json.to_bool (member "policy" step) then (
          let observation = observe state actor in
          check
            (ok
               (Player_policy.propose observation.view
                  ~legal_commands:observation.legal_commands)
            = Some command)
            (id ^ " literal policy command: "
            ^ Yojson.Basic.to_string (proposal observation));
          check
            (List.mem command observation.legal_commands)
            "proposal not actually offered");
        let result = Engine.perform_command state ~player_id:actor command in
        (* Retain the old view through a transition; all native records are immutable. *)
        check
          (before_measurements = measurements state)
          "old observation changed";
        check
          (before = Native_json.state_json state)
          "submission mutated original state";
        let next, expected, encoded =
          match (result, member "expected_rejection" step) with
          | Error r, (`Assoc _ as wanted) ->
              compare (id ^ " rejection")
                (Native_json.to_json (Command.rejection_to_value r))
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
              let expected = Economy_fixture.expected_after expected step in
              compare
                (id ^ " full resulting state")
                (state_value transition.state)
                expected;
              compare (id ^ " ordered facts")
                (`List
                   (List.map
                      (fun e -> Native_json.to_json (Event.to_value e))
                      transition.events))
                (member "expected_events" step);
              ( transition.state,
                expected,
                `Assoc
                  [
                    ("status", `String "accepted");
                    ( "state_json",
                      `String (Native_json.state_json transition.state) );
                    ("events", member "expected_events" step);
                  ] )
          | Error r, _ ->
              failwith
                (id ^ " unexpected rejection "
                ^ Command.rejection_name r.code
                ^ ":" ^ r.field)
          | Ok _, _ -> failwith (id ^ " accepted negative input")
        in
        let after =
          compare_views
            (id ^ " literal after view")
            next
            (member "expected_views" step)
        in
        (match member "expected_legal" step with
        | `Null -> ()
        | expected ->
            compare
              (id ^ " literal complete pending/terminal legal domain")
              (Economy_fixture.legal_both_value next)
              expected);
        let trace =
          `Assoc
            [
              ("before", before_measurements);
              ( "command_json",
                `String (Yojson.Basic.to_string (member "command" step)) );
              ("result", encoded);
              ("after", after);
            ]
        in
        run next expected rest (trace :: traces)
  in
  `Assoc
    [
      ("id", `String id);
      ("initial_state_json", `String (Native_json.state_json initial));
      ("initial", initial_measurements);
      ( "steps",
        `List
          (run initial (member "initial_state" record) (list "steps" record) [])
      );
    ]
