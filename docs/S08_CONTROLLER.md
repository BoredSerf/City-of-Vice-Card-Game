# Controller and local persistence

`src/app/controller.ts` synchronously orchestrates one human (0) and heuristic
rival (1). The OCaml engine still owns rules, legal choices, pending owners,
versions, admission, income and outcomes. The narrow `src/engine/index.ts`
adapter decodes the existing six-operation JSON facade; it neither repairs saves
nor implements a second state validator. UI animation, timing and dialog state
belong outside domain state. [S09's normal browser UI](S09_BROWSER.md) now consumes
this controller; root `index.html` remains the separate playable prototype.

## Consumer API and trust

```ts
import { create_controller } from "../src/app/controller.ts";

const game = create_controller(); // No storage access or game creation yet.
game.inspect_save(); // Read/admit the slot, without installing it.
game.resume(); // Explicitly re-read, admit and install the complete save.
game.new_game("00000001", "empty_only");
game.submit_human({ command: "start_game", opening_distributor: 0 });
game.submit_human({ command: "collect_income" });
game.step_rival(); // One fresh observation/proposal and at most one command.
game.retry_save(); // Save current progress; no command or event replay.
```

Each operation directly returns a detached update with `status`, minimal
`rejection`, `snapshot` and `trusted_events`. `snapshot()` returns a detached
human observation plus save metadata. Canonical state, stored raw bytes, recovery
baseline, rival observation, RNG and history have no public getter or callback.
The caller cannot override the intended actor. Both human and rival commands pass
the current state to the same `perform_command` path. An old command is accepted
if it is still legal; rejected commands produce no save or new events.

`trusted_events` contains only the current operation's actual ordered engine
facts. It can include private card IDs. It is for trusted local consumers, never
policy input or raw player-visible output. A UI must map those facts to appropriate
visible information. Resume, inspection, idle, rejection and save retry return no
new domain events. A publication fault after an accepted command is exposed via
`snapshot.integration_fault`; that command and its successful save remain applied.
A malformed facade result before adoption preserves the prior live game and bytes.

Rival stepping observes identity1 freshly and supplies only `{view,legal_commands}`
to the actual heuristic. The engine's decision owner determines action, including
inactive Pipeline defender and Night-loss trim decisions. Human-owned choices
make the rival wait even during its active turn. There is no automatic drain loop,
phase clearing, inserted income or end-turn escape. Resume never replays income,
RNG or stored history. A terminal save is recognized but has `resumable:false`;
explicit resume may install it as a completed game.

## One protected save slot

`src/app/persistence.ts` lazily acquires browser storage and uses only
`city-of-vice-modular-current-v1`. It stores raw engine-produced JSON directly.
Only null means absent; even an empty string passes through `validate_state`.
Legacy `city-of-vice-current-v6` and `city-of-vice-achievements-v1` are never read
or written. There is no storage scan, clear, remove-before-write or eager write
probe. The narrow injectable port permits only `getItem` and `setItem`.

Save metadata keeps slot admission, current savedness and write authority separate:

| Metadata          | Meaning                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `slot.admission`  | uninspected, empty, valid, rejected or unreadable. Only admitted valid data supplies resume eligibility.                      |
| `saved`           | Current canonical progress is represented by the last successful save or admitted resume. Failure is never reported as saved. |
| `write_authority` | owned, protected or suspended. Unsaved progress can still own a known prior slot.                                             |
| `failure`         | acquisition, read or write failure, without raw exception/payload data.                                                       |

A valid new-game candidate is prepared before installing or writing it. Missing
intent/cancel/invalid seed cannot discard the live game. The three explicit intents
are:

| `new_game` intent | Behavior                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty_only`      | Read the slot; only null allows installation and one save. Existing data requires replacement. Unknown storage returns unavailable without adoption. |
| `memory_only`     | Install valid progress without storage access/write. Existing bytes remain protected and later commands cannot autosave them.                        |
| `replace`         | Install valid progress and authorize one setter attempt over existing/unknown data. Success establishes ownership.                                   |

An ordinary owned setter failure keeps progress unsaved and retains authority over
the known unchanged prior bytes. A later command or plain retry may save current
progress. A failed protected replacement consumes its one-shot intent: subsequent
commands perform no read/write, and a plain retry cannot overwrite nonempty bytes.
Renewed `retry_save("replace")` permits one new attempt; a successful read proving
null also permits saving. Retry never re-executes a command or its events.

Acquisition/read failure suspends writes. A later explicit inspection/plain retry
restores ownership only for null or the exact previously owned raw baseline that
still passes engine admission. Raw whitespace is preserved separately from the
canonical admitted snapshot. Different valid, rejected or unknown bytes stay
protected; explicit resume can instead adopt a different valid save. Starting a
different game in memory resets its lineage ownership. These are bounded
single-writer decisions under provisional issues [68](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/68),
[88](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/88) and
[89](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/89).
They provide no multi-tab locking, disk-durability, migration or original-prototype
compatibility guarantee. Final warning/confirmation presentation belongs to S09.

## Run and inspect the method

Use the locked installed prerequisites from [S02](S02_FOUNDATION.md), including the
explicit browser installation. From the repository root:

```sh
npm run build:native
npm run build:melange
npm run test:native
npm run typecheck
npm run test:contract
npm run build:web
npm run test:browser
```

`npm run verify` includes these checks plus the existing formatter, prototype and
characterization checks. Both existing contract configurations explicitly include
the integration suite and require nonempty serial execution. The production path
rebuilds its actual standalone facade before import and has no development
fallback. Neither dependency locks nor existing literal expectations change.

| Test ID | Required observations (S08-AC references)                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C01     | Lazy one-key access, null/empty, cancel, rejected bytes and sentinel preservation (01/05/06).                                                                                                                                                          |
| C02     | Real FUND001/mirror/FUND003/STOP001, exact actors/events/writes, current rejection/old-command legality and detached publication (02/03/08).                                                                                                           |
| C03     | Every boundary in all 93 existing policy/numeric fixtures reconstructed from literal state/patches/events, all eight phases/five pending forms/both owners/terminal reasons, hand8/cash26 and deterministic continuation; no resume replay (03/04/08). |
| C04     | Existing impossible effects, unsupported schema/rules/RNG and exact original SAVE001–004 payloads rejected at the modular key without adoption/write (04/05). Legacy expectations remain historical and unchanged.                                     |
| C05–C08 | Candidate ordering, three intentions, independent acquisition/read/set faults, consumed protected intent, owned retries/autosave and same/null/different/rejected/unreadable recovery (06/07).                                                         |
| C09–C10 | Decode/publication faults, raw baseline versus canonical, memory-lineage reset, no-game finite calls and nested trusted-event detachment (01/07/08).                                                                                                   |
| B01     | Actual Chromium localStorage, same-origin `page.reload`, new controller/resume/no replay/literal continuation, rejected-byte reload/cancel/replace and sentinels (09).                                                                                 |

The browser consumer `tests/browser/controller.html`/`controller.ts` is test-only,
served by a Vite instance rooted explicitly at the repository on an ephemeral
loopback port. Its readiness text identifies the loaded controller. Requests are
restricted to that actual origin; page errors and external requests must be empty.
Each failure path awaits its own context/server/browser cleanup. Chromium's own
sandbox stays enabled. If an outer execution sandbox prevents launch, record it
as unavailable and use the authorized host execution path; do not disable Chromium
sandboxing. Unrelated servers/profiles must remain untouched.

This is controller/browser-storage evidence, not S09 gameplay or S11 responsive,
keyboard or accessibility acceptance. Preserve source commit/tree, command/exit
codes, complete logs, fixture/module/native hashes, observations and failure
history outside the reusable method. Silent Dune reuse establishes no fresh
native action or fresh 120-game run. A missing required fixture/generated input,
failed import/launch or failed assertion is failure/unavailable, never a passing
rejection observation. Hosted and independent results remain separate evidence.

## Validate failure detection without changing application source

With exclusive test use, copy `tests/integration/controller.test.ts` to
`tests/integration/controller_control.test.ts`. In that isolated copy only,
change the C02 captured cash command's card ID31 to ID35, retaining the expected
accepted result. Run:

```sh
npm exec -- vitest run --config vitest.config.ts tests/integration/controller_control.test.ts -t S08-C02
```

The known illegal choice must fail its unchanged accepted-result assertion. Retain
the nonzero log, then remove only the temporary control copy. For the unavailable
input control, make a fresh control copy, change its policy fixture input path to
`../policy/required_s08_missing.json`, then run the same command. The suite must
fail to import the missing input; an empty/skipped passing suite is unacceptable.
Retain the failed log and remove only that copy even if the control fails to run.
Confirm the original source hash is unchanged and both focused targets pass after
cleanup. The browser launch/port failures similarly supply measurement-failure
observations; verify owned profiles/PIDs/listeners are gone after failed and
successful attempts. Preserve evidence, installed dependencies and shared caches.
