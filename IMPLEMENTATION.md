# City of Vice implementation roadmap

This roadmap turns the accepted [MVP plan](docs/MVP_PLAN.md) into numbered,
reviewable development slices. The MVP plan defines product behavior, architecture,
acceptance criteria, non-goals, and stop conditions; this file defines work order.
If the two documents disagree, the MVP plan controls.

The current `index.html` and `README.md` are required source material for parity
work. A coordinator must read them and the MVP plan directly before assigning a
slice. A summary from another agent is not a substitute.

## Roadmap maintenance

The slice register below is the only place where slice status and priority are
recorded. Slice contracts deliberately contain no status lines or progress
checkboxes. Checkpoint commits should not rewrite completed steps into this file;
implementation notes, evidence, owners, and review discussion belong in the work
item or pull request.

To operate the roadmap:

1. Select the lowest-numbered `ready` slice at the highest priority. Parallel work
   is allowed only when dependencies are complete and the assignments do not edit
   the same contracts, interfaces, or files.
2. Assign one coordinator and one implementation owner outside this document. The
   coordinator changes the slice's single Status cell to `in_progress`.
3. Keep the slice within its stated outcome, scope, and acceptance checks. A
   checkpoint commit is not evidence that a slice is complete.
4. Change the Status cell to `review` when the implementation and its verification
   evidence are ready for a reviewer. The reviewer must inspect the current files
   and run or examine the applicable checks, not rely only on a handoff summary.
5. Change the same cell to `done` only after acceptance and integration. Then move
   newly unblocked slices from `planned` to `ready` by editing only their Status
   cells.
6. Use `blocked` when a listed stop condition or unresolved dependency prevents
   safe progress. Record the reason and required decision in the work item, leaving
   this roadmap concise. Return the cell to `ready` or `in_progress` after the
   blocker is resolved.

Allowed statuses are `planned`, `ready`, `in_progress`, `review`, `blocked`, and
`done`.

Priorities express product urgency, not dependency order:

- `P0` — required to release the accepted MVP or fix a release-blocking defect.
- `P1` — the next approved outcome after the MVP; schedule after all ready P0 work.
- `P2` — valuable but not committed to the next release.
- `P3` — parked idea; retain for later triage.
- `unset` — newly captured request awaiting an authorized priority decision.

Only the product owner, or a delegate explicitly given product-priority authority,
may change priority. A coordinator may recommend a priority in the work item but
must not silently broaden the accepted MVP.

## Slice register

| Slice | Outcome | Depends on | Priority | Status |
| --- | --- | --- | --- | --- |
| S01 | Freeze the behavioral baseline and resolve rule discrepancies | — | P0 | ready |
| S02 | Establish reproducible OCaml, TypeScript, browser, and CI foundations | — | P0 | ready |
| S03 | Implement deterministic domain state and game setup | S01, S02 | P0 | planned |
| S04 | Implement turn economy, payments, drawing, and resource limits | S03 | P0 | planned |
| S05 | Implement card effects, operators, invariants, and victory | S04 | P0 | planned |
| S06 | Put the heuristic rival behind the neutral player boundary | S05 | P0 | planned |
| S07 | Publish and verify the Melange-to-TypeScript facade | S02, S06 | P0 | planned |
| S08 | Add the application controller and safe local persistence | S07 | P0 | planned |
| S09 | Deliver the complete playable browser flow | S08 | P0 | planned |
| S10 | Reach user-facing parity with the prototype | S09 | P0 | planned |
| S11 | Verify browser accessibility, responsiveness, and resume flows | S10 | P0 | planned |
| S12 | Produce equivalent static-site and standalone artifacts | S11 | P0 | planned |
| S13 | Complete the integration gate and authorized Cloudflare deployment | S12 | P0 | planned |
| S14 | Harden and document the MVP release | S13 | P0 | planned |
| S15 | Retire the live legacy implementation and close MVP acceptance | S14 | P0 | planned |

## Definition of done for every slice

A slice is `done` only when all of the following are true:

- its stated outcome and acceptance checks are satisfied without adding excluded
  product scope;
- new or changed behavior has proportionate automated coverage, including failure
  behavior and no-mutation checks where applicable;
- applicable formatting, compilation, type, test, and build checks pass from the
  documented developer workflow;
- generated and source artifacts have not become parallel hand-edited
  implementations;
- the change has been reviewed against the current slice contract and the MVP
  acceptance criteria it serves; and
- user-facing or developer documentation affected by the change is current.

