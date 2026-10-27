type t = int32

let algorithm = "xorshift32_v1"

let of_hex value =
  if
    String.length value <> 8
    || not
         (String.for_all
            (function '0' .. '9' | 'a' .. 'f' -> true | _ -> false)
            value)
  then None
  else
    let state = Int32.of_string ("0x" ^ value) in
    if state = 0l then None else Some state

let to_hex state = Printf.sprintf "%08lx" state

let next state =
  let open Int32 in
  let state = logxor state (shift_left state 13) in
  let state = logxor state (shift_right_logical state 17) in
  logxor state (shift_left state 5)

let choose ~bound state =
  if bound <= 0 || bound > 36 then invalid_arg "Random_source.choose bound";
  let state = next state in
  let word = Int32.to_float state in
  let unsigned = if word < 0. then word +. 4294967296. else word in
  ( int_of_float (Float.floor (unsigned /. 4294967296. *. float_of_int bound)),
    state )
