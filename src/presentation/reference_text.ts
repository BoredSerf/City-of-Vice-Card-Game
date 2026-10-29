import type { Crew } from "@city-of-vice/engine";
export const resource_aliases = {
  green: "Leaf",
  blue: "Crystal",
  black: "Tar",
  white: "Powder",
  yellow: "Speederol",
  purple: "Chillaxipin",
} as const;
/** Working rule descriptions, never command validators or a forecast service. */
export const crew_benefits: Record<Crew, string> = {
  "The Docks":
    "Each paid draw may draw two cards, then its owner discards one of those cards. Use the offered draw mode.",
  "Club Circuit":
    "An operator may declare two distinct ordered targets. Ruffian targets must belong to different crews. Pay the complete offered action.",
  "Trailer Park":
    "When the complete crew protects an action, opposing Hitman and Fixer return affected distributors to your hand instead. Full-hand overflow goes to discard. Ruffian still returns its selected crews.",
  "The Burbs":
    "Incoming income draws a free card. The owner resolves any required discard or legitimate-business cash choice.",
  Pipeline:
    "You may intercept an opposing operator by accepting its offer and paying the operator's printed activation cost. Declining resolves the original whole action.",
  "Night Shift":
    "Your resource limit is twelve instead of ten, and incoming income grants a bonus resource. Losing the crew can require its owner to trim immediately.",
  "Arts District":
    "Once per turn, trade one active distributor with the rival after paying both printed costs. Incoming income resets the allowance.",
  "Hill Country":
    "Trade two resources of one color for one of another instead of four for one.",
};
export const rule_sections = [
  [
    "Start & win",
    "Choose an offered opening distributor. Each player receives three cards and no resources. Twelve active businesses wins; no active distributors loses. Operators do not count as businesses. The engine decides the winner.",
  ],
  [
    "Income & crews",
    "Collect the initial income when offered. End turn automatically collects the incoming player's income; resume and acknowledgement never collect again. Each active distributor produces its color. Complete three-member crews have the benefits below; legitimate businesses and operators produce no ordinary income.",
  ],
  [
    "Activate or cash",
    "Pay the printed activation cost to play a card. A distributor or operator costs one matching resource; a legitimate business costs one matching plus one wildcard. Cash an inactive card for one of its color, or an eligible legitimate business for any color. Use actual offered payment/color choices.",
  ],
  [
    "Business capacity",
    "Three distributor slots plus three for each active legitimate business. At most three legitimate businesses may be possessed in active areas and hand together. Drawing a fourth requires its owner to cash an inactive legitimate business. Active legitimate businesses count toward victory and are protected from all operators.",
  ],
  [
    "Operators",
    "At most two active operators. Hitman pays each target's cost to discard distributors. Ruffian pays each selected target's color and returns that target followed by its crew; overflow beyond seven goes to discard. Fixer pays twice each target's cost and acquires into active space or suspended hand. Whole ordered actions, protection and optional Pipeline consent are resolved by the engine. The operator is disposed once after use.",
  ],
  [
    "Draw & trade",
    "Paid draw prices rise each time and reset on incoming income. Select ordinary or offered Docks mode and a complete offered payment. Resource trading is four for one, or two for one with Hill Country. Arts District offers one distributor pair per turn, paying both printed costs.",
  ],
  [
    "Hand & resource limits",
    "Hand limit seven; resource limit ten, or twelve with Night Shift. Required owners resolve Docks discard, legitimate-business cash and unit resource trims. Transient hand-eight/cash-overflow states remain required choices. Suspended acquisitions must later be activated normally. Menu or Escape does not clear a decision.",
  ],
  [
    "The deck",
    "The base game has 24 distributors in eight crews, six legitimate businesses and six operators. The engine reshuffles discard when needed and supplies the same legal path to both players. Hidden rival hands and deck order are not revealed.",
  ],
] as const;
