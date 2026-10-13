(* Catches a dropped, replaced, or truncated caller-supplied probe label.
   This is a toolchain probe, not a game rule or approved gameplay interface. *)
let () =
  List.iter
    (fun (label, expected) ->
      let actual = Foundation.probe label in
      if actual <> expected then
        failwith
          (Printf.sprintf "probe %S: expected %S, received %S" label expected actual))
    [ ("S02", "OCaml / S02"); ("", "OCaml / "); ("two words", "OCaml / two words") ]
