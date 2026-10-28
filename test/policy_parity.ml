let () =
  let d = Policy_fixture.load () in
  Policy_fixture.metadata d;
  print_endline
    (Yojson.Basic.to_string
       (`List (List.map Policy_fixture.run_case (Policy_fixture.cases d))))
