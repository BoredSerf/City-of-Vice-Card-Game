import type {
  Engine_command,
  Engine_event,
  Player_observation,
  Rejected,
} from "@city-of-vice/engine";
import { engine_boundary, type Engine_facade } from "../engine/index.ts";
import {
  local_persistence,
  type Storage_port,
  type Storage_failure,
} from "./persistence.ts";

type Rejection = Rejected["rejection"];
type Slot =
  | { admission: "uninspected" | "empty" | "unreadable" }
  | { admission: "valid"; resumable: boolean }
  | { admission: "rejected"; rejection: Rejection };
type Authority = "owned" | "protected" | "suspended";
export type New_game_intent = "empty_only" | "replace" | "memory_only";
export type Controller_snapshot = {
  human: Player_observation | null;
  save: {
    slot: Slot;
    saved: boolean;
    write_authority: Authority;
    failure: Storage_failure["stage"] | null;
  };
  integration_fault: boolean;
};
export type Controller_update = {
  status:
    | "applied"
    | "inspected"
    | "idle"
    | "cancelled"
    | "no_game"
    | "rejected"
    | "unavailable"
    | "replacement_required"
    | "integration_fault"
    | "saved";
  snapshot: Controller_snapshot;
  rejection: Rejection | null;
  /** Trusted local facts for this operation only; may contain private card IDs.
   * Never pass these events to a policy or render their raw JSON as player data. */
  trusted_events: Engine_event[];
};

