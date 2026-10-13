# City of Vice S02 source checkpoint review

Reviewed 2026-10-13 UTC by an independent reviewer who did not implement the
source checkpoint or edit the roadmap status artifact.

## Decisions

1. **S02 source content: accepted for an explicitly unfinished Draft checkpoint.**
   No source-level publication blocker was found in the exact 22-file set below.
   This is technical acceptance of a preparation checkpoint, not S02 acceptance,
   completion, integration readiness, installed dependencies, or passing new tests.
   Publication and any resulting hosted workflow execution remain separate gates.
2. **Roadmap cell: accepted independently.** The exact change is only S02 Status
   `ready` to `in_progress`, preserving the already-published S01 `in_progress` cell.
   Assigning the implementation owner and starting source preparation establish
   this administrative transition. Neither slice is moved to `review` or `done`.
3. **PR51 description: accepted.** Title: “Roadmap: record S01 and S02 work in
   progress”. The reviewed body correctly describes two cells against main, this
   new commit's single additional S02 transition, and unfinished verification.

## Controlling scope and inspection

The existing S02 contract in IMPLEMENTATION.md controls. This review does not
introduce another contract. Read the applicable AGENTS.md files first, then the
project README, CONTRIBUTING, IMPLEMENTATION, and MVP plan. Inspected current
prototype startup/rules code, its complete original test file, each changed or
new foundation file, the complete changed-file inventory, and the roadmap diff.
The embedded artwork payloads were not decoded; whole-file identity checks cover
their preservation along with the unchanged prototype code.

The checkpoint is product-neutral configuration, direct version constraints,
test expectations, a maintained TypeScript declaration, documentation, and a
fail-closed CI draft. Runtime OCaml/TypeScript bodies, the new HTML shell,
generated output, complete locks, and bootstrap are deliberately absent.
There are no new rules, state, AI, persistence, gameplay UI, prototype replacement,
standalone export, deployment, or license changes. The S01 decision file still
contains twelve unresolved decisions and zero mappings to S02.

The native and generated-boundary probe fixtures use independent literal
expectations and check that caller-supplied labels survive the boundary. The
browser fixture opens the real development and built-static entries, checks the
visible engine result, rejects non-local HTTP requests, records page errors, uses
fresh contexts, and requests an enabled Chromium sandbox. A narrow real-browser
smoke through the Vitest Node runner is proportionate; an additional browser
provider/component application is unnecessary here.

## Findings and dispositions

- **No requested source remediation.** Missing compilation, runtime bodies,
  bootstrap, solved locks, browser proof, and CI evidence are accurately disclosed
  unfinished work. They prevent S02 completion, not a candid source-only checkpoint.
- **PreviewServer cleanup concern disproved for the selected version.** General
  Vite API documentation omits `PreviewServer.close()`, but the exact Vite v8.3.4
  source declares `close(): Promise<void>`. Its fetched preview.ts blob is
  `13be7e4345dbe0b153fdc3224107350688451e29`. No cleanup rewrite is warranted.
  Source: https://github.com/vitejs/vite/blob/v8.3.4/packages/vite/src/node/preview.ts
- **Workflow execution consequence remains explicit.** Opening the S02 PR can
  run GitHub-hosted checkout and setup-node before the intentionally failing
  missing-lock step. Source-only publication must not be represented as having
  no setup/execution consequence. This review did not start that workflow.
- **CI draft is fail-closed, not enforced integration.** Ordinary pull_request
  and main push events, read-only contents permission, disabled persisted checkout
  credentials, no secrets or deployment, no path exclusions, and one stable
  `integration` job are present. Missing locks/bootstrap cause failure; no
  continue-on-error, skipped-gate exception, or success-masking final job exists.
  Repository owner/admin required-check configuration and a controlled exact-head
  failing blocked-integration demonstration remain prerequisites. Live repository
  enforcement settings were not independently re-read in this source review.
