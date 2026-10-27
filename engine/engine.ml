type transition = { state : State.t; events : Event.t list }

let create_session ~seed =
  match Random_source.of_hex seed with
  | None -> Error (Command.reject Invalid_seed "seed")
  | Some random_source -> Ok (State.create random_source)

let command_rejection state ~player_id
    (Command.Start_game { opening_distributor }) =
  if player_id <> 0 then Some (Command.reject Invalid_actor "player_id")
  else if (State.snapshot state).phase <> State.Awaiting_opening then
    Some (Command.reject Wrong_phase "phase")
  else if not (Cards.is_distributor opening_distributor) then
    Some (Command.reject Invalid_opening "opening_distributor")
  else None

let legal_commands state ~player_id =
  List.filter_map
    (fun opening_distributor ->
      let command = Command.Start_game { opening_distributor } in
      match command_rejection state ~player_id command with
      | None -> Some command
      | Some _ -> None)
    Cards.opening_ids

let perform_with_random ~draw_index state ~player_id
    (Command.Start_game { opening_distributor } as command) =
  match command_rejection state ~player_id command with
  | Some rejection -> Error rejection
  | None -> (
      let snapshot = State.snapshot state in
      let opening =
        Setup.deal ~draw_index ~random_source:snapshot.random_source
          ~opening_distributor
      in
      let events =
        Event.setup_events opening_distributor opening.rival_distributor
      in
      let first =
        {
          State.empty_player with
          hand = opening.first_hand;
          active_card_ids = [ opening_distributor ];
        }
      in
      let rival =
        {
          State.empty_player with
          hand = opening.rival_hand;
          active_card_ids = [ opening.rival_distributor ];
        }
      in
      match
        State.of_snapshot
          {
            snapshot with
            phase = Ready;
            turn_number = 1;
            active_player = Some 0;
            deck = opening.deck;
            players = [ first; rival ];
            random_source = opening.random_source;
            history = events;
          }
      with
      | Ok state -> Ok { state; events }
      | Error rejection -> Error rejection)

let perform_command = perform_with_random ~draw_index:Random_source.choose

module For_testing = struct
  let perform_command = perform_with_random
end
