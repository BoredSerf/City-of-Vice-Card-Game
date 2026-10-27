# S01 product-approval amendment: independent review

Review date: 2026-10-13 UTC. Independent final-deliverable review, separate from implementation.

## Judgment

**Verified: the reviewed S01 state satisfies S01's acceptance contract.** No blocking finding remains in this amendment. The contract expressly permits unresolved decisions when their affected scenarios, commands and slices are mapped. RD-002 through RD-012 meet that requirement; they are downstream implementation gates, not reasons to keep S01 unfinished indefinitely.

**PR #52 may become Ready for review after this exact reviewed follow-on and its receipt are published.** This receipt does not establish publication, merge, integration, roadmap `done`, or readiness of S03. The coordinator's post-integration status procedure still applies. RD-007 continues to prevent S03 from entering `ready`; its S01/S02 dependencies also remain operative.

## Basis and exact state

- Repository: [BoredSerf/City-of-Vice-Card-Game](https://github.com/BoredSerf/City-of-Vice-Card-Game).
- Feature: `phil/s01-behavioral-baseline-20261013`, [PR #52](https://github.com/BoredSerf/City-of-Vice-Card-Game/pull/52).
- Local HEAD: `a0058a03950e23231507ff5487d528b85f7c7244`, tree `bc6d2c778fddae0082a3beaf62c855aa6fca0c8f`, plus the nine uncommitted files below.
- Complete nine-file `git diff --binary a0058a03950e23231507ff5487d528b85f7c7244` SHA-256: `bdc667f724efbc79c88085500a898fededa5ca862fc40fc30cb655810b360047`.
- Approved initial reference: `4ccb19703d4af1a1c202d922b514a58a17d0e537`, tree `2ec9c3176abea9efcce93491a9ea0265dbb6db17`.

The review read the applicable workspace and project instructions, CONTRIBUTING.md, IMPLEMENTATION.md, MVP_PLAN.md, S01 artifacts, existing tests and historical S01_REVIEW.md. PD-001 was compared with the owner's 2026-10-13 approval: current prototype as reference with defects open, and retention of eight distinct crew bonuses. The explicit pinned verifier instructions were read; this is not a claim of runtime registration.

| Changed file | SHA-256 |
| --- | --- |
| `docs/MVP_PLAN.md` | `3ca2ca23491f2e534b4606236128eda8348dc717c10c3ff7993a6c4ffa80d1a0` |
| `docs/PROTOTYPE_CHANGES.md` | `c856572e0b09c48614d045f619266fe235c0ef432190f2b34dc9bde8bafa8697` |
| `docs/S01_BASELINE.md` | `ed436d5358ff69ca56ea8de649bbc808737809410d26f040d7379600180f89ce` |
| `docs/decisions/PD-001-reference-and-crews.md` | `3fe6c23c1589583eb2040a9edfd123d0fd234593e73b5111e68907089925bfe3` |
| `docs/feature-requests/FR-001-crew-specific-bonuses.md` | `ad192175a1d0e800fab465a3de7fcc66558d5c72265abc6c4e0629ea9294ea70` |
| `tests/characterization.test.cjs` | `ec2eefa75f4f9ef319df6ad31fb661cc3bfc0180342a5130e368a4b4de663749` |
| `tests/characterization/harness.cjs` | `5ee02593ca50e0b2ab0f05e8089343cf8895c10d54e135499a9fe0aae25723aa` |
| `tests/characterization/manifest.json` | `8ead1b4ec9b6bee52acdd86f7e5d200443a4b15be0a720e8e2e8c9280745235a` |
| `tests/characterization/rule_decisions.json` | `d75ac11781c920c0c42dc43215ee13e3cfcf6fb52c6fb1c961127eb12eca738b` |

## Current verification and acceptance coverage

Fresh checks ran with Node v24.19.0, no dependencies, one test worker, 30-second timeout and 128 MiB old-space. Fresh free-space checks exceeded 20 GB. Each command exited 0 unless an intentional negative control is identified.

1. `timeout 30s node --max-old-space-size=128 --test --test-concurrency=1 tests/*.test.cjs` in the feature worktree: **34/34 passed**, no skipped tests. This includes source-ranking/payment mutations, browser/helper handoff distinction, reciprocal decision links, source/approval scope and the RD-007 S03 guard.
2. The same command in the clean detached exact reference: **16/16 passed**. HEAD/tree matched the approved reference and `git status --short` remained empty.
3. `env S01_PROTOTYPE_ROOT=../s01-candidate-check timeout 30s node --max-old-space-size=128 tests/characterization/harness.cjs`: **36 cards, 92 scenarios**, both approved-baseline and source-commit fields equal `4ccb197...`. Inventory equality, unique physical-card coverage, explicit fixtures, required characterization areas, literal results and source SHA-256/Git-blob assertions passed independently of a replacement engine.
4. An in-memory control loaded the published old harness against current metadata: it rejected the new schema, while the current validator accepted it. Removing only the current RD-007/S03 guard in memory made the unauthorized gate removal pass, whereas the unchanged current validator rejected it. This establishes regression sensitivity. It does not claim independent observation of the author's historical RED/GREEN chronology.
5. `git diff --check` passed. Exact diff scope confirms no `index.html`, original prototype tests, card inventory, scenario expectations, roadmap register or game-code changes.
6. GitHub comparison of `4ccb197...` to `main` at approximately 19:06 UTC reported **identical**, zero commits/files. There are no later merged prototype changes to reconcile at this review checkpoint. PC-001 correctly records direction already contained in the reference, not an invented subsequent correction.

PD-001, the plan amendment, ledger, FR-001 and metadata consistently resolve RD-001 only. The source reference is approved; none of the 92 observed outcomes becomes an approved correction or golden scenario. FR-001's direction is accepted, its detailed abilities remain subject to the recorded decisions, and priority remains `unset`.

The remaining decision mappings were inspected directly, not inferred from a green suite:

| Decision | Principal affected command families | Directly gated slices |
| --- | --- | --- |
| RD-002 | Income, crew choice, trimming, drawing, trades, activation, operators, AI | S04–S11 |
| RD-003 | Draw | S04, S07, S09 |
| RD-004 | Operator acquisition/overflow | S05, S06, S07, S09, S10 |
| RD-005 | Income, cash, trim, crew choice | S04, S05, S06, S08, S09, S11 |
| RD-006 | Operator interception | S05, S06, S09 |
| RD-007 | Setup, income, end turn | S03, S04, S07, S08, S09 |
| RD-008 | Load and resume | S08–S11 |
| RD-009 | Operator target selection | S05, S06, S09 |
| RD-010 | Operator outcome copy | S09–S11 |
| RD-011 | Draw, discard choice, end turn | S09–S11 |
| RD-012 | AI step and resource trades | S06 |

The register contains the exact scenario IDs and required decisions. Ordinary roadmap dependency paths carry prerequisite effects to later consumers. S02 is unaffected by these rule decisions. Future scheduling of FR-001 remains subject to the existing backlog/slice procedure; this review does not schedule its implementation.

## Preserved findings and limits

The earlier three adverse findings and their corrections remain intact in `docs/S01_REVIEW.md` (SHA-256 `0d6da215a0481c3cbfbd72ed9e0bd9fdbe47823c732dcb6a92d6defe8c87e49d`). That receipt's old approval/draft statements describe its identified earlier checkpoint. This receipt supplies the later bounded judgment without rewriting history.

Unchanged inventory/scenario hashes remain `73199a14094549e7c5391a14db0499a6e9c076eaf497cf19af1d7e3041232e95` and `9416320e74a7cfef0b078be240bfa3987cf6842c1a3daf4b6c12b7fe75323b2e`. The previously recorded save, overflow, sequencing, consent and AI defects remain open. The withdrawn Docks-renderer and Arts-cap allegations remain withdrawn. No browser, accessibility, replacement-engine, toolchain-build, deployment or full MVP acceptance is claimed. Existing commands suffice before S02; S02 owns their integration into its future required gate. No excluded private material was found in these nine outgoing files.

## Separate roadmap register review

**Accepted as a bounded three-cell status-only change.** In `phil/s01-roadmap-status-20261013` ([PR #51](https://github.com/BoredSerf/City-of-Vice-Card-Game/pull/51)), HEAD is `1899e91609812e2dd861c90f69afbe20d38baa97`, tree `312a0d5a31a8cb9c80ae611f1708e29bfccd3a34`. The coordinator expanded the originally reviewed one-cell scope to these three cells, which were then inspected directly:

- S01 Status `in_progress` → `review`: supported by the completed implementation/evidence and this independent acceptance. It does not predict integration or `done`.
- S02 Status `in_progress` → `blocked`: supported by the required sandbox prerequisite failing before installation and the incomplete dependency-lock/verification work. The inspected earlier preflight records `bwrap: loopback: Failed to create NETLINK_ROUTE socket: Operation not permitted`, natural exit 1; this reviewer did not rerun or bypass the security probe. Further progress requires an authorized working sandbox and applicable admission, not a security-setting workaround.
- FR-001 Disposition `triage` → `accepted`: records the owner's accepted direction and must be read with the PD-001/FR-001 scope in the separately reviewed feature amendment. Priority stays `unset`; detailed semantics and implementation scheduling remain separate.

At approximately 19:13 UTC, a fresh GitHub read verified [PR #53](https://github.com/BoredSerf/City-of-Vice-Card-Game/pull/53) open and Draft, head `7077a1a0b27cbd06f4b9960e83bf78e7f0f62969`. [Run 38452658522](https://github.com/BoredSerf/City-of-Vice-Card-Game/actions/runs/38452658522) for that exact head was completed/failure: checkout and Node setup passed; `Require resolved dependency locks` failed; bootstrap and aggregate verification were skipped. This corroborates S02's incomplete status, not passing foundation checks or configured required-check enforcement. Enforcement remains a separate owner gate.

Final three-cell diff SHA-256: `61ea8e141933fdff27fc2836ff8a0989f9432c2fd9891aa17e70e55b2e2a64c8`. Resulting IMPLEMENTATION.md SHA-256: `30622ff957391b25049a6778152547c14d6dbabe69e202b0e88d55da9cddd246`. `git diff --check` passed. No priority, dependency, slice contract or other register cell changes; neither slice is marked `done`. The earlier one-cell diff identity `064936987c127bf6f9f75b1530fa7168e483e6ae16b425e9684b6e2ed14031a2` is superseded by this reviewed three-cell state, not silently reused as its evidence.

No governed source was edited, staged, committed, published, merged or deployed during this review.
