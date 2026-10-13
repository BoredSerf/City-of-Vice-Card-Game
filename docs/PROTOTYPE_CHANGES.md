# Prototype change ledger

Authority and required fields are defined in
[`CONTRIBUTING.md`](../CONTRIBUTING.md#baselines-and-prototype-changes).
Priority and disposition are separate; a merge or a passing test is not product
acceptance.

## Reference status

- Characterization candidate: `4ccb19703d4af1a1c202d922b514a58a17d0e537`
- Approved `prototype_baseline`: not established by verified evidence in this checkpoint
- `final_parity_ref`: not selected
- Human acceptance record for this candidate: none recorded

Because this checkpoint has no locked baseline, it cannot assert a complete set
of changes "after the approved baseline." The entry below records a known merged
candidate change whose authority issue must survive characterization. It is not
an assertion that all earlier prototype history has been reconciled. When an
exact baseline is accepted, reconcile every subsequent merged change against that
SHA before S03 readiness and maintain this ledger thereafter. Do not infer an
approved reference from the candidate label or move it with `main`.

## PC-001 — Merged FR-001 crew-specific behavior awaiting disposition

| Field | Record |
| --- | --- |
| Source | [PR #50](https://github.com/BoredSerf/City-of-Vice-Card-Game/pull/50), merged at [`4ccb19703d4af1a1c202d922b514a58a17d0e537`](https://github.com/BoredSerf/City-of-Vice-Card-Game/commit/4ccb19703d4af1a1c202d922b514a58a17d0e537) |
| Classification | `rules`, `ui`, `copy` |
| Disposition | `triage` |
| Priority | `unset` |
| Human decision record | None verified for acceptance of these semantics; [FR-001](feature-requests/FR-001-crew-specific-bonuses.md) retains unresolved product authority and scheduling. |
| Affected scenarios | All scenarios linked to RD-002 in the [decision register](../tests/characterization/rule_decisions.json), including each `S01-CREW-*` family, `S01-RUFFIAN-002`, `S01-FIXER-004`, relevant AI/mandatory-choice/save cases and `S01-WIN-001`. The JSON lists the exact IDs. |
| Affected slices | S04, S05, S06, S07, S08, S09, S10, S11; S03 also remains behind the separate initial-baseline gate. |
| Destination | FR-001 backlog intake until an authorized disposition and applicable MVP amendment/slice or delta are recorded. S01 captures observations only. |
| Verification evidence | [S01 candidate](S01_BASELINE.md), pinned source hashes, complete card inventory and executable corpus. Observed behaviors include all eight bonuses and their limit/timing conflicts. This is not verification of approved intended semantics. |

Related unresolved observations RD-003 through RD-012 are defined in the decision
register, with precise command and downstream-slice mappings. They do not create
accepted corrections by being listed here. No game implementation change is made
by this ledger.

## Adding an entry after baseline acceptance

Use a new stable `PC-###` ID and record source commit or PR; `rules`/`ui`/`copy`
classifications; exact scenario and slice impact; disposition; priority; the human
decision record; implementation slice or backlog destination; and verification
evidence. Apply the active/completed-slice rules in `CONTRIBUTING.md`. This ledger
records decisions and traceability; it is not a recipe for cherry-picking a parity
state.