- **Dependency and emit-layout evidence remains pending.** Exact direct version
  constraints are not a solved dependency graph or integrity evidence. Real
  installation must establish supported metadata, both full locks, the opam
  repository revision, generated adapter path, clean bootstrap, and all checks.
  Missing-module/tool errors do not constitute observed test-first assertion RED.

The action release links independently resolved to the full pinned commits:

- checkout v7.0.1:
  https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1
- setup-node v7.1.0:
  https://github.com/actions/setup-node/commit/949feb2413d6458794dcd2491c4babbbce0c15c1

## Fresh verification and limits

- Original suite: `timeout 30s node --max-old-space-size=128 --test --test-concurrency=1 tests/prototype-rules.test.cjs`
  exited 0: 16 tests passed, 0 failed, 0 skipped, approximately 333 ms test duration.
- package.json and tsconfig.json parsed successfully using existing Node under a
  30-second timeout and 128 MiB old-space bound.
- `git diff --check` passed in both reviewed worktrees. This tracked-diff check
  alone is not a formatting result for the untracked foundation files.
- No OCaml compilation, new TypeScript checking, formatter, new test, build,
  browser, clean-bootstrap, CI, dependency install, or lock generation was run.
- No source edits, Git changes, external mutations, browser launches, downloads,
  permission changes, merges, or deployments were performed by this reviewer.
  This receipt is the reviewer's sole written artifact.
- The initial resource guard reported 20,754,853,888 free bytes and the City
  recovery directory at 8,272,653 bytes, below 32 MiB and above the 10 GB floor.

Unchanged source SHA-256 identities:

```text
f01755c9c82c3f871fafc7f8b5b1b078ad05ddb6421a15425a0e824ebc6fac15  index.html
1f635a4a2852ca08fefecaaa8b98460eaf49e5144735a734fbce0334d6d19469  tests/prototype-rules.test.cjs
```

## Exact source checkpoint identity

Branch: `phil/s02-reproducible-foundation-20261013`.
Base/HEAD during inspection: `4ccb19703d4af1a1c202d922b514a58a17d0e537`.
There is one modified tracked file, README.md, and the 21 new files listed below.
The README diff against the base has SHA-256
`bceb819d1af976735b6fcbd1a8995bbc70879d6d3005fbc54055e95e78cfff4e`.
No other modified, new, or ignored files appeared in `git status --short --ignored`.

SHA-256 of every reviewed changed/new file:

```text
bbf7cb7c9b8fd1bf8f693fa6cdff1849e1552362ff1d550eb1b0260feab913f5  README.md
2e4e07e6434216031fcd065d22820bf33e42de80df7da751abeeb008b17b6ac8  .github/workflows/verify.yml
0360ed663e7493043541a7c94ea3b3377b58905458f9d5a98dd9253110138841  .gitignore
7e8a2fa94951112b894a3dbe3d05efef5e9263741fa49125f0a70f40fedab4cc  .node-version
3b88d1057add6f92ec23dc22dd017e312ded13a042deb0ba6f08bad85d936456  .npmrc
422e31fe0dbe330696f8152cda8bc1ac8d917824cbb5a898ce38c4c350227725  .ocamlformat
eb5ed36908f0eeb7d225612070ead8739dc4ff782c2657ca7615a69e0038fe32  city_of_vice.opam
af2616e778c2b34923c6998196bfa8aaf40c0501708075832dd3b0773ef3686f  package.json
ce133f481994ce91b08861371faec1e10d9a1610d110d347392025b6f3e64ad9  tsconfig.json
da03804282abcd4924c5ad2cd6db326bbbaa22984bcc9f08dc02424e23501abc  dune
a45219aae2a109c78d6babc3718c866771b42635cf0f3d57462c84555ea4ba33  dune-project
49e70e8b063d225b7a69313ac82976d37549c205aadd6339db0225e6bddc2baa  engine/dune
c736883909211fc7b031bf65f897aabc43bb0d4df693e23a03b53a0e3ae826c0  engine_js/dune
9ffc781017aa19521ad5db39379312d7a4c1940fd2bc4f3611684d7385eb33de  test/dune
24eedde8ebadb2d43946a218bb8db2aae8e81b1b389ff4b444519c623d3c588c  test/foundation_test.ml
8e36b6f9cde907b3ab55ad476ac3a173943c544836e3151413f3ff7cd2fa026c  src/engine/generated-engine.d.ts
aae985b24116ee2fad12595d91d0ea73ddb2f1bddabba0faf23a36c752a8d0fd  tests/contract/foundation.test.ts
ab96060c23770fc74168fb8a97494ff22d1dc17a59c75c588add4087cac2a8f1  tests/browser/foundation.test.ts
c4e8a5ae62aa41107a1793f02923abcb9f0f488d862795302902536db7a208dc  vite.config.ts
ff6d3748e1f4e274f76a2a2c452d5cb608a624a7e7f0b2f549e30dd15ad4bbad  vitest.config.ts
d4a3c5b13700fde1d2ac72e3878426658152cebac9d5fbc5caae5cf23c3a4acc  vitest.browser.config.ts
e6659cf703f852386111892abcfdbe6b59fff6fe4d63fdfc774b2e580836e7df  docs/S02_FOUNDATION.md
```