export function create_controller(
  options: { storage?: () => Storage_port; facade?: Engine_facade } = {},
) {
  const engine = engine_boundary(options.facade);
  const storage = local_persistence(options.storage);
  let canonical: string | null = null;
  let baseline: string | null | undefined;
  let saved = false;
  let authority: Authority = "protected";
  let slot: Slot = { admission: "uninspected" };
  let failure: Storage_failure["stage"] | null = null;
  const owns_slot = () => authority === "owned";

  function human_observation(state: string): Player_observation {
    const result = engine.player_observation(state, 0);
    if (result.status !== "accepted") throw Error("facade_observation");
    return result.observation;
  }
  function snapshot(): Controller_snapshot {
    let human: Player_observation | null = null;
    let integration_fault = false;
    try {
      if (canonical !== null) human = human_observation(canonical);
    } catch {
      integration_fault = true;
    }
    if (saved && slot.admission === "valid" && human !== null)
      slot = { admission: "valid", resumable: human.view.phase !== "over" };
    return structuredClone({
      human,
      save: { slot, saved, write_authority: authority, failure },
      integration_fault,
    });
  }
  function update(
    status: Controller_update["status"],
    events: Engine_event[] = [],
    rejection: Rejection | null = null,
  ): Controller_update {
    return {
      status,
      snapshot: snapshot(),
      rejection: structuredClone(rejection),
      trusted_events: structuredClone(events),
    };
  }
  function unavailable(problem: Storage_failure) {
    failure = problem.stage;
    if (problem.stage !== "write") {
      authority = "suspended";
      slot = { admission: "unreadable" };
      saved = false;
    }
  }
  function write(replacing = false): boolean {
    if (canonical === null) return false;
    const result = storage.write(canonical);
    if (result.status === "written") {
      baseline = canonical;
      authority = "owned";
      saved = true;
      failure = null;
      // Successful saving does not run a second admission or replay any history.
      slot = { admission: "valid", resumable: false };
      return true;
    }
    saved = false;
    if (replacing) {
      baseline = undefined;
      authority = "protected";
    }
    unavailable(result);
    return false;
  }
  function read_slot() {
    const result = storage.read();
    if (result.status === "unavailable") {
      unavailable(result);
      return { status: "unavailable" } as const;
    }
    failure = null;
    if (result.value === null) {
      slot = { admission: "empty" };
      if (
        canonical !== null &&
        (baseline !== undefined || authority !== "owned")
      ) {
        authority = "owned";
        baseline = null;
        saved = false;
      }
      return { status: "empty" } as const;
    }
    const admitted = engine.validate_state(result.value);
    if (admitted.status !== "accepted") {
      slot = { admission: "rejected", rejection: admitted.rejection };
      if (canonical !== null) {
        authority = "protected";
        saved = false;
      }
      return { status: "rejected", rejection: admitted.rejection } as const;
    }
    const human = human_observation(admitted.state_json);
    slot = { admission: "valid", resumable: human.view.phase !== "over" };
    if (canonical !== null) {
      if (baseline !== undefined && result.value === baseline) {
        authority = "owned";
        saved = admitted.state_json === canonical;
      } else {
        authority = "protected";
        saved = false;
      }
    }
    return {
      status: "valid",
      raw: result.value,
      canonical: admitted.state_json,
    } as const;
  }
  function submit(command: Engine_command, actor: 0 | 1): Controller_update {
    if (canonical === null) return update("no_game");
    let result;
    try {
      result = engine.perform_command(
        canonical,
        JSON.stringify({ ...command, player_id: actor }),
      );
    } catch {
      return update("integration_fault");
    }
    if (result.status !== "accepted")
      return update("rejected", [], result.rejection);
    canonical = result.state_json;
    saved = false;
    if (authority === "owned") write();
    return update("applied", result.events);
  }
  return {
    snapshot,
    inspect_save(): Controller_update {
      try {
        const result = read_slot();
        return update(
          result.status === "unavailable" ? "unavailable" : "inspected",
          [],
          result.status === "rejected" ? result.rejection : null,
        );
      } catch {
        authority = "suspended";
        saved = false;
        return update("integration_fault");
      }
    },
    resume(): Controller_update {
      try {
        const result = read_slot();
        if (result.status !== "valid")
          return update(
            result.status === "empty" ? "idle" : result.status,
            [],
            result.status === "rejected" ? result.rejection : null,
          );
        canonical = result.canonical;
        baseline = result.raw;
        authority = "owned";
        saved = true;
        return update("applied");
      } catch {
        authority = "suspended";
        saved = false;
        return update("integration_fault");
      }
    },
    new_game(seed: string, intent?: New_game_intent): Controller_update {
      if (
        intent !== "empty_only" &&
        intent !== "replace" &&
        intent !== "memory_only"
      )
        return update("cancelled");
      let candidate;
      try {
        candidate = engine.create_session(seed);
      } catch {
        return update("integration_fault");
      }
      if (candidate.status !== "accepted")
        return update("rejected", [], candidate.rejection);
      if (intent === "empty_only") {
        try {
          const result = read_slot();
          if (result.status !== "empty")
            return update(
              result.status === "unavailable"
                ? "unavailable"
                : "replacement_required",
            );
        } catch {
          return update("integration_fault");
        }
      }
      canonical = candidate.state_json;
      baseline = undefined;
      saved = false;
      authority = "protected";
      if (intent === "empty_only") {
        baseline = null;
        authority = "owned";
        write();
      } else if (intent === "replace") write(true);
      return update("applied", candidate.events);
    },
    cancel(): Controller_update {
      return update("cancelled");
    },
    submit_human(command: Engine_command): Controller_update {
      return submit(command, 0);
    },
    step_rival(): Controller_update {
      if (canonical === null) return update("no_game");
      try {
        const observed = engine.player_observation(canonical, 1);
        if (observed.status !== "accepted")
          return update("rejected", [], observed.rejection);
        const proposed = engine.heuristic_proposal(
          JSON.stringify(observed.observation),
        );
        if (proposed.status !== "accepted")
          return update("rejected", [], proposed.rejection);
        return proposed.command === null
          ? update("idle")
          : submit(proposed.command, 1);
      } catch {
        return update("integration_fault");
      }
    },
    retry_save(intent?: "replace"): Controller_update {
      if (canonical === null) return update("no_game");
      if (intent === "replace")
        return update(write(true) ? "saved" : "unavailable");
      if (authority !== "owned") {
        try {
          const result = read_slot();
          if (result.status === "unavailable") return update("unavailable");
          if (!owns_slot()) return update("replacement_required");
        } catch {
          authority = "suspended";
          saved = false;
          return update("integration_fault");
        }
      }
      return update(write() ? "saved" : "unavailable");
    },
  };
}
