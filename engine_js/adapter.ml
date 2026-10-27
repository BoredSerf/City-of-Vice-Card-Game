let probe = Foundation.probe

open City_engine

let rec to_json = function
  | Wire_value.Null -> Js.Json.null
  | Bool value -> Js.Json.boolean value
  | Number value -> Js.Json.number value
  | String value -> Js.Json.string value
  | Array values -> Js.Json.array (Array.of_list (List.map to_json values))
  | Object fields ->
      let object_ = Js.Dict.empty () in
      List.iter
        (fun (key, value) -> Js.Dict.set object_ key (to_json value))
        fields;
      Js.Json.object_ object_

let rec of_json value =
  match Js.Json.classify value with
  | JSONNull -> Wire_value.Null
  | JSONFalse -> Bool false
  | JSONTrue -> Bool true
  | JSONNumber value -> Number value
  | JSONString value -> String value
  | JSONArray values -> Array (List.map of_json (Array.to_list values))
  | JSONObject fields ->
      Object
        (List.map
           (fun (key, value) -> (key, of_json value))
           (Array.to_list (Js.Dict.entries fields)))

let encode value = Js.Json.stringify (to_json value)

let rejected state_json rejection =
  let open Wire_value in
  encode
    (Object
       [
         ("status", String "rejected");
         ("state_json", state_json);
         ("events", Array []);
         ("rejection", Command.rejection_to_value rejection);
       ])

let accepted state events =
  let open Wire_value in
  encode
    (Object
       [
         ("status", String "accepted");
         ("state_json", String (encode (State.to_value state)));
         ("events", Array (List.map Event.to_value events));
       ])

let parse value =
  if Js.typeof value <> "string" then Error ()
  else try Ok (of_json (Js.Json.parseExn value)) with _ -> Error ()

let create_session seed =
  if Js.typeof seed <> "string" then
    rejected Null (Command.reject Invalid_seed "seed")
  else
    match Engine.create_session ~seed with
    | Ok state -> accepted state []
    | Error rejection -> rejected Null rejection

let decode_state state_json =
  match parse state_json with
  | Error () -> Error (Command.reject Malformed_state "json")
  | Ok value -> State.of_value value

let perform_command state_json command_json =
  let unchanged =
    if Js.typeof state_json = "string" then Wire_value.String state_json
    else Wire_value.Null
  in
  match decode_state state_json with
  | Error rejection -> rejected unchanged rejection
  | Ok state -> (
      let command =
        match parse command_json with
        | Error () -> Error (Command.reject Malformed_command "json")
        | Ok value -> Command.of_value value
      in
      match command with
      | Error rejection -> rejected unchanged rejection
      | Ok (player_id, command) -> (
          match Engine.perform_command state ~player_id command with
          | Ok transition -> accepted transition.state transition.events
          | Error rejection -> rejected unchanged rejection))

let validate_state state_json =
  match decode_state state_json with
  | Ok state -> accepted state []
  | Error rejection ->
      rejected
        (if Js.typeof state_json = "string" then String state_json else Null)
        rejection

let legal_commands state_json player_json =
  match decode_state state_json with
  | Error rejection -> rejected Null rejection
  | Ok state -> (
      let player_id =
        match parse player_json with
        | Ok value -> (
            try Some (Wire_value.int value)
            with Wire_value.Decode_error _ -> None)
        | Error () -> None
      in
      match player_id with
      | Some player_id when player_id = 0 || player_id = 1 ->
          encode
            (Object
               [
                 ("status", String "accepted");
                 ( "commands",
                   Array
                     (List.map Command.to_value
                        (Engine.legal_commands state ~player_id)) );
               ])
      | _ -> rejected Null (Command.reject Invalid_actor "player_id"))
