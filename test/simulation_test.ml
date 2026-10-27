open City_engine

let check = Economy_fixture.check
let ok = Economy_fixture.ok
let budget = 10_000
let seeds = [ "00000001"; "12345678"; "7fffffff"; "80000000"; "ffffffff" ]
let count predicate ids = List.length (List.filter predicate ids)
let distributors player = count (fun id -> id < 24) player.State.active_card_ids
let legits ids = count (fun id -> id >= 24 && id < 30) ids
let businesses player = count (fun id -> id < 30) player.State.active_card_ids

let final_night_loss (snapshot : State.snapshot) owner =
  let rec action_tail lost = function
    | Event.Crew_lost { player_id; crew = Night_shift } :: rest ->
        action_tail (lost || player_id = owner) rest
    | Operator_result { player_id; affected; _ } :: _ ->
        let current = List.nth snapshot.players owner in
        lost
        && owner = 1 - player_id
        && List.for_all
             (fun id ->
               List.mem id current.active_card_ids
               || List.exists
                    (fun (entry : Event.affected) -> entry.card_id = id)
                    affected)
             [ 15; 16; 17 ]
        && List.exists
             (fun (entry : Event.affected) ->
               entry.card_id >= 15 && entry.card_id <= 17)
             affected
    | Card_activated _ :: _ | Distributors_traded _ :: _ -> false
    | _ :: rest -> action_tail lost rest
    | [] -> false
  in
  action_tail false (List.rev snapshot.history)

