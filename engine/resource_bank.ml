type t = {
  green : int;
  blue : int;
  black : int;
  white : int;
  yellow : int;
  purple : int;
}

let zero = { green = 0; blue = 0; black = 0; white = 0; yellow = 0; purple = 0 }
let colors = [ Cards.Green; Blue; Black; White; Yellow; Purple ]

let get bank = function
  | Cards.Green -> bank.green
  | Blue -> bank.blue
  | Black -> bank.black
  | White -> bank.white
  | Yellow -> bank.yellow
  | Purple -> bank.purple

let set bank color value =
  match color with
  | Cards.Green -> { bank with green = value }
  | Blue -> { bank with blue = value }
  | Black -> { bank with black = value }
  | White -> { bank with white = value }
  | Yellow -> { bank with yellow = value }
  | Purple -> { bank with purple = value }

let add bank color amount = set bank color (get bank color + amount)
let total bank = List.fold_left (fun sum color -> sum + get bank color) 0 colors

let valid ~max_total bank =
  List.for_all
    (fun color ->
      let count = get bank color in
      count >= 0 && count <= max_total)
    colors
  && total bank <= max_total

let to_value bank =
  Wire_value.Object
    (List.map
       (fun color ->
         (Cards.color_key color, Wire_value.int_value (get bank color)))
       colors)

let of_value value =
  let fields = Wire_value.fields (List.map Cards.color_key colors) value in
  List.fold_left
    (fun bank color ->
      set bank color
        (Wire_value.int (Wire_value.field (Cards.color_key color) fields)))
    zero colors
