# S01 observational checkpoint: independent review

Review date: 2026-10-13 UTC.

## Disposition

**Accepted for limited observational checkpoint publication.** The three P2
findings from the initial review are corrected and independently reverified.
The exact reviewed implementation is identified below. Keep its PR **Draft**:
this acceptance establishes the quality of the recorded observations, not
product-rule approval, an approved prototype baseline, S01 completion, or
readiness of a replacement-engine slice.

All twelve product decisions remain unresolved. `prototype_baseline` and the
human decision record remain null, FR-001 remains pending authorized disposition,
and no approved golden scenarios exist. The former shared crew-resource bonus
cannot execute against this candidate. Passing observations of defects do not
approve them as intended rules.

## Exact reviewed source and files

- Repository: [BoredSerf/City-of-Vice-Card-Game](https://github.com/BoredSerf/City-of-Vice-Card-Game).
- Candidate source commit: `4ccb19703d4af1a1c202d922b514a58a17d0e537`.
- Candidate source tree: `2ec9c3176abea9efcce93491a9ea0265dbb6db17`.
- Eight-file implementation `git diff --binary` SHA-256, before adding this
  review receipt:
  `e5c54b8f847c53577618a67c3d5838a8dbed12e4b899db070f7272d70a60cf5a`.
- Initial reviewed diff SHA-256, retained for finding provenance:
  `8deb01ca64b2b86b8240ff4944bf4452077735dc4b01b8006af8d53fc48b5a2d`.

| Reviewed implementation file | SHA-256 |
| --- | --- |
| `docs/PROTOTYPE_CHANGES.md` | `ec66d5c12548ab411b21559d141a1c1bb5b36eea450c63c6503217507073ddc9` |
| `docs/S01_BASELINE.md` | `e9b2af383f8aaf0cca39451f82fe292141f9601cf92e9a3d48e862b3b1783096` |
| `tests/characterization.test.cjs` | `a3d466c6f7520a3a80b7164e4620bde7b5d1f87bcc8033b4ecbd3f3e38386531` |
| `tests/characterization/cards.json` | `73199a14094549e7c5391a14db0499a6e9c076eaf497cf19af1d7e3041232e95` |
| `tests/characterization/harness.cjs` | `290d882733de4b369aed11f38bf5cfbde2507edc173ee3a2c92670347f9e1b93` |
| `tests/characterization/manifest.json` | `94b82aea12a5645a8d2199cf79c74790bad197adbe40889f54d8c67c9f85cde3` |
| `tests/characterization/rule_decisions.json` | `2a1cad9c51953efd56b5f6c3da4d2b075a9cb53fb656a0979fc6ce511c3b1b1a` |
| `tests/characterization/scenarios.json` | `9416320e74a7cfef0b078be240bfa3987cf6842c1a3daf4b6c12b7fe75323b2e` |

The clean source materialization and implementation branch both resolve to the
candidate commit/tree above. This is an exact shallow checkpoint, not a claim of
full local history. The unchanged source hashes are:

- `index.html`: `f01755c9c82c3f871fafc7f8b5b1b078ad05ddb6421a15425a0e824ebc6fac15`
- `tests/prototype-rules.test.cjs`: `1f635a4a2852ca08fefecaaa8b98460eaf49e5144735a734fbce0334d6d19469`

## Initial findings and their dispositions

### P2-1: competing-target evidence depended on input order — corrected

Initially, `S01-AI-TARGET-001` placed the preferred complete-crew target first.
Replacing only `return value(b)-value(a);` at source line 628 with `return 0;`
in memory left all 91 initial scenarios passing. That did not establish the
claimed ranking preference.

The corrected fixture (`scenarios.json:12029`) starts the affordable lone target
first, with active order `[6,0,1,2,24]`, while its literal outcome selects target
0. The pinned source passes. Independently repeating the same comparator mutation
across all 92 scenarios now fails exactly `S01-AI-TARGET-001`, step 1.
`characterization.test.cjs:120` preserves this focused mutation check.

### P2-2: helper/browser handoff conflict lacked a gate — corrected

The initial `S01-TURN-001` recorded exported `runAI` returning to human phase
`play` with income already collected. An independent execution of the unchanged
browser `beginAI` function on the same initial state instead returned turn 2,
player 0, phase `ready`, with no human income. RD-007 did not record that conflict.

`S01-TURN-001` and the new `S01-TURN-002` (`scenarios.json:12770,12955`) now retain
both literal outcomes. The latter executes the original controller on the game
screen with two queued callbacks and asserts the ready-state notice. Their
initial states were independently checked equal. Replacing only the browser
handoff with automatic human income fails `S01-TURN-002`, step 2.

RD-007 now links both paths and the direct-income observations `S01-DRAW-002` and
`S01-CREW-NIGHT-001`. Their titles explicitly identify calls during `play`.
The unresolved choice maps to `start_game`, `collect_income`, and `end_turn`,
blocking S03, S04, S07, S08, and S09 as applicable. No intended handoff semantics
were selected by remediation.

The probe (`harness.cjs:101`) permits no timers by default. This one scenario uses
a maximum of two scheduled callbacks, synchronous registration order, and a
required empty queue at completion. Independent checks reject budgets 0, 1 and 3,
and an undrained queue. These are bounded source-control-flow observations;
elapsed delays and real browser event-loop behavior are not verified.

### P2-3: readiness metadata validation failed open — corrected

Initially, validation accepted RD-003 as resolved without human evidence, unknown
slice `S99`, unknown command `typo_command`, and missing reciprocal scenario
links. Removing RD-003 and its links also left the complete initial corpus passing
despite `manifest.gates` still naming it.

`validate_decisions` (`harness.cjs:233`) now requires the exact twelve unique
candidate gates, manifest/register agreement, both directions of scenario links,
known command-family and slice identifiers, unresolved status, null human records,
unapproved scenarios, a null baseline and no approved golden scenarios.
Declared future command families remain separate from executable legacy aliases.

Independent repeats of all original adverse cases now reject with specific
validation failures. Removing RD-003 from both the manifest and register also
rejects, and duplicate manifest gates reject. Focused negative tests are retained
at `characterization.test.cjs:143-190`. Later product acceptance requires a
deliberately reviewed metadata change; an approval string cannot silently promote
this observation candidate.

## Current verification

Fresh independent checks used Node `v24.19.0` with only existing built-ins:

- Full suite: **30/30 passed**, comprising 16 unchanged original tests and
  14 characterization tests.
- Clean candidate's original suite: **16/16 passed**.
- Corpus against the clean exact source: **36 cards, 92 scenarios**, null approved
  baseline, exact candidate commit; SHA-256 and Git-blob checks passed.
- `git diff --check`: passed.
- The detached candidate source stayed clean after verification.

Commands are documented in [S01_BASELINE.md](S01_BASELINE.md). Both suites used
`timeout 30s node --max-old-space-size=128 --test --test-concurrency=1 tests/*.test.cjs`.
The corpus used the same bounded Node settings with `tests/characterization/harness.cjs`
and `S01_PROTOTYPE_ROOT` pointing to the clean source materialization.

The inventory accounts for every physical card exactly once. The corpus covers
the named MVP characterization areas with explicit partitions, ordered decks and
fixed randomness, literal deltas/results/visible outputs, rejection no-mutation
checks and declared invariant violations. The corrected targeting fixture joins
substantive funding and stopping observations. It is not exhaustive AI validation
or proof of the future redacted player boundary.

The earlier save mismatch, ordinary-draw and Fixer overflow, Burbs sequencing,
automatic Pipeline interception, redundant Ruffian charge, and Hill Country
funding findings remain unresolved product observations. The Docks panel is
present; its recorded issue is dismissal and inconsistent gating. The paid Arts
swap reduces twelve resources to ten before losing Night Shift, so the withdrawn
cap-deadlock allegation remains withdrawn.

No real-browser, layout, animation, accessibility, reload, replacement-engine,
toolchain-build or deployment acceptance is claimed. No game source, original
test, accepted MVP contract, or roadmap register changes in this feature scope.
No excluded private material was found in the reviewed outgoing files.

## Separate roadmap update and PR descriptions

The separately reviewed status-only update changes exactly the S01 Status cell
from `ready` to `in_progress`, without priority, dependency or contract changes.
It is separate in [PR #51](https://github.com/BoredSerf/City-of-Vice-Card-Game/pull/51).
Its accepted diff SHA-256 is
`f6694013d95706bfe0dc6cecff72b0d3a91c90119a5b1658bd60f5fae8ae7bd6`;
the resulting `IMPLEMENTATION.md` SHA-256 is
`f15b3b1806a24d0a0e08892333d8a821a9d0241f6d14b1c7ba38836a8e9236ce`.

The refreshed feature PR description correctly reports 30 tests, 92 scenarios,
the separate status update, Draft status and unresolved product acceptance.
This review does not authorize merge, deployment or a baseline move.