A rules disagreement, unsafe state transition, hidden-information leak, broken
cross-language contract, or need to expand approved scope is a stop condition, not
an implementation detail to resolve by assumption.

## Development slices

### S01 — Behavioral baseline and rule decisions

**Outcome:** The prototype's intended rules can be implemented and tested without
guesswork.

**Deliver:** Preserve the current prototype as the parity reference; extract a
machine-readable inventory of all 36 cards; inventory rules, edge cases, and AI
decisions; establish seeded representative fixtures; and record every conflict
between displayed rules, current behavior, and intended behavior for product
decision.

**Accept when:** The inventory accounts for every card exactly once; the rule
inventory covers the characterization cases named in the MVP plan; fixtures can be
reproduced from explicit data; and every discovered conflict is either resolved by
the product owner or clearly blocks only its affected downstream work.

**Verify:** Review the inventory against `index.html`, exercise the reference flows,
and reproduce the fixtures. This slice establishes evidence for MVP-002 and
MVP-003; it does not change game behavior.

### S02 — Reproducible project foundation

**Outcome:** A clean checkout has one documented way to install locked development
dependencies, run both toolchains, test, and build.

**Deliver:** Add the approved OCaml, Dune, Melange, TypeScript, Vite, Vitest, and
real-browser foundations; establish the required domain and adapter boundaries;
add formatting, type-check, test, and build entry points; and start the verification
workflow. Keep the shipped website backend-free and free of runtime package
downloads.

**Accept when:** Dependency versions are locked; empty or minimal OCaml and browser
targets compile; a generated Melange ES module is consumable by TypeScript; the
thin application shell builds; and the initial checks run locally and in CI.

**Verify:** Follow the documented bootstrap from a clean checkout and run every
initial check. This is the foundation for MVP-001, MVP-006A, MVP-009, and MVP-012.

### S03 — Deterministic state and game setup

**Outcome:** The pure OCaml engine can create a valid, reproducible opening state.

**Deliver:** Implement cards, versioned serializable state, injected randomness,
opening-distributor choice, initial deal, player zones, phases, legal-command
discovery, typed events and rejections, and the `start_game` transition. Keep the
domain library free of browser, storage, timer, network, and Melange APIs.

**Accept when:** The same seed and opening command reproduce identical state and
events; all 36 cards occupy exactly one valid location; invalid setup commands
leave serialized state unchanged; and opening constraints match the approved
baseline.

**Verify:** Native OCaml unit, scenario, serialization, and invariant tests cover
successful and rejected setup paths. Serves MVP-001 through MVP-005.

### S04 — Turn economy and resource rules

**Outcome:** A legal non-operator turn can be played entirely through engine
commands.

**Deliver:** Implement income, crew bonuses, mandatory trimming, fixed and wildcard
payments, escalating draw prices, drawing, discarding and reshuffling, resource
trading, cashing applicable cards, phase changes, and `end_turn`.

**Accept when:** Each public command has typed success and rejection behavior;
resource and hand limits are enforced; reshuffling and payments are deterministic;
mandatory decisions prevent illegal progression; and rejection never mutates
state.

**Verify:** Characterization and engine tests assert resulting state and emitted
events, plus invariant checks after every step in seeded scenarios. Serves MVP-002
through MVP-005.

### S05 — Card effects, operators, and victory

**Outcome:** The engine implements the complete approved base game.

**Deliver:** Implement activation and cashing for every remaining card category;
distributor capacity; legitimate-business protection and limits; operator payment,
disposal, and limits; Hitman, Ruffian, and Fixer outcomes including full-hand
overflow; and both victory conditions.

**Accept when:** Every card category and known edge case has an intentional
assertion; twelve-business and elimination victories emit the correct outcome;
all limits and protected targets are enforced; and deterministic full-game
simulations preserve invariants after every command.

**Verify:** Native unit and scenario tests plus many seeded full-game simulations.
Serves MVP-001 through MVP-005.

### S06 — Neutral player policy and heuristic rival

**Outcome:** Human and automated players use the same legal engine-command path.

**Deliver:** Define the immutable, redacted player view and `Player_policy`
boundary; supply legal commands to policies; port the existing heuristic rival to
OCaml; and validate every proposed action through the engine.

**Accept when:** Representative funding, targeting, and stopping decisions match
the approved baseline; seeded decisions are reproducible; the rival cannot observe
the opponent's hidden hand or deck order; and malformed or stale proposals cannot
bypass engine validation.

