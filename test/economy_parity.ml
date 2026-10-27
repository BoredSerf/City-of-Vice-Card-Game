module Json = Yojson.Basic.Util

let () =
  let document = Economy_fixture.load () in
  let cases =
    List.filter
      (fun record -> Json.to_bool (Json.member "facade" record))
      (Economy_fixture.cases document)
  in
  let traces = List.map Economy_fixture.run_case cases in
  print_endline (Yojson.Basic.to_string (`List traces))
