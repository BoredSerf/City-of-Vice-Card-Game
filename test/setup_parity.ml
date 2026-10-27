open City_engine

let ok = function
  | Ok value -> value
  | Error rejection -> failwith (Command.rejection_name rejection.Command.code)

let () =
  let cases =
    List.concat_map
      (fun seed ->
        let initial = ok (Engine.create_session ~seed) in
        List.map
          (fun opening_distributor ->
            let transition =
              ok
                (Engine.perform_command initial ~player_id:0
                   (Start_game { opening_distributor }))
            in
            Wire_value.Object
              [
                ("seed", String seed);
                ("opening_distributor", Wire_value.int_value opening_distributor);
                ("initial_state", State.to_value initial);
                ("state", State.to_value transition.state);
                ("events", Array (List.map Event.to_value transition.events));
              ])
          Cards.opening_ids)
      Native_json.seeds
  in
  print_endline (Native_json.encode (Array cases))