## Separate roadmap artifact identity

Branch: `phil/s01-roadmap-status-20261013`.
Published base inspected: `22f7144a68be9fe7f31875d1d1e99231bea379e9`.
The sole uncommitted change at review was the single S02 Status cell.

- Current IMPLEMENTATION.md SHA-256:
  `128bd8d5bad72842c39fae3ec2c66db77388423d268ae7d3cef7d6b5ea940f1c`
- Diff against that published base SHA-256:
  `7e22490275c3d3fc195c5810ede6e42acc98cbdb03d313fb35d863a71c3086ed`
- Reviewed replacement PR51 body SHA-256:
  `60fae4656c6a956b0fa4347bbde011ac69341e46de0e0c09a825f74455e5bb0a`

Any material change to a reviewed artifact requires focused independent review
again. Review acceptance does not attest that publication subsequently occurred.

## Addendum — 2026-10-13 18:57 UTC: product-decision wording

**Accepted for the same explicitly unfinished source-only Draft checkpoint.**
The sole change to the previously reviewed 22-file set is the approval paragraph
in `docs/S02_FOUNDATION.md`. Its new SHA-256 is
`6a2b4364dac00601040984d50cad17d3d008711f8d9b5878c40da5d80112d118`;
the original document identity above remains historical evidence.

Fresh hash comparison checked all 24 source identities in this receipt: the other
21 checkpoint files and both preserved prototype/test files remain byte-identical.
Replacing only the new paragraph in memory with the original paragraph reproduced
the exact prior document SHA-256, establishing a paragraph-only change. HEAD
remains `4ccb19703d4af1a1c202d922b514a58a17d0e537`. The tracked diff whitespace
check passed; this is not a new formatter, toolchain, test, browser, or CI result.

The replacement correctly records approval of the exact initial prototype
reference and the high-level direction of eight distinct crew bonuses. It does
not approve all observed outcomes or the detailed crew edge cases. The inspected
S01 decision context records RD-001 as resolved, eleven decisions still open, and
no unresolved decision mapped to S02. S01 remains unfinished and its updated
decision record awaits independent review and publication. That record was read
only as context; this addendum does not independently accept the S01 changes.

The previous review and adverse-finding dispositions remain preserved above.
The coordinator has separately cleared bounded ordinary GitHub-hosted validation;
checkout/setup-node can therefore run as part of publishing this checkpoint.
No successful workflow run is established here. Missing locks/bootstrap still
produce an expected failure, and neither that failure nor workflow source proves
required-check enforcement. The owner/admin configuration and blocked-integration
demonstration remain unsatisfied S02 acceptance requirements.

This re-review performed source reads and bounded existing-Node identity checks
only. No source edit, installation, browser execution, Git mutation, publication,
or repository administration was performed by the reviewer. Only this receipt
addendum was written. Fresh free-space guard: 20,746,633,216 bytes, above 10 GB.
