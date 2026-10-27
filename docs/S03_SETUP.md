# Deterministic engine setup

S03 implements the [deterministic setup slice](../IMPLEMENTATION.md#s03--deterministic-state-and-game-setup).
The pure OCaml `city_engine` library creates a session, discovers its opening
commands and performs `start_game`. It ends at turn 1, player 0, phase `ready`,
with zero resources. Initial income collection belongs to S04; the approved
[PD-002](decisions/PD-002-public-command-boundary.md) automatic-income handoff
applies to the later `end_turn` implementation. The first-turn assumption is
recorded in [issue #58](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/58).

This does not implement income, ordinary turns, crew effects, payments, drawing,
operators, victory, policies, controller, browser storage or legacy save migration.
The root prototype and separate S02 probe/browser shell remain in place.

## Domain and snapshots

`engine/*.mli` owns the authoritative domain types. Cards, immutable state,
commands, events, rejection codes, random-source state and the snapshot codec
compile natively without Melange, browser, storage, timer or network dependencies.
The card catalog retains all 36 physical IDs and original card inventory fields.
Active cards preserve activation order. Suspension is hand metadata, never a
second location for a physical card.

`Engine.create_session ~seed` returns `awaiting_opening`: turn 0, no active player,
empty player zones/resources and all 36 cards in catalog order in the deck.
Player 0 can choose any of the 24 distributors. The same legality function drives
command discovery and execution. Player 1 has no opening commands. After a valid
start, neither player has an executable S03 command to discover. New games use a
new session; repeating `start_game` on a started session rejects unchanged.

Snapshots have `schema_version: 1`, `rules_version: "prototype_4ccb197_pd002"`,
ordered zones, resources, phase/turn/player, RNG cursor and structured event
history. Outcome and pending decision fields are null in this slice. Only
`awaiting_opening` and the initial `ready` state are supported; later slices must
extend the decoder and its tests deliberately. These snapshots are trusted full
engine data, not redacted player-policy views. S06 owns the player boundary.

The shared `Wire_value` representation is ordinary pure JSON-shaped data.
`State.to_value` and `State.of_value` encode/decode and validate it once. Native
test support uses pinned Yojson 3.0.0 for JSON syntax, while `engine_js` uses the
installed Melange `Js.Json` API. Neither adapter implements game rules. The domain
does not import either JSON runtime, and there is no custom JSON text parser.
The native syntax adapter matches `JSON.parse` by retaining the last value when
an input JSON object repeats a name; both then use the same state decoder.

Validation rejects unsupported versions/RNG algorithms, malformed fields, unknown
phases, wrong player count, missing/duplicate/out-of-range cards, invalid initial
resources/draw prices/suspension, inconsistent turns/starters/history, and non-null
outcomes/pending choices. It validates this slice's emitted states rather than
claiming support for arbitrary future midgame or prototype saves. There is no
reachability solver or migration promise.

## Randomness and setup order

The replay algorithm is `xorshift32_v1`. Seed and cursor are exactly eight lowercase
hex digits, excluding all-zero. Each next word applies 32-bit xor/shift operations
13 left, 17 logical right, 5 left. Interpret that word as unsigned, divide by 2^32,
then take `floor(fraction * bound)` for a choice. This is game randomness, not a
cryptographic source. Its first five cursor words from `00000001` are:

```text
00042021 04080601 9dcca8c5 1255994f 8ef917d1
```

The engine shuffles IDs 0–35 with descending Fisher–Yates, removes the selected
starter, filters the still-shuffled deck for distributors of both a different
crew and color, then chooses/removes the rival starter. It deals three alternating
rounds, player 0 then player 1. Deck arrays are bottom-to-top: the final element is
drawn first. Setup consumes 35 shuffle words plus one rival-choice word. The
updated cursor survives serialization for later drawing. The standard OCaml and
Melange RNGs are not the replay contract.

Only `Engine.For_testing` accepts an injected choice source, for S01's existing
constant-0.999999 observation. It invokes the same validated setup implementation
and is not exported by the JavaScript facade. Production snapshots contain only
the named PRNG and cursor, never a function or test stream.

Events are completed facts in chronological order: `game_started`, two
`opening_distributor_chosen` events and two `initial_hand_dealt` counts. They carry
no UI copy, hidden hands or deck order. The structured history records the same
facts; future UI copy is derived outside the engine.

## Generated JSON facade

The actual Melange-generated module retains `probe` and adds four operations,
declared in [generated-engine.d.ts](../src/engine/generated-engine.d.ts):

```ts
create_session(seed: string): string;
perform_command(state_json: string, command_json: string): string;
legal_commands(state_json: string, player_json: string): string;
validate_state(state_json: string): string;
```

Results are documented JSON strings, not OCaml runtime objects. Creation,
submission and validation return `Command_result`: an accepted status with
`state_json` and typed `events`, or a rejected status with those fields plus typed
`rejection.code`/`field`. Rejected submissions preserve the supplied state string
byte-for-byte and emit no events. Invalid seed creation has null state. Legal
discovery returns accepted `commands`, or a typed rejected result. Rejection
codes are declared explicitly; copy belongs outside the engine.

Example caller using the generated module:

```ts
import { create_session, perform_command } from "@city-of-vice/engine";
import type { Command_result } from "@city-of-vice/engine";

const created = JSON.parse(create_session("00000001")) as Command_result;
if (created.status === "accepted") {
  const started = JSON.parse(
    perform_command(
      created.state_json,
      JSON.stringify({
        player_id: 0,
        command: "start_game",
        opening_distributor: 0,
      }),
    ),
  ) as Command_result;
  // Render events/state through the later controller; do not mutate engine data.
}
```

`legal_commands(state_json, "0")` supplies the numeric actor as JSON. Commands
require the actor plus the advertised command fields. Unknown commands and
malformed external values reject safely. No S04 command is advertised or executed.
The complete production/development facade stabilization remains S07.

## Verification and evidence

Use the exact prerequisites and locked bootstrap in
[S02_FOUNDATION.md](S02_FOUNDATION.md). The added native-only Yojson dependency is
pinned in both opam inputs. A deliberate lock update uses the installed solution
and a complete `opam lock`; normal bootstrap must preserve all lock bytes.

From the repository root:

```sh
npm run bootstrap
npm run browser:install
npm run verify
```

For focused checks with dependencies installed:

```sh
npm run build:native
npm run build:melange
npm run test:native
npm run typecheck
npm run test:contract
```

Run native tests before the contract suite: `dune runtest` generates
`_build/default/test/setup_parity.json` by executing the native setup implementation.
The existing `npm test` already enforces that ordering. Missing fixture evidence
fails the contract import; there is no skip or handwritten substitute. All new
native/contract checks join `npm run verify` through the existing required
aggregate. No generated JavaScript is copied or edited.

| Method                                | Coverage and limits                                                                                                                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/setup_test.ml` catalog case     | Reads every original `cards.json` field; checks IDs, 24 opening choices and eight three-card crews. An altered expected name is a failing comparison control.                                                                                                                 |
| Native `S01-SETUP-001` case           | Reads the existing scenario, random input and complete expected state. Compares exact zones/resources and a documented legacy-field/history projection. The original version/name mapping is test normalization, not a second engine. Altered expected deck fails comparison. |
| Native/generated `S01-SETUP-002` case | Reads the PD-002 golden record and executes its invalid opening as typed no-mutation rejection. Historical helper fallback remains unchanged in the legacy observation runner. The other five golden cases are not claimed as S03 executions.                                 |
| Native random/seed sweep              | Literal PRNG vectors and five seeds × all 24 legal openings; exact repeat state/events, invariants, RNG consumption and roundtrip continuation; successful and rejected calls preserve prior immutable state.                                                                 |
| Native validation matrix              | Real JSON roundtrips plus malformed/version/phase/card/player/resource/history/RNG and command controls. Negative inputs must produce errors instead of being repaired silently.                                                                                              |
| `tests/contract/setup.test.ts`        | Actual generated module against 120 native snapshots/events/RNG cursors, legal discovery, PD-002 correction, typed rejections, exact rejected input bytes, malformed external values and validation. Missing native evidence is an explicit negative control.                 |
| Existing aggregate                    | Formatting, native and Melange compilation, TypeScript, prototype/decision tests, standalone corpus, native/contract tests, static build and both browser probe modes remain required.                                                                                        |

These methods serve MVP-001–MVP-005 and incrementally exercise MVP-006A. Record the
source commit, exact command/environment, exit status and full output in review
evidence. A missing fixture/compiler/browser is a failed measurement, not a pass.
The test methods create only normal ignored Dune output; browser smoke retains
its existing cleanup. No persistence/storage or background process is created by
the setup fixtures. Full-game simulations and later command/rule coverage belong
to the slices that implement those behaviors.
