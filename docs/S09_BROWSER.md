# Playable modular browser flow

After the [locked setup](S02_FOUNDATION.md), run `npm run dev` to play one human
against the actual OCaml heuristic rival. `npm run build:web` produces the same
application in `dist/`. The normal entry is `web/index.html`/`web/main.ts`; it uses
the [S08 controller](S08_CONTROLLER.md), not the root prototype script.
Full artwork/gallery/rules/dialog/animation parity is S10 work. S11 owns the full
responsive/keyboard/reduced-motion matrix; S12 owns standalone distribution.
Root `index.html` remains a separate playable prototype. No license is assigned.

## Menu, game and saves

Choose **New game**, select a named opening distributor and confirm it. The browser
supplies a valid random seed; the normal UI has no seed/state debug input. Collect
income when that action is offered. **End turn** already includes the next
player's income under PD-002; returning, resuming and acknowledging do not collect
again. The board displays your hand/suspended cards, public player areas, named
resource colors/counts, phase/decision owner, own limits/rate/capacity and pile counts.
Printed card information comes from the one public inventory. It does not decide
legality, affordability or victory.

Every available action comes from a complete engine offering. Choose its named
family, then card/color/payment/mode/target choices, and confirm. Each partial
choice filters retained complete commands; it never combines separately legal
fragments. Different ordered targets and payment arrays remain distinct. Current
engine validation decides a submitted old choice. Rejection refreshes controls
without a fallback move or save.

| Offered family      | Controls                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Start game          | Named opening distributor.                                                                                          |
| Collect income      | Explicit offered income action.                                                                                     |
| Activate card       | Named card and offered wildcard payment, including printed cost/no wildcard.                                        |
| Cash card           | Named eligible card and offered resource color.                                                                     |
| Draw card           | Ordinary/Docks mode and one complete offered payment.                                                               |
| Discard drawn card  | Named eligible drawn card.                                                                                          |
| Trim resource       | Offered unit/color.                                                                                                 |
| Trade resources     | Offered spend/receive pair at the displayed current rate.                                                           |
| Use operator        | Named operator, first target and optional second target in offered order. Completed costs/results come from events. |
| Trade distributors  | Offered own/rival pair.                                                                                             |
| Respond to Pipeline | Offered Accept/Decline.                                                                                             |
| End turn            | Explicit offered turn handoff.                                                                                      |

Required choices include Docks discard, legitimate-business cash, resource trim,
Pipeline response and post-action crew-loss trim. Ownership takes priority over
active player. You can respond while the rival is active; the rival can resolve
its own required choice during your active turn. Menu/Escape cannot clear a domain
decision. **Continue current game** returns to retained live progress, including
its pending choice, without replacing it from stored bytes.

The main menu inspects through S08 and offers **Resume saved game** only for an
admitted unfinished save. Resume re-reads/adopts the complete state. A completed
save is recognized without being advertised unfinished. New game or Resume asks
before abandoning unsaved live progress. Cancel preserves it. Existing/unknown
saved bytes require explicit **Replace saved game**, or **Play only in memory**
preserves the slot. The save panel distinguishes current savedness, protected or
paused automatic writes, rejected/unreadable data and storage access/read/write
failures. An applied action may still be unsaved.

Use **Retry save** for S08's permitted recovery. Protected nonempty bytes require
renewed explicit replacement. A failed protected replacement consumes its one-shot
intent; later play cannot silently overwrite the prior bytes. Ordinary owned
setter failure keeps live progress and permits later current-state retry/autosave.
Acquisition/read recovery must prove null or the admitted exact prior-owned raw
baseline. The UI does not parse, repair, migrate, scan or write storage itself.
Legacy/achievement keys remain separate. These single-writer decisions and
issues68/88/89 remain provisional; no concurrency/disk-durability claim is made.

## Rival, results, log and privacy

One cancellable UI task performs one fresh rival step. Actual required ownership
and current view determine the next task. Menu/new/resume/navigation invalidate
old queued work. Waiting, rejection, fault and terminal/no-game states cannot
start a busy loop or force End turn. An accepted transition followed by display
failure remains committed: allowed current facts appear once, saving status stays
honest and automation pauses. A pre-adoption integration failure preserves the
prior game. Neither path rolls back or replays a command to obtain a better view.

**Rival actions** retains the visible batch during required human interruptions.
Complete your required choice first; automation resumes only when actual ownership
requires it. At ordinary human handoff choose **Continue** before ordinary actions.
Acknowledgement changes UI state only: no command, policy, income, save or replay.
Actual winner/reason immediately displays victory/defeat, with recap still available.
The UI never infers the outcome from business counts.

The log is explicitly **this UI session's action log**. New game resets it; menu
and live return retain it. Resume starts with **Game resumed**, without replaying
stored history. S10 must reconcile persisted-log parity with the human-selected
reference; S09 makes no history-read API or second log persistence system.
These recap/log directions under issues94/95 remain provisional.

Only explicit visible facts are retained. Own draws may show own card names;
rival draws show count/source/reported price, with no identities in text,
attributes, hidden nodes, recap or announcements. Completed revealed discard/cash
and public operator/target facts may name cards. Actual operator destinations
determine discard/active/hand/suspension narration. Unknown event tags have no raw
dump fallback. Policies still receive only S08's fresh redacted observation;
UI log, events, errors and save data never become policy input.

