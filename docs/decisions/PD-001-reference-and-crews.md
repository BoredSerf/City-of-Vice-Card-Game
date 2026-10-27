# PD-001 — Initial reference and crew direction

- **Decision date:** 2026-10-13
- **Authority:** Product owner
- **Disposition:** Accepted within the two scopes below

The product owner was asked whether to use the current prototype as the reference
while keeping its documented defects open, and retain the eight distinct crew
bonuses instead of reverting to the older shared bonus. The recommendation
explicitly left edge cases, including optional Pipeline interception and resource
overflow, for separate decisions. The owner replied: “Yes, that makes sense.”

## Initial reference

The approved initial `prototype_baseline` is exactly
[`4ccb19703d4af1a1c202d922b514a58a17d0e537`](https://github.com/BoredSerf/City-of-Vice-Card-Game/commit/4ccb19703d4af1a1c202d922b514a58a17d0e537),
tree `2ec9c3176abea9efcce93491a9ea0265dbb6db17`.
This resolves RD-001. The [manifest](../../tests/characterization/manifest.json)
pins its source files and the [S01 record](../S01_BASELINE.md) explains reproduction.

Acceptance establishes the comparison reference while documented defects remain
open. It does not approve every observed outcome as an intended rule, select a
`final_parity_ref`, or approve a correction. All 92 scenarios remain prototype
observations with unchanged expected outcomes and no approved golden scenarios.

## Crew direction

Retain eight distinct crew bonuses in the MVP: The Docks, Club Circuit, Trailer
Park, The Burbs, Pipeline, Night Shift, Arts District, and Hill Country. The older
shared complete-crew resource bonus is not the selected MVP direction.
This accepts the high-level direction of [FR-001](../feature-requests/FR-001-crew-specific-bonuses.md)
and the corresponding [MVP plan amendment](../MVP_PLAN.md#accepted-amendment-2026-10-13).

RD-002 remains unresolved for detailed ability semantics, including timing,
mandatory-choice order, overflow, consent and save compatibility. The request's
ability descriptions and the prototype observations are inputs to those rulings,
not separately approved implementations. RD-003 through RD-012 also remain
unresolved; their scenario, command and slice mappings stay in force.

## Continuation

Priority remains `unset`; this decision supplies neither a priority ruling nor
delegated product authority. The roadmap coordinator owns register and scheduling
changes. In particular, RD-007 still gates S03, alongside its ordinary S01/S02
dependencies. This record alone does not complete S01 or make engine work ready.
Any specific correction needs its own product decision, explicit expectation
update and independent review under `CONTRIBUTING.md`.

Subsequent decision: [PD-002, 2026-10-27](PD-002-public-command-boundary.md)
resolves RD-007 only and adds separate public-command golden specifications.
The no-golden/unresolved statements above describe PD-001's original checkpoint;
PD-001 itself supplies no authority for that later correction.