**Verify:** Policy tests compare redacted views, legal actions, chosen commands, and
resulting events for representative fixtures. Satisfies MVP-006 and contributes to
MVP-001 through MVP-003.

### S07 — Stable JavaScript facade

**Outcome:** TypeScript consumes a deliberately JavaScript-shaped engine contract,
not Melange runtime internals.

**Deliver:** Add the thin Melange adapter and maintained TypeScript declaration for
commands, player views, legal actions, events, rejections, serialization, and the
heuristic policy. Export only primitives, arrays, plain records, or documented
serialized JSON.

**Accept when:** Development and production module builds satisfy the same contract;
malformed external data is rejected safely; hidden state is absent from player
views; and TypeScript contains no dependency on undocumented OCaml runtime
representations.

**Verify:** TypeScript contract tests exercise each exported operation against the
generated development and production modules. Satisfies MVP-006A and reinforces
MVP-005 and MVP-006.

### S08 — Controller and local persistence

**Outcome:** The browser application can drive a game and safely resume it without
owning rules.

**Deliver:** Implement the TypeScript controller, engine adapter, versioned
serialization flow, and a `localStorage` adapter. Keep UI-only animation, dialog,
and timing state outside domain state.

**Accept when:** Human input and the rival pass through the same engine facade;
valid saves survive reload; malformed, impossible, or unsupported saves are not
partially applied or overwritten; and the user can explicitly replace a rejected
save with a new game.

**Verify:** Integration tests cover command/event flow, AI turns, save and resume,
invalid saves, version rejection, and explicit replacement. Satisfies MVP-008 and
supports MVP-006 and MVP-007.

### S09 — Complete playable browser flow

**Outcome:** One human can start, play, and finish a base game against the heuristic
rival in the modular client.

**Deliver:** Implement the menu, opening-distributor selection, semantic game board,
hands and player areas, legal primary actions, mandatory decisions, turn flow,
action log, AI recap with acknowledgement, and victory or defeat transition.

**Accept when:** Every base-game command is reachable only when legal; engine events
drive rendered results and announcements; the critical path in the MVP plan can be
completed from a controlled fixture; and no production flow calls the legacy game
script.

**Verify:** Integration tests and a real-browser critical-path test from menu to
outcome. Establishes the playable core of MVP-007.

### S10 — Prototype feature parity

**Outcome:** The modular client contains every approved user-facing state and aid
from the reference prototype.

**Deliver:** Extract and integrate artwork; complete dialogs, card gallery, rules,
warnings, operator results, recaps, animations, and illustrated end screens; and
preserve the approved gameplay copy and interaction semantics without requiring
pixel identity.

**Accept when:** The named reference flows and screen states have no missing
gameplay information or action; artwork is source-managed rather than duplicated
as hand-edited generated output; and a product parity review accepts documented
intentional differences.

**Verify:** Compare named flows and reference screenshots at representative states,
then run the full browser path. Completes MVP-007 and prepares MVP-014.

### S11 — Browser quality and persistence verification

**Outcome:** Critical gameplay is robust across supported input modes and viewport
classes.

**Deliver:** Add focused browser coverage for keyboard operation, visible focus,
semantic announcements, reduced motion, representative phone/tablet/desktop
layouts, reload/resume, invalid-save recovery, and controlled victory/defeat.

**Accept when:** Every primary action is keyboard operable; focus remains visible
and moves sensibly through dialogs and state changes; reduced-motion preference is
honored; critical controls and information remain usable at each target width; and
resume behavior passes in a real browser.

**Verify:** Run the browser matrix and document any explicitly accepted browser or
accessibility limitations. Satisfies MVP-008 and MVP-011.

### S12 — Static and standalone distribution artifacts

**Outcome:** The same source revision produces the normal website and the
self-contained HTML export.

**Deliver:** Make `dist/` the production static website; add one project-owned
post-build command that produces `dist-standalone/index.html`; inline required
JavaScript, CSS, and images; and serve each artifact through a static server for
verification. Generated output is never edited by hand.

**Accept when:** A clean checkout produces both artifacts; neither needs a backend,
account, API key, or runtime download; and the shared critical-path smoke test
passes against each. If safe single-file generation conflicts with architecture,
accessibility, security, performance, or platform work, stop for the product
decision required by the MVP plan.

**Verify:** Production builds plus the same real-browser smoke suite against both
served outputs. Satisfies MVP-009 and MVP-010.

### S13 — Integration gate and Cloudflare deployment

**Outcome:** Only a fully verified artifact from an approved production revision is
deployed to Cloudflare Pages.

