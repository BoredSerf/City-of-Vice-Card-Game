type resolved = {
  debit : Resource_bank.t;
  remaining : Resource_bank.t;
  colors : Cards.color list;
}

let resolve bank costs ~picks =
  let failure code = Error (Command.reject code "payment") in
  if not (Resource_bank.valid ~max_total:26 bank) then failure Invalid_state
  else
    let fixed =
      List.filter_map
        (function Cards.Fixed color -> Some color | Any -> None)
        costs
    in
    let wild_count = List.length costs - List.length fixed in
    let rec debit remaining paid = function
      | [] -> Ok (remaining, List.rev paid)
      | color :: rest ->
          if Resource_bank.get remaining color = 0 then
            failure Insufficient_resources
          else
            debit (Resource_bank.add remaining color (-1)) (color :: paid) rest
    in
    match debit bank [] fixed with
    | Error rejection -> Error rejection
    | Ok (remaining, fixed) -> (
        let rec automatic bank count chosen =
          if count = 0 then List.rev chosen
          else
            let best =
              List.fold_left
                (fun best color ->
                  if Resource_bank.get bank color > Resource_bank.get bank best
                  then color
                  else best)
                Cards.Green Resource_bank.colors
            in
            if Resource_bank.get bank best = 0 then List.rev chosen
            else
              automatic
                (Resource_bank.add bank best (-1))
                (count - 1) (best :: chosen)
        in
        let supplied = picks in
        let picks =
          match picks with
          | None -> automatic remaining wild_count []
          | Some picks -> picks
        in
        if List.length picks <> wild_count then
          failure
            (match supplied with
            | None -> Insufficient_resources
            | Some _ -> Invalid_payment)
        else
          match debit remaining [] picks with
          | Error rejection -> Error rejection
          | Ok (remaining, picked) ->
              let colors = fixed @ picked in
              let debit =
                List.fold_left
                  (fun bank color -> Resource_bank.add bank color 1)
                  Resource_bank.zero colors
              in
              Ok { debit; remaining; colors })
