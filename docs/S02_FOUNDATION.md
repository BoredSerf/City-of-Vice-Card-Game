# S02 foundation source preparation

This is a partial implementation of the existing
[S02 contract](../IMPLEMENTATION.md#s02--reproducible-project-foundation), based on
commit `4ccb19703d4af1a1c202d922b514a58a17d0e537`. It is not a runnable foundation
or a completed slice. The roadmap coordinator owns `IMPLEMENTATION.md`.

## Current boundary

Prepared here: dependency constraints, Dune/Vite/TypeScript/Vitest configuration,
test expectations, a maintained declaration, and a fail-closed CI draft.

Still absent: runtime implementation, dependency installation, transitive locks,
a tested bootstrap command, generated JavaScript, and browser/build evidence.
The new tests have not run. Missing tools or missing modules are not observed
test-first assertion failures. Implement runtime bodies only after the relevant
tests can run and fail for the intended missing behavior.

The existing root `index.html` and `tests/prototype-rules.test.cjs` stay unchanged.
Their source identities are respectively:

- SHA-256 `f01755c9c82c3f871fafc7f8b5b1b078ad05ddb6421a15425a0e824ebc6fac15`
- SHA-256 `1f635a4a2852ca08fefecaaa8b98460eaf49e5144735a734fbce0334d6d19469`

S01 remains separate, unfinished work. Product-owner decision PD-001 (2026-10-13)
approves exact commit `4ccb19703d4af1a1c202d922b514a58a17d0e537` as the initial
prototype reference and retaining eight distinct crew bonuses as the high-level
MVP direction. Eleven rule decisions remain open, including detailed crew
semantics; prototype observations do not approve those outcomes. None blocks this
product-neutral foundation. S01's updated decision record is awaiting independent
re-review and publication; this approval does not complete S01.

Source-stage verification on 2026-10-13 ran the unchanged original suite with
`timeout 30s node --max-old-space-size=128 --test --test-concurrency=1 tests/prototype-rules.test.cjs`:
16 passed, 0 failed, 0 skipped. Both recorded source hashes still matched.
`package.json` and `tsconfig.json` parsed as JSON. No OCaml, TypeScript, formatting,
build, browser, clean-bootstrap, or CI result is claimed.

## Smallest complete path

The implementation will have one pure OCaml library in `engine/`, one thin
Melange adapter in `engine_js/`, and one framework-free browser entry at
`web/index.html` with `web/main.ts`. The source prototype is neither imported nor
bundled. `dist/` will contain only the generated foundation website.

The temporary `Foundation.probe` operation carries a supplied label into a
string, demonstrated by `S02` becoming `OCaml / S02`. It establishes toolchain
plumbing only. It is not a game-session API, state model, or product-copy decision.
The maintained declaration in `src/engine/generated-engine.d.ts` exposes only
`probe(label: string): string`. The contract suite imports actual Melange output;
there is no handwritten substitute for that output.

Dune emits ES modules under `_build/`. The Vite alias points at the documented
nested emit layout, `_build/default/engine_js/generated/engine_js/adapter.js`;
the first real compilation must confirm that exact path. Generated artifacts
remain ignored and are regenerated rather than copied or edited manually.
See the official [Dune Melange reference](https://dune.readthedocs.io/en/stable/melange.html).

The browser smoke uses Vitest's Node runner and Playwright to open both the real
Vite development entry and the actual built static output. A single browser runs
the same visible probe assertion for each, sequentially, with fresh contexts.
This avoids a second component-test application and does not use jsdom. The
optional `@vitest/browser-playwright` provider is unnecessary for this narrow
end-to-end check; no provider wrapper or browser-context unit suite is introduced.

Both flows must display the OCaml result through TypeScript and the real DOM,
have no uncaught page errors, and make no external HTTP requests. Non-local
requests are blocked and recorded. Playwright launches with
`chromiumSandbox: true`; sandbox failure is a stop, not a reason to disable it.

## Dependency resolution still required

These are exact direct constraints, not solved dependency locks:

| Tool | Candidate |
| --- | --- |
| Node / npm | 24.19.0 / 11.9.0 |
| opam | 2.6.1 |
| OCaml | 5.5.1 |
| Dune | 3.24.2 |
| Melange | 7.0.1-55 |
| ocamlformat | 0.29.0 |
| TypeScript | 7.0.2 |
| Vite | 8.3.4 |
| Vitest | 5.0.4 |
| Playwright | 1.64.0 |
| Prettier | 3.9.10 |
| Node declarations | 24.19.2 |

Before installation, verify the selected official release metadata and required
system packages. Melange's OCaml and Dune constraints must be satisfied by the
actual solve. Relevant primary records include
[Melange](https://opam.ocaml.org/packages/melange/melange.7.0.1-55/),
[Dune](https://opam.ocaml.org/packages/dune/dune.3.24.2/),
[ocamlformat](https://opam.ocaml.org/packages/ocamlformat/ocamlformat.0.29.0/),
[Vite](https://github.com/vitejs/vite/blob/v8.3.4/packages/vite/package.json),
[Vitest](https://github.com/vitest-dev/vitest/blob/v5.0.4/packages/vitest/package.json),
and [Playwright](https://github.com/microsoft/playwright/blob/v1.64.0/packages/playwright/package.json).

The authorized resolution stage must generate and review:

- `package-lock.json`, including exact transitive packages and integrity fields;
- `city_of_vice.opam.locked`, from a real installed solution, without
  `--direct-only` or machine-local dependency pins;
- `toolchain/opam-repository.rev`, recording the exact repository commit used for
  the solve, with package source checksums verified against that revision; and
- a single documented `npm run bootstrap` path, verified in a clean checkout with
  that repository revision and both lockfiles, without silently updating them.

The planned bootstrap must check prerequisite versions, keep opam's sandbox
enabled, use one compiler job, and fail on missing locks, unsupported prerequisites,
or integrity failures. It must neither change system/security configuration nor
implicitly download browsers. This checkpoint deliberately has no bootstrap
script or fabricated lockfiles. Do not use an unlocked install as its replacement.
The official [opam lock command](https://opam.ocaml.org/doc/man/opam-lock.html)
requires installed dependencies; constraints alone cannot provide its evidence.

Browser installation and execution are separate stages. A developer may later
set `CITY_CHROMIUM_EXECUTABLE` to an explicitly approved existing executable.
That proves only that browser's compatibility. System Chromium 154 is not the
Chromium 156/revision 1248 expected by the Playwright 1.64.0 candidate. A pinned
browser download needs its own approval and must be recorded; none is performed
by these test files or package scripts.

## Verification commands after bootstrap

The intended aggregate is `npm run verify`. It runs every command below in order
and stops on any failure; no command accepts an empty test set as success.

| Check | Command |
| --- | --- |
| OCaml/Dune formatting | `npm run format:ocaml` |
| New web/config/document formatting | `npm run format:web` |
| Native target compilation | `npm run build:native` |
| Generated Melange ES modules | `npm run build:melange` |
| TypeScript and maintained declaration | `npm run typecheck` |
| Existing prototype tests | `npm run test:prototype` |
| Native probe behavior | `npm run test:native` |
| Actual generated-module contract | `npm run test:contract` |
| Static production build | `npm run build:web` |
| Development and built-static browser smoke | `npm run test:browser` |

`npm test` includes prototype, native, and generated-module contract tests. Build
the generated modules first when running it individually. Browser tests need the
production build first. `npm run dev` will serve only the separate foundation
entry after Melange compilation; it is not the playable prototype.

The prototype command retains Node's `tests/*.test.cjs` entry point. After S01
is independently integrated, that glob will also include its characterization
test. The integration change must additionally add its standalone corpus command
(`node tests/characterization/harness.cjs`) to the same aggregate before calling
the combined gate complete. Do not copy S01 into this independent branch or
conditionally skip a missing corpus while claiming it was checked.

## CI and enforcement

The draft `.github/workflows/verify.yml` uses ordinary `pull_request` events and
pushes to `main`, `contents: read`, no persisted checkout credentials, no secrets,
no deployment, no path exclusions, and one stable aggregate job named
`integration`. It fails while lock inputs or bootstrap are missing. It contains
no placeholder success, `continue-on-error`, or failure-masking final job.

Official action tags were resolved on 2026-10-13:

- [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1):
  `3d3c42e5aac5ba805825da76410c181273ba90b1`
- [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0):
  `949feb2413d6458794dcd2491c4babbbce0c15c1`

The final clean CI runner still needs the verified bootstrap's opam and browser
prerequisites. The source draft is not evidence that GitHub Actions has run.

Repository enforcement is separately pending owner/admin action. Workflow YAML
does not make a check required. S02 cannot satisfy acceptance until an authorized
owner/admin configures the emitted aggregate check as required for integration
and demonstrates, on a controlled failing change, that integration is blocked.
Record the check name/app identity, protected target, failing run/commit, observed
block, and subsequent passing run. Do not merge or alter repository permissions
to manufacture that evidence.

Rules, AI, persistence, gameplay UI, artwork extraction, standalone export,
deployment, licensing changes, and prototype retirement remain outside S02.
