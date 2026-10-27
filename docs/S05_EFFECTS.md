# Card effects and complete games

The pure engine extends setup/economy with paid activation, whole operator
actions, optional defender interception, Arts swaps and final outcomes. Root
`index.html` remains the playable prototype; the modular browser still shows
the foundation probe. Policy/redaction, full facade stabilization, controller,
storage and gameplay UI remain later work.

## Authority and source records

[Issue #81](https://github.com/BoredSerf/City-of-Vice-Card-Game/issues/81) records
the bounded provisional S05 contract SHA-256
`cc71b5a8769320e40952c58876ab04c0d8a17310b8c8c646df0946e9276b7876`,
the independently verified prerequisite `f553191f2176c43e073129beceaba200a009cccc`
and the pending acceptance obligations. Original comparisons remain pinned to
`4ccb19703d4af1a1c202d922b514a58a17d0e537`; all original S01 observations and
approval labels are unchanged. [PD-002](decisions/PD-002-public-command-boundary.md)
remains the exact bounded approval for public rejection/automatic incoming income.
Detailed issues #61/#64/#65/#66/#73/#74 are provisional working choices under
the owner's direction to file assumptions and continue; they are not individual
human rule acceptance or approval of a PR.

[Effects fixtures](../tests/effects/scenarios.json) preserve 59 complete original
source records and stable step references. Source-comparison outcomes are separate
from explicit provisional corrections and supported-state negatives. The six
invalid helper inputs keep their gameplay invalidity after representation-only
conversion: capacity, active operators, possessed legits, inconsistent outcome
and noninitial Ready each fail their semantic state guard. Paired actual valid
states exercise the corresponding command guards. No public repair operation or
blanket helper exclusion is introduced.

Existing positive modular fixtures deliberately project schema/rules headers and
add false initial Arts flags. Original S01 embedded records stay unchanged.
Former unsupported terminal-shape tests now assert inconsistent supported
outcomes; tests for genuinely old layouts still reject unsupported versions.
Controlled histories are typed synthetic phase/turn context, not claimed full-game
transcripts. Exact expected states/facts come from source literals and the
contract; replacement-engine results do not author their expectations.

## Commands and atomic effects

All commands still use the five JSON-string facade exports documented in
[setup](S03_SETUP.md) and the maintained
[TypeScript declaration](../src/engine/generated-engine.d.ts). Four commands are
added; each submission also supplies `player_id`:

| Command              | Required payload and behavior                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `activate_card`      | `card_id`, `wildcard_payment:null` for automatic or an explicit color array. Pay printed cost, remove hand/suspension, append active. |
| `use_operator`       | `operator_id`, ordered `target_ids`. Validate the entire declaration/invoice/destinations before any offer, debit or effect.          |
| `trade_distributors` | `own_card_id`, `rival_card_id`. Pay both printed costs, swap exact active positions and mark this turn's Arts allowance used.         |
| `respond_intercept`  | Boolean `accept`. Only the pending defender can answer; there is no attacker cancellation or retarget command.                        |

Distributor capacity is three plus three per active legit. At most two active
operators and three possessed legits remain legal. Suspended acquisitions wait
in hand and later pay normal activation; space opening does not promote them.
Inactive cash remains the shared economy command for every category.

`Card_action` supplies one pure whole-action preflight shared by execution,
discovery and pending decode. It consumes the immutable `Player_state` record,
avoiding a State/Engine dependency cycle. Its transient result is not another
serialized board or rules authority. Shared fixed-first payment remains the only
payment implementation. No new card action or response consumes engine RNG.

Hitman pays each target's cost; Ruffian pays each selected target's color once
and returns that target followed by the remaining same-crew active order. Club
permits two distinct ordered targets; Ruffian crews must differ. Return overflow
at seven enters discard. Fixer pays twice each target cost and fills active slots
before suspended hand destinations; any unplaceable acquisition rejects the
whole command. Trailer completeness at declaration protects all defender
distributors through that one Hitman/Fixer action. Dispose the operator once,
after affected-card discard entries, before crew changes/outcome/cleanup.

Eligible Pipeline creates a defender-owned decision with no debit or effect.
Accept pays only the defender's printed operator activation cost, transfers the
operator active and cancels the attack. Decline pays the recorded attacker debit
once and resolves the complete action without another offer. Intent is checked
against the frozen live board on decode. Ordinary turn identity stays unchanged;
captured operators use ordinary ownership on their new owner's later turn.

Arts is unilateral and does not invoke Pipeline or Trailer. Losing/reacquiring
Arts preserves its used flag. Only actual incoming income resets that owner's
allowance. Crew gains grant no retrospective income; eligibility changes live.

After a whole card action, elimination has priority over twelve-business
expansion. A two-target action finishes both targets and disposal, even if the
first acquisition reaches twelve. Operator cards do not count as businesses.
If nonterminal Night loss leaves the inactive owner at eleven/twelve, that owner
must trim through the existing unit command; the active header/turn/price stay
unchanged. No resource choice is made for either player.

## Snapshot, history and terminal boundary

Schema is **2**, rules ID **`prototype_4ccb197_pd002_s05_working`**. Each player
requires boolean `traded_distributors`. Old interim layouts reject as unsupported;
no browser migration or persistence policy is supplied.

The new `intercept` pending object contains defender/attacker IDs, operator ID,
ordered target IDs and resolved attacker debit. `trim` can also carry the distinct
`post_action_trim` cause for an inactive Night-loss owner. Existing Docks, forced
cash and income-trim ownership/bounds remain: pre-draw old hand/legits must be
legal, pre-cash bank at most 25, post-cash income trim at most 26. Post-action
Night trim has only its eleven/twelve exception; the other owner must remain
within the live cap. Both players' legal lists use the actual pending owner.

Limited protocol validation retains strict setup/Ready, first synthetic handoff
anchor, subsequent exact relative rounds and once-only income. It adds only
current allowance, decision/answer/defender-payment context and the immediately
completed action's crew-loss/outcome cause. It is not a full replay solver.

`over` requires a consistent winner/reason, no pending decision and final
`game_finished` fact. Final banks freeze immediately and total at most twelve;
eleven/twelve without current Night requires that winning action's matching Night
loss and actual destinations. An old unrelated loss cannot explain excess.
Every later command rejects `game_over/phase` unchanged and discovery is empty.
The event is `game_finished`; `game_over` names the rejection, not an event.

Completed events describe actual ordered destinations, shared debit, single
disposal, crew changes, consent/transfer, swap and outcome. No UI animation,
timer, copied attack board, callback or hidden repair state enters the snapshot.

## Required checks and controls

Use the existing locked [foundation workflow](S02_FOUNDATION.md):

```sh
npm run build:native
npm run build:melange
npm run typecheck
npm run test:native
npm run test:contract
npm run verify
```

Native literal tests compare complete expected state/history/events, validate
every advertised command for both players and independently enumerate finite
command candidates at each distinct fixture boundary. Equivalent automatic or
fixed-only payment aliases must have an advertised equivalent public result;
ordered operator declarations remain distinct. Actual generated tests import
mandatory native parity, compare both player lists, execute every advertised
continuation and assert exact rejection bytes/empty facts. Native-only JSON syntax
and generated adapter syntax remain thin wrappers around the same pure codec.

The mandatory native simulation runs **120 complete games**, five pinned engine
seeds (`00000001`, `12345678`, `7fffffff`, `80000000`, `ffffffff`) times all 24
opening distributors. The verification driver groups currently discovered
commands by family, then selects family and command with its separate
`xorshift32_v1` stream. Per-game driver seed is `5eed0001` plus the zero-based
matrix index. This family-balanced-v1 fuzzer is test code, not the S06 rival
policy. The initial ceiling is 10,000 accepted public commands per game;
incomplete prefixes or no-continuation states fail. It independently asserts
physical/limit/resource/outcome predicates, deliberately rejects invalid actors,
records the entire command list and replays identical state/events/winner/cursor.
Its required Dune target `_build/default/test/simulation_replay.jsonl` retains
all 120 command lists and the completion summary without terminal-log truncation.
The driver has its own arbitrary-list selector and a literal 100-choice control;
the engine's card-oriented bounded selector is unchanged. No repair/helper bypass
is permitted.

The local S05 aggregate failure control changes the first `S01-ACTIVATE-001`
literal expected Black balance from zero to one without changing formatting.
`npm run verify` must reach and fail that new S05 effects
assertion. Restore exact good fixture bytes and rerun the full aggregate. Retain
failure/restoration/pass logs and exact tree identities. This demonstrates local
gate wiring; it supplies neither product acceptance nor hosted/human integration
evidence. All predecessor prototype/corpus/setup/economy/browser paths stay in
the cumulative gate.
