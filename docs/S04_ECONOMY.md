# Turn economy

S04 extends the pure OCaml setup engine with income, paid draw, cash, resource
trades, mandatory decisions and turn handoff. The browser still displays the S02
probe; root `index.html` remains the playable prototype. [S05 effects](S05_EFFECTS.md)
subsequently adds activation, operators and victory. Policies, controller,
storage and gameplay UI remain later work.

## Authority and fixtures

[Issue #72](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/72) records
the provisional implementation basis and reviewed contract SHA-256
`ba3427846ca231796f3cf04e56bfc88ab6e2978b0bb1bd859c37659bbfde3d09`.
Original comparisons use baseline `4ccb19703d4af1a1c202d922b514a58a17d0e537`;
observations are not blanket rule approval. [PD-002](decisions/PD-002-public-command-boundary.md)
approves repeated-income rejection and automatic incoming income on `end_turn`.
Crew, full-hand draw and cash-before-trim corrections remain provisional under
issues #61–63; initial income, round counting and interim codec/context assumptions
are recorded in #58/#72. Individual rule/PR acceptance remains pending.

[tests/economy/scenarios.json](../tests/economy/scenarios.json) is the separate
intended-expectation ledger: 43 unchanged original source records with partial-use
and exclusion notes, 79 literal command cases, 9 pure-payment cases, 33 invalid
snapshots and 2 admitted history-context controls. Expected deltas and ordered
facts come from source literals and the reviewed contract, never from the
replacement engine's resulting states. The original 92 observations and approval
metadata are unchanged.

Controlled income fixtures retain incoming zones/banks and use opposite-player
`play` followed by `end_turn`. Their setup/turn/income facts are explicitly
synthetic context, not reachable full-game transcripts. Legacy fields/colors are
normalized, UI logs become domain facts, and the S05 Arts allowance is omitted.
Referenced activation, AI and browser steps listed as excluded are not S04 claims.

## Commands and state

| Command               | Allowed phase and result                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `collect_income`      | Initial `ready` only; reset price, distributor income, Night Shift, Burbs, then cash/trim/play.                                 |
| `draw_card`           | `play`; explicit payment and boolean Docks choice, starting below seven hand cards; pay/increment once for one or two draws.    |
| `discard_draw_choice` | `draw_discard`; discard one recorded new card, then cash/trim/play.                                                             |
| `cash_card`           | `play` for any inactive category, or `legit_cash` for an inactive legit; printed color for non-legits, chosen color for legits. |
| `trim_resource`       | `trim`; choose one positive bank unit until the live cap holds, equally for both players.                                       |
| `trade_resources`     | `play`; four of one color for one different color, or two with complete Hill Country.                                           |
| `end_turn`            | `play`; switch once and collect incoming income, stopping at that player's decision.                                            |

Initial setup still returns turn 1/player 0/`ready` with zero income. Later
handoffs collect automatically once; 0→1 keeps the round, 1→0 increments it.
Mandatory order is Docks discard → fourth-legit cash → trim → play. Only
compulsory cash may credit above cap. Pre-cash banks are bounded at 25, post-cash
trim at 26; voluntary cash at cap rejects. Suspended-card cash removes its marker.

Night grants the least-held color after base income, ties in catalog order, and
changes cap ten→twelve while complete. Burbs skips a free draw when hand/pile
availability prevents it, without price/RNG changes or invoking Docks. Docks is
optional and needs two available cards before debit/shuffle. Discard resolution
cannot select an old hand card.

Pure payment reserves fixed colors before wildcard selections. Omitted wildcard
picks use largest remaining bank, ties in catalog order, debiting the copied bank
after each pick. Discovery lists one canonical payment per affordable multiset;
equivalent permutations are accepted. There is no public payment action.

Deck arrays remain bottom-to-top. Shuffle current discard only when the next draw
finds an empty deck. Docks may cross that boundary; its later discard cannot enter
the earlier shuffle. A one-card shuffle consumes no RNG word. Production retains
`xorshift32_v1`; original constant-stream comparisons use the native test seam.

The original S04 schema was 1 with rules ID `prototype_4ccb197_pd002_s04_working`.
S05 deliberately projects these fixtures to schema 2/its working identifier and
false initial Arts flags; old interim layouts reject unsupported. There is no
storage/migration feature. Awaiting/initial-ready validation stays strict. Other phases validate
card/capacity/resource/price bounds, suspension, pending owner/provenance and
current income/decision/header context. A first typed handoff may anchor a
controlled synthetic actor/round; subsequent handoffs count relatively. Anchoring
is not a wire operation or production counter exception. A phase-only flip cannot
skip income. S05 now validates native terminal outcomes; the prior terminal-shape
controls assert semantic outcome contradictions using its supported layout.

Docks admission also removes the two recorded new IDs locally and requires the
remaining pre-draw hand to contain fewer than seven cards and possess at most
three legits. The temporary eight-card/five-legit allowance applies only to those
two new cards. [Issue #76](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/76)
records the original failed checkpoint and this bounded correction; it adds no
full-history replay or repair action.

The existing five facade exports and JSON result envelopes remain. See
[generated-engine.d.ts](../src/engine/generated-engine.d.ts) for command/event/state
unions. Rejections preserve exact supplied state bytes and emit no success facts.
Events are chronological completed facts without UI copy. Full state/events are
trusted engine data; S06 owns redaction.

## Verification

Use the locked [foundation workflow](S02_FOUNDATION.md):

```sh
npm run build:native
npm run build:melange
npm run test:native
npm run typecheck
npm run test:contract
npm run verify
```

Native tests read literal inputs/expected deltas, compare complete state/history,
ordered events and rejection codes, exercise every advertised command, preserve
input/RNG, and round-trip every phase. They cover payment multisets, both actors,
the bounded multi-turn sequence, context/maximum-counter and cash-bound controls.
An admitted max-counter fixture uses a failing RNG callback to prove overflow
rejects before an incoming Burbs reshuffle.

`dune runtest` produces `_build/default/test/economy_parity.json`. The actual
generated-module suite imports it unconditionally and compares all 77 seeded
traces, legal choices and every new command/event/phase/rejection. Two historical
constant-source cases stay native-only; seeded and one-card controls cover the
generated reshuffle path. Setup regressions remain in the cumulative gate.

The issue #76 controls reject the exact four-old-legit counterexample and a
five-old-legit variant with a complete physical partition, plus a seven-old-card
hand. Both new-card choices remain executable at the valid three-old-legit and
six-old-card boundaries. The three-legit controls explicitly project the admitted
pending bank to its live cap, then assert literal discard→cash→trim→play results;
they do not claim reconstruction of the earlier payment. Native and actual
generated tests consume these same literals and check every advertised pending
resolution. Malformed facade inputs preserve their exact supplied bytes.

The required local failure control changes the first `S01-CASH-001` expected Black
credit 1→2 without changing formatting. `npm run verify` must reach the S04
assertion and fail on actual 1 versus expected 2. Restore exact good fixture bytes,
confirm identity/diff, and rerun to pass; retain both logs and source/tree IDs.
A formatting-only failure is insufficient. This proves local wiring, not S02
#56's required repository integration-block/failure/correction/pass acceptance.

Tests create normal ignored Dune/build outputs and the existing smoke-test
resources, whose cleanup is retained. No dependency, service or storage is added.
Full-game/victory/policy and complete production facade acceptance remain later work.
