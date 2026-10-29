import type { Win_reason } from "@city-of-vice/engine";
import type { Storage_port } from "./persistence.ts";
import {
  card_ids,
  card_info,
  crew_names,
  color_name,
  resource_colors,
} from "../presentation/catalog.ts";
import { resource_aliases } from "../presentation/reference_text.ts";

export const achievement_key = "city-of-vice-modular-achievements-v1";
export const achievement_definitions = [
  {
    id: "brutal",
    name: "Brutal Victory",
    description: "Win by eliminating every rival distributor.",
  },
  {
    id: "streak-10",
    name: "Untouchable",
    description: "Win 10 games in a row.",
  },
  ...crew_names.map((crew) => ({
    id: "crew-" + crew,
    name: crew + " Crew",
    description: `Win with all three members of ${crew} active.`,
  })),
  ...resource_colors.map((color) => ({
    id: "monopoly-" + color_name(color),
    name: color_name(color) + " Monopoly",
    description: `Win with every ${resource_aliases[color]} business active, including its legit business.`,
  })),
];
export type Achievement_record = {
  schema_version: 1;
  earned_ids: string[];
  win_streak: number;
};
export type Completion = {
  winner: 0 | 1;
  reason: Win_reason;
  human_active_ids: number[];
};
type Failure =
  "acquire" | "read" | "invalid" | "write" | "changed" | "overflow" | null;
export type Achievement_snapshot = {
  record: Achievement_record | null;
  saved: boolean;
  pending: boolean;
  failure: Failure;
  newly_earned: string[];
};
const empty = (): Achievement_record => ({
  schema_version: 1,
  earned_ids: [],
  win_streak: 0,
});
export function admit_achievements(raw: string | null): Achievement_record {
  if (raw === null) return empty();
  const value = JSON.parse(raw) as Achievement_record;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "earned_ids,schema_version,win_streak" ||
    value.schema_version !== 1 ||
    !Array.isArray(value.earned_ids) ||
    !Number.isSafeInteger(value.win_streak) ||
    value.win_streak < 0 ||
    value.earned_ids.some(
      (id) =>
        typeof id !== "string" ||
        !achievement_definitions.some((award) => award.id === id),
    ) ||
    new Set(value.earned_ids).size !== value.earned_ids.length
  )
    throw Error("Invalid achievement record");
  return structuredClone(value);
}
/** Reference predicates on the actual public final human board; no game adjudication. */
export function apply_completion(
  record: Achievement_record,
  completion: Completion,
): Achievement_record {
  if (completion.winner === 1)
    return { ...record, earned_ids: [...record.earned_ids], win_streak: 0 };
  if (record.win_streak === Number.MAX_SAFE_INTEGER)
    throw Error("Achievement streak overflow");
  const win_streak = record.win_streak + 1,
    earned_ids = new Set(record.earned_ids),
    active = new Set(completion.human_active_ids);
  if (completion.reason === "elimination") earned_ids.add("brutal");
  if (win_streak >= 10) earned_ids.add("streak-10");
  for (const crew of crew_names)
    if (
      card_ids
        .filter(
          (id) =>
            card_info(id).type === "illegal" && card_info(id).crew === crew,
        )
        .every((id) => active.has(id))
    )
      earned_ids.add("crew-" + crew);
  for (const color of resource_colors)
    if (
      card_ids
        .filter(
          (id) =>
            card_info(id).type !== "operator" &&
            card_info(id).color === color_name(color),
        )
        .every((id) => active.has(id))
    )
      earned_ids.add("monopoly-" + color_name(color));
  return { schema_version: 1, earned_ids: [...earned_ids], win_streak };
}

/** Isolated feature-specific pending record. No game calls, legacy import or durable receipt. */
export function create_achievements(
  acquire: () => Storage_port = () => window.localStorage,
) {
  let known = false,
    attempted = false,
    baseline: string | null = null,
    record: Achievement_record | null = null;
  let dirty = false,
    authorized = false,
    failure: Failure = null,
    newly_earned: string[] = [];
  const pending: Completion[] = [];
  const snapshot = (): Achievement_snapshot =>
    structuredClone({
      record,
      saved:
        record !== null && !dirty && pending.length === 0 && failure === null,
      pending: dirty || pending.length > 0,
      failure,
      newly_earned,
    });
  function read(): boolean {
    attempted = true;
    let storage: Storage_port;
    try {
      storage = acquire();
    } catch {
      failure = "acquire";
      authorized = false;
      return false;
    }
    let raw: string | null;
    try {
      raw = storage.getItem(achievement_key);
    } catch {
      failure = "read";
      authorized = false;
      return false;
    }
    if (known && raw !== null && raw !== baseline) {
      failure = "changed";
      authorized = false;
      return false;
    }
    let admitted: Achievement_record;
    try {
      admitted = admit_achievements(raw);
    } catch {
      if (!known) {
        known = true;
        baseline = raw;
      }
      failure = "invalid";
      authorized = false;
      return false;
    }
    known = true;
    baseline = raw;
    if (record === null) record = admitted;
    else if (
      raw === null &&
      JSON.stringify(record) !== JSON.stringify(admitted)
    )
      dirty = true;
    authorized = true;
    failure = null;
    return true;
  }
  function apply_pending(): boolean {
    if (record === null || pending.length === 0) return record !== null;
    let candidate = structuredClone(record);
    try {
      for (const completion of pending)
        candidate = apply_completion(candidate, completion);
    } catch {
      failure = "overflow";
      authorized = false;
      return false;
    }
    newly_earned = candidate.earned_ids.filter(
      (id) => !record!.earned_ids.includes(id),
    );
    record = candidate;
    pending.length = 0;
    dirty = true;
    return true;
  }
  function write() {
    if (!authorized || !dirty || record === null) return;
    let storage: Storage_port;
    try {
      storage = acquire();
    } catch {
      failure = "acquire";
      authorized = false;
      return;
    }
    const raw = JSON.stringify(record);
    try {
      storage.setItem(achievement_key, raw);
      baseline = raw;
      dirty = false;
      failure = null;
    } catch {
      failure = "write";
    }
  }
  return {
    snapshot,
    inspect(): Achievement_snapshot {
      read();
      return snapshot();
    },
    record_completion(completion: Completion): Achievement_snapshot {
      pending.push(structuredClone(completion));
      newly_earned = [];
      if (!known) {
        if (!attempted) read();
        if (!known) return snapshot();
      }
      if (apply_pending()) write();
      return snapshot();
    },
    retry(): Achievement_snapshot {
      if (!dirty && pending.length === 0 && record !== null && failure === null)
        return snapshot();
      if (read() && apply_pending()) write();
      return snapshot();
    },
  };
}
