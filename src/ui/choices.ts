import type { Engine_command } from "@city-of-vice/engine";
import { card_name, color_name } from "./catalog.ts";

export const action_names: Record<Engine_command["command"], string> = {
  start_game: "Choose opening distributor",
  collect_income: "Collect income",
  end_turn: "End turn",
  activate_card: "Activate card",
  cash_card: "Cash card",
  draw_card: "Draw card",
  discard_draw_choice: "Discard drawn card",
  trim_resource: "Trim resource",
  trade_resources: "Trade resources",
  use_operator: "Use operator",
  trade_distributors: "Trade distributors",
  respond_intercept: "Answer Pipeline offer",
};
export type Choice_field = { label: string; value: string; text: string };
const card = (label: string, id: number): Choice_field => ({
  label,
  value: String(id),
  text: card_name(id),
});
const color = (label: string, value: string): Choice_field => ({
  label,
  value,
  text: color_name(value),
});
const payment = (label: string, colors: string[] | null): Choice_field => ({
  label,
  value: colors === null ? "printed" : colors.join("/"),
  text:
    colors === null
      ? "Printed cost · no wildcard"
      : colors.length
        ? colors.map(color_name).join(" + ")
        : "No payment",
});

/** Describe complete offered values only. This function performs no legality search. */
export function command_fields(command: Engine_command): Choice_field[] {
  switch (command.command) {
    case "start_game":
      return [card("Opening distributor", command.opening_distributor)];
    case "activate_card":
      return [
        card("Card to activate", command.card_id),
        payment("Wildcard payment", command.wildcard_payment),
      ];
    case "cash_card":
      return [
        card("Card to cash", command.card_id),
        color("Resource to gain", command.color),
      ];
    case "draw_card":
      return [
        {
          label: "Draw mode",
          value: String(command.use_docks_bonus),
          text: command.use_docks_bonus ? "Docks bonus draw" : "Ordinary draw",
        },
        payment("Draw payment", command.payment),
      ];
    case "discard_draw_choice":
      return [card("Drawn card to discard", command.card_id)];
    case "trim_resource":
      return [color("Resource to trim", command.color)];
    case "trade_resources":
      return [
        color("Resource to spend", command.from_color),
        color("Resource to receive", command.to_color),
      ];
    case "use_operator":
      return [
        card("Operator", command.operator_id),
        card("First target", command.target_ids[0]!),
        command.target_ids[1] === undefined
          ? { label: "Second target", value: "none", text: "No second target" }
          : card("Second target", command.target_ids[1]),
      ];
    case "trade_distributors":
      return [
        card("Your distributor", command.own_card_id),
        card("Rival distributor", command.rival_card_id),
      ];
    case "respond_intercept":
      return [
        {
          label: "Pipeline response",
          value: String(command.accept),
          text: command.accept ? "Accept" : "Decline",
        },
      ];
    case "collect_income":
    case "end_turn":
      return [];
  }
}
export function matching_commands(
  offered: Engine_command[],
  family: Engine_command["command"],
  selected: string[],
): Engine_command[] {
  return offered.filter(
    (command) =>
      command.command === family &&
      selected.every(
        (value, index) => command_fields(command)[index]?.value === value,
      ),
  );
}
export function next_choices(
  offered: Engine_command[],
  family: Engine_command["command"],
  selected: string[],
): Choice_field[] {
  const choices = matching_commands(offered, family, selected)
    .map((command) => command_fields(command)[selected.length])
    .filter((field): field is Choice_field => field !== undefined);
  return choices.filter(
    (choice, index) =>
      choices.findIndex((other) => other.value === choice.value) === index,
  );
}
