# JavaScript facade verification

The supported engine facade consists of seven ordinary JavaScript functions.
Every function returns a primitive string. The diagnostic probe returns text;
the other six return JSON described by
`src/engine/generated-engine.d.ts`. OCaml interfaces and codecs own the domain
contract. TypeScript consumers use JSON values and do not inspect OCaml runtime
representations.

| Function             | Arguments                                      | Decoded result                                                                                                       |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `probe`              | Primitive string label                         | Plain `OCaml / ` diagnostic text.                                                                                    |
| `create_session`     | Eight lowercase nonzero hex seed               | Accepted state/events or full rejection.                                                                             |
| `perform_command`    | State JSON, command JSON                       | Accepted state/events or full rejection preserving state bytes. Submission adds `player_id` to any `Engine_command`. |
| `legal_commands`     | State JSON, serialized numeric participant 0/1 | Ordered command array or full rejection with null state.                                                             |
| `validate_state`     | State JSON                                     | Canonical accepted state/empty events or full rejection preserving original bytes.                                   |
| `player_observation` | State JSON, serialized numeric participant 0/1 | Redacted `{view,legal_commands}` or minimal rejection.                                                               |
| `heuristic_proposal` | Redacted observation JSON                      | One offered command, null, or minimal rejection.                                                                     |

Accepted command/validation results have exactly `status`, `state_json`, `events`.
Full errors add `rejection:{code,field}`, preserve the input string where
documented (null for a nonstring input), and have empty events. Discovery success
has `status`/`commands`. Projection success has `status`/`observation`; proposal
success has `status`/`command`. Minimal errors have only `status`/`rejection`.

Full snapshots and command/event results are trusted local caller data and can
contain private cards. Only the redacted observation goes to policy. A proposal
must still pass current-state `perform_command`, with the intended actor, before
another observation is obtained. See [the policy guide](S06_POLICY.md) for
ownership, numeric admission, isolation, current validation and the distinction
between native retained duplicate fields and raw JSON last-value parsing.
Detailed provisional rule choices retain their existing authority.

## Two actual targets, one complete suite

Development contracts import the actual generated adapter at
`_build/default/engine_js/generated/engine_js/adapter.js` through
`vitest.config.ts`. Production contracts import only the Vite-emitted
`.cache/facade-production/adapter.mjs` through `vitest.production.config.ts`.
Both configs run the same six `tests/contract/**/*.test.ts` suites and the S08
`tests/integration/**/*.test.ts` suites, serially, with no-empty and no-`.only`
protections. There is no target fallback or mocked engine.

`vite.facade.config.ts` builds the generated entry in installed Vite ES library
mode. It emits one deterministic `adapter.mjs`, bundles its dependencies, rejects
external static/dynamic module imports and rejects test-fixture modules in the
bundle. The build logs the actual export/import/module inventory. It empties only
its owned `.cache/facade-production/` directory. Client target/minification use
the same Vite defaults as the normal web build; review both configurations when
those defaults or explicit choices change.

This module is a verification artifact. The normal `dist/` build and development/
built-static playable-browser checks remain separate. S08's controller and storage
integration are described in [the controller guide](S08_CONTROLLER.md). Gameplay
UI verification is described in [the browser guide](S09_BROWSER.md); deployment
and runtime services remain outside this facade method. Root `index.html` remains
the separate prototype.

## Run the method

Use the locked tools and installed dependencies from
[the foundation setup](S02_FOUNDATION.md). From the application root, prepare the
actual generated modules and mandatory native parity before focused contracts:

```sh
npm run build:native
npm run build:melange
npm run test:native
npm run typecheck
npm run test:contract
```

`test:contract` unconditionally builds the production artifact first, then runs
the complete development and production suites, stopping on any failure.
`test:contract:production` also rebuilds before its suite.
`test:contract:development` selects development alone. These focused commands
require the generated/native prerequisites above. A missing generation or parity
input fails; it cannot skip a comparison. `npm run verify` performs the cumulative
format/native/Melange/type/prototype/corpus/native-parity/production-build/both-
contract-target/web/browser chain in the supported order.

The original five suites retain all setup/economy/effects/policy literals and
their native evidence, including all 93 policy cases, 69 numeric negatives and
seven separately coarse positives. The focused `facade.test.ts` adds exact seven-
export/arity/string checks, finite allowed-key/variant witnesses and exact
malformed failures for all nine JSON-operation argument slots. It requires all 12
command tags, 24 event tags, 19 rejection codes, both five-form pending inventories
and their enums/destinations to occur. Complete existing literals remain the
semantic expectations; target agreement is corroboration.

`facade.types.ts` is a compile-only consumer example checked by `tsc --noEmit`.
It exercises valid structured commands/events/state/pending/view/result payloads
and deliberately invalid arguments and structures. Each expected compiler error
must remain an error; an accidentally broadened declaration makes the unused
expected-error annotation fail. These examples are never bundled or executed.

For evidence, retain the exact source commit/tree and status, commands/exit codes,
complete logs, generated-entry and production-output hashes, bundler graph and
native parity identities. Record cache scope: silent Dune reuse does not establish
a fresh native action or 120 complete games. The unchanged complete-game target
remains required. Missing tools, failed builds/imports and test failures provide
no passing verification result.

## Validate production loading and freshness

These local controls apply to the new production method. Run only with exclusive
build/test use of this checkout and after a successful `npm run test:contract`.
Retain complete failed logs and exit codes in the chosen evidence location before
restoring resources. No source fixture or engine implementation is changed.

For missing output, leave development generation available and remove only the
production import target temporarily:

```sh
test -f _build/default/engine_js/generated/engine_js/adapter.js
mv .cache/facade-production/adapter.mjs .cache/facade-production-missing-control.mjs
npm exec -- vitest run --config vitest.production.config.ts
mv .cache/facade-production-missing-control.mjs .cache/facade-production/adapter.mjs
```

The import-only command must exit nonzero because the production alias is absent,
even though development exists. Use a fresh process as shown. This raw command
intentionally omits rebuilding for this control; supported production checks
always rebuild. Restore the module even when the control or measurement fails.

For failed rebuilding, first ensure old production output exists. Temporarily
withhold the generated build entry, then invoke the supported rebuilding command:

```sh
test -f .cache/facade-production/adapter.mjs
mv _build/default/engine_js/generated/engine_js/adapter.js .cache/facade-generated-control.js
npm run test:contract:production
mv .cache/facade-generated-control.js _build/default/engine_js/generated/engine_js/adapter.js
npm run test:contract
```

The production command must exit nonzero at the unresolved entry build failure,
before Vitest can use old output. Record that the prior output existed at the
start; the failed build may remove it. Restore the exact generated file without
changing its permissions, and require the final rebuilding command to pass both
targets. Confirm generated and rebuilt production hashes, remove no shared
dependencies/cache data, and leave neither control backup behind. The method
starts no persistent server; the cumulative browser checks retain their own
existing awaited cleanup.

These controls verify local loading/failure ordering. Actual passing local and
hosted checks, independent review and human acceptance/merge remain separate
obligations. They do not authorize repository-protection changes or merging.
