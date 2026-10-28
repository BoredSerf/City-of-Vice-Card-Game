import inventory from "../../tests/characterization/cards.json";

/** The sole public presentation inventory. Printed facts never decide legality. */
export function card_name(id: number): string {
  const card = inventory.find((entry) => entry.id === id);
  if (!card) throw Error("Unknown public card");
  return card.name;
}
export function card_description(id: number): string {
  const card = inventory.find((entry) => entry.id === id);
  if (!card) throw Error("Unknown public card");
  return `${card.name} · ${card.business} · ${card.color} · ${card.type === "illegal" ? "Distributor" : card.type === "legit" ? "Legitimate business" : "Operator"} · ${card.crew}. Printed activation cost: ${card.activation_cost.join(" + ")}.${card.flavor ? " " + card.flavor : ""}`;
}
export const resource_colors = [
  "green",
  "blue",
  "black",
  "white",
  "yellow",
  "purple",
] as const;
export const color_name = (color: string) =>
  color.charAt(0).toUpperCase() + color.slice(1);
