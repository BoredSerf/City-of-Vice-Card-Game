# S01 observational baseline

This is an implementation checkpoint of the existing S01 contract in
[`IMPLEMENTATION.md`](../IMPLEMENTATION.md#s01--behavioral-baseline-and-rule-decisions).
The product owner has accepted the initial source reference and the high-level
eight-crew MVP direction in [PD-001](decisions/PD-001-reference-and-crews.md).
This checkpoint does not change the game or complete S01. Detailed product rulings
and independent review remain separate gates.

## Exact source and authority

The approved initial reference is commit
[`4ccb19703d4af1a1c202d922b514a58a17d0e537`](https://github.com/BoredSerf/City-of-Vice-Card-Game/commit/4ccb19703d4af1a1c202d922b514a58a17d0e537),
tree `2ec9c3176abea9efcce93491a9ea0265dbb6db17`, the merge of PR #50.
The [manifest](../tests/characterization/manifest.json) records the commit, tree,
SHA-256 and Git blob identities of both the prototype and its existing tests.
The harness refuses a source-file mismatch. A later `main` is not a substitute.

On 2026-10-13 the product owner accepted this exact initial reference with its
documented defects still open. The manifest records its SHA as
`prototype_baseline` and cites PD-001 as the human decision record. RD-001 is
resolved. FR-001 is accepted only as the high-level direction to retain eight
distinct crew bonuses; its priority remains `unset`. RD-002 retains the detailed
timing, consent, overflow and compatibility questions. Merged code and passing
tests supply no additional product approval.

Every scenario remains `prototype_observation` / `unapproved_candidate`; the
retained approval label means the individual outcome has not been promoted to an
approved intended rule. All 92 expected outcomes are unchanged. There are no
approved corrections or approved golden scenarios. The former shared crew bonus
cannot execute against this reference and is no longer the selected MVP direction.
See RD-001 and RD-002 in the
[rule-decision register](../tests/characterization/rule_decisions.json).

S03 remains gated by RD-007 and its ordinary S01/S02 dependencies. Each unresolved
decision lists the commands and downstream slices it blocks. S02's foundation work
is not blocked by these rule decisions; ordinary roadmap dependencies still apply.
The roadmap coordinator alone owns the slice register.

## Artifacts

| Artifact | Purpose |
| --- | --- |
| [`cards.json`](../tests/characterization/cards.json) | All 36 unique cards: 24 distributors in eight crews, six legits, six operators; identity, color, business, crew, activation cost, and ability data. |
| [`scenarios.json`](../tests/characterization/scenarios.json) | 92 stable scenario IDs, complete initial states, explicit randomness, ordered commands, literal expected results/deltas/logs, provenance and decision links. |
| [`rule_decisions.json`](../tests/characterization/rule_decisions.json) | Authoritative S01 decision register: observed conflict, required product decision, exact affected scenario IDs, command families, blocked slices and source references. |
| [`harness.cjs`](../tests/characterization/harness.cjs) | Independent Node runner against the pinned prototype, not the replacement engine. |
| [`characterization.test.cjs`](../tests/characterization.test.cjs) | Validator, exact-transition, mutation-sensitivity and traceability checks, plus the complete corpus run. |
| [`PROTOTYPE_CHANGES.md`](PROTOTYPE_CHANGES.md) | Change-ledger intake and authority status. |
| [`PD-001`](decisions/PD-001-reference-and-crews.md) | Public-safe product-owner decision, exact initial reference and bounded crew direction. |

The existing `index.html`, original tests, scenarios and roadmap register are
unchanged by this approval-record amendment. The MVP plan and FR-001 record now
reflect PD-001's high-level direction. There is no new dependency, build system or
runtime engine implementation.

The source card records leave operator `ability_cost` empty; effective use costs
come from the target (twice its cost for a Fixer), as exercised by the operator
scenarios. The inventory does not interpret that empty array as a free ability.

## Fixture semantics

- `initial_state` is the complete serialized prototype state. A null initial state
  is used only for `start_game`; its expected full state is literal in that step.
- Deck and discard arrays are ordered bottom-to-top. The final deck element is
  drawn first. Each scenario injects a fresh constant random stream `0.999999`;
  this leaves Fisher-Yates order unchanged, including the tested discard reshuffle.
  It is explicit controlled randomness, not a statistical simulation.
- `args` are ordered inputs to a small snake_case adapter over the existing
  exported functions. Legacy field names such as `drawPrice` and `opId` remain
  intact only within recorded prototype data and that adapter.
- `expected_result` is literal. `{ "undefined": true }` distinguishes an actual
  undefined result from null. `start_game` adopts its returned state and reports
  the adapter marker `state_created`.
- `expected.changes` replaces the named serialized paths, `remove` deletes named
  fields, and `logs` lists new visible records in emission order. Every other
  serialized value must remain unchanged. Expected deltas were authored
  independently of the executing prototype; the runner has no update/snapshot
  recording mode.
- A `rejection` step additionally compares the entire before/after serialized
  state. Negative checks cover missing cards, wrong player/phase, invalid colors
  and payments, capacity, operator counts, protected targets and forced choices.
- Every initial and resulting state accounts for each physical card ID 0–35
  exactly once across deck, discard, active cards and hands. Suspended IDs are
  unique metadata pointing into a hand, never extra physical locations. Resources
  must be non-negative integers; turn, draw-price and pending-choice fields are
  validated independently of the prototype.
- The independent limit audit checks hand, resource, operator, legit-possession
  and distributor-capacity bounds. Legit and hand allowances depend on the active
  mandatory phase. Intentional helper-boundary preconditions and observed
  violations must be declared explicitly. A declaration never relaxes physical
  card accounting. For example, `S01-FIXER-004` is expected to expose
  `hand_limit:0`, not silently pass as a valid future-engine transition.
- Controlled mid-game fixtures are not claims of full-game reachability.
  `S01-LIMIT-004`, `S01-CAPACITY-001/002`, and `S01-OPERATOR-LIMIT-001`
  intentionally exercise reconciliation or rejection from named limit violations.
  The malformed payload in `S01-SAVE-004` is separate from its valid live state.

The original tests remain useful historical evidence, but some of their setup
helpers duplicate or omit cards. This new corpus establishes its own complete
partitions; it does not rewrite or silently endorse those older fixtures.

The version-2 metadata validator requires all twelve unique manifest gates to
match the register exactly, checks both directions of every scenario link, and
accepts only known slice IDs and declared command-family labels. These labels
include future public/controller operations; they need not be executable legacy
methods. The sole resolved gate is RD-001, bound to the exact approved source
commit/tree and PD-001 reference. The other eleven gates must remain unresolved
with null resolution records and nonempty downstream mappings. RD-002 alone has a
separate partial decision record for crew direction. Unapproved scenarios and an
empty approved-golden list remain mandatory.

These closed rules reject missing/substituted human-record references, source
movement and broader approval claims. The corpus also requires the referenced
decision document to exist and be nonempty. They check consistency with the
recorded decision; they cannot authenticate product authority from arbitrary text.
Independent review checks the actual human decision and its scope. Later product
decisions require a deliberately reviewed metadata update.

### Execution boundaries

`exported_rules` runs the script's existing CommonJS interface in an isolated Node
VM. `instrumented_prototype` runs the same unchanged source with inert DOM/storage
adapters and a narrowly inserted closure-access hook in place of automatic startup.
This executes the actual loader, trim/click handler, gate, panel and turn-controller
functions. The hook does not replace game-rule bodies. Timers are refused by
default. `S01-TURN-002` permits exactly two queued callbacks for the unchanged
`beginAI` path on the game screen; callbacks run synchronously in registration
order, ignoring elapsed delays. An exhausted callback budget or an undrained queue
fails the probe. This provides bounded control-flow evidence, not browser timing
or event-loop acceptance.

The probe demonstrates source behavior, not real-browser navigation, layout,
animation, accessibility, or reload acceptance. In particular, save cases prove
the loader/menu mismatch and unchanged live state on rejection; they do not claim
to have exercised an actual browser reload or observed persisted-data loss.
Real-browser acceptance remains with S09–S11.

## Coverage map

The manifest's required areas are checked for scenario coverage. The JSON gives
the exact inputs and outcomes; these are representative entry points:

| MVP characterization area | Scenario IDs |
| --- | --- |
| Opening constraints and initial deal | `S01-SETUP-001/002` |
| Income and ten-resource trimming | `S01-INCOME-001`–`004`, `S01-TRIM-001/002` |
| Every crew, gaining/losing a crew, simultaneous crews | `S01-CREW-DOCKS-*`, `CLUB-*`, `TRAILER-*`, `BURBS-*`, `PIPELINE-*`, `NIGHT-*`, `ARTS-*`, `HILL-*`, `MULTI-*` (all have the `S01-CREW-` prefix) |
| Fixed/wildcard payments and resource trades | `S01-PAY-001`–`004`, `S01-TRADE-001/002` |
| Escalating draws and discard reshuffle | `S01-DRAW-001`–`007` |
| Activate and cash every card category | `S01-ACTIVATE-001`–`003`, `S01-PAY-001`, `S01-CASH-001`–`005` |
| Distributor capacity and suspended reacquisition | `S01-LIMIT-001/002`, `S01-CAPACITY-001/002`, `S01-FIXER-002` |
| Legit protection and both operator/legit limits | `S01-PROTECTED-001`–`003`, `S01-LIMIT-003/004`, `S01-LEGIT-001`, `S01-OPERATOR-LIMIT-001` |
| All six operators, disposal and full-hand outcomes | `S01-HITMAN-001`, `S01-RUFFIAN-001/002`, `S01-FIXER-001`–`004`, crew interaction cases |
| Expansion and elimination wins | `S01-WIN-001`–`003` |
| Decisive AI funding, competing targets and stopping | `S01-AI-FUND-001`–`004`, `S01-AI-TARGET-001`, `S01-AI-STOP-001`, `S01-AI-DRAW-001`, `S01-AI-DECIDE-001/002` |
| Turn handoff and additional persistence/UI evidence | `S01-TURN-001/002`, `S01-SAVE-001`–`004`, `S01-UI-DOCKS-001` |

The competing-target case puts the affordable lone distributor before the preferred
complete-crew distributor. Removing only the target-ranking comparator in memory
now fails that scenario; the pinned source passes. Funding cases include a
complete affordable plan and an impossible plan that must not sacrifice a donor.
These are policy observations, not proof of a
redacted player boundary or exhaustive policy optimality. S06 owns that boundary.

`S01-TURN-001` observes exported `runAI` returning to `play` with human income
already collected. On the same initial state, `S01-TURN-002` observes browser
`beginAI` returning to `ready` without that income. RD-007 maps both outcomes to
the still-unresolved public-command/controller choice; neither is approved as
intended behavior. It also maps `S01-DRAW-002` and `S01-CREW-NIGHT-001`, whose
direct income-helper calls during `play` are not claims of a browser-legal new turn.

## Reproduction

Node's built-in runner is sufficient; the recorded implementation checks used
Node `v24.19.0`. From the repository root:

```sh
timeout 30s node --max-old-space-size=128 --test --test-concurrency=1 tests/*.test.cjs
timeout 30s node --max-old-space-size=128 tests/characterization/harness.cjs
```

The full suite contains the 16 unchanged original tests plus eighteen characterization
harness tests. The corpus runner reports 36 cards, 92 scenarios, the approved
baseline SHA, and the same exact source commit. There is no `package.json` at
this checkpoint, so no npm lint/build/test result is claimed. S02 must add these
checks to the integration gate when the foundation exists.

To verify against a clean reference materialization while retaining the corpus
in the working branch, use a fresh destination and existing Git objects:

```sh
git worktree add --detach ../city-of-vice-candidate 4ccb19703d4af1a1c202d922b514a58a17d0e537
env S01_PROTOTYPE_ROOT=../city-of-vice-candidate timeout 30s node --max-old-space-size=128 tests/characterization/harness.cjs
git -C ../city-of-vice-candidate rev-parse HEAD
git -C ../city-of-vice-candidate status --short
```

The source-hash check covers the reference `index.html` and original test file.
The new corpus itself belongs to the S01 branch; copying it into the source
worktree is unnecessary. A clean detached materialization at the stated source
commit passed the corpus on 2026-10-13. The tree stayed clean.

## Review evidence and remaining gates

- The initial independent review requested three P2 changes: targeting did not
  discriminate ranking from input order; helper/browser turn handoff was missing
  from the decision gate; and readiness metadata validation failed open. Focused
  remediation reorders the competing targets and proves mutation sensitivity,
  adds the bounded browser-controller observation and reciprocal RD-007 links,
  and validates candidate authority, identifiers, complete gate membership and
  both link directions. Independent acceptance and the disposition of these
  findings are recorded separately in the review receipt for the exact reviewed
  artifact. That remediation did not resolve product decisions; the later PD-001
  approval resolves RD-001 only. The original adverse findings and their
  dispositions remain in [the historical review receipt](S01_REVIEW.md).
- Test-first validator checks were observed failing before implementation, then
  passing. Later malformed-field and missing-decision-gate tests likewise failed
  before their validation was added.
- A mutation-sensitivity test executes the real draw, restores a spent resource,
  and confirms that the runner rejects the changed payment with its stable
  scenario ID. Unlisted state mutations are also rejected.
- Initial static inspection incorrectly suggested the Docks renderer was absent.
  Execution found both choices, and source line 925 confirmed the renderer. The
  corrected literal case proves only dismissibility and inconsistent gating
  (RD-011); the absent-renderer allegation is withdrawn.
- An older concern about losing Night Shift during a paid Arts swap was checked
  against current behavior. `S01-CREW-ARTS-002` proves twelve resources become ten
  before losing the crew and a further legal trade succeeds. It is not an open
  cap-deadlock finding for this source.
- The PD-001 metadata amendment was test-first: four failures exposed the old
  null-baseline policy and missing checks for scoped human evidence, source
  identity and partial crew direction; the revised checks then passed. The
  original negative identifier, gate-membership and reciprocal-link cases remain.
  A further negative test first exposed that RD-007 could lose S03 while retaining
  its other slice links; the scoped validator now rejects that unauthorized lift.
- Eleven rule decisions remain unresolved, including RD-002's detailed crew
  semantics. FR-001 priority is unset, and RD-007 still blocks S03. A green run
  supplies no additional product ruling. Independent acceptance of this changed
  artifact must be recorded in a new review receipt; the historical receipt
  applies only to its identified checkpoint.

Future S03–S06 work must consume these same stable IDs as reference evidence,
with affected rule implementation blocked by the unresolved decision mappings.
Incorporate only explicitly accepted corrections or deltas. Domain adapters must
not import prototype-only UI state into the pure engine. If the accepted source
changes, retain traceability, regenerate and reverify the affected corpus
deliberately, and follow `CONTRIBUTING.md` rather than silently refreshing results.
