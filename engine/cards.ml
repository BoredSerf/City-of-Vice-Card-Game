type color = Green | Blue | Black | White | Yellow | Purple

type crew =
  | Docks
  | Club_circuit
  | Trailer_park
  | Burbs
  | Pipeline
  | Night_shift
  | Arts_district
  | Hill_country

type ability = Kill | Coerce | Buy
type category = Distributor | Legit | Operator of ability
type cost = Fixed of color | Any

type t = {
  id : int;
  name : string;
  business : string;
  color : color;
  category : category;
  crew : crew option;
  activation_cost : cost list;
  ability_cost : cost list;
  flavor : string;
}

let color_name = function
  | Green -> "Green"
  | Blue -> "Blue"
  | Black -> "Black"
  | White -> "White"
  | Yellow -> "Yellow"
  | Purple -> "Purple"

let color_key = function
  | Green -> "green"
  | Blue -> "blue"
  | Black -> "black"
  | White -> "white"
  | Yellow -> "yellow"
  | Purple -> "purple"

let crew_name = function
  | Docks -> "The Docks"
  | Club_circuit -> "Club Circuit"
  | Trailer_park -> "Trailer Park"
  | Burbs -> "The Burbs"
  | Pipeline -> "Pipeline"
  | Night_shift -> "Night Shift"
  | Arts_district -> "Arts District"
  | Hill_country -> "Hill Country"

let ability_name = function Kill -> "kill" | Coerce -> "coerce" | Buy -> "buy"

let make id name business color category crew =
  let activation_cost =
    match category with Legit -> [ Fixed color; Any ] | _ -> [ Fixed color ]
  in
  {
    id;
    name;
    business;
    color;
    category;
    crew;
    activation_cost;
    ability_cost = [];
    flavor = "";
  }

let distributor id name business color crew =
  make id name business color Distributor (Some crew)

let legit id name color = make id name name color Legit None

let operator id name business color ability =
  make id name business color (Operator ability) None

let all =
  [
    distributor 0 "Ishmael Kelp" "Dockside" Green Docks;
    distributor 1 "Slick Panzer" "Waterfront" Black Docks;
    distributor 2 "Ivory Crane" "Shipping Office" White Docks;
    distributor 3 "Fizzy Sparks" "Nightclub Bar" Yellow Club_circuit;
    distributor 4 "Colby Dunn" "Club Entrance" Blue Club_circuit;
    distributor 5 "Bianca Starr" "Dance Floor" White Club_circuit;
    distributor 6 "Velvet Zizek" "Trailer Door" Purple Trailer_park;
    distributor 7 "Skeeter Rash" "Back Window" Black Trailer_park;
    distributor 8 "Clover Gaines" "Front Porch" Green Trailer_park;
    distributor 9 "Nero Lombardy" "Poolside" Black Burbs;
    distributor 10 "Mavis Marlow" "Over the Hedge" Purple Burbs;
    distributor 11 "Whitney Whitlock" "Open House" White Burbs;
    distributor 12 "Cinder Briggs" "Scrapyard" Black Pipeline;
    distributor 13 "Dwight Waters" "Car Wash" Blue Pipeline;
    distributor 14 "Dizzy Diesel" "Repo & Towing" Yellow Pipeline;
    distributor 15 "Vera Veil" "Coat Check" Purple Night_shift;
    distributor 16 "Iggy Static" "Backstage" Blue Night_shift;
    distributor 17 "Gigi Watts" "Drum Kit" Yellow Night_shift;
    distributor 18 "Lyla Plum" "New Age Store" Purple Arts_district;
    distributor 19 "Drew Moss" "Mural Studio" Green Arts_district;
    distributor 20 "Sterling Starch" "Stage Door" White Arts_district;
    distributor 21 "Sunny Rattle" "Roadside Stand" Yellow Hill_country;
    distributor 22 "Flint Wheeler" "Trucking Route" Blue Hill_country;
    distributor 23 "Bud Bramble" "Country Acreage" Green Hill_country;
    legit 24 "Records & Games" Green;
    legit 25 "Auto Shop" Blue;
    legit 26 "Budget Motel" Black;
    legit 27 "Cocktail Bar" White;
    legit 28 "Festival Grounds" Yellow;
    legit 29 "Clinic" Purple;
    operator 30 "Wade Haskett" "Hitman" Green Kill;
    operator 31 "Ellis Voss" "Hitman" Blue Kill;
    operator 32 "Eddie Pruitt" "Ruffian" Yellow Coerce;
    operator 33 "Dottie Bellini" "Ruffian" Purple Coerce;
    operator 34 "Leonard Huff" "Fixer" Black Buy;
    operator 35 "Simone Mercer" "Fixer" White Buy;
  ]

let find id = List.find_opt (fun card -> card.id = id) all

let is_distributor id =
  match find id with Some { category = Distributor; _ } -> true | _ -> false

let opening_ids =
  List.filter_map
    (fun card -> if is_distributor card.id then Some card.id else None)
    all

let color_of_key = function
  | "green" -> Some Green
  | "blue" -> Some Blue
  | "black" -> Some Black
  | "white" -> Some White
  | "yellow" -> Some Yellow
  | "purple" -> Some Purple
  | _ -> None

let complete_crew active crew =
  List.for_all
    (fun card -> card.crew <> Some crew || List.mem card.id active)
    all

let crews =
  [
    Docks;
    Club_circuit;
    Trailer_park;
    Burbs;
    Pipeline;
    Night_shift;
    Arts_district;
    Hill_country;
  ]

let crew_of_name name = List.find_opt (fun crew -> crew_name crew = name) crews
