import { business_count } from "./catalog.ts";
export function business_warning(
  before: readonly number[][],
  after: readonly number[][],
): string | null {
  const counts = after.map(business_count);
  if (
    !counts.some(
      (count, actor) => count === 11 && business_count(before[actor]!) !== 11,
    )
  )
    return null;
  return counts.every((count) => count === 11)
    ? "Both empires are one business from victory"
    : counts[0] === 11
      ? "You are one business from victory"
      : "The rival is one business from victory";
}