## Required checks and evidence

Use the prerequisites from S02, then from the application root:

```sh
npm run typecheck
npm run test:contract
npm run build:web
npm run test:browser
```

Focused tests require the existing generated/native inputs documented in S07/S08.
`npm run verify` includes formatting (including introduced CSS), native/Melange,
types, original prototype/corpus/native/parity/full-game targets, fresh production
facade, both actual contract/integration targets, normal web build and real browser
checks. No empty/fallback/mocked-success path is allowed. Missing fixture/import,
unexpected exception or unavailable launch fails rather than becoming a passing
rejection. Native cache reuse proves no fresh native action/120-game execution.

| IDs     | Method / scope                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01–U02 | Named complete alternatives and every actual offered path at the existing literal phase/owner boundaries, both real facade targets. No independent legality search.                                                                     |
| U03     | Literal visible expectations for all24 event tags, operator destination variants, own/rival draw boundary and unknown-tag refusal.                                                                                                      |
| B01     | Normal development and actual built-static menu/new/opening/income/action/end/rival/ack/reload/Resume, actual human WIN001 activation8 and actual rival mirrored WIN001 finishing transition. Replaces the S02 probe-only product test. |
| B02     | Actual meaningful DOM selections submit independently specified commands/states across human families, all5 pending forms, wildcard/Docks, hand8 and ordered targets. B01 supplies normal opening.                                      |
| B03     | All5 rival pending forms, both inactive-owner directions, interruption/ack, one-step calls and cancellation on menu/new/resume.                                                                                                         |
| B04     | Admitted hidden draw twins compare complete DOM/attributes/announcements/recap only while authorized visible facts agree.                                                                                                               |
| B05/B08 | Save intentions, rejected/unknown/terminal eligibility, cancel/memory-only, consumed replacement, owned failure, recovery and unsaved live abandonment/Resume.                                                                          |
| B06–B07 | Real forwarded-result fault timing/no replay, retained old DOM candidates/current rejection and refreshed offered controls.                                                                                                             |

`tests/browser/ui.html`/`ui.ts` compose the same UI/controller with test-only seed,
storage failures, real forwarding instrumentation and queued task delivery.
They never fabricate successful gameplay or ship. Browser-side fixture preloading
is test-only and followed by actual menu/Resume; no production state endpoint,
query parameter or global is added. S08 B01 remains independently required.
Each browser method uses isolated contexts, actual loopback origin, local-only
requests, page-error observations, Chromium's own sandbox and awaited cleanup.
Ephemeral ports avoid unrelated listeners. Do not stop unknown/shared servers.

The bundle guard requires the sole public `tests/characterization/cards.json`
import and rejects all other test modules. Minimal `resolveJsonModule` and a CSS
type declaration support the existing toolchain. Preserve public catalog bytes,
native full-field equality/sensitivity checks, facade/declaration/engine/policy,
original fixtures, locks/tools and workflow. No runtime package/service is added.

For retained evidence, record exact source/tree, commands/exit codes, complete
results/adverse attempts, source/fixture/module/UI graph/output hashes, two-mode
outcomes, sandbox/page errors/origin and owned PID/profile/listener cleanup.
`CITY_UI_EVIDENCE_DIR` optionally stores normal-entry victory screenshots outside
the source tree. Separate author, independent and current hosted results from
human acceptance/dependency-order integration.

The known-failure path uses actual invalid/rejected saved bytes and a real
forwarded command decode fault in B05/B06; it must show preservation/pause without
replayed effects. U03's unknown-tag control refuses raw output. A missing required
UI fixture or generated import remains a failed measurement. Existing S07 loader
and S08 fixture/unavailability controls remain applicable; no unrelated source
mutation ceremony or second test runner is needed. Preserve failed logs and
restore/remove only owned temporary control files, never shared dependencies.

For the UI fixture-unavailable control, copy `tests/integration/ui.test.ts` to
`tests/integration/ui_control.test.ts`. In that isolated copy only, change the
U02 input `../policy/scenarios.json` to `../policy/required_s09_missing.json`.
Run `npm exec -- vitest run --config vitest.config.ts tests/integration/ui_control.test.ts -t S09-U02`.
It must exit nonzero with ENOENT. Retain the log, remove only that copy and confirm
the original suite hash is unchanged. The final aggregate must pass after cleanup.

To measure private-input rejection without writing outputs or changing source,
run the existing website bundle guard against the test-only entry:

```sh
node --input-type=module -e 'import { build } from "vite"; await build({ configFile: "vite.config.ts", build: { write: false, emptyOutDir: false, outDir: ".cache/s09-private-control-output", rolldownOptions: { input: process.cwd() + "/tests/browser/ui.html" } } });'
```

It must exit nonzero with **Private test inputs entered the website bundle**.
The control writes no output and cannot clear the normal `dist/`. Retain the
failed log; a normal `npm run build:web` must still pass with the public inventory
and zero private test modules. Missing-entry or unrelated build failures would
not validate this guard. The initial real-browser label failure followed by the
explicit native-label correction also demonstrates that B01 detects an unusable
opening control rather than passing a probe-only page.
