import type { Engine_event } from "@city-of-vice/engine";
import { card_name } from "./catalog.ts";
import { visible_facts } from "./visibility.ts";
export type Completed_result = {
  title: string;
  facts: string[];
  cards: { card_id: number; stamp: string }[];
};
/** Only completed public operator fields are retained; no raw batch/private draw data. */
export function completed_results(events: Engine_event[]): Completed_result[] {
  const results: Completed_result[] = [];
  for (const event of events) {
    if (event.event === "operator_result")
      results.push({
        title: `Completed ${card_name(event.operator_id)} action`,
        facts: visible_facts(event),
        cards: [
          { card_id: event.operator_id, stamp: "OPERATOR" },
          ...event.affected.map(({ card_id, destination }) => ({
            card_id,
            stamp:
              destination.zone === "discard"
                ? "DISCARDED"
                : destination.zone === "active"
                  ? "ACTIVE"
                  : destination.suspended
                    ? "SUSPENDED HAND"
                    : "RETURNED TO HAND",
          })),
        ],
      });
    else if (
      event.event === "intercept_answered" ||
      event.event === "operator_intercepted" ||
      event.event === "operator_disposed"
    )
      results.push({
        title:
          event.event === "operator_disposed"
            ? "Operator disposed"
            : "Pipeline response completed",
        facts: visible_facts(event),
        cards: [
          {
            card_id: event.operator_id,
            stamp:
              event.event === "operator_disposed" ? "DISPOSED" : "RESPONSE",
          },
        ],
      });
  }
  return results;
}
