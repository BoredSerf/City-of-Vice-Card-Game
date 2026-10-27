# Contributing to City of Vice

This project is moving from a self-contained browser prototype to a modular
application while the prototype may continue to evolve. This workflow keeps those
two lines of work aligned without requiring the product owner to reason about the
internal architecture.

## Sources of authority

| Document | Responsibility |
| --- | --- |
| `docs/MVP_PLAN.md` | Accepted product scope, architecture, and MVP acceptance criteria. |
| `IMPLEMENTATION.md` | Slice order, dependencies, status, priorities, and implementation gates. |
| `CONTRIBUTING.md` | Procedure for proposing, approving, implementing, and verifying changes. |
| `AGENTS.md` | Short instructions that make agents apply this workflow. |

Anyone may request or recommend a change. Only the product owner or a maintainer
explicitly delegated product authority may accept, defer, reject, or supersede it,
change its priority, or move an approved prototype snapshot. Agents may explain
impact and recommend a decision, but they do not supply human approval. If authority
is unclear, ask and record the answer in the change's issue, pull request, or other
durable decision record.

## Before changing the prototype

For a request affecting rules, behavior, presentation, copy, or `index.html`:

1. Read the current slice register and prototype-baseline policy in
   `IMPLEMENTATION.md`.
2. Tell the requester both the next ready roadmap slice overall and the slice or
   backlog destination applicable to this request. Do not substitute one answer for
   the other.
3. Explain whether the request affects `rules`, `ui`, `copy`, or more than one of
   those classifications.
4. If S01 has locked a prototype baseline, warn when changing only `index.html`
   would move the prototype beyond the state used by the modular application.
5. Recommend one path: include the work in an applicable active slice, record an
   accepted delta, or place non-urgent work in the feature backlog.

The human decision controls. Record it before treating the request as accepted MVP
work.

## Baselines and prototype changes

S01 records one exact `prototype_baseline` commit SHA before S03 begins. Git tags
may make the snapshot easier to find, but the SHA is authoritative. Ordinary merges
or rebases never move it.

After the baseline is locked, open a ledger entry before merging any change that
affects prototype rules, behavior, presentation, copy, or its tests. Every such
merged change must have an entry in `docs/PROTOTYPE_CHANGES.md`; S01 creates that
ledger. Each entry has:

- a stable change ID and source commit or pull request;
- one or more classifications: `rules`, `ui`, and `copy`;
- affected characterization scenarios and slices;
- disposition: `triage`, `accepted`, `deferred`, `rejected`, or `superseded`;
- priority: `P0`, `P1`, `P2`, `P3`, or `unset`;
- the human decision record;
- the implementation slice or backlog item; and
- verification evidence when implemented.

Priority and disposition are separate. `P0` means release-blocking priority; it is
not a disposition and does not bypass applicable ledger or backlog records, slice
ownership, review, or verification.

Before S03 begins, the product owner or an explicitly delegated product maintainer
may approve a newer baseline commit after the characterization corpus is
regenerated and verified. After S03 begins, keep the baseline fixed and process
later accepted changes as deltas.

S10 locks one exact `final_parity_ref` commit containing the approved prototype
state. The ledger provides traceability; it is not a cherry-pick recipe. If the
accepted state does not already exist as one commit, create and verify a dedicated
snapshot commit, then record its SHA. Prototype work after that cutoff still enters
the ledger and backlog unless accepted for the MVP.

## Deltas and slices

When an accepted delta affects a slice that is still `in_progress` or `review`, the
slice owner may amend that slice if the result remains coherent. Refresh affected
acceptance criteria, verification, and review before integration.

When an accepted delta affects a `done` slice, keep that completed record intact and
create a new slice with the next available `S##` identifier. The new slice names the
completed work it changes, its downstream consumers, acceptance criteria, and
verification. Add it as a dependency of every not-yet-done consumer it affects;
block an affected consumer already in progress until the delta is complete. A
completed slice never returns to an active status.

A rules delta updates the characterization corpus before implementation. UI and
copy deltas update their applicable browser fixtures or reference evidence. Mixed
changes perform every applicable check.

## Development on verified, unmerged prerequisites

The product owner permits stacked branches and pull requests so that waiting for
human acceptance or merge alone need not stop dependent development. This is a
development-readiness exception to the usual integrated-dependency requirement,
not acceptance or integration of the prerequisite. The roadmap coordinator selects
eligible work under the existing priority, ordering, and rule-decision gates.

- Before dependent development starts, independently verify each prerequisite's
  implementation and applicable tests at an exact commit. Record every parent
  pull request, commit SHA, and verification evidence in the dependent work item
  or pull request. A branch's existence or a passing check alone is insufficient.
- Base the dependent branch on its verified prerequisite branch and target its pull
  request at that parent branch, keeping its own change reviewable. With multiple
  prerequisites, record every exact revision and independently verify the combined
  base before relying on it. Record that base and how it contains the prerequisites.
- Run applicable checks against the cumulative stack, including each new test or
  build command in the accumulated verification workflow. If a parent changes,
  reassess affected contracts and evidence, update descendants, and independently
  reverify affected behavior before relying on the changed base.
- Unresolved product or rule decisions, unsafe behavior, failed applicable checks,
  and unverified required interfaces still block affected development. Stacking
  does not resolve RD-007 or waive S02's passing local and hosted checks and
  independent verification of the reviewed revision. Apply the
  [CI acceptance amendment](docs/MVP_PLAN.md#ci-acceptance-amendment-2026-10-27).
  Keep pending acceptance and integration requirements explicit even where
  verified code permits development.
- Record the readiness exception and its evidence outside the roadmap status cells.
  Verified but unmerged work is not `done` or integrated; keep existing `review`,
  `blocked`, and reconciliation obligations truthful.

One roadmap coordinator retains ownership of the entire unfinished stack, pending
decisions, and reconciliation through human merges. The same coordinator may
continue eligible dependent work while earlier verified pull requests await human
acceptance or merge; finishing one layer does not release that ownership.

## Pull requests and completion

Keep a change within its owning slice or delta. The pull request should identify
the applicable baseline or final parity reference, ledger entry, acceptance
criteria, and verification results. Semantic changes to the MVP plan require fresh
product-owner acceptance.

Implementation and review do not move roadmap status automatically. The roadmap
coordinator applies the small status updates described in `IMPLEMENTATION.md` after
the relevant transition is established.

Before acceptance and merge, a human inspects the source review and applicable
local and hosted check results for the reviewed revision. Failed checks or missing
verification evidence block acceptance and merge. Keep every actual test and
build check in the automated workflow as it is introduced. The CI acceptance
amendment removes mandatory GitHub required-status-check enforcement and the
deliberate failing-check merge-block demonstration; it does not waive passing
checks or human inspection.

The user accepts and merges every pull request, including workflow and status-only
changes, in dependency order. Do not enable automatic merging, merge on the user's
behalf, push directly to `main`, or bypass existing repository protections. After a
parent merges, update descendant bases and verification as needed. Mark a slice
`done` only after acceptance and integration, through the post-merge status update,
which also awaits human merge. The coordinator then confirms the authoritative
tracker and integration evidence agree and all stack obligations are closed; do
not create a no-op tracker update merely to record that confirmation.
