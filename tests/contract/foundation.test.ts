import { expect, test } from "vitest";
import { probe } from "@city-of-vice/engine";

// The alias resolves only to actual Melange output. No handwritten substitute.
// Catches discarded arguments, OCaml-runtime-shaped results, and missing exports.
test.each([
  ["S02", "OCaml / S02"],
  ["", "OCaml / "],
  ["<strong>probe</strong>", "OCaml / <strong>probe</strong>"],
])("the generated facade carries %j as an ordinary string", (label, expected) => {
  const result: string = probe(label);
  expect(typeof result).toBe("string");
  expect(result).toBe(expected);
});
