let () =
  let document = Effects_fixture.load () in
  let traces =
    List.map Effects_fixture.run_case (Effects_fixture.cases document)
  in
  print_endline (Yojson.Basic.to_string (`List traces))
