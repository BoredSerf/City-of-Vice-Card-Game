import * as facade from "@city-of-vice/engine";
import type {
  Command_result,
  Heuristic_proposal_result,
  Player_observation_result,
  Legal_commands_result,
} from "@city-of-vice/engine";

/** Injection permits forwarding instrumentation; the domain authority remains S07. */
export type Engine_facade = Pick<
  typeof facade,
  | "create_session"
  | "perform_command"
  | "validate_state"
  | "player_observation"
  | "heuristic_proposal"
  | "legal_commands"
>;
function decode<T>(raw: string, accepted_field: string): T {
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("facade_result");
  if (value.status === "accepted") {
    if (!(accepted_field in value)) throw Error("facade_result");
    if (
      accepted_field === "state_json" &&
      (typeof value.state_json !== "string" ||
        !Array.isArray(value.events) ||
        value.events.some(
          (event) =>
            !event ||
            typeof event !== "object" ||
            typeof event.event !== "string",
        ))
    )
      throw Error("facade_result");
    if (accepted_field === "state_json") {
      const state: unknown = JSON.parse(value.state_json as string);
      if (!state || typeof state !== "object" || Array.isArray(state))
        throw Error("facade_result");
    }
    if (accepted_field === "observation") {
      const observation = value.observation as Record<string, unknown> | null;
      if (
        !observation ||
        typeof observation !== "object" ||
        !observation.view ||
        typeof observation.view !== "object" ||
        !Array.isArray(observation.legal_commands)
      )
        throw Error("facade_result");
    }
    if (
      accepted_field === "command" &&
      value.command !== null &&
      (!value.command ||
        typeof value.command !== "object" ||
        typeof (value.command as Record<string, unknown>).command !== "string")
    )
      throw Error("facade_result");
  } else if (
    value.status !== "rejected" ||
    !value.rejection ||
    typeof value.rejection !== "object" ||
    typeof (value.rejection as Record<string, unknown>).code !== "string" ||
    typeof (value.rejection as Record<string, unknown>).field !== "string"
  )
    throw Error("facade_result");
  return value as T;
}
export function engine_boundary(source: Engine_facade = facade) {
  return {
    create_session: (seed: string) =>
      decode<Command_result>(source.create_session(seed), "state_json"),
    perform_command: (state: string, command: string) =>
      decode<Command_result>(
        source.perform_command(state, command),
        "state_json",
      ),
    validate_state: (state: string) =>
      decode<Command_result>(source.validate_state(state), "state_json"),
    player_observation: (state: string, actor: number) =>
      decode<Player_observation_result>(
        source.player_observation(state, JSON.stringify(actor)),
        "observation",
      ),
    heuristic_proposal: (observation: string) =>
      decode<Heuristic_proposal_result>(
        source.heuristic_proposal(observation),
        "command",
      ),
    legal_commands: (state: string, actor: number) =>
      decode<Legal_commands_result>(
        source.legal_commands(state, JSON.stringify(actor)),
        "commands",
      ),
  };
}
