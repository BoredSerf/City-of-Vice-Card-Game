import type { Engine_event, Win_reason } from "@city-of-vice/engine";
import { card_name, color_name, resource_colors } from "./catalog.ts";

export function actor_name(id: number): string {
  if (id === 0) return "You";
  if (id === 1) return "Rival";
  throw Error("Unknown participant");
}
const actor_possessive = (id: number) =>
  id === 0 ? "your" : id === 1 ? "the rival's" : actor_name(id);
export function outcome_text(winner: number, reason: Win_reason): string {
  const ending =
    reason === "expansion"
      ? "twelve businesses"
      : reason === "elimination"
        ? "elimination"
        : null;
  if (ending === null) throw Error("Unknown outcome");
  return `${winner === 0 ? "Victory" : winner === 1 ? "Defeat" : actor_name(winner)} · ${actor_name(winner)} won by ${ending}.`;
}
const resources = (bank: Record<string, number>) =>
  resource_colors
    .filter((color) => bank[color] !== 0)
    .map((color) => `${bank[color]} ${color_name(color)}`)
    .join(", ") || "no resources";
const decision_name = (decision: string) => {
  switch (decision) {
    case "draw_discard":
      return "discard a drawn card";
    case "legit_cash":
      return "cash a legitimate business";
    case "trim":
      return "trim resources";
    case "post_action_trim":
      return "trim resources after a crew change";
    case "intercept":
      return "answer the Pipeline offer";
    default:
      throw Error("Unknown decision");
  }
};
export { decision_name };
/** Actor/field whitelist. Rival draw identities are never converted to names or retained. */
export function visible_facts(event: Engine_event): string[] {
  switch (event.event) {
    case "game_started":
      return [
        `Game started · turn ${event.turn_number}, ${actor_name(event.active_player)} ${event.active_player === 0 ? "are" : "is"} active.`,
      ];
    case "opening_distributor_chosen":
      return [
        `${actor_name(event.player_id)} opened with ${card_name(event.card_id)}.`,
      ];
    case "initial_hand_dealt":
      return [
        `${actor_name(event.player_id)} received ${event.count} initial cards.`,
      ];
    case "turn_changed":
      return [
        `Turn ${event.turn_number}: ${actor_name(event.from_player)} handed over to ${actor_name(event.to_player)}.`,
      ];
    case "income_collected":
      return [
        `${actor_name(event.player_id)} collected ${resources(event.resources)}.`,
      ];
    case "payment_made":
      return [
        `${actor_name(event.player_id)} paid ${resources(event.resources)}.`,
      ];
    case "crew_resource_granted":
      return [
        `${actor_name(event.player_id)} gained ${event.amount} ${color_name(event.color)} from ${event.crew}.`,
      ];
    case "resource_trimmed":
      return [
        `${actor_name(event.player_id)} trimmed ${event.amount} ${color_name(event.color)}.`,
      ];
    case "resources_traded":
      return [
        `${actor_name(event.player_id)} traded ${event.spent} ${color_name(event.from_color)} for ${event.gained} ${color_name(event.to_color)}.`,
      ];
    case "deck_reshuffled":
      return [
        `${actor_name(event.player_id)} reshuffled ${event.count} cards.`,
      ];
    case "cards_drawn":
      return [
        event.player_id === 0
          ? `You drew ${event.card_ids.map(card_name).join(", ")} (${event.card_ids.length} cards; ${event.source}; price ${event.price ?? "bonus"}).`
          : `${actor_name(event.player_id)} drew ${event.card_ids.length} ${event.card_ids.length === 1 ? "card" : "cards"} (${event.source}; price ${event.price ?? "bonus"}).`,
      ];
    case "card_discarded":
      return [
        `${actor_name(event.player_id)} discarded ${card_name(event.card_id)} for ${event.reason}.`,
      ];
    case "card_cashed":
      return [
        `${actor_name(event.player_id)} cashed ${card_name(event.card_id)} for ${event.amount} ${color_name(event.color)}${event.mandatory ? " (required choice)" : ""}.`,
      ];
    case "card_activated":
      return [
        `${actor_name(event.player_id)} activated ${card_name(event.card_id)}.`,
      ];
    case "crew_completed":
      return [`${actor_name(event.player_id)} completed ${event.crew}.`];
    case "crew_lost":
      return [`${actor_name(event.player_id)} lost ${event.crew}.`];
    case "decision_required":
      return [
        `${actor_name(event.player_id)} must ${decision_name(event.decision)}.`,
      ];
    case "decision_resolved":
      return [
        `${actor_name(event.player_id)} completed the choice: ${decision_name(event.decision)}.`,
      ];
    case "operator_result":
      return [
        `${actor_name(event.player_id)} used ${card_name(event.operator_id)} on ${event.target_ids.map(card_name).join(", ")}.`,
        ...event.affected.map(
          ({ card_id, destination }) =>
            `${card_name(card_id)} ${
              destination.zone === "discard"
                ? "went to discard"
                : destination.zone === "active"
                  ? `became active for ${actor_name(destination.player_id)}`
                  : destination.zone === "hand"
                    ? `went to ${actor_possessive(destination.player_id)} hand${destination.suspended ? " (suspended)" : ""}`
                    : (() => {
                        throw Error("Unknown destination");
                      })()
            }.`,
        ),
      ];
    case "operator_disposed":
      return [
        `${actor_name(event.player_id)} disposed of ${card_name(event.operator_id)}.`,
      ];
    case "intercept_answered":
      return [
        `${actor_name(event.player_id)} ${event.accept ? "accepted" : "declined"} the Pipeline offer for ${card_name(event.operator_id)}.`,
      ];
    case "operator_intercepted":
      return [
        `${actor_name(event.defender_id)} intercepted ${actor_possessive(event.attacker_id)} ${card_name(event.operator_id)}.`,
      ];
    case "distributors_traded":
      return [
        `${actor_name(event.player_id)} traded ${card_name(event.own_card_id)} for ${card_name(event.rival_card_id)}.`,
      ];
    case "game_finished":
      return [outcome_text(event.winner, event.reason)];
    default:
      throw Error("Unknown integration event");
  }
}
