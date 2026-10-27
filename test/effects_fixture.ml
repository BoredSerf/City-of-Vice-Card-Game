open City_engine
module Json = Yojson.Basic.Util

let check = Economy_fixture.check
let member = Json.member
let text name record = Json.to_string (member name record)
let list name record = Json.to_list (member name record)
let load () = Yojson.Basic.from_file "../tests/effects/scenarios.json"
let cases = Economy_fixture.cases
let run_case record = Economy_fixture.run_case ~both_players:true record

let metadata_test document =
  check
    (text "contract_sha256" document
    = "cc71b5a8769320e40952c58876ab04c0d8a17310b8c8c646df0946e9276b7876")
    "S05 contract identity";
  check
    (text "rules_version" document = State.rules_version)
    "S05 fixture rules identifier";
  let originals =
    Json.to_list
      (Yojson.Basic.from_file "../tests/characterization/scenarios.json")
  in
  let ledger = list "source_ledger" document in
  check (List.length ledger = 59) "S05 must preserve59 named source records";
  check
    (List.length
       (List.sort_uniq String.compare (List.map (text "scenario_id") ledger))
    = 59)
    "S05 duplicate source record";
  List.iter
    (fun entry ->
      let source =
        List.find
          (fun record -> text "id" record = text "scenario_id" entry)
          originals
      in
      Economy_fixture.compare_json "S05 unchanged original source record"
        (member "source_record" entry)
        source;
      check
        (text "approval" source = "unapproved_candidate")
        "S05 changed original approval")
    ledger;
  let records = cases document @ list "invalid_states" document in
  List.iter
    (fun ident ->
      check
        (List.exists (fun record -> text "contract_id" record = ident) records)
        ("missing S05 fixture: " ^ ident))
    [
      "S05-PROV-PIPELINE-001";
      "S05-PROV-FIXER-001";
      "S05-PROV-RUFFIAN-001";
      "S05-PROV-TRAILER-001";
      "S05-PROV-TRAILER-NIGHT-001";
      "S05-PROV-NIGHT-001";
      "S05-PROV-ARTS-NIGHT-001";
      "S05-PROV-TERMINAL-NIGHT-001";
      "S05-DERIVED-WIN-001";
      "S05-DERIVED-WIN-002";
      "S05-DERIVED-CREWS-001";
      "S05-PROV-INVALID-001";
      "S05-DERIVED-CODEC-001";
    ];
  List.iter
    (fun case ->
      check (list "steps" case <> []) "empty S05 case";
      List.iter
        (fun reference ->
          let source =
            List.find
              (fun record -> text "id" record = text "scenario_id" reference)
              originals
          in
          List.iter
            (fun index ->
              let index = Json.to_int index in
              check
                (index >= 1 && index <= List.length (list "steps" source))
                "S05 invalid source step")
            (list "steps" reference))
        (list "source_refs" case))
    (cases document)
