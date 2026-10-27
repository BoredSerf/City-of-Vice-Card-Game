# PD-002 — Public command boundary and automatic income

- **Decision date:** 2026-10-27
- **Authority:** Product owner
- **Disposition:** Accepted within the bounded rule below

The product owner was asked exactly:

> S03 is blocked by RD-007’s product ruling. May I record this rule: public commands reject invalid opening choices and repeated income collection without changing state; end_turn performs the next player’s income automatically; internal helper observations are excluded from public-command parity?

The owner answered: “Approve this rule”.

## Approved rule

Public commands reject invalid opening choices and repeated income collection
without changing state. `end_turn` performs the next player's income automatically.
Internal helper observations are excluded from public-command parity.

This resolves RD-007's public-boundary question. Rejections remain typed under the
[accepted engine contract](../MVP_PLAN.md#5-engine-contract); this decision does not
select rejection-code names, event payloads, serialized engine types, or detailed
crew/mandatory-choice semantics.

## Observation and golden evidence

The 92 observations in [scenarios.json](../../tests/characterization/scenarios.json)
retain their original IDs, inputs, outputs, provenance and unapproved labels.
The exact source remains `4ccb19703d4af1a1c202d922b514a58a17d0e537`.
The separate [public-command parity record](../../tests/characterization/public_command_parity.json)
links approved golden expectations to these same stable IDs:

| Observation ID | Steps excluded from public-command parity | Approved boundary expectation |
| --- | --- | --- |
| `S01-SETUP-002` | 1: `newState`'s fallback for invalid opening ID 24 | Reject the invalid opening choice; do not create or alter state. |
| `S01-INCOME-004` | 1–2: repeated `startTurn` calls during `play` | Reject both attempted income collections with state unchanged. |
| `S01-DRAW-002` | 1: `startTurn` during `play` resets the draw price and adds income | Reject; preserve the bank, draw price and all other serialized state. |
| `S01-CREW-NIGHT-001` | 2 only: `startTurn` after activation during the same `play` phase | Reject with state unchanged. Step 1's activation/crew observations remain under RD-002. |
| `S01-TURN-001` | 1: `runAI` combines rival income/actions and the following human income | A public `end_turn` hands off to the next player and collects that player's income once. |
| `S01-TURN-002` | 1–3: `beginAI`, its queued handoff and the resulting collect-income notice | Public handoff includes income; a second `collect_income` is rejected unchanged. |

The exclusion concerns the listed helper/controller entry and handoff observations.
It does not approve or exclude every underlying draw, AI, crew or payment rule.
The two turn golden cases cover both player directions on crew-free fixtures;
they do not request a whole rival policy turn as part of `end_turn`.

Golden cases are specifications, **not executions against the prototype or a new
engine**. Their fixture references and literal expectations are reviewable now;
S03–S06 must consume the applicable stable IDs when implementing public commands.
The metadata validator checks their bounded approval, fixture links and helper
exclusions. Passing that check supplies no implementation verdict.

## Remaining gates

RD-001 and RD-007 are resolved; RD-002 through RD-006 and RD-008 through RD-012
remain unresolved with their existing mappings. PD-001's initial reference and
high-level crew direction remain scoped as originally recorded. This approval
does not approve all observed outcomes, resolve another rule decision, move the
baseline, select `final_parity_ref`, start S03, change scope or priorities, or
establish S01/S02 acceptance and integration.

The roadmap coordinator retains scheduling and tracker ownership. S02's required
check enforcement and controlled failure/block/correction/pass proof remain
outstanding prerequisites. Human acceptance and merge remain required for every
layer of the stack.
