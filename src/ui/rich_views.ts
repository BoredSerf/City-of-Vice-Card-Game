import type { Player_view, Crew } from "@city-of-vice/engine";
import {
  card_info,
  card_ids,
  crew_names,
  color_name,
} from "../presentation/catalog.ts";
import {
  crew_benefits,
  rule_sections,
  resource_aliases,
} from "../presentation/reference_text.ts";
import { portrait } from "./artwork.ts";

function add<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  text?: string,
) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}
function action(parent: HTMLElement, label: string, run: () => void) {
  const button = add(parent, "button", label);
  button.type = "button";
  button.addEventListener("click", run);
  return button;
}
export function known_location(
  id: number,
  view: Player_view | undefined,
): string {
  if (view?.hand.includes(id)) return "Your hand";
  if (view?.players[0]?.active_card_ids.includes(id)) return "Your active area";
  if (view?.players[1]?.active_card_ids.includes(id))
    return "Rival active area";
  return "Location not shown";
}
export function render_rules(parent: HTMLElement) {
  const page = add(parent, "section");
  page.setAttribute("aria-label", "Rules");
  add(page, "h2", "Rules");
  add(
    page,
    "p",
    "Choose complete payments and ordered targets from available actions. Required choices take priority over the active turn.",
  );
  for (const [title, text] of rule_sections) {
    const section = add(page, "section");
    add(section, "h3", title);
    add(section, "p", text);
  }
  const bonuses = add(page, "section");
  bonuses.setAttribute("aria-label", "Crew bonuses");
  add(bonuses, "h3", "Crew bonuses");
  for (const crew of crew_names) {
    const entry = add(bonuses, "article");
    add(entry, "h4", crew);
    add(entry, "p", crew_benefits[crew]);
  }
  add(
    page,
    "p",
    Object.entries(resource_aliases)
      .map(([color, alias]) => `${alias} / ${color_name(color)}`)
      .join(" · "),
  );
}
export function render_gallery(
  parent: HTMLElement,
  page_number: number,
  inspect: (id: number) => void,
  navigate: (page: number) => void,
) {
  const page = add(parent, "section");
  page.setAttribute("aria-label", "Card gallery");
  add(page, "h2", `Card gallery · page ${page_number + 1} of 3`);
  const grid = add(page, "div");
  grid.className = "gallery_grid";
  for (const id of card_ids.slice(page_number * 12, page_number * 12 + 12)) {
    const card = card_info(id),
      button = action(grid, "", () => inspect(id));
    button.className = "gallery_card";
    button.setAttribute("aria-label", `Inspect ${card.name}`);
    button.append(portrait(id));
    add(button, "strong", card.name);
    add(button, "span", `${card.business} · ${card.color}`);
  }
  const prev = action(page, "Previous 12", () => navigate(page_number - 1));
  prev.disabled = page_number === 0;
  const next = action(page, "Next 12", () => navigate(page_number + 1));
  next.disabled = page_number === 2;
}
export function render_card_inspection(
  parent: HTMLElement,
  id: number,
  view: Player_view | undefined,
  inspect_crew: (crew: Crew) => void,
) {
  const card = card_info(id),
    page = add(parent, "section");
  page.setAttribute("aria-label", "Card inspection");
  add(page, "h2", card.name);
  const art = add(page, "div");
  art.className = "inspection_art";
  art.append(portrait(id));
  add(
    page,
    "p",
    `${card.business} · ${card.type === "illegal" ? "Distributor" : card.type === "legit" ? "Legitimate business" : "Operator"} · ${card.color} · ${card.crew}`,
  );
  add(
    page,
    "p",
    `Printed activation cost: ${card.activation_cost.join(" + ")}.`,
  );
  add(page, "p", known_location(id, view));
  if (card.type === "illegal") {
    add(
      page,
      "p",
      `Produces one ${card.color} resource per incoming income while active.`,
    );
    action(page, `Inspect ${card.crew} crew`, () =>
      inspect_crew(card.crew as Crew),
    );
  } else if (card.type === "legit") {
    add(
      page,
      "p",
      "Adds three distributor slots while active. Protected from all operators. Counts as a business; possessed limit includes your hand.",
    );
  } else {
    add(
      page,
      "p",
      card.business === "Hitman"
        ? "Hitman: discard the selected distributor after paying each target's cost, subject to protection and consent."
        : card.business === "Ruffian"
          ? "Ruffian: pay the chosen target's color; return that target then its crew. Full-hand overflow goes to discard."
          : "Fixer: pay twice each target's cost. Actual acquisitions use active space first, otherwise suspended hand; invalid whole actions are not offered.",
    );
    add(
      page,
      "p",
      "Printed activation is separate from ability payment. Only offered whole ordered targets are actionable. A selection does not guarantee the result of Pipeline consent.",
    );
  }
  if (card.flavor) add(page, "p", card.flavor);
  add(
    page,
    "p",
    "Unlisted locations and exact forecasts are not shown. Available actions remain the engine's complete offered values.",
  );
}
export function render_crew_inspection(
  parent: HTMLElement,
  crew: Crew,
  view: Player_view | undefined,
  inspect_card: (id: number) => void,
) {
  const page = add(parent, "section");
  page.setAttribute("aria-label", "Crew inspection");
  add(page, "h2", crew);
  add(page, "p", crew_benefits[crew]);
  const members = card_ids.filter(
    (id) => card_info(id).type === "illegal" && card_info(id).crew === crew,
  );
  if (view)
    add(
      page,
      "p",
      `Public active members: you ${members.filter((id) => view.players[0]!.active_card_ids.includes(id)).length} of 3; rival ${members.filter((id) => view.players[1]!.active_card_ids.includes(id)).length} of 3.`,
    );
  const grid = add(page, "div");
  grid.className = "gallery_grid";
  for (const id of members) {
    const card = card_info(id),
      button = action(grid, "", () => inspect_card(id));
    button.setAttribute("aria-label", `Inspect ${card.name}`);
    button.append(portrait(id));
    add(button, "strong", card.name);
    add(button, "span", known_location(id, view));
  }
}
