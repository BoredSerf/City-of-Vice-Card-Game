# Prototype change ledger

Authority and required fields are defined in
[`CONTRIBUTING.md`](../CONTRIBUTING.md#baselines-and-prototype-changes).
Priority and disposition are separate; a merge or a passing test is not product
acceptance.

## Reference status

- Approved initial `prototype_baseline`: `4ccb19703d4af1a1c202d922b514a58a17d0e537`
- `final_parity_ref`: not selected
- Human acceptance record: [PD-001, 2026-10-13](decisions/PD-001-reference-and-crews.md#initial-reference)

PD-001 accepts the source reference with documented defects still open. PC-001
records the crew direction already present in that reference; it is not a later
correction to the source. PD-002 later resolves RD-007 with separate golden
specifications and precise helper exclusions, as linked in the
[S01 record](S01_BASELINE.md). It changes no prototype source, original test,
observed scenario expectation or source reference; its public-command correction
still requires implementation in the applicable slices. Reconcile every subsequent
merged prototype change against this SHA before S03 readiness and maintain this ledger thereafter. Do
not move the baseline with `main` or infer rule approval from an observation pass.

## PC-001 — Eight-crew direction accepted; detailed semantics unresolved

| Field | Record |
| --- | --- |
| Source | [PR #50](https://github.com/BoredSerf/City-of-Vice-Card-Game/pull/50), merged at [`4ccb19703d4af1a1c202d922b514a58a17d0e537`](https://github.com/BoredSerf/City-of-Vice-Card-Game/commit/4ccb19703d4af1a1c202d922b514a58a17d0e537) |
| Classification | `rules`, `ui`, `copy` |
| Disposition | `accepted` for retaining eight distinct crew bonuses in the MVP; detailed semantics remain gated by RD-002 and related decisions. |
| Priority | `unset` |
| Human decision record | [PD-001](decisions/PD-001-reference-and-crews.md#crew-direction), product owner, 2026-10-13; [accepted MVP amendment](MVP_PLAN.md#accepted-amendment-2026-10-13). Approval is limited to the high-level direction. |
| Affected scenarios | All scenarios linked to RD-002 in the [decision register](../tests/characterization/rule_decisions.json), including each `S01-CREW-*` family, `S01-RUFFIAN-002`, `S01-FIXER-004`, relevant AI/mandatory-choice/save cases and `S01-WIN-001`. The JSON lists the exact IDs. |
| Affected slices | S04, S05, S06, S07, S08, S09, S10, S11. At PC-001's decision checkpoint S03 remained behind RD-007; subsequent PD-002 resolves that rule gate only, leaving ordinary dependencies and acceptance/integration obligations. |
| Destination | [FR-001](feature-requests/FR-001-crew-specific-bonuses.md) accepted direction in the amended MVP plan. The coordinator owns scheduling through the applicable slice/delta procedure after detailed rulings; priority remains unset. S01 captures observations only. |
| Verification evidence | [S01 reference](S01_BASELINE.md), pinned source hashes, complete card inventory and executable corpus. Observed behaviors include all eight bonuses and their limit/timing conflicts. This is not verification of approved detailed semantics. |

Related observations RD-003 through RD-012 are defined in the decision
register, with precise command and downstream-slice mappings. They do not create
accepted corrections by being listed here; PD-002 is separate explicit authority
for RD-007 only. No game implementation change is made
by this ledger.

## Adding a subsequent entry

Use a new stable `PC-###` ID and record source commit or PR; `rules`/`ui`/`copy`
classifications; exact scenario and slice impact; disposition; priority; the human
decision record; implementation slice or backlog destination; and verification
evidence. Apply the active/completed-slice rules in `CONTRIBUTING.md`. This ledger
records decisions and traceability; it is not a recipe for cherry-picking a parity
state.