(* These assertions use the literal catalog ID partition and public snapshot,
   independently of State.of_snapshot's validation implementation. *)
let invariants state =
  let snapshot = State.snapshot state in
  check
    (snapshot.schema_version = 2 && List.length snapshot.players = 2)
    "simulation schema/players";
  let locations =
    snapshot.deck @ snapshot.discard
    @ List.concat_map
        (fun (p : State.player) -> p.hand @ p.active_card_ids)
        snapshot.players
  in
  check
    (List.sort Int.compare locations = List.init 36 Fun.id)
    "simulation physical partition";
  List.iteri
    (fun who (owner : State.player) ->
      let active = snapshot.active_player = Some who in
      let bank = Resource_bank.total owner.resources in
      let owned_pending =
        match snapshot.pending_decision with
        | Some (Pending_draw_discard { player_id; _ })
        | Some (Pending_legit_cash { player_id; _ })
        | Some (Pending_trim { player_id })
        | Some (Pending_post_action_trim { player_id })
        | Some (Pending_intercept { player_id; _ }) ->
            player_id = who
        | None -> false
      in
      let max_bank =
        match (snapshot.phase, snapshot.pending_decision) with
        | State.Over, _ -> 12
        | Legit_cash, _ when active -> 25
        | Trim, Some (Pending_post_action_trim _) when owned_pending -> 12
        | Trim, Some (Pending_trim _) when active -> 26
        | _ ->
            if
              List.for_all
                (fun id -> List.mem id owner.active_card_ids)
                [ 15; 16; 17 ]
            then 12
            else 10
      in
      check
        (List.for_all
           (fun color -> Resource_bank.get owner.resources color >= 0)
           Resource_bank.colors
        && bank <= max_bank)
        "simulation resource bound";
      check
        (List.length owner.hand
        <= if snapshot.phase = Draw_discard && active then 8 else 7)
        "simulation hand bound";
      check
        (legits (owner.hand @ owner.active_card_ids)
        <=
        if snapshot.phase = Draw_discard && active then 5
        else if snapshot.phase = Legit_cash && active then 4
        else 3)
        "simulation legit possession";
      check
        (distributors owner <= 3 * (legits owner.active_card_ids + 1))
        "simulation capacity";
      check
        (count (fun id -> id >= 30) owner.active_card_ids <= 2)
        "simulation operator limit";
      check
        (List.for_all
           (fun id -> id < 24 && List.mem id owner.hand)
           owner.suspended_card_ids)
        "simulation suspension";
      check (owner.draw_price >= 1 && owner.draw_price <= 13) "simulation price")
    snapshot.players;
  (match (snapshot.phase, snapshot.outcome) with
  | Awaiting_opening, None -> ()
  | Over, Some outcome ->
      check (snapshot.pending_decision = None) "terminal pending decision";
      let winner = List.nth snapshot.players outcome.winner in
      let loser = List.nth snapshot.players (1 - outcome.winner) in
      let reason =
        if distributors loser = 0 then Event.Elimination else Expansion
      in
      check
        (distributors winner > 0
        && outcome.reason = reason
        && (reason = Elimination || businesses winner >= 12))
        "independent final winner/reason";
      check
        (not (List.for_all (fun p -> distributors p = 0) snapshot.players))
        "ambiguous elimination";
      check
        (not (List.for_all (fun p -> businesses p >= 12) snapshot.players))
        "ambiguous expansion";
      List.iteri
        (fun owner player ->
          let live_cap =
            if
              List.for_all
                (fun id -> List.mem id player.State.active_card_ids)
                [ 15; 16; 17 ]
            then 12
            else 10
          in
          check
            (Resource_bank.total player.resources <= live_cap
            || final_night_loss snapshot owner)
            "independent terminal Night-loss cap cause")
        snapshot.players
  | _, None ->
      List.iter
        (fun p ->
          check
            (distributors p > 0 && businesses p < 12)
            "simulation unadjudicated live board")
        snapshot.players
  | _ -> failwith "simulation phase/outcome");
  check
    (ok (Native_json.decode_state (Native_json.state_json state)) = state)
    "simulation native roundtrip"

let family = function
  | Command.Start_game _ -> "start"
  | Collect_income -> "income"
  | Draw_card _ -> "draw"
  | Discard_draw_choice _ -> "discard"
  | Cash_card _ -> "cash"
  | Trim_resource _ -> "trim"
  | Trade_resources _ -> "resource_trade"
  | End_turn -> "handoff"
  | Activate_card _ -> "activate"
  | Use_operator _ -> "operator"
  | Trade_distributors _ -> "distributor_trade"
  | Respond_intercept _ -> "intercept"

let driver_index ~bound driver =
  check (bound > 0) "driver requires a nonempty choice domain";
  let driver = Random_source.next driver in
  let unsigned =
    Int64.to_float (Int64.of_string ("0x" ^ Random_source.to_hex driver))
  in
  ( int_of_float (Float.floor (unsigned /. 4294967296. *. float_of_int bound)),
    driver )

let choose driver commands =
  let families =
    List.fold_left
      (fun names (_, command) ->
        let name = family command in
        if List.mem name names then names else names @ [ name ])
      [] commands
  in
  let choice, driver = driver_index ~bound:(List.length families) driver in
  let selected =
    List.filter
      (fun (_, command) -> family command = List.nth families choice)
      commands
  in
  let choice, driver = driver_index ~bound:(List.length selected) driver in
  (List.nth selected choice, driver)

let wire_command (actor, command) =
  match Native_json.to_json (Command.to_value command) with
  | `Assoc fields -> `Assoc (("player_id", `Int actor) :: fields)
  | _ -> assert false

let terminal_rejections state =
  let original = Native_json.state_json state in
  let commands =
    [
      Command.Start_game { opening_distributor = 0 };
      Collect_income;
      Draw_card { payment = []; use_docks_bonus = false };
      Discard_draw_choice { card_id = 0 };
      Cash_card { card_id = 0; color = Green };
      Trim_resource { color = Green };
      Trade_resources { from_color = Green; to_color = Blue };
      End_turn;
      Activate_card { card_id = 0; wildcard_payment = None };
      Use_operator { operator_id = 30; target_ids = [ 0 ] };
      Trade_distributors { own_card_id = 0; rival_card_id = 1 };
      Respond_intercept { accept = true };
    ]
  in
  List.iter
    (fun player_id ->
      check (Engine.legal_commands state ~player_id = []) "terminal discovery";
      List.iter
        (fun command ->
          match Engine.perform_command state ~player_id command with
          | Error { code = Game_over; field = "phase" } -> ()
          | _ -> failwith "post-terminal native rejection")
        commands)
    [ 0; 1 ];
  check (Native_json.state_json state = original) "post-terminal mutation"

let play index engine_seed opening =
  let driver_seed =
    Printf.sprintf "%08lx" (Int32.add 0x5eed0001l (Int32.of_int index))
  in
  let initial = ok (Engine.create_session ~seed:engine_seed) in
  let opening_command =
    (0, Command.Start_game { opening_distributor = opening })
  in
  let started =
    ok (Engine.perform_command initial ~player_id:0 (snd opening_command))
  in
  let rec run count state driver commands results =
    invariants state;
    let before = Native_json.state_json state in
    (match Engine.perform_command state ~player_id:2 End_turn with
    | Error { code = Invalid_actor; field = "player_id" } -> ()
    | _ -> failwith "simulation deliberate invalid actor");
    check
      (before = Native_json.state_json state)
      "simulation rejection mutation";
    match (State.snapshot state).outcome with
    | Some outcome ->
        terminal_rejections state;
        let commands = List.rev commands and results = List.rev results in
        let replayed =
          List.fold_left2
            (fun replay (player_id, command) expected ->
              let actual =
                ok (Engine.perform_command replay ~player_id command)
              in
              check (actual = expected)
                "full recorded command/event/state replay differs";
              actual.state)
            initial commands results
        in
        check (replayed = state) "final replay/cursor/outcome differs";
        let record =
          `Assoc
            [
              ("engine_seed", `String engine_seed);
              ("opening_distributor", `Int opening);
              ("driver_seed", `String driver_seed);
              ("driver_final", `String (Random_source.to_hex driver));
              ("command_count", `Int count);
              ("winner", `Int outcome.winner);
              ("reason", `String (Event.win_reason_name outcome.reason));
              ( "engine_cursor",
                `String
                  (Random_source.to_hex (State.snapshot state).random_source) );
              ("commands", `List (List.map wire_command commands));
            ]
        in
        print_endline (Yojson.Basic.to_string record);
        count
    | None ->
        check (count < budget)
          (Printf.sprintf
             "incomplete simulation: seed=%s opening=%d driver=%s budget=%d"
             engine_seed opening driver_seed budget);
        let legal =
          List.concat_map
            (fun player_id ->
              List.map
                (fun command -> (player_id, command))
                (Engine.legal_commands state ~player_id))
            [ 0; 1 ]
        in
        check (legal <> []) "live simulation has no public continuation";
        let selected, driver = choose driver legal in
        check
          (before = Native_json.state_json state)
          "driver choice advanced engine RNG";
        let player_id, command = selected in
        let transition = ok (Engine.perform_command state ~player_id command) in
        run (count + 1) transition.state driver (selected :: commands)
          (transition :: results)
  in
  run 1 started.state
    (Option.get (Random_source.of_hex driver_seed))
    [ opening_command ] [ started ]

let () =
  let selected, next =
    driver_index ~bound:100 (Option.get (Random_source.of_hex "04080601"))
  in
  check
    (selected = 61 && Random_source.to_hex next = "9dcca8c5")
    "driver arbitrary-bound literal control";
  let count = ref 0 and maximum = ref 0 and total = ref 0 in
  List.iter
    (fun seed ->
      List.iter
        (fun opening ->
          let steps = play !count seed opening in
          incr count;
          total := !total + steps;
          maximum := max !maximum steps)
        Cards.opening_ids)
    seeds;
  check (!count = 120) "incomplete120-game matrix";
  Printf.printf
    "{\"summary\":\"S05 complete seeded \
     games\",\"completed\":%d,\"replayed\":%d,\"commands\":%d,\"maximum\":%d,\"budget\":%d,\"driver\":\"family-balanced-v1\"}\n\
     %!"
    !count !count !total !maximum budget
