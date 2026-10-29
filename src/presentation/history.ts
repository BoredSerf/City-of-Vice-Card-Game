import type { Engine_event } from "@city-of-vice/engine";
import { visible_facts } from "./visibility.ts";

export type Visible_history_entry = {
  turn_number: number | null;
  actor: 0 | 1 | null;
  text: string;
};
export type Visible_history_result =
  | { status: "available"; entries: Visible_history_entry[] }
  | { status: "no_game" | "integration_fault"; entries: [] };

/** Projection of already admitted canonical history; no domain validation or replay. */
export function project_visible_history(
  history: Engine_event[],
): Visible_history_entry[] {
  let turn_number: number | null = null;
  const entries: Visible_history_entry[] = [];
  for (const event of history) {
    if (event.event === "game_started" || event.event === "turn_changed") {
      if (!Number.isSafeInteger(event.turn_number) || event.turn_number < 0)
        throw Error("Invalid history context");
      turn_number = event.turn_number;
    }
    const candidate =
      "player_id" in event
        ? event.player_id
        : event.event === "game_started"
          ? event.active_player
          : event.event === "turn_changed"
            ? event.to_player
            : event.event === "operator_intercepted"
              ? event.defender_id
              : event.event === "game_finished"
                ? event.winner
                : null;
    if (candidate !== null && candidate !== 0 && candidate !== 1)
      throw Error("Invalid history actor");
    for (const text of visible_facts(event))
      entries.push({ turn_number, actor: candidate, text });
  }
  return entries.slice(-30);
}
