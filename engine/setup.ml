type 'random opening = {
  deck : int list;
  first_hand : int list;
  rival_hand : int list;
  rival_distributor : int;
  random_source : 'random;
}

let deal ~draw_index ~random_source ~opening_distributor =
  let selected =
    match Cards.find opening_distributor with
    | Some ({ category = Distributor; _ } as card) -> card
    | _ -> invalid_arg "Setup.deal opening_distributor"
  in
  (* Mutation is confined to a fresh local shuffle buffer, never session state. *)
  let deck =
    Array.of_list (List.map (fun (card : Cards.t) -> card.id) Cards.all)
  in
  let random_source = ref random_source in
  let choose bound =
    let index, next = draw_index ~bound !random_source in
    if index < 0 || index >= bound then invalid_arg "Setup.deal random index";
    random_source := next;
    index
  in
  for index = Array.length deck - 1 downto 1 do
    let other = choose (index + 1) in
    let value = deck.(index) in
    deck.(index) <- deck.(other);
    deck.(other) <- value
  done;
  let deck = List.filter (( <> ) opening_distributor) (Array.to_list deck) in
  let options =
    List.filter
      (fun id ->
        match Cards.find id with
        | Some card ->
            card.category = Cards.Distributor
            && card.crew <> selected.crew
            && card.color <> selected.color
        | None -> false)
      deck
  in
  let rival_distributor = List.nth options (choose (List.length options)) in
  let top_first = List.rev (List.filter (( <> ) rival_distributor) deck) in
  match top_first with
  | first_1 :: rival_1 :: first_2 :: rival_2 :: first_3 :: rival_3 :: remaining
    ->
      {
        deck = List.rev remaining;
        first_hand = [ first_1; first_2; first_3 ];
        rival_hand = [ rival_1; rival_2; rival_3 ];
        rival_distributor;
        random_source = !random_source;
      }
  | _ -> invalid_arg "Setup.deal card inventory"