**Deliver:** Complete CI coverage for formatting, OCaml compilation and tests,
Melange generation, TypeScript checking and contracts, browser smoke tests, and
both builds. Add the owner-authorized workflow that uploads the already-built
`dist/` artifact and performs a post-deployment smoke check.

**Accept when:** Every required check blocks integration on failure; deployment
does not rebuild on Cloudflare; the deployed artifact is the verified CI artifact;
credentials remain in repository secrets with least privilege; and an authorized
production deployment passes against its resulting URL.

**Verify:** Exercise a failing gate, a successful clean run, artifact identity, and
the production smoke check. Production setup stops until the authorized repository,
Pages project, and secret-management path are confirmed. Satisfies MVP-009A and
MVP-012.

### S14 — MVP release hardening and documentation

**Outcome:** The accepted browser MVP is supportable and ready for release review.

**Deliver:** Run focused AI and balance-regression playtests; resolve release-
blocking accessibility and browser findings; define release versioning; add a
changelog; and update the README with bootstrap, development, tests, architecture,
website and standalone outputs, deployment, known limitations, and license status.

**Accept when:** No unresolved release-blocking regression remains; documented
commands work from a clean checkout; known limitations are accurate; and the owner
has made an explicit license decision before any invitation for outside
contributions or open-source distribution.

**Verify:** Execute the documented workflow, record playtest coverage and findings,
and conduct release-documentation review. Satisfies MVP-013 and the Milestone 4
exit condition.

### S15 — Legacy retirement and MVP closure

**Outcome:** The modular application is the sole live implementation, with the
accepted prototype preserved in Git history.

**Deliver:** After parity acceptance, remove the monolithic implementation as live
source without maintaining a second rules or UI path; run the complete acceptance
suite from a clean checkout; and record the release revision and any retained
limitations in the release work item.

**Accept when:** No production or test path depends on the legacy script; all
MVP-001 through MVP-014 criteria have an automated check or reproducible human
verification and pass; both distribution artifacts are reproducible; and the
approved website revision is reachable at the production URL.

**Verify:** Run the full CI and distribution verification, confirm the production
smoke result, and obtain final product acceptance of the exact reviewed revision.
Satisfies MVP-014 and closes the MVP.

## Acceptance-criterion ownership

This table identifies the slices that own final proof. Earlier slices may add
supporting coverage without changing this mapping.

| MVP criterion | Final proof owner |
| --- | --- |
| MVP-001 — Pure OCaml engine | S06 |
| MVP-002 — Rule parity | S05 |
| MVP-003 — Determinism | S06 |
| MVP-004 — State integrity | S05 |
| MVP-005 — Rejection safety | S05 |
| MVP-006 — Neutral players | S06 |
| MVP-006A — Typed Melange boundary | S07 |
| MVP-007 — Web parity | S10 |
| MVP-008 — Resume | S11 |
| MVP-009 — Static website | S12 |
| MVP-009A — Cloudflare deployment | S13 |
| MVP-010 — Standalone export | S12 |
| MVP-011 — Responsive access | S11 |
| MVP-012 — CI gate | S13 |
| MVP-013 — Documentation | S14 |
| MVP-014 — Legacy retirement | S15 |

## Feature requests and backlog

Do not add a feature request directly to an active slice. Capture it in the backlog
register first, with the next sequential `FR-###` identifier and a link to its
source or decision record. New entries start with Priority `unset` and Disposition
`triage`.

At triage, the product owner or authorized delegate chooses a priority and one of
these dispositions: `accepted`, `deferred`, `rejected`, or `superseded`. Record the
reason in the linked work item rather than expanding this table.

- If an accepted request is required by the current MVP plan, add the next `S##`
  row to the slice register, give it a stable slice contract, map its acceptance
  criteria, and set dependencies before marking it `ready`.
- If it changes approved rules, scope, architecture, non-goals, or acceptance
  semantics, update and re-accept the controlling product plan before scheduling
  implementation.
- If it belongs to a post-MVP track such as Steam, mobile, or ChatGPT/MCP, leave it
  in the backlog until that track and its external prerequisites receive explicit
  authorization. The delivery tracks in the MVP plan remain the authoritative
  source; do not duplicate their full specifications here.
- Defects that prevent an existing acceptance criterion from passing are not new
  features. Link them to the owning slice and assign P0 only when they block the
  accepted MVP release.

| Request | Summary | Source | Priority | Disposition |
| --- | --- | --- | --- | --- |
